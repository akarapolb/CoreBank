package org.fabor.ledger.adapter.persistence;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;
import javax.sql.DataSource;
import org.fabor.ledger.api.BatchPostedEvent;
import org.fabor.ledger.application.IdempotencyConflictException;
import org.fabor.ledger.application.InvalidReversalException;
import org.fabor.ledger.application.LedgerStore;
import org.fabor.ledger.domain.AccountId;
import org.fabor.ledger.domain.BalanceType;
import org.fabor.ledger.domain.BatchId;
import org.fabor.ledger.domain.Direction;
import org.fabor.ledger.domain.Entry;
import org.fabor.ledger.domain.PostingBatch;
import org.fabor.platform.money.Currency;
import org.fabor.platform.money.Money;
import org.fabor.platform.tenancy.IdempotencyKey;
import org.fabor.platform.tenancy.TenantId;

/**
 * Plain-JDBC ledger store shared by all databases. Vendor subclasses only say how to recognise a
 * unique-constraint violation. SQL here is the portable subset (no ON CONFLICT, no RETURNING).
 *
 * <p>Write path, one transaction: insert batch (unique keys give idempotency and single reversal),
 * insert entries, insert the outbox event. On a unique violation the transaction is rolled back and
 * the winner's committed row decides between replay and conflict.
 */
public abstract class JdbcLedgerStore implements LedgerStore {
    private static final int MAX_ATTEMPTS = 5;

    private final DataSource ds;
    private final java.util.Set<String> hotAccounts;
    private final int stripes;

    protected JdbcLedgerStore(DataSource ds) {
        this(ds, java.util.Set.of(), 1);
    }

    /**
     * @param hotAccounts account ids whose balances are striped over {@code stripes} rows; such accounts
     *                    cannot carry {@code requireFunds} entries (the sum of stripes is not locked)
     */
    protected JdbcLedgerStore(DataSource ds, java.util.Set<String> hotAccounts, int stripes) {
        this.ds = ds;
        this.hotAccounts = java.util.Set.copyOf(hotAccounts);
        this.stripes = Math.max(1, stripes);
    }

    /** SQL that adds a delta to a balance row, creating it if absent. Parameters: tenant, account, type, currency, stripe, delta. */
    protected abstract String upsertBalanceSql();

    /** True if the failure is a deadlock or serialization failure that is safe to retry. */
    protected abstract boolean isRetryable(SQLException e);

    /** True if the exception is a unique/primary key violation; the message names the constraint. */
    protected abstract boolean isUniqueViolation(SQLException e);

    @Override
    public PostResult append(PostingBatch batch, Instant recordedAt) {
        if (batch.reverses().isPresent()) {
            checkReversible(batch);
        }
        for (int attempt = 1; ; attempt++) {
            try (Connection c = ds.getConnection()) {
                c.setAutoCommit(false);
                try {
                    insert(c, batch, recordedAt);
                    c.commit();
                    return new PostResult(new StoredBatch(batch, recordedAt), false);
                } catch (SQLException e) {
                    c.rollback();
                    if (isRetryable(e) && attempt < MAX_ATTEMPTS) {
                        continue;
                    }
                    if (isUniqueViolation(e)) {
                        Optional<PostResult> resolved = resolveConflict(batch, e);
                        if (resolved.isPresent()) {
                            return resolved.get();
                        }
                        if (attempt < MAX_ATTEMPTS) {
                            continue; // lost a race creating a balance row; nothing was committed
                        }
                    }
                    throw new IllegalStateException("Ledger append failed", e);
                } catch (RuntimeException e) {
                    c.rollback();
                    throw e;
                }
            } catch (SQLException e) {
                throw new IllegalStateException("Ledger append failed", e);
            }
        }
    }

    /**
     * Appends many batches in one transaction (one commit, one log flush). Each batch gets its own
     * savepoint so a duplicate key or id fails only that batch. Returns one entry per input: a
     * {@link PostResult} or the exception that batch would have thrown from {@link #append}.
     * Reversals are not allowed here: they must see their original already committed.
     */
    public List<Object> appendAll(List<PostingBatch> batches, List<Instant> recordedAt) {
        for (int attempt = 1; ; attempt++) {
            Object[] out = new Object[batches.size()];
            SQLException[] deferred = new SQLException[batches.size()];
            try (Connection c = ds.getConnection()) {
                c.setAutoCommit(false);
                try {
                    java.util.TreeMap<BalanceKey, Long> net = new java.util.TreeMap<>();
                    for (int i = 0; i < batches.size(); i++) {
                        PostingBatch b = batches.get(i);
                        if (b.entries().stream().anyMatch(Entry::requireFunds)) {
                            throw new IllegalArgumentException("requireFunds batches must use append, not appendAll");
                        }
                        java.sql.Savepoint sp = c.setSavepoint();
                        try {
                            insertRows(c, b, recordedAt.get(i));
                            addNet(net, b);
                            out[i] = new PostResult(new StoredBatch(b, recordedAt.get(i)), false);
                        } catch (SQLException e) {
                            if (isRetryable(e)) {
                                throw e;
                            }
                            c.rollback(sp);
                            if (isUniqueViolation(e)) {
                                deferred[i] = e;
                            } else {
                                out[i] = new IllegalStateException("Ledger append failed", e);
                            }
                        } catch (RuntimeException e) {
                            c.rollback(sp);
                            out[i] = e;
                        }
                    }
                    // one pass over every balance the group touched, in global key order: a hot account
                    // is updated once per group instead of once per batch
                    applyNet(c, net, stripeFor(batches.get(0)));
                    c.commit();
                } catch (SQLException | RuntimeException e) {
                    c.rollback();
                    throw e;
                }
            } catch (SQLException e) {
                if (isRetryable(e) && attempt < MAX_ATTEMPTS) {
                    continue;
                }
                IllegalStateException failure = new IllegalStateException("Ledger group append failed", e);
                return java.util.Collections.nCopies(batches.size(), failure);
            }
            for (int i = 0; i < out.length; i++) {
                if (deferred[i] != null) {
                    PostingBatch b = batches.get(i);
                    try {
                        Optional<PostResult> r = resolveConflict(b, deferred[i]);
                        out[i] = r.isPresent() ? r.get() : append(b, recordedAt.get(i));
                    } catch (RuntimeException e) {
                        out[i] = e;
                    }
                }
            }
            return java.util.Arrays.asList(out);
        }
    }

    private void insert(Connection c, PostingBatch b, Instant recordedAt) throws SQLException {
        insertRows(c, b, recordedAt);
        applyBalances(c, b);
    }

    private void insertRows(Connection c, PostingBatch b, Instant recordedAt) throws SQLException {
        String tenant = b.tenant().value();
        OffsetDateTime at = recordedAt.atOffset(ZoneOffset.UTC);
        try (PreparedStatement ps = c.prepareStatement(
                "INSERT INTO ledger_batch (tenant, batch_id, idem_key, content_hash, value_date, recorded_at, "
                        + "reverses_batch) VALUES (?,?,?,?,?,?,?)")) {
            ps.setString(1, tenant);
            ps.setString(2, b.id().value());
            ps.setString(3, b.key().value());
            ps.setString(4, hash(b));
            ps.setObject(5, b.valueDate());
            ps.setObject(6, at);
            ps.setString(7, b.reverses().map(BatchId::value).orElse(null));
            ps.executeUpdate();
        }
        try (PreparedStatement ps = c.prepareStatement(
                "INSERT INTO ledger_entry (tenant, batch_id, seq, account, balance_type, direction, minor, currency, "
                        + "minor_units, value_date, recorded_at, require_funds) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)")) {
            int seq = 0;
            for (Entry e : b.entries()) {
                ps.setString(1, tenant);
                ps.setString(2, b.id().value());
                ps.setInt(3, seq++);
                ps.setString(4, e.account().value());
                ps.setString(5, e.type().name());
                ps.setString(6, e.direction().name());
                ps.setLong(7, e.amount().minor());
                ps.setString(8, e.amount().currency().code());
                ps.setInt(9, e.amount().currency().minorUnits());
                ps.setObject(10, b.valueDate());
                ps.setObject(11, at);
                ps.setInt(12, e.requireFunds() ? 1 : 0);
                ps.addBatch();
            }
            ps.executeBatch();
        }
        try (PreparedStatement ps = c.prepareStatement(
                "INSERT INTO ledger_outbox (tenant, aggregate_id, event_type, payload, created_at) VALUES (?,?,?,?,?)")) {
            ps.setString(1, tenant);
            ps.setString(2, b.id().value());
            ps.setString(3, BatchPostedEvent.TYPE);
            ps.setString(4, event(b, recordedAt).toJson());
            ps.setObject(5, at);
            ps.executeUpdate();
        }
    }

    private record BalanceKey(String tenant, String account, String type, String currency)
            implements Comparable<BalanceKey> {
        @Override
        public int compareTo(BalanceKey o) {
            int c = tenant.compareTo(o.tenant);
            if (c == 0) {
                c = account.compareTo(o.account);
            }
            if (c == 0) {
                c = type.compareTo(o.type);
            }
            return c == 0 ? currency.compareTo(o.currency) : c;
        }
    }

    private static void addNet(java.util.TreeMap<BalanceKey, Long> net, PostingBatch b) {
        for (Entry e : b.entries()) {
            net.merge(new BalanceKey(b.tenant().value(), e.account().value(), e.type().name(),
                    e.amount().currency().code()), e.signedMinor(), Math::addExact);
        }
    }

    /**
     * Applies net balance effects, locking rows in sorted key order so concurrent transactions cannot
     * deadlock on each other (first-touch inserts can still collide; those are retried).
     */
    private void applyNet(Connection c, java.util.TreeMap<BalanceKey, Long> net, int stripe) throws SQLException {
        try (PreparedStatement ps = c.prepareStatement(upsertBalanceSql())) {
            for (var en : net.entrySet()) {
                BalanceKey k = en.getKey();
                ps.setString(1, k.tenant());
                ps.setString(2, k.account());
                ps.setString(3, k.type());
                ps.setString(4, k.currency());
                ps.setInt(5, hotAccounts.contains(k.account()) ? stripe : 0);
                ps.setLong(6, en.getValue());
                ps.executeUpdate();
            }
        }
    }

    private int stripeFor(PostingBatch b) {
        return stripes > 1 ? Math.floorMod(b.id().value().hashCode(), stripes) : 0;
    }

    /** Single-batch path: apply the batch's balances, then check every requireFunds bucket. */
    private void applyBalances(Connection c, PostingBatch b) throws SQLException {
        java.util.TreeMap<BalanceKey, Long> net = new java.util.TreeMap<>();
        addNet(net, b);
        java.util.Set<BalanceKey> guarded = new java.util.TreeSet<>();
        for (Entry e : b.entries()) {
            if (e.requireFunds()) {
                if (hotAccounts.contains(e.account().value())) {
                    throw new IllegalArgumentException(
                            "requireFunds is not supported on striped account " + e.account().value());
                }
                guarded.add(new BalanceKey(b.tenant().value(), e.account().value(), e.type().name(),
                        e.amount().currency().code()));
            }
        }
        applyNet(c, net, stripeFor(b));
        for (BalanceKey k : guarded) {
            try (PreparedStatement ps = c.prepareStatement(
                    "SELECT COALESCE(SUM(minor), 0) FROM ledger_balance "
                            + "WHERE tenant = ? AND account = ? AND balance_type = ? AND currency = ?")) {
                ps.setString(1, k.tenant());
                ps.setString(2, k.account());
                ps.setString(3, k.type());
                ps.setString(4, k.currency());
                try (ResultSet rs = ps.executeQuery()) {
                    rs.next();
                    if (rs.getLong(1) < 0) {
                        throw new org.fabor.ledger.application.InsufficientFundsException(
                                "Insufficient funds on " + k.account());
                    }
                }
            }
        }
    }

    @Override
    public List<EntryRecord> entries(TenantId tenant, AccountId account, BalanceType type, Currency currency, LocalDate asOf,
                                     int limit) {
        if (limit < 1 || limit > 500) {
            throw new IllegalArgumentException("limit must be 1..500");
        }
        try (Connection c = ds.getConnection();
             PreparedStatement ps = c.prepareStatement(
                     "SELECT batch_id, value_date, recorded_at, direction, minor FROM ledger_entry "
                             + "WHERE tenant = ? AND account = ? AND balance_type = ? AND currency = ? AND value_date <= ? "
                             + "ORDER BY value_date DESC, recorded_at DESC, batch_id DESC, seq DESC FETCH FIRST " + limit + " ROWS ONLY")) {
            ps.setString(1, tenant.value());
            ps.setString(2, account.value());
            ps.setString(3, type.name());
            ps.setString(4, currency.code());
            ps.setObject(5, asOf);
            try (ResultSet rs = ps.executeQuery()) {
                List<EntryRecord> out = new ArrayList<>();
                while (rs.next()) {
                    out.add(new EntryRecord(new BatchId(rs.getString(1)), rs.getObject(2, LocalDate.class),
                            rs.getObject(3, OffsetDateTime.class).toInstant(), Direction.valueOf(rs.getString(4)),
                            Money.ofMinor(rs.getLong(5), currency)));
                }
                return out;
            }
        } catch (SQLException e) {
            throw new IllegalStateException("Ledger entries failed", e);
        }
    }

    @Override
    public List<AccountId> accounts(TenantId tenant) {
        try (Connection c = ds.getConnection();
             PreparedStatement ps = c.prepareStatement(
                     "SELECT DISTINCT account FROM ledger_balance WHERE tenant = ? ORDER BY account")) {
            ps.setString(1, tenant.value());
            try (ResultSet rs = ps.executeQuery()) {
                List<AccountId> out = new ArrayList<>();
                while (rs.next()) {
                    out.add(new AccountId(rs.getString(1)));
                }
                return out;
            }
        } catch (SQLException e) {
            throw new IllegalStateException("Ledger accounts failed", e);
        }
    }

    @Override
    public Money currentBalance(TenantId tenant, AccountId account, BalanceType type, Currency currency) {
        try (Connection c = ds.getConnection();
             PreparedStatement ps = c.prepareStatement(
                     "SELECT COALESCE(SUM(minor), 0) FROM ledger_balance "
                             + "WHERE tenant = ? AND account = ? AND balance_type = ? AND currency = ?")) {
            ps.setString(1, tenant.value());
            ps.setString(2, account.value());
            ps.setString(3, type.name());
            ps.setString(4, currency.code());
            try (ResultSet rs = ps.executeQuery()) {
                rs.next();
                return Money.ofMinor(rs.getLong(1), currency);
            }
        } catch (SQLException e) {
            throw new IllegalStateException("Ledger balance failed", e);
        }
    }

    private void checkReversible(PostingBatch b) {
        BatchId target = b.reverses().orElseThrow();
        StoredBatch original = find(b.tenant(), target)
                .orElseThrow(() -> new InvalidReversalException("Unknown batch " + target.value()));
        if (original.batch().reverses().isPresent()) {
            throw new InvalidReversalException("A reversal cannot be reversed");
        }
    }

    /** Empty means neither the key nor the id exists: the violation was a balance-row race, so retry. */
    private Optional<PostResult> resolveConflict(PostingBatch b, SQLException cause) {
        Optional<StoredBatch> sameKey = findByKey(b.tenant(), b.key());
        if (sameKey.isPresent()) {
            if (!sameKey.get().batch().equals(b)) {
                throw new IdempotencyConflictException("Key reused with different content: " + b.key().value());
            }
            return Optional.of(new PostResult(sameKey.get(), true));
        }
        if (b.reverses().isPresent() && String.valueOf(cause.getMessage()).toLowerCase().contains("uq_ledger_batch_reverses")) {
            throw new InvalidReversalException("Batch already reversed: " + b.reverses().get().value());
        }
        if (find(b.tenant(), b.id()).isPresent()) {
            throw new IdempotencyConflictException("Batch id already used: " + b.id().value());
        }
        return Optional.empty();
    }

    @Override
    public Optional<StoredBatch> find(TenantId tenant, BatchId id) {
        return load(tenant, "batch_id", id.value());
    }

    private Optional<StoredBatch> findByKey(TenantId tenant, IdempotencyKey key) {
        return load(tenant, "idem_key", key.value());
    }

    private Optional<StoredBatch> load(TenantId tenant, String column, String value) {
        try (Connection c = ds.getConnection();
             PreparedStatement head = c.prepareStatement(
                     "SELECT batch_id, idem_key, value_date, recorded_at, reverses_batch FROM ledger_batch "
                             + "WHERE tenant = ? AND " + column + " = ?");
             PreparedStatement lines = c.prepareStatement(
                     "SELECT account, balance_type, direction, minor, currency, minor_units, require_funds FROM ledger_entry "
                             + "WHERE tenant = ? AND batch_id = ? ORDER BY seq")) {
            head.setString(1, tenant.value());
            head.setString(2, value);
            try (ResultSet rs = head.executeQuery()) {
                if (!rs.next()) {
                    return Optional.empty();
                }
                BatchId id = new BatchId(rs.getString(1));
                IdempotencyKey key = new IdempotencyKey(rs.getString(2));
                LocalDate valueDate = rs.getObject(3, LocalDate.class);
                Instant recorded = rs.getObject(4, OffsetDateTime.class).toInstant();
                Optional<BatchId> reverses = Optional.ofNullable(rs.getString(5)).map(BatchId::new);
                lines.setString(1, tenant.value());
                lines.setString(2, id.value());
                List<Entry> entries = new ArrayList<>();
                try (ResultSet er = lines.executeQuery()) {
                    while (er.next()) {
                        Currency cur = new Currency(er.getString(5).trim(), er.getInt(6));
                        entries.add(new Entry(new AccountId(er.getString(1)), BalanceType.valueOf(er.getString(2)),
                                Direction.valueOf(er.getString(3)), Money.ofMinor(er.getLong(4), cur),
                                er.getInt(7) == 1));
                    }
                }
                return Optional.of(new StoredBatch(new PostingBatch(tenant, id, key, valueDate, entries, reverses),
                        recorded));
            }
        } catch (SQLException e) {
            throw new IllegalStateException("Ledger read failed", e);
        }
    }

    @Override
    public Money balance(TenantId tenant, AccountId account, BalanceType type, Currency currency,
                         LocalDate valueAsOf, Instant recordedAsOf) {
        try (Connection c = ds.getConnection();
             PreparedStatement ps = c.prepareStatement(
                     "SELECT COALESCE(SUM(CASE direction WHEN 'CREDIT' THEN minor ELSE -minor END), 0) FROM ledger_entry "
                             + "WHERE tenant = ? AND account = ? AND balance_type = ? AND currency = ? "
                             + "AND value_date <= ? AND recorded_at <= ?")) {
            ps.setString(1, tenant.value());
            ps.setString(2, account.value());
            ps.setString(3, type.name());
            ps.setString(4, currency.code());
            ps.setObject(5, valueAsOf);
            ps.setObject(6, recordedAsOf.atOffset(ZoneOffset.UTC));
            try (ResultSet rs = ps.executeQuery()) {
                rs.next();
                return Money.ofMinor(rs.getLong(1), currency);
            }
        } catch (SQLException e) {
            throw new IllegalStateException("Ledger balance failed", e);
        }
    }

    private static BatchPostedEvent event(PostingBatch b, Instant recordedAt) {
        return new BatchPostedEvent(b.tenant().value(), b.id().value(), b.key().value(), b.valueDate().toString(),
                recordedAt.toString(), b.reverses().map(BatchId::value).orElse(""),
                b.entries().stream().map(e -> new BatchPostedEvent.Line(e.account().value(), e.type().name(),
                        e.direction().name(), e.amount().minor(), e.amount().currency().code())).toList());
    }

    private static String hash(PostingBatch b) {
        StringBuilder sb = new StringBuilder();
        sb.append(b.id().value()).append('|').append(b.valueDate()).append('|')
                .append(b.reverses().map(BatchId::value).orElse("-"));
        for (Entry e : b.entries()) {
            sb.append('|').append(e.account().value()).append(',').append(e.type()).append(',')
                    .append(e.direction()).append(',').append(e.amount().minor()).append(',')
                    .append(e.amount().currency().code()).append(',').append(e.requireFunds());
        }
        try {
            return HexFormat.of().formatHex(
                    MessageDigest.getInstance("SHA-256").digest(sb.toString().getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}

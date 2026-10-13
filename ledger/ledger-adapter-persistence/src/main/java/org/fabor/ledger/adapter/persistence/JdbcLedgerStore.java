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
    private final DataSource ds;

    protected JdbcLedgerStore(DataSource ds) {
        this.ds = ds;
    }

    /** True if the exception is a unique/primary key violation; the message names the constraint. */
    protected abstract boolean isUniqueViolation(SQLException e);

    @Override
    public PostResult append(PostingBatch batch, Instant recordedAt) {
        if (batch.reverses().isPresent()) {
            checkReversible(batch);
        }
        try (Connection c = ds.getConnection()) {
            c.setAutoCommit(false);
            try {
                insert(c, batch, recordedAt);
                c.commit();
                return new PostResult(new StoredBatch(batch, recordedAt), false);
            } catch (SQLException e) {
                c.rollback();
                if (isUniqueViolation(e)) {
                    return resolveConflict(batch, e);
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

    private void insert(Connection c, PostingBatch b, Instant recordedAt) throws SQLException {
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
                        + "minor_units, value_date, recorded_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)")) {
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

    private void checkReversible(PostingBatch b) {
        BatchId target = b.reverses().orElseThrow();
        StoredBatch original = find(b.tenant(), target)
                .orElseThrow(() -> new InvalidReversalException("Unknown batch " + target.value()));
        if (original.batch().reverses().isPresent()) {
            throw new InvalidReversalException("A reversal cannot be reversed");
        }
    }

    private PostResult resolveConflict(PostingBatch b, SQLException cause) {
        Optional<StoredBatch> sameKey = findByKey(b.tenant(), b.key());
        if (sameKey.isPresent()) {
            if (!sameKey.get().batch().equals(b)) {
                throw new IdempotencyConflictException("Key reused with different content: " + b.key().value());
            }
            return new PostResult(sameKey.get(), true);
        }
        if (b.reverses().isPresent() && String.valueOf(cause.getMessage()).toLowerCase().contains("uq_ledger_batch_reverses")) {
            throw new InvalidReversalException("Batch already reversed: " + b.reverses().get().value());
        }
        throw new IdempotencyConflictException("Batch id already used: " + b.id().value());
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
                     "SELECT account, balance_type, direction, minor, currency, minor_units FROM ledger_entry "
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
                                Direction.valueOf(er.getString(3)), Money.ofMinor(er.getLong(4), cur)));
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
                    .append(e.amount().currency().code());
        }
        try {
            return HexFormat.of().formatHex(
                    MessageDigest.getInstance("SHA-256").digest(sb.toString().getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}

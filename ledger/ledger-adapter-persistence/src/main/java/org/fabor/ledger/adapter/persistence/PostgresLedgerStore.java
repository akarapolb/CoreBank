package org.fabor.ledger.adapter.persistence;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.sql.Connection;
import java.sql.Date;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;
import javax.sql.DataSource;
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

/** PostgreSQL {@link LedgerStore} in plain JDBC. Idempotency and single-reversal are enforced by unique constraints. */
public final class PostgresLedgerStore implements LedgerStore {
    private static final String UNIQUE_VIOLATION = "23505";

    private final DataSource ds;

    public PostgresLedgerStore(DataSource ds) {
        this.ds = ds;
    }

    @Override
    public PostResult append(PostingBatch batch, Instant recordedAt) {
        try (Connection c = ds.getConnection()) {
            c.setAutoCommit(false);
            try {
                PostResult result = appendTx(c, batch, recordedAt);
                c.commit();
                return result;
            } catch (SQLException | RuntimeException e) {
                c.rollback();
                throw e;
            }
        } catch (SQLException e) {
            throw new IllegalStateException("Ledger append failed", e);
        }
    }

    private PostResult appendTx(Connection c, PostingBatch b, Instant recordedAt) throws SQLException {
        String tenant = b.tenant().value();
        String hash = hash(b);
        if (b.reverses().isPresent()) {
            checkReversible(c, tenant, b.reverses().get());
        }
        int inserted;
        try (PreparedStatement ps = c.prepareStatement(
                "INSERT INTO ledger_batch (tenant, batch_id, idem_key, content_hash, value_date, recorded_at, reverses_batch) "
                        + "VALUES (?,?,?,?,?,?,?) ON CONFLICT (tenant, idem_key) DO NOTHING")) {
            ps.setString(1, tenant);
            ps.setString(2, b.id().value());
            ps.setString(3, b.key().value());
            ps.setString(4, hash);
            ps.setDate(5, Date.valueOf(b.valueDate()));
            ps.setTimestamp(6, Timestamp.from(recordedAt));
            ps.setString(7, b.reverses().map(BatchId::value).orElse(null));
            inserted = ps.executeUpdate();
        } catch (SQLException e) {
            if (UNIQUE_VIOLATION.equals(e.getSQLState())) {
                String detail = String.valueOf(e.getMessage());
                if (detail.contains("uq_ledger_batch_reverses")) {
                    throw new InvalidReversalException("Batch already reversed: " + b.reverses().orElseThrow().value());
                }
                throw new IdempotencyConflictException("Batch id already used: " + b.id().value());
            }
            throw e;
        }
        if (inserted == 0) {
            return replayOrConflict(c, b, hash);
        }
        int seq = 0;
        try (PreparedStatement ps = c.prepareStatement(
                "INSERT INTO ledger_entry (tenant, batch_id, seq, account, balance_type, direction, minor, currency, "
                        + "minor_units, value_date, recorded_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)")) {
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
                ps.setDate(10, Date.valueOf(b.valueDate()));
                ps.setTimestamp(11, Timestamp.from(recordedAt));
                ps.addBatch();
            }
            ps.executeBatch();
        }
        return new PostResult(new StoredBatch(b, recordedAt), false);
    }

    private void checkReversible(Connection c, String tenant, BatchId target) throws SQLException {
        try (PreparedStatement ps = c.prepareStatement(
                "SELECT reverses_batch FROM ledger_batch WHERE tenant = ? AND batch_id = ?")) {
            ps.setString(1, tenant);
            ps.setString(2, target.value());
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    throw new InvalidReversalException("Unknown batch " + target.value());
                }
                if (rs.getString(1) != null) {
                    throw new InvalidReversalException("A reversal cannot be reversed");
                }
            }
        }
    }

    private PostResult replayOrConflict(Connection c, PostingBatch b, String hash) throws SQLException {
        try (PreparedStatement ps = c.prepareStatement(
                "SELECT batch_id, content_hash, recorded_at FROM ledger_batch WHERE tenant = ? AND idem_key = ?")) {
            ps.setString(1, b.tenant().value());
            ps.setString(2, b.key().value());
            try (ResultSet rs = ps.executeQuery()) {
                rs.next();
                if (!hash.equals(rs.getString(2))) {
                    throw new IdempotencyConflictException("Key reused with different content: " + b.key().value());
                }
                Instant at = rs.getTimestamp(3).toInstant();
                return new PostResult(new StoredBatch(b, at), true);
            }
        }
    }

    @Override
    public Optional<StoredBatch> find(TenantId tenant, BatchId id) {
        try (Connection c = ds.getConnection();
             PreparedStatement head = c.prepareStatement(
                     "SELECT idem_key, value_date, recorded_at, reverses_batch FROM ledger_batch "
                             + "WHERE tenant = ? AND batch_id = ?");
             PreparedStatement lines = c.prepareStatement(
                     "SELECT account, balance_type, direction, minor, currency, minor_units FROM ledger_entry "
                             + "WHERE tenant = ? AND batch_id = ? ORDER BY seq")) {
            head.setString(1, tenant.value());
            head.setString(2, id.value());
            try (ResultSet rs = head.executeQuery()) {
                if (!rs.next()) {
                    return Optional.empty();
                }
                IdempotencyKey key = new IdempotencyKey(rs.getString(1));
                LocalDate value = rs.getDate(2).toLocalDate();
                Instant recorded = rs.getTimestamp(3).toInstant();
                Optional<BatchId> reverses = Optional.ofNullable(rs.getString(4)).map(BatchId::new);
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
                return Optional.of(new StoredBatch(new PostingBatch(tenant, id, key, value, entries, reverses), recorded));
            }
        } catch (SQLException e) {
            throw new IllegalStateException("Ledger find failed", e);
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
            ps.setDate(5, Date.valueOf(valueAsOf));
            ps.setTimestamp(6, Timestamp.from(recordedAsOf));
            try (ResultSet rs = ps.executeQuery()) {
                rs.next();
                return Money.ofMinor(rs.getLong(1), currency);
            }
        } catch (SQLException e) {
            throw new IllegalStateException("Ledger balance failed", e);
        }
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

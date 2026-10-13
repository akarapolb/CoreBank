package org.fabor.scheduler.persistence;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import javax.sql.DataSource;
import org.fabor.platform.tenancy.TenantId;
import org.fabor.scheduler.Claimed;
import org.fabor.scheduler.DueQueueStore;
import org.fabor.scheduler.Task;

/** PostgreSQL due queue: leases with {@code FOR UPDATE SKIP LOCKED}, so any number of workers can run per shard. */
public final class PostgresDueQueue implements DueQueueStore {
    private final DataSource ds;

    public PostgresDueQueue(DataSource ds) {
        this.ds = ds;
    }

    private static OffsetDateTime odt(Instant i) {
        return i.atOffset(ZoneOffset.UTC);
    }

    @Override
    public boolean enqueue(Task t) {
        try (Connection c = ds.getConnection();
             PreparedStatement ps = c.prepareStatement(
                     "INSERT INTO scheduler_due (tenant, task_key, task_type, arrangement_id, payload, due_at) "
                             + "VALUES (?,?,?,?,?,?) ON CONFLICT (tenant, task_key) DO NOTHING")) {
            ps.setString(1, t.tenant().value());
            ps.setString(2, t.key());
            ps.setString(3, t.type());
            ps.setString(4, t.arrangementId());
            ps.setString(5, t.payload());
            ps.setObject(6, odt(t.dueAt()));
            return ps.executeUpdate() == 1;
        } catch (SQLException e) {
            throw new IllegalStateException("enqueue failed", e);
        }
    }

    @Override
    public List<Claimed> claim(Instant now, int limit, Instant leaseUntil) {
        try (Connection c = ds.getConnection()) {
            c.setAutoCommit(false);
            try (PreparedStatement sel = c.prepareStatement(
                    "SELECT id, tenant, task_key, task_type, arrangement_id, payload, due_at, attempts FROM scheduler_due "
                            + "WHERE NOT dead AND due_at <= ? AND (lease_until IS NULL OR lease_until <= ?) "
                            + "ORDER BY due_at, id FETCH FIRST ? ROWS ONLY FOR UPDATE SKIP LOCKED");
                 PreparedStatement upd = c.prepareStatement(
                         "UPDATE scheduler_due SET lease_until = ?, token = ?, attempts = attempts + 1 WHERE id = ?")) {
                sel.setObject(1, odt(now));
                sel.setObject(2, odt(now));
                sel.setInt(3, limit);
                List<Claimed> out = new ArrayList<>();
                try (ResultSet rs = sel.executeQuery()) {
                    while (rs.next()) {
                        String token = UUID.randomUUID().toString();
                        Task t = new Task(new TenantId(rs.getString(2)), rs.getString(3), rs.getString(4), rs.getString(5),
                                rs.getObject(7, OffsetDateTime.class).toInstant(), rs.getString(6));
                        out.add(new Claimed(rs.getLong(1), t, token, rs.getInt(8) + 1));
                    }
                }
                for (Claimed cl : out) {
                    upd.setObject(1, odt(leaseUntil));
                    upd.setString(2, cl.token());
                    upd.setLong(3, cl.id());
                    upd.addBatch();
                }
                upd.executeBatch();
                c.commit();
                return out;
            } catch (SQLException | RuntimeException e) {
                c.rollback();
                throw e;
            }
        } catch (SQLException e) {
            throw new IllegalStateException("claim failed", e);
        }
    }

    @Override
    public boolean complete(Claimed claimed, Optional<Instant> nextDue) {
        String sql = nextDue.isPresent()
                ? "UPDATE scheduler_due SET due_at = ?, lease_until = NULL, token = NULL, attempts = 0 WHERE id = ? AND token = ?"
                : "DELETE FROM scheduler_due WHERE id = ? AND token = ?";
        try (Connection c = ds.getConnection(); PreparedStatement ps = c.prepareStatement(sql)) {
            int i = 1;
            if (nextDue.isPresent()) {
                ps.setObject(i++, odt(nextDue.get()));
            }
            ps.setLong(i++, claimed.id());
            ps.setString(i, claimed.token());
            return ps.executeUpdate() == 1;
        } catch (SQLException e) {
            throw new IllegalStateException("complete failed", e);
        }
    }

    @Override
    public boolean fail(Claimed claimed, Instant retryAt, boolean dead, String error) {
        try (Connection c = ds.getConnection();
             PreparedStatement ps = c.prepareStatement(
                     "UPDATE scheduler_due SET due_at = ?, lease_until = NULL, token = NULL, dead = ?, last_error = ? "
                             + "WHERE id = ? AND token = ?")) {
            ps.setObject(1, odt(retryAt));
            ps.setBoolean(2, dead);
            ps.setString(3, error);
            ps.setLong(4, claimed.id());
            ps.setString(5, claimed.token());
            return ps.executeUpdate() == 1;
        } catch (SQLException e) {
            throw new IllegalStateException("fail failed", e);
        }
    }

    @Override
    public List<Task> dead() {
        try (Connection c = ds.getConnection();
             PreparedStatement ps = c.prepareStatement(
                     "SELECT tenant, task_key, task_type, arrangement_id, payload, due_at FROM scheduler_due WHERE dead ORDER BY id");
             ResultSet rs = ps.executeQuery()) {
            List<Task> out = new ArrayList<>();
            while (rs.next()) {
                out.add(new Task(new TenantId(rs.getString(1)), rs.getString(2), rs.getString(3), rs.getString(4),
                        rs.getObject(6, OffsetDateTime.class).toInstant(), rs.getString(5)));
            }
            return out;
        } catch (SQLException e) {
            throw new IllegalStateException("dead failed", e);
        }
    }

    @Override
    public long pending() {
        try (Connection c = ds.getConnection();
             PreparedStatement ps = c.prepareStatement("SELECT COUNT(*) FROM scheduler_due WHERE NOT dead");
             ResultSet rs = ps.executeQuery()) {
            rs.next();
            return rs.getLong(1);
        } catch (SQLException e) {
            throw new IllegalStateException("pending failed", e);
        }
    }
}

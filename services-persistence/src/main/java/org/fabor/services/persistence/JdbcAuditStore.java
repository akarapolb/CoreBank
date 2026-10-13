package org.fabor.services.persistence;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.function.Function;
import javax.sql.DataSource;
import org.fabor.platform.security.AuditLog;
import org.fabor.platform.security.AuditLog.Record;

/** Audit chain in PostgreSQL. The head row is locked for the duration of an append, so writers queue and never fork the chain. */
public final class JdbcAuditStore implements AuditLog.Store {
    private static final String COLS = "seq, at, actor_type, actor, on_behalf_of, action, subject, detail, prev_hash, hash";
    private final DataSource ds;

    public JdbcAuditStore(DataSource ds) {
        this.ds = ds;
    }

    @Override
    public Record append(Function<Optional<Record>, Record> sealer) {
        return Jdbc.tx(ds, c -> {
            try (PreparedStatement lock = c.prepareStatement("SELECT id FROM audit_head WHERE id = 1 FOR UPDATE")) {
                lock.executeQuery().close();
            }
            Record next = sealer.apply(head(c));
            try (PreparedStatement ps = c.prepareStatement("INSERT INTO audit_log (" + COLS + ") VALUES (?,?,?,?,?,?,?,?,?,?)")) {
                ps.setLong(1, next.seq());
                ps.setObject(2, Jdbc.odt(next.at()));
                ps.setString(3, next.actorType());
                ps.setString(4, next.actor());
                ps.setString(5, next.onBehalfOf());
                ps.setString(6, next.action());
                ps.setString(7, next.subject());
                ps.setString(8, next.detail());
                ps.setString(9, next.prevHash());
                ps.setString(10, next.hash());
                ps.executeUpdate();
            }
            return next;
        });
    }

    @Override
    public List<Record> all() {
        return Jdbc.tx(ds, c -> {
            try (PreparedStatement ps = c.prepareStatement("SELECT " + COLS + " FROM audit_log ORDER BY seq");
                 ResultSet rs = ps.executeQuery()) {
                List<Record> out = new ArrayList<>();
                while (rs.next()) {
                    out.add(read(rs));
                }
                return out;
            }
        });
    }

    @Override
    public Optional<Record> head() {
        return Jdbc.tx(ds, JdbcAuditStore::head);
    }

    private static Optional<Record> head(Connection c) throws SQLException {
        try (PreparedStatement ps = c.prepareStatement("SELECT " + COLS + " FROM audit_log ORDER BY seq DESC FETCH FIRST 1 ROW ONLY");
             ResultSet rs = ps.executeQuery()) {
            return rs.next() ? Optional.of(read(rs)) : Optional.empty();
        }
    }

    private static Record read(ResultSet rs) throws SQLException {
        return new Record(rs.getLong(1), Jdbc.instant(rs, 2), rs.getString(3), rs.getString(4), rs.getString(5), rs.getString(6),
                rs.getString(7), rs.getString(8), rs.getString(9), rs.getString(10));
    }
}

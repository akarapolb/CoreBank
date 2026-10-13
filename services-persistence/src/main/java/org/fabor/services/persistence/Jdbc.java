package org.fabor.services.persistence;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import javax.sql.DataSource;

/** Tiny helpers shared by the repositories. */
final class Jdbc {
    @FunctionalInterface
    interface Work<T> {
        T run(Connection c) throws SQLException;
    }

    private Jdbc() { }

    static <T> T tx(DataSource ds, Work<T> work) {
        try (Connection c = ds.getConnection()) {
            c.setAutoCommit(false);
            try {
                T r = work.run(c);
                c.commit();
                return r;
            } catch (SQLException | RuntimeException e) {
                c.rollback();
                throw e;
            }
        } catch (SQLException e) {
            throw new IllegalStateException("Database error: " + e.getMessage(), e);
        }
    }

    static OffsetDateTime odt(Instant i) {
        return i.atOffset(ZoneOffset.UTC);
    }

    static Instant instant(ResultSet rs, int col) throws SQLException {
        return rs.getObject(col, OffsetDateTime.class).toInstant();
    }

    static PreparedStatement prep(Connection c, String sql, Object... args) throws SQLException {
        PreparedStatement ps = c.prepareStatement(sql);
        for (int i = 0; i < args.length; i++) {
            ps.setObject(i + 1, args[i]);
        }
        return ps;
    }
}

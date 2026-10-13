package org.fabor.ledger.adapter.persistence;

import java.sql.SQLException;
import javax.sql.DataSource;

public final class PostgresLedgerStore extends JdbcLedgerStore {
    public PostgresLedgerStore(DataSource ds) {
        super(ds);
    }

    @Override
    protected boolean isUniqueViolation(SQLException e) {
        return "23505".equals(e.getSQLState());
    }
}

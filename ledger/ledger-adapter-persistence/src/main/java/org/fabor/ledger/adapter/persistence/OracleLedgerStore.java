package org.fabor.ledger.adapter.persistence;

import java.sql.SQLException;
import javax.sql.DataSource;

public final class OracleLedgerStore extends JdbcLedgerStore {
    public OracleLedgerStore(DataSource ds) {
        super(ds);
    }

    @Override
    protected boolean isUniqueViolation(SQLException e) {
        return e.getErrorCode() == 1; // ORA-00001
    }
}

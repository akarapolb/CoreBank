package org.fabor.ledger.adapter.persistence;

import java.sql.SQLException;
import java.util.Set;
import javax.sql.DataSource;

public final class PostgresLedgerStore extends JdbcLedgerStore {
    public PostgresLedgerStore(DataSource ds) {
        super(ds);
    }

    public PostgresLedgerStore(DataSource ds, Set<String> hotAccounts, int stripes) {
        super(ds, hotAccounts, stripes);
    }

    @Override
    protected boolean isUniqueViolation(SQLException e) {
        return "23505".equals(e.getSQLState());
    }

    @Override
    protected boolean isRetryable(SQLException e) {
        return "40P01".equals(e.getSQLState()) || "40001".equals(e.getSQLState());
    }

    @Override
    protected String upsertBalanceSql() {
        return "INSERT INTO ledger_balance (tenant, account, balance_type, currency, stripe, minor) "
                + "VALUES (?,?,?,?,?,?) ON CONFLICT (tenant, account, balance_type, currency, stripe) "
                + "DO UPDATE SET minor = ledger_balance.minor + EXCLUDED.minor";
    }
}

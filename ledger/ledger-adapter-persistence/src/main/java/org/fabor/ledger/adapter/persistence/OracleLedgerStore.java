package org.fabor.ledger.adapter.persistence;

import java.sql.SQLException;
import java.util.Set;
import javax.sql.DataSource;

public final class OracleLedgerStore extends JdbcLedgerStore {
    public OracleLedgerStore(DataSource ds) {
        super(ds);
    }

    public OracleLedgerStore(DataSource ds, Set<String> hotAccounts, int stripes) {
        super(ds, hotAccounts, stripes);
    }

    @Override
    protected boolean isUniqueViolation(SQLException e) {
        return e.getErrorCode() == 1; // ORA-00001
    }

    @Override
    protected boolean isRetryable(SQLException e) {
        return e.getErrorCode() == 60 || e.getErrorCode() == 8177; // ORA-00060 deadlock, ORA-08177 serialization
    }

    @Override
    protected String upsertBalanceSql() {
        return "MERGE INTO ledger_balance b USING (SELECT ? AS tenant, ? AS account, ? AS balance_type, "
                + "? AS currency, ? AS stripe, ? AS minor FROM dual) s "
                + "ON (b.tenant = s.tenant AND b.account = s.account AND b.balance_type = s.balance_type "
                + "AND b.currency = s.currency AND b.stripe = s.stripe) "
                + "WHEN MATCHED THEN UPDATE SET b.minor = b.minor + s.minor "
                + "WHEN NOT MATCHED THEN INSERT (tenant, account, balance_type, currency, stripe, minor) "
                + "VALUES (s.tenant, s.account, s.balance_type, s.currency, s.stripe, s.minor)";
    }
}

package org.fabor.ledger.adapter.persistence;

import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import javax.sql.DataSource;

/**
 * Proves the ledger invariants straight from the database, in portable SQL: every batch balances per
 * currency, the maintained balances equal a full rebuild from the entries, and every batch has exactly
 * one outbox event. Run after chaos tests, after restores, and nightly in production.
 */
public final class LedgerIntegrityCheck {
    public record Report(long batchesChecked, long unbalancedBatches, long thinBatches, long balanceMismatches,
                         long batchesWithoutEvent, long duplicateEvents) {
        public boolean ok() {
            return unbalancedBatches == 0 && thinBatches == 0 && balanceMismatches == 0
                    && batchesWithoutEvent == 0 && duplicateEvents == 0;
        }
    }

    private static final String SIGNED = "CASE direction WHEN 'CREDIT' THEN minor ELSE -minor END";

    private final DataSource ds;

    public LedgerIntegrityCheck(DataSource ds) {
        this.ds = ds;
    }

    public Report run() {
        try (Connection c = ds.getConnection(); Statement st = c.createStatement()) {
            return new Report(
                    count(st, "SELECT COUNT(*) FROM ledger_batch"),
                    count(st, "SELECT COUNT(*) FROM (SELECT 1 FROM ledger_entry GROUP BY tenant, batch_id, currency "
                            + "HAVING SUM(" + SIGNED + ") <> 0) x"),
                    count(st, "SELECT COUNT(*) FROM (SELECT 1 FROM ledger_batch b "
                            + "WHERE (SELECT COUNT(*) FROM ledger_entry e WHERE e.tenant = b.tenant "
                            + "AND e.batch_id = b.batch_id) < 2) x"),
                    count(st, "SELECT COUNT(*) FROM "
                            + "(SELECT tenant, account, balance_type, currency, SUM(" + SIGNED + ") s FROM ledger_entry "
                            + "GROUP BY tenant, account, balance_type, currency) e "
                            + "FULL OUTER JOIN (SELECT tenant, account, balance_type, currency, SUM(minor) s "
                            + "FROM ledger_balance GROUP BY tenant, account, balance_type, currency) b "
                            + "ON e.tenant = b.tenant AND e.account = b.account AND e.balance_type = b.balance_type "
                            + "AND e.currency = b.currency WHERE COALESCE(e.s, 0) <> COALESCE(b.s, 0)"),
                    count(st, "SELECT COUNT(*) FROM ledger_batch b WHERE NOT EXISTS (SELECT 1 FROM ledger_outbox o "
                            + "WHERE o.tenant = b.tenant AND o.aggregate_id = b.batch_id AND o.event_type = 'BatchPosted')"),
                    count(st, "SELECT COUNT(*) FROM (SELECT 1 FROM ledger_outbox WHERE event_type = 'BatchPosted' "
                            + "GROUP BY tenant, aggregate_id HAVING COUNT(*) > 1) x"));
        } catch (SQLException e) {
            throw new IllegalStateException("Integrity check failed to run", e);
        }
    }

    private static long count(Statement st, String sql) throws SQLException {
        try (ResultSet rs = st.executeQuery(sql)) {
            rs.next();
            return rs.getLong(1);
        }
    }
}

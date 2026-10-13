package org.fabor.ledger.adapter.persistence;

import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;
import oracle.jdbc.pool.OracleDataSource;
import org.fabor.ledger.application.LedgerStore;
import org.fabor.ledger.testkit.LedgerStoreConformance;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.BeforeAll;

/** Same conformance suite on Oracle. Set FABOR_ORA_URL, FABOR_ORA_USER, FABOR_ORA_PASSWORD. */
class OracleLedgerStoreTest extends LedgerStoreConformance {
    private static OracleDataSource ds;

    @BeforeAll
    static void migrate() throws SQLException {
        String url = System.getenv("FABOR_ORA_URL");
        Assumptions.assumeTrue(url != null, "FABOR_ORA_URL not set; skipping Oracle tests");
        ds = new OracleDataSource();
        ds.setURL(url);
        ds.setUser(System.getenv().getOrDefault("FABOR_ORA_USER", "fabor"));
        ds.setPassword(System.getenv().getOrDefault("FABOR_ORA_PASSWORD", "fabor"));
        Flyway.configure().dataSource(ds).locations("classpath:db/migration/oracle").load().migrate();
    }

    @Override
    protected LedgerStore newStore() {
        try (Connection c = ds.getConnection(); Statement st = c.createStatement()) {
            st.execute("DELETE FROM ledger_outbox");
            st.execute("DELETE FROM ledger_balance");
            // rows are immutable by trigger; TRUNCATE is DDL, and a parent table needs its FK disabled first
            st.execute("ALTER TABLE ledger_entry DISABLE CONSTRAINT fk_ledger_entry_batch");
            st.execute("TRUNCATE TABLE ledger_entry");
            st.execute("TRUNCATE TABLE ledger_batch");
            st.execute("ALTER TABLE ledger_entry ENABLE CONSTRAINT fk_ledger_entry_batch");
        } catch (SQLException e) {
            throw new IllegalStateException(e);
        }
        return new OracleLedgerStore(ds);
    }
}

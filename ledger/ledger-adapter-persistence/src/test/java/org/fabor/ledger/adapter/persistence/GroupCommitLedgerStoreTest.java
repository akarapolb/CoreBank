package org.fabor.ledger.adapter.persistence;

import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;
import org.fabor.ledger.application.LedgerStore;
import org.fabor.ledger.testkit.LedgerStoreConformance;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.BeforeAll;
import org.postgresql.ds.PGSimpleDataSource;

/** The group-commit wrapper must satisfy exactly the same conformance suite as the plain store. */
class GroupCommitLedgerStoreTest extends LedgerStoreConformance {
    private static PGSimpleDataSource ds;
    private GroupCommitLedgerStore store;

    @BeforeAll
    static void migrate() {
        ds = PgSupport.dataSource();
        Assumptions.assumeTrue(ds != null, "No PostgreSQL: set FABOR_PG_URL or run Docker; skipping");
        Flyway.configure().dataSource(ds).locations("classpath:db/migration/postgresql").cleanDisabled(false)
                .load().migrate();
    }

    @AfterEach
    void close() {
        if (store != null) {
            store.close();
        }
    }

    @Override
    protected LedgerStore newStore() {
        try (Connection c = ds.getConnection(); Statement st = c.createStatement()) {
            st.execute("TRUNCATE ledger_entry, ledger_outbox, ledger_balance, ledger_batch");
        } catch (SQLException e) {
            throw new IllegalStateException(e);
        }
        store = new GroupCommitLedgerStore(new PostgresLedgerStore(ds), 2, 64, 200);
        return store;
    }
}

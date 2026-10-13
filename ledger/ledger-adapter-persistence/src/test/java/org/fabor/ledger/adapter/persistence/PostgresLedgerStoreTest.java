package org.fabor.ledger.adapter.persistence;

import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;
import org.fabor.ledger.application.LedgerStore;
import org.fabor.ledger.testkit.LedgerStoreConformance;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.BeforeAll;
import org.postgresql.ds.PGSimpleDataSource;

/** Runs the shared conformance suite on PostgreSQL. Set FABOR_PG_URL, FABOR_PG_USER, FABOR_PG_PASSWORD. */
class PostgresLedgerStoreTest extends LedgerStoreConformance {
    private static PGSimpleDataSource ds;

    @BeforeAll
    static void migrate() {
        String url = System.getenv("FABOR_PG_URL");
        Assumptions.assumeTrue(url != null, "FABOR_PG_URL not set; skipping PostgreSQL tests");
        ds = new PGSimpleDataSource();
        ds.setUrl(url);
        ds.setUser(System.getenv().getOrDefault("FABOR_PG_USER", "postgres"));
        ds.setPassword(System.getenv().getOrDefault("FABOR_PG_PASSWORD", ""));
        Flyway.configure().dataSource(ds).locations("classpath:db/migration/postgresql").cleanDisabled(false)
                .load().migrate();
    }

    @Override
    protected LedgerStore newStore() {
        try (Connection c = ds.getConnection(); Statement st = c.createStatement()) {
            st.execute("TRUNCATE ledger_entry, ledger_batch");
        } catch (SQLException e) {
            throw new IllegalStateException(e);
        }
        return new PostgresLedgerStore(ds);
    }

    @org.junit.jupiter.api.Test
    void rowsAreImmutable() throws SQLException {
        LedgerStore s = newStore();
        s.append(deposit("b1", "k1", java.time.LocalDate.of(2026, 1, 1), 100), T0);
        try (Connection c = ds.getConnection(); Statement st = c.createStatement()) {
            org.assertj.core.api.Assertions.assertThatThrownBy(() -> st.execute("DELETE FROM ledger_entry"))
                    .hasMessageContaining("immutable");
            org.assertj.core.api.Assertions.assertThatThrownBy(() -> st.execute("UPDATE ledger_batch SET idem_key='x'"))
                    .hasMessageContaining("immutable");
        }
    }
}

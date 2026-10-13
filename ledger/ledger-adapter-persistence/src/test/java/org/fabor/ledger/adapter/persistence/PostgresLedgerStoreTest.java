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

/** Runs the shared conformance suite on PostgreSQL (FABOR_PG_URL, or Testcontainers when Docker is present). */
class PostgresLedgerStoreTest extends LedgerStoreConformance {
    private static PGSimpleDataSource ds;

    @BeforeAll
    static void migrate() {
        ds = PgSupport.dataSource();
        Assumptions.assumeTrue(ds != null, "No PostgreSQL: set FABOR_PG_URL or run Docker; skipping");
        Flyway.configure().dataSource(ds).locations("classpath:db/migration/postgresql").cleanDisabled(false)
                .load().migrate();
    }

    @Override
    protected LedgerStore newStore() {
        try (Connection c = ds.getConnection(); Statement st = c.createStatement()) {
            st.execute("TRUNCATE ledger_entry, ledger_outbox, ledger_batch");
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

    @org.junit.jupiter.api.Test
    void outboxHasExactlyOneEventPerBatchEvenOnReplay() throws SQLException {
        LedgerStore s = newStore();
        var b = deposit("b1", "k1", java.time.LocalDate.of(2026, 1, 1), 100);
        s.append(b, T0);
        s.append(b, T1);
        try (Connection c = ds.getConnection(); Statement st = c.createStatement();
             java.sql.ResultSet rs = st.executeQuery("SELECT count(*), min(event_type), min(aggregate_id) FROM ledger_outbox")) {
            rs.next();
            org.assertj.core.api.Assertions.assertThat(rs.getLong(1)).isEqualTo(1);
            org.assertj.core.api.Assertions.assertThat(rs.getString(2)).isEqualTo("BatchPosted");
            org.assertj.core.api.Assertions.assertThat(rs.getString(3)).isEqualTo("b1");
        }
    }
}

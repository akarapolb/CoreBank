package org.fabor.scheduler.persistence;

import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;
import org.flywaydb.core.Flyway;
import org.fabor.scheduler.DueQueueConformance;
import org.fabor.scheduler.DueQueueStore;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.BeforeAll;
import org.postgresql.ds.PGSimpleDataSource;
import org.testcontainers.DockerClientFactory;
import org.testcontainers.containers.PostgreSQLContainer;

/** Shared conformance suite on PostgreSQL: FABOR_PG_URL, or Testcontainers when Docker is present. */
class PostgresDueQueueTest extends DueQueueConformance {
    private static PGSimpleDataSource ds;

    @BeforeAll
    static void migrate() {
        ds = new PGSimpleDataSource();
        String url = System.getenv("FABOR_PG_URL");
        if (url != null) {
            ds.setUrl(url);
            ds.setUser(System.getenv().getOrDefault("FABOR_PG_USER", "postgres"));
            ds.setPassword(System.getenv().getOrDefault("FABOR_PG_PASSWORD", ""));
        } else {
            Assumptions.assumeTrue(DockerClientFactory.instance().isDockerAvailable(), "No PostgreSQL; skipping");
            PostgreSQLContainer<?> pg = new PostgreSQLContainer<>("postgres:16");
            pg.start();
            ds.setUrl(pg.getJdbcUrl());
            ds.setUser(pg.getUsername());
            ds.setPassword(pg.getPassword());
        }
        Flyway.configure().dataSource(ds).locations("classpath:db/migration/scheduler/postgresql")
                .table("flyway_scheduler").baselineOnMigrate(true).baselineVersion("0").load().migrate();
    }

    @Override
    protected DueQueueStore newStore() {
        try (Connection c = ds.getConnection(); Statement st = c.createStatement()) {
            st.execute("TRUNCATE scheduler_due");
        } catch (SQLException e) {
            throw new IllegalStateException(e);
        }
        return new PostgresDueQueue(ds);
    }
}

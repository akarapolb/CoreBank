package org.fabor.ledger.adapter.persistence;

import org.postgresql.ds.PGSimpleDataSource;
import org.testcontainers.DockerClientFactory;
import org.testcontainers.containers.PostgreSQLContainer;

/**
 * Gives tests a PostgreSQL: the one in FABOR_PG_URL (CI service), else a Testcontainers instance
 * when Docker is available, else null so the caller can skip.
 */
final class PgSupport {
    private static PostgreSQLContainer<?> container;

    private PgSupport() { }

    static synchronized PGSimpleDataSource dataSource() {
        PGSimpleDataSource ds = new PGSimpleDataSource();
        String url = System.getenv("FABOR_PG_URL");
        if (url != null) {
            ds.setUrl(url);
            ds.setUser(System.getenv().getOrDefault("FABOR_PG_USER", "postgres"));
            ds.setPassword(System.getenv().getOrDefault("FABOR_PG_PASSWORD", ""));
            return ds;
        }
        if (!DockerClientFactory.instance().isDockerAvailable()) {
            return null;
        }
        if (container == null) {
            container = new PostgreSQLContainer<>("postgres:16");
            container.start();
        }
        ds.setUrl(container.getJdbcUrl());
        ds.setUser(container.getUsername());
        ds.setPassword(container.getPassword());
        return ds;
    }
}

package org.fabor.app;

import javax.sql.DataSource;
import org.flywaydb.core.Flyway;

/** Applies the three migration sets (ledger, services, scheduler), each with its own history table, at startup. */
final class Migrations {
    Migrations(DataSource ds) {
        migrate(ds, "classpath:db/migration/postgresql", "flyway_schema_history");
        migrate(ds, "classpath:db/migration/services/postgresql", "flyway_services");
        migrate(ds, "classpath:db/migration/scheduler/postgresql", "flyway_scheduler");
    }

    private static void migrate(DataSource ds, String location, String table) {
        Flyway.configure().dataSource(ds).locations(location).table(table).baselineOnMigrate(true).baselineVersion("0")
                .load().migrate();
    }
}

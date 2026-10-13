# Quickstart

Requirements: Java 21, Maven 3.9. Docker is optional (PostgreSQL tests use Testcontainers when no database is configured).

```bash
mvn verify                       # unit, property, architecture and in-memory conformance tests
```

With a PostgreSQL you control (also runs the shared conformance suite, invariants and group-commit tests):

```bash
export FABOR_PG_URL=jdbc:postgresql://localhost:5432/fabor FABOR_PG_USER=postgres FABOR_PG_PASSWORD=postgres
mvn verify
```

Oracle (optional; the driver is customer-supplied and never bundled): set `FABOR_ORA_URL`, `FABOR_ORA_USER`, `FABOR_ORA_PASSWORD`.

Local stack (PostgreSQL, Kafka, Apicurio, Debezium; Oracle with `--profile oracle`):

```bash
docker compose -f deploy/dev/compose.yaml up -d
contracts/register-schemas.sh
```

Benchmark and crash check:

```bash
mvn -q install -DskipTests
mvn -q dependency:build-classpath -pl ledger/ledger-perf -Dmdep.outputFile=/tmp/perf.cp
CP="ledger/ledger-perf/target/classes:$(cat /tmp/perf.cp)"
java -cp "$CP" org.fabor.ledger.perf.LedgerBench jdbc:postgresql://localhost:5432/fabor postgres postgres 32 15 100000 false group
```

Layout: `platform/` shared kernel · `ledger/` ledger (domain, application, api, adapters, perf) · `agent-gateway/` MCP tools · `deploy/` stack, Debezium and observability configs · `docs/` design and runbooks.

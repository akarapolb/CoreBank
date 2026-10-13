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

## Running the app and the console

```bash
mvn -pl fabor-app -am package -DskipTests
export FABOR_DB_URL=jdbc:postgresql://localhost:5432/fabor FABOR_DB_USER=postgres FABOR_DB_PASSWORD=postgres
export FABOR_MASTER_KEY=$(head -c 40 /dev/urandom | base64)       # development key provider
# production: SPRING_SECURITY_OAUTH2_RESOURCESERVER_JWT_ISSUER_URI=https://idp.example/realms/fabor  (OIDC is the default)
# local development only, with every role granted:
export FABOR_AUTH_MODE=token FABOR_API_TOKEN=a-long-development-token
java -jar fabor-app/target/fabor-app-0.1.0-SNAPSHOT.jar         # API :8080, metrics/health :8081, gRPC :9090
```

Open `http://localhost:8080/console/`, go to Settings, enter an actor name and the token under Access, then use Master Builder and Approvals to publish a product through the four approvals. The console is the design prototype (`prototype/index.html`) split into `console.css`, `proto.js` and `index.html` without visual changes; `live.js` fills its screens with real data once you are signed in (Master Builder, Approvals, Customer 360, Contracts, Ledger, teller deposits). `scripts/console-smoke.js` drives the flow in headless Chromium and `scripts/ui-tour.js` regenerates the screenshots in `docs/ui/`.

### Browser sign-in (OIDC, authorization code with PKCE)

```bash
node scripts/mock-idp.js 18090 &                      # development identity provider (a real Keycloak in production)
export SPRING_SECURITY_OAUTH2_RESOURCESERVER_JWT_ISSUER_URI=http://localhost:18090
export FABOR_CONSOLE_CLIENT_ID=fabor-console FABOR_CONSOLE_AUTHORIZE_URL=http://localhost:18090/authorize FABOR_CONSOLE_TOKEN_URL=http://localhost:18090/token
java -jar fabor-app/target/fabor-app-0.1.0-SNAPSHOT.jar     # without FABOR_AUTH_MODE: OIDC
NODE_PATH=$(npm root -g) node scripts/console-oidc-smoke.js
```

In Keycloak, create a public client with the console URL as redirect URI, PKCE S256 required, and your console origin as a web origin (the browser calls the token endpoint directly).

# ADR-0004: Compatibility with bank-mandated technology stacks

- Status: Proposed
- Date: 2026-10-13

## Context

Banks run technology governance with approved product lists, vendor support requirements and regulator-facing IT risk standards. A core that requires unapproved components is delayed by months of exception processes. We also must stay fast: ≥ 10k postings/s per cell at p99 < 50 ms.

## Decision

Build only on **mainstream, open-source** components ([ADR-0006](0006-open-source-only.md)) that have commercial support available from at least one vendor if the bank wants it, and put every infrastructure dependency behind an internal port so the bank's approved equivalent can be swapped in.

| Concern | Default | Bank-approved alternatives we certify | Isolation point |
|---|---|---|---|
| Language/runtime | Java 21 (Eclipse Temurin), Spring Boot 3 | Red Hat build of OpenJDK, IBM Semeru (OpenJ9) | n/a |
| Container platform | Kubernetes (OKD) | **Red Hat OpenShift**, EKS/AKS/GKE, VMware Tanzu | Helm charts + OpenShift-compatible manifests (non-root, restricted SCC) |
| Ledger/OLTP database | PostgreSQL 16+ | **EDB Postgres Advanced** (commercial support), **Oracle 19c/23ai** (certified from Phase 0), SQL Server / Db2 on demand | MyBatis + per-database `LedgerStore` ([ADR-0005](0005-multi-database-support.md)) |
| Messaging/events | Apache Kafka on Strimzi, Apicurio Registry | A bank's existing Kafka (incl. Confluent or Red Hat AMQ Streams); **IBM MQ** adapter for legacy integration | Event publisher/consumer ports |
| Workflow / durable timers | Temporal (self-hosted) | **Flowable** or **Operaton** if Temporal is not approved | Workflow port; per-account scheduler can fall back to DB-backed timers |
| Cache | Valkey | A bank's existing Redis-compatible service | Cache port |
| API gateway | Apache APISIX | Kong OSS, or the bank's gateway (Apigee, IBM API Connect, Azure API Management) | Standard OpenAPI + OAuth2 |
| Identity | Keycloak | Bank's IAM (ForgeRock, Ping, Entra ID) via OIDC/SAML | OIDC |
| Secrets/keys | OpenBao | Bank's CyberArk or cloud KMS, **Thales/Entrust HSMs** via PKCS#11 | Key management port |
| Observability | OpenTelemetry → Prometheus/Grafana stack | Bank's tooling via OTLP (Dynatrace, Splunk, Elastic, AppDynamics) | OpenTelemetry (vendor-neutral) |
| Analytics | Iceberg lakehouse | Bank's data platform (Databricks, Cloudera, Snowflake) | Event stream + CDC exports |
| Mainframe/legacy integration | — | IBM z/OS via MQ, CICS/REST, file adapters | Integration adapters |

Rules:

1. Our components are open source only ([ADR-0006](0006-open-source-only.md)). Proprietary products appear only in the right-hand column, as infrastructure the bank already licenses and chooses to use.
2. No proprietary cloud-only service on the posting path (no lock-in to one cloud's database or queue).
3. Each alternative we certify gets its own CI pipeline and performance test; we do not claim support for a stack we have not benchmarked.

## Speed

Keeping to mainstream components does not cost performance, because posting-path speed comes from design:

- Single-shard transactions for most postings (accounts of one contract co-located).
- Balance projections updated in the same transaction; no read-after-write round trips.
- Batched inserts, prepared statements, minimal indexes on hot tables, partitioning by date.
- Hot-account striping for bank internal accounts.
- Asynchronous everything after commit (GL, reporting, notifications, AI features) via the outbox.
- Continuous performance tests in CI with a hard gate on p99 latency regressions.

## Consequences

- Passes bank architecture review with standard components, and bank teams can run it with skills they already have.
- Oracle runs in CI from Phase 0 ([ADR-0005](0005-multi-database-support.md)). Other alternatives (second workflow engine, SQL Server, Db2) are certified only when a signed customer requires them.

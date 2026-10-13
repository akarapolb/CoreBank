# ADR-0006: Open-source-only technology policy

- Status: Accepted
- Date: 2026-10-13

## Context

The platform must be built entirely on open-source software: no commercial licences, no vendor lock-in, full auditability of every component, and the freedom to run anywhere. Several popular infrastructure projects have moved to source-available licences (BSL, SSPL, FSL, RSAL, Confluent Community License) that are **not** open source under the OSI definition and restrict commercial or SaaS use. Those must be excluded too.

## Decision

### Licence policy

| Allowed | Conditions | Not allowed |
|---|---|---|
| Apache-2.0, MIT, BSD-2/3-Clause, ISC, EPL-2.0, MPL-2.0, LGPL-2.1/3.0, GPL-2.0 with Classpath Exception (OpenJDK), CC0, PostgreSQL License | **AGPL-3.0 / GPL**: only for separately deployed, unmodified infrastructure (e.g. Grafana). Never linked into our code. | BSL / BUSL, SSPL, FSL, RSAL, Elastic License, Confluent Community License, Commons Clause, "open core" enterprise editions, any licence that is not OSI-approved |

Enforced in CI: every build produces a **CycloneDX SBOM** and runs a licence check (**ORT**, OSS Review Toolkit). A dependency with a disallowed or unknown licence fails the build. Licences are re-checked on every version bump, because projects do relicense.

### Our stack vs the bank's infrastructure

- **Everything we ship and depend on is open source.**
- A bank may choose to run the platform on infrastructure it already licenses (Oracle Database, OpenShift, IBM MQ, an HSM, a commercial observability tool). We integrate through open standards and optional adapters. Those adapters only depend on the vendor's client library when the bank chooses that option, and are never part of the default build.

### Bill of materials

| Concern | Choice | Licence | Replaces |
|---|---|---|---|
| JDK | **Eclipse Temurin** (OpenJDK 21) | GPL-2.0 + CE | Oracle JDK |
| Framework | Spring Boot 3 | Apache-2.0 | |
| SQL mapping (services) | **MyBatis 3** | Apache-2.0 | jOOQ (commercial for Oracle/SQL Server/Db2) |
| Ledger data access | **Spring `JdbcClient` / plain JDBC** | Apache-2.0 | |
| Schema migrations | **Flyway Community** | Apache-2.0 | Liquibase (Community moved to FSL from 5.0) |
| Default database | PostgreSQL 16+ | PostgreSQL License | |
| Product expressions | cel-java | Apache-2.0 | |
| Event streaming | **Apache Kafka** on **Strimzi** | Apache-2.0 | Confluent Platform, Redpanda (BSL) |
| Schema registry | **Apicurio Registry** | Apache-2.0 | Confluent Schema Registry (Confluent Community License) |
| CDC / outbox relay | Debezium | Apache-2.0 | |
| Workflows / timers | **Temporal** (self-hosted) | MIT | Camunda 8 (not open source) |
| Alternative workflow engine | **Flowable** or **Operaton** (Camunda 7 fork) | Apache-2.0 | |
| Cache / online feature store | **Valkey** | BSD-3-Clause | Redis |
| API gateway | **Apache APISIX** or Kong Gateway OSS | Apache-2.0 | |
| Identity | Keycloak | Apache-2.0 | |
| Authorization policy | OPA or Cedar | Apache-2.0 | |
| Secrets / key management | **OpenBao** (+ PKCS#11 to a bank HSM; SoftHSM in dev) | MPL-2.0 | HashiCorp Vault (BSL) |
| Container platform | Kubernetes (OKD where an OpenShift-compatible platform is wanted) | Apache-2.0 | |
| Infrastructure as code | **OpenTofu** | MPL-2.0 | Terraform (BSL) |
| GitOps | Argo CD | Apache-2.0 | |
| Service mesh / mTLS | **Istio** or **Cilium** | Apache-2.0 | |
| Observability | OpenTelemetry, Prometheus, Grafana, Loki, Tempo | Apache-2.0 / AGPL-3.0 (deployed unmodified) | |
| Search / logs (alternative) | OpenSearch | Apache-2.0 | Elasticsearch |
| Lakehouse | Apache Iceberg + Trino, object storage on **Ceph** | Apache-2.0 / LGPL | |
| Operational analytics | ClickHouse | Apache-2.0 | |
| Transformations | dbt Core | Apache-2.0 | |
| Feature store | Feast | Apache-2.0 | |
| ML lifecycle | MLflow | Apache-2.0 | |
| Model serving | vLLM (LLMs), KServe / BentoML (ML models) | Apache-2.0 | |
| LLM gateway | LiteLLM (or an in-house gateway) | MIT | |
| Agent tool protocol | Model Context Protocol, open-source SDKs | MIT | |
| Testing | JUnit 5, Testcontainers, jqwik (property-based), ArchUnit, Gatling | EPL-2.0 / MIT / Apache-2.0 | |
| Code quality | Error Prone, NullAway, SpotBugs, Semgrep CE | Apache-2.0 / MIT / LGPL | |

### AI models

Code, gateways and serving infrastructure are all open source. **Models are a separate choice** (see [09](../09-open-decisions.md)):

- **Default for open-source compliance:** self-hosted **open-weight models under OSI-approved licences** (e.g. Apache-2.0 models) served with vLLM, which also keeps customer data in the bank's environment.
- **Optional:** commercial model APIs behind the same gateway, where the bank allows them, with PII tokenized before any external call.
- Models with custom "community" licences (usage caps, acceptable-use restrictions) are not treated as open source.

## Consequences

- No licence fees, no audit exposure, and full source access for regulators and bank security teams.
- We give up some conveniences (jOOQ's type-safe SQL, managed Confluent tooling) and make up for them with tests: the multi-database CI matrix, SQL linting, and contract tests.
- Relicensing risk is ongoing. The licence gate in CI catches it, and every core dependency has a named open-source fallback in this table.

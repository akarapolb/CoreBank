# ADR-0005: Multi-database support, PostgreSQL by default

- Status: Proposed
- Date: 2026-10-13

## Context

Banks often mandate a specific database (commonly Oracle, sometimes Db2 or SQL Server) through their technology standards, DBA teams and support contracts. We want PostgreSQL as the default for cost and ecosystem, but must be able to run a bank's mandated database without forking the code or losing ledger performance.

## Decision

### Support tiers

| Tier | Databases | Meaning |
|---|---|---|
| **Default** | PostgreSQL 16+ (community, **EDB Postgres Advanced**, Aurora PostgreSQL, AlloyDB, Azure Database for PostgreSQL) | Every PR tested, performance baseline, reference deployment |
| **Certified** | **Oracle Database 19c and 23ai** | Full functional suite on every merge to main, performance benchmark each release |
| **On demand** | Microsoft SQL Server 2022, IBM Db2 LUW 11.5+ | Enabled when a signed customer needs it; the code is kept portable so this is a certification effort, not a rewrite |

MySQL/MariaDB are not supported for the ledger.

### Architecture

```
 Domain services
     │  repository interfaces (ports)
     ▼
 Persistence adapters
  ├─ Portable SQL via jOOQ (dialect-aware SQL generation) ── most services
  └─ LedgerStore SPI with hand-tuned implementation per DB ── ledger hot path
       ├─ PostgresLedgerStore   (multi-row INSERT/unnest, RETURNING, ON CONFLICT)
       ├─ OracleLedgerStore     (array binding, MERGE, RETURNING INTO)
       └─ SqlServer / Db2       (on demand)
     │
 Schema migrations: Liquibase changelogs (vendor-neutral; per-vendor changesets only where unavoidable)
 Outbox relay: Debezium CDC (PostgreSQL, Oracle, SQL Server, Db2) with a polling publisher fallback
```

- **Most services** use **jOOQ** for type-safe SQL that renders to each dialect. jOOQ's commercial edition is required for Oracle, SQL Server and Db2; budget for it.
- **The ledger** gets a small `LedgerStore` interface (post batch, lock balances, read balances as of a date, find by idempotency key) with a tuned implementation per database. That keeps the hot path fast on each engine and keeps the vendor-specific code to a few hundred lines.
- No JPA/Hibernate on the posting path. Its generated SQL is hard to tune and to keep identical across vendors.

### Portability rules (enforced by ArchUnit, SQL lint and the CI matrix)

| Concern | Rule |
|---|---|
| Business logic | In Java only. No stored procedures or triggers for business rules. |
| Concurrency | **Do not rely on `SERIALIZABLE`.** Oracle's "serializable" is snapshot isolation and behaves differently from PostgreSQL's. The ledger uses `READ COMMITTED` plus explicit `SELECT … FOR UPDATE` on balance rows, locked in ascending account-id order to prevent deadlocks. Same semantics on every engine. |
| IDs | Application-generated **UUIDv7** (time-ordered for index locality), stored as `uuid` / `RAW(16)` / `BINARY(16)`. No sequences or identity columns on hot tables. |
| Money | Minor units in `BIGINT` / `NUMBER(19)`. Rates and accrual accumulators in `NUMERIC(38,12)` / `NUMBER(38,12)`. |
| Time | `TIMESTAMP WITH TIME ZONE` stored in UTC; value dates as `DATE`. Timestamps come from the application clock, never `now()` in SQL (needed for determinism and replay anyway). |
| Booleans | Mapped by the adapter (`boolean` / `NUMBER(1)` on Oracle 19c). |
| Strings | Never store meaningful empty strings: Oracle treats `''` as `NULL`. Use `NULL` or explicit codes. |
| Identifiers | Lowercase snake_case, unquoted, ≤ 30 characters (safe for every engine and Oracle 19c tooling). |
| JSON | Allowed only for opaque payloads that are never filtered in SQL (e.g. raw product definition, audit context). Queried fields are real columns. |
| Pagination | Keyset pagination; `OFFSET … FETCH` (SQL:2008) only for back-office lists. |
| Sharding | Application-level shard routing (not Citus), so sharding works identically on every engine. |
| Partitioning | By date on posting and event tables via a per-vendor migration. On Oracle this requires the licensed Partitioning option; the design also works without it at lower volume. |

### Testing

- **Testcontainers** for PostgreSQL, Oracle Free, SQL Server and Db2.
- Every PR: full suite on PostgreSQL, plus ledger invariant tests on Oracle.
- Every merge to main: full suite on PostgreSQL and Oracle.
- Release: full matrix including on-demand engines that have a live customer, plus performance benchmarks per certified engine with the same p99 gate.
- A shared **conformance suite** for `LedgerStore`: concurrency, idempotency, deadlock-freedom, balance rebuild. Every implementation must pass it.

## Alternatives

- **PostgreSQL only**: simplest and fastest to build, but blocks banks that mandate Oracle or Db2.
- **JPA/Hibernate for portability**: easy to start, poor control over hot-path SQL and locking, subtle cross-vendor differences.
- **Database-specific forks**: fastest per engine, unmaintainable.

## Consequences

- The portability discipline costs about 10–15% more persistence work, mostly in Phase 0. Running Oracle in CI from the first ledger commit is what keeps the code portable; adding a second database later would cost far more.
- Commercial costs: jOOQ commercial licence; Oracle licences for customer deployments (customer-provided).
- Ledger performance is tuned per engine, so each certified database has its own benchmark baseline.

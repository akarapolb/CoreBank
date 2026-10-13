# ADR-0002: PostgreSQL for the ledger, sharded by account, with a benchmark gate

- Status: Proposed
- Date: 2026-10-13

## Context

The ledger needs atomic multi-leg postings, strict consistency, RPO = 0, ≥ 10k postings/s per cell, point-in-time queries, and operability by bank IT teams and regulators who know relational databases.

## Decision

- Store postings and balance projections in a relational database, **PostgreSQL by default** (Oracle certified; see [ADR-0005](0005-multi-database-support.md)), with synchronous replication across AZs.
- Concurrency via `READ COMMITTED` plus explicit `SELECT … FOR UPDATE` on balance rows in ascending account-id order. We do not rely on `SERIALIZABLE`, because its semantics differ across engines.
- **Shard by account** (application-level shard routing, so it works on every supported database). Keep the accounts of one arrangement on one shard so most postings are single-shard transactions.
- Cross-shard transfers use reserve → commit through clearing accounts, orchestrated as a saga, so each step is a local transaction that balances.
- Mitigate hot accounts (e.g. a bank's internal settlement account) with **sub-account striping** and periodic sweeps.
- **Benchmark gate**: at the end of Phase 0, if PostgreSQL cannot meet targets with reasonable hardware, evaluate **TigerBeetle** as the balance/transfer engine behind the same ledger API.

## Alternatives

- **TigerBeetle**: purpose-built, extremely fast double-entry engine; fewer operators know it and its data model is intentionally minimal (we would keep rich metadata elsewhere).
- **Distributed SQL (CockroachDB, YugabyteDB, Spanner)**: global consistency, higher latency per transaction, higher cost; reconsider for multi-region active-active.
- **Event store only**: maximal flexibility, harder ad hoc querying and reconciliation for operations teams.

## Consequences

- The ledger API hides storage, so the storage engine can change without touching domain services.
- We must invest early in shard routing, rebalancing and hot-account handling.

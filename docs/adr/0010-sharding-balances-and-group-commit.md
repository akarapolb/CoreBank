# ADR-0010: Maintained balances, group commit, striping and application-level sharding

Status: accepted (Phase 0, sprint S4)

## Context

Posting must scale per cell ([ADR-0008](0008-global-multi-region-topology.md)) while staying correct on PostgreSQL and Oracle ([ADR-0005](0005-multi-database-support.md)). Measurements are in [benchmarks](../benchmarks/phase0-ledger-postgresql.md).

## Decisions

1. **Maintained balance table.** `ledger_balance` holds the current balance per (tenant, account, bucket, currency, stripe), updated in the same transaction as the entries. Bitemporal "as of" queries still read the immutable entries. `requireFunds` debits are checked against this table after the update, under the row lock the update took, so concurrent withdrawals cannot overdraw.
2. **Ordered locking.** Balance rows are always updated in sorted key order, so two transactions cannot deadlock on each other. First-touch inserts can still collide; deadlocks and serialization failures are retried (up to 5 times).
3. **Group commit.** Concurrent appends are queued and committed in one transaction by a few flusher threads, with a savepoint per batch so one bad batch fails alone. Balances are aggregated over the whole group and applied once, in global key order. Reversals and `requireFunds` batches bypass the group because they need committed state.
4. **Hot-account striping.** Configured accounts spread their balance over N rows; reads sum the stripes. Striped accounts cannot carry `requireFunds` entries (the sum is not locked).
5. **Application-level sharding.** One batch is one local transaction, so all its entries must map to one shard. Related accounts share a placement key (`id@placement`). Cross-shard moves use a reserve → commit transfer through clearing accounts co-located with each side; every step is an idempotent balanced batch, so a half-done transfer resumes or is cancelled. One orchestrator must drive a transfer.

## Consequences

- Balance reads are O(1); posting does a few more writes per batch.
- Idempotency keys and batch ids are unique per shard, not globally. The API gateway must issue keys per request and never reuse one across batches that route differently. A global key registry is a later decision.
- Changing the shard count moves accounts, so resharding is a data migration with its own plan.
- The clearing accounts' combined balance equals the in-flight transfers; it is a reconciliation check and a monitoring signal.

# ADR-0007: Computed accrual and a partitioned time-wheel scheduler

- Status: Proposed (refines the scheduler in docs/02)
- Date: 2026-10-13

## Context

The first design gave every account a durable workflow timer and posted interest accrual to the ledger daily per account. At a billion accounts that means a billion long-lived workflows and a billion accrual postings a day before any customer activity, and a month-end spike when capitalization falls on the same date for hundreds of millions of accounts.

## Decision

1. **Account-level accrual is computed state.** Accrued interest is derived deterministically from the balance history and the product version and kept in an accumulator on the arrangement. It is posted to the ledger only at events that need it: billing, capitalization, payoff, rate change, tier-changing balance movement, and month end.
2. **GL accrual is posted daily in aggregate** per product, legal entity and currency, so the general ledger is accurate every day.
3. **Due work runs on a partitioned time-wheel.** Each ledger shard owns a due-queue table keyed by time bucket and arrangement. Workers per shard claim buckets with `SELECT … FOR UPDATE SKIP LOCKED` (supported on PostgreSQL and Oracle), execute idempotently and reschedule. Throughput scales with shards.
4. **Peaks are spread by booking time, never by value date.** Month-end capitalization keeps its value date and is booked across the night window per shard with jitter.
5. **Temporal is kept for long-running, multi-step business processes** (origination, restructuring, repossession, migration), not for per-account timers.

## Consequences

- Ledger load from accrual drops from one posting per account per day to a handful per account per month plus a small number of aggregate GL postings.
- Account-level accrued interest is always available on demand and reproducible for audit, because it is a pure function of history.
- The scheduler is a core component the team owns; it needs its own conformance tests for exactly-once effects and catch-up after outages.

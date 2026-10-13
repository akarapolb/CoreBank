# Ledger append latency

**Alert:** `LedgerAppendLatencyP99High` (page): p99 above 50 ms for 10 minutes.

## Confirm
Dashboard p50 vs p99. A rising p50 means overall saturation; a rising p99 alone means contention or a slow disk.

## Act
1. **Hot account:** one account on every batch (fees, GL) queues on its row lock. Check `pg_locks` for waiters on `ledger_balance`. Fix: stripe the account (ADR-0010); group commit also helps.
2. **Disk flush slow:** check WAL write latency and storage IOPS. Group commit amortises flushes; confirm it is enabled and flushers are not starved.
3. **Connection saturation:** compare active connections to the pool limit.
4. **Bad query plan after growth:** run `EXPLAIN` on the balance read; confirm `ix_ledger_entry_balance` is used.
5. **Overload:** if throughput exceeds the cell design point (10,000/s), shed or add a cell.

## Escalate
After 30 minutes without improvement, page the ledger squad lead.

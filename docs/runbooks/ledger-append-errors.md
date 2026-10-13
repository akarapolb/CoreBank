# Ledger append errors

**Alerts:** `LedgerAppendErrorRateHigh` (page), `LedgerIdempotencyConflictsSpike` (ticket).

## Meaning
- `outcome="error"`: an append failed for a reason that is not a business refusal (database unreachable, pool exhausted, retries exhausted after deadlocks).
- `outcome="idempotency_conflict"`: a client reused an idempotency key or batch id with different content. This is a client bug, not a platform fault.

## Confirm
1. Dashboard "Fabor OS · Ledger (RED)": errors vs total, latency.
2. Service logs for `Ledger append failed` and the SQL state in the cause.
3. Database: connection count, locks (`pg_stat_activity` waiting rows), replication state.

## Act
| Cause | Action |
|---|---|
| Database down or failing over | Follow [ledger-primary-failure.md](ledger-primary-failure.md). Clients retry safely: appends are idempotent. |
| Pool exhausted | Check for long transactions; raise pool size only after finding the cause. |
| Deadlock retries exhausted | Look for a hot account without striping (see ADR-0010); configure striping for it. |
| Idempotency conflicts | Identify the calling tenant from logs (not from metric tags) and contact the integrator. |

## Escalate
Page the ledger squad lead if errors persist 15 minutes or any posting is suspected lost; then run the integrity check ([ledger-integrity.md](ledger-integrity.md)).

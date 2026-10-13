# Runbooks

One per alert. Each says what the alert means, how to confirm, what to do, and when to escalate. Every service ships with its runbook before it reaches staging ([engineering plan](../14-engineering-plan.md)).

| Alert | Runbook |
|---|---|
| LedgerAppendErrorRateHigh, LedgerIdempotencyConflictsSpike | [ledger-append-errors.md](ledger-append-errors.md) |
| LedgerAppendLatencyP99High | [ledger-latency.md](ledger-latency.md) |
| LedgerIntegrityCheckFailed | [ledger-integrity.md](ledger-integrity.md) |
| Primary database lost | [ledger-primary-failure.md](ledger-primary-failure.md) |

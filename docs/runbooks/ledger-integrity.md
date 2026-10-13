# Ledger integrity failure

**Alert:** `LedgerIntegrityCheckFailed` (page). This is the most serious ledger alert: an invariant is violated.

## What is checked (`LedgerIntegrityCheck`)
1. Every batch balances per currency.
2. Every batch has at least two entries.
3. Maintained balances equal a full rebuild from the entries.
4. Every batch has exactly one `BatchPosted` outbox event.

## Act
1. **Stop** anything that repairs or rewrites ledger data. Rows are immutable by design; never `UPDATE` or `DELETE` them.
2. Capture the report output and the time of the last passing run.
3. Balance mismatch only (check 3): the entries are the source of truth. Rebuild `ledger_balance` from the entries in a maintenance transaction after the squad lead approves, then re-run the check.
4. Any other failure: freeze posting for the affected cell and escalate to the ledger squad lead and the security lead. Treat as a potential integrity incident.
5. Record a blameless post-incident review within five days.

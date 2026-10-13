# Ledger primary database failure

## Guarantee
Appends return only after commit. A posting that was acknowledged survives the loss of the primary (verified by `scripts/chaos-kill-primary.sh`; with replication, only for synchronous replicas, see ADR-0008 for RPO).

## Act
1. Let the HA manager (Patroni or the platform's equivalent) promote a replica; do not promote by hand unless it is stuck.
2. Clients retry with the same idempotency key. Retried appends either replay the stored result or post once.
3. After recovery run the integrity check and `scripts/chaos-kill-primary.sh` logic's verify step is the model: compare acknowledged ids against the database.
4. Outbox: Debezium resumes from its replication slot. If the slot was lost, re-snapshot the outbox table; consumers deduplicate on event id.
5. Review: how many appends failed (not acknowledged) during the window, and whether alerts fired on time.

# Phase 0 exit report

Measured against the exit criteria in [14 · Engineering plan](14-engineering-plan.md) §4. **Phase 0 is not closed.** Two criteria need infrastructure this environment does not have; they are marked open, not passed.

| Exit criterion | Status | Evidence |
|---|---|---|
| Property-based tests prove ledger invariants under concurrency on both databases | **PostgreSQL met, Oracle open** | `LedgerInvariantsTest` (16 concurrent threads, plain, group commit and striped stores; integrity check after each); shared `LedgerStoreConformance` incl. concurrent retries and concurrent guarded withdrawals. The Oracle store, migrations and test class exist and run in CI against Oracle Free, but have never been executed (no Oracle available while building). |
| 10,000 batches/s at p99 < 50 ms on PostgreSQL; Oracle baseline published | **Open** | [Benchmark](benchmarks/phase0-ledger-postgresql.md): about 5,000/s at p99 about 27 ms on a shared 4-vCPU container. Needs the dedicated performance environment. No Oracle baseline. |
| Full balance rebuild from postings matches projections | **Met (PostgreSQL)** | `LedgerIntegrityCheck` rebuilds from entries and compares to `ledger_balance`; run after every invariants and chaos run. |
| Killing a database primary loses no committed posting | **Met for a single node** | `scripts/chaos-kill-primary.sh`: two `kill -9` rounds under load, restarts; plain store 51,153 acknowledged and all present, group-commit store 56,587 acknowledged and all present; integrity clean. Zone partition and replica failover need a multi-node environment and are not covered. |
| Licence gate, SBOM and signed images in every build | **Partly met** | Licence allowlist script and ORT job in CI; CycloneDX SBOM per build; keyless cosign signing of release artifacts on tags. No container images exist yet, so no image signing. None of the GitHub workflows has run yet. |

## Other sprint S5 deliverables

| Deliverable | Status |
|---|---|
| Observability dashboards and runbooks | Done: metrics decorator, Grafana dashboard, Prometheus alerts, four runbooks. Not deployed anywhere. |
| Agent gateway skeleton with read-only tools | Done: MCP JSON-RPC core, entitlement checks, audit for every call, two ledger read tools, write tools refused. No network transport, authentication or guardrails (redaction, delegated authority) yet. |
| Open-source readiness | Done: licence, NOTICE, CONTRIBUTING, SECURITY, governance, code of conduct, trademark policy, PR and issue templates, CODEOWNERS, Renovate, quickstart. Still needed: real security contact address, GitHub organisation, trademark clearance. |
| Benchmark report with reproducible harness | Done, with the caveats above. |

## Open items before Phase 0 can close

1. Run the Oracle conformance and invariants suites (CI does this once pushed to GitHub, or run against any Oracle 19c+).
2. Provision the performance environment (S4 plan) and rerun the benchmark on tuned PostgreSQL; record the Oracle baseline.
3. Multi-node chaos: partition a zone, fail over a replica, measure RPO.
4. Replace placeholder contacts and complete trademark clearance before the public launch.

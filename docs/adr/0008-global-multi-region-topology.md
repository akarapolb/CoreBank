# ADR-0008: Home-region accounts, cells, and paired DR regions

- Status: Proposed
- Date: 2026-10-13

## Context

A global bank operates in many countries with data residency rules, needs to survive a full region loss, and must scale to about 100,000 postings per second. Multi-master writes across regions would need conflict resolution on balances, which is unacceptable for a ledger.

## Decision

- Every customer and account has a **home region**, chosen by the tenant's residency rules. All writes for an account happen in its home region.
- Within a region, accounts are placed in **cells**: independent full stacks that share nothing on the posting path. Cells are the unit of scale, blast radius and maintenance.
- A **global directory** maps tenant and account to region and cell. It is replicated and cached at every gateway.
- **Cross-cell and cross-region transfers** use the reserve → commit saga through clearing accounts, so each step is a local transaction that balances.
- Each region has a **paired DR region inside the same residency boundary**, with continuous replication (RPO ≤ 60 s, RTO ≤ 30 min). Designated critical cells may replicate synchronously to a nearby pair for RPO 0.
- The **control plane** (product catalog, directory, configuration, model registry) is replicated read-only to all regions, so regions keep operating without it.

## Alternatives

- **Globally distributed SQL with multi-region writes:** simpler routing, but higher latency on every posting and harder residency guarantees.
- **One global region with DR:** cannot meet residency rules or latency for a multi-country bank.

## Consequences

- Linear scale-out by adding cells; region failure is contained.
- Cross-region transfers are slower (p99 under 300 ms) than in-cell transfers; acceptable for their volume.
- Moving a customer between regions is an explicit migration, not a configuration change.

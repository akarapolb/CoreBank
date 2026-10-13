# ADR-0009: Open core under Apache 2.0, with a commercial layer

- Status: Accepted
- Date: 2026-10-13

## Context

Banks, regulators and auditors value being able to read and verify a core banking system, and an open-source core supports adoption and our no-lock-in position ([ADR-0006](0006-open-source-only.md)). Open source alone does not fund a company or give banks the accountability they need. We must choose a licence and a clear line between what is open and what is paid.

## Decision

- **Licence:** Apache License 2.0 for code; CC BY 4.0 for documentation. No copyleft (often blocked by bank legal teams) and no source-available licences (contrary to ADR-0006 and to community trust).
- **Contributions:** Developer Certificate of Origin sign-off, no CLA.
- **Trademark:** "Fabor OS" and "Fabor Certified" stay protected ([TRADEMARKS.md](../../TRADEMARKS.md)).
- **Open source from the end of Phase 0**, when the ledger and engines are stable and the 10,000/s benchmark is published with a reproducible harness.

### Open-core boundary

| Open (Apache 2.0) | Commercial |
|---|---|
| Ledger, platform libraries, calculation engines | Jurisdiction packs: rule packs, regulatory reports, disclosures, tax rules, kept current with update guarantees |
| Product engine and Master Builder application | Maintained template libraries per market for Master Builder |
| All domain services: deposits, lending, leasing, fleet, floor plan, trade finance, treasury, syndication, collections, accounting | Product copilot and AI agent packs: prompts, evaluation suites, tuned models |
| APIs, event schemas, MCP tools, agent gateway core, SDKs | Migration factory: mappings, reconciliation tooling, parallel-run automation |
| Single-region reference deployment (Helm, OpenTofu) | Multi-region and cell operations: global directory administration, failover automation |
| One generic reference rule pack, for testing and learning | Certified long-term-support releases with security SLAs, and indemnity |
| Documentation and the prototype | Managed cloud service |

Rules: features never move from open to commercial. Commercial items may become open later. Nothing in the commercial layer is needed for the ledger to be correct or for a bank to export its own data.

## Alternatives

- **Fully closed:** simpler to monetize, but loses the trust, adoption and verification advantages, and puts us in the same position as incumbents.
- **Fully open, services-only revenue:** low margins and scaling limited by headcount.
- **Source-available (BSL, SSPL):** blocks competitors but breaks community trust and contradicts ADR-0006.
- **Copyleft (AGPL):** deters hosting competitors but is often prohibited by bank legal policies.

## Consequences

- Anyone may copy, fork and host the open code. Protection comes from trademark, certification, accountability, current regulatory content, speed and ecosystem, not from the licence.
- The commercial layer must stay valuable on its own merits; we invest continuously in jurisdiction packs, templates, AI evaluation and operations tooling.
- The revenue model is in [docs/13](../13-business-model.md).

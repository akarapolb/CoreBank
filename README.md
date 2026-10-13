# Fabor OS

**The Financial and Banking Operator.** An AI-native core banking platform for **retail**, **commercial (SME and corporate)** and **virtual (digital-only) banks**.
Any lending product, including **leasing and hire purchase**, is built from configuration, not code.

> Status: **planning**. This repository holds the blueprint. Code arrives in Phase 0 (see the [roadmap](docs/07-roadmap.md)).

## What "unicorn grade" means here

| Dimension | Target |
|---|---|
| Correctness | Double-entry, immutable, bitemporal ledger. Zero tolerance for unbalanced postings. Every balance can be rebuilt from events. |
| Speed to market | A new deposit or loan product goes from idea to production in **days**, through configuration and simulation, without a core release. |
| Scale | 10k postings/s per cell at p99 < 50 ms; 100k/s sustained globally by adding cells; designed and tested for 1 billion accounts. |
| Availability | 99.99% for the posting path, RPO = 0, RTO < 15 min, active-active across availability zones. |
| No batch | No end-of-day freeze. Accrual, billing and aging run continuously; "EOD" is a reporting cut, not an outage. |
| AI-native | Every capability is exposed as a governed tool that AI agents can call, and AI is built into credit, fraud, collections, operations and product design, under bank-grade model risk controls. |
| Multi-tenant | One platform hosts many banks or brands, each with its own products, chart of accounts, regulatory pack and data residency. |
| Regulator-ready | Full audit trail, explainable decisions, IFRS 9 / TFRS 9, IFRS 16 / TFRS 16, Basel III reporting, PDPA/GDPR. |

## Documents

| # | Document | What it covers |
|---|---|---|
| 01 | [Vision and principles](docs/01-vision-and-principles.md) | Target customers, scope, design principles, non-goals |
| 02 | [Architecture](docs/02-architecture.md) | Service map, ledger design, eventing, tech stack, deployment, NFRs |
| 03 | [Domain model](docs/03-domain-model.md) | Parties, accounts, ledger, balances, postings, limits, collateral |
| 04 | [Product engine](docs/04-product-engine.md) | How deposits, loans, leasing and hire purchase are defined as configuration |
| 05 | [Lending and leasing](docs/05-lending-and-leasing.md) | Schedules, interest, accrual, EIR, waterfall, restructuring, leasing lifecycle |
| 06 | [AI-native layer](docs/06-ai-native.md) | Agent tool layer, AI use cases, guardrails, model risk management |
| 07 | [Roadmap](docs/07-roadmap.md) | Phases, milestones, exit criteria, team |
| 08 | [Security, risk and compliance](docs/08-security-and-compliance.md) | Security architecture, regulatory mapping, audit |
| 10 | [Application architecture and modules](docs/10-application-architecture.md) | Layers, communication rules, request flow, Maven modules, dependency rules |
| 11 | [Global scale and benchmark](docs/11-global-scale-and-benchmark.md) | Global sizing, high-performance design, capability check against global banks and leading platforms |
| 12 | [Trade finance, treasury and syndication](docs/12-trade-treasury-syndication.md) | Native LCs and guarantees, treasury operations, syndicated lending as lender and agent |
| 13 | [Business and revenue model](docs/13-business-model.md) | Editions, price metrics, add-ons, services, example customers, unit economics |
| SDD | [Design reference (HTML)](docs/design/fabor-os-design.html) | Software design document: functional, module, architecture, infrastructure, security and compliance design |
| — | [HTML prototype](prototype/index.html) | Clickable back-office console: overview, Master Builder, Customer 360, contracts, fleet and floor plan, trade finance, treasury, syndication, branch and teller, corporate banking, Product Studio, ledger, approvals, AI agents, settings, architecture and module diagrams |
| ADR | [Architecture decision records](docs/adr/) | Key decisions and their trade-offs, incl. [bank stack compatibility](docs/adr/0004-bank-stack-compatibility.md), [multi-database support](docs/adr/0005-multi-database-support.md) the [open-source-only policy](docs/adr/0006-open-source-only.md) and the [open-core model](docs/adr/0009-open-core-model.md) |
| — | [Open decisions](docs/09-open-decisions.md) | Choices that need the founders' input before Phase 0 |

## Licence and contributing

Fabor OS is open core. Code is licensed under the [Apache License 2.0](LICENSE) and documentation under CC BY 4.0 (see [NOTICE](NOTICE)). Commercial editions add jurisdiction packs, AI packs, migration and multi-region tooling, certified releases and managed operations ([ADR-0009](docs/adr/0009-open-core-model.md)).

- [Contributing](CONTRIBUTING.md) (DCO sign-off, no CLA)
- [Security policy](SECURITY.md)
- [Governance](GOVERNANCE.md) and [maintainers](MAINTAINERS.md)
- [Code of conduct](CODE_OF_CONDUCT.md)
- [Trademark policy](TRADEMARKS.md)

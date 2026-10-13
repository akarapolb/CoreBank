# CoreBank

An AI-native core banking platform for **retail**, **commercial (SME and corporate)** and **virtual (digital-only) banks**.
Any lending product, including **leasing and hire purchase**, is built from configuration, not code.

> Status: **planning**. This repository holds the blueprint. Code arrives in Phase 0 (see the [roadmap](docs/07-roadmap.md)).

## What "unicorn grade" means here

| Dimension | Target |
|---|---|
| Correctness | Double-entry, immutable, bitemporal ledger. Zero tolerance for unbalanced postings. Every balance can be rebuilt from events. |
| Speed to market | A new deposit or loan product goes from idea to production in **days**, through configuration and simulation, without a core release. |
| Scale | 10k+ postings/sec per ledger shard at p99 < 50 ms, scaling horizontally to 100M+ accounts. |
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
| SDD | [Design reference (HTML)](docs/design/corebank-design.html) | Software design document: functional, module, architecture, infrastructure, security and compliance design |
| — | [HTML prototype](prototype/index.html) | Clickable back-office console: overview, Customer 360, HP contract, Product Studio, ledger, approvals, AI agents, architecture and module diagrams |
| ADR | [Architecture decision records](docs/adr/) | Key decisions and their trade-offs, incl. [bank stack compatibility](docs/adr/0004-bank-stack-compatibility.md), [multi-database support](docs/adr/0005-multi-database-support.md) and the [open-source-only policy](docs/adr/0006-open-source-only.md) |
| — | [Open decisions](docs/09-open-decisions.md) | Choices that need the founders' input before Phase 0 |

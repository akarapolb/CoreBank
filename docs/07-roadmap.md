# 07 — Roadmap

Durations assume the team in the last section. Each phase has exit criteria; we do not start the next phase's scope on a phase that has not met them.

## Phase 0 — Foundations (months 0–3)

**Goal:** a correct, fast ledger and the engineering platform everything else stands on.

- Monorepo, CI/CD with SBOM + open-source licence gate, GitOps, environments (dev, test, staging, perf), observability, secrets
- Platform libraries: money, currency, calendars, day counts, rounding, idempotency, outbox, tenancy
- Persistence layer: MyBatis, Flyway, `LedgerStore` SPI with PostgreSQL and Oracle implementations, conformance suite, Testcontainers CI matrix
- Ledger service: posting batches, balance types, holds, reversals, bitemporal balances, multi-currency
- Party service (basic) and product catalog skeleton with schema validation
- Contract-first APIs (OpenAPI/Protobuf) and event schemas
- Agent gateway skeleton: read-only tools auto-generated from OpenAPI, audit log

**Exit criteria:** property-based tests prove ledger invariants under concurrency; 10k postings/s at p99 < 50 ms on PostgreSQL in the perf environment, with an Oracle baseline recorded; full balance rebuild from postings matches projections; chaos test (kill a DB primary) loses no committed posting.

## Phase 1 — Retail MVP for a virtual bank (months 3–9)

**Goal:** everything a virtual bank needs to open the doors.

- Deposits: savings, current, term deposit, pockets; tiered interest; withholding tax
- Lending: personal loan and nano loan (annuity), with schedule engine, accrual, billing, waterfall, aging
- Product engine v1: building blocks for deposits and amortizing loans, simulator, golden tests, maker-checker publishing
- Accounting: GL mapping, sub-ledger → GL reconciliation, daily trial balance
- Integrations: instant payment rail and QR, eKYC vendor, credit bureau, notifications
- Workflows: digital onboarding, loan origination, disbursement
- AI Tier 1: credit decisioning (with reason codes), document intelligence, fraud scoring on the posting path, customer assistant (read + servicing requests)
- Security baseline, PII vault, audit, PDPA consent

Also in Phase 1: scale-out test reaching 100,000 batches/s across 10 cells with at least 90% linear efficiency; sanctions screening inside the payment latency budget.

**Exit criteria:** end-to-end pilot with internal staff accounts; regulator sandbox / IT risk assessment passed; penetration test clean of high findings; daily automated reconciliation at zero difference for 30 consecutive days.

## Phase 2 — Asset finance and leasing (months 9–14)

- Hire purchase (auto, motorcycle), finance lease, operating lease
- Annuity-from-flat, balloon/residual, EIR income recognition, VAT per installment, tax invoices
- Asset register, insurance linkage, dealer channel and subvention
- Fleet hire purchase and leasing: master agreements, call-off schedules, consolidated billing, cross-default, co-terminus
- Floor plan financing: dealer lines, per-unit drawdowns, OEM interest-free periods, curtailments, payoff on sale (netted from retail HP), stock audits, sold-out-of-trust alerts
- The dealer and fleet facilities from limits-collateral (a subset of the Phase 3 limit tree) are pulled forward into this phase
- Early settlement with regulatory rebate formulas
- Collections v1 + AI propensity models; repossession and remarketing workflows
- IFRS 9 ECL engine v1 and IFRS 16 lessor accounting

**Exit criteria:** parallel run against an existing leasing book (or synthetic book of ≥ 100k contracts) matches schedules, income and VAT to the satang; auditors sign off on accounting entries.

## Phase 3 — Commercial banking (months 14–20)

- Facility trees and limits, group exposure, collateral management, covenants
- SME term loans (equal principal, grace), revolving credit, overdraft, invoice finance
- Multi-currency accounts and FX postings
- Cash management basics: sweeps, pooling (notional later), bulk payments
- RM copilot, covenant extraction from financial statements, credit memo drafting
- Credit application workflow with authority matrix routing; bulk and payroll payments with client dual authorization; camt.053 and MT940 statements
- Retail bank extensions: branch and teller (drawers and vaults as ledger accounts, supervisor overrides), floating-rate home loans with resets, cheque clearing adapter
- Regulatory reporting data marts

**Exit criteria:** commercial pilot customer live; limit checks atomic under concurrent drawdowns; regulatory return dry-runs accepted.

## Phase 4 — Scale and platform (months 20–30)

- Multi-tenant SaaS hardening: tenant onboarding automation, per-tenant cells, data residency
- Migration toolkit for incumbent banks (product mapping, balance migration, parallel run, reconciliation)
- Advanced products: mortgages with floating resets, syndicated loans, BNPL partner platform, embedded finance APIs
- AI Tier 2/3: collections agents, product copilot, dynamic pricing, natural-language analytics
- Certifications: ISO 27001, SOC 2 Type II, PCI DSS scope (if cards)

## Phase 5 — Global bank (months 30–42)

- Multi-region active-active with home-region accounts and paired DR regions in production
- Billion-account certification: month-end capitalization within the night window, zone and region failover drills
- Jurisdiction packs beyond Thailand (Singapore, Malaysia, Indonesia, Hong Kong, then EU, UK, US)
- Islamic banking product blocks; cross-border, cross-currency liquidity pooling
- Native trade finance and syndication where integration is no longer enough
- Tier-1 reference program and certifications

See [11](11-global-scale-and-benchmark.md) for the global capability check that drives this phase.

## Team (initial ~25–35, growing to ~60)

| Squad | Scope |
|---|---|
| Ledger & platform | Ledger, platform libs, performance, SRE |
| Product engine | DSL, schedule engine, simulator, pricing |
| Deposits & payments | Deposit products, payment integrations |
| Lending & leasing | Loan/HP/lease lifecycle, collections |
| Accounting & risk | GL, IFRS 9/16, regulatory reporting |
| AI & data | Agent gateway, models, feature store, MRM tooling |
| Channels (thin) | Reference mobile/web/back-office apps proving the APIs |
| Security & compliance | AppSec, IAM, audit, regulatory liaison |

Key early hires: a **core banking architect** who has shipped a ledger, a **lending/leasing domain lead** (accounting + local regulation), a **head of risk/model validation**, and a **compliance lead** familiar with the launch market's virtual bank regime.

## Top risks

| Risk | Mitigation |
|---|---|
| Ledger correctness bugs | Property-based and model-based testing, invariants in the DB, daily rebuild checks, parallel runs |
| Scope creep ("support everything") | Product engine building blocks with a strict backlog; integrate rather than build adjacent systems |
| Regulatory approval timeline | Engage regulator early, IT risk documentation from Phase 0, sandbox participation |
| AI incidents (wrong advice, unauthorized action) | Delegated authority, policy engine, human-in-the-loop, eval suites, kill switches |
| Performance at scale | Cell architecture, perf environment from Phase 0, load tests in CI on every ledger change |
| Talent and bank IT governance | Java/Spring, PostgreSQL, Kafka are on bank-approved lists; every infrastructure dependency is swappable ([ADR-0004](adr/0004-bank-stack-compatibility.md)) |

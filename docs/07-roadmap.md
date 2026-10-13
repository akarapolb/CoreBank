# 07 — Roadmap

Durations assume the team in the last section. Each phase has exit criteria; we do not start the next phase's scope on a phase that has not met them.

## Phase 0 — Foundations (months 0–3)

**Goal:** a correct, fast ledger and the engineering platform everything else stands on.

- Monorepo, CI/CD, GitOps, environments (dev, test, staging, perf), observability, secrets
- Platform libraries: money, currency, calendars, day counts, rounding, idempotency, outbox, tenancy
- Ledger service: posting batches, balance types, holds, reversals, bitemporal balances, multi-currency
- Party service (basic) and product catalog skeleton with schema validation
- Contract-first APIs (OpenAPI/Protobuf) and event schemas
- Agent gateway skeleton: read-only tools auto-generated from OpenAPI, audit log

**Exit criteria:** property-based tests prove ledger invariants under concurrency; 10k postings/s at p99 < 50 ms in the perf environment; full balance rebuild from postings matches projections; chaos test (kill a DB primary) loses no committed posting.

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

**Exit criteria:** end-to-end pilot with internal staff accounts; regulator sandbox / IT risk assessment passed; penetration test clean of high findings; daily automated reconciliation at zero difference for 30 consecutive days.

## Phase 2 — Asset finance and leasing (months 9–14)

- Hire purchase (auto, motorcycle), finance lease, operating lease
- Annuity-from-flat, balloon/residual, EIR income recognition, VAT per installment, tax invoices
- Asset register, insurance linkage, dealer channel and subvention
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
- Regulatory reporting data marts

**Exit criteria:** commercial pilot customer live; limit checks atomic under concurrent drawdowns; regulatory return dry-runs accepted.

## Phase 4 — Scale and platform (months 20–30)

- Multi-tenant SaaS hardening: tenant onboarding automation, per-tenant cells, data residency
- Migration toolkit for incumbent banks (product mapping, balance migration, parallel run, reconciliation)
- Advanced products: mortgages with floating resets, syndicated loans, BNPL partner platform, embedded finance APIs
- AI Tier 2/3: collections agents, product copilot, dynamic pricing, natural-language analytics
- Certifications: ISO 27001, SOC 2 Type II, PCI DSS scope (if cards)

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
| Talent | Kotlin/Postgres/Kafka are mainstream; avoid niche stacks unless benchmarks force it |

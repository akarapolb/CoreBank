# 01 — Vision and principles

## Vision

A cloud-native core banking platform that a new virtual bank can launch on in months, that a retail or commercial bank can migrate onto product by product, and that treats AI as a first-class operator of the bank rather than a bolt-on chatbot.

## Target customers

| Segment | What they need from the core |
|---|---|
| **Virtual bank** (e.g. a newly licensed digital-only bank) | Fast launch, low cost per account, real-time everything, API-first, embedded finance, data-driven credit for thin-file customers |
| **Retail bank** | Savings, current, term deposits, personal loans, mortgages, auto hire purchase, credit lines, high volume, branch + digital channels |
| **Commercial bank (SME and corporate)** | Facility hierarchies, multi-currency, cash management, term loans, revolving credit, overdrafts, equipment leasing, collateral and covenants, relationship pricing |
| **Leasing and hire-purchase company** | Asset-backed contracts, residual value, VAT on installments, insurance, repossession and remarketing |

## Scope

**In scope (core)**

- Party (customer) master, KYC status, relationships and hierarchies
- Deposits: current/checking, savings, term deposits, pockets/goals, sweeps, overdraft
- Lending: any amortizing, bullet, revolving or asset-backed product (see [05](05-lending-and-leasing.md))
- Leasing: finance lease, operating lease, hire purchase, balloon/residual
- Multi-currency double-entry ledger, sub-ledgers and general ledger
- Product engine, pricing engine, fees and charges
- Limits, collateral, guarantees and covenants
- Payments hub integration (domestic instant, cards, SWIFT/ISO 20022), not a full payments switch
- Trade finance: letters of credit, guarantees, collections, trade loans, supply-chain finance ([12](12-trade-treasury-syndication.md))
- Treasury operations: FX and money-market deals, real-time positions, revaluation, nostro reconciliation, liquidity metrics, FTP
- Syndicated lending as lender and as agent, including secondary transfers
- Accounting (IFRS 9 / TFRS 9 ECL and EIR, IFRS 16 / TFRS 16 lessor accounting)
- Collections and recoveries
- Regulatory reporting data feeds
- AI agent layer and AI decisioning services

**Out of scope (integrate, do not build)**

- Card issuing processor and card switch (integrate with a processor)
- Payment scheme connectivity (integrate with scheme gateways)
- Trading front office for complex derivatives (treasury operations are in scope)
- Full CRM and marketing automation (we expose events and APIs to them)
- Identity verification vendors (eKYC/biometrics: we orchestrate them)

## Design principles

1. **The ledger is sacred.** Every movement of value is a balanced, immutable, append-only posting. Corrections are reversals, never updates. Balances are projections of postings and can always be rebuilt.
2. **Products are data.** A product is a versioned definition (parameters + rules + accounting mapping), not a code branch. Product changes go through simulation and maker-checker approval, not a release.
3. **Event-sourced at the edges of value.** Contract and account state transitions emit domain events; downstream systems (GL, reporting, AI features, notifications) consume events, never poll the core database.
4. **Bitemporal by default.** Every fact has a *value date* (when it is economically effective) and a *booking time* (when we recorded it). Back-valued transactions trigger deterministic recalculation.
5. **No batch windows.** Accruals, billing, aging and fee assessment are scheduled per account and processed continuously. The bank never "closes" for EOD.
6. **API-first and agent-first.** Every capability is an API with a machine-readable contract. The same contracts are exposed as governed tools to AI agents. There are no back-door screens that bypass the API.
7. **AI proposes, policy disposes.** AI can draft, decide within delegated authority, and act through tools, but every action passes the same entitlement, limit and policy checks as a human, and every AI decision is logged with inputs, model version and explanation.
8. **Multi-tenant, multi-entity, multi-jurisdiction.** Tenant isolation, per-tenant chart of accounts, calendars, currencies, tax rules and regulatory packs are part of the model from day one.
9. **Deterministic and replayable.** Given the same events and product version, the engine produces the same balances to the satang/cent. This is what lets us simulate products, reconcile, and pass audits.
10. **Secure and compliant by construction.** Zero-trust networking, encryption everywhere, PII tokenization, least privilege, maker-checker on sensitive operations, and a tamper-evident audit log.

## Non-goals

- Being a general-purpose low-code platform. Configuration is powerful but bounded and typed.
- Supporting every legacy batch file format natively. Legacy integration goes through an adapter layer.
- Letting AI move money without a policy decision and an audit record.

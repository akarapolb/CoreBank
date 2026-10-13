# 04 — Product engine

The product engine is what makes "support any loan product, including leasing" true. Products are **composed from typed building blocks** and published as immutable versions.

## Product definition

A product version is a document validated against a schema, plus bounded expressions in **CEL** where logic is needed. Example (abridged) for an auto hire-purchase product:

```yaml
product: AUTO_HP_NEW
version: 3
family: ASSET_FINANCE          # DEPOSIT | LOAN | CREDIT_LINE | LEASE | ASSET_FINANCE
currency: THB
segment: [RETAIL, SME]

parameters:
  principal:       { min: 100000, max: 5000000 }
  term_months:     { allowed: [12, 24, 36, 48, 60, 72, 84] }
  down_payment_pct:{ min: 0.0, max: 0.8 }
  balloon_pct:     { min: 0.0, max: 0.4, default: 0.0 }

pricing:
  rate_type: FLAT                 # FLAT | FIXED | FLOATING | STEPPED | CUSTOM
  rate_table: hp_new_car_2026q4   # resolved by pricing service by term, LTV, risk grade
  disclosed_rate: EFFECTIVE       # regulator-required effective rate disclosure
  day_count: ACT_365F

schedule:
  method: ANNUITY_FROM_FLAT       # see 05 for the method catalog
  frequency: MONTHLY
  first_due: { rule: ONE_PERIOD_AFTER_DISBURSEMENT }
  holiday_rule: FOLLOWING

income_recognition:
  method: EIR                     # EIR | STRAIGHT_LINE | RULE_OF_78 (where permitted)
  deferred_fees: [ORIGINATION_FEE]

tax:
  vat:
    applies_to: [INSTALLMENT]     # VAT on each HP installment
    rate: 0.07
    point: DUE_DATE

fees:
  - code: ORIGINATION_FEE
    trigger: DISBURSEMENT
    amount: "min(max(principal * 0.01, 2000), 20000)"   # CEL
  - code: LATE_CHARGE
    trigger: DAILY_WHILE_OVERDUE
    amount: "overdue_installment * annual_rate(0.15) / 365"
    cap: REGULATORY_CAP

repayment_waterfall: [FEES_DUE, PENALTY_DUE, VAT_DUE, INTEREST_DUE, PRINCIPAL_DUE]

early_settlement:
  allowed: true
  rebate: REGULATORY_FORMULA_TH_HP
  fee: "remaining_interest * 0.0"

delinquency:
  buckets: [1, 30, 60, 90]
  non_accrual_at_dpd: 90          # move interest to suspense
  write_off_at_dpd: 360

asset:
  required: true
  types: [VEHICLE_NEW]
  ownership_until_paid: LESSOR    # title transfers at final payment
  insurance: { required: true, payer: CUSTOMER, financed_allowed: true }

lifecycle_events:                 # hooks to workflows
  on_npl: collections.start_strategy("auto_hp_default")
  on_terminate: leasing.start_repossession

accounting:
  gl_mapping: hp_standard_th_v2   # balance type × event → GL accounts
```

## Building blocks

| Block | Options |
|---|---|
| **Family** | Deposit, term deposit, loan, revolving credit, overdraft, lease (finance/operating), hire purchase, BNPL, floor plan |
| **Structure** | Single contract, or master agreement with child schedules (fleet), or revolving line with per-unit drawdowns (floor plan); cross-default and co-terminus flags |
| **Disbursement** | Single, tranches/drawdowns, revolving, per-unit (floor plan), direct-to-dealer/merchant/distributor, to escrow, netted against another arrangement (floor plan payoff from retail HP) |
| **Curtailment** | Age-based principal reductions (days → % of original), payoff-on-sale window |
| **Interest-free period** | Days free, who pays (customer, dealer, OEM), income recognition of subvention |
| **Billing** | Per contract, or consolidated across a master agreement or dealer line |
| **Rate** | Flat, fixed, floating (base + spread, reset frequency, floor/cap), stepped, promotional, tiered (deposits), relationship-based |
| **Schedule method** | Annuity (equal installment), equal principal, bullet, balloon, interest-only then amortizing, step-up/step-down, seasonal/skip months, custom upload, annuity-from-flat |
| **Frequency** | Daily, weekly, bi-weekly, monthly, quarterly, semi-annual, annual, at maturity |
| **Interest calc** | Simple, compound (daily/monthly), on outstanding or on original principal (flat), day-count convention |
| **Income recognition** | EIR, straight-line, sum-of-digits (where regulator permits) |
| **Fees** | Event-triggered or periodic, CEL formula, caps, waivable with authority, amortized or upfront |
| **Waterfall** | Ordered allocation across balance types, oldest-first or per-installment, configurable for NPL |
| **Tax** | VAT/GST on installments, interest, or fees; withholding tax on deposit interest; stamp duty |
| **Grace & holidays** | Principal grace, full payment holiday (capitalized or deferred interest), regulator-mandated relief programs |
| **Early settlement** | Allowed/blocked, prepayment fees, rebates, partial prepayment (reduce term or reduce installment) |
| **Delinquency** | Bucket boundaries, non-accrual trigger, penalty rules, write-off |
| **Asset** | Asset types, title ownership, insurance, residual value, maintenance, return conditions |
| **Accounting** | GL mapping per balance type and event; IFRS 9 classification (amortized cost / FVOCI / FVTPL) |

## Lifecycle of a product

```
Draft  →  Simulate  →  Review (maker-checker: product, risk, finance, compliance)  →  Publish v(n)  →  Retire
```

- **Simulation**: the simulator runs the definition against thousands of synthetic and historical scenarios (back-valued payments, rate resets, holidays, early settlement, default) and produces schedules, accounting entries, yield, and regulatory disclosures. Results become golden tests stored under `products/<code>/tests/`.
- **Versioning**: arrangements pin the version they were opened on. Changes that must apply to existing contracts (e.g. a rate change on floating loans) are explicit **migrations** with their own approval, not silent edits.
- **AI co-pilot**: product managers can describe a product in natural language; the AI drafts the definition, runs the simulator, and highlights regulatory issues. A human still approves publication (see [06](06-ai-native.md)).

## Master Builder

Master Builder is the guided way to create and change products on top of the product engine. It never bypasses the engine: everything it produces is an ordinary product definition, simulated and approved like any other.

| Part | What it does |
|---|---|
| Template library | Starts from a maintained template per family and rule pack (new and used car HP, motorcycle HP, finance lease, personal loan, floating home loan, and more over time) |
| Product copilot | Turns a plain-language brief ("used car HP, 200k to 1.5M, 24 to 72 months, flat 4.25%, 20% balloon…") into a draft definition, listing what it understood and what it assumed; it never publishes |
| Eight guided steps | Basics, pricing, schedule, fees and tax, repayment and arrears, changes and early settlement, accounting, review |
| Live rule checks | Each step is checked against the jurisdiction rule pack (rate caps, VAT applicability, rebate rules, non-accrual limits, method and rate compatibility) with the failing step highlighted |
| Scenario simulation | Every draft is run through standard scenarios (on time, missed payments, early settlement, rate rise, payment holiday); results become the product's golden tests |
| Diff and approval | Shows exactly what changed from the template or the live version, then sends the definition to maker-checker approval |

Templates, rule packs and the copilot's evaluation suites are maintained per market and are part of the commercial jurisdiction packs.

## Why not code per product, and why not a full scripting language

- Code per product (classic cores) makes every new product a release and every bug a production incident.
- Full scripting (e.g. Python "smart contracts") is flexible but hard to bound, test exhaustively and audit.
- **Typed blocks + CEL** cover the vast majority of products with guarantees (termination, no side effects, static validation). For the rare product that truly needs new behavior, we add a new block to the engine with tests, once, and every product benefits. See [ADR-0003](adr/0003-product-definition.md).

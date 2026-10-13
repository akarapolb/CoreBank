# 05 — Lending and leasing

## Coverage matrix

| Product | Family | Schedule | Notes |
|---|---|---|---|
| Personal loan | LOAN | Annuity | Risk-based pricing, instant decision |
| Nano / micro loan | LOAN | Annuity or daily | Thin-file AI scoring, small tickets |
| BNPL / installment | LOAN | Equal installments, 0% merchant-subsidized | Merchant subvention income via EIR |
| Mortgage / home loan | LOAN | Annuity, floating with resets, step rates | Teaser rates, collateral, insurance, refinance |
| Auto hire purchase | ASSET_FINANCE | Annuity from flat rate, balloon | VAT per installment, title retention, repossession |
| Motorcycle HP | ASSET_FINANCE | Annuity from flat | High volume, field collections |
| Fleet HP / fleet lease | ASSET_FINANCE (master agreement) | One schedule per call-off; annuity from flat or effective | Consolidated billing, per-vehicle title, cross-default, co-terminus option |
| Floor plan (dealer inventory) | FLOOR_PLAN | Per-unit drawdown, interest after free period, aging curtailments, bullet on sale | OEM subvention, stock audits, sold-out-of-trust control |
| Finance lease (equipment) | LEASE | Annuity, residual value | IFRS 16 lessor: net investment in lease |
| Operating lease | LEASE | Rental | Asset on lessor books, depreciation, maintenance |
| Title loan (vehicle-backed) | LOAN | Annuity or bullet | Collateral registry integration |
| SME term loan | LOAN | Equal principal, grace periods | Facility limits, covenants |
| Revolving credit / overdraft | CREDIT_LINE | Interest on utilized, commitment fee on unutilized | Limit reviews, annual renewal |
| Working capital / invoice finance | CREDIT_LINE | Bullet per drawdown | Receivables as collateral |
| Syndicated loans (lender or agent) | LOAN (multi-party) | Per tranche; term or RFR compounded in arrears | Pro-rata distribution, fees, secondary transfers ([12](12-trade-treasury-syndication.md)) |
| Trade loans, bills discounting, forfaiting | LOAN | Bullet per bill, discount with EIR | Linked to LCs or invoices ([12](12-trade-treasury-syndication.md)) |
| Credit card receivable (later) | CREDIT_LINE | Minimum due, statement cycle | Via card processor integration |

## Schedule engine

Inputs: principal, rate (resolved), term, frequency, method, first due date, calendar, day count, rounding rules, balloon/residual, grace/holiday segments.

Methods:

- **Annuity**: equal installment `A = P·r / (1 − (1+r)^−n)`, last installment absorbs rounding. Balloon variant amortizes `P − PV(balloon)`.
- **Equal principal**: fixed principal, declining interest.
- **Bullet / interest-only**: interest per period, principal at maturity.
- **Annuity-from-flat** (common in auto hire purchase): total interest = `P × flat_rate × years`; installment = `(P + total interest) / n`; the engine derives the **effective interest rate** (IRR) for disclosure and splits each installment into interest and principal by EIR so accounting is correct, not by straight line.
- **Stepped / seasonal / custom**: segments with their own rate, installment or skip rules; or an uploaded schedule validated for balance and positive principal.

Schedules are **regenerated deterministically** on any event that changes economics (rate reset, partial prepayment, restructuring, back-valued payment), with the old schedule kept as history.

## Interest accrual and income recognition

- Daily accrual per arrangement, triggered by its own durable timer (no global EOD).
- Accrual precision kept at high scale (e.g. 10 decimals) in a separate accumulator; only rounded amounts post to the ledger, with residual carried forward.
- **EIR (IFRS 9 / TFRS 9)**: deferred fees and costs, subventions and transaction costs are amortized into interest income at the effective rate. The EIR is recomputed on modification.
- **Non-accrual**: at the configured DPD threshold, interest accrual continues in memo/suspense and stops being recognized as income; recoveries reverse suspense per policy.

## Billing, repayment and allocation

1. On due date the scheduler **bills**: moves amounts from accrued/outstanding into `*_DUE` balances and emits `InstallmentBilled`.
2. Incoming payments (direct debit, instant payment, counter, dealer) post to the arrangement and are **allocated** by the product's waterfall.
3. Overpayments go to a configurable target: prepayment, credit balance, or advance payment of next installments.
4. **Aging** updates DPD daily per arrangement and emits `DelinquencyChanged`, which feeds collections and IFRS 9 staging.

## Modifications and restructuring

| Modification | Engine behavior |
|---|---|
| Partial prepayment | Reduce term or reduce installment (customer or product choice) |
| Rate change / reset | New rate segment from effective date; regenerate schedule |
| Payment holiday | Insert holiday segment; interest capitalized, deferred, or waived |
| Term extension | Regenerate remaining schedule |
| Restructuring (TDR) | New terms, modification gain/loss under IFRS 9, staging impact, regulatory flags |
| Debt consolidation | Close several arrangements into one new arrangement atomically |
| Write-off and recovery | Move balances to off-balance memo; recoveries post to income |

Every modification is a workflow with maker-checker and delegated authority limits, and can be proposed by an AI agent but approved per policy.

## Leasing and hire purchase lifecycle

```
Quote → Credit decision → Contract & e-sign → Asset ordered from dealer/supplier
     → Asset delivered & registered → Disburse to dealer → Active (billing, VAT, insurance)
     → [Early settlement | Maturity & title transfer | Default → Repossession → Remarketing → Shortfall recovery]
```

Leasing-specific capabilities:

- **Asset register**: make/model/VIN/chassis/engine/registration, supplier, cost, depreciation (operating lease), location, condition, telematics link (optional).
- **Residual value**: guaranteed vs unguaranteed, RV curves per asset class, RV risk monitoring, end-of-term options (return, buy at RV, refinance balloon).
- **Lessor accounting (IFRS 16 / TFRS 16)**: finance lease recognized as net investment in the lease with finance income at the implicit rate; operating lease keeps the asset on books with straight-line rental income and depreciation.
- **Tax**: VAT on installments by due date; tax invoices issued per installment; handling of VAT on repossession and resale.
- **Insurance**: policy linkage, financed premiums, renewal tracking, claims as payments to the contract.
- **Dealer channel**: dealer onboarding, subvention/commission (amortized via EIR), floor-plan financing (see below).
- **Repossession and remarketing**: legal notice timelines per jurisdiction, field agent assignment, storage costs, auction proceeds allocation, deficiency claim.
- **Title management**: title retained by lessor until full payment; registry transfer workflow at payoff.

## Fleet hire purchase and leasing

For business customers financing many vehicles over time.

**Structure.** A **master agreement** is a parent arrangement holding the commercial terms: facility limit, rate card by term and vehicle class, fees, insurance requirements, cross-default and reporting covenants. Each **call-off** creates a **schedule**: a child arrangement for a batch of vehicles with its own rate (locked from the rate card at call-off), term, schedule, VAT and EIR. Each vehicle is an **asset** under its schedule with its own title, insurance and registration.

```
MasterAgreement MA-2025-0031 (limit ฿80M, rate card, cross-default)
 ├─ Schedule S-01  12 × Isuzu FVM   60m  flat 3.20%  ── Asset × 12 (VIN, title, insurance, cost centre)
 ├─ Schedule S-02  10 × Hino 500    60m  flat 3.20%  ── Asset × 10
 └─ Schedule S-03   8 × Isuzu NLR   48m  flat 3.10%  ── Asset × 8
```

| Capability | Behavior |
|---|---|
| Call-off | Draws on the master facility atomically; rate from the rate card valid on the call-off date; dealer paid directly |
| Consolidated billing | One invoice per billing cycle across all schedules, with a VAT line per vehicle; one payment allocated across schedules by the master waterfall (oldest due first) |
| Co-terminus | Optional: a new schedule's term is set to end with an existing schedule, so the whole fleet matures together |
| Per-vehicle events | Early payoff, substitution (replace a written-off vehicle), transfer between cost centres, repossession of one vehicle, without touching the others |
| Cross-default | A default on any schedule triggers default status, collections and TFRS 9 stage 3 on every schedule under the master agreement |
| Fleet services (optional) | Maintenance, tyres, insurance and telematics as separately priced service lines on full-service operating leases; pass-through to providers |
| Reporting | Cost-centre and driver allocation, fleet age and mileage, exposure by vehicle class |

## Floor plan (dealer inventory) financing

A revolving line that funds a dealer's stock, vehicle by vehicle.

**Structure.** The **dealer line** is a revolving facility (with sub-limits for new, used and demo units). Each vehicle the dealer receives from the distributor is a **unit drawdown**, paid straight to the distributor and secured by the vehicle itself; the bank holds the registration book. A unit is repaid in full when the vehicle is sold.

| Capability | Behavior |
|---|---|
| Interest | Daily on each unit after an **interest-free period** (typically 30–90 days for new units), which the OEM pays as subvention; used units bear interest from day one; rate may tier by unit age |
| Curtailment | Scheduled principal reductions as a unit ages, configured per product (example: 10% at 120 days, 25% at 180, the rest at 270) |
| Payoff on sale | Dealer must repay within an agreed window (example: 48 hours). When the retail buyer finances the car with the same bank, the floor-plan unit is **repaid automatically by netting the retail HP disbursement** |
| Billing | Monthly dealer statement of interest and curtailments due, per unit |
| Stock audits | Periodic physical audits (VIN sighting) scheduled per dealer risk; results recorded per unit |
| Sold out of trust (SOT) | AI matches vehicle registration, insurance and retail-finance events against financed VINs; a sold-but-unpaid unit raises an alert, opens an audit and can freeze new drawdowns |
| Risk mitigants | OEM repurchase agreements, dealer guarantees, deposit margins; aging and SOT feed the dealer's risk grade |

Accounting: units are drawdowns on a revolving credit arrangement; OEM-paid interest is interest income from the OEM, not the dealer; curtailments reduce the unit's principal; ECL is assessed at dealer level.

## IFRS 9 / TFRS 9 expected credit loss

- Staging from DPD, SICR signals (AI model + rules), forbearance and watch-list.
- ECL = PD × LGD × EAD over 12 months (stage 1) or lifetime (stages 2–3), with macroeconomic scenarios.
- Monthly ECL run posts provisions through the accounting service; models registered and governed under model risk management (see [06](06-ai-native.md)).

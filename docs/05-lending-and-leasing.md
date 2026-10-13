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
| Finance lease (equipment) | LEASE | Annuity, residual value | IFRS 16 lessor: net investment in lease |
| Operating lease | LEASE | Rental | Asset on lessor books, depreciation, maintenance |
| Title loan (vehicle-backed) | LOAN | Annuity or bullet | Collateral registry integration |
| SME term loan | LOAN | Equal principal, grace periods | Facility limits, covenants |
| Revolving credit / overdraft | CREDIT_LINE | Interest on utilized, commitment fee on unutilized | Limit reviews, annual renewal |
| Working capital / invoice finance | CREDIT_LINE | Bullet per drawdown | Receivables as collateral |
| Corporate term / syndicated (later) | LOAN | Custom | Agency, participations, multi-currency |
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
- **Dealer channel**: dealer onboarding, subvention/commission (amortized via EIR), floor-plan financing (later).
- **Repossession and remarketing**: legal notice timelines per jurisdiction, field agent assignment, storage costs, auction proceeds allocation, deficiency claim.
- **Title management**: title retained by lessor until full payment; registry transfer workflow at payoff.

## IFRS 9 / TFRS 9 expected credit loss

- Staging from DPD, SICR signals (AI model + rules), forbearance and watch-list.
- ECL = PD × LGD × EAD over 12 months (stage 1) or lifetime (stages 2–3), with macroeconomic scenarios.
- Monthly ECL run posts provisions through the accounting service; models registered and governed under model risk management (see [06](06-ai-native.md)).

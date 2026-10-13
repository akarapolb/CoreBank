# 03 — Domain model

## Core entities

```
Tenant (bank / brand)
 └─ LegalEntity (booking entity, base currency, chart of accounts, calendar, tax regime)
     ├─ Party ──< PartyRelationship >── Party        (owner, guarantor, director, group member)
     │    └─ KycProfile, Consent, RiskRating
     ├─ Product ──< ProductVersion                    (immutable once published)
     ├─ Facility (limit tree for commercial)          ─< Facility (child limits)
     │    └─ Covenant, CollateralLink
     ├─ Arrangement (the contract: deposit, loan, lease, HP)
     │    ├─ product_version_id (pinned; migrations are explicit)
     │    ├─ ArrangementParty (roles: borrower, co-borrower, guarantor, lessee)
     │    ├─ Schedule ──< ScheduleLine (due date, principal, interest, fees, VAT)
     │    ├─ Asset (for leasing/HP/secured loans)
     │    └─ LedgerAccount (one or more, per balance purpose)
     ├─ Collateral ──< Valuation
     └─ LedgerAccount ──< Posting >── PostingBatch (balanced set, idempotency key)
```

## Party

- Types: `INDIVIDUAL`, `SOLE_PROPRIETOR`, `COMPANY`, `PARTNERSHIP`, `GOVERNMENT`, `FINANCIAL_INSTITUTION`.
- Relationships form a graph (beneficial owners, group companies, household). Group exposure is computed over this graph.
- PII is stored in a dedicated vault and referenced by token elsewhere (see [08](08-security-and-compliance.md)).

## Arrangement

The **arrangement** is the generic contract. Deposits, loans, credit lines, leases and hire-purchase agreements are all arrangements whose behavior comes from their product version.

State machine (common skeleton; products may add sub-states):

```
DRAFT → PENDING_APPROVAL → APPROVED → ACTIVE ⇄ SUSPENDED
                                     ↓
                    MATURED / PAID_OFF / TERMINATED / WRITTEN_OFF → CLOSED
```

Arrangements can form a hierarchy through `parent_arrangement_id`:

| Pattern | Parent | Children |
|---|---|---|
| Fleet | Master agreement (terms, limit, rate card, cross-default) | Schedules, one per call-off, each with its own assets |
| Floor plan | Dealer line (revolving, sub-limits by unit type) | Unit drawdowns, one per VIN |
| Commercial | Facility | Drawdowns, loans, leases under the facility |

A parent can carry a **billing account** so that all children are invoiced and paid together; allocation across children follows the parent's waterfall. Delinquency and default can be propagated from a child to its siblings (cross-default).

Lending adds delinquency status (`CURRENT`, `DPD_1_30`, `DPD_31_60`, `DPD_61_90`, `NPL_90+`) and IFRS 9 stage (`1`, `2`, `3`, `POCI`) as orthogonal attributes, not states.

## Ledger

### Ledger account and balance types

A ledger account belongs to one arrangement (or is an internal/GL account) and holds multiple **balance types** so that one contract does not need dozens of accounts:

| Balance type | Example |
|---|---|
| `PRINCIPAL` | Outstanding loan principal, deposit balance |
| `INTEREST_ACCRUED` | Interest accrued not yet billed |
| `INTEREST_DUE` | Billed and unpaid interest |
| `PRINCIPAL_DUE` | Billed and unpaid principal |
| `FEES_DUE` | Billed fees |
| `PENALTY_DUE` | Late payment charges |
| `VAT_DUE` | VAT billed on installments (HP/lease) |
| `SUSPENDED_INTEREST` | Interest in suspense on non-performing loans |
| `UNEARNED_INCOME` | Unearned finance income (lease/HP) |
| `DEFERRED_FEES` | Fees amortized via EIR |
| `HOLD` | Reserved funds (card auth, pending transfer) |

Product definitions declare which balance types they use and how each maps to the GL.

### Posting

```
PostingBatch {
  id, tenant_id, idempotency_key, value_date, booking_ts,
  actor { type: HUMAN|SYSTEM|AGENT, id, on_behalf_of },
  reason_code, trace_id, product_version_id?, reverses_batch_id?,
  legs: [ { account_id, balance_type, currency, amount (minor units), side: DEBIT|CREDIT } ]
}
```

Invariants enforced by the ledger, not by callers:

1. Σ debits = Σ credits per currency per batch (FX uses a position account per currency pair).
2. Postings are immutable; reversal is a new batch that references the original.
3. Amounts are integers in minor units with currency-defined exponent; no floating point anywhere.
4. A batch is atomic: all legs or none.
5. Available balance = ledger balance − holds + authorized overdraft; enforced at commit.

### Balances

Balances are materialized projections updated in the same transaction as postings, with point-in-time snapshots by value date to make historical queries and back-valuation cheap. A nightly (non-blocking) job rebuilds a sample of balances from raw postings and alerts on any drift.

## Limits, collateral and covenants (commercial)

- **Facility tree**: group limit → company limit → product sub-limits (term loan, revolver, overdraft, leasing line, trade line). Utilization is checked atomically at drawdown.
- **Collateral**: types (real estate, vehicle, machinery, deposit, guarantee, receivables), valuations over time, haircuts, allocation across arrangements, LTV monitoring.
- **Covenants**: financial ratios (DSCR, leverage), reporting obligations, test schedules, breach workflow. AI extracts figures from submitted financial statements (see [06](06-ai-native.md)).

## Calendars, day counts and money

Shared platform library, heavily property-tested:

- Business calendars per tenant/country, with business-day conventions (following, modified following, preceding).
- Day counts: Actual/365 Fixed, Actual/360, Actual/Actual (ISDA), 30/360, 30E/360.
- Rounding per currency and per purpose (accrual precision ≠ billing precision), with residual tracking so rounding never leaks value.

# 12 — Trade finance, treasury and syndication

These three capabilities close the biggest functional gaps against established global cores ([11](11-global-scale-and-benchmark.md)). They are built **natively** on the same ledger, product engine, limits and workflow services, so a letter of credit, an FX deal and a syndicated loan share one customer view, one limit tree and one set of books with deposits and loans.

## 1. What the core needs first (shared foundations)

| Foundation | Why | Design |
|---|---|---|
| **Contingent and memo ledger** | LCs, guarantees and undrawn commitments are obligations, not cash | Off-balance-sheet balance types (`CONTINGENT_LC`, `CONTINGENT_GUARANTEE`, `UNDRAWN_COMMITMENT`, `AGENCY_CLIENT_MONEY`) posted with the same balanced batches to contra accounts; reported separately for capital (credit conversion factors) |
| **Multi-party arrangements** | Syndicated loans and confirmed LCs have several banks on one contract | Arrangement roles extended: agent, lender, participant, confirming bank, advising bank, beneficiary; shares stored as exact fractions |
| **Real-time currency positions** | Every customer FX conversion, trade payment and nostro movement changes the bank's exposure | Every posting in a non-base currency updates a position per currency, entity and book in the same transaction |
| **Market data** | Pricing, revaluation, RFR compounding | Rates service: FX spot and forward points, benchmark rates (THOR, SOFR, SONIA, €STR), yield curves, with value-dated history |
| **SWIFT FIN and ISO 20022 messaging** | Trade, treasury and agency all communicate by message | payments-hub extended with MT 3xx (treasury), MT 7xx (trade), MT 9xx (statements) and ISO 20022 equivalents; message ↔ event mapping |
| **Document workflows** | Trade and agency run on documents | Document store with versioning, AI extraction, checklists and maker-checker |
| **Exposure limits** | New risk types | Limit tree extended: trade lines, counterparty and settlement limits, country and bank limits |

## 2. Trade finance

### 2.1 Products

| Product | Rules | Ledger effect |
|---|---|---|
| Import letter of credit (sight, usance, deferred payment) | UCP 600, ISBP | Contingent on issuance; becomes an acceptance liability on acceptance; cash on payment |
| Export LC: advising, confirmation, negotiation, discounting | UCP 600 | Confirmation is contingent; negotiation and discounting are funded assets |
| Standby LC | ISP98 or UCP 600 | Contingent until claim |
| Bank guarantees: bid, performance, advance payment, financial | URDG 758 or local law | Contingent until claim; margin held |
| Documentary collections, import and export | URC 522 | No bank liability unless avalised |
| Trade loans: import loan, packing credit, pre- and post-shipment | Product engine | Funded loans linked to the underlying LC or invoice |
| Bills discounting, forfaiting | Product engine | Discounted asset; yield amortized via EIR |
| Supply-chain finance: payables (reverse factoring) and receivables finance | Programme agreements | Funded per invoice; anchor buyer limit |

### 2.2 Lifecycle: import LC

```
Application (portal or API) → Credit and limit check on trade line → Margin hold
 → Issue (MT700 / ISO 20022) → Contingent posting
 → Amendments (MT707), beneficiary consent
 → Documents presented → AI-assisted examination against LC terms (5 banking days)
 → Accept, or refuse with discrepancies (MT734), or applicant waiver
 → Usance: acceptance liability → Maturity payment (MT756/MT202) → Contingent released
 → Settlement, commission true-up, closure
```

### 2.3 Capabilities

- **Charges:** issuance, amendment, advising, confirmation, discrepancy and courier fees from fee tables; LC commission accrued over the tenor.
- **Margins:** cash margin held as a deposit hold or a pledged deposit; partial release on partial drawings.
- **Limits:** trade sub-limits per customer, confirmation limits per issuing bank and country, all checked atomically.
- **Screening:** parties, banks, vessels, ports and goods (dual-use) at every event, not only at issuance.
- **AI:** document examination that lists discrepancies against the LC with citations for the checker; trade-based money laundering signals (price anomalies, unusual routes, repeated amendments).
- **Digital trade:** eUCP for electronic presentations; electronic bills of lading where law allows (Phase 5).

## 3. Treasury

Scope is **treasury operations in the core**: what a bank needs to run its currency, liquidity and funding books in real time. A trading front office with complex derivatives stays out of scope and integrates through APIs.

| Capability | Design |
|---|---|
| FX deals: spot, forward, swap, customer FX | Deal capture with dealer, counterparty and settlement limits; confirmations (MT300 / ISO 20022) and matching; settlement through nostros or CLS |
| Money market: interbank placements and borrowings, repo | Deals as arrangements with schedules; collateral for repo; MT320 confirmations |
| Real-time positions | Currency position per entity and book updated in the posting transaction; cash position per currency and value date for 30 days ahead |
| Revaluation | FX revaluation of positions and foreign-currency balances at the entity's cut-off, posted as balanced batches; forwards revalued against curves |
| Nostro management | Expected flows from every posting; statements (MT950, camt.053) matched automatically; AI proposes matches for exceptions; breaks aged and owned |
| Liquidity | Intraday liquidity per currency; LCR and NSFR inputs computed from postings and contractual flows; maturity gap data for ALM |
| Funds transfer pricing | FTP curves applied to every deposit and loan at origination, so product profitability is known per contract |
| Rates and curves | Benchmark rates, RFR compounding (lookback, observation shift, lockout), curves for pricing and revaluation |
| Hedge accounting | TFRS 9 hedge designation and effectiveness for the bank's own hedges (Phase 5) |

## 4. Syndication

### 4.1 Roles

| Role | What Fabor OS does |
|---|---|
| **Lender (participant)** | Books the bank's share as its own loan; receives cash flows from the agent; tracks the full facility for reference |
| **Agent** | Runs the whole facility: lender register, drawdowns, rate fixing, interest and fee calculation per lender, collection and distribution, notices, transfers, covenant monitoring; agency cash is client money (memo) |
| **Arranger** | Commitments, allocation, sell-down to target hold |
| **Security agent** | Holds collateral on behalf of lenders; enforcement waterfall |

### 4.2 Structure

```
Facility agreement (borrower, agent, governing law)
 ├─ Tranche A  term loan     THB, THOR compounded in arrears + margin
 ├─ Tranche B  term loan     USD, SOFR compounded in arrears + margin
 └─ Tranche C  revolving     multi-currency, commitment and utilization fees
     └─ Lender shares per tranche (exact fractions) → change by transfers
```

### 4.3 Capabilities

- **Drawdowns:** utilization request, conditions precedent, funding notices to each lender pro rata, funding received, disbursement to the borrower; a defaulting lender is handled without blocking others.
- **Interest:** per tranche and interest period; term rates or RFR compounded in arrears with lookback, observation shift and lockout; margin ratchets on covenant levels; default interest.
- **Fees:** arrangement, upfront, commitment (on undrawn), utilization, agency and ticking fees, each with its own basis and distribution.
- **Distribution:** every borrower payment split by tranche and lender share, with a waterfall (fees, interest, principal) and rounding residuals assigned deterministically.
- **Secondary transfers:** assignment, novation and funded or unfunded participation; trade date versus settlement date; accrued interest and fee split between seller and buyer; lender register updated.
- **Notices:** generated and sent (email, portal, SWIFT); inbound notices read by AI into structured instructions for a checker.
- **Covenants and amendments:** majority and all-lender consents tracked; amendments versioned like product versions.

## 5. Architecture changes

| New service | Owns | Main events |
|---|---|---|
| `trade-finance` | LCs, guarantees, collections, trade loans, SCF programmes, presentations | `LcIssued`, `LcAmended`, `PresentationExamined`, `DiscrepancyRaised`, `LcPaid`, `GuaranteeClaimed` |
| `treasury` | Deals, positions, nostro expectations, revaluation runs, liquidity metrics | `FxDealBooked`, `PositionChanged`, `NostroBreakOpened`, `RevaluationPosted` |
| `syndication` | Facilities, tranches, lender register, notices, transfers | `DrawdownNoticed`, `LenderFunded`, `InterestFixed`, `DistributionPosted`, `ShareTransferred` |
| `market-data` | Rates, curves, benchmark fixings | `RateFixed`, `CurvePublished` |

All four follow the module rules in [10](10-application-architecture.md): pure domain, ports and adapters, money through the ledger only. New calculation engines: `engine-rfr` (compounding conventions), `engine-pro-rata` (exact share allocation with residual rules) and `engine-revaluation`.

## 6. Phasing

| Phase | Trade finance | Treasury | Syndication |
|---|---|---|---|
| 3 · months 14–20 | Contingent ledger, guarantees, import LC (sight), trade loans | Real-time positions, rates service, customer FX, nostro reconciliation, FTP | RFR engine, lender (participant) role |
| 4 · months 20–30 | Full LC lifecycle incl. usance and export, collections, SCF, AI document checks | FX and money-market deals, revaluation, liquidity metrics, CLS | Agent role: drawdowns, distribution, notices, secondary transfers |
| 5 · months 30–42 | eUCP and electronic bills of lading, Islamic trade products | Hedge accounting, ALM data for IRRBB | Security agent, multi-currency revolving with swingline |

## 7. Team

Add three squads at Phase 3: **trade finance** (with a UCP and URDG specialist), **treasury operations** (with a treasury accountant) and **lending agency** (with an LMA documentation specialist). The market-data service sits with the platform squad.

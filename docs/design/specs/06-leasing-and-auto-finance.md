# 06 · Leasing and auto finance

What the console must do for asset finance: a car on hire purchase from the dealer's quote to the registration book; servicing and early payoff of a hire-purchase contract with the rebate; finance and operating leases, including the end of an operating lease; fleet master agreements; dealer floor plan; and dealer management with commission and clawback.

Prototype: `docs/design/console-prototype/js/leasing.js` (HPQ-26-1031, the extra tabs on HP-2025-004812 and DLR-1, O1, lists), `records.js` (HP-2025-004812, F2, MA-1, DLR-1, FP-DEMO), `flows.js` (`hpSettle`, `fpPayoff`), `data.js` (`HP`, `FP`, `effRate`). Core: `lending` (`LeaseService`, `MasterService`, `FloorPlanService`, `LoanService` with `RebateRule`), `assets` (`AssetService`, `DealerService`), controllers `LeaseController`, `MasterController`, `FloorPlanController`, `DealerController`, `AssetController`, `BankingController` (see [core-api-inventory.md](core-api-inventory.md)).

## 1. Scope and users

In scope: dealer quotes and hire-purchase origination, the OCPB disclosure and signing, dealer payment, the registration book (เล่มทะเบียน) and its custody; HP servicing (insurance, compulsory cover, vehicle tax, change of registration), early settlement with the statutory rebate and the book's release; finance leases (TFRS 16 lessor); operating lease end (inspection, return, buy, extend); fleet master agreements and call-offs; floor plan lines, unit payoff and stock audit; dealer scorecard, commission and clawback.

Out of scope: arrears and repossession of vehicles (05-collections), the credit policy values (02-retail-lending), the loan application form for cars (field dictionary in [loan-application-fields.md](../loan-application-fields.md), product `car`).

| Role (prototype id) | Core role | May do |
|---|---|---|
| Credit officer (`credit`) | `credit-officer` | Change quote terms, decide an HP application (`credit` ≤ ฿2,000,000) |
| Operations checker (`ops`) | `ops`, `dealer-officer`, `floorplan-officer` | Pay a dealer (`payout` ≤ ฿5,000,000), floor plan payoff, commission run, HP settlement (`settle` ≤ ฿2,000,000), lease end with a goodwill reduction (`waive` ≤ ฿5,000) |
| Lease officer | `lease-officer` | Book leases, collect rent, terminate, purchase |
| Fleet officer | `fleet-officer` | Sign master agreements, call-offs, cross-default evaluation and cure |
| Asset officer | `asset-officer` | Asset register: delivery, activation, policies, title transfer, return |
| Head of operations | — | Second approver for `payout` and `waive` |

## 2. Screens

| Route | Kind | What it shows | Data |
|---|---|---|---|
| `leasing/overview` | Page | Contracts, financed this month, dealer lines in use by dealer (Bangna Motors 92%, Rama 9 Trucks 71%, Chiang Mai Auto 44%, Korat Isuzu 28%), items needing action | Aggregates |
| `leasing/quotes` | List | Dealer quotes: quote, customer, vehicle, financed, effective rate, stage | **New** quote store |
| `leasing/hp` | List | Contract, hirer, vehicle, outstanding, rebate rule, status | `GET /api/v1/loans` filtered by product family |
| `leasing/leases`, `ends` | Lists | Lease, lessee, kind, net investment, due now, end date, status | `GET /api/v1/leases/{id}` per lease; **New** list endpoint |
| `leasing/books` | List | Registration books: contract, vehicle, where the book is (dealer, DLT, vault, released), days since payout | `GET /api/v1/assets/{id}/title-history` |
| `leasing/fleet`, `floorplan`, `assets`, `dealers` | Lists | As in the prototype lists | Master, floor plan, asset and dealer endpoints |
| `HPQ-26-1031` | Record: hire-purchase deal | Facts: price incl. VAT, down payment, amount financed, instalment (incl. VAT, 60), effective rate (against the rate shown), debt service ratio. Tabs: Quote, Credit, Contract, Dealer payment, Registration book | Quote, product rules, applicant, bureau |
| `HP-2025-004812` | Record: hire purchase | Facts and tabs Summary, Schedule, Rebate (settlement today), Asset; added tabs Servicing, Registration book | `GET /api/v1/loans/{id}/detail`, `GET /api/v1/loans/{id}/settlement-quote`, asset |
| `F2` | Record: finance lease | Facts: net investment, rent, arrears. Tabs: Summary, Schedule, Accounting, Asset | `GET /api/v1/leases/{id}`, `/due`, `/carrying` |
| `O1` | Record: operating lease | Facts: lessee, vehicle, ends 31 Oct, km over, charges. Tabs: Return inspection, Options, Lessor accounting | **New** lease-end endpoints, asset condition |
| `MA-1` | Record: fleet master agreement | Facts: limit ฿500,000, in use ฿112,498.98 (22%), schedules 2, vehicles 3, monthly invoice ฿49,652.35, next due. Tabs: Schedules, Invoices, Covenants | `GET /api/v1/masters/{id}`, `/schedules`, `/facility`, `/invoice` |
| `DLR-1` | Record: dealer | Tabs: Lines, Performance, Agreement; added Scorecard, Clawback | `GET /api/v1/dealers/{id}`, floor plan lines, **New** scorecard and clawback |
| `FP-DEMO` | Record: floor plan line | Limit ฿6,800,000, units by VIN with state (floored, sold, aged), interest due, dealer account balance | `GET /api/v1/floorplans/{id}`, `/units`, `/exposure`, `/overdue-sales` |

### HPQ-26-1031 tabs

| Tab | Content |
|---|---|
| Quote | Customer (Supansa Meesuk, 31), vehicle (Toyota Yaris Ativ 1.2 Premium 2026, VIN), price incl. VAT ฿689,000, down payment, amount financed, flat rate and effective rate side by side against the cap, instalment and VAT, insurance with the bank as beneficiary |
| Credit | Score, income, debts, debt service ratio against the 60% policy, bureau and employment checks |
| Contract | The OCPB disclosure sheet: price, amount financed, flat and effective rate, total interest, instalment, rebate on early payoff by tier, fees, the right to cancel; signing state |
| Dealer payment | Amount financed less the dealer's subsidy = paid now; commission 2% deferred and subject to clawback |
| Registration book | The three steps with dates; due from the dealer within 45 days of payout |

### HP-2025-004812 added tabs

| Tab | Content |
|---|---|
| Servicing | Renewals with dates and reminders: first-class insurance (Viriyah, 4 Jan 2027), compulsory cover (พ.ร.บ.), annual vehicle tax; actions Renew the insurance, Change of registration |
| Registration book | Where the book is; after payoff, the release timeline (paid off, ownership passes to the hirer, transfer papers, book released within 15 days) |

## 3. Fields

### Change terms (`hpqTerms`)

| Field | English | Thai | Type | Values |
|---|---|---|---|---|
| `term` | Term | ระยะเวลา | choice | 48, 60, 72 months |
| `flat` | Rate | อัตรา | choice | 2.49% (Toyota campaign, the dealer pays the subsidy), 3.29% (standard), 6.10% (dealer's request) |
| `downPct` | Down payment | เงินดาวน์ | choice | 10, 15, 20, 25% |
| `guarantor` | Guarantor | ผู้ค้ำประกัน | choice | None; Kanya Meesuk, mother |

### Other dialogs

| Dialog | Fields | Validation |
|---|---|---|
| Credit decision (`hpqApprove`) | Read-only: amount financed, score 712, debt service ratio | — |
| Sign the contract (`hpqSign`) | Checkbox: the customer has read the disclosure sheet, including the effective rate and the rebate on early payoff | Must be ticked |
| Pay the dealer (`hpqPay`) | Read-only: to (Bangna Motors current account), checked documents (tax invoice, insurance, delivery) | — |
| Registration book (`hpqBook`) | Read-only: next step | Steps in order |
| Renew the insurance (`hpIns`) | Quote: Viriyah first class ฿17,900 sum insured ฿610,000; Dhipaya ฿18,450 / ฿620,000; Bangkok Insurance ฿19,200 / ฿630,000 | — |
| Change of registration (`hpReg`) | Read-only: request (move to Chiang Mai, new address and plate), fees | Book must be in the vault |
| Settle early (`hpSettle`) | Settlement date (today), pay from: cash or transfer at a branch; trade-in through Bangna Motors | — |
| Release the registration book (`hpRelease`) | Hand over: collected at branch 0123 with ID; registered courier; the bank transfers at the DLT (฿1,500) | Book not at the DLT |
| End of the lease (`leEnd`) | Choice: return, buy at market value, extend 12 months; goodwill reduction (money ≥ 0, return only, capped at the charges) | Amount ≥ 0 |
| October commission run (`dlrRun`) | Read-only: contracts 21, clawbacks 2 | — |
| Pay off a unit (`fpPayoff`) | Vehicle (VIN); type the VIN to confirm | Dealer account covers the payoff |

## 4. Actions

| Action | Who | Refused or blocked when (message) | Review shows | Approval | Effect | Core call |
|---|---|---|---|---|---|---|
| Change terms | Credit officer | Effective rate above the cap: "Above the cap for new cars. A 6.10% flat rate over 60 months is 11.02% effective. Lower the rate or the dealer funds the difference." (blocked) | Amount financed, instalment incl. VAT, effective rate against the cap, debt service ratio | — | Quote updated | **New** `POST /api/v1/hp-quotes/{id}/terms` |
| Credit decision | Credit officer | Effective rate over the cap: "Above the cap. Change the terms first." | Approves the amount financed with the stated terms | `credit` on the amount financed | Stage Approved; dealer told | `POST /api/v1/loans/applications` (decision only, no disbursement) — see gaps |
| Sign the contract | Credit officer, ops | Not approved; disclosure not acknowledged: "The disclosure sheet must be acknowledged before signing." | "Sends the contract for e-signature at the showroom; the signed copy goes to the customer's app and the vehicle can be handed over once the dealer is paid." | — | Contract HP-2026-001031 signed | **New** `POST /api/v1/hp-quotes/{id}/signature` |
| Pay the dealer | Ops | Not signed | Amount financed ฿551,200, dealer subsidy −฿22,048, paid now ฿529,152; commission ฿11,024 deferred | `payout` on the amount paid | Stage Paid; the contract is live; book tracking starts | `POST /api/v1/dealers/payments` (assetId) after `POST /api/v1/assets` (order) and `/delivery`, `/activation`. **New**: net of subsidy (core pays the whole cost) |
| Record a registration book step | Ops, asset officer | All steps done | The step; on receipt: owner the bank, possessor the hirer, VIN and engine number checked, scanned and vaulted | — | Next step recorded | `POST /api/v1/assets/{id}/title-transfer` (registered to the bank). **New** book custody states (at dealer, at DLT, in vault, released) |
| Renew the insurance | Ops | — | "Orders the Viriyah policy from 4 Jan 2027 with the bank as beneficiary; the premium is collected from Napat's account in three monthly parts. The customer may choose another insurer as long as the cover meets the contract." | — | Policy ordered | `POST /api/v1/assets/{id}/policies`; reminders from `GET /api/v1/assets/expiring-cover` |
| Change of registration | Ops | — | Book taken from the vault to the bank's agent at the DLT with a consent letter, back within 14 days; the hirer's new address updates the contract | — | Book at the DLT | **New** `POST /api/v1/assets/{id}/book-movements` |
| Settle early (HP) | Ops, teller | — | Instalments left × instalment, unearned interest, rebate (tier % of unearned), settlement before VAT, VAT 7%, total | `settle` on the total | Contract closed; tax invoice TI-2026-30118; title transfers to the hirer; book to release | `GET /api/v1/loans/{id}/settlement-quote`, `POST /api/v1/loans/{id}/settlement` (product rebate `TIERED:0.6,0.7,1.0`) |
| Release the book | Ops | Book still at the DLT: "The book is at the DLT. Wait for it to come back from the change of registration." | Releases the book with the bank's power of attorney and the transfer form; the vault record closes | — | Book released (branch, courier or transferred at the DLT) | `POST /api/v1/assets/{id}/title-transfer` (to the hirer). **New** release method and fee |
| End of the lease (O1) | Ops | Goodwill above the charges is capped | The effect of the choice on the lessor's books (§ calculations) and what happens to the car | Goodwill > 0: `waive` on the goodwill (ops ฿5,000) | Return booked for 31 Oct and charges billed; or sale agreed with tax invoice and transfer papers; or extension booked | **New** `POST /api/v1/leases/{id}/end` (choice, charges, goodwill). Core `/purchase` and `/termination` accept finance leases only |
| Collect rent (F2) | Lease officer | — | Amount and what it clears | — | Rent applied | `POST /api/v1/leases/{id}/collections` |
| Commission run | Ops | Already run | October commission ฿193,800, clawbacks −฿29,573.33, net ฿164,226.67, WHT 3% ฿4,926.80, paid ฿159,299.87 to Bangna Motors | `payout` | Commission paid; clawbacks settled | **New** `POST /api/v1/dealers/{id}/commission-runs` |
| Pay off a unit (FP-DEMO) | Ops | The dealer account is short: "CUR-D0007 is ฿x short. Ask the dealer to fund the account or pay by BAHTNET first." (blocked); the typed VIN does not match | Outstanding on the unit, interest since the later of the draw date and the last billing (1 Oct), payoff | `payout` on the payoff | Unit leaves the line; title to the buyer; the line frees the principal | `GET /api/v1/floorplans/{id}/units/{unitId}/payoff-quote`, `POST /api/v1/floorplans/{id}/units/{unitId}/payoff` |
| New call-off (MA-1) | Fleet officer | Over the facility headroom | Vehicles, principal, term (co-terminus) | — | Schedule MS-n booked | `POST /api/v1/masters/{id}/call-offs`, `GET /api/v1/masters/{id}/co-terminus-term` |
| Evaluate or cure cross-default (MA-1) | Fleet officer | — | — | — | Cross-default state | `POST /api/v1/masters/{id}/evaluation`, `/cure` |

## 5. States

### Hire-purchase deal (HPQ)

| State | Entered when | Next |
|---|---|---|
| Quote from the dealer | Dealer submits the quote | Approved (decision within the cap), Declined |
| Approved | Credit decision | Contract signed |
| Contract signed | E-signature with the disclosure acknowledged | Dealer paid |
| Dealer paid | Payout | Live contract (HP-2026-001031); book tracking: filed at DLT → registered (bank owner, hirer possessor) → received and vaulted |

### Registration book

At the dealer → filed at the DLT → registered → in the bank's vault → out to the DLT (change of registration, back within 14 days) → released (after payoff, within 15 days).

### HP contract (core loan)

ACTIVE → CLOSED (paid off or settled; title transferred) / NON_ACCRUAL / WRITTEN_OFF (05-collections).

### Leases (core `Lease`)

Finance: ACTIVE → COMPLETED (run off) → purchased; ACTIVE → terminated early. Operating (prototype O1): active → ending (inspection) → returned and sold, bought by the lessee, or extended 12 months.

### Floor plan unit (core `FloorPlanUnit`)

Floored → sold (sale recorded) → paid off (within the payoff window; overdue sales listed) or settled by a retail HP; aged units curtailed.

## 6. Postings

| Event | Debit | Credit | Core |
|---|---|---|---|
| Dealer payment | Supplier payable (asset cost) | Dealer's account; commission deferred (asset) | `DealerService.payDealer` |
| HP instalment | Customer account | Interest income (effective-rate), principal, output VAT | `LoanService.repay` |
| HP early settlement | Customer account | Remaining principal, interest still charged after the rebate, VAT 7% on the settlement | `LoanService.settle` |
| Finance lease rent | Customer account | Finance income, net investment | `LeaseService.collect` |
| Operating lease end, return | Customer receivable (charges + VAT) | Other income, output VAT; asset to inventory for remarketing | **New** |
| Operating lease end, buy | Customer receivable (market price) | Asset at book value ฿690,000; gain or loss on sale; output VAT | **New** |
| Commission clawback | Dealer payable | Deferred commission | **New** |
| Floor plan payoff | Dealer current account CUR-D0007 | Unit principal, interest income | `FloorPlanService.payoff` |

## 7. Configurable values

| Key | Sample value | Set by | Rule |
|---|---|---|---|
| `HP_RULES.capNew` | Effective rate cap 10% a year, new cars | Regulator, locked | OCPB / BOT car hire-purchase rules, *to confirm* |
| `HP_RULES.capUsed` | 15%, used cars | Regulator, locked | Same, *to confirm* |
| Rebate tiers | Up to 1/3 of the instalments paid: 60% of unearned interest; up to 2/3: 70%; beyond: 100% | Regulator, locked | OCPB rule on early payoff, *to confirm*; product `early_settlement.rebate: TIERED:0.6,0.7,1.0` |
| `HP_RULES.bookDays` | Dealer hands the registration book within 45 days of payout | Bank (dealer agreement) | — |
| `HP_RULES.releaseDays` | Book released within 15 days of payoff | Regulator, locked | *to confirm* |
| VAT | 7% on the instalment and on the settlement | Regulator | Revenue Code |
| Standard flat rate | 3.29% | Bank | — |
| Dealer subsidy | (standard − campaign flat) × amount financed × years | Bank and dealer agreement | — |
| Commission | 2% of the amount financed | Bank (dealer agreement) | — |
| Clawback | Pro rata on payoff within 12 months; in full on default within 6 months | Bank (dealer agreement) | — |
| WHT on commission | 3% | Regulator | Revenue Code |
| Debt service ratio | ≤ 60% | Bank, POL-RETAIL | — |
| Insurance | First class, bank as beneficiary; customer may choose the insurer | Bank; OCPB, *to confirm* | — |
| Lease excess distance | ฿3 per km over the allowance (O1: 90,000 km) | Bank (lease contract) | — |
| Return standard | Tyres ≥ 3 mm; damage items priced from the inspection | Bank | — |
| Release at the DLT | ฿1,500 | Bank | — |
| Floor plan rate | 6.5% a year; payoff within the window after sale | Bank | — |
| Dealer scorecard thresholds | First-payment default ≤ 1.0%; default in 6 months ≤ 1.5%; books within 45 days ≥ 95%; insurance at payout 100%; document mismatch ≤ 2.0%; complaints ≤ 5 in 12 months | Bank | — |

## Calculations

### Flat rate to effective rate (HPQ-26-1031)

```
down        = price × downPct / 100
financed    = price − down
interest    = financed × flat × term / 12          // flat rate on the original amount
instalment  = (financed + interest) / term          // before VAT
vat         = 7% × instalment
effective   = 12 × r, where r solves instalment × (1 − (1 + r)^−term) / r = financed   // bisection, 80 steps, 0 < r < 10% a month
subsidy     = flat < standard ? financed × (standard − flat) / 100 × term / 12 : 0
paid_dealer = financed − subsidy
commission  = 2% × financed
dsr         = (other_debts + instalment + vat) / income
```

| Case | Financed | Instalment | VAT | Total | Effective | Subsidy | Paid to dealer | DSR |
|---|---|---|---|---|---|---|---|---|
| 2.49% flat, 60, 20% down (campaign) | ฿551,200 | ฿10,330.41 | ฿723.13 | ฿11,053.54 | 4.72% | ฿22,048.00 | ฿529,152.00 | 39.6% |
| 3.29% flat (standard) | ฿551,200 | ฿10,697.87 | ฿748.85 | ฿11,446.72 | 6.16% | ฿0.00 | ฿551,200.00 | 40.6% |
| 6.10% flat (dealer's request) | ฿551,200 | ฿11,988.60 | ฿839.20 | ฿12,827.80 | 11.02%, over the 10% cap: blocked | — | — | 44.2% |

Income ฿38,500, other debts ฿4,200, commission ฿11,024.

### Rebate on early HP payoff (HP-2025-004812, 24 Oct 2026)

฿722,500 financed at 2.79% flat over 60 months (effective 5.26%), instalment ฿13,721.48 + VAT; 22 paid.

```
receivable  = instalment × instalments_left
principal   = balance on the effective-rate schedule after the last paid instalment
unearned    = receivable − principal
tier        = paid ≤ n/3 → 60%; paid ≤ 2n/3 → 70%; else 100%
rebate      = unearned × tier
settlement  = receivable − rebate;  VAT = 7% × settlement;  total = settlement + VAT
```

| Line | Value |
|---|---|
| 38 instalments left × ฿13,721.48 | ฿521,416.24 |
| Unearned interest | ฿42,093.95 |
| Rebate, 70% (22 of 60 paid, past one third) | −฿29,465.76 |
| Settlement before VAT | ฿491,950.48 |
| VAT 7% | ฿34,436.53 |
| **Total to settle** | **฿526,387.01** |

### End of operating lease (O1, Anan Chaiyo's CR-V)

```
excess  = max(0, actual_km − allowed_km) × ฿3 = (104,600 − 90,000) × 3 = ฿43,800
damage  = Σ items marked chargeable (default: bumper ฿6,500, tyres ฿14,000, missing key ฿9,800 = ฿30,300; stone chips ฿1,800 and seat ฿1,200 not charged)
net     = max(0, excess + damage − goodwill) = ฿74,100;  VAT ฿5,187.00;  total ฿79,287.00
```

| Choice | Effect on the lessor's books |
|---|---|
| Return | Charges ex VAT ฿74,100 + expected auction ฿700,000 − book value ฿690,000 − remarketing ฿12,000 = ฿72,100 |
| Buy at market value (฿735,000 incl. VAT) | Sale ex VAT ฿686,915.89 − book value ฿690,000 = loss ฿3,084.11 |
| Extend 12 months | Rent 12 × ฿17,400 = ฿208,800 − depreciation to a new residual of ฿560,000 (฿130,000) + excess distance billed now ฿43,800 = ฿122,600 |

Cost ฿1,150,000, residual ฿690,000, 36 months.

### Commission clawback (DLR-1, October run)

| Contract | Event | Commission | Clawback | Rule |
|---|---|---|---|---|
| HP-2026-000418 | Paid off in month 5 | ฿10,240 | ฿5,973.33 | Pro rata, 7 of 12 months |
| HP-2026-000377 | Three instalments missed by month 4 | ฿23,600 | ฿23,600.00 | In full, default within 6 months |
| HP-2025-004812 | Paying on time, month 22 | ฿14,450 | ฿0.00 | Outside the window |

Run: ฿193,800 − ฿29,573.33 = ฿164,226.67; WHT 3% ฿4,926.80; paid ฿159,299.87.

### Floor plan payoff (FP-DEMO, MR0HA3CD5P0100013 Fortuner, sold 22 Oct)

Interest = outstanding × 6.5% / 365 × days since the later of the draw date and the last billing (1 Oct → 24 Oct, 23 days) = ฿1,390,000 × 0.065 / 365 × 23 = ฿5,693.42; payoff ฿1,395,693.42 from CUR-D0007 (฿2,140,000).

## 8. Acceptance criteria

| # | Given | When | Then |
|---|---|---|---|
| 1 | HPQ-26-1031 at 2.49% flat, 60 months, 20% down | The Quote tab opens | Instalment ฿11,053.54 incl. VAT; effective 4.72% against a 10% cap |
| 2 | Same | Terms changed to 6.10% flat | "Above the cap for new cars"; 11.02% effective; the change cannot be saved |
| 3 | Terms within the cap, credit officer | Credit decision | Within `credit` ฿2,000,000; stage Approved |
| 4 | Approved | Sign without ticking the disclosure | "The disclosure sheet must be acknowledged before signing." |
| 5 | Signed, operations checker | Pay the dealer | ฿529,152.00 paid now; commission ฿11,024.00 deferred; stage Dealer paid |
| 6 | Dealer paid | Three book steps recorded | Book received, checked and vaulted |
| 7 | HP-2025-004812, 22 of 60 paid | Settle early | Rebate 70%, ฿29,465.76; total ฿526,387.01; pill Paid off |
| 8 | Paid off, book at the DLT for a change of registration | Release the book | "The book is at the DLT"; blocked |
| 9 | Paid off, book in the vault | Release at the DLT | Released; fee ฿1,500; vault record closed |
| 10 | O1 with the default marks | Choose return | Charges ฿79,287.00 incl. VAT; result ฿72,100 |
| 11 | O1 | Choose return with a goodwill of ฿8,000, operations checker | Needs a second approver (`waive` ฿5,000) |
| 12 | O1 | Choose buy | Sale for ฿735,000 incl. VAT; loss on sale ฿3,084.11 |
| 13 | DLR-1 | Run October commission | Paid ฿159,299.87 after clawbacks and WHT; cannot run twice |
| 14 | FP-DEMO, the sold Fortuner | Pay off, type the VIN | ฿1,395,693.42 from CUR-D0007; unit released |
| 15 | A floor plan payoff larger than CUR-D0007 | Pay off | "CUR-D0007 is ฿x short"; blocked |

## 9. Gaps against the core

| Method and path | Purpose | Module |
|---|---|---|
| `POST /api/v1/hp-quotes` | Store a dealer's quote (vehicle, price, down payment, term, rate, guarantor) | lending (new HpQuote) |
| `POST /api/v1/hp-quotes/{id}/terms` | Change terms; recalculate effective rate, subsidy, DSR; refuse above the cap | lending, engine-schedule |
| `POST /api/v1/hp-quotes/{id}/decision` | Credit decision on the quote without disbursing (today `/loans/applications` decides and disburses in one call) | lending · OriginationService |
| `POST /api/v1/hp-quotes/{id}/signature` | Record the e-signature with the disclosure acknowledgement | lending, product disclosure |
| (param) `POST /api/v1/dealers/payments` | Pay net of the dealer subsidy; record the subsidy as income over the term | assets · DealerService |
| `POST /api/v1/assets/{id}/book-movements` | Registration book custody: at dealer, at DLT, in vault, released; with method and fee | assets |
| `POST /api/v1/leases/{id}/end` | Operating lease end: inspection charges, goodwill, return / buy / extend | lending · LeaseService |
| `POST /api/v1/leases/{id}/inspection` | Return inspection items and excess distance | lending, assets |
| `GET /api/v1/leases` | List leases for the list sections | lending |
| `POST /api/v1/dealers/{id}/commission-runs` | Monthly commission with clawbacks and WHT | assets · DealerService |
| `GET /api/v1/dealers/{id}/scorecard` | Dealer scorecard against thresholds | assets |

## 10. Open questions

1. **Effective-rate caps.** 10% new, 15% used, and whether the cap applies to the rate before or after the dealer's subsidy. *Counsel, bank.*
2. **Rebate tiers.** The prototype computes unearned interest on the effective-rate schedule and applies 60/70/100% by thirds; the core's `TIERED` rule applies the fractions to "interest not yet due". Confirm both mean the same base. *Counsel, engineering.*
3. **Dealer payment.** The core pays the whole asset cost and defers commission; the prototype pays net of the subsidy and pays commission monthly with clawback. Which flow and accounting? *Bank, finance.*
4. **Operating lease end.** The core's purchase and termination endpoints accept finance leases only (purchase after run-off). Buy-out and return of an operating lease need a new path. *Engineering.*
5. **Book custody.** Who records each step (dealer portal or bank staff) and whether the DLT can confirm registration electronically. *Bank.*
6. **Insurance choice.** The customer may choose any insurer meeting the cover; how the bank verifies cover from another insurer. *Bank, counsel.*

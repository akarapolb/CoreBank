# 05 · Collections

What the console must do when payments stop: the strategy by delinquency bucket, the collector's case (contact, promises, hardship, restructuring), early settlement of a loan in arrears, the legal path and write-off, recoveries and debt sale, and repossession through to auction and settlement.

Prototype: `docs/design/console-prototype/js/collections.js` (LN-A-C11, LN-A-C14, R-A4, strategy, overview), `records.js` and `flows.js` (LN-A-C10 loan page and the settle, pay, promise and restructure dialogs), `data.js` (`LOAN`). Core: `lending` module (`LoanService`, `CollectionsService`, `RepossessionService`), controllers `BankingController`, `CollectionsController`, `RepossessionController` (see [core-api-inventory.md](core-api-inventory.md)).

## 1. Scope and users

In scope: the collections queue and strategy; a delinquent loan's case; promises to pay; hardship assessment and restructuring offers; early settlement and part payment of an overdue loan; the legal path (notice, termination, suit, mediation, judgment); write-off, recoveries and sale of the debt; voluntary surrender and repossession of a vehicle, notice of sale, auction and the shortfall or surplus.

Out of scope here: the loss allowance run that reads the stages (see 11-finance-and-control), the restructuring policy values themselves (POL-RETAIL, see 02-retail-lending), floor-plan and lease arrears (06-leasing-and-auto-finance).

| Role (prototype id) | Core role | May do |
|---|---|---|
| Collector (`collector`) | `collections-agent` | See the queue, log contacts, record promises, take a hardship assessment, propose a restructuring up to the `hardship` limit (฿150,000) |
| Credit officer (`credit`) | `credit-officer` | Restructure (`restructure` ≤ ฿5,000,000, `hardship` ≤ ฿2,000,000), propose write-off (`writeoff` ≤ ฿200,000), record court outcomes, recoveries, debt sale |
| Operations checker (`ops`) | `ops` | Early settlement ≤ ฿2,000,000, payments, recoveries posting |
| Repossession officer | `repossession-officer` | Record a repossession, the sale and its result |
| Collections manager | — | Second approver for `hardship` |
| Head of collections | — | Approves a sale below the reserve price |
| Chief credit officer | `write-off-approver` (+ `write-off-exception` before the product's write-off day count) | Second approver for `writeoff` |

## 2. Screens

| Route | Kind | What it shows | Data |
|---|---|---|---|
| `collections/overview` | Page | Accounts and amounts by bucket with roll-forward and cure rates; today's contacts (placed, reached, blocked as already reached, blocked as outside hours, complaints); collectors' queues and promise-kept rates | Queue aggregates by bucket; contact counts for the day |
| `collections/queue` | List | Loan, customer, days late, overdue, bucket, recommended action, last contact, open promise | `GET /api/v1/collections/queue?asOf=` |
| `collections/strategy` | Page | For each bucket (1–30, 31–60, 61–90, 90+): accounts, amount, roll forward, cure, and the day-by-day steps; the contact rules; a strategy test (champion/challenger) | Product delinquency config (buckets, steps); test results |
| `collections/promises`, `hardship`, `legal`, `repossessions`, `writeoff` | Lists | One row per case with its state | Per-case summaries |
| `LN-A-C11` | Record: collections case | Facts: days late (bucket), due now (instalments, fees, default interest), outstanding principal, becomes NPL on, contact today (allowed / reached), promises kept. Tabs: Arrears, Contact, Promises, Hardship, Restructure | Loan, arrears, contact log, promises, hardship assessment, offers |
| `LN-A-C10` | Record: loan | Facts: outstanding principal, overdue (5 instalments), days late, next due, rate, loss allowance. Tabs: Summary, Schedule, Payments, Collections, Recovery, Postings, What if | `GET /api/v1/loans/{id}/detail`, schedule, postings |
| `LN-A-C14` | Record: legal and write-off | Facts: outstanding principal, interest not recognised, loss allowance, days late. Tabs: Legal (the steps with dates, the court case), Write-off, Recovery | Legal case, allowance, recoveries |
| `R-A4` | Record: repossession | Facts: surrendered on, price guide, reserve, owed. Tabs: Vehicle (condition report, yard), Notices, Auction, Settlement (where the money went) | `GET /api/v1/repossessions/{reference}`, asset record |

### Record ids

`LN-…` loans; `R-…` repossessions (core `reference`); promises and contacts carry the dialog's reference.

### LN-A-C11 tabs

| Tab | Content |
|---|---|
| Arrears | Each overdue instalment: number, due, days late, interest, principal, default interest, collection fee; how a payment is applied (fees and default interest, then interest oldest first, then principal oldest first, then the next instalment); the next steps timeline (hardship and offer now, promise due, NPL date) |
| Contact | Whether a call is allowed now (day, time, window) and whether the customer was already reached today; contact points with consent; the script for the bucket; the contact rules; the contact history |
| Promises | Each promise: made on, the dated parts, total, state (Open, Kept, Broken) |
| Hardship | The assessment form (§3) and the affordability result |
| Restructure | The three options with instalment, months, rate, interest over the term, modification gain or loss and whether it fits; once offered, the offer state |

## 3. Fields

### Log a contact (`colContact`)

| Field | English | Thai | Type | Required | Source | Validation |
|---|---|---|---|---|---|---|
| `to` | Who was contacted | ผู้ที่ติดต่อ | choice: mobile, work, LINE, third party | Yes | Staff | — |
| `out` | Outcome | ผลการติดต่อ | choice: promise, hardship, dispute, refused, no answer, wrong number, third party | Yes | Staff | Outcomes promise, hardship, dispute, refused count as a successful contact (right-party contact) |
| `note` | Note | บันทึก | text | No | Staff | — |

### Record promise (`colPromise`)

| Field | English | Thai | Type | Required | Validation |
|---|---|---|---|---|---|
| `pd0..2`, `pa0..2` | Up to three dated payments | วันที่และจำนวนเงิน | date + money (THB) | At least one | First within 7 days of today; every payment between today and today + `promiseDays` (30) |

### Hardship assessment (LN-A-C11 Hardship tab, saved as typed)

| Field | English | Thai | Type | Required | Source |
|---|---|---|---|---|---|
| `reason` | What happened | เกิดอะไรขึ้น | choice: income, job, illness, family, disaster, business | Yes | Customer |
| `since` | Since | ตั้งแต่ | date | Yes | Customer |
| `before` | Monthly income before | รายได้ต่อเดือนก่อนหน้า | money | Yes | Customer |
| `now` | Monthly income now | รายได้ต่อเดือนตอนนี้ | money | Yes | Customer |
| `expenses` | Essential household costs | ค่าใช้จ่ายจำเป็นของครัวเรือน | money | Yes | Customer |
| `evidence` | Evidence | หลักฐาน | set: employer letter, statements 3 months, medical certificate | No (may follow) | Customer |
| other debts | Other debts (bureau) | หนี้อื่น (เครดิตบูโร) | money | — | NCB, fetched |

### Settle early (LN-A-C10)

| Field | English | Type | Rule |
|---|---|---|---|
| Settlement date | Settlement date | static: today | The quote is valid for today only |
| `from` | Pay from | choice: the customer's savings account, cash or transfer at a branch | From savings is blocked if the balance is short |
| confirm | Type LN-A-C10 to confirm | text | Must equal the loan id |

### Other dialogs

| Dialog | Fields |
|---|---|
| Take payment | Amount (money, > 0, ≤ available in the source account), from account |
| Write off (`kitWriteOff`) | Reason (text, required; prefilled "Suit filed, no assets found, allowance at 100%; holding the loan to 360 days adds nothing.") |
| Record a court outcome (`kitCourt`) | Outcome: compromise, judgment for the bank, dismissed |
| Record a recovery (`kitRecover`) | Amount (money > 0), how: compromise, salary attachment, customer |
| Sell the debt (`kitSell`) | Price (money > 0) |
| Send notice of sale (`repoNotice`) | None: shows recipient, address, date, reserve |
| Record the auction (`repoAuction`) | Hammer price (money > 0) |

## 4. Actions

| Action | Who | Refused or blocked when (message) | Review shows | Approval | Effect | Core call |
|---|---|---|---|---|---|---|
| View queue | Collector | — | — | — | — | `GET /api/v1/collections/queue` |
| Log a contact | Collector | A successful contact was already made today: "Malee was already reached today. Another contact would break the one-a-day rule; log it tomorrow." Outside the contact hours for the day: call buttons disabled | The contact and whether it counts as today's one successful contact | — | Contact logged; "Contact today" becomes Reached | `POST /api/v1/collections/{loanId}/contacts` (channel, note). **New** fields: `party` (debtor, third party), `outcome`, `rightPartyContact`; **New** server-side check of hours and one successful contact a day |
| Record promise | Collector | No payment: "Enter at least one payment."; first part later than 7 days: "The first payment must be within 7 days."; any part outside 30 days: "Every payment must fall within the next 30 days." | The parts and their total | — | Promise Open; checked each morning, reminder the day before, Kept or Broken automatically | `POST /api/v1/collections/{loanId}/promises` takes one `payBy`. **New**: `parts[]` (date, amount) |
| Hardship assessment | Collector | — | The affordability card (§ calculations) | — | Assessment saved on the case | **New** `POST /api/v1/collections/{loanId}/hardship` |
| Offer a restructuring (`colRestructure`) | Collector, credit officer | The instalment is above the affordable amount: "More than she can afford. ฿x against ฿y. An offer she cannot keep sets her up to fail; choose another." (blocked) | Balance restructured, new instalment, interest over the term, modification gain or loss, and the cure rule | `hardship` on the balance | Offer sent to the customer's app; state Offer with the customer | **New** `POST /api/v1/loans/{id}/restructure-offers` (option, terms); acceptance by the customer **New** `POST /api/v1/loans/{id}/restructure-offers/{offerId}/acceptance` |
| Customer accepts | Customer (app) | Offer expired | — | — | Arrears cleared into the new schedule; flagged restructured; stays Stage 2 until cured | `POST /api/v1/loans/{id}/restructure` (newRate, newTerm). **New** `holidayMonths` for the three-month pause option |
| Propose a restructuring (LN-A-C10, `restructure`) | Copilot draft, collector | — | New principal (the settlement balance), term 12/18/24, new instalment at 15.00% | Sent to a credit officer (`restructure`) | Proposal AP-1190 | **New** proposal; on approval `POST /api/v1/loans/{id}/restructure` |
| Settle early (LN-A-C10) | Ops, teller, credit officer | From savings with too little: "SAV-C10 is ฿1,545.98 short" and settlement is blocked; the typed id does not match | The quote line by line (§ calculations); the authority note | `settle` on the total (ops ฿2,000,000) | Loan closed; remaining instalments cancelled; receipt RC-2026-104233 | `GET /api/v1/loans/{id}/settlement-quote?date=` then `POST /api/v1/loans/{id}/settlement`. **New**: settlement from a branch receipt instead of the linked deposit account |
| Take payment | Ops, teller | Amount above the source balance | Allocation of the payment by the waterfall | — | Payment applied | `POST /api/v1/loans/{id}/repayments` |
| Record a court outcome | Credit officer | Already recorded | Effect on the legal timeline | — | Compromise judgment or continue to judgment | **New** `POST /api/v1/collections/{loanId}/legal-events` |
| Write off (`kitWriteOff`) | Credit officer | No reason: "Give the reason." | Principal written off, interest not recognised cleared, new loss in income ฿0.00, and that the debt is still owed | `writeoff` on principal (credit officer ฿200,000; else the chief credit officer) | Status written off; debt tracked off balance sheet; legal case continues | `POST /api/v1/loans/{id}/write-off` (`override` true before the product's write-off day count, needs `write-off-exception`). See open question 1 on the allowance |
| Record a recovery | Credit officer, ops | Amount above what is still owed (core: "Recovery exceeds what is still owed") | Amount and what is still owed | — | Income 4900 Bad debts recovered; memo balance reduced | `POST /api/v1/loans/{id}/recoveries` |
| Sell the debt | Credit officer | Not written off | "Sells the claim for ฿x. Kittipong is told in writing before the transfer, the buyer takes over the case and must follow the Debt Collection Act, and the price is booked as a recovery." | `writeoff` | Sold to an AMC; recovery booked; no further offers | `POST /api/v1/loans/{id}/recoveries` for the price + **New** `POST /api/v1/loans/{id}/debt-sale` (buyer, notice date) |
| Record repossession | Repossession officer | Loan not Active or Non-accrual (core) | Asset, yard, condition | — | Asset held for sale | `POST /api/v1/repossessions` (reference, loanId, assetId, date, location, condition) |
| Send notice of sale | Repossession officer | Already sent | Recipient, registered post, auction date, reserve, right to settle and take the vehicle back | — | Notice sent at least 7 days before the auction | **New** `POST /api/v1/repossessions/{reference}/notices` |
| Record the auction | Repossession officer | Notice not sent (button disabled) | Sold for, costs, applied to the loan, shortfall or surplus; below the reserve: "Selling below the reserve needs the head of collections." | Below reserve: head of collections | Sold; net applied (fees, interest, principal); shortfall stays owed or surplus paid to the customer; customer told | `POST /api/v1/repossessions/{reference}/sale` (proceeds, costs). **New** reserve-price approval step |

## 5. States

### Collections case (per loan)

| State | Entered when | Next |
|---|---|---|
| In queue, bucket N | Days past due ≥ the bucket's lower bound | Contacted, promise, hardship, cured |
| Promise open | Promise recorded | Kept (all parts paid by their dates), Broken (a part missed) |
| Hardship reported | Assessment saved | Offer with the customer |
| Offer with the customer | Restructuring offered | Restructured (accepted), Offer lapsed |
| Restructured | Offer accepted and booked | Cured after 3 consecutive months or 3 instalments on time, whichever is longer; back in the queue if missed |
| Legal | Notice of default sent | Terminated, Suit filed, Compromise judgment, Judgment |
| Written off | Write-off posted | Recovering, Sold to an AMC, Closed |

### Loan status (core `Loan.Status`)

ACTIVE → NON_ACCRUAL (at the product's non-accrual days past due) → WRITTEN_OFF; ACTIVE or NON_ACCRUAL → CLOSED (settled or paid off).

### Legal steps (LN-A-C14)

Notice of default (registered post, 30 days to pay) → restructuring offered twice (at 30 days and before the suit) → contract terminated, debt accelerated → suit filed (court, case number, panel firm) → court mediation (compromise made a judgment) → judgment → enforcement.

### Repossession (R-A4)

Surrendered or repossessed → held for sale → notice of sale sent → auctioned (sold; below reserve needs approval) → settled (shortfall owed or surplus paid) → result told to the customer (within 30 days of the sale in the prototype's timeline).

## 6. Postings

| Event | Debit | Credit | Core |
|---|---|---|---|
| Repayment | Customer deposit account | Penalty, interest, principal receivable by the waterfall | `LoanService.repay` |
| Early settlement | Customer deposit account | Billed items, principal; interest still charged by the rebate rule to income (suspense if non-accrual); VAT where the product carries it | `LoanService.settle` (one atomic batch) |
| Restructure | Principal (unpaid billed interest capitalised) / 5310 Modification loss / penalty waived | Interest receivable / principal / penalty receivable | `LoanService.restructure` |
| Write-off | `gl:write-off-expense` (prototype: 1390 Loss allowance) | Principal, interest, penalty, VAT receivables; memo `loan:{id}:written-off` (contingent) | `LoanService.writeOff` |
| Recovery | Customer deposit account | 4900 Bad debts recovered (`gl:recovery-income`); memo reduced | `LoanService.recover` |
| Repossession sale | Proceeds, net of costs | Loan by the waterfall; shortfall written off and tracked, surplus to the customer | `RepossessionService.sell` |

## 7. Configurable values

| Key | Sample value | Set by | Rule |
|---|---|---|---|
| Contact hours | Weekdays 08:00–20:00; weekends and public holidays 08:00–18:00 | Regulator, locked (bank may narrow) | Debt Collection Act and BOT guidance, *to confirm* |
| Successful contacts a day | 1 | Regulator, locked | Same, *to confirm* |
| Third-party contact | Only to find how to reach the debtor; never mention the debt | Regulator, locked | Same |
| Buckets and steps | 1–30, 31–60, 61–90, 90+ with the day steps in `BUCKETS` | Bank (product delinquency config) | — |
| `promiseDays` | 30 (range 7–60) | Bank, POL-RETAIL | — |
| First promise payment within | 7 days | Bank | — |
| Promise parts | Up to 3 | Bank | — |
| `hardshipShare` | 70% of spare income (range 30–100) | Bank, POL-RETAIL | — |
| Default interest | 3% a year on overdue principal only | Regulator cap, locked | BOT, *to confirm* |
| Collection fee | ฿100 per missed instalment | Regulator cap, locked | BOT, *to confirm* |
| Restructuring offer before NPL | Required before 90 days past due | Regulator, locked | BOT responsible lending, *to confirm* |
| Cure after restructuring | 3 consecutive months or 3 instalments, whichever is longer | Regulator, locked | BOT / TFRS 9, *to confirm* |
| Non-accrual and NPL | 90 days past due; Stage 3 | Regulator, locked | BOT / TFRS 9 |
| Write-off day count | Product `delinquency.writeOffAtDpd` (prototype narrative: 360) | Bank | — |
| Notice of sale | At least 7 days before the auction | Regulator, locked | Hire Purchase rules, *to confirm* |
| Auction fee | 5% of the hammer price | Bank (contract with the auction house) | — |
| Towing | ฿2,000 | Bank | — |
| Storage | ฿150 a day | Bank | — |
| Reserve price | Set per vehicle (R-A4: ฿52,000 against a price guide of ฿61,000) | Bank | — |

## Calculations

### Early settlement quote (LN-A-C10, 24 Oct 2026)

Loan ฿85,250 over 15 months at 15.00% reducing balance, instalment ฿6,268.16 on the 2nd; 5 paid, 5 overdue (Jun–Oct), 144 days late.

| Line | Formula | Value |
|---|---|---|
| Principal outstanding | balance after instalment 5 | ฿58,578.83 |
| Interest billed, unpaid | Σ interest of the overdue instalments | ฿2,960.49 |
| Interest since 2 Oct | balance after instalment 10 (฿30,198.52) × 15% / 365 × 22 days | ฿273.03 |
| Default interest | Σ overdue principal × 3% / 365 × days late of each | ฿191.83 |
| **Total to settle** | sum, each rounded to 2 dp | **฿62,004.18** |

From SAV-C10 (฿60,458.20) it is ฿1,545.98 short and blocked; at a branch it is within an operations checker's ฿2,000,000.

### Arrears and NPL date (LN-A-C11)

฿150,000 over 48 months at 22%, instalment ฿4,725.91 on the 20th; instalments 25–27 overdue. Overdue ฿14,177.73 + default interest ฿26.06 + fees ฿300.00 = due now ฿14,503.79; 65 days late; becomes NPL on the first overdue due date + 90 days = 18 Nov 2026.

### Hardship affordability

```
spare       = max(0, income_now − essential_costs − other_debts_from_bureau)
affordable  = floor(spare × hardshipShare / 100 / 10) × 10          // to ฿10
balance     = principal_outstanding + unpaid_billed_interest + default_interest
instalment  = annuity(rate / 12, months, capital), capital = balance × (1 + rate/12)^holiday_months
fits        = instalment ≤ affordable
modification= Σ instalment / (1 + original_rate/12)^(i + holiday) − balance   (0 if |x| < ฿1)
```

LN-A-C11: income 17,500 − costs 9,800 − bureau 1,800 = spare ฿5,900; affordable ฿4,130 (70%); income down 38%; balance ฿95,963.70.

| Option | Months | Rate | Instalment | Interest over term | Modification | Fits |
|---|---|---|---|---|---|---|
| Extend the term | 60 | 22% | ฿2,650.41 | ฿63,060.90 | ฿0.00 | Yes |
| Three months' pause, then extend | 3 + 57 | 22% | ฿2,880.60 | ฿62,855.14 | ฿0.00 | Yes |
| Lower rate and extend | 60 | 16% | ฿2,333.65 | ฿44,055.30 | −฿11,469.06 (loss) | Yes |

The current ฿4,725.91 is more than she can pay.

### Repossession settlement (R-A4, hammer ฿55,000)

```
storage = ฿150 × days(18 Oct → 7 Nov) = ฿3,000
fee     = 5% × hammer = ฿2,750
costs   = towing ฿2,000 + storage + fee = ฿7,750
net     = hammer − costs = ฿47,250, applied to LN-A-C10 (fees, interest, principal)
gap     = owed (settlement total ฿62,004.18) − net = shortfall ฿14,754.18 (still owed)
```

A hammer price below ฿52,000 goes to the head of collections before it is recorded.

## 8. Acceptance criteria

| # | Given | When | Then |
|---|---|---|---|
| 1 | LN-A-C11, no successful contact today, Saturday 10:52 | The collector opens Contact | "Allowed: Saturday, 10:52, within 08:00–18:00" |
| 2 | Malee was reached today | A second contact with outcome promise is logged | Refused with the one-a-day message; nothing is logged |
| 3 | Any loan | A promise whose first part is 10 days away | "The first payment must be within 7 days." |
| 4 | Any loan | A promise with a part 45 days away | "Every payment must fall within the next 30 days." |
| 5 | LN-A-C11 with the sample assessment | The Hardship tab is opened | Affordable instalment ฿4,130; 3 of 3 options fit |
| 6 | The assessment changed so an option no longer fits | That option is offered | The review is blocked: "More than she can afford" |
| 7 | An option that fits, collector | Offer a restructuring | Within `hardship` (฿95,963.70 against the collector's ฿150,000); offer sent; pill "Offer with the customer" |
| 8 | Offer sent | The customer accepts in the app | Pill Restructured; Stage 2 until the cure rule is met |
| 9 | LN-A-C10, pay from SAV-C10 | Settle early | Blocked: "SAV-C10 is ฿1,545.98 short" |
| 10 | LN-A-C10, at a branch, operations checker | Settle early, type LN-A-C10 | Within authority; loan closed for ฿62,004.18 |
| 11 | LN-A-C10, collector | Settle early | Needs a second approver (no `settle` authority) |
| 12 | LN-A-C14, credit officer | Write off with a reason | Within `writeoff` ฿200,000 for ฿140,000; new loss in income ฿0.00; pill Written off |
| 13 | LN-A-C14 written off | Record a recovery of ฿4,167 (compromise) | Recovery listed; income 4900; still owed reduced |
| 14 | LN-A-C14 not written off | Record a recovery | Refused (core: only written-off loans have recoveries) |
| 15 | R-A4, notice not sent | Record the auction | Button disabled |
| 16 | R-A4, notice sent | Record ฿55,000 | Costs ฿7,750, applied ฿47,250, shortfall ฿14,754.18; pill "Sold · shortfall" |
| 17 | R-A4, notice sent | Record ฿50,000 | "Below the reserve"; sent to the head of collections; not sold yet |

## 9. Gaps against the core

| Method and path | Purpose | Module |
|---|---|---|
| (fields) `POST /api/v1/collections/{loanId}/contacts` | Add party, outcome, right-party flag; enforce hours and one successful contact a day server side | lending · CollectionsService |
| (fields) `POST /api/v1/collections/{loanId}/promises` | Accept up to three dated parts; daily kept/broken evaluation | lending · CollectionsService |
| `POST /api/v1/collections/{loanId}/hardship` | Save a hardship assessment and return affordability and fitting options | lending (new HardshipService) |
| `POST /api/v1/loans/{id}/restructure-offers` | Create an offer from an option; send to the customer | lending |
| `POST /api/v1/loans/{id}/restructure-offers/{offerId}/acceptance` | Customer accepts; books the restructure | lending, channels |
| (param) `POST /api/v1/loans/{id}/restructure` | `holidayMonths` for a payment pause with interest capitalised | lending · LoanService |
| (param) `POST /api/v1/loans/{id}/settlement` | Settle from a branch receipt or another account, not only the linked deposit account | lending, deposit |
| `POST /api/v1/collections/{loanId}/legal-events` | Notice, termination, suit, mediation, judgment with dates and references | lending (new LegalCase) |
| `POST /api/v1/loans/{id}/debt-sale` | Sell a written-off claim: buyer, price, notice to the debtor | lending |
| `POST /api/v1/repossessions/{reference}/notices` | Notice of sale with the auction date and reserve | lending · RepossessionService |
| (step) `POST /api/v1/repossessions/{reference}/sale` | Reserve price on the case; a sale below it waits for approval | lending · RepossessionService |
| `GET /api/v1/collections/strategy` | Buckets, steps and rates for the Strategy page | lending, engine-product |

## 10. Open questions

1. **Write-off against the allowance.** The core's write-off debits `gl:write-off-expense` for the whole balance; the prototype writes off against the 100% loss allowance with no new loss in income (and clears interest not recognised from suspense). Finance and the core team decide which accounting the core posts. *Engineering, finance.*
2. **Interest to date in the quote.** The core's settlement quote is billed items + principal + interest still charged by the rebate rule; it has no line for interest accrued since the last due date or for default interest on the overdue principal, which the prototype shows. *Engineering, product.*
3. **Restructuring scope.** The core restructures fixed-rate annuity products only, never raises the rate and books immediately. Offers with customer acceptance, a payment pause and flat-rate products need design. *Engineering.*
4. **Contact rules.** Exact hours, the one-a-day rule and third-party contact under the Debt Collection Act; whether attempts count. *Counsel.*
5. **Promise rules.** 7 days for the first part and 30 for the last, up to three parts. *Bank.*
6. **Repossession shortfall.** The core writes off a shortfall after a sale (an approved exception); the prototype keeps it owed on the loan. Which does the bank want? *Bank, finance.*
7. **Debt sale.** Notice period to the debtor before transfer and the buyer's obligations. *Counsel.*

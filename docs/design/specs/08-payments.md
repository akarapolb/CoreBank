# 08 · Payments

Spec for the Payments system of the production console: the overview of rails and cut-offs, large-value BAHTNET transfers, outgoing SWIFT MT103 transfers, bulk payroll files, standing orders, the recall of a mistaken PromptPay transfer, the held payment after a sanctions match, ITMX reconciliation, and the customer app payment.

Prototype sources: `js/payments.js`; `viewHeld` and the `releasePayment` / `rejectPayment` flows (TR-9918210) in `js/records.js` and `js/flows.js`; the ITMX break in the exception centre (`js/records.js`, `resolveExc`); the app preview `viewApp` in `js/records.js`. The finance side of reconciliation (REC-2026-10, suspense GL 2990, the month-end close) is in [11-finance-and-control.md](11-finance-and-control.md).

The prototype's business date is Saturday 24 Oct 2026: BAHTNET and ITMX bulk are closed, PromptPay runs, SWIFT sends with value Monday 26 Oct. All BOT, ITMX and SWIFT rules below are the prototype's reading and are *to confirm*.

## 1. Scope and users

| In scope | Out of scope |
|---|---|
| Rails, cut-offs, the Monday queue, the bank's BOT settlement position | Treasury's intraday liquidity management (10) |
| Large-value transfers on paper: call-back, maker-checker, warehousing | Card schemes |
| Outgoing SWIFT: screening, charges, BOT purpose code, FX conversion, gpi tracking | Incoming SWIFT and nostro reconciliation (10) |
| Bulk files: validation, exclusion, release route on a non-business payday | The company's own online banking (maker Ratana W., checker Somkid W.) |
| Standing orders, recalls of mistaken transfers, held payments | Scam reports and holds under the technology crime decree (owned by fraud ops; referenced only) |
| PromptPay/ITMX daily reconciliation break | GL suspense clearing (11) |

| Role | May do |
|---|---|
| Operations checker (`ops`) | Record call-backs, approve large-value transfers up to ฿50,000,000 (`rtgs`), clear screening hits, send SWIFT from a USD account, release bulk files up to ฿5,000,000 (`payout`), send recalls, release held payments within `payout` |
| Finance controller (`finance`) | `rtgs` up to ฿500,000,000; `payout` up to ฿10,000,000 |
| Credit officer / RM (`credit`) | Enters paper instructions (maker); may not approve what they entered |
| Head of operations | Second approver for `rtgs` and `payout` above the limits |
| Head of dealing | Second approver for `fx` (SWIFT paid in baht) |
| Customer (app) | Pay an instalment; scan Thai QR |

## 2. Screens

| Route | Record / list | Facts strip | Tabs and data |
|---|---|---|---|
| `payments/overview` | Payments overview (page) | PromptPay today (1,204,118 items, ฿1,842.6m), Queued for Monday (count, amount), Held (1, TR-9918210 $1.18m), Balance at the BOT (฿4,210m after PromptPay settlement), ITMX collateral used (41% of ฿6,000m) | **Rails and cut-offs**: rail, hours, today's state, items, value ฿m. **Queued for Monday 26 Oct**: payment, rail, amount, state, in release order. **Settlement position**: BOT current account now, Monday outflows queued, intraday liquidity against bonds (฿2,500,000,000), headroom at Monday's opening |
| `payments/held` → `TR-9918210` | Held payment | Amount ($1,180,000.00 ≈ THB), Match 91%, Held since 08:41, Decide by 12:41 (4-hour target), Cut-off 15:00 | Screening comparison (on the payment vs on the list), Decision |
| `payments/transfers` | Transfers list | — | Transfer, From, To, Amount, Rail, State (live) |
| `payments/transfers` → `TR-9918231` | Large-value transfer | Amount ฿31,850,000.00, Value date Mon 26 Oct, From CUR-B2031 (available ฿36,420,118.50), Maker Wanida K., Online limit ฿20,000,000 | **Instruction**: debit, credit (Bangkok Bank 101-3-88214-6, Hino Motors Sales (Thailand)), amount, reference PO HMST-26-4410, received Fri 23 Oct 16:05 after the 15:30 cut-off. **Checks**: the five checks (below). **Liquidity**: the bank's BOT account at Monday's opening |
| `payments/transfers` → `TR-9918203` | Outgoing SWIFT transfer | Amount $240,000.00, Value date Mon 26 Oct, Screening (2 hits / Cleared), Charges, Purpose code | **Message**: the MT103 as it will be sent (fields 20, 23B, 32A, 33B, 50K, 57A, 59, 70, 71A, 77B, 121). **Screening**: hit, matched against, score, finding, state. **Tracker**: gpi events once sent |
| `payments/batches` | Bulk files list | — | File, Company, Items, Amount, Payday, State |
| `payments/batches` → `PAY-26-10-0414` | Payroll file | Payday Sun 25 Oct, Items (n / 84), Amount, To our accounts 31, Debit CUR-K0414 (balance ฿6,240,000) | **Validation**: each exception row with an Exclude toggle. **Payday**: the two routes with staff paid, fee, note. **File**: format, control total ฿1,948,600.00, company approvals, arrival time |
| `payments/standing` | Standing orders list | — | Order, From, To, Amount, Next, State (SO-55120, SO-55104 failed retry, SO-55098 TCG fee starting after drawdown) |
| `payments/recalls` | Recalls list | — | Case, Customer, Amount, Receiving bank, Opened, State |
| `payments/recalls` → `RCL-26-1024-03` | Recall request | Amount ฿18,500.00, From SAV-40218, To 08x-xxx-4417 (meant 4471), Receiving bank answers within 7 business days, Kind: mistake, not a scam | **Case**: transfer TR-9918188 at 08:12, what the customer says, name shown before confirming, settled and final; note on the scam route. **Process**: request → receiving bank → consent → returned or letter |
| `payments/promptpay` | PromptPay proxies | — | Proxy, Type, Account, Registered, Transfers (30d), State |
| `payments/recon` | Reconciliation | — | File, Rail, Items, Difference, Proposed match, State (ITMX 24 Oct 05:00 ฿4,200.00 Review) |
| `payments/limits` | Limits | — | Limit, Applies to, Per transaction, Per day, Used today, State |
| `channels/preview` | Customer app | Monthly active users, payments today, rating | Home, Pay, QR, Paid, Statement screens |

Large-value checks (TR-9918231): signatures match the mandate (two directors); call-back to an authorised signatory on the number on file; beneficiary account confirmed by the receiving bank's name lookup; funds available, held from now until sent; not a new beneficiary (paid 6 times since 2024).

## 3. Fields

### Call-back (`bnCallback`)

| Field | Label | Type | Source | Validation |
|---|---|---|---|---|
| `calledName` | Called | text | Mandate on file (Mr Chatchai S., director) | Must be an authorised signatory on the mandate |
| `calledNumber` | Number | phone | Mandate on file (02-xxx-4410) | Must be the number on file, never one from the instruction |
| `confirmed` | Confirmed | multi | Staff | Amount, beneficiary account and the purchase order |

The prototype shows these read-only; production records them with the call time and recording id (kept five years).

### Clear screening hits (`swClear`)

| Field | English | Thai | Type | Required | Validation |
|---|---|---|---|---|---|
| `why` | Reason | เหตุผล | text | Yes | Non-empty: "Give the reason." |

### Send the MT103 (`swSend`)

| Field | English | Thai | Type | Required | Values / validation |
|---|---|---|---|---|---|
| `src` | Pay from | จ่ายจาก | choice | Yes | `fcd` FCD-B2031 USD account ($412,880.00); `thb` CUR-B2031 in baht, converted |
| `ch` | Charges | ค่าธรรมเนียม | choice | Yes | `SHA` each side pays its own bank (default); `OUR` sender pays all; `BEN` beneficiary pays all |
| `purpose` | Purpose code for the BOT | รหัสวัตถุประสงค์สำหรับ ธปท. | choice | When amount ≥ $50,000 | 318004 Import of goods: vehicle parts; 318001 Import of goods: other; 318190 Services. Empty: "The BOT needs a purpose for transfers of $50,000 or more." |

### Release the payroll (`pyRelease`)

| Field | English | Thai | Type | Required | Values |
|---|---|---|---|---|---|
| `how` | Route | ช่องทาง | choice | Yes | `rt` Real-time transfers today, staff paid by the 25th (default); `bulk` ITMX bulk, value Monday 26 Oct |
| `excl[i]` | Exclude | ตัดออก | toggle per exception row | — | Set on the Validation tab before release |

Validation exceptions in PAY-26-10-0414:

| Row | Finding | Amount | Severity |
|---|---|---|---|
| 17 | Account number fails the check digit: 123-4-5678-9 | ฿18,400.00 | Must exclude |
| 33 and 34 | Same account and amount twice: Somchai D., ฿21,500 | ฿21,500.00 | Warning |
| 51 | Name lookup returns Somsri K., file says Somsak K. | ฿19,800.00 | Warning |
| 62 | Account closed at the receiving bank | ฿16,900.00 | Must exclude |

### Recall (`rcSend`, `rcOutcome`)

`rcSend` has no inputs (transfer and reason come from the case). `rcOutcome`: `o` = `returned` (receiver agreed; ฿18,500.00 returned) or `refused` (refused or no answer).

### Held payment (`releasePayment`, `rejectPayment`)

| Field | English | Type | Required | Validation |
|---|---|---|---|---|
| `why` | Why it is a false positive | text | Yes | "Say why."; prefilled with the subsidiary's registration (HK 2213845) |
| `confirm` | Type TR-9918210 to confirm | text | Yes | Must equal the payment id |

## 4. Actions

| Action | Who | Refused or blocked when (message) | Review shows | Approval rule | Effect | Core call |
|---|---|---|---|---|---|---|
| Record call-back `bnCallback` | `ops` | Already recorded | "Records the call with the number used and the time; the recording is kept for five years." | Single | Check 2 passes | **New** `POST /api/v1/payments/{id}/callbacks` (payments) |
| Approve large-value transfer `bnApprove` | `ops`, `finance`; not the maker | Maker approves: "You entered this transfer. A different person must approve it." No call-back on paper above ฿5m: "Call-back first. Paper instructions above ฿5m need a call-back." | "Holds ฿31,850,000.00 on CUR-B2031 now and sends at Monday's opening. BAHTNET payments are final once sent; until 08:30 it can still be cancelled here." | Maker-checker + `rtgs` (ops ฿50m, finance ฿500m, else Head of operations); above ฿500m also treasury confirms the position | Funds held; transfer `warehoused` for the next BAHTNET opening, first in queue | **New** `POST /api/v1/payments/{id}/approval` (payments); hold via **New** `POST /api/v1/accounts/{id}/holds` (deposit) |
| Cancel before release | Maker or checker | After it is sent | — | Single | Hold released | **New** `POST /api/v1/payments/{id}/cancellation` |
| Release warehoused queue | Scheduler at rail opening | BOT balance + intraday liquidity insufficient | — | — | Sent in queue order | **New** job `rail-release` + BAHTNET adapter |
| Clear screening hits `swClear` | `ops` (sanctions-trained) | No reason | "Clears both hits as false positives. The reason and your name are kept for the auditors; the payment can be sent." | Single below the hold threshold; score ≥ 85 goes to the held-payment route instead | Hits `cleared` | **New** `POST /api/v1/payments/{id}/screening/clearance` (payments, compliance) |
| Send MT103 `swSend` | `ops` | Screening not cleared: "Screening is not cleared. Clear the hits first." No purpose ≥ $50,000 (entry step) | Debit (FCD-B2031 $240,000.00, or CUR-B2031 ฿8,659,200.00 @ 36.0800), our fee (฿500; ฿1,400 with OUR), what Hino receives, purpose | `fx` when paid in baht (ops ฿0 → Head of dealing); none from the USD account | MT103 sent now, value Mon 26 Oct; UETR assigned; reported to the BOT with the purpose code in the daily FX data set | **New** `POST /api/v1/payments/{id}/send` (payments, SWIFT adapter); FX via the treasury deal service (10) |
| Track gpi | System | — | — | — | Tracker events (sent, credited, ACCC) | **New** `GET /api/v1/payments/{id}/tracking` (SWIFT gpi adapter) |
| Exclude a row | `ops` | File released | — | — | Row excluded; totals recalculated | **New** `PATCH /api/v1/payment-batches/{id}/items/{row}` |
| Release payroll `pyRelease` | `ops` | Any must-exclude row still included: "Rows that cannot be paid. Exclude row 17 and row 62 first; they would bounce back." | Items, debit CUR-K0414, fees (53 × ฿5 real time; 53 × ฿2 bulk), staff paid today or Mon 26 Oct | `payout` (ops ฿5m, finance ฿10m, else Head of operations) | `rt`: PromptPay/ORFT items today; `bulk`: ITMX bulk for Monday's first window; own-bank staff credited at once either way; excluded rows returned to the company's online banking | **New** `POST /api/v1/payment-batches/{id}/release` with `route` (payments) |
| Send recall `rcSend` | `ops` | Already sent | "Asks Krungthai through ITMX to contact the receiver and return the money with their consent. Nothing is taken from anyone's account without it." | Single | Case `with receiving bank`; customer SMS with the case number | **New** `POST /api/v1/recalls/{id}/request` (payments, ITMX dispute adapter) |
| Record the answer `rcOutcome` | `ops` | — | `returned`: credits ฿18,500.00 to SAV-40218 and closes. `refused`: closes the bank's part and sends a letter for a police report and a civil claim | Single | Case `returned` or `refused` | **New** `POST /api/v1/recalls/{id}/outcome` |
| Release held payment `releasePayment` | `ops`, typed confirm | No reason | "Releases $1,180,000.00 to HSBC Hong Kong before the 15:00 cut-off. The beneficiary is added to the good-guys list…" | `payout` on the THB equivalent (≈ ฿42,480,000 → Head of operations) | Released and sent; good-guys list updated | **New** `POST /api/v1/payments/{id}/screening/release` |
| Reject held payment `rejectPayment` | `ops` | — | "Returns $1,180,000.00 to CUR-B2031 and opens a compliance case with the screening evidence." Customer told the payment could not be made, not why | Single | Funds returned; case opened | **New** `POST /api/v1/payments/{id}/screening/rejection` |
| Resolve ITMX break | Payments ops | — | Proposed match from the reconciliation agent | Maker-checker | Break cleared; suspense GL 2990 cleared; close step unblocked | **New** `POST /api/v1/reconciliations/{id}/breaks/{breakId}/resolution` (accounting; see 11) |
| App: pay an instalment | Customer | Insufficient balance | Amount, from account | Device biometrics | Applied oldest instalment first; receipt RC-… | `POST /api/v1/me/loans/{id}/repayments` (exists) |
| App: balance and activity | Customer | — | — | — | — | `GET /api/v1/me/balance`, `GET /api/v1/me/activity` (exist) |
| App: Thai QR | Customer | — | — | — | QR with Ref 1 (mobile) and Ref 2 (instalment); the payment matches by reference | `PromptPayQr.generate` exists in `payments`; **New** `GET /api/v1/me/loans/{id}/qr` |

The core today has no payment, rail or batch endpoints; `payments` contains only the PromptPay QR encoder and parser.

## 5. States

### Outgoing payment (BAHTNET, SWIFT, PromptPay)

| State | Entered by | Next |
|---|---|---|
| `entered` | Maker keys or a channel submits | `screening` |
| `screening` | Screening engine | `held` (score ≥ 85), `waiting for checker` |
| `held` | Sanctions hit | `released` (false positive, within authority), `rejected` |
| `waiting for checker` | — | `approved` |
| `approved` | Checker (and call-back where required) | `warehoused` if the rail is closed or the value date is later; else `sent` |
| `warehoused` | Rail closed | `sent` at opening; `cancelled` before 08:30 |
| `sent` | Rail adapter | `settled` (BAHTNET: final at once) / `credited` (gpi ACCC) |
| `returned`, `rejected`, `cancelled` | — | — |

### Bulk file

| State | Entered by | Next |
|---|---|---|
| `received` | Upload, SHA-256 and control total checked | `validated` |
| `validated, exceptions` | Validation | `ready` when every must-exclude row is excluded |
| `ready` | — | `released (rt)`, `released (bulk)` |
| `released` | Release | `settled`; returned items fed back to the company |

### Recall

`new request` → `with receiving bank` (`rcSend`) → `returned` or `refused` (`rcOutcome`). Answer due within 7 business days.

### Standing order

`active` → on due date: `paid`, or `failed` (insufficient funds) → retried daily for 3 days → `failed, notified`.

## 6. Postings

| Event | Debit | Credit | Amount |
|---|---|---|---|
| Large-value transfer approved | CUR-B2031 available | CUR-B2031 payment hold | ฿31,850,000.00 (reservation) |
| BAHTNET sent | CUR-B2031 | BOT current account (settlement) | ฿31,850,000.00 |
| SWIFT from USD account | FCD-B2031 | USD nostro (MUFG) | $240,000.00 |
| SWIFT paid in baht | CUR-B2031 ฿8,659,200.00 | FX position (treasury) | at 36.0800 |
| SWIFT fee | Customer account | Fee income, remittance | ฿500.00 (+ ฿900.00 OUR) |
| Payroll release | CUR-K0414 | Own-bank staff accounts; ITMX clearing for other banks | released total |
| Payroll fees | CUR-K0414 | Fee income | ฿5 or ฿2 per other-bank item |
| Recall returned | ITMX clearing | SAV-40218 | ฿18,500.00 |
| Held payment rejected | Payment hold | CUR-B2031 | $1,180,000.00 equivalent |
| ITMX break | Suspense GL 2990 | SAV-C14 | ฿4,200.00 (when matched) |

## 7. Configurable values

| Key | Prototype value | Set by | Rule (to confirm) |
|---|---|---|---|
| `rail.bahtnet.hours` | 08:30–15:30 business days | Regulator (BOT), locked | Customer transfers |
| `rail.itmxBulk.cutoffs` | 10:30 and 14:00 business days | ITMX, locked | — |
| `rail.promptpay.hours` | 24/7 | ITMX, locked | — |
| `rail.swift.usdSameDay` | by 15:00; sent any day, value next business day | Bank / correspondent | — |
| `calendar.businessDays` | Thai bank holidays (23 Oct Chulalongkorn Day) | Regulator, locked | Value dates roll forward to the next business day |
| `limit.onlineBusinessTransfer` | ฿20,000,000 per item | Bank | Above it: paper instruction |
| `callback.paperAbove` | ฿5,000,000 | Bank | Call-back before approval, number from the mandate only |
| `authority.rtgs` | ops ฿50,000,000; finance ฿500,000,000; above → Head of operations | Bank | — |
| `treasury.confirmAbove` | ฿500,000,000 | Bank | Treasury confirms the position before release |
| `screening.holdScore` | 85 | Bank (compliance) | Lists: UN, OFAC, EU, Thai; names, banks, countries, field 70 |
| `screening.decideWithin` | 4 hours | Bank | Held payment target |
| `swift.purposeCodeFrom` | $50,000 | Regulator, locked | BOT FX reporting |
| `swift.fee` | ฿500; OUR adds ฿900 | Bank | — |
| `bulk.fee` | real time ฿5, bulk ฿2 per other-bank item | Bank | — |
| `standingOrder.retryDays` | 3 | Bank | Daily retry after insufficient funds |
| `recall.answerDays` | 7 business days | ITMX, locked | — |
| `itmx.collateralPledged` | ฿6,000,000,000 | Bank (treasury) | — |

## 8. Acceptance criteria

| # | Given | When | Then |
|---|---|---|---|
| 1 | Saturday 24 Oct | Payments overview opens | BAHTNET and ITMX bulk show "Closed until Monday"; PromptPay "Open"; the Monday queue lists TR-9918231, PAY-26-10-0414, TR-9918202 and SO-55120 with headroom computed from ฿4,210,000,000 + ฿2,500,000,000 intraday |
| 2 | TR-9918231 without a call-back | `ops` approves | Blocked: "Call-back first" |
| 3 | TR-9918231, maker Wanida K. (`credit`) | The maker approves | Blocked: "You entered this transfer. A different person must approve it." |
| 4 | Call-back recorded | `ops` approves | Review shows ฿31,850,000.00 and "Within your authority"; state "Warehoused for Monday 08:30"; funds held |
| 5 | Warehoused transfer | Monday 08:30 | Sent first in the queue; cannot be cancelled afterwards |
| 6 | TR-9918203 with open hits | Send | Blocked: "Screening is not cleared. Clear the hits first." |
| 7 | Hits cleared, no purpose code | Send | Entry step: "The BOT needs a purpose for transfers of $50,000 or more." |
| 8 | Purpose 318004, from FCD-B2031, SHA | Send | MT103 :71A:SHA, :77B:/BOT/318004, UETR assigned; tracker shows "Sent to MUFG Bank, Tokyo" |
| 9 | Paid in baht | Send as `ops` | Debit ฿8,659,200.00 at 36.0800; "Needs a second approver: the head of dealing." |
| 10 | Charges OUR | Send | Our fee ฿1,400.00; Hino receives $240,000.00 in full |
| 11 | PAY-26-10-0414 with row 62 not excluded | Release | Blocked: "Rows that cannot be paid… they would bounce back." |
| 12 | Rows 17, 51 and 62 excluded | Release real time | 81 items, ฿1,893,500.00; within `payout`; "Payroll paid; staff credited today." |
| 13 | Same, route bulk | Release | Staff paid Mon 26 Oct; fees ฿2 per other-bank item |
| 14 | RCL-26-1024-03 new | Send recall | State "With the receiving bank"; customer SMS |
| 15 | Recall sent | Answer `returned` | ฿18,500.00 credited to SAV-40218; case closed |
| 16 | Recall sent | Answer `refused` | Letter with transfer details sent to the customer; no account debited |
| 17 | TR-9918210 held at 91% | `ops` releases with reason and typed id | Above `payout`: sent to the head of operations; on approval released before 15:00 and the beneficiary added to the good-guys list |
| 18 | TR-9918210 | Reject | Funds back to CUR-B2031; compliance case opened; customer told only that it could not be made |
| 19 | App, LN-A-C10 overdue | Customer pays an instalment | Applied oldest first; the loan and the postings update at once; receipt shown |

## 9. Gaps against the core

| **New** call | Purpose | Owning module |
|---|---|---|
| `POST /api/v1/payments`, `GET /api/v1/payments/{id}`, `GET /api/v1/payments?state=&rail=` | Outgoing payment record and lists | payments |
| `POST /api/v1/payments/{id}/callbacks` | Call-back evidence | payments |
| `POST /api/v1/payments/{id}/approval`, `/cancellation`, `/send` | Maker-checker, warehousing, sending | payments |
| `POST /api/v1/payments/{id}/screening/clearance`, `/release`, `/rejection` | Sanctions screening decisions | payments + compliance |
| `GET /api/v1/payments/{id}/tracking` | SWIFT gpi | payments (SWIFT adapter) |
| BAHTNET, ITMX (PromptPay, ORFT, bulk, dispute) and SWIFT adapters | Rails | payments (integration) |
| Job `rail-release` | Release warehoused items at opening in queue order, checked against the BOT balance | scheduler + payments |
| `GET /api/v1/payments/overview` | Rails, queue, BOT position | payments + treasury |
| `POST /api/v1/payment-batches`, `GET /api/v1/payment-batches/{id}`, `PATCH .../items/{row}`, `POST .../release` | Bulk files | payments |
| `POST /api/v1/standing-orders`, `GET /api/v1/standing-orders`, job `standing-order-run` | Standing orders and retries | payments + scheduler |
| `POST /api/v1/recalls`, `POST /api/v1/recalls/{id}/request`, `POST /api/v1/recalls/{id}/outcome` | Recalls of mistaken transfers | payments |
| `GET /api/v1/me/loans/{id}/qr` | Thai QR for a loan instalment (uses `PromptPayQr`) | payments + lending |
| `POST /api/v1/reconciliations/{id}/breaks/{breakId}/resolution` | ITMX break (see 11) | accounting |
| Business-day calendar service | Value-date rolling for every rail | platform |

## 10. Open questions

1. Is the ฿5,000,000 call-back threshold for paper instructions the bank's rule, and which numbers count as "on file" (mandate only)?
2. BOT purpose codes: confirm the code list and the $50,000 threshold for reporting.
3. Payroll on a non-business payday: should the bank offer real-time by default, and who bears the per-item fee difference?
4. The prototype charges 53 items' fees regardless of exclusions; production should charge only items actually sent to other banks.
5. Screening hold threshold (85) and the 4-hour decision target: compliance to set.
6. ITMX dispute service: the message set and the 7-business-day answer period.
7. The recall answer is due seven business days after Saturday 24 Oct, Tuesday 3 Nov (the prototype now shows 3 Nov); confirm the counting rule with ITMX.

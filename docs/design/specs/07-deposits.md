# 07 · Deposits

Spec for the Deposits system of the production console: savings and current accounts, holds and legal orders, dormant accounts and the dormant fee, term deposits at maturity with withholding tax, and the monthly statement run. It also places the AML case and the held payment, which sit in Compliance and Payments but act on deposit accounts.

Prototype sources: `js/deposits.js`, `viewAccount` (SAV-C10) in `js/records.js`, `TD-88140` and the `tdInstruction` flow in `js/flows.js`, `viewAML` and `viewHeld` in `js/records.js`. Business account opening (AO-26-0412) and individual onboarding (ONB-7731) are in [01-onboarding.md](01-onboarding.md); the counter's cash deposit and withdrawal are in [09-branch.md](09-branch.md); the held payment TR-9918210 is specified in [08-payments.md](08-payments.md).

All regulatory rules below are the prototype's reading and are *to confirm* with counsel, compliance and tax.

## 1. Scope and users

| In scope | Out of scope |
|---|---|
| Account page: transactions, holds, interest, statement | Opening an account (01) |
| Legal orders from the LED, AMLO and the police: verify, apply, check, reply | Cash at the counter (09) |
| Dormancy: marking, contact, reactivation, the yearly dormant fee | Card authorisations (holds arrive from the card system) |
| Term deposits: maturity instruction, rollover, payout, prepayment to a loan, withholding tax | Unclaimed-money remittance to the state (open question 3) |
| Statement run: checks, exceptions, generation and delivery | Product definition of deposit products (Product Factory) |

| Role (prototype id) | May do |
|---|---|
| Operations checker (`ops`) | Verify and apply legal orders; check an order someone else applied; reactivate a dormant account; set term deposit instructions; run statements |
| Finance controller (`finance`) | Run the dormant fee (posts fee income under the `journal` authority) |
| Teller (`teller`) | See holds and dormancy on the account; reactivation is at the branch but approved as above |
| Compliance / investigator | Work AML cases (AML-2026-0418); see orders marked secret in full |
| Front line (branch, call centre) | See only "restricted: refer to compliance" on an account under a secret order |

## 2. Screens

| Route | Record / list | Facts strip | Tabs and the data each needs |
|---|---|---|---|
| `deposits/accounts` → `SAV-C10` | Savings account | Balance, Available (balance − holds), Holds, Rate, Accrued this month, Opened | **Transactions**: when, description, reference, amount, running balance; filter by id, name or amount. **Holds**: hold id, reason, placed, until, amount (e.g. HLD-30412 card authorisation ฿5,000.00 to 30 Oct). **Interest**: rate, accrual method, accrued to date, next capitalisation. **Statement**: opening, money in, money out, closing for the last month and the channel used |
| `deposits/orders` | Holds and orders list | — | Order, Issuer, Account, Amount, Received, State |
| `deposits/orders` → `ORD-26-0187`, `-0191`, `-0193` | Legal order | Account balance, Order covers, Available to the customer, Period | **Order**: issued by, legal basis, received via, effect, reply, related case; handling timeline received → verified → applied (maker) → checked (checker) |
| `deposits/dormant` | Dormant accounts list | — | Account, Customer, Balance, Dormant since, Fee, State |
| `deposits/dormant` → `SAV-30988` | Dormant account | Balance, Last customer activity, Dormant since, Interest ("Still credited"), Dormant fee | **Account**: why dormant, rules while dormant, history timeline. **All dormant accounts**: portfolio by age band with counts, balances, whether the fee applies; the fee-run button |
| `deposits/term` | Term deposits list | — | Deposit, Customer, Principal, Rate, Matures, At maturity |
| `deposits/term` → `TD-88102`, `TD-88201`, `TD-88140` | Term deposit | Principal, Gross interest (days), Withholding tax %, Paid at maturity, Matures | **Summary**: instruction, default if none, change window after rollover, early withdrawal rule; tax card (rate, 50 Tawi certificate, remittance date) |
| `deposits/statements` | Statements list | — | Run or account, Customer, Period, Channel, Sent, State |
| `deposits/statements` → `STM-2026-10` | Statement run | Statements, By app, Encrypted email, Post, Tax certificates | **Checks**: the five pre-send checks. **Exceptions**: email bounced, post returned, opted out of paper, with what happens to each |
| `compliance/cases` → `AML-2026-0418` | AML case | (see 08 and the compliance spec) | Alert, Investigation, Decision |

Front-line masking: when an account carries an order with `secret = true` (AMLO), every screen outside Compliance and Operations shows the account state as "restricted: refer to compliance" and hides the order, its amount and its issuer. Statements never show order detail (statement check 5).

## 3. Fields

### Verify the order (`ordVerify`)

| Field | English label | Thai label | Type | Required | Source | Validation |
|---|---|---|---|---|---|---|
| `chk[0]` | Confirmed with the issuer through its own channel | ยืนยันกับผู้ออกคำสั่งผ่านช่องทางของผู้ออกคำสั่ง | checkbox | Yes | Staff | All three must be ticked |
| `chk[1]` | Account number and holder's ID match the order | เลขบัญชีและเลขประจำตัวของเจ้าของบัญชีตรงกับคำสั่ง | checkbox | Yes | Staff | " |
| `chk[2]` | Order is signed by an authorised officer and within its period | คำสั่งลงนามโดยเจ้าหน้าที่ผู้มีอำนาจและอยู่ในระยะเวลา | checkbox | Yes | Staff | " |

Message when not all ticked: "All three checks must pass; otherwise return the order to the issuer."

### Apply the hold (`ordApply`), Check and reply (`ordCheck`)

No input fields: the amount and the effect come from the order record. `ordCheck` shows Held and Reply to.

### Reactivate (`dormReactivate`)

| Field | English label | Type | Required | Source | Validation |
|---|---|---|---|---|---|
| `rchk[0]` | Identity checked: card reader and NDID, face matches | checkbox | Yes | Staff, NDID, card reader | All three ticked |
| `rchk[1]` | Mobile number unchanged in the last 30 days | checkbox | Yes | Core (contact history) | " |
| `rchk[2]` | Customer asked for it in person or in the app, not by phone | checkbox | Yes | Staff | " |

Message: "Reactivating dormant accounts is a common fraud route; every check must pass." In production `rchk[1]` is computed, not ticked.

### Maturity instruction (`tdRoll`)

| Field | English label | Thai label | Type | Required | Values |
|---|---|---|---|---|---|
| `instr` | At maturity | เมื่อครบกำหนด | choice | Yes | `rollall` Roll over principal and interest · `rollprin` Roll over principal; pay interest to savings · `close` Close and pay to {payout account} · `loan` Pay to the home loan as a prepayment (only when the customer has a loan with the bank, e.g. TD-88201 → LN-77120) |
| `term` | New term | ระยะใหม่ | choice | When rolling | From the rate card: 3 months 1.60%, 6 months 1.90%, 12 months 2.25%, 24 months 2.50% |

`tdInstruction` (TD-88140, corporate) offers `pay` / `roll` / `rollall` at 2.35% for 6 months; same rules.

### Dormant fee run (`dormFee`), Contact the customer (`dormTrace`), Generate and send (`stmRun`)

No input fields; each shows the population and the consequence.

## 4. Actions

| Action | Who | Refused or blocked when (message) | Review shows | Approval rule | Effect | Core call |
|---|---|---|---|---|---|---|
| Verify the order `ordVerify` | `ops` | Any check unticked: "All three checks must pass; otherwise return the order to the issuer." | "Records the order as authentic. The hold is applied next." | Single person | Order `received → verified` | **New** `POST /api/v1/legal-orders/{id}/verification` (deposit) |
| Apply the hold `ordApply` | `ops` | Order not `verified` (button hidden) | Amount; effect; "Places a legal hold of ฿X on {account}, effective at once on every channel." Secret orders add "Front-line staff see only that the account is restricted." | Maker of a maker-checker pair | `verified → applied`; hold placed with amount and scope (`partial`: debits above free balance refused; `freeze`: all debits refused, credits accepted and frozen; `suspend`: all debits and channels suspended) | **New** `POST /api/v1/accounts/{id}/holds` with `kind=legal`, `orderId`, `amountMinor`, `scope` (deposit) |
| Check and reply `ordCheck` | `ops`, not the maker | Maker = checker: "You applied the hold, so someone else checks it. Preview as another role." | Held; reply to; "Confirms the hold matches the order and sends the reply: {reply}." | Checker of the pair | `applied → checked`; reply sent to the issuer's channel | **New** `POST /api/v1/legal-orders/{id}/check` (deposit); reply via **New** issuer adapter (LED e-filing, AMLO secure channel, police case system) |
| Contact the customer `dormTrace` | `ops` | Campaign already sent (button disabled) | "Sends the reminders. The message never states the balance…" | Single | SMS, LINE and a letter in a plain envelope; timeline entry | **New** `POST /api/v1/accounts/{id}/dormancy/contact` (deposit → notifications) |
| Reactivate `dormReactivate` | `ops` at the branch | Any check unticked (message above) | "Makes the account active. For 30 days, outgoing transfers above ฿50,000 wait 24 hours, and the customer is told of each one." | Single, with identity evidence | `dormant → active`; 30-day watch (`postReactivationHold`) | **New** `POST /api/v1/accounts/{id}/reactivation` (deposit) |
| Run the dormant fee `dormFee` | `finance` | Already run for the year (disabled) | 17,904 accounts charged ฿50; 3,426 charged their balance; total ฿1,006,188.40 | `journal` authority (finance ฿50,000,000; ops ฿1,000,000 → Finance controller) | Fee posted per account; none below zero; zero-balance accounts closed after a final notice | **New** `POST /api/v1/deposits/dormant-fee-runs` with `year` (deposit, scheduler) |
| Maturity instruction `tdRoll` | `ops` | — | Principal, interest, withholding tax, then the new deposit (amount, rate, end date) or the payout | Single | Instruction saved on the deposit; `loan` also creates a prepayment instruction on the loan for the maturity date | **New** `PUT /api/v1/term-deposits/{id}/maturity-instruction` (deposit) |
| Maturity (scheduled) | Scheduler | — | — | — | Interest, withholding tax, then roll or pay out per the instruction | **New** scheduler job `term-deposit-maturity` calling `DepositService` (deposit) |
| Generate and send `stmRun` | `ops` | Warns (does not block) if last month's 214 bounced emails were not switched to post | "Generates the statements from the ledger as of 31 Oct 23:59, sends them on 1 Nov, and keeps a copy for 10 years." | Single | Run scheduled for 1 Nov 00:30 | **New** `POST /api/v1/statement-runs/{period}/schedule` (deposit, documents) |
| Switch exceptions to post | `ops` | — | — | Single | Bounced-email accounts use post this month | **New** `POST /api/v1/statement-runs/{period}/exceptions/bounced/channel` |
| Deposit / withdraw on an account | Teller, `ops` | See 09 | See 09 | `cash` | Posts to the account | `POST /api/v1/accounts/{id}/deposits`, `POST /api/v1/accounts/{id}/withdrawals` (exist) |
| Read balance | Any | — | — | — | — | `GET /api/v1/accounts/{id}/balance?asOf=` (exists) |
| Account page data | Any | — | — | — | Transactions, holds, accrued interest | **New** `GET /api/v1/accounts/{id}` and `GET /api/v1/accounts/{id}/transactions`, `GET /api/v1/accounts/{id}/holds` (deposit; today only the balance is exposed) |
| File an STR `fileSTR` | Investigator | Grounds ≤ 40 characters: "Describe the grounds in more detail." | Report STR-2026-0094; typed confirmation of the case id | Typed confirm; customer not told | Report filed; account to enhanced monitoring | **New** `POST /api/v1/aml/cases/{id}/str` (compliance) |
| Close with no report `closeCase` | Investigator | No reason: "Say why." | "Sends the closure to a second investigator." | Second investigator | Case `→ closure review` | **New** `POST /api/v1/aml/cases/{id}/closure` (compliance) |

The core today exposes only `deposit`, `withdraw` and `balance` on accounts (`BankingController`), and `DepositService` has `open`, `deposit`, `withdraw`, `balance`, `accrued` and `capitalize`. Holds, orders, dormancy, term deposits and statements are new.

## 5. States

### Legal order

| State | Entered by | Next |
|---|---|---|
| `received` | Order arrives on the issuer's channel (or is keyed from paper) | `verified`; or `returned` if a check fails |
| `verified` | `ordVerify` | `applied` |
| `applied` | `ordApply` (maker recorded) | `checked` |
| `checked` | `ordCheck` by a different person; reply sent | `released` (issuer lifts it or the period ends), `remitted` (LED calls for the money) |
| `released` / `remitted` | Issuer instruction or expiry | — |

Periods: ORD-26-0187 LED attachment until released or called; ORD-26-0191 AMLO 90 days unless extended; ORD-26-0193 police 7 days, then released unless the police order more.

### Account dormancy

| State | Entered by | Next |
|---|---|---|
| `active` | Opening; reactivation | `dormant` after 12 months with no customer-initiated transaction (interest and fees do not count) |
| `dormant` | Nightly dormancy job | `active` by reactivation; `closed` when the fee takes the balance to zero and the final notice expires |
| `active, watched` | Reactivation | `active` after 30 days |

### Term deposit

| State | Entered by | Next |
|---|---|---|
| `open` | Placement | `matured` on the end date |
| `matured` | Maturity job | `rolled` (new deposit opened, old one closed), `paid` |
| `rolled, change window` | Rollover | `open` (new deposit) after 7 days; within 7 days the customer may change it without losing interest |

### Statement run

| State | Entered by | Next |
|---|---|---|
| `ready` | Month end | `scheduled` by `stmRun` |
| `scheduled` | `stmRun` | `sent` on 1 Nov 00:30 |
| `sent` | Delivery | Exceptions feed next month's run |

## 6. Postings

GL codes are the core's ledger accounts (`DepositService`): `gl:deposit-clearing`, `gl:interest-expense`, `gl:wht-payable`; fee income and the legal-hold sub-account are **New**.

| Event | Debit | Credit | Amount (prototype) |
|---|---|---|---|
| Legal hold applied | Customer account (available) | Customer account, legal-hold sub-balance | ฿2,914,300.00 (ORD-26-0191) — a balance reservation, not a GL movement |
| LED remittance | Customer account, legal-hold | `gl:deposit-clearing` → LED | On instruction |
| Dormant fee | Customer account | Fee income, dormant fee (**New** GL) | ฿50 or the balance if less; run total ฿1,006,188.40 |
| Term deposit interest at maturity | `gl:interest-expense` | Term deposit account | TD-88102 ฿5,264.38; TD-88201 ฿2,016.44 |
| Withholding tax | Term deposit account | `gl:wht-payable` | TD-88102 ฿789.66; TD-88201 ฿302.47 |
| Payout to a loan (TD-88201) | Term deposit account | Loan account LN-77120 (prepayment) | ฿201,713.97 |
| Monthly savings interest | `gl:interest-expense` | Savings account | `DepositService.capitalize` (exists) |

## 7. Configurable values

| Key | Prototype value | Set by | Rule (to confirm) |
|---|---|---|---|
| `dormancy.inactivityMonths` | 12 | Bank | Customer-initiated transactions only; interest and fees do not count |
| `dormancy.feeMinYears` | 2 | Bank | Fee only after 2 years dormant |
| `dormancy.feeBalanceBelow` | ฿2,000 | Bank, within BOT fee rules | Fee only under this balance |
| `dormancy.feeAmount` | ฿50 a year, or the balance if less | Bank | Never takes a balance below zero; published in the fee schedule; customers told 30 days before |
| `dormancy.limitationReviewYears` | 10 | Counsel | Over 10 years: no fee; reviewed for the limitation period |
| `reactivation.watchDays` | 30 | Bank | — |
| `reactivation.delayAbove` | ฿50,000, 24 hours | Bank | Outgoing transfers above it wait 24 hours during the watch |
| `td.rateCard` | 3m 1.60%, 6m 1.90%, 12m 2.25%, 24m 2.50% | Bank (treasury) | — |
| `td.defaultAtMaturity` | Roll principal and interest for the same term at the day's rate | Bank | — |
| `td.changeWindowDays` | 7 | Bank | Change after rollover without losing interest |
| `td.earlyWithdrawal` | Under 3 months: no interest; after: the savings rate | Bank | — |
| `td.dayBasis` | Actual/365 | Bank | `interest = principal × rate × days / 365`, rounded half-up to 0.01 |
| `tax.whtIndividual` | 15% | Regulator, locked | Revenue Code; exemptions (tax-free savings) depend on product and customer |
| `tax.whtCompany` | 1% | Regulator, locked | — |
| `tax.remitBy` | 7th of the next month | Regulator, locked | With the customer's tax ID; 50 Tawi certificate in the app at maturity and with the January statement |
| `orders.ammloPeriodDays` | 90 | Regulator, locked | AMLO may extend |
| `orders.policePeriodDays` | 7 | Regulator, locked | Technology crime decree |
| `orders.ledReplyDays` | 7 | Regulator, locked | Confirm the amount attached |
| `statements.retentionYears` | 10 | Regulator, locked | — |
| `statements.depositProtectionCap` | ฿1,000,000 per depositor per bank | Regulator, locked | Notice printed on every statement |
| `statements.feeNoticeDays` | 30 | Regulator, locked | Fee changes announced 30 days ahead are printed |

## 8. Acceptance criteria

| # | Given | When | Then |
|---|---|---|---|
| 1 | ORD-26-0191 is `received` | `ops` verifies with all three checks | State is `verified`; "Order verified." |
| 2 | ORD-26-0191 is `received` | One check is unticked | Stays on the entry step: "All three checks must pass; otherwise return the order to the issuer." |
| 3 | ORD-26-0191 is `verified` | `ops` applies the hold | State `applied`, maker = `ops`; Available to the customer is ฿0.00 for an AMLO freeze; "Do not tell the customer" pill shown |
| 4 | ORD-26-0191 was applied by `ops` | The same person opens Check and reply | Entry step refuses: "You applied the hold, so someone else checks it." |
| 5 | ORD-26-0193 is `applied` by `ops` | A different role checks it | State `checked`; reply sent; pill "In force: reply sent" |
| 6 | An account under an AMLO order | A branch or call-centre user opens it | They see only "restricted: refer to compliance" |
| 7 | SAV-30988 is dormant | `ops` reactivates with all checks | Pills "Active" and "Watched for 30 days"; a ฿60,000 transfer out is delayed 24 hours |
| 8 | The 2026 dormant fee has not run | `finance` runs it | Review shows 17,904 at ฿50, 3,426 at their balance, total ฿1,006,188.40; within the `journal` authority; no account goes below zero |
| 9 | The dormant fee run is attempted by `ops` | Review | "Needs a second approver: the finance controller." |
| 10 | TD-88102, ฿500,000 at 2.10%, 27 Apr–27 Oct 2026 (183 days), individual | Maturity calculated | Gross ฿5,264.38, withholding ฿789.66 (15%), paid ฿504,474.72 |
| 11 | TD-88201, ฿200,000 at 2.00%, 3 May–3 Nov (184 days) | Instruction set to "Pay to LN-77120" | ฿201,713.97 goes to LN-77120 as a prepayment on 3 Nov; LN-77120's prepayment screen shows it |
| 12 | TD-88102 instruction is roll principal and interest | New term 12 months chosen | Review shows the new deposit at 2.25% to 27 Oct 2027 |
| 13 | A company term deposit matures | Maturity runs | Withholding is 1% |
| 14 | STM-2026-10 is `ready` and 214 emails bounced last month | `stmRun` review | Warning "214 emails bounced last month" with the option to switch to post; sending is still allowed |
| 15 | Bounced accounts switched to post | `stmRun` | State `scheduled` for 1 Nov; no warning |
| 16 | AML-2026-0418 | Investigator files an STR with grounds over 40 characters and types the case id | STR-2026-0094 filed; account stays open; customer not told |

## 9. Gaps against the core

| **New** call | Purpose | Owning module |
|---|---|---|
| `GET /api/v1/accounts/{id}` | Account header, product, state, rate | deposit |
| `GET /api/v1/accounts/{id}/transactions` | Paged transactions with running balance | deposit / ledger |
| `GET /api/v1/accounts/{id}/holds`, `POST /api/v1/accounts/{id}/holds`, `DELETE /api/v1/accounts/{id}/holds/{holdId}` | Holds (card, legal, payment) and the available balance | deposit |
| `POST /api/v1/legal-orders`, `GET /api/v1/legal-orders/{id}` | Register an incoming order | deposit (new `legalorders` package) |
| `POST /api/v1/legal-orders/{id}/verification`, `/check`, `/release`, `/remittance` | Order lifecycle with maker-checker | deposit |
| Issuer adapters (LED e-filing, AMLO secure channel, police case system) | Receive orders and send replies | integration (new) |
| `POST /api/v1/accounts/{id}/dormancy/contact` | Dormant contact campaign | deposit + notifications |
| `POST /api/v1/accounts/{id}/reactivation` | Reactivate with identity evidence; start the watch | deposit |
| Nightly job `dormancy-marking` | Mark accounts dormant | scheduler |
| `POST /api/v1/deposits/dormant-fee-runs` | Yearly fee run | deposit + scheduler |
| `POST /api/v1/term-deposits`, `GET /api/v1/term-deposits/{id}`, `PUT /api/v1/term-deposits/{id}/maturity-instruction` | Term deposits | deposit (new `term` package) |
| Job `term-deposit-maturity` | Interest, withholding, roll or pay out, loan prepayment | scheduler + deposit + lending |
| `GET /api/v1/tax/wht-certificates/{id}` | 50 Tawi certificate | accounting |
| `POST /api/v1/statement-runs/{period}/schedule`, `GET /api/v1/statement-runs/{period}`, `POST .../exceptions/{kind}/channel` | Statement runs | deposit + documents (new) |
| `POST /api/v1/aml/cases/{id}/str`, `POST /api/v1/aml/cases/{id}/closure` | AML case decisions | compliance (new module) |
| Account open from the console | `DepositService.open` exists but no endpoint | deposit (see 01) |

## 10. Open questions

1. Dormancy period and the dormant fee: confirm 12 months and the ฿2,000 / ฿50 rule against the BOT's fee rules and the bank's schedule.
2. Whether the dormant fee posts under the `journal` authority or needs its own action key (a run, not a manual journal).
3. Unclaimed deposits: the limitation period and whether any remittance to the state applies; the prototype only flags accounts over 10 years for counsel.
4. Legal orders: which issuers send electronically and which arrive on paper; the exact reply format and deadline per issuer; who may see secret orders.
5. Withholding tax exemptions (tax-free savings, juristic persons exempt by law): where the flag lives (product or customer).
6. Term deposit early-withdrawal penalty: confirm "no interest under 3 months, savings rate after".
7. Statement email password = date of birth is weak; security to confirm an alternative.

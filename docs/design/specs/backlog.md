# Backlog from the console specs

Every **New** core call and module from specs 00–11 in one list, grouped into slices a team can deliver and demo one at a time. Each slice names its spec; the spec has the fields, rules, review text and acceptance criteria. Items that appear in more than one spec are listed once, under the slice that needs them first.

The order puts shared foundations first, then the retail bank end to end (where most of the core already exists), then the commercial bank. It is a proposal for the bank and the engineering leads to confirm.

## Slice 0 · Foundations every screen needs (spec 00)

| Item | Core call | Module |
|---|---|---|
| Amount limits per role and action, with the second approver | `GET /api/v1/authority/check?action=&amount=` and its configuration | platform-security |
| One approvals inbox for every area | `POST /api/v1/approvals`, `GET /api/v1/approvals?assignee=me`, `POST /api/v1/approvals/{id}/decision` | platform (new `approvals`) |
| Record history from the audit log | `GET /api/v1/records/{id}/history` | platform-security (`AuditLog` exists) |
| Search across records the person may see | `GET /api/v1/search?q=` | platform |
| Workbench cards per role | `GET /api/v1/workbench?role=` | fabor-app read model |
| Exception centre | `GET /api/v1/exceptions`, `POST /api/v1/exceptions/{id}/resolve` | new `operations` |
| Business-day calendar for value dates, cut-offs and deadlines (Thai holidays) | calendar service | platform |
| Manual journals with maker-checker | `POST /api/v1/journals`, `POST /api/v1/journals/{id}/approve` | accounting / ledger |
| Roles the console needs | `rm`, `teller`, `branch-manager`, `trade-ops`, `payments-ops`, `treasury`, `finance-controller`, `policy-maker`, `policy-approver` | fabor-app `Actor`, IdP claims |

## Slice 1 · Opening accounts (spec 01)

| Item | Core call |
|---|---|
| Opening drafts and answers | `POST /api/v1/onboarding`, `PUT /api/v1/onboarding/{id}/answers` |
| Identity: ID card and DOPA, NDID or video | `POST /api/v1/onboarding/{id}/identity/verify`, `POST /api/v1/onboarding/{id}/identity/ndid` |
| Company lookup | `GET /api/v1/registries/dbd/{regNo}` |
| Screening before submission | `POST /api/v1/onboarding/{id}/screening`, `POST /api/v1/onboarding/{id}/screening/{hitId}/clear` |
| Submit, route, approve, reject, check | `POST /api/v1/onboarding/{id}/submit`, `/approve`, `/reject`, `/check` |
| Business party with directors, owners, mandate | `POST /api/v1/business-customers` |
| KYC refresh | `POST /api/v1/customers/{id}/kyc-reviews`, `POST /api/v1/kyc-reviews/{id}/complete` |
| Open an account without onboarding a party | endpoint for `DepositService.open` |

Existing and reused: `POST /api/v1/customers`, `/release`, `/consents/{purpose}/withdraw`.

## Slice 2 · Retail lending from application to payout (spec 02)

| Item | Core call |
|---|---|
| Split today's decide-and-disburse call into steps | `PUT /api/v1/loan-applications/{id}/answers`, `POST …/bureau`, `POST …/submit`, `POST …/offer`, `POST …/disburse` |
| Credit review | `POST /api/v1/credit-reviews/{id}/verifications`, `PATCH …/worksheet`, `PUT …/deviations/{key}`, `POST …/decisions`, `POST …/information-requests` |
| Credit committee (retail and commercial) | `POST /api/v1/committees/{meetingId}/items`, `POST /api/v1/committees/{meetingId}/items/{itemId}/resolution` |
| Approval to payout | `POST /api/v1/disbursements/{id}/conditions/{key}/receive`, `/verify`, `/waive`; `POST …/contract/send`, `…/insurance/verify`, `…/mortgage`, `…/payout` |
| Credit policy (unless hosted on product drafts) | `PUT /api/v1/credit-policies/{id}/draft`, `POST …/draft/simulate`, `POST …/draft/return` |

Existing and reused: `POST /api/v1/loans/applications` (automatic path), product disclosure, product draft submit, approve and publish.

## Slice 3 · Servicing and collections (specs 02 and 05)

| Item | Core call |
|---|---|
| Home-loan servicing (`LoanService.prepay` and `holiday` exist without endpoints) | `POST /api/v1/loans/{id}/prepayments`, `/rate-offers` and `/accept`, `/holidays`, `/due-day`, `/mandates`, `/fee-waivers`, `/letters` |
| Contact and promise rules enforced in the core | extra fields on `POST /api/v1/collections/{loanId}/contacts` and `/promises` (outcome, successful contact, up to three dated parts; calling hours; one successful contact a day) |
| Hardship and restructuring offers | `POST /api/v1/collections/{loanId}/hardship`, `POST /api/v1/loans/{id}/restructure-offers`, `POST …/restructure-offers/{offerId}/acceptance`; `holidayMonths` on `/restructure` |
| Settlement from a branch receipt or another account | extend `POST /api/v1/loans/{id}/settlement` |
| Legal case and debt sale | `POST /api/v1/collections/{loanId}/legal-events`, `POST /api/v1/loans/{id}/debt-sale` |
| Repossession notice and reserve price | `POST /api/v1/repossessions/{reference}/notices`; reserve price on the case |
| Strategy page | `GET /api/v1/collections/strategy` |

## Slice 4 · Auto finance (spec 06)

| Item | Core call |
|---|---|
| Hire purchase from the dealer's quote | `POST /api/v1/hp-quotes`, `POST …/terms` (refuse above the rate cap), `POST …/decision`, `POST …/signature` |
| Pay the dealer net of subsidy; commission runs with clawback and 3% WHT | extend `POST /api/v1/dealers/payments`; `POST /api/v1/dealers/{id}/commission-runs`; `GET /api/v1/dealers/{id}/scorecard` |
| Registration book custody | `POST /api/v1/assets/{id}/book-movements` |
| Operating lease end: inspection, return, buy, extend | `POST /api/v1/leases/{id}/inspection`, `POST /api/v1/leases/{id}/end`; `GET /api/v1/leases` |

## Slice 5 · Deposits (spec 07)

| Item | Core call |
|---|---|
| Account view and history | `GET /api/v1/accounts/{id}`, `GET /api/v1/accounts/{id}/transactions` |
| Holds and available balance | `GET`, `POST /api/v1/accounts/{id}/holds`, `DELETE /api/v1/accounts/{id}/holds/{holdId}` |
| Legal orders with maker-checker; LED, AMLO and police adapters | `POST /api/v1/legal-orders`, `GET …/{id}`, `POST …/verification`, `/check`, `/release`, `/remittance` |
| Dormancy and unclaimed money | job `dormancy-marking`; `POST /api/v1/accounts/{id}/dormancy/contact`, `/reactivation`; `POST /api/v1/deposits/dormant-fee-runs` |
| Term deposits and withholding tax | `POST /api/v1/term-deposits`, `GET …/{id}`, `PUT …/maturity-instruction`; job `term-deposit-maturity`; `GET /api/v1/tax/wht-certificates/{id}` |
| Statements | `POST /api/v1/statement-runs/{period}/schedule`, `GET …/{period}`, `POST …/exceptions/{kind}/channel` |
| AML case decisions | `POST /api/v1/aml/cases/{id}/str`, `POST /api/v1/aml/cases/{id}/closure` |

## Slice 6 · Payments (spec 08)

| Item | Core call |
|---|---|
| Outgoing payments with call-back, maker-checker and warehousing | `POST /api/v1/payments`, `GET …/{id}`, `GET /api/v1/payments?state=&rail=`, `POST …/callbacks`, `/approval`, `/cancellation`, `/send` |
| Screening decisions | `POST /api/v1/payments/{id}/screening/clearance`, `/release`, `/rejection` |
| Rail adapters and release at opening | BAHTNET, ITMX (PromptPay, ORFT, bulk, disputes), SWIFT; job `rail-release`; `GET /api/v1/payments/{id}/tracking` |
| Overview with the BOT position | `GET /api/v1/payments/overview` |
| Bulk files | `POST /api/v1/payment-batches`, `GET …/{id}`, `PATCH …/items/{row}`, `POST …/release` |
| Standing orders | `POST`, `GET /api/v1/standing-orders`; job `standing-order-run` |
| Recalls of mistaken transfers | `POST /api/v1/recalls`, `POST …/{id}/request`, `POST …/{id}/outcome` |
| Pay an instalment by Thai QR | `GET /api/v1/me/loans/{id}/qr` |

## Slice 7 · Branch (spec 09)

| Item | Core call |
|---|---|
| Drawers and movements on every cash deposit or withdrawal | `POST /api/v1/branches/{id}/drawers`, `GET …/drawers/{drawerId}`; `drawerId` and `teller` on `MoneyMove` |
| Counts and differences to GL 1990 | `POST …/drawers/{drawerId}/counts`, `POST …/differences/{diffId}/approval` |
| Vault under dual control | `POST /api/v1/branches/{id}/vault/movements`, `POST …/vault/counts` |
| Branch day close | `PUT /api/v1/branches/{id}/days/{date}/checklist/{item}`, `POST …/days/{date}/close` |
| Suspect notes, cash reports and structuring alerts | `POST /api/v1/branches/{id}/counterfeit-notes`; `POST /api/v1/aml/ctr`, `POST /api/v1/aml/alerts` |
| Queue tickets | `POST /api/v1/branches/{id}/queue/next` |

## Slice 8 · Finance and control (spec 11)

| Item | Core call |
|---|---|
| Loss allowance as a draft run with scenarios and overlays, posted under authority | `POST /api/v1/ecl/runs`, `GET …/{id}`, `POST …/{id}/post`; `POST /api/v1/ecl/overlays`, `POST …/{id}/approve`; `GET /api/v1/ecl/scenarios` |
| Reconciliation | `GET /api/v1/reconciliations/{runId}`, `POST …/breaks/{key}/explanation`, `POST …/breaks/{breakId}/resolution` |
| BOT data sets with maker and checker | new `reporting`: `GET /api/v1/regulatory-reports/{id}`, `POST …/generate`, `POST …/submit`; `POST /api/v1/loans/{id}/regulatory-codes` |
| Month-end close | `GET /api/v1/close/{period}`, `POST …/steps/{key}/complete`, `POST …/sign-off` |
| GL account view | `GET /api/v1/gl/{code}` |
| Product factory additions | `POST /api/v1/products/drafts/{id}/return`; `effectiveFrom` on publish; `GET /api/v1/products/templates/{id}` |

## Slice 9 · Business banking (spec 03)

| Item | Core call | Module |
|---|---|---|
| Commercial credit applications: spread, rating, pricing, memo, projection, submission | `POST`, `GET /api/v1/credit-applications/{id}`, `PUT …/spread`, `PUT …/rating`, `GET …/projection`, `POST …/submission`, `GET …/memo` | new `credit-analysis` |
| Staged drawdowns against certificates | `POST /api/v1/loans/{id}/drawdowns` | lending |
| Facilities: notes, overdraft draws, covenant tests, waivers, reviews | `GET /api/v1/facilities/{id}`, `POST …/drawdowns`, `/covenant-tests`, `/waiver-requests`, `/reviews` | lending |
| Limit tree: temporary increases, holds | `POST /api/v1/limits/{lineId}/temporary-increase`, `POST …/hold` | new `limits` |
| Relationship view and call reports | `GET /api/v1/customers/{id}/relationship`, `POST /api/v1/customers/{id}/contacts` | customers read model |
| Early warning with a nightly score feeding the ECL stage | `GET /api/v1/early-warnings/{id}`, `POST …/signals/{signalId}/explanation`, `PATCH …/actions/{actionId}`, `POST …/decision` | new `credit-monitoring` |

## Slice 10 · Treasury (spec 10)

| Item | Core call |
|---|---|
| Overview, positions, FX rates | `GET /api/v1/treasury/overview`, `GET /api/v1/treasury/positions`, `GET /api/v1/rates/fx` |
| Liquidity: LCR, stress, contingency plan | `GET /api/v1/treasury/liquidity/lcr`, `GET …/lcr/stress`, `POST …/{reportId}/contingency-plan` |
| Interest-rate risk | `GET /api/v1/treasury/alm/gap`, `GET /api/v1/treasury/alm/shock` |
| FX deals front to back | `POST /api/v1/treasury/deals`, `GET …/{id}`, `POST …/confirmations/{leg}/query`, `…/match`, `POST …/amendments` |
| Nostro reconciliation | `GET /api/v1/treasury/nostros/{id}`, `POST …/matches` (journal from slice 0) |

## Slice 11 · Trade and syndication (spec 04)

| Item | Core call | Module |
|---|---|---|
| Letters of credit: presentations, checks, waiver, refusal (MT734), payment (MT202) | `GET`, `POST /api/v1/trade/lcs`, `GET …/{id}`, `POST …/presentations`, `/waiver-requests`, `/applicant-answer`, `/refusal`, `/payment` | new `trade-finance` |
| Trust receipts | `POST /api/v1/trade/trust-receipts`, `GET …/{id}` | trade-finance on the lending ledger |
| Guarantees under URDG 758 | `GET /api/v1/trade/guarantees/{id}`, `POST …/demands`, `/applicant-notice`, `/payment`, `/refusal` | trade-finance |
| Book a loan from another module (the demand loan after a guarantee claim) | `POST /api/v1/loans` | lending |
| Syndicated loans as agent | `GET /api/v1/syndications`, `GET …/{id}`, `GET …/register`, `POST …/utilisations`, `/funding-notices`, `/fundings`, `GET …/interest-periods/{pid}`, `POST …/distributions`, `/amendment-requests`, `/votes`, `/declaration`, `/transfers`, `/kyc`, `/registration` | new `syndication`, `engine-rfr`, `engine-pro-rata` |
| Off-balance-sheet memo balances | `CONTINGENT_LC`, `CONTINGENT_GUARANTEE`, `UNDRAWN_COMMITMENT`, `AGENCY_CLIENT_MONEY` | ledger |

## Decisions where the prototype and the core disagree

The prototype is the agreed behaviour, but each of these changes something the core already does, so it needs an owner's decision before the work starts.

| # | Area | Core today | Prototype | Spec |
|---|---|---|---|---|
| D1 | Write-off | Debits write-off expense for the whole balance; needs the product's day count or the exception role | Writes off against the 100% allowance with no new loss; clears suspended interest | 05 |
| D2 | Settlement quote | Billed items, principal and interest the rebate rule still charges; settles only from the linked account | Adds interest accrued since the last due date and default interest; accepts a branch receipt | 05 |
| D3 | Restructuring | Booked at once; fixed-rate annuities only; no pause | An offer the customer accepts in the app; one option is a three-month pause | 05 |
| D4 | Repossession shortfall | Written off after the sale | Stays owed on the loan; notice of sale and reserve price first | 05 |
| D5 | Dealer payment | Pays the full asset cost, defers commission | Pays net of the dealer's subsidy; commission in a monthly run with clawback | 06 |
| D6 | Operating lease end | Purchase and termination only for finance leases | Return, buy or extend an operating lease | 06 |
| D7 | Early-payoff rebate | Fractions of interest not yet due | Fractions of unearned interest on the effective-rate schedule | 06 |
| D8 | Loss allowance | Each run books every loan at once with one PD and LGD | Draft run, scenario weights, overlays, posted under authority | 11 |
| D9 | Loan applications | One call decides and disburses | Separate decision, offer and payout, so a person can decide or counter | 02 |

## Fixes made in the prototype

Found while writing the specs and fixed in the prototype on 26 Oct 2026, so the prototype and the specs agree.

| # | Where | Fix |
|---|---|---|
| P1 | Authority (`underwriting.js`) | The credit officer's limit reads the levels the credit policy publishes; above it the approver is named by amount: head of retail credit, then the committee |
| P2 | `disbursement.js` | Carry APP-30409's spouse consent condition through to payout |
| P3 | `underwriting.js` CC-2026-21 | The committee can vote APP-30414 only after it has been sent |
| P4 | `data.js` facilities list | FAC-K0414's state follows the committee decision |
| P5 | `trade.js` | The examination deadline skips 23 Oct (Chulalongkorn Day): 30 Oct, not 29 Oct |
| P6 | `records.js`, `trade.js` BG-26-1102 | "Amend" sends an amendment that waits for the beneficiary; "Record a claim" opens a demand case with a five-day clock |
| P7 | `payments.js` | Recall deadline 3 Nov; payroll fees on the rows actually sent; released payroll leaves the Monday queue |
| P8 | `flows.js` | Remove the dead `eclRun` flow (`finance.js` replaces it) |
| P9 | `treasury.js` | The ALM note: earnings break their limit near +107bp, economic value near +161bp |
| P10 | `finance.js` | Close sign-off goes to the CFO (new action `closesign`); a data-set correction is proposed by one person and checked by another; the NPL ratio counts substandard or worse by BOT classification, shown beside the stage |
| P11 | `branch.js` | A branch manager role (Rattikorn Boonsri) holds `cash`, `cashin`, `overshort` and `branchclose`; `ops` no longer does; the stale router comment is gone |
| P12 | `corporate.js` | Monitoring's "tests due in 30 days" and "reviews overdue" are counted from the facilities on the page |

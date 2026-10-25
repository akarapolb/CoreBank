# 02 · Retail lending

From the application to the open loan and its servicing: the loan application (APP-30416), the credit officer's review (APP-30409), the credit committee (CC-2026-21), approval to payout (DSB-30409 → LN-77455), home-loan servicing (LN-77120) and the retail credit policy every screen reads (POL-RETAIL). Source: `console-prototype/js/appform.js`, `underwriting.js`, `disbursement.js`, `lending.js` (HOME), `policy.js`, lists in `data.js`. Field-level spec for the application form: [loan-application-fields.md](../loan-application-fields.md) (166 fields in 24 sections; personal, home and car products).

## 1. Scope and users

| In scope | Out of scope (other specs) |
|---|---|
| Application intake for personal loan, home loan, car hire purchase, with live affordability | Commercial credit APP-30414 and facilities (03) |
| Automatic decision, referral, credit-officer decision, counter-offer, decline with reasons | Hire-purchase deal from a dealer quote (06) |
| Credit review workbench with income/debt worksheet, deviations and mitigants, memo | Collections, restructuring of arrears (05) |
| Credit committee: agenda, conflicts, quorum, votes, minutes | Loss allowance on the book (11) |
| Approval to payout: conditions with maker-checker, e-contract, insurance, Land Office, payout | |
| Home-loan servicing: prepay, rate review, payment holiday, due date, direct debit, fee waiver, letters | |
| The retail credit policy: draft, simulate, approve, publish | |

| Role | May |
|---|---|
| Branch staff / ops (`ops`) | Take an application, submit it, send the offer, disburse within payout authority, service loans within `service` authority |
| Credit officer (`credit`) | Decide up to ฿2,000,000 and deviations at its level; verify employment; counter-offer; decline; refer; receive and verify conditions; waive a condition |
| Head of retail credit | Decide up to ฿10,000,000 and LTV deviations |
| Credit committee | Above ฿10,000,000; covenant waivers; annual reviews |
| Product maker (`product`) | Draft and submit policy changes |
| Policy checker | Approve, send back and publish (not the maker) |
| Customer (app) | Sign the offer with NDID; accept a counter-offer or rate offer; approve e-DDA |

## 2. Screens

| Screen | Route / id | Facts and tabs |
|---|---|---|
| Lending overview | `lending/overview` | Pipeline and book |
| Applications | `lending/applications` | Application, applicant, product, amount, score, decision |
| Credit review queue | `lending/credit` | Application, applicant, product, amount, flags, state (live from the review) |
| Loan application | `APP-30416` (Pimchanok Rattana, party C13, branch 0123) | Steps as tabs: Loan, Applicant, Work and income, Debts and assets, Co-borrower, Security, Declarations, Documents, Review and submit, Offer and payout. Sticky side panel on every step: instalment, total interest, debt service ratio against the product limit, LTV against its cap, completeness, missing answers with Fix links, the policy checks with Passes / Refer / Fails. |
| Credit review | `APP-30409` (Kittisak and Nattaya Wongsawat, Rama 9 Skyline unit 2304) | Facts: amount ฿2,150,000, LTV, DSR, instalment, approver needed. Tabs: Summary, Applicants (2), Income and debts, Credit bureau, Collateral, Policy and deviations, Credit memo, Decision. |
| Credit committee | `CC-2026-21` (18 Nov 2026, 14:00, room 12A and video) | Facts: agenda items, total under decision, voting members 4, quorum 3 including the chair, conflicts declared. Tabs: Agenda, Members and quorum, Minutes. |
| Disbursements | `lending/disbursements` | Disbursement, loan, customer, amount, to, state ("{n} before payout" or Paid) |
| Approval to payout | `DSB-30409` (APP-30409 → LN-77455, ฿2,000,000, transfer 15 Nov) | Pills: "{n} things before payout" / Ready to pay / Paid. Tabs: Overview, Conditions (5), e-Contract, Insurance, Land Office, Payout. |
| Home loan | `LN-77120` (Anan Chaiyo, party C21) | Pills Active, Stage 1. Tabs: Summary, Schedule (18), Payments (8), Servicing, Letters (4). |
| Servicing requests | `lending/servicing` | Request, loan, customer, asked for, channel, state |
| Credit policy | `POL-RETAIL` (Product Factory) | Version and effective date. Tabs: Affordability, Collateral, Authority, Collections, Regulatory (locked), Impact, Changes. |

**Credit review checks** (Policy and deviations tab), each Pass / Fail / Deviation / Flag:

| Check | APP-30409 value |
|---|---|
| Debt service ratio up to 70% (home) | computed from the worksheet |
| LTV up to 90%, first contract | 93.5% at ฿2,150,000 → deviation, head of retail credit |
| Combined income at least ฿20,000 | |
| 12 months or more in the current job | Kittisak 10 · Nattaya 62 → deviation, credit officer |
| Age 65 or less at the end | |
| Bureau scores 600 or more | 688 · 671 |
| No 60-day arrears in 24 months | one 30-day, Mar 2025 |
| Credit enquiries in 3 months | 4 → flag |

The **worksheet** lists each income line with its source and the percentage counted (salary 100%, overtime and bonus 70%), and each bureau debt with an include toggle; excluding a debt requires a reason and adds a condition (e.g. "The Krungthai loan is left out of the ratio, so paying it off must be a condition."). Every change is logged with before and after.

## 3. Fields (action dialogs)

| Dialog | Field | Label (EN / TH) | Type | Required | Source | Validation |
|---|---|---|---|---|---|---|
| uwVerify | vsrc | Number found on / เบอร์โทรจาก | choice: DBD company record 02-555-0188, company website 02-555-0100 | Yes | Staff | Must be a number the bank found itself |
| | vwho | Spoke to / ผู้ให้ข้อมูล | text | Yes | Staff | "Say who you spoke to." |
| | vres | Result / ผล | choice: confirmed, partial, not confirmed | Yes | Staff | |
| uwApprove | conditions | Conditions before disbursement | multi-select of UW conditions | — | Staff | Payoff condition forced on when a debt is excluded |
| uwCounter | amount | Amount | money | Yes | Staff | "Enter an amount in baht."; "A counter-offer is for less than was asked." |
| | term | Term | choice 25 / 30 years | Yes | Staff | |
| uwInfo | what | Ask the customers for | multi-select (salary certificate, overtime slips, explanation of the late payment, down-payment statement) | ≥1 | Staff | "Choose at least one." |
| uwDecline | dr1, dr2 | Main reason, Second reason | choice: LTV, DSR, tenure, credit history, information not provided; second may be None | dr1 | Staff | "Choose two different reasons, or none for the second." |
| ccVote | cv{n} | Vote per voting member | choice: approve, approve with changes, reject, abstain | Yes | Staff | Conflicted member listed, not voting |
| | cres | Resolution | text | Yes | Staff | "Write the resolution." |
| dsbWaive | wwhy | Why it can be waived | text | Yes | Staff | "Give the reason." |
| dsbInsure | four checks | Loss payee; address and unit match title; cover starts by transfer date; sum insured covers building cost | checkboxes | all | Staff | "Every point must match before it is verified." |
| dsbRegister | reg | Mortgage registration number | text | Yes | Staff (Land Office) | "Enter the registration number." |
| hmPrepay | pamt, pfrom, pmode | Amount; from (TD-88201 at maturity, or transfer today); what gets smaller (term / instalment) | money, choice, radio | Yes | Customer via staff | "Enter an amount in baht…"; amount ≥ balance: "That clears the loan: use a settlement quote…"; from TD: amount ≤ maturity proceeds |
| hmReprice | offer | Retention offer: fixed 3.10% 2 years then MRR − 2.00% (fee ฿5,000), or MRR − 2.25% floating (no fee) | choice | Yes | Staff | |
| hmHoliday | months, reason, how | Instalments to pause (1–3); reason (loss of income, illness, disaster); interest added to the end or spread | choice | Yes | Customer via staff | |
| hmDueDate | hday | New due day (1, 5, 25, 28) | choice | Yes | Customer | |
| hmMandate | account | Collect from (Kasikornbank, SCB) | choice | Yes | Customer | |
| hmWaive | fee, reason | Fee (late fee July ฿200, retention fee ฿5,000); reason | choice | Yes | Staff | |
| hmLetter | kind, via | Interest certificate 2025, balance confirmation, payments in 12 months; email (encrypted PDF), app, post | choice | Yes | Customer | |
| polSubmit | pnote | Why the change | text | Yes | Product maker | "Say why." |
| polReject | note | What to change | text | Yes | Checker | "Say what to change." |
| polPublish | when | Takes effect: now, or 1 Dec 2026 | choice | Yes | Checker | |

## 4. Actions

| Action | Who | Refused / blocked when | Review shows | Approval rule | Effect | Core call |
|---|---|---|---|---|---|---|
| Save application answers | Staff | — | — | — | Draft saved, side panel recalculated | **New** `PUT /api/v1/loan-applications/{id}/answers` |
| Fetch NCB report | System on consent | No CREDIT_BUREAU consent: "Consent for CREDIT_BUREAU is required to check credit" | — | — | Bureau debts listed, score | Inside `POST /api/v1/loans/applications` today; **New** `POST /api/v1/loan-applications/{id}/bureau` |
| Submit for decision (`appSubmit`) | Staff | Missing answers: "{n} answers are missing or wrong"; a hard rule fails: "Outside credit policy" (change amount/term, add co-borrower, or decline with the main reason) | Auto: "Within the automatic approval band · Score 702, every rule passes, ฿{amount} is within ฿{auto}." Refer: "Referred for review" with the reasons. Otherwise "Needs a credit decision by a person · Every hard rule passes. The recommendation is to approve." | `credit` (authority matrix) for a person's decision; automatic band from policy | Auto: approved, documents to come become conditions. Refer: "Referred to compliance before a credit decision". Above authority: "With the credit officer for a decision · Target: 4 working hours." | `POST /api/v1/loans/applications` decides **and disburses** today; split into **New** `POST /api/v1/loan-applications/{id}/submit` (decision only) |
| Send to sign (`appOffer`) | Staff | Not approved | To the customer's app with a push; signs with NDID; offer valid 7 days | — | Key facts sheet and contract sent; key facts must be opened before signing | **New** `POST /api/v1/loan-applications/{id}/offer`; disclosure from `GET /api/v1/products/{product}/versions/{version}/disclosure` |
| Disburse (`appDisburse`) | Ops | Conditions outstanding ("Waiting for the conditions") | "Pays ฿{amount} to {payee} and opens {contract} with {term} instalments on the {day}th." | `payout` | Loan opened (personal LN-A-C15 to SAV-C13; car HP-2026-005020 to the dealer CUR-D0007; home to the seller by cashier's cheque) | **New** `POST /api/v1/loan-applications/{id}/disburse` (wraps `LoanService.disburse`) |
| Verify employment (`uwVerify`) | Credit officer | No contact name | Source of the number | — | Verified / partial / not confirmed logged; not confirmed: "The tenure deviation cannot be accepted; ask for more information or decline." | **New** `POST /api/v1/credit-reviews/{id}/verifications` |
| Edit worksheet line | Credit officer | Excluding a debt without a reason | — | — | Ratios recalculated; change logged with before/after | **New** `PATCH /api/v1/credit-reviews/{id}/worksheet` |
| Write a mitigant | Credit officer | — | — | — | Mitigant stored per deviation | **New** `PUT /api/v1/credit-reviews/{id}/deviations/{key}` |
| Approve (`uwApprove`) | Credit officer | Unmitigated deviation ("Write a mitigant for: …"); employment not verified ("Verify Kittisak's employment first"); a hard rule fails ("only a counter-offer or a decline is possible") → "Not ready to approve" | Amount, term, instalment, DSR, LTV; "Approves with {n} conditions and {m} deviations accepted with their mitigants. The memo is signed with your name." | Level = max(amount level, highest deviation level) from LEVELS; button "Send to {level}" above the user's level | Approved with conditions, or recommended and sent up; above ฿10m added to the next committee | **New** `POST /api/v1/credit-reviews/{id}/decisions` `{kind: approve}` |
| Counter-offer (`uwCounter`) | Credit officer | Amount ≥ asked; blockers as approve | Asked, offered, DSR, extra down payment | Same levels for the new amount | Customers accept or decline in the app within 7 days | **New** same endpoint `{kind: counter, amount, term}` |
| Refer to committee (`uwCommittee`) | Credit officer | — | Meeting CC-2026-21 18 Nov; papers | — | On the agenda; customers told the decision takes until 18 Nov | **New** `POST /api/v1/committees/{meetingId}/items` |
| Ask for information (`uwInfo`) | Credit officer | Nothing chosen | Items | — | Requests in both borrowers' apps; decision clock paused | **New** `POST /api/v1/credit-reviews/{id}/information-requests` |
| Decline (`uwDecline`) | Credit officer | Same reason twice | The letter: main reason, NCB report right, may reapply, may ask for an explanation | — | Application closed, reasons kept, letter by app and email | **New** `POST /api/v1/credit-reviews/{id}/decisions` `{kind: decline, reasons}` |
| Record the vote (`ccVote`) | Committee secretary | No resolution; quorum not met (fewer than 3 voting, or chair absent) → "No quorum" | For / against / abstained, result; tie → "Approved on the chair's casting vote" | Vote: majority of voting members present; conflicted member excluded | Item decided; APP-30409 status follows; FAC-B2031 waiver lifts the draw stop | **New** `POST /api/v1/committees/{meetingId}/items/{itemId}/resolution` |
| Receive / verify a condition | Credit officer receives, ops verifies | Verifier is the receiver | Evidence | Maker-checker | Condition received → verified | **New** `POST /api/v1/disbursements/{id}/conditions/{key}/receive`, `/verify` |
| Waive a condition (`dsbWaive`) | Credit officer | No reason | "Waives '{condition}' with your reason. The waiver is added to the approval record." | `credit` for the loan amount (฿2,000,000) | Condition waived | **New** `POST /api/v1/disbursements/{id}/conditions/{key}/waive` |
| Send to sign (`dsbSend`) | Ops | — | Both borrowers' apps; key facts, loan agreement, direct debit consent | — | Each opens key facts before signing; bank seals after both sign; stamp duty paid electronically | **New** `POST /api/v1/disbursements/{id}/contract/send` |
| Verify insurance (`dsbInsure`) | Ops | Any of four points unticked | Policy FI-26-0091827 | — | Verified; renewal reminder 16 Oct 2027 | **New** `POST /api/v1/disbursements/{id}/insurance/verify` |
| Record mortgage registration (`dsbRegister`) | Ops | Conditions or contract not complete: "Do not register yet · The representative only signs the mortgage once every condition is met and the contract is signed." | Registration on condominium title 77231 | — | Mortgage recorded; cheque may be handed over | **New** `POST /api/v1/disbursements/{id}/mortgage` |
| Disburse (`dsbPay`) | Ops | Any gate open (conditions, both signatures, stamp duty, fire insurance, mortgage): "Not ready to pay" with the list | "Releases the cashier's cheque for ฿2,000,000 and opens LN-77455: 360 months, ฿11,500 on the 25th from 25 Dec 2026." | `payout` (ops ฿5,000,000) | Loan open; ledger, GL and both apps updated | **New** `POST /api/v1/disbursements/{id}/payout` (wraps `LoanService.disburseAtRate`) |
| Prepay (`hmPrepay`) | Ops | Amount ≥ balance; from TD above proceeds | Principal after; term months sooner or new instalment; interest saved | `service` | Applied now, or booked for TD maturity 3 Nov | **New** `POST /api/v1/loans/{id}/prepayments` `{amount, mode: REDUCE_TERM|REDUCE_INSTALMENT, date}` (`LoanService.prepay` exists) |
| Rate review (`hmReprice`) | Ops | — | New rate, interest saved, modification loss (TFRS 9) | `service` on the balance | Offer in the app for 7 days; on acceptance rate changes from the next instalment, instalment unchanged, term shortens | **New** `POST /api/v1/loans/{id}/rate-offers`, `/accept` |
| Payment holiday (`hmHoliday`) | Ops | — | Instalments paused, interest added, longer term or new instalment | `service` | No collection for the months; bureau told current; interest accrues; SICR check | **New** `POST /api/v1/loans/{id}/holidays` (`LoanService.holiday` exists) |
| Move the due date (`hmDueDate`) | Ops | — | First instalment on new day, extra days of interest | — | Schedule re-dated; extra interest added once | **New** `POST /api/v1/loans/{id}/due-day` |
| Direct debit (`hmMandate`) | Ops | — | Account, cap ฿25,000, first collection | — | e-DDA request via ITMX; one retry next business day | **New** `POST /api/v1/loans/{id}/mandates` |
| Waive a fee (`hmWaive`) | Ops | — | Amount, reason | `waive` (ops ฿5,000) | Fee income reversed 5420 against 1320 | **New** `POST /api/v1/loans/{id}/fee-waivers` |
| Issue a letter (`hmLetter`) | Ops | — | Interest paid 2025 ฿95,226.50, deductible up to ฿100,000, sent to Revenue Department with consent | — | Letter generated and sent | **New** `POST /api/v1/loans/{id}/letters` |
| Edit policy draft | Product maker | Out of bounds; regulatory value looser than the floor ("regulation allows at most …"); head limit ≤ officer limit | — | — | Draft changed | `POST /api/v1/products/drafts/{id}/yaml` (if the policy is a product-engine document) or **New** `PUT /api/v1/credit-policies/{id}/draft` |
| Simulate impact | Product maker | — | 90 days of applications decided again: approval rate, expected loss rate | — | — | **New** `POST /api/v1/credit-policies/{id}/draft/simulate` |
| Submit (`polSubmit`) | Product maker | No reason | Approval and loss rate change | Maker-checker | Draft locked, sent to a checker | `POST /api/v1/products/drafts/{id}/submit` or **New** policy equivalent |
| Approve (`polApprove`) | Checker | Checker is the maker: "You made this change, so someone else must approve it." | Maker's reason | Maker-checker | Approved, not yet in force | `POST /api/v1/products/drafts/{id}/approve` |
| Send back (`polReject`) | Checker | No note | — | — | Draft unlocked with the note | **New** `POST /api/v1/credit-policies/{id}/draft/return` |
| Publish (`polPublish`) | Checker | Not approved | Effective now or on 1 Dec 2026 | — | Version +1; new applications, decisions, hardship offers and promises use it; decisions already made keep their version | `POST /api/v1/products/drafts/{id}/publish` |

## 5. States

| Record | States |
|---|---|
| Application | Draft → Submitted → Approved automatically / With credit officer / Referred to compliance / Outside policy → Offer sent → Signed → Disbursed; or Declined |
| Credit review | Awaiting decision → Information requested (clock paused) → Approved / Counter-offer sent / With head of retail credit / With the committee / Declined |
| Committee item | On agenda → Decided (approved, approved with changes, rejected) |
| Disbursement | Stage 0 conditions → 1 conditions verified → 2 contract signed → 3 mortgage registered → 4 paid |
| Condition | Open → Received → Verified, or Waived |
| Policy | Draft → Submitted → Approved → Published (or Scheduled) ; Submitted → Returned → Draft |
| Servicing request | Asked → Offer sent / Booked → Done |

## 6. Postings

| Event | Debit | Credit |
|---|---|---|
| Disbursement | 1300 Loans receivable | Payee account (customer savings, dealer current account, or cashier's cheque clearing) |
| Prepayment | Customer account / TD proceeds | 1300 Loans receivable |
| Fee waiver | 5420 Fee income (reversal) | 1320 Fees receivable |
| Rate review modification | 5310 Modification loss | 1300 Loans receivable (when the present value falls) |
| Stamp duty | Customer or bank per product | Stamp duty payable |

## 7. Configurable values

| Key | Sample | Set by | Rule |
|---|---|---|---|
| `dsr.personal / home / car` | 60% / 70% / 60% | Bank | BOT responsible lending, *to confirm* |
| `minIncome.personal / home / car` | ฿15,000 / ฿20,000 / ฿15,000 | Bank | Credit policy |
| `auto.personal / car` | ฿500,000 / ฿1,500,000 (home never automatic) | Bank | Credit policy |
| `ltvHome.1 / 2 / 3` | 90% / 80% / 70% | Regulator floor, bank may tighten | BOT LTV measure, *to confirm* |
| `ltvCar.new / used` | 85% / 80% | Bank | Credit policy |
| `levels.officer / head` | ฿2,000,000 / ฿10,000,000; committee above | Bank | Delegation of authority |
| `haircut.variable / other` | 70% / 50% | Bank | Credit policy |
| `reg.capHigh / capLow / capThreshold` | 5× / 1.5× income, threshold ฿30,000 | Regulator, locked | BOT personal-loan cap, *to confirm* |
| `reg.defaultRate` | +3% a year | Regulator, locked | BOT, *to confirm* |
| Age at end of term | 65 | Bank | Credit policy |
| Tenure | 1 year employed, 2 years self-employed, no probation | Bank | Credit policy |
| Bureau | score ≥ 600, no 90-day arrears in 24 months (home: 60 days) | Bank | Credit policy |
| Prepayment fee | none after the first 3 years | Bank, per product | Contract |
| Offer validity | 7 days | Bank | Contract |
| Committee quorum | 3 voting members including the chair; chair's casting vote | Bank (board) | Committee charter |
| Policy simulation window | 90 days | Bank | — |

## 8. Acceptance criteria

| # | Given | When | Then |
|---|---|---|---|
| 1 | APP-30416 with 14 answers missing | Submit | "14 answers are missing or wrong"; each marked on its step |
| 2 | APP-30416 complete, personal ฿300,000, every rule passes | Submit | "Within the automatic approval band · Score 702"; "Approved automatically in 2 seconds" |
| 3 | APP-30416 with a PEP or related-party answer | Submit | "Referred for review"; state "Referred to compliance before a credit decision" |
| 4 | APP-30416 switched to a home loan | Submit | "Home loans are always decided by a credit officer."; ops sees "With the credit officer for a decision" |
| 5 | A hard rule fails (e.g. DSR above limit) | Submit | "Outside credit policy" |
| 6 | APP-30409, mitigants empty and employment unverified | Approve | "Not ready to approve" with both blockers |
| 7 | APP-30409 verified, mitigants written, ฿2,150,000 at LTV 93.5% | Approve as credit officer | Button "Send to Head of retail credit"; status "With the head of retail credit" |
| 8 | APP-30409 | Counter-offer ฿2,000,000 | "Within your authority"; LTV below 90% removes the LTV deviation |
| 9 | APP-30409 | Decline with LTV and DSR | Letter names the main reason and the NCB report right |
| 10 | CC-2026-21 item APP-30414 | Vote with Arunee T. conflicted | Arunee does not vote; resolution recorded "(3–0)" |
| 11 | CC-2026-21 tie among voters with the chair approving | Record | "Approved on the chair's casting vote" |
| 12 | DSB-30409 with open conditions | Disburse | "Not ready to pay" listing conditions, signatures, stamp duty, insurance, mortgage |
| 13 | DSB-30409 condition received by the credit officer | The same person verifies | Refused; a second person must verify |
| 14 | DSB-30409 before signatures | Record registration | "Do not register yet" |
| 15 | DSB-30409 all gates met | Disburse as ops | "opens LN-77455: 360 months, ฿11,500 on the 25th from 25 Dec 2026" |
| 16 | LN-77120 | Prepay ฿200,000 from TD-88201, reduce term | Principal after ฿2,590,243.96; "33 months sooner" |
| 17 | LN-77120 as the collector | Prepay | "Needs a second approver" |
| 18 | LN-77120 | Move due day to the 5th | First instalment 5 Dec 2026 |
| 19 | POL-RETAIL draft by user A | User A approves | "You made this change, so someone else must approve it." |
| 20 | POL-RETAIL draft loosening the personal-loan cap above 5× | Save | "regulation allows at most 5 × income" |
| 21 | POL-RETAIL with the officer limit raised to ฿2,500,000 and first-home LTV to 95%, published | Open APP-30409 at ฿2,150,000 | No LTV deviation; within the credit officer's authority |

## 9. Gaps against the core

| Gap | Notes |
|---|---|
| Application as a resource (draft, answers, documents, co-borrower, security) | `POST /loans/applications` takes 12 fields and decides and disburses in one call |
| Decision outcomes beyond approve/decline: refer, person's decision, counter-offer, information request | `CreditDecision.Outcome` only |
| Credit review workbench: worksheet, deviations with levels, mitigants, verifications, memo, audit log of changes | Not in the core |
| Approval levels by amount and deviation | Today `actor.require(...)` by role only |
| Committee: meetings, items, members, conflicts, quorum, resolutions, minutes | Not in the core |
| Disbursement case: conditions with maker-checker, e-contract and stamp duty, insurance verification, Land Office | Not in the core |
| Servicing endpoints over existing domain methods: prepay, holiday | `LoanService.prepay`, `LoanService.holiday` exist without endpoints |
| Rate offers, due-day change, e-DDA mandate, fee waiver, letters | Not in the core |
| Credit policy as a versioned, simulated, maker-checked document read by decisions | `CreditDecision` takes a policy object; the product draft workflow (`/products/drafts`) can host it if the policy is modelled as configuration |

New calls, in one place: `PUT /api/v1/loan-applications/{id}/answers`, `POST /api/v1/loan-applications/{id}/bureau`, `POST /api/v1/loan-applications/{id}/submit`, `POST /api/v1/loan-applications/{id}/offer`, `POST /api/v1/loan-applications/{id}/disburse`, `POST /api/v1/credit-reviews/{id}/verifications`, `PATCH /api/v1/credit-reviews/{id}/worksheet`, `PUT /api/v1/credit-reviews/{id}/deviations/{key}`, `POST /api/v1/credit-reviews/{id}/decisions`, `POST /api/v1/credit-reviews/{id}/information-requests`, `POST /api/v1/committees/{meetingId}/items`, `POST /api/v1/committees/{meetingId}/items/{itemId}/resolution`, `POST /api/v1/disbursements/{id}/conditions/{key}/receive`, `.../verify`, `.../waive`, `POST /api/v1/disbursements/{id}/contract/send`, `POST /api/v1/disbursements/{id}/insurance/verify`, `POST /api/v1/disbursements/{id}/mortgage`, `POST /api/v1/disbursements/{id}/payout`, `POST /api/v1/loans/{id}/prepayments`, `POST /api/v1/loans/{id}/rate-offers` (+ `/accept`), `POST /api/v1/loans/{id}/holidays`, `POST /api/v1/loans/{id}/due-day`, `POST /api/v1/loans/{id}/mandates`, `POST /api/v1/loans/{id}/fee-waivers`, `POST /api/v1/loans/{id}/letters`, `PUT /api/v1/credit-policies/{id}/draft`, `POST /api/v1/credit-policies/{id}/draft/simulate`, `POST /api/v1/credit-policies/{id}/draft/return`.

## 10. Open questions

| Question | For |
|---|---|
| The prototype has two authority mechanisms for credit: the approval levels (LEVELS, read from the policy) and the `credit` row of the authority matrix. Publishing a new officer limit updates the first only. Production should have one source: the credit policy. | Engineering, credit |
| Is the credit policy a product-engine document (reusing `/products/drafts`) or its own resource? | Engineering |
| Home LTV deviation: may the head of retail credit accept LTV above the BOT measure, or only within the bank's own tighter limit? | Counsel, credit |
| Does the decline letter need both reasons by regulation, or only the main one? | Counsel |
| Who pays stamp duty on the e-contract per product, and is it collected before payout? | Operations, tax |
| Payment holiday reporting to NCB as current: confirm under the relief measure in force | Counsel |
| Retention-rate offer modification loss: booked at offer acceptance or at the next instalment? | Finance |

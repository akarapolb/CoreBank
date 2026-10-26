# 11 · Finance and control

Spec for the finance and control screens of the console:

- the loss allowance under TFRS 9 (ECL);
- the sub-ledger to GL reconciliation;
- the BOT loan data set;
- the month-end close;
- the general ledger drill-down;
- the exception centre;
- the product factory (templates and product drafts), which the close freezes and the ledger depends on.

Prototype sources: `docs/design/console-prototype/js/finance.js` (ECL-2026-10, REC-2026-10, DS-LOAN-2026-10, close states), `js/records.js` (GL-1300 and journals, the exception centre, the close checklist, TPL-HP-VEHICLE and AUTO_HP_USED v2), `js/flows.js` (`resolveExc`, `approveProduct`, `requestChanges`). Design background: [docs/04-product-engine.md](../../04-product-engine.md), [docs/08-security-and-compliance.md](../../08-security-and-compliance.md).

Figures are the prototype's sample data for October 2026, viewed on Saturday 24 Oct 2026. PDs, LGDs, scenario weights, staging rules and BOT data set rules are *to confirm*: the bank supplies the model parameters, and counsel and compliance confirm the regulatory readings.

## 1. Scope and users

**In scope.** Finance & Risk: Loss allowance (ECL), Reconciliation, Regulatory reports, Month-end close, General ledger. Operations: Exception centre. Product Factory: Master Builder templates and product drafts.

**Out of scope.** Model development and validation for PD and LGD (the bank supplies tables); financial statement production beyond the allowance movement note; the AMLO cash transaction report (spec 09) and the LCR submission (spec 10), which appear here only as rows in the reports list.

**Users.**

| Role | Prototype role id | May do |
|---|---|---|
| Finance controller | `finance` (Arunee T.) | Post the allowance (`journal` limit ฿50m); propose overlays; explain reconciliation differences; generate or approve the BOT data set; approve journals |
| Operations checker | `ops` (Ploy C.) | Resolve exceptions; approve journals up to ฿1m; generate or approve the data set |
| CFO | — | Sign off the close (action `closesign`; in the prototype every other role sends it to the CFO) |
| Risk committee | — | Approves overlays (outside the console in the prototype) |
| Product maker | `product` (Krit S.) | Creates and submits product drafts |
| Risk and Compliance approvers | `credit` (Wanida K., Risk); Compliance | Approve drafts; Compliance is the last checker |

## 2. Screens

### 2.1 ECL-2026-10 · Loss allowance run

Lede: "Loss allowance under TFRS 9 for October 2026 · positions as of 24 Oct, rerun at 31 Oct 23:59". Pills: "Draft run" or "Posted"; "Board-approved weights" or "Severe weights: for review only". Action: **Post the allowance** (disabled once posted or while severe weights are selected).

| Facts strip | Default value |
|---|---|
| Exposure | ฿31.84bn |
| Allowance required | ฿1,411.12m |
| Held in GL 1390 | ฿1,401.57m |
| Top-up (or Release) | ฿9.55m (warn when positive) |
| Stage 3 share | 2.13% |
| Coverage, Stage 3 | 72.1% |

| Tab | Shows |
|---|---|
| Summary | By stage (Stage, Exposure, Allowance, Coverage) with overlays and total rows; Forward-looking scenarios (Scenario, Weight, PD multiplier, Assumptions) and the Weights selector: "Board-approved, Q4 2026: 60 / 10 / 30" or "Severe, for sensitivity: 50 / 5 / 45", hint "Weighted multiplier 1.120×. Only the board-approved weights can be posted." |
| Loans | The named loans in the run: Loan, Customer, Stage, Why, Exposure, PD, LGD, Allowance. Their stage follows what happened to them elsewhere (restructured, covenant breach, written off). After the LN-A-C14 write-off a notice explains it left the run and its ฿140,000 allowance was used |
| Staging rules | Trigger, Moves to, Loans now (see §7) |
| Overlays | Overlay, Reason, Amount, Expires, State; button **Propose an overlay** |
| Movement | Opening 30 Sep, new loans, repayments and maturities, transfers between stages, write-offs (allowance used), scenario weights, overlays, model and parameter changes, closing 31 Oct; note that the table goes into the financial statement notes as it is |

### 2.2 REC-2026-10 · Reconciliation

Lede: "Sub-ledgers against the general ledger · run daily at 06:00 · today's run". Pill: "3 breaks open" → "All matched or explained".

| Facts strip | Value |
|---|---|
| Ledgers | 6 |
| Postings today | 3,872,934 |
| Breaks open | 3 → 0 |
| Amount open | ฿9,554,751.75 (4,200 + 9,548,691.75 + 1,860) |

| Tab | Shows |
|---|---|
| Breaks | One line per break: GL, what, amount, state; **Open** (go to the source) or **Explain** (timing differences) |
| Ledgers | Ledger, GL, Sub-ledger, GL balance, Difference, State for 1300 Loans, 1320 Interest receivable, 1390 Loss allowance, 2100 Deposits, 1350 Leases, 2990 Suspense |

Breaks:

| Key | GL | What | Amount | Clears when | Go to |
|---|---|---|---|---|---|
| `suspense` | 2990 | ITMX settlement break | ฿4,200.00 | The ITMX exception is resolved | Exception centre |
| `allowance` | 1390 | Loss allowance against today's ECL run | the current top-up (฿9,548,691.75) | The October run is posted | ECL-2026-10 |
| `accrual` | 1320 | Interest receivable: accrual for 31 Oct posts at 23:59 | ฿1,860.00 | Explained as a timing difference | `recExplain` |

### 2.3 DS-LOAN-2026-10 · BOT loan data set

Lede: "Loan data set for the BOT · October 2026 · due 15 Nov 2026 · one row per contract". Pill: validation errors, "Validated", "Generated, waiting for checker" or "Submitted". Action: **Generate the file** (disabled while any rule fails), then **Approve and submit**.

| Facts strip | Value |
|---|---|
| Contracts | 214,880 |
| Gross NPL ratio | Exposure classified substandard or worse (BOT classification by days past due) ÷ total exposure; equals Stage 3 in the sample book (2.13%) |
| Allowance | the run's required allowance |
| Rules passed | 6 / 7 by default (the GL 1390 rule fails until the run is posted) |
| Due | 15 Nov 2026 |

| Tab | Shows |
|---|---|
| Validation | Each rule with pass, warning or error; a failing rule shows why and either **Fix the data** (corrects the source record) or **Open** (goes to the record that must change). Note: "A fix changes the source record, never the file." |
| Contracts | Contract, Product code (C-TERM, R-HOME, R-PERS), Stage (S1–S3), Days past due, Restructured (TDR-02 once fixed), Outstanding, Allowance |
| Submission | Timeline: validated; file generated with a checksum, by whom; approved and submitted, "Acknowledged: DMS-26-10-004127" |

### 2.4 Finance → Month-end close (`finance/close`, page view)

Title "Month-end close · October 2026"; lede "No batch window means no close night: accrual runs all month, so the close is a checklist of controls, not a job queue." A progress bar ("N of 9 steps done", "7 days to month end") and the checklist:

| Step key | Step | Owner | Due | Default state | State rule |
|---|---|---|---|---|---|
| `pre` | Pre-close checks | Operations | 22 Oct | Done | fixed |
| `freeze` | Freeze product changes | Product team | 23 Oct | Done | fixed |
| `recon` | Sub-ledger to GL reconciliation | Finance | Daily 06:00 | Ready | Done when every break is matched or explained, else Ready with **Open** |
| `suspense` | Clear suspense GL 2990 | Payments ops | 30 Oct | Blocked by "ITMX break ฿4,200.00" | Ready (**Mark done**) once the ITMX exception is resolved; Done when marked |
| `accrual` | Accrual complete to 31 Oct | Scheduler | 31 Oct 23:59 | Runs by itself | always auto |
| `ecl` | Run the loss allowance (ECL) | Arunee T. | 31 Oct | Ready (**Open the run**) | Done when the run is posted |
| `fx` | Revalue foreign currency | Treasury | 31 Oct | Runs by itself | always auto |
| `bot` | BOT data sets | Finance | 15 Nov | Waiting | Ready (**Open**) when the ECL run is posted and reconciliation is done; Done when submitted |
| `signoff` | CFO sign-off | CFO | 3 Nov | Waiting | Ready (**Sign off**) when every other step is Done or Runs by itself |

### 2.5 GL-1300 · Loans receivable

Lede: "Asset · balance from the immutable ledger, live". Pill "Matches sub-ledger".

| Facts strip | Value |
|---|---|
| Balance | ฿31.74bn |
| Today's postings | 48,211 |
| Debits today | ฿612.4m |
| Credits today | ฿590.1m |
| Difference | ฿0.00 · "against sub-ledger" |

| Tab | Shows |
|---|---|
| Balance | By product (Personal loans ฿12.06bn, Home loans ฿9.84bn, SME term loans ฿6.98bn, Overdrafts ฿2.86bn) |
| Journals | Journal, When, What, Source, Amount; clicking a row opens the journal drawer |
| Reconciliation | Loan sub-ledger ฿31,744,120,000 against GL 1300, difference ฿0; "Reconciled at 06:00 and on every posting since." |

Journal drawer: account lines with debit and credit, totals, and a notice "Balanced: debits equal credits · posted once, never edited; a correction is a new journal"; **Source: <record>** opens the record that caused it.

### 2.6 Operations → Exception centre (`ops/exceptions`, page view)

Title "Exception centre"; lede "Every break, failed task, integration fault and limit breach in one queue, each with an owner and a clock." Facts: Open, Past their deadline, Oldest, Resolved today. Each item: severity, title, kind · detail · owner, a bar of age against its deadline ("N left" or "Overdue by N"), **Open** and **Resolve**. Items are filtered to the systems the tenant has. Empty state: "No open exceptions · New ones arrive here the moment a check fails."

| Severity | Kind | Title | Owner | Age / deadline (min) | Goes to |
|---|---|---|---|---|---|
| crit | Reconciliation break | ITMX 05:00 · ฿4,200.00 unmatched | Payments ops | 280 / 480 | payments/recon |
| crit | Payoff overdue | FP-2026-0011 · Rama 9 Trucks | Asset finance | 5,760 / 2,880 | leasing/floorplan |
| warn | Dead letter | capitalize:SAV-P9 failed 5 times | Operations | 1,440 / 2,880 | ops/scheduler |
| warn | Nostro break | NOS-EUR-01 · €1,200.00 | Treasury ops | 190 / 1,440 | NOS-EUR-01 |
| warn | Integration | DOPA error rate 1.20% | Integration team | 95 / 240 | admin/integrations |
| info | Limit warning | Bangna Motors at 92% of group limit | Credit risk | 2,100 / 4,320 | DLR-1 |
| info | Document discrepancy | LC-26-0412 insurance certificate | Trade operations | 1,300 / 7,200 | LC-26-0412 |

### 2.7 Product factory: TPL-HP-VEHICLE and AUTO_HP_USED v2

**TPL-HP-VEHICLE** (Master Builder template). Lede: "Vehicle hire purchase template · the building blocks every HP product is made from". Pills Live, v4. Facts: Version v4 (live since 1 Jul 2026), Building blocks 9, Products using it 3, Contracts 4,812, Rule pack TH-HP-VEHICLE-v1, Owner Product team. Actions: New version; **Create product** (opens a draft).

| Tab | Shows |
|---|---|
| Building blocks (9) | Pricing, Instalment VAT, Early settlement rebate, Fees, Default, Insurance, Collateral, Accounting, Disclosure; each "Locked" or "Editable within range" |
| Parameters (7) | Parameter, Default, Allowed range, Who may change, Source (e.g. effective rate cap used cars 15.00%, 0–15%, Nobody, TH-HP-VEHICLE-v1) |
| Rule pack (5) | Rule, Value, Source, State "To confirm with counsel" (OCPB effective-rate caps 10% new / 15% used / 23% motorcycles; rebate 60/70/100 by third of term) |
| Products (3) | CAR_HP_NEW v3 Live 4,812 contracts; AUTO_HP_USED v2 In review; EV_HP_NEW v1 Draft |

**AUTO_HP_USED v2** (product draft). Lede: "Used car hire purchase · made from TPL-HP-VEHICLE v4 · maker Krit S." Pills In review, Simulation passed. Facts: Template v4, Rate range 6–15% effective, Term 12–72 months, Simulation 1,200 / 1,200, Approvals 1 of 2, Goes live 1 Nov 2026. Actions **Request changes**, **Approve**.

| Tab | Shows |
|---|---|
| Setup | The draft's parameters within the template's ranges |
| Simulation | 1,200 scenarios, all passed; highest effective rate 14.82% against the 15.00% cap; distribution by band; a sample cost-of-credit disclosure |
| Approvals | Submitted by Krit S. (maker) with simulation SIM-2210; approved by Wanida K. (Risk); Compliance pending |
| Changes from v1 (5) | Maximum effective rate 18.00% → 15.00%; maximum term 60 → 72 months; rebate Rule of 78 → Tiered 60/70/100; minimum down payment 25% → 20%; disclosure template v1 English first → v2 Thai first |

## 3. Fields

| Dialog | Field | English label | Thai label | Type | Required | Source | Validation |
|---|---|---|---|---|---|---|---|
| `eclRun` | — | Exposure / Weights / Overlays | ยอดหนี้ / น้ำหนัก / การปรับปรุง | read-only | — | Run | Weights must be board-approved, else "Only the board-approved weights can be posted." |
| ECL Summary | `weights` | Weights | น้ำหนัก | choice: `board`, `severe` | Yes | Finance | Disabled once posted |
| `eclOverlay` | `amount` | Amount | จำนวนเงิน | money (THB), default 2,500,000 | Yes | Finance | > 0, else "Enter an amount." |
| `eclOverlay` | `why` | The risk the model does not see | ความเสี่ยงที่แบบจำลองยังไม่สะท้อน | text | Yes | Finance | with evidence, else "Give the reason and the evidence." |
| `eclOverlay` | `ev` | Evidence | หลักฐาน | text; hint "Data, not opinion: arrears trend, sector news, early-warning signals." | Yes | Finance | as above |
| `recExplain` | `why` | Explanation | คำอธิบาย | text, prefilled with the accrual timing explanation | Yes | Finance | "Explain it." |
| `rptGenerate` | — | Rows / Format | แถว / รูปแบบ | read-only: 214,880; BOT specification with SHA-256 checksum | — | System | Blocked while any rule fails |
| `rptSubmit` | — | Prepared by / To | จัดทำโดย / ถึง | read-only | — | System | "Generate the file first." / "You generated the file, so someone else must approve it. Preview as another role." |
| `closeSignoff` | — | Allowance posted / Reconciliation / BOT loan data set | บันทึกค่าเผื่อ / การกระทบยอด / ชุดข้อมูลสินเชื่อ ธปท. | read-only | — | Close | Only offered when the step is Ready |
| `resolveExc` | `how` | Resolution | วิธีแก้ไข | choice: `fixed` "Fixed at the source", `matched` "Matched or adjusted", `accepted` "Accepted as is, with a reason" | Yes | Staff | — |
| `resolveExc` | `note` | What was done | สิ่งที่ทำ | text; hint "Kept with the exception in the audit trail." | Yes | Staff | "Say what was done." |
| `approveProduct` | `note` | Note for the record (optional) | หมายเหตุ (ไม่บังคับ) | text | No | Approver | — |
| `requestChanges` | `note` | What should change | สิ่งที่ต้องแก้ไข | text; hint "The maker sees this note." | Yes | Approver | "Say what should change." |

## 4. Actions

| Action (flow) | Who | Refused or blocked when | Review shows | Approval | Effect | Core call |
|---|---|---|---|---|---|---|
| Post the allowance (`eclRun`) | Finance controller | Severe weights selected; already posted | Allowance held now, allowance required, top-up (or release) to post; "Posts ฿X: debit 5300 Expected credit loss expense, credit 1390 Loss allowance. GL 1390 then agrees with the run." | `journal` with the absolute top-up: ops ฿1m, finance ฿50m, else Finance controller | Run posted at the required amount; close step `ecl` Done; the GL 1390 break and the data set rule clear | `POST /api/v1/ecl/run?asOf=` exists (role `ecl-operator`) but books per loan at once with no draft; **New** draft/post split below |
| Preview a loan's allowance | Finance | — | Stage, horizon PD, LGD, exposure, allowance | None | — | `GET /api/v1/ecl/loans/{loanId}` exists |
| Propose an overlay (`eclOverlay`) | Finance | Run posted | "Proposes ฿X, expiring 31 Mar 2027, to the risk committee. It counts in the run only once approved." | Risk committee (outside the dialog) | Overlay added with state "With the risk committee"; not counted | **New** `POST /api/v1/ecl/overlays` |
| Approve an overlay | Risk committee | — | — | Risk committee | State approved; counts in the run until it expires | **New** `POST /api/v1/ecl/overlays/{id}/approve` |
| Explain a difference (`recExplain`) | Finance | — | "Records the difference as a timing difference with your explanation, kept for the auditors. If it has not cleared after month end it reopens." | None | Break explained | **New** `POST /api/v1/reconciliations/{runId}/breaks/{key}/explanation` |
| Fix a data set rule (button) | Finance | — | — (toast "Source record corrected; the rule passes.") | None in the prototype (see open question 7) | Source record corrected (restructuring code TDR-02 on LN-A-C11; LN-A-C14 moved to the write-off schedule) | **New** per source: `POST /api/v1/loans/{id}/regulatory-codes` |
| Generate the file (`rptGenerate`) | Finance or ops | Any rule failing: "Validation errors remain" | "Builds the file from today's ledger and locks it. A second person approves and submits it." | Maker step | File generated, locked, preparer recorded | **New** `POST /api/v1/regulatory-reports/{id}/generate` |
| Approve and submit (`rptSubmit`) | Anyone but the preparer | Not generated: "Generate the file first."; same person: "You generated the file, so someone else must approve it. Preview as another role." | "Submits the locked file. The BOT's acknowledgement is kept with the file and the validation log." | Maker-checker | Submitted; acknowledgement DMS-26-10-004127; close step `bot` Done | **New** `POST /api/v1/regulatory-reports/{id}/submit` |
| Mark suspense cleared (close) | Payments ops | Until the ITMX exception is resolved | — | None | Step `suspense` Done | **New** `POST /api/v1/close/{period}/steps/{key}/complete` |
| CFO sign-off (`closeSignoff`) | CFO | Until every other step is Done or automatic | "Closes October. Postings dated October are locked; any later correction is a dated adjustment in November with its reason." | CFO only (open question 6) | Period closed; October postings locked | **New** `POST /api/v1/close/{period}/sign-off` |
| Open a journal | Finance, ops | — | Balanced lines and the source record | None | — | `GET /api/v1/ledger/batches?account=&limit=` exists (role `ops`); **New** `GET /api/v1/gl/{code}` for the account view |
| Resolve an exception (`resolveExc`) | The owner's team | — | "Closes “<title>” for <owner>. If the same check fails again, a new exception opens and links to this one." | None | Exception resolved; ITMX resolution unblocks close step `suspense` | **New** `POST /api/v1/exceptions/{id}/resolve` |
| Rerun a dead letter (via Open) | Operations | — | — | — | — | `POST /api/v1/admin/scheduler/backfill` exists |
| Approve a product draft (`approveProduct`) | Compliance, the last checker | — | "Approves AUTO_HP_USED v2. It is the last approval, so the product goes live for dealers on 1 Nov 2026. Version 1 stays for the contracts already open." | Maker-checker by role: Risk then Compliance | Draft approved by every required role; published with effect 1 Nov 2026 | `POST /api/v1/products/drafts/{id}/approve` (body `role`) exists; `POST /api/v1/products/drafts/{id}/publish` exists but takes no effective date: **New** `effectiveFrom` |
| Request changes (`requestChanges`) | Any approver | — | "Sends AUTO_HP_USED v2 back to Krit S. with your note. Risk's approval is cleared and must be given again after the change." | None | Draft back to DRAFT; approvals cleared | **New** `POST /api/v1/products/drafts/{id}/return` (an edit already resets to DRAFT via `POST /drafts/{id}/yaml`) |
| Check a draft | Maker, approvers | — | Issues, scenarios, golden hash | None | — | `GET /api/v1/products/drafts/{id}/check` exists |
| Create or edit a draft | Product maker | — | — | — | — | `POST /api/v1/products/drafts`, `POST /api/v1/products/drafts/{id}/yaml` exist |
| Submit a draft | Product maker | Check fails | — | — | IN_REVIEW | `POST /api/v1/products/drafts/{id}/submit` exists |
| Retire a version | Product publisher | — | — | — | Retired | `POST /api/v1/products/{product}/versions/{version}/retire` exists |
| Disclosure | Anyone | — | Quoted and effective rates, fees, totals | — | — | `GET /api/v1/products/{product}/versions/{version}/disclosure` exists |

## 5. States

**ECL run.**

| State | Entered when | Next |
|---|---|---|
| Draft | The run is computed (daily, and at 31 Oct 23:59) | Posted; recomputed when loans or weights change |
| Posted | Posted within the poster's `journal` authority | Superseded by next month's run |

**Overlay.** Proposed ("With the risk committee") → Approved → Expired on its expiry date (no longer counted). Rejected is not modelled.

**Reconciliation break.** Open → Matched (source fixed, e.g. exception resolved or run posted) or Explained (timing difference) → Reopened if an explained break has not cleared after month end.

**Regulatory report.** Validation errors → Validated → Generated, waiting for checker (locked) → Submitted (acknowledged).

**Close step.** Waiting → Ready → Done; or Blocked (with the blocking item) → Ready; or Runs by itself. **Period.** Open → Closed at CFO sign-off.

**Exception.** Open (age counting against its deadline; "Overdue by" once past) → Resolved (fixed, matched or accepted with a reason); a repeat failure opens a new exception linked to the old one.

**Product draft.** Core statuses DRAFT → IN_REVIEW (submitted; approvals collected per role) → PUBLISHED; any edit returns it to DRAFT and clears approvals. The prototype's "goes live 1 Nov 2026" is a published version with a future effective date.

## 6. Postings

| Event | Debit | Credit | Amount (prototype) |
|---|---|---|---|
| Allowance top-up (ECL-2026-10) | 5300 Expected credit loss expense | 1390 Loss allowance on loans | ฿9,548,691.75 (board weights, default state) |
| Allowance release | 1390 Loss allowance on loans | 5300 Expected credit loss expense | the absolute negative top-up |
| September allowance (JE-2026-10-01-000417, from ECL-RUN-09) | 5300 | 1390 | ฿18,611,200.00 |
| Loan payment received (JE-2026-10-24-883104, LN-A-C13) | 2100 Savings deposits | 1310 Instalments receivable | ฿10,450.00 |
| Disbursement (JE-2026-10-24-882911, MS-4) | 1300 Loans receivable | 2100 Current accounts · dealer | ฿45,279.48 |
| Instalment billed (LN-A-C10) | 1310 Instalments receivable | 1300 Loans receivable (principal); 4100 Interest income (interest) | the schedule's instalment |
| Modification loss (JE-2026-09-30-771020, TL-2024-000311) | 5310 Modification loss | 1300 Loans receivable | ฿18,412.20 |
| Write-off (allowance used) | 1390 Loss allowance on loans | 1300 Loans receivable | ฿140,000.00 for LN-A-C14 (not a new expense) |

The core books the allowance per loan in one contra-asset account per loan and posts only the change since the last run (`EclService.book`); the GL view aggregates to 1390 through `accounting` GL mapping.

## 7. Configurable values

| Key | Prototype value | Set by | Rule (to confirm) |
|---|---|---|---|
| `ecl.scenarios.board` | Base 60% × 1.00; Upside 10% × 0.85; Downside 30% × 1.45 (weighted multiplier 1.120) | Board, each quarter | TFRS 9 forward-looking information |
| `ecl.scenarios.severe` | Base 50% × 1.00; Upside 5% × 0.85; Downside 45% × 1.45 (1.195) | Risk, for sensitivity only; never postable | — |
| `ecl.pd`, `ecl.lgd` | Bank-supplied tables v2026-09; the prototype uses test values per loan (e.g. FAC-B2031 1.8% / 7.5% after breach, LGD 30%) | Bank (risk models) | Core today: one `fabor.ecl.annual-pd` and `fabor.ecl.lgd` |
| `ecl.staging.stage2` | More than 30 days past due; financial covenant breached; internal grade down 2 notches since origination; watchlist, or restructured while performing | Bank, within TFRS 9 | TFRS 9 significant increase in credit risk; BOT guideline |
| `ecl.staging.stage3` | More than 90 days past due; legal action, or the borrower unlikely to pay | Regulator, locked (90 days) | TFRS 9 credit-impaired; BOT classification |
| `ecl.cure` | Restructured loans stay until paid on time for 3 consecutive months or 3 instalments, whichever is longer | Regulator, locked | BOT restructuring guideline |
| `ecl.overlay.expiryDefault` | 31 Mar 2027 | Risk committee | Internal overlay policy |
| `recon.schedule` | Daily 06:00 and on every posting | Bank | — |
| `recon.explainedReopen` | Reopens if not cleared after month end | Bank | Internal control |
| `ds.loan.rules` | GL 1300 agrees; GL 1390 agrees; stage agrees with days past due; restructured contracts carry the restructuring code; written-off contracts on the write-off schedule; customer IDs valid; collateral valued within 3 years (warning only) | Regulator (BOT specification) plus bank cross-checks | BOT DS_LOAN data set specification |
| `ds.loan.due` | 15th of the following month | Regulator, locked | BOT reporting calendar |
| `ds.loan.checksum` | SHA-256 | Bank | — |
| `close.steps` | the nine steps in §2.4 with owners and due dates | Finance | Internal close policy |
| `close.lockOnSignoff` | Postings dated in the period are locked; corrections are dated adjustments in the next period with a reason | Bank (finance) | Accounting policy |
| `exception.deadlines` | per kind, in minutes (e.g. reconciliation break 480; nostro break 1,440; integration 240) | Bank (operations) | — |
| `integration.dopa.errorThreshold` | 0.5% | Bank | — |
| `limit.warnLevel` | 90% of group limit | Bank (credit risk) | — |
| `product.hp.rateCap.new` / `.used` / `.motorcycle` | 10.00% / 15.00% / 23.00% effective a year | Regulator, locked (rule pack TH-HP-VEHICLE-v1) | OCPB notification 2022 |
| `product.hp.rebate` | 60% / 70% / 100% of unearned interest by third of term | Regulator, locked | OCPB notification 2022 |
| `product.approvals` | Risk, then Compliance (last checker) | Bank | Product governance |
| Action limit `journal` | ops ฿1,000,000; finance ฿50,000,000; else Finance controller | Bank | Authority matrix |

## 8. Acceptance criteria

| # | Given | When | Then |
|---|---|---|---|
| F1 | ECL-2026-10 with default data and board weights | the page opens | exposure ฿31.84bn, required ฿1,411.12m, held ฿1,401.57m, top-up ฿9.55m, stage 3 share 2.13%, coverage 72.1% |
| F2 | the Summary tab | weights set to Severe | pill "Severe weights: for review only"; weighted multiplier 1.195×; required ฿1,472.31m; Post the allowance disabled |
| F3 | severe weights | the post dialog's Next is pressed | error "Only the board-approved weights can be posted." |
| F4 | board weights, the finance controller | posts | review shows held, required and "Top-up to post" ฿9,548,691.75 with debit 5300 / credit 1390; done "Loss allowance posted for October."; pill Posted; the close step `ecl` is Done; the GL 1390 break clears |
| F5 | board weights, the operations checker (limit ฿1m) | posts | the confirm reads "Send to Finance controller"; nothing is posted |
| F6 | the Overlays tab | a finance user proposes ฿2,500,000 "Rubber price fall, southern provinces" with evidence | "Sent to the risk committee."; a new overlay OVL-09 "With the risk committee"; required allowance unchanged |
| F7 | the overlay dialog | amount empty or reason or evidence missing | "Enter an amount." / "Give the reason and the evidence." |
| F8 | Malee's loan LN-A-C11 restructured and Kittipong's LN-A-C14 written off elsewhere | the Loans and Staging tabs open | LN-A-C11 is Stage 2 "Restructured 24 Oct; stays Stage 2 until 3 months paid"; LN-A-C14 is not listed and the write-off notice shows; movement shows write-offs −฿140,000 |
| F9 | REC-2026-10 | the accrual break is explained | "Explained."; breaks open falls by one |
| F10 | the ITMX exception resolved, the run posted and the accrual explained | REC-2026-10 opens | "All matched or explained"; close step `recon` Done |
| F11 | DS-LOAN-2026-10 before the run is posted | the page opens | "GL 1390 does not yet include October's ECL run; post it first" with **Open**; Generate disabled |
| F12 | LN-A-C11 restructured | Validation opens | "LN-A-C11 was restructured on 24 Oct but has no restructuring code"; **Fix the data** makes it pass and shows TDR-02 in Contracts |
| F13 | all rules pass | a user generates the file and then tries to submit it | submit is refused: "You generated the file, so someone else must approve it. Preview as another role." |
| F14 | the file generated by another user | submit | "Submitted. Acknowledged as DMS-26-10-004127."; close step `bot` Done |
| F15 | every step but sign-off Done or automatic | the CFO signs off | "October is closed."; postings dated October are locked |
| F16 | the close checklist with the ITMX exception open | the page opens | `suspense` is Blocked "ITMX break ฿4,200.00" with an **Exception centre** button; after resolving it, **Mark done** |
| F17 | the exception centre | an item is resolved with a note | "Resolved and recorded."; it leaves the queue; Resolved today increases |
| F18 | the resolve dialog | the note is empty | "Say what was done." |
| F19 | GL-1300 Journals | a journal row is opened | the drawer lists lines whose debits equal credits and "Balanced: debits equal credits"; **Source** opens the loan when it is a record |
| F20 | AUTO_HP_USED v2 in review with Risk's approval | Compliance approves | "Approved. AUTO_HP_USED v2 is scheduled to go live on 1 Nov 2026." |
| F21 | the same draft | an approver requests changes with an empty note | "Say what should change."; with a note, "Sent back to Krit S." and Risk's approval is cleared |
| F22 | Thai language | each page and tab opens | no untranslated label; dates in Buddhist years |

## 9. Gaps against the core

What exists: `POST /api/v1/ecl/run` and `GET /api/v1/ecl/loans/{loanId}` (lending `EclRun`, `EclService`, role `ecl-operator`); `GET /api/v1/ledger/batches` (StaffViewController, role `ops`); the product draft lifecycle (`/api/v1/products/drafts…`, catalog `MasterBuilder`, `ReviewReport` with issues and scenarios); `POST /api/v1/admin/scheduler/backfill`; and an `accounting` `Reconciliation.run` with GL mapping but no endpoint.

| Method | Path | Purpose | Owning module |
|---|---|---|---|
| POST | `/api/v1/ecl/runs` | Compute a draft run for a period with chosen scenario weights, without booking | lending (ECL) |
| GET | `/api/v1/ecl/runs/{id}` | Draft run: stage totals, named loans, overlays, top-up, movement | lending (ECL) |
| POST | `/api/v1/ecl/runs/{id}/post` | Post the run's change under the `journal` authority (5300 / 1390) | lending (ECL) + ledger |
| POST | `/api/v1/ecl/overlays` | Propose an overlay with reason, evidence and expiry | lending (ECL) |
| POST | `/api/v1/ecl/overlays/{id}/approve` | Risk committee approval | lending (ECL) |
| GET | `/api/v1/ecl/scenarios` | Board-approved and sensitivity weight sets | lending (ECL) |
| GET | `/api/v1/reconciliations/{runId}` | Ledgers, breaks and differences from `Reconciliation.run` | accounting |
| POST | `/api/v1/reconciliations/{runId}/breaks/{key}/explanation` | Record a timing-difference explanation | accounting |
| GET | `/api/v1/regulatory-reports/{id}` | Data set rules, contracts, submission log | new `reporting` module |
| POST | `/api/v1/regulatory-reports/{id}/generate` | Build and lock the file with a checksum (maker) | reporting |
| POST | `/api/v1/regulatory-reports/{id}/submit` | Approve and submit (checker ≠ maker); store the acknowledgement | reporting |
| POST | `/api/v1/loans/{id}/regulatory-codes` | Set the restructuring code or move to the write-off schedule at the source | lending |
| GET | `/api/v1/close/{period}` | Checklist with derived step states | accounting |
| POST | `/api/v1/close/{period}/steps/{key}/complete` | Mark a manual step done | accounting |
| POST | `/api/v1/close/{period}/sign-off` | CFO sign-off; lock the period's postings | accounting + ledger |
| GET | `/api/v1/gl/{code}` | Balance, today's postings, by-product split, sub-ledger comparison | accounting |
| POST | `/api/v1/journals`, `/api/v1/journals/{id}/approve` | Manual journals under maker-checker (shared with spec 10) | accounting / ledger |
| GET | `/api/v1/exceptions` | The queue, filtered by the tenant's systems | new `operations` module (platform) |
| POST | `/api/v1/exceptions/{id}/resolve` | Resolve with how and note; link repeats | operations |
| POST | `/api/v1/products/drafts/{id}/return` | Send a draft back with a note; clear approvals | catalog |
| POST | `/api/v1/products/drafts/{id}/publish` (extend) | Accept `effectiveFrom` so the last approval schedules go-live | catalog |
| GET | `/api/v1/products/templates/{id}` | Template blocks, parameters, rule pack, products | catalog |

## 10. Open questions

1. The core's ECL run books at once with one PD and one LGD. Agree the draft-then-post split, per-segment PD/LGD tables and scenario weights before building the console screen.
2. Overlays: who records the risk committee's approval in the console, and what happens on expiry mid-month?
3. The prototype's movement table derives "model and parameter changes" as the balancing figure; confirm the bank's movement categories for the financial statement note.
4. Gross NPL ratio: the prototype uses Stage 3 ÷ total exposure; confirm the BOT NPL definition (classification, not stage).
5. Which other BOT data sets are in the first release (the reports list also shows the LCR submission and the AMLO cash transaction report)?
6. Sign-off: only the CFO signs off the close; decide whether a delegate may sign when the CFO is away.
7. "Fix the data" corrects a source record with no maker-checker in the prototype; should regulatory-code changes need a second person?
8. Product go-live: the prototype treats Compliance's approval as scheduling publication; the core separates approve (by role) and publish (`product-publisher`). Keep both, or publish automatically on the last approval?
9. Exception deadlines are per item in the prototype; confirm a deadline per kind and who is paged when one is overdue.

## Appendix A. Calculations

### A.1 ECL by stage

For each named loan: stage `s`, exposure `EAD`, base `PD`, `LGD`, and the weighted scenario multiplier `M = Σ weight × multiplier` (board 1.120, severe 1.195).

```
PD_eff = 1                     if s = 3
       = min(1, PD × M)        otherwise
ECL    = EAD × PD_eff × LGD
```

The rest of the book is held as stage totals (EAD, allowance): Stage 1 ฿29,104,000,000 / ฿581,900,000; Stage 2 ฿1,982,000,000 / ฿331,400,000; Stage 3 ฿676,500,000 / ฿487,900,000. Stages 1 and 2 are scaled by `M / M_board`; Stage 3 is not.

```
stage_al(s) = base_al(s) × (s < 3 ? M / M_board : 1) + Σ ECL of named loans in s
stage_ead(s) = base_ead(s) + Σ EAD of named loans in s
model     = Σ stage_al
overlays  = Σ approved overlay amounts (not expired)
required  = model + overlays
held      = posted amount, or ฿1,401,568,800.00 before October is posted
top-up    = required − held           (negative = release)
```

Default state (board weights):

| Item | Value |
|---|---|
| Stage 1 | ฿29,179,415,243.96 / ฿582,345,148.85 |
| Stage 2 | ฿1,982,095,937.64 / ฿331,413,538.72 |
| Stage 3 | ฿676,702,004.18 / ฿488,058,804.18 |
| Model | ฿1,401,817,491.75 |
| Overlays (OVL-07 ฿6,200,000; OVL-08 ฿3,100,000) | ฿9,300,000.00 |
| Required | ฿1,411,117,491.75 |
| Top-up | ฿9,548,691.75 |
| Severe weights: required / top-up | ฿1,472,306,689.58 / ฿70,737,889.58 |

Named loans, default state:

| Loan | Stage | EAD | PD_eff | LGD | ECL |
|---|---|---|---|---|---|
| LN-A-C10 | 3 | ฿62,004.18 | 100% | 30.3% (EAD less 90% of collateral value) | ฿18,804.18 |
| LN-A-C11 | 2 | ฿95,937.64 | 20.16% | 70% | ฿13,538.72 |
| LN-A-C14 | 3 | ฿140,000.00 | 100% | 100% | ฿140,000.00 |
| FAC-B2031 | 1 | ฿72,500,000.00 | 2.016% | 30% | ฿438,480.00 |
| LN-77120 | 1 | ฿2,790,243.96 | 1.008% | 15% | ฿4,218.85 |
| LN-A-C13 | 1 | ฿125,000.00 | 2.80% | 70% | ฿2,450.00 |

Stage changes driven by other screens: FAC-B2031 moves to Stage 2 (PD 7.5%) when its Q3 covenant test breaches; LN-A-C11's PD falls from 18% to 14% once restructured; LN-A-C14 leaves the run when written off; new loans paid out this month (DSB-30409, APP-30416) join Stage 1.

### A.2 Movement in the allowance

```
opening    = ฿1,401,568,800.00
new loans  = ฿6,100,000 + Σ ECL of loans paid out this month
repayments = −฿4,300,000
transfers  = ฿3,200,000 + (FAC-B2031 breached ? its Stage 2 ECL − its Stage 1 ECL : 0)
write-offs = −฿140,000 if LN-A-C14 is written off
weights    = (base Stage 1 + Stage 2 allowance) × (M / M_board − 1)
overlays   = approved overlays
other      = required − opening − (all the lines above)       (model and parameter changes)
closing    = required
```

### A.3 Reconciliation

For each GL code in the reconciliation set: difference = GL balance − sub-ledger balance (from `accounting` `Reconciliation.run`: ledger net against the GL projection). A difference is a break until it is matched at the source or explained; an explained break reopens if it has not cleared after month end.

### A.4 Data set ratios

Gross NPL ratio (prototype) = exposure classified substandard or worse ÷ total exposure × 100; in the sample book this equals Stage 3 exposure = 676,702,004.18 ÷ 31,838,213,185.78 = 2.13%. Stage 3 coverage = Stage 3 allowance ÷ Stage 3 exposure = 72.1%.

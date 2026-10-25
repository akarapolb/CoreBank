# 03 · Business banking

Commercial credit, the relationship view of a business customer, monitoring and early warning on the commercial book, and commercial credit facilities with covenants. Prototype sources: `js/commercial.js` (APP-30414), `js/corporate.js` (B-0414, Lending → Monitoring, EW-B3107), `js/lending.js` (FAC-B2031), `js/underwriting.js` (the committee items CC-2026-21 decides for this area). Conventions, template and the authority matrix: [README](README.md), [00-cross-cutting](00-cross-cutting.md), [prototype-inventory](prototype-inventory.md).

## 1. Scope and users

**In scope.** A commercial credit application from request to committee to drawdowns against construction progress; spreading of audited accounts with analyst adjustments; a cash-flow projection with stress; security and cover; an internal rating that sets pricing and RAROC; the term sheet and a generated credit memo; the relationship view of a business customer (limits under a group limit, connected parties, obligations calendar, profitability, call reports, temporary limit increases); covenant and early-warning monitoring across the commercial book; an early-warning case ending in a watchlist decision that moves the TFRS 9 stage; a credit facility umbrella with lines, drawdowns on promissory notes, covenant tests, a waiver request and an annual review.

**Out of scope here.** Retail applications and the credit committee mechanics in general ([02-retail-lending](02-retail-lending.md)); trade lines and guarantees ([04](04-trade-and-syndication.md)); the loss-allowance run itself ([11](11-finance-and-control.md)); the fleet master agreement MA-1 ([06](06-leasing-and-auto-finance.md)).

| Role (prototype id) | Person in the prototype | What they do here |
|---|---|---|
| Relationship manager (`ops` stands in; RM named on the record) | Pakorn T. (Korat Isuzu), Wanida K. (Siam Freight), Siriporn N. (Chiang Mai Cold Chain) | Builds the application, logs call reports, asks for temporary increases, owns the action plan |
| Credit officer (`credit`) | Wanida Kaewmanee | Spreads, rates, recommends, decides early warnings, approves temporary increases up to its limit |
| Head of retail credit | Supaporn L. (second approver) | Approves above the credit officer; agrees an override of the early-warning score |
| Credit committee | CC-2026-21 members | Decides credit above ฿10m, covenant waivers and annual reviews |
| Operations checker (`ops`) | Ploy Chaiyaporn | Pays drawdowns within the `drawdown` authority |

## 2. Screens

| Route | Record id pattern | Purpose |
|---|---|---|
| Lending → Credit review (list) | `APP-nnnnn` | Applications waiting for credit; APP-30414 opens the commercial application |
| Lending → Facilities (list) | `FAC-xnnnn` | Facility umbrellas; FAC-K0414 shows "Credit committee" until APP-30414 is approved |
| Lending → Monitoring (page) | — | Covenants due and early-warning scores across borrowers |
| Customers → Directory (list) | `B-nnnn` | Business customers; B-0414 opens the relationship view |
| Record `APP-30414` | commercial credit application | Eight tabs below |
| Record `B-0414` | business customer | Five tabs below |
| Record `EW-B3107` | early-warning case | Four tabs below |
| Record `FAC-B2031` | credit facilities | Five tabs below |

### APP-30414 · Commercial credit application

Lede: "Korat Isuzu Co., Ltd. · SME term loan for a second showroom and service centre · RM Pakorn T." Pills: state (Analysis / On the committee's agenda / Approved by CC-2026-21) and "Stressed DSCR x.xx×" toned good ≥ 1.25, warn ≥ 1.0, crit below. Actions: *Credit memo* (jumps to the tab), *Send to committee* (disabled once sent or approved).

| Fact | Value (sample) | Source |
|---|---|---|
| Amount | ฿12,000,000 · 7 years, 12 months' grace | request |
| Rating | 5 / 10 · PD 0.80% | §4 rating calculation |
| Rate | 6.60% · MLR − 0.50% | MLR config + grade margin |
| Min DSCR, base | 1.63× | projection, no stress |
| Cover | 140% · with TCG 50% | security calculation |
| RAROC | 18.2% · hurdle 15% (warn below) | RAROC calculation |

| Tab | What it shows | Data needed |
|---|---|---|
| Request | Borrower (company, business, owners, relationship since 2021, KYC refresh ONB-7690 open as a condition) and request (purpose, ฿18.0m total cost, ฿12.0m loan 67% / ฿6.0m equity already in land, facility shape, four tranches against certificates, why now) | customer record, application |
| Financials | Spread FY2023–FY2025 (฿m): revenue, gross profit, adjusted EBITDA, adjusted net profit, total assets, debt incl. floor plan, equity; ratios; two adjustment checkboxes | audited statements, analyst adjustments |
| Repayment capacity | 2027–2033 table: year, cash for debt service, debt service, DSCR base, cash stressed, DSCR stressed (coloured); stress sliders; policy result | projection engine |
| Security | Collateral table (value, advance rate, lending value, basis) + TCG + personal guarantee; cover card; construction-risk checklist | collateral register, appraisal |
| Rating and pricing | Financial factors (60%) with scores; five qualitative selects (40%); result; pricing and return | rating model, pricing config |
| Term sheet | Facility, rate, fees, tenor, prepayment; covenants; conditions before first drawdown; undertakings | term-sheet template + calculated rate |
| Credit memo | Five paragraphs generated from the other tabs (Recommendation, Business, Capacity, Risks, Rating and return), tagged Copilot; committee notice | generated text, RM signs |
| Drawdowns | Locked until committee approval ("Opens once the committee approves"); then four tranches with *Draw* on the next one | tranche plan, drawdown history |

### B-0414 · Business customer (relationship view)

Lede: "Business customer · party B-0414 · RM Pakorn T., Nakhon Ratchasima business centre · grade 5 · since 2021". Pills: "KYC refresh overdue" (crit) when any calendar item is overdue, else "Nothing overdue"; term-loan state. Actions: *Temporary increase* (disabled once requested), *Call report*.

| Fact | Rule |
|---|---|
| Group limit | sum of line limits; warn and sub "temporary, base ฿40,000,000" when above the base group limit |
| In use | sum of line usage; % of group limit |
| Deposits | ฿8,340,000 (CUR-K0414 ฿6,240,000 + SAV-K0414 ฿2,100,000) |
| Connected exposure | in use + connected parties' loans (฿3.2m Wongpanich Land LN-B4471, ฿4.1m Mr Somkid LN-77302) |
| Revenue a year | sum of profitability rows |
| Relationship RAROC | warn below the 15% hurdle |

| Tab | Content |
|---|---|
| Limits and accounts | Lines table (line, limit, in use, use bar warn > 85%, remarks); accounts card; opportunities card |
| Calendar | Obligations: due date, what (links where a record exists), kind, state (overdue N days crit; ≤ 30 days warn; else Scheduled) |
| Profitability | Revenue rows and total; return card (revenue, cost to serve, expected loss, capital, RAROC after 20% tax) |
| Call reports | Timeline: date, summary, kind · RM · next step |
| People and group | Directors, signing rule, shareholders; connected-parties table |

Lines (sample): FP-K0414 floor plan ฿20m (฿26m while a temporary increase is approved), used ฿5.6m; APP-30414 term loan ฿12m, used = sum of drawn tranches once approved; BG-K0414 guarantee to Tri Petch Isuzu Sales ฿5m, used ฿5m; OD-K0414 overdraft ฿3m, used ฿0.4m.

### Lending → Monitoring (page)

Facts: commercial borrowers 214; on the watchlist 7 (+1 once EW-B3107 is put on it); covenants breached 1 (+1 when FAC-B2031 breaches); tests due in 30 days 19; reviews overdue 3. Table *Early-warning signals* (borrower, name, score, band, decision) and table *Covenants* (facility, borrower, covenant, tested, latest, state). Both read live state from FAC-B2031, EW-B3107 and APP-30414.

### EW-B3107 · Early-warning case

Lede: "Chiang Mai Cold Chain Co., Ltd. · cold storage and transport · OD ฿8m and a term loan of ฿14m · RM Siriporn N." Pills: band; classification (Pass · Stage 1 · not past due → Monitor · Stage 1 or Watchlist · Stage 2). Actions: *Hold unused overdraft*, *Decide*.

| Fact | Value |
|---|---|
| Signal score | live score; "60 or more: watchlist" |
| Exposure | ฿22,000,000 |
| Days past due | 0 |
| Loss allowance | ฿132,000 (12 months) → ฿792,000 (lifetime) on Stage 2 |
| Collateral | ฿26,500,000 · cold store, appraised 2024 |

| Tab | Content |
|---|---|
| Signals | Seven signals with points and source; an "Explained" checkbox per signal removes its points (reason kept); score line |
| Account conduct | Six months: peak use, average use, credits, returned cheques, use bar (crit > 95%, warn > 85% of ฿8m) |
| Action plan | Five actions with owner and date, each with a Done checkbox |
| Decision | Options table (Monitor ฿132,000 · Watchlist ฿792,000 · Stage 3 not available without default) and the outcome notice |

### FAC-B2031 · Credit facilities (Siam Freight Logistics)

Pills: Draw stop / Active; covenant state; "Annual review in N days". Actions: *Start annual review*, *Draw down*. Facts: umbrella ฿120,000,000; in use (sum of lines); available (crit "draw stop on RC and OD" while stopped); DSCR (Q2 1.22x until tested, then Q3); collateral cover (lending value ÷ in use); next review 30 Nov 2026.

| Line | Kind | Limit | In use | Pricing | Tenor | System |
|---|---|---|---|---|---|---|
| TL-2024-000311 | Term loan | ฿60,000,000 | ฿38,400,000 | MLR − 1.00% = 6.10% | Amortising to Sep 2029 | lending |
| RC-B2031 | Revolving credit, promissory notes | ฿30,000,000 | ฿18,000,000 | MOR − 0.50% = 6.80% | 1 to 6 months per note | lending |
| OD-B2031 | Overdraft on CUR-B2031 | ฿10,000,000 | ฿0 | MOR = 7.30% | On demand | lending |
| BG-LINE | Bank guarantees | ฿15,000,000 | ฿12,000,000 | Fee 1.50% a year | BG-26-1102 to the Port Authority | trade |
| FX-B2031 | FX settlement line | ฿10,000,000 | ฿4,100,000 | Pre-settlement risk | Forwards to Mar 2027 | treasury |

Tabs: Limits (umbrella bar, line bars, terms; note that MA-1 ฿61.4m in Leasing cross-defaults), Drawdowns (notes PN-26-0815 ฿8m, PN-26-1003 ฿10m; conditions precedent with "No event of default continuing" failing while stopped), Covenants, Collateral, Annual review (checklist and Copilot's draft).

## 3. Fields

Every action dialog follows the enter → review → done pattern in [00-cross-cutting](00-cross-cutting.md).

| Dialog | Field | Label (EN / TH) | Type | Required | Source | Validation |
|---|---|---|---|---|---|---|
| comSubmit | — | (read-only: meeting CC-2026-21 · 18 Nov 2026; papers) | — | — | — | blocked if outside policy (§4) |
| comDraw | `ccert` | Bank engineer's progress certificate received / ได้รับใบรับรองความคืบหน้าจากวิศวกรธนาคาร | checkbox | Yes | staff | "A tranche cannot be drawn without the engineer's certificate." |
| Financials tab | `oneoff`, `salary` | Remove the one-off gain… / Normalise the managing director's pay… | checkbox | — | analyst | changes every ratio and the projection live |
| Repayment capacity | `rev` 0–30 step 1 (%), `margin` 0–4 step 0.5 (pt), `rate` 0–4 step 0.5 (pt) | Revenue lower by / Gross margin lower by / Interest rates higher by | slider | — | analyst | default 5 / 0.5 / 1 |
| Rating tab | `mgmt`, `industry`, `position`, `franchise`, `succession` | Management and track record; Industry outlook (commercial trucks); Market position in the territory; Dependence on one brand's franchise; Succession and governance | choice 1–5 (Weak … Strong) | Yes | analyst | defaults 4, 3, 4, 2, 3 |
| kiCall | `kck` | Contact / ช่องทาง | choice: call, visit, meeting | Yes | staff | — |
| kiCall | `kcw` | What was discussed / เรื่องที่หารือ | text | Yes | staff | "Write what was discussed." |
| kiCall | `kcn` | Next step / ขั้นต่อไป | text | No | staff | becomes an RM task |
| kiExcess | — | (read-only: ฿20,000,000 → ฿26,000,000 until 31 Jan 2027; reason) | — | — | — | — |
| ewClassify | `ewc` | Decision / การตัดสินใจ | choice: watch (Watchlist, Stage 2), monitor (Monitor, stays Stage 1); default watch when score ≥ 60 | Yes | officer | — |
| ewClassify | `eww` | Reason / เหตุผล | text | Yes | officer | "Give the reason; it goes to credit risk and the auditors." |
| ewFreeze | — | (read-only: limit ฿8m, in use ฿7.9m, held ฿0.1m) | — | — | — | — |
| facDraw | `dline` | Line | choice RC-B2031, OD-B2031 with available amount | Yes | staff | — |
| facDraw | `damt` | Amount | money | Yes | staff | "Enter an amount in baht." |
| facDraw | `dten` | Tenor, for a note | choice 1, 3, 6 months | Yes (RC) | staff | — |
| covTest | `qe`, `qs`, `qn`, `qa`, `ql` | EBITDA; Debt service: interest and principal; Net debt; Current assets; Current liabilities | money | Yes | management accounts (prefilled 41.2m, 36.1m, 128.4m, 62.0m, 54.9m) | "Enter every figure in baht." |
| covWaiver | `wkind` | What to ask for | radio: once (Waive Q3 2026 only, fee 0.05% = ฿60,000), reset (DSCR 1.10x for Q3–Q4 2026, margin +0.25%) | Yes | RM | — |
| facReview | — | (read-only: renew ฿120m 12 months; committee 18 Nov; pack) | — | — | — | blocked while the Q3 test is due |

## 4. Actions

| Action (flow) | Who | Refused or blocked when (message) | Review shows | Approval | Effect | Core call |
|---|---|---|---|---|---|---|
| Spread adjustments (tab) | credit | — | — | none (analyst's working) | Ratios and projection recalculate; adjustment kept with analyst name in History | **New** `PUT /api/v1/credit-applications/{id}/spread` (credit-analysis) |
| Stress settings (tab) | credit | — | — | none | Projection recalculates; the settings travel with the paper | **New** same resource, `stress` block |
| Qualitative factors (tab) | credit | — | — | none; a one-notch override needs a reason and is reported to credit risk | Grade, PD, margin, rate, RAROC recalculate | **New** `PUT /api/v1/credit-applications/{id}/rating` |
| Send to committee (`comSubmit`) | credit / RM | Base min DSCR < 1.25 or stressed min < 1.0: "Outside policy … Restructure the request or write it up as an exception." | Lock note | committee routing by amount: ฿12m > ฿10m (head of retail credit) → credit committee | Locks the analysis; adds item 1 to CC-2026-21 (already there in the prototype) | **New** `POST /api/v1/credit-applications/{id}/submission` (credit workflow). The existing `POST /api/v1/loans/applications` is automatic decisioning for retail and does not fit a manual commercial paper |
| Committee vote (`ccVote` item 1) | committee secretary | No quorum (fewer than 3 voters or chair absent); member Arunee T. excluded for conflict | For / against / abstained / result; chair's casting vote on a tie | committee vote | Item state Approved; APP-30414 pill "Approved by CC-2026-21"; Drawdowns tab opens; FAC-K0414 to be created | **New** `POST /api/v1/committees/{id}/items/{itemId}/resolution` |
| Draw a tranche (`comDraw`) | ops | Certificate unticked: "A tranche cannot be drawn without the engineer's certificate."; only the next tranche can be drawn | This tranche, drawn after, undrawn left; first tranche confirms mortgage, TCG certificate and KYC refresh | `drawdown` (ops ฿20m, credit ฿50m → head of operations) | Pays the contractor against invoices; interest only during grace | **New** `POST /api/v1/loans/{id}/drawdowns` (lending). No disbursement endpoint exists today |
| Call report (`kiCall`) | RM | empty summary | "Saves the report … credit matters copied to the credit file." | none | Adds to timeline; next step becomes a task | **New** `POST /api/v1/customers/{id}/contacts` (customers). `POST /api/v1/collections/{loanId}/contacts` exists for collections only |
| Temporary increase (`kiExcess`) | RM, credit | already requested | Group limit now ฿40m, increase ฿6m, group limit until 31 Jan ฿46m; falls back by itself on 31 Jan; weekly stock audits above ฿20m | `limit` (credit ฿10m; others → head of retail credit) | FP-K0414 limit ฿26m until 31 Jan 2027 when approved; "pending" otherwise | **New** `POST /api/v1/limits/{lineId}/temporary-increase` (limits); floor plan line itself: `GET /api/v1/floorplans/{id}/exposure` exists for reading |
| Explain a signal (tab) | credit / RM | — | — | none | Signal stops counting; reason kept | **New** `POST /api/v1/early-warnings/{id}/signals/{signalId}/explanation` (credit-monitoring) |
| Mark an action done (tab) | owner | — | — | none | Counts toward the plan | **New** `PATCH /api/v1/early-warnings/{id}/actions/{actionId}` |
| Decide (`ewClassify`) | credit | empty reason | Stage 1 → 2, allowance ฿132,000 → ฿792,000, change ฿660,000; "Against the score" notice when choosing Monitor at score ≥ 60 | Watch: none beyond the officer. Monitor at ≥ 60: `override` (no one holds it → head of retail credit), reported to credit risk | Watch: Stage 2 from today, monthly review, new limits only through credit; customer not told the classification. Monitor: Stage 1, review in 3 months (24 Jan 2027) | **New** `POST /api/v1/early-warnings/{id}/decision`; stage overlay feeds `POST /api/v1/ecl/run` and is readable via `GET /api/v1/ecl/loans/{loanId}` (exist) |
| Hold unused overdraft (`ewFreeze`) | credit | already held | Stops new use above ฿7,900,000 under the material-adverse-change clause with written notice; limit not cancelled | none (officer) | Hold on OD-B3107; notice sent today | **New** `POST /api/v1/limits/{lineId}/hold` |
| Draw down (`facDraw`) | ops | Draw stop: "DSCR was breached at Q3 2026 and has not been waived, so no new money can be drawn on the revolving credit or the overdraft."; amount > line available or umbrella available: "Over the limit" | Amount, matures, interest at 6.80% (actual/365), available after | `drawdown` | Credits CUR-B2031; RC creates note `PN-26-1024-n` | **New** `POST /api/v1/facilities/{id}/drawdowns` (lending). `GET /api/v1/masters/{id}/facility` exists only for fleet masters |
| Test covenants (`covTest`) | credit | any figure ≤ 0 | Table of covenants with Q3 values and Met/Breached; on breach: event of default, draw stop on RC and OD (TL and guarantees unaffected), RM and credit risk told, allowance checks Stage 2 | none | FAC.cov = met or breach | **New** `POST /api/v1/facilities/{id}/covenant-tests` |
| Ask for a waiver (`covWaiver`) | credit / RM | — | Sends with Q3 accounts and Copilot's note to the committee 18 Nov; draw stop stays | `waiver` (credit ฿50m; FAC limit ฿120m → credit committee) | Waiver "sent"; committee item 2 becomes votable; on approval draw stop lifted and new DSCR level applies from Q3 | **New** `POST /api/v1/facilities/{id}/waiver-requests` |
| Annual review (`facReview`) | RM | Q3 test due: "Test the Q3 covenants first — The committee needs the latest covenant results." | Sends the pack; facility stays on current terms | committee | Committee item 3 votable | **New** `POST /api/v1/facilities/{id}/reviews` |

### Calculations

**Spread** (per year *i*, ฿m; FIN data in the prototype):

| Item | Formula |
|---|---|
| Gross profit | revenue − COGS |
| Adjusted EBITDA | GP − opex + other income − (one-off removed? other income : 0) − (salary normalised? 1.2 : 0) |
| Current assets / liabilities | cash + AR + inventory + other CA / AP + short-term debt (floor plan) + current portion of LTD |
| Debt | short-term debt + CPLTD + LTD (floor plan counts as debt) |
| Net profit, adjusted | EBITDA − depreciation − interest − tax |
| Ratios | gross margin, EBITDA margin, current ratio CA/CL, debt to equity, debt to EBITDA, interest cover (EBITDA − dep) / interest, inventory days inv/COGS×365, receivable days AR/revenue×365 |

Expected FY2023 / FY2024 / FY2025 adjusted EBITDA with both adjustments: 13.5 / 16.1 / 16.5; FY2025 debt to equity 0.93×, current ratio 1.45×, interest cover 4.8×. Unticking the one-off: FY2024 EBITDA 18.1.

**Projection** (2027–2033, from FY2025): rate = (MLR 7.10 − grade margin + stress rate) / 100; annual new-loan instalment = pmt(rate/12, 72, 12.0) × 12. For year k = 1…7: revenue ×1.04, and ×1.10 more in year 2 (showroom opens 2028); fixed opex = (FY2025 opex + 1.2 if salary normalised) ×1.04 per year plus 2.0 in year 2. Stressed revenue r = revenue × (1 − rev%); EBITDA = r × (FY2025 gross margin − margin pt) − opex × (1 − 0.4 × rev%). Interest = existing LTD × 6% + floor-plan interest 2.0 × (1 + rate pt / 6) + new balance × rate; principal = existing min(LTD, 2.0) + new loan (0 in year 1, then instalment − interest). Tax = 20% × max(0, EBITDA − depreciation (FY2025 + 0.5 from year 2) − interest). Cash for debt service = EBITDA − tax − maintenance capex (FY2025 depreciation) − working capital 6% × max(0, r − previous r). DSCR = cash ÷ (old principal + interest + new principal). Policy: every year ≥ 1.25 base and ≥ 1.0 stressed. Expected at defaults: base min 1.63× (2028), stressed min 1.16× (2028); revenue −25%: stressed min 0.44×, "Outside policy".

**Security**: lending value = Σ value × advance rate (land ฿6.0m × 70%, new building ฿11.5m × 50%, equipment ฿2.2m × 40% = ฿10.83m) + TCG 50% of ฿12m = ฿16.83m → cover 140%. The personal guarantee is counted for commitment, not value.

**Rating**: financial factors scored 1–5 — higher is better: score = 1 + count of cuts reached (current ratio cuts 1.0/1.2/1.4/1.6; interest cover 2/3/4/6; EBITDA margin 3/4/5/7%; two-year revenue growth 0/5/10/15%); lower is better: debt to equity score = 5 − count of cuts exceeded (1.0/1.5/2.0/2.5). Financial score = Σ/25, qualitative = Σ/25, total = 0.6 × financial + 0.4 × qualitative. Grade = clamp(round(13 − 10 × total), 1, 10). PD by grade 1–10: 0.03, 0.08, 0.20, 0.40, 0.80, 1.50, 2.80, 5.00, 9.00, 18.00%. Margin below MLR by grade: 1.50, 1.25, 1.00, 0.75, 0.50, 0.25, 0, −0.50, −1.00, −1.50. Expected: grade 5, PD 0.80%, rate 6.60%; management set to 1 → grade 6, rate 6.85%.

**RAROC**: income = 12 × (rate − FTP 3.0 − cost 1.5)% + front-end fee 0.5% × 12 / 7; expected loss = 12 × PD × LGD 30%; economic capital = 12 × 8.5% (× 1.5 from grade 7); RAROC = (income − EL) × (1 − 20% tax) / capital. Expected 18.2% against the 15% hurdle.

**Relationship profitability** (฿m a year): floor-plan margin 0.169, audit fees 0.048, guarantee fee 0.075, deposits value 0.116, payroll and cash management 0.062; once APP-30414 is approved add term-loan income (RAROC income + 12 × 1.5%). Cost to serve 0.11 (+0.18), EL 0.018 (+loan EL), capital 0.82 (+loan capital). RAROC = (revenue − cost − EL) × 0.8 / capital: 33.4% before, 24.9% after.

**Early-warning score**: Σ points of unexplained signals (15, 12, 10, 8, 10, 15, 5 = 75). Bands: ≥ 60 High — watchlist recommended; 30–59 Medium — monitor closely; < 30 Low.

**Covenants** (FAC-B2031): DSCR = EBITDA ÷ debt service ≥ 1.20x; net debt ÷ EBITDA ≤ 3.50x; current ratio ≥ 1.10x. Q3 sample: 1.14x (breach), 3.12x, 1.13x.

## 5. States

| Record | State | Entered by | Next |
|---|---|---|---|
| APP-30414 | Analysis | creation | Sent to committee |
| | On the committee's agenda | comSubmit | Approved / Rejected (vote) |
| | Approved by CC-2026-21 | vote passed | Drawdowns 1→4 |
| | Fully drawn | fourth tranche | servicing as a loan |
| EW-B3107 | Pass · Stage 1 (open case) | nightly score ≥ 60 | Monitor or Watchlist |
| | Monitor · Stage 1 | decision | review 24 Jan 2027 |
| | Watchlist · Stage 2 | decision | monthly review; Stage 3 only on default |
| FAC-B2031 covenants | Due → Met / Breach | covTest | Breach → waiver sent → waived (draw stop lifted) |
| FAC-B2031 | Active / Draw stop | breach not waived | Active when waived or cured |
| FP-K0414 temporary increase | none → pending → approved | kiExcess | falls back 31 Jan 2027 |

## 6. Postings

| Event | Debit | Credit | Note |
|---|---|---|---|
| Tranche drawn (APP-30414) | Loans receivable (1300) | Contractor's account / clearing | interest-only during grace |
| Note drawn (RC-B2031) | Loans receivable (1300) | CUR-B2031 | promissory note `PN-…` |
| Watchlist, Stage 2 | ECL expense (5300) ฿660,000 | Loss allowance (1390) | posted by the ECL run, not by the decision |
| Temporary increase, overdraft hold | — | — | limit changes only; undrawn commitment memo changes |

## 7. Configurable values

| Key | Sample value | Set by | Basis |
|---|---|---|---|
| `credit.commercial.dscr.base.min` | 1.25× each year | bank | credit policy |
| `credit.commercial.dscr.stress.min` | 1.0× each year | bank | credit policy |
| `credit.commercial.stress.default` | revenue −5%, margin −0.5 pt, rates +1 pt | bank | credit policy |
| `credit.authority.levels` | officer ฿2m, head of retail credit ฿10m, committee above | bank | delegated authority |
| `pricing.mlr` | 7.10% | bank | published rate |
| `pricing.gradeMargin[1..10]` | 1.50 … −1.50 | bank | pricing policy |
| `rating.pd[1..10]` | 0.03 … 18.00% | bank (model owner) | rating model, validated annually |
| `rating.weights` | financial 60%, qualitative 40% | bank | rating model |
| `raroc.ftp`, `raroc.cost`, `raroc.lgd`, `raroc.capital`, `raroc.tax`, `raroc.hurdle` | 3.0%, 1.5%, 30%, 8.5%, 20%, 15% | bank (finance) | capital policy |
| `collateral.advanceRate.{land,building,equipment}` | 70%, 50%, 40% | bank | collateral policy |
| `tcg.cover`, `tcg.fee` | 50%, 1.75% a year | TCG scheme, *to confirm* | Thai Credit Guarantee Corporation PGS terms |
| `ews.signal.points` | 15, 12, 10, 8, 10, 15, 5 | bank (credit risk) | early-warning model |
| `ews.band` | high ≥ 60, medium ≥ 30 | bank | early-warning model |
| `ews.reviewMonths.monitor` | 3 | bank | credit policy |
| `limit.temporary.maxMonths` | 3 (sample: to 31 Jan) | bank | credit policy |
| `covenant.testDays` | within 45 days of quarter end | bank, per facility letter | facility letter |
| `waiver.fee.once` | 0.05% of the umbrella | bank | fee schedule |
| Stage 2 on watchlist | yes | bank, *to confirm* | TFRS 9 SICR qualitative criteria |
| Stage 3 / NPL needs default (90 dpd or unlikely to pay) | — | regulator, locked, *to confirm* | BOT asset classification, TFRS 9 |
| Customer not told of watchlist classification | — | bank, *to confirm* | internal policy |

## 8. Acceptance criteria

| # | Given | When | Then |
|---|---|---|---|
| 1 | APP-30414 with defaults | open Repayment capacity | base min 1.63×, stressed min 1.16×, result "Within policy" |
| 2 | revenue slider at 25% | — | stressed min 0.44×, "Outside policy" |
| 3 | stress at 30 / 4 / 4 | Send to committee | review blocked: "Outside policy" with both DSCRs; nothing sent |
| 4 | defaults | Send to committee | done "On the agenda of CC-2026-21."; pill "On the committee's agenda"; button disabled |
| 5 | Financials tab | untick the one-off | FY2024 adjusted EBITDA 18.1; re-tick restores 16.1 |
| 6 | Rating tab | set management to 1 | grade 6, rate 6.85% |
| 7 | committee not decided | open Drawdowns | "Opens once the committee approves" |
| 8 | CC-2026-21 item 1, Arunee T. conflicted | record the vote, all approve | result Approved (3–0); APP-30414 pill "Approved by CC-2026-21" |
| 9 | approved | draw tranches 1→4 as ops | ฿3.6m, ฿3.6m, ฿3.0m, ฿1.8m paid; "Drawn ฿12.0m of ฿12.0m" |
| 10 | certificate unticked | Next | error "A tranche cannot be drawn without the engineer's certificate." |
| 11 | B-0414 as credit officer | Temporary increase | done "Floor plan raised to ฿26,000,000 until 31 Jan 2027."; group limit ฿46,000,000 "temporary, base ฿40,000,000" |
| 12 | same as ops | Temporary increase | sent to the head of retail credit; limit unchanged |
| 13 | B-0414 | Call report with a summary | entry first in Call reports |
| 14 | EW-B3107 | open | score 75, "High: watchlist recommended" |
| 15 | tick signal 6 Explained | — | score 60 |
| 16 | score ≥ 60 | Decide → Monitor with a reason | review shows "Against the score"; confirm sends to the head of retail credit; classification unchanged |
| 17 | — | Decide → Watchlist with a reason | review shows ฿132,000 → ฿792,000, change ฿660,000; done "On the watchlist, Stage 2."; Monitoring "On the watchlist" +1 |
| 18 | FAC-B2031 covenant due | Test Q3 with the prefilled figures | DSCR 1.14x Breached; "Breach recorded. Draw stop set on RC-B2031 and OD-B2031." |
| 19 | breach, no waiver | Draw down ฿5m on RC | blocked "Draw stop" |
| 20 | Q3 test due | Annual review | blocked "Test the Q3 covenants first" |
| 21 | breach | Ask for a waiver → committee approves item 2 | draw stop lifted; Monitoring shows "Waived" |

## 9. Gaps against the core

| New | Purpose | Owning module |
|---|---|---|
| `credit-applications` resource (`POST`, `GET /{id}`, `PUT /{id}/spread`, `PUT /{id}/rating`, `POST /{id}/submission`, `GET /{id}/memo`) | Manual commercial credit: spreading, projection, rating, pricing, memo | new `credit-analysis` module in `lending` (or `decisioning` for the rating model) |
| `GET /api/v1/credit-applications/{id}/projection?rev=&margin=&rate=` | Server-side projection so the memo and committee pack use the same numbers | credit-analysis |
| `POST /api/v1/committees/{id}/items/{itemId}/resolution` | Committee votes and minutes (shared with retail) | lending workflow |
| `POST /api/v1/loans/{id}/drawdowns` | Staged disbursement against certificates | lending |
| `facilities` resource (`GET /{id}`, `POST /{id}/drawdowns`, `POST /{id}/covenant-tests`, `POST /{id}/waiver-requests`, `POST /{id}/reviews`) | Umbrella limits, notes, covenants, draw stop | lending + the limit tree ([12](../../12-trade-treasury-syndication.md) §1 "Exposure limits") |
| `POST /api/v1/limits/{lineId}/temporary-increase`, `POST /api/v1/limits/{lineId}/hold` | Limit tree changes with expiry and holds | new `limits` module |
| `POST /api/v1/customers/{id}/contacts`, `GET /api/v1/customers/{id}/relationship` | Call reports; aggregated exposure, connected parties, calendar, profitability | customers (onboarding) + a read model |
| `early-warnings` resource (`GET /{id}`, signals, actions, decision) and a nightly scoring job | Early-warning cases and stage overlay | new `credit-monitoring` module; stage overlay consumed by `EclService` |

## 10. Open questions

1. Is the commercial rating model the bank's own scorecard or a vendor model; who validates the PD table?
2. Should the projection run on the server (one source for memo, committee and audit) or stay in the screen?
3. TCG product and fee for this segment (PGS round, cover %, fee) — *to confirm* with TCG terms in force.
4. Does a watchlist decision itself move the stage, or does the ECL run apply a qualitative SICR flag the decision sets? (The prototype shows the allowance change in the review; the posting belongs to the run.)
5. Temporary increase maximum term and whether the fall-back is automatic or needs a review.
6. Connected-party definition for the single lending limit (BOT single lending limit rules — *to confirm*).

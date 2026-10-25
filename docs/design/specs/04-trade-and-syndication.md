# 04 · Trade finance and syndication

Import letters of credit, bank guarantees and syndicated loans with the bank as agent. Prototype sources: `js/trade.js` (LC-26-0412, BG-26-1108), `js/records.js` (BG-26-1102), `js/syndication.js` (Syndication overview, SYN-001). All three run in **Demo Commercial Bank**. Architecture: [12-trade-treasury-syndication](../../12-trade-treasury-syndication.md) defines the `trade-finance` and `syndication` services, the contingent ledger, multi-party arrangements, market data, SWIFT messaging and the `engine-rfr` / `engine-pro-rata` engines this spec relies on. Conventions and the authority matrix: [README](README.md), [00-cross-cutting](00-cross-cutting.md), [prototype-inventory](prototype-inventory.md).

**None of this exists in the core today.** The [core API inventory](core-api-inventory.md) has no trade, guarantee or syndication endpoint; every core call below is **New**. Existing calls that are reused are named where they apply (customer read, account debit, ledger).

## 1. Scope and users

**In scope.** Examining a presentation under an import sight LC check by check against UCP 600; asking the applicant for a waiver, refusing by MT734, recording the applicant's answer; paying under the LC on a trust receipt; a demand under a performance guarantee examined against URDG 758, the applicant told, paid, and recovered from margin, account and a demand loan; a guarantee record without a claim (BG-26-1102). For syndication as agent: the overview, the lender register, a utilisation request with pro rata funding notices and a defaulting lender, interest on THOR compounded in arrears shared by lender, arrangement / commitment / agency fees, the payment waterfall and distribution, a Majority Lenders vote with a defaulting lender disregarded, and a secondary transfer registered after KYC.

**Out of scope.** LC issuance and amendment entry (AMD-1 is shown as history only), export LCs, documentary collections (list only: DC-26-0301, DC-26-0305), usance LCs, the bank as participant in someone else's syndication (SYN-004 is list-only), FX for the settlement ([10-treasury](10-treasury.md), FX-26-10-0918), the facility umbrella that carries the trade line ([03](03-business-banking.md), FAC-B2031 BG-LINE).

| Role | Prototype id | What they do here |
|---|---|---|
| Trade operations checker | `ops` | Examines, overrides a check with a second checker, sends waivers and refusals, pays within the `trade` authority (฿100m) |
| Head of trade operations | second approver | Approves trade payments and claims above ฿100m |
| Loan agency officer | `ops` | Sends notices, records votes, counts, prepares distributions within the `agency` authority (฿1bn), records KYC, registers transfers |
| Head of loan agency | second approver | Approves distributions above ฿1bn |
| RM | Wanida K. | Owns the customer side (Siam Freight, EEC Logistics) |

## 2. Screens

| Route | Record id pattern | Purpose |
|---|---|---|
| Trade Finance → Letters of credit | `LC-yy-nnnn` | LC-26-0412 (Siam Freight → Hino, Issued), LC-26-0418 (Pacific Import Trading, discrepant) |
| Trade Finance → Guarantees | `BG-yy-nnnn` | BG-26-1102 (Siam Freight → Port Authority, Issued), BG-26-1108 (EEC Logistics → PTT, state live: Claim received / Claim paid / Claim refused) |
| Syndication → Overview (page) | — | Deals as agent and participant, commitments, due on 2 Nov, open votes, defaulting lenders, two-week calendar |
| Syndication → Deals / Participants / Notices / Lender votes / Fees | `SYN-nnn`, `DD-nnnn`, `AR-nn`, `FEE-nnnn` | Live lists from the register and state |
| Record `LC-26-0412` | import letter of credit | Summary, Examination (14), Decision, Payment, Amendments (1), Charges |
| Record `BG-26-1108` | bank guarantee | Demand (5), Applicant's side, Recovery, Terms |
| Record `BG-26-1102` | bank guarantee | Summary, Security, Claims, Charges |
| Record `SYN-001` | syndicated facility | Facility, Lenders (6), Drawdowns, Interest, Fees, Payment waterfall, Lender votes (1), Transfers (1) |

### LC-26-0412

Lede: "Siam Freight Logistics → Hino Motors (JP) · sight LC under UCP 600 · presented by MUFG Bank, Tokyo". Pills: Issued + state (`N discrepancy` crit → Waiting for the applicant / Refused, holding documents → Ready to pay → Settled; Documents refused, returning on decline). Actions: *Refuse documents* (enabled only with a discrepancy and no decision), *Applicant's answer* (after a waiver request or refusal, until answered), *Pay* (once payable) or *Ask for a waiver*.

| Fact | Value |
|---|---|
| Amount | $2,400,000.00 ± 5% |
| Invoice | $2,398,560.00 ≈ ฿86,540,045 at 36.08 |
| Checks | 13 of 14 comply (crit while any discrepancy) |
| Answer by | 29 Oct 2026 · "5 banking days, art. 14(b)" (warn until decided) |
| Margin held | ฿8,640,000 · 10% |
| Expiry | 30 Dec 2026 |

| Tab | Content |
|---|---|
| Summary | Contract (applicant, beneficiary, advising/presenting bank, amount, goods 12 Hino 500 trucks CIF Laem Chabang, available with us by sight payment, trade line $5.0m under FAC-B2031); timeline (presented 22 Oct → today's decision → 29 Oct deadline → paid) |
| Examination | 14 checks: document, check, LC terms, document says, UCP 600 article, result with an override checkbox (disabled once decided) |
| Decision | Options table (waive · refuse and hold · miss the deadline) with UCP articles; outcome notices |
| Payment | Locked until payable; then the funding quote; after settlement the paid summary |
| Amendments | AMD-1: latest shipment 15 Nov → 30 Nov 2026, accepted by beneficiary |
| Charges | Issuance 0.125% ฿103,680 paid; amendment ฿1,500 paid; discrepancy fee $80 (deducted on payment after a waiver); payment commission 0.25% on settlement |

### BG-26-1108

Lede: "EEC Logistics Co., Ltd. → PTT PCL · performance guarantee under URDG 758 · RM Wanida K." Pills: Demand received 21 Oct / Demand paid / Demand refused. Actions: *Tell the applicant* (once), *Pay the demand* or *Refuse the demand* depending on compliance (disabled once decided). Facts: amount ฿4,500,000; demanded ฿4,500,000; decide by 28 Oct 2026 "5 business days, art. 20"; margin ฿450,000 (10%); applicant's account CUR-EEC01 ฿1,200,000.

Tabs: Demand (five checks with URDG article and an override checkbox; notice "Complying: the bank pays — A guarantee is independent of the contract (art. 5). Only a court order stops payment." or "Not complying: the bank may refuse — One refusal notice listing every discrepancy, by 28 Oct (art. 24)."); Applicant's side (EEC's objection quoted; the independence explanation; notified timeline); Recovery (paid ฿4,500,000 − margin ฿450,000 − CUR-EEC01 ฿1,200,000 = demand loan ฿2,850,000 at MOR + 2.00%, LN-EEC-0101); Terms (beneficiary PTT, purpose contract W-2026-044 Rayong, URDG 758, demand requirements, expiry 30 Jun 2027, counter-indemnity 4 Feb 2026 with 10% cash margin).

### BG-26-1102

Siam Freight Logistics → Port Authority of Thailand, performance guarantee for berth lease B-4, Laem Chabang, ฿12,000,000, expiry 31 Dec 2027; security: cash margin ฿1,200,000 held in CUR-B2031 (10%), counter-indemnity signed 2 Jan 2026; claims: none ("A claim would open here with the demand, the documents and a 5-day clock to pay or refuse."); charges: issuance 1.5% a year ฿180,000 paid, stamp duty ฿10 paid. It is the record behind FAC-B2031's BG-LINE (฿12m used of ฿15m).

### SYN-001

Lede: "Siam Energy PCL · ฿6.0bn syndicated facilities · we are agent and hold 35% · signed 15 Jan 2026, Thai law". Pills: Performing; 1 defaulting lender; vote open N% for / Covenant reset agreed. Actions: *Record a vote* (while a lender has not voted and the vote is not counted), *Send funding notices* (once).

| Fact | Value |
|---|---|
| Commitment | ฿6,000,000,000 |
| Drawn | ฿3,600,000,000 · 60% |
| Lenders | 6 (7 after the transfer) |
| Interest period | 3 Aug – 2 Nov · THOR in arrears |
| Due 2 Nov | ฿232,097,474 |
| Net debt to EBITDA | 3.62× (warn; limit 4.0× for FY2026 once agreed) |

| Tranche | Commitment | Drawn | Pricing | Terms |
|---|---|---|---|---|
| A · Term loan | ฿3,600,000,000 | ฿3,600,000,000 | THOR + 1.25% | Amortising ฿200m a quarter from Nov 2026; matures 15 Jan 2031 |
| B · Revolving credit | ฿2,400,000,000 | ฿0 | Fixed per loan + 1.10% | Loans of 1–6 months; available to 31 Dec 2029 |

| Lender | Role | Share | Commitment | Arrangement rate |
|---|---|---|---|---|
| Demo Commercial Bank (us) | Agent, mandated lead arranger, bookrunner | 35% | ฿2,100,000,000 | 0.45% |
| Bangkok Bank | Mandated lead arranger | 25% | ฿1,500,000,000 | 0.45% |
| Krungsri | Lead arranger | 15% | ฿900,000,000 | 0.40% |
| MUFG Bank, Bangkok Branch | Arranger | 12% (8% after transfer) | ฿720,000,000 | 0.35% |
| Andaman Investment Bank | Participant · **defaulting lender since 25 Sep** | 8% | ฿480,000,000 | 0.30% |
| Siam Commercial Bank | Participant | 5% | ฿300,000,000 | 0.30% |
| ICBC (Thai) | Participant, by transfer (from 30 Oct) | 4% | ฿240,000,000 | — |

Tabs: Facility (tranches, terms, covenants: net debt to EBITDA ≤ 3.5× latest 3.62× → ≤ 4.0× FY2026 once agreed; interest cover ≥ 4.0× latest 5.1×; tested half-yearly); Lenders (register + defaulting-lender notice); Drawdowns (DD-1030 checks and funding table; DD-0925 history: ฿500m asked, ฿460m received, Andaman "Not funded"); Interest; Fees; Payment waterfall; Lender votes (AR-03); Transfers (TC-SYN001-02).

## 3. Fields

| Dialog | Field | Label (EN / TH) | Type | Required | Source | Validation |
|---|---|---|---|---|---|---|
| Examination tab | `lc-chk-i` | Result override per check | checkbox | — | examiner | override tagged "override"; recorded with a second checker in History; locked once decided |
| lcWaiver | `wnote` | Discrepancies to explain / ความไม่ตรงที่ต้องอธิบาย | text, prefilled one line per discrepancy ("Insurance certificate: 100% of CIF, $2,398,560.00 (credit says at least 110% of CIF)") | Yes | system | "Describe the discrepancy." |
| lcRefuse | `rhold` | The documents / เอกสาร | choice: hold (Hold pending the applicant's waiver), return (Return to the presenter) | Yes | examiner | — |
| lcAnswer | `lans` | Siam Freight Logistics | choice: accept (Accepts the documents, signed on the trade portal), decline | Yes | trade portal | — |
| lcSettle | `lhow` | Siam Freight pays by / สยามเฟรทชำระโดย | choice: thb (THB trust receipt, 120 days, MOR − 0.75%), usd (USD trust receipt, 120 days, SOFR + 2.25%), debit (Debit its accounts now) | Yes | staff | debit blocked (§4) |
| Demand tab | `bg-chk-i` | Result override per check | checkbox | — | examiner | locked once decided |
| bgNotify / bgDecide | — | read-only summaries | — | — | — | — |
| synNotice | — | Lenders (count); Register (as it stands / includes ICBC) | read-only | — | register | — |
| synVote | `svl` | Lender | choice of lenders not yet voted | Yes | portal reply | "Every lender has voted." when none left |
| synVote | `svv` | Vote | choice: yes (For), no (Against) | Yes | portal reply | — |
| synCountVote | — | Record date 23 Oct 2026; deadline 30 Oct 2026, 17:00 | read-only | — | — | blocked below threshold |
| synDistribute | `sda` | Received from Siam Energy | money, default the total due | Yes | agent's account | "Enter the amount received." |
| synKyc | `sk0..sk3` | Licensed bank; Screening clear; Thai tax resident; Admin details received | checkbox | at least one | KYC team | "Tick what has been checked." |
| synRegister | — | Share 4%; effective 30 Oct 2026; transfer fee ฿100,000 paid by ICBC (Thai) | read-only | — | certificate | blocked until 4 of 4 KYC checks |

## 4. Actions

| Action (flow) | Who | Refused or blocked when | Review shows | Approval | Effect | Core call |
|---|---|---|---|---|---|---|
| Override a check | ops | after a decision or settlement | — | second checker (maker-checker) | Check result flips; discrepancy count and payability recalculate | **New** `POST /api/v1/trade/lcs/{id}/presentations/{pid}/checks/{checkId}/override` (trade-finance) |
| Ask for a waiver (`lcWaiver`) | ops | no discrepancy; already asked; answered; settled | "Asks Siam Freight Logistics to accept the documents as presented. The bank still answers MUFG by 29 Oct: pay if they waive, refuse if they do not." | none | Decision = waiver; sent to the applicant's trade portal and RM | **New** `POST /api/v1/trade/lcs/{id}/presentations/{pid}/waiver-requests` |
| Refuse documents (`lcRefuse`) | ops | no discrepancy; already refused; answered; settled | MT734 preview (`:20:LC260412`, `:21:MUFG-TK-88213`, `:32A:261029USD2398560,`, `:77J:` one line per discrepancy, `:77B:` HOLD DOCUMENTS PENDING APPLICANT WAIVER, UCP 600 ART 16(C)(III)(B) or RETURNING DOCUMENTS); "One notice listing every discrepancy (art. 16(d)); a second notice cannot add any." | none | Decision = refused; "return" also sets the answer to decline | **New** `POST /api/v1/trade/lcs/{id}/presentations/{pid}/refusal` → MT734 via payments-hub |
| Applicant's answer (`lcAnswer`) | ops | not asked/refused; already answered | accept: "The bank agrees to the waiver and may now pay. The $80 discrepancy fee comes off the proceeds to Hino." decline: "The documents are refused and returned to MUFG." | none | Answer recorded; accept makes the LC payable | **New** `POST /api/v1/trade/lcs/{id}/presentations/{pid}/applicant-answer` |
| Pay (`lcSettle`) | ops | `debit`: "Not enough in the accounts — Needs ฿77,900,044.80; CUR-B2031 and the USD account hold about ฿18.65m together. Use a trust receipt." | MT202 to MUFG value 26 Oct ($2,398,480.00 after the $80 fee, or $2,398,560.00); trust receipt TR-26-0412 ($2,398,560.00 or ฿77,900,044.80); due 22 Feb 2027; trade line "$2.40m of $5.0m: the LC becomes the trust receipt"; release of the bill of lading; the LC closes | `trade` on ฿86,540,044.80 (ops ฿100m; else head of trade operations) | Settled; documents released; TR booked; payment commission 0.25% charged | **New** `POST /api/v1/trade/lcs/{id}/presentations/{pid}/payment` + **New** `POST /api/v1/trade/trust-receipts`; account debits via existing `POST /api/v1/accounts/{id}/withdrawals` for fees |
| Override a demand check | ops | after the decision | — | second checker | Compliance recalculates; button switches Pay ↔ Refuse | **New** `POST /api/v1/trade/guarantees/{id}/demands/{did}/checks/{checkId}/override` |
| Tell the applicant (`bgNotify`) | ops | already told | "Sends the demand to the applicant now (URDG 758 art. 16). This is information, not a request for permission: the decision stays with the bank." | none | Notified; timeline entry | **New** `POST /api/v1/trade/guarantees/{id}/demands/{did}/applicant-notice` |
| Pay the demand (`bgDecide`, compliant) | ops | not yet notified: "Tell the applicant first — URDG 758 art. 16: the applicant hears of the demand before the bank pays it." | To PTT by BAHTNET ฿4,500,000; margin −฿450,000; CUR-EEC01 −฿1,200,000; demand loan LN-EEC-0101 ฿2,850,000; guarantee reduced to nil and closed | `trade` ฿4,500,000 | Demand paid; LN-EEC-0101 booked at MOR + 2.00%; list row "Claim paid" | **New** `POST /api/v1/trade/guarantees/{id}/demands/{did}/payment`; the demand loan through **New** `POST /api/v1/loans` (no booking endpoint for a non-applied loan exists); the debit via existing `POST /api/v1/accounts/{id}/withdrawals` |
| Refuse the demand (`bgDecide`, not compliant) | ops | — | "Sends one refusal notice to PTT listing each discrepancy (art. 24). PTT may present a new complying demand before expiry." | none | Demand refused; list row "Claim refused" | **New** `POST /api/v1/trade/guarantees/{id}/demands/{did}/refusal` |
| Send funding notices (`synNotice`) | ops | already sent | Each lender's amount from the register today; "Sends each lender its notice by the agency portal and SWIFT MT643-style message on Monday 26 Oct at 08:00, with the rate, the period and the agent's BOT account. Andaman's notice goes too; if it fails to fund, the borrower receives less." | none | Notices snapshot the register (later transfers do not change them); DD-1030 "Queued" | **New** `POST /api/v1/syndications/{id}/utilisations/{uid}/funding-notices` (syndication) |
| Record a vote (`synVote`) | ops | every lender has voted; vote counted | For before / after / needed 66⅔% | none | Vote recorded with the lender's reply; changeable until the deadline | **New** `POST /api/v1/syndications/{id}/amendment-requests/{arId}/votes` |
| Count and declare (`synCountVote`) | ops | below threshold: "Not passed yet — N% for against 66⅔% needed. Wait for the remaining lenders or the deadline." | For %; "Without disregarding Andaman" %; consequence (covenant 4.0× for FY2026, letter to Siam Energy, every lender told) | none (agent's ministerial act) | Amendment agreed; facility covenant changes; vote closed | **New** `POST /api/v1/syndications/{id}/amendment-requests/{arId}/declaration` |
| Prepare the distribution (`synDistribute`) | ops | amount ≤ 0 | Waterfall with got / due per step; "A short payment" notice when any step is short | `agency` on the amount (ops ฿1bn; else head of loan agency) | Distribution prepared for 2 Nov; per-lender fees, interest, principal | **New** `POST /api/v1/syndications/{id}/distributions` |
| Record KYC (`synKyc`) | ops | nothing ticked | "Records N of 4 checks with the evidence attached." | none | KYC checks recorded on the incoming lender | **New** `POST /api/v1/syndications/{id}/transfers/{tid}/kyc` (reuse the onboarding KYC engine for the party) |
| Register the transfer (`synRegister`) | ops | KYC < 4: "KYC not complete — N of 4 checks recorded. The agent cannot register a lender it has not identified." | MUFG 12% → 8%; ICBC (Thai) 0% → 4%; later notices use new shares | none | Register updated from 30 Oct; Lenders shows ICBC "From 30 Oct" | **New** `POST /api/v1/syndications/{id}/transfers/{tid}/registration` |

### Calculations

**LC payable** (THB trust receipt): invoice $2,398,560.00 × 36.0800 = ฿86,540,044.80; less margin ฿8,640,000.00 = ฿77,900,044.80 financed. Payment commission 0.25% × ฿86,540,044.80. The $80 discrepancy fee is deducted from the amount remitted to the presenter only when the payment follows a waiver of a discrepancy.

**LC payable state**: payable when no check is discrepant, or the applicant accepted. Discrepant checks = checks whose built-in result XOR override is false. In the sample only check 8 (insurance cover, art. 28(f)(ii): at least 110% of CIF vs 100%) is discrepant.

**Guarantee recovery**: demand − margin − applicant's available balance = demand loan (฿4,500,000 − ฿450,000 − ฿1,200,000 = ฿2,850,000).

**THOR compounded in arrears** (Tranche A, 3 Aug to 2 Nov 2026, actual/365): for each calendar day d in [3 Aug, 2 Nov): r_d = 1.74% before 1 Oct, 1.49% from 1 Oct; product Π (1 + r_d / 365); compounded rate = (Π − 1) × 365 / 91 = 1.6555%; all-in = 1.6555% + 1.25% = 2.9055%; interest = ฿3.6bn × 2.9055% × 91 / 365 = ฿26,077,474 (rounded to satang, displayed to the baht). Lender interest = interest × share. (Prototype simplification: every calendar day carries a rate, no lookback or observation shift; production uses `engine-rfr` with the facility's convention — *to confirm*.)

**Tranche B loan DD-1030**: ฿600m at fixed 1.62% + 1.10% = 2.72%, 30 Oct to 30 Nov, 31 days: interest at maturity ฿1,386,082.

**Fees**:
- Arrangement fee ฿30m at signing: each lender share × ฿6bn × its role rate (฿9,450,000; ฿6,750,000; ฿3,600,000; ฿2,520,000; ฿1,440,000; ฿900,000 = ฿24,660,000); bookrunner's fee to us = ฿30,000,000 − ฿24,660,000 = ฿5,340,000.
- Commitment fee, quarter to 2 Nov: 0.25% × ฿2.4bn undrawn × (1 − defaulting share 8%) = ฿5,520,000 (฿6,000,000 less ฿480,000), shared pro rata among non-defaulting lenders (share ÷ 92%).
- Agency fee: ฿2,000,000 a year, ฿500,000 a quarter, kept by the agent, not shared.

**Waterfall due 2 Nov** (applied in rank order, each filled before the next): 1 agency fee ฿500,000; 2 commitment fee ฿5,520,000; 3 interest Tranche A ฿26,077,474; 4 principal instalment Tranche A ฿200,000,000; total ฿232,097,474. A short step is shared pro rata within its class. Distribution per lender: fees = its commitment-fee share (+ the agency fee for us), interest = interest got × share, principal = principal got × share.

**Vote count** (Majority Lenders = 66⅔% of commitments at the record date 23 Oct; defaulting lender's commitment disregarded): counted base = ฿6.0bn − ฿480m = ฿5.52bn. For: us ฿2.1bn + SCB ฿0.3bn = 43.5%; after Bangkok Bank votes for: ฿3.9bn ÷ ฿5.52bn = 70.7% → passes. If Andaman counted: ฿3.9bn ÷ ฿6.0bn = 65.0% (fails). "Cannot pass" when (base − against) ÷ base < 66⅔%. Money terms (margin, fees, amounts, dates, maturity, pro rata sharing, voting rules) need all lenders.

**Funding with a defaulting lender** (DD-0925 history): the agent does not fund for a lender that fails; the borrower receives the sum of funded shares (฿500m − ฿40m = ฿460m); other lenders are not asked to cover.

## 5. States

| Record | State | Entered by | Next |
|---|---|---|---|
| LC-26-0412 presentation | Discrepant | examination | waiver asked / refused |
| | Waiting for the applicant | lcWaiver | accepted → ready to pay; declined → refused, returning |
| | Refused, holding documents | lcRefuse (hold) | applicant later accepts → ready to pay (art. 16(c)(iii)(b)) |
| | Documents refused, returning | lcRefuse (return) or decline | closed |
| | Ready to pay | no discrepancy, or accepted | Settled |
| | Settled | lcSettle | LC closed; TR-26-0412 live to 22 Feb 2027 |
| BG-26-1108 demand | Demand received 21 Oct | inbound demand | applicant told → paid (compliant) or refused (not compliant) |
| | Demand paid | bgDecide | guarantee nil, closed; LN-EEC-0101 opened |
| | Demand refused | bgDecide | beneficiary may present again before expiry 30 Jun 2027 |
| DD-1030 | To send → Queued (Mon 26 Oct 08:00) → funded → disbursed 30 Oct | synNotice | repaid 30 Nov |
| AR-03 | Open (closes 30 Oct 17:00) → Agreed / Rejected | synCountVote | facility version amended |
| Distribution 2 Nov | Scheduled → Prepared → Released when funds arrive | synDistribute | paid to lenders by BAHTNET |
| TC-SYN001-02 | Certificate received → KYC (n of 4) → Registered from 30 Oct | synKyc, synRegister | — |
| Lender | Active / Defaulting lender since 25 Sep / From 30 Oct | funding failure, transfer | defaulting → cured |

## 6. Postings

| Event | Debit | Credit | Note |
|---|---|---|---|
| LC issued (history) | Contingent: customers' liability on LCs | Contingent: LCs outstanding | `CONTINGENT_LC` memo balance ([12](../../12-trade-treasury-syndication.md) §1) |
| LC paid on a THB trust receipt | Trust receipt loans | Nostro / MUFG via MT202 | plus: margin deposit → trust receipt (reduces the loan); reverse the contingent pair |
| Payment commission, discrepancy fee | CUR-B2031 / proceeds | Fee income | |
| Guarantee demand paid | Margin hold ฿450,000; CUR-EEC01 ฿1,200,000; demand loan LN-EEC-0101 ฿2,850,000 | BAHTNET settlement to PTT ฿4,500,000 | reverse `CONTINGENT_GUARANTEE` ฿4,500,000 |
| Syndication funding (DD-1030) | Agency client money (memo) per lender received | Borrower's account on disbursement | our 35% share also books our own loan |
| Distribution 2 Nov | Agency client money | Each lender's account; agency fee income (us) | `AGENCY_CLIENT_MONEY` memo; rounding residual by `engine-pro-rata` |

## 7. Configurable values

| Key | Sample | Set by | Basis |
|---|---|---|---|
| `trade.examination.days` | 5 banking days after presentation | ICC rule, locked, *to confirm* (bank holiday calendar decides banking days) | UCP 600 art. 14(b) |
| `trade.lc.tolerance` | ± 5% on amount | per LC | UCP 600 art. 30 |
| `trade.fees.issuance`, `amendment`, `discrepancy`, `paymentCommission` | 0.125%; ฿1,500; $80; 0.25% | bank | trade fee table |
| `trade.margin.default` | 10% | bank, per customer | credit approval |
| `trade.tr.tenorDays`, `trade.tr.price.thb`, `trade.tr.price.usd` | 120; MOR − 0.75%; SOFR + 2.25% | bank | trade pricing |
| `guarantee.decision.days` | 5 business days | ICC rule, locked, *to confirm* | URDG 758 art. 20 |
| `guarantee.fee` | 1.5% a year | bank | fee table |
| `guarantee.demandLoan.price` | MOR + 2.00% | bank | pricing |
| `authority.trade` | ops ฿100,000,000 → head of trade operations | bank | delegated authority |
| `synd.majorityLenders` | 66⅔% of commitments at record date | per facility agreement, *to confirm* | LMA-style clause |
| `synd.defaultingLender.disregardVotes`, `.noCommitmentFee` | true | per facility agreement, *to confirm* | LMA defaulting-lender clauses |
| `synd.noticeDays.utilisation` | 5 business days | per facility | facility agreement |
| `synd.rfr.convention` | THOR compounded in arrears, actual/365, no lookback (prototype) | per facility, *to confirm* | Thai market convention / TBA |
| `synd.fees.commitment`, `agency`, `arrangement[role]`, `transfer` | 0.25% a quarter on undrawn; ฿2m a year; 0.45/0.45/0.40/0.35/0.30%; ฿100,000 | per facility | fee letters |
| `authority.agency` | ops ฿1,000,000,000 → head of loan agency | bank | delegated authority |
| `synd.transfer.kycChecks` | licensed bank; sanctions and adverse media; Thai tax residence; admin details | bank (compliance) | AMLO KYC, withholding tax |

## 8. Acceptance criteria

| # | Given | When | Then |
|---|---|---|---|
| 1 | LC-26-0412 as presented | open Examination | 14 checks, 13 comply, insurance cover Discrepant (28(f)(ii)) |
| 2 | override check 8 to comply | — | discrepancies 0, LC payable ("Pay" shown); revert restores 1 |
| 3 | 1 discrepancy, no decision | Refuse documents (hold) | MT734 preview contains `:77J:` "INSURANCE CERTIFICATE COVER AMOUNT…" and `:77B:` HOLD…; done "MT734 sent to MUFG Bank, Tokyo." |
| 4 | no decision | Ask for a waiver | review mentions 29 Oct; done "Waiver request sent to Siam Freight Logistics." |
| 5 | waiver asked | Applicant's answer → accept | review mentions the $80 discrepancy fee; done "Waiver accepted; ready to pay." |
| 6 | payable | Pay → Debit its accounts now | blocked "Not enough in the accounts … ฿77,900,044.80" |
| 7 | payable, ops | Pay → THB trust receipt | review shows TR-26-0412 and ฿77,900,044.80; done "Paid to MUFG Bank; TR-26-0412 booked; documents released."; Payment tab shows $2,398,480.00 paid and $80 deducted |
| 8 | BG-26-1108, applicant not told | Pay the demand | blocked "Tell the applicant first" |
| 9 | told | Pay the demand as ops | review shows ฿2,850,000 demand loan; done "Paid to PTT; LN-EEC-0101 booked for the shortfall."; Guarantees list "Claim paid" |
| 10 | a demand check overridden to discrepant | — | action becomes "Refuse the demand"; refusal done "Refusal sent to PTT." |
| 11 | SYN-001 | open Interest | 91 days; THOR compounded 1.6555%; all-in 2.9055%; ฿26,077,474 |
| 12 | — | open Fees | commitment fee ฿5,520,000; Andaman "None while defaulting"; bookrunner's fee ฿5,340,000 |
| 13 | votes: us for, Krungsri against, Andaman against, SCB for | count | 43.5% → blocked "Not passed yet" |
| 14 | record Bangkok Bank for | count and declare | 70.7%, "Without disregarding Andaman 65.0%"; done "Amendment agreed; the covenant is 4.0× for FY2026." |
| 15 | — | Prepare the distribution with ฿232,097,474 | four steps fully paid; per-lender table; done "Distribution prepared for 2 Nov." |
| 16 | — | Prepare with less than the total | "A short payment" notice; principal step short |
| 17 | KYC 0 of 4 | Register the transfer | blocked "KYC not complete — 0 of 4 checks recorded…" |
| 18 | KYC 4 of 4 | Register | MUFG 8%, ICBC (Thai) 4% from 30 Oct; Lenders shows 7 |
| 19 | notices sent before the transfer | register the transfer | DD-1030 funding table still shows 6 lenders (snapshot) |

## 9. Gaps against the core

| New | Purpose | Owning module |
|---|---|---|
| `GET/POST /api/v1/trade/lcs`, `GET /api/v1/trade/lcs/{id}` | LC records | `trade-finance` |
| `POST /api/v1/trade/lcs/{id}/presentations`, `…/presentations/{pid}/checks/{checkId}/override` | Presentations and examination with AI-listed discrepancies for a checker | `trade-finance` + document workflows |
| `…/presentations/{pid}/waiver-requests`, `/applicant-answer`, `/refusal`, `/payment` | Decision and settlement | `trade-finance`; MT734 / MT202 through payments-hub |
| `POST /api/v1/trade/trust-receipts`, `GET /{id}` | Import loans after settlement | `trade-finance` (loan booked on the lending ledger) |
| `GET /api/v1/trade/guarantees/{id}`, `POST …/demands`, `…/demands/{did}/checks/{checkId}/override`, `/applicant-notice`, `/payment`, `/refusal` | Guarantees and demands under URDG 758 | `trade-finance` |
| `POST /api/v1/loans` (book a loan from another module, e.g. LN-EEC-0101) | Demand loan under a counter-indemnity | lending |
| `GET /api/v1/syndications`, `GET /api/v1/syndications/{id}`, `GET /{id}/register` | Facilities, tranches, lender register | `syndication` |
| `POST /api/v1/syndications/{id}/utilisations`, `…/utilisations/{uid}/funding-notices`, `…/fundings` | Utilisation requests, notices, funding received, defaulting lender | `syndication` |
| `GET /api/v1/syndications/{id}/interest-periods/{pid}` | Rate fixing and per-lender interest | `syndication` + `engine-rfr` + `market-data` (THOR fixings) |
| `POST /api/v1/syndications/{id}/distributions` | Waterfall and per-lender split | `syndication` + `engine-pro-rata` |
| `POST /api/v1/syndications/{id}/amendment-requests`, `…/votes`, `…/declaration` | Lender votes and versioned amendments | `syndication` |
| `POST /api/v1/syndications/{id}/transfers`, `…/kyc`, `…/registration` | Secondary transfers | `syndication` + onboarding KYC |
| Contingent and agency memo balance types | `CONTINGENT_LC`, `CONTINGENT_GUARANTEE`, `UNDRAWN_COMMITMENT`, `AGENCY_CLIENT_MONEY` | ledger |

## 10. Open questions

1. Banking-day calendar for the examination deadline: 23 Oct (Chulalongkorn Day) is a Thai bank holiday, so five banking days after a 22 Oct presentation may end on 30 Oct, not 29 Oct as the prototype shows — *to confirm* with the holiday calendar in the core.
2. Trust receipt booking: on the lending ledger as a loan product, or a trade-finance product with its own accrual?
3. THOR convention for this facility: lookback, observation shift, lockout, rounding of the daily rate — *to confirm* against the facility agreement and Thai Bankers' Association guidance.
4. Should the agent prepare a distribution before the money arrives (prototype: prepared now, released on receipt), and who releases it?
5. Applicant's waiver after a refusal with "hold": does the bank need the presenter's further consent, or only the applicant's waiver (UCP 600 art. 16(c)(iii)(b)) — *to confirm*.
6. Is LN-EEC-0101 handed to collections immediately or to the credit officer first?

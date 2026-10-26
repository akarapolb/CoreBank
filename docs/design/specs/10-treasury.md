# 10 · Treasury

Spec for the treasury screens of the console: liquidity coverage (LCR), interest-rate risk in the banking book (ALM), FX deals front to back, and nostro reconciliation. Prototype source: `docs/design/console-prototype/js/treasury.js`, plus the spot-deal dialog `fxDeal` in `js/flows.js`. Design background: [docs/12-trade-treasury-syndication.md](../../12-trade-treasury-syndication.md) §1, §3 and §5.

Every figure below is the prototype's sample data, as at Friday 23 Oct 2026 close, viewed on Saturday 24 Oct 2026. Every BOT ratio, minimum and run-off rate is the prototype's reading and is *to confirm* with the bank's treasury, risk and compliance teams.

## 1. Scope and users

**In scope.** The Treasury system of the **Demo Commercial Bank** tenant (the Retail tenant also has Treasury, with the same screens):

- Treasury → Overview: the day in one page;
- Liquidity: LCR-2026-10, with stress and the contingency funding plan; NSFR shown as a figure only;
- Interest-rate risk: ALM-2026-10, the repricing gap and rate shocks;
- Deals: the customer forward FX-26-10-0918 and its cover deal, plus the spot deal dialog;
- FX positions: the currency position list;
- Nostro accounts: NOS-EUR-01 reconciliation with a maker-checker journal.

**Out of scope.** A dealing front office (pricing engines, derivatives beyond outright forwards), hedge accounting, money-market and repo deal capture as records (the contingency plan names a repo but does not book it), NSFR calculation, CLS. These follow the phasing in doc 12 §6.

**Users.**

| Role | Prototype role id | May do |
|---|---|---|
| Treasurer / ALCO owner | `finance` (Arunee T.) | View everything; invoke the contingency funding plan (goes to the ALCO chair); approve the nostro journal (finance limit ฿50m) |
| Dealer | `ops` acting as dealer | Book a spot deal (always goes to the head of dealing: no role has its own `fx` authority) |
| Treasury operations | `ops` (Ploy C.) | Match confirmations, resolve mismatches, accept nostro matches, prepare the nostro journal; approve a journal it did not prepare, up to ฿1m |
| Head of dealing | — (second approver) | Approves FX deals; agrees any amendment to a booked deal |
| ALCO chair | — (second approver) | Approves contingency funding actions |

## 2. Screens

### 2.1 Treasury → Overview (`treasury/overview`, page view)

Title "Treasury today"; lede "Saturday 24 Oct 2026, positions at Friday's close. Liquidity, funding, rate risk, FX and the nostros in one place."

| Facts strip | Value | Tone rule |
|---|---|---|
| LCR | 148% · "BOT minimum 100%" | warn below 120% |
| NSFR | 126% · "BOT minimum 100%" | — (static until NSFR is built) |
| FX net open position | $12.4m · "limit $25.0m" | — |
| NII at ±100bp | −4.7% · "limit −5%" | crit below −5% |
| Nostro breaks | 1, then 0 once NOS-EUR-01 is matched and posted | crit while open |

Cards: **Needs attention** (one line per record with a link and a good/warn/crit marker: LCR-2026-10, ALM-2026-10, FX-26-10-0918, NOS-EUR-01) and **Funding today** (overnight interbank placement ฿6.00bn at 2.45%; BOT reserve average ฿12.4bn, 104% of requirement; large maturity TD-88140 Siam Energy 29 Oct; net 30-day outflow from the LCR).

### 2.2 List sections

| Section | Columns | Rows |
|---|---|---|
| Liquidity | Report, As of, Ratio, Minimum, State | LCR-2026-10 (live ratio; state "Contingency plan with ALCO" once invoked), NSFR-2026-Q3 (126%) |
| Interest-rate risk | Report, As of, NII at ±100bp, EVE at ±100bp, State | ALM-2026-10 |
| Deals | Deal, Counterparty, Type, Amount, Value date, State | FX-26-10-0918 (Unconfirmed → Confirmed), FX-26-10-0919 (Mismatch → Confirmed), FX-26-10-0907 (spot, Siam Energy buys EUR 1.5m, value 27 Oct) |
| FX positions | Currency, Position, Limit, Use, MTM P&L, State | USD $12.4m of $25m; JPY ¥288m of ¥500m |
| Nostro accounts | Nostro, Bank, Currency, Our books, Their statement, State | NOS-USD-01 Citibank NY, NOS-JPY-01 MUFG Tokyo (matched), NOS-EUR-01 Deutsche Bank (Break → Matched) |

### 2.3 LCR-2026-10 · Liquidity coverage ratio

Lede: "Liquidity coverage ratio · Demo Commercial Bank, solo · as at close of 23 Oct 2026 · ALCO owner: treasurer". Pill: LCR value (good ≥ 120%, warn ≥ 100%, crit below).

| Facts strip | Value |
|---|---|
| LCR | 148% · "minimum 100%" (warn under 120%) |
| High-quality liquid assets | ฿44.10bn · "after haircuts and caps" |
| Outflows, 30 days | ฿42.80bn |
| Inflows, capped at 75% | ฿13.00bn |
| Early-warning trigger | 120% · "internal, above the BOT 100%" |

| Tab | Shows |
|---|---|
| Liquid assets (4) | Level, Asset, Market value, Haircut, Counted; a total row "After the caps: level 2 at most 40%, level 2B at most 15%". Note: only unencumbered assets under the treasurer's control count; bonds pledged in BOT repo are excluded |
| Cash flows | Outflows table (Category, Balance, Run-off, Outflow) and inflows table (Category, Balance, Counted, Outflow) with "Total, capped at 75% of outflows" |
| Stress | Run-off multiplier slider ×1.00–×3.00, step 0.05; live result: outflows, net outflows, "Early warning, 120%, at ×1.25", "Breach, 100%, at ×1.50", LCR; notice when below a threshold |
| Contingency plan | The plan's actions in order (Action, Raises, Time); after invoking, "Sent to the ALCO chair" |

### 2.4 ALM-2026-10 · Interest-rate risk

Lede: "Interest-rate risk in the banking book · October · repricing gap, earnings and economic value · for ALCO on 28 Oct". Pill: "Within limits at ±100bp" or "Outside a limit at ±100bp".

| Facts strip | Value |
|---|---|
| NII, next 12 months | ฿8.2bn |
| NII at ±100bp, worst | −฿0.38bn · "−4.7% · limit −5%" |
| EVE at ±100bp, worst | −฿2.04bn · "−9.3% of tier 1 · limit −15%" |
| Tier 1 capital | ฿22.0bn |

| Tab | Shows |
|---|---|
| Repricing gap | Bucket, Rate-sensitive assets, Rate-sensitive liabilities, Gap (warn when negative), Cumulative. Note that savings and current accounts are placed by the behavioural model, not at overnight |
| Rate shocks | Parallel shock slider −300 to +300bp, step 25; NII change, EVE change, limits state |

### 2.5 FX-26-10-0918 · FX forward

Lede: "Outright forward · Siam Freight Logistics buys USD 2,400,000 for value 22 Feb 2027 · to repay the LC-26-0412 trust receipt · dealer Teerapat S." Pills: "Booked 23 Oct 16:40"; confirmation state "MT300 mismatch" → "Waiting for the corrected MT300" → "Confirmations matched".

| Facts strip | Value |
|---|---|
| Amount | USD 2,400,000.00 |
| Forward rate | 35.8100 · "spot 36.0800" |
| THB to pay | ฿85,944,000 |
| Value date | 22 Feb 2027 |
| Line after deal | 93% of FX-B2031 (warn above 90%) |
| Mark-to-market, customer leg | −฿264,000 (bank's view) |

| Tab | Shows |
|---|---|
| Deal | Bank sells USD, buys THB; spot and points "36.0800 − 2700 = 35.8100"; trade date; purpose under the BOT FX rules with the underlying (trust receipt TR-26-0412) and evidence attached. Cover card: FX-26-10-0919 with Citibank N.A., Bangkok, bank buys USD 2,400,000 at 35.7950; sales margin ฿36,000 |
| Credit line | Pre-settlement line FX-B2031: limit ฿10,000,000, used before ฿4,100,000, this deal ฿5,156,640 (6% of notional for a 4-month forward), used after ฿9,256,640 · 93% |
| Confirmations (2) | Leg, Confirmed by, Our value date, Their value date, State. Customer leg matched (trade portal, e-signed); cover leg MT300 from Citibank: 22 Feb vs 23 Feb 2027, Mismatch |
| Settlement plan | 22 Feb 2027: Siam Freight pays ฿85,944,000 from CUR-B2031; bank pays USD 2,400,000 to the trust receipt; Citibank pays USD to NOS-USD-01; bank pays ฿85,908,000 by BAHTNET. Standing settlement instructions only; a change needs a call-back to a number on file |
| Mark-to-market | Market forward for 22 Feb 35.9200; customer leg −฿264,000; cover leg +฿300,000; bank's net = sales margin ฿36,000 |

### 2.6 NOS-EUR-01 · Nostro reconciliation

Lede: "EUR nostro at Deutsche Bank, Frankfurt · statement MT950 of 23 Oct 2026 against the general ledger 1150-EUR". Pills: "Break €1,200.00" → "Reconciled"; "Journal waiting for a checker" while prepared and not posted.

| Facts strip | Value |
|---|---|
| Our books | €3,418,200.00 → €3,417,000.00 once posted |
| Their statement | €3,417,000.00 |
| Difference | €1,200.00 (crit) → €0.00 |
| Open items | 2 → 0 |
| Open since | 23 Oct 2026 · "ageing limit 3 days" |

| Tab | Shows |
|---|---|
| Statement lines (4) | Date, What, Amount, Our reference, Their reference, State: two auto-matched, one suggested (€25,000 Lanna Craft, references differ), one "Not on our books" (€1,200 charges) |
| Journal | Debit 5410 Correspondent bank charges ฿46,980.00; credit 1150-EUR €1,200.00 @ 39.1500; state (Not prepared / Prepared by X, waiting for a different person / Posted); note on the tariff (€100 a month plus €50 per outgoing payment) |

## 3. Fields

| Dialog | Field | English label | Thai label | Type | Required | Source | Validation |
|---|---|---|---|---|---|---|---|
| `cfpInvoke` | `stage` | Stage | ระดับ | choice: `watch` "Early warning: ALCO meets, actions 1 and 2 on standby", `act` "Invoke: take actions 1 to 3 now" | Yes | Staff | — ; hint shows the stressed LCR at the current multiplier |
| `fxResolve` (mismatch) | `who` | Which is right | ข้อมูลใดถูกต้อง | choice: `ours` "Our booking, 22 Feb: the dealer's recording confirms it", `theirs` "Theirs, 23 Feb: amend our deal" | Yes | Staff | `theirs` is blocked at review |
| `fxResolve` (chased) | — | Their value date / Every other field | วันส่งมอบของคู่สัญญา / ช่องอื่นทั้งหมด | read-only | — | Incoming MT300 | — |
| `fxDeal` | `side` | We | ธนาคาร | choice: sell to customer, buy from customer | Yes | Dealer | — |
| `fxDeal` | `ccy` | Currency | สกุลเงิน | choice: USD 36.0000 / 36.0800, JPY 0.2410 / 0.2425, EUR 39.1500 / 39.2600 | Yes | Rates service (bid / offer) | — |
| `fxDeal` | `amt` | Amount | จำนวนเงิน | money (deal currency), default 2,400,000 | Yes | Dealer | > 0, else "Enter an amount." |
| `nosMatch` | — | Our entry / Their line / Why suggested | รายการของเรา / รายการของคู่สัญญา / เหตุที่เสนอ | read-only | — | Matcher | — |
| `nosPost`, `nosApprove` | — | Debit / Credit / Amount / Prepared by | เดบิต / เครดิต / จำนวนเงิน / จัดทำโดย | read-only | — | Reconciliation | — |

The LCR multiplier and the ALM shock are view controls, not saved fields: ×1.00–×3.00 step 0.05 and −300 to +300bp step 25.

## 4. Actions

| Action (flow) | Who | Refused or blocked when | Review shows | Approval | Effect | Core call |
|---|---|---|---|---|---|---|
| Invoke the contingency funding plan (`cfpInvoke`) | Treasurer | Already sent (button disabled) | Funding raised (฿20.0bn for `act`: actions 1–3; ฿0 for `watch`); who is told ("ALCO, the board risk committee and the BOT, today" or "ALCO"); consequence | `alco` action: no role holds it, so always "Send to Asset and liability committee chair" | Plan state = sent; pill "Contingency plan with ALCO"; the BOT is told the same day when invoked | **New** `POST /api/v1/treasury/liquidity/{reportId}/contingency-plan` |
| Resolve a confirmation mismatch: ours is right (`fxResolve`, `ours`) | Treasury ops | — | "Sends an MT399 asking Citibank to cancel and re-send its MT300 for 22 Feb…; escalated to the head of treasury ops if not by Monday noon" | None (operations) | Cover state mismatch → chased; MT399 sent | **New** `POST /api/v1/treasury/deals/{id}/confirmations/{leg}/query` (sends MT399) |
| Resolve: theirs is right (`fxResolve`, `theirs`) | Treasury ops | Always blocked: "A change to a booked deal needs the dealer's head to agree and moves the customer leg too… Use only if the recording supports it." | — | Head of dealing (outside this dialog) | — | **New** `POST /api/v1/treasury/deals/{id}/amendments` (future; not in this slice) |
| Record the corrected MT300 (`fxResolve` when chased) | Treasury ops | — | "Matches the cover leg; both legs are now confirmed and the deal goes to settlement on 22 Feb 2027." | None | Cover state → matched; deal Confirmed | **New** `POST /api/v1/treasury/deals/{id}/confirmations/{leg}/match` (normally automatic on MT300 receipt) |
| Book a spot deal (`fxDeal`) | Dealer | Open position after the deal over $25m: blocked, "Over the $25m open position limit · Cover the position first or ask the head of dealing." | Rate (offer when the bank sells, bid when it buys), value date 28 Oct 2026, open position after ($m), THB amount | `fx` with the THB amount: no role holds `fx`, so always "Send to Head of dealing" | Deal FX-26-10-0927 booked and sent for confirmation; position updated | **New** `POST /api/v1/treasury/deals` |
| Accept a suggested nostro match (`nosMatch`) | Treasury ops | Already matched | "Matches the two lines and teaches the matcher this reference pattern for Lanna Craft." | None | Line matched by the user; open items −1; pattern stored | **New** `POST /api/v1/treasury/nostros/{id}/matches` |
| Prepare the charges journal (`nosPost`) | Treasury ops | Already prepared or posted | "Prepares the journal. Someone other than you checks it before it posts." | Maker step of maker-checker | Journal prepared, maker recorded | **New** `POST /api/v1/journals` (status PREPARED) |
| Check and post the journal (`nosApprove`) | Anyone but the maker | The checker prepared it: "You prepared this journal · A different person must check it." | Debit 5410, credit 1150-EUR ฿46,980.00; consequence | Maker-checker, then `journal` with the THB amount (ops ฿1m, finance ฿50m; else Finance controller) | Journal posted; our books €3,417,000.00; break closed; the exception "NOS-EUR-01 · €1,200.00" in the exception centre is resolved | **New** `POST /api/v1/journals/{id}/approve` |

All other screen interactions (multiplier, shock) are read-only calculations and call **New** `GET` endpoints listed in §9.

## 5. States

**LCR report (LCR-2026-10).**

| State | Entered when | Next |
|---|---|---|
| Computed | Daily run after close of business | Contingency plan invoked; next day's report supersedes it |
| Contingency plan with ALCO | `cfpInvoke` sent | Closed by ALCO (outside the prototype) |

**FX deal (FX-26-10-0918 and cover FX-26-10-0919).**

| State | Entered when | Next |
|---|---|---|
| Booked | Dealer books within line and position limits (or after the head of dealing approves) | Confirmed, Mismatch |
| Mismatch | Incoming confirmation differs in any field | Chased (MT399 sent), Amended (needs the head of dealing) |
| Chased | MT399 sent | Confirmed when the corrected MT300 matches; escalated if not by Monday noon |
| Confirmed | Both legs matched | Settled on value date |
| Settled | Value-date payments made and nostro credited | — |

**Nostro statement line.**

| State | Entered when | Next |
|---|---|---|
| Matched automatically | Same amount, date and reference | — |
| Suggested | Same amount and date, references differ | Matched by a user |
| Not on our books | Statement line with no ledger entry | Booked, once a journal is prepared and approved |
| Booked | Journal posted | — |

**Journal.** Not prepared → Prepared (maker) → Posted (a different checker, within the `journal` limit) or sent to the finance controller when above it.

## 6. Postings

| Event | Debit | Credit | Amount |
|---|---|---|---|
| Nostro charges (NOS-EUR-01) | 5410 Correspondent bank charges | 1150-EUR Nostro, Deutsche Bank | €1,200.00 = ฿46,980.00 @ 39.1500 |
| Forward settlement, customer leg (22 Feb 2027) | 2100 CUR-B2031 | FX position THB / bank's USD to the trust receipt | ฿85,944,000 / USD 2,400,000 |
| Forward settlement, cover leg | 1150-USD NOS-USD-01 | BAHTNET settlement account | USD 2,400,000 / ฿85,908,000 |
| Spot deal (value 28 Oct) | 2100 customer current account (bank sells) | FX position | THB amount at the offer rate |

GL codes for the FX position and BAHTNET settlement accounts are not named in the prototype; the accounting team assigns them in `accounting` GL mapping (open question 4). Forward revaluation postings belong to the revaluation run (close step "Revalue foreign currency", spec 11).

## 7. Configurable values

| Key | Prototype value | Set by | Rule (to confirm) |
|---|---|---|---|
| `lcr.minimum` | 100% | Regulator, locked | BOT LCR notification |
| `lcr.earlyWarning` | 120% | Bank (ALCO) | Internal risk appetite |
| `lcr.haircut.L1` / `L2A` / `L2B` | 0% / 15% / 50% | Regulator, locked (bank may be stricter) | BOT LCR notification |
| `lcr.cap.L2` | 40% of HQLA (implemented as L2 ≤ ⅔ × L1) | Regulator, locked | BOT LCR notification |
| `lcr.cap.L2B` | 15% of HQLA (implemented as L2B ≤ 15/85 × (L1 + L2A)) | Regulator, locked | BOT LCR notification |
| `lcr.inflowCap` | 75% of outflows | Regulator, locked | BOT LCR notification |
| `lcr.runoff.<category>` | stable retail 5%, less stable retail 10%, SME as retail 10%, operational corporate 25%, non-operational corporate 40%, financial institutions 100%, committed credit lines 10%, committed liquidity facilities 30%, derivatives and other 100% | Regulator, locked (floors) | BOT LCR notification |
| `lcr.inflowRate.<category>` | performing loans maturing in 30 days 50%; interbank placements 100% | Regulator, locked | BOT LCR notification |
| `lcr.stress.multiplierRange` | ×1.00–×3.00 step 0.05, applied to deposits only | Bank | Internal stress design |
| `cfp.actions` | 1 Repo Thai government bonds with the BOT ฿10.0bn same day; 2 Draw committed interbank lines ฿4.0bn 1 day; 3 Raise term deposit rates 25bp for 3–6 months ฿6.0bn 2 weeks; 4 Slow new corporate lending commitments ฿3.0bn 1 month | Board | Board-approved contingency funding plan, tested twice a year |
| `irrbb.niiLimit` | −5% of 12-month NII | Bank (board) | Internal limit; BOT IRRBB guideline |
| `irrbb.eveLimit` | −15% of tier 1 | Bank (board), regulator outlier test | BOT IRRBB guideline (outlier test at 15% of tier 1) |
| `irrbb.buckets` | ≤1m, 1–3m, 3–6m, 6–12m, 1–3y, 3–5y, >5y with NII weights 11.5/12, 10/12, 7.5/12, 3/12, 0, 0, 0 and durations 0.04, 0.17, 0.375, 0.75, 2, 4, 7 | Bank (ALM) | Behavioural model for non-maturity deposits |
| `irrbb.shockRange` | −300 to +300bp step 25 | Bank | BOT IRRBB standard shocks (to confirm) |
| `fx.openPositionLimit` | $25.0m net per currency, in USD equivalent | Bank (board), within BOT NOP limit | BOT net open position rules |
| `fx.pfeAddOn` | 6% of notional for a 4-month forward | Bank (credit risk) | Internal pre-settlement risk table by tenor |
| `fx.lineWarn` | 90% of the counterparty line | Bank | — |
| `fx.purposeEvidence` | Underlying required for customer forwards | Regulator, locked | BOT FX regulations (underlying transactions) |
| `nostro.ageingLimit` | 3 days | Bank (treasury ops) | Internal control |
| `nostro.matchRules` | auto: amount + date + reference; suggest: amount + date | Bank | — |
| Action limit `fx` | no role | Bank | Authority matrix (head of dealing approves) |
| Action limit `alco` | no role | Bank | Authority matrix (ALCO chair approves) |
| Action limit `journal` | ops ฿1,000,000; finance ฿50,000,000 | Bank | Authority matrix (finance controller above) |

## 8. Acceptance criteria

| # | Given | When | Then |
|---|---|---|---|
| T1 | LCR-2026-10 with default data | the page opens | LCR shows 148%, HQLA ฿44.10bn, outflows ฿42.80bn, inflows ฿13.00bn |
| T2 | the Stress tab | the multiplier is set to ×2.00 | LCR shows 72%, a "Below the BOT minimum" notice asks to invoke the plan and tell the BOT; early warning at ×1.25, breach at ×1.50 |
| T3 | the multiplier between ×1.25 and ×1.45 | — | the "Early-warning trigger · The treasurer convenes ALCO within the day." notice shows |
| T4 | the treasurer | invokes the plan with stage "Invoke" | review shows funding raised ฿20.0bn and "ALCO, the board risk committee and the BOT, today"; the confirm button reads "Send to Asset and liability committee chair"; afterwards the plan button is disabled and the list row shows "Contingency plan with ALCO" |
| T5 | ALM-2026-10 | the page opens | NII at ±100bp worst −4.7% and EVE −9.3% of tier 1; pill "Within limits at ±100bp" |
| T6 | the Rate shocks tab | shock +200bp | "Outside: NII −5%, EVE −15% of tier 1" |
| T7 | FX-26-10-0918 with the cover MT300 at 23 Feb | treasury ops chooses "Theirs" | the review is blocked with the dealer's-head message |
| T8 | the same deal | ops chooses "Ours" and confirms | "MT399 sent to Citibank."; state Chased; the button becomes "Record the corrected MT300" |
| T9 | the deal is Chased | ops records the corrected MT300 | "Confirmations matched."; both legs Matched; deals list shows Confirmed |
| T10 | NOS-EUR-01 with a €1,200 break | ops accepts the suggested match | the €25,000 line shows "Matched by Ploy C."; open items 1 |
| T11 | the same nostro | ops prepares the journal, then tries to approve it | the approval is blocked: "You prepared this journal" |
| T12 | a journal prepared by ops | finance approves it | review shows ฿46,980.00; "Journal posted."; difference €0.00; pill Reconciled; the nostro row shows Matched; the exception centre no longer lists NOS-EUR-01 |
| T13 | the spot deal dialog with USD position $12.4m | the bank buys USD 15,000,000 | position after $27.4m: blocked, "Over the $25m open position limit · Cover the position first or ask the head of dealing." |
| T14 | the spot deal dialog, defaults | Next | rate 36.0800, value date 28 Oct 2026, position after 10.00, THB ฿86,592,000.00; confirm reads "Send to Head of dealing" |
| T15 | Thai language | each treasury page and tab opens | no untranslated tab or column label; dates in Buddhist years |

## 9. Gaps against the core

There is no treasury module today (no controller, no domain code). Everything here is **New**, owned by the planned `treasury` service with `market-data` and the `accounting` / `ledger` modules (doc 12 §5).

| Method | Path | Purpose | Owning module |
|---|---|---|---|
| GET | `/api/v1/treasury/overview` | The overview figures and attention list | treasury |
| GET | `/api/v1/treasury/liquidity/lcr?asOf=` | LCR report: HQLA lines, outflows, inflows, ratio | treasury |
| GET | `/api/v1/treasury/liquidity/lcr/stress?multiplier=` | Stressed LCR and the two threshold multipliers | treasury |
| POST | `/api/v1/treasury/liquidity/{reportId}/contingency-plan` | Invoke (watch or act) the contingency funding plan, routed to the ALCO chair | treasury |
| GET | `/api/v1/treasury/alm/gap?asOf=` | Repricing gap by bucket | treasury |
| GET | `/api/v1/treasury/alm/shock?bp=` | NII and EVE change and limit state | treasury |
| POST | `/api/v1/treasury/deals` | Book a spot or forward deal with line and position checks | treasury |
| GET | `/api/v1/treasury/deals/{id}` | Deal, cover link, line use, confirmations, settlement plan, MTM | treasury |
| POST | `/api/v1/treasury/deals/{id}/confirmations/{leg}/query` | Send an MT399 asking the counterparty to correct its confirmation | treasury + payments-hub (SWIFT) |
| POST | `/api/v1/treasury/deals/{id}/confirmations/{leg}/match` | Match a confirmation (manual; auto on MT300 receipt) | treasury |
| POST | `/api/v1/treasury/deals/{id}/amendments` | Amend a booked deal with the head of dealing's agreement (later slice) | treasury |
| GET | `/api/v1/treasury/positions` | Currency positions against limits | treasury |
| GET | `/api/v1/treasury/nostros/{id}` | Statement lines, our entries, match state, difference | treasury |
| POST | `/api/v1/treasury/nostros/{id}/matches` | Accept a suggested match | treasury |
| POST | `/api/v1/journals` | Prepare a manual journal (maker) | accounting / ledger |
| POST | `/api/v1/journals/{id}/approve` | Check and post a journal (checker ≠ maker, `journal` limit) | accounting / ledger |
| GET | `/api/v1/rates/fx?ccy=` | Bid and offer, forward points | market-data |

Also needed: MT300, MT399 and MT950 handling in payments-hub; the contingent / position balance types from doc 12 §1; the `fx` and `alco` actions in the authority store.

## 10. Open questions

1. LCR caps: confirm the BOT formula for the level 2 and level 2B caps (adjusted amounts after unwinding secured transactions) before implementing Appendix A.1.
2. NSFR: build the calculation, or keep it as an imported figure for the first release?
3. ALM: who owns the behavioural model for non-maturity deposits, and how often is it recalibrated? Which BOT shock scenarios (parallel only, or the six standard shocks)?
4. GL codes for the FX position, revaluation and BAHTNET settlement accounts are not in the prototype.
5. Should the spot deal dialog require the purpose and underlying evidence, as the forward does under the BOT FX rules?
6. Should a confirmation mismatch past "Monday noon" raise an exception-centre item automatically, with an owner and a clock?
7. The ALCO card now says earnings break their limit first, near +107bp, and economic value near +161bp. Confirm which limit ALCO acts on first.

## Appendix A. Calculations

### A.1 LCR

Inputs in ฿bn: HQLA lines (level, market value, haircut), outflow lines (balance, run-off rate, is-deposit), inflow lines (balance, inflow rate); a run-off multiplier `m` (default 1).

```
L1   = Σ market value of level 1                       (haircut 0)
L2A  = Σ market value of level 2A × (1 − 0.15)
L2Br = Σ market value of level 2B × (1 − 0.50)
L2B  = min(L2Br, 15/85 × (L1 + L2A))
L2   = min(L2A + L2B, 2/3 × L1)
HQLA = L1 + L2
rate_i(m) = min(1, rate_i × m)   if line i is a deposit
          = rate_i               otherwise (credit and liquidity lines, derivatives)
Out  = Σ balance_i × rate_i(m)
In   = Σ balance_j × inflowRate_j
InC  = min(In, 0.75 × Out)
Net  = Out − InC
LCR  = HQLA / Net × 100
```

Thresholds: the smallest `m` from 1.00 upward in steps of 0.05 where LCR < 120% (early warning) and where LCR < 100% (breach); "—" if none up to ×4.

Worked example (default data):

| Item | Value |
|---|---|
| L1 = 12.4 + 24.6 | ฿37.00bn |
| L2A = 6.0 × 0.85 | ฿5.10bn |
| L2B = min(4.0 × 0.5, 15/85 × 42.1) | ฿2.00bn |
| HQLA | ฿44.10bn |
| Outflows = 3.0 + 3.4 + 1.8 + 5.5 + 17.6 + 8.0 + 1.2 + 0.6 + 1.7 | ฿42.80bn |
| Inflows = 14.0 × 0.5 + 6.0 × 1.0 (cap 32.10) | ฿13.00bn |
| Net outflows | ฿29.80bn |
| LCR | 147.99% (shown 148%) |
| ×1.25 | 117.2% (early warning) |
| ×1.50 | 97.0% (breach) |
| ×2.00 | 72.2% |

Open question 1: the Basel and BOT cap formulas work on adjusted amounts (after unwinding secured funding); the prototype's simpler form must be checked against the notification before implementation.

### A.2 Repricing gap, NII and EVE

For each bucket `b`: assets `A_b`, liabilities `L_b` (฿bn), NII weight `w_b` (fraction of the year left after repricing, zero beyond one year) and modified duration `d_b` (years).

```
gap_b  = A_b − L_b
cum_b  = Σ gap up to b
ΔNII(s) = Σ gap_b × w_b × s          s = shock in decimal (100bp = 0.01)
ΔEVE(s) = − Σ gap_b × d_b × s
NII%  = ΔNII / NII_base × 100        NII_base = ฿8.2bn
EVE%  = ΔEVE / Tier1 × 100           Tier1 = ฿22.0bn
worst(±s) = min over +s and −s, for each of NII and EVE
limits: NII% ≥ −5 and EVE% ≥ −15
```

| Shock | ΔNII | NII% | ΔEVE | EVE% | Limits |
|---|---|---|---|---|---|
| +100bp | −฿0.384bn | −4.68% | −฿2.044bn | −9.29% | Within |
| −100bp | +฿0.384bn | +4.68% | +฿2.044bn | +9.29% | Within |
| +150bp | −฿0.576bn | −7.03% | −฿3.067bn | −13.94% | Outside (NII) |
| +175bp | −฿0.672bn | −8.20% | −฿3.578bn | −16.26% | Outside (both) |
| +200bp | −฿0.768bn | −9.37% | −฿4.089bn | −18.59% | Outside (both) |

Note: at +150bp NII is already outside its −5% limit (it crosses near +107bp); EVE crosses its −15% limit near +161bp. The prototype's ALCO card says so.

### A.3 FX forward

```
points       = (forward − spot) × 10,000                  = (35.8100 − 36.0800) × 10,000 = −2,700
THB to pay   = notional × forward                          = 2,400,000 × 35.81 = ฿85,944,000
PFE add-on   = THB × pfeAddOn(tenor)                       = 85,944,000 × 6% = ฿5,156,640
line used    = used before + PFE add-on                    = 4,100,000 + 5,156,640 = ฿9,256,640 (93% of ฿10m)
MTM customer = (market forward − deal rate) × notional     = (35.92 − 35.81) × 2.4m = ฿264,000 to the customer (shown −฿264,000 for the bank)
MTM cover    = (market forward − cover rate) × notional    = (35.92 − 35.795) × 2.4m = +฿300,000
sales margin = (deal rate − cover rate) × notional         = ฿36,000
```

### A.4 Spot deal open position

USD-equivalent of the deal: USD at par, JPY × 0.0067, EUR × 1.08 (in $m). Position after = current position (USD 12.4, JPY 1.93, EUR 1.1) − deal if the bank sells, + deal if it buys. Blocked when |position after| > 25. Rate = offer when the bank sells, bid when it buys. Default (sell USD 2,400,000): rate 36.0800, THB ฿86,592,000.00, position after 10.00.

### A.5 Nostro matching

| Rule | Condition | Result |
|---|---|---|
| Auto | Same amount, same value date, our reference appears in their reference (`/RFB/<ours>`) | Matched automatically |
| Suggest | Same amount and value date, references differ | Suggested; a user accepts, and the reference pattern is learnt for that customer |
| Unmatched theirs | Statement line with no candidate | "Not on our books"; needs a journal |
| Difference | our books − their statement | €3,418,200 − €3,417,000 = €1,200.00 |

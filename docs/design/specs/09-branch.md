# 09 · Branch

Spec for the Branch & Teller system of the production console: the counter, the teller's cash drawer, the vault, and the end of day. It covers the everyday cash deposit and withdrawal, the large withdrawal above a teller's authority, the large cash deposit over the AMLO reporting threshold, the suspect note, top-ups and sell-backs under dual control, and closing the branch day.

Prototype sources: `js/branch.js` (pages `branch/counter`, `branch/drawer`, `branch/vault`, `branch/eod`); the `deposit` and `withdraw` flows and the `DRAWER` noon count in `js/flows.js` and `js/records.js`; the branch queue list in `js/data.js`. Branch 0123 on Saturday 24 Oct 2026, open 09:00–15:00; teller Somsak J. at counter 3.

The AMLO and BOT thresholds below are the prototype's reading and are *to confirm*.

## 1. Scope and users

| In scope | Out of scope |
|---|---|
| Counter transactions in cash for any account | Account opening at the branch (01) |
| Controls: authority, ID re-check, scam check, source of funds, CTR, structuring alert, counterfeit notes | AML investigation after the alert (07, compliance) |
| Drawer: float, movements, denomination count, limits | Cash-in-transit contract and pickup scheduling (only the order is raised) |
| Vault: dual control, movements, count, insurance limit | ATM cash (not in the prototype) |
| End of day: counts, differences, sell-back, vault count, checklist, sign-off | Cheque clearing itself (only the checklist item) |

| Role | May do |
|---|---|
| Teller (`teller`) | Deposits and withdrawals up to the `cash` authority ฿500,000; cash deposits up to ฿1,999,999 (`cashin`); suspect notes; vault top-up and sell-back with a second person; count the drawer; prepare the close |
| Branch manager (`manager` in the prototype, Rattikorn Boonsri) | `cash` up to ฿5,000,000; `cashin` up to ฿10,000,000; approve differences up to ฿1,000 (`overshort`); sign off the branch day (`branchclose`) |
| Vault custodians (Wipa K. manager, Kanokwan S. assistant) | Each holds one key and half the combination; second person for vault movements and the vault count |
| Regional manager, audit | Receive unexplained vault differences and repeated teller differences |

## 2. Screens

| Route | Page | Facts strip | Content |
|---|---|---|---|
| `branch/counter` | Counter | SAV-C10 balance, LN-A-C10 overdue, This counter today (transactions), Drawer (with ฿500,000 limit), Your cash authority | Banner when the drawer is over ฿500,000 ("Sell the excess to the vault before the next cash transaction.") or under ฿100,000 ("Ask the vault for a top-up."); the customer at the counter (ticket, ID read and DOPA check); service tiles: Cash deposit, Cash withdrawal, Large withdrawal, Large cash deposit, Suspect note, Pay a loan; "Today at this counter" (items waiting for the branch manager, the retained note) |
| `branch/drawer` | Cash drawer | Opening float ฿400,000.00 (09:02, dual control), Cash in, Cash out, Expected, Last count | Count by denomination (the 12:00 count until the end-of-day count); Movements today: time, service, reference, in, out (cheques marked "not cash"; foreign cash marked "USD to the FX drawer") |
| `branch/vault` | Vault | Opening balance ฿20,700,000, Floats issued, In the vault now, Insurance limit ฿25,000,000, Custodians | Movements with the tellers; notice when counted and balanced |
| `branch/bqueue` | Branch queue | — | Ticket, Customer, Service, Waiting, Counter, State |
| `branch/eod` | End of day | — | Six steps with their buttons (below); Drawers table: counter, teller, expected, counted, difference, state; Close checklist |

End-of-day steps, each done before the next button is offered:

| # | Step | Done when | Button (flow) |
|---|---|---|---|
| 1 | Every drawer counted and balanced | All four drawers balanced (counter 3 counted with no difference, or its difference approved) | Count (`brCount`) |
| 2 | Differences explained and approved | No difference, or the difference posted to GL 1990 | Approve the difference (`brDiff`) |
| 3 | Drawers sold back to the vault | All four sold back under dual control | Sell back (`brSellBack`) |
| 4 | Vault counted and balanced | Vault count equals expected | Count the vault (`brVaultCount`) |
| 5 | Close checklist | All five items ticked | — (checkboxes) |
| 6 | Branch manager signs off | Signed | Sign off (`brClose`) |

Close checklist items: cheques for clearing (38 sent, 38 on the list); cash transaction reports for today prepared for AMLO; passbook stock (412 expected, 410 counted; 2 spoiled destroyed under dual control); keys and combinations log signed by both custodians; CCTV recording for today backed up.

## 3. Fields

### Cash deposit (`deposit`) and cash withdrawal (`withdraw`)

| Field | English | Thai | Type | Required | Validation |
|---|---|---|---|---|---|
| `acct` | Account | บัญชี | choice | Yes | Customer's accounts |
| `amount` | Amount | จำนวนเงิน | money (THB) | Yes | > 0: "Enter an amount in baht." Withdrawal ≤ balance: "SAV-C10 holds only ฿X." Withdrawal ≤ drawer cash: "Your drawer does not hold that much cash; ask the vault." |
| `source` | Source of funds | แหล่งที่มาของเงิน | text | Deposit ≥ ฿2,000,000 | "Say where the money comes from: it is required from ฿2,000,000." |

Withdrawals above ฿50,000 show "Check the ID card against the customer again".

### Large withdrawal (`brBigOut`)

| Field | English | Thai | Type | Required | Validation |
|---|---|---|---|---|---|
| `amount` | Amount | จำนวนเงิน | money | Yes | ≤ account balance (SAV-20871 ฿1,284,300.00): "SAV-20871 holds only ฿1,284,300.00." |
| `why` | What it is for | วัตถุประสงค์ | choice | Yes | `car` Paying for a used car, seller present; `told` Someone on the phone told them to; `other` Other |
| `id` | ID card read again and the signature matches | อ่านบัตรประชาชนซ้ำและลายมือชื่อตรงกัน | checkbox | Yes | "Check the ID card again before a withdrawal this size." |

Hint for customers aged 70 or over: "Ask what the money is for and whether anyone told them to withdraw it."

### Large cash deposit (`brBigIn`)

| Field | English | Thai | Type | Required | Validation |
|---|---|---|---|---|---|
| `amount` | Amount | จำนวนเงิน | money | Yes | Counted by the note counter, which checks each note |
| `src` | Source of the cash | แหล่งที่มาของเงินสด | text | ≥ ฿2,000,000 | "Say where the cash comes from: required from ฿2,000,000." |
| `id` | The person depositing showed ID | ผู้นำฝากแสดงบัตร | checkbox | Yes | "Record the ID of the person depositing." |

### Suspect note (`brFake`)

| Field | English | Thai | Type | Required | Values |
|---|---|---|---|---|---|
| `den` | Note | ธนบัตร | choice | Yes | ฿1,000, ฿500, ฿100 |
| `serial` | Serial number | หมายเลขธนบัตร | text | Yes | "Record the serial number." |

### Vault top-up or sell-back (`brVault`), sell-back at end of day (`brSellBack`)

| Field | English | Thai | Type | Required | Validation |
|---|---|---|---|---|---|
| `dir` | Direction | ทิศทาง | choice | Yes (`brVault`) | `sell` (default when over ฿500,000), `top` |
| `amount` | Amount | จำนวนเงิน | money | Yes (`brVault`) | Sell ≤ drawer: "Your drawer does not hold that much." Default sell amount rounds the excess over ฿400,000 up to ฿100,000 |
| `sec` | Second person | ผู้ควบคุมคนที่สอง | choice | Yes | Wipa K. (vault custodian), Kanokwan S. (assistant manager); the teller themself: "Dual control: the second person cannot be the teller." |

### Count the drawer (`brCount`)

| Field | English | Type | Required | Validation |
|---|---|---|---|---|
| `counts[den]` | Note ฿1,000 / ฿500 / ฿100 / ฿50 / ฿20; Coin ฿10 / ฿5 / ฿2 / ฿1 | whole number per denomination | Yes | Each ≥ 0: "Enter a whole number for every denomination." |
| `why` | If it does not balance: what happened | text | When counted ≠ expected | "It does not balance: explain the difference." |

### Count the vault (`brVaultCount`)

| Field | English | Type | Required | Validation |
|---|---|---|---|---|
| `amount` | Counted | money | Yes | ≥ 0: "Enter the amount counted." |

## 4. Actions

| Action | Who | Refused or blocked when (message) | Review shows | Approval rule | Effect | Core call |
|---|---|---|---|---|---|---|
| Cash deposit `deposit` | Teller | Amount ≥ ฿2,000,000 without source | Credits ฿X; drawer goes up by the same; ≥ ฿2m: "A supervisor approves before the money is credited. The AMLO cash transaction report is filed automatically." | `cash` below ฿2m; ≥ ฿2m see `brBigIn` | Account credited; drawer cash in; receipt | `POST /api/v1/accounts/{id}/deposits` (exists) + **New** drawer movement |
| Cash withdrawal `withdraw` | Teller | Over balance; over drawer cash | Pays out ฿X; ID re-check notice above ฿50,000 | `cash` (teller ฿500,000; ops ฿2,000,000; else Branch manager) | Account debited; drawer cash out | `POST /api/v1/accounts/{id}/withdrawals` (exists) + **New** drawer movement |
| Large withdrawal `brBigOut` | Teller | Purpose "told": "Possible scam: do not pay… The account gets a 24-hour hold under the bank's scam rules." ID not re-checked | Drawer now, top-up from the vault first, paid out, drawer after; "Pays ฿650,000.00 from SAV-20871 in ฿1,000 notes, counted twice in front of the customer and the camera." | `cash`: teller ฿500,000 → Branch manager | On approval: vault top-up (if the drawer would fall under ฿100,000) then the withdrawal; while waiting, shown in "Today at this counter" | `POST /api/v1/accounts/{id}/withdrawals` (exists) after **New** `POST /api/v1/approvals/{id}/decision`; scam hold via **New** `POST /api/v1/accounts/{id}/holds` |
| Large cash deposit `brBigIn` | Teller | No source ≥ ฿2m; no depositor ID | CTR notice; structuring notice ("Three cash deposits of ฿1.90m–฿1.98m in the past 14 days… Referred to compliance as an alert; the customer is not told."); drawer after and excess to the vault | `cashin`: teller ฿1,999,999; ops ฿10,000,000; else Branch manager | Credit; CTR prepared in today's file; AML alert raised; drawer then over the limit | `POST /api/v1/accounts/{id}/deposits` (exists) + **New** `POST /api/v1/aml/ctr` + **New** `POST /api/v1/aml/alerts` |
| Suspect note `brFake` | Teller | No serial | "Retains the ฿1,000 note; it is not credited and is never handed back. The customer gets receipt CF-26-1024-01 with the serial number. The note and the report go to the BOT, and the police are told." | Single | Note recorded; receipt printed; added to the BOT shipment with Monday's pickup | **New** `POST /api/v1/branches/{id}/counterfeit-notes` (branch) |
| Vault top-up or sell `brVault` | Teller + second person | Second person is the teller; sell more than the drawer holds | Drawer now, to / from the vault, drawer after; "Both people count the cash and sign the slip; the drawer and the vault move together in the ledger." | Dual control | Drawer and vault move in one posting | **New** `POST /api/v1/branches/{id}/vault/movements` (branch) |
| Count the drawer `brCount` | Teller | Bad count; difference without explanation | Expected, counted, difference; on a difference: "The drawer cannot be sold back until the branch manager approves the difference; it is posted to GL 1990 Teller over and short." | Single | Count recorded; difference pending with the explanation | **New** `POST /api/v1/branches/{id}/drawers/{drawerId}/counts` |
| Approve the difference `brDiff` | Branch manager | Teller tries: "Needs a second approver: the branch manager." | Difference, teller's explanation, this teller's last 90 days; "Posts ฿100.00 to GL 1990… a shortage is recovered from the teller if not found within 7 days; repeated differences go to audit." | `overshort`: ops ฿1,000; teller none | Difference posted; drawer balanced | **New** `POST /api/v1/branches/{id}/drawers/{drawerId}/differences/{diffId}/approval` |
| Sell back `brSellBack` | Teller + second person | Drawer not balanced: "The drawer does not balance yet. Count it, and have any difference approved first." Second person is the teller | "The whole drawer goes to the vault in sealed bags, counted and signed by two people." | Dual control | Drawer to zero; vault up | **New** vault movement with `kind=sellback` |
| Count the vault `brVaultCount` | Two custodians | A drawer still out: "A drawer is still out. Counter 3 has not sold back yet." Difference: "The vault is short/over ฿X. Recount with both custodians; an unexplained vault difference is reported to the regional manager and audit before the branch can close." | Expected, counted, difference 0; over ฿25m: "A cash pickup is ordered for Monday 08:30." | Dual control | Vault balanced; pickup ordered when over the insurance limit | **New** `POST /api/v1/branches/{id}/vault/counts` |
| Tick a checklist item | Branch staff | Branch closed | — | Single | Item done | **New** `PUT /api/v1/branches/{id}/days/{date}/checklist/{item}` |
| Sign off `brClose` | Branch manager | Anything open: "Not ready to close. Still open: counter 3 does not balance; counter 3 has not sold back; the vault is not counted; the checklist is not finished; a withdrawal waits for approval; a deposit waits for approval." | "Closes branch 0123 for the day. The cash position, the CTR file and the day's report go to operations and finance; the branch reopens Monday." | `branchclose` (Branch manager only) | Branch day `closed`; reports sent | **New** `POST /api/v1/branches/{id}/days/{date}/close` |
| Call next ticket | Teller | — | — | — | Next queue ticket to this counter | **New** `POST /api/v1/branches/{id}/queue/next` |

The core today has `POST /api/v1/accounts/{id}/deposits` and `/withdrawals` (role `ops`); drawers, vaults, branch days, CTRs and counterfeit notes are new. The existing deposit endpoint requires the actor role `ops` and has no teller identity or drawer; the teller role must be added.

## 5. States

### Teller drawer (per teller per day)

| State | Entered by | Next |
|---|---|---|
| `issued` | Opening float from the vault under dual control | `open` |
| `open` | First transaction | `counted` |
| `counted, balanced` | `brCount` with no difference | `sold back` |
| `counted, difference` | `brCount` with a difference | `counted, approved` via `brDiff` |
| `counted, approved` | Difference posted to GL 1990 | `sold back` |
| `sold back` | `brSellBack` under dual control | — |

### Branch day

| State | Entered by | Next |
|---|---|---|
| `open` | Vault opened by two custodians (08:45) | `closing` |
| `closing` | First end-of-day count | `closed` when all six steps are done |
| `closed` | `brClose` by the branch manager | Reopens on the next business day |

### Counter transaction waiting for approval

`entered` → `waiting for branch manager` (above the teller's authority) → `approved` (posted, receipt) or `declined`. A branch day cannot close with any item waiting.

## 6. Postings

| Event | Debit | Credit | Amount (prototype) |
|---|---|---|---|
| Opening float | Teller drawer, counter 3 | Branch vault 0123 | ฿400,000.00 |
| Cash deposit | Teller drawer | Customer account | e.g. ฿2,150,000.00 to CUR-R4410 |
| Cash withdrawal | Customer account | Teller drawer | e.g. ฿650,000.00 from SAV-20871 |
| Vault top-up | Teller drawer | Vault | e.g. ฿500,000.00 (VLT-1305) |
| Sell to vault | Vault | Teller drawer | e.g. ฿200,000.00 (VLT-1020) |
| Foreign cash bought | FX drawer (USD) | Teller drawer (THB) | ฿17,800.00 for USD 500 at 35.60 |
| Cheque deposit | Clearing receivable | Customer account | not cash; not in the drawer |
| Teller shortage | GL 1990 Teller over and short | Teller drawer | ฿100.00 |
| Teller overage | Teller drawer | GL 1990 Teller over and short | — |
| End-of-day sell-back | Vault | Teller drawer | counted amount |
| Suspect note | Off-balance register only | — | Never credited |

Drawer arithmetic: expected = sum of cash in − cash out over the day's movements, including vault movements; cheques and foreign cash are excluded from the THB drawer. Prototype: 400,000 + 25,000 − 8,000 − 200,000 + 2,340 − 45,000 + 120,500 − 17,800 + 17,795 = ฿294,835.00, matching the 12:00 count (212 × ฿1,000, 88 × ฿500, 310 × ฿100, 64 × ฿50, 145 × ฿20, 120 × ฿10, 80 × ฿5, 40 × ฿2, 55 × ฿1).

Vault arithmetic: opening ฿20,700,000 − floats to counters 1, 2 and 4 ฿2,100,000 − counter 3's float ฿400,000 + counter 3's sale ฿200,000 = ฿18,400,000 now; after sell-backs (counters 1, 2, 4: ฿612,300 + ฿855,140 + ฿1,178,925; counter 3: its counted amount) the vault is counted against that total.

## 7. Configurable values

| Key | Prototype value | Set by | Rule (to confirm) |
|---|---|---|---|
| `drawer.limit` | ฿500,000 | Bank (operations) | Over it, sell the excess before the next cash transaction |
| `drawer.minimum` | ฿100,000 | Bank | Under it, top up from the vault |
| `drawer.denominations` | ฿1,000, 500, 100, 50, 20 notes; ฿10, 5, 2, 1 coins | Regulator (BOT), locked | — |
| `authority.cash` | teller ฿500,000; ops ฿2,000,000; else Branch manager | Bank | — |
| `authority.cashin` | teller ฿1,999,999; ops ฿10,000,000; else Branch manager | Bank | Teller below the CTR threshold only |
| `authority.overshort` | ops ฿1,000; else Branch manager | Bank | — |
| `withdrawal.idRecheckAbove` | ฿50,000 | Bank | Read the ID card again |
| `scam.ageForPrompt` | 70 | Bank | Ask the purpose and whether anyone told them to withdraw |
| `scam.holdHours` | 24 | Bank | When a third party directed the withdrawal |
| `aml.ctrThreshold` | ฿2,000,000 cash, inclusive | Regulator (AMLO), locked | CTR prepared at once, filed in the day's file; source of funds required |
| `aml.structuringRule` | 3 deposits of ฿1.90m–฿1.98m within 14 days | Bank (compliance) | Alert to compliance; customer not told |
| `teller.shortageRecoveryDays` | 7 | Bank (HR policy) | Recovered from the teller if not found |
| `vault.insuranceLimit` | ฿25,000,000 | Bank | Over it, order a cash pickup |
| `branch.saturdayHours` | 09:00–15:00 | Bank | — |
| `counterfeit.receiptPrefix` | CF-yy-mmdd-nn | Bank | Note retained; to the BOT with the next pickup; police told |

## 8. Acceptance criteria

| # | Given | When | Then |
|---|---|---|---|
| 1 | Counter 3 at 12:00 | The drawer page opens | Expected ฿294,835.00; the 12:00 count by denomination adds up to it; cheque CHQ-1112 shows "not cash" and FX-1215 "USD to the FX drawer" |
| 2 | Teller, SAV-20871 | Large withdrawal ฿650,000 for a used car with ID re-checked | Review shows a vault top-up of ฿500,000.00 first and the drawer after ฿144,835.00; "Needs a second approver: the branch manager."; listed under "Today at this counter" |
| 3 | Same | Purpose "Someone on the phone told them to" | Blocked: "Possible scam: do not pay"; 24-hour hold on the account |
| 4 | Same | ID not re-checked | Entry step: "Check the ID card again before a withdrawal this size." |
| 5 | Branch manager approves the withdrawal | — | Vault top-up and withdrawal posted; drawer updated |
| 6 | Teller, CUR-R4410 | Large cash deposit ฿2,150,000 with source and depositor ID | CTR notice and structuring notice shown; "Needs a second approver: the branch manager." |
| 7 | `ops` accepts the deposit | — | Credited; CTR in today's file; drawer over the limit and the counter banner says to sell the excess |
| 8 | A suspect ฿1,000 note | Teller records serial 6J 4518832 | Receipt CF-26-1024-01; the note is not credited; the end-of-day checklist notes it goes to the BOT with Monday's pickup |
| 9 | Vault movement | Second person is the teller | "Dual control: the second person cannot be the teller." |
| 10 | Counter 3 not counted | Sell back | Blocked: "The drawer does not balance yet." |
| 11 | Teller counts one ฿100 note short with an explanation | Record the count | Difference −฿100.00; step 1 shows 3 of 4 balanced; the difference waits for the branch manager |
| 12 | Same | The teller opens Approve the difference | "Needs a second approver: the branch manager." |
| 13 | Branch manager approves | — | ฿100.00 to GL 1990; counter 3 "Approved"; step 3 offers Sell back |
| 14 | Counter 3 still out | Count the vault | Blocked: "A drawer is still out." |
| 15 | All sold back | Vault counted ฿1,000 | Blocked: the vault is short; recount and report to the regional manager and audit |
| 16 | Vault counted at the expected amount | — | "Vault balanced"; under ฿25m no pickup notice |
| 17 | Checklist 4 of 5 | Sign off | Blocked: "Still open: the checklist is not finished." |
| 18 | Everything done | Teller signs off | "Needs a second approver: the branch manager." |
| 19 | Everything done | Branch manager signs off | "Branch 0123 is closed for Saturday"; reports to operations and finance; reopens Monday 26 Oct 08:30 |

## 9. Gaps against the core

| **New** call | Purpose | Owning module |
|---|---|---|
| `POST /api/v1/branches/{id}/drawers` (issue float), `GET /api/v1/branches/{id}/drawers/{drawerId}` | Teller drawers with expected cash and movements | branch (new module) |
| Drawer movement on every cash `deposit`/`withdrawal` | Link a counter posting to the teller's drawer | branch + deposit (extend `MoneyMove` with `drawerId`, `teller`) |
| `POST /api/v1/branches/{id}/drawers/{drawerId}/counts` | Denomination count | branch |
| `POST /api/v1/branches/{id}/drawers/{drawerId}/differences/{diffId}/approval` | Over/short approval and GL 1990 posting | branch + ledger |
| `POST /api/v1/branches/{id}/vault/movements` | Top-up, sell, sell-back under dual control | branch + ledger |
| `POST /api/v1/branches/{id}/vault/counts` | Vault count and pickup order | branch |
| `PUT /api/v1/branches/{id}/days/{date}/checklist/{item}`, `POST /api/v1/branches/{id}/days/{date}/close` | Branch day close | branch |
| `POST /api/v1/branches/{id}/counterfeit-notes` | Retained notes and receipts | branch |
| `POST /api/v1/aml/ctr`, `POST /api/v1/aml/alerts` | Cash transaction reports and structuring alerts | compliance (new) |
| `POST /api/v1/approvals/{id}/decision` | Branch manager approvals of counter items (shared approvals inbox, see 00) | platform |
| `POST /api/v1/branches/{id}/queue/next` | Queue tickets | branch |
| Teller role in `Actor` | Deposit and withdrawal endpoints accept only `ops` today | fabor-app (security) |

## 10. Open questions

1. The CTR threshold: ฿2,000,000 inclusive, and whether several cash deposits by one person in a day aggregate.
2. The structuring rule (3 deposits of ฿1.90m–฿1.98m in 14 days) belongs to compliance's rule set; confirm it and who receives the alert.
3. Counterfeit notes: the BOT form and the police notification route.
4. Teller shortage recovery after 7 days is an HR rule; confirm it can be in the console's wording.
5. The prototype now has a `manager` role for the branch manager's authorities; production maps it to a `branch-manager` role from the identity provider.
6. Whether the generic counter withdrawal checks the live drawer: the prototype's `withdraw` flow checks the static noon total, not the running drawer.

# 00 · Cross-cutting: what every screen shares

Prototype: `js/core.js`, `js/data.js`, `js/views.js`, `js/records.js`, `js/flows.js`, `js/shell.js`. Core: `fabor-app` (`Actor`, `SecurityConfig`, `ApiErrors`, `AppConfig` audit and PII vault), `agent-gateway`, `platform-security`. Frontend architecture: ADR 0011; the production console is `web/apps/console`.

## 1. Scope and users

Everything here applies to every area spec (01–11): sign-in and session, roles and the authority matrix, the record page, the three-step action dialog, maker-checker and dual control, history, search, languages and dates, tenants and branding, the Workbench, the approvals inbox, the exception centre, Copilot, and the customer app's link to the console. Area specs refer back here instead of repeating it.

Out of scope for production: the prototype's presenter mode, its tour, the before-and-after comparison page and the "Reset demo" control. They exist to sell the design.

### Roles

The prototype has six sample roles; the core enforces finer roles with `actor.require(…)`. A production login carries several core roles; the console derives what to show from them.

| Prototype role | Sample person | Title | Core roles it maps to (today) | Also needs (New) |
|---|---|---|---|---|
| `ops` | Ploy Chaiyaporn | Operations checker | `ops` | `trade-ops`, `payments-ops` |
| `collector` | Nok Saelim | Collector | `collections-agent`, `repossession-officer` | — |
| `credit` | Wanida Kaewmanee | Credit officer (also RM in the prototype) | `credit-officer`, `write-off-approver` (above limit) | `rm` |
| `product` | Krit Sombat | Product maker | `product-maker` (`product-publisher` is a different person) | `policy-maker`, `policy-approver` |
| `finance` | Arunee Thongdee | Finance controller | `ecl-operator` | `finance-controller`, `treasury` |
| `teller` | Somsak Jaidee | Teller, branch 0123 | `ops` (deposits and withdrawals) | `teller`, `branch-manager` |

Other core roles already in use: `ops-admin` (scheduler backfill), `compliance-analyst`, `customer` (the app; party id from the token, never from the request).

## 2. Screens

| Screen | Route (prototype hash) | What it is |
|---|---|---|
| Sign in | — | Bank SSO (OIDC) or staff ID with a six-digit code; idle sessions end after 15 minutes. |
| Shell | every page | Left rail of pinned systems (by role and tenant), top bar with tenant switcher, search (⌘K), language, density, Copilot, inbox, notifications, avatar menu. |
| Workbench → Today | `#workbench/today` | "What needs you": cards from every system for this role, each with a count, tone, one line and a link; a work list; a live stream; KPIs. Each person can reorder or hide cards (stored per role). |
| Workbench → Approvals | `#workbench/approvals` | Everything waiting for a checker, from people and agents, in one inbox. |
| System overview | `#<system>/overview` | Headline figures, a chart, a side list; areas with a registered page view replace the generic one. |
| List section | `#<system>/<section>` | A table with filter, column sort, row click to the record, bulk select where an action applies. |
| Record page | `#<RECORD-ID>` | Back link, eyebrow (system · kind), title and id, lede, pills, actions (History always first), facts strip, tabs, panel. |
| Operations → Exception centre | `#ops/exceptions` | Every break and breach with owner, age and a clock against its time limit; resolve with a reason. |
| Settings | `#account/settings` | Language, theme (Modern, Calm), dark mode, density, notifications. |

### The record page

| Part | Rule |
|---|---|
| Facts strip | 4–6 figures; each has a label, a value, an optional tone (`warn`, `crit`) and a small line under it. Tone never carries meaning alone: the text says it. |
| Pills | State first, then at most two flags. |
| Actions | History, then secondary actions, then one primary. A button the person cannot use is disabled with the reason in the review step, not hidden. |
| Tabs | Each tab may show a count. The panel is rendered from the record's data on every change; focus returns to the control that changed. |
| History side panel | Who did what, when, from and to, for this record (see §4). |

## 3. Fields

Shared field rules (the form engines in `appform.js` and `onboarding.js` and every dialog use them):

| Rule | Behaviour |
|---|---|
| Money input | Accepts `1,234.56` or `1234.56`; shows two decimals; rejects negative and non-numbers with "Enter an amount." |
| Required | A required field left empty blocks Next and is listed with a Fix link on review screens. |
| Source tag | A prefilled value shows its source (DOPA, NCB, Record, Staff, Appraiser, Statement); editing it keeps the original in history. |
| Thai ID | 13 digits with the check digit validated (`idValid`). |
| Dates | Entered and shown in the user's language; stored as ISO dates. |

## 4. Actions: the dialog every action uses

Every action in every area is a three-step dialog: **Enter**, **Review and confirm**, **Done**.

| Step | Behaviour | Core |
|---|---|---|
| Enter | The action's fields. Next validates; an error stays on the step with the message. | — |
| Review and confirm | States the consequence in a sentence (what posts, who is told, what changes). Shows a quote table where money moves. If the person may not do it alone, says who approves and the confirm button reads "Send to <approver>". A blocked action shows why and disables confirm. An irreversible action asks the person to type the record id. | Pre-checks call a read endpoint (quote, balance, eligibility); nothing is written. |
| Done | Says what happened, or that it went for approval. "Nothing was posted" appears only in the prototype. | The write call, carrying the dialog's reference as `reference`. |

| Rule | Behaviour | Core |
|---|---|---|
| Idempotency | The dialog's reference (`IDEM-xxxxxxxx`) is created when it opens and kept on retry; the same reference never posts twice. | Exists for postings (`IdempotencyKey`, `IdempotencyConflictException` → 409). |
| Authority | The review step calls `authCheck(action, amount)`: within the person's limit → do it; above → send to the second approver from the matrix. | **New**: `GET /api/v1/authority/check?action=&amount=` and amount limits per role; today the core checks roles only. |
| Maker-checker | Whoever prepares something (a condition, a journal, a transfer, a policy change, a payee) cannot approve it; refused with "You prepared this; someone else must check it." | **New**: approvals service (below). |
| Dual control | Two named people present (vault, drawer sell-back); naming yourself as the second is refused. | **New**, in the branch module. |
| Typed confirmation | Settlement, write-off and similar: type the record id to enable confirm. | Console only. |
| Agent actions | Copilot and agents act only through the same dialogs; their writes carry `actor.type = AGENT` and the person they act for. | `agent-gateway` (`AgentPrincipal`, `AuditSink`). |

### The approvals service (New)

One queue for everything sent to a second person.

| Call | Purpose |
|---|---|
| `POST /api/v1/approvals` | Create a request: action key, amount, record, payload, maker, reason. |
| `GET /api/v1/approvals?assignee=me` | The inbox for the signed-in approver (by role and limit). |
| `POST /api/v1/approvals/{id}/decision` | Approve or reject with a note; approving replays the stored action with its original reference; the maker cannot decide. |

## 5. States

An approval request: `pending` → `approved` (the action runs) or `rejected` (the maker is told) or `expired` (after the action's time limit). An exception: `open` → `resolved` (with how and a note) or `escalated`.

## 6. Postings

None of its own. Every posting goes through the ledger with a batch id and idempotency key; the GL drill-down (spec 11) shows them.

## 7. Configurable values

| Key | Prototype value | Who sets it | Note |
|---|---|---|---|
| Authority matrix | See [prototype-inventory.md](prototype-inventory.md#authority-matrix) (22 action keys × 6 roles) | Bank | Credit approval levels: credit officer ฿2m, head of retail credit ฿10m, committee above (credit policy, spec 02). |
| Idle session timeout | 15 minutes | Bank (security policy) | |
| Workbench cards per role | Defaults per role; person may reorder or hide | Bank sets defaults | |
| Exception time limits | Per kind (for example a reconciliation break 24 h) | Bank | |
| Languages | English, Thai | — | Thai dates in Buddhist years. |

## 8. Acceptance criteria

| # | Given | When | Then |
|---|---|---|---|
| X1 | An operations checker with a ฿2,000,000 settlement limit | they settle a loan whose quote is above it | the review says "Needs a second approver: the credit officer" and confirm reads "Send to Credit officer"; Done says it was sent for approval |
| X2 | A dialog that has been confirmed | the network fails and the person confirms again | the core receives the same `reference` and posts once |
| X3 | A journal prepared by one person | the same person opens Check | the action is refused and names the rule |
| X4 | Any record page | the person opens History | the side panel lists who, when, what, from and to for that record |
| X5 | The language is Thai | any date shows | it is in Thai with a Buddhist year; labels switch with it |
| X6 | A tenant without Trade Finance | a person searches for an LC | no result from that system appears and its rail item is absent |
| X7 | Copilot drafts a restructuring | the person confirms | it goes through the same review and authority check as a person's action, recorded as on behalf of that person |

## 9. Gaps against the core

| New | Purpose |
|---|---|
| `GET /api/v1/authority/check`, authority configuration | Amount limits per role and action key; second approver |
| `/api/v1/approvals` (three calls above) | One approvals inbox for every area |
| `GET /api/v1/records/{id}/history` | Record history from the audit log (`AuditLog` exists; no read endpoint) |
| `GET /api/v1/search?q=` | Search across records the person may see |
| `GET /api/v1/workbench?role=` | Cards for the Workbench, each from its area's service |
| `GET /api/v1/exceptions`, `POST /api/v1/exceptions/{id}/resolution` | The exception centre (spec 11) |

## 10. Open questions

- Which identity provider and which role claims the bank uses; how a person with two jobs (credit officer and RM) is shown.
- Whether approvals expire, and after how long, per action.
- Whether agents may execute within authority in the first release, or only propose.

# Fabor console: UX foundation

The basis for the React console ([ADR-0011](../adr/0011-frontend-architecture.md)). It replaces the rule that the console follows `prototype/index.html` exactly: the prototype's visual language (colour tokens, type, tone) is kept as the starting point, and its structure changes where the findings below say so.

## 1. What is wrong with the console today

A heuristic review (Nielsen's ten heuristics, plus information architecture and accessibility checks) of the static console as it stands after the seven live slices. Severity: 3 = blocks or misleads people on a common task, 2 = slows them down or causes errors, 1 = friction.

| # | Finding | Heuristic | Sev |
|---|---|---|---|
| F1 | Navigation is organised by system module (Master Builder, Product Studio, Architecture, Modules) rather than by the work people do. Blueprint pages sit in the same menu as operations. | Match with the real world | 3 |
| F2 | There is no starting point for a person's work. The Overview shows bank-wide figures; a collector or an officer has to know where their tasks are. | Visibility of system status | 3 |
| F3 | Records are opened by typing an exact id (MA-1, FP-1, A3, F2). There are no lists, no search and no filters for loans, leases, agreements or assets. | Recognition rather than recall | 3 |
| F4 | Live and sample data appear on the same screen: a sample contract header until a loan is opened, a fixed sample business date, sample tiles beside live ones. | Visibility of system status; trust | 3 |
| F5 | Irreversible actions (settle, sale after repossession, lease termination, write-off) sit inline next to harmless ones. Only one asks for confirmation and none shows the consequence (amount moved, status after) before it happens. | Error prevention | 3 |
| F6 | The Contracts screen carries six jobs on one long page: look up, apply, the collections queue, per-loan collections, repossession and the schedule. The main task of the page is unclear. | Aesthetic and minimalist design | 2 |
| F7 | The Fleet and floor plan screen grew five unrelated tabs (fleet, floor plan, assets, leases, dealers). | Consistency; match with the real world | 2 |
| F8 | System codes reach people: RESTRUCTURE_REVIEW, WRITTEN_OFF, PRINCIPAL_DUE, and error messages with amounts in satang ("exceeds what is due by 99099900"). | Match with the real world; help with errors | 2 |
| F9 | Results appear in a box at the top of the panel, often off screen, while the button that caused them is lower down; toasts are used inconsistently. | Visibility of system status | 2 |
| F10 | Dates show as ISO strings in some places and formatted in others; amounts are entered in baht in some forms and minor units in others. | Consistency and standards | 2 |
| F11 | Clickable table rows are not reachable by keyboard and do not announce themselves to screen readers. | Accessibility (WCAG 2.1.1) | 2 |
| F12 | Long forms have no grouping, no inline validation and no explanation of defaults (for example the 36 periods of a lease). | Error prevention; help | 1 |
| F13 | No empty, loading or partial-failure states: a screen either has data or shows the prototype's sample. | Visibility of system status | 1 |

## 2. Who uses it and for what

| Role | Their day | Top tasks (in order of frequency) |
|---|---|---|
| Collections agent | Works a queue of late accounts | Find the next account to call; log the contact; record a promise; see whether earlier promises were kept |
| Servicing officer | Answers customers and back-office requests | Find a customer or contract; take a payment; quote and settle early; open a new loan |
| Credit and recoveries officer | Decides on troubled accounts | Review a loan for restructuring or write-off; repossess and sell the asset; see what remains owed |
| Asset finance officer | Runs dealers, stock lines, fleets and leases | Check a dealer line and its stock; audit stock; draw a unit; open a call-off; book a lease; check insurance |
| Product maker and checkers | Build and approve products | Draft a product; read the simulation; approve in their role; publish |
| Finance and risk controller | Watches the book | See the position and arrears; run the loss allowance; read the ledger behind a figure |

Design for the agent and the officer first: they spend the whole day in the console and their tasks repeat hundreds of times.

## 3. Information architecture

Organised by the work, not by the system. Seven areas at most, each a noun people use.

```
Home ............. My work: my queues, approvals waiting for me, items needing attention, key figures
Customers ........ Search · Customer (accounts, loans, leases, assets, contact history)
Lending .......... Loans (list, detail) · Applications
Asset finance .... Leases · Fleet agreements · Floor plan lines · Assets · Dealers
Collections ...... Queue · Promises · Repossessions
Products ......... Catalogue · Drafts and approvals
Finance & risk ... Position · Loss allowance · Ledger
(Settings and Sign out sit under the user menu; Architecture and Modules move to the documentation.)
```

Rules:
- **Every business object has a list and a detail page** at a stable address: `/loans`, `/loans/LN-APP3`, `/loans/LN-APP3/schedule`. Lists search, filter and sort; the filter is in the address so it can be shared and bookmarked.
- **A detail page has one header** (identity, status, the three or four facts that matter, primary actions) and **tabs for facets** (for a loan: Summary, Schedule, Payments, Collections, Recovery, Postings). No page carries another object's job.
- **Cross-links follow the real relationships**: a loan links to its customer, its assets and its postings; an asset links back to its contract and dealer.
- **One global search** finds customers, loans, leases, agreements, lines and assets by id, VIN, registration or name, with keyboard access (`/` and the command palette).
- **Approvals are an inbox**, reached from Home and a badge in the top bar, not a page people must remember to visit.

## 4. Interaction rules

1. **Actions open a dialog with three steps: enter, review, confirm.** The review step states the consequence in plain words and figures ("Settles LN-APP2. ฿101,503.67 is taken from SAV-P2. The loan closes."). Irreversible actions ask the person to type the amount or the id to confirm; reversible ones confirm with one button.
2. **One idempotency reference per dialog**, created when it opens and reused on retry, so a double click or a timeout never posts twice.
3. **Never optimistic on money.** Show a pending state on the button, then the result from the server. Refresh what the action changed (the header, the list row, the queue).
4. **Feedback where the eye is**: the result appears in the dialog or next to the control that caused it; a toast only confirms something that finished elsewhere.
5. **Plain language everywhere.** Status and codes have one mapping table (for example `RESTRUCTURE_REVIEW` → "Review for restructuring", `WRITTEN_OFF` → "Written off"). Errors say what happened and what to do, with amounts in baht.
6. **Recognition over recall.** Pick from lists and search results; type an id only as a shortcut.
7. **Progressive disclosure.** Show the facts needed for the task; the rest one click away (the full schedule, the postings).
8. **Keyboard first for repeated work.** Every row and action is reachable by keyboard; the queue supports next and previous without the mouse.
9. **Honest states.** Loading skeletons, empty states that say what to do next, partial failures shown per section. Never sample data once signed in.

## 5. Visual and content system

- **Tokens** come from the prototype's `console.css` (colours, radius, shadows, fonts: Geist, IBM Plex Sans Thai, Geist Mono) with light and dark themes. Two densities: comfortable for occasional users, compact for agents.
- **Numbers**: right-aligned, tabular figures; baht with a ฿ sign and two decimals; negative amounts with a minus sign, never colour alone.
- **Dates**: `24 Oct 2026` in tables, with the age where it matters ("115 days late").
- **Status** uses a chip with text and colour: good, warning, critical, information, neutral. Colour never carries meaning on its own.
- **Type scale** 12, 13, 14 (body), 16, 20, 26. One page title per page; panel titles are labels, not headings competing with it.
- **Language**: English and Thai, same keys; sentence case; verbs on buttons ("Record promise", not "Submit").

## 6. Accessibility

WCAG 2.2 AA: contrast checked for both themes, visible focus, every control reachable and operable by keyboard, rows are links or buttons, results announced through a live region, form errors tied to their fields, no time limits on reading. Axe runs in the end-to-end tests.

## 7. How we will know it is better

Measured with the roles above, before (current console) and after, on the same tasks: find a late account and record a promise; take a payment; settle early; repossess and record a sale; check a dealer's stock. Track task success, time on task, errors and a System Usability Scale score. Target: every task completed without help, half the time of today for the queue tasks, SUS above 80.

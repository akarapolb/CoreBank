# Fabor console: demo script for bank clients

The full route is 31 steps in seven chapters, about 40 minutes; pick chapters to fit the time. The executive route is 7 steps, about 10 minutes. Open `index.html` (or the published link) in a desktop browser, 1200px wide or more; between 860 and 1180px the sections fold into the menu button at the top left. With no internet in the room, use `offline/fabor-console.html` (built by `build-offline.py`). Everything is sample data and nothing is posted; in presenter mode a ribbon at the top says so.

## Before the meeting

- **Reset demo** (presenter panel or Settings) clears saved views, pins, branding and settings and signs out, so you start on the sign-in screen. Changes made during a demo (a loan settled, a policy published) last until the page is reloaded.
- Pick the tenant that matches the client: **Demo Retail Bank** (the default; retail and auto finance), **Demo Commercial Bank** (corporate, trade and treasury) or **Demo Virtual Bank** (digital only). Presenter steps set the tenant they need, so this only matters when you click around yourself.
- Set the language in **Settings** if the audience reads Thai: labels and dates switch together, with Buddhist years.
- Put the client's brand on it: **Admin → Branding** (name, two-letter mark, colour, logo). It only changes this browser; **Back to Fabor** undoes it.
- Turn on **Presenter mode** from the avatar menu. Each step takes the console to the right screen as the right person, opens the dialog or panel, and shows one line to say. *Full* lists the chapters; *Executive* the short route.

## Executive route: 7 steps, about 10 minutes

1. **Workbench and tour**: the day starts with what needs this person, from every system.
2. **Open an account**: identity from the card and DOPA; every field shows where it came from; the risk score moves with the answers.
3. **Credit review**: adjust overtime to 0% and the ratios follow; the approver depends on the amount and each deviation, not on a person's say-so.
4. **Settle early**: the quote line by line; savings ฿1,545.98 short, so it is blocked; at the branch it is within authority; the loan id is typed to confirm.
5. **Customer app**: pay an instalment and it lands on the loan and the ledger at once.
6. **Ledger drill-down**: from a GL figure to the journal, the balanced postings and the loan that caused it.
7. **Before and after**: the same settlement, about 40 minutes and a night in a typical core, against a minute. Say the times are illustrative.

## Full route

### 1. Opening (3 steps)

| Step | Show | Say |
|---|---|---|
| Sign in | Bank SSO, or staff ID with the six-digit code | The bank's own identity provider and a second factor; idle sessions end after 15 minutes. |
| Workbench and tour | **Take the tour** (nine short steps; skip if time is short) | Work arrives from every system in one place; nobody hunts across screens. |
| One console, many roles | The collector's Workbench | Same core, different job: the Workbench and pinned systems follow the role. |

### 2. A customer joins (2)

| Step | Show | Say |
|---|---|---|
| Open an account | **ONB-7731**, Weerapong at branch 0123: *Identity*, then *Due diligence*, then *Review and open* | 98 fields, each tagged DOPA, NDID, staff or customer, much of it prefilled. Set *opening for someone else* and *transfers with Myanmar*: the risk turns high, the most common mule-account pattern. *Review and open* lists what is missing with Fix links; low risk opens at once. |
| A business customer | **AO-26-0412**, Lanna Craft Export: *Owners*, *Due diligence*, *Signing mandate* | Ownership traced through a Hong Kong company to the people behind it; a screening near match to clear; shareholdings must add to 100%; a PEP owner sends it to compliance. Both journeys print as a field dictionary for the backend. |

### 3. Lending (7)

| Step | Show | Say |
|---|---|---|
| New loan application | **APP-30416**: the product, then *Review and submit* | 166 fields; the instalment and debt ratio update as you type. Fill the 14 missing answers and ฿300,000 is approved automatically; a PEP answer is referred; a home loan goes to a credit officer. |
| Credit review | **APP-30409** as the credit officer: *Income and debts*, *Policy and deviations*, *Decision* | Approve is blocked until each deviation has a mitigant and the employer is called on a number the bank found itself. ฿2,150,000 at LTV 93.5% needs the head of retail credit; a ฿2,000,000 counter-offer is within the officer's authority. |
| Credit committee | **CC-2026-21** | A member with a conflict does not vote on that item; quorum and the chair's casting vote are checked; the minutes write themselves. |
| Approval to payout | **DSB-30409** | One person receives a condition and another verifies it; the Land Office registration and the payout are each refused until what comes before is done. |
| Servicing a home loan | **LN-77120**, *Prepay* | ฿200,000 from the maturing deposit: 33 months sooner, about ฿413,000 of interest saved; or a lower instalment. Rate review, holiday, due date, direct debit and letters work the same way. |
| Commercial facilities | **FAC-B2031**, *Test Q3 2026* | DSCR 1.14x against 1.20x: a draw stop, then a waiver to the committee. Limits sit under one umbrella across lending, trade and treasury. |
| Dealer floor plan | **FP-DEMO**, *Pay off* the sold Fortuner | Payoff with interest to the day, the dealer's balance checked, the VIN typed to confirm. |

### 4. When payments stop (6)

| Step | Show | Say |
|---|---|---|
| Collections strategy | **Collections → Strategy** as the collector | Day by day for each bucket; a strategy test in the 1–30 bucket. The console enforces calling hours and one successful contact a day. |
| Hardship and restructuring | **LN-A-C11**, Malee: *Contact*, *Hardship*, *Restructure* | She can pay ฿4,130 against ฿4,725.91; three offers that fit, with their TFRS 9 effect, sent before the loan turns non-performing on 18 Nov, as the BOT requires. |
| Settle early | **LN-A-C10** | The quote line by line; savings short so it is blocked; at the branch, within an operations checker's authority. *History* shows who did what. |
| Copilot drafts | The Copilot panel | Copilot reads the screen and drafts a restructuring; it cannot post. *What if* moves term and rate live. |
| Legal and write-off | **LN-A-C14** | Notice, offers, suit; written off against the 100% allowance with no new loss; recoveries or a debt sale afterwards. |
| Repossession and auction | **R-A4** | Notice of sale with the right to take the car back; a bid below the reserve needs approval; the shortfall stays owed. |

### 5. Deposits and payments (4)

| Step | Show | Say |
|---|---|---|
| Legal orders | **ORD-26-0191** | An AMLO freeze: verified through AMLO's channel, applied, checked by a second person; the customer is not told and the available balance falls to zero. Dormant accounts and term deposits (TD-88201 pays into Anan's home loan, after 15% withholding tax) are in the same system. |
| AML case | **AML-2026-0418** | Nine cash deposits just under the reporting threshold; *File a suspicious transaction report*, and the customer is never told. |
| Held payment | **TR-9918210** | A sanctions name match stops a $1.18m payment; releasing it is above an operations checker's limit, so it goes to the head of operations. |
| Customer app | **Customer App → App preview** | Pay an instalment: it lands on the loan and in the live postings at once. |

### 6. Control and the books (6)

| Step | Show | Say |
|---|---|---|
| Credit policy | **POL-RETAIL** as the product maker | Every limit the screens use, in one versioned place. Raise the officer's limit to ฿2,500,000 and the first-home LTV to 95%; *Impact* decides 90 days of applications again. Loosening the BOT cap is refused, and so is approving your own change. Published, APP-30409 needs only the officer. |
| Loss allowance | **ECL-2026-10** as the finance controller | Stages follow this demo: Malee Stage 2, Siam Freight Stage 2 after its breach, Kittipong gone after his write-off. Severe weights show the sensitivity but cannot be posted. |
| BOT data set | **DS-LOAN-2026-10** | Validation catches the demo's own changes; fix at the source, generate, and a second person submits. |
| Month-end close | **Finance & Risk → Month-end close** | No close night: the checklist follows the run, the reconciliation and the report to the CFO's sign-off. |
| Ledger drill-down | **GL 1300 → Journals** | From a GL figure to its journal, the balanced postings and the loan. |
| Exception centre | **Operations → Exception centre** | Every break and breach with an owner and a clock; resolving the ITMX break unblocks the close. |

### 7. Closing (3)

| Step | Show | Say |
|---|---|---|
| Commercial bank | **LC-26-0412** in Demo Commercial Bank | Same console, more systems: an import LC with a discrepancy and a five-day deadline. |
| Thai | The Workbench in Thai | Labels and dates switch together, with Buddhist years; dark mode and compact rows are on the rail and the top bar. |
| Before and after | **Workbench → Before and after** | About 40 minutes, three systems and a night, against a minute. The times are illustrative. |

## If they ask

- **Is this the product?** It is the agreed design as a clickable prototype. The production console is React on the same patterns and already runs Loans, Collections and Floor plan against the live core.
- **Where do the numbers come from?** Sample data computed so the figures agree across screens: the schedules, quotes, tax, loss allowance and data set reconcile, and a change in one place (a write-off, a policy) shows up in the others. In the product they come from the immutable ledger and the core services.
- **Is the Copilot real AI?** Not in the prototype: its answers are written in. The design point is that it drafts and a person approves, through the same review and authority checks.
- **How do the forms map to our data?** The application and account-opening forms are generated from field catalogues that also print as field dictionaries (`docs/design/loan-application-fields.md`, `docs/design/account-opening-fields.md`), with each field's source and the reason it is collected.
- **Are the rules right for Thailand?** They are the prototype's reading of BOT, AMLO, PDPA, consumer and tax rules, marked "to confirm" throughout. Limits, risk weights and fees are the bank's to set, through the credit policy.
- **Can we change the look?** Settings offers Modern and Calm styles; a bank's colours are a few design tokens, not new screens.

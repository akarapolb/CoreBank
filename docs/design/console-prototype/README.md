# Fabor console prototype

A clickable prototype of the staff console across every Fabor system, used to agree the design and to demo to banks. Sample data only; nothing posts. The production console is the React app in `web/`, built on the same patterns.

| File | What it holds |
|---|---|
| `index.html` | The page: icons, the shell markup, and the scripts in load order |
| `styles.css` | Design tokens (light, dark, Calm style, compact density) and every component |
| `js/core.js` | Helpers, storage, Thai and English, dates in Buddhist years |
| `js/data.js` | Systems, tenants, roles, limits and authorities, the computed records, every list |
| `js/views.js` | Charts and the shared views: overview, list, Workbench, approvals, Customer 360 |
| `js/records.js` | Record pages, analytics, branch, settings, exceptions, close, customer app, branding, AML, held payment, loan application, before and after, what-if |
| `js/flows.js` | Action dialogs: enter, review and confirm (with the authority check), done |
| `js/lending.js` | Lending in depth: servicing on the home loan LN-77120, the commercial facility FAC-B2031 with covenants and collateral, and the Lending overview |
| `js/appform.js` | The loan application APP-30416: a field catalogue (166 fields, each with its source and the reason it is collected) that drives the form, its checks, the document list and the review, through decision, e-signature and disbursement |
| `js/underwriting.js` | The credit officer's side: the Credit review queue, the workbench for APP-30409 (income and debt worksheet, bureau history, appraisal, deviations and mitigants, Copilot's memo, five decisions with the approver set by amount and deviation), and the committee meeting CC-2026-21 with conflicts, quorum, votes and minutes |
| `js/collections.js` | Collections in depth: strategy by bucket and the contact rules (enforced: hours and one contact a day), the collector's case LN-A-C11 (arrears and payment order, contact, multi-part promises, hardship assessment, restructuring offers), the legal and write-off case LN-A-C14 (court, write-off postings, recovery, debt sale) and the repossession R-A4 (notice of sale, auction, shortfall) |
| `js/disbursement.js` | Approval to payout, DSB-30409: conditions with maker-checker and waivers, the e-contract and stamp duty, fire insurance and declined life cover, the Land Office appointment and mortgage registration, and the payout gate with its postings |
| `js/policy.js` | The retail credit policy in Product Factory, POL-RETAIL: the limits the bank sets in one versioned place, edited as a draft, simulated on 2,400 recent applications, approved by a second person and published; the application form, credit review and collections read the published values, and regulatory rules can only be tightened |
| `js/finance.js` | Finance and month-end for October: the ECL run ECL-2026-10 (stages follow the prototype's loans, scenario weights, overlays under governance, the movement, posting), the reconciliation REC-2026-10, the BOT loan data set DS-LOAN-2026-10 (validation that catches the demo's own changes, fix at source, maker-checker submission), and the close checklist driven by all three to CFO sign-off |
| `js/deposits.js` | Deposits in depth: a business account opening with beneficial owners, screening and a live risk score (AO-26-0412), legal orders from the LED, AMLO and the police with authentication and maker-checker (ORD-26-0187/0191/0193), a dormant account with safe reactivation and the dormant fee run (SAV-30988), term deposit maturities with withholding tax (TD-88102, TD-88201 into the home loan), and the statement run (STM-2026-10) |
| `tools/application-fields.mjs` | Prints the catalogue as [`../loan-application-fields.md`](../loan-application-fields.md); run it with `node` after changing the form |
| `js/shell.js` | Side panels, sign-in, tour, presenter mode, live feel, rendering and events; starts the app |
| `demo-script.md` | How to present it to a bank |
| `build-offline.py` | Builds `offline/fabor-console.html`, one file with fonts inlined, for rooms without internet |
| `fonts/` | Geist, Geist Mono, Bricolage Grotesque and IBM Plex Sans Thai (SIL Open Font License), used by the offline build |

The scripts are classic scripts sharing one global scope, so their order in `index.html` matters. Open `index.html` in a browser to run it; it loads its fonts from Google Fonts. For a meeting without internet, run `python build-offline.py` and open the file it writes.

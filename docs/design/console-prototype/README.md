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
| `tools/application-fields.mjs` | Prints the catalogue as [`../loan-application-fields.md`](../loan-application-fields.md); run it with `node` after changing the form |
| `js/shell.js` | Side panels, sign-in, tour, presenter mode, live feel, rendering and events; starts the app |
| `demo-script.md` | How to present it to a bank |
| `build-offline.py` | Builds `offline/fabor-console.html`, one file with fonts inlined, for rooms without internet |
| `fonts/` | Geist, Geist Mono, Bricolage Grotesque and IBM Plex Sans Thai (SIL Open Font License), used by the offline build |

The scripts are classic scripts sharing one global scope, so their order in `index.html` matters. Open `index.html` in a browser to run it; it loads its fonts from Google Fonts. For a meeting without internet, run `python build-offline.py` and open the file it writes.

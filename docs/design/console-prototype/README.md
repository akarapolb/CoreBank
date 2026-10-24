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
| `js/shell.js` | Side panels, sign-in, tour, presenter mode, live feel, rendering and events; starts the app |
| `demo-script.md` | How to present it to a bank |
| `build-offline.py` | Builds `offline/fabor-console.html`, one file with fonts inlined, for rooms without internet |
| `fonts/` | Geist, Geist Mono, Bricolage Grotesque and IBM Plex Sans Thai (SIL Open Font License), used by the offline build |

The scripts are classic scripts sharing one global scope, so their order in `index.html` matters. Open `index.html` in a browser to run it; it loads its fonts from Google Fonts. For a meeting without internet, run `python build-offline.py` and open the file it writes.

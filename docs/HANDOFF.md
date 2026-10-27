# Handoff for the next session

State as of 27 Oct 2026. Read this first, then [`phase1-status.md`](phase1-status.md), [`07-roadmap.md`](07-roadmap.md), the [UX foundation](design/ux-foundation.md), the [console prototype](design/console-prototype/README.md) and the [engineering specs](design/specs/README.md).

**The short version.** The backend through Phase 2 and a first slice of the React console exist. Since then the session built the clickable console prototype to cover every system in depth, wrote an engineering spec for each area (screens, fields, actions, approvals, configurable values, acceptance criteria, core calls), and fixed the prototype where the specs found problems. The prototype and specs are finished and consistent; **the production console and the backend behind it are mostly not started**. `docs/design/specs/backlog.md` is the plan for that, in twelve slices.

## What this is

Fabor OS: an AI-native core banking platform (retail, commercial and virtual banks; any loan product including leasing and hire purchase). Java 21, Maven multi-module, Spring Boot 3.5.6, PostgreSQL 16, plain JDBC with Flyway. Front end: the classic static console, a React console in `web/` (ADR-0011), and a clickable design prototype in `docs/design/console-prototype/`. Branch `claude/stoic-lamport-l78s32` on GitHub `akarapolb/CoreBank`. This is the repository's only branch and its default (`origin/HEAD`): there is no branch named `main`, so "push to main" means pushing this branch. No pull request has been opened; do not open one unless asked.

## Where things stand

**Backend.** Phases 0 and 1 are built and tested. Phase 2 so far, all in the code with tests and `FaborAppTest` coverage unless noted:

- **Tax and hire purchase:** `engine-tax` (VAT, tax invoices, instalment VAT on the interest or the whole instalment); flat-rate schedules with balloons; rebate rules (`ACTUARIAL`, `RULE_OF_78`, `PERCENT:x`, `TIERED:a,b,c`) on settlement and on prepayment; payment holidays and restructuring on flat loans; the `TH-HP-VEHICLE-v1` rule pack; the cost-of-credit `Disclosure` endpoint (compiled, never called by an app test).
- **Leases (TFRS 16):** finance and operating leases with accrual, collection, termination and purchase option (`LeaseService`, `LeaseController`).
- **Asset finance:** asset register with title and insurance (`assets` module), dealers, fleet master agreements with call-offs and a consolidated invoice, floor plan lines with curtailment, payoff and stock audit.
- **Collections and recovery:** a worklist with the recommended next step, contacts and promises (`CollectionsService`); repossession and remarketing (`RepossessionService`).
- **Loss allowance (TFRS 9):** `engine-ecl`, `EclService`, `EclRun`, and a daily run off by default. PD and LGD must be set (`fabor.ecl.annual-pd`, `fabor.ecl.lgd`) or it answers 409. The 0.04 and 0.45 used so far are test values; the bank supplies the real ones.
- **For the consoles:** `GET /api/v1/overview`, `GET /api/v1/loans` (search, status, overdue), `GET /floorplans` and units, the settlement quote, and the OpenAPI document at `/api/v1/openapi`.

The detail of each item, and what each one still lacks, is in the git history and the earlier version of this file (`git show eeb65eb:docs/HANDOFF.md`).

**Classic console** (`fabor-app/src/main/resources/static/console`): the original prototype on live data through `live.js`, slices 1 to 7 (fleet and floor plan, collections, assets, leases, dealers and repossession, loss allowance, overview). It is being replaced by the React console.

**React console** (`web/`, served at `/console-next/`): milestone 1 done. Sign-in (token mode), Home, Loans list and detail, the Collections queue and Floor plan lines, all through a three-step action dialog. It has 16 unit tests and passes typecheck. It was checked by hand against the demo app, and from the jar with the strict CSP.

**Design prototype** (`docs/design/console-prototype/`): the agreed target design for the whole console. It is a clickable page with sample data covering 19 systems (23 scripts, 54 record pages, 123 actions, 7 roles, 3 demo tenants); the main pieces are:

- the shell: a system rail and switcher with a short sidebar per system, tenants and roles, pinning, search, and Thai and English with Buddhist-year dates;
- record pages, and every action as enter, review and confirm, with an authority check per role;
- Copilot, the exception centre, month-end close, an AML case, a held payment, loan origination, a customer app and analytics;
- light, dark and Calm themes, sign-in with MFA, presenter and executive modes, and bank branding;
- the presenter route is one story in nine chapters (46 steps) with a 7-step executive cut; each step sets its own tenant and role. Between 860 and 1180px wide the sections fold into the menu button so pages keep their width. `demo-script.md` follows the route.

Lending goes deeper than the other systems (`js/lending.js`):
- servicing on the home loan LN-77120: prepay, rate review, payment holiday, due date, e-DDA, fee waiver, letters;
- a new application APP-30416 (`js/appform.js`): 166 fields from a catalogue that records each field's source and the reason it is collected, with validation, completeness, documents that follow the answers, and automatic, referred and declined decisions through e-signature and disbursement. `docs/design/loan-application-fields.md` is generated from it as the backend's starting field list;
- the commercial facility FAC-B2031, with limits across Lending, Trade and Treasury, drawdowns, covenants (the Q3 test breaches DSCR and sets a draw stop), collateral and the annual review;
- a Lending overview with the pipeline and the book;
- payments in depth (`js/payments.js`): the Payments overview on a Saturday with the Monday queue and the BOT position, a BAHTNET transfer with call-back and maker-checker, a SWIFT MT103 with screening, charges, purpose code and gpi tracking, a payroll file with validation and a Sunday payday, standing orders and a PromptPay recall that needs the receiver's consent;
- treasury and markets (`js/treasury.js`, Demo Commercial Bank): a Treasury overview, LCR-2026-10 with a run-off stress against the 120% internal trigger and the BOT 100% and the contingency funding plan, ALM-2026-10 with the repricing gap and rate shocks to earnings and economic value, the FX forward FX-26-10-0918 from booking to confirmation matching, and the nostro break NOS-EUR-01 cleared under maker-checker; the BOT ratios and limits are the prototype's reading;
- leasing and auto finance (`js/leasing.js`): a hire-purchase deal HPQ-26-1031 from quote to dealer payment and registration book, with the effective rate checked against the cap; servicing and book release on HP-2025-004812; the end of operating lease O1 with inspection charges and return, buy or extend; and Bangna Motors' scorecard and commission clawback. The OCPB/BOT caps, rebate tiers and book deadlines are configuration to confirm;
- syndication (`js/syndication.js`, Demo Commercial Bank): the bank as agent on SYN-001 with funding notices from the lender register, a defaulting lender, THOR compounded in arrears, fees by role and by share, the payment waterfall, a Majority Lenders vote that passes only because the defaulting lender is disregarded, and a transfer registered after KYC; the LMA-style clauses and market conventions are the prototype's reading;
- the branch counter (`js/branch.js`): counter controls (a ฿650,000 withdrawal to the branch manager with a scam check, a ฿2.15m cash deposit with the AMLO report and a structuring hint, a suspect note retained), the drawer and the vault under dual control, and an end of day that closes only when every drawer and the vault balance; the thresholds are the prototype's reading;
- new areas register their own lists and pages through `EXTRA_LISTS` and `PAGE_VIEWS` (data.js) instead of editing the shared files;
- commercial banking (`js/corporate.js`, `js/trade.js`): the Korat Isuzu relationship view B-0414, Lending → Monitoring with the early-warning case EW-B3107 (watchlist and Stage 2), the import LC examined against UCP 600 with waiver, MT734 refusal and trust-receipt settlement, and a URDG 758 guarantee demand BG-26-1108 paid and recovered;
- a commercial credit application (`js/commercial.js`), APP-30414 Korat Isuzu: spreading with analyst adjustments, a projection with live stress against the DSCR policy, TCG cover, a rating scorecard that sets pricing and RAROC, the term sheet, the memo, the committee and construction drawdowns;
- the credit officer's side (`js/underwriting.js`): a Credit review queue, the workbench for APP-30409 with an adjustable income and debt worksheet, bureau history, appraisal, deviations that each carry their own approver level, a Copilot memo and five decisions; and the credit committee CC-2026-21 with conflicts, quorum, votes and minutes. The approval levels (credit officer ฿2m, head of retail credit ฿10m, committee above) are sample values;
- approval to payout (`js/disbursement.js`): DSB-30409 with conditions under maker-checker, the e-contract and stamp duty, insurance, the Land Office appointment and mortgage registration, and the payout gate;
- the retail credit policy (`js/policy.js`): POL-RETAIL holds the limits in one versioned place with draft, impact simulation, maker-checker and publish, and the form, credit review and collections read it. Its values are still sample values for the bank to set;
- Finance and month-end (`js/finance.js`): the October ECL run tied to the prototype's loans, the reconciliation, the BOT loan data set with validation and maker-checker, and the close checklist to CFO sign-off. The book outside the prototype's loans is aggregate sample figures, and the BOT data set's rules and codes are illustrative;
- account opening (`js/onboarding.js`): a form engine over field catalogues for individual onboarding ONB-7731 and business account opening AO-26-0412 (213 fields), with validation, a live risk score and routing; `docs/design/account-opening-fields.md` is generated from it;
- Deposits in depth (`js/deposits.js`): legal orders (LED, AMLO, police) under maker-checker, dormant accounts and the dormant fee, term deposit maturities with withholding tax, and the statement run. TD-88102 moved from Malee to a new customer, since Malee is in hardship. Legal and tax points are to confirm with counsel;
- Collections in depth (`js/collections.js`): strategy by bucket, contact rules the console enforces, the collector's case LN-A-C11 with hardship and restructuring, the legal and write-off case LN-A-C14, and the repossession R-A4 through auction. The restructured-loan cure rule now reads 3 consecutive months or 3 instalments, whichever is longer, everywhere. The Thai collection and restructuring rules are the prototype's reading, to confirm with counsel.

The prototype's authority matrix (23 action keys by 7 roles, in `docs/design/specs/prototype-inventory.md`) is what the backend authority check will need. Credit approval levels have one source: the credit policy's levels (`LEVELS` in `underwriting.js`), and above the officer's limit the approver is named by amount (head of retail credit to ฿10m, then the committee).

**Where it is published (both private; sharing is set from the artifact's Share menu):**
- the prototype: https://claude.ai/artifact/TV87zHeb7PuDxkSDe2YnUy (republish with the Artifact tool, `root` set to `docs/design/console-prototype`, `files` listing every changed `js/` file);
- a ten-slide client deck in the console's look, with speaker notes: https://claude.ai/artifact/QdjvBuokzY5tQ2cJPWHVeB. Its placeholders, still to fill before a meeting: client name, presenter and date on the cover; the pilot scope and the baseline-times date on the last slide. Its slide 7 promises that every regulatory reading is marked "to confirm". The deck's files lived in a session scratch folder, not in the repo; read them back from the artifact if they are needed.

`demo-script.md` is the meeting script (46 steps in nine chapters, with "more to show" lines for what is off the route). `build-offline.py` writes a single offline file (the output is git-ignored).

**Testing the prototype.** `node docs/design/console-prototype/tools/run-tests.mjs` runs seven suites in headless Edge (set `EDGE` if it is not at the default path): `main` (569 steps), `payments` (59), `treasury` (54), `leasing` (80), `syndication` (72), `branch` (74) and `walk`, which runs every presenter step (46). Each suite is a script in `tools/tests/` appended after `shell.js`; it opens every record tab in English and Thai, runs every action through review to done, and fails on `undefined`, `NaN` or `[object Object]` in the page. `tools/tests/consistency.js` (not in the runner) lists any record that two lists show with different customers. Add a suite or steps when you add a screen. `tools/core-api-inventory.mjs` and `tools/prototype-inventory.mjs` regenerate the two inventories in `docs/design/specs/`; `tools/application-fields.mjs` and `tools/account-opening-fields.mjs` regenerate the two field dictionaries.

## Standing instructions from the user

- Commit when a piece of work is finished, and push only when asked. Commit trailer: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` (follow the latest attribution instruction in the session if it differs).
- Be honest about what was verified: say plainly what ran and what did not.
- The rule that the console copies `prototype/index.html` exactly **is lifted**. The design is now the console prototype above plus the UX foundation; departures from it are recorded there.
- Token mode (`ui-smoke-token-123456`) is for development only.
- Rule-pack values (rate caps, rebate tiers, termination) are configuration to confirm with counsel. PD and LGD come from the bank.
- Confirm scope with the user before starting something large. The user has so far chosen, in order: deep prototype areas, then engineering specs, then the prototype fixes the specs found. **Starting the production React console has not been approved** ("Not now" to milestone 2 earlier, and not raised since). Ask which slice of `backlog.md` to start with.
- The user pushes only on request, and asks for it by name ("Push the branch claude/stoic-lamport-l78s32 to origin"). Do not push unprompted.

## Run it (this Windows machine)

```bash
# PostgreSQL 16 in Docker: container fabor-demo-pg on 127.0.0.1:55432, user postgres, password fabor.
# Database "fabor" is the demo app's, "fabor_test" the tests'. Start it if it is stopped:
docker start fabor-demo-pg

# Full build with tests (set FABOR_PG_URL to the fabor_test database; skip LedgerInvariantsTest on Windows)
mvn install -Dtest='!LedgerInvariantsTest' -Dsurefire.failIfNoSpecifiedTests=false
# Quick jar rebuild after controller or UI edits (install lending first if it changed)
mvn -o -DskipTests -Djacoco.skip=true install -pl fabor-app
```

Demo app: `SPRING_PROFILES_ACTIVE=demo FABOR_AUTH_MODE=token FABOR_API_TOKEN=ui-smoke-token-123456 FABOR_MASTER_KEY=<base64 of 40 bytes> FABOR_DB_URL=jdbc:postgresql://127.0.0.1:55432/fabor FABOR_GRPC_PORT=0 FABOR_HTTP_PORT=18080 FABOR_MGMT_PORT=18081 java -jar fabor-app/target/fabor-app-0.1.0-SNAPSHOT.jar`. Classic console at `/console/`, React console at `/console-next/`.

React console in development: `pnpm --dir web install`, `pnpm --dir web dev` (port 5180, forwards `/api` to 18080), `node web/scripts/seed-demo.mjs` for realistic data. Checks: `pnpm --dir web typecheck`, `pnpm --dir web test`, `pnpm --dir web build` (the next Maven build packs the dist into the jar). After API changes: `FABOR_API=http://localhost:18080 pnpm --dir web api:gen`.

Prototype: open `docs/design/console-prototype/index.html` in a browser (fonts from Google Fonts), or run `PYTHONIOENCODING=utf-8 python docs/design/console-prototype/build-offline.py` and open `offline/fabor-console.html`. In the desktop app, `preview_start` with the `prototype` entry in `.claude/launch.json` serves `offline/` on port 5190 (rebuild the offline file first; after `go(...)` calls in the page's console use `finishSignin()` to get past sign-in). Tests: `node docs/design/console-prototype/tools/run-tests.mjs` (headless Edge).

## Layout

| Path | What |
|---|---|
| `ledger/*` | Immutable bitemporal double-entry ledger, stores (PostgreSQL run; Oracle written, never run), sharding, gRPC |
| `engines/*` | interest, schedule, product DSL with CEL and rule packs, tax, lease, ECL |
| `catalog`, `simulator` | Master Builder (maker-checker, immutable versions), golden-file simulator |
| `deposit`, `lending`, `assets`, `onboarding`, `decisioning`, `payments`, `accounting` | Banking services |
| `scheduler` | Leased due-queue, worker, keyed idempotent tasks |
| `platform/*`, `services-persistence` | Money, tenancy, audit, PII vault, consents, JDBC stores, Flyway (V1 to V9) |
| `agent-gateway` | MCP gateway for AI agents |
| `fabor-app` | Spring Boot app: controllers, `SecurityConfig` (strict CSP on `/console-next`), `Lifecycle`, static consoles |
| `web/` | React console (`apps/console`), design system (`packages/ui`), typed API client (`packages/api`) |
| `docs/design/` | UX foundation, console prototype (`console-prototype/`: scripts in `js/`, tests and generators in `tools/`), earlier design and engineering-plan pages |
| `docs/design/specs/` | Engineering specs for the production console: one per area, generated inventories, and `backlog.md` |
| `plan/plan.json`, `docs/14-engineering-plan.md` | The plan |

## Things that will bite you

- **Windows.** `.gitattributes` forces LF; keep it. Testcontainers 1.x cannot talk to Docker Engine 29 here, so tests without `FABOR_PG_URL` silently skip PostgreSQL ("No PostgreSQL; skipping"). `LedgerInvariantsTest` exhausts ephemeral ports on Windows: exclude it or run it on Linux. Do not leave a shell inside a module's `target/`.
- **Maven offline:** new dependencies need one online `mvn dependency:resolve -pl <module>`. The app compiles against installed module jars, so install a changed module (often `lending`) before `fabor-app`.
- **OpenAPI:** request records must have unique simple names (two `SaleRequest`s once gave the client the wrong body); `FaborAppTest` now fails on a clash. `openapi-typescript` needs TypeScript 5.9 (pinned; 7 breaks it) and `--properties-required-by-default`; nullable fields are marked in `apps/console/src/lib/api.ts`.
- **Front end:** the React console runs under a strict CSP with no inline styles; use classes from `@fabor/ui`. Port 5173 is taken on this machine; the dev server uses 5180. Editing a package during `pnpm dev` reloads the page and closes an open dialog.
- **Prototype:**
  - Its scripts are classic scripts sharing one global scope, so their order in `index.html` and `build-offline.py` matters (`shell.js` last; add a new file to both). Rebuild the offline file after any change.
  - New areas should register themselves rather than edit shared files: `RECS`, `FLOWS`, `TH`, `ACTIONS` and `AUTH`, `EXTRA_LISTS.push(() => ({...}))` for list sections, `PAGE_VIEWS["system/section"]` for full pages (the router checks `PAGE_VIEWS` first), and `sysById.<system>.sections` for new sections. `js/payments.js` and `js/branch.js` are good models.
  - **Thai labels clash silently.** `TH` is one dictionary shared by every file, so a duplicate key overrides an earlier translation everywhere ("Note" was once "banknote"). Before adding keys, search for the key in `js/*.js`; reuse the existing one when the meaning matches, rename your label when it does not. A column named "Credit says" or "Limit" is right-aligned as money (`NUMERIC` in `views.js`); rename it if it holds text.
  - The page is a fragment with no `<html>` or charset: headless Edge reads it as Latin-1 unless a charset is added (the runners do this), and the preview server serves `offline/fabor-console.html`, which declares UTF-8.
  - Headless Edge can hang on a test that loops until a button disappears; the test runner has a timeout, but stop a stuck `msedge` by hand. The Browser pane's preview server stops between turns: start it again with `preview_start` (`prototype` in `.claude/launch.json`, port 5190, serving `offline/`).
  - The business date is Saturday 24 Oct 2026 everywhere (BAHTNET and bulk files closed, payday on Sunday, 23 Oct a Thai holiday); change it in `core.js` and expect dates in several screens and the demo script to follow.
- **Vehicle hire purchase in Thailand** may not be quoted flat (Contract Committee notification from 10 January 2023; BOT supervision since Notification 55/2568). Vehicle products use `ANNUITY` plus the rule pack; flat rate suits non-vehicle hire purchase. The primary texts were not read; confirm with counsel.
- A stale app holding the database makes `drop database` fail silently. `pkill -f` can kill your own shell; use pid files.

## Engineering specs (`docs/design/specs/`)

Start with its [README](design/specs/README.md): the ten-section template every spec follows (scope and users, screens, fields, actions, states, postings, configurable values, acceptance criteria, gaps against the core, open questions) and the conventions.

| File | What |
|---|---|
| `00-cross-cutting.md` | What every screen shares: roles and authority, the three-step action dialog, maker-checker, dual control, history, search, approvals inbox, exception centre, Copilot and agent actions |
| `01` to `11` | Onboarding; retail lending; business banking; trade and syndication; collections; leasing and auto finance; deposits; payments; branch; treasury; finance and control |
| `core-api-inventory.md`, `prototype-inventory.md` | Generated: the 101 endpoints the core has today, and the prototype's records, actions and authority matrix |
| `backlog.md` | Every **New** core call and module in twelve delivery slices; nine decisions where the prototype and the core disagree; the twelve prototype fixes (done) |

What the specs found, in short:
- The core has about 100 endpoints, mostly retail lending, collections, leases, floor plan, dealers and products. It has **no amount-based authority check, approvals queue, record history, search or Workbench feed**: those are slice 0 and everything else leans on them.
- Trade finance, syndication, payments rails, branch cash, legal orders, term deposits, treasury and regulatory reporting need **new modules**.
- Nine places where the prototype's agreed behaviour changes what the core already does (D1 to D9 in `backlog.md`): write-off against the allowance, the settlement quote's extra lines, restructuring as an offer the customer accepts, repossession shortfall kept owed, dealer payment net of subsidy, operating-lease end, the rebate's interest base, the loss-allowance run as a draft with scenarios and overlays, and splitting the loan application's decide-and-disburse call. **Each needs an owner's decision before work starts.**
- The agents wrote the specs by reading the prototype's source and the controllers and domain modules. Figures in the specs were recomputed from the prototype's code. Nothing in the specs has been compiled or run against the core.

## Next steps (recommended order; confirm with the user first)

1. **Decide D1 to D9** in `backlog.md` and the open questions at the end of each spec (identity provider and role claims, approval expiry, whether agents may execute within authority in the first release). Quick for the user to answer; blocks most of the backend work.
2. **Slice 0: foundations** (`backlog.md`): amount limits per role and action with an authority-check endpoint, one approvals service, record history over the existing `AuditLog`, search, the Workbench feed, the exception centre, a Thai holiday calendar, manual journals with maker-checker, and the missing roles. The React console's authority check in the action dialog depends on this.
3. **React console milestone 2: the shell.** Port the prototype's frame into `web/`:
   - the system rail and switcher, the per-system sidebar, the tenant and role menus, ⌘K search;
   - Thai and English with Buddhist-year dates, light, dark and compact.

   Then one record-page component (the figures strip, tabs and History) used for LN-A-C10, then leases, the floor plan and customers.
4. **Slices 1 to 3 (retail)** where the core already has most of the pieces: opening accounts, retail lending from application to payout, servicing and collections. Then the rest in `backlog.md` order; trade and syndication last.
5. **For a client meeting:** tailor the prototype and deck to a named client (brand in Admin → Branding, products and limits in the credit policy, a 15 to 20 step route from the 46, the deck's placeholders). Not started; needs the client's name or a stand-in profile.
6. **A rules review pack for counsel:** one document listing every rule the prototype marks "to confirm" (BOT, AMLO, PDPA, OCPB, TFRS 9 and 16, UCP 600, URDG 758) with where it applies and the value used. Not started; the deck's slide 7 promises it.
7. **Still open:**
   - CI has never run, not even the `web` job;
   - Playwright and axe checks; OIDC sign-in in the React console;
   - the Phase 2 leftovers in `plan/plan.json` (lease payments in advance and VAT on rentals, the ECL significant-increase test, wiring the GL projection into the app, and e-Tax behind the `Invoicing` sink).

## Not verified anywhere (be honest about it)

GitHub workflows have never run. The Oracle stores have never executed. The Docker image has never been built. No real Keycloak, OpenBao, eKYC provider, credit bureau, sanctions list or PromptPay rail has been used. There are no ML models and no LLM behind Copilot (the prototype's answers are written in). There are no native apps, no scale test and no penetration test. The prototype's figures are sample data computed to agree with each other, not output from the core. Rule-pack values are configuration to confirm with counsel and the regulator.

Specific to the prototype and specs from this session:
- The prototype was tested only in headless Edge (the suites above) and looked at in the Browser pane. It was **not tried in Chrome, Safari or on a phone**. The narrow-width layout pass (861 to 1180px) was done before payments, treasury, auto finance, syndication, the branch screens, business banking and trade existed; **those screens' narrow layouts have not been checked**.
- The deck was published but never viewed after rendering, by me; check it in the viewer.
- Every regulatory and market-convention reading in the prototype and specs (BOT, AMLO, PDPA, OCPB, TFRS 9 and 16, UCP 600, URDG 758, LMA clauses, THOR, LCR, the OCPB rate cap and rebate tiers, calling hours, cash reporting thresholds) is **the prototype's reading, not confirmed with counsel**. The primary texts were not read. The LCR level 2 caps are known to be simplified.
- The specs' mapping of actions to core endpoints comes from reading controllers and domain modules; no call was made against a running core.
- One simplification the specs flag is left in the prototype: syndication's commitment fee is charged on the full undrawn amount for the whole quarter and ignores the ฿460m drawn from 25 Sep (see spec 04).

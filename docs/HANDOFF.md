# Handoff for the next session

Read this first, then [`phase1-status.md`](phase1-status.md), [`07-roadmap.md`](07-roadmap.md), the [UX foundation](design/ux-foundation.md) and the [console prototype](design/console-prototype/README.md).

## What this is

Fabor OS: an AI-native core banking platform (retail, commercial and virtual banks; any loan product including leasing and hire purchase). Java 21, Maven multi-module, Spring Boot 3.5.6, PostgreSQL 16, plain JDBC with Flyway. Front end: the classic static console, a React console in `web/` (ADR-0011), and a clickable design prototype in `docs/design/console-prototype/`. Branch `claude/stoic-lamport-l78s32` on GitHub `akarapolb/CoreBank`. No pull request has been opened; do not open one unless asked.

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

**Design prototype** (`docs/design/console-prototype/`, committed in `3ef95fa`): the agreed target design for the whole console. It is a clickable page with sample data covering 19 systems; the main pieces are:

- the shell: a system rail and switcher with a short sidebar per system, tenants and roles, pinning, search, and Thai and English with Buddhist-year dates;
- record pages, and every action as enter, review and confirm, with an authority check per role;
- Copilot, the exception centre, month-end close, an AML case, a held payment, loan origination, a customer app and analytics;
- light, dark and Calm themes, sign-in with MFA, presenter and executive modes, and bank branding.

It is published privately at https://claude.ai/artifact/R7VtX5SGT2mSrgcFSe2w1L (sharing is set from the page). `demo-script.md` is the meeting script. `build-offline.py` writes a single offline file (the output is git-ignored).

## Standing instructions from the user

- Commit when a piece of work is finished, and push only when asked. Commit trailer: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` (follow the latest attribution instruction in the session if it differs).
- Be honest about what was verified: say plainly what ran and what did not.
- The rule that the console copies `prototype/index.html` exactly **is lifted**. The design is now the console prototype above plus the UX foundation; departures from it are recorded there.
- Token mode (`ui-smoke-token-123456`) is for development only.
- Rule-pack values (rate caps, rebate tiers, termination) are configuration to confirm with counsel. PD and LGD come from the bank.
- Confirm scope with the user before starting something large. The last answer was **"Not now"** to starting milestone 2 of the React console.

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

Prototype: open `docs/design/console-prototype/index.html` in a browser (fonts from Google Fonts). The browser pane in the desktop app shows local files as static snapshots without their scripts, so to check the prototype use headless Edge (`C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe --headless=new --screenshot=... --window-size=1440,900 <file url>`, or `--dump-dom` with a test script appended). That is how it was tested.

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
| `docs/design/` | UX foundation, console prototype, earlier design and engineering-plan pages |
| `plan/plan.json`, `docs/14-engineering-plan.md` | The plan |

## Things that will bite you

- **Windows.** `.gitattributes` forces LF; keep it. Testcontainers 1.x cannot talk to Docker Engine 29 here, so tests without `FABOR_PG_URL` silently skip PostgreSQL ("No PostgreSQL; skipping"). `LedgerInvariantsTest` exhausts ephemeral ports on Windows: exclude it or run it on Linux. Do not leave a shell inside a module's `target/`.
- **Maven offline:** new dependencies need one online `mvn dependency:resolve -pl <module>`. The app compiles against installed module jars, so install a changed module (often `lending`) before `fabor-app`.
- **OpenAPI:** request records must have unique simple names (two `SaleRequest`s once gave the client the wrong body); `FaborAppTest` now fails on a clash. `openapi-typescript` needs TypeScript 5.9 (pinned; 7 breaks it) and `--properties-required-by-default`; nullable fields are marked in `apps/console/src/lib/api.ts`.
- **Front end:** the React console runs under a strict CSP with no inline styles; use classes from `@fabor/ui`. Port 5173 is taken on this machine; the dev server uses 5180. Editing a package during `pnpm dev` reloads the page and closes an open dialog.
- **Prototype:** its scripts are classic scripts sharing one global scope, so their order in `index.html` matters. Rebuild the offline file after any change.
- **Vehicle hire purchase in Thailand** may not be quoted flat (Contract Committee notification from 10 January 2023; BOT supervision since Notification 55/2568). Vehicle products use `ANNUITY` plus the rule pack; flat rate suits non-vehicle hire purchase. The primary texts were not read; confirm with counsel.
- A stale app holding the database makes `drop database` fail silently. `pkill -f` can kill your own shell; use pid files.

## Next steps (recommended order; confirm with the user first)

1. **React console milestone 2: the shell.** Port the prototype's frame into `web/`:
   - the system rail and switcher, the per-system sidebar, the tenant and role menus, ⌘K search;
   - Thai and English with Buddhist-year dates, light, dark and compact.

   Then one record-page component (the figures strip, tabs and History) used for LN-A-C10, then leases, the floor plan and customers.
2. **Authority check in the action dialog.** It needs a backend piece: a limits table per role and action, and an endpoint the review step calls (the prototype's `AUTH` table in `js/data.js` is the starting shape).
3. **Customers and Asset finance in React** against the live API (milestone 2 as planned in the UX foundation).
4. **Backend for screens the prototype added:** the exception centre (unify reconciliation breaks, dead letters, integration errors), held payments with sanctions screening, the month-end close checklist, AML alerts and cases.
5. **Still open:**
   - CI has never run, not even the `web` job;
   - Playwright and axe checks; OIDC sign-in in the React console;
   - the Phase 2 leftovers in `plan/plan.json` (lease payments in advance and VAT on rentals, the ECL significant-increase test, wiring the GL projection into the app, and e-Tax behind the `Invoicing` sink).

## Not verified anywhere (be honest about it)

GitHub workflows have never run. The Oracle stores have never executed. The Docker image has never been built. No real Keycloak, OpenBao, eKYC provider, credit bureau, sanctions list or PromptPay rail has been used. There are no ML models and no LLM behind Copilot (the prototype's answers are written in). There are no native apps, no scale test and no penetration test. The prototype's figures are sample data computed to agree with each other, not output from the core. Rule-pack values are configuration to confirm with counsel and the regulator.

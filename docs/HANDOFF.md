# Handoff for the next session

Written at the end of the Phase 1 closing session. Read this first, then [`phase1-status.md`](phase1-status.md) and [`07-roadmap.md`](07-roadmap.md).

## What this is

Fabor OS: an AI-native core banking platform (retail, commercial, virtual bank; any loan product including leasing and hire purchase). Java 21, Maven multi-module, Spring Boot 3.5.6, PostgreSQL 16, plain JDBC with Flyway. Branch `claude/stoic-lamport-l78s32` (GitHub `akarapolb/corebank`). No pull request has been opened; do not open one unless asked.

## State

- **Phase 0 and Phase 1: built and tested.** Every Phase 1 item that code can close is closed. What cannot be closed here is listed in `phase1-status.md` ("Not built, and why") and `phase0-exit-report.md`.
- **Phase 2: started.** `engines/engine-tax` (VAT, `TaxInvoice`) and `engines/engine-lease` (finance and operating lease, `LeaseJournal`) are committed and tested. Nothing else from Phase 2 exists.
- Last full build: BUILD SUCCESS, all modules, 90% branch coverage gate met, app tests green on real PostgreSQL. Browser smoke tests (token mode and OIDC mode) pass.

## Standing instructions from the user

- "Continue per plan, don't skip unless I say so." Follow `plan/plan.json` order. The user said "close phase 1 first" once, then it was closed.
- **The UI must follow `prototype/index.html` verbatim.** The console is that file split into `console.css`, `proto.js`, `index.html`; do not restyle it. Live data is added only through `live.js` and the `window.FABOR` seam (three `LIVE` hooks in `proto.js`). New screens must reuse the prototype's components (panel, form, field, chip, result, kv, table). The customer app (`/app/`) uses the prototype's tokens, fonts and logo.
- Commit and push to the designated branch when work is done (a stop hook enforces it). Commit trailers: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` and `Claude-Session: <session url>`.
- Be honest about what is verified. Say plainly what ran and what did not.

## Run it

```bash
# PostgreSQL 16 on 5433 (this container's cluster: /tmp/pgdata, socket /tmp, user pg). Restart if "connection refused":
#   /usr/lib/postgresql/16/bin/pg_ctl -D /tmp/pgdata -o "-p 5433 -k /tmp" -l /tmp/pg.log start
export FABOR_PG_URL=jdbc:postgresql://localhost:5433/postgres FABOR_PG_USER=pg      # tests use this; otherwise Testcontainers
mvn -o install                                   # full build with tests and the coverage gate (~10 min)
mvn -o -DskipTests -Djacoco.skip=true install -pl fabor-app    # quick rebuild of the jar after UI or controller edits
```

Demo app with seeded behaviour (fake eKYC and bureau, dev token mode): `SPRING_PROFILES_ACTIVE=demo FABOR_AUTH_MODE=token FABOR_API_TOKEN=ui-smoke-token-123456 FABOR_MASTER_KEY=<base64 of 40 bytes> FABOR_DB_URL=... FABOR_GRPC_PORT=0 FABOR_HTTP_PORT=18080 FABOR_MGMT_PORT=18081 java -jar fabor-app/target/fabor-app-0.1.0-SNAPSHOT.jar`, then:

```bash
NODE_PATH=$(npm root -g) node scripts/console-smoke.js        # console, token mode
NODE_PATH=$(npm root -g) OUT=docs/ui node scripts/ui-tour.js # regenerate the 18 screenshots in docs/ui/ (needs an empty database)
```

`scripts/console-oidc-smoke.js` needs `scripts/mock-idp.js` on :18090 and the app in OIDC mode (variables in `docs/quickstart.md`). `docs/quickstart.md` has the full setup.

## Layout

| Path | What |
|---|---|
| `ledger/*` | Immutable bitemporal double-entry ledger, stores (PostgreSQL run; Oracle written, never run), sharding, gRPC API |
| `engines/*` | interest, schedule (annuity, flat, equal principal, odd-day), product DSL + CEL + rule packs, tax, lease |
| `catalog`, `simulator` | Master Builder (maker-checker, immutable versions), golden-file simulator |
| `deposit`, `lending`, `onboarding`, `decisioning`, `payments`, `accounting` | Banking services (see `phase1-status.md`) |
| `scheduler` | Leased due-queue (`FOR UPDATE SKIP LOCKED`), worker, keyed idempotent tasks |
| `platform/*`, `services-persistence` | Money, tenancy, audit log, PII vault, consents, JDBC stores, Flyway (three history tables) |
| `agent-gateway` | MCP gateway for AI agents |
| `fabor-app` | Spring Boot app: controllers (`ProductsController`, `BankingController`, `CustomersController`, `StaffViewController`, `MeController`, `AdminController`), `SecurityConfig`, `Lifecycle`, static UIs |
| `fabor-app/src/main/resources/static/console` | The prototype console (`proto.js`, `console.css`, `index.html`) plus `live.js` |
| `fabor-app/src/main/resources/static/app` | Customer mobile PWA |
| `prototype/index.html` | The original design prototype: the source of truth for the console's look |
| `plan/plan.json`, `docs/14-engineering-plan.md` | The plan |

## Things that will bite you

- `pkill -f` and `pgrep -f` can kill your own shell; use pid files.
- A stale app holding the database makes `drop database` fail silently, so the tour shows "Version already published". Kill strays first.
- Test JVM: `-Xlint:all -Werror`, `dependencyConvergence` (skipped only in `fabor-app`), 90% branch coverage per module. New code needs tests in the same module; `-DskipTests` makes the coverage check fail unless you add `-Djacoco.skip=true`.
- The console CSP (`SecurityConfig.consoleUi`) allows Google Fonts and style attributes because the prototype needs them; the API chain keeps the strict policy. Inline event handlers are not allowed (the prototype's four `onsubmit` attributes were removed; `live.js` prevents form submission instead).
- After an OIDC redirect, set `location.hash` to trigger the prototype's router (`replaceState` does not fire `hashchange`).
- The product definition the Master Builder emits (`toDsl` in `live.js`) uses VAT on fees only and a free-text rebate; hire-purchase rule packs and instalment VAT are Phase 2 work. Server-side check findings are shown to the user as they are.
- Ledger batch "origin" (SYSTEM or HUMAN) in the console is inferred from the posting-id scheme (`StaffViewController.origin`), not stored.

## Next steps (Phase 2, in plan order)

1. **Hire purchase:** annuity from flat rate, EIR disclosure, balloon, VAT on instalments, e-Tax invoice integration (engine-tax has the model; the sink is a port). Hire-purchase rate caps and the early-settlement rebate formula (the "rule of 78"-style Thai HP rebate) as a rule pack. Prepayment and holidays currently refuse flat-rate products.
2. **Leases (TFRS 16):** wire `engine-lease` into the lending service and GL mapping (`lease_tfrs16_v1`).
3. **Asset register,** title, insurance, dealer channel; then fleet master agreements, call-offs, consolidated billing; floor plan lines, curtailments, payoff on sale, sold-out-of-trust alerts.
4. **Collections v1, repossession and remarketing, TFRS 9 ECL engine v1** (restructuring currently books a modification loss only, never a gain).
5. **Console:** bring the prototype's sample screens (Product Studio, Fleet and floor plan, Overview KPIs) onto real data as the services land, using `live.js` and the same components.
6. Parallel-run harness, SOC 2 / ISO 27001 readiness, first leasing customer: business and external work as much as code.

Confirm scope with the user before starting; the last offer ("Should I start Phase 2?") was unanswered.

## Not verified anywhere (be honest about it)

GitHub workflows have never run. The Oracle stores have never executed. The Docker image has never been built. No real Keycloak, OpenBao, eKYC provider, credit bureau or PromptPay rail has been used. There are no ML models and no LLM assistant. There are no native apps, no scale test and no penetration test. Rule-pack values are configuration to confirm with counsel and the regulator.

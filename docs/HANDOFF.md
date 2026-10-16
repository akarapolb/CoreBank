# Handoff for the next session

Written at the end of the Phase 1 closing session. Read this first, then [`phase1-status.md`](phase1-status.md) and [`07-roadmap.md`](07-roadmap.md).

## What this is

Fabor OS: an AI-native core banking platform (retail, commercial, virtual bank; any loan product including leasing and hire purchase). Java 21, Maven multi-module, Spring Boot 3.5.6, PostgreSQL 16, plain JDBC with Flyway. Branch `claude/stoic-lamport-l78s32` (GitHub `akarapolb/corebank`). No pull request has been opened; do not open one unless asked.

## State

- **Phase 0 and Phase 1: built and tested.** Every Phase 1 item that code can close is closed. What cannot be closed here is listed in `phase1-status.md` ("Not built, and why") and `phase0-exit-report.md`.
- **Phase 2: started.** `engines/engine-tax` (VAT, `TaxInvoice`, `InstalmentVat`) and `engines/engine-lease` (finance and operating lease, `LeaseJournal`) are committed and tested. Hire purchase so far: flat-rate schedules accept a balloon (`Method.ANNUITY_FROM_FLAT`); `RebateRule` (`ACTUARIAL`/`EIR`/`NONE`, `RULE_OF_78`, `PERCENT:x`, `TIERED:a,b,c`) is validated by `ProductValidator` and applied by `LoanService.settle` (the interest the rule still charges is one atomic ledger batch with the payment, to income or suspense on a non-accrual loan); `ThailandHirePurchaseRules` (rule pack `TH-HP-VEHICLE-v1`, registered in `AppConfig`) checks vehicle products; instalment VAT: a product with `tax.vat.applies_to: [INSTALMENT_INTEREST]` or `[INSTALMENT_TOTAL]` gets VAT added when an instalment is billed (`Loan.Instalment.vatDue`/`vatPaid`, loan VAT receivable account `loan:ID:vat`, migration `V3__instalment_vat.sql`), paid through the waterfall's `VAT_DUE`, invoiced through the `Invoicing` sink as `INV-<loan>-I<n>`, charged on the interest an early settlement still collects (interest base only; a whole-instalment base refuses settlement while instalments are unbilled), included in a write-off (the VAT stays payable: relief is a tax-team decision) and blocking a restructuring until paid. Leases (TFRS 16): `LeaseService` (lending) books finance leases (payments in arrears) and operating leases, accrues each period by time (finance income; or rent billed, straight-line rent against one signed accrued-or-deferred rent account, and depreciation) and collects cash from the customer deposit account against the oldest accrued period; `Lease`/`LeaseRepo`/`JdbcLeaseRepo` (migration `V4__leases.sql`); `GlMapping.leaseTfrs16V1()`; beans in `AppConfig`. No REST endpoint or console screen yet. Asset register (new module `assets`): `AssetService` registers assets (unique VIN/serial), tracks ORDERED, DELIVERED, ACTIVE, RETURNED and DISPOSED, keeps the title with the lessor until the contract is paid off (`transferTitle`, with a title-event history), and tracks insurance policies (cover on a day, uninsured and expiring-cover lists; activation can require cover); `DealerService` onboards and suspends dealers and pays a dealer for an active asset (settles `gl:supplier-payable`, pays commission to `gl:dealer-commission-deferred`, once per asset); `JdbcAssetRepo`/`JdbcDealerRepo` (migration `V5__assets.sql`); beans in `AppConfig`, with the contract-settled check over the loan and lease repositories. No REST endpoint or console screen yet. Fleet master agreements (lending): `MasterService` signs agreements (facility limit, rate card by vehicle class, term range and validity dates, cross-default days past due), draws call-offs as loans at the rate locked from the card on the day (`LoanService.disburseAtRate`; the dealer account receives the whole principal and the customer account pays the fee and the instalments), checks the limit against outstanding principal, builds one `ConsolidatedInvoice` across schedules (VAT split per vehicle), spreads one payment across schedules oldest due first (retry-safe per reference), defaults the agreement when any schedule reaches the covenant and cures it; `JdbcMasterRepo` (migration `V6__fleet_master_agreements.sql`); beans in `AppConfig`. No REST endpoint or console screen yet. Floor plan (lending): `FloorPlanService` runs dealer lines (revolving, sub-limits by NEW/USED/DEMO, terms and curtailment steps on the line itself), one drawdown per unit paid to the distributor, daily interest on the unit with the unit type interest-free days booked to the manufacturer (`gl:oem-subvention-receivable`) rather than the dealer, curtailments (`principalDue`), dealer statements, sale recording with a payoff window (`overdueSales`), payoff and repayments from the dealer settlement account (interest first), and `settleFromRetailLoan` (checks a live retail loan at least as big as the payoff); `JdbcFloorPlanRepo` (migration `V7__floor_plan.sql`); `GlMapping.assetFinanceV1()`; beans in `AppConfig`. No REST endpoint or console screen yet. Flat-rate prepayment and payment holidays: `LoanService.prepay` and `holiday` accept `ANNUITY_FROM_FLAT` products (`requireAmortising`). A prepayment charges the prepaid share of the unbilled interest less the same share of the product's rebate rule (nothing for `ACTUARIAL` or no rule), plus VAT on that interest for interest-base products with a `PREPAY` invoice, then rebuilds the balance flat; VAT on the whole instalment refuses it (as settlement does). A holiday capitalises at the periodic rate implied by the unbilled instalments (`impliedPeriodic`) and rebuilds flat. `restructure` accepts flat loans (rebuilt flat at the new flat rate; the modification loss is measured at the implied rate). VAT on the whole instalment: early settlement and prepayment charge VAT on the principal they replace plus the interest still charged (`settlementTaxable`, `prepaidVat`; a tax-team decision to confirm). `Disclosure` (engine-product) builds the cost-of-credit text (quoted rate, EIR, all-in rate with up-front fees, totals), served at `GET /api/v1/products/{product}/versions/{version}/disclosure?principal=&term=&date=` (compiled, not exercised by an app test: no PostgreSQL was available). Leases: `LeaseService.terminate` (finance lease paid out at the net investment carried plus a fee) and `purchase` (lessee buys at the end; disposal gain or loss in `gl:lease-disposal-gain`), statuses `TERMINATED` and `PURCHASED`. Floor plan: `FloorPlanService.stockAudit` compares open stock with unit ids found on the lot (missing, sale overdue, unexpected; read-only, nothing persisted). Nothing else from Phase 2 exists.
- Last full build (Windows, JDK 21, PostgreSQL 16 in Docker via `FABOR_PG_URL`): BUILD SUCCESS, all modules, coverage gates met, app tests green on real PostgreSQL, with `LedgerInvariantsTest` excluded (see "Things that will bite you"). The browser smoke tests (token mode and OIDC mode) were last run in the earlier Linux session; they were not re-run after the hire-purchase change.

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

- **Windows.** A global `core.autocrlf=true` turns test resources into CRLF and breaks tests that match on `"
"`; the repo now has `.gitattributes` (`* text=auto eol=lf`). `Golden.render` forces LF in the pretty printer (Jackson used the platform separator). Testcontainers 1.x cannot talk to Docker Engine 29 here, so PostgreSQL tests were silently skipped ("No PostgreSQL; skipping"): start a container yourself (`docker run -d --name fabor-test-pg -e POSTGRES_PASSWORD=... -p 127.0.0.1:55432:5432 postgres:16.4-alpine`) and set `FABOR_PG_URL`/`FABOR_PG_USER`/`FABOR_PG_PASSWORD`. `LedgerInvariantsTest` opens thousands of connections and exhausts Windows' ephemeral ports (`BindException: Address already in use`), so it did not run on Windows: use `-Dtest='!LedgerInvariantsTest' -Dsurefire.failIfNoSpecifiedTests=false` or run it on Linux. Do not leave a shell inside a module's `target/` (Maven cannot clean it).
- **Vehicle hire purchase in Thailand may not be quoted flat.** Law-firm summaries of the Contract Committee notification in force from 10 January 2023 say interest must be charged on the outstanding principal, with effective-rate ceilings of 10% (new car), 15% (used car), 23% (motorcycle) and an early-settlement rebate of at least 60% / 70% / 100% of the interest not yet due at up to a third / two thirds / beyond two thirds of the term paid. The Bank of Thailand has since taken over supervision (Notification 55/2568, December 2025). The primary texts were not read; the numbers in `ThailandHirePurchaseRules` are configuration to confirm with counsel. The flat-rate engine therefore suits non-vehicle hire purchase (equipment, consumer goods), and vehicle products use `ANNUITY` plus the rule pack.

- `pkill -f` and `pgrep -f` can kill your own shell; use pid files.
- A stale app holding the database makes `drop database` fail silently, so the tour shows "Version already published". Kill strays first.
- Test JVM: `-Xlint:all -Werror`, `dependencyConvergence` (skipped only in `fabor-app`), 90% branch coverage per module. New code needs tests in the same module; `-DskipTests` makes the coverage check fail unless you add `-Djacoco.skip=true`.
- The console CSP (`SecurityConfig.consoleUi`) allows Google Fonts and style attributes because the prototype needs them; the API chain keeps the strict policy. Inline event handlers are not allowed (the prototype's four `onsubmit` attributes were removed; `live.js` prevents form submission instead).
- After an OIDC redirect, set `location.hash` to trigger the prototype's router (`replaceState` does not fire `hashchange`).
- The product definition the Master Builder emits (`toDsl` in `live.js`) uses VAT on fees only and a free-text rebate; hire-purchase rule packs and instalment VAT are Phase 2 work. Server-side check findings are shown to the user as they are.
- Ledger batch "origin" (SYSTEM or HUMAN) in the console is inferred from the posting-id scheme (`StaffViewController.origin`), not stored.

## Next steps (Phase 2, in plan order)

1. **Hire purchase, what is left:** tax-team sign-off on the whole-instalment VAT termination rule; counsel review of the disclosure wording and an app test for its endpoint; a real e-Tax service behind the `Invoicing` sink; the console's Master Builder emits no vehicle segment or instalment VAT yet, so `ThailandHirePurchaseRules` and instalment VAT apply only to products that declare them. Also seen: a written-off loan's `settlementQuote` still counts the interest of its unbilled instalments (older behaviour, not changed).
2. **Leases (TFRS 16), what is left:** payments in advance (the engine supports `Timing.ADVANCE`; `LeaseService.bookFinance` always books arrears; income timing needs a decision), VAT on rentals (needs a `Lease.Period` field, so a migration), termination of operating leases, impairment of the net investment (TFRS 9 ECL), a REST API and console screens, and wiring lease postings into the GL projection and reconciliation run (the projection is not wired into the app yet).
3. **Asset register, what is left:** an API and console screens, financed premiums and claims as payments to the contract, EIR amortisation of dealer commission (TFRS 9), subvention, dealer onboarding checks, depreciation per asset for operating leases from the register, and linking an asset to a lease or loan at booking; fleet, what is left: per-vehicle events (substitution, payoff or repossession of one vehicle, transfer between cost centres), cost-centre and driver allocation, an API and console, TFRS 9 stage 3 on a defaulted agreement, e-Tax invoices for the consolidated invoice, a termination rule for settling a schedule early under instalment VAT on the whole instalment; floor plan, what is left: persisting audit history and alerting on `stockAudit` findings, the manufacturer paying subvention, rate tiers by unit age, OEM repurchase and dealer guarantees, deposit margins, the dealer risk grade, and a tie between `FloorPlanUnit.unitId` and the asset register.
4. **Collections v1, repossession and remarketing, TFRS 9 ECL engine v1** (restructuring currently books a modification loss only, never a gain).
5. **Console:** bring the prototype's sample screens (Product Studio, Fleet and floor plan, Overview KPIs) onto real data as the services land, using `live.js` and the same components.
6. Parallel-run harness, SOC 2 / ISO 27001 readiness, first leasing customer: business and external work as much as code.

Confirm scope with the user before starting; the last offer ("Should I start Phase 2?") was unanswered.

## Not verified anywhere (be honest about it)

GitHub workflows have never run. The Oracle stores have never executed. The Docker image has never been built. No real Keycloak, OpenBao, eKYC provider, credit bureau or PromptPay rail has been used. There are no ML models and no LLM assistant. There are no native apps, no scale test and no penetration test. Rule-pack values are configuration to confirm with counsel and the regulator.

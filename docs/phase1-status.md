# Phase 1 status (retail and virtual bank MVP)

Measured against the Phase 1 plan items ([07](07-roadmap.md), `plan/plan.json`). "Built" means code with tests in this repository. Nothing here has run in production, and the GitHub workflows have never run.

## Built and tested

| Plan item | Where | Evidence |
|---|---|---|
| Product DSL, CEL, schedule and interest engines | `engines/engine-interest`, `engine-schedule`, `engine-product` | Property tests (schedules always sum to principal and close to zero; a property test found and fixed a negative-interest rounding bug); CEL fees exact in minor units; strict YAML (unknown keys rejected); deposit tiers; Thailand retail rule pack (personal-loan cap on the all-in effective rate) |
| Simulator and golden tests | `simulator` | Standard scenarios (on time, late, early settlement); golden file committed and verified, drift fails the build |
| Master Builder and maker-checker publishing | `catalog` | Author cannot approve; each role approves once by a different person; edits void approvals; publish re-checks the approved text; immutable versions; diff |
| Partitioned time-wheel scheduler (ADR-0007) | `scheduler/` | Lease-based claims with `FOR UPDATE SKIP LOCKED`; conformance suite incl. 8 concurrent workers never double-claiming, catch-up after outage, retry and dead-letter; PostgreSQL |
| Party, consents, PII vault, audit log | `platform/platform-security`, `onboarding`, `services-persistence` | Hash-chained audit log (tamper detection, concurrent writers do not fork it, rows immutable in the database); AES-GCM vault with blind index and key rotation; PDPA consent history |
| Deposits (savings, tiered interest, withholding tax) | `deposit` | Interest computed from daily balance history (no stored accrual); marginal and whole-balance tiers; withholding with annual exemption and catch-up; idempotent month-end capitalization |
| Personal loans | `lending` | Disbursement net of fee; billing; waterfall repayment (oldest instalment first); daily late charge; non-accrual at the product's days past due; early settlement; retries safe |
| GL mapping and daily reconciliation | `accounting` | Event-fed GL projection compared with the ledger; a lost event shows up as a named break |
| PromptPay QR | `payments` | EMVCo payload, CRC-16 verified against the standard check value, parse and validate |
| Credit decisioning with reason codes, sanctions screening, fraud scoring | `decisioning` | Explainable scorecard with hard policy rules; name screening (Jaro-Winkler, token order, accents, date of birth); transaction risk rules |
| Onboarding and origination workflows | `onboarding` | Consent, tokenised PII, eKYC, screening, account opening; bureau, decision, disbursement; every step audited |
| Spring Boot app | `fabor-app` | End-to-end test over HTTP and gRPC on real PostgreSQL: products published through maker-checker, customer onboarded, loan approved and disbursed, scheduler tasks enqueued, token required on REST and gRPC, overdraft maps to 422 |

## Not built, and why

| Plan item | Status |
|---|---|
| Real eKYC provider, credit bureau (NCB), PromptPay rails | Ports exist; the app wires "no provider" defaults (eKYC fails closed, bureau returns nothing). Needs provider contracts and credentials. |
| Credit decisioning model, document intelligence, fraud ML, customer assistant | Rule-based decisioning only. Models need data and model-risk governance; the assistant needs an LLM deployment. |
| Reference mobile app | Not built. The REST API is the base for it. |
| Scale-out test (100k/s across 10 cells) | Needs a performance environment. Sharding and cross-shard transfers are built and tested in memory only. |
| Penetration test, IT risk assessment, regulator sandbox, design partner, Series A, staff pilot | External or business work, not code. |
| Oracle for scheduler and services repositories | PostgreSQL only; the ledger has an Oracle store that has never been run. |
| Container image | Dockerfile written, never built (no Docker here). |

## Gaps closed after the first status report

| Gap | What was done |
|---|---|
| Shared-token authentication | OIDC is the default: JWTs verified against the identity provider's keys (signature, issuer, expiry), roles from `realm_access.roles` enforced per operation (`product-maker`, `approver-<role>`, `product-publisher`, `ops`, `compliance-analyst`, `ops-admin`, gRPC `ledger-client`), actor taken from the token. The shared token remains only as an explicit development mode. Tested with forged, expired and wrong-issuer tokens. |
| Keys derived from one master secret | `OpenBaoKeyProvider` reads per-tenant keys from OpenBao KV v2 with a short cache, supports rotation, and fails closed. Tested against a stub speaking the KV v2 read API, not against a real OpenBao. |
| Back-office console | A browser console at `/console/` (products and maker-checker, customers, accounts, loans, operations). Driven end to end in headless Chromium by `scripts/console-smoke.js`; no horizontal scroll at phone width; CSP set. It takes a pasted token: browser login (authorization code with PKCE) is not built. |
| Partial prepayment, payment holidays | Prepayment (reduce term or reduce instalment) and holidays with interest capitalised, on fixed-rate annuity products; ledger balances equal the rebuilt schedule; retries safe. |
| VAT on fees, tax invoices | VAT on the origination fee when the product says so, posted to VAT payable, with a tax invoice handed to a sink. |
| Odd-day first-period interest | The schedule engine charges a first period of irregular length for its actual days. |
| Loans created before the scheduler existed | `backfill` queues missing billing, accrual and interest work for active loans and accounts; runs at startup and from an admin endpoint; the billing task now follows schedule changes. |

## Known gaps in what is built

- Loan servicing still lacks restructuring (modification gain or loss, debt consolidation) and write-off and recovery.
- Prepayment and holidays do not apply to flat-rate (hire purchase) products; those need the rebate rules of Phase 2.
- Browser sign-in for the console (authorization code with PKCE) is not built; OIDC is exercised through API tokens only, against a locally generated key, not a real Keycloak.
- Rule-pack values (rate cap, retention, thresholds) are configuration to confirm with counsel and the regulator, not legal advice.

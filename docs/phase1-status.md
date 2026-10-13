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
| Back-office console v1, reference mobile app | Only the HTML prototype exists. The REST API is the base for them. |
| Scale-out test (100k/s across 10 cells) | Needs a performance environment. Sharding and cross-shard transfers are built and tested in memory only. |
| Penetration test, IT risk assessment, regulator sandbox, design partner, Series A, staff pilot | External or business work, not code. |
| OIDC authentication | The app uses a shared bearer token with an `X-Actor` header. It is a pilot placeholder behind a gateway, not production authentication. |
| Oracle for scheduler and services repositories | PostgreSQL only; the ledger has an Oracle store that has never been run. |
| Container image | Dockerfile written, never built (no Docker here). |

## Known gaps in what is built

- Loan servicing does not yet handle partial prepayment, VAT on fees, payment holidays or restructuring, and odd-day first-period interest is not modelled.
- The scheduler runs inside the app; billing for a loan is enqueued when it is disbursed, so loans created before the scheduler existed would not be picked up.
- `ConfigKeyProvider` derives keys from one master secret in the process. Production needs the OpenBao-backed provider.
- Rule-pack values (rate cap, retention, thresholds) are configuration to confirm with counsel and the regulator, not legal advice.

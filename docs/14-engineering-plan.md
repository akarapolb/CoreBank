# 14 — Engineering plan

How the Fabor OS team builds the platform: who, in what order, with which practices and quality gates. It turns the roadmap ([07](07-roadmap.md)) into executable work, starting with a sprint-level plan for Phase 0.

## 1. Engineering goals

| # | Goal | Measured by |
|---|---|---|
| 1 | Correct money, always | Zero unbalanced postings in any environment; property-based and conformance suites green on every merge |
| 2 | Fast by design | Ledger p99 < 50 ms at 10,000 batches/s per cell; no p99 regression merges |
| 3 | Ship small and often | Trunk-based development, daily merges, release every 2 weeks from Phase 1 |
| 4 | Portable and open | PostgreSQL and Oracle green on every merge; only OSI-licensed dependencies |
| 5 | Operable from day one | Every service has dashboards, alerts and a runbook before it reaches staging |

## 2. Workstreams and dependencies

```
Platform kernel (money, time, tenancy, persistence, events, security)
   └─► Ledger ─► Scheduler (time-wheel) ─┐
                                         ├─► Deposits ─► Payments hub
   Product engine + simulator ───────────┤
                                         ├─► Lending ─► Leasing / HP ─► Fleet, floor plan
                                         └─► Limits & collateral ─► Commercial ─► Trade, treasury, syndication
   Agent gateway + AI decisioning ─────────► (attaches to every service through its APIs)
   Delivery platform (CI/CD, environments, observability) ─► everything
```

The ledger and platform kernel are on the critical path for everything. Nothing that moves money starts before the ledger passes its conformance suite.

## 3. Team topology

Squads of 5–7 people, each owning services end to end (build, test, run). Every squad has a tech lead, engineers, a quality engineer and access to a shared SRE.

| Squad | Owns | Starts | Size at start → Phase 3 |
|---|---|---|---|
| Ledger & platform | Platform kernel, ledger, scheduler, performance | Month 0 | 6 → 8 |
| Delivery platform & SRE | CI/CD, environments, observability, security tooling | Month 0 | 3 → 6 |
| Product engine | DSL, CEL, schedule and interest engines, simulator, Master Builder | Month 1 | 4 → 6 |
| Deposits & payments | Deposits, payments hub, PromptPay, statements | Month 3 | 5 → 6 |
| Lending & leasing | Lending, leasing, HP, fleet, floor plan, collections | Month 3 | 6 → 8 |
| AI & data | Agent gateway, decisioning, feature store, model risk tooling | Month 2 | 4 → 7 |
| Channels | Back-office console, reference apps | Month 4 | 3 → 5 |
| Commercial & markets | Limits, collateral, trade, treasury, syndication | Month 12 | 5 → 10 |
| Accounting & risk | GL, TFRS 9 and 16, regulatory reporting | Month 8 | 4 → 6 |

Headcount: about **25 at month 3**, **40 at month 12**, **60 at month 20**. Shared roles: architect, security lead, product managers per two squads, technical writer, domain experts (lending, accounting, compliance).

### Hiring order (first 6 months)

1. Founding engineers: core banking architect, ledger tech lead, platform/SRE lead.
2. Ledger engineers with database internals experience (PostgreSQL and Oracle).
3. Product engine lead with financial mathematics background.
4. Lending and accounting domain lead (TFRS 9, Thai hire purchase).
5. AI lead with model risk experience.
6. Security lead before the first external pilot.

## 4. Phase 0 sprint plan (12 weeks, 2-week sprints)

**Goal:** a correct, fast, portable ledger on a production-grade delivery platform, ready to open-source with a published benchmark.

| Sprint | Weeks | Goal | Deliverables | Done when |
|---|---|---|---|---|
| S0 | 1–2 | Foundations | Maven multi-module repo per [10](10-application-architecture.md); CI with build, unit tests, ArchUnit, licence gate (ORT), SBOM; dev environment with Testcontainers; coding standards; ADR template | A hello-world service builds, tests and deploys to dev in under 15 minutes |
| S1 | 3–4 | Platform kernel | `platform-money` (minor units, BigDecimal, rounding, currencies), `platform-time` (calendars, day counts, business days), `platform-tenancy`, idempotency keys | 100% branch coverage on money and day-count; property tests for rounding and day counts |
| S2 | 5–6 | Ledger domain on PostgreSQL | Posting batch model, balance types, holds, reversals, bitemporal balances; `LedgerStore` SPI; PostgreSQL implementation; gRPC `PostBatch` | Conformance suite: balanced per currency, idempotent, reversals, as-of queries all green |
| S3 | 7–8 | Portability and events | Oracle `LedgerStore`; transactional outbox; Debezium to Kafka; event schemas in Apicurio; Flyway migrations for both databases | Same conformance suite green on PostgreSQL and Oracle; events published exactly once in effect |
| S4 | 9–10 | Performance | Group commit, ordered row locks, asynchronous internal balances, hot-account striping, application-level sharding, performance environment, Gatling scenarios | 10,000 batches/s at p99 < 50 ms on PostgreSQL in one cell; Oracle baseline recorded |
| S5 | 11–12 | Hardening and launch | Chaos tests (kill primary, partition zone), balance rebuild check, observability dashboards and runbooks, agent gateway skeleton with read-only tools, open-source readiness (docs, CONTRIBUTING, security policy) | Phase 0 exit criteria met; benchmark report published with a reproducible harness |

### Phase 0 exit criteria

- Property-based tests prove ledger invariants under concurrency on both databases.
- 10,000 batches/s at p99 < 50 ms on PostgreSQL; Oracle baseline published.
- Full balance rebuild from postings matches projections.
- Killing a database primary loses no committed posting.
- Licence gate, SBOM and signed images in every build.

## 5. Phases 1–5: epics and milestones

| Phase | Months | Epics | Milestone |
|---|---|---|---|
| 1 | 3–9 | Product engine v1 and Master Builder; deposits; personal and nano loans; scheduler (ADR-0007); GL and daily reconciliation; PromptPay, eKYC, bureau; onboarding and origination workflows; credit, fraud and document AI; customer assistant; 10-cell scale-out test; sanctions screening | Staff pilot live; 30 days of reconciliation at zero |
| 2 | 9–14 | Hire purchase, finance and operating leases, fleet, floor plan; flat-to-EIR, VAT, e-Tax invoices; collections v1; TFRS 9 ECL and TFRS 16 | Parallel run on a 100k-contract book matches to the satang |
| 3 | 14–20 | Limits and collateral, commercial lending, cash management, credit applications; branch and teller; floating home loans; contingent ledger, guarantees, sight LCs; positions, nostro, FTP; RFR engine, lender role; billion-account test | Commercial pilot live; billion-account month end within the night window |
| 4 | 20–30 | Multi-tenant SaaS hardening; migration factory; full trade finance; FX and money-market deals; syndication agent; multi-region active-active | First incumbent migration in parallel run |
| 5 | 30–42 | Additional jurisdiction packs; Islamic banking; cross-border pooling; digital trade; hedge accounting; tier-1 certification | Global-bank reference program |

## 6. Ways of working

### Development flow

- **Trunk-based development.** Branches live less than two days; incomplete work hides behind feature flags.
- **Pull requests:** one reviewer by default; two for ledger, money, security and public API changes. DCO sign-off on every commit.
- **ADRs** for any change to a recorded decision; open for comment for seven days.
- **Definition of ready:** acceptance criteria, test cases for money behavior, and affected ADRs identified.
- **Definition of done:** merged to trunk, all gates green, dashboards and runbook updated, docs updated, deployed to staging.

### Testing strategy

| Layer | What | Where it runs |
|---|---|---|
| Unit | Domain rules, plain Java, milliseconds | Every commit |
| Property-based (jqwik) | Money, rounding, day counts, schedule invariants, ledger invariants | Every commit |
| Golden tests | Product behavior from the simulator, to the satang | Every commit |
| Contract | OpenAPI, Protobuf and event schemas between services | Every commit |
| Integration (Testcontainers) | Persistence on PostgreSQL and Oracle, Kafka, outbox | Every merge |
| Conformance | `LedgerStore` and scheduler suites per database | Every merge |
| Performance (Gatling) | Ledger and payment scenarios against budgets | Every ledger change; nightly full run |
| Chaos | Primary loss, zone partition, slow Kafka | Weekly and before every release |
| Security | SAST (Semgrep), dependency and container scanning (Trivy), DAST (OWASP ZAP) | Every merge; DAST nightly |
| Agent evaluation | Tool-call correctness, refusals, injection resistance | Every change to an agent or prompt |

### CI/CD pipeline

```
commit → build + unit + property + ArchUnit (≤ 8 min)
       → SQL lint, SAST, secret scan, licence gate, SBOM (≤ 4 min)
       → integration on PostgreSQL + Oracle, contract tests (≤ 15 min)
       → signed image (cosign) → dev (auto)
       → nightly: performance, DAST, full chaos subset
       → staging (auto, from trunk) → canary to production (approval)
```

Tooling: GitHub with GitHub Actions for hosting CI (pipelines kept portable to Tekton for bank-hosted builds), Renovate for dependency updates, ORT for licences, Syft for SBOMs, Trivy, Semgrep, cosign, Argo CD for deployment.

### Releases

- Semantic versioning. Releases every two weeks from Phase 1.
- Long-term-support release every six months, supported for 24 months (the certified Enterprise build).
- Database migrations are backward compatible for one release, so rollbacks are always possible.

### Operations

- Every service ships with RED metrics (rate, errors, duration), traces, structured logs, SLOs and a runbook.
- On-call rotation per squad from the first pilot; blameless post-incident reviews within five days.
- Error budgets: a squad that exhausts its budget pauses feature work for reliability work.

## 7. Engineering metrics

| Metric | Target |
|---|---|
| Lead time, commit to production | Under 1 day by Phase 2 |
| Deployment frequency | Daily to staging; every 2 weeks to production |
| Change failure rate | Under 10% |
| Time to restore | Under 1 hour |
| CI time to merge-ready | Under 30 minutes |
| Flaky test rate | Under 1%; flaky tests are fixed or removed within a week |
| Escaped money defects | Zero |

## 8. Environments and budget (Phase 0–1)

| Environment | Purpose | Indicative monthly cloud cost |
|---|---|---|
| Dev (ephemeral per branch) | Feature work | $3–5k |
| SIT | Integration on both databases | $3–4k |
| Performance | Benchmarks at 10k/s, later 100k/s on demand | $6–10k steady; $25–40k during scale-out runs |
| Staging | Release candidates, production-like | $5–8k |
| Pilot production (Phase 1) | Staff pilot, 3 zones | $10–15k |

Oracle testing uses the free Oracle Database container image in CI; a bank-provided Oracle environment is used for certification benchmarks.

## 9. Engineering risks

| Risk | Mitigation |
|---|---|
| Ledger defects | Conformance and property suites, two-reviewer rule, daily rebuild checks |
| Performance target missed | Benchmark from sprint S4; TigerBeetle evaluation gate (ADR-0002) |
| Oracle divergence | Both databases in CI from S3; shared conformance suite |
| Scope creep in Phase 1 | Fixed exit criteria; anything else goes to the next phase |
| Hiring delays | Start with a smaller founding team on the critical path (ledger, platform) |
| Flaky integration tests | Testcontainers with fixed images, quarantine with a one-week fix rule |

## 10. First 30 days

1. Hire or assign the architect, ledger lead and platform lead.
2. Create the GitHub organisation, repository structure and CI skeleton (S0).
3. Agree coding standards, review rules and the ADR process.
4. Stand up dev and SIT environments with Testcontainers for PostgreSQL and Oracle.
5. Start S1 (money and time libraries) with property-based tests first.
6. Book the performance environment for S4.
7. Line up one design partner to provide anonymized data for parallel-run planning.

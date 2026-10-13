# 02 — Architecture

## Logical view

```
                         ┌─────────────────────────────────────────────────────────────┐
 Channels                │ Mobile app · Web · Branch/teller · RM workstation · Partners │
                         └───────────────┬──────────────────────────────┬──────────────┘
                                         │ REST/gRPC (OpenAPI)          │ Agent tools (MCP)
                         ┌───────────────▼──────────────┐   ┌───────────▼───────────────┐
 Edge                    │ API gateway · AuthN/Z · rate │   │ Agent gateway: tool       │
                         │ limiting · idempotency keys  │   │ registry, policy, audit   │
                         └───────────────┬──────────────┘   └───────────┬───────────────┘
                                         └──────────────┬───────────────┘
 Orchestration           ┌──────────────────────────────▼───────────────────────────────┐
                         │ Workflow engine (Temporal): onboarding, origination,         │
                         │ disbursement, restructuring, collections, lease termination  │
                         └──────────────────────────────┬───────────────────────────────┘
 Domain services   ┌──────────┬──────────┬──────────────┼─────────┬──────────┬──────────┐
                   │ Party &  │ Product  │ Deposit      │ Lending │ Leasing  │ Limits & │
                   │ KYC      │ catalog &│ accounts     │ contracts│ & assets │ collateral│
                   │          │ pricing  │              │          │          │          │
                   └──────────┴──────────┴──────┬───────┴─────────┴──────────┴──────────┘
                                                │ posting instructions
 Ledger core             ┌──────────────────────▼───────────────────────────────────────┐
                         │ Ledger: posting engine · balance projections · holds ·       │
                         │ multi-currency · bitemporal · sharded by account             │
                         └──────────────────────┬───────────────────────────────────────┘
                                                │ domain events (outbox → Kafka)
 Downstream   ┌────────────┬───────────────┬────┴─────────┬──────────────┬───────────────┐
              │ GL &       │ IFRS 9 ECL /  │ Regulatory   │ Feature store│ Notifications │
              │ accounting │ IFRS 16       │ reporting    │ & AI models  │ & statements  │
              └────────────┴───────────────┴──────────────┴──────────────┴───────────────┘
 Integration  Payments hub adapters (instant payments, ISO 20022, SWIFT, cards processor), credit bureau,
              eKYC vendors, tax authority, asset registries (vehicle registration), insurers
```

## Core services

| Service | Responsibility | Store |
|---|---|---|
| **party** | Customers (individual, business), relationships, group hierarchies, KYC/AML status, consents | PostgreSQL |
| **product-catalog** | Versioned product definitions, pricing tables, fee schedules, approval workflow | PostgreSQL |
| **pricing** | Rate resolution (base rate + spread + relationship adjustments), risk-based pricing hook | in-memory + catalog |
| **deposit** | Deposit account lifecycle, interest, sweeps, overdraft, dormancy | PostgreSQL |
| **lending** | Loan contracts, schedules, accrual, billing, repayment allocation, restructuring | PostgreSQL |
| **leasing** | Lease/HP contracts, asset register, residual value, VAT, insurance, termination, repossession | PostgreSQL |
| **limits-collateral** | Facility trees, exposure, collateral valuation, LTV, guarantees, covenants | PostgreSQL |
| **ledger** | Posting engine, balances, holds/reservations, FX, bitemporal history | PostgreSQL (sharded) — see [ADR-0002](adr/0002-ledger-storage.md) |
| **scheduler** | Per-account timers for accrual, billing, maturity, aging (no batch) | Temporal / durable timers |
| **accounting** | Posting-to-GL mapping, sub-ledger to GL reconciliation, period close, IFRS 9/16 entries | PostgreSQL + warehouse |
| **collections** | Delinquency buckets, strategies, promises-to-pay, agent assignment | PostgreSQL |
| **agent-gateway** | Exposes service APIs as AI tools, enforces policy and delegated authority, records AI actions | PostgreSQL |
| **ai-decisioning** | Credit scoring, fraud, AML, collections propensity, model serving and monitoring | Model registry + feature store |

Each service owns its data. Cross-service consistency uses **sagas** in the workflow engine and the **transactional outbox** pattern for events. Only the ledger moves money.

## The posting path (the heart)

1. A domain service (e.g. lending) builds a **posting instruction**: an idempotency key, value date, and a set of balanced legs (account, balance type, amount, currency, direction).
2. The ledger validates: balanced per currency, accounts open, no restrictions, sufficient available balance (respecting holds and overdraft limits), entitlements.
3. The ledger commits postings and updated balance projections **in one database transaction** on the shard that owns the accounts, and writes the event to the outbox.
4. The outbox relays to Kafka. GL, reporting, features and notifications consume asynchronously.
5. Cross-shard transfers use a two-phase *reserve → commit* with a suspense/clearing account, so each shard transaction stays local and every intermediate state balances.

Idempotency keys are retained so any retry returns the original result. Every posting carries `tenant`, `trace_id`, `actor` (human, system or AI agent), and `product_version`.

## Bitemporality and back-valuation

- Postings have `value_date` and `booking_ts`. Balances are queryable *as of value date* and *as known at booking time*.
- A back-valued event (e.g. a repayment value-dated three days ago) triggers the contract engine to replay from that date with the same product version, compute the delta in interest/fees, and post **adjustment entries** today. History is never rewritten.

## Technology stack (recommended)

| Concern | Choice | Why |
|---|---|---|
| Domain services | **Java 21 + Spring Boot 3**, virtual threads | On every bank's approved list, exact decimals (`BigDecimal`), largest banking talent pool ([ADR-0001](adr/0001-language-and-runtime.md)) |
| Ledger core | Java first; evaluate a **Rust** hot path or **TigerBeetle** only if benchmarks demand it | Avoid premature exotic tech; keep the option open ([ADR-0002](adr/0002-ledger-storage.md)) |
| Product rules | Typed product DSL (YAML/JSON schema) + **CEL** expressions for bounded logic | Safe, sandboxed, non-Turing-complete, auditable ([ADR-0003](adr/0003-product-definition.md)) |
| Database | **PostgreSQL 16+** (Aurora/AlloyDB/Cloud SQL or self-managed with Patroni); Citus or app-level sharding for ledger | Serializable transactions, proven, cheap, strong ecosystem |
| Events | **Kafka** (or Redpanda) with schema registry (Avro/Protobuf) | Durable ordered log, replay, ecosystem |
| Workflows | **Temporal** (Camunda 8 if the bank requires) | Durable sagas and per-account timers replace batch jobs |
| APIs | gRPC internally, REST/JSON with OpenAPI externally, ISO 20022 for payments | |
| AI tools | **MCP** (Model Context Protocol) servers generated from OpenAPI, behind the agent gateway | One contract for humans, apps and agents |
| LLMs | Model-agnostic gateway; latest Claude models as default for agentic work | Swap per use case, per data-residency rule |
| Analytics | Lakehouse (Iceberg on object storage) + dbt; ClickHouse for operational analytics | |
| Feature store | Feast or equivalent, online (Redis) + offline (Iceberg) | Same features in training and serving |
| Platform | Kubernetes / Red Hat OpenShift, Terraform, Argo CD (GitOps), service mesh (mTLS), OpenTelemetry | |
| Secrets/keys | Cloud KMS/HSM, Vault | |

## Deployment

Every infrastructure dependency sits behind a port so a bank's approved equivalent (OpenShift, EDB/Oracle, Confluent/IBM MQ, bank IAM and HSMs) can be used. See [ADR-0004](adr/0004-bank-stack-compatibility.md).


- **Cell-based architecture**: each cell is a full stack (services + ledger shards) serving a subset of tenants/accounts. Cells limit blast radius and are the unit of scaling and of data residency.
- Active-active across 3 availability zones within a region; synchronous replication for the ledger (RPO = 0); warm standby region for disaster recovery.
- Deployable to public cloud or a bank's private cloud (regulators may require in-country hosting; see [09](09-open-decisions.md)).

## Non-functional requirements

| NFR | Target |
|---|---|
| Posting throughput | ≥ 10,000 postings/s per cell, linear scale-out by adding cells/shards |
| Posting latency | p99 < 50 ms, p50 < 10 ms |
| Balance inquiry | p99 < 20 ms |
| Availability (posting path) | 99.99% monthly |
| RPO / RTO | 0 / < 15 min |
| Accrual freshness | Interest accrued daily per account, continuously scheduled; no global EOD |
| Back-valuation | Up to configurable horizon (default 90 days) without manual intervention |
| Audit retention | ≥ 10 years, tamper-evident |
| Reconciliation | Sub-ledger to GL reconciles to zero every day, automatically |

## Repository layout (proposed monorepo)

```
corebank/
  platform/            # shared libs: money, calendars, day-count, idempotency, outbox, tenancy
  services/
    party/ product-catalog/ pricing/ deposit/ lending/ leasing/
    limits-collateral/ ledger/ accounting/ collections/
    agent-gateway/ ai-decisioning/
  products/            # product definitions (DSL) + golden test cases per product
  contracts/           # OpenAPI, Protobuf, Avro event schemas, MCP tool manifests
  simulator/           # product simulation and what-if engine
  infra/               # Terraform, Helm, Argo CD
  docs/
```

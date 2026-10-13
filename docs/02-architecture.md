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
| **party** | Customers (individual, business), relationships, group hierarchies, KYC/AML status, consents | RDBMS |
| **product-catalog** | Versioned product definitions, pricing tables, fee schedules, approval workflow | RDBMS |
| **pricing** | Rate resolution (base rate + spread + relationship adjustments), risk-based pricing hook | in-memory + catalog |
| **deposit** | Deposit account lifecycle, interest, sweeps, overdraft, dormancy | RDBMS |
| **lending** | Loan contracts, schedules, accrual, billing, repayment allocation, restructuring | RDBMS |
| **leasing** | Lease/HP contracts, asset register, residual value, VAT, insurance, termination, repossession | RDBMS |
| **limits-collateral** | Facility trees, exposure, collateral valuation, LTV, guarantees, covenants | RDBMS |
| **ledger** | Posting engine, balances, holds/reservations, FX, bitemporal history | RDBMS (sharded) — see [ADR-0002](adr/0002-ledger-storage.md) |
| **scheduler** | Due work for accrual posting, billing, maturity, aging (no batch); partitioned time-wheel per shard ([ADR-0007](adr/0007-scheduling-and-accrual-at-scale.md)) | Due-queue tables per shard |
| **accounting** | Posting-to-GL mapping, sub-ledger to GL reconciliation, period close, IFRS 9/16 entries | RDBMS + warehouse |
| **collections** | Delinquency buckets, strategies, promises-to-pay, agent assignment | RDBMS |
| **trade-finance** | LCs, guarantees, collections, trade loans, supply-chain finance, document examination ([12](12-trade-treasury-syndication.md)) | RDBMS |
| **treasury** | FX and money-market deals, real-time positions, revaluation, nostro reconciliation, liquidity metrics, FTP | RDBMS |
| **syndication** | Syndicated facilities, tranches, lender register, drawdown notices, distributions, transfers | RDBMS |
| **market-data** | FX rates, benchmark fixings (THOR, SOFR, SONIA, €STR), curves | RDBMS + cache |
| **agent-gateway** | Exposes service APIs as AI tools, enforces policy and delegated authority, records AI actions | RDBMS |
| **ai-decisioning** | Credit scoring, fraud, AML, collections propensity, model serving and monitoring | Model registry + feature store |

"RDBMS" means PostgreSQL by default or any certified database ([ADR-0005](adr/0005-multi-database-support.md)). Each service owns its data. Cross-service consistency uses **sagas** in the workflow engine and the **transactional outbox** pattern for events. Only the ledger moves money.

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

Open source only; full bill of materials and licence policy in [ADR-0006](adr/0006-open-source-only.md).

| Concern | Choice | Why |
|---|---|---|
| Domain services | **Java 21 + Spring Boot 3**, virtual threads | On every bank's approved list, exact decimals (`BigDecimal`), largest banking talent pool ([ADR-0001](adr/0001-language-and-runtime.md)) |
| Ledger core | Java first; evaluate a **Rust** hot path or **TigerBeetle** only if benchmarks demand it | Avoid premature exotic tech; keep the option open ([ADR-0002](adr/0002-ledger-storage.md)) |
| Product rules | Typed product DSL (YAML/JSON schema) + **CEL** expressions for bounded logic | Safe, sandboxed, non-Turing-complete, auditable ([ADR-0003](adr/0003-product-definition.md)) |
| Database | **PostgreSQL 16+ by default** (EDB, Aurora, AlloyDB, Azure, or self-managed with Patroni); **Oracle 19c/23ai certified**; SQL Server and Db2 on demand. MyBatis + a per-database `LedgerStore` on plain JDBC, Flyway migrations, app-level sharding | Portable without losing hot-path tuning ([ADR-0005](adr/0005-multi-database-support.md)) |
| Events | **Apache Kafka** on Strimzi, Apicurio schema registry (Avro/Protobuf) | Durable ordered log, replay, ecosystem |
| Workflows | **Temporal**, self-hosted (Flowable/Operaton if the bank requires) | Durable sagas and per-account timers replace batch jobs |
| APIs | gRPC internally, REST/JSON with OpenAPI externally, ISO 20022 for payments | |
| AI tools | **MCP** (Model Context Protocol) servers generated from OpenAPI, behind the agent gateway | One contract for humans, apps and agents |
| LLMs | Open-source gateway (LiteLLM) + vLLM serving open-weight, OSI-licensed models by default; commercial model APIs optional where the bank allows | Open-source policy, data residency, swap per use case |
| Analytics | Lakehouse (Iceberg on object storage) + dbt; ClickHouse for operational analytics | |
| Feature store | Feast or equivalent, online (Valkey) + offline (Iceberg) | Same features in training and serving |
| Platform | Kubernetes / Red Hat OpenShift, OpenTofu, Argo CD (GitOps), Istio/Cilium (mTLS), OpenTelemetry | |
| Secrets/keys | OpenBao + bank HSM via PKCS#11 | |

## Deployment

Every infrastructure dependency sits behind a port so a bank's approved equivalent (OpenShift, EDB/Oracle, Confluent/IBM MQ, bank IAM and HSMs) can be used. See [ADR-0004](adr/0004-bank-stack-compatibility.md).


- **Cell-based architecture**: each cell is a full stack (services + ledger shards) serving a subset of tenants/accounts. Cells limit blast radius and are the unit of scaling and of data residency.
- Active-active across 3 availability zones within a region; synchronous replication for the ledger (RPO = 0); paired DR region within the same residency boundary (RPO ≤ 60 s, RTO ≤ 30 min).
- For global banks: accounts have a home region, cells inside regions, and a global directory for routing ([ADR-0008](adr/0008-global-multi-region-topology.md)). Global sizing and targets are in [11](11-global-scale-and-benchmark.md).
- Deployable to public cloud or a bank's private cloud (regulators may require in-country hosting; see [09](09-open-decisions.md)).

## Non-functional requirements

| NFR | Target |
|---|---|
| Posting throughput | ≥ 10,000 postings/s per cell, linear scale-out by adding cells/shards |
| Posting latency | p99 < 50 ms, p50 < 10 ms |
| Balance inquiry | p99 < 20 ms |
| Availability (posting path) | 99.99% monthly per cell; 99.995% per region (global tier) |
| RPO / RTO, zone loss | 0 / < 5 min, automatic |
| RPO / RTO, region loss | ≤ 60 s / ≤ 30 min |
| Global throughput | 100,000 batches/s sustained, 250,000 burst, by adding cells |
| Accrual freshness | Interest accrued daily per account, continuously scheduled; no global EOD |
| Back-valuation | Up to configurable horizon (default 90 days) without manual intervention |
| Audit retention | ≥ 10 years, tamper-evident |
| Reconciliation | Sub-ledger to GL reconciles to zero every day, automatically |

## Repository layout (proposed monorepo)

```
fabor-os/
  platform/            # shared libs: money, calendars, day-count, idempotency, outbox, tenancy
  platform/persistence # dialect adapters, LedgerStore SPI + per-DB impls, conformance suite
  services/
    party/ product-catalog/ pricing/ deposit/ lending/ leasing/
    limits-collateral/ ledger/ accounting/ collections/
    agent-gateway/ ai-decisioning/
  products/            # product definitions (DSL) + golden test cases per product
  contracts/           # OpenAPI, Protobuf, Avro event schemas, MCP tool manifests
  simulator/           # product simulation and what-if engine
  infra/               # OpenTofu, Helm, Argo CD
  docs/
```

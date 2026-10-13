# 10 — Application architecture and modules

This document turns the service map in [02](02-architecture.md) into the structure the code will have: layers, services, the modules inside each service, and the dependency rules that keep them apart. The interactive version, with the prototype screens, is in [`prototype/index.html`](../prototype/index.html).

## 1. Application architecture

```mermaid
flowchart TB
  subgraph CH[Channels]
    MOB[Mobile app]:::ch
    WEB[Internet banking]:::ch
    BO[Back-office console]:::ch
    RM[RM workstation]:::ch
    PTN[Partners / dealers]:::ch
  end

  subgraph EDGE[Edge]
    GW[API gateway<br/>APISIX · OAuth2 · idempotency]
    AGW[Agent gateway<br/>MCP tools · policy · audit]
  end

  subgraph ORCH[Orchestration]
    WF[Workflow workers<br/>Temporal sagas]
    SCH[Scheduler<br/>per-account timers]
  end

  subgraph DOM[Domain services]
    PTY[party]
    CAT[product-catalog<br/>+ pricing]
    DEP[deposit]
    LND[lending]
    LSE[leasing]
    LIM[limits-collateral]
    COL[collections]
  end

  subgraph CORE[Ledger core]
    LED[ledger<br/>postings · balances · holds]
  end

  subgraph AI[AI services]
    DEC[ai-decisioning<br/>credit · fraud · AML]
    LLM[LLM gateway<br/>LiteLLM · vLLM]
  end

  subgraph DS[Downstream]
    ACC[accounting<br/>GL · TFRS 9 · TFRS 16]
    REP[reporting<br/>regulatory marts]
    FS[feature store]
    NTF[notifications]
  end

  subgraph INT[Integration]
    PAY[payments-hub<br/>PromptPay · ISO 20022 · SWIFT]
    EXT[bureau · eKYC · e-Tax · registries]
  end

  K[(Kafka · Apicurio)]

  CH --> GW
  CH -.assistant.-> AGW
  GW --> WF
  GW --> DOM
  AGW --> GW
  AGW --> LLM
  WF --> DOM
  SCH --> LND & LSE & DEP
  DOM -- posting instructions --> LED
  PAY -- posting instructions --> LED
  LND & LSE & PTY --> DEC
  LED -- outbox / Debezium --> K
  DOM -- outbox --> K
  K --> ACC & REP & FS & NTF & COL
  FS --> DEC
  WF --> PAY & EXT

  classDef ch fill:none,stroke-dasharray:3 3
```

### Layer responsibilities

| Layer | Responsibility | Rule |
|---|---|---|
| Channels | Reference UIs and partner apps | Hold no business logic; call public APIs only |
| Edge | AuthN/Z, rate limits, idempotency keys, API versioning; the agent gateway exposes the same APIs as MCP tools | Agents go through the API gateway like any other client |
| Orchestration | Multi-step business processes (onboarding, origination, disbursement, restructuring, repossession) and per-account timers | Coordinates services; owns no business data |
| Domain services | Contract state and business rules per domain | Own their database schema; never write another service's tables |
| Ledger core | The only place value moves | Accepts balanced posting instructions only; knows nothing about products |
| AI services | Models and LLM access | Read features and events; act only through the edge |
| Downstream | GL, reporting, features, notifications | Consume events; never call back into the posting path synchronously |
| Integration | Payment rails and external providers | Adapters translate external formats into domain commands |

### Communication rules

| From → To | Mechanism | Why |
|---|---|---|
| Channel → service | REST/JSON via API gateway | Public contract, OpenAPI |
| Service → service (query) | gRPC, read-only | Low latency; no distributed writes |
| Service → ledger | gRPC `PostBatch` with idempotency key | Single synchronous call on the money path |
| Multi-service write | Temporal saga with compensations | No two-phase commit across services |
| State change → others | Transactional outbox → Kafka | Exactly-once effect via idempotent consumers |
| Agent → anything | MCP tool → agent gateway → API gateway | Same entitlements, limits and audit as a human |

## 2. Request flow: auto hire-purchase disbursement

```mermaid
sequenceDiagram
  autonumber
  participant BO as Back-office / dealer portal
  participant GW as API gateway
  participant WF as Origination workflow
  participant LIM as limits-collateral
  participant LSE as leasing
  participant LED as ledger
  participant PAY as payments-hub
  participant K as Kafka

  BO->>GW: POST /hp-contracts/{id}/disburse (Idempotency-Key)
  GW->>WF: start DisburseHpContract
  WF->>LIM: reserve facility + register vehicle as collateral
  LIM-->>WF: reserved
  WF->>LSE: activate contract (generate schedule, EIR, VAT lines)
  LSE->>LED: PostBatch(principal → dealer settlement, deferred fees)
  LED-->>LSE: committed (batch id)
  WF->>PAY: pay dealer via PromptPay / bank transfer
  PAY-->>WF: settled
  LSE-)K: HpContractActivated
  LED-)K: PostingBatchCommitted
  Note over WF: Any failure runs compensations:<br/>reverse batch, release reservation
```

## 3. Module diagram

The repository is one **Maven multi-module** build (Maven is the default build tool in most bank toolchains; Apache-2.0).

```mermaid
flowchart LR
  subgraph PLATFORM[platform — shared kernel]
    MONEY[platform-money]
    TIME[platform-time]
    TEN[platform-tenancy]
    PERS[platform-persistence]
    EVT[platform-events]
    SEC[platform-security]
    OBS[platform-observability]
  end

  subgraph ENGINES[engines — pure calculation, no I/O]
    SCHED[engine-schedule]
    INT[engine-interest]
    PROD[engine-product<br/>DSL + CEL]
    TAX[engine-tax]
  end

  subgraph CONTRACTS[contracts]
    OAS[OpenAPI]
    PROTO[Protobuf]
    AVRO[Avro events]
    MCP[MCP tool manifests]
  end

  subgraph SVC[services/*]
    LND[lending]
    LSE[leasing]
    DEP[deposit]
    LED[ledger]
    OTH[party · catalog · limits · collections · accounting · agent-gateway · …]
  end

  SIM[simulator]

  ENGINES --> MONEY & TIME
  SVC --> PLATFORM
  LND & LSE & DEP --> ENGINES
  SIM --> ENGINES
  SVC --> CONTRACTS
```

`ledger` is the one service with no arrow to `engines`: it moves value and knows nothing about products.

### Modules inside one service (hexagonal)

Every service has the same shape. Example: `services/leasing`.

```mermaid
flowchart TB
  APP[leasing-app<br/>Spring Boot main, wiring, config]
  WEB[leasing-adapter-web<br/>REST controllers, gRPC]
  PG[leasing-adapter-persistence<br/>MyBatis mappers + Flyway<br/>postgresql/ · oracle/]
  MSG[leasing-adapter-messaging<br/>outbox, Kafka consumers]
  CLI[leasing-adapter-clients<br/>ledger, limits, payments clients]
  APPL[leasing-application<br/>use cases, ports, transactions]
  DOMN[leasing-domain<br/>contract, asset, schedule, rules<br/>pure Java]
  API[leasing-api<br/>DTOs, OpenAPI, events]

  APP --> WEB & PG & MSG & CLI
  WEB --> APPL
  PG --> APPL
  MSG --> APPL
  CLI --> APPL
  APPL --> DOMN
  WEB --> API
  DOMN --> ENG[engines/*]
```

| Module | Contains | May depend on |
|---|---|---|
| `*-domain` | Entities, value objects, state machines, domain events, business rules | `platform-money`, `platform-time`, `engines/*` |
| `*-application` | Use cases, inbound and outbound ports (interfaces), transaction boundaries | `*-domain`, `platform-*` interfaces |
| `*-api` | Public DTOs, OpenAPI/Protobuf, event schemas | `contracts` only |
| `*-adapter-web` | REST/gRPC endpoints | `*-application`, `*-api` |
| `*-adapter-persistence` | MyBatis mappers, per-vendor SQL, Flyway migrations | `*-application`, `platform-persistence` |
| `*-adapter-messaging` | Outbox writer, Kafka consumers | `*-application`, `platform-events` |
| `*-adapter-clients` | Clients for other services, generated from their `*-api` | `*-application`, other services' `*-api` |
| `*-app` | Spring Boot entry point and configuration | All of the above |

### Dependency rules (enforced by ArchUnit and the Maven Enforcer plugin)

1. `*-domain` has no Spring, MyBatis, Kafka or JDBC imports. It is plain Java and unit-testable in milliseconds.
2. Dependencies point inward: adapters → application → domain. Never the reverse.
3. A service depends on another service **only through its `*-api` module**. No shared tables, no shared domain classes.
4. `engines/*` are pure functions: same inputs, same outputs, no clock, no I/O. This is what makes simulation, replay and back-valuation deterministic.
5. `ledger` depends on nothing product-specific. It never imports `engines/*` or any product service.
6. `platform-money` forbids `float`/`double` and exposes only `long` minor units and `BigDecimal` with explicit rounding.
7. Database-vendor code lives only in `*-adapter-persistence` under `postgresql/` and `oracle/` folders.

### Repository tree

```
fabor-os/
  pom.xml                              # parent: versions, plugins, enforcer, licence gate
  platform/
    platform-money/  platform-time/  platform-tenancy/  platform-persistence/
    platform-events/ platform-security/ platform-observability/ platform-test/
  engines/
    engine-schedule/ engine-interest/ engine-product/ engine-tax/
  contracts/
    openapi/ proto/ avro/ mcp/
  services/
    ledger/            ledger-domain, ledger-application, ledger-store-postgresql, ledger-store-oracle, ledger-app, ...
    party/  product-catalog/  deposit/  lending/  leasing/  limits-collateral/
    collections/  accounting/  payments-hub/  agent-gateway/  ai-decisioning/
    workflow-workers/  scheduler/
  simulator/
  products/                            # product definitions + golden tests
  prototype/                           # HTML prototype of the back-office console
  infra/                               # OpenTofu, Helm, Argo CD
  docs/
```

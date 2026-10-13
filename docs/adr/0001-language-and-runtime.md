# ADR-0001: Kotlin on the JVM for domain services

- Status: Proposed
- Date: 2026-10-13

## Context

Core banking code is long-lived, correctness-critical, decimal-heavy and maintained by large teams. We need strong typing, exact arithmetic, mature libraries (Kafka, Temporal, Postgres, gRPC, observability) and a deep hiring pool, including engineers with banking experience.

## Decision

Use **Kotlin on JVM 21+** for domain services and the ledger. Money is represented as `Long` minor units in the ledger and `BigDecimal` with explicit scale and rounding mode in calculations. Floating point types are banned in domain code by a lint rule.

## Alternatives

- **Go**: simple and fast, but weaker type modeling for complex domains and no built-in decimal type.
- **Rust**: excellent performance and safety, smaller banking talent pool, slower iteration for business logic. Kept as an option for a ledger hot path if benchmarks require.
- **Java**: equivalent runtime; Kotlin gives null safety, sealed types and concise domain models with full Java interop.

## Consequences

- One primary language across services simplifies tooling and mobility between squads.
- JVM startup and memory are acceptable for long-running services; native images can be evaluated later for tooling.

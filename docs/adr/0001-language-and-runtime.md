# ADR-0001: Java 21 + Spring Boot for domain services

- Status: Proposed (supersedes the earlier Kotlin proposal)
- Date: 2026-10-13

## Context

- The platform must pass bank architecture review and fit **bank-approved technology standards**. Java/Spring Boot is on the approved list of virtually every bank; Kotlin, Go and Rust often are not, or need an exception.
- Bank IT teams, vendors and auditors who will operate and review the system are overwhelmingly Java teams.
- **Speed matters** in two senses: runtime performance of the posting path, and delivery speed of the team.
- Correctness needs exact decimal arithmetic and strong typing.

## Decision

- **Java 21 LTS** (moving to the next LTS on a planned cadence) with **Spring Boot 3**, packaged as OCI containers.
- Modern Java features carry most of what Kotlin offered: `record` value types, `sealed` interfaces with exhaustive `switch` pattern matching, virtual threads for high concurrency without reactive complexity.
- Money: `long` minor units in the ledger, `BigDecimal` with explicit scale and `RoundingMode` in calculations. `float`/`double` banned in domain code by ArchUnit/Error Prone rules. Nullness checked with JSpecify annotations + NullAway.
- Performance path: virtual threads, JDBC batching, prepared statements, connection pooling tuned per shard, low-pause GC (Generational ZGC), and JVM warm-up / CDS (Class Data Sharing) for fast startup. GraalVM native image is optional for tools and edge services, not required for the core.

## Alternatives

- **Kotlin**: nicer syntax and null safety, same runtime speed, but not always on bank-approved lists. Kept out to avoid compliance exceptions.
- **Go**: fast and simple, but no native decimal type, weaker domain modelling, and less commonly approved for core systems.
- **Rust**: top raw performance, small talent pool, rarely on approved lists. Only for an isolated hot path if the Phase 0 benchmark proves it necessary, and only with bank approval.
- **C#/.NET**: technically equivalent; choose it only if the design-partner bank is a .NET shop.

## Consequences

- Clears bank technology governance with no exceptions and lets bank teams operate and extend the system.
- Runtime performance is the same as Kotlin (same JVM). Throughput is bounded by the database and locking design, not the language.
- Slightly more verbose code than Kotlin, offset by a larger hiring pool and onboarding speed.

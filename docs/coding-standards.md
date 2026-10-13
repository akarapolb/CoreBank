# Coding standards

Short and enforced by tooling where possible. Rule numbers refer to [docs/10](10-application-architecture.md).

1. **Java 21, Maven.** Compiler runs with `-Xlint:all -Werror`; no warnings merge.
2. **Money is `Money` only.** Never `double` or `float` (rule 6, ArchUnit-enforced); amounts are `long` minor units, rounding is always explicit.
3. **Domain and engines are pure** (rules 1 and 4): no Spring, JDBC, MyBatis, Kafka, clocks or randomness. Pass time in as a parameter.
4. **Dependencies point inward** (rule 2). Each module carries an `ArchitectureTest`.
5. **Tests first for money behaviour.** Every calculation has example tests and a jqwik property test; ledger and money changes need two reviewers.
6. **Dependency convergence and licences.** Only OSI-licensed dependencies ([ADR-0006](adr/0006-open-source-only.md)); the Maven Enforcer rule fails on conflicting versions.
7. **Commits:** small, imperative subject, `Signed-off-by` (DCO). Trunk-based; branches live under two days.
8. **ADR** for any change to a recorded decision.

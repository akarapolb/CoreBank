# ADR-0003: Products as typed building blocks plus CEL expressions

- Status: Proposed
- Date: 2026-10-13

## Context

The platform must support any deposit, loan, lease or hire-purchase product and launch new ones in days. Options range from code per product (slow, risky) to general scripting per product (flexible, hard to bound and audit).

## Decision

Define products as **versioned, schema-validated documents** composed from typed building blocks (rate, schedule method, fees, waterfall, tax, delinquency, asset, accounting). Where formulas are needed, use **CEL (Common Expression Language)**: side-effect free, guaranteed to terminate, statically type-checkable and fast.

Each product carries **golden test cases** produced by the simulator; publishing requires them to pass and requires maker-checker approval.

## Alternatives

- **Code per product**: every product is a release; rejected.
- **Python/JS smart contracts per product** (as some modern cores do): maximal flexibility, but needs sandboxing, makes static validation and exhaustive testing harder, and shifts engineering work to product teams.
- **Visual rule engine (BPMN/DMN)**: good for decisioning, poor fit for financial calculation semantics.

## Consequences

- Most new products need no engineering. Genuinely new behavior is added as a new engine block, once, with tests.
- The schema and CEL function library become a public, versioned contract that AI copilots can generate against and validate.

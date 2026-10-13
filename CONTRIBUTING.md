# Contributing to Fabor OS

Thank you for helping build Fabor OS. This guide explains how to propose changes and what we expect from a contribution.

## Before you start

- Read the [README](README.md) and the architecture decision records in [`docs/adr/`](docs/adr/). They explain why the code is shaped the way it is.
- For anything larger than a small fix, open an issue first so maintainers can agree the approach with you.
- Report security problems privately, as described in [SECURITY.md](SECURITY.md), never in a public issue.

## Developer Certificate of Origin

We use the [Developer Certificate of Origin](https://developercertificate.org/) (DCO) instead of a contributor licence agreement. Sign off every commit to confirm you have the right to submit it under the project's licence:

```
git commit -s -m "Describe the change"
```

This adds a line such as `Signed-off-by: Your Name <you@example.com>`. Pull requests with unsigned commits cannot be merged.

## What a good contribution looks like

- **Money is exact.** No `float` or `double` in domain code; amounts are minor units or `BigDecimal` with explicit rounding.
- **The ledger stays sacred.** Postings are balanced and immutable; corrections are reversals.
- **Module rules hold.** Dependencies point inward, services talk through their `*-api` modules, and engines stay free of I/O. The build enforces this.
- **Both databases pass.** Persistence changes run against PostgreSQL and Oracle in CI.
- **Tests come with the change.** Unit tests for rules, property-based tests for calculations, golden tests for product behaviour.
- **Only OSI-licensed dependencies** ([ADR-0006](docs/adr/0006-open-source-only.md)). The licence gate in CI rejects anything else.
- **Clear commits.** One logical change per commit, with a message that says why.

## Review

At least one maintainer reviews every pull request. Changes to the ledger, money handling, security or the public API need two maintainer approvals. Maintainers may ask for an ADR when a change alters a recorded decision.

## Licence of contributions

By contributing, you agree that your contribution is licensed under the Apache License 2.0 (code) or CC BY 4.0 (documentation), as described in [NOTICE](NOTICE).

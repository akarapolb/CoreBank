# Governance

## Roles

| Role | Who | Responsibilities |
|---|---|---|
| Users | Anyone running Fabor OS | Report issues, request features, share experience |
| Contributors | Anyone with a merged contribution | Code, documentation, tests, jurisdiction knowledge |
| Maintainers | Named in `MAINTAINERS.md` | Review and merge, release, uphold the ADRs and quality bar |
| Steering group | Company lead maintainers, plus elected representatives of adopting banks once there are three or more | Roadmap, ADR approval, maintainer appointments, licence and trademark policy |

## Decisions

- Day-to-day changes: lazy consensus among maintainers on the pull request.
- Architecture changes: an ADR in `docs/adr/`, open for comment for at least 7 days, approved by the steering group.
- Disagreements: escalate to the steering group, which decides by majority.

## Roadmap

The roadmap is public in [`docs/07-roadmap.md`](docs/07-roadmap.md). The open-core boundary in [ADR-0009](docs/adr/0009-open-core-model.md) states which parts are open and which are commercial; moving a part from commercial to open needs no special approval, while moving anything from open to commercial is not allowed.

## Path to a foundation

When independent banks and integrators contribute regularly, the steering group will evaluate moving the project to a neutral foundation such as FINOS (the Fintech Open Source Foundation, part of the Linux Foundation). The Fabor trademark would move with it under the foundation's trademark policy.

# Fabor OS web

The staff console in React (ADR-0011, [UX foundation](../docs/design/ux-foundation.md)). It replaces the static console at
`/console/` screen by screen; until then both are served, the new one at `/console-next/`.

```
web/
  apps/console        React, Vite, TanStack Router and Query: the staff console
  packages/ui         @fabor/ui: design tokens and components (no inline styles, so the strict CSP holds)
  packages/api        @fabor/api: typed client generated from the API's OpenAPI document
  scripts/seed-demo.mjs   demo customers, loans of different ages and a dealer line
```

## Run it

Needs Node 22 or later and pnpm 11, and a running Fabor app in token mode on port 18080 (see `docs/quickstart.md`).

```bash
pnpm --dir web install
pnpm --dir web dev                 # http://localhost:5180/console-next/, with /api forwarded to :18080
node web/scripts/seed-demo.mjs     # optional: realistic work to show
```

Sign in with any name and the app's token (`FABOR_API_TOKEN`).

## Check it

```bash
pnpm --dir web typecheck
pnpm --dir web test
pnpm --dir web build               # apps/console/dist, packed into the Spring jar by the next Maven build
```

The Maven build of `fabor-app` copies `web/apps/console/dist` into the jar under `static/console-next` when it exists,
so build the web first when you want the console in the jar.

## When the API changes

```bash
FABOR_API=http://localhost:18080 pnpm --dir web api:gen   # refreshes packages/api/openapi.json and src/schema.d.ts
```

Commit both files; the diff shows what changed in the API. Properties are treated as present unless the console marks
them optional in `apps/console/src/lib/api.ts`, because the services leave null values out of their JSON.

## Rules for screens

From the UX foundation: every record has a list and a detail page with a stable address; actions that move money or
change a record go through `ActionDialog` (enter, review with the consequence in figures, confirm; irreversible ones ask
for the id or VIN to be typed); codes are shown through `lib/labels.ts`, never raw; amounts are shown with `formatMoney`
and typed with `MoneyInput` and `parseMoney`; loading, empty and error states are always designed.

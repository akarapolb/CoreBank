# ADR-0011: Front-end architecture

Status: proposed (needs a decision before any code is written)

## Context

Today's UIs are static files served by Spring Boot: the staff console (`index.html`, `console.css`, the design prototype `proto.js`, and `live.js`, about 1,400 lines of imperative DOM code that fills the prototype with API data) and the customer app (a small PWA). They proved the services end to end and the slices built so far (fleet and floor plan, collections, assets, leases, dealers, repossession, the loss allowance run, the overview) all work. They will not scale:

- No types, so the API contract lives in the developer's head; money is minor units everywhere and a mix-up is silent.
- Behaviour is wired to global DOM ids; screens cannot be reused, composed or tested in isolation; one change (a misplaced call, a selector that matched every table) broke another screen twice.
- No component library: every screen rebuilds panel, field, table and chip by hand.
- No automated UI tests (the Playwright smoke script is not run by CI and covers none of the slices).
- Several teams will work on many domains (retail, commercial, leasing, trade, treasury, syndication, risk, operations) plus a customer app and later corporate and partner portals.

Constraints that stay: the look follows `prototype/index.html` (the design system is extracted from it, not restyled); strict content security policy with no inline scripts or handlers; OIDC authorization code with PKCE in production and a token mode for development; roles from the token decide what a person sees; Thai and English; light, dark and the Modern and Calm styles; accessible; same-origin API.

## Decision (proposed)

1. **One workspace, `web/`**, with pnpm workspaces and Turborepo. Apps: `console` (staff) and `customer` (customer app); later `portal` for corporate customers. Packages shared by all.
2. **Next.js (App Router) with strict TypeScript, built as a static export** and served by Spring Boot or a CDN. The console and customer app sit behind sign-in, so server rendering adds nothing and would put a Node server in the trust path. Revisit if a public onboarding or marketing site needs server rendering; that would be a separate app.
3. **Packages.**
   - `@fabor/ui`: the design system. Tokens are extracted from `console.css` as CSS variables, unchanged. Components: Panel, Form and Field, Chip, Result, KeyValue, DataTable, Kpi, Segmented tabs, Toast, Dialog. Documented and visually tested in Storybook.
   - `@fabor/api`: a typed client generated from the backend's OpenAPI document. A `Money` type in minor units with one formatter. Errors mapped from the stable statuses (400 bad request, 409 conflict, 422 insufficient funds) to typed errors the screens can show.
   - `@fabor/auth`: OIDC code with PKCE, development token mode, session, and `useRoles` and `RequireRole` helpers.
   - `@fabor/i18n`: Thai and English messages, number, date and baht formatting.
   - `@fabor/config`: shared ESLint, TypeScript and test configuration.
4. **Feature modules** under `apps/console/src/features/<domain>` (overview, customers, contracts, collections, repossession, assets, leases, dealers, floorplan, fleet, ecl, products, ledger, approvals, and so on). A feature owns its routes, queries, forms and tests and may depend on `ui`, `api` and `auth` but not on another feature (enforced by lint rules). Each feature exports a manifest (route, label, icon, required roles) from which navigation and the command palette are built, so adding a domain does not touch a central file.
5. **Data and forms.** TanStack Query for server state (caching, retries, invalidation after a write); React Hook Form with Zod for forms, with the schemas matching the generated API types. No global store beyond session and interface preferences.
6. **The backend contract becomes a build artifact.** Add springdoc-openapi, publish `openapi.json` in CI, generate the client from it, and fail the build on drift. API gaps the console already exposed, to close alongside: list endpoints for loans, leases, master agreements and assets; server-side filtering and pagination; maintained summaries instead of the overview walking every account and loan; one idempotency-key convention for writes.
7. **Quality gates in CI.** Vitest with Testing Library for units, Playwright end to end against the demo app in Docker, axe accessibility checks, Storybook visual regression for `@fabor/ui`, bundle size budgets, strict CSP checked in the e2e run.
8. **Migration by strangler.** The static console stays at `/console/`. The new console is served at `/console-next/`. Port one slice at a time in the order they were built, each with a parity check against the old screen and the prototype (screenshots and the same Playwright script). Switch the default when every live slice is ported, then delete the old files. The customer app follows the same way afterwards.

## Alternatives considered

- **Stay with static JavaScript, split into ES modules.** Cheapest, but gives no types, no component model and no tooling for a team; it only postpones the problem.
- **Vite and React as a single-page app.** Simpler than Next.js and sufficient for an authenticated console. Next.js is proposed for its routing and layout conventions, its ecosystem and the option of server rendering for public pages; the cost is a heavier toolchain. If that cost is not wanted, the rest of this ADR applies unchanged on Vite.
- **Micro-frontends.** Rejected for now: one design system and one team per area do not justify the runtime and deployment complexity. Revisit when separate teams own separate domains and must ship independently.
- **Angular or Vue.** No technical reason to prefer them here; React has the larger hiring pool and component ecosystem for this kind of product.

## Consequences

- A Node toolchain joins the build and CI (Java 21 and Maven stay for the services); the Spring Boot image gains the static export.
- The prototype's look is preserved as tokens and components; a screen that does not match the prototype is a defect, as now.
- During the migration two consoles exist; slice parity checks keep them from drifting.
- The backend must keep its API stable and documented; changes that break the generated client fail the build instead of failing in front of a user.

## First milestone (proposed)

Scaffold `web/`, extract the tokens and the five most used components with Storybook, wire OIDC and token-mode sign-in, generate the client from the OpenAPI document, and port two screens as proof: the Fleet and floor plan floor-plan tab and the Overview, with Playwright parity checks against the current console. Success is a green CI run that includes the e2e and accessibility checks, and a review of the result against the prototype.

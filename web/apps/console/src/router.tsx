import { createRootRoute, createRoute, createRouter, Outlet, redirect } from "@tanstack/react-router";
import { ErrorPage, InlineErrorPage, NotFoundPage } from "./shell/ErrorPage";
import { session } from "./lib/session";
import { AppShell } from "./shell/AppShell";
import { SignInPage } from "./features/auth/SignInPage";
import { HomePage } from "./features/home/HomePage";
import { LoansPage, type LoansSearch } from "./features/loans/LoansPage";
import { LoanPage, type LoanSearch } from "./features/loans/LoanPage";
import { CollectionsPage } from "./features/collections/CollectionsPage";
import { LinesPage } from "./features/floorplan/LinesPage";
import { LinePage } from "./features/floorplan/LinePage";

const root = createRootRoute({ component: Outlet, errorComponent: ErrorPage, notFoundComponent: NotFoundPage });

const signIn = createRoute({
  getParentRoute: () => root,
  path: "/sign-in",
  validateSearch: (s: Record<string, unknown>): { redirect?: string } => (typeof s.redirect === "string" ? { redirect: s.redirect } : {}),
  component: SignInPage,
});

/** Everything behind sign-in shares the shell. */
const app = createRoute({
  getParentRoute: () => root,
  id: "app",
  component: AppShell,
  // a deep link opened while signed out comes back to the same page after sign-in
  beforeLoad: ({ location }) => {
    if (!session.get()) throw redirect({ to: "/sign-in", search: { redirect: location.href } });
  },
});

const home = createRoute({ getParentRoute: () => app, path: "/", component: HomePage });

const VIEWS = ["all", "overdue", "ACTIVE", "NON_ACCRUAL", "CLOSED", "WRITTEN_OFF"] as const;
const loans = createRoute({
  getParentRoute: () => app,
  path: "/loans",
  validateSearch: (s: Record<string, unknown>): LoansSearch => ({
    q: typeof s.q === "string" ? s.q : "",
    view: VIEWS.includes(s.view as (typeof VIEWS)[number]) ? (s.view as LoansSearch["view"]) : "all",
  }),
  component: LoansPage,
});

const TABS = ["summary", "schedule", "collections"] as const;
const loan = createRoute({
  getParentRoute: () => app,
  path: "/loans/$loanId",
  validateSearch: (s: Record<string, unknown>): LoanSearch => ({
    tab: TABS.includes(s.tab as (typeof TABS)[number]) ? (s.tab as LoanSearch["tab"]) : "summary",
  }),
  component: LoanPage,
});

const collections = createRoute({ getParentRoute: () => app, path: "/collections", component: CollectionsPage });
const lines = createRoute({ getParentRoute: () => app, path: "/floor-plan", component: LinesPage });
const line = createRoute({ getParentRoute: () => app, path: "/floor-plan/$lineId", component: LinePage });

const routeTree = root.addChildren([signIn, app.addChildren([home, loans, loan, collections, lines, line])]);

export const router = createRouter({ routeTree, basepath: "/console-next", defaultPreload: "intent", defaultErrorComponent: InlineErrorPage });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

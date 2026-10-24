import { useState, type FormEvent } from "react";
import { Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Button, Field, Select } from "@fabor/ui";
import { api, ok, today } from "../lib/api";
import { session, useSession } from "../lib/session";
import { density, setDensity, setTheme, theme, type Density, type Theme } from "../lib/preferences";

/**
 * The frame around every page (UX foundation, section 3): navigation by the work people do, one search, the person and
 * their display preferences. Destinations not yet rebuilt open the classic console instead of leading nowhere.
 */
export function AppShell() {
  const who = useSession();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [menu, setMenu] = useState(false);
  const queue = useQuery({ queryKey: ["queue"], queryFn: () => ok(api.GET("/api/v1/collections/queue", { params: { query: { asOf: today() } } })) });

  const search = (e: FormEvent) => {
    e.preventDefault();
    navigate({ to: "/loans", search: { q: q.trim(), view: "all" } });
  };
  const longDate = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date());

  return (
    <div className="app">
      <a className="skip-link" href="#main">Skip to content</a>
      <nav className="side" aria-label="Main">
        <Link to="/" className="side__brand"><span className="side__logo" aria-hidden="true">F</span>Fabor OS</Link>
        <div className="side__group">
          <Link to="/" className="side__link" activeProps={{ className: "active" }} activeOptions={{ exact: true }}>Home</Link>
        </div>
        <div className="side__group">
          <div className="side__heading">Lending</div>
          <Link to="/loans" search={{ q: "", view: "all" }} className="side__link" activeProps={{ className: "active" }}>Loans</Link>
          <Link to="/collections" className="side__link" activeProps={{ className: "active" }}>
            Collections
            {queue.data && queue.data.length > 0 && <span className="side__badge" aria-label={`${queue.data.length} overdue`}>{queue.data.length}</span>}
          </Link>
        </div>
        <div className="side__group">
          <div className="side__heading">Asset finance</div>
          <Link to="/floor-plan" className="side__link" activeProps={{ className: "active" }}>Floor plan</Link>
        </div>
        <div className="side__group">
          <div className="side__heading">Not rebuilt yet</div>
          <a className="side__link" href="/console/index.html#customer">Customers</a>
          <a className="side__link" href="/console/index.html#assetfin">Leases, fleet, assets</a>
          <a className="side__link" href="/console/index.html#builder">Products</a>
          <a className="side__link" href="/console/index.html#ledger">Ledger</a>
        </div>
        <div className="side__foot">These links open the classic console.</div>
      </nav>

      <div className="main">
        <header className="top">
          <form className="top__search f-search" role="search" onSubmit={search}>
            <svg className="f-search__icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <label className="f-sr" htmlFor="global-search">Search loans by id, customer or product</label>
            <input id="global-search" className="f-input" type="search" placeholder="Search loans by id, customer or product" value={q} onChange={(e) => setQ(e.target.value)} />
          </form>
          <span className="top__date">{longDate}</span>
          <span className="top__live">Live data</span>
          <div className="user">
            <Button variant="ghost" aria-expanded={menu} aria-haspopup="true" onClick={() => setMenu(!menu)}>{who?.actor ?? "Signed in"}</Button>
            {menu && <UserMenu onClose={() => setMenu(false)} />}
          </div>
        </header>
        <main id="main" className="page" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function UserMenu({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [t, setT] = useState<Theme>(theme());
  const [d, setD] = useState<Density>(density());
  return (
    <div className="user__menu" role="dialog" aria-label="Display and account" onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}>
      <Field label="Theme">
        {(p) => (
          <Select {...p} value={t} onChange={(e) => { const v = e.target.value as Theme; setT(v); setTheme(v); }}>
            <option value="system">Same as my computer</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </Select>
        )}
      </Field>
      <Field label="Row density" hint="Compact fits more rows for queue work.">
        {(p) => (
          <Select {...p} value={d} onChange={(e) => { const v = e.target.value as Density; setD(v); setDensity(v); }}>
            <option value="comfortable">Comfortable</option>
            <option value="compact">Compact</option>
          </Select>
        )}
      </Field>
      <Button onClick={() => { session.signOut(); navigate({ to: "/sign-in" }); }}>Sign out</Button>
    </div>
  );
}


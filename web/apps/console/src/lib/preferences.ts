/** Per-person display preferences, kept in this browser only: theme and row density (UX foundation, section 5). */
export type Theme = "system" | "light" | "dark";
export type Density = "comfortable" | "compact";

const get = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const set = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } };

export function theme(): Theme { const t = get("fabor.theme"); return t === "light" || t === "dark" ? t : "system"; }
export function density(): Density { return get("fabor.density") === "compact" ? "compact" : "comfortable"; }

export function applyPreferences() {
  const root = document.documentElement;
  const t = theme();
  if (t === "system") root.removeAttribute("data-theme"); else root.setAttribute("data-theme", t);
  if (density() === "compact") root.setAttribute("data-density", "compact"); else root.removeAttribute("data-density");
}

export function setTheme(t: Theme) { set("fabor.theme", t); applyPreferences(); }
export function setDensity(d: Density) { set("fabor.density", d); applyPreferences(); }

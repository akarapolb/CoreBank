/**
 * One way to show money and dates everywhere (UX foundation, section 5). Amounts arrive from the API in minor units
 * (satang); people read baht with two decimals and a minus sign for negatives, never colour alone.
 */
const amount = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const day = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

const SYMBOL: Record<string, string> = { THB: "฿", USD: "$", EUR: "€" };

export function formatMoney(minor: number, currency = "THB"): string {
  const sign = minor < 0 ? "−" : "";
  const symbol = SYMBOL[currency];
  const value = amount.format(Math.abs(minor) / 100);
  return symbol ? `${sign}${symbol}${value}` : `${sign}${value} ${currency}`;
}

/** Turns a baht amount typed by a person into minor units; null when it is not a usable amount. */
export function parseMoney(text: string): number | null {
  const cleaned = text.replace(/[,\s฿]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole, fraction = ""] = cleaned.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

/** `2026-10-24` (an ISO date from the API) as `24 Oct 2026`. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? iso : day.format(d);
}

export function formatPercent(fraction: number, digits = 2): string {
  return `${(fraction * 100).toFixed(digits)}%`;
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;
}

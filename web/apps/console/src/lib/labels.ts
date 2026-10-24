import type { Tone } from "@fabor/ui";

/**
 * The one place where system codes become words (UX foundation, rule 5). Screens never show a raw code; anything not
 * listed falls back to the code in sentence case, so a new status is readable before it is added here.
 */
type Label = { text: string; tone: Tone };

const LOAN_STATUS: Record<string, Label> = {
  ACTIVE: { text: "Active", tone: "good" },
  NON_ACCRUAL: { text: "Non-accrual", tone: "crit" },
  CLOSED: { text: "Closed", tone: "neutral" },
  WRITTEN_OFF: { text: "Written off", tone: "crit" },
};

const NEXT_STEP: Record<string, Label & { hint: string }> = {
  REMIND: { text: "Remind", tone: "info", hint: "A friendly reminder by SMS or call." },
  CALL: { text: "Call", tone: "warn", hint: "Call the customer and agree a payment." },
  LETTER: { text: "Send letter", tone: "warn", hint: "A formal arrears letter." },
  FIELD_VISIT: { text: "Field visit", tone: "crit", hint: "Visit the customer or the asset." },
  RESTRUCTURE_REVIEW: { text: "Review for restructuring", tone: "crit", hint: "A credit officer decides on restructuring." },
  WRITE_OFF_REVIEW: { text: "Review for write-off", tone: "crit", hint: "A credit officer decides on write-off or recovery." },
};

const UNIT_STATUS: Record<string, Label> = {
  OPEN: { text: "In stock", tone: "info" },
  PAID: { text: "Paid off", tone: "good" },
};

const LINE_STATUS: Record<string, Label> = {
  ACTIVE: { text: "Active", tone: "good" },
  FROZEN: { text: "Frozen", tone: "warn" },
  CLOSED: { text: "Closed", tone: "neutral" },
};

export const CHANNELS = [
  { value: "CALL", text: "Phone call" },
  { value: "SMS", text: "SMS" },
  { value: "EMAIL", text: "Email" },
  { value: "LETTER", text: "Letter" },
  { value: "VISIT", text: "Visit" },
] as const;

function fallback(code: string): Label {
  const words = code.toLowerCase().replace(/_/g, " ");
  return { text: words.charAt(0).toUpperCase() + words.slice(1), tone: "neutral" };
}

/**
 * A loan's state as a person reads it: the contract status, and for a live loan whether it is in arrears. "Active" in
 * green on a loan 205 days late would tell the opposite of the truth.
 */
export function loanStatus(code: string, dpd = 0): Label {
  if (code === "ACTIVE" && dpd > 0) return { text: dpd >= 90 ? `${dpd} days late` : `Late · ${dpd} days`, tone: dpd >= 90 ? "crit" : "warn" };
  return LOAN_STATUS[code] ?? fallback(code);
}
export const nextStep = (code: string) => NEXT_STEP[code] ?? { ...fallback(code), hint: "" };
export const unitStatus = (code: string): Label => UNIT_STATUS[code] ?? fallback(code);
export const lineStatus = (code: string): Label => LINE_STATUS[code] ?? fallback(code);
export const channel = (code: string) => CHANNELS.find((c) => c.value === code)?.text ?? fallback(code).text;
export const productName = (code: string) => fallback(code).text;

// Seeds a running demo app (token mode) with customers, loans of different ages and a dealer line, so the console has
// realistic work to show: loans that are current, a few days late, two months late and long overdue, and stock on a
// floor plan line. Safe to run twice: existing records are reported and skipped.
// Usage: node web/scripts/seed-demo.mjs   (FABOR_API and FABOR_API_TOKEN override the defaults)
import { readFileSync } from "node:fs";

const BASE = process.env.FABOR_API ?? "http://localhost:18080";
const TOKEN = process.env.FABOR_API_TOKEN ?? "ui-smoke-token-123456";

async function call(method, path, body, actor = "seed", type = "application/json") {
  const res = await fetch(`${BASE}/api/v1${path}`, {
    method,
    headers: { Authorization: `Bearer ${TOKEN}`, "X-Actor": actor, "Content-Type": type },
    body: body === undefined ? undefined : type === "application/json" ? JSON.stringify(body) : body,
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

async function step(label, fn) {
  const r = await fn();
  const ok = r.status < 300;
  console.log(`${ok ? "ok  " : "skip"} ${label}${ok ? "" : ` (${r.status}: ${r.body?.message ?? ""})`}`);
  return r;
}

async function publish(file, code) {
  const versions = await call("GET", `/products/${code}/versions`);
  if (versions.status === 200 && versions.body.length > 0) { console.log(`skip product ${code} (already published)`); return; }
  const yaml = readFileSync(new URL(`../../fabor-app/src/test/resources/products/${file}`, import.meta.url), "utf8");
  const d = await call("POST", "/products/drafts", yaml, "maya", "text/plain");
  await call("POST", `/products/drafts/${d.body.id}/submit`, undefined, "maya");
  for (const [who, role] of [["bob", "PRODUCT"], ["rita", "RISK"], ["fin", "FINANCE"], ["carl", "COMPLIANCE"]]) {
    await call("POST", `/products/drafts/${d.body.id}/approve`, { role }, who);
  }
  await step(`product ${code}`, () => call("POST", `/products/drafts/${d.body.id}/publish`, undefined, "maya"));
}

await publish("savings.yaml", "SAVINGS_STD");
await publish("personal-loan.yaml", "PERSONAL_LOAN_STD");

const people = [
  ["C10", "Somchai Prasert", "2026-03-02"],
  ["C11", "Malee Wongsa", "2026-07-20"],
  ["C12", "Anan Chaiyo", "2026-08-25"],
  ["C13", "Pimchanok Rattana", "2026-10-15"],
  ["C14", "Kittipong Siri", "2026-05-11"],
];
for (const [i, [id, name, asOf]] of people.entries()) {
  await step(`customer ${id}`, () => call("POST", "/customers", {
    partyId: id, fullName: name, nationalId: `11017002306${String(80 + i).padStart(2, "0")}`, phone: `08123400${String(10 + i)}`,
    dateOfBirth: "1988-04-12", documentRef: `doc-${id}`,
    consents: [{ purpose: "KYC_PROCESSING", version: 1, channel: "APP" }, { purpose: "CREDIT_BUREAU", version: 1, channel: "APP" }],
  }));
  await step(`loan for ${id} from ${asOf}`, () => call("POST", "/loans/applications", {
    applicationId: `A-${id}`, partyId: id, productCode: "PERSONAL_LOAN_STD", productVersion: 1, amountMinor: 8_000_000 + i * 1_500_000,
    termMonths: 12, monthlyInstalmentMinor: 760_000, monthlyIncomeMinor: 5_000_000, existingDebtMinor: 300_000, monthsAtEmployer: 30,
    asOf, currency: "THB",
  }));
}

await step("dealer line FP-DEMO", () => call("POST", "/floorplans", {
  id: "FP-DEMO", dealerId: "DLR-1", currency: "THB", limitMinor: 300_000_000, annualRate: 0.065, payoffWindowDays: 3, settlementAccountId: "SAV-C14",
  terms: { NEW: { subLimitMinor: 250_000_000, interestFreeDays: 60 }, USED: { subLimitMinor: 80_000_000, interestFreeDays: 0 } },
  curtailments: [{ atDay: 120, cumulativePercent: 10 }, { atDay: 180, cumulativePercent: 25 }, { atDay: 270, cumulativePercent: 100 }],
  signedOn: "2026-06-01",
}));
const units = [["MR0HA3CD5P0100011", "NEW", 89_500_000, "2026-06-03"], ["MR0HA3CD5P0100012", "NEW", 91_000_000, "2026-08-14"],
  ["JTEBU3FJ9PK020301", "USED", 42_000_000, "2026-09-02"], ["MR0HA3CD5P0100013", "NEW", 54_900_000, "2026-10-10"]];
for (const [vin, type, amount, date] of units) {
  await step(`unit ${vin}`, () => call("POST", "/floorplans/FP-DEMO/units", { unitId: vin, type, amountMinor: amount, date, supplierAccountId: "SAV-C13" }));
}
await step("sale of MR0HA3CD5P0100011", () => call("POST", "/floorplans/FP-DEMO/units/MR0HA3CD5P0100011/sale", { soldOn: "2026-10-15" }));
console.log("Done. The scheduler bills the past instalments within a few seconds.");

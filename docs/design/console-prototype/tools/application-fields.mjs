// Prints the loan application's field catalogue (js/appform.js) as docs/design/loan-application-fields.md.
//   node docs/design/console-prototype/tools/application-fields.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const here = dirname(fileURLToPath(import.meta.url)), root = join(here, "..");
const src = readFileSync(join(root, "js/appform.js"), "utf8");
// the catalogue needs no browser; stub what the script touches when it loads
const ctx = { FLOWS: {}, RECS: {}, TH: {}, document: { addEventListener() {} }, parseMoney: (v) => Number(String(v).replace(/[฿,\s]/g, "")), Object, Math, String, Number, Date, isNaN, Infinity };
vm.createContext(ctx);
vm.runInContext(src + `
;globalThis.__out = { AF, AF_STEPS, WHY, AF_SRC, products: Object.keys(INTAKE_PRODUCTS).map((k) => [k, INTAKE_PRODUCTS[k].name]),
  options: (x) => typeof x.o !== "function" ? null : Object.fromEntries(Object.keys(INTAKE_PRODUCTS).map((p) => { INTAKE.product = p; return [p, x.o()]; })) };`, ctx);
const { AF, AF_STEPS, WHY, AF_SRC, products, options } = ctx.__out;

const cond = (fn) => !fn ? "" : fn.label || String(fn).replace(/^\(f\)\s*=>\s*/, "").replace(/\bf\./g, "").replace(/num\((\w+)\)/g, "$1").replace(/&&/g, "and").replace(/\|\|/g, "or").replace(/!==/g, "≠").replace(/===/g, "=").replace(/^!(\w+)$/, "$1 is not ticked");
const cell = (s) => String(s).replace(/\|/g, "\|");
const TYPE = { money: "money (THB)", num: "number", text: "text", select: "choice", check: "yes/no (tick)", date: "date", tel: "phone", email: "email", id: "citizen ID (13 digits, checksum)", post: "postcode (5 digits)", area: "long text" };
let fields = 0, required = 0;
const out = [`# Loan application: field dictionary

Generated from \`docs/design/console-prototype/js/appform.js\` by \`tools/application-fields.mjs\`. Do not edit by hand: change the catalogue and run the tool again.

The same catalogue drives the prototype's form, its checks, the document list and the review step, so this list is what the screens ask. It is the starting point for the backend's application model; the values for limits (debt service ratio, LTV, minimum income, automatic-approval bands) are credit policy that the bank sets, and the regulatory notes are for counsel and compliance to confirm.

**Columns.** *Required*: "Yes" when shown; a field that is only shown in some cases is required only then. *Shown when*: the condition on other answers (or the product). *Source*: where the value comes from; anything other than "Customer" is prefilled or fetched and shown with a tag. *Why*: the reason the bank collects it.

**Products:** ${products.map(([k, n]) => `\`${k}\` ${n}`).join(", ")}.

**Sources:** ${Object.entries(AF_SRC).map(([k, v]) => `\`${k}\` ${v[0]}`).join(", ")}.
`];
for (const [step, en] of AF_STEPS) {
  const secs = AF.filter((s) => s.s === step);
  if (!secs.length) continue;
  out.push(`\n## ${en}\n`);
  for (const sec of secs) {
    out.push(`### ${sec.en}${sec.when ? ` (when ${cond(sec.when)})` : ""}\n`);
    if (sec.sub) out.push(`${sec.sub[0]}\n`);
    out.push("| Field | Label | Thai | Type | Required | Shown when | Source | Why | Values |", "|---|---|---|---|---|---|---|---|---|");
    for (const x of sec.fields) {
      fields++; if (x.req) required++;
      const opts = options(x), vals = opts ? Object.entries(opts).map(([p, o]) => `${p}: ${o.map((v) => v[0]).join(", ")}`).join("; ") : x.o ? x.o.map((v) => v[0]).join(", ") : "";
      out.push(`| \`${x.k}\` | ${cell(x.en)} | ${cell(x.th)} | ${TYPE[x.t] || x.t}${x.ro ? ", read-only" : ""} | ${x.req ? "Yes" : ""} | ${cell(cond(x.when))} | ${AF_SRC[x.src] ? AF_SRC[x.src][0] : ""} | ${WHY[x.why] || ""} | ${cell(vals)} |`);
    }
    out.push("");
  }
}
out.splice(1, 0, `\n${fields} fields in ${AF.length} sections; ${required} of them required when shown.`);
out.push(`
## Derived, not asked

- **Income counted**: salary + fixed allowances + 70% of variable income + 50% of other income (employees); net profit + 50% of other income (self-employed); the pension (retired); plus the co-borrower's income when there is one.
- **Debt payments**: the credit bureau (NCB) accounts, the declared debts the bureau does not show (cooperative, student loan, informal, other) and the co-borrower's debts.
- **Policy checks**: debt service ratio, minimum income, the BOT personal-loan cap (5 times income at ฿30,000 a month or more, 1.5 times below it), LTV by mortgage contract number (or vehicle condition), age at the end of the loan, time in the job or business, bureau score and arrears, bankruptcy. Politically exposed persons, related parties and debt litigation are referred to a person rather than declined.
- **Documents**: the list follows occupation, marital status, co-borrower, guarantor, product and purpose; required documents not yet received become conditions before disbursement.
`);
writeFileSync(join(root, "..", "loan-application-fields.md"), out.join("\n"));
console.log(`docs/design/loan-application-fields.md · ${fields} fields, ${required} required`);

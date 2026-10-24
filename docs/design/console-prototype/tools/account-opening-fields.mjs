// Prints the account-opening catalogues (js/onboarding.js) as docs/design/account-opening-fields.md.
//   node docs/design/console-prototype/tools/account-opening-fields.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const here = dirname(fileURLToPath(import.meta.url)), root = join(here, "..");
// onboarding.js builds on appform.js (option lists, ID check) and deposits.js (the rate card); stub what loading touches
const ctx = { FLOWS: {}, RECS: {}, TH: {}, document: { addEventListener() {} }, parseMoney: (v) => Number(String(v).replace(/[฿,\s]/g, "")), tt: (en) => en, t: (s) => s, BIZ: Date.UTC(2026, 9, 24), Object, Math, String, Number, Date, isNaN, Infinity, JSON };
vm.createContext(ctx);
const RATE_CARD = "const RATE_CARD = [[3, 0.016], [6, 0.019], [12, 0.0225], [24, 0.025]];\n";
vm.runInContext(readFileSync(join(root, "js/appform.js"), "utf8") + "\n" + RATE_CARD + readFileSync(join(root, "js/onboarding.js"), "utf8") + `
;globalThis.__out = { forms: [["Individual onboarding (ONB-7731)", IND_STEPS, IND_CAT, OBF.ind], ["Business account opening (AO-26-0412)", BIZ_STEPS, BIZ_CAT, OBF.biz]], SRC: OB_SRC, WHY: OB_WHY };`, ctx);
const { forms, SRC, WHY } = ctx.__out;

const cond = (fn) => !fn ? "" : fn.label || String(fn).replace(/^\(f\)\s*=>\s*/, "").replace(/\bf\./g, "").replace(/f\[`(\w+)\$\{n\}(\w*)`\]/g, "$1n$2").replace(/&&/g, "and").replace(/\|\|/g, "or").replace(/!==/g, "≠").replace(/===/g, "=").replace(/^!(\w+)$/, "$1 is not ticked").replace(/^isThai\(f\)$/, "document is a Thai ID card").replace(/^!isThai\(f\)$/, "document is not a Thai ID card");
const cell = (s) => String(s).replace(/\|/g, "\|").replace(/\n/g, " ");
const TYPE = { money: "money (THB)", num: "number", pct: "percent", text: "text", select: "choice", check: "yes/no (tick)", date: "date", tel: "phone", email: "email", id: "13-digit ID (checksum)", post: "postcode", area: "long text" };
const out = [`# Account opening: field dictionary

Generated from \`docs/design/console-prototype/js/onboarding.js\` by \`tools/account-opening-fields.mjs\`. Do not edit by hand: change the catalogue and run the tool again.

The catalogues drive the prototype's individual onboarding and business account opening: the form, field checks, the risk score, the review step and approval routing. They are the starting point for the backend's customer and account-opening model. Regulatory reasons are for compliance and counsel to confirm; risk weights and bands are the bank's to set.

**Sources:** ${Object.entries(SRC).map(([k, v]) => `\`${k}\` ${v[0]}`).join(", ")}. **Why:** ${Object.entries(WHY).map(([k, v]) => `\`${k}\` ${v}`).join(", ")}.
`];
let total = 0;
for (const [name, steps, cat] of forms) {
  const n = cat.reduce((a, s) => a + s.fields.length, 0); total += n;
  out.push(`\n## ${name}\n\n${n} fields.\n`);
  for (const [step, en] of steps) {
    const secs = cat.filter((s) => s.s === step); if (!secs.length) continue;
    out.push(`### ${en}\n`);
    for (const sec of secs) {
      out.push(`**${sec.en}**${sec.when ? ` (when ${cond(sec.when)})` : ""}${sec.sub ? `: ${sec.sub[0]}` : ""}\n`, "| Field | Label | Thai | Type | Required | Shown when | Source | Why | Values |", "|---|---|---|---|---|---|---|---|---|");
      for (const x of sec.fields) { const opts = typeof x.o === "function" ? x.o({}) : x.o;
        out.push(`| \`${x.k}\` | ${cell(x.en)} | ${cell(x.th)} | ${TYPE[x.t] || x.t}${x.ro === true ? ", read-only" : ""} | ${typeof x.req === "function" ? "When " + cell(cond(x.req)) : x.req ? "Yes" : ""} | ${cell(cond(x.when))} | ${SRC[x.src] ? SRC[x.src][0] : ""} | ${WHY[x.why] || ""} | ${opts ? cell(opts.map((v) => v[0]).filter(Boolean).join(", ")) : ""} |`); }
      out.push("");
    }
  }
}
out.push(`## Derived, not asked

- **Customer risk** adds points for the answers that raise risk (foreign nationality or ownership, opening remotely, higher-risk industries, deposits well above income, large cash, cross-border flows and high-risk countries, politically exposed persons, acting for someone else, nominees, shell signs, layered ownership, adverse media). 0–3 is low (opens at once, checked the same day, reviewed every 3 years), 4–7 medium (a manager approves, reviewed every 2 years), 8 or more high (enhanced due diligence, compliance and a senior manager approve).
- **Cross-checks** for businesses: shareholdings add up to 100%, and a company shareholder of 25% or more has the person behind it named.
`);
out.splice(1, 0, `\n${total} fields across both journeys.`);
writeFileSync(join(root, "..", "account-opening-fields.md"), out.join("\n"));
console.log(`docs/design/account-opening-fields.md · ${total} fields`);

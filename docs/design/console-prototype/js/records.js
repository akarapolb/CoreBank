// Fabor console prototype · Record pages, analytics, branch screens and personal settings.
// Classic scripts sharing one global scope; load order is set in index.html.
/* ---------------- records with a full page ---------------- */
let recentRecs = [];
const RECS = {
  "LN-A-C10": { sys: "lending", sec: "loans", label: "LN-A-C10", kind: "Personal loan", match: ["LN-A-C10"], view: () => viewLoan(),
    tabs: [["summary", "Summary"], ["schedule", "Schedule", 15], ["payments", "Payments", 5], ["collections", "Collections", 8], ["recovery", "Recovery"], ["postings", "Postings"], ["whatif", "What if"]] },
  "C10": { sys: "customers", sec: "directory", label: "Somchai Prasert", kind: "Customer", match: ["C10"], view: () => viewCustomer(),
    tabs: [["overview", "Overview"], ["products", "Accounts and contracts", 3], ["contacts", "Contact history", 10], ["consents", "Consents", 4], ["kyc", "KYC"]] },
  "FP-DEMO": { sys: "leasing", sec: "floorplan", label: "FP-DEMO", kind: "Floor plan line", match: ["FP-DEMO"], view: () => viewLine(),
    tabs: [["units", "Vehicles", 4], ["audit", "Stock audit"], ["billing", "Interest"], ["dealer", "Dealer"]] },
  "HP-2025-004812": { sys: "leasing", sec: "hp", label: "HP-2025-004812", kind: "Hire purchase", match: ["HP-2025-004812"], view: () => viewHP(),
    tabs: [["summary", "Summary"], ["schedule", "Schedule", 60], ["settle", "Early settlement"], ["vehicle", "Vehicle and insurance"]] },
  "TPL-HP-VEHICLE": { sys: "products", sec: "master", label: "TPL-HP-VEHICLE", kind: "Product template", match: ["TPL-HP-VEHICLE"], view: () => viewTemplate(),
    tabs: [["blocks", "Building blocks", 9], ["params", "Parameters", 7], ["rules", "Rule pack", 5], ["products", "Products", 3]] },
  "AUTO_HP_USED_v2": { sys: "products", sec: "builder", label: "AUTO_HP_USED v2", kind: "Product draft", match: ["AUTO_HP_USED v2", "AUTO_HP_USED"], view: () => viewDraft(),
    tabs: [["setup", "Setup"], ["sim", "Simulation"], ["approvals", "Approvals"], ["changes", "Changes from v1", 5]] },
  "SAV-C10": { sys: "deposits", sec: "accounts", label: "SAV-C10", kind: "Savings account", match: ["SAV-C10"], view: () => viewAccount(),
    tabs: [["tx", "Transactions", 9], ["holds", "Holds", 1], ["interest", "Interest"], ["statement", "Statement"]] },
  "LC-26-0412": { sys: "trade", sec: "lc", label: "LC-26-0412", kind: "Import letter of credit", match: ["LC-26-0412"], view: () => viewLC(),
    tabs: [["summary", "Summary"], ["docs", "Documents", 7], ["amend", "Amendments", 1], ["charges", "Charges", 3]] },
  "ONB-7731": { sys: "customers", sec: "onboarding", label: "ONB-7731", kind: "Onboarding", match: ["ONB-7731"], view: () => viewOnboarding(),
    tabs: [["id", "ID card"], ["dopa", "DOPA check"], ["ndid", "NDID"], ["face", "Liveness"], ["screen", "Sanctions and PEP"], ["consent", "Consents"], ["open", "Open account"]] },
  "F2": { sys: "leasing", sec: "leases", label: "F2", kind: "Finance lease", match: ["F2"], view: () => viewLease(),
    tabs: [["summary", "Summary"], ["schedule", "Schedule", 12], ["accounting", "Accounting"], ["asset", "Asset"]] },
  "MA-1": { sys: "leasing", sec: "fleet", label: "MA-1", kind: "Fleet master agreement", match: ["MA-1"], view: () => viewFleet(),
    tabs: [["schedules", "Schedules", 2], ["invoices", "Invoices", 3], ["covenants", "Covenants", 2]] },
  "DLR-1": { sys: "leasing", sec: "dealers", label: "DLR-1", kind: "Dealer", match: ["DLR-1"], view: () => viewDealer(),
    tabs: [["lines", "Lines", 2], ["performance", "Performance"], ["agreement", "Agreement"]] },
  "TD-88140": { sys: "deposits", sec: "term", label: "TD-88140", kind: "Term deposit", match: ["TD-88140"], view: () => viewTD(),
    tabs: [["summary", "Summary"], ["interest", "Interest"]] },
  "BG-26-1102": { sys: "trade", sec: "guarantees", label: "BG-26-1102", kind: "Bank guarantee", match: ["BG-26-1102"], view: () => viewBG(),
    tabs: [["summary", "Summary"], ["security", "Security"], ["claims", "Claims", 0], ["charges", "Charges", 2]] },
  "AML-2026-0418": { sys: "compliance", sec: "cases", label: "AML-2026-0418", kind: "AML case", match: ["AML-2026-0418", "AML-ALR-7712"], view: () => viewAML(),
    tabs: [["alert", "Alert"], ["investigation", "Investigation", 9], ["decision", "Decision"]] },
  "TR-9918210": { sys: "payments", sec: "held", label: "TR-9918210", kind: "Held payment", match: ["TR-9918210", "AML-ALR-7699"], view: () => viewHeld(),
    tabs: [["payment", "Payment"], ["screening", "Screening"], ["decision", "Decision"]] },
  "APP-30413": { sys: "lending", sec: "applications", label: "APP-30413", kind: "Loan application", match: ["APP-30413"], view: () => viewApp30413(),
    tabs: [["application", "Application"], ["credit", "Credit assessment"], ["decision", "Decision"], ["disbursement", "Disbursement"]] },
  "GL-1300": { sys: "finance", sec: "gl", label: "GL 1300", kind: "General ledger account", match: ["1300"], view: () => viewGL(),
    tabs: [["balance", "Balance"], ["journals", "Journals", 6], ["recon", "Reconciliation"]] },
};
function recOf(html) {
  for (const [id, d] of Object.entries(RECS)) for (const m of d.match) if (html.includes(`class="rec">${esc(m)}<`) && has(d.sys)) return { id, m };
  return null;
}
const secLabel = (sys, sec) => t(sysById[sys].sections.find(([k]) => k === sec)[1]);
const factsHtml = (facts) => `<section class="facts" aria-label="${esc(t("Key figures"))}">${facts.map(([l, v, tone, sub]) => `<div class="fact"><span>${esc(t(l))}</span><b class="${tone || ""}">${esc(v)}</b>${sub ? `<small>${esc(sub)}</small>` : ""}</div>`).join("")}</section>`;
// one header, the facts that matter, tabs for each facet
function recordPage(o) {
  const def = RECS[current.rec], s = sysById[def.sys], tab = current.tab;
  const id = `${eyebrow(s, t(def.kind))}<h1 class="title${o.mono ? " rec-id" : ""}">${esc(o.title)}</h1><p class="lede">${o.lede}</p>${o.pills ? `<div class="pills">${o.pills}</div>` : ""}`;
  return `<button class="back" type="button" data-go="${def.sys}/${def.sec}">${icon("i-back")}${esc(secLabel(def.sys, def.sec))}</button>
    <div class="head">${o.avatar ? `<div class="profile"><span class="big-av">${esc(o.avatar)}</span><div>${id}</div></div>` : `<div>${id}</div>`}<div class="actions"><button class="btn" type="button" data-action="history" aria-pressed="${side === "history"}">${icon("i-history")}${esc(tt("History", "ประวัติ"))}</button>${o.actions || ""}</div></div>
    ${factsHtml(o.facts)}
    <div class="tabs" role="tablist" aria-label="${esc(o.title)}">${def.tabs.map(([k, l, c]) => `<button class="tab" type="button" role="tab" id="tab-${k}" aria-controls="panel" aria-selected="${k === tab}" tabindex="${k === tab ? 0 : -1}" data-tab="${k}">${esc(t(l))}${c ? `<span class="c">${c}</span>` : ""}</button>`).join("")}</div>
    <div id="panel" class="panel" role="tabpanel" aria-labelledby="tab-${tab}">${o.panels[tab]()}</div>`;
}
const kvHtml = (rows) => `<dl class="kv">${rows.map(([k, v]) => `<dt>${esc(t(k))}</dt><dd>${esc(v)}</dd>`).join("")}</dl>`;
const card = (title, body, extra = "") => `<section class="card"><div class="card-head"><div class="card-title">${esc(title)}</div>${extra}</div><div class="card-body">${body}</div></section>`;
const tl = (items) => `<div class="timeline">${items.map(([d, w, sub, st]) => `<div class="tl ${st || ""}"><span class="t">${esc(typeof d === "number" ? fdShort(d) : d)}</span><span class="rail-dot"><i></i></span><div class="what"><strong>${esc(t(w))}</strong>${sub ? `<span>${esc(t(sub))}</span>` : ""}</div></div>`).join("")}</div>`;

function viewLoan() {
  const L = LOAN;
  return recordPage({ title: "LN-A-C10", mono: true, lede: `${esc(t("Somchai Prasert"))} · party C10 · ${esc(t("Repaid from"))} SAV-C10`,
    pills: lateP(LATE_DAYS) + P("crit", "Stage 3") + P("warn", "Collateral held for sale"),
    actions: `<button class="btn" type="button" data-act="promise">${esc(t("Record promise"))}</button><button class="btn" type="button" data-act="pay">${icon("i-cash")}${esc(t("Take payment"))}</button><button class="btn primary" type="button" data-act="settle">${esc(t("Settle early"))}</button>`,
    facts: [["Outstanding principal", baht(L.principalOut)], ["Overdue, 5 instalments", baht(L.overdue), "crit"], ["Days late", String(LATE_DAYS), "crit", tt(`since ${fd(L.late[0].due)}`, `ตั้งแต่ ${fd(L.late[0].due)}`)],
      ["Next due", baht(L.pay), "", fd(L.rows[10].due)], ["Interest rate", "15.00%", "", t("a year, reducing balance")], ["Loss allowance", baht(L.allowance), "", "Stage 3 · " + t("45% of exposure")]],
    panels: { summary: loanSummary, schedule: loanSchedule, payments: loanPayments, collections: loanCollections, recovery: loanRecovery, postings: loanPostings, whatif: loanWhatIf } });
}
function loanSummary() {
  const L = LOAN;
  const kv = [["Product", "Personal loan · PERSONAL_LOAN_STD v1"], ["Principal", baht(L.P)], ["Disbursed", `${fd(Date.UTC(2025, 11, 2))} → SAV-C10`], ["Term", lang === "th" ? `15 งวด สิ้นสุด ${fd(L.rows[14].due)}` : `15 months, ends ${fd(L.rows[14].due)}`],
    ["Instalment", lang === "th" ? `${baht(L.pay)} ทุกวันที่ 2` : `${baht(L.pay)} on the 2nd`], ["Interest rate", "15.00% · " + t("a year, reducing balance")], ["Default interest", lang === "th" ? "+3.00% ต่อปีบนเงินต้นค้างชำระ" : "+3.00% a year on overdue principal"],
    ["Collateral", "A4 · Mitsubishi Triton · 4กก 4444"], ["Repaid from", "SAV-C10 · " + baht(L.sav)]];
  const next = [[L.rows[10].due, lang === "th" ? `งวดที่ 11 ${baht(L.pay)} ครบกำหนด` : `Instalment 11 of ${baht(L.pay)} falls due`, ""],
    [Date.UTC(2026, 10, 5), lang === "th" ? "ครบ 30 วันหลังหนังสือบอกกล่าว: บอกเลิกสัญญาได้" : "30 days after the notice: the contract can be terminated", "warn"],
    [Date.UTC(2027, 4, 28), lang === "th" ? "ค้างครบ 360 วัน: พิจารณาตัดหนี้สูญ" : "360 days late: write-off review", "crit"]];
  return `<div class="grid-main">
    <section class="card"><div class="card-head"><div class="card-title">${esc(t("Contract"))}</div></div><div class="card-body"><dl class="kv">${kv.map(([k, v]) => `<dt>${esc(t(k))}</dt><dd>${esc(v)}</dd>`).join("")}</dl></div></section>
    <section class="card"><div class="card-head"><div class="card-title">${esc(t("What happens next"))}</div></div><div class="card-body"><div class="timeline">${next.map(([d, w, st]) => `<div class="tl ${st}"><span class="t">${esc(fdShort(d))}</span><span class="rail-dot"><i></i></span><div class="what"><strong>${esc(w)}</strong></div></div>`).join("")}</div>
      <p class="note">${esc(t("Settlement today"))}: <b class="num">${baht(LOAN.total)}</b>. ${esc(lang === "th" ? "ดูรายละเอียดได้จากปุ่มปิดบัญชีก่อนกำหนด" : "The breakdown is in Settle early.")}</p></div></section></div>`;
}
function loanSchedule() {
  const tone = { paid: ["good", "Paid"], next: ["info", "Due next"], scheduled: ["", "Scheduled"] };
  return `<section class="card"><div class="table-wrap"><table><caption class="sr">${esc(t("Schedule"))}</caption><thead><tr>${["No.", "Due", "Instalment", "Interest", "Principal", "Balance after", "State"].map((c) => `<th scope="col" class="${NUMERIC.test(c) ? "r" : ""}">${esc(t(c))}</th>`).join("")}</tr></thead><tbody>
    ${LOAN.rows.map((r) => `<tr class="${r.state === "overdue" ? "late" : r.state}"><td class="num">${r.n}</td><td class="num">${esc(fd(r.due))}</td><td class="r num">${baht(r.amount)}</td><td class="r num">${baht(r.interest)}</td><td class="r num">${baht(r.principal)}</td><td class="r num">${baht(r.balance)}</td><td>${r.state === "overdue" ? lateP(LOAN.daysLate(r.due)) : P(tone[r.state][0], tone[r.state][1])}</td></tr>`).join("")}
    </tbody></table></div></section>`;
}
function loanPayments() {
  return `<section class="card"><div class="table-wrap"><table><caption class="sr">${esc(t("Payments"))}</caption><thead><tr>${["Received", "Amount", "From", "Reference", "Applied to"].map((c) => `<th scope="col" class="${c === "Amount" ? "r" : ""}">${esc(t(c))}</th>`).join("")}</tr></thead><tbody>
    ${LOAN.rows.filter((r) => r.state === "paid").reverse().map((r) => `<tr><td class="num">${esc(fd(r.due))}</td><td class="r num">${baht(r.amount)}</td><td><span class="rec">SAV-C10</span></td><td class="num muted">RC-2026-${String(40112 + r.n * 917).padStart(6, "0")}</td><td>${esc(lang === "th" ? `งวดที่ ${r.n}` : `Instalment ${r.n}`)}</td></tr>`).join("")}
    </tbody></table></div></section>`;
}
function loanCollections() {
  return `<section class="card"><div class="card-head"><div><div class="card-title">${esc(t("Collections"))}</div><div class="card-sub">${esc(t("Contacts and promises, newest first"))}</div></div><button class="btn" type="button" data-act="promise">${esc(t("Record promise"))}</button></div>
    <div class="card-body"><div class="timeline">${COLL.slice().reverse().map(([d, w, sub, st]) => `<div class="tl ${st}"><span class="t">${esc(fdShort(d))}</span><span class="rail-dot"><i></i></span><div class="what"><strong>${esc(t(w))}</strong><span>${esc(t(sub))}</span></div></div>`).join("")}</div></div></section>`;
}
function loanRecovery() {
  const L = LOAN, shortfall = r2(L.total + L.costs - L.valuation);
  const kv = [["Vehicle", "A4 · Mitsubishi Triton 2.4 GLS, 2022"], ["Registration", "4กก 4444 · VIN MMTJJKK10NH004412"], ["Taken", fd(Date.UTC(2026, 9, 18))], ["Where", lang === "th" ? "ลานบางพลี" : "Bang Phli yard"], ["Forced-sale valuation", baht(L.valuation)], ["Towing and storage", baht(L.costs)]];
  return `<div class="grid-main">
    <section class="card"><div class="card-head"><div class="card-title">${esc(t("Collateral"))}</div>${P("warn", "Held for sale")}</div><div class="card-body"><dl class="kv">${kv.map(([k, v]) => `<dt>${esc(t(k))}</dt><dd>${esc(v)}</dd>`).join("")}</dl></div></section>
    <section class="card"><div class="card-head"><div class="card-title">${esc(t("Expected shortfall"))}</div></div><div class="card-body" style="display:grid;gap:14px">
      <div class="quote"><span>${esc(t("Settlement today"))}</span><span class="num">${baht(L.total)}</span><span>${esc(t("Towing and storage"))}</span><span class="num">${baht(L.costs)}</span><span>${esc(t("Forced-sale valuation"))}</span><span class="num">${baht(-L.valuation)}</span><span class="total">${esc(t("Expected shortfall"))}</span><span class="total num">${baht(shortfall)}</span></div>
      <p class="note">${esc(t("If the customer settles, the vehicle is returned. If not, it is sold and the shortfall stays owed."))}</p></div></section></div>`;
}
function loanPostings() {
  const rw = LOAN.rows;
  const rows = [[BIZ, "Loss allowance top-up", "5300 Expected credit loss expense", "1390 Loss allowance on loans", 1204.10],
    [rw[9].due, "Instalment 10 billed, principal", "1310 Instalments receivable", "1300 Loans receivable", rw[9].principal], [rw[9].due, "Instalment 10 billed, interest", "1310 Instalments receivable", "4100 Interest income", rw[9].interest],
    [rw[8].due, "Instalment 9 billed, principal", "1310 Instalments receivable", "1300 Loans receivable", rw[8].principal], [rw[8].due, "Instalment 9 billed, interest", "1310 Instalments receivable", "4100 Interest income", rw[8].interest],
    [rw[4].due, "Payment received, instalment 5", "2100 Savings deposits · SAV-C10", "1310 Instalments receivable", rw[4].amount]];
  return `<section class="card"><div class="card-head"><div class="card-sub">${esc(t("Every entry balances: total debits equal total credits."))}</div></div><div class="card-body flush"><div class="table-wrap"><table><caption class="sr">${esc(t("Postings"))}</caption><thead><tr>${["Date", "Entry", "Debit", "Credit", "Amount"].map((c) => `<th scope="col" class="${c === "Amount" ? "r" : ""}">${esc(t(c))}</th>`).join("")}</tr></thead><tbody>
    ${rows.map(([d, e, dr, cr, a]) => `<tr><td class="num">${esc(fd(d))}</td><td>${esc(e)}</td><td class="muted">${esc(dr)}</td><td class="muted">${esc(cr)}</td><td class="r num">${baht(a)}</td></tr>`).join("")}
    </tbody></table></div></div></section>`;
}

/* ---------------- customer C10 ---------------- */
function viewCustomer() {
  const L = LOAN;
  const panels = {
    overview: () => `<section class="rel">${[["deposits", "SAV-C10", baht(L.sav), "Savings Standard", "deposits/accounts"], ["lending", "LN-A-C10", baht(L.principalOut), tt(`${LATE_DAYS} days late`, `ค้าง ${LATE_DAYS} วัน`), "rec:LN-A-C10"], ["collections", "R-A4", baht(L.valuation), tt("Triton held for sale", "ไทรทันรอขาย"), "collections/repossessions"]].filter((x) => has(x[0])).map(([sid, k, v, d, go]) => `<button class="card" type="button" data-go="${go}"><span class="k">${icon(sysById[sid].icon)}${esc(k)}</span><span class="v">${esc(v)}</span><span class="muted" style="font-size:12.5px">${esc(t(d))}</span></button>`).join("")}</section>
      <div class="grid-main">${card(t("What happens next"), tl([[BIZ, "Recommended: review for restructuring", "Collections policy, 120 or more days late", "now"], [L.rows[10].due, tt("Instalment 11 falls due", "งวดที่ 11 ครบกำหนด"), "", ""], [Date.UTC(2027, 11, 1), tt("KYC review", "ทบทวน KYC"), "", ""]]))}
      ${card(t("Consents"), `<div class="bars">${[[tt("Credit bureau check", "ตรวจเครดิตบูโร"), 100, ""], [tt("Marketing", "การตลาด"), 0, "crit"], [tt("Service messages", "ข้อความบริการ"), 100, ""]].map(([n, p, tone]) => `<div class="bar-row"><span>${esc(n)}</span><span class="muted">${p ? esc(tt("Given", "ให้แล้ว")) : esc(tt("Withdrawn", "ถอนแล้ว"))}</span><div class="bar"><span class="${tone}" style="width:${p || 4}%"></span></div></div>`).join("")}</div>`)}</div>`,
    products: () => `<section class="card"><div class="card-body flush">${table({ cols: ["Account", "Product", "Opened", "Balance", "Status"], rows: [[R("SAV-C10"), "Savings Standard", "1 Dec 2025", baht(L.sav), P("good", "Active")], [R("LN-A-C10"), t("Personal loan"), "2 Dec 2025", baht(L.principalOut), lateP(LATE_DAYS)], [R("A4"), "Mitsubishi Triton · 4กก 4444", "2 Dec 2025", baht(L.valuation), P("warn", "Repossessed")]] }, t("Accounts and contracts"))}</div></section>`,
    contacts: () => card(t("Contact history"), tl([[Date.UTC(2025, 11, 1), tt("Onboarded in the app", "เปิดบัญชีผ่านแอป"), tt("NDID identity check passed, IAL 2.3", "ยืนยันตัวตน NDID ผ่าน IAL 2.3"), "done"], [Date.UTC(2025, 11, 2), tt("Loan LN-A-C10 disbursed", "เบิกจ่ายสินเชื่อ LN-A-C10"), "฿85,250.00 → SAV-C10", "done"], ...COLL])),
    consents: () => `<section class="card"><div class="card-body flush">${table({ cols: ["Purpose", "Legal basis", "Since", "Status"], rows: [[tt("Credit bureau check (NCB)", "ตรวจเครดิตบูโร (NCB)"), tt("Consent", "ความยินยอม"), "1 Dec 2025", P("good", "Given")], [tt("Marketing by SMS and email", "การตลาดทาง SMS และอีเมล"), tt("Consent", "ความยินยอม"), "12 Aug 2026", P("crit", "Withdrawn")], [tt("Share data with insurance partner", "ส่งข้อมูลให้พันธมิตรประกัน"), tt("Consent", "ความยินยอม"), "—", P("", "Not given")], [tt("Service messages", "ข้อความบริการ"), tt("Contract", "สัญญา"), "1 Dec 2025", P("info", "Required")]] }, t("Consents"))}</div></section>`,
    kyc: () => card("KYC", kvHtml([[tt("Identity document", "เอกสารแสดงตน"), tt("Thai national ID 1-1020-xxxxx-xx-3", "บัตรประชาชน 1-1020-xxxxx-xx-3")], [tt("Checked with DOPA", "ตรวจกับกรมการปกครอง"), fd(Date.UTC(2025, 11, 1))], ["NDID", "IAL 2.3 · AAL 2.2"], [tt("Sanctions and PEP", "รายชื่อคว่ำบาตรและ PEP"), tt(`Clear, last screened ${fd(BIZ)}`, `ไม่พบ ตรวจล่าสุด ${fd(BIZ)}`)], [t("Risk"), tt("Medium (arrears)", "กลาง (ค้างชำระ)")], [tt("Next review", "ทบทวนครั้งถัดไป"), fd(Date.UTC(2027, 11, 1))]]) + `<p class="note" style="margin-top:14px">${esc(tt("Personal data stays in the vault. This page shows masked values; viewing the full ID is logged.", "ข้อมูลส่วนบุคคลเก็บในวอลต์ หน้านี้แสดงแบบปิดบัง การดูเลขเต็มจะถูกบันทึก"))}</p>`),
  };
  return recordPage({ title: t("Somchai Prasert"), avatar: "SP", lede: esc(tt("Retail · party C10 · customer since 1 Dec 2025 · KYC verified", "รายย่อย · รหัส C10 · ลูกค้าตั้งแต่ 1 ธ.ค. 2568 · ยืนยัน KYC แล้ว")),
    pills: P("crit", tt("Has arrears", "มียอดค้าง")) + P("warn", tt("Marketing consent withdrawn", "ถอนความยินยอมการตลาด")),
    actions: `<button class="btn" type="button" data-flow="logContact">${esc(t("Log a contact"))}</button><button class="btn primary" type="button" data-go="rec:LN-A-C10">LN-A-C10 ${icon("i-arrow")}</button>`,
    facts: [[tt("Relationship since", "เป็นลูกค้าตั้งแต่"), fd(Date.UTC(2025, 11, 1))], ["Deposits", baht(L.sav)], ["Lending", baht(L.principalOut), "", tt("1 loan", "1 สัญญา")], ["Overdue", baht(L.overdue), "crit"], ["Risk", tt("Medium", "กลาง")], ["Consents", tt("2 of 4 given", "ให้แล้ว 2 จาก 4")]],
    panels });
}

/* ---------------- floor plan line FP-DEMO ---------------- */
function viewLine() {
  const unitState = (u) => u.state === "sold" ? P("crit", tt(`Sold · payoff due ${fdShort(u.due)}`, `ขายแล้ว · ชำระคืนภายใน ${fdShort(u.due)}`)) : u.state === "aged" ? P("warn", tt("Aged · 20% curtailed", "ค้างสต็อกนาน · ลดยอด 20%")) : P("good", tt("On the floor", "อยู่ในสต็อก"));
  const panels = {
    units: () => `<section class="card"><div class="table-wrap"><table><caption class="sr">${esc(t("Vehicles"))}</caption><thead><tr>${["VIN", "Model", "Drawn", "Days on floor", "Outstanding", "State", ""].map((c) => `<th scope="col" class="${c === "Outstanding" || c === "Days on floor" ? "r" : ""}">${esc(t(c))}</th>`).join("")}</tr></thead><tbody>
      ${FP.units.map((u) => `<tr class="${u.state === "sold" ? "late" : ""}"><td><span class="rec">${u.vin}</span></td><td class="wrap">${esc(u.model)}</td><td class="num">${esc(fd(u.drawn))}</td><td class="r num">${FP.days(u)}</td><td class="r num">${baht(u.out)}</td><td>${unitState(u)}</td><td class="r"><button class="btn row-btn${u.state === "sold" ? " primary" : ""}" type="button" data-flow="fpPayoff" data-arg="${u.vin}" aria-label="${esc(tt("Pay off", "ชำระคืน"))} ${u.vin}">${esc(tt("Pay off", "ชำระคืน"))}</button></td></tr>`).join("")}
      </tbody></table></div></section>`,
    audit: () => `<div class="grid-main">${card(tt("Last stock audit", "ตรวจสต็อกครั้งล่าสุด"), kvHtml([[t("Date"), fd(Date.UTC(2026, 8, 30))], [tt("Auditor", "ผู้ตรวจ"), "Field audit team · Pongsak R."], [tt("Seen", "พบรถ"), tt("4 of 4, with photos and GPS", "4 จาก 4 พร้อมภาพและพิกัด")], [t("Result"), tt("No exceptions", "ไม่พบข้อผิดปกติ")]]))}
      ${card(tt("Next audit", "ตรวจครั้งถัดไป"), tl([[Date.UTC(2026, 9, 31), tt("Monthly stock audit", "ตรวจสต็อกประจำเดือน"), tt("Unannounced, within 3 days of this date", "ไม่แจ้งล่วงหน้า ภายใน 3 วัน"), "now"], [Date.UTC(2026, 10, 15), tt("Aged unit review", "ทบทวนรถค้างสต็อก"), "JTEBU3FJ9PK020301 · 150 days", "warn"]]))}</div>`,
    billing: () => `<section class="card"><div class="card-body flush">${table({ cols: ["Statement", "Period", "Amount", "Due", "Paid on", "State"], rows: [[R("FPI-2026-10"), "Oct 2026", baht(FP.interest), "5 Nov 2026", "—", P("info", tt("Accruing", "กำลังคำนวณ"))], [R("FPI-2026-09"), "Sep 2026", baht(17824.11), "5 Oct 2026", "5 Oct 2026", P("good", "Paid")], [R("FPI-2026-08"), "Aug 2026", baht(13560.33), "5 Sep 2026", "4 Sep 2026", P("good", "Paid")]] }, t("Interest"))}</div></section>`,
    dealer: () => card(tt("Bangna Motors · DLR-1", "บางนา มอเตอร์ส · DLR-1"), kvHtml([[t("Commission"), "2.00%"], [t("Lines"), "FP-1 · FP-DEMO"], [tt("Group limit", "วงเงินรวม"), tt("฿25,000,000.00 · 92% in use", "฿25,000,000.00 · ใช้ไป 92%")], [t("Account"), `CUR-D0007 · ${baht(FP.dealerBal)}`], [tt("Relationship manager", "ผู้ดูแลความสัมพันธ์"), "Wanida K."]])),
  };
  return recordPage({ title: "FP-DEMO", mono: true, lede: esc(tt(`Floor plan for Bangna Motors (DLR-1) · ${(FP.rate * 100).toFixed(2)}% a year on each vehicle drawn`, `วงเงินฟลอร์แพลน บางนา มอเตอร์ส (DLR-1) · ดอกเบี้ย ${(FP.rate * 100).toFixed(2)}% ต่อปีต่อคัน`)),
    pills: P("crit", tt("1 sold, payoff due", "ขายแล้ว 1 คัน รอชำระคืน")) + P("warn", tt("1 aged unit", "ค้างสต็อกนาน 1 คัน")),
    actions: `<button class="btn" type="button">${esc(tt("Draw a unit", "เบิกรถเข้าสต็อก"))}</button><button class="btn primary" type="button" data-flow="fpPayoff">${esc(tt("Pay off a unit", "ชำระคืนรายคัน"))}</button>`,
    facts: [[t("Limit"), baht(FP.limit)], [t("In use"), baht(FP.inUse), "", `${FP.pct}%`], [tt("Available", "คงเหลือ"), baht(FP.avail)], [tt("Units on the floor", "รถในสต็อก"), String(FP.units.length)], [tt("Interest this month", "ดอกเบี้ยเดือนนี้"), baht(FP.interest)], [tt("Next stock audit", "ตรวจสต็อกครั้งถัดไป"), fd(Date.UTC(2026, 9, 31))]],
    panels });
}

/* ---------------- hire purchase HP-2025-004812 ---------------- */
const hpQuote = () => `<div class="quote"><span>${esc(tt(`${HP.remaining} instalments left × ${baht(HP.inst)}`, `ค่างวดคงเหลือ ${HP.remaining} งวด × ${baht(HP.inst)}`))}</span><span class="num">${baht(HP.receivable)}</span>
  <span>${esc(tt("Unearned interest", "ดอกเบี้ยที่ยังไม่ถึงกำหนด"))}</span><span class="num">${baht(HP.unearned)}</span><span>${esc(tt(`Rebate, ${HP.tier * 100}% of unearned interest`, `ส่วนลด ${HP.tier * 100}% ของดอกเบี้ยที่ยังไม่ถึงกำหนด`))}</span><span class="num">${baht(-HP.rebate)}</span>
  <span>${esc(tt("Settlement before VAT", "ยอดปิดก่อน VAT"))}</span><span class="num">${baht(HP.settle)}</span><span>VAT 7%</span><span class="num">${baht(HP.vatSettle)}</span>
  <span class="total">${esc(t("Total to settle"))}</span><span class="total num">${baht(HP.total)}</span></div>`;
function viewHP() {
  const tone = { paid: ["good", "Paid"], next: ["info", "Due next"], scheduled: ["", "Scheduled"] };
  const panels = {
    summary: () => `<div class="grid-main">${card(t("Contract"), kvHtml([["Hirer", "Napat Srisuk"], ["Dealer", tt("Bangna Motors (DLR-1)", "บางนา มอเตอร์ส (DLR-1)")], ["Product", "CAR_HP_NEW v3"], [tt("Cash price", "ราคาเงินสด"), baht(HP.price)], [tt("Down payment", "เงินดาวน์"), baht(HP.down)], [tt("Amount financed", "ยอดจัดไฟแนนซ์"), baht(HP.fin)],
        ["Term", tt(`${HP.n} months from 5 Jan 2025`, `${HP.n} งวด เริ่ม 5 ม.ค. 2568`)], [tt("Flat rate", "ดอกเบี้ยคงที่"), tt(`${(HP.flat * 100).toFixed(2)}% a year · effective ${HP.eff.toFixed(2)}%`, `${(HP.flat * 100).toFixed(2)}% ต่อปี · อัตราที่แท้จริง ${HP.eff.toFixed(2)}%`)],
        ["Instalment", `${baht(HP.inst)} + VAT ${baht(HP.vat)} = ${baht(r2(HP.inst + HP.vat))}`], ["Rebate rule", tt("Tiered 60/70/100 of unearned interest", "ขั้นบันได 60/70/100 ของดอกเบี้ยที่ยังไม่ถึงกำหนด")]]))}
      ${card(t("What happens next"), tl([[HP.rows[HP.paid].due, tt("Instalment 23 falls due", "งวดที่ 23 ครบกำหนด"), `${baht(r2(HP.inst + HP.vat))}`, "now"], [Date.UTC(2026, 11, 5), tt("Rebate rises to 70% → stays until instalment 40", "ส่วนลด 70% ถึงงวดที่ 40"), "", ""], [Date.UTC(2027, 0, 4), tt("Insurance renewal", "ต่ออายุประกัน"), "Viriyah · Type 1", "warn"]]))}</div>`,
    schedule: () => `<section class="card"><div class="table-wrap"><table><caption class="sr">${esc(t("Schedule"))}</caption><thead><tr>${["No.", "Due", "Instalment", "Interest", "Principal", "Balance after", "State"].map((c) => `<th scope="col" class="${NUMERIC.test(c) ? "r" : ""}">${esc(t(c))}</th>`).join("")}</tr></thead><tbody>
      ${HP.rows.map((r) => `<tr class="${r.state}"><td class="num">${r.n}</td><td class="num">${esc(fd(r.due))}</td><td class="r num">${baht(r.amount)}</td><td class="r num">${baht(r.interest)}</td><td class="r num">${baht(r.principal)}</td><td class="r num">${baht(r.balance)}</td><td>${P(tone[r.state][0], tone[r.state][1])}</td></tr>`).join("")}</tbody></table></div></section>`,
    settle: () => `<div class="grid-main">${card(tt("Rebate tier", "ขั้นส่วนลด"), `<div class="tier">${[["1–20", 60], ["21–40", 70], ["41–60", 100]].map(([r, p], i) => `<div class="${HP.tier * 100 === p ? "on" : ""}"><b>${p}%</b>${esc(tt(`instalments ${r}`, `งวดที่ ${r}`))}</div>`).join("")}</div>
        <p class="note" style="margin-top:14px">${esc(tt(`${HP.paid} of ${HP.n} instalments are paid, so ${HP.tier * 100}% of the unearned interest is given back. Rule-pack values are configuration to confirm with counsel.`, `ชำระแล้ว ${HP.paid} จาก ${HP.n} งวด จึงได้ส่วนลด ${HP.tier * 100}% ของดอกเบี้ยที่ยังไม่ถึงกำหนด ค่าในชุดกฎต้องยืนยันกับที่ปรึกษากฎหมาย`))}</p>`)}
      ${card(tt("Settlement today", "ยอดปิดบัญชีวันนี้"), hpQuote(), `<button class="btn primary row-btn" type="button" data-flow="hpSettle">${esc(t("Settle early"))}</button>`)}</div>`,
    vehicle: () => `<div class="grid-main">${card(t("Vehicle"), kvHtml([[t("Vehicle"), "Toyota Hilux Revo 2.4 Z-Edition, 2024"], ["VIN", "MR0HA3CD5N0100204"], [t("Registration"), "3กข 7788 กรุงเทพมหานคร"], [tt("Title", "กรรมสิทธิ์"), tt("Held by the bank until paid off", "ธนาคารถือไว้จนชำระครบ")]]))}
      ${card(tt("Insurance", "ประกันภัย"), kvHtml([[tt("Insurer", "บริษัทประกัน"), "Viriyah · Type 1"], [tt("Sum insured", "ทุนประกัน"), baht(700000)], [tt("Expires", "หมดอายุ"), fd(Date.UTC(2027, 0, 4))], [tt("Beneficiary", "ผู้รับประโยชน์"), tt("The bank", "ธนาคาร")]]))}</div>`,
  };
  return recordPage({ title: "HP-2025-004812", mono: true, lede: esc(tt("Napat Srisuk · Toyota Hilux Revo 2.4 · flat-rate hire purchase", "นภัทร ศรีสุข · Toyota Hilux Revo 2.4 · เช่าซื้อดอกเบี้ยคงที่")), pills: P("good", "Active") + P("info", tt(`${HP.tier * 100}% rebate tier`, `ส่วนลดขั้น ${HP.tier * 100}%`)),
    actions: `<button class="btn" type="button">${esc(t("Take payment"))}</button><button class="btn primary" type="button" data-flow="hpSettle">${esc(t("Settle early"))}</button>`,
    facts: [[tt("Receivable, before VAT", "ลูกหนี้คงค้าง ก่อน VAT"), baht(HP.receivable)], [tt("Paid", "ชำระแล้ว"), `${HP.paid} / ${HP.n}`], ["Next due", baht(r2(HP.inst + HP.vat)), "", fd(HP.rows[HP.paid].due)], [tt("Flat rate", "ดอกเบี้ยคงที่"), `${(HP.flat * 100).toFixed(2)}%`, "", tt(`effective ${HP.eff.toFixed(2)}%`, `ที่แท้จริง ${HP.eff.toFixed(2)}%`)], [tt("Rebate today", "ส่วนลดวันนี้"), baht(HP.rebate)], [t("Settlement today"), baht(HP.total), "", tt("including VAT", "รวม VAT")]],
    panels });
}

/* ---------------- Master Builder template and Product Studio draft ---------------- */
function viewTemplate() {
  const blocks = [["Pricing", "Flat rate quoted, effective rate disclosed", "i-fx", "Editable within range"], ["Instalment VAT", "7% on each instalment, INTEREST or TOTAL base", "i-scale", "Locked"], ["Early settlement rebate", "Tiered 60/70/100 of unearned interest", "i-check", "Locked"],
    ["Fees", "Stamp duty, transfer, late fee", "i-cash", "Editable within range"], ["Default", "Default interest +3%, notice after 3 missed instalments", "i-alert", "Locked"], ["Insurance", "Type 1 cover required, lapse alerts", "i-shield", "Editable within range"],
    ["Collateral", "Vehicle title held until paid off", "i-truck", "Locked"], ["Accounting", "GL mapping and TFRS 9 staging", "i-layers", "Locked"], ["Disclosure", "Cost of credit in Thai and English", "i-inbox", "Editable within range"]];
  const panels = {
    blocks: () => `<section class="tiles">${blocks.map(([n, d, ic, st]) => `<div class="action-tile"><span class="tile">${icon(ic)}</span><strong>${esc(n)}</strong><small>${esc(d)}</small>${P(st === "Locked" ? "" : "info", tt(st, st === "Locked" ? "ล็อก" : "แก้ไขได้ในช่วง"))}</div>`).join("")}</section>`,
    params: () => `<section class="card"><div class="card-body flush">${table({ cols: ["Parameter", "Default", "Allowed range", "Who may change", "Source"], rows: [["Effective rate cap, used cars", "15.00%", "0–15%", "Nobody", R("TH-HP-VEHICLE-v1")], ["Effective rate cap, new cars", "10.00%", "0–10%", "Nobody", R("TH-HP-VEHICLE-v1")], ["Term", "48 months", "12–84 months", "Product maker", "Template"], ["Minimum down payment", "15%", "0–50%", "Product maker", "Template"], ["Rebate rule", "Tiered 60/70/100", "Fixed", "Nobody", R("TH-HP-VEHICLE-v1")], ["VAT base", "Instalment", "INTEREST or TOTAL", "Finance", "Template"], ["Late fee", "฿100.00", "Up to ฿100.00", "Product maker", "Template"]] }, t("Parameters"))}</div></section>`,
    rules: () => `<section class="card"><div class="card-body flush">${table({ cols: ["Rule", "Value", "Source", "State"], rows: [["Maximum effective rate, new cars", "10.00% a year", "OCPB notification 2022", P("warn", "To confirm with counsel")], ["Maximum effective rate, used cars", "15.00% a year", "OCPB notification 2022", P("warn", "To confirm with counsel")], ["Maximum effective rate, motorcycles", "23.00% a year", "OCPB notification 2022", P("warn", "To confirm with counsel")], ["Early settlement rebate", "60% / 70% / 100% by third of term", "OCPB notification 2022", P("warn", "To confirm with counsel")], ["Termination", "3 missed instalments and 30 days' notice", "Civil and Commercial Code", P("warn", "To confirm with counsel")]] }, t("Rule pack"))}</div></section>`,
    products: () => `<section class="card"><div class="card-body flush">${table({ cols: ["Product", "Version", "Contracts", "State"], rows: [[R("CAR_HP_NEW"), "v3", "4,812", P("good", "Live")], [R("AUTO_HP_USED"), "v2", "—", P("info", "In review")], [R("EV_HP_NEW"), "v1", "—", P("", "Draft")]] }, t("Products"))}</div></section>`,
  };
  return recordPage({ title: "TPL-HP-VEHICLE", mono: true, lede: esc(tt("Vehicle hire purchase template · the building blocks every HP product is made from", "แม่แบบเช่าซื้อรถยนต์ · ส่วนประกอบที่ผลิตภัณฑ์เช่าซื้อทุกตัวใช้")), pills: P("good", "Live") + P("", "v4"),
    actions: `<button class="btn" type="button">${esc(tt("New version", "เวอร์ชันใหม่"))}</button><button class="btn primary" type="button" data-go="rec:AUTO_HP_USED_v2">${icon("i-plus")}${esc(tt("Create product", "สร้างผลิตภัณฑ์"))}</button>`,
    facts: [[t("Version"), "v4", "", tt("live since 1 Jul 2026", "ใช้ตั้งแต่ 1 ก.ค. 2569")], [t("Building blocks"), "9"], [t("Products using it"), "3"], [t("Contracts"), "4,812"], [t("Rule pack"), "TH-HP-VEHICLE-v1"], [t("Owner"), tt("Product team", "ทีมผลิตภัณฑ์")]], panels });
}
function viewDraft() {
  const fin = 384000, inst = 10080, eff = effRate(fin, inst, 48) * 12 * 100;
  const panels = {
    setup: () => card(tt("Setup", "การตั้งค่า"), kvHtml([["Template", "TPL-HP-VEHICLE v4"], [t("Name"), tt("Used car hire purchase", "เช่าซื้อรถยนต์มือสอง")], [tt("Effective rate", "อัตราดอกเบี้ยที่แท้จริง"), "6.00–15.00%"], ["Term", tt("12–72 months; 72 only for cars under 5 years old", "12–72 เดือน 72 เดือนเฉพาะรถอายุไม่เกิน 5 ปี")], [tt("Minimum down payment", "เงินดาวน์ขั้นต่ำ"), "20%"], ["Rebate rule", "Tiered 60/70/100"], [tt("VAT base", "ฐาน VAT"), tt("Instalment", "ค่างวด")], [tt("Channels", "ช่องทาง"), tt("Dealers and branches", "ดีลเลอร์และสาขา")]])),
    sim: () => `${factsHtml([[t("Scenarios"), "1,200"], [t("Passed "), "1,200"], [tt("Highest effective rate", "อัตราที่แท้จริงสูงสุด"), "14.82%"], [tt("Rate cap", "เพดานอัตรา"), "15.00%"]])}<div class="grid-main">
      ${card(tt("Effective rate across scenarios", "อัตราที่แท้จริงในทุกสถานการณ์"), `<div class="bars">${[["6–8%", 12], ["8–10%", 28], ["10–12%", 31], ["12–14%", 22], ["14–15%", 7]].map(([n, p]) => `<div class="bar-row"><span>${n}</span><span class="num muted">${p}%</span><div class="bar"><span style="width:${p * 2.5}%"></span></div></div>`).join("")}</div>`)}
      ${card(tt("Sample disclosure", "ตัวอย่างการเปิดเผยข้อมูล"), `<div class="quote"><span>${esc(tt("Car price", "ราคารถ"))}</span><span class="num">${baht(480000)}</span><span>${esc(tt("Down payment 20%", "เงินดาวน์ 20%"))}</span><span class="num">${baht(96000)}</span><span>${esc(tt("Amount financed", "ยอดจัดไฟแนนซ์"))}</span><span class="num">${baht(fin)}</span><span>${esc(tt("48 instalments, flat 6.50%", "48 งวด ดอกเบี้ยคงที่ 6.50%"))}</span><span class="num">${baht(inst)} + VAT ${baht(705.6)}</span><span class="total">${esc(tt("Effective rate", "อัตราดอกเบี้ยที่แท้จริง"))}</span><span class="total num">${eff.toFixed(2)}%</span></div>`)}</div>`,
    approvals: () => card(tt("Maker and checkers", "ผู้ทำและผู้ตรวจ"), tl([[Date.UTC(2026, 9, 23), tt("Submitted by Krit S. (maker)", "ส่งโดยกฤษ ส. (ผู้ทำ)"), tt("Simulation SIM-2210 attached", "แนบผลจำลอง SIM-2210"), "done"], [Date.UTC(2026, 9, 24), tt("Approved by Wanida K. (Risk)", "อนุมัติโดยวนิดา ก. (ความเสี่ยง)"), tt("Rate distribution within appetite", "การกระจายอัตราอยู่ในกรอบ"), "done"], ["—", tt("Compliance: waiting for you", "ฝ่ายกำกับ: รอคุณ"), tt("Rate cap and disclosure checks", "ตรวจเพดานอัตราและการเปิดเผยข้อมูล"), "now"], [Date.UTC(2026, 10, 1), tt("Goes live for dealers", "เริ่มใช้กับดีลเลอร์"), tt("v1 stays for existing contracts", "สัญญาเดิมยังใช้ v1"), ""]])),
    changes: () => `<section class="card"><div class="card-body flush">${table({ cols: ["Field", "v1", "v2"], rows: [["Maximum effective rate", "18.00%", "15.00%"], ["Maximum term", "60 months", "72 months"], ["Rebate rule", "Rule of 78", "Tiered 60/70/100"], ["Minimum down payment", "25%", "20%"], ["Disclosure template", "v1, English first", "v2, Thai first"]] }, t("Changes from v1"))}</div></section>`,
  };
  return recordPage({ title: "AUTO_HP_USED v2", mono: true, lede: esc(tt("Used car hire purchase · made from TPL-HP-VEHICLE v4 · maker Krit S.", "เช่าซื้อรถยนต์มือสอง · สร้างจาก TPL-HP-VEHICLE v4 · ผู้ทำ กฤษ ส.")), pills: P("info", "In review") + P("good", tt("Simulation passed", "จำลองผ่าน")),
    actions: `<button class="btn" type="button" data-flow="requestChanges">${esc(tt("Request changes", "ขอให้แก้ไข"))}</button><button class="btn primary" type="button" data-flow="approveProduct">${icon("i-check")}${esc(tt("Approve", "อนุมัติ"))}</button>`,
    facts: [["Template", "TPL-HP-VEHICLE", "", "v4"], [tt("Rate range", "ช่วงอัตรา"), "6–15%", "", tt("effective a year", "ที่แท้จริงต่อปี")], ["Term", tt("12–72 months", "12–72 เดือน")], [t("Simulation"), "1,200 / 1,200"], [t("Approvals"), tt("1 of 2", "1 จาก 2")], [tt("Goes live", "เริ่มใช้"), fd(Date.UTC(2026, 10, 1))]], panels });
}

/* ---------------- deposit account SAV-C10 ---------------- */
function viewAccount() {
  const L = LOAN, hold = 5000, tx = [["24 Oct 2026 09:44", "PromptPay to 08x-xxx-1180", "TR-9918201", -2500], ["21 Oct 2026 12:10", "Cash deposit, Branch 0123", "TX-0123-8790", 15000], ["15 Oct 2026 08:00", "Salary · Siam Logistics Co.", "PAYROLL-1015", 28400],
    ["5 Oct 2026 18:22", "Bill payment · MEA electricity", "BP-55120", -1840.5], ["1 Oct 2026 00:00", "Interest for September", "INT-2026-09", 24.84], ["30 Sep 2026 14:02", "ATM withdrawal · Bangna", "ATM-77120", -5000],
    ["15 Sep 2026 08:00", "Salary · Siam Logistics Co.", "PAYROLL-0915", 28400], ["2 Sep 2026 09:00", "Direct debit to LN-A-C10 failed", "DD-LN-A-C10-9", 0], ["1 Sep 2026 00:00", "Interest for August", "INT-2026-08", 22.11]];
  let bal = L.sav;
  const rows = tx.map(([d, w, ref, a]) => { const r = [d, w, R(ref), a < 0 ? baht(a) : a ? "+" + baht(a) : "—", baht(bal)]; bal = r2(bal - a); return r; });
  const accrued = r2(L.sav * 0.005 / 365 * 24);
  const panels = {
    tx: () => `<section class="card"><div class="toolbar"><label class="filter">${icon("i-search")}<span class="sr">${esc(t("Filter by id, name or amount"))}</span><input data-filter placeholder="${esc(t("Filter by id, name or amount"))}"></label></div><div class="card-body flush">${table({ cols: ["When", "Description", "Reference", "Amount", "Balance"], rows }, t("Transactions"))}</div></section>`,
    holds: () => `<section class="card"><div class="card-body flush">${table({ cols: ["Hold", "Reason", "Placed", "Until", "Amount"], rows: [[R("HLD-30412"), tt("Card authorisation · Lazada", "อนุมัติบัตร · Lazada"), "23 Oct 2026", "30 Oct 2026", baht(hold)]] }, t("Holds"))}</div></section>`,
    interest: () => `<div class="grid-main">${card(tt("Interest", "ดอกเบี้ย"), kvHtml([[t("Rate"), tt("0.50% a year up to ฿1,000,000", "0.50% ต่อปี ถึง ฿1,000,000")], [tt("Accrued this month", "ค้างรับเดือนนี้"), baht(accrued)], [tt("Paid on", "จ่ายทุก"), tt("the 1st of each month", "วันที่ 1 ของทุกเดือน")], [tt("Withholding tax", "ภาษีหัก ณ ที่จ่าย"), tt("Exempt below ฿20,000 a year", "ยกเว้นเมื่อไม่เกิน ฿20,000 ต่อปี")]]))}
      ${card(tt("Daily accrual", "ดอกเบี้ยรายวัน"), `<p class="muted" style="font-size:13px">${esc(tt("Accrual runs per account all day, with no batch window: the figure above is as of now.", "คำนวณดอกเบี้ยรายบัญชีตลอดวัน ไม่ต้องรอปิดงวด ตัวเลขด้านบนเป็นค่า ณ ตอนนี้"))}</p>`)}</div>`,
    statement: () => card(tt("Statement for September 2026", "รายการเดินบัญชี กันยายน 2569"), quoteRows([[tt("Opening balance", "ยอดยกมา"), baht(20118.3)], [tt("Money in", "เงินเข้า"), baht(28422.11)], [tt("Money out", "เงินออก"), baht(-5000)], [tt("Closing balance", "ยอดยกไป"), baht(43540.41)]]) + `<p class="note" style="margin-top:14px">${esc(tt("Sent as an e-Statement on 1 Oct 2026.", "ส่งเป็น e-Statement เมื่อ 1 ต.ค. 2569"))}</p>`),
  };
  return recordPage({ title: "SAV-C10", mono: true, lede: `${esc(t("Savings Standard"))} · ${esc(t("Somchai Prasert"))} · PromptPay 08x-xxx-1180`, pills: P("good", "Active") + P("info", tt("1 hold", "อายัด 1 รายการ")),
    actions: `<button class="btn" type="button" data-flow="withdraw">${esc(tt("Withdraw", "ถอน"))}</button><button class="btn primary" type="button" data-flow="deposit">${esc(tt("Deposit", "ฝากเงิน"))}</button>`,
    facts: [[t("Balance"), baht(L.sav)], [tt("Available", "ใช้ได้"), baht(r2(L.sav - hold))], [t("Holds"), baht(hold)], [t("Rate"), "0.50%"], [tt("Accrued this month", "ค้างรับเดือนนี้"), baht(accrued)], [t("Opened"), fd(Date.UTC(2025, 11, 1))]], panels });
}

/* ---------------- import LC-26-0412 ---------------- */
function viewLC() {
  const docs = [["Commercial invoice", "3 originals", "Complies"], ["Packing list", "3 copies", "Complies"], ["Bill of lading", "Full set 3/3, clean on board", "Complies"], ["Certificate of origin", "Form JTEPA", "Complies"],
    ["Insurance certificate", "110% CIF", "Discrepant"], ["Inspection certificate", "Issued by SGS", "Complies"], ["Beneficiary certificate", "1 original", "Complies"]];
  const panels = {
    summary: () => `<div class="grid-main">${card(t("Contract"), kvHtml([[t("Applicant"), t("Siam Freight Logistics")], [t("Beneficiary"), "Hino Motors Ltd. (JP)"], [tt("Advising bank", "ธนาคารผู้แจ้ง"), "MUFG Bank, Tokyo"], [t("Amount"), "$2,400,000.00 ± 5%"], [tt("Goods", "สินค้า"), tt("12 Hino 500 trucks, CIF Laem Chabang", "รถบรรทุก Hino 500 จำนวน 12 คัน CIF แหลมฉบัง")], [t("Expiry"), fd(Date.UTC(2026, 11, 30))], [tt("Margin held", "เงินประกัน"), "฿8,640,000.00 · 10%"]]))}
      ${card(t("What happens next"), tl([[Date.UTC(2026, 9, 22), tt("Documents presented", "ยื่นเอกสาร"), tt("7 documents, 1 discrepancy", "7 รายการ ไม่ตรง 1"), "done"], [BIZ, tt("Ask the applicant to waive the discrepancy", "ขอให้ผู้ขอเปิดยอมรับความไม่ตรง"), "", "now"], [Date.UTC(2026, 9, 29), tt("Examination deadline, 5 banking days", "ครบกำหนดตรวจ 5 วันทำการ"), "UCP 600 art. 14", "warn"]]))}</div>`,
    docs: () => `<section class="card"><div class="card-body flush">${table({ cols: ["Document", "Required", "State"], rows: docs.map(([d, r, s]) => [d, r, P(s === "Complies" ? "good" : "crit", s)]) }, t("Documents"))}</div></section>
      ${notice("crit", tt("Insurance certificate covers 100% of CIF, the LC asks for 110%", "ใบรับรองประกันคุ้มครอง 100% ของ CIF แต่ LC กำหนด 110%"), tt("Refuse, or ask Siam Freight to waive it. Either way the bank must answer by 29 Oct.", "ปฏิเสธ หรือขอให้สยามเฟรทยอมรับ ต้องตอบภายใน 29 ต.ค."))}`,
    amend: () => `<section class="card"><div class="card-body flush">${table({ cols: ["Amendment", "Change", "Requested", "State"], rows: [[R("AMD-1"), tt("Latest shipment 15 Nov → 30 Nov 2026", "ส่งสินค้าล่าสุด 15 พ.ย. → 30 พ.ย. 2569"), "10 Oct 2026", P("good", tt("Accepted by beneficiary", "ผู้รับประโยชน์ยอมรับ"))]] }, t("Amendments"))}</div></section>`,
    charges: () => `<section class="card"><div class="card-body flush">${table({ cols: ["Charge", "Paid by", "Amount", "State"], rows: [["Issuance 0.125%", t("Siam Freight Logistics"), baht(103680), P("good", "Paid")], ["Amendment", t("Siam Freight Logistics"), baht(1500), P("good", "Paid")], ["Discrepancy fee", "Hino Motors Ltd.", "$80.00", P("info", "Scheduled")]] }, t("Charges"))}</div></section>`,
  };
  return recordPage({ title: "LC-26-0412", mono: true, lede: esc(tt("Siam Freight Logistics → Hino Motors (JP) · sight LC under UCP 600", "สยามเฟรท โลจิสติกส์ → Hino Motors (JP) · LC ชนิดชำระเมื่อเห็น ตาม UCP 600")), pills: P("good", "Issued") + P("crit", tt("1 discrepancy", "เอกสารไม่ตรง 1")),
    actions: `<button class="btn" type="button">${esc(tt("Refuse documents", "ปฏิเสธเอกสาร"))}</button><button class="btn primary" type="button" data-flow="lcWaiver">${esc(tt("Ask for a waiver", "ขอให้ยอมรับ"))}</button>`,
    facts: [[t("Amount"), "$2,400,000.00"], [tt("THB equivalent", "เทียบเท่าบาท"), baht(86400000, 0), "", "@ 36.00"], [t("Expiry"), fd(Date.UTC(2026, 11, 30))], [t("Documents"), tt("6 of 7 comply", "ตรง 6 จาก 7"), "crit"], [tt("Answer by", "ตอบภายใน"), fd(Date.UTC(2026, 9, 29))], [tt("Margin", "เงินประกัน"), "10%"]], panels });
}

/* ---------------- onboarding ONB-7731: one step at a time ---------------- */
function viewOnboarding() {
  const def = RECS["ONB-7731"], steps = def.tabs, i = Math.max(0, steps.findIndex(([k]) => k === current.tab)), done = (k) => steps.findIndex(([x]) => x === k) < i;
  const content = {
    id: [tt("Card read at counter 3", "อ่านบัตรที่ช่อง 3"), kvHtml([[t("Name"), "Napat Srisuk · นภัทร ศรีสุข"], [tt("Card number", "เลขบัตร"), "3-1012-xxxxx-xx-8"], [tt("Date of birth", "วันเกิด"), fd(Date.UTC(1991, 3, 14))], [tt("Card expires", "บัตรหมดอายุ"), fd(Date.UTC(2029, 3, 13))]])],
    dopa: [tt("DOPA confirms the card is valid", "กรมการปกครองยืนยันบัตรใช้ได้"), notice("good", tt("Card active, laser code matches", "บัตรใช้งานได้ รหัสหลังบัตรตรงกัน"), tt("Checked 09:31, response 410 ms", "ตรวจ 09:31 ใช้เวลา 410 ms"))],
    ndid: [tt("Identity proofed with NDID", "พิสูจน์ตัวตนผ่าน NDID"), kvHtml([[tt("Identity provider", "ผู้ให้บริการยืนยันตัวตน"), "Krungthai NEXT"], ["IAL / AAL", "2.3 / 2.2"], [t("Result"), tt("Accepted", "ผ่าน")]])],
    face: [tt("Face matches the card photo", "ใบหน้าตรงกับรูปบนบัตร"), `${factsHtml([[tt("Match score", "คะแนนความเหมือน"), "97.4%", "", tt("threshold 90%", "เกณฑ์ 90%")], [tt("Liveness", "การตรวจมีชีวิต"), tt("Passed", "ผ่าน")], [tt("Attempts", "จำนวนครั้ง"), "1"]])}`],
    screen: [tt("No sanctions or PEP match", "ไม่พบในรายชื่อคว่ำบาตรหรือ PEP"), notice("good", tt("Screened against UN, OFAC, EU and the AMLO lists", "ตรวจกับรายชื่อ UN, OFAC, EU และ ปปง."), tt("1 near match on name was cleared: different date of birth.", "พบชื่อใกล้เคียง 1 รายการ ตรวจแล้ววันเกิดไม่ตรง"))],
    consent: [tt("Consents, explained in Thai", "ความยินยอม อธิบายเป็นภาษาไทย"), `<div>${[[tt("Credit bureau check (NCB)", "ตรวจเครดิตบูโร (NCB)"), true], [tt("Marketing by SMS and email", "การตลาดทาง SMS และอีเมล"), false], [tt("Share data with insurance partner", "ส่งข้อมูลให้พันธมิตรประกัน"), false]].map(([n, on]) => `<label class="switch"><span>${esc(n)}</span><input type="checkbox" ${on ? "checked" : ""}></label>`).join("")}</div>`],
    open: [tt("Open the account", "เปิดบัญชี"), kvHtml([["Product", "Savings Standard"], [tt("Account number", "เลขบัญชี"), tt("Assigned on opening", "ได้รับเมื่อเปิดบัญชี")], ["PromptPay", tt("Link mobile 08x-xxx-7731", "ผูกเบอร์ 08x-xxx-7731")], [tt("Passbook", "สมุดบัญชี"), tt("Printed at the counter", "พิมพ์ที่เคาน์เตอร์")]])],
  };
  const [title, body] = content[steps[i][0]];
  return `<button class="back" type="button" data-go="customers/onboarding">${icon("i-back")}${esc(t("Onboarding"))}</button>
    <div class="head"><div>${eyebrow(sysById.customers, "ONB-7731")}<h1 class="title">${esc(tt("New customer: Napat Srisuk", "ลูกค้าใหม่: นภัทร ศรีสุข"))}</h1><p class="lede">${esc(tt("Branch 0123 · each step saves as you go, so the customer can finish in the app.", "สาขา 0123 · บันทึกทุกขั้นตอน ลูกค้าทำต่อในแอปได้"))}</p></div></div>
    <div class="steps" style="padding:0;border:0" aria-label="${esc(tt("Steps", "ขั้นตอน"))}">${steps.map(([k, l], n) => `<button class="step ${n === i ? "on" : n < i ? "done" : ""}" type="button" data-tab="${k}" style="border:0;background:transparent;padding:0" ${n === i ? 'aria-current="step"' : ""}><b>${n < i ? "✓" : n + 1}</b>${esc(t(l))}</button>`).join("")}</div>
    ${card(title, body)}
    <div class="actions" style="justify-content:flex-end">${i > 0 ? `<button class="btn" type="button" data-tab="${steps[i - 1][0]}">${esc(t("Back"))}</button>` : ""}${i < steps.length - 1 ? `<button class="btn primary" type="button" data-tab="${steps[i + 1][0]}">${esc(t("Next"))}</button>` : `<button class="btn primary" type="button" data-flow="openAccount">${esc(tt("Open the account", "เปิดบัญชี"))}</button>`}</div>`;
}

/* ---------------- GL 1300: from a figure to its postings and source records ---------------- */
const JOURNALS = [["JE-2026-10-24-883104", "24 Oct 2026 09:44", "Loan payment received", "LN-A-C13", [["2100 Savings deposits", 10450.0, 0], ["1310 Instalments receivable", 0, 10450.0]]],
  ["JE-2026-10-24-882911", "24 Oct 2026 08:12", "Disbursement", "MS-4", [["1300 Loans receivable", 45279.48, 0], ["2100 Current accounts · dealer", 0, 45279.48]]],
  ["JE-2026-10-02-410022", "2 Oct 2026 00:00", "Instalment 10 billed", "LN-A-C10", [["1310 Instalments receivable", LOAN.rows[9].amount, 0], ["1300 Loans receivable", 0, LOAN.rows[9].principal], ["4100 Interest income", 0, LOAN.rows[9].interest]]],
  ["JE-2026-10-01-000417", "1 Oct 2026 00:00", "Month-end loss allowance", "ECL-RUN-09", [["5300 Expected credit loss expense", 18611200, 0], ["1390 Loss allowance on loans", 0, 18611200]]],
  ["JE-2026-09-30-771020", "30 Sep 2026 16:40", "Restructuring modification loss", "TL-2024-000311", [["5310 Modification loss", 18412.2, 0], ["1300 Loans receivable", 0, 18412.2]]],
  ["JE-2026-09-02-409881", "2 Sep 2026 00:00", "Instalment 9 billed", "LN-A-C10", [["1310 Instalments receivable", LOAN.rows[8].amount, 0], ["1300 Loans receivable", 0, LOAN.rows[8].principal], ["4100 Interest income", 0, LOAN.rows[8].interest]]]];
function viewGL() {
  const panels = {
    balance: () => `<div class="grid-main">${card(tt("By product", "ตามผลิตภัณฑ์"), `<div class="bars">${[["Personal loans", 38, "฿12.06bn"], ["Home loans", 31, "฿9.84bn"], ["SME term loans", 22, "฿6.98bn"], ["Overdrafts", 9, "฿2.86bn"]].map(([n, p, v]) => `<div class="bar-row"><span>${esc(t(n))}</span><span class="num muted">${v}</span><div class="bar"><span style="width:${p}%"></span></div></div>`).join("")}</div>`)}
      ${card(tt("How to read it", "วิธีอ่าน"), `<p class="muted" style="font-size:13px">${esc(tt("Every figure opens its journals, every journal its postings, every posting the record that caused it. Nothing is summarised away.", "ทุกตัวเลขเปิดดูรายการบัญชีได้ ทุกรายการเปิดดูรายการย่อยและต้นทางได้ ไม่มีการสรุปจนตรวจย้อนไม่ได้"))}</p>`)}</div>`,
    journals: () => `<section class="card"><div class="table-wrap"><table><caption class="sr">${esc(t("Journals"))}</caption><thead><tr>${["Journal", "When", "What", "Source", "Amount"].map((c) => `<th scope="col" class="${c === "Amount" ? "r" : ""}">${esc(t(c))}</th>`).join("")}</tr></thead><tbody>
      ${JOURNALS.map(([id, w, what, src, lines], i) => `<tr class="click" tabindex="0" data-journal="${i}"><td><span class="rec link">${id}</span></td><td class="num">${esc(loc(w))}</td><td>${esc(what)}</td><td><span class="rec">${src}</span></td><td class="r num">${baht(lines.reduce((s, l) => s + l[1], 0))}</td></tr>`).join("")}</tbody></table></div></section>`,
    recon: () => card(tt("Sub-ledger against GL", "บัญชีย่อยเทียบ GL"), quoteRows([[tt("Loan sub-ledger", "บัญชีย่อยสินเชื่อ"), baht(31744120000, 0)], [tt("GL 1300", "GL 1300"), baht(31744120000, 0)], [t("Difference"), baht(0)]]) + `<p class="note" style="margin-top:14px">${esc(tt("Reconciled at 06:00 and on every posting since.", "กระทบยอดเมื่อ 06:00 และทุกครั้งที่มีการบันทึกหลังจากนั้น"))}</p>`),
  };
  return recordPage({ title: "GL 1300 · " + tt("Loans receivable", "ลูกหนี้เงินให้กู้"), lede: esc(tt("Asset · balance from the immutable ledger, live", "สินทรัพย์ · ยอดจากบัญชีแยกประเภทที่แก้ไขไม่ได้ แบบเรียลไทม์")), pills: P("good", tt("Matches sub-ledger", "ตรงกับบัญชีย่อย")),
    facts: [[t("Balance"), "฿31.74bn"], [tt("Today's postings", "รายการวันนี้"), "48,211"], [tt("Debits today", "เดบิตวันนี้"), "฿612.4m"], [tt("Credits today", "เครดิตวันนี้"), "฿590.1m"], [t("Difference"), baht(0), "", tt("against sub-ledger", "เทียบบัญชีย่อย")]], panels });
}
function openJournal(i) {
  const [id, w, what, src, lines] = JOURNALS[i], dr = lines.reduce((s, l) => s + l[1], 0), cr = lines.reduce((s, l) => s + l[2], 0), rec = RECS[src] ? src : null;
  $("#drawerHost").innerHTML = `<div class="overlay" style="padding:0" data-close></div><aside class="drawer" role="dialog" aria-modal="true" aria-label="${id}">
    <div class="drawer-head"><span class="tile">${icon("i-scale")}</span><div style="min-width:0"><div class="eyebrow" style="margin-bottom:2px">${esc(what)}</div><h2 style="font-family:var(--font-data);font-size:17px;overflow-wrap:anywhere">${id}</h2></div><button class="icon-btn" type="button" data-close aria-label="${esc(t("Close"))}" style="margin-left:auto">${icon("i-close")}</button></div>
    <div class="drawer-body"><div class="table-wrap"><table><thead><tr><th scope="col">${esc(t("Account"))}</th><th scope="col" class="r">${esc(t("Debit"))}</th><th scope="col" class="r">${esc(t("Credit"))}</th></tr></thead><tbody>${lines.map(([a, d, c]) => `<tr><td style="white-space:normal">${esc(a)}</td><td class="r num">${d ? baht(d) : ""}</td><td class="r num">${c ? baht(c) : ""}</td></tr>`).join("")}
      <tr><td><b>${esc(tt("Total", "รวม"))}</b></td><td class="r num"><b>${baht(dr)}</b></td><td class="r num"><b>${baht(cr)}</b></td></tr></tbody></table></div>
      ${notice(Math.abs(dr - cr) < 0.005 ? "good" : "crit", tt("Balanced: debits equal credits", "สมดุล: เดบิตเท่ากับเครดิต"), `${esc(loc(w))} · ${tt("posted once, never edited; a correction is a new journal", "บันทึกครั้งเดียว แก้ไขไม่ได้ การแก้ไขคือรายการใหม่")}`)}</div>
    <div class="drawer-foot"><button class="btn" type="button" data-close>${esc(t("Close"))}</button>${rec ? `<button class="btn primary" type="button" data-rec="${rec}">${esc(tt("Source", "ต้นทาง"))}: ${src} ${icon("i-arrow")}</button>` : `<span class="muted" style="font-size:12.5px;align-self:center">${esc(tt("Source", "ต้นทาง"))}: ${src}</span>`}</div></aside>`;
  $("#drawerHost .icon-btn[data-close]")?.focus();
}

/* ---------------- finance lease F2 (TFRS 16, lessor) ---------------- */
const LEASE = (() => {
  const rent = 12000, r = 0.07 / 12, n = 36, start = Date.UTC(2024, 10, 1), rows = [];
  let ni = r2(rent * (1 - Math.pow(1 + r, -n)) / r);
  const cost = ni;
  for (let i = 1; i <= n; i++) { const inc = r2(ni * r), prin = i === n ? ni : r2(rent - inc); ni = r2(ni - prin); rows.push({ n: i, due: Date.UTC(2024, 10 + i, 1), income: inc, principal: prin, balance: Math.max(0, ni) }); }
  const paid = 21, overdue = 2, nowIdx = paid + overdue; // instalments 22 and 23 are unpaid
  return { rent, n, start, cost, rows, paid, overdue, ni: r2(rows[paid - 1].balance), due: rent * overdue, nextDue: rows[nowIdx].due };
})();
function viewLease() {
  const L = LEASE, st = (r) => r.n <= L.paid ? P("good", "Paid") : r.n <= L.paid + L.overdue ? P("crit", tt(`Late · ${Math.round((BIZ - r.due) / 864e5)} days`, `ค้าง ${Math.round((BIZ - r.due) / 864e5)} วัน`)) : P("", "Scheduled");
  const show = L.rows.slice(L.paid - 4, L.paid + 8);
  const panels = {
    summary: () => `<div class="grid-main">${card(t("Contract"), kvHtml([["Lessee", t("Malee Wongsa")], [t("Kind"), tt("Finance lease, lessor accounting under TFRS 16", "สัญญาเช่าการเงิน บัญชีผู้ให้เช่าตาม TFRS 16")], [t("Term"), tt(`${L.n} months from ${fd(L.start)}`, `${L.n} เดือน เริ่ม ${fd(L.start)}`)], [tt("Rent", "ค่าเช่า"), tt(`${baht(L.rent)} a month in advance, VAT on top`, `${baht(L.rent)} ต่อเดือนล่วงหน้า บวก VAT`)], [tt("Rate implicit in the lease", "อัตราดอกเบี้ยตามนัยของสัญญา"), "7.00%"], [tt("At the end", "เมื่อสิ้นสุด"), tt("Option to buy for ฿1,000.00", "สิทธิซื้อในราคา ฿1,000.00")]]))}
      ${card(t("What happens next"), tl([[BIZ, tt("Two rents unpaid · reminder sent", "ค้างค่าเช่า 2 งวด · ส่งแจ้งเตือนแล้ว"), "", "now"], [L.nextDue, tt("Next rent falls due", "ค่าเช่างวดถัดไปครบกำหนด"), baht(L.rent), ""], [Date.UTC(2026, 11, 1), tt("Three rents unpaid: the lease can be terminated", "ค้าง 3 งวด: บอกเลิกสัญญาได้"), "", "warn"]]))}</div>`,
    schedule: () => `<section class="card"><div class="table-wrap"><table><caption class="sr">${esc(t("Schedule"))}</caption><thead><tr>${["No.", "Due", tt("Rent", "ค่าเช่า"), tt("Finance income", "รายได้ทางการเงิน"), tt("Reduces investment", "ลดเงินลงทุน"), tt("Net investment after", "เงินลงทุนสุทธิหลังงวด"), "State"].map((c, i) => `<th scope="col" class="${i >= 2 && i <= 5 ? "r" : ""}">${esc(t(c))}</th>`).join("")}</tr></thead><tbody>
      ${show.map((r) => `<tr class="${r.n > L.paid && r.n <= L.paid + L.overdue ? "late" : r.n <= L.paid ? "paid" : ""}"><td class="num">${r.n}</td><td class="num">${esc(fd(r.due))}</td><td class="r num">${baht(L.rent)}</td><td class="r num">${baht(r.income)}</td><td class="r num">${baht(r.principal)}</td><td class="r num">${baht(r.balance)}</td><td>${st(r)}</td></tr>`).join("")}</tbody></table></div></section>`,
    accounting: () => card(tt("Lessor accounting", "การบัญชีผู้ให้เช่า"), quoteRows([[tt("Lease receivable at start", "ลูกหนี้ตามสัญญาเช่าเมื่อเริ่ม"), baht(L.cost)], [tt("Rents received so far", "ค่าเช่าที่ได้รับแล้ว"), baht(L.rent * L.paid)], [tt("Finance income recognised", "รายได้ทางการเงินที่รับรู้แล้ว"), baht(r2(L.rows.slice(0, L.paid).reduce((s, x) => s + x.income, 0)))], [tt("Net investment now", "เงินลงทุนสุทธิปัจจุบัน"), baht(L.ni)]]) + `<p class="note" style="margin-top:14px">${esc(tt("Finance income accrues daily on the net investment. Unpaid rents stay on the receivable and age into collections.", "รายได้ทางการเงินคำนวณรายวันจากเงินลงทุนสุทธิ ค่าเช่าค้างยังอยู่ในลูกหนี้และนับอายุเข้าสู่การติดตามหนี้"))}</p>`),
    asset: () => card(t("Asset"), kvHtml([[t("Vehicle"), "Isuzu D-Max Spark 1.9, 2024"], [t("Registration"), "1ฒษ 2045 กรุงเทพมหานคร"], [tt("Title", "กรรมสิทธิ์"), tt("Owned by the bank until the purchase option is used", "ธนาคารเป็นเจ้าของจนกว่าจะใช้สิทธิซื้อ")], [tt("Insurance", "ประกันภัย"), "Viriyah · Type 1 · 12 Jan 2027"]])),
  };
  return recordPage({ title: "F2", mono: true, lede: esc(tt("Malee Wongsa · Isuzu D-Max Spark · finance lease", "มาลี วงศ์ษา · Isuzu D-Max Spark · สัญญาเช่าการเงิน")), pills: P("warn", "Arrears") + P("", "TFRS 16"),
    actions: `<button class="btn" type="button" data-flow="logContact">${esc(t("Log a contact"))}</button><button class="btn primary" type="button">${esc(tt("Collect rent", "รับค่าเช่า"))}</button>`,
    facts: [[t("Net investment"), baht(L.ni)], [t("Due now"), baht(L.due), "crit", tt("2 rents", "2 งวด")], [tt("Rent", "ค่าเช่า"), baht(L.rent), "", tt("a month", "ต่อเดือน")], [tt("Rents paid", "ชำระแล้ว"), `${L.paid} / ${L.n}`], [tt("Rate", "อัตรา"), "7.00%"], [t("Next due"), fd(L.nextDue)]], panels });
}

/* ---------------- fleet master agreement MA-1 ---------------- */
function viewFleet() {
  const panels = {
    schedules: () => `<section class="card"><div class="card-body flush">${table({ cols: ["Schedule", "Vehicles", "Outstanding", "Rate", "Ends", "State"], rows: [[R("MS-1"), "2 × Hino 500 FG", baht(67219.5), "5.25%", "Aug 2028", P("good", "Active")], [R("MS-4"), "1 × Isuzu FRR 210", baht(45279.48), "5.25%", "Oct 2029", P("good", "Active")]] }, t("Schedules"))}</div></section>`,
    invoices: () => `<section class="card"><div class="card-body flush">${table({ cols: ["Invoice", "Period", "Amount", "Due", "Paid on", "State"], rows: [[R("FLT-INV-2026-10"), "Oct 2026", baht(49652.35), "24 Oct 2026", "24 Oct 2026", P("good", "Paid")], [R("FLT-INV-2026-09"), "Sep 2026", baht(48120.1), "24 Sep 2026", "23 Sep 2026", P("good", "Paid")], [R("FLT-INV-2026-11"), "Nov 2026", baht(49652.35), "24 Nov 2026", "—", P("info", "Scheduled")]] }, t("Invoices"))}</div></section>`,
    covenants: () => `<section class="card"><div class="card-body flush">${table({ cols: ["Covenant", "Limit", "Latest", "Tested", "State"], rows: [["Debt / EBITDA", "≤ 3.5x", "3.1x", "18 Oct 2026", P("good", tt("Met", "ผ่าน"))], [tt("Cross-default with other facilities", "ผิดนัดข้ามสัญญา"), tt("None", "ไม่มี"), tt("Cured 24 Oct", "แก้ไขแล้ว 24 ต.ค."), "24 Oct 2026", P("good", tt("Met", "ผ่าน"))]] }, t("Covenants"))}</div></section>`,
  };
  return recordPage({ title: "MA-1", mono: true, lede: esc(tt("Siam Freight Logistics · one agreement, one invoice, many vehicles", "สยามเฟรท โลจิสติกส์ · สัญญาเดียว ใบแจ้งหนี้เดียว รถหลายคัน")), pills: P("good", "Active"),
    actions: `<button class="btn" type="button">${esc(tt("New call-off", "เบิกตารางใหม่"))}</button><button class="btn primary" type="button" data-go="customers/c360">${esc(t("Customer 360"))} ${icon("i-arrow")}</button>`,
    facts: [[t("Limit"), baht(500000)], [t("In use"), baht(112498.98), "", "22%"], [t("Schedules"), "2"], [tt("Vehicles", "รถ"), "3"], [tt("Monthly invoice", "ใบแจ้งหนี้รายเดือน"), baht(49652.35)], [t("Next due"), fd(Date.UTC(2026, 10, 24))]], panels });
}

/* ---------------- dealer DLR-1 ---------------- */
function viewDealer() {
  const panels = {
    lines: () => `<section class="card"><div class="card-body flush">${table({ cols: ["Line", "Limit", "In use", "Due now", "State"], rows: [[R("FP-DEMO"), baht(FP.limit), FP.pct + "%", baht(FP.interest), P("warn", "Payoff due")], [R("FP-1"), baht(18200000), "3%", baht(2086.03), P("good", "Active")]] }, t("Lines"))}</div></section>`,
    performance: () => `${factsHtml([[tt("Contracts this year", "สัญญาปีนี้"), "412"], [tt("Financed this year", "ยอดจัดปีนี้"), "฿318.4m"], [tt("Early default rate", "อัตราผิดนัดช่วงแรก"), "0.9%", "", tt("first 6 months", "6 เดือนแรก")], [tt("Commission paid", "ค่าคอมมิชชันที่จ่าย"), "฿6.37m"]])}${card(tt("Contracts per month", "สัญญาต่อเดือน"), `<div class="bars">${[["May", 31], ["Jun", 36], ["Jul", 42], ["Aug", 39], ["Sep", 47], ["Oct", 44]].map(([m, v]) => `<div class="bar-row"><span>${esc(loc(m + " 2026"))}</span><span class="num muted">${v}</span><div class="bar"><span style="width:${v * 2}%"></span></div></div>`).join("")}</div>`)}`,
    agreement: () => card(tt("Dealer agreement", "สัญญาดีลเลอร์"), kvHtml([[t("Commission"), tt("2.00% of amount financed, paid monthly", "2.00% ของยอดจัด จ่ายรายเดือน")], [tt("Recourse", "การรับผิด"), tt("Buy-back of repossessed units within 90 days", "ซื้อคืนรถที่ถูกยึดภายใน 90 วัน")], [tt("Signed", "ลงนาม"), fd(Date.UTC(2025, 5, 3))], [tt("KYC", "KYC"), tt("Verified · next review 3 Jun 2027", "ยืนยันแล้ว · ทบทวนครั้งถัดไป 3 มิ.ย. 2570")]])),
  };
  return recordPage({ title: t("Bangna Motors"), lede: esc(tt("Toyota dealer · Bangna, Bangkok · DLR-1", "ดีลเลอร์โตโยต้า · บางนา กรุงเทพฯ · DLR-1")), pills: P("good", "Active") + P("warn", tt("92% of group limit", "ใช้ 92% ของวงเงินรวม")),
    actions: `<button class="btn primary" type="button" data-go="rec:FP-DEMO">FP-DEMO ${icon("i-arrow")}</button>`,
    facts: [[tt("Group limit", "วงเงินรวม"), baht(25000000, 0)], [t("In use"), "92%", "crit"], [t("Lines"), "2"], [t("Commission"), "2.00%"], [tt("Paid this month", "จ่ายเดือนนี้"), baht(9690000, 0)], [tt("Relationship manager", "ผู้ดูแลความสัมพันธ์"), "Wanida K."]], panels });
}

/* ---------------- term deposit TD-88140 ---------------- */
function viewTD() {
  const P0 = 120000000, rate = 0.0245, start = Date.UTC(2026, 3, 29), end = Date.UTC(2026, 9, 29), days = Math.round((end - start) / 864e5), gross = r2(P0 * rate * days / 365), wht = r2(gross * 0.01), accrued = r2(P0 * rate * Math.round((BIZ - start) / 864e5) / 365);
  const panels = {
    summary: () => `<div class="grid-main">${card(t("Contract"), kvHtml([[t("Customer"), "Siam Energy PCL"], [t("Principal"), baht(P0)], [t("Rate"), tt("2.45% a year, fixed", "2.45% ต่อปี คงที่")], [t("Term"), tt(`6 months, ${fd(start)} to ${fd(end)}`, `6 เดือน ${fd(start)} ถึง ${fd(end)}`)], [t("At maturity"), tt("Pay principal and interest to CUR-SE01", "โอนเงินต้นและดอกเบี้ยเข้า CUR-SE01")], [tt("Early withdrawal", "ถอนก่อนกำหนด"), tt("Allowed; interest at the savings rate", "ทำได้ ได้ดอกเบี้ยอัตราออมทรัพย์")]]))}
      ${card(t("What happens next"), tl([[end, tt("Matures", "ครบกำหนด"), baht(r2(P0 + gross - wht)), "now"], [end, tt("Treasury told: ฿120m leaves term funding", "แจ้งฝ่ายบริหารเงิน: เงินฝากประจำ ฿120 ล้าน ออกจากระบบ"), "", "warn"]]))}</div>`,
    interest: () => card(tt("Interest", "ดอกเบี้ย"), quoteRows([[tt("Accrued to today", "ค้างรับถึงวันนี้"), baht(accrued)], [tt(`Gross interest for ${days} days`, `ดอกเบี้ยรวม ${days} วัน`), baht(gross)], [tt("Withholding tax 1% (company)", "ภาษีหัก ณ ที่จ่าย 1% (นิติบุคคล)"), baht(-wht)], [tt("Paid at maturity", "จ่ายเมื่อครบกำหนด"), baht(r2(gross - wht))]])),
  };
  return recordPage({ title: "TD-88140", mono: true, lede: esc(tt("Siam Energy PCL · 6-month fixed deposit", "สยามเอนเนอร์ยี · เงินฝากประจำ 6 เดือน")), pills: P("good", "Active") + P("info", tt("Matures in 5 days", "ครบกำหนดใน 5 วัน")),
    actions: `<button class="btn primary" type="button" data-flow="tdInstruction">${esc(tt("Change maturity instruction", "เปลี่ยนคำสั่งเมื่อครบกำหนด"))}</button>`,
    facts: [[t("Principal"), baht(P0, 0)], [t("Rate"), "2.45%"], [t("Matures"), fd(end)], [tt("Accrued", "ค้างรับ"), baht(accrued)], [tt("Net interest", "ดอกเบี้ยสุทธิ"), baht(r2(gross - wht))], [t("At maturity"), tt("Pay to current", "โอนเข้ากระแสรายวัน")]], panels });
}

/* ---------------- bank guarantee BG-26-1102 ---------------- */
function viewBG() {
  const panels = {
    summary: () => card(t("Contract"), kvHtml([[t("Applicant"), t("Siam Freight Logistics")], [t("Beneficiary"), "Port Authority of Thailand"], [t("Amount"), baht(12000000)], [tt("Purpose", "วัตถุประสงค์"), tt("Performance guarantee for berth lease B-4, Laem Chabang", "ค้ำประกันการปฏิบัติตามสัญญาเช่าท่าเรือ B-4 แหลมฉบัง")], [t("Expiry"), fd(Date.UTC(2027, 11, 31))], [tt("Form", "รูปแบบ"), tt("On demand, beneficiary's wording", "ชำระเมื่อเรียกร้อง ตามแบบของผู้รับประโยชน์")]])),
    security: () => card(tt("Security", "หลักประกัน"), kvHtml([[tt("Cash margin", "เงินประกัน"), tt("฿1,200,000.00 held in CUR-B2031 (10%)", "฿1,200,000.00 กันไว้ใน CUR-B2031 (10%)")], [tt("Counter-indemnity", "หนังสือรับสภาพหนี้"), tt("Signed 2 Jan 2026", "ลงนาม 2 ม.ค. 2569")], [tt("Facility", "วงเงิน"), tt("Within group limit ฿250.0m", "อยู่ในวงเงินรวม ฿250.0m")]])),
    claims: () => `<section class="card"><div class="card-body"><div class="state"><span class="sev good">${icon("i-check")}</span><strong>${esc(tt("No claims", "ไม่มีการเรียกร้อง"))}</strong><p>${esc(tt("A claim would open here with the demand, the documents and a 5-day clock to pay or refuse.", "หากมีการเรียกร้องจะแสดงที่นี่ พร้อมหนังสือ เอกสาร และกำหนด 5 วันในการจ่ายหรือปฏิเสธ"))}</p></div></div></section>`,
    charges: () => `<section class="card"><div class="card-body flush">${table({ cols: ["Charge", "Paid by", "Amount", "State"], rows: [["Issuance 1.5% a year", t("Siam Freight Logistics"), baht(180000), P("good", "Paid")], ["Stamp duty", t("Siam Freight Logistics"), baht(10), P("good", "Paid")]] }, t("Charges"))}</div></section>`,
  };
  return recordPage({ title: "BG-26-1102", mono: true, lede: esc(tt("Siam Freight Logistics → Port Authority of Thailand · performance guarantee", "สยามเฟรท โลจิสติกส์ → การท่าเรือแห่งประเทศไทย · หนังสือค้ำประกันการปฏิบัติตามสัญญา")), pills: P("good", "Issued"),
    actions: `<button class="btn" type="button">${esc(tt("Amend", "แก้ไข"))}</button><button class="btn primary" type="button">${esc(tt("Record a claim", "บันทึกการเรียกร้อง"))}</button>`,
    facts: [[t("Amount"), baht(12000000, 0)], [t("Expiry"), fd(Date.UTC(2027, 11, 31))], [tt("Margin", "เงินประกัน"), "10%"], [tt("Claims", "การเรียกร้อง"), "0"], [tt("Fee", "ค่าธรรมเนียม"), "1.5%", "", tt("a year", "ต่อปี")]], panels });
}

/* ---------------- reports and analytics ---------------- */
const VINT_COLORS = ["var(--accent)", "var(--good)", "var(--warn)", "var(--crit)", "var(--faint)"];
function viewAnalytics(sec) {
  const s = sysById.analytics, head = (title, lede) => `<div class="head"><div>${eyebrow(s)}<h1 class="title">${esc(title)}</h1><p class="lede">${esc(lede)}</p></div><div class="actions"><button class="btn" type="button">${icon("i-arrow")}${esc(t("Export"))}</button><button class="btn primary" type="button" data-go="analytics/scheduled">${esc(tt("Schedule this", "ตั้งเวลาส่ง"))}</button></div></div>`;
  if (sec === "portfolio") {
    const prods = [["Personal loans", 12.06, 3.9], ["Home loans", 9.84, 0.8], ["SME term loans", 6.98, 2.2], ["Overdrafts", 2.86, 1.6], ["Hire purchase", 7.42, 1.9], ["Leases", 2.44, 0.7]];
    const max = Math.max(...prods.map((p) => p[1]));
    return head(tt("Portfolio", "พอร์ตสินเชื่อ"), tt("Outstanding by product and how much of it is late, as of now.", "ยอดคงค้างตามผลิตภัณฑ์และสัดส่วนที่ค้างชำระ ณ ตอนนี้")) +
      factsHtml([[tt("Total book", "พอร์ตรวม"), "฿41.60bn"], [tt("Late 30+ days", "ค้าง 30 วันขึ้นไป"), "3.84%", "crit"], [t("NPL ratio"), "2.14%"], [tt("Weighted rate", "อัตราเฉลี่ยถ่วงน้ำหนัก"), "7.92%"], [tt("Customers", "ลูกค้า"), "214,880"]]) +
      card(tt("Outstanding and share late by product", "ยอดคงค้างและสัดส่วนค้างตามผลิตภัณฑ์"), `<div class="bars">${prods.map(([n, v, late]) => `<div class="bar-row"><span>${esc(t(n))}</span><span class="num muted">฿${v.toFixed(2)}bn · ${esc(tt("late", "ค้าง"))} ${late.toFixed(1)}%</span><div class="bar" style="display:flex"><span style="width:${(v / max) * 100 * (1 - late / 100)}%;border-radius:999px 0 0 999px"></span><span class="crit" style="width:${(v / max) * late}%;border-radius:0 999px 999px 0"></span></div></div>`).join("")}</div><div class="legend" style="margin-top:14px"><span><i></i>${esc(tt("Up to date", "ปกติ"))}</span><span><i style="background:var(--crit)"></i>${esc(tt("30+ days late", "ค้าง 30 วันขึ้นไป"))}</span></div>`);
  }
  if (sec === "vintage") {
    const vs = [["Q4 2025", 0.9], ["Q1 2026", 1.1], ["Q2 2026", 1.4], ["Q3 2026", 1.2]], W = 640, H = 240, L = 40, B = 26, T = 10, max = 8;
    const x = (m) => L + (m / 12) * (W - L - 14), y = (v) => T + (H - T - B) * (1 - v / max);
    let svg = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(tt("Cumulative share of loans 30+ days late by months since origination", "สัดส่วนสะสมของสัญญาที่ค้าง 30 วันขึ้นไป ตามเดือนนับจากเปิดสัญญา"))}">`;
    [0, 2, 4, 6, 8].forEach((v) => { svg += `<line class="gl" x1="${L}" x2="${W - 14}" y1="${y(v)}" y2="${y(v)}"/><text x="${L - 8}" y="${y(v) + 3.5}" text-anchor="end">${v}%</text>`; });
    [0, 3, 6, 9, 12].forEach((m) => { svg += `<text x="${x(m)}" y="${H - 6}" text-anchor="middle">${tt(`M${m}`, `เดือน ${m}`)}</text>`; });
    vs.forEach(([q, k], i) => { const months = 12 - i * 3, pts = Array.from({ length: months + 1 }, (_, m) => [x(m), y(Math.min(max, k * 7 * (1 - Math.exp(-m / 5))))]); svg += `<path d="${pts.map((p, j) => (j ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ")}" style="fill:none;stroke:${VINT_COLORS[i]};stroke-width:2"/>`; });
    return head(tt("Vintage", "วินเทจ"), tt("Personal loans: share 30+ days late by quarter of origination. Q2 2026 is worsening faster than earlier quarters.", "สินเชื่อส่วนบุคคล: สัดส่วนค้าง 30 วันขึ้นไปตามไตรมาสที่เปิดสัญญา ไตรมาส 2/2569 แย่ลงเร็วกว่าไตรมาสก่อน")) +
      card(tt("Cumulative 30+ days late", "ค้าง 30 วันขึ้นไป สะสม"), svg + `</svg><div class="vintage-legend">${vs.map(([q], i) => `<span><i style="background:${VINT_COLORS[i]}"></i>${q}</span>`).join("")}</div>`) +
      notice("info", tt("Q2 2026 reaches 5.4% at month 4, against 3.5% for Q4 2025", "ไตรมาส 2/2569 แตะ 5.4% ที่เดือนที่ 4 เทียบกับ 3.5% ของไตรมาส 4/2568"), tt("Most of the gap comes from the online channel; see Roll rates for where accounts move.", "ส่วนต่างมาจากช่องทางออนไลน์เป็นหลัก ดูอัตราไหลเพื่อดูการเคลื่อนของบัญชี"));
  }
  const buckets = ["Current", "1–29", "30–59", "60–89", "90+"], M = [[96.1, 3.6, 0.3, 0, 0], [41.2, 38.5, 20.3, 0, 0], [12.4, 9.8, 34.1, 43.7, 0], [4.2, 2.1, 6.3, 31.0, 56.4], [1.1, 0.4, 0.6, 2.2, 95.7]];
  return head(tt("Roll rates", "อัตราไหล"), tt("Where accounts in each bucket last month are this month. Read across a row.", "บัญชีในแต่ละช่วงเมื่อเดือนก่อน เดือนนี้อยู่ที่ไหน อ่านตามแถว")) +
    `<section class="card"><div class="table-wrap"><table class="heat"><caption class="sr">${esc(tt("Roll rate matrix", "ตารางอัตราไหล"))}</caption><thead><tr><th scope="col">${esc(tt("From \\ to", "จาก \\ ไป"))}</th>${buckets.map((b) => `<th scope="col" class="r">${esc(b === "Current" ? tt("Current", "ปกติ") : b)}</th>`).join("")}</tr></thead><tbody>
    ${M.map((row, i) => `<tr><th scope="row" style="background:transparent">${esc(buckets[i] === "Current" ? tt("Current", "ปกติ") : buckets[i])}</th>${row.map((v, j) => `<td class="h" style="background:color-mix(in srgb, ${j > i ? "var(--crit)" : j < i ? "var(--good)" : "var(--accent)"} ${Math.round(v * 0.55)}%, var(--surface))">${v.toFixed(1)}%</td>`).join("")}</tr>`).join("")}</tbody></table></div></section>
    <div class="legend"><span><i style="background:var(--good)"></i>${esc(tt("Cured or improved", "ดีขึ้น"))}</span><span><i></i>${esc(tt("Stayed", "คงที่"))}</span><span><i style="background:var(--crit)"></i>${esc(tt("Rolled forward", "แย่ลง"))}</span></div>`;
}

/* ---------------- branch: counter and cash drawer ---------------- */
const DRAWER = [[1000, 212], [500, 88], [100, 310], [50, 64], [20, 145], [10, 120], [5, 80], [2, 40], [1, 55]];
const drawerTotal = DRAWER.reduce((s, [d, c]) => s + d * c, 0);
function viewCounter() {
  const s = sysById.branch, L = LOAN;
  const tiles = [["deposit", "i-cash", tt("Cash deposit", "ฝากเงินสด"), tt("Into any account, with a receipt", "เข้าบัญชีใดก็ได้ พร้อมใบเสร็จ")], ["withdraw", "i-vault", tt("Cash withdrawal", "ถอนเงินสด"), tt("ID check above ฿50,000", "ตรวจบัตรซ้ำเมื่อเกิน ฿50,000")],
    ["act:pay", "i-loan", tt("Pay a loan", "ชำระสินเชื่อ"), "LN-A-C10 · " + tt(`${baht(L.overdue)} overdue`, `ค้าง ${baht(L.overdue)}`)], ["go:payments/transfers", "i-swap", tt("Transfer", "โอนเงิน"), tt("PromptPay, other banks", "พร้อมเพย์ ต่างธนาคาร")],
    ["none", "i-inbox", tt("Update passbook", "ปรับสมุดบัญชี"), tt("Prints 12 new lines", "พิมพ์ 12 รายการใหม่")], ["go:deposits/accounts", "i-plus", tt("Open an account", "เปิดบัญชี"), tt("Savings or term deposit", "ออมทรัพย์หรือฝากประจำ")]];
  const attr = (k) => k.startsWith("act:") ? `data-act="${k.slice(4)}"` : k.startsWith("go:") ? `data-go="${k.slice(3)}"` : k === "none" ? "" : `data-flow="${k}"`;
  return `<div class="head"><div>${eyebrow(s, tt("Counter 3 · Branch 0123", "ช่อง 3 · สาขา 0123"))}<h1 class="title">${esc(t("Counter"))}</h1><p class="lede">${esc(tt("Ticket A-042 is at your counter. The customer's ID card was read and checked with DOPA.", "บัตรคิว A-042 อยู่ที่ช่องของคุณ อ่านบัตรประชาชนและตรวจกับกรมการปกครองแล้ว"))}</p></div>
      <div class="actions"><button class="btn" type="button" data-go="branch/bqueue">${esc(tt("Call next ticket", "เรียกคิวถัดไป"))}</button></div></div>
    <section class="card"><div class="card-body"><div class="profile"><span class="big-av">SP</span><div style="min-width:0"><h2 style="font-size:20px;font-weight:600">${esc(t("Somchai Prasert"))}</h2><p class="muted">C10 · ${esc(tt("ID verified 09:38", "ยืนยันตัวตน 09:38"))}</p><div class="pills">${P("good", tt("DOPA check passed", "ตรวจกรมการปกครองผ่าน"))}${lateP(LATE_DAYS)}</div></div>
      <div class="actions" style="margin-left:auto"><button class="btn" type="button" data-go="rec:C10">${esc(tt("Customer page", "หน้าลูกค้า"))} ${icon("i-arrow")}</button></div></div></div></section>
    ${factsHtml([["SAV-C10", baht(L.sav), "", "Savings Standard"], ["LN-A-C10", baht(L.overdue), "crit", tt("overdue", "ค้างชำระ")], [tt("This counter today", "ช่องนี้วันนี้"), "38", "", tt("transactions", "รายการ")], [tt("Drawer", "ลิ้นชัก"), baht(drawerTotal), "", tt("limit ฿500,000.00", "วงเงิน ฿500,000.00")]])}
    <section class="tiles wide" aria-label="${esc(tt("Services", "บริการ"))}">${tiles.map(([k, ic, n, d]) => `<button class="action-tile" type="button" ${attr(k)}><span class="tile">${icon(ic)}</span><strong>${esc(n)}</strong><small>${esc(d)}</small></button>`).join("")}</section>`;
}
function viewDrawer() {
  const s = sysById.branch;
  return `<div class="head"><div>${eyebrow(s, tt("Counter 3 · Somsak J.", "ช่อง 3 · สมศักดิ์ จ."))}<h1 class="title">${esc(t("Cash drawer"))}</h1><p class="lede">${esc(tt("Counted against the system at 12:00. Cash above ฿400,000 goes to the vault.", "นับเทียบกับระบบเมื่อ 12:00 เงินสดเกิน ฿400,000 ส่งเข้าห้องมั่นคง"))}</p></div>
      <div class="actions"><button class="btn" type="button">${esc(tt("Send to vault", "ส่งเข้าห้องมั่นคง"))}</button><button class="btn primary" type="button">${esc(tt("Count now", "นับตอนนี้"))}</button></div></div>
    ${factsHtml([[t("Expected"), baht(drawerTotal)], [tt("Counted", "นับได้"), baht(drawerTotal)], [t("Difference"), baht(0), "", tt("balanced", "ยอดตรง")], [t("Limit"), baht(500000)]])}
    <div class="grid-main"><section class="card"><div class="card-body flush">${table({ cols: ["Note", "Count", "Value"], rows: DRAWER.map(([d, c]) => [(d >= 20 ? tt("Note ", "ธนบัตร ") : tt("Coin ", "เหรียญ ")) + baht(d, 0), String(c), baht(d * c)]) }, t("Cash drawer"))}</div></section>
    <section class="card"><div class="card-body flush">${table({ cols: ["Time", "Service", "In", "Out"], rows: [["11:52", tt("Cash deposit · SAV-C14", "ฝากเงินสด · SAV-C14"), baht(25000), "—"], ["11:31", tt("Withdrawal · SAV-P2", "ถอนเงิน · SAV-P2"), "—", baht(8000)], ["10:58", tt("Loan payment · LN-A-C12", "ชำระสินเชื่อ · LN-A-C12"), baht(10084.8), "—"], ["10:20", tt("Sent to vault", "ส่งเข้าห้องมั่นคง"), "—", baht(200000)]] }, tt("Movements", "รายการเคลื่อนไหว"))}</div></section></div>`;
}

/* ---------------- my settings ---------------- */
function viewSettings() {
  const root = document.documentElement, style = root.getAttribute("data-style") || "modern", theme = root.getAttribute("data-theme") || "system", density = root.getAttribute("data-density") || "comfortable";
  const choice = (group, val, cur, name, desc, mini) => `<button class="choice" type="button" role="radio" aria-checked="${val === cur}" data-set="${group}" data-val="${val}">${mini ? `<div class="mini ${mini}"><div class="s"></div><div class="m"><div class="bar"></div><div class="cards"><i></i><i></i><i></i></div></div></div>` : ""}<span class="row">${esc(name)}<span class="tick">${val === cur ? icon("i-check") : ""}</span></span>${desc ? `<small>${esc(desc)}</small>` : ""}</button>`;
  const row = (h, p, body) => `<div class="set-row"><div><h3>${esc(h)}</h3><p>${esc(p)}</p></div><div class="choices" role="radiogroup" aria-label="${esc(h)}">${body}</div></div>`;
  const notes = [["approvals", tt("Approvals waiting for me", "รายการรออนุมัติจากฉัน"), true], ["breaks", tt("Reconciliation breaks", "รายการกระทบยอดไม่ตรง"), true], ["promises", tt("Broken promises in my queue", "ผิดนัดในคิวของฉัน"), true], ["digest", tt("Daily summary by email at 07:30", "สรุปประจำวันทางอีเมล 07:30"), false]];
  return `<div class="head"><div><div class="eyebrow">${icon("i-user")}${esc(role.name)} · ${esc(t(role.title))}</div><h1 class="title">${esc(t("Settings"))}</h1><p class="lede">${esc(tt("Choose how the console looks and works for you. Changes apply immediately and only affect your own view.", "เลือกรูปแบบคอนโซลสำหรับคุณ มีผลทันทีและเฉพาะมุมมองของคุณ"))}</p></div></div>
    <section class="card"><div class="card-head"><div class="card-title">${esc(tt("Appearance", "รูปลักษณ์"))}</div></div><div class="card-body">
      ${row(tt("Interface style", "สไตล์หน้าจอ"), tt("Modern is brighter and more energetic. Calm is flatter and quieter, for long working days.", "Modern สดใสและมีชีวิตชีวา Calm เรียบและเงียบกว่า เหมาะกับการทำงานทั้งวัน"),
        choice("style", "modern", style, "Modern", tt("Cobalt accent, raised cards, lively motion. Suits dashboards and demos.", "สีน้ำเงินโคบอลต์ การ์ดยกนูน เคลื่อนไหวมีชีวิตชีวา"), "lt modern") + choice("style", "calm", style, "Calm", tt("One muted accent, flat panels, more space, slower motion. Suits operations work.", "สีเดียวโทนหม่น พื้นเรียบ เว้นที่มากขึ้น เหมาะกับงานปฏิบัติการ"), "lt calm"))}
      ${row(tt("Theme", "ธีม"), tt("System follows your computer's light or dark setting.", "ตามระบบจะใช้ค่าสว่างหรือมืดของเครื่องคุณ"), choice("theme", "light", theme, tt("Light", "สว่าง"), "", "lt") + choice("theme", "system", theme, tt("System", "ตามระบบ"), "", "sys") + choice("theme", "dark", theme, tt("Dark", "มืด"), "", "dk"))}
    </div></section>
    <section class="card"><div class="card-head"><div class="card-title">${esc(tt("Workspace", "พื้นที่ทำงาน"))}</div></div><div class="card-body">
      ${row(tt("Density", "ความหนาแน่น"), tt("Compact fits more rows for people who work a queue all day.", "แบบกระชับแสดงแถวได้มากขึ้น สำหรับคนที่ทำงานกับคิวทั้งวัน"), choice("density", "comfortable", density, tt("Comfortable", "สบายตา"), tt("46 px rows", "แถว 46 px")) + choice("density", "compact", density, tt("Compact", "กระชับ"), tt("36 px rows", "แถว 36 px")))}
      ${row(tt("Language", "ภาษา"), tt("Labels, dates and messages. Thai dates use the Buddhist year.", "ป้าย วันที่ และข้อความ วันที่ภาษาไทยใช้ปีพุทธศักราช"), choice("lang", "en", lang, "English", "24 Oct 2026") + choice("lang", "th", lang, "ไทย", "24 ต.ค. 2569"))}
      ${row(tt("Start page", "หน้าแรก"), tt("Where the console opens after you sign in.", "หน้าที่เปิดหลังเข้าสู่ระบบ"), choice("start", "workbench", store.get("fabor.start") || "workbench", t("Workbench"), tt("Your work across every system", "งานของคุณในทุกระบบ")) + choice("start", "last", store.get("fabor.start") || "workbench", tt("Last system used", "ระบบที่ใช้ล่าสุด"), tt("Pick up where you left off", "ทำต่อจากที่ค้างไว้")))}
    </div></section>
    <section class="card"><div class="card-head"><div class="card-title">${esc(t("Notifications"))}</div></div><div class="card-body">${notes.map(([k, n, def]) => { const on = (store.get("fabor.note." + k) ?? String(def)) === "true"; return `<label class="switch"><span>${esc(n)}</span><input type="checkbox" data-note="${k}" ${on ? "checked" : ""}></label>`; }).join("")}</div></section>
    <section class="card"><div class="card-head"><div class="card-title">${esc(tt("Demo", "การสาธิต"))}</div></div><div class="card-body"><div class="actions"><button class="btn" type="button" data-action="presenter">${esc(tt("Presenter mode", "โหมดผู้นำเสนอ"))}</button><button class="btn" type="button" data-go="admin/branding">${esc(tt("Bank branding", "แบรนด์ธนาคาร"))}</button><button class="btn" type="button" data-action="reset">${esc(tt("Reset demo data", "รีเซ็ตข้อมูลสาธิต"))}</button></div></div></section>`;
}

/* ---------------- limits and authorities ---------------- */
function viewAuthorities() {
  const s = sysById.admin, roles = ROLES;
  return `<div class="head"><div>${eyebrow(s)}<h1 class="title">${esc(t("Limits and authorities"))}</h1><p class="lede">${esc(tt("What each role may do alone, and who approves above it. Every review step checks this table and says why.", "บทบาทใดทำอะไรได้เองถึงเท่าไร และใครอนุมัติเมื่อเกิน ทุกขั้นตอนตรวจทานใช้ตารางนี้และบอกเหตุผล"))}</p></div>
      <div class="actions"><button class="btn primary" type="button">${esc(tt("Propose a change", "เสนอการเปลี่ยนแปลง"))}</button></div></div>
    <section class="card"><div class="table-wrap"><table><caption class="sr">${esc(t("Limits and authorities"))}</caption><thead><tr><th scope="col">${esc(tt("Action", "การทำรายการ"))}</th>${roles.map((r) => `<th scope="col" class="r">${esc(t(r.title))}</th>`).join("")}<th scope="col">${esc(tt("Above the limit", "เมื่อเกินวงเงิน"))}</th></tr></thead><tbody>
    ${ACTIONS.map(([k, n, second]) => `<tr><th scope="row" style="background:transparent;font-weight:500">${esc(tt(n, t(n)))}</th>${roles.map((r) => { const v = AUTH[r.id][k]; return `<td class="r num${r.id === role.id ? " me" : ""}">${v ? baht(v, 0) : `<span class="faint">—</span>`}</td>`; }).join("")}<td>${esc(t(second))}</td></tr>`).join("")}
    </tbody></table></div></section>
    <p class="note">${esc(tt(`You are signed in as ${role.title.toLowerCase()}; your column is highlighted. Changes to this table go through maker-checker like any other change, and the audit trail keeps every version.`, `คุณเข้าระบบในฐานะ${t(role.title)} คอลัมน์ของคุณถูกเน้น การแก้ไขตารางนี้ต้องผ่านผู้ทำ-ผู้ตรวจ และเก็บทุกเวอร์ชันในประวัติการตรวจสอบ`))}</p>`;
}

/* ---------------- exception centre: every break, failure and breach in one queue ---------------- */
const EXC = [
  ["crit", "Reconciliation break", "ITMX 05:00 · ฿4,200.00 unmatched", "PromptPay credit to SAV-C14", "Payments ops", 280, 480, "payments/recon"],
  ["crit", "Payoff overdue", "FP-2026-0011 · Rama 9 Trucks", "Unit sold 4 days ago and not paid off", "Asset finance", 5760, 2880, "leasing/floorplan"],
  ["warn", "Dead letter", "capitalize:SAV-P9 failed 5 times", "The account is dormant", "Operations", 1440, 2880, "ops/scheduler"],
  ["warn", "Nostro break", "NOS-EUR-01 · €1,200.00", "Deutsche Bank statement differs", "Treasury ops", 190, 1440, "treasury/nostro"],
  ["warn", "Integration", "DOPA error rate 1.20%", "Above the 0.5% threshold", "Integration team", 95, 240, "admin/integrations"],
  ["info", "Limit warning", "Bangna Motors at 92% of group limit", "Above the 90% warning level", "Credit risk", 2100, 4320, "rec:DLR-1"],
  ["info", "Document discrepancy", "LC-26-0412 insurance certificate", "The bank must answer by 29 Oct", "Trade operations", 1300, 7200, "rec:LC-26-0412"],
];
const resolvedExc = new Set();
const dur = (m) => m >= 1440 ? tt(`${Math.round(m / 1440)} d`, `${Math.round(m / 1440)} วัน`) : m >= 60 ? tt(`${Math.floor(m / 60)} h ${m % 60} min`, `${Math.floor(m / 60)} ชม. ${m % 60} นาที`) : tt(`${m} min`, `${m} นาที`);
const excOpen = () => EXC.map((x, i) => [x, i]).filter(([x, i]) => !resolvedExc.has(i) && has(x[7].startsWith("rec:") ? RECS[x[7].slice(4)].sys : x[7].split("/")[0]));
function viewExceptions() {
  const s = sysById.ops, open = excOpen(), breached = open.filter(([x]) => x[5] > x[6]).length;
  return `<div class="head"><div>${eyebrow(s)}<h1 class="title">${esc(t("Exception centre"))}</h1><p class="lede">${esc(tt("Every break, failed task, integration fault and limit breach in one queue, each with an owner and a clock.", "รายการไม่ตรง งานล้มเหลว การเชื่อมต่อขัดข้อง และการเกินวงเงิน รวมในคิวเดียว มีผู้รับผิดชอบและเวลากำกับ"))}</p></div></div>
    ${factsHtml([[tt("Open", "เปิดอยู่"), String(open.length)], [tt("Past their deadline", "เกินกำหนด"), String(breached), breached ? "crit" : ""], [tt("Oldest", "เก่าสุด"), open.length ? dur(Math.max(...open.map(([x]) => x[5]))) : "—"], [tt("Resolved today", "แก้ไขวันนี้"), String(11 + resolvedExc.size)]])}
    ${open.length ? `<section class="card"><div class="card-body"><div class="list">${open.map(([[sev, kind, title, detail, owner, age, sla, go], i]) => { const left = sla - age; return `<div class="li"><span class="sev ${sev}">${icon(sev === "crit" ? "i-alert" : sev === "warn" ? "i-clock" : "i-bell")}</span><div style="flex:1"><strong>${esc(title)}</strong><p>${esc(tt(kind, kind))} · ${esc(detail)} · ${esc(owner)}</p>
      <div class="bar" style="margin-top:8px;max-width:340px"><span class="${left < 0 ? "crit" : left < sla * 0.25 ? "warn" : ""}" style="width:${Math.min(100, (age / sla) * 100)}%"></span></div><p style="margin-top:4px">${esc(left < 0 ? tt(`Overdue by ${dur(-left)}`, `เกินกำหนด ${dur(-left)}`) : tt(`${dur(left)} left`, `เหลือ ${dur(left)}`))}</p></div>
      <div class="actions" style="width:auto;flex-wrap:nowrap"><button class="btn row-btn" type="button" data-go="${go}">${esc(t("Open"))}</button><button class="btn row-btn primary" type="button" data-flow="resolveExc" data-arg="${i}">${esc(tt("Resolve", "แก้ไข"))}</button></div></div>`; }).join("")}</div></div></section>`
      : `<section class="card"><div class="card-body"><div class="state"><span class="sev good">${icon("i-check")}</span><strong>${esc(tt("No open exceptions", "ไม่มีรายการค้าง"))}</strong><p>${esc(tt("New ones arrive here the moment a check fails.", "รายการใหม่จะมาที่นี่ทันทีที่การตรวจไม่ผ่าน"))}</p></div></div></section>`}`;
}

/* ---------------- month-end close ---------------- */
let closeDone = new Set();
const CLOSE = [["pre", "Pre-close checks", "Operations", "22 Oct", "done"], ["freeze", "Freeze product changes", "Product team", "23 Oct", "done"], ["recon", "Sub-ledger to GL reconciliation", "Finance", "Daily 06:00", "done"],
  ["suspense", "Clear suspense GL 2990", "Payments ops", "30 Oct", "blocked", "ITMX break ฿4,200.00"], ["accrual", "Accrual complete to 31 Oct", "Scheduler", "31 Oct 23:59", "auto"],
  ["ecl", "Run the loss allowance (ECL)", "Arunee T.", "31 Oct", "ready"], ["fx", "Revalue foreign currency", "Treasury", "31 Oct", "waiting"], ["bot", "BOT data sets", "Finance", "15 Nov", "waiting"], ["signoff", "CFO sign-off", "CFO", "3 Nov", "waiting"]];
function viewClose() {
  const s = sysById.finance, state = (x) => closeDone.has(x[0]) ? "done" : x[0] === "suspense" && resolvedExc.has(0) ? "ready" : x[4], done = CLOSE.filter((x) => state(x) === "done").length;
  const pill = { done: ["good", tt("Done", "เสร็จ")], blocked: ["crit", tt("Blocked", "ติดขัด")], auto: ["info", tt("Runs by itself", "ทำงานอัตโนมัติ")], ready: ["info", tt("Ready", "พร้อม")], waiting: ["", tt("Waiting", "รอ")] };
  return `<div class="head"><div>${eyebrow(s)}<h1 class="title">${esc(tt("Month-end close · October 2026", "ปิดบัญชีสิ้นเดือน · ตุลาคม 2569"))}</h1><p class="lede">${esc(tt("No batch window means no close night: accrual runs all month, so the close is a checklist of controls, not a job queue.", "ไม่มีช่วงปิดระบบจึงไม่มีคืนปิดบัญชี ดอกเบี้ยคำนวณตลอดเดือน การปิดบัญชีจึงเป็นรายการตรวจควบคุม ไม่ใช่คิวงาน"))}</p></div></div>
    <section class="card"><div class="card-body"><div class="bar-row"><span><b>${done}</b> ${esc(tt(`of ${CLOSE.length} steps done`, `จาก ${CLOSE.length} ขั้นตอนเสร็จแล้ว`))}</span><span class="num muted">${esc(tt("7 days to month end", "อีก 7 วันสิ้นเดือน"))}</span><div class="bar"><span style="width:${(done / CLOSE.length) * 100}%"></span></div></div></div></section>
    <section class="card"><div class="table-wrap"><table><caption class="sr">${esc(t("Month-end close"))}</caption><thead><tr>${[tt("Step", "ขั้นตอน"), t("Owner"), t("Due"), t("State"), ""].map((c) => `<th scope="col">${esc(c)}</th>`).join("")}</tr></thead><tbody>
    ${CLOSE.map((x) => { const st = state(x); return `<tr><td style="white-space:normal"><b style="font-weight:500">${esc(tt(x[1], x[1]))}</b>${x[5] && st === "blocked" ? `<div class="muted" style="font-size:12.5px">${esc(tt("Blocked by", "ติดที่"))} ${esc(x[5])}</div>` : ""}</td><td>${esc(x[2])}</td><td class="num">${esc(loc(x[3]))}</td><td>${P(pill[st][0], pill[st][1])}</td>
      <td class="r">${x[0] === "ecl" && st === "ready" ? `<button class="btn row-btn primary" type="button" data-flow="eclRun">${esc(tt("Run", "เริ่ม"))}</button>` : x[0] === "suspense" && st === "blocked" ? `<button class="btn row-btn" type="button" data-go="ops/exceptions">${esc(t("Exception centre"))}</button>` : x[0] === "suspense" && st === "ready" ? `<button class="btn row-btn primary" type="button" data-close-step="suspense">${esc(tt("Mark done", "ทำเครื่องหมายเสร็จ"))}</button>` : ""}</td></tr>`; }).join("")}
    </tbody></table></div></section>`;
}

/* ---------------- customer app: the same ledger, seen by the customer ---------------- */
let appScreen = "home", appPaid = false;
function qrSvg(seed) {
  // three finder squares in the corners, a separator ring around each, and seeded noise for the data
  const finder = (r, c) => {
    for (const [fr, fc] of [[0, 0], [0, 18], [18, 0]]) {
      const y = r - fr, x = c - fc;
      if (y >= -1 && y <= 7 && x >= -1 && x <= 7) return y >= 0 && y <= 6 && x >= 0 && x <= 6 && (y === 0 || y === 6 || x === 0 || x === 6 || (y >= 2 && y <= 4 && x >= 2 && x <= 4)) ? 1 : 0;
    }
    return -1;
  };
  let x = seed, cells = "";
  for (let r = 0; r < 25; r++) for (let c = 0; c < 25; c++) {
    x = (x * 9301 + 49297) % 233280;
    const f = finder(r, c);
    if (f === 1 || (f === -1 && x / 233280 > 0.52)) cells += `<rect x="${c}" y="${r}" width="1" height="1"/>`;
  }
  return `<svg viewBox="-1 -1 27 27" width="168" height="168" role="img" aria-label="Thai QR payment code" style="background:#fff;fill:#0a0f1d;border-radius:8px">${cells}</svg>`;
}
function viewApp() {
  const s = sysById.channels, L = LOAN, inst = L.pay;
  const screens = {
    home: `<div class="app-top"><span>${esc(tt("Good morning", "สวัสดีตอนเช้า"))}</span><b>${esc(tt("Somchai", "คุณสมชาย"))}</b></div>
      <div class="app-card dark"><small>SAV-C10 · ${esc(t("Savings Standard"))}</small><b>${baht(appPaid ? r2(L.sav - inst) : L.sav)}</b><small>${esc(tt("Available", "ใช้ได้"))}</small></div>
      <div class="app-card"><small>LN-A-C10 · ${esc(t("Personal loan"))}</small><b class="${appPaid ? "" : "crit"}">${baht(appPaid ? r2(L.overdue - inst) : L.overdue)}</b><small>${esc(tt("overdue · talk to us about a plan", "ค้างชำระ · คุยกับเราเรื่องแผนผ่อน"))}</small><button class="btn primary wide" type="button" data-app="pay">${esc(tt("Pay an instalment", "ชำระค่างวด"))}</button></div>
      <div class="app-grid">${[["i-swap", tt("Transfer", "โอนเงิน")], ["i-grid", tt("Scan QR", "สแกน QR")], ["i-inbox", tt("Statements", "รายการเดินบัญชี")], ["i-phone", tt("Call us", "ติดต่อเรา")]].map(([ic, l], k) => `<button type="button" data-app="${k === 2 ? "statement" : k === 1 ? "qr" : "home"}">${icon(ic)}<span>${esc(l)}</span></button>`).join("")}</div>`,
    pay: `<div class="app-top"><button class="app-back" type="button" data-app="home" aria-label="${esc(t("Back"))}">${icon("i-back")}</button><b>${esc(tt("Pay LN-A-C10", "ชำระ LN-A-C10"))}</b></div>
      <div class="app-card"><small>${esc(tt("Amount", "จำนวนเงิน"))}</small><b>${baht(inst)}</b><small>${esc(tt("Instalment 6, due 2 Jun", "งวดที่ 6 ครบกำหนด 2 มิ.ย."))}</small></div>
      <div class="app-card"><small>${esc(tt("From", "จาก"))}</small><b style="font-size:16px">SAV-C10</b><small>${baht(L.sav)}</small></div>
      <p class="app-fine">${esc(tt("Paid instalments are applied oldest first. Default interest stays due.", "ชำระงวดที่เก่าที่สุดก่อน ดอกเบี้ยผิดนัดยังคงค้างอยู่"))}</p>
      <button class="btn primary wide" type="button" data-app="paid">${esc(tt("Confirm with Face ID", "ยืนยันด้วย Face ID"))}</button><button class="btn wide" type="button" data-app="qr">${esc(tt("Pay from another bank by QR", "ชำระจากธนาคารอื่นด้วย QR"))}</button>`,
    qr: `<div class="app-top"><button class="app-back" type="button" data-app="home" aria-label="${esc(t("Back"))}">${icon("i-back")}</button><b>Thai QR Payment</b></div>
      <div class="app-card" style="justify-items:center;text-align:center">${qrSvg(4812)}<b style="font-size:16px">${baht(inst)}</b><small>Fabor Demo Bank · LN-A-C10 · Ref 1 0812345678 · Ref 2 06</small></div>
      <p class="app-fine">${esc(tt("Any Thai banking app can scan this. The payment matches the loan by its references, with no manual step.", "แอปธนาคารไทยใดก็สแกนได้ ระบบจับคู่กับสัญญาด้วยเลขอ้างอิงโดยไม่ต้องทำมือ"))}</p>`,
    paid: `<div class="app-done">${icon("i-check")}<b>${esc(tt("Paid", "ชำระแล้ว"))}</b><span>${baht(inst)} → LN-A-C10</span><small>${esc(tt("Receipt RC-2026-104301 · 24 Oct 2026 10:02", "ใบเสร็จ RC-2026-104301 · 24 ต.ค. 2569 10:02"))}</small><button class="btn wide" type="button" data-app="home">${esc(tt("Done", "เสร็จ"))}</button></div>`,
    statement: `<div class="app-top"><button class="app-back" type="button" data-app="home" aria-label="${esc(t("Back"))}">${icon("i-back")}</button><b>${esc(tt("SAV-C10 statement", "รายการเดินบัญชี SAV-C10"))}</b></div>
      ${[[tt("PromptPay to 08x-xxx-1180", "พร้อมเพย์ไป 08x-xxx-1180"), -2500, "24 Oct"], [tt("Cash deposit", "ฝากเงินสด"), 15000, "21 Oct"], [tt("Salary", "เงินเดือน"), 28400, "15 Oct"], [tt("Electricity bill", "ค่าไฟฟ้า"), -1840.5, "5 Oct"]].map(([w, a, d]) => `<div class="app-row"><span><b>${esc(w)}</b><small>${esc(loc(d + " 2026"))}</small></span><span class="num ${a < 0 ? "" : "good"}">${a < 0 ? baht(a) : "+" + baht(a)}</span></div>`).join("")}`,
  };
  return `<div class="head"><div>${eyebrow(s)}<h1 class="title">${esc(t("App preview"))}</h1><p class="lede">${esc(tt("What Somchai sees in the bank's app. It runs on the same core: a payment here lands on LN-A-C10 and in the live postings at once.", "สิ่งที่คุณสมชายเห็นในแอปธนาคาร ทำงานบนแกนเดียวกัน การชำระที่นี่เข้าสัญญา LN-A-C10 และรายการบัญชีสดทันที"))}</p></div>
    <div class="actions"><button class="btn" type="button" data-action="app-reset">${esc(tt("Reset the app", "รีเซ็ตแอป"))}</button><button class="btn primary" type="button" data-go="rec:LN-A-C10">LN-A-C10 ${icon("i-arrow")}</button></div></div>
    <div class="app-stage"><div class="phone" role="region" aria-label="${esc(tt("Customer app", "แอปลูกค้า"))}"><div class="phone-notch" aria-hidden="true"></div><div class="phone-screen" lang="${lang}">${screens[appScreen]}</div></div>
      <div style="display:grid;gap:14px;align-content:start;min-width:0">${factsHtml([[tt("Monthly active users", "ผู้ใช้งานรายเดือน"), "318,402"], [tt("Payments in the app today", "การชำระในแอปวันนี้"), "41,880"], [tt("App store rating", "คะแนนในสโตร์"), "4.7"]])}
      ${card(tt("Built on the console's rules", "สร้างบนกฎเดียวกับคอนโซล"), `<div class="list">${[["i-shield", tt("Same limits and fraud rules", "วงเงินและกฎป้องกันทุจริตเดียวกัน"), tt("New-device cooling-off: ฿5,000 for 24 hours", "อุปกรณ์ใหม่: ไม่เกิน ฿5,000 ใน 24 ชั่วโมง")], ["i-scale", tt("Same ledger", "บัญชีแยกประเภทเดียวกัน"), tt("No overnight sync; staff see app payments as they happen", "ไม่ต้องซิงก์ข้ามคืน พนักงานเห็นการชำระในแอปทันที")], ["i-users", tt("Same consents", "ความยินยอมเดียวกัน"), tt("Withdrawn in the app, honoured in every system", "ถอนในแอป มีผลในทุกระบบ")]].map(([ic, a, b]) => `<div class="li"><span class="sev info">${icon(ic)}</span><div><strong>${esc(a)}</strong><p>${esc(b)}</p></div></div>`).join("")}</div>`)}</div></div>`;
}

/* ---------------- bank branding for the demo ---------------- */
const SWATCHES = ["#3554f5", "#0b6e4f", "#5b2a86", "#b8002e", "#0057b8", "#d35400"];
function viewBranding() {
  const s = sysById.admin, b = brand();
  const lum = (hex) => { const v = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
  const ratio = (1.05) / (lum(b.color || "#3554f5") + 0.05);
  return `<div class="head"><div>${eyebrow(s)}<h1 class="title">${esc(t("Branding"))}</h1><p class="lede">${esc(tt("Dress the console in the client bank's colour, name and logo before a demo. It changes tokens, not screens, and only for this browser.", "แต่งคอนโซลด้วยสี ชื่อ และโลโก้ของธนาคารลูกค้าก่อนสาธิต เปลี่ยนเฉพาะโทเคน ไม่ใช่หน้าจอ และเฉพาะเบราว์เซอร์นี้"))}</p></div>
    <div class="actions"><button class="btn" type="button" data-action="brand-clear">${esc(tt("Back to Fabor", "กลับเป็น Fabor"))}</button></div></div>
    <section class="card"><div class="card-body" style="display:grid;gap:18px;max-width:640px">
      <div class="field"><label for="bname">${esc(tt("Bank name", "ชื่อธนาคาร"))}</label><input class="input" id="bname" value="${esc(b.name || t(tenant.name))}"></div>
      <div class="field"><label for="bmark">${esc(tt("Short mark (2 letters)", "อักษรย่อ (2 ตัว)"))}</label><input class="input" id="bmark" maxlength="3" value="${esc(b.mark || tenant.mark)}" style="max-width:120px"></div>
      <fieldset class="field"><legend>${esc(tt("Brand colour", "สีแบรนด์"))}</legend><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px">${SWATCHES.map((c) => `<button type="button" class="swatch" data-swatch="${c}" aria-label="${c}" aria-pressed="${(b.color || "#3554f5") === c}" style="background:${c}"></button>`).join("")}<label class="swatch custom" title="${esc(tt("Custom colour", "สีกำหนดเอง"))}"><span class="sr">${esc(tt("Custom colour", "สีกำหนดเอง"))}</span><input type="color" id="bcolor" value="${esc(b.color || "#3554f5")}"></label></div>
        <span class="hint">${esc(ratio >= 4.5 ? tt(`White text on this colour: ${ratio.toFixed(1)}:1, passes AA.`, `ตัวอักษรขาวบนสีนี้: ${ratio.toFixed(1)}:1 ผ่าน AA`) : tt(`White text on this colour is only ${ratio.toFixed(1)}:1; pick a darker shade for buttons.`, `ตัวอักษรขาวบนสีนี้ได้เพียง ${ratio.toFixed(1)}:1 ควรเลือกสีเข้มขึ้น`))}</span></fieldset>
      <div class="field"><label for="blogo">${esc(tt("Logo (PNG or SVG, square)", "โลโก้ (PNG หรือ SVG สี่เหลี่ยมจัตุรัส)"))}</label><input id="blogo" type="file" accept="image/png,image/svg+xml,image/jpeg">${b.logo ? `<img src="${b.logo}" alt="" style="width:48px;height:48px;border-radius:12px;object-fit:contain;background:var(--surface-2)">` : ""}</div>
      <div class="actions"><button class="btn primary" type="button" data-action="brand-apply">${esc(tt("Apply branding", "ใช้แบรนด์นี้"))}</button></div>
    </div></section>`;
}

/* ---------------- AML case AML-2026-0418: structuring below the cash report threshold ---------------- */
const AML_TX = [[13, "Branch 0123", 1985000], [14, "Branch 0451", 1960000], [15, "Branch 0123", 1990000], [16, "Branch 0218", 1940000], [17, "Branch 0451", 1975000], [19, "Branch 0123", 1980000], [20, "Branch 0218", 1955000], [21, "Branch 0451", 1985000], [22, "Branch 0123", 1970000]];
const AML_TOTAL = AML_TX.reduce((s, x) => s + x[2], 0);
let amlOutcome = null;
function viewAML() {
  const panels = {
    alert: () => `<div class="grid-main">${card(tt("Why it was raised", "เหตุที่แจ้งเตือน"), `<p style="font-size:14px;line-height:1.6">${esc(tt(`Nine cash deposits of ฿1.94m to ฿1.99m over ten days at three branches, ${baht(AML_TOTAL, 0)} in all. None reached the ฿2,000,000 cash report threshold. The customer declared about ฿3,000,000 of cash a month.`, `ฝากเงินสด 9 ครั้ง ครั้งละ ฿1.94–1.99 ล้าน ใน 10 วันที่ 3 สาขา รวม ${baht(AML_TOTAL, 0)} ไม่มีครั้งใดถึงเกณฑ์รายงาน ฿2,000,000 ลูกค้าแจ้งเงินสดหมุนเวียนราว ฿3,000,000 ต่อเดือน`))}</p>`)}
      ${card(tt("Rule", "กฎ"), kvHtml([[tt("Rule", "กฎ"), tt("Structuring below the cash report threshold", "แตกยอดต่ำกว่าเกณฑ์รายงานเงินสด")], [tt("Score", "คะแนน"), "87 / 100"], [tt("Related", "เกี่ยวข้อง"), tt("Adverse media hit at the last KYC review", "พบข่าวเชิงลบในการทบทวน KYC ครั้งล่าสุด")], [t("Risk"), t("High")]]))}</div>`,
    investigation: () => `${card(tt("What the investigator did", "สิ่งที่ผู้สอบสวนทำ"), tl([[Date.UTC(2026, 9, 23), tt("Alert raised and case opened", "แจ้งเตือนและเปิดเรื่อง"), "AML-ALR-7712", "done"], [Date.UTC(2026, 9, 23), tt("CCTV and teller notes requested from 3 branches", "ขอภาพกล้องและบันทึกพนักงานจาก 3 สาขา"), "", "done"], [Date.UTC(2026, 9, 24), tt("Same depositor at all three branches", "ผู้ฝากคนเดียวกันทั้ง 3 สาขา"), tt("Not the account's director", "ไม่ใช่กรรมการของบัญชี"), "warn"], [BIZ, tt("Decide: report or close", "ตัดสิน: รายงานหรือปิดเรื่อง"), "", "now"]]))}
      <section class="card"><div class="card-body flush">${table({ cols: ["Date", "Where", "Amount"], rows: AML_TX.map(([d, b, a]) => [`${d} Oct 2026`, b, baht(a)]) }, tt("Cash deposits", "การฝากเงินสด"))}</div></section>`,
    decision: () => amlOutcome ? notice("good", amlOutcome, tt("The case is closed for editing; the file stays for 10 years.", "เรื่องปิดแก้ไขแล้ว เก็บแฟ้มไว้ 10 ปี")) : `<div class="tiles wide"><button class="action-tile" type="button" data-flow="fileSTR"><span class="tile">${icon("i-alert")}</span><strong>${esc(tt("File a suspicious transaction report", "ยื่นรายงานธุรกรรมที่มีเหตุอันควรสงสัย"))}</strong><small>${esc(tt("To AMLO, without telling the customer", "ต่อ ปปง. โดยไม่แจ้งลูกค้า"))}</small></button>
      <button class="action-tile" type="button" data-flow="closeCase"><span class="tile">${icon("i-check")}</span><strong>${esc(tt("Close with no report", "ปิดเรื่องโดยไม่รายงาน"))}</strong><small>${esc(tt("With the reason on file", "พร้อมบันทึกเหตุผล"))}</small></button></div>
      <p class="note">${esc(tt("Telling the customer about a report (tipping off) is an offence. Their relationship manager sees only that the account is under review.", "การแจ้งลูกค้าว่ามีการรายงานเป็นความผิด ผู้ดูแลความสัมพันธ์จะเห็นเพียงว่าบัญชีอยู่ระหว่างตรวจสอบ"))}</p>`,
  };
  return recordPage({ title: "AML-2026-0418", mono: true, lede: esc(tt("Pacific Import Trading · structuring · investigator Dao P.", "Pacific Import Trading · แตกยอด · ผู้สอบสวน ดาว พ.")), pills: amlOutcome ? P("good", tt("Decided", "ตัดสินแล้ว")) : P("warn", tt("Investigating", "กำลังสอบสวน")) + P("crit", t("High")),
    actions: `<button class="btn primary" type="button" data-tab="decision">${esc(tt("Decide", "ตัดสิน"))}</button>`,
    facts: [[tt("Cash deposited", "เงินสดที่ฝาก"), baht(AML_TOTAL, 0), "crit"], [tt("Deposits", "จำนวนครั้ง"), String(AML_TX.length)], [tt("Branches", "สาขา"), "3"], [tt("Declared cash a month", "เงินสดที่แจ้งต่อเดือน"), baht(3000000, 0)], [t("Score"), "87"], [tt("Open for", "เปิดมาแล้ว"), tt("1 day", "1 วัน")]], panels });
}

/* ---------------- payment held for sanctions screening ---------------- */
let heldOutcome = null;
function viewHeld() {
  const thb = 1180000 * 36;
  const cmp = [["Name", "Siam Freight Logistic Ltd", "SEA FREIGHT LOGIC TRADING CO."], ["Country", "Hong Kong", "—"], ["Registration", "HK 2213845, since 2015", "—"], ["Address", "Kwun Tong, Kowloon", "Unknown"], ["Relationship", "Subsidiary of the applicant, on file since 2019", "—"], ["Listed", "—", "UN consolidated list, 2019"]];
  const panels = {
    payment: () => card(t("Contract"), kvHtml([["From", "CUR-B2031 · " + t("Siam Freight Logistics")], ["To", "Siam Freight Logistic Ltd (HK) · HSBC Hong Kong"], ["Amount", "$1,180,000.00 ≈ " + baht(thb, 0)], [tt("Purpose", "วัตถุประสงค์"), tt("Intercompany settlement for freight services", "ชำระระหว่างบริษัทในเครือ ค่าบริการขนส่ง")], [tt("Rail", "ช่องทาง"), "SWIFT MT103 · cut-off 15:00"]])),
    screening: () => `<section class="card"><div class="table-wrap"><table><caption class="sr">${esc(tt("Screening match", "ผลการคัดกรอง"))}</caption><thead><tr><th scope="col"></th><th scope="col">${esc(tt("On the payment", "ในรายการโอน"))}</th><th scope="col">${esc(tt("On the list", "ในรายชื่อ"))}</th></tr></thead><tbody>
      ${cmp.map(([f, a, b]) => `<tr><th scope="row" style="background:transparent;font-weight:500">${esc(tt(f, t(f)))}</th><td style="white-space:normal">${esc(a)}</td><td style="white-space:normal">${esc(b)}</td></tr>`).join("")}</tbody></table></div></section>
      ${notice("info", tt("Name similarity 91%; nothing else matches", "ชื่อคล้าย 91% ข้อมูลอื่นไม่ตรงกัน"), tt("The beneficiary is the customer's own registered subsidiary. A likely false positive, but a person must decide.", "ผู้รับเป็นบริษัทลูกที่จดทะเบียนของลูกค้าเอง น่าจะเป็นผลบวกลวง แต่ต้องให้คนตัดสิน"))}`,
    decision: () => heldOutcome ? notice("good", heldOutcome, "") : `<div class="tiles wide"><button class="action-tile" type="button" data-flow="releasePayment"><span class="tile">${icon("i-check")}</span><strong>${esc(tt("Release: false positive", "ปล่อยรายการ: ผลบวกลวง"))}</strong><small>${esc(tt("Sends before the 15:00 cut-off", "ส่งก่อนตัดรอบ 15:00"))}</small></button>
      <button class="action-tile" type="button" data-flow="rejectPayment"><span class="tile">${icon("i-close")}</span><strong>${esc(tt("Reject and escalate", "ปฏิเสธและส่งต่อ"))}</strong><small>${esc(tt("Funds return to CUR-B2031; compliance opens a case", "คืนเงินเข้า CUR-B2031 ฝ่ายกำกับเปิดเรื่อง"))}</small></button></div>`,
  };
  return recordPage({ title: "TR-9918210", mono: true, lede: esc(tt("Siam Freight Logistics → Siam Freight Logistic Ltd (HK) · SWIFT", "สยามเฟรท โลจิสติกส์ → Siam Freight Logistic Ltd (HK) · SWIFT")), pills: heldOutcome ? P("good", tt("Decided", "ตัดสินแล้ว")) : P("crit", tt("Held for screening", "ระงับเพื่อคัดกรอง")),
    actions: `<button class="btn primary" type="button" data-tab="decision">${esc(tt("Decide", "ตัดสิน"))}</button>`,
    facts: [[t("Amount"), "$1,180,000.00", "", "≈ " + baht(thb, 0)], [tt("Match", "ความคล้าย"), "91%"], [tt("Held since", "ระงับตั้งแต่"), "08:41"], [tt("Decide by", "ตัดสินภายใน"), "12:41", "warn", tt("4-hour target", "เป้าหมาย 4 ชั่วโมง")], [tt("Cut-off", "ตัดรอบ"), "15:00"]], panels });
}

/* ---------------- loan application APP-30413: from application to disbursement ---------------- */
let appDecision = null;
const APP = (() => { const amount = 890000, n = 60, flat = 0.0249, inst = r2(amount * (1 + flat * n / 12) / n); return { amount, n, flat, inst, vat: r2(inst * 0.07), eff: effRate(amount, inst, n) * 12 * 100, dsr: (9800 + inst) / 58000 * 100, ltv: amount / 1104000 * 100 }; })();
function viewApp30413() {
  const A = APP, rules = [["Age 20 to 65", "35", true], ["Income ฿15,000 a month or more", "฿58,000, from 6 months of statements", true], [`Debt service ratio up to 60%`, `${A.dsr.toFixed(1)}%`, true], ["Loan to value up to 85%", `${A.ltv.toFixed(1)}%`, true],
    ["Bureau score 600 or more", "655", true], ["No 90-day arrears in 24 months", tt("None", "ไม่มี"), true], ["Device and identity fraud checks", tt("Passed", "ผ่าน"), true], ["Proof of address", tt("Missing", "ไม่มี"), false]];
  const panels = {
    application: () => `<div class="grid-main">${card(t("Applicant"), kvHtml([[t("Name"), "Napat Srisuk"], [tt("Channel", "ช่องทาง"), tt("Dealer · Bangna Motors", "ดีลเลอร์ · บางนา มอเตอร์ส")], [t("Vehicle"), "Toyota Corolla Cross HEV, 2026"], [tt("Cash price", "ราคาเงินสด"), baht(1104000)], [tt("Down payment", "เงินดาวน์"), baht(214000)], [tt("Amount financed", "ยอดจัดไฟแนนซ์"), baht(A.amount)], [t("Term"), tt(`${A.n} months`, `${A.n} เดือน`)], [tt("Flat rate", "ดอกเบี้ยคงที่"), `${(A.flat * 100).toFixed(2)}% · ${tt("effective", "ที่แท้จริง")} ${A.eff.toFixed(2)}%`]]))}
      ${card(tt("Documents", "เอกสาร"), `<div class="list">${[["ID card, checked with DOPA", true], ["Bank statements, 6 months", true], ["Payslip", true], ["Proof of address", false]].map(([d, ok]) => `<div class="li"><span class="sev ${ok ? "good" : "warn"}">${icon(ok ? "i-check" : "i-alert")}</span><div><strong>${esc(tt(d, d))}</strong><p>${esc(ok ? tt("Received", "ได้รับแล้ว") : tt("Requested from the dealer", "ขอจากดีลเลอร์แล้ว"))}</p></div></div>`).join("")}</div>`)}</div>`,
    credit: () => `<div class="grid-main"><section class="card"><div class="card-body flush">${table({ cols: ["Rule", "Applicant", "Result"], rows: rules.map(([r, v, ok]) => [r, v, P(ok ? "good" : "warn", ok ? tt("Passes", "ผ่าน") : tt("Condition", "มีเงื่อนไข"))]) }, tt("Credit policy", "นโยบายสินเชื่อ"))}</div></section>
      ${card(tt("Recommendation", "คำแนะนำ"), `<p style="font-size:15px;line-height:1.6"><b>${esc(tt("Approve with one condition", "อนุมัติโดยมีเงื่อนไขหนึ่งข้อ"))}</b>: ${esc(tt("proof of address before the money is paid to the dealer.", "ต้องมีหลักฐานที่อยู่ก่อนจ่ายเงินให้ดีลเลอร์"))}</p>${kvHtml([[tt("Scorecard", "แบบจำลองคะแนน"), "HP-AUTO-2026 · 655"], [tt("Probability of default, 12 months", "โอกาสผิดนัด 12 เดือน"), "2.1%"], [tt("Pricing band", "ช่วงราคา"), "B · 2.49% flat"]])}`)}</div>`,
    decision: () => appDecision ? notice("good", appDecision, "") : `<div class="tiles wide"><button class="action-tile" type="button" data-flow="decideApp" data-arg="approve"><span class="tile">${icon("i-check")}</span><strong>${esc(tt("Approve with the condition", "อนุมัติพร้อมเงื่อนไข"))}</strong><small>${esc(tt("Disbursement waits for proof of address", "การจ่ายเงินรอหลักฐานที่อยู่"))}</small></button>
      <button class="action-tile" type="button" data-flow="decideApp" data-arg="decline"><span class="tile">${icon("i-close")}</span><strong>${esc(tt("Decline", "ปฏิเสธ"))}</strong><small>${esc(tt("The applicant is told the main reason", "แจ้งเหตุผลหลักให้ผู้สมัคร"))}</small></button></div>`,
    disbursement: () => !appDecision || !/^Approved|^อนุมัติ/.test(appDecision) ? `<section class="card"><div class="card-body"><div class="state"><span class="sev info">${icon("i-clock")}</span><strong>${esc(tt("Opens once the application is approved", "เปิดเมื่ออนุมัติใบสมัครแล้ว"))}</strong></div></div></section>`
      : `<div class="grid-main">${card(tt("Pay the dealer", "จ่ายเงินให้ดีลเลอร์"), kvHtml([["To", "CUR-D0007 · " + t("Bangna Motors")], [t("Amount"), baht(A.amount)], [tt("New contract", "สัญญาใหม่"), "HP-2026-004913"], [tt("First instalment", "ค่างวดแรก"), `${fd(Date.UTC(2026, 10, 25))} · ${baht(r2(A.inst + A.vat))}`]]) + `<div class="actions" style="margin-top:14px"><button class="btn primary" type="button" data-flow="disburseApp">${esc(tt("Disburse", "จ่ายเงิน"))}</button></div>`)}${card(tt("Condition", "เงื่อนไข"), notice("good", tt("Proof of address received 10:12", "ได้รับหลักฐานที่อยู่ 10:12"), ""))}</div>`,
  };
  return recordPage({ title: "APP-30413", mono: true, lede: esc(tt("Napat Srisuk · car hire purchase through Bangna Motors", "นภัทร ศรีสุข · เช่าซื้อรถยนต์ผ่านบางนา มอเตอร์ส")), pills: appDecision ? P("good", tt("Decided", "ตัดสินแล้ว")) : P("info", "Needs documents"),
    actions: `<button class="btn primary" type="button" data-tab="decision">${esc(tt("Decide", "ตัดสิน"))}</button>`,
    facts: [[t("Amount"), baht(A.amount, 0)], [t("Term"), tt(`${A.n} months`, `${A.n} เดือน`)], [t("Instalment"), baht(r2(A.inst + A.vat)), "", tt("including VAT", "รวม VAT")], [tt("Debt service ratio", "ภาระหนี้ต่อรายได้"), `${A.dsr.toFixed(1)}%`], ["LTV", `${A.ltv.toFixed(1)}%`], [t("Score"), "655"]], panels });
}

/* ---------------- before and after: the same task in a typical core and in Fabor ---------------- */
function viewCompare() {
  const s = sysById.workbench;
  const before = [["Find the contract in the core's green screen", "2 min"], ["Export the schedule to a spreadsheet", "5 min"], ["Work out the rebate by hand under the OCPB rule", "15 min"], ["A checker repeats the calculation", "15 min"], ["Key the settlement; it posts after the night batch", "next day"], ["Finance reconciles the GL the morning after", "next day"]];
  const after = [["Open HP-2025-004812 from search", "10 s"], ["Settle early: the quote shows the rebate tier and VAT", "30 s"], ["Type the contract id; the authority check runs", "20 s"], ["Posted to the ledger, GL matched at once", "real time"]];
  const col = (title, sub, steps, tone) => `<section class="card"><div class="card-head"><div><div class="card-title">${esc(title)}</div><div class="card-sub">${esc(sub)}</div></div></div><div class="card-body"><div class="timeline">${steps.map(([w, d], i) => `<div class="tl ${tone}"><span class="t">${esc(tt(d, d))}</span><span class="rail-dot"><i></i></span><div class="what"><strong>${i + 1}. ${esc(tt(w, w))}</strong></div></div>`).join("")}</div></div></section>`;
  return `<div class="head"><div>${eyebrow(s)}<h1 class="title">${esc(t("Before and after"))}</h1><p class="lede">${esc(tt("Early settlement of a hire purchase contract with the rebate, as it is commonly done today and as it is done here. Times are illustrative.", "การปิดบัญชีเช่าซื้อก่อนกำหนดพร้อมส่วนลด แบบที่ทำกันทั่วไปวันนี้และแบบที่ทำที่นี่ เวลาเป็นตัวอย่างประกอบ"))}</p></div>
      <div class="actions"><button class="btn primary" type="button" data-go="rec:HP-2025-004812">${esc(tt("Try it", "ลองทำ"))} ${icon("i-arrow")}</button></div></div>
    ${factsHtml([[tt("Time", "เวลา"), tt("about 1 min", "ราว 1 นาที"), "", tt("from about 40 min and a night", "จากราว 40 นาทีและข้ามคืน")], [tt("Systems touched", "ระบบที่ใช้"), "1", "", tt("from 3", "จาก 3")], [tt("Manual calculations", "การคำนวณด้วยมือ"), "0", "", tt("from 2", "จาก 2")], [tt("Posted", "บันทึกบัญชี"), tt("at once", "ทันที"), "", tt("from the next day", "จากวันถัดไป")]])}
    <div class="grid-main" style="grid-template-columns:minmax(0,1fr) minmax(0,1fr)">${col(tt("A typical core today", "ระบบหลักทั่วไปวันนี้"), tt("Three systems and a batch", "สามระบบและงานแบตช์"), before, "warn")}${col("Fabor", tt("One review, one ledger", "ตรวจทานครั้งเดียว บัญชีเดียว"), after, "done")}</div>
    <section class="card"><div class="card-body flush">${table({ cols: ["Task", tt("Typical today", "ทั่วไปวันนี้"), "Fabor"], rows: [["Record a promise to pay", "3 screens, re-key the loan id", "One dialog from the queue, J/K and P"], ["Month-end close", "A close night of batch jobs", "A checklist of controls; accrual runs all month"], ["Launch a product change", "Weeks of code and testing", "Days: template, 1,200 simulated scenarios, maker-checker"], ["Answer “why is this figure what it is?”", "Extract and reconcile by hand", "GL → journal → postings → the record"]] }, t("Before and after"))}</div></section>`;
}

/* ---------------- what if: restructuring terms for LN-A-C10, recomputed as you move the sliders ---------------- */
function whatIf(term, ratePct) {
  const L = LOAN, r = ratePct / 100 / 12, pmt = r2(L.total * r / (1 - Math.pow(1 + r, -term)));
  const eir = 0.15 / 12, pv = pmt * (1 - Math.pow(1 + eir, -term)) / eir; // new cash flows at the original effective rate
  const mod = r2(pv - L.total); // under ฿1 is the rounding of the instalment, not a modification
  return { pmt, interest: r2(pmt * term - L.total), mod: Math.abs(mod) < 1 ? 0 : mod, dsr: (pmt / 24000) * 100 };
}
function loanWhatIf() {
  const w = whatIf(18, 15);
  return `<div class="grid-main"><section class="card"><div class="card-head"><div><div class="card-title">${esc(tt("Restructure LN-A-C10", "ปรับโครงสร้าง LN-A-C10"))}</div><div class="card-sub">${esc(tt(`Capitalises the settlement balance of ${baht(LOAN.total)}. Move the sliders.`, `ทบยอดปิดบัญชี ${baht(LOAN.total)} เป็นเงินต้น เลื่อนแถบเพื่อปรับ`))}</div></div></div><div class="card-body" style="display:grid;gap:18px">
      <div class="field"><label for="wiTerm">${esc(t("Term"))}: <b id="wiTermV">18</b> ${esc(tt("months", "เดือน"))}</label><input type="range" id="wiTerm" data-whatif min="6" max="36" step="1" value="18" style="accent-color:var(--accent)"></div>
      <div class="field"><label for="wiRate">${esc(t("Interest rate"))}: <b id="wiRateV">15.00</b>%</label><input type="range" id="wiRate" data-whatif min="9" max="18" step="0.25" value="15" style="accent-color:var(--accent)"></div></div></section>
    <section class="card" aria-live="polite"><div class="card-head"><div class="card-title">${esc(tt("What it does", "ผลที่ได้"))}</div></div><div class="card-body" id="wiOut">${whatIfOut(w)}</div></section></div>`;
}
function whatIfOut(w) {
  return quoteRows([[tt("New instalment", "ค่างวดใหม่"), baht(w.pmt)], [tt("Interest over the new term", "ดอกเบี้ยตลอดระยะใหม่"), baht(w.interest)], [tt("Share of the customer's ฿24,000 income", "สัดส่วนต่อรายได้ ฿24,000 ของลูกค้า"), `${w.dsr.toFixed(1)}%`], [tt("Modification gain or loss (TFRS 9)", "กำไรหรือขาดทุนจากการปรับเงื่อนไข (TFRS 9)"), baht(w.mod)]]) +
    `<p class="note" style="margin-top:14px">${esc(w.mod < 0 ? tt("A rate below the original 15% is a modification loss, booked when the change is approved.", "อัตราต่ำกว่า 15% เดิมเป็นขาดทุนจากการปรับเงื่อนไข รับรู้เมื่ออนุมัติ") : tt("At the original rate there is no modification loss. The loan stays in Stage 3 until it has paid on time for 3 consecutive months or 3 instalments, whichever is longer.", "ที่อัตราเดิมไม่มีขาดทุนจากการปรับเงื่อนไข สัญญาอยู่ใน Stage 3 จนชำระตรงเวลา 3 เดือนติดต่อกันหรือ 3 งวด แล้วแต่อย่างใดนานกว่า"))}</p>
    <div class="actions" style="margin-top:12px"><button class="btn primary" type="button" data-flow="restructure">${esc(tt("Propose these terms", "เสนอเงื่อนไขนี้"))}</button></div>`;
}

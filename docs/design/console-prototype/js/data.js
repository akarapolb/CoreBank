// Fabor console prototype · Systems, tenants, roles, the computed records and every list.
// Classic scripts sharing one global scope; load order is set in index.html.
/* ---------------- systems: the information architecture ---------------- */
const SYS = [
  { id: "workbench", name: "Workbench", group: "Everyday", icon: "i-home", desc: "Your work across every system", sections: [["today", "Today"], ["approvals", "Approvals", "appr"], ["tasks", "My tasks", 12], ["recent", "Recently viewed"], ["compare", "Before and after"]] },
  { id: "customers", name: "Customers", group: "Everyday", icon: "i-users", desc: "Parties, KYC and every relationship", sections: [["overview", "Overview"], ["c360", "Customer 360"], ["directory", "Directory"], ["onboarding", "Onboarding", 9], ["kyc", "KYC reviews", 4, true]] },
  { id: "branch", name: "Branch & Teller", group: "Everyday", icon: "i-cash", desc: "Counter, cash drawer and branch queue", sections: [["counter", "Counter"], ["drawer", "Cash drawer"], ["bqueue", "Branch queue", 4], ["eod", "End of day"]] },
  { id: "deposits", name: "Deposits", group: "Retail & business banking", icon: "i-vault", desc: "Savings, current and term deposits", sections: [["overview", "Overview"], ["accounts", "Accounts"], ["term", "Term deposits"], ["interest", "Interest and fees"], ["statements", "Statements"]] },
  { id: "lending", name: "Lending", group: "Retail & business banking", icon: "i-loan", desc: "Applications, loans and servicing", sections: [["overview", "Overview"], ["applications", "Applications", 14], ["loans", "Loans"], ["restructuring", "Restructuring", 3], ["disbursements", "Disbursements"]] },
  { id: "leasing", name: "Leasing & Asset Finance", group: "Retail & business banking", icon: "i-truck", desc: "Leases, hire purchase, fleet, floor plan", sections: [["overview", "Overview"], ["leases", "Leases"], ["hp", "Hire purchase"], ["fleet", "Fleet agreements"], ["floorplan", "Floor plan", 1, true], ["assets", "Assets"], ["dealers", "Dealers"]] },
  { id: "collections", name: "Collections & Recovery", group: "Retail & business banking", icon: "i-phone", desc: "Arrears, promises, repossession", sections: [["overview", "Overview"], ["queue", "Queue", 128, true], ["promises", "Promises", 31], ["repossessions", "Repossessions", 6], ["writeoffs", "Write-offs"]] },
  { id: "payments", name: "Payments", group: "Retail & business banking", icon: "i-swap", desc: "PromptPay, transfers, reconciliation", sections: [["overview", "Overview"], ["held", "Held payments", 1, true], ["transfers", "Transfers"], ["promptpay", "PromptPay"], ["recon", "Reconciliation", 1, true], ["limits", "Limits"]] },
  { id: "channels", name: "Customer App", group: "Retail & business banking", icon: "i-mobile", desc: "What customers see, on the same ledger", sections: [["preview", "App preview"], ["releases", "Releases"]] },
  { id: "trade", name: "Trade Finance", group: "Corporate & markets", icon: "i-globe", desc: "Letters of credit and guarantees", sections: [["overview", "Overview"], ["lc", "Letters of credit"], ["guarantees", "Guarantees"], ["docs", "Documentary collections"]] },
  { id: "treasury", name: "Treasury", group: "Corporate & markets", icon: "i-fx", desc: "Liquidity, FX and nostro", sections: [["overview", "Overview"], ["liquidity", "Liquidity"], ["fx", "FX positions"], ["nostro", "Nostro accounts"]] },
  { id: "syndication", name: "Syndication", group: "Corporate & markets", icon: "i-layers", desc: "Agency, participations and fees", sections: [["overview", "Overview"], ["deals", "Deals"], ["participants", "Participants"], ["fees", "Fees"]] },
  { id: "products", name: "Product Factory", group: "Control", icon: "i-cube", desc: "Design, simulate and approve products", sections: [["overview", "Overview"], ["catalogue", "Catalogue"], ["master", "Master Builder"], ["builder", "Product Studio"], ["simulations", "Simulations"], ["papprovals", "Approvals", 3]] },
  { id: "finance", name: "Finance & Risk", group: "Control", icon: "i-scale", desc: "Ledger, GL, loss allowance, reporting", sections: [["overview", "Overview"], ["close", "Month-end close"], ["gl", "General ledger"], ["ecl", "Loss allowance"], ["recon", "Sub-ledger vs GL"], ["reports", "Regulatory reports"]] },
  { id: "compliance", name: "Compliance & AML", group: "Control", icon: "i-eye", desc: "Alerts, investigations and reports to AMLO", sections: [["alerts", "Alerts", 3, true], ["cases", "Cases"], ["str", "Reports to AMLO"]] },
  { id: "analytics", name: "Reports & Analytics", group: "Control", icon: "i-chart", desc: "Portfolio, vintages, roll rates, reports", sections: [["portfolio", "Portfolio"], ["vintage", "Vintage"], ["rollrate", "Roll rates"], ["scheduled", "Scheduled reports"]] },
  { id: "ops", name: "Operations", group: "Control", icon: "i-gear", desc: "Exceptions, scheduler, audit and incidents", sections: [["overview", "Overview"], ["exceptions", "Exception centre", "exc", true], ["scheduler", "Scheduler"], ["audit", "Audit trail"], ["incidents", "Incidents"]] },
  { id: "agents", name: "AI Agents", group: "Control", icon: "i-spark", desc: "Proposals checked by people and policy", sections: [["overview", "Overview"], ["proposals", "Proposals", 5], ["policies", "Policies"], ["activity", "Activity"]] },
  { id: "admin", name: "Admin", group: "Control", icon: "i-shield", desc: "Users, roles, tenants, integrations", sections: [["users", "Users and roles"], ["authorities", "Limits and authorities"], ["tenants", "Tenants"], ["branding", "Branding"], ["integrations", "Integrations"], ["settings", "Bank settings"]] },
  { id: "account", name: "My account", group: "Hidden", icon: "i-user", desc: "Your own preferences", hidden: true, sections: [["settings", "Settings"]] },
];
const sysById = Object.fromEntries(SYS.map((s) => [s.id, s]));

/* ---------------- tenants: each bank licenses its own set of systems ---------------- */
const ALL = SYS.filter((s) => !s.hidden).map((s) => s.id);
const TENANTS = [
  { id: "virtual", name: "Demo Virtual Bank", mark: "VB", sub: "Digital only, retail and SME", systems: ALL.filter((x) => !["branch", "leasing", "trade", "treasury", "syndication"].includes(x)), pinned: ["workbench", "customers", "deposits", "lending", "payments", "collections"] },
  { id: "retail", name: "Demo Retail Bank", mark: "RB", sub: "Branches, retail lending and auto finance", systems: ALL.filter((x) => !["trade", "syndication"].includes(x)), pinned: ["workbench", "customers", "deposits", "lending", "leasing", "collections"] },
  { id: "commercial", name: "Demo Commercial Bank", mark: "CB", sub: "Corporate, trade and markets", systems: ALL, pinned: ["workbench", "customers", "lending", "leasing", "trade", "treasury"] },
];
let tenant = TENANTS.find((x) => x.id === store.get("fabor.tenant")) || TENANTS[1];
const has = (id) => id === "account" || tenant.systems.includes(id);
let tenantOpen = false, roleOpen = false, side = null;

/* ---------------- roles: who is signed in shapes the Workbench and the default pins ---------------- */
const ROLES = [
  { id: "ops", name: "Ploy Chaiyaporn", first: "Ploy", th: "พลอย", title: "Operations checker", av: "PC", pins: ["workbench", "customers", "deposits", "lending", "leasing", "collections"], needs: null },
  { id: "collector", name: "Nok Saelim", first: "Nok", th: "นก", title: "Collector", av: "NS", pins: ["workbench", "collections", "customers", "lending", "payments"],
    needs: [["collections", "Accounts in your queue", "42", "crit", "9 promises due today · oldest 144 days", "collections/queue"], ["collections", "Promises broken yesterday", "3", "warn", "Call before 12:00 to keep the cure rate", "collections/promises"], ["lending", "Loans to review for restructuring", "2", "warn", "LN-A-C10 and LN-A-C14, past 120 days", "rec:LN-A-C10"]] },
  { id: "credit", name: "Wanida Kaewmanee", first: "Wanida", th: "วนิดา", title: "Credit officer", av: "WK", pins: ["workbench", "customers", "lending", "leasing", "collections", "trade"],
    needs: [["lending", "Applications to decide", "14", "warn", "3 over your ฿2,000,000 authority go to committee", "lending/applications"], ["lending", "Restructuring proposals", "3", "info", "1 drafted by the RM copilot", "lending/restructuring"], ["collections", "Write-off waiting", "1", "crit", "LN-A-C14 · 135 days late", "collections/writeoffs"]] },
  { id: "product", name: "Krit Sombat", first: "Krit", th: "กฤษ", title: "Product maker", av: "KS", pins: ["workbench", "products", "finance", "lending", "leasing"],
    needs: [["products", "Drafts in progress", "3", "info", "EV_HP_NEW has not been simulated", "products/builder"], ["products", "Waiting for checkers", "1", "warn", "AUTO_HP_USED v2 with Compliance", "rec:AUTO_HP_USED_v2"], ["products", "Simulation failed", "1", "crit", "12 scenarios over the 15% cap on draft 1", "products/simulations"]] },
  { id: "finance", name: "Arunee Thongdee", first: "Arunee", th: "อรุณี", title: "Finance controller", av: "AT", pins: ["workbench", "finance", "treasury", "deposits", "lending", "ops"],
    needs: [["finance", "Regulatory reports due", "2", "warn", "AMLO CTR by 27 Oct · NPL Q3 by 15 Nov", "finance/reports"], ["finance", "Suspense to clear", "฿4,200.00", "warn", "ITMX break in GL 2990", "finance/recon"], ["finance", "Month-end loss allowance", "7 days", "info", "Run on 31 Oct after accrual", "finance/ecl"]] },
  { id: "teller", name: "Somsak Jaidee", first: "Somsak", th: "สมศักดิ์", title: "Teller · Branch 0123", av: "SJ", pins: ["workbench", "branch", "customers", "deposits", "lending"],
    needs: [["branch", "Customers waiting", "4", "warn", "Longest wait 9 minutes", "branch/bqueue"], ["branch", "Cash in your drawer", "฿294,835.00", "info", "Limit ฿500,000.00", "branch/drawer"], ["deposits", "Deposits above ฿2,000,000 today", "1", "warn", "Supervisor approval and AMLO report", "workbench/approvals"]] },
];
let role = ROLES.find((r) => r.id === store.get("fabor.role")) || ROLES[0];
/* ---------------- limits and authorities: what each role may do alone, and who approves above it ---------------- */
const ACTIONS = [["credit", "Credit approval", "Credit officer"], ["settle", "Early settlement", "Credit officer"], ["payout", "Payouts and dealer payoffs", "Head of operations"], ["cash", "Cash at the counter", "Branch manager"],
  ["restructure", "Restructuring", "Credit committee"], ["fx", "FX deals", "Head of dealing"], ["journal", "Manual journals", "Finance controller"]];
const AUTH = {
  ops: { credit: 0, settle: 2000000, payout: 5000000, cash: 2000000, restructure: 0, fx: 0, journal: 1000000 },
  collector: { settle: 0, payout: 0, cash: 0, restructure: 0, fx: 0, journal: 0 },
  credit: { credit: 2000000, settle: 5000000, payout: 0, cash: 0, restructure: 5000000, fx: 0, journal: 0 },
  product: { settle: 0, payout: 0, cash: 0, restructure: 0, fx: 0, journal: 0 },
  finance: { settle: 0, payout: 10000000, cash: 0, restructure: 0, fx: 0, journal: 50000000 },
  teller: { settle: 1000000, payout: 0, cash: 500000, restructure: 0, fx: 0, journal: 0 },
};
function authCheck(action, amount) {
  const lim = (AUTH[role.id] || {})[action] || 0, a = ACTIONS.find((x) => x[0] === action);
  return { ok: amount <= lim, lim, name: a[1], second: a[2] };
}
const pinKey = () => `fabor.pins.${tenant.id}.${role.id}`;
function pins() {
  try { const p = JSON.parse(store.get(pinKey()) || "null"); if (Array.isArray(p)) return p.filter(has); } catch {}
  const base = role.pins.filter(has);
  return base.length >= 3 ? base : [...new Set(base.concat(tenant.pinned.filter(has)))].slice(0, 6);
}
function togglePin(id) {
  const p = pins(), i = p.indexOf(id);
  if (i >= 0) p.splice(i, 1); else if (p.length < 8) p.push(id);
  store.set(pinKey(), JSON.stringify(p));
}
Object.assign(TH, {
  "Operations checker": "ผู้ตรวจปฏิบัติการ", "Collector": "เจ้าหน้าที่ติดตามหนี้", "Product maker": "ผู้ออกแบบผลิตภัณฑ์", "Finance controller": "ผู้ควบคุมการเงิน", "Teller · Branch 0123": "พนักงานสาขา · สาขา 0123",
  "Accounts in your queue": "บัญชีในคิวของคุณ", "9 promises due today · oldest 144 days": "นัดชำระครบวันนี้ 9 รายการ · เก่าสุด 144 วัน", "Promises broken yesterday": "ผิดนัดเมื่อวาน",
  "Call before 12:00 to keep the cure rate": "โทรก่อน 12:00 เพื่อรักษาอัตรากลับมาปกติ", "Loans to review for restructuring": "สัญญาที่ต้องพิจารณาปรับโครงสร้าง", "LN-A-C10 and LN-A-C14, past 120 days": "LN-A-C10 และ LN-A-C14 ค้างเกิน 120 วัน",
  "Applications to decide": "ใบสมัครรอพิจารณา", "3 over your ฿2,000,000 authority go to committee": "3 รายการเกินอำนาจ ฿2,000,000 ส่งคณะกรรมการ", "Restructuring proposals": "ข้อเสนอปรับโครงสร้างหนี้",
  "1 drafted by the RM copilot": "1 รายการร่างโดยผู้ช่วย RM", "Write-off waiting": "รอตัดหนี้สูญ", "LN-A-C14 · 135 days late": "LN-A-C14 · ค้าง 135 วัน", "Drafts in progress": "ฉบับร่างที่กำลังทำ",
  "EV_HP_NEW has not been simulated": "EV_HP_NEW ยังไม่ได้จำลอง", "Waiting for checkers": "รอผู้ตรวจ", "AUTO_HP_USED v2 with Compliance": "AUTO_HP_USED v2 อยู่ที่ฝ่ายกำกับ", "Simulation failed": "การจำลองไม่ผ่าน",
  "12 scenarios over the 15% cap on draft 1": "12 สถานการณ์เกินเพดาน 15% ในร่างที่ 1", "Regulatory reports due": "รายงานทางการที่ครบกำหนด", "AMLO CTR by 27 Oct · NPL Q3 by 15 Nov": "รายงาน ปปง. ภายใน 27 ต.ค. · NPL ไตรมาส 3 ภายใน 15 พ.ย.",
  "Suspense to clear": "บัญชีพักที่ต้องเคลียร์", "ITMX break in GL 2990": "รายการ ITMX ไม่ตรงใน GL 2990", "Month-end loss allowance": "ค่าเผื่อผลขาดทุนสิ้นเดือน", "7 days": "7 วัน", "Run on 31 Oct after accrual": "คำนวณ 31 ต.ค. หลังดอกเบี้ยค้างรับ",
  "Customers waiting": "ลูกค้ารอรับบริการ", "Longest wait 9 minutes": "รอนานสุด 9 นาที", "Cash in your drawer": "เงินสดในลิ้นชัก", "Limit ฿500,000.00": "วงเงิน ฿500,000.00", "Deposits above ฿2,000,000 today": "ฝากเงินเกิน ฿2,000,000 วันนี้",
  "Supervisor approval and AMLO report": "หัวหน้าอนุมัติและรายงาน ปปง.", "Signed in as": "เข้าระบบในชื่อ", "Preview as": "ดูในบทบาท", "Settings": "การตั้งค่า", "Bank settings": "การตั้งค่าธนาคาร", "My account": "บัญชีของฉัน",
  "Pin to rail": "ปักหมุดที่แถบ", "Unpin from rail": "เลิกปักหมุด", "Branch & Teller": "สาขาและเคาน์เตอร์", "Counter, cash drawer and branch queue": "เคาน์เตอร์ ลิ้นชักเงินสด และคิวสาขา",
  "Finance lease": "สัญญาเช่าการเงิน", "Fleet master agreement": "สัญญาหลักฟลีต", "Dealer": "ดีลเลอร์", "Term deposit": "เงินฝากประจำ", "Bank guarantee": "หนังสือค้ำประกัน", "Accounting": "การบัญชี",
  "Invoices": "ใบแจ้งหนี้", "Covenants": "เงื่อนไขทางการเงิน", "Performance": "ผลงาน", "Agreement": "สัญญา", "Security": "หลักประกัน", "Claims": "การเรียกร้อง", "Schedule ": "ตาราง",
  "Covenant": "เงื่อนไข", "Latest": "ล่าสุด", "Tested": "ทดสอบเมื่อ", "Vehicles ": "รถ", "Ends": "สิ้นสุด",
  "Reports & Analytics": "รายงานและการวิเคราะห์", "Portfolio, vintages, roll rates, reports": "พอร์ต วินเทจ อัตราไหล และรายงาน", "Portfolio": "พอร์ตสินเชื่อ", "Vintage": "วินเทจ", "Roll rates": "อัตราไหล", "Scheduled reports": "รายงานตามกำหนด",
  "Audience": "ผู้รับ", "Schedule": "กำหนดการ", "Next run": "รอบถัดไป", "Format": "รูปแบบ", "Paused": "หยุดชั่วคราว", "Hire purchase": "เช่าซื้อ",
  "Counter": "เคาน์เตอร์", "Cash drawer": "ลิ้นชักเงินสด", "Branch queue": "คิวสาขา", "End of day": "ปิดวัน", "Master Builder": "มาสเตอร์บิลเดอร์", "Product Studio": "สตูดิโอผลิตภัณฑ์",
});

/* ---------------- the loan with a full record page: LN-A-C10, computed so every figure agrees ---------------- */
const LOAN = (() => {
  const P = 85250, r = 0.15 / 12, pay = 6268.16, n = 15, rows = [];
  let bal = P;
  for (let i = 1; i <= n; i++) {
    const interest = r2(bal * r), principal = i === n ? bal : r2(pay - interest);
    bal = r2(bal - principal);
    rows.push({ n: i, due: Date.UTC(2026, i - 1, 2), interest, principal, amount: r2(interest + principal), balance: bal, state: i <= 5 ? "paid" : i <= 10 ? "overdue" : i === 11 ? "next" : "scheduled" });
  }
  const daysLate = (ms) => Math.round((BIZ - ms) / 864e5);
  const late = rows.filter((x) => x.state === "overdue");
  const principalOut = rows[4].balance;
  const billedInterest = r2(late.reduce((s, x) => s + x.interest, 0));
  const accrued = r2(rows[9].balance * 0.15 / 365 * daysLate(rows[9].due));
  const defaultInterest = r2(late.reduce((s, x) => s + x.principal * 0.03 / 365 * daysLate(x.due), 0));
  const overdue = r2(late.reduce((s, x) => s + x.amount, 0));
  const total = r2(principalOut + billedInterest + accrued + defaultInterest);
  return { P, pay, rows, late, daysLate, principalOut, billedInterest, accrued, defaultInterest, overdue, total, allowance: r2(total * 0.45), sav: 60458.20, valuation: 48000, costs: 3500 };
})();
const LATE_DAYS = LOAN.daysLate(LOAN.late[0].due);
const COLL = [
  [Date.UTC(2026, 5, 3), "SMS reminder sent", "Instalment 6 unpaid", "done"],
  [Date.UTC(2026, 5, 10), "Call, no answer", "Agent Nok · 2 attempts", "done"],
  [Date.UTC(2026, 6, 2), "Letter 1 sent", "To the registered address", "warn"],
  [Date.UTC(2026, 6, 15), "Promise of ฿12,000.00 by 31 Jul", "Customer cited a delayed salary · call by agent Nok", "done"],
  [Date.UTC(2026, 7, 1), "Promise broken", "Nothing received by 31 Jul", "crit"],
  [Date.UTC(2026, 8, 5), "Notice of default sent", "30 days to pay before termination", "crit"],
  [Date.UTC(2026, 9, 18), "Vehicle A4 repossessed", "Held for sale at the Bang Phli yard", "warn"],
  [BIZ, "Recommended: review for restructuring", "Collections policy, 120 or more days late", "now"],
];

// effective annual rate (%) for an amount financed repaid by n equal instalments
function effRate(fin, inst, n) {
  let lo = 0, hi = 0.1;
  for (let k = 0; k < 80; k++) { const m = (lo + hi) / 2, pv = inst * (1 - Math.pow(1 + m, -n)) / m; if (pv > fin) lo = m; else hi = m; }
  return (lo + hi) / 2;
}

/* ---------------- FP-DEMO: a dealer floor plan line with four vehicles ---------------- */
const FP = (() => {
  const limit = 6800000, rate = 0.065, billedTo = Date.UTC(2026, 9, 1), dealerBal = 2140000;
  const units = [
    { vin: "MR0HA3CD5P0100011", model: "Toyota Hilux Revo 2.4 Entry", drawn: Date.UTC(2026, 7, 2), amount: 742000, out: 742000, state: "floored" },
    { vin: "MR0HA3CD5P0100012", model: "Toyota Hilux Revo 2.8 Prerunner", drawn: Date.UTC(2026, 8, 15), amount: 968000, out: 968000, state: "floored" },
    { vin: "MR0HA3CD5P0100013", model: "Toyota Fortuner 2.4 V", drawn: Date.UTC(2026, 9, 1), amount: 1390000, out: 1390000, state: "sold", sold: Date.UTC(2026, 9, 22), due: Date.UTC(2026, 9, 26) },
    { vin: "JTEBU3FJ9PK020301", model: "Toyota Fortuner Legender 2.8", drawn: Date.UTC(2026, 5, 18), amount: 1500000, out: 1200000, state: "aged" },
  ];
  const days = (u) => Math.round((BIZ - u.drawn) / 864e5);
  const interestOf = (u) => r2(u.out * rate / 365 * Math.round((BIZ - Math.max(u.drawn, billedTo)) / 864e5));
  const payoff = (u) => { const i = interestOf(u); return { principal: u.out, interest: i, total: r2(u.out + i) }; };
  const inUse = units.reduce((s, u) => s + u.out, 0);
  return { limit, rate, units, days, interestOf, payoff, inUse, avail: limit - inUse, pct: Math.round(inUse / limit * 100), interest: r2(units.reduce((s, u) => s + interestOf(u), 0)), dealerBal };
})();

/* ---------------- HP-2025-004812: flat-rate hire purchase with a tiered rebate ---------------- */
const HP = (() => {
  const price = 850000, down = 127500, fin = 722500, flat = 0.0279, n = 60, paid = 22;
  const interest = r2(fin * flat * n / 12), inst = r2((fin + interest) / n), vat = r2(inst * 0.07);
  const r = effRate(fin, inst, n), rows = [];
  let bal = fin;
  for (let i = 1; i <= n; i++) {
    const int = r2(bal * r), prin = i === n ? bal : r2(inst - int);
    bal = r2(bal - prin);
    rows.push({ n: i, due: Date.UTC(2025, i - 1, 5), interest: int, principal: prin, amount: inst, balance: Math.max(0, bal), state: i <= paid ? "paid" : i === paid + 1 ? "next" : "scheduled" });
  }
  const remaining = n - paid, receivable = r2(inst * remaining), principalBal = rows[paid - 1].balance;
  const unearned = r2(receivable - principalBal), tier = paid <= n / 3 ? 0.6 : paid <= (2 * n) / 3 ? 0.7 : 1;
  const rebate = r2(unearned * tier), settle = r2(receivable - rebate), vatSettle = r2(settle * 0.07);
  return { price, down, fin, flat, n, paid, interest, inst, vat, eff: r * 12 * 100, rows, remaining, receivable, unearned, tier, rebate, settle, vatSettle, total: r2(settle + vatSettle) };
})();

/* ---------------- helpers that render in the current language ---------------- */
const P = (tone, text) => `<span class="pill ${tone}">${esc(t(text))}</span>`;
const R = (v) => `<span class="rec">${esc(v)}</span>`;
const who = (name) => `<span class="who"><span class="av">${esc(name.split(" ").map((w) => w[0]).slice(0, 2).join(""))}</span>${esc(t(name))}</span>`;
const lateP = (n) => n >= 90 ? P("crit", lang === "th" ? `ค้าง ${n} วัน` : `${n} days late`) : P("warn", lang === "th" ? `ค้าง ${n} วัน` : `Late · ${n} days`);
const chip = (sid) => `<span class="chip-sys">${icon(sysById[sid].icon)}${esc(t(sysById[sid].name))}</span>`;

const OVERVIEW = {
  customers: { kpis: [["Active customers", "418,206", "+1.2%", "up", 11], ["Onboarded this week", "2,914", "+8.4%", "up", 12], ["KYC reviews due", "4", "−3", "up", 13], ["Consents withdrawn", "37", "+5", "down", 14]],
    chart: ["New customers per day", "Retail and SME, last 30 days", 2, 360, 1.2, 60], side: ["By segment", [["Retail", 78, ""], ["SME", 15, ""], ["Corporate", 4, ""], ["Virtual only", 3, ""]]] },
  deposits: { kpis: [["Total deposits", "฿48.21bn", "+1.8%", "up", 21], ["Accounts", "412,880", "+0.6%", "up", 22], ["Term deposits maturing (7d)", "฿612.4m", "312 deposits", "flat", 23], ["Cost of funds", "1.42%", "−4 bp", "up", 24]],
    chart: ["Deposit balance", "฿bn, last 30 days", 3, 47.3, 0.03, 0.4], side: ["Mix", [["Savings", 54, ""], ["Current", 21, ""], ["Term", 22, ""], ["Foreign currency", 3, ""]]] },
  lending: { kpis: [["Loans outstanding", "฿31.74bn", "+2.6%", "up", 31], ["Applications today", "184", "+12%", "up", 32], ["Approval rate", "68.4%", "−1.1 pt", "down", 33], ["NPL ratio", "2.14%", "+0.07 pt", "down", 34]],
    chart: ["Disbursements", "฿m per day, last 30 days", 4, 88, 0.8, 24], side: ["Book by product", [["Personal loans", 38, ""], ["Home loans", 31, ""], ["SME term loans", 22, ""], ["Overdrafts", 9, ""]]] },
  leasing: { kpis: [["Net investment in leases", "฿9.86bn", "+3.1%", "up", 41], ["Vehicles financed", "21,408", "+412", "up", 42], ["Floor plan in use", "92%", "FP-DEMO near limit", "down", 43], ["Assets without cover", "3", "renew this week", "down", 44]],
    chart: ["New contracts", "Hire purchase and leases per day", 5, 58, 0.5, 16], side: ["Dealer lines in use", [["Bangna Motors", 92, "crit"], ["Rama 9 Trucks", 71, "warn"], ["Chiang Mai Auto", 44, ""], ["Korat Isuzu", 28, ""]]] },
  collections: { kpis: [["Accounts in arrears", "4,812", "+2.3%", "down", 51], ["Overdue amount", "฿412.6m", "+1.9%", "down", 52], ["Promises kept (30d)", "71%", "+4 pt", "up", 53], ["Cured this month", "1,206", "+9%", "up", 54]],
    chart: ["Roll rate 30 → 60 days", "% of accounts, last 30 days", 6, 14.5, -0.06, 1.4], side: ["By bucket", [["1–29 days", 61, "warn"], ["30–59 days", 21, "warn"], ["60–89 days", 9, "crit"], ["90+ days", 9, "crit"]]] },
  payments: { kpis: [["PromptPay today", "1.84m", "+6%", "up", 61], ["Value settled", "฿21.4bn", "+3%", "up", 62], ["ITMX breaks", "1", "฿4,200.00", "down", 63], ["Straight-through rate", "99.6%", "+0.1 pt", "up", 64]],
    chart: ["Transfers per minute", "Today, all channels", 7, 1800, 8, 500], side: ["Rails", [["PromptPay", 72, ""], ["BAHTNET", 9, ""], ["Bill payment", 14, ""], ["SWIFT", 5, ""]]] },
  trade: { kpis: [["LCs outstanding", "$184.2m", "+4%", "up", 71], ["Guarantees issued", "฿2.31bn", "+1%", "up", 72], ["Documents under review", "23", "5 discrepant", "down", 73], ["Expiring in 30 days", "14", "", "flat", 74]],
    chart: ["Trade volume", "$m per day", 8, 21, 0.12, 5], side: ["By product", [["Import LC", 46, ""], ["Export LC", 21, ""], ["Bank guarantees", 27, ""], ["Collections", 6, ""]]] },
  treasury: { kpis: [["LCR", "148%", "min 100%", "up", 81], ["Net stable funding", "126%", "min 100%", "up", 82], ["FX open position", "$12.4m", "limit $25m", "flat", 83], ["Nostro match rate", "97.8%", "1 break", "down", 84]],
    chart: ["High-quality liquid assets", "฿bn, last 30 days", 9, 12.2, 0.02, 0.3], side: ["FX exposure by currency", [["USD", 58, ""], ["EUR", 17, ""], ["JPY", 14, ""], ["CNY", 11, ""]]] },
  syndication: { kpis: [["Agency deals", "18", "+2", "up", 91], ["Commitments", "฿60.0bn", "", "flat", 92], ["Drawn", "฿36.0bn", "60%", "flat", 93], ["Fees due (30d)", "฿18.6m", "", "flat", 94]],
    chart: ["Drawn balance", "฿bn across agency deals", 10, 34, 0.07, 0.5], side: ["Our share by deal", [["Siam Energy 2026", 35, ""], ["EEC Port", 22, ""], ["Bangkok Metro Ext.", 18, ""], ["Others", 25, ""]]] },
  products: { kpis: [["Products live", "46", "+2 this quarter", "up", 101], ["Drafts", "7", "3 in review", "flat", 102], ["Simulated scenarios", "1,200", "per version", "flat", 103], ["Rule packs", "4", "TH-HP-VEHICLE-v1", "flat", 104]],
    chart: ["Contracts opened on new versions", "per day", 11, 36, 0.6, 12], side: ["Live products by family", [["Lending", 41, ""], ["Deposits", 33, ""], ["Asset finance", 20, ""], ["Trade", 6, ""]]] },
  finance: { kpis: [["Postings today", "3,872,934", "Σ debit = Σ credit", "flat", 111], ["Loss allowance (ECL)", "฿1.42bn", "+฿18.6m", "down", 112], ["Stage 3 share", "2.14%", "of the book", "down", 113], ["Sub-ledger vs GL", "฿0.00", "reconciled 06:00", "up", 114]],
    chart: ["Loss allowance", "฿m, last 30 days", 12, 1385, 1.2, 10], side: ["ECL by stage", [["Stage 1", 41, ""], ["Stage 2", 23, "warn"], ["Stage 3", 36, "crit"]]] },
  ops: { kpis: [["Tasks due now", "0", "queue drained", "up", 121], ["Tasks today", "1.92m", "billing, accrual, aging", "flat", 122], ["Dead letters", "2", "needs review", "down", 123], ["Posting p99", "18 ms", "target < 50 ms", "up", 124]],
    chart: ["Scheduler throughput", "tasks per second", 13, 2600, 4, 500], side: ["Work by type", [["Accrual", 52, ""], ["Billing", 23, ""], ["Aging and penalties", 17, ""], ["Capitalisation", 8, ""]]] },
  agents: { kpis: [["Proposals waiting", "5", "for a checker", "flat", 131], ["Accepted (30d)", "214", "86%", "up", 132], ["Blocked by policy", "9", "", "flat", 133], ["Hours saved (30d)", "412", "", "up", 134]],
    chart: ["Proposals per day", "across all agents", 14, 7, 0.12, 3], side: ["By agent", [["Reconciliation", 38, ""], ["Collections", 27, ""], ["RM copilot", 21, ""], ["KYC", 14, ""]]] },
};

// lists are built on each render so they follow the language
function lists() {
  const base = {
    "customers/directory": { cols: ["Customer", "Party id", "Segment", "Products", "KYC", "Since"], rows: [
      [who("Somchai Prasert"), R("C10"), "Retail", "Savings · Loan", P("good", "Verified"), "1 Dec 2025"], [who("Siam Freight Logistics"), R("B-2031"), "Corporate", "Fleet · Trade · Deposits", P("good", "Verified"), "11 Jan 2024"],
      [who("Malee Wongsa"), R("C11"), "Retail", "Savings · Loan", P("warn", "Review due"), "20 Jul 2026"], [who("Bangna Motors"), R("D-0007"), "SME", "Floor plan · Current", P("good", "Verified"), "3 Jun 2025"],
      [who("Pimchanok Rattana"), R("C13"), "Virtual only", "Savings · Loan", P("good", "Verified"), "15 Oct 2026"]] },
    "customers/onboarding": { cols: ["Application", "Applicant", "Channel", "Step", "Waiting", "State"], rows: [
      [R("ONB-7731"), who("Napat Srisuk"), "Branch 0123", "Liveness check", "4 min", P("info", "In progress")], [R("ONB-7728"), who("Wanida Kaewmanee"), "Branch 0123", "Sanctions and PEP", "18 min", P("warn", "Possible match")],
      [R("ONB-7733"), who("Thanakorn Ruang"), "App", "Consents", "1 min", P("info", "In progress")], [R("ONB-7690"), who("Korat Isuzu Co., Ltd."), "RM", "Beneficial owners", "2 days", P("warn", "Documents missing")]] },
    "customers/kyc": { cols: ["Customer", "Reason", "Risk", "Due", "Owner"], rows: [
      [who("Malee Wongsa"), "Periodic review", P("good", "Low"), "31 Oct 2026", "KYC team"], [who("Siam Energy PCL"), "Ownership change", P("warn", "Medium"), "28 Oct 2026", "Wanida K."],
      [who("Pacific Import Trading"), "Adverse media", P("crit", "High"), "25 Oct 2026", "Compliance"], [who("Anan Chaiyo"), "Address changed", P("good", "Low"), "6 Nov 2026", "KYC team"]] },
    "deposits/accounts": { cols: ["Account", "Customer", "Product", "Balance", "Rate", "Status"], rows: [
      [R("SAV-C10"), t("Somchai Prasert"), "Savings Standard", baht(LOAN.sav), "0.50%", P("good", "Active")], [R("CUR-B2031"), t("Siam Freight Logistics"), "Business Current", baht(18240612), "—", P("good", "Active")],
      [R("SAV-C14"), t("Kittipong Siri"), "Savings Standard", baht(1003806.11), "0.50%", P("good", "Active")], [R("SAV-P9"), "Arthit Wong", "Savings Standard", baht(0), "0.50%", P("warn", "Dormant")],
      [R("FCD-B2031"), t("Siam Freight Logistics"), "USD Deposit", "$412,880.00", "1.10%", P("good", "Active")]] },
    "deposits/term": { cols: ["Deposit", "Customer", "Principal", "Rate", "Matures", "At maturity"], rows: [
      [R("TD-88102"), t("Malee Wongsa"), baht(500000), "2.10%", "27 Oct 2026", "Roll over"], [R("TD-88140"), "Siam Energy PCL", baht(120000000), "2.45%", "29 Oct 2026", "Pay to current"],
      [R("TD-88201"), t("Anan Chaiyo"), baht(200000), "2.00%", "3 Nov 2026", "Ask customer"], [R("TD-88244"), t("Pimchanok Rattana"), baht(1000000), "2.25%", "12 Nov 2026", "Roll over"]] },
    "lending/applications": { cols: ["Application", "Applicant", "Product", "Amount", "Score", "Decision"], rows: [
      [R("APP-30412"), "Thanakorn Ruang", t("Personal loan"), baht(150000), "702", P("good", "Approved")], [R("APP-30413"), "Napat Srisuk", "Car hire purchase", baht(890000), "655", P("info", "Needs documents")],
      [R("APP-30414"), "Korat Isuzu Co., Ltd.", "SME term loan", baht(12000000), "—", P("warn", "Credit committee")], [R("APP-30415"), "Arthit Wong", t("Personal loan"), baht(80000), "541", P("crit", "Declined")]] },
    "lending/loans": { cols: ["Loan", "Customer", "Product", "Outstanding", "Overdue", "Status"], rows: [
      [R("LN-A-C10"), t("Somchai Prasert"), t("Personal loan"), baht(LOAN.principalOut), baht(LOAN.overdue), lateP(LATE_DAYS)], [R("LN-A-C11"), t("Malee Wongsa"), t("Personal loan"), baht(95000), baht(26128.80), lateP(65)],
      [R("LN-A-C13"), t("Pimchanok Rattana"), t("Personal loan"), baht(125000), "—", P("good", "Active")], [R("MS-1"), t("Siam Freight Logistics"), t("Fleet schedule"), baht(67219.50), "—", P("good", "Active")],
      [R("LN-A-C14"), t("Kittipong Siri"), t("Personal loan"), baht(140000), baht(64201.65), P("crit", "Non-accrual")]] },
    "lending/restructuring": { cols: ["Loan", "Customer", "Proposal", "New rate", "Term", "Status"], rows: [
      [R("TL-2024-000311"), t("Siam Freight Logistics"), "Rate cut, term extension", "5.25%", "60 months", P("info", "AI proposal · checker")], [R("LN-A-C14"), t("Kittipong Siri"), "Capitalise arrears", "9.00%", "18 months", P("warn", "Credit officer")],
      [R("LN-77120"), t("Anan Chaiyo"), "Payment holiday 2 months", "—", "+2", P("good", "Approved")]] },
    "leasing/leases": { cols: ["Lease", "Lessee", "Kind", "Net investment", "Due now", "Status"], rows: [
      [R("F1"), t("Siam Freight Logistics"), "Finance", baht(4910765), baht(0), P("", "Terminated")], [R("F2"), t("Malee Wongsa"), "Finance", baht(LEASE.ni), baht(LEASE.due), P("warn", "Arrears")],
      [R("O1"), t("Anan Chaiyo"), "Operating", "—", baht(5000), P("good", "Active")], [R("O2"), t("Bangna Motors"), "Operating", "—", baht(0), P("good", "Active")]] },
    "leasing/fleet": { cols: ["Agreement", "Customer", "Schedules", "In use", "Invoice", "Status"], rows: [
      [R("MA-1"), t("Siam Freight Logistics"), "2", "฿112,498.98 of ฿500,000.00", baht(0), P("good", "Active")], [R("MA-2025-0031"), "Thai Cold Chain", "4", "฿61.4m of ฿80.0m", baht(2180440), P("good", "Active")],
      [R("MA-2026-0007"), "EEC Logistics", "1", "฿8.2m of ฿20.0m", baht(410120), P("warn", "Cross-default watch")]] },
    "leasing/floorplan": { cols: ["Line", "Dealer", "In use", "Due now", "Sold, not paid off", "Status"], rows: [
      [R("FP-DEMO"), t("Bangna Motors"), FP.pct + "%", baht(FP.interest), "1", P("warn", "Payoff due")], [R("FP-1"), t("Bangna Motors"), "3%", baht(2086.03), "0", P("good", "Active")],
      [R("FP-2026-0011"), t("Rama 9 Trucks"), "71%", baht(48211.60), "1", P("crit", "Payoff overdue")]] },
    "leasing/assets": { cols: ["Asset", "Vehicle", "Registration", "Contract", "Cover", "Status"], rows: [
      [R("A2"), "Toyota Hilux Revo", "2ขข 5678", "LN-APP1", P("crit", "No cover"), P("good", "Active")], [R("A3"), "Hino 500 FG", "5ขค 1234", "LN-APP2", P("good", "Viriyah · Sep 2027"), P("", "Disposed")],
      [R("A4"), "Mitsubishi Triton", "4กก 4444", "LN-A-C10", P("warn", "Expires 3 Nov"), P("warn", "Repossessed")]] },
    "leasing/dealers": { cols: ["Dealer", "Name", "Commission", "Lines", "Paid this month", "Status"], rows: [
      [R("DLR-1"), t("Bangna Motors"), "2.00%", "2", baht(9690000), P("good", "Active")], [R("DLR-2"), t("Rama 9 Trucks"), "1.50%", "1", baht(0), P("good", "Active")]] },
    "leasing/hp": { cols: ["Contract", "Hirer", "Vehicle", "Outstanding", "Rebate rule", "Status"], rows: [
      [R("HP-2025-004812"), "Napat Srisuk", "Toyota Hilux Revo 2.4", baht(HP.receivable), "Tiered 60/70/100", P("good", "Active")], [R("HP-2026-000233"), t("Anan Chaiyo"), "Honda City", baht(381220), "Tiered 60/70/100", lateP(12)]] },
    "collections/queue": { cols: ["Loan", "Customer", "Days late", "Overdue", "Next step", "Promise"], rows: [
      [R("LN-A-C10"), t("Somchai Prasert"), String(LATE_DAYS), baht(LOAN.overdue), P("crit", "Review for restructuring"), "—"], [R("LN-A-C14"), t("Kittipong Siri"), "135", baht(64201.65), P("crit", "Review for restructuring"), "—"],
      [R("LN-A-C11"), t("Malee Wongsa"), "65", baht(26128.80), P("warn", "Send letter"), P("info", lang === "th" ? "ภายใน 31 ต.ค." : "By 31 Oct")], [R("LN-A-C12"), t("Anan Chaiyo"), "29", baht(10084.80), P("info", "Remind"), "—"]] },
    "collections/promises": { cols: ["Loan", "Customer", "Promised", "Pay by", "Made", "State"], rows: [
      [R("LN-A-C11"), t("Malee Wongsa"), baht(5000), "31 Oct 2026", "24 Oct 2026", P("info", "Open ")], [R("LN-77012"), "Arthit Wong", baht(12000), "20 Oct 2026", "13 Oct 2026", P("crit", "Broken")],
      [R("LN-76998"), "Suda Panya", baht(8400), "18 Oct 2026", "11 Oct 2026", P("good", "Kept")]] },
    "collections/repossessions": { cols: ["Case", "Loan", "Asset", "Taken", "Outcome", "State"], rows: [
      [R("R-A4"), "LN-A-C10", "A4 · Mitsubishi Triton", "18 Oct 2026", "—", P("warn", "Held for sale")], [R("R1"), "LN-APP1", "A1 · Isuzu D-Max", "26 Sep 2026", "Shortfall ฿15,211.04", P("good", "Sold")],
      [R("R-A3"), "LN-A-C12", "A3 · Hino 500 FG", "12 Sep 2026", "Surplus ฿46,496.33", P("good", "Sold")]] },
    "payments/recon": { cols: ["File", "Rail", "Items", "Difference", "Proposed match", "State"], rows: [
      [R("ITMX 24 Oct 05:00"), "PromptPay", "1,204,118", baht(4200), t("Reconciliation agent"), P("warn", "Review")], [R("BAHTNET 23 Oct"), "BAHTNET", "3,912", baht(0), "—", P("good", "Matched")]] },
    "trade/lc": { cols: ["LC", "Applicant", "Beneficiary", "Amount", "Expiry", "State"], rows: [
      [R("LC-26-0412"), t("Siam Freight Logistics"), "Hino Motors (JP)", "$2,400,000.00", "30 Dec 2026", P("good", "Issued")], [R("LC-26-0418"), "Pacific Import Trading", "Shenzhen Elec.", "$418,500.00", "12 Nov 2026", P("warn", "Discrepant documents")]] },
    "treasury/fx": { cols: ["Currency", "Position", "Limit", "Use", "MTM P&L", "State"], rows: [
      [R("USD"), "$12,400,000", "$25,000,000", "50%", baht(412880), P("good", "Within limit")], [R("JPY"), "¥288,000,000", "¥500,000,000", "58%", baht(-91240), P("good", "Within limit")]] },
    "syndication/deals": { cols: ["Deal", "Borrower", "Commitment", "Drawn", "Our share", "Next fee"], rows: [
      [R("SYN-001"), "Siam Energy PCL", baht(6000000000, 0), "60%", "35%", "1 Nov 2026"], [R("SYN-004"), "EEC Port Co.", baht(12000000000, 0), "41%", "22%", "15 Nov 2026"]] },
    "products/catalogue": { cols: ["Product", "Code", "Family", "Version", "Contracts", "State"], rows: [
      [t("Personal loan"), R("PERSONAL_LOAN_STD"), "Lending", "v1", "11", P("good", "Live")], [t("Savings Standard"), R("SAVINGS_STD"), "Deposits", "v1", "9", P("good", "Live")],
      ["Car hire purchase, new", R("CAR_HP_NEW"), "Asset finance", "v3", "4,812", P("good", "Live")], ["Used car hire purchase", R("AUTO_HP_USED"), "Asset finance", "v2", "—", P("info", "In review")]] },
    "finance/ecl": { cols: ["Loan", "Stage", "Exposure", "PD", "LGD", "Allowance"], rows: [
      [R("LN-A-C14"), P("crit", "Stage 3"), baht(140000), "100%", "45%", baht(63000)], [R("LN-A-C10"), P("crit", "Stage 3"), baht(LOAN.total), "100%", "45%", baht(LOAN.allowance)],
      [R("LN-A-C11"), P("warn", "Stage 2"), baht(121128.80), "3.72%", "45%", baht(1960.24)], [R("MS-1"), P("good", "Stage 1"), baht(67219.50), "2.68%", "45%", baht(798.71)]] },
    "finance/gl": { cols: ["GL", "Name", "Type", "Debit", "Credit", "Net"], rows: [
      [R("1300"), "Loans receivable", "Asset", baht(31744120000, 0), "—", baht(31744120000, 0)], [R("1390"), "Loss allowance on loans", "Asset (contra)", "—", baht(1420180000, 0), baht(-1420180000, 0)],
      [R("2310"), "VAT payable", "Liability", "—", baht(48211640, 0), baht(-48211640, 0)], [R("5300"), "Expected credit loss expense", "Expense", baht(18611200, 0), "—", baht(18611200, 0)]] },
    "ops/scheduler": { cols: ["Task", "Type", "Due", "Attempts", "Last error", "State"], rows: [
      [R("bill:LN-A-C13:2"), "Billing", "15 Nov 2026", "0", "—", P("info", "Queued")], [R("accrue:MS-4"), "Accrual", "25 Oct 2026", "0", "—", P("info", "Queued")],
      [R("capitalize:SAV-P9"), "Capitalisation", "1 Nov 2026", "5", "Account dormant", P("crit", "Dead letter")]] },
    "agents/proposals": { cols: ["Proposal", "Agent", "For", "Change", "Policy check", "State"], rows: [
      [R("AP-1182"), "RM copilot", "Wanida K.", "Restructure TL-2024-000311", P("good", "Within authority"), P("info", "Waiting for checker")], [R("AP-1183"), "Reconciliation", "Treasury ops", "Match ITMX break ฿4,200.00", P("good", "Passed"), P("info", "Waiting for checker")],
      [R("AP-1179"), "Collections", "Agent pool", "Promise plan for 214 accounts", P("warn", "Needs supervisor"), P("warn", "Escalated")]] },
    "admin/users": { cols: ["User", "Roles", "Systems", "Last seen", "MFA", "State"], rows: [
      [who("Ploy Chaiyaporn"), "ops, checker", "Workbench, Lending, Collections", "now", P("good", "On"), P("good", "Active")], [who("Krit Sombat"), "product-maker", "Product Factory", "2 h", P("good", "On"), P("good", "Active")],
      [who("Wanida Kaewmanee"), "RM, credit-officer", "Customers, Lending, Trade", "12 min", P("good", "On"), P("good", "Active")]] },
    "admin/tenants": { cols: ["Tenant", "Name", "Systems", "Users", "Region", "State"], rows: TENANTS.map((x) => [R(x.mark), esc(t(x.name)), String(x.systems.length), x.id === "commercial" ? "1,240" : x.id === "retail" ? "3,912" : "184", "TH", P("good", "Active")]) },
  };
  return Object.assign(base, moreLists());
}

// the sections that complete every system
function moreLists() {
  const W = (sid) => (has(sid) ? chip(sid) : "");
  const tasks = [["Call back about restructuring", "collections", "LN-A-C10", "24 Oct 2026", "High ", "Open "], ["Confirm stock audit results", "leasing", "FP-DEMO", "24 Oct 2026", "High ", "Open "],
    ["Check documents for car hire purchase", "lending", "APP-30413", "25 Oct 2026", "Medium", "Open "], ["Approve cash deposit above ฿2,000,000", "branch", "TX-0123-8841", "24 Oct 2026", "High ", "Waiting for you"],
    ["Periodic KYC review", "customers", "C11", "31 Oct 2026", "Low", "Open "], ["Reply to compliance on AUTO_HP_USED v2", "products", "AUTO_HP_USED v2", "26 Oct 2026", "Medium", "Open "]].filter((x) => has(x[1]));
  const recs = recentRecs.length ? recentRecs : [{ rec: "LN-A-C10", at: null }, { rec: "FP-DEMO", at: null }];
  return Object.assign({
    "workbench/tasks": { cols: ["Task", "System", "Record", "Due", "Priority", "State"], rows: tasks.map(([a, s, r, d, p, st]) => [esc(t(a)), W(s), R(r), d, P(p.trim() === "High" ? "crit" : p === "Medium" ? "warn" : "", p), P(st === "Waiting for you" ? "warn" : "info", st)]) },
    "workbench/recent": { cols: ["Record", "Type", "System", "Viewed"], rows: recs.filter((x) => RECS[x.rec] && has(RECS[x.rec].sys)).map((x) => [R(RECS[x.rec].label), esc(t(RECS[x.rec].kind)), W(RECS[x.rec].sys), x.at ? new Date(x.at).toTimeString().slice(0, 5) : "—"]) },
    "deposits/interest": { cols: ["Product", "Tier", "Rate", "Fee", "Effective", "State"], rows: [
      ["Savings Standard", "Up to ฿1,000,000", "0.50%", "—", "1 Jul 2026", P("good", "Live")], ["Savings Standard", "Above ฿1,000,000", "0.75%", "—", "1 Jul 2026", P("good", "Live")],
      ["Term deposit 6 months", "All balances", "1.90%", "—", "1 Jul 2026", P("good", "Live")], ["Term deposit 12 months", "All balances", "2.25%", "—", "1 Jul 2026", P("good", "Live")],
      ["Business Current", "—", "0.00%", "฿100.00 a month", "1 Jan 2026", P("good", "Live")], ["Dormant account fee", "After 2 years", "—", "฿50.00 a year", "1 Jan 2027", P("info", "Waiting for checker")]] },
    "deposits/statements": { cols: ["Account", "Customer", "Period", "Channel", "Sent", "State"], rows: [
      [R("SAV-C10"), t("Somchai Prasert"), "Sep 2026", "e-Statement", "1 Oct 2026", P("good", "Delivered")], [R("CUR-B2031"), t("Siam Freight Logistics"), "Sep 2026", "Encrypted PDF by email", "1 Oct 2026", P("good", "Delivered")],
      [R("SAV-P9"), "Arthit Wong", "Sep 2026", "Post", "2 Oct 2026", P("warn", "Returned")]] },
    "lending/disbursements": { cols: ["Disbursement", "Loan", "Customer", "Amount", "To", "State"], rows: [
      [R("DSB-55102"), "LN-A-C13", t("Pimchanok Rattana"), baht(125000), "SAV-C13", P("good", "Paid")], [R("DSB-55103"), "MS-4", t("Siam Freight Logistics"), baht(45279.48), t("Bangna Motors"), P("good", "Paid")],
      [R("DSB-55110"), "APP-30412", "Thanakorn Ruang", baht(150000), "PromptPay 08x-xxx-4412", P("warn", "Waiting for signature")]] },
    "collections/writeoffs": { cols: ["Loan", "Customer", "Days late", "Amount", "Recovery expected", "State"], rows: [
      [R("LN-A-C14"), t("Kittipong Siri"), "135", baht(140000), baht(12000), P("info", "Waiting for checker")], [R("LN-61022"), "Suda Panya", "372", baht(48211.60), baht(0), P("", "Written off")],
      [R("LN-60110"), "Arthit Wong", "401", baht(22104), baht(4000), P("", "Sold to AMC")]] },
    "payments/transfers": { cols: ["Transfer", "From", "To", "Amount", "Rail", "State"], rows: [
      [R("TR-9918201"), "SAV-C10", "PromptPay 08x-xxx-1180", baht(2500), "PromptPay", P("good", "Settled")], [R("TR-9918202"), "CUR-B2031", "KBank 123-4-56789-0", baht(2480000), "BAHTNET", P("info", "Waiting for checker")],
      [R("TR-9918203"), "FCD-B2031", "Hino Motors (JP)", "$240,000.00", "SWIFT", P("warn", "Screening")]] },
    "payments/promptpay": { cols: ["Proxy", "Type", "Account", "Registered", "Transfers (30d)", "State"], rows: [
      [R("08x-xxx-1180"), "Mobile", "SAV-C10", "1 Dec 2025", "41", P("good", "Active")], [R("1-1020-xxxxx-55-1"), "National ID", "SAV-C14", "11 Jan 2025", "12", P("good", "Active")],
      [R("0105556xxxxxx"), "Tax id", "CUR-B2031", "2 Feb 2024", "1,204", P("good", "Active")]] },
    "payments/limits": { cols: ["Limit", "Applies to", "Per transaction", "Per day", "Used today", "State"], rows: [
      ["Retail PromptPay", "All retail customers", baht(50000, 0), baht(200000, 0), "38%", P("good", "Active")], ["Corporate BAHTNET", "CUR-B2031", baht(50000000, 0), baht(200000000, 0), "12%", P("good", "Active")],
      ["New device cooling-off", "First 24 hours", baht(5000, 0), baht(5000, 0), "—", P("info", "Fraud rule")]] },
  }, moreLists2(W));
}
function moreLists2(W) {
  return {
    "trade/guarantees": { cols: ["Guarantee", "Applicant", "Beneficiary", "Amount", "Expiry", "State"], rows: [
      [R("BG-26-1102"), t("Siam Freight Logistics"), "Port Authority of Thailand", baht(12000000), "31 Dec 2027", P("good", "Issued")], [R("BG-26-1108"), "EEC Logistics", "PTT PCL", baht(4500000), "30 Jun 2027", P("crit", "Claim received")]] },
    "trade/docs": { cols: ["Collection", "Drawer", "Drawee", "Amount", "Terms", "State"], rows: [
      [R("DC-26-0301"), "Thai Cold Chain", "Tokyo Foods KK", "$86,200.00", "D/P", P("info", "Sent to collecting bank")], [R("DC-26-0305"), "Thai Cold Chain", "Osaka Trading", "$41,900.00", "D/A 60 days", P("good", "Accepted")]] },
    "treasury/liquidity": { cols: ["Bucket", "Inflows", "Outflows", "Net", "Cumulative", "State"], rows: [
      ["Overnight", "฿4.20bn", "฿3.10bn", "฿1.10bn", "฿1.10bn", P("good", "Within limit")], ["2–7 days", "฿6.80bn", "฿7.40bn", "−฿0.60bn", "฿0.50bn", P("good", "Within limit")],
      ["8–30 days", "฿9.10bn", "฿10.30bn", "−฿1.20bn", "−฿0.70bn", P("warn", "Watch")], ["1–3 months", "฿14.60bn", "฿12.20bn", "฿2.40bn", "฿1.70bn", P("good", "Within limit")]] },
    "treasury/nostro": { cols: ["Nostro", "Bank", "Currency", "Our books", "Their statement", "State"], rows: [
      [R("NOS-USD-01"), "Citibank New York", "USD", "$41,220,118.20", "$41,220,118.20", P("good", "Matched")], [R("NOS-JPY-01"), "MUFG Tokyo", "JPY", "¥1,204,880,000", "¥1,204,880,000", P("good", "Matched")],
      [R("NOS-EUR-01"), "Deutsche Bank Frankfurt", "EUR", "€3,418,200.00", "€3,417,000.00", P("crit", "Break")]] },
    "syndication/participants": { cols: ["Participant", "Deal", "Commitment", "Share", "Drawn", "State"], rows: [
      ["Fabor Demo Bank (agent)", "SYN-001", baht(2100000000, 0), "35%", "60%", P("good", "Active")], ["Bangkok Bank", "SYN-001", baht(1800000000, 0), "30%", "60%", P("good", "Active")],
      ["Krungsri", "SYN-001", baht(1200000000, 0), "20%", "60%", P("good", "Active")], ["Siam Commercial Bank", "SYN-001", baht(900000000, 0), "15%", "60%", P("good", "Active")]] },
    "syndication/fees": { cols: ["Fee", "Deal", "Type", "Amount", "Due", "State"], rows: [
      [R("FEE-7101"), "SYN-001", "Commitment fee 0.25%", baht(6000000), "1 Nov 2026", P("info", "Scheduled")], [R("FEE-7102"), "SYN-004", "Agency fee", baht(1500000), "15 Nov 2026", P("info", "Scheduled")],
      [R("FEE-7088"), "SYN-001", "Commitment fee 0.25%", baht(6000000), "1 Oct 2026", P("good", "Paid")]] },
    "products/master": { cols: ["Template", "Family", "Building blocks", "Products using it", "Rule pack", "State"], rows: [
      [R("TPL-HP-VEHICLE"), "Asset finance", "9", "3", "TH-HP-VEHICLE-v1", P("good", "Live")], [R("TPL-PERSONAL-LOAN"), "Lending", "7", "2", "TH-CONSUMER-v1", P("good", "Live")],
      [R("TPL-SAVINGS"), "Deposits", "5", "3", "—", P("good", "Live")], [R("TPL-LEASE-TFRS16"), "Asset finance", "8", "2", "TH-LEASE-v1", P("good", "Live")], [R("TPL-TERM-DEPOSIT"), "Deposits", "6", "0", "—", P("info", "Draft")]] },
    "products/builder": { cols: ["Draft", "Template", "Maker", "Last change", "Simulation", "State"], rows: [
      [R("AUTO_HP_USED v2"), "TPL-HP-VEHICLE", "Krit S.", "24 Oct 2026", P("good", "Passed"), P("info", "In review")], [R("EV_HP_NEW v1"), "TPL-HP-VEHICLE", "Krit S.", "22 Oct 2026", P("", "Not run"), P("", "Draft")],
      [R("SAVINGS_KIDS v1"), "TPL-SAVINGS", "Krit S.", "18 Oct 2026", P("good", "Passed"), P("", "Draft")]] },
    "products/simulations": { cols: ["Run", "Product", "Scenarios", "Passed ", "Failed", "State"], rows: [
      [R("SIM-2210"), "AUTO_HP_USED v2", "1,200", "1,200", "0", P("good", "Passed")], [R("SIM-2207"), "AUTO_HP_USED v2 draft 1", "1,200", "1,188", "12", P("crit", "Failed")],
      [R("SIM-2199"), "CAR_HP_NEW v3", "1,200", "1,200", "0", P("good", "Passed")]] },
    "products/papprovals": { cols: ["Product", "Version", "Maker", "Needs", "Waiting", "State"], rows: [
      [R("AUTO_HP_USED v2"), "v2", "Krit S.", "Risk ✓ · Compliance", "2 h", P("info", "Waiting for checker")], [R("SAVINGS_STD v2"), "v2", "Krit S.", "Finance · Compliance", "1 day", P("info", "Waiting for checker")],
      [R("TPL-TERM-DEPOSIT v1"), "v1", "Krit S.", "Architecture board", "3 days", P("warn", "Escalated")]] },
    "finance/recon": { cols: ["Ledger", "GL", "Sub-ledger", "GL balance", "Difference", "State"], rows: [
      ["Loans", R("1300"), baht(31744120000, 0), baht(31744120000, 0), baht(0), P("good", "Matched")], ["Deposits", R("2100"), baht(48210004112, 0), baht(48210004112, 0), baht(0), P("good", "Matched")],
      ["Leases", R("1350"), baht(9860220000, 0), baht(9860220000, 0), baht(0), P("good", "Matched")], ["Suspense", R("2990"), baht(0), baht(4200), baht(4200), P("warn", "Review")]] },
    "finance/reports": { cols: ["Report", "Regulator", "Period", "Due", "Prepared", "State"], rows: [
      ["Loan data set (DS_LOAN)", "BOT", "Sep 2026", "15 Oct 2026", "Automatic", P("good", "Submitted")], ["Liquidity coverage ratio", "BOT", "Oct 2026", "24 Oct 2026", "Automatic", P("good", "Submitted")],
      ["Cash transaction report", "AMLO", "Oct 2026", "27 Oct 2026", "Automatic", P("info", "Ready")], ["NPL and provisions", "BOT", "Sep 2026", "15 Nov 2026", "Arunee T.", P("warn", "Drafting")]] },
    "ops/audit": { cols: ["When", "Who", "Action", "Record", "Channel", "Result"], rows: [
      ["24 Oct 2026 09:41", "Ploy C.", "Approved cash deposit", "TX-0123-8840", "Console", P("good", "Done")], ["24 Oct 2026 09:12", "RM copilot", "Proposed restructuring", "TL-2024-000311", "Agent", P("info", "Waiting for checker")],
      ["24 Oct 2026 08:57", "Krit S.", "Submitted product", "AUTO_HP_USED v2", "Console", P("good", "Done")], ["24 Oct 2026 06:00", "Scheduler", "Reconciled sub-ledger to GL", "All ledgers", "System", P("good", "Done")]] },
    "ops/incidents": { cols: ["Incident", "Started", "Impact", "Owner", "Severity", "State"], rows: [
      [R("INC-3312"), "23 Oct 2026 22:10", "NDID slow, onboarding waits 40 s", "Integration team", P("warn", "Medium"), P("good", "Resolved")], [R("INC-3315"), "24 Oct 2026 05:12", "ITMX file one item short", "Payments ops", P("", "Low"), P("info", "In progress")]] },
    "agents/policies": { cols: ["Policy", "Agent", "May propose", "Limit", "Checker", "State"], rows: [
      ["Restructuring within authority", "RM copilot", "Rate, term, holiday", "Modification loss ≤ ฿50,000", "Credit officer", P("good", "Active")], ["Match payment breaks", "Reconciliation", "One-to-one matches", "≤ ฿10,000 per item", "Payments ops", P("good", "Active")],
      ["Promise plans", "Collections", "Plans up to 3 months", "≤ 250 accounts per batch", "Supervisor", P("good", "Active")], ["KYC refresh", "KYC", "Document requests", "Low and medium risk only", "KYC team", P("good", "Active")]] },
    "agents/activity": { cols: ["When", "Agent", "Did", "Record", "Outcome", "State"], rows: [
      ["24 Oct 2026 09:12", "RM copilot", "Drafted restructuring", "TL-2024-000311", "Within authority", P("info", "Waiting for checker")], ["24 Oct 2026 05:14", "Reconciliation", "Proposed a match", "ITMX 24 Oct 05:00", "฿4,200.00", P("info", "Waiting for checker")],
      ["23 Oct 2026 18:30", "Collections", "Drafted promise plans", "214 accounts", "Needs supervisor", P("warn", "Escalated")], ["23 Oct 2026 11:02", "KYC", "Requested a document", "C11", "Proof of address", P("good", "Done")]] },
    "admin/integrations": { cols: ["Integration", "Kind", "Endpoint", "Last call", "Error rate", "State"], rows: [
      ["ITMX PromptPay", "Payments", "itmx.example/pp/v2", "now", "0.01%", P("good", "Active")], ["NDID", "Identity", "ndid.example/idp", "2 min", "0.40%", P("good", "Active")],
      ["NCB credit bureau", "Credit", "ncb.example/v3", "6 min", "0.00%", P("good", "Active")], ["BOT data sets", "Reporting", "bot.example/rdt", "24 Oct 2026", "0.00%", P("good", "Active")], ["DOPA ID check", "Identity", "dopa.example/card", "1 min", "1.20%", P("warn", "Watch")]] },
    "admin/settings": { cols: ["Setting", "Value", "Scope", "Changed", "By", "State"], rows: [
      ["Business day calendar", "BOT holidays 2026", "Bank", "2 Jan 2026", "Admin", P("good", "Active")], ["Cash report threshold", "฿2,000,000", "Bank", "1 Jan 2026", "Compliance", P("good", "Active")],
      ["Maker-checker on payments above", "฿1,000,000", "Bank", "15 Mar 2026", "Admin", P("good", "Active")], ["Session timeout", "15 minutes", "Bank", "1 Jan 2026", "Security", P("good", "Active")]] },
    "analytics/scheduled": { cols: ["Report", "Audience", "Schedule", "Next run", "Format", "State"], rows: [
      ["Daily arrears pack", "Collections heads", "Every business day 07:00", "25 Oct 2026", "PDF + XLSX", P("good", "Active")], ["Portfolio by product", "Executive committee", "Monday 08:00", "26 Oct 2026", "PDF", P("good", "Active")],
      ["Vintage curves, personal loans", "Credit risk", "1st of month", "1 Nov 2026", "XLSX", P("good", "Active")], ["Dealer exposure", "Asset finance", "Friday 17:00", "30 Oct 2026", "PDF", P("info", "Paused")]] },
    "branch/bqueue": { cols: ["Ticket", "Customer", "Service", "Waiting", "Counter", "State"], rows: [
      [R("A-042"), t("Somchai Prasert"), "Loan payment", "now", "3", P("info", "At counter")], [R("A-043"), "Malee Wongsa", "Cash deposit", "6 min", "—", P("", "Waiting")],
      [R("B-017"), "Thai Cold Chain", "Cheque deposit", "9 min", "—", P("warn", "Waiting")], [R("A-044"), "Anan Chaiyo", "Passbook update", "2 min", "—", P("", "Waiting")]] },
    "compliance/alerts": { cols: ["Alert", "Customer", "Rule", "Score", "Raised", "State"], rows: [
      [R("AML-ALR-7712"), "Pacific Import Trading", "Structuring below the cash report threshold", "87", "23 Oct 2026", P("crit", "Case opened")], [R("AML-ALR-7708"), "Arthit Wong", "Rapid in and out through PromptPay", "64", "22 Oct 2026", P("warn", "Open ")],
      [R("AML-ALR-7699"), t("Siam Freight Logistics"), "Sanctions name match on a payment", "58", "24 Oct 2026", P("info", "Payment held")]] },
    "compliance/cases": { cols: ["Case", "Customer", "Typology", "Investigator", "Opened", "State"], rows: [
      [R("AML-2026-0418"), "Pacific Import Trading", "Structuring", "Dao P.", "23 Oct 2026", P("warn", "Investigating")], [R("AML-2026-0402"), "Thanakorn Ruang", "Unusual cash for profile", "Dao P.", "2 Oct 2026", P("good", "Closed, no report")]] },
    "compliance/str": { cols: ["Report", "Kind", "Customer", "Filed", "Reference", "State"], rows: [
      [R("STR-2026-0091"), "Suspicious transaction", "Kanchana Trading", "12 Oct 2026", "AMLO-26-118204", P("good", "Acknowledged")], [R("CTR-2026-10-24"), "Cash transactions ≥ ฿2,000,000", "38 customers", "24 Oct 2026", "—", P("info", "Ready")]] },
    "payments/held": { cols: ["Payment", "From", "To", "Amount", "Reason", "State"], rows: [
      [R("TR-9918210"), "CUR-B2031", "Siam Freight Logistic Ltd (HK)", "$1,180,000.00", "Sanctions name match 91%", P("crit", "Held")]] },
    "channels/releases": { cols: ["Version", "Platform", "What changed", "Released", "Adoption", "State"], rows: [
      [R("5.12.0"), "iOS · Android", "Pay a loan by Thai QR from any bank", "21 Oct 2026", "64%", P("good", "Live")], [R("5.11.2"), "iOS · Android", "Face ID for transfers above ฿50,000", "7 Oct 2026", "91%", P("good", "Live")],
      [R("5.13.0"), "iOS · Android", "Restructuring offers in the app", "4 Nov 2026", "—", P("info", "In review")]] },
    "branch/eod": { cols: ["Check", "Expected", "Actual", "Difference", "By", "State"], rows: [
      ["Teller drawers", "฿2,941,200.00", "฿2,941,200.00", baht(0), "Supervisor", P("good", "Matched")], ["Vault cash", "฿18,400,000.00", "—", "—", "Branch manager", P("info", "Scheduled")],
      ["Cheques for clearing", "38", "38", "0", "Back office", P("good", "Matched")], ["Passbook stock", "412", "410", "2", "Supervisor", P("warn", "Review")]] },
  };
}

const APPROVALS = [
  ["products", "Publish product AUTO_HP_USED v2", "Krit S. · Product Factory", "1,200 scenarios passed · rate cap ≤ 15% checked", "warn", "2 h"],
  ["lending", "Restructure TL-2024-000311", "RM copilot for Wanida K.", "Within authority · modification loss ฿18,412.20", "info", "40 min"],
  ["payments", "Match ITMX break of ฿4,200.00", "Reconciliation agent", "One item, 24 Oct 05:00 file", "info", "3 h"],
  ["collections", "Write off LN-A-C14", "Credit officer", "135 days late · override needed before 360 days", "crit", "1 day"],
  ["deposits", "Cash deposit above ฿2,000,000", "Teller 4 · Branch 0123", "AMLO cash transaction report will be filed", "warn", "12 min"],
  ["trade", "Amend LC-26-0418 expiry to 30 Nov", "Trade operations", "Beneficiary consent received", "info", "1 h"],
  ["leasing", "Raise FP-DEMO limit to ฿30,000,000", "Asset finance officer", "Bangna Motors at 92% of limit", "warn", "5 h"],
];
const approvals = () => APPROVALS.filter((a) => has(a[0]));

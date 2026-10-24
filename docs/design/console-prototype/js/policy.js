// Fabor console prototype · The retail credit policy in Product Factory: one versioned home for the limits the bank
// sets (affordability, LTV, approval authority, collections). A draft is edited, its impact simulated on recent
// applications, approved by a second person and published; the application form, credit review and collections
// read the published values. Rules set by regulation are locked: they may be tightened, never loosened.
// Classic scripts sharing one global scope; load order is set in index.html.

const POLICY = {
  version: 7, effective: Date.UTC(2026, 6, 1),
  dsr: { personal: 60, home: 70, car: 60 }, minIncome: { personal: 15000, home: 20000, car: 15000 }, auto: { personal: 500000, car: 1500000 },
  ltvHome: { 1: 90, 2: 80, 3: 70 }, ltvCar: { new: 85, used: 80 }, levels: { officer: 2000000, head: 10000000 },
  haircut: { variable: 70, other: 50 }, hardshipShare: 70, promiseDays: 30,
  reg: { capHigh: 5, capLow: 1.5, capThreshold: 30000, weekday: "08:00–20:00", weekend: "08:00–18:00", perDay: 1, defaultRate: 3 },
};
const POL_REG_FLOOR = { capHigh: 5, capLow: 1.5, perDay: 1, defaultRate: 3 };
const clone = (o) => JSON.parse(JSON.stringify(o));
let PDRAFT = { p: clone(POLICY), state: "draft", maker: null, checker: null, note: "" };
let POL_HISTORY = [[6, Date.UTC(2026, 0, 1), "Supaporn L.", "Thanawat P.", ["Home LTV for a first contract 85% → 90%", "LTV บ้านสัญญาแรก 85% → 90%"]], [7, Date.UTC(2026, 6, 1), "Krit S.", "Chairat S.", ["Car hire purchase automatic band ฿1,000,000 → ฿1,500,000", "เกณฑ์อนุมัติอัตโนมัติเช่าซื้อรถ ฿1,000,000 → ฿1,500,000"]]];

/* every editable parameter: path, labels, unit, bounds, and whether regulation sets a floor */
const POL_PARAMS = [
  ["afford", "dsr.personal", "Debt service ratio, personal loans", "ภาระหนี้ต่อรายได้ สินเชื่อส่วนบุคคล", "%", 30, 80], ["afford", "dsr.home", "Debt service ratio, home loans", "ภาระหนี้ต่อรายได้ สินเชื่อบ้าน", "%", 30, 80], ["afford", "dsr.car", "Debt service ratio, car hire purchase", "ภาระหนี้ต่อรายได้ เช่าซื้อรถยนต์", "%", 30, 80],
  ["afford", "minIncome.personal", "Minimum income, personal loans", "รายได้ขั้นต่ำ สินเชื่อส่วนบุคคล", "฿", 10000, 100000], ["afford", "minIncome.home", "Minimum income, home loans", "รายได้ขั้นต่ำ สินเชื่อบ้าน", "฿", 10000, 100000], ["afford", "minIncome.car", "Minimum income, car hire purchase", "รายได้ขั้นต่ำ เช่าซื้อรถยนต์", "฿", 10000, 100000],
  ["afford", "haircut.variable", "Variable income counted", "สัดส่วนรายได้ไม่ประจำที่นับ", "%", 0, 100], ["afford", "haircut.other", "Other income counted", "สัดส่วนรายได้อื่นที่นับ", "%", 0, 100],
  ["collateral", "ltvHome.1", "Home LTV, first contract", "LTV บ้าน สัญญาที่ 1", "%", 50, 100], ["collateral", "ltvHome.2", "Home LTV, second contract", "LTV บ้าน สัญญาที่ 2", "%", 50, 100], ["collateral", "ltvHome.3", "Home LTV, third or later", "LTV บ้าน สัญญาที่ 3 ขึ้นไป", "%", 50, 100],
  ["collateral", "ltvCar.new", "Car LTV, new", "LTV รถใหม่", "%", 50, 100], ["collateral", "ltvCar.used", "Car LTV, used", "LTV รถใช้แล้ว", "%", 50, 100],
  ["authority", "auto.personal", "Automatic approval up to, personal loans", "อนุมัติอัตโนมัติไม่เกิน สินเชื่อส่วนบุคคล", "฿", 0, 2000000], ["authority", "auto.car", "Automatic approval up to, car hire purchase", "อนุมัติอัตโนมัติไม่เกิน เช่าซื้อรถยนต์", "฿", 0, 5000000],
  ["authority", "levels.officer", "Credit officer approves up to", "เจ้าหน้าที่สินเชื่ออนุมัติได้ไม่เกิน", "฿", 500000, 10000000], ["authority", "levels.head", "Head of retail credit approves up to", "หัวหน้าฝ่ายสินเชื่อรายย่อยอนุมัติได้ไม่เกิน", "฿", 1000000, 50000000],
  ["collections", "hardshipShare", "Share of spare income a restructured instalment may take", "สัดส่วนรายได้คงเหลือที่ค่างวดปรับโครงสร้างใช้ได้", "%", 30, 100], ["collections", "promiseDays", "Longest promise to pay", "ระยะนัดชำระสูงสุด", "days", 7, 60],
  ["reg", "reg.capHigh", "Personal loan cap, income ฿30,000 or more", "เพดานสินเชื่อส่วนบุคคล รายได้ ฿30,000 ขึ้นไป", "× income", 1, 5, true], ["reg", "reg.capLow", "Personal loan cap, income under ฿30,000", "เพดานสินเชื่อส่วนบุคคล รายได้ต่ำกว่า ฿30,000", "× income", 0.5, 1.5, true],
  ["reg", "reg.perDay", "Successful collection contacts a day", "การติดต่อทวงถามที่สำเร็จต่อวัน", "", 0, 1, true], ["reg", "reg.defaultRate", "Default interest above the contract rate", "ดอกเบี้ยผิดนัดเหนืออัตราตามสัญญา", "% a year", 0, 3, true]];
const pget = (o, path) => path.split(".").reduce((a, k) => a[k], o);
const pset = (o, path, v) => { const ks = path.split("."), last = ks.pop(); ks.reduce((a, k) => a[k], o)[last] = v; };
const fmtP = (v, unit) => unit === "฿" ? baht(v, 0) : unit === "%" ? `${v}%` : unit === "days" ? tt(`${v} days`, `${v} วัน`) : `${v}${unit ? " " + unit : ""}`;
function polChanges() { return POL_PARAMS.filter(([, path]) => pget(PDRAFT.p, path) !== pget(POLICY, path)).map(([g, path, en, th, unit]) => ({ path, en, th, unit, from: pget(POLICY, path), to: pget(PDRAFT.p, path) })); }
function polErrors() {
  const e = [];
  for (const [, path, en, th, unit, min, max, reg] of POL_PARAMS) { const v = pget(PDRAFT.p, path);
    if (isNaN(v) || v < min || v > max) e.push(tt(`${en}: between ${fmtP(min, unit)} and ${fmtP(max, unit)}`, `${th}: ระหว่าง ${fmtP(min, unit)} ถึง ${fmtP(max, unit)}`));
    if (reg && v > POL_REG_FLOOR[path.split(".")[1]]) e.push(tt(`${en}: regulation allows at most ${fmtP(POL_REG_FLOOR[path.split(".")[1]], unit)}`, `${th}: กฎหมายกำหนดไม่เกิน ${fmtP(POL_REG_FLOOR[path.split(".")[1]], unit)}`)); }
  if (PDRAFT.p.levels.head <= PDRAFT.p.levels.officer) e.push(tt("The head of retail credit's limit must be above the credit officer's", "วงเงินหัวหน้าฝ่ายต้องสูงกว่าเจ้าหน้าที่สินเชื่อ"));
  return e;
}

/* ---------------- impact: the last 90 days of applications, decided again under the draft ---------------- */
const POL_SAMPLE = (() => {
  let x = 7; const rnd = () => { x = (x * 9301 + 49297) % 233280; return x / 233280; }, out = [];
  for (let i = 0; i < 2400; i++) {
    const r = rnd(), product = r < 0.55 ? "personal" : r < 0.8 ? "car" : "home", income = Math.round(12000 + Math.pow(rnd(), 1.6) * 140000), debts = Math.round(income * rnd() * 0.35);
    const amount = product === "personal" ? Math.round(income * (0.8 + rnd() * 5)) : product === "car" ? Math.round(300000 + rnd() * 1200000) : Math.round(1200000 + rnd() * 6000000);
    const term = product === "personal" ? 48 : product === "car" ? 72 : 360, rate = product === "personal" ? 0.15 : product === "car" ? 0.0479 : 0.0555;
    const inst = pmt(rate / 12, term, amount), dsr = (debts + inst) / income * 100, value = product === "home" ? amount / (0.75 + rnd() * 0.3) : amount / (0.7 + rnd() * 0.25);
    out.push({ product, income, amount, dsr, ltv: amount / value * 100, contract: product === "home" ? (rnd() < 0.8 ? 1 : rnd() < 0.7 ? 2 : 3) : 0, used: product === "car" && rnd() < 0.35 });
  }
  return out;
})();
function polRun(P) {
  let n = 0, auto = 0, vol = 0, el = 0;
  for (const a of POL_SAMPLE) {
    const cap = a.income >= P.reg.capThreshold ? P.reg.capHigh : P.reg.capLow;
    const lim = a.product === "home" ? P.ltvHome[a.contract] : a.product === "car" ? P.ltvCar[a.used ? "used" : "new"] : 999;
    const ok = a.dsr <= P.dsr[a.product] && a.income >= P.minIncome[a.product] && a.ltv <= lim && (a.product !== "personal" || a.amount <= a.income * cap);
    if (!ok) continue;
    n++; vol += a.amount; if (a.product !== "home" && a.amount <= (P.auto[a.product] || 0)) auto++;
    const pd = a.dsr < 40 ? 0.012 : a.dsr < 60 ? 0.025 : a.dsr < 70 ? 0.04 : 0.07, lgd = a.product === "personal" ? 0.7 : a.product === "home" ? 0.15 : 0.35;
    el += a.amount * pd * lgd * (a.ltv > 90 ? 1.4 : 1);
  }
  return { n, rate: n / POL_SAMPLE.length * 100, auto: n ? auto / n * 100 : 0, vol, el, elRate: vol ? el / vol * 100 : 0 };
}

/* ---------------- the page ---------------- */
const POL_STATE = () => ({ draft: [tt("Draft", "ร่าง"), "info"], submitted: [tt("Waiting for checker", "รอผู้ตรวจ"), "warn"], approved: [tt("Approved, not published", "อนุมัติแล้ว ยังไม่เผยแพร่"), "good"] }[PDRAFT.state]);
function viewPolicy() {
  const ch = polChanges(), st = POL_STATE(), err = polErrors();
  const act = PDRAFT.state === "draft" ? `<button class="btn" type="button" data-pol-reset ${ch.length ? "" : "disabled"}>${esc(tt("Discard changes", "ยกเลิกการแก้ไข"))}</button><button class="btn primary" type="button" data-flow="polSubmit" ${ch.length && !err.length ? "" : "disabled"}>${esc(tt("Submit for approval", "ส่งอนุมัติ"))}</button>`
    : PDRAFT.state === "submitted" ? `<button class="btn" type="button" data-flow="polReject">${esc(tt("Send back", "ส่งกลับแก้ไข"))}</button><button class="btn primary" type="button" data-flow="polApprove">${icon("i-check")}${esc(tt("Approve", "อนุมัติ"))}</button>`
    : `<button class="btn primary" type="button" data-flow="polPublish">${esc(tt("Publish", "เผยแพร่"))}</button>`;
  return recordPage({ title: tt("Retail credit policy", "นโยบายสินเชื่อรายย่อย"), lede: esc(tt(`Version ${POLICY.version} in force since ${fd(POLICY.effective)} · the application form, credit review and collections read it`, `ฉบับที่ ${POLICY.version} มีผลตั้งแต่ ${fd(POLICY.effective)} · ใบสมัคร การพิจารณาสินเชื่อ และการติดตามหนี้ใช้ค่าจากนโยบายนี้`)),
    pills: P(st[1], st[0]) + (ch.length ? P("info", tt(`${ch.length} changes in the draft`, `แก้ไข ${ch.length} รายการในร่าง`)) : P("", tt("Draft matches version " + POLICY.version, `ร่างตรงกับฉบับที่ ${POLICY.version}`))) + (err.length ? P("crit", tt(`${err.length} problems`, `มีปัญหา ${err.length} รายการ`)) : ""), actions: act,
    facts: [[tt("In force", "ฉบับที่ใช้"), `v${POLICY.version}`, "", fd(POLICY.effective)], [tt("Draft", "ร่าง"), `v${POLICY.version + 1}`, "", st[0]], [tt("Changes", "การแก้ไข"), String(ch.length)], [tt("Maker", "ผู้จัดทำ"), PDRAFT.maker ? ROLE_NAME(PDRAFT.maker) : "—"], [tt("Checker", "ผู้ตรวจ"), PDRAFT.checker ? ROLE_NAME(PDRAFT.checker) : "—"]],
    panels: { afford: () => polGroup("afford", tt("Income counted at 100% unless set below. Variable income: overtime, commission, bonus.", "รายได้นับ 100% เว้นแต่กำหนดต่ำกว่า รายได้ไม่ประจำ: ค่าล่วงเวลา คอมมิชชัน โบนัส")), collateral: () => polGroup("collateral", tt("Home LTV by how many home-loan contracts the customer has; the BOT measure is the outer limit, these are the bank's own.", "LTV บ้านตามจำนวนสัญญาสินเชื่อบ้านของลูกค้า มาตรการ ธปท. เป็นเพดานสูงสุด ค่าเหล่านี้เป็นนโยบายของธนาคาร")),
      authority: () => polGroup("authority", tt("Above the head of retail credit, the credit committee decides. A deviation raises the approver by its own level.", "เกินวงเงินหัวหน้าฝ่ายสินเชื่อรายย่อย คณะกรรมการสินเชื่อเป็นผู้พิจารณา ข้อยกเว้นยกระดับผู้อนุมัติตามระดับของข้อยกเว้นนั้น")), collections: () => polGroup("collections", tt("Used by the hardship assessment and the promise rules.", "ใช้ในการประเมินปัญหาทางการเงินและกฎการนัดชำระ")),
      reg: () => polGroup("reg", tt("Set by regulation: the bank may be stricter, never looser. Calling hours are fixed: weekdays 08:00–20:00, weekends and holidays 08:00–18:00.", "กำหนดโดยกฎหมายและหลักเกณฑ์: ธนาคารเข้มงวดกว่าได้ แต่ผ่อนปรนกว่าไม่ได้ เวลาติดต่อกำหนดตายตัว: วันทำการ 08:00–20:00 วันหยุด 08:00–18:00")), impact: polImpact, changes: polChangesTab } });
}
function polGroup(g, sub) {
  const rows = POL_PARAMS.filter((x) => x[0] === g), ro = PDRAFT.state !== "draft";
  return `<section class="card"><div class="card-head"><div class="card-sub">${esc(sub)}</div></div><div class="card-body"><div class="form-grid">${rows.map(([, path, en, th, unit, min, max, reg]) => { const v = pget(PDRAFT.p, path), was = pget(POLICY, path), bad = isNaN(v) || v < min || v > max || (reg && v > POL_REG_FLOOR[path.split(".")[1]]);
    return `<div class="field"><label for="pol-${path}">${esc(tt(en, th))}${reg ? ` <span class="src-tag">${esc(tt("Regulation", "กฎหมาย"))}</span>` : ""}</label><input class="input${unit === "฿" ? " money" : ""}" id="pol-${path}" data-pol="${path}" inputmode="decimal" value="${esc(unit === "฿" ? Number(v).toLocaleString("en-US") : String(v))}" ${ro ? "disabled" : ""} ${bad ? 'aria-invalid="true"' : ""}><span class="hint">${esc(v !== was ? tt(`Now ${fmtP(was, unit)}`, `ปัจจุบัน ${fmtP(was, unit)}`) : "")}</span></div>`; }).join("")}</div>
    ${polErrors().length ? `<div style="margin-top:14px">${notice("crit", tt("Fix before submitting", "แก้ไขก่อนส่ง"), polErrors().join(" · "))}</div>` : ""}</div></section>`;
}
function polImpact() {
  const a = polRun(POLICY), b = polRun(PDRAFT.p), d = (x, y, dp = 1, unit = "") => `${(y - x >= 0 ? "+" : "−")}${Math.abs(y - x).toFixed(dp)}${unit}`;
  const rows = [[tt("Approved", "อนุมัติ"), a.n.toLocaleString("en-US"), b.n.toLocaleString("en-US"), d(a.n, b.n, 0)], [tt("Approval rate", "อัตราการอนุมัติ"), `${a.rate.toFixed(1)}%`, `${b.rate.toFixed(1)}%`, d(a.rate, b.rate, 1, " pt")], [tt("Decided automatically", "ตัดสินอัตโนมัติ"), `${a.auto.toFixed(1)}%`, `${b.auto.toFixed(1)}%`, d(a.auto, b.auto, 1, " pt")],
    [tt("Volume approved", "วงเงินอนุมัติ"), `฿${(a.vol / 1e6).toFixed(1)}m`, `฿${(b.vol / 1e6).toFixed(1)}m`, d(a.vol / 1e6, b.vol / 1e6, 1, "m")], [tt("Expected loss, 12 months", "ผลขาดทุนที่คาดว่าจะเกิด 12 เดือน"), `฿${(a.el / 1e6).toFixed(2)}m`, `฿${(b.el / 1e6).toFixed(2)}m`, d(a.el / 1e6, b.el / 1e6, 2, "m")], [tt("Expected loss rate", "อัตราผลขาดทุนที่คาดว่าจะเกิด"), `${a.elRate.toFixed(2)}%`, `${b.elRate.toFixed(2)}%`, d(a.elRate, b.elRate, 2, " pt")]];
  return `<section class="card"><div class="card-head"><div><div class="card-title">${esc(tt("If the draft had applied for the last 90 days", "หากใช้ร่างนี้ในช่วง 90 วันที่ผ่านมา"))}</div><div class="card-sub">${esc(tt(`${POL_SAMPLE.length.toLocaleString("en-US")} applications decided again; expected loss uses the scorecard's PD by debt service band and LGD by product.`, `ตัดสินใบสมัคร ${POL_SAMPLE.length.toLocaleString("en-US")} รายการใหม่ ผลขาดทุนที่คาดว่าจะเกิดใช้ PD ตามช่วงภาระหนี้และ LGD ตามผลิตภัณฑ์`))}</div></div></div><div class="card-body flush"><div class="table-wrap"><table><caption class="sr">${esc(tt("Impact", "ผลกระทบ"))}</caption><thead><tr>${["", `v${POLICY.version}`, tt("Draft", "ร่าง"), tt("Change", "เปลี่ยนแปลง")].map((h, i) => `<th scope="col" class="${i ? "r" : ""}">${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr><td>${esc(r[0])}</td><td class="r num">${esc(r[1])}</td><td class="r num">${esc(r[2])}</td><td class="r num">${esc(r[3])}</td></tr>`).join("")}</tbody></table></div></div></section>
    <p class="note">${esc(tt("A simulation on past applications, not a forecast: it does not model how customers would have behaved under different terms.", "เป็นการจำลองจากใบสมัครในอดีต ไม่ใช่การพยากรณ์ ไม่ได้รวมพฤติกรรมของลูกค้าที่อาจเปลี่ยนไปตามเงื่อนไข"))}</p>`;
}
function polChangesTab() {
  const ch = polChanges();
  return `<section class="card"><div class="card-head"><div class="card-title">${esc(tt(`Draft against version ${POLICY.version}`, `ร่างเทียบฉบับที่ ${POLICY.version}`))}</div></div><div class="card-body ${ch.length ? "flush" : ""}">${ch.length ? `<div class="table-wrap"><table><caption class="sr">${esc(tt("Changes", "การแก้ไข"))}</caption><thead><tr><th scope="col">${esc(tt("Parameter", "พารามิเตอร์"))}</th><th scope="col">${esc(tt("Change", "การเปลี่ยนแปลง"))}</th></tr></thead><tbody>${ch.map((c) => `<tr><td>${esc(tt(c.en, c.th))}</td><td><div class="diff"><del>${esc(fmtP(c.from, c.unit))}</del>→<ins>${esc(fmtP(c.to, c.unit))}</ins></div></td></tr>`).join("")}</tbody></table></div>` : `<div class="state"><span class="sev info">${icon("i-check")}</span><strong>${esc(tt("No changes yet", "ยังไม่มีการแก้ไข"))}</strong></div>`}</div></section>
    ${card(tt("Versions", "ประวัติฉบับ"), tl(POL_HISTORY.slice().reverse().map(([v, d, maker, checker, what]) => [d, tt(`Version ${v}`, `ฉบับที่ ${v}`), `${tt(...what)} · ${tt(`made by ${maker}, approved by ${checker}`, `จัดทำโดย ${maker} อนุมัติโดย ${checker}`)}`, "done"])))}`;
}

/* ---------------- maker-checker and publishing ---------------- */
const polSub = () => tt(`Retail credit policy · version ${POLICY.version + 1}`, `นโยบายสินเชื่อรายย่อย · ฉบับที่ ${POLICY.version + 1}`);
const polDiffHtml = () => `<div style="display:grid;gap:6px">${polChanges().map((c) => `<div class="diff"><span style="font-family:var(--font-ui)">${esc(tt(c.en, c.th))}</span> <del>${esc(fmtP(c.from, c.unit))}</del>→<ins>${esc(fmtP(c.to, c.unit))}</ins></div>`).join("")}</div>`;
Object.assign(FLOWS, {
  polSubmit: () => ({ title: tt("Submit for approval", "ส่งอนุมัติ"), sub: polSub(), init: { note: "" }, fields: (d) => polDiffHtml() + area("pnote", tt("Why the change", "เหตุผลของการเปลี่ยนแปลง"), d.note),
    read: (d) => { d.note = $("#pnote").value.trim(); return d.note ? "" : tt("Say why.", "ระบุเหตุผล"); },
    review: () => { const a = polRun(POLICY), b = polRun(PDRAFT.p); return { html: quoteRows([[tt("Approval rate", "อัตราการอนุมัติ"), `${a.rate.toFixed(1)}% → ${b.rate.toFixed(1)}%`], [tt("Expected loss rate", "อัตราผลขาดทุนที่คาดว่าจะเกิด"), `${a.elRate.toFixed(2)}% → ${b.elRate.toFixed(2)}%`]]) + `<p class="consequence">${esc(tt("Locks the draft and sends it to a checker, who must be someone else. Nothing changes for customers until it is published.", "ล็อกร่างและส่งให้ผู้ตรวจซึ่งต้องเป็นบุคคลอื่น ไม่มีผลต่อลูกค้าจนกว่าจะเผยแพร่"))}</p>`, confirm: tt("Submit", "ส่ง") }; },
    done: (d) => { if (PDRAFT.state === "draft") { PDRAFT.state = "submitted"; PDRAFT.maker = role.id; PDRAFT.note = d.note; setTimeout(render, 0); } return tt("Submitted for approval.", "ส่งอนุมัติแล้ว"); } }),
  polApprove: () => ({ title: tt("Approve the policy change", "อนุมัติการเปลี่ยนแปลงนโยบาย"), sub: polSub(), init: {}, fields: () => polDiffHtml() + `<p class="hint muted" style="margin-top:10px">${esc(tt(`Maker's reason: ${PDRAFT.note}`, `เหตุผลของผู้จัดทำ: ${PDRAFT.note}`))}</p>`,
    read: () => PDRAFT.maker === role.id ? tt("You made this change, so someone else must approve it. Preview as another role.", "คุณเป็นผู้จัดทำ ต้องให้ผู้อื่นอนุมัติ ลองสลับบทบาท") : "",
    review: () => ({ html: `<p class="consequence">${esc(tt("Approves the draft. It still needs to be published, with an effective date, before it applies.", "อนุมัติร่าง ต้องเผยแพร่พร้อมวันที่มีผลก่อนจึงจะใช้บังคับ"))}</p>`, confirm: tt("Approve", "อนุมัติ") }),
    done: () => { if (PDRAFT.state === "submitted") { PDRAFT.state = "approved"; PDRAFT.checker = role.id; setTimeout(render, 0); } return tt("Approved.", "อนุมัติแล้ว"); } }),
  polReject: () => ({ title: tt("Send back", "ส่งกลับแก้ไข"), sub: polSub(), init: { why: "" }, fields: (d) => area("rwhy", tt("What to change", "สิ่งที่ต้องแก้ไข"), d.why), read: (d) => { d.why = $("#rwhy").value.trim(); return d.why ? "" : tt("Say what to change.", "ระบุสิ่งที่ต้องแก้ไข"); },
    review: () => ({ html: `<p class="consequence">${esc(tt("Unlocks the draft for the maker with your note.", "ปลดล็อกร่างให้ผู้จัดทำแก้ไขพร้อมบันทึกของคุณ"))}</p>`, confirm: tt("Send back", "ส่งกลับ") }),
    done: () => { if (PDRAFT.state === "submitted") { PDRAFT.state = "draft"; setTimeout(render, 0); } return tt("Sent back.", "ส่งกลับแล้ว"); } }),
  polPublish: () => ({ title: tt("Publish", "เผยแพร่"), sub: polSub(), init: { when: "now" }, fields: (d) => select("pwhen", tt("Takes effect", "มีผล"), [["now", tt("Now, for new applications and decisions", "ทันที สำหรับใบสมัครและการตัดสินใหม่")], ["dec", tt("1 Dec 2026", "1 ธ.ค. 2569")]], d.when),
    read: (d) => { d.when = $("#pwhen").value; return ""; },
    review: (d) => ({ html: polDiffHtml() + `<p class="consequence" style="margin-top:12px">${esc(d.when === "now" ? tt("Applies at once to new applications, credit decisions, hardship offers and promises. Decisions already made keep the policy they were made under.", "มีผลทันทีกับใบสมัคร การตัดสินสินเชื่อ ข้อเสนอปรับโครงสร้าง และการนัดชำระใหม่ การตัดสินที่ทำไปแล้วคงใช้นโยบายเดิม") : tt("Scheduled for 1 Dec 2026; until then version " + POLICY.version + " applies.", `ตั้งเวลามีผล 1 ธ.ค. 2569 ระหว่างนี้ใช้ฉบับที่ ${POLICY.version}`))}</p>`, confirm: tt("Publish", "เผยแพร่") }),
    done: (d) => { if (PDRAFT.state === "approved") { const ch = polChanges(); POL_HISTORY.push([POLICY.version + 1, d.when === "now" ? BIZ : Date.UTC(2026, 11, 1), ROLE_NAME(PDRAFT.maker), ROLE_NAME(PDRAFT.checker), [ch.map((c) => `${c.en} ${fmtP(c.from, c.unit)} → ${fmtP(c.to, c.unit)}`).join("; "), ch.map((c) => `${c.th} ${fmtP(c.from, c.unit)} → ${fmtP(c.to, c.unit)}`).join("; ")]]);
        if (d.when === "now") polApply(PDRAFT.p, d.when);
        PDRAFT = { p: clone(POLICY), state: "draft", maker: null, checker: null, note: "" }; setTimeout(render, 0); }
      return d.when === "now" ? tt("Published. The screens now use the new values.", "เผยแพร่แล้ว หน้าจอใช้ค่าใหม่แล้ว") : tt("Scheduled for 1 Dec 2026.", "ตั้งเวลามีผล 1 ธ.ค. 2569 แล้ว"); } }),
});
// publishing changes what the other screens read
function polApply(p) {
  const keep = { version: POLICY.version + 1, effective: BIZ };
  Object.assign(POLICY, clone(p), keep);
  for (const k of Object.keys(INTAKE_PRODUCTS)) { INTAKE_PRODUCTS[k].dsr = POLICY.dsr[k]; INTAKE_PRODUCTS[k].minIncome = POLICY.minIncome[k]; INTAKE_PRODUCTS[k].auto = POLICY.auto[k] || 0; }
  LEVELS[0][2] = POLICY.levels.officer; LEVELS[1][2] = POLICY.levels.head;
}
document.addEventListener("input", (e) => { const path = e.target.dataset && e.target.dataset.pol; if (!path) return; pset(PDRAFT.p, path, parseMoney(e.target.value)); });
document.addEventListener("change", (e) => { const path = e.target.dataset && e.target.dataset.pol; if (!path) return; render(); $(`[data-pol="${path}"]`)?.focus(); });
document.addEventListener("click", (e) => { if (e.target.closest("[data-pol-reset]")) { PDRAFT.p = clone(POLICY); render(); } });

Object.assign(RECS, {
  "POL-RETAIL": { sys: "products", sec: "policy", label: "POL-RETAIL", kind: "Credit policy", match: ["POL-RETAIL"], view: () => viewPolicy(),
    tabs: [["afford", "Affordability"], ["collateral", "Collateral"], ["authority", "Authority"], ["collections", "Collections"], ["reg", "Regulatory"], ["impact", "Impact"], ["changes", "Changes"]] },
});
Object.assign(TH, { "Credit policy": "นโยบายสินเชื่อ", "Authority": "อำนาจอนุมัติ", "Regulatory": "ตามกฎหมาย", "Impact": "ผลกระทบ", "Changes": "การแก้ไข" });

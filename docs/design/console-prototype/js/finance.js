// Fabor console prototype · Finance and month-end for October 2026: the ECL run (ECL-2026-10) with staging that
// follows the loans' real state, macro scenarios and overlays; the sub-ledger to GL reconciliation (REC-2026-10);
// the BOT loan data set (DS-LOAN-2026-10) with validation; and the close checklist tied to all three.
// Classic scripts sharing one global scope; load order is set in index.html.

/* ---------------- ECL: the rest of the book in aggregate, the prototype's loans one by one ---------------- */
const ECLS = { weights: "board", posted: false, postedAmount: 0, overlays: [
  { id: "OVL-07", en: "Tourism-dependent borrowers: hours and income cut", th: "ผู้กู้ที่พึ่งพาการท่องเที่ยว: ชั่วโมงงานและรายได้ลดลง", amount: 6200000, expires: Date.UTC(2027, 2, 31), state: "approved" },
  { id: "OVL-08", en: "Flood-affected districts, Chiang Mai and Lamphun", th: "พื้นที่ประสบอุทกภัย เชียงใหม่และลำพูน", amount: 3100000, expires: Date.UTC(2027, 0, 31), state: "approved" }] };
const SCEN = { board: [["Base", "กรณีฐาน", 60, 1.0, "GDP +2.6%, unemployment 1.0%", "GDP +2.6% ว่างงาน 1.0%"], ["Upside", "กรณีดี", 10, 0.85, "GDP +3.4%", "GDP +3.4%"], ["Downside", "กรณีเลวร้าย", 30, 1.45, "GDP +0.4%, house prices −6%", "GDP +0.4% ราคาบ้าน −6%"]],
  severe: [["Base", "กรณีฐาน", 50, 1.0, "GDP +2.6%, unemployment 1.0%", "GDP +2.6% ว่างงาน 1.0%"], ["Upside", "กรณีดี", 5, 0.85, "GDP +3.4%", "GDP +3.4%"], ["Downside", "กรณีเลวร้าย", 45, 1.45, "GDP +0.4%, house prices −6%", "GDP +0.4% ราคาบ้าน −6%"]] };
const macro = () => SCEN[ECLS.weights].reduce((s, x) => s + x[2] / 100 * x[3], 0);
const MACRO_BOARD = SCEN.board.reduce((s, x) => s + x[2] / 100 * x[3], 0);
const ECL_HELD = 1401568800, ECL_BASE = [[1, 29104000000, 581900000], [2, 1982000000, 331400000], [3, 676500000, 487900000]];
function eclLoans() {
  const m = macro(), out = [], add = (id, who, stage, ead, pd, lgd, why) => out.push({ id, who, stage, ead: r2(ead), pd: stage === 3 ? 1 : Math.min(1, pd * m), lgd, why, ecl: r2(ead * (stage === 3 ? 1 : Math.min(1, pd * m)) * lgd) });
  const somEad = REPO.sold ? Math.max(0, repoCalc().gap) : LOAN.total;
  add("LN-A-C10", t("Somchai Prasert"), 3, somEad, 1, REPO.sold ? 1 : Math.max(0, somEad - LOAN.valuation * 0.9) / somEad, REPO.sold ? tt("144 days late; vehicle sold, shortfall unsecured", "ค้าง 144 วัน ขายรถแล้ว ส่วนขาดไม่มีหลักประกัน") : tt("144 days late; vehicle held for sale", "ค้าง 144 วัน รถรอขาย"));
  add("LN-A-C11", t("Malee Wongsa"), 2, MAL.principalOut + MAL.late.reduce((s, x) => s + x.interest, 0), MALC.accepted ? 0.14 : 0.18, 0.7, MALC.accepted ? tt("Restructured 24 Oct; stays Stage 2 until 3 months paid", "ปรับโครงสร้าง 24 ต.ค. อยู่ Stage 2 จนชำระ 3 เดือน") : tt("65 days late", "ค้าง 65 วัน"));
  if (!KIT.wo) add("LN-A-C14", t("Kittipong Siri"), 3, KIT.principal, 1, 1, tt("135 days late; suit filed, no assets", "ค้าง 135 วัน ฟ้องแล้ว ไม่พบทรัพย์"));
  add("FAC-B2031", t("Siam Freight Logistics"), FAC.cov === "breach" ? 2 : 1, facUsed(), FAC.cov === "breach" ? 0.075 : 0.018, 0.3, FAC.cov === "breach" ? tt("Covenant breach: significant increase in credit risk", "ผิดเงื่อนไข: ความเสี่ยงด้านเครดิตเพิ่มขึ้นอย่างมีนัยสำคัญ") : tt("Current; covenant test due", "ปกติ รอทดสอบเงื่อนไข"));
  add("LN-77120", t("Anan Chaiyo"), 1, HOME.bal, 0.009, 0.15, tt("Current", "ปกติ"));
  add("LN-A-C13", t("Pimchanok Rattana"), 1, 125000, 0.025, 0.7, tt("Current", "ปกติ"));
  if (DSB.paid) add(DSB_LOAN, tt("Kittisak and Nattaya Wongsawat", "กิตติศักดิ์และณัฐยา วงศ์สวัสดิ์"), 1, DSB_AMT, 0.008, 0.15, tt("New this month", "ใหม่เดือนนี้"));
  if (INTAKE.paid) add(INTAKE_PRODUCTS[INTAKE.product].contract, t("Pimchanok Rattana"), 1, num(INTAKE.f.amount), 0.025, INTAKE.product === "home" ? 0.15 : 0.7, tt("New this month", "ใหม่เดือนนี้"));
  return out;
}
// BOT loan classification by days past due (the prototype's reading): the NPL ratio counts substandard or worse, whatever the stage
const DPD = () => ({ "LN-A-C10": 144, "LN-A-C11": MALC.accepted ? 0 : MAL.dpd, "LN-A-C14": 135 });
const botClass = (id) => { const d = DPD()[id] || 0; return d > 360 ? "Doubtful of loss" : d > 180 ? "Doubtful" : d > 90 ? "Substandard" : d > 30 ? "Special mention" : "Pass"; };
const isNpl = (id) => ["Substandard", "Doubtful", "Doubtful of loss"].includes(botClass(id));
function eclRunCalc() {
  const loans = eclLoans(), scale = macro() / MACRO_BOARD, stages = ECL_BASE.map(([s, ead, al]) => ({ s, ead, al: r2((s === 3 ? al : al * scale)) }));
  for (const l of loans) { const st = stages[l.stage - 1]; st.ead += l.ead; st.al = r2(st.al + l.ecl); }
  const overlays = ECLS.overlays.filter((o) => o.state === "approved").reduce((s, o) => s + o.amount, 0), model = r2(stages.reduce((s, x) => s + x.al, 0)), required = r2(model + overlays);
  return { loans, stages, overlays, model, required, held: ECLS.posted ? ECLS.postedAmount : ECL_HELD, topup: r2(required - (ECLS.posted ? ECLS.postedAmount : ECL_HELD)), ead: stages.reduce((s, x) => s + x.ead, 0) };
}
ACTIONS.push(["closesign", "Closing the month", "Chief financial officer"]);
let closeSent = false;
const bn = (v) => `฿${(v / 1e9).toFixed(2)}bn`, mn = (v) => `฿${(v / 1e6).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}m`;
function viewEcl() {
  const c = eclRunCalc(), s3 = c.stages[2];
  return recordPage({ title: "ECL-2026-10", mono: true, lede: esc(tt("Loss allowance under TFRS 9 for October 2026 · positions as of 24 Oct, rerun at 31 Oct 23:59", "ค่าเผื่อผลขาดทุนด้านเครดิตตาม TFRS 9 เดือนตุลาคม 2569 · ข้อมูล ณ 24 ต.ค. คำนวณใหม่ 31 ต.ค. 23:59")),
    pills: ECLS.posted ? P("good", tt("Posted", "บันทึกบัญชีแล้ว")) : P("info", tt("Draft run", "ผลคำนวณเบื้องต้น")) + P(ECLS.weights === "board" ? "good" : "warn", ECLS.weights === "board" ? tt("Board-approved weights", "น้ำหนักที่คณะกรรมการอนุมัติ") : tt("Severe weights: for review only", "น้ำหนักรุนแรง: เพื่อทบทวนเท่านั้น")),
    actions: `<button class="btn primary" type="button" data-flow="eclRun" ${ECLS.posted || ECLS.weights !== "board" ? "disabled" : ""}>${esc(tt("Post the allowance", "บันทึกค่าเผื่อ"))}</button>`,
    facts: [[tt("Exposure", "ยอดหนี้"), bn(c.ead)], [tt("Allowance required", "ค่าเผื่อที่ต้องมี"), mn(c.required)], [tt("Held in GL 1390", "ยอดใน GL 1390"), mn(c.held)], [tt(c.topup >= 0 ? "Top-up" : "Release", c.topup >= 0 ? "ตั้งเพิ่ม" : "กลับรายการ"), mn(Math.abs(c.topup)), c.topup > 0 ? "warn" : ""], [tt("Stage 3 share", "สัดส่วน Stage 3"), `${(s3.ead / c.ead * 100).toFixed(2)}%`], [tt("Coverage, Stage 3", "อัตราครอบคลุม Stage 3"), `${(s3.al / s3.ead * 100).toFixed(1)}%`]],
    panels: { summary: eclSummary, loans: eclLoansTab, staging: eclStaging, overlays: eclOverlays, movement: eclMovement } });
}
function eclSummary() {
  const c = eclRunCalc(), w = SCEN[ECLS.weights];
  return `<div class="grid-main"><section class="card"><div class="card-head"><div class="card-title">${esc(tt("By stage", "แยกตาม Stage"))}</div></div><div class="card-body flush">${table({ cols: ["Stage", "Exposure", "Allowance", "Coverage"], rows: [...c.stages.map((x) => [P(["good", "warn", "crit"][x.s - 1], `Stage ${x.s}`), bn(x.ead), mn(x.al), `${(x.al / x.ead * 100).toFixed(2)}%`]), [tt("Overlays", "การปรับปรุงโดยผู้บริหาร"), "—", mn(c.overlays), "—"], [`<b>${esc(tt("Total", "รวม"))}</b>`, bn(c.ead), `<b>${mn(c.required)}</b>`, `${(c.required / c.ead * 100).toFixed(2)}%`]] }, tt("By stage", "แยกตาม Stage"))}</div></section>
    <section class="card"><div class="card-head"><div><div class="card-title">${esc(tt("Forward-looking scenarios", "สถานการณ์คาดการณ์ล่วงหน้า"))}</div><div class="card-sub">${esc(tt("PDs are weighted across scenarios; the board approves the weights each quarter.", "PD ถ่วงน้ำหนักตามสถานการณ์ คณะกรรมการอนุมัติน้ำหนักทุกไตรมาส"))}</div></div></div><div class="card-body" style="display:grid;gap:12px">
      ${table({ cols: ["Scenario", "Weight", "PD multiplier", "Assumptions"], rows: w.map(([en, th, wt, m, aen, ath]) => [tt(en, th), `${wt}%`, `${m.toFixed(2)}×`, tt(aen, ath)]) }, tt("Scenarios", "สถานการณ์"))}
      <div class="field"><label for="eclW">${esc(tt("Weights", "น้ำหนัก"))}</label><select class="input" id="eclW" data-ecl-weights ${ECLS.posted ? "disabled" : ""}><option value="board" ${ECLS.weights === "board" ? "selected" : ""}>${esc(tt("Board-approved, Q4 2026: 60 / 10 / 30", "คณะกรรมการอนุมัติ ไตรมาส 4/2569: 60 / 10 / 30"))}</option><option value="severe" ${ECLS.weights === "severe" ? "selected" : ""}>${esc(tt("Severe, for sensitivity: 50 / 5 / 45", "รุนแรง เพื่อทดสอบความอ่อนไหว: 50 / 5 / 45"))}</option></select><span class="hint">${esc(tt(`Weighted multiplier ${macro().toFixed(3)}×. Only the board-approved weights can be posted.`, `ตัวคูณถ่วงน้ำหนัก ${macro().toFixed(3)}× บันทึกบัญชีได้เฉพาะน้ำหนักที่คณะกรรมการอนุมัติ`))}</span></div></div></section></div>`;
}
function eclLoansTab() {
  const c = eclRunCalc();
  return `<section class="card"><div class="card-head"><div><div class="card-title">${esc(tt("The prototype's loans in this run", "สัญญาในต้นแบบที่อยู่ในการคำนวณนี้"))}</div><div class="card-sub">${esc(tt("Their stage follows what happened to them elsewhere in the console. The rest of the book is in the stage totals.", "Stage เป็นไปตามสิ่งที่เกิดขึ้นกับสัญญาในส่วนอื่นของคอนโซล ส่วนที่เหลือของพอร์ตรวมอยู่ในยอดแต่ละ Stage"))}</div></div></div><div class="card-body flush">${table({ cols: ["Loan", "Customer", "Stage", "Why", "Exposure", "PD", "LGD", "Allowance"], rows: c.loans.map((l) => [R(l.id), l.who, P(["good", "warn", "crit"][l.stage - 1], `Stage ${l.stage}`), l.why, baht(l.ead), `${(l.pd * 100).toFixed(2)}%`, `${(l.lgd * 100).toFixed(0)}%`, baht(l.ecl)]) }, tt("Loans", "สัญญา"))}</div></section>
    ${KIT.wo ? notice("info", tt("LN-A-C14 is not here: written off on 24 Oct", "ไม่มี LN-A-C14: ตัดหนี้สูญแล้ว 24 ต.ค."), tt("Its ฿140,000 allowance was used by the write-off; it shows in the movement.", "ค่าเผื่อ ฿140,000 ถูกใช้ในการตัดหนี้สูญ แสดงในการเปลี่ยนแปลงของค่าเผื่อ")) : ""}`;
}
function eclStaging() {
  const L = eclLoans(), hit = (f) => L.filter(f).map((l) => l.id).join(", ") || "—";
  return `<section class="card"><div class="card-head"><div class="card-sub">${esc(tt("A loan moves to Stage 2 on any trigger, and to Stage 3 when credit-impaired. Restructured loans stay put until they have paid on time for 3 consecutive months or 3 instalments, whichever is longer.", "สัญญาเข้า Stage 2 เมื่อเข้าเกณฑ์ใดเกณฑ์หนึ่ง และเข้า Stage 3 เมื่อด้อยค่าด้านเครดิต สัญญาที่ปรับโครงสร้างคงอยู่จนชำระตรงเวลา 3 เดือนติดต่อกันหรือ 3 งวด แล้วแต่อย่างใดนานกว่า"))}</div></div><div class="card-body flush">${table({ cols: ["Trigger", "Moves to", "Loans now"], rows: [
    [tt("More than 30 days past due", "ค้างชำระเกิน 30 วัน"), "Stage 2", hit((l) => l.stage === 2 && l.id === "LN-A-C11")], [tt("Financial covenant breached", "ผิดเงื่อนไขทางการเงิน"), "Stage 2", hit((l) => l.id === "FAC-B2031" && l.stage === 2)],
    [tt("Internal grade down 2 notches since origination", "ระดับความเสี่ยงลดลง 2 ขั้นนับจากให้สินเชื่อ"), "Stage 2", "—"], [tt("Watchlist, or restructured while performing", "อยู่ในรายการเฝ้าระวัง หรือปรับโครงสร้างขณะยังปกติ"), "Stage 2", MALC.accepted ? "LN-A-C11" : "—"],
    [tt("More than 90 days past due", "ค้างชำระเกิน 90 วัน"), "Stage 3", hit((l) => l.stage === 3)], [tt("Legal action, or the borrower unlikely to pay", "ดำเนินคดี หรือลูกหนี้ไม่น่าจะชำระได้"), "Stage 3", KIT.wo ? "—" : "LN-A-C14"]] }, tt("Staging rules", "เกณฑ์การจัดชั้น"))}</div></section>`;
}
function eclOverlays() {
  return `<section class="card"><div class="card-head"><div><div class="card-title">${esc(tt("Management overlays", "การปรับปรุงโดยผู้บริหาร"))}</div><div class="card-sub">${esc(tt("For risks the model cannot see yet. Each has an owner, evidence, an expiry, and the risk committee's approval.", "สำหรับความเสี่ยงที่แบบจำลองยังไม่สะท้อน แต่ละรายการมีผู้รับผิดชอบ หลักฐาน วันหมดอายุ และการอนุมัติของคณะกรรมการบริหารความเสี่ยง"))}</div></div><button class="btn primary" type="button" data-flow="eclOverlay" ${ECLS.posted ? "disabled" : ""}>${esc(tt("Propose an overlay", "เสนอการปรับปรุง"))}</button></div><div class="card-body flush">${table({ cols: ["Overlay", "Reason", "Amount", "Expires", "State"], rows: ECLS.overlays.map((o) => [R(o.id), tt(o.en, o.th), baht(o.amount, 0), fd(o.expires), o.state === "approved" ? P("good", tt("Approved", "อนุมัติแล้ว")) : P("warn", tt("With the risk committee", "รอคณะกรรมการบริหารความเสี่ยง"))]) }, tt("Overlays", "การปรับปรุง"))}</div></section>`;
}
function eclMovement() {
  const c = eclRunCalc(), L = c.loans, f = (id) => (L.find((l) => l.id === id) || {}).ecl || 0;
  const newLoans = r2(6100000 + L.filter((l) => /New this month|ใหม่เดือนนี้/.test(l.why)).reduce((s, l) => s + l.ecl, 0));
  const transfers = r2(3200000 + (FAC.cov === "breach" ? f("FAC-B2031") - r2(facUsed() * 0.018 * macro() * 0.3) : 0));
  const writeoffs = KIT.wo ? -140000 : 0, repay = -4300000, macroCh = r2(ECL_BASE.slice(0, 2).reduce((s, x) => s + x[2], 0) * (macro() / MACRO_BOARD - 1));
  const overlays = c.overlays, other = r2(c.required - ECL_HELD - newLoans - transfers - writeoffs - repay - macroCh - overlays);
  const rows = [[tt("Opening, 30 Sep", "ยอดยกมา 30 ก.ย."), ECL_HELD], [tt("New loans", "สินเชื่อใหม่"), newLoans], [tt("Repayments and maturities", "การชำระคืนและครบกำหนด"), repay], [tt("Transfers between stages", "การย้าย Stage"), transfers], [tt("Write-offs (allowance used)", "ตัดหนี้สูญ (ใช้ค่าเผื่อ)"), writeoffs], [tt("Scenario weights", "น้ำหนักสถานการณ์"), macroCh], [tt("Overlays", "การปรับปรุงโดยผู้บริหาร"), overlays], [tt("Model and parameter changes", "การเปลี่ยนแปลงแบบจำลองและพารามิเตอร์"), other], [tt("Closing, 31 Oct", "ยอดยกไป 31 ต.ค."), c.required]];
  return card(tt("Movement in the allowance", "การเปลี่ยนแปลงของค่าเผื่อ"), quoteRows(rows.map(([k, v]) => [k, v === ECL_HELD || v === c.required ? mn(v) : `${v >= 0 ? "+" : "−"}${mn(Math.abs(v))}`])) + `<p class="note" style="margin-top:12px">${esc(tt("This table goes into the financial statement notes as it is. A write-off reduces both the loan and the allowance, so it is not a new expense.", "ตารางนี้ใช้ในหมายเหตุประกอบงบการเงินได้ทันที การตัดหนี้สูญลดทั้งสินเชื่อและค่าเผื่อ จึงไม่ใช่ค่าใช้จ่ายใหม่"))}</p>`);
}
Object.assign(FLOWS, {
  eclRun: () => ({ title: tt("Post the loss allowance", "บันทึกค่าเผื่อผลขาดทุน"), sub: tt("ECL-2026-10 · October 2026 · TFRS 9", "ECL-2026-10 · ตุลาคม 2569 · TFRS 9"), init: {}, fields: () => { const c = eclRunCalc(); return kvHtml([[tt("Exposure", "ยอดหนี้"), bn(c.ead)], [tt("Weights", "น้ำหนัก"), tt("Board-approved, Q4 2026", "คณะกรรมการอนุมัติ ไตรมาส 4/2569")], [tt("Overlays", "การปรับปรุง"), mn(c.overlays)]]); }, read: () => (ECLS.weights === "board" ? "" : tt("Only the board-approved weights can be posted.", "บันทึกบัญชีได้เฉพาะน้ำหนักที่คณะกรรมการอนุมัติ")),
    review: () => { const c = eclRunCalc(); return { html: quoteRows([[tt("Allowance held now", "ค่าเผื่อที่ตั้งไว้"), baht(c.held)], [tt("Allowance required", "ค่าเผื่อที่ต้องมี"), baht(c.required)], [c.topup >= 0 ? tt("Top-up to post", "ส่วนที่ต้องตั้งเพิ่ม") : tt("Release to post", "ส่วนที่กลับรายการ"), baht(Math.abs(c.topup))]]) + `<p class="consequence">${tt(`Posts <b>${baht(Math.abs(c.topup))}</b>: debit 5300 Expected credit loss expense, credit 1390 Loss allowance${c.topup < 0 ? " (reversed)" : ""}. GL 1390 then agrees with the run.`, `บันทึก <b>${baht(Math.abs(c.topup))}</b>: เดบิต 5300 ค่าใช้จ่ายผลขาดทุนด้านเครดิตที่คาดว่าจะเกิด เครดิต 1390 ค่าเผื่อผลขาดทุน${c.topup < 0 ? " (กลับรายการ)" : ""} แล้ว GL 1390 จะตรงกับผลคำนวณ`)}</p>`, confirm: tt("Post", "บันทึก"), auth: ["journal", Math.abs(c.topup)] }; },
    done: (d) => { if (!ECLS.posted && d.auth && d.auth.ok) { ECLS.posted = true; ECLS.postedAmount = eclRunCalc().required; closeDone.add("ecl"); setTimeout(render, 0); } return tt("Loss allowance posted for October.", "บันทึกค่าเผื่อผลขาดทุนเดือนตุลาคมแล้ว"); } }),
  eclOverlay: () => ({ title: tt("Propose an overlay", "เสนอการปรับปรุง"), sub: "ECL-2026-10", init: { amount: 2500000, why: "", ev: "" },
    fields: (d) => money("oamt", d.amount, t("Amount")) + area("owhy", tt("The risk the model does not see", "ความเสี่ยงที่แบบจำลองยังไม่สะท้อน"), d.why) + area("oev", tt("Evidence", "หลักฐาน"), d.ev, tt("Data, not opinion: arrears trend, sector news, early-warning signals.", "ใช้ข้อมูล ไม่ใช่ความเห็น: แนวโน้มการค้างชำระ ข่าวอุตสาหกรรม สัญญาณเตือนล่วงหน้า")),
    read: (d) => { const v = parseMoney($("#oamt").value); d.why = $("#owhy").value.trim(); d.ev = $("#oev").value.trim(); if (isNaN(v) || v <= 0) return tt("Enter an amount.", "ใส่จำนวนเงิน"); if (!d.why || !d.ev) return tt("Give the reason and the evidence.", "ระบุเหตุผลและหลักฐาน"); d.amount = v; return ""; },
    review: (d) => ({ html: `<p class="consequence">${esc(tt(`Proposes ${baht(d.amount, 0)}, expiring 31 Mar 2027, to the risk committee. It counts in the run only once approved.`, `เสนอ ${baht(d.amount, 0)} หมดอายุ 31 มี.ค. 2570 ต่อคณะกรรมการบริหารความเสี่ยง นับในการคำนวณเมื่ออนุมัติแล้วเท่านั้น`))}</p>`, confirm: tt("Propose", "เสนอ") }),
    done: (d) => { if (!d.logged) { d.logged = true; ECLS.overlays.push({ id: `OVL-${String(ECLS.overlays.length + 7).padStart(2, "0")}`, en: d.why, th: d.why, amount: d.amount, expires: Date.UTC(2027, 2, 31), state: "proposed" }); setTimeout(render, 0); } return tt("Sent to the risk committee.", "ส่งคณะกรรมการบริหารความเสี่ยงแล้ว"); } }),
});

/* ---------------- REC-2026-10: sub-ledgers against the GL ---------------- */
const RECS_STATE = { explained: {}, preparer: {} };
function recBreaks() {
  const c = eclRunCalc();
  return [{ k: "suspense", gl: "2990", en: "ITMX settlement break", th: "รายการชำระดุลผ่าน ITMX ไม่ตรง", amount: 4200, done: resolvedExc.has(0), how: tt("Resolved in the exception centre", "แก้ไขในศูนย์รายการผิดปกติ"), act: "ops/exceptions" },
    { k: "allowance", gl: "1390", en: "Loss allowance against today's ECL run", th: "ค่าเผื่อผลขาดทุนเทียบผลคำนวณ ECL วันนี้", amount: ECLS.posted ? 0 : Math.abs(c.topup), done: ECLS.posted, how: tt("Clears when the October run is posted", "หมดไปเมื่อบันทึกผลเดือนตุลาคม"), act: "rec:ECL-2026-10" },
    { k: "accrual", gl: "1320", en: "Interest receivable: accrual for 31 Oct posts at 23:59", th: "ดอกเบี้ยค้างรับ: รายการคงค้าง 31 ต.ค. บันทึก 23:59", amount: 1860, done: !!RECS_STATE.explained.accrual, how: tt("Timing difference, explained", "ผลต่างด้านเวลา อธิบายแล้ว"), act: "flow:recExplain" }];
}
const recDone = () => recBreaks().every((b) => b.done);
function viewRec() {
  const br = recBreaks(), open = br.filter((b) => !b.done);
  const ledgers = [["Loans", "สินเชื่อ", "1300", 31744120000], ["Interest receivable", "ดอกเบี้ยค้างรับ", "1320", 286411900], ["Loss allowance", "ค่าเผื่อผลขาดทุน", "1390", -eclRunCalc().required], ["Deposits", "เงินฝาก", "2100", -48210004112], ["Leases", "สัญญาเช่า", "1350", 9860220000], ["Suspense", "บัญชีพัก", "2990", 0]];
  return recordPage({ title: "REC-2026-10", mono: true, lede: esc(tt("Sub-ledgers against the general ledger · run daily at 06:00 · today's run", "บัญชีย่อยเทียบบัญชีแยกประเภททั่วไป · ทำทุกวัน 06:00 · รอบวันนี้")),
    pills: P(open.length ? "warn" : "good", open.length ? tt(`${open.length} breaks open`, `ผลต่างค้าง ${open.length} รายการ`) : tt("All matched or explained", "ตรงกันหรืออธิบายแล้วทั้งหมด")), actions: "",
    facts: [[tt("Ledgers", "บัญชี"), String(ledgers.length)], [tt("Postings today", "รายการวันนี้"), "3,872,934"], [tt("Breaks open", "ผลต่างค้าง"), String(open.length), open.length ? "warn" : ""], [tt("Amount open", "ยอดผลต่างค้าง"), baht(open.reduce((s, b) => s + b.amount, 0))]],
    panels: { breaks: () => `<section class="card"><div class="card-body"><div class="list">${br.map((b) => `<div class="li"><span class="sev ${b.done ? "good" : "warn"}">${icon(b.done ? "i-check" : "i-alert")}</span><div><strong>GL ${b.gl} · ${esc(tt(b.en, b.th))}</strong><p>${baht(b.amount)} · ${esc(b.done ? b.how : tt("Open", "ค้างอยู่"))}</p></div>${b.done ? "" : b.act.startsWith("flow:") ? `<button class="btn row-btn primary" type="button" data-flow="${b.act.slice(5)}" data-arg="${b.k}" style="margin-left:auto">${esc(tt("Explain", "อธิบาย"))}</button>` : `<button class="btn row-btn" type="button" data-go="${b.act}" style="margin-left:auto">${esc(tt("Open", "เปิด"))}</button>`}</div>`).join("")}</div></div></section>`,
      ledgers: () => `<section class="card"><div class="card-body flush">${table({ cols: ["Ledger", "GL", "Sub-ledger", "GL balance", "Difference", "State"], rows: ledgers.map(([en, th, gl, v]) => { const b = br.find((x) => x.gl === gl && !x.done), diff = b ? b.amount : 0; return [tt(en, th), R(gl), baht(v, 0), baht(v + (gl === "1390" && b ? (eclRunCalc().topup) : gl === "2990" && b ? 4200 : gl === "1320" && b ? 1860 : 0), 0), baht(diff), diff ? P("warn", "Review") : P("good", "Matched")]; }) }, tt("Ledgers", "บัญชี"))}</div></section>` } });
}
Object.assign(FLOWS, {
  recExplain: (k) => ({ title: tt("Explain a difference", "อธิบายผลต่าง"), sub: "REC-2026-10 · GL 1320", init: { why: tt("The accrual job for 31 Oct runs at 23:59; the sub-ledger already includes today's interest. Clears at month end.", "งานบันทึกดอกเบี้ยค้างรับของ 31 ต.ค. ทำงาน 23:59 บัญชีย่อยรวมดอกเบี้ยวันนี้แล้ว จะหมดไปเมื่อสิ้นเดือน") },
    fields: (d) => area("rexp", tt("Explanation", "คำอธิบาย"), d.why), read: (d) => { d.why = $("#rexp").value.trim(); return d.why ? "" : tt("Explain it.", "ระบุคำอธิบาย"); },
    review: () => ({ html: `<p class="consequence">${esc(tt("Records the difference as a timing difference with your explanation, kept for the auditors. If it has not cleared after month end it reopens.", "บันทึกเป็นผลต่างด้านเวลาพร้อมคำอธิบาย เก็บไว้สำหรับผู้สอบบัญชี หากไม่หมดไปหลังสิ้นเดือนจะเปิดขึ้นใหม่"))}</p>`, confirm: tt("Record", "บันทึก") }),
    done: () => { if (!RECS_STATE.explained[k]) { RECS_STATE.explained[k] = true; setTimeout(render, 0); } return tt("Explained.", "บันทึกคำอธิบายแล้ว"); } }),
});

/* ---------------- DS-LOAN-2026-10: the loan data set for the BOT ---------------- */
const RPT = { fix: {}, prop: {}, generated: false, preparer: null, submitted: false };
function rptRules() {
  const c = eclRunCalc();
  return [{ k: "gl1300", en: "Outstanding balances agree with GL 1300", th: "ยอดคงค้างตรงกับ GL 1300", ok: true },
    { k: "gl1390", en: "Allowances agree with GL 1390", th: "ค่าเผื่อตรงกับ GL 1390", ok: ECLS.posted, why: tt("GL 1390 does not yet include October's ECL run; post it first", "GL 1390 ยังไม่รวมผล ECL เดือนตุลาคม ให้บันทึกก่อน"), go: "rec:ECL-2026-10" },
    { k: "stage", en: "Stage agrees with days past due", th: "Stage สอดคล้องกับจำนวนวันค้าง", ok: true },
    { k: "tdr", en: "Restructured contracts carry the restructuring code", th: "สัญญาที่ปรับโครงสร้างมีรหัสการปรับโครงสร้าง", ok: !MALC.accepted || !!RPT.fix.tdr, why: tt("LN-A-C11 was restructured on 24 Oct but has no restructuring code", "LN-A-C11 ปรับโครงสร้าง 24 ต.ค. แต่ไม่มีรหัสการปรับโครงสร้าง"), fix: "tdr" },
    { k: "wo", en: "Written-off contracts moved to the write-off schedule", th: "สัญญาที่ตัดหนี้สูญย้ายไปตารางหนี้สูญ", ok: !KIT.wo || !!RPT.fix.wo, why: tt("LN-A-C14 was written off but is still in the loan schedule", "LN-A-C14 ตัดหนี้สูญแล้วแต่ยังอยู่ในตารางสินเชื่อ"), fix: "wo" },
    { k: "id", en: "Customer IDs are valid", th: "เลขประจำตัวลูกค้าถูกต้อง", ok: true },
    { k: "coll", en: "Collateral valued within 3 years", th: "ประเมินราคาหลักประกันภายใน 3 ปี", ok: true, warn: tt("LN-77120 appraised Mar 2023: due for reappraisal in 2026 (warning only)", "LN-77120 ประเมิน มี.ค. 2566 ถึงกำหนดประเมินใหม่ 2569 (เตือนเท่านั้น)") }];
}
const rptReady = () => rptRules().every((r) => r.ok);
function viewRpt() {
  const rules = rptRules(), fails = rules.filter((r) => !r.ok), c = eclRunCalc(), npl = (ECL_BASE[2][1] + c.loans.filter((l) => isNpl(l.id)).reduce((a, l) => a + l.ead, 0)) / c.ead * 100;
  return recordPage({ title: "DS-LOAN-2026-10", mono: true, lede: esc(tt("Loan data set for the BOT · October 2026 · due 15 Nov 2026 · one row per contract", "ชุดข้อมูลสินเชื่อนำส่ง ธปท. · ตุลาคม 2569 · ครบกำหนด 15 พ.ย. 2569 · หนึ่งแถวต่อสัญญา")),
    pills: RPT.submitted ? P("good", "Submitted") : fails.length ? P("crit", tt(`${fails.length} validation errors`, `ผิดพลาด ${fails.length} รายการ`)) : RPT.generated ? P("info", tt("Generated, waiting for checker", "สร้างไฟล์แล้ว รอผู้ตรวจ")) : P("good", tt("Validated", "ตรวจสอบผ่าน")),
    actions: RPT.submitted ? "" : RPT.generated ? `<button class="btn primary" type="button" data-flow="rptSubmit">${esc(tt("Approve and submit", "อนุมัติและนำส่ง"))}</button>` : `<button class="btn primary" type="button" data-flow="rptGenerate" ${fails.length ? "disabled" : ""}>${esc(tt("Generate the file", "สร้างไฟล์"))}</button>`,
    facts: [[tt("Contracts", "สัญญา"), "214,880"], [tt("Gross NPL ratio", "อัตรา NPL ขั้นต้น"), `${npl.toFixed(2)}%`, "", tt("substandard or worse, by classification", "ต่ำกว่ามาตรฐานขึ้นไป ตามการจัดชั้น")], [tt("Allowance", "ค่าเผื่อ"), mn(c.required)], [tt("Rules passed", "ผ่านกฎ"), `${rules.filter((r) => r.ok).length} / ${rules.length}`, fails.length ? "crit" : ""], [tt("Due", "ครบกำหนด"), fd(Date.UTC(2026, 10, 15))]],
    panels: { validation: () => `<section class="card"><div class="card-body"><div class="list">${rules.map((r) => `<div class="li"><span class="sev ${r.ok ? (r.warn ? "info" : "good") : "crit"}">${icon(r.ok ? "i-check" : "i-alert")}</span><div><strong>${esc(tt(r.en, r.th))}</strong>${!r.ok ? `<p>${esc(r.why)}</p>` : r.warn ? `<p>${esc(r.warn)}</p>` : ""}</div>${r.ok ? "" : r.fix ? `<button class="btn row-btn primary" type="button" data-rpt-fix="${r.fix}" style="margin-left:auto">${esc(RPT.prop[r.fix] ? tt("Check the correction", "ตรวจการแก้ไข") : tt("Fix the data", "แก้ไขข้อมูล"))}</button>` : `<button class="btn row-btn" type="button" data-go="${r.go}" style="margin-left:auto">${esc(tt("Open", "เปิด"))}</button>`}</div>`).join("")}</div></div></section><p class="note">${esc(tt("Rules come from the BOT's data set specification and the bank's own cross-checks. A fix changes the source record, never the file.", "กฎมาจากข้อกำหนดชุดข้อมูลของ ธปท. และการตรวจไขว้ของธนาคาร การแก้ไขทำที่ข้อมูลต้นทาง ไม่ใช่ที่ไฟล์"))}</p>`,
      contracts: () => `<section class="card"><div class="card-body flush">${table({ cols: ["Contract", "Product code", "Stage", "Classification", "Days past due", "Restructured", "Outstanding", "Allowance"], rows: c.loans.map((l) => [R(l.id), l.id.startsWith("FAC") ? "C-TERM" : l.id === "LN-77120" || l.id === DSB_LOAN ? "R-HOME" : "R-PERS", `S${l.stage}`, t(botClass(l.id)), String(DPD()[l.id] || 0), l.id === "LN-A-C11" && MALC.accepted ? (RPT.fix.tdr ? "TDR-02" : "—") : "—", baht(l.ead), baht(l.ecl)]).concat(KIT.wo && !RPT.fix.wo ? [[R("LN-A-C14"), "R-PERS", "S3", t("Substandard"), "135", "—", baht(140000), baht(0)]] : []) }, tt("Contracts", "สัญญา"))}</div></section><p class="note">${esc(tt("The prototype's loans; the file holds every contract.", "สัญญาในต้นแบบ ไฟล์จริงมีทุกสัญญา"))}</p>`,
      submission: () => card(tt("Submission", "การนำส่ง"), tl([[BIZ, tt("Validated against the specification", "ตรวจสอบตามข้อกำหนด"), fails.length ? tt(`${fails.length} errors`, `ผิดพลาด ${fails.length}`) : tt("All rules pass", "ผ่านทุกกฎ"), fails.length ? "warn" : "done"], [RPT.generated ? BIZ : "—", tt("File generated, with a checksum", "สร้างไฟล์พร้อมค่าตรวจสอบ"), RPT.generated ? tt(`by ${ROLE_NAME(RPT.preparer)}`, `โดย ${ROLE_NAME(RPT.preparer)}`) : "", RPT.generated ? "done" : ""], [RPT.submitted ? BIZ : "—", tt("Approved and submitted to the BOT", "อนุมัติและนำส่ง ธปท."), RPT.submitted ? tt("Acknowledged: DMS-26-10-004127", "ได้รับการตอบรับ: DMS-26-10-004127") : tt("A second person approves", "บุคคลที่สองอนุมัติ"), RPT.submitted ? "done" : ""]])) } });
}
Object.assign(FLOWS, {
  rptGenerate: () => ({ title: tt("Generate the file", "สร้างไฟล์"), sub: "DS-LOAN-2026-10", init: {}, fields: () => kvHtml([[tt("Rows", "แถว"), "214,880"], [tt("Format", "รูปแบบ"), tt("BOT data set specification, with a SHA-256 checksum", "ตามข้อกำหนดชุดข้อมูล ธปท. พร้อมค่า SHA-256")]]), read: () => "",
    review: () => ({ html: rptReady() ? `<p class="consequence">${esc(tt("Builds the file from today's ledger and locks it. A second person approves and submits it.", "สร้างไฟล์จากบัญชีแยกประเภทวันนี้และล็อกไว้ ให้บุคคลที่สองอนุมัติและนำส่ง"))}</p>` : notice("crit", tt("Validation errors remain", "ยังมีข้อผิดพลาด"), ""), blocked: !rptReady(), confirm: tt("Generate", "สร้าง") }),
    done: () => { if (!RPT.generated) { RPT.generated = true; RPT.preparer = role.id; setTimeout(render, 0); } return tt("File generated.", "สร้างไฟล์แล้ว"); } }),
  rptSubmit: () => ({ title: tt("Approve and submit", "อนุมัติและนำส่ง"), sub: "DS-LOAN-2026-10", init: {}, fields: () => kvHtml([[tt("Prepared by", "จัดทำโดย"), ROLE_NAME(RPT.preparer)], [tt("To", "ถึง"), tt("BOT data management system", "ระบบบริหารข้อมูลของ ธปท.")]]),
    read: () => (!RPT.generated ? tt("Generate the file first.", "สร้างไฟล์ก่อน") : RPT.preparer === role.id ? tt("You generated the file, so someone else must approve it. Preview as another role.", "คุณเป็นผู้สร้างไฟล์ ต้องให้ผู้อื่นอนุมัติ ลองสลับบทบาท") : ""),
    review: () => ({ html: `<p class="consequence">${esc(tt("Submits the locked file. The BOT's acknowledgement is kept with the file and the validation log.", "นำส่งไฟล์ที่ล็อกไว้ เก็บการตอบรับจาก ธปท. ไว้กับไฟล์และบันทึกการตรวจสอบ"))}</p>`, confirm: tt("Submit", "นำส่ง") }),
    done: () => { if (!RPT.submitted) { RPT.submitted = true; setTimeout(render, 0); } return tt("Submitted. Acknowledged as DMS-26-10-004127.", "นำส่งแล้ว เลขตอบรับ DMS-26-10-004127"); } }),
  closeSignoff: () => ({ title: tt("CFO sign-off", "CFO ลงนามรับรอง"), sub: tt("Month-end close · October 2026", "ปิดบัญชีสิ้นเดือน · ตุลาคม 2569"), init: {}, fields: () => kvHtml([[tt("Allowance posted", "บันทึกค่าเผื่อ"), mn(ECLS.postedAmount)], [tt("Reconciliation", "การกระทบยอด"), tt("All matched or explained", "ตรงกันหรืออธิบายแล้วทั้งหมด")], [tt("BOT loan data set", "ชุดข้อมูลสินเชื่อ ธปท."), tt("Submitted", "นำส่งแล้ว")]]), read: () => "",
    review: () => ({ auth: ["closesign", 1], html: `<p class="consequence">${esc(tt("Closes October. Postings dated October are locked; any later correction is a dated adjustment in November with its reason.", "ปิดงวดตุลาคม ล็อกรายการที่ลงวันที่ในเดือนตุลาคม การแก้ไขภายหลังทำเป็นรายการปรับปรุงในเดือนพฤศจิกายนพร้อมเหตุผล"))}</p>`, confirm: tt("Sign off", "ลงนาม") }),
    done: (d) => { if (d.auth && !d.auth.ok) { closeSent = true; setTimeout(render, 0); } else if (!closeDone.has("signoff")) { closeDone.add("signoff"); setTimeout(render, 0); } return tt("October is closed.", "ปิดงวดตุลาคมแล้ว"); } }),
});

/* ---------------- the close checklist follows the records above ---------------- */
function finCloseState(x) {
  if (x[0] === "recon") return recDone() ? "done" : "ready";
  if (x[0] === "fx" || x[0] === "accrual") return "auto";
  if (x[0] === "bot") return RPT.submitted ? "done" : ECLS.posted && recDone() ? "ready" : "waiting";
  if (x[0] === "signoff") return CLOSE.filter((y) => y[0] !== "signoff").every((y) => { const st = closeDone.has(y[0]) ? "done" : finCloseState(y) || (y[0] === "suspense" && resolvedExc.has(0) ? "done" : y[4]); return st === "done" || st === "auto"; }) ? "ready" : "waiting";
  return null;
}
function finCloseButton(x, st) {
  if (x[0] === "recon" && st === "ready") return `<button class="btn row-btn" type="button" data-go="rec:REC-2026-10">${esc(tt("Open", "เปิด"))}</button>`;
  if (x[0] === "ecl" && st === "ready") return `<button class="btn row-btn primary" type="button" data-go="rec:ECL-2026-10">${esc(tt("Open the run", "เปิดผลคำนวณ"))}</button>`;
  if (x[0] === "bot" && st === "ready") return `<button class="btn row-btn primary" type="button" data-go="rec:DS-LOAN-2026-10">${esc(tt("Open", "เปิด"))}</button>`;
  if (x[0] === "signoff" && st === "ready") return closeSent ? P("info", tt("With the CFO", "รอ CFO")) : `<button class="btn row-btn primary" type="button" data-flow="closeSignoff">${esc(tt("Send for sign-off", "ส่งให้ลงนาม"))}</button>`;
  return "";
}
document.addEventListener("change", (e) => { if (e.target.dataset && e.target.dataset.eclWeights !== undefined) { ECLS.weights = e.target.value; render(); $("#eclW")?.focus(); } });
document.addEventListener("click", (e) => { const el = e.target.closest("[data-rpt-fix]"); if (!el) return; const k = el.dataset.rptFix; if (!RPT.prop[k]) { RPT.prop[k] = role.id; render(); toast(tt("Correction proposed on the source record; a second person checks it.", "เสนอแก้ไขที่ต้นทางแล้ว ผู้ตรวจคนที่สองต้องตรวจ")); return; } if (RPT.prop[k] === role.id) { toast(tt("You proposed this correction; someone else must check it.", "คุณเป็นผู้เสนอการแก้ไขนี้ ต้องให้ผู้อื่นตรวจ")); return; } RPT.fix[k] = true; render(); toast(tt("Source record corrected; the rule passes.", "แก้ไขข้อมูลต้นทางแล้ว ผ่านกฎ"), "good"); });

Object.assign(RECS, {
  "ECL-2026-10": { sys: "finance", sec: "ecl", label: "ECL-2026-10", kind: "Loss allowance run", match: ["ECL-2026-10"], view: () => viewEcl(), tabs: [["summary", "Summary"], ["loans", "Loans"], ["staging", "Staging rules"], ["overlays", "Overlays"], ["movement", "Movement"]] },
  "REC-2026-10": { sys: "finance", sec: "recon", label: "REC-2026-10", kind: "Reconciliation", match: ["REC-2026-10"], view: () => viewRec(), tabs: [["breaks", "Breaks"], ["ledgers", "Ledgers"]] },
  "DS-LOAN-2026-10": { sys: "finance", sec: "reports", label: "DS-LOAN-2026-10", kind: "Regulatory report", match: ["DS-LOAN-2026-10"], view: () => viewRpt(), tabs: [["validation", "Validation"], ["contracts", "Contracts"], ["submission", "Submission"]] },
});
const finLists = () => ({
  "finance/ecl": { cols: ["Run", "Month", "Allowance", "Top-up", "Weights", "State"], rows: [[R("ECL-2026-10"), "Oct 2026", mn(eclRunCalc().required), mn(eclRunCalc().topup), ECLS.weights === "board" ? tt("Board", "คณะกรรมการ") : tt("Severe", "รุนแรง"), ECLS.posted ? P("good", tt("Posted", "บันทึกแล้ว")) : P("info", tt("Draft", "ร่าง"))], [R("ECL-2026-09"), "Sep 2026", mn(ECL_HELD), mn(18611200), tt("Board", "คณะกรรมการ"), P("good", tt("Posted", "บันทึกแล้ว"))]] },
  "finance/recon": { cols: ["Run", "When", "Ledgers", "Breaks open", "State"], rows: [[R("REC-2026-10"), "24 Oct 2026 06:00", "6", String(recBreaks().filter((b) => !b.done).length), recDone() ? P("good", "Matched") : P("warn", "Review")], [R("REC-2026-09"), "30 Sep 2026 06:00", "6", "0", P("good", "Matched")]] },
  "finance/reports": { cols: ["Report", "Regulator", "Period", "Due", "Prepared", "State"], rows: [[R("DS-LOAN-2026-10"), "BOT", "Oct 2026", "15 Nov 2026", RPT.preparer ? ROLE_NAME(RPT.preparer) : tt("Automatic", "อัตโนมัติ"), RPT.submitted ? P("good", "Submitted") : rptReady() ? P("info", "Ready") : P("crit", tt("Errors", "มีข้อผิดพลาด"))],
    ["Loan data set (DS_LOAN)", "BOT", "Sep 2026", "15 Oct 2026", "Automatic", P("good", "Submitted")], ["Liquidity coverage ratio", "BOT", "Oct 2026", "24 Oct 2026", "Automatic", P("good", "Submitted")], ["Cash transaction report", "AMLO", "Oct 2026", "27 Oct 2026", "Automatic", P("info", "Ready")]] },
});
Object.assign(TH, { "Classification": "การจัดชั้น", "Pass": "ปกติ", "Special mention": "กล่าวถึงเป็นพิเศษ", "Substandard": "ต่ำกว่ามาตรฐาน", "Doubtful": "สงสัย", "Doubtful of loss": "สงสัยจะสูญ", "Closing the month": "การปิดงวดบัญชี", "Chief financial officer": "ประธานเจ้าหน้าที่ฝ่ายการเงิน", "Loss allowance run": "การคำนวณค่าเผื่อผลขาดทุน", "Regulatory report": "รายงานต่อหน่วยงานกำกับ", "Staging rules": "เกณฑ์การจัดชั้น", "Overlays": "การปรับปรุงโดยผู้บริหาร", "Movement": "การเปลี่ยนแปลง", "Breaks": "ผลต่าง", "Ledgers": "บัญชี", "Validation": "การตรวจสอบ", "Submission": "การนำส่ง",
  "Month": "เดือน", "Top-up": "ตั้งเพิ่ม", "Weights": "น้ำหนัก", "Breaks open": "ผลต่างค้าง", "Scenario": "สถานการณ์", "Weight": "น้ำหนัก", "PD multiplier": "ตัวคูณ PD", "Assumptions": "สมมติฐาน", "Coverage": "อัตราครอบคลุม", "Why": "เหตุผล", "Trigger": "เกณฑ์", "Moves to": "ย้ายไป", "Loans now": "สัญญาตอนนี้", "Overlay": "การปรับปรุง", "Expires": "หมดอายุ",
  "Product code": "รหัสผลิตภัณฑ์", "Restructured": "ปรับโครงสร้าง", "Days past due": "จำนวนวันค้าง" });

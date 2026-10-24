// Fabor console prototype · Treasury and markets for the commercial bank: an overview of the day, the LCR calculation
// (LCR-2026-10) with a run-off stress and the contingency funding trigger, interest-rate risk in the banking book
// (ALM-2026-10: repricing gap, NII and EVE), an FX forward front to back (FX-26-10-0918) and the EUR nostro
// reconciliation (NOS-EUR-01) cleared under maker-checker. Figures in ฿ billions unless shown; values are samples and
// the BOT rules are the prototype's reading, to confirm. Classic scripts sharing one global scope; load order is set in index.html.

const tbn = (v, dp = 2) => `${v < 0 ? "−" : ""}฿${Math.abs(v).toFixed(dp)}bn`, tpct = (v, dp = 0) => `${v < 0 ? "−" : ""}${Math.abs(v).toFixed(dp)}%`;

/* ---------------- LCR-2026-10: liquidity coverage ---------------- */
const LCR = { mult: 1, cfp: null };
const HQLA = [["L1", "Cash and reserves at the BOT", "เงินสดและเงินฝากที่ ธปท.", 12.4, 0], ["L1", "Thai government and BOT bonds", "พันธบัตรรัฐบาลและพันธบัตร ธปท.", 24.6, 0],
  ["L2A", "State enterprise bonds rated AA", "พันธบัตรรัฐวิสาหกิจ อันดับ AA", 6.0, 0.15], ["L2B", "Corporate bonds rated A+", "หุ้นกู้ภาคเอกชน อันดับ A+", 4.0, 0.5]];
// [en, th, balance, run-off rate, is a deposit (stressed by the multiplier)]
const LCR_OUT = [["Retail deposits, stable", "เงินฝากรายย่อย ส่วนที่มั่นคง", 60.0, 0.05, true], ["Retail deposits, less stable", "เงินฝากรายย่อย ส่วนที่มั่นคงน้อย", 34.0, 0.10, true],
  ["SME deposits treated as retail", "เงินฝาก SME ที่ถือเป็นรายย่อย", 18.0, 0.10, true], ["Corporate operational deposits", "เงินฝากนิติบุคคลเพื่อการดำเนินงาน", 22.0, 0.25, true],
  ["Corporate non-operational deposits", "เงินฝากนิติบุคคลที่ไม่ใช่เพื่อการดำเนินงาน", 44.0, 0.40, true], ["Deposits of financial institutions", "เงินฝากสถาบันการเงิน", 8.0, 1.0, true],
  ["Committed undrawn credit lines, incl. FAC-B2031 ฿22m", "วงเงินสินเชื่อที่ยังไม่เบิก รวม FAC-B2031 ฿22 ล้าน", 12.0, 0.10, false], ["Committed liquidity facilities", "วงเงินสภาพคล่องที่ผูกพัน", 2.0, 0.30, false],
  ["Derivatives and other", "อนุพันธ์และอื่นๆ", 1.7, 1.0, false]];
const LCR_IN = [["Performing loans maturing in 30 days, 50%", "สินเชื่อปกติครบกำหนดใน 30 วัน 50%", 14.0, 0.5], ["Interbank placements maturing", "เงินให้กู้ยืมระหว่างธนาคารครบกำหนด", 6.0, 1.0]];
function lcrCalc(mult = LCR.mult) {
  const l1 = HQLA.filter((h) => h[0] === "L1").reduce((a, h) => a + h[3], 0), l2a = HQLA[2][3] * (1 - HQLA[2][4]), l2bRaw = HQLA[3][3] * (1 - HQLA[3][4]);
  const l2b = Math.min(l2bRaw, 15 / 85 * (l1 + l2a)), l2 = Math.min(l2a + l2b, 2 / 3 * l1), hqla = l1 + l2;
  const outs = LCR_OUT.map(([en, th, bal, rate, dep]) => ({ en, th, bal, rate: dep ? Math.min(1, rate * mult) : rate, flow: bal * (dep ? Math.min(1, rate * mult) : rate) }));
  const out = outs.reduce((a, o) => a + o.flow, 0), inf = LCR_IN.reduce((a, i) => a + i[2] * i[3], 0), capped = Math.min(inf, 0.75 * out), net = out - capped;
  return { l1, l2a, l2b, hqla, outs, out, inf, capped, net, ratio: hqla / net * 100 };
}
const lcrAt = (target) => { for (let m = 1; m <= 4; m += 0.05) if (lcrCalc(m).ratio < target) return m; return null; };
function viewLCR() {
  const c = lcrCalc(1);
  return recordPage({ title: "LCR-2026-10", mono: true, lede: esc(tt("Liquidity coverage ratio · Demo Commercial Bank, solo · as at close of 23 Oct 2026 · ALCO owner: treasurer", "อัตราส่วนสินทรัพย์สภาพคล่องเพื่อรองรับกระแสเงินสดไหลออก · ธนาคาร (เฉพาะธนาคาร) · ณ สิ้นวัน 23 ต.ค. 2569 · เจ้าของ: เหรัญญิก ALCO")),
    pills: P(c.ratio >= 120 ? "good" : c.ratio >= 100 ? "warn" : "crit", tt(`LCR ${tpct(c.ratio)}`, `LCR ${tpct(c.ratio)}`)) + (LCR.cfp ? P("info", tt("Contingency plan with ALCO", "แผนสภาพคล่องฉุกเฉินอยู่ที่ ALCO")) : ""),
    actions: `<button class="btn" type="button" data-tab="stress">${esc(tt("Stress", "ทดสอบภาวะวิกฤต"))}</button><button class="btn primary" type="button" data-flow="cfpInvoke" ${LCR.cfp ? "disabled" : ""}>${esc(tt("Contingency funding plan", "แผนสภาพคล่องฉุกเฉิน"))}</button>`,
    facts: [["LCR", tpct(c.ratio), c.ratio < 120 ? "warn" : "", tt("minimum 100%", "ขั้นต่ำ 100%")], [tt("High-quality liquid assets", "สินทรัพย์สภาพคล่องสูง"), tbn(c.hqla), "", tt("after haircuts and caps", "หลังส่วนลดและเพดาน")], [tt("Outflows, 30 days", "กระแสเงินสดไหลออก 30 วัน"), tbn(c.out)], [tt("Inflows, capped at 75%", "กระแสเงินสดไหลเข้า เพดาน 75%"), tbn(c.capped)], [tt("Early-warning trigger", "จุดเตือนล่วงหน้า"), "120%", "", tt("internal, above the BOT 100%", "เกณฑ์ภายใน สูงกว่า ธปท. 100%")]],
    panels: { hqla: lcrHqla, outflows: lcrFlows, stress: lcrStress, cfp: lcrCfp } });
}
function lcrHqla() {
  const c = lcrCalc(1);
  return `<section class="card"><div class="card-body flush">${table({ cols: ["Level", "Asset", "Market value", "Haircut", "Counted"], rows: [...HQLA.map(([lv, en, th, v, h]) => [lv, tt(en, th), tbn(v), tpct(h * 100), tbn(v * (1 - h))]), [tt("Total", "รวม"), tt("After the caps: level 2 at most 40%, level 2B at most 15%", "หลังเพดาน: ระดับ 2 ไม่เกิน 40% ระดับ 2B ไม่เกิน 15%"), "", "", tbn(c.hqla)]] }, tt("High-quality liquid assets", "สินทรัพย์สภาพคล่องสูง"))}</div></section>
    <p class="note">${esc(tt("Assets count only if unencumbered and under the treasurer's control: bonds already pledged in BOT repo are excluded. The caps are the prototype's reading of the BOT notification, to confirm.", "นับเฉพาะสินทรัพย์ที่ไม่ติดภาระและอยู่ในการควบคุมของเหรัญญิก พันธบัตรที่วางเป็นหลักประกันซื้อคืนกับ ธปท. แล้วไม่นับ เพดานตามการตีความประกาศ ธปท. ของต้นแบบ รอยืนยัน"))}</p>`;
}
function lcrFlows() {
  const c = lcrCalc(1);
  return `<section class="card"><div class="card-head"><div class="card-title">${esc(tt("Outflows over 30 days", "กระแสเงินสดไหลออก 30 วัน"))}</div></div><div class="card-body flush">${table({ cols: ["Category", "Balance", "Run-off", "Outflow"], rows: c.outs.map((o) => [tt(o.en, o.th), tbn(o.bal), tpct(o.rate * 100), tbn(o.flow)]).concat([[tt("Total", "รวม"), "", "", tbn(c.out)]]) }, tt("Outflows", "ไหลออก"))}</div></section>
    <section class="card"><div class="card-head"><div class="card-title">${esc(tt("Inflows over 30 days", "กระแสเงินสดไหลเข้า 30 วัน"))}</div></div><div class="card-body flush">${table({ cols: ["Category", "Balance", "Counted", "Outflow"], rows: LCR_IN.map(([en, th, b, r]) => [tt(en, th), tbn(b), tpct(r * 100), tbn(b * r)]).concat([[tt("Total, capped at 75% of outflows", "รวม เพดาน 75% ของไหลออก"), "", "", tbn(c.capped)]]) }, tt("Inflows", "ไหลเข้า"))}</div></section>`;
}
function lcrStressOut() {
  const c = lcrCalc(), warn = lcrAt(120), breach = lcrAt(100);
  return quoteRows([[tt("Outflows", "ไหลออก"), tbn(c.out)], [tt("Net outflows", "ไหลออกสุทธิ"), tbn(c.net)], [tt("Early warning, 120%, at", "เตือนล่วงหน้า 120% ที่"), warn ? `× ${warn.toFixed(2)}` : "—"], [tt("Breach, 100%, at", "ต่ำกว่าเกณฑ์ 100% ที่"), breach ? `× ${breach.toFixed(2)}` : "—"], ["LCR", tpct(c.ratio)]]) +
    (c.ratio < 100 ? notice("crit", tt("Below the BOT minimum", "ต่ำกว่าเกณฑ์ ธปท."), tt("Invoke the contingency funding plan and tell the BOT.", "ใช้แผนสภาพคล่องฉุกเฉินและแจ้ง ธปท.")) : c.ratio < 120 ? notice("info", tt("Early-warning trigger", "ถึงจุดเตือนล่วงหน้า"), tt("The treasurer convenes ALCO within the day.", "เหรัญญิกเรียกประชุม ALCO ภายในวัน")) : "");
}
function lcrStress() {
  return `<div class="grid-main"><section class="card"><div class="card-head"><div><div class="card-title">${esc(tt("Deposit run-off stress", "ทดสอบภาวะวิกฤตการถอนเงินฝาก"))}</div><div class="card-sub">${esc(tt("Multiplies every deposit run-off rate; lines and derivatives stay at their rates.", "คูณอัตราการถอนเงินฝากทุกประเภท วงเงินและอนุพันธ์คงเดิม"))}</div></div></div><div class="card-body" style="display:grid;gap:16px">
    <div class="field"><label for="lcr-mult">${esc(tt("Run-off multiplier", "ตัวคูณอัตราการถอน"))}: <b id="lcr-mult-v">× ${LCR.mult.toFixed(2)}</b></label><input type="range" id="lcr-mult" data-lcr-mult min="1" max="3" step="0.05" value="${LCR.mult}" style="accent-color:var(--accent)"></div><div id="lcrStressOut">${lcrStressOut()}</div></div></section>
    ${card(tt("Reading it", "วิธีอ่าน"), `<p class="muted" style="font-size:13px">${esc(tt("A multiplier of 2 is a run like 2008 for corporate deposits: the ratio falls below the internal trigger first, then the BOT minimum. The plan's actions are sized against the gap at each step.", "ตัวคูณ 2 เทียบเท่าการถอนเงินฝากนิติบุคคลแบบปี 2551 อัตราส่วนจะต่ำกว่าเกณฑ์ภายในก่อน แล้วจึงต่ำกว่าเกณฑ์ ธปท. แผนกำหนดขนาดการดำเนินการตามช่องว่างแต่ละขั้น"))}</p>`)}</div>`;
}
const CFP = [["Repo Thai government bonds with the BOT", "ทำธุรกรรมซื้อคืนพันธบัตรรัฐบาลกับ ธปท.", 10.0, "Same day"], ["Draw committed interbank lines", "เบิกวงเงินระหว่างธนาคารที่ผูกพัน", 4.0, "1 day"], ["Raise term deposit rates 25bp for 3–6 months", "ขึ้นดอกเบี้ยเงินฝากประจำ 3–6 เดือน 0.25%", 6.0, "2 weeks"], ["Slow new corporate lending commitments", "ชะลอการผูกพันสินเชื่อธุรกิจใหม่", 3.0, "1 month"]];
function lcrCfp() {
  return `<section class="card"><div class="card-head"><div><div class="card-title">${esc(tt("Contingency funding plan", "แผนสภาพคล่องฉุกเฉิน"))}</div><div class="card-sub">${esc(tt("Approved by the board, tested twice a year; actions in the order the treasurer takes them.", "คณะกรรมการธนาคารอนุมัติ ทดสอบปีละสองครั้ง เรียงตามลำดับที่เหรัญญิกดำเนินการ"))}</div></div></div><div class="card-body flush">${table({ cols: ["Action", "Raises", "Time"], rows: CFP.map(([en, th, v, time]) => [tt(en, th), tbn(v, 1), t(time)]) }, tt("Plan", "แผน"))}</div></section>
    ${LCR.cfp ? notice("info", tt("Sent to the ALCO chair", "ส่งประธาน ALCO แล้ว"), tt("The BOT is told the same day the plan is invoked.", "แจ้ง ธปท. ในวันเดียวกับที่ใช้แผน")) : ""}`;
}

/* ---------------- ALM-2026-10: interest-rate risk in the banking book ---------------- */
const ALM = { shock: 100 };
const BUCKETS_IR = [["Up to 1 month", "ไม่เกิน 1 เดือน", 42, 70, 11.5 / 12, 0.04], ["1–3 months", "1–3 เดือน", 38, 45, 10 / 12, 0.17], ["3–6 months", "3–6 เดือน", 26, 36, 7.5 / 12, 0.375], ["6–12 months", "6–12 เดือน", 30, 28, 3 / 12, 0.75],
  ["1–3 years", "1–3 ปี", 44, 20, 0, 2], ["3–5 years", "3–5 ปี", 22, 8, 0, 4], ["Over 5 years", "เกิน 5 ปี", 18, 3, 0, 7]];
const NII_BASE = 8.2, TIER1 = 22.0;
function almCalc(bp = ALM.shock) {
  const r = bp / 10000, rows = BUCKETS_IR.map(([en, th, a, l, w, d]) => ({ en, th, a, l, gap: a - l, w, d }));
  let cum = 0; rows.forEach((x) => { cum += x.gap; x.cum = cum; });
  const nii = rows.reduce((s, x) => s + x.gap * x.w * r, 0), eve = -rows.reduce((s, x) => s + x.gap * x.d * r, 0);
  return { rows, nii, eve, niiPct: nii / NII_BASE * 100, evePct: eve / TIER1 * 100 };
}
const almWorst = (bp = Math.abs(ALM.shock)) => { const u = almCalc(bp), d = almCalc(-bp); return { nii: Math.min(u.nii, d.nii), eve: Math.min(u.eve, d.eve), niiPct: Math.min(u.niiPct, d.niiPct), evePct: Math.min(u.evePct, d.evePct) }; };
function viewALM() {
  const w = almWorst(100);
  return recordPage({ title: "ALM-2026-10", mono: true, lede: esc(tt("Interest-rate risk in the banking book · October · repricing gap, earnings and economic value · for ALCO on 28 Oct", "ความเสี่ยงด้านอัตราดอกเบี้ยในบัญชีเพื่อการธนาคาร · ตุลาคม · ช่องว่างการปรับอัตรา รายได้ และมูลค่าทางเศรษฐกิจ · เสนอ ALCO 28 ต.ค.")),
    pills: P(w.niiPct < -5 || w.evePct < -15 ? "crit" : "good", w.niiPct < -5 || w.evePct < -15 ? tt("Outside a limit at ±100bp", "เกินเพดานที่ ±100bp") : tt("Within limits at ±100bp", "อยู่ในเพดานที่ ±100bp")),
    facts: [[tt("NII, next 12 months", "รายได้ดอกเบี้ยสุทธิ 12 เดือน"), tbn(NII_BASE, 1)], [tt("NII at ±100bp, worst", "NII ที่ ±100bp กรณีแย่สุด"), tbn(w.nii), w.niiPct < -5 ? "crit" : "", tt(`${tpct(w.niiPct, 1)} · limit −5%`, `${tpct(w.niiPct, 1)} · เพดาน −5%`)], [tt("EVE at ±100bp, worst", "EVE ที่ ±100bp กรณีแย่สุด"), tbn(w.eve), w.evePct < -15 ? "crit" : "", tt(`${tpct(w.evePct, 1)} of tier 1 · limit −15%`, `${tpct(w.evePct, 1)} ของเงินกองทุนชั้นที่ 1 · เพดาน −15%`)], [tt("Tier 1 capital", "เงินกองทุนชั้นที่ 1"), tbn(TIER1, 1)]],
    panels: { gap: almGap, sensitivity: almSens } });
}
function almGap() {
  const a = almCalc();
  return `<section class="card"><div class="card-head"><div><div class="card-title">${esc(tt("Repricing gap", "ช่องว่างการปรับอัตราดอกเบี้ย"))}</div><div class="card-sub">${esc(tt("Assets and liabilities by when their rate next changes. Savings and current accounts are placed by the behavioural model, not at overnight.", "สินทรัพย์และหนี้สินตามวันที่อัตราเปลี่ยนครั้งถัดไป เงินฝากออมทรัพย์และกระแสรายวันจัดตามแบบจำลองพฤติกรรม ไม่ใช่ข้ามคืน"))}</div></div></div><div class="card-body flush">
    ${table({ cols: ["Bucket", "Rate-sensitive assets", "Rate-sensitive liabilities", "Gap", "Cumulative"], rows: a.rows.map((x) => [tt(x.en, x.th), tbn(x.a, 1), tbn(x.l, 1), `<span style="color:var(--${x.gap < 0 ? "warn" : "ink"})">${tbn(x.gap, 1)}</span>`, tbn(x.cum, 1)]) }, tt("Gap", "ช่องว่าง"))}</div></section>
    <p class="note">${esc(tt("More liabilities than assets reprice within a year, so rising rates cut earnings at first; long fixed-rate loans mean the economic value falls when rates rise.", "หนี้สินปรับอัตราภายในหนึ่งปีมากกว่าสินทรัพย์ ดอกเบี้ยขึ้นจึงลดรายได้ในช่วงแรก และสินเชื่ออัตราคงที่ระยะยาวทำให้มูลค่าทางเศรษฐกิจลดลงเมื่อดอกเบี้ยขึ้น"))}</p>`;
}
const almOut = () => { const a = almCalc(); return quoteRows([[tt("NII change, 12 months", "รายได้ดอกเบี้ยสุทธิเปลี่ยน 12 เดือน"), `${tbn(a.nii)} · ${tpct(a.niiPct, 1)}`], [tt("EVE change", "มูลค่าทางเศรษฐกิจเปลี่ยน"), `${tbn(a.eve)} · ${tpct(a.evePct, 1)}`], [tt("Limits", "เพดาน"), a.niiPct < -5 || a.evePct < -15 ? tt("Outside: NII −5%, EVE −15% of tier 1", "เกิน: NII −5% EVE −15% ของเงินกองทุนชั้นที่ 1") : tt("Within: NII −5%, EVE −15% of tier 1", "อยู่ในเพดาน: NII −5% EVE −15% ของเงินกองทุนชั้นที่ 1")]]); };
function almSens() {
  return `<div class="grid-main"><section class="card"><div class="card-head"><div><div class="card-title">${esc(tt("Parallel rate shock", "การเปลี่ยนอัตราดอกเบี้ยแบบขนาน"))}</div><div class="card-sub">${esc(tt("Earnings over 12 months from the gap inside a year; economic value from the gap times each bucket's duration.", "รายได้ 12 เดือนจากช่องว่างภายในหนึ่งปี มูลค่าทางเศรษฐกิจจากช่องว่างคูณดูเรชันของแต่ละช่วง"))}</div></div></div><div class="card-body" style="display:grid;gap:16px">
    <div class="field"><label for="alm-shock">${esc(tt("Shock", "การเปลี่ยนแปลง"))}: <b id="alm-shock-v">${ALM.shock > 0 ? "+" : ""}${ALM.shock}bp</b></label><input type="range" id="alm-shock" data-alm-shock min="-300" max="300" step="25" value="${ALM.shock}" style="accent-color:var(--accent)"></div><div id="almOut">${almOut()}</div></div></section>
    ${card(tt("At ALCO", "ในการประชุม ALCO"), `<p class="muted" style="font-size:13px">${esc(tt("Above about +150bp the economic value falls past its limit. The usual answers are a receive-fixed swap or longer fixed-rate deposits; the treasurer brings sized options to ALCO.", "เมื่อเกินประมาณ +150bp มูลค่าทางเศรษฐกิจจะลดลงเกินเพดาน ทางแก้ทั่วไปคือสัญญาแลกเปลี่ยนรับอัตราคงที่ หรือเงินฝากประจำระยะยาวขึ้น เหรัญญิกเสนอทางเลือกพร้อมขนาดต่อ ALCO"))}</p>`)}</div>`;
}

/* ---------------- FX-26-10-0918: a customer forward, front to back ---------------- */
const FXD = { cover: "mismatch", settled: false };
const FX_FWD = { usd: 2400000, rate: 35.81, spot: 36.08, mkt: 35.92, value: Date.UTC(2027, 1, 22), pfe: 0.06 };
const fxThb = () => FX_FWD.usd * FX_FWD.rate, fxMtm = () => (FX_FWD.mkt - FX_FWD.rate) * FX_FWD.usd;
const fxLine = () => { const l = FAC.lines.find((x) => x[0] === "FX-B2031"); return { limit: l[3], used: l[4], add: fxThb() * FX_FWD.pfe }; };
function viewFX() {
  const L = fxLine(), after = L.used + L.add;
  return recordPage({ title: "FX-26-10-0918", mono: true, lede: esc(tt("Outright forward · Siam Freight Logistics buys USD 2,400,000 for value 22 Feb 2027 · to repay the LC-26-0412 trust receipt · dealer Teerapat S.", "สัญญาซื้อขายล่วงหน้า · สยามเฟรท โลจิสติกส์ ซื้อ USD 2,400,000 ส่งมอบ 22 ก.พ. 2570 · เพื่อชำระทรัสต์รีซีทของ LC-26-0412 · ผู้ค้า ธีรภัทร ส.")),
    pills: P("good", tt("Booked 23 Oct 16:40", "บันทึก 23 ต.ค. 16:40")) + P(FXD.cover === "matched" ? "good" : "crit", FXD.cover === "matched" ? tt("Confirmations matched", "ยืนยันตรงกันแล้ว") : FXD.cover === "chased" ? tt("Waiting for the corrected MT300", "รอ MT300 ฉบับแก้ไข") : tt("MT300 mismatch", "MT300 ไม่ตรง")),
    actions: `<button class="btn primary" type="button" data-flow="fxResolve" ${FXD.cover === "matched" ? "disabled" : ""}>${esc(FXD.cover === "chased" ? tt("Record the corrected MT300", "บันทึก MT300 ฉบับแก้ไข") : tt("Resolve mismatch", "แก้ความไม่ตรง"))}</button>`,
    facts: [[t("Amount"), "USD 2,400,000.00"], [tt("Forward rate", "อัตราล่วงหน้า"), FX_FWD.rate.toFixed(4), "", tt(`spot ${FX_FWD.spot.toFixed(4)}`, `ทันที ${FX_FWD.spot.toFixed(4)}`)], [tt("THB to pay", "บาทที่ต้องชำระ"), baht(fxThb(), 0)], [tt("Value date", "วันส่งมอบ"), fd(FX_FWD.value)],
      [tt("Line after deal", "วงเงินหลังดีล"), `${Math.round(after / L.limit * 100)}%`, after / L.limit > 0.9 ? "warn" : "", "FX-B2031"], [tt("Mark-to-market, customer leg", "มูลค่ายุติธรรม ขาลูกค้า"), baht(-fxMtm(), 0), fxMtm() > 0 ? "warn" : ""]],
    panels: { deal: fxDeal, limits: fxLimits, confirm: fxConfirm, settle: fxSettle, mtm: fxMtmTab } });
}
function fxDeal() {
  const pts = (FX_FWD.rate - FX_FWD.spot) * 10000;
  return `<div class="grid-main">${card(tt("Deal", "ดีล"), kvHtml([[tt("Bank", "ธนาคาร"), tt("Sells USD, buys THB", "ขาย USD ซื้อบาท")], [tt("Customer", "ลูกค้า"), t("Siam Freight Logistics")], [t("Amount"), "USD 2,400,000.00"], [tt("Spot and points", "อัตราทันทีและส่วนต่าง"), `${FX_FWD.spot.toFixed(4)} ${pts < 0 ? "−" : "+"} ${Math.abs(pts).toFixed(0)} = ${FX_FWD.rate.toFixed(4)}`], [tt("Trade date", "วันทำรายการ"), "23 Oct 2026 16:40"], [tt("Purpose, BOT FX rules", "วัตถุประสงค์ ตามเกณฑ์ ธปท."), tt("Underlying: repaying trust receipt TR-26-0412 for imported trucks; evidence attached", "มีธุรกรรมอ้างอิง: ชำระทรัสต์รีซีท TR-26-0412 ค่ารถนำเข้า แนบหลักฐาน")]]))}
    ${card(tt("Cover", "การปิดฐานะ"), kvHtml([[tt("Cover deal", "ดีลปิดฐานะ"), "FX-26-10-0919"], [tt("With", "คู่สัญญา"), "Citibank N.A., Bangkok"], [tt("Bank", "ธนาคาร"), tt("Buys USD 2,400,000 forward at 35.7950", "ซื้อ USD 2,400,000 ล่วงหน้าที่ 35.7950")], [tt("Sales margin", "ส่วนต่างฝ่ายขาย"), baht((FX_FWD.rate - 35.795) * FX_FWD.usd, 0)]]))}</div>`;
}
function fxLimits() {
  const L = fxLine(), after = L.used + L.add;
  return card(tt("Pre-settlement line FX-B2031", "วงเงินก่อนการส่งมอบ FX-B2031"), quoteRows([[tt("Line", "วงเงิน"), baht(L.limit, 0)], [tt("Used before", "ใช้ก่อนดีล"), baht(L.used, 0)], [tt(`This deal: ${tpct(FX_FWD.pfe * 100)} of notional for a 4-month forward`, `ดีลนี้: ${tpct(FX_FWD.pfe * 100)} ของมูลค่าสำหรับสัญญา 4 เดือน`), baht(L.add, 0)], [tt("Used after", "ใช้หลังดีล"), `${baht(after, 0)} · ${Math.round(after / L.limit * 100)}%`]]) +
    `<p class="note" style="margin-top:12px">${esc(tt("Checked at booking: within the line under FAC-B2031's group limit, so the dealer needed no credit approval. Settlement risk on value date is checked separately against the bank's daily settlement limit.", "ตรวจเมื่อบันทึก: อยู่ในวงเงินภายใต้วงเงินกลุ่ม FAC-B2031 ผู้ค้าจึงไม่ต้องขออนุมัติสินเชื่อ ความเสี่ยงการส่งมอบในวันส่งมอบตรวจแยกกับวงเงินส่งมอบรายวัน"))}</p>`);
}
function fxConfirm() {
  const rows = [[tt("Customer leg", "ขาลูกค้า"), tt("Trade portal, e-signed by Siam Freight", "พอร์ทัลการค้า ลงนามอิเล็กทรอนิกส์โดยสยามเฟรท"), "22 Feb 2027", "22 Feb 2027", P("good", "Matched")],
    [tt("Cover leg, MT300", "ขาปิดฐานะ MT300"), "Citibank N.A., Bangkok", "22 Feb 2027", FXD.cover === "mismatch" ? "23 Feb 2027" : FXD.cover === "chased" ? tt("awaiting", "รอ") : "22 Feb 2027", P(FXD.cover === "matched" ? "good" : FXD.cover === "chased" ? "warn" : "crit", FXD.cover === "matched" ? "Matched" : FXD.cover === "chased" ? "Chased" : "Mismatch")]];
  return `<section class="card"><div class="card-head"><div><div class="card-title">${esc(tt("Confirmations", "การยืนยันดีล"))}</div><div class="card-sub">${esc(tt("Matched by operations, not the dealer. Every field is compared; here the value date differs.", "ฝ่ายปฏิบัติการเป็นผู้จับคู่ ไม่ใช่ผู้ค้า เทียบทุกช่อง ครั้งนี้วันส่งมอบไม่ตรง"))}</div></div></div><div class="card-body flush">${table({ cols: ["Leg", "Confirmed by", "Our value date", "Their value date", "State"], rows }, tt("Confirmations", "การยืนยัน"))}</div></section>`;
}
function fxSettle() {
  return card(tt("Settlement on 22 Feb 2027", "การส่งมอบวันที่ 22 ก.พ. 2570"), quoteRows([[tt("Siam Freight pays, from CUR-B2031", "สยามเฟรทจ่าย จาก CUR-B2031"), baht(fxThb())], [tt("Bank pays USD, to the trust receipt", "ธนาคารจ่าย USD ชำระทรัสต์รีซีท"), "USD 2,400,000.00"], [tt("Cover: Citibank pays USD to NOS-USD-01", "ปิดฐานะ: ซิตี้แบงก์โอน USD เข้า NOS-USD-01"), "USD 2,400,000.00"], [tt("Cover: bank pays THB by BAHTNET", "ปิดฐานะ: ธนาคารจ่ายบาททาง BAHTNET"), baht(35.795 * FX_FWD.usd)]]) + `<p class="note" style="margin-top:12px">${esc(tt("Instructions come from the standing settlement instructions on file; a change of instructions needs a call-back to a number on file.", "คำสั่งส่งมอบใช้ตามที่บันทึกไว้ การเปลี่ยนคำสั่งต้องโทรยืนยันกลับไปยังเบอร์ที่บันทึกไว้"))}</p>`);
}
function fxMtmTab() {
  const m = fxMtm();
  return card(tt("Mark-to-market, 23 Oct close", "มูลค่ายุติธรรม ณ สิ้นวัน 23 ต.ค."), quoteRows([[tt("Market forward for 22 Feb", "อัตราล่วงหน้าตลาดสำหรับ 22 ก.พ."), FX_FWD.mkt.toFixed(4)], [tt("Customer leg", "ขาลูกค้า"), baht(-m, 0)], [tt("Cover leg", "ขาปิดฐานะ"), baht((FX_FWD.mkt - 35.795) * FX_FWD.usd, 0)], [tt("Bank's net, the sales margin", "สุทธิของธนาคาร คือส่วนต่างฝ่ายขาย"), baht((FX_FWD.rate - 35.795) * FX_FWD.usd, 0)]]) + `<p class="note" style="margin-top:12px">${esc(tt("The dollar has firmed since the deal, so the customer is in the money and the bank's current exposure to Siam Freight is nil; the line still holds the potential exposure.", "ดอลลาร์แข็งค่าขึ้นหลังทำดีล ลูกค้าได้ประโยชน์ ธนาคารจึงไม่มีความเสี่ยงปัจจุบันต่อสยามเฟรท แต่วงเงินยังกันความเสี่ยงที่อาจเกิดไว้"))}</p>`);
}

/* ---------------- NOS-EUR-01: the EUR nostro at Deutsche Bank ---------------- */
const NOS = { matched: false, maker: null, approved: false };
const NOS_LINES = [[Date.UTC(2026, 9, 20), "Incoming from Siemens AG for Siam Energy PCL", "รับเงินจาก Siemens AG ให้ Siam Energy PCL", 180000, "PAY-EUR-1020", "/RFB/PAY-EUR-1020", "auto"],
  [Date.UTC(2026, 9, 21), "Outgoing MT103 for Pacific Import Trading", "MT103 จ่ายออกให้ Pacific Import Trading", -64300, "PAY-EUR-1021", "/RFB/PAY-EUR-1021", "auto"],
  [Date.UTC(2026, 9, 22), "Incoming for Lanna Craft Export, invoice 8812", "รับเงินให้ Lanna Craft Export ใบแจ้งหนี้ 8812", 25000, "INV 8812 LANNA", "/RFB/LANNA CRAFT 8812", "suggest"],
  [Date.UTC(2026, 9, 22), "Charges, September", "ค่าธรรมเนียม กันยายน", -1200, "", "CHARGES SEP 2026", "theirs"]];
const NOS_RATE = 39.15, nosThb = () => r2(1200 * NOS_RATE);
const nosOpen = () => (NOS.matched ? 0 : 1) + (NOS.approved ? 0 : 1);
function viewNOS() {
  const ours = 3418200 - (NOS.approved ? 1200 : 0), theirs = 3417000;
  return recordPage({ title: "NOS-EUR-01", mono: true, lede: esc(tt("EUR nostro at Deutsche Bank, Frankfurt · statement MT950 of 23 Oct 2026 against the general ledger 1150-EUR", "บัญชีนอสโตร EUR ที่ Deutsche Bank แฟรงก์เฟิร์ต · รายการบัญชี MT950 วันที่ 23 ต.ค. 2569 เทียบบัญชีแยกประเภท 1150-EUR")),
    pills: P(ours === theirs ? "good" : "crit", ours === theirs ? tt("Reconciled", "กระทบยอดแล้ว") : tt(`Break €${(ours - theirs).toLocaleString("en-US", { minimumFractionDigits: 2 })}`, `ผลต่าง €${(ours - theirs).toLocaleString("en-US", { minimumFractionDigits: 2 })}`)) + (NOS.maker && !NOS.approved ? P("warn", tt("Journal waiting for a checker", "รายการบัญชีรอผู้ตรวจ")) : ""),
    actions: `<button class="btn" type="button" data-flow="nosMatch" ${NOS.matched ? "disabled" : ""}>${esc(tt("Accept suggested match", "ยอมรับการจับคู่ที่เสนอ"))}</button>${NOS.maker && !NOS.approved ? `<button class="btn primary" type="button" data-flow="nosApprove">${esc(tt("Check the journal", "ตรวจรายการบัญชี"))}</button>` : `<button class="btn primary" type="button" data-flow="nosPost" ${NOS.approved ? "disabled" : ""}>${esc(tt("Post the charges", "บันทึกค่าธรรมเนียม"))}</button>`}`,
    facts: [[tt("Our books", "บัญชีของเรา"), `€${ours.toLocaleString("en-US", { minimumFractionDigits: 2 })}`], [tt("Their statement", "รายการของธนาคารต่างประเทศ"), "€3,417,000.00"], [tt("Difference", "ผลต่าง"), `€${(ours - theirs).toLocaleString("en-US", { minimumFractionDigits: 2 })}`, ours === theirs ? "" : "crit"], [tt("Open items", "รายการค้าง"), String(nosOpen()), nosOpen() ? "warn" : ""], [tt("Open since", "ค้างตั้งแต่"), fd(Date.UTC(2026, 9, 23)), "", tt("ageing limit 3 days", "เกณฑ์อายุ 3 วัน")]],
    panels: { lines: nosLinesTab, journal: nosJournal } });
}
function nosLinesTab() {
  const st = (k) => k === "auto" ? P("good", tt("Matched automatically", "จับคู่อัตโนมัติ")) : k === "suggest" ? P(NOS.matched ? "good" : "warn", NOS.matched ? tt("Matched by Ploy C.", "จับคู่โดยพลอย ช.") : tt("Suggested: same amount and date, references differ", "เสนอ: จำนวนและวันที่ตรง อ้างอิงต่างกัน")) : P(NOS.approved ? "good" : "crit", NOS.approved ? tt("Booked", "บันทึกแล้ว") : tt("Not on our books", "ไม่มีในบัญชีของเรา"));
  return `<section class="card"><div class="card-body flush">${table({ cols: ["Date", "What", "Amount", "Our reference", "Their reference", "State"], rows: NOS_LINES.map(([d, en, th, amt, ours, theirs, k]) => [fd(d), tt(en, th), `${amt < 0 ? "−" : ""}€${Math.abs(amt).toLocaleString("en-US", { minimumFractionDigits: 2 })}`, k === "theirs" && !NOS.approved ? "—" : ours || "JE-NOS-EUR-1023", theirs, st(k)]) }, tt("Statement lines", "รายการบัญชี"))}</div></section>`;
}
function nosJournal() {
  return card(tt("Journal for the charges", "รายการบัญชีค่าธรรมเนียม"), quoteRows([[tt("Debit 5410 Correspondent bank charges", "เดบิต 5410 ค่าธรรมเนียมธนาคารตัวแทน"), baht(nosThb())], [tt("Credit 1150-EUR Nostro, Deutsche Bank", "เครดิต 1150-EUR นอสโตร Deutsche Bank"), `€1,200.00 @ ${NOS_RATE.toFixed(4)}`], [tt("State", "สถานะ"), NOS.approved ? tt("Posted", "บันทึกแล้ว") : NOS.maker ? tt(`Prepared by ${ROLES.find((r) => r.id === NOS.maker).name}; waiting for a different person to check`, `จัดทำโดย ${ROLES.find((r) => r.id === NOS.maker).name} รอผู้ตรวจที่ไม่ใช่ผู้จัดทำ`) : tt("Not prepared", "ยังไม่จัดทำ")]]) + `<p class="note" style="margin-top:12px">${esc(tt("Charges agree with the tariff in the account agreement (€100 a month plus €50 per outgoing payment): 2 payments short of the bank's own estimate, so treasury ops also asks Deutsche Bank for the breakdown.", "ค่าธรรมเนียมตรงตามอัตราในสัญญาบัญชี (€100 ต่อเดือน บวก €50 ต่อรายการจ่ายออก) ต่างจากประมาณการของธนาคาร 2 รายการ ฝ่ายปฏิบัติการบริหารเงินจึงขอรายละเอียดจาก Deutsche Bank ด้วย"))}</p>`);
}

/* ---------------- Treasury overview ---------------- */
function viewTreasuryOverview() {
  const c = lcrCalc(1), w = almWorst(100);
  const tasks = [["LCR-2026-10", tt("LCR above the internal trigger; stress shows where it would cross", "LCR สูงกว่าจุดเตือน การทดสอบภาวะวิกฤตแสดงจุดที่จะต่ำกว่า"), c.ratio >= 120 ? "good" : "warn"], ["ALM-2026-10", tt("Repricing gap and rate shocks for ALCO on 28 Oct", "ช่องว่างการปรับอัตราและการทดสอบดอกเบี้ยสำหรับ ALCO 28 ต.ค."), w.evePct < -15 || w.niiPct < -5 ? "crit" : "good"],
    ["FX-26-10-0918", FXD.cover === "matched" ? tt("Forward confirmed on both legs", "สัญญาล่วงหน้ายืนยันครบทั้งสองขา") : tt("MT300 value date differs from our booking", "วันส่งมอบใน MT300 ไม่ตรงกับที่บันทึก"), FXD.cover === "matched" ? "good" : "crit"], ["NOS-EUR-01", NOS.approved && NOS.matched ? tt("Reconciled", "กระทบยอดแล้ว") : tt("€1,200 charges not on our books", "ค่าธรรมเนียม €1,200 ยังไม่อยู่ในบัญชี"), NOS.approved && NOS.matched ? "good" : "crit"]];
  return `<div class="head"><div>${eyebrow(sysById.treasury, t("Overview"))}<h1 class="title">${esc(tt("Treasury today", "บริหารเงินวันนี้"))}</h1><p class="lede">${esc(tt("Saturday 24 Oct 2026, positions at Friday's close. Liquidity, funding, rate risk, FX and the nostros in one place.", "วันเสาร์ที่ 24 ต.ค. 2569 ฐานะ ณ สิ้นวันศุกร์ สภาพคล่อง แหล่งเงิน ความเสี่ยงอัตราดอกเบี้ย FX และนอสโตรในที่เดียว"))}</p></div></div>
    ${factsHtml([["LCR", tpct(c.ratio), c.ratio < 120 ? "warn" : "", tt("BOT minimum 100%", "เกณฑ์ ธปท. 100%")], ["NSFR", "126%", "", tt("BOT minimum 100%", "เกณฑ์ ธปท. 100%")], [tt("FX net open position", "ฐานะเงินตราต่างประเทศสุทธิ"), "$12.4m", "", tt("limit $25.0m", "เพดาน $25.0m")], [tt("NII at ±100bp", "NII ที่ ±100bp"), tpct(w.niiPct, 1), w.niiPct < -5 ? "crit" : "", tt("limit −5%", "เพดาน −5%")], [tt("Nostro breaks", "ผลต่างนอสโตร"), String(NOS.approved && NOS.matched ? 0 : 1), NOS.approved && NOS.matched ? "" : "crit"]])}
    <div class="grid-main"><section class="card"><div class="card-head"><div class="card-title">${esc(tt("Needs attention", "ต้องดำเนินการ"))}</div></div><div class="card-body"><div class="list">${tasks.map(([id, w_, tone]) => `<div class="li"><span class="sev ${tone}">${icon(tone === "good" ? "i-check" : "i-alert")}</span><div><strong><button class="rec link" type="button" data-go="rec:${id}">${id}</button></strong><p>${esc(w_)}</p></div></div>`).join("")}</div></div></section>
    ${card(tt("Funding today", "แหล่งเงินวันนี้"), quoteRows([[tt("Lent overnight in the interbank market", "ให้กู้ยืมข้ามคืนในตลาดระหว่างธนาคาร"), "฿6.00bn @ 2.45%"], [tt("BOT reserve, average to date", "เงินสำรองที่ ธปท. เฉลี่ยถึงวันนี้"), tt("฿12.4bn, 104% of requirement", "฿12.4bn 104% ของที่กำหนด")], [tt("Large maturity", "รายการครบกำหนดใหญ่"), tt("TD-88140 Siam Energy, 29 Oct", "TD-88140 Siam Energy 29 ต.ค.")], [tt("Net 30-day outflow", "ไหลออกสุทธิ 30 วัน"), tbn(c.net)]]))}</div>`;
}

Object.assign(FLOWS, {
  cfpInvoke: () => ({ title: tt("Contingency funding plan", "แผนสภาพคล่องฉุกเฉิน"), sub: "LCR-2026-10", init: { stage: "watch" },
    fields: (d) => select("cfps", tt("Stage", "ระดับ"), [["watch", tt("Early warning: ALCO meets, actions 1 and 2 on standby", "เตือนล่วงหน้า: ประชุม ALCO เตรียมการขั้น 1 และ 2")], ["act", tt("Invoke: take actions 1 to 3 now", "ใช้แผน: ดำเนินการขั้น 1 ถึง 3 ทันที")]], d.stage) + `<p class="hint muted">${esc(tt(`Stressed LCR at × ${LCR.mult.toFixed(2)}: ${tpct(lcrCalc().ratio)}.`, `LCR ภายใต้ภาวะวิกฤตที่ × ${LCR.mult.toFixed(2)}: ${tpct(lcrCalc().ratio)}`))}</p>`,
    read: (d) => { d.stage = $("#cfps").value; return ""; },
    review: (d) => { const raise = d.stage === "act" ? CFP.slice(0, 3).reduce((a, x) => a + x[2], 0) : 0;
      return { html: quoteRows([[tt("Funding raised", "แหล่งเงินที่ได้"), tbn(raise, 1)], [tt("Who is told", "ผู้ที่ต้องแจ้ง"), d.stage === "act" ? tt("ALCO, the board risk committee and the BOT, today", "ALCO คณะกรรมการบริหารความเสี่ยง และ ธปท. วันนี้") : tt("ALCO", "ALCO")]]) + `<p class="consequence">${esc(d.stage === "act" ? tt("Starts the plan's first three actions; each is booked as its own deal and reported to the BOT the same day.", "เริ่มการดำเนินการสามขั้นแรกตามแผน แต่ละขั้นบันทึกเป็นดีลของตนเองและรายงาน ธปท. ในวันเดียวกัน") : tt("Calls ALCO within the day and puts the first two actions on standby.", "เรียกประชุม ALCO ภายในวัน และเตรียมการสองขั้นแรก"))}</p>`, confirm: tt("Send", "ส่ง"), auth: ["alco", 1] }; },
    done: () => { if (!LCR.cfp) { LCR.cfp = "sent"; setTimeout(render, 0); } return tt("Sent to the ALCO chair.", "ส่งประธาน ALCO แล้ว"); } }),
  fxResolve: () => FXD.cover === "chased"
    ? { title: tt("Record the corrected MT300", "บันทึก MT300 ฉบับแก้ไข"), sub: "FX-26-10-0919 · Citibank N.A., Bangkok", init: {}, fields: () => kvHtml([[tt("Their value date", "วันส่งมอบของคู่สัญญา"), "22 Feb 2027"], [tt("Every other field", "ช่องอื่นทั้งหมด"), tt("Agrees", "ตรงกัน")]]), read: () => "",
        review: () => ({ html: `<p class="consequence">${esc(tt("Matches the cover leg; both legs are now confirmed and the deal goes to settlement on 22 Feb 2027.", "จับคู่ขาปิดฐานะ ทั้งสองขายืนยันแล้ว และดีลรอส่งมอบวันที่ 22 ก.พ. 2570"))}</p>`, confirm: tt("Match", "จับคู่") }),
        done: () => { if (FXD.cover !== "matched") { FXD.cover = "matched"; setTimeout(render, 0); } return tt("Confirmations matched.", "ยืนยันตรงกันแล้ว"); } }
    : { title: tt("Resolve the confirmation mismatch", "แก้การยืนยันที่ไม่ตรง"), sub: "FX-26-10-0919 · Citibank N.A., Bangkok", init: { who: "ours" },
        fields: (d) => select("fxw", tt("Which is right", "ข้อมูลใดถูกต้อง"), [["ours", tt("Our booking, 22 Feb: the dealer's recording confirms it", "ที่เราบันทึก 22 ก.พ.: เทปการสนทนาของผู้ค้ายืนยัน")], ["theirs", tt("Theirs, 23 Feb: amend our deal", "ของคู่สัญญา 23 ก.พ.: แก้ดีลของเรา")]], d.who),
        read: (d) => { d.who = $("#fxw").value; return ""; },
        review: (d) => ({ html: `<p class="consequence">${esc(d.who === "ours" ? tt("Sends an MT399 asking Citibank to cancel and re-send its MT300 for 22 Feb. The deal stays unconfirmed until it arrives; escalated to the head of treasury ops if not by Monday noon.", "ส่ง MT399 ขอให้ซิตี้แบงก์ยกเลิกและส่ง MT300 ใหม่สำหรับ 22 ก.พ. ดีลยังไม่ยืนยันจนกว่าจะได้รับ หากไม่ได้รับภายในเที่ยงวันจันทร์จะส่งหัวหน้าฝ่ายปฏิบัติการบริหารเงิน") : tt("A change to a booked deal needs the dealer's head to agree and moves the customer leg too, which Siam Freight would have to re-confirm. Use only if the recording supports it.", "การแก้ดีลที่บันทึกแล้วต้องได้รับความเห็นชอบจากหัวหน้าผู้ค้า และกระทบขาลูกค้าซึ่งสยามเฟรทต้องยืนยันใหม่ ใช้เมื่อเทปสนทนายืนยันเท่านั้น"))}</p>`, blocked: d.who === "theirs", confirm: tt("Send MT399", "ส่ง MT399") }),
        done: () => { if (FXD.cover === "mismatch") { FXD.cover = "chased"; setTimeout(render, 0); } return tt("MT399 sent to Citibank.", "ส่ง MT399 ถึงซิตี้แบงก์แล้ว"); } },
  nosMatch: () => ({ title: tt("Accept the suggested match", "ยอมรับการจับคู่ที่เสนอ"), sub: "NOS-EUR-01 · €25,000.00", init: {}, fields: () => kvHtml([[tt("Our entry", "รายการของเรา"), "INV 8812 LANNA · 22 Oct · €25,000.00"], [tt("Their line", "รายการของคู่สัญญา"), "/RFB/LANNA CRAFT 8812 · 22 Oct · €25,000.00"], [tt("Why suggested", "เหตุที่เสนอ"), tt("Same amount and date; both references carry invoice 8812", "จำนวนและวันที่ตรงกัน อ้างอิงทั้งสองมีใบแจ้งหนี้ 8812")]]), read: () => "",
    review: () => ({ html: `<p class="consequence">${esc(tt("Matches the two lines and teaches the matcher this reference pattern for Lanna Craft.", "จับคู่สองรายการ และให้ระบบจดจำรูปแบบอ้างอิงนี้ของ Lanna Craft"))}</p>`, confirm: tt("Match", "จับคู่") }),
    done: () => { if (!NOS.matched) { NOS.matched = true; setTimeout(render, 0); } return tt("Matched.", "จับคู่แล้ว"); } }),
  nosPost: () => ({ title: tt("Post the charges", "บันทึกค่าธรรมเนียม"), sub: "NOS-EUR-01 · €1,200.00", init: {}, fields: () => kvHtml([[tt("Debit", "เดบิต"), tt("5410 Correspondent bank charges", "5410 ค่าธรรมเนียมธนาคารตัวแทน")], [tt("Credit", "เครดิต"), "1150-EUR Nostro, Deutsche Bank"], [t("Amount"), `€1,200.00 · ${baht(nosThb())}`]]), read: () => "",
    review: () => ({ html: `<p class="consequence">${esc(tt("Prepares the journal. Someone other than you checks it before it posts.", "จัดทำรายการบัญชี ต้องให้ผู้อื่นที่ไม่ใช่คุณตรวจก่อนบันทึก"))}</p>`, confirm: tt("Prepare", "จัดทำ") }),
    done: () => { if (!NOS.maker) { NOS.maker = role.id; setTimeout(render, 0); } return tt("Journal prepared; waiting for a checker.", "จัดทำรายการบัญชีแล้ว รอผู้ตรวจ"); } }),
  nosApprove: () => ({ title: tt("Check the journal", "ตรวจรายการบัญชี"), sub: "NOS-EUR-01 · €1,200.00", init: {}, fields: () => kvHtml([[tt("Prepared by", "จัดทำโดย"), ROLES.find((r) => r.id === NOS.maker).name], [t("Amount"), `€1,200.00 · ${baht(nosThb())}`]]), read: () => "",
    review: () => role.id === NOS.maker ? { html: notice("crit", tt("You prepared this journal", "คุณเป็นผู้จัดทำรายการนี้"), tt("A different person must check it.", "ต้องให้ผู้อื่นตรวจ")), blocked: true }
      : { html: quoteRows([[tt("Debit 5410, credit 1150-EUR", "เดบิต 5410 เครดิต 1150-EUR"), baht(nosThb())]]) + `<p class="consequence">${esc(tt("Posts the journal; the nostro agrees with the statement once every line is matched.", "บันทึกรายการบัญชี นอสโตรจะตรงกับรายการของธนาคารต่างประเทศเมื่อจับคู่ครบทุกรายการ"))}</p>`, confirm: tt("Approve and post", "อนุมัติและบันทึก"), auth: ["journal", nosThb()] },
    done: (d) => { if (!NOS.approved && !(d.auth && !d.auth.ok)) { NOS.approved = true; resolvedExc.add(EXC.findIndex((x) => x[2].startsWith("NOS-EUR-01"))); setTimeout(render, 0); } return tt("Journal posted.", "บันทึกรายการบัญชีแล้ว"); } }),
});
document.addEventListener("input", (e) => {
  const d = e.target.dataset || {};
  if (d.lcrMult !== undefined) { LCR.mult = +e.target.value; $("#lcr-mult-v").textContent = `× ${LCR.mult.toFixed(2)}`; $("#lcrStressOut").innerHTML = lcrStressOut(); }
  if (d.almShock !== undefined) { ALM.shock = +e.target.value; $("#alm-shock-v").textContent = `${ALM.shock > 0 ? "+" : ""}${ALM.shock}bp`; $("#almOut").innerHTML = almOut(); }
});

ACTIONS.push(["alco", "Contingency funding actions", "Asset and liability committee chair"]);
sysById.treasury.sections = [["overview", "Overview"], ["liquidity", "Liquidity"], ["alm", "Interest-rate risk"], ["deals", "Deals"], ["fx", "FX positions"], ["nostro", "Nostro accounts", 1, true]];
PAGE_VIEWS["treasury/overview"] = viewTreasuryOverview;
EXTRA_LISTS.push(() => ({
  "treasury/liquidity": { cols: ["Report", "As of", "Ratio", "Minimum", "State"], rows: [[R("LCR-2026-10"), "23 Oct 2026", tpct(lcrCalc(1).ratio), "100%", P(LCR.cfp ? "info" : "good", LCR.cfp ? "Contingency plan with ALCO" : "Within limit")], ["NSFR-2026-Q3", "30 Sep 2026", "126%", "100%", P("good", "Within limit")]] },
  "treasury/alm": { cols: ["Report", "As of", "NII at ±100bp", "EVE at ±100bp", "State"], rows: [[R("ALM-2026-10"), "23 Oct 2026", tpct(almWorst(100).niiPct, 1), tpct(almWorst(100).evePct, 1), P("good", "Within limit")]] },
  "treasury/deals": { cols: ["Deal", "Counterparty", "Type", "Amount", "Value date", "State"], rows: [[R("FX-26-10-0918"), t("Siam Freight Logistics"), "Forward · bank sells USD", "USD 2,400,000.00", "22 Feb 2027", P(FXD.cover === "matched" ? "good" : "crit", FXD.cover === "matched" ? "Confirmed" : "Unconfirmed")],
    [R("FX-26-10-0919"), "Citibank N.A., Bangkok", "Forward · bank buys USD", "USD 2,400,000.00", "22 Feb 2027", P(FXD.cover === "matched" ? "good" : "crit", FXD.cover === "matched" ? "Confirmed" : "Mismatch")], ["FX-26-10-0907", "Siam Energy PCL", "Spot · bank buys EUR", "EUR 1,500,000.00", "27 Oct 2026", P("good", "Confirmed")]] },
  "treasury/nostro": { cols: ["Nostro", "Bank", "Currency", "Our books", "Their statement", "State"], rows: [[R("NOS-USD-01"), "Citibank New York", "USD", "$41,220,118.20", "$41,220,118.20", P("good", "Matched")], [R("NOS-JPY-01"), "MUFG Tokyo", "JPY", "¥1,204,880,000", "¥1,204,880,000", P("good", "Matched")],
    [R("NOS-EUR-01"), "Deutsche Bank Frankfurt", "EUR", NOS.approved ? "€3,417,000.00" : "€3,418,200.00", "€3,417,000.00", P(NOS.approved && NOS.matched ? "good" : "crit", NOS.approved && NOS.matched ? "Matched" : "Break")]] },
}));
Object.assign(RECS, {
  "LCR-2026-10": { sys: "treasury", sec: "liquidity", label: "LCR-2026-10", kind: "Liquidity coverage ratio", match: ["LCR-2026-10"], view: () => viewLCR(), tabs: [["hqla", "Liquid assets", 4], ["outflows", "Cash flows"], ["stress", "Stress"], ["cfp", "Contingency plan"]] },
  "ALM-2026-10": { sys: "treasury", sec: "alm", label: "ALM-2026-10", kind: "Interest-rate risk", match: ["ALM-2026-10"], view: () => viewALM(), tabs: [["gap", "Repricing gap"], ["sensitivity", "Rate shocks"]] },
  "FX-26-10-0918": { sys: "treasury", sec: "deals", label: "FX-26-10-0918", kind: "FX forward", match: ["FX-26-10-0918"], view: () => viewFX(), tabs: [["deal", "Deal"], ["limits", "Credit line"], ["confirm", "Confirmations", 2], ["settle", "Settlement plan"], ["mtm", "Mark-to-market"]] },
  "NOS-EUR-01": { sys: "treasury", sec: "nostro", label: "NOS-EUR-01", kind: "Nostro reconciliation", match: ["NOS-EUR-01"], view: () => viewNOS(), tabs: [["lines", "Statement lines", 4], ["journal", "Journal"]] },
});
Object.assign(TH, { "Contingency funding actions": "การดำเนินการตามแผนสภาพคล่องฉุกเฉิน", "Asset and liability committee chair": "ประธานคณะกรรมการบริหารสินทรัพย์และหนี้สิน", "Liquidity coverage ratio": "อัตราส่วน LCR", "Interest-rate risk": "ความเสี่ยงอัตราดอกเบี้ย", "FX forward": "สัญญาซื้อขายเงินตราล่วงหน้า", "Nostro reconciliation": "กระทบยอดนอสโตร",
  "Liquid assets": "สินทรัพย์สภาพคล่อง", "Cash flows": "กระแสเงินสด", "Contingency plan": "แผนฉุกเฉิน", "Repricing gap": "ช่องว่างการปรับอัตรา", "Rate shocks": "การทดสอบอัตราดอกเบี้ย", "Credit line": "วงเงินคู่สัญญา", "Confirmations": "การยืนยันดีล", "Settlement plan": "แผนการส่งมอบ", "Mark-to-market": "มูลค่ายุติธรรม", "Statement lines": "รายการบัญชี",
  "Level": "ระดับ", "Market value": "มูลค่าตลาด", "Haircut": "ส่วนลด", "Counted": "นับได้", "Category": "ประเภท", "Run-off": "อัตราไหลออก", "Outflow": "จำนวนที่นับ", "Raises": "แหล่งเงินที่ได้",
  "Rate-sensitive assets": "สินทรัพย์ที่อ่อนไหวต่ออัตรา", "Rate-sensitive liabilities": "หนี้สินที่อ่อนไหวต่ออัตรา", "Gap": "ช่องว่าง", "Leg": "ขา", "Confirmed by": "ยืนยันโดย", "Our value date": "วันส่งมอบของเรา", "Their value date": "วันส่งมอบของคู่สัญญา",
  "Our reference": "อ้างอิงของเรา", "Their reference": "อ้างอิงของคู่สัญญา", "As of": "ณ วันที่", "Ratio": "อัตราส่วน", "Minimum": "ขั้นต่ำ", "NII at ±100bp": "NII ที่ ±100bp", "EVE at ±100bp": "EVE ที่ ±100bp", "Counterparty": "คู่สัญญา", "Value date": "วันส่งมอบ",
  "Same day": "ภายในวัน", "1 day": "1 วัน", "2 weeks": "2 สัปดาห์", "1 month": "1 เดือน", "Contingency plan with ALCO": "แผนฉุกเฉินอยู่ที่ ALCO", "Confirmed": "ยืนยันแล้ว", "Unconfirmed": "ยังไม่ยืนยัน", "Mismatch": "ไม่ตรง", "Chased": "ติดตามแล้ว",
  "Forward · bank sells USD": "ล่วงหน้า · ธนาคารขาย USD", "Forward · bank buys USD": "ล่วงหน้า · ธนาคารซื้อ USD", "Spot · bank buys EUR": "ทันที · ธนาคารซื้อ EUR" });

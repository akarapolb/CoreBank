// Fabor console prototype · Lending: servicing a home loan, a new application from intake to disbursement,
// commercial credit facilities with covenants and collateral, and the Lending overview.
// Classic scripts sharing one global scope; load order is set in index.html.
const pmt = (r, n, pv) => (r ? pv * r / (1 - Math.pow(1 + r, -n)) : pv / n);
// months and interest to repay a balance at a fixed instalment
function amortise(bal, r, pay) {
  let n = 0, interest = 0;
  while (bal > 0.005 && n < 1200) { const i = r2(bal * r); interest += i; bal = r2(bal - Math.min(bal, r2(pay - i))); n++; }
  return { n, interest: r2(interest) };
}
const addMonths = (ms, k) => { const d = new Date(ms); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + k, d.getUTCDate()); };
const monthsTh = (n) => tt(`${n} months`, `${n} เดือน`);
const yearsMonths = (n) => { const y = Math.floor(n / 12), m = n % 12; return lang === "th" ? `${y ? `${y} ปี` : ""}${y && m ? " " : ""}${m ? `${m} เดือน` : ""}` : `${y ? `${y} year${y > 1 ? "s" : ""}` : ""}${y && m ? " " : ""}${m ? `${m} month${m > 1 ? "s" : ""}` : ""}`; };

/* ---------------- LN-77120: a performing home loan, computed so every figure agrees ---------------- */
const HOME = (() => {
  const P = 3200000, pay = 18500, fixed = 0.0325, mrr = 0.073, margin = 0.0175, paid = 43, rows = [];
  const rateAt = (i) => (i <= 36 ? fixed : mrr - margin);
  let bal = P;
  for (let i = 1; i <= paid; i++) {
    const interest = r2(bal * rateAt(i) / 12), principal = r2(pay - interest);
    bal = r2(bal - principal);
    rows.push({ n: i, due: Date.UTC(2023, 2 + i, 15), interest, principal, amount: pay, balance: bal, state: "paid", rate: rateAt(i) });
  }
  const rate = mrr - margin, r = rate / 12, left = amortise(bal, r, pay);
  for (let i = paid + 1, b = bal; i <= paid + 12; i++) {
    const interest = r2(b * r), principal = r2(pay - interest);
    b = r2(b - principal);
    rows.push({ n: i, due: Date.UTC(2023, 2 + i, 15), interest, principal, amount: pay, balance: b, state: i === paid + 1 ? "next" : "scheduled", rate });
  }
  const int2025 = r2(rows.filter((x) => new Date(x.due).getUTCFullYear() === 2025).reduce((s, x) => s + x.interest, 0));
  const int2026 = r2(rows.filter((x) => x.state === "paid" && new Date(x.due).getUTCFullYear() === 2026).reduce((s, x) => s + x.interest, 0));
  return { P, pay, mrr, margin, rate, r, rows, paid, bal, left, ends: addMonths(rows[paid - 1].due, left.n), contractEnds: Date.UTC(2053, 2, 15), next: rows[paid],
    int2025, int2026, valuation: 3900000, td: 200000, tdInterest: r2(200000 * 0.02 * 182 / 365) };
})();
const homeDailyInterest = () => r2(HOME.bal * HOME.rate / 365);
let homeLog = [];

function viewHome() {
  const H = HOME;
  return recordPage({ title: "LN-77120", mono: true, lede: `${esc(t("Anan Chaiyo"))} · party C21 · ${esc(tt("paid by transfer from Kasikornbank", "ชำระโดยโอนจากธนาคารกสิกรไทย"))}`,
    pills: P("good", "Active") + P("good", "Stage 1") + P("info", tt("Rate review asked in the app", "ขอทบทวนอัตราผ่านแอป")),
    actions: `<button class="btn" type="button" data-flow="hmLetter">${esc(tt("Letters", "หนังสือ"))}</button><button class="btn" type="button" data-tab="servicing">${esc(tt("Change the loan", "เปลี่ยนเงื่อนไข"))}</button><button class="btn primary" type="button" data-flow="hmPrepay">${icon("i-cash")}${esc(tt("Prepay", "ชำระเงินต้นล่วงหน้า"))}</button>`,
    facts: [["Outstanding principal", baht(H.bal)], ["Next due", baht(H.pay), "", fd(H.next.due)], ["Interest rate", "5.55%", "", tt("MRR 7.30% − 1.75%", "MRR 7.30% − 1.75%")],
      [tt("Repaid by", "ผ่อนหมดภายใน"), fd(H.ends), "", tt(`${yearsMonths(H.left.n)} at this instalment`, `${yearsMonths(H.left.n)} ที่ค่างวดนี้`)], [tt("Paid on time", "ชำระตรงเวลา"), tt(`42 of ${H.paid}`, `42 จาก ${H.paid}`)], ["LTV", `${(H.bal / H.valuation * 100).toFixed(1)}%`, "", tt(`against ${baht(H.valuation, 0)}`, `เทียบ ${baht(H.valuation, 0)}`)]],
    panels: { summary: homeSummary, schedule: homeSchedule, payments: homePayments, servicing: homeServicing, letters: homeLetters } });
}
function homeSummary() {
  const H = HOME;
  const kv = [["Product", "Home loan · HOME_STD v3"], ["Principal", baht(H.P)], ["Disbursed", tt("15 Mar 2023 to the seller at the Land Office", "15 มี.ค. 2566 ให้ผู้ขายที่สำนักงานที่ดิน")],
    ["Term", tt(`30 years, contract ends ${fd(H.contractEnds)}`, `30 ปี สัญญาสิ้นสุด ${fd(H.contractEnds)}`)], ["Instalment", tt(`${baht(H.pay)} on the 15th`, `${baht(H.pay)} ทุกวันที่ 15`)],
    ["Interest rate", tt("3.25% fixed to Mar 2026, now MRR − 1.75% = 5.55%", "คงที่ 3.25% ถึง มี.ค. 2569 ตอนนี้ MRR − 1.75% = 5.55%")],
    ["Collateral", tt("Townhouse, Bang Kapi · title deed 45210 · first-rank mortgage", "ทาวน์เฮาส์ บางกะปิ · โฉนด 45210 · จำนองลำดับแรก")], [tt("Fire insurance", "ประกันอัคคีภัย"), tt("Renews 15 Mar 2027 · required for the mortgage", "ต่ออายุ 15 มี.ค. 2570 · จำเป็นตามสัญญาจำนอง")],
    [tt("Life cover", "ประกันชีวิต"), tt("None taken. Optional, never a condition of the loan", "ไม่ได้ทำ เป็นทางเลือก ไม่ใช่เงื่อนไขของสินเชื่อ")], [tt("Prepayment fee", "ค่าธรรมเนียมไถ่ถอนก่อนกำหนด"), tt("None since 15 Mar 2026 (3% in the first 3 years)", "ไม่มีตั้งแต่ 15 มี.ค. 2569 (3% ในสามปีแรก)")]];
  const next = [[Date.UTC(2026, 10, 3), tt(`TD-88201 matures: ${baht(H.td + H.tdInterest)} could prepay the loan`, `TD-88201 ครบกำหนด ${baht(H.td + H.tdInterest)} นำมาชำระเงินต้นได้`), "", "warn"],
    [H.next.due, tt(`Instalment ${H.next.n} of ${baht(H.pay)}`, `งวดที่ ${H.next.n} ${baht(H.pay)}`), "", ""], [Date.UTC(2027, 0, 31), tt("Interest certificate for 2026, for the tax return", "หนังสือรับรองดอกเบี้ยปี 2569 สำหรับยื่นภาษี"), "", ""], [Date.UTC(2027, 2, 15), tt("Fire insurance renewal", "ต่ออายุประกันอัคคีภัย"), "", ""]];
  return `<div class="grid-main">${card(t("Contract"), kvHtml(kv))}
    ${card(t("What happens next"), tl(next) + `<p class="note">${esc(tt(`Interest accrues at ${baht(homeDailyInterest())} a day. Anan asked for a rate review in the app on 22 Oct; it is in Servicing.`, `ดอกเบี้ยเดินวันละ ${baht(homeDailyInterest())} คุณอนันต์ขอทบทวนอัตราผ่านแอปเมื่อ 22 ต.ค. อยู่ในแท็บงานบริการ`))}</p>`)}</div>`;
}
function homeSchedule() {
  const tone = { paid: ["good", "Paid"], next: ["info", "Due next"], scheduled: ["", "Scheduled"] }, rows = HOME.rows.slice(HOME.paid - 6);
  return `<section class="card"><div class="card-head"><div class="card-sub">${esc(tt(`The last 6 instalments and the next 12. At ${baht(HOME.pay)} a month the loan is repaid by ${fd(HOME.ends)}, before the contract end of ${fd(HOME.contractEnds)}.`, `6 งวดล่าสุดและ 12 งวดถัดไป ที่ค่างวด ${baht(HOME.pay)} จะผ่อนหมดภายใน ${fd(HOME.ends)} ก่อนสัญญาสิ้นสุด ${fd(HOME.contractEnds)}`))}</div></div><div class="card-body flush"><div class="table-wrap"><table><caption class="sr">${esc(t("Schedule"))}</caption><thead><tr>${["No.", "Due", "Rate", "Instalment", "Interest", "Principal", "Balance after", "State"].map((c) => `<th scope="col" class="${NUMERIC.test(c) || c === "Rate" ? "r" : ""}">${esc(t(c))}</th>`).join("")}</tr></thead><tbody>
    ${rows.map((r) => `<tr class="${r.state}"><td class="num">${r.n}</td><td class="num">${esc(fd(r.due))}</td><td class="r num">${(r.rate * 100).toFixed(2)}%</td><td class="r num">${baht(r.amount)}</td><td class="r num">${baht(r.interest)}</td><td class="r num">${baht(r.principal)}</td><td class="r num">${baht(r.balance)}</td><td>${P(tone[r.state][0], tone[r.state][1])}</td></tr>`).join("")}
    </tbody></table></div></div></section>`;
}
function homePayments() {
  const paid = HOME.rows.filter((r) => r.state === "paid").slice(-8).reverse();
  return `<section class="card"><div class="table-wrap"><table><caption class="sr">${esc(t("Payments"))}</caption><thead><tr>${["Received", "Amount", "From", "Reference", "Applied to"].map((c) => `<th scope="col" class="${c === "Amount" ? "r" : ""}">${esc(t(c))}</th>`).join("")}</tr></thead><tbody>
    ${paid.map((r) => { const late = r.n === 40; return `<tr><td class="num">${esc(fd(late ? r.due + 4 * 864e5 : r.due))}</td><td class="r num">${baht(r.amount + (late ? 200 : 0))}</td><td>${esc(tt("PromptPay from Kasikornbank", "พร้อมเพย์จากกสิกรไทย"))}</td><td class="num muted">RC-${String(26000 + r.n * 731).padStart(6, "0")}</td><td>${esc(tt(`Instalment ${r.n}`, `งวดที่ ${r.n}`))}${late ? ` ${P("warn", tt("4 days late · fee ฿200", "ช้า 4 วัน · ค่าปรับ ฿200"))}` : ""}</td></tr>`; }).join("")}
    </tbody></table></div></section>`;
}
const SERVICE_TILES = [["hmPrepay", "i-cash", "Prepay", "ชำระเงินต้นล่วงหน้า", "Pay off part of the principal: shorter term or lower instalment", "ลดเงินต้น เลือกลดระยะเวลาหรือลดค่างวด"],
  ["hmReprice", "i-fx", "Review the rate", "ทบทวนอัตราดอกเบี้ย", "A retention offer instead of a refinance elsewhere", "ข้อเสนอรักษาลูกค้าแทนการรีไฟแนนซ์ที่อื่น"],
  ["hmHoliday", "i-clock", "Payment holiday", "พักชำระหนี้", "Pause 1 to 3 instalments; interest keeps accruing", "พัก 1 ถึง 3 งวด ดอกเบี้ยยังเดิน"],
  ["hmDueDate", "i-history", "Move the due date", "เปลี่ยนวันครบกำหนด", "Pay nearer to payday", "ชำระใกล้วันเงินเดือนออก"],
  ["hmMandate", "i-swap", "Direct debit", "หักบัญชีอัตโนมัติ", "e-DDA from another bank, approved in its app", "e-DDA จากธนาคารอื่น อนุมัติในแอปของธนาคารนั้น"],
  ["hmWaive", "i-check", "Waive a fee", "ยกเว้นค่าธรรมเนียม", "With a reason, within authority", "ระบุเหตุผล ภายในอำนาจอนุมัติ"]];
function homeServicing() {
  const hist = [...homeLog, [Date.UTC(2026, 9, 22), tt("Rate review asked in the app", "ขอทบทวนอัตราผ่านแอป"), tt("SRV-26-1042 · Anan compares a refinance offer at 2.90%", "SRV-26-1042 · คุณอนันต์เทียบข้อเสนอรีไฟแนนซ์ 2.90%"), "now"],
    [Date.UTC(2026, 6, 19), tt("Instalment 40 paid 4 days late", "งวดที่ 40 ชำระช้า 4 วัน"), tt("Late fee ฿200 charged", "เรียกเก็บค่าปรับ ฿200"), "warn"],
    [Date.UTC(2026, 2, 15), tt("Fixed period ended", "สิ้นสุดช่วงดอกเบี้ยคงที่"), tt("3.25% → MRR − 1.75% = 5.55%; instalment kept at ฿18,500", "3.25% → MRR − 1.75% = 5.55% ค่างวดคงเดิม ฿18,500"), "done"],
    [Date.UTC(2026, 0, 20), tt("Interest certificate 2025 sent", "ส่งหนังสือรับรองดอกเบี้ยปี 2568"), tt(`${baht(HOME.int2025)} of interest, by email`, `ดอกเบี้ย ${baht(HOME.int2025)} ทางอีเมล`), "done"]];
  return `<section class="card"><div class="card-head"><div><div class="card-title">${esc(tt("Change the loan", "เปลี่ยนเงื่อนไขสินเชื่อ"))}</div><div class="card-sub">${esc(tt("Each change shows its effect before anything is done, and checks your authority.", "ทุกการเปลี่ยนแปลงแสดงผลก่อนทำรายการ และตรวจอำนาจอนุมัติของคุณ"))}</div></div></div>
    <div class="card-body"><div class="tiles wide">${SERVICE_TILES.map(([f, ic, en, th, sen, sth]) => `<button class="action-tile" type="button" data-flow="${f}"><span class="tile">${icon(ic)}</span><strong>${esc(tt(en, th))}</strong><small>${esc(tt(sen, sth))}</small></button>`).join("")}</div></div></section>
    ${card(tt("Servicing history", "ประวัติงานบริการ"), tl(hist))}`;
}
function homeLetters() {
  const rows = [[tt("Interest certificate 2025", "หนังสือรับรองดอกเบี้ย 2568"), "20 Jan 2026", tt("Email, encrypted PDF", "อีเมล PDF เข้ารหัส"), P("good", "Delivered")], [tt("Rate change notice", "แจ้งเปลี่ยนอัตราดอกเบี้ย"), "13 Feb 2026", tt("App and post", "แอปและไปรษณีย์"), P("good", "Delivered")],
    [tt("Annual statement 2025", "รายการเดินบัญชีประจำปี 2568"), "5 Jan 2026", tt("App", "แอป"), P("good", "Delivered")], [tt("Late payment notice", "แจ้งชำระล่าช้า"), "16 Jul 2026", "SMS", P("good", "Delivered")]];
  return `<section class="card"><div class="card-head"><div class="card-sub">${esc(tt("Letters and certificates, generated from the ledger, so the figures always agree.", "หนังสือและเอกสารรับรองสร้างจากบัญชีแยกประเภท ตัวเลขตรงกันเสมอ"))}</div><button class="btn" type="button" data-flow="hmLetter">${esc(tt("Issue a letter", "ออกหนังสือ"))}</button></div><div class="card-body flush">${table({ cols: ["Letter", "Sent", "Channel", "State"], rows }, tt("Letters", "หนังสือ"))}</div></section>`;
}

/* servicing flows on LN-77120 */
const homeSub = () => "LN-77120 · " + t("Anan Chaiyo");
Object.assign(FLOWS, {
  hmPrepay: () => ({ title: tt("Prepay principal", "ชำระเงินต้นล่วงหน้า"), sub: homeSub(), init: { amount: HOME.td, mode: "term", from: "td" },
    fields: (d) => money("pamt", d.amount, t("Amount"), tt(`Outstanding ${baht(HOME.bal)}. No prepayment fee: the first three years ended on 15 Mar 2026.`, `คงค้าง ${baht(HOME.bal)} ไม่มีค่าธรรมเนียม เพราะพ้นสามปีแรกเมื่อ 15 มี.ค. 2569`)) +
      select("pfrom", t("Pay from"), [["td", tt(`TD-88201 at maturity on 3 Nov 2026 · ${baht(HOME.td + HOME.tdInterest)}`, `TD-88201 เมื่อครบกำหนด 3 พ.ย. 2569 · ${baht(HOME.td + HOME.tdInterest)}`)], ["transfer", tt("Transfer or PromptPay today", "โอนหรือพร้อมเพย์วันนี้")]], d.from) +
      `<fieldset class="field"><legend>${esc(tt("What should get smaller", "ต้องการลดอะไร"))}</legend><div class="radio-list">
        <label class="radio-card"><input type="radio" name="pmode" value="term" ${d.mode === "term" ? "checked" : ""}><span><b>${esc(tt("The term", "ระยะเวลาผ่อน"))}</b><small>${esc(tt("Keep paying ฿18,500 and finish sooner. Saves the most interest.", "จ่าย ฿18,500 เท่าเดิม ผ่อนหมดเร็วขึ้น ประหยัดดอกเบี้ยมากที่สุด"))}</small></span></label>
        <label class="radio-card"><input type="radio" name="pmode" value="instalment" ${d.mode === "instalment" ? "checked" : ""}><span><b>${esc(tt("The instalment", "ค่างวด"))}</b><small>${esc(tt("Same end date, a lower monthly payment.", "วันสิ้นสุดเดิม ค่างวดต่อเดือนลดลง"))}</small></span></label></div></fieldset>`,
    read: (d) => { const v = parseMoney($("#pamt").value); d.from = $("#pfrom").value; d.mode = document.querySelector("input[name=pmode]:checked").value;
      if (isNaN(v) || v <= 0) return tt("Enter an amount in baht, for example 200,000.00.", "ใส่จำนวนเงินเป็นบาท เช่น 200,000.00");
      if (v >= HOME.bal) return tt(`That clears the loan: use a settlement quote for ${baht(HOME.bal)} plus interest to the day.`, `ยอดนี้ปิดบัญชีทั้งหมด ให้ใช้ยอดปิดบัญชี ${baht(HOME.bal)} บวกดอกเบี้ยถึงวันชำระ`);
      if (d.from === "td" && v > HOME.td + HOME.tdInterest) return tt(`TD-88201 pays ${baht(HOME.td + HOME.tdInterest)} at maturity.`, `TD-88201 จ่าย ${baht(HOME.td + HOME.tdInterest)} เมื่อครบกำหนด`);
      d.amount = v; return ""; },
    review: (d) => { const H = HOME, nb = r2(H.bal - d.amount), before = H.left;
      let rows, en, th;
      if (d.mode === "term") { const after = amortise(nb, H.r, H.pay), saved = before.n - after.n, intSaved = r2(before.interest - after.interest); d.saved = saved;
        rows = [[tt("Principal after", "เงินต้นคงเหลือ"), baht(nb)], [t("Instalment"), tt(`${baht(H.pay)}, unchanged`, `${baht(H.pay)} เท่าเดิม`)], [tt("Repaid by", "ผ่อนหมดภายใน"), `${fd(addMonths(H.rows[H.paid - 1].due, after.n))} (${tt(`${saved} months sooner`, `เร็วขึ้น ${saved} เดือน`)})`], [tt("Interest saved", "ดอกเบี้ยที่ประหยัด"), baht(intSaved)]];
      } else { const n = before.n, np = Math.ceil(pmt(H.r, n, nb) / 10) * 10, after = amortise(nb, H.r, np), intSaved = r2(before.interest - after.interest); d.newPay = np;
        rows = [[tt("Principal after", "เงินต้นคงเหลือ"), baht(nb)], [tt("New instalment", "ค่างวดใหม่"), `${baht(np)} (${tt(`${baht(r2(H.pay - np))} less`, `ลดลง ${baht(r2(H.pay - np))}`)})`], [tt("Repaid by", "ผ่อนหมดภายใน"), tt(`${fd(addMonths(H.rows[H.paid - 1].due, after.n))}, about the same`, `${fd(addMonths(H.rows[H.paid - 1].due, after.n))} ใกล้เคียงเดิม`)], [tt("Interest saved", "ดอกเบี้ยที่ประหยัด"), baht(intSaved)]]; }
      const when = d.from === "td" ? tt("on 3 Nov 2026, when TD-88201 matures", "วันที่ 3 พ.ย. 2569 เมื่อ TD-88201 ครบกำหนด") : tt("today", "วันนี้");
      en = `Applies <b>${baht(d.amount)}</b> to principal ${when}, after interest to that day. No fee. A new schedule goes to Anan in the app, and the change is in the history of LN-77120.`;
      th = `ตัด <b>${baht(d.amount)}</b> เข้าเงินต้น${when} หลังหักดอกเบี้ยถึงวันนั้น ไม่มีค่าธรรมเนียม ส่งตารางผ่อนใหม่ให้คุณอนันต์ในแอป และบันทึกในประวัติของ LN-77120`;
      return { html: quoteRows(rows) + `<p class="consequence">${tt(en, th)}</p>`, confirm: tt("Confirm prepayment", "ยืนยันชำระล่วงหน้า"), auth: ["service", d.amount] }; },
    done: (d) => { if (!d.logged) { d.logged = true; homeLog.unshift([BIZ, tt(`Prepayment of ${baht(d.amount)} booked`, `บันทึกชำระเงินต้นล่วงหน้า ${baht(d.amount)}`), d.mode === "term" ? tt(`Term ${d.saved} months shorter`, `ระยะเวลาสั้นลง ${d.saved} เดือน`) : tt(`Instalment ${baht(d.newPay)} from Dec 2026`, `ค่างวด ${baht(d.newPay)} ตั้งแต่ ธ.ค. 2569`), "done"]); }
      return d.from === "td" ? tt("Booked for 3 Nov 2026. TD-88201 is instructed to pay the loan at maturity.", "ตั้งรายการไว้วันที่ 3 พ.ย. 2569 สั่ง TD-88201 ให้ชำระเข้าสินเชื่อเมื่อครบกำหนด") : tt("Prepayment applied. The new schedule is in the app.", "ชำระเงินต้นแล้ว ตารางผ่อนใหม่อยู่ในแอป"); } }),

  hmReprice: () => ({ title: tt("Review the rate", "ทบทวนอัตราดอกเบี้ย"), sub: homeSub() + " · SRV-26-1042", init: { offer: "fix" },
    fields: (d) => `<p class="hint muted">${esc(tt("Anan has a refinance offer from another bank at 2.90% for 3 years, with about ฿52,000 of fees and transfer costs.", "คุณอนันต์ได้ข้อเสนอรีไฟแนนซ์จากธนาคารอื่น 2.90% สามปี มีค่าธรรมเนียมและค่าโอนราว ฿52,000"))}</p>
      <fieldset class="field"><legend>${esc(tt("Retention offer", "ข้อเสนอรักษาลูกค้า"))}</legend><div class="radio-list">${[["fix", tt("Fixed 3.10% for 2 years, then MRR − 2.00%", "คงที่ 3.10% สองปี จากนั้น MRR − 2.00%"), tt("Fee ฿5,000. No new mortgage, no Land Office visit.", "ค่าธรรมเนียม ฿5,000 ไม่ต้องจดจำนองใหม่ ไม่ต้องไปสำนักงานที่ดิน")],
        ["float", tt("MRR − 2.25% floating, now 5.05%", "ลอยตัว MRR − 2.25% ตอนนี้ 5.05%"), tt("No fee", "ไม่มีค่าธรรมเนียม")]].map(([v, b, s]) => `<label class="radio-card"><input type="radio" name="roffer" value="${v}" ${d.offer === v ? "checked" : ""}><span><b>${esc(b)}</b><small>${esc(s)}</small></span></label>`).join("")}</div></fieldset>`,
    read: (d) => { d.offer = document.querySelector("input[name=roffer]:checked").value; return ""; },
    review: (d) => { const H = HOME, nr = d.offer === "fix" ? 0.031 : 0.0505, months = d.offer === "fix" ? 24 : 12;
      const monthly = r2(H.bal * (H.rate - nr) / 12), saved = r2(monthly * months), after = amortise(H.bal, nr / 12, H.pay);
      let pv = 0; for (let k = 1; k <= months; k++) pv += monthly / Math.pow(1 + H.r, k);
      d.nr = nr;
      return { html: quoteRows([[tt("New rate", "อัตราใหม่"), `${(nr * 100).toFixed(2)}%`], [tt("Interest less per month, now", "ดอกเบี้ยลดลงต่อเดือน ตอนนี้"), baht(monthly)], [tt(`Interest saved over ${months} months`, `ดอกเบี้ยที่ประหยัดใน ${months} เดือน`), baht(saved)],
        [tt("Paid off sooner, at ฿18,500", "ผ่อนหมดเร็วขึ้น ที่ ฿18,500"), monthsTh(Math.max(0, H.left.n - after.n))], [tt("Modification loss (TFRS 9), estimated", "ขาดทุนจากการปรับเงื่อนไข (TFRS 9) ประมาณ"), baht(-r2(pv))]]) +
        `<p class="consequence">${tt(`Sends the offer to Anan in the app to accept within 7 days. On acceptance the rate changes from the next instalment, the instalment stays at ${baht(H.pay)} so the term shortens, and Finance books the modification result.`, `ส่งข้อเสนอให้คุณอนันต์ในแอป ตอบรับภายใน 7 วัน เมื่อตอบรับ อัตราเปลี่ยนตั้งแต่งวดถัดไป ค่างวดคงเดิม ${baht(H.pay)} ระยะเวลาจึงสั้นลง และฝ่ายการเงินบันทึกผลการปรับเงื่อนไข`)}</p>`,
        confirm: tt("Send the offer", "ส่งข้อเสนอ"), auth: ["service", H.bal] }; },
    done: (d) => { if (!d.logged) { d.logged = true; homeLog.unshift([BIZ, tt(`Retention offer sent: ${(d.nr * 100).toFixed(2)}%`, `ส่งข้อเสนอรักษาลูกค้า ${(d.nr * 100).toFixed(2)}%`), tt("Waiting for Anan to accept in the app, 7 days", "รอคุณอนันต์ตอบรับในแอป ภายใน 7 วัน"), ""]); }
      return tt("Offer sent to Anan in the app. SRV-26-1042 waits for the answer.", "ส่งข้อเสนอให้คุณอนันต์ในแอปแล้ว SRV-26-1042 รอคำตอบ"); } }),

  hmHoliday: () => ({ title: tt("Payment holiday", "พักชำระหนี้"), sub: homeSub(), init: { months: "2", how: "end", why: "income" },
    fields: (d) => select("hmon", tt("Instalments to pause", "จำนวนงวดที่พัก"), [["1", tt("1 · November", "1 งวด · พฤศจิกายน")], ["2", tt("2 · November and December", "2 งวด · พฤศจิกายนและธันวาคม")], ["3", tt("3 · November to January", "3 งวด · พฤศจิกายนถึงมกราคม")]], d.months) +
      select("hwhy", tt("Reason", "เหตุผล"), [["income", tt("Temporary loss of income", "รายได้ลดลงชั่วคราว")], ["medical", tt("Illness or medical costs", "เจ็บป่วยหรือค่ารักษาพยาบาล")], ["disaster", tt("Flood or other disaster", "น้ำท่วมหรือภัยพิบัติ")]], d.why) +
      `<fieldset class="field"><legend>${esc(tt("Interest during the holiday", "ดอกเบี้ยระหว่างพักชำระ"))}</legend><div class="radio-list">
        <label class="radio-card"><input type="radio" name="hhow" value="end" ${d.how === "end" ? "checked" : ""}><span><b>${esc(tt("Add the months to the end", "ต่อระยะเวลาท้ายสัญญา"))}</b><small>${esc(tt("The instalment stays the same; the loan runs longer.", "ค่างวดเท่าเดิม สัญญายาวขึ้น"))}</small></span></label>
        <label class="radio-card"><input type="radio" name="hhow" value="spread" ${d.how === "spread" ? "checked" : ""}><span><b>${esc(tt("Spread over the remaining term", "เฉลี่ยในระยะที่เหลือ"))}</b><small>${esc(tt("The end date stays; the instalment rises a little.", "วันสิ้นสุดเดิม ค่างวดเพิ่มเล็กน้อย"))}</small></span></label></div></fieldset>`,
    read: (d) => { d.months = $("#hmon").value; d.why = $("#hwhy").value; d.how = document.querySelector("input[name=hhow]:checked").value; return ""; },
    review: (d) => { const H = HOME, k = +d.months, accr = r2(H.bal * (Math.pow(1 + H.r, k) - 1)), nb = r2(H.bal + accr);
      const rows = [[tt("Instalments paused", "งวดที่พัก"), monthsTh(k)], [tt("Interest added during the holiday", "ดอกเบี้ยที่เพิ่มระหว่างพัก"), baht(accr)]];
      if (d.how === "end") { const after = amortise(nb, H.r, H.pay); rows.push([tt("Loan runs longer by", "สัญญายาวขึ้น"), monthsTh(after.n + k - H.left.n)], [t("Instalment"), tt(`${baht(H.pay)}, unchanged`, `${baht(H.pay)} เท่าเดิม`)]); }
      else { const np = Math.ceil(pmt(H.r, H.left.n - k, nb) / 10) * 10; rows.push([tt("New instalment", "ค่างวดใหม่"), baht(np)], [tt("Repaid by", "ผ่อนหมดภายใน"), tt(`${fd(H.ends)}, unchanged`, `${fd(H.ends)} เท่าเดิม`)]); }
      rows.push([tt("Modification loss (TFRS 9)", "ขาดทุนจากการปรับเงื่อนไข (TFRS 9)"), baht(0)]);
      return { html: quoteRows(rows) + `<p class="consequence">${tt(`No instalment is collected for ${monthsTh(k).toLowerCase()} from ${fd(H.next.due)}, and the credit bureau is told the loan is current. Interest keeps accruing at the contract rate, so there is no modification loss. The reason is kept, and the loan is checked for a significant increase in credit risk.`, `ไม่เรียกเก็บค่างวด ${monthsTh(k)} ตั้งแต่ ${fd(H.next.due)} และแจ้งเครดิตบูโรว่าสัญญาปกติ ดอกเบี้ยยังเดินตามอัตราในสัญญา จึงไม่มีขาดทุนจากการปรับเงื่อนไข เก็บเหตุผลไว้ และตรวจว่าความเสี่ยงด้านเครดิตเพิ่มขึ้นอย่างมีนัยสำคัญหรือไม่`)}</p>`,
        confirm: tt("Grant the holiday", "อนุมัติพักชำระ"), auth: ["service", H.bal] }; },
    done: (d) => { if (!d.logged) { d.logged = true; homeLog.unshift([BIZ, tt(`Payment holiday: ${d.months} instalments`, `พักชำระ ${d.months} งวด`), d.how === "end" ? tt("Months added to the end", "ต่อท้ายสัญญา") : tt("Spread over the remaining term", "เฉลี่ยในระยะที่เหลือ"), "done"]); }
      return tt("Holiday granted. Anan gets the new schedule and a letter in the app.", "อนุมัติพักชำระแล้ว ส่งตารางใหม่และหนังสือแจ้งให้คุณอนันต์ในแอป"); } }),

  hmDueDate: () => ({ title: tt("Move the due date", "เปลี่ยนวันครบกำหนด"), sub: homeSub(), init: { day: "28" },
    fields: (d) => select("hday", tt("New due day", "วันครบกำหนดใหม่"), [["1", tt("The 1st", "วันที่ 1")], ["5", tt("The 5th", "วันที่ 5")], ["25", tt("The 25th", "วันที่ 25")], ["28", tt("The 28th", "วันที่ 28")]], d.day) + `<p class="hint muted">${esc(tt("Now the 15th. Anan's salary arrives on the 25th.", "ตอนนี้วันที่ 15 เงินเดือนคุณอนันต์เข้าวันที่ 25"))}</p>`,
    read: (d) => { d.day = $("#hday").value; return ""; },
    review: (d) => { const day = +d.day, first = day > 15 ? Date.UTC(2026, 10, day) : Date.UTC(2026, 11, day), extra = Math.round((first - HOME.next.due) / 864e5), cost = r2(homeDailyInterest() * extra); d.first = first;
      return { html: quoteRows([[tt("First instalment on the new day", "ค่างวดแรกในวันใหม่"), fd(first)], [tt("Extra days of interest", "ดอกเบี้ยวันที่เพิ่ม"), String(extra)], [tt("Added to that instalment", "เพิ่มในค่างวดนั้น"), baht(cost)], [tt("That instalment", "ค่างวดนั้น"), baht(r2(HOME.pay + cost))]]) +
        `<p class="consequence">${tt(`Moves every instalment to the ${day}${day === 1 ? "st" : "th"} from ${fd(first)}. The extra ${extra} days of interest are added once, to that instalment. The term does not change.`, `เปลี่ยนวันครบกำหนดทุกงวดเป็นวันที่ ${day} ตั้งแต่ ${fd(first)} ดอกเบี้ย ${extra} วันที่เพิ่มเรียกเก็บครั้งเดียวในงวดนั้น ระยะเวลาไม่เปลี่ยน`)}</p>`, confirm: tt("Move the due date", "เปลี่ยนวันครบกำหนด") }; },
    done: (d) => { if (!d.logged) { d.logged = true; homeLog.unshift([BIZ, tt(`Due date moved to the ${d.day}`, `เปลี่ยนวันครบกำหนดเป็นวันที่ ${d.day}`), tt(`From ${fd(d.first)}`, `ตั้งแต่ ${fd(d.first)}`), "done"]); }
      return tt("Due date changed. Reminders follow the new day.", "เปลี่ยนวันครบกำหนดแล้ว การแจ้งเตือนเปลี่ยนตามวันใหม่"); } }),

  hmMandate: () => ({ title: tt("Set up direct debit", "ตั้งหักบัญชีอัตโนมัติ"), sub: homeSub(), init: { acc: "kbank" },
    fields: (d) => select("macc", tt("Collect from", "หักจากบัญชี"), [["kbank", tt("Kasikornbank · xxx-x-x4512-6", "กสิกรไทย · xxx-x-x4512-6")], ["scb", tt("SCB · xxx-x-x9031-2", "ไทยพาณิชย์ · xxx-x-x9031-2")]], d.acc) + `<p class="hint muted">${esc(tt("Anan pays by PromptPay each month today; one payment was 4 days late in July.", "ทุกวันนี้คุณอนันต์โอนพร้อมเพย์ทุกเดือน และเคยช้า 4 วันในเดือนกรกฎาคม"))}</p>`,
    read: (d) => { d.acc = $("#macc").value; return ""; },
    review: (d) => ({ html: kvHtml([[tt("Account", "บัญชี"), d.acc === "kbank" ? tt("Kasikornbank · xxx-x-x4512-6", "กสิกรไทย · xxx-x-x4512-6") : tt("SCB · xxx-x-x9031-2", "ไทยพาณิชย์ · xxx-x-x9031-2")], [tt("Amount", "จำนวน"), tt("The instalment due, up to ฿25,000", "ค่างวดที่ครบกำหนด ไม่เกิน ฿25,000")], [tt("First collection", "หักครั้งแรก"), fd(Date.UTC(2026, 11, 15))]]) +
      `<p class="consequence">${tt("Sends an e-DDA request through ITMX. Anan approves it in the other bank's app. Then each instalment is collected on the due day, with one retry on the next business day if it fails.", "ส่งคำขอ e-DDA ผ่าน ITMX คุณอนันต์อนุมัติในแอปของธนาคารนั้น จากนั้นหักค่างวดในวันครบกำหนด หากไม่สำเร็จจะหักซ้ำอีกครั้งในวันทำการถัดไป")}</p>`, confirm: tt("Send the request", "ส่งคำขอ") }),
    done: (d) => { if (!d.logged) { d.logged = true; homeLog.unshift([BIZ, tt("Direct debit requested", "ขอหักบัญชีอัตโนมัติ"), tt("Waiting for Anan to approve the e-DDA", "รอคุณอนันต์อนุมัติ e-DDA"), ""]); }
      return tt("Request sent. It starts once Anan approves it.", "ส่งคำขอแล้ว เริ่มเมื่อคุณอนันต์อนุมัติ"); } }),

  hmWaive: () => ({ title: tt("Waive a fee", "ยกเว้นค่าธรรมเนียม"), sub: homeSub(), init: { fee: "late", why: "first" },
    fields: (d) => select("wfee", tt("Fee", "ค่าธรรมเนียม"), [["late", tt("Late payment fee, July 2026 · ฿200.00", "ค่าปรับชำระล่าช้า ก.ค. 2569 · ฿200.00")], ["retention", tt("Retention offer fee · ฿5,000.00", "ค่าธรรมเนียมข้อเสนอรักษาลูกค้า · ฿5,000.00")]], d.fee) +
      select("wwhy", tt("Reason", "เหตุผล"), [["first", tt("First late payment in 3 years", "ล่าช้าครั้งแรกในสามปี")], ["retain", tt("Keeps the customer from refinancing", "รักษาลูกค้าไม่ให้รีไฟแนนซ์")], ["error", tt("Our error", "ความผิดพลาดของธนาคาร")]], d.why),
    read: (d) => { d.fee = $("#wfee").value; d.why = $("#wwhy").value; return ""; },
    review: (d) => { const amt = d.fee === "late" ? 200 : 5000; d.amt = amt;
      return { html: `<p class="consequence">${tt(`Waives <b>${baht(amt)}</b> on LN-77120. Fee income is reversed (5420 against 1320), and the reason is kept with the entry.`, `ยกเว้น <b>${baht(amt)}</b> ของ LN-77120 กลับรายการรายได้ค่าธรรมเนียม (5420 กับ 1320) และเก็บเหตุผลไว้กับรายการ`)}</p>`, confirm: tt("Waive the fee", "ยกเว้นค่าธรรมเนียม"), auth: ["waive", amt] }; },
    done: (d) => { if (!d.logged) { d.logged = true; homeLog.unshift([BIZ, tt(`Fee of ${baht(d.amt)} waived`, `ยกเว้นค่าธรรมเนียม ${baht(d.amt)}`), "", "done"]); }
      return tt("Fee waived.", "ยกเว้นค่าธรรมเนียมแล้ว"); } }),

  hmLetter: () => ({ title: tt("Issue a letter", "ออกหนังสือ"), sub: homeSub(), init: { kind: "interest", ch: "email" },
    fields: (d) => select("lkind", tt("Letter", "หนังสือ"), [["interest", tt("Interest certificate 2025, for the tax return", "หนังสือรับรองดอกเบี้ยปี 2568 สำหรับยื่นภาษี")], ["balance", tt("Balance confirmation, today", "หนังสือยืนยันยอดหนี้ ณ วันนี้")], ["history", tt("Payments in the last 12 months", "ประวัติการชำระ 12 เดือน")]], d.kind) +
      select("lch", tt("Send by", "ส่งทาง"), [["email", tt("Email, encrypted PDF", "อีเมล PDF เข้ารหัส")], ["app", tt("The app", "แอป")], ["post", tt("Post to the registered address", "ไปรษณีย์ตามที่อยู่ที่ลงทะเบียน")]], d.ch),
    read: (d) => { d.kind = $("#lkind").value; d.ch = $("#lch").value; return ""; },
    review: (d) => ({ html: kvHtml(d.kind === "interest" ? [[tt("Interest paid in 2025", "ดอกเบี้ยที่ชำระปี 2568"), baht(HOME.int2025)], [tt("Deductible", "ลดหย่อนได้"), tt("Up to ฿100,000 a year", "ไม่เกิน ฿100,000 ต่อปี")], [tt("Sent to the Revenue Department too", "ส่งกรมสรรพากรด้วย"), tt("Yes, with consent on file", "ใช่ มีความยินยอมแล้ว")]]
      : d.kind === "balance" ? [[tt("Principal", "เงินต้น"), baht(HOME.bal)], [tt("Interest to today", "ดอกเบี้ยถึงวันนี้"), baht(r2(homeDailyInterest() * 9))], [tt("As of", "ณ วันที่"), fd(BIZ)]]
      : [[tt("Instalments", "งวด"), "12"], [tt("Late", "ล่าช้า"), tt("1, by 4 days", "1 งวด ช้า 4 วัน")]]) + `<p class="consequence">${esc(tt("Generated from the ledger and signed by the bank's certificate.", "สร้างจากบัญชีแยกประเภทและลงนามด้วยใบรับรองของธนาคาร"))}</p>`, confirm: tt("Send", "ส่ง") }),
    done: () => tt("Letter sent.", "ส่งหนังสือแล้ว") }),
});

/* ---------------- APP-30416: a loan application from intake to disbursement ---------------- */
const INTAKE_PRODUCTS = {
  personal: { name: "Personal loan", th: "สินเชื่อส่วนบุคคล", code: "PERSONAL_LOAN_STD v1", rate: 0.15, min: 20000, max: 1000000, step: 10000, tmin: 12, tmax: 60, amount: 300000, term: 48, dsr: 60, auto: 500000, contract: "LN-A-C15" },
  home: { name: "Home loan", th: "สินเชื่อบ้าน", code: "HOME_STD v3", rate: 0.0555, min: 500000, max: 10000000, step: 50000, tmin: 120, tmax: 360, amount: 2500000, term: 360, dsr: 70, auto: 0, contract: "LN-77302" },
  car: { name: "Car hire purchase", th: "เช่าซื้อรถยนต์", code: "CAR_HP_NEW v2", rate: 0.0479, min: 200000, max: 2000000, step: 10000, tmin: 24, tmax: 84, amount: 850000, term: 72, dsr: 60, auto: 1500000, contract: "HP-2026-005020" },
};
const INTAKE0 = () => ({ product: "personal", amount: 300000, term: 48, income: 85000, decided: null, sent: false, paid: false });
let INTAKE = INTAKE0();
const intakeExisting = r2(pmt(0.01, 36, 125000)) + 2000;
function intakeCalc() {
  const I = INTAKE, p = INTAKE_PRODUCTS[I.product], inst = r2(pmt(p.rate / 12, I.term, I.amount)), total = r2(inst * I.term);
  const dsr = (intakeExisting + inst) / I.income * 100, cap = I.product === "personal" ? I.income * 5 : Infinity;
  const room = p.dsr / 100 * I.income - intakeExisting, maxLoan = Math.max(0, Math.min(cap, room > 0 ? room * (1 - Math.pow(1 + p.rate / 12, -I.term)) / (p.rate / 12) : 0));
  const age = 31, ageEnd = age + Math.ceil(I.term / 12), ltv = I.product === "home" ? I.amount / 3050000 * 100 : I.product === "car" ? I.amount / 1104000 * 100 : 0;
  const checks = [[tt(`Debt service ratio up to ${p.dsr}%`, `ภาระหนี้ต่อรายได้ไม่เกิน ${p.dsr}%`), `${dsr.toFixed(1)}%`, dsr <= p.dsr],
    ...(I.product === "personal" ? [[tt("Up to 5 times monthly income", "ไม่เกิน 5 เท่าของรายได้ต่อเดือน"), baht(cap, 0), I.amount <= cap]] : []),
    ...(ltv ? [[tt(`Loan to value up to ${I.product === "home" ? 90 : 85}%`, `วงเงินต่อมูลค่าหลักประกันไม่เกิน ${I.product === "home" ? 90 : 85}%`), `${ltv.toFixed(1)}%`, ltv <= (I.product === "home" ? 90 : 85)]] : []),
    [tt("Age at the end of the loan up to 65", "อายุเมื่อสิ้นสุดสัญญาไม่เกิน 65 ปี"), String(ageEnd), ageEnd <= 65], [tt("Bureau score 600 or more", "คะแนนเครดิตบูโร 600 ขึ้นไป"), "702", true], [tt("No 90-day arrears in 24 months", "ไม่มีค้างชำระ 90 วันใน 24 เดือน"), tt("None", "ไม่มี"), true]];
  const ok = checks.every((c) => c[2]);
  return { p, inst, total, interest: r2(total - I.amount), dsr, maxLoan, checks, ok, ltv, auto: ok && I.amount <= p.auto };
}
function intakeOut() {
  const c = intakeCalc(), I = INTAKE;
  return quoteRows([[t("Instalment"), baht(c.inst)], [tt("Total interest", "ดอกเบี้ยทั้งหมด"), baht(c.interest)], [tt("Total repaid", "ยอดชำระทั้งหมด"), baht(c.total)]]) +
    `<p class="note" style="margin-top:12px">${esc(I.product === "home" ? tt("The instalment is tested at the floating rate of 5.55%, though the first 3 years are fixed at 2.99%.", "ทดสอบค่างวดที่อัตราลอยตัว 5.55% แม้สามปีแรกคงที่ 2.99%") : tt(`Effective rate ${(c.p.rate * 100).toFixed(2)}% a year on the reducing balance, as the disclosure will show.`, `อัตราดอกเบี้ยที่แท้จริง ${(c.p.rate * 100).toFixed(2)}% ต่อปี แบบลดต้นลดดอก ตามที่แสดงในเอกสารเปิดเผยข้อมูล`))}</p>`;
}
function affordOut() {
  const c = intakeCalc(), tone = c.dsr > c.p.dsr ? "crit" : c.dsr > c.p.dsr * 0.8 ? "warn" : "";
  return `<div class="bars"><div class="bar-row"><span>${esc(tt("Debt service ratio", "ภาระหนี้ต่อรายได้"))}</span><span class="num">${c.dsr.toFixed(1)}% <span class="muted">/ ${c.p.dsr}%</span></span><div class="bar"><span class="${tone}" style="width:${Math.min(100, c.dsr)}%"></span></div></div></div>
    <div style="margin-top:14px">${table({ cols: ["Rule", "Applicant", "Result"], rows: c.checks.map(([r, v, ok]) => [r, v, P(ok ? "good" : "crit", ok ? tt("Passes", "ผ่าน") : tt("Fails", "ไม่ผ่าน"))]) }, tt("Credit policy", "นโยบายสินเชื่อ"))}</div>
    <p class="note" style="margin-top:12px">${esc(tt(`Most she can borrow over ${monthsTh(INTAKE.term).toLowerCase()} at this income: ${baht(Math.floor(c.maxLoan / 1000) * 1000, 0)}.`, `วงเงินสูงสุดใน ${monthsTh(INTAKE.term)} ที่รายได้นี้: ${baht(Math.floor(c.maxLoan / 1000) * 1000, 0)}`))}</p>`;
}
function viewIntake() {
  const def = RECS["APP-30416"], steps = def.tabs, i = Math.max(0, steps.findIndex(([k]) => k === current.tab)), I = INTAKE, c = intakeCalc(), p = c.p;
  const slider = (id, label, val, min, max, step, show) => `<div class="field"><label for="${id}">${esc(label)}: <b id="${id}V">${esc(show)}</b></label><input type="range" id="${id}" data-intake="${id}" min="${min}" max="${max}" step="${step}" value="${val}" style="accent-color:var(--accent)"></div>`;
  const content = {
    product: [tt("What the customer wants", "ลูกค้าต้องการอะไร"), `<div class="choices" role="radiogroup" aria-label="${esc(t("Product"))}">${Object.entries(INTAKE_PRODUCTS).map(([k, x]) => `<button class="choice" type="button" role="radio" aria-checked="${k === I.product}" data-intake-product="${k}"><span class="row">${esc(tt(x.name, x.th))}<span class="tick">${icon("i-check")}</span></span><small>${esc(x.code)} · ${(x.rate * 100).toFixed(2)}%</small></button>`).join("")}</div>
      <div class="grid-main" style="margin-top:16px"><div style="display:grid;gap:16px">${slider("inAmount", t("Amount"), I.amount, p.min, p.max, p.step, baht(I.amount, 0))}${slider("inTerm", t("Term"), I.term, p.tmin, p.tmax, p.tmin >= 120 ? 12 : 6, monthsTh(I.term))}</div><div id="inOut" aria-live="polite">${intakeOut()}</div></div>`],
    applicant: [tt("Found by citizen ID: an existing customer", "พบจากเลขบัตรประชาชน: เป็นลูกค้าเดิม"), `<div class="grid-main"><div>${kvHtml([[t("Name"), t("Pimchanok Rattana")], [tt("Party", "รหัสลูกค้า"), "C13"], [tt("Customer since", "เป็นลูกค้าตั้งแต่"), fd(Date.UTC(2026, 9, 15))], ["KYC", tt("Verified with NDID, IAL 2.3", "ยืนยันด้วย NDID IAL 2.3")], [tt("Sanctions and PEP", "รายชื่อคว่ำบาตรและ PEP"), tt(`Clear, screened ${fd(BIZ)}`, `ไม่พบ ตรวจ ${fd(BIZ)}`)], [tt("Work", "อาชีพ"), tt("Salaried, logistics manager, 6 years", "พนักงานประจำ ผู้จัดการโลจิสติกส์ 6 ปี")], [tt("Age", "อายุ"), "31"]])}</div>
      <div>${notice("good", tt("Nothing to key again", "ไม่ต้องกรอกข้อมูลซ้ำ"), tt("Identity, address and contact come from the customer record. The credit bureau check uses the consent she gave in the app today.", "ข้อมูลตัวตน ที่อยู่ และช่องทางติดต่อมาจากข้อมูลลูกค้า การตรวจเครดิตบูโรใช้ความยินยอมที่ให้ในแอปวันนี้"))}</div></div>`],
    affordability: [tt("Can she afford it", "ความสามารถในการชำระหนี้"), `<div class="grid-main"><div id="inAfford" aria-live="polite">${affordOut()}</div><div style="display:grid;gap:14px">
      <div class="field"><label for="inIncome">${esc(tt("Monthly income, verified", "รายได้ต่อเดือน ตรวจแล้ว"))}</label><input class="input money" id="inIncome" data-intake="inIncome" inputmode="decimal" value="${esc(I.income.toLocaleString("en-US"))}"><span class="hint">${esc(tt("From 6 months of statements, read automatically", "จากรายการเดินบัญชี 6 เดือน อ่านอัตโนมัติ"))}</span></div>
      ${table({ cols: ["Existing debt", "Monthly"], rows: [["LN-A-C13 · " + tt("personal loan, this bank", "สินเชื่อส่วนบุคคล ธนาคารนี้"), baht(intakeExisting - 2000)], [tt("Credit card, from NCB", "บัตรเครดิต จาก NCB"), baht(2000)]] }, tt("Existing debt", "หนี้เดิม"))}</div></div>`],
    collateral: [tt("Security", "หลักประกัน"), I.product === "personal" ? notice("good", tt("Unsecured: no collateral and no guarantor", "ไม่มีหลักประกัน ไม่ต้องมีผู้ค้ำ"), tt("Priced on the scorecard and the debt service ratio.", "กำหนดราคาจากแบบจำลองคะแนนและภาระหนี้ต่อรายได้"))
      : I.product === "home" ? kvHtml([[tt("Property", "ทรัพย์"), tt("Condominium, Ratchada, 34 m² · title deed 88120", "คอนโดมิเนียม รัชดา 34 ตร.ม. · โฉนด 88120")], [tt("Purchase price", "ราคาซื้อ"), baht(3200000)], [tt("Appraisal", "ราคาประเมิน"), tt(`${baht(3050000)} · bank's panel appraiser, 21 Oct 2026`, `${baht(3050000)} · ผู้ประเมินในบัญชีของธนาคาร 21 ต.ค. 2569`)], ["LTV", `${c.ltv.toFixed(1)}%`], [tt("Charge", "การจดทะเบียน"), tt("First-rank mortgage at the Land Office on transfer day", "จำนองลำดับแรกที่สำนักงานที่ดินในวันโอน")], [tt("Fire insurance", "ประกันอัคคีภัย"), tt("Required; any insurer the customer chooses", "จำเป็น เลือกบริษัทประกันได้เอง")]])
      : kvHtml([[t("Vehicle"), "Toyota Corolla Cross HEV, 2026"], [tt("Cash price", "ราคาเงินสด"), baht(1104000)], [tt("Down payment", "เงินดาวน์"), baht(1104000 - I.amount)], ["LTV", `${c.ltv.toFixed(1)}%`], [tt("Title", "กรรมสิทธิ์"), tt("Stays with the bank until the last instalment", "เป็นของธนาคารจนชำระงวดสุดท้าย")], [tt("Dealer", "ดีลเลอร์"), t("Bangna Motors")]])],
    documents: [tt("Documents", "เอกสาร"), `<div class="list">${[[tt("Citizen ID, checked with DOPA", "บัตรประชาชน ตรวจกับกรมการปกครอง"), true], [tt("Bank statements, 6 months", "รายการเดินบัญชี 6 เดือน"), true], [tt("Payslip, last month", "สลิปเงินเดือนล่าสุด"), true],
      ...(I.product === "home" ? [[tt("Sale and purchase agreement", "สัญญาจะซื้อจะขาย"), true], [tt("Title deed copy", "สำเนาโฉนด"), false]] : I.product === "car" ? [[tt("Dealer's quotation", "ใบเสนอราคาจากดีลเลอร์"), true]] : [])]
      .map(([d, ok]) => `<div class="li"><span class="sev ${ok ? "good" : "warn"}">${icon(ok ? "i-check" : "i-alert")}</span><div><strong>${esc(d)}</strong><p>${esc(ok ? tt("Received and read", "ได้รับและอ่านแล้ว") : tt("Asked for in the app", "ขอผ่านแอปแล้ว"))}</p></div></div>`).join("")}</div>`],
    decision: [tt("Decision", "ผลการพิจารณา"), I.decided ? notice(I.decided.ok ? "good" : "info", I.decided.text, I.decided.sub)
      : `${kvHtml([[t("Product"), tt(p.name, p.th)], [t("Amount"), baht(I.amount)], [t("Term"), monthsTh(I.term)], [t("Instalment"), baht(c.inst)], [tt("Debt service ratio", "ภาระหนี้ต่อรายได้"), `${c.dsr.toFixed(1)}%`], [tt("Policy", "นโยบาย"), c.ok ? tt("All rules pass", "ผ่านทุกข้อ") : tt("One or more rules fail", "ไม่ผ่านบางข้อ")]])}<div class="actions" style="margin-top:14px"><button class="btn primary" type="button" data-flow="appSubmit">${esc(tt("Submit for decision", "ส่งพิจารณา"))}</button></div>`],
    offer: [tt("Offer and signature", "ข้อเสนอและการลงนาม"), !I.decided || !I.decided.ok ? `<div class="state"><span class="sev info">${icon("i-clock")}</span><strong>${esc(tt("Opens once the application is approved", "เปิดเมื่ออนุมัติใบสมัครแล้ว"))}</strong></div>`
      : `<div class="grid-main"><div>${kvHtml([[t("Product"), `${tt(p.name, p.th)} · ${p.code}`], [t("Amount"), baht(I.amount)], [t("Term"), monthsTh(I.term)], [t("Instalment"), baht(c.inst)], [tt("Effective rate", "อัตราดอกเบี้ยที่แท้จริง"), I.product === "home" ? tt("2.99% for 3 years, then MRR − 1.75%", "2.99% สามปี จากนั้น MRR − 1.75%") : `${(p.rate * 100).toFixed(2)}%`], [tt("Total interest", "ดอกเบี้ยทั้งหมด"), baht(c.interest)], [tt("Fees", "ค่าธรรมเนียม"), I.product === "home" ? tt("Mortgage registration 1% at the Land Office; no bank fee", "ค่าจดจำนอง 1% ที่สำนักงานที่ดิน ไม่มีค่าธรรมเนียมธนาคาร") : tt("None", "ไม่มี")], [tt("Insurance", "ประกัน"), tt("Optional; never a condition of the loan", "เป็นทางเลือก ไม่ใช่เงื่อนไขของสินเชื่อ")]])}</div>
        <div>${I.paid ? notice("good", tt(`Paid. Contract ${p.contract} is open.`, `จ่ายเงินแล้ว เปิดสัญญา ${p.contract}`), tt("The first instalment is due on 25 Nov 2026.", "ค่างวดแรกครบกำหนด 25 พ.ย. 2569"))
          : I.sent ? `${notice("good", tt("Signed in the app with NDID at 10:44", "ลงนามในแอปด้วย NDID เวลา 10:44"), tt("The key facts sheet was shown before signing and is kept with the contract.", "แสดงเอกสารสรุปข้อมูลสำคัญก่อนลงนาม และเก็บไว้กับสัญญา"))}<div class="actions" style="margin-top:14px"><button class="btn primary" type="button" data-flow="appDisburse">${esc(tt("Disburse", "จ่ายเงิน"))}</button></div>`
          : `<p class="muted">${esc(tt("The key facts sheet and the contract go to the customer's app to read and sign.", "เอกสารสรุปข้อมูลสำคัญและสัญญาส่งไปที่แอปของลูกค้าเพื่ออ่านและลงนาม"))}</p><div class="actions" style="margin-top:14px"><button class="btn primary" type="button" data-flow="appOffer">${esc(tt("Send to sign", "ส่งให้ลงนาม"))}</button></div>`}</div></div>`],
  };
  const [title, body] = content[steps[i][0]];
  const last = i === steps.length - 1;
  return `<button class="back" type="button" data-go="lending/applications">${icon("i-back")}${esc(t("Applications"))}</button>
    <div class="head"><div>${eyebrow(sysById.lending, "APP-30416")}<h1 class="title">${esc(tt(`New application: ${tt(p.name, p.th).toLowerCase()}`, `ใบสมัครใหม่: ${p.th}`))}</h1><p class="lede">${esc(tt("Pimchanok Rattana · started by Ploy C. at 10:31 · each step saves as you go", "พิมพ์ชนก รัตนะ · เริ่มโดยพลอย ช. เวลา 10:31 · บันทึกทุกขั้นตอน"))}</p></div><div class="actions"><button class="btn" type="button" data-intake-reset>${esc(tt("Start again", "เริ่มใหม่"))}</button></div></div>
    <div class="steps" style="padding:0;border:0" aria-label="${esc(tt("Steps", "ขั้นตอน"))}">${steps.map(([k, l], n) => `<button class="step ${n === i ? "on" : n < i ? "done" : ""}" type="button" data-tab="${k}" style="border:0;background:transparent;padding:0" ${n === i ? 'aria-current="step"' : ""}><b>${n < i ? "✓" : n + 1}</b>${esc(t(l))}</button>`).join("")}</div>
    ${card(title, body)}
    <div class="actions" style="justify-content:flex-end">${i > 0 ? `<button class="btn" type="button" data-tab="${steps[i - 1][0]}">${esc(t("Back"))}</button>` : ""}${!last ? `<button class="btn primary" type="button" data-tab="${steps[i + 1][0]}">${esc(t("Next"))}</button>` : ""}</div>`;
}
Object.assign(FLOWS, {
  appSubmit: () => ({ title: tt("Submit for decision", "ส่งพิจารณา"), sub: "APP-30416 · " + t("Pimchanok Rattana"), init: {}, fields: () => `<p class="muted">${esc(tt("The decision engine runs the credit policy and the scorecard now.", "ระบบตัดสินใจตรวจนโยบายสินเชื่อและแบบจำลองคะแนนทันที"))}</p>`, read: () => "",
    review: (d) => { const c = intakeCalc(), I = INTAKE; d.c = c;
      if (!c.ok) return { html: notice("crit", tt("Outside credit policy", "อยู่นอกนโยบายสินเชื่อ"), c.checks.filter((x) => !x[2]).map((x) => `${x[0]}: ${x[1]}`).join(" · ")) + `<p class="consequence">${esc(tt("Go back and lower the amount or lengthen the term. Declining instead tells her the main reason, as responsible lending requires.", "ย้อนกลับไปลดวงเงินหรือขยายระยะเวลา หากปฏิเสธจะแจ้งเหตุผลหลักให้ลูกค้าตามหลักการให้สินเชื่ออย่างรับผิดชอบ"))}</p>`, blocked: true };
      if (c.auto) return { html: notice("good", tt("Within the automatic approval band", "อยู่ในเกณฑ์อนุมัติอัตโนมัติ"), tt(`Score 702, all rules pass, ${baht(I.amount, 0)} is within ${baht(c.p.auto, 0)}.`, `คะแนน 702 ผ่านทุกข้อ ${baht(I.amount, 0)} อยู่ในวงเงิน ${baht(c.p.auto, 0)}`)) + `<p class="consequence">${esc(tt("Approves the application now, with no condition. The offer is ready to send.", "อนุมัติใบสมัครทันทีโดยไม่มีเงื่อนไข พร้อมส่งข้อเสนอ"))}</p>`, confirm: tt("Submit", "ส่ง") };
      return { html: notice("info", tt("Needs a credit decision by a person", "ต้องให้เจ้าหน้าที่พิจารณา"), I.product === "home" ? tt("Home loans are always decided by a credit officer.", "สินเชื่อบ้านพิจารณาโดยเจ้าหน้าที่สินเชื่อเสมอ") : tt(`Above the automatic band of ${baht(c.p.auto, 0)}.`, `เกินเกณฑ์อนุมัติอัตโนมัติ ${baht(c.p.auto, 0)}`)) + `<p class="consequence">${esc(tt("All rules pass. The recommendation is to approve.", "ผ่านทุกข้อ คำแนะนำคืออนุมัติ"))}</p>`, confirm: tt("Approve", "อนุมัติ"), auth: ["credit", I.amount] }; },
    done: (d) => { if (!INTAKE.decided) { const pending = d.auth && !d.auth.ok;
        INTAKE.decided = pending ? { ok: false, text: tt(`With the ${d.auth.second.toLowerCase()} for a decision`, `อยู่ระหว่าง${t(d.auth.second)}พิจารณา`), sub: tt("Target: 4 working hours. The customer sees the progress in the app.", "เป้าหมาย 4 ชั่วโมงทำการ ลูกค้าเห็นความคืบหน้าในแอป") }
          : { ok: true, text: d.c.auto ? tt("Approved automatically in 2 seconds", "อนุมัติอัตโนมัติใน 2 วินาที") : tt("Approved within your authority", "อนุมัติภายในอำนาจของคุณ"), sub: tt("The offer is ready to send for signature.", "ข้อเสนอพร้อมส่งให้ลงนาม") };
        setTimeout(render, 0); }
      return INTAKE.decided.text; } }),
  appOffer: () => ({ title: tt("Send to sign", "ส่งให้ลงนาม"), sub: "APP-30416 · " + t("Pimchanok Rattana"), init: {}, fields: () => kvHtml([[tt("To", "ถึง"), tt("Pimchanok's app, with a push notification", "แอปของคุณพิมพ์ชนก พร้อมการแจ้งเตือน")], [tt("Signs with", "ลงนามด้วย"), "NDID"], [tt("Offer valid", "ข้อเสนอมีผล"), tt("7 days", "7 วัน")]]), read: () => "",
    review: () => ({ html: `<p class="consequence">${esc(tt("Sends the key facts sheet and the contract. She must open the key facts before she can sign.", "ส่งเอกสารสรุปข้อมูลสำคัญและสัญญา ลูกค้าต้องเปิดอ่านเอกสารสรุปก่อนจึงลงนามได้"))}</p>`, confirm: tt("Send", "ส่ง") }),
    done: () => { if (!INTAKE.sent) { INTAKE.sent = true; setTimeout(render, 0); } return tt("Sent. In this concept she signs at once.", "ส่งแล้ว ในต้นแบบนี้ลูกค้าลงนามทันที"); } }),
  appDisburse: () => { const p = INTAKE_PRODUCTS[INTAKE.product], to = INTAKE.product === "personal" ? "SAV-C13" : INTAKE.product === "car" ? "CUR-D0007 · " + t("Bangna Motors") : tt("The seller, by cashier's cheque at the Land Office", "ผู้ขาย ด้วยแคชเชียร์เช็คที่สำนักงานที่ดิน");
    return { title: tt("Disburse", "จ่ายเงิน"), sub: `APP-30416 → ${p.contract}`, init: {}, fields: () => kvHtml([[tt("To", "ถึง"), to], [t("Amount"), baht(INTAKE.amount)]]), read: () => "",
      review: () => ({ html: `<p class="consequence">${tt(`Pays <b>${baht(INTAKE.amount)}</b> to ${esc(to)} and opens ${p.contract} with ${INTAKE.term} instalments. The ledger, the GL and the customer's app update at once.`, `จ่าย <b>${baht(INTAKE.amount)}</b> ให้ ${esc(to)} และเปิดสัญญา ${p.contract} ${INTAKE.term} งวด บัญชีแยกประเภท GL และแอปของลูกค้าอัปเดตทันที`)}</p>`, confirm: tt("Disburse", "จ่ายเงิน"), auth: ["payout", INTAKE.amount] }),
      done: (d) => { if (!(d.auth && !d.auth.ok) && !INTAKE.paid) { INTAKE.paid = true; setTimeout(render, 0); } return tt(`Paid. ${p.contract} is open.`, `จ่ายเงินแล้ว เปิดสัญญา ${p.contract}`); } }; },
});
document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-intake-product], [data-intake-reset]");
  if (!el) return;
  if (el.dataset.intakeReset !== undefined) { INTAKE = INTAKE0(); current.tab = "product"; render(); return; }
  const p = INTAKE_PRODUCTS[el.dataset.intakeProduct];
  Object.assign(INTAKE, { product: el.dataset.intakeProduct, amount: p.amount, term: p.term, decided: null, sent: false, paid: false });
  render(); $(`[data-intake-product="${el.dataset.intakeProduct}"]`)?.focus();
});
document.addEventListener("input", (e) => {
  const k = e.target.dataset.intake;
  if (!k) return;
  if (k === "inAmount") { INTAKE.amount = +e.target.value; $("#inAmountV").textContent = baht(INTAKE.amount, 0); }
  if (k === "inTerm") { INTAKE.term = +e.target.value; $("#inTermV").textContent = monthsTh(INTAKE.term); }
  if (k === "inIncome") { const v = parseMoney(e.target.value); if (!isNaN(v) && v > 0) INTAKE.income = v; }
  INTAKE.decided = null; INTAKE.sent = false; INTAKE.paid = false;
  if ($("#inOut")) $("#inOut").innerHTML = intakeOut();
  if ($("#inAfford")) $("#inAfford").innerHTML = affordOut();
});

/* ---------------- FAC-B2031: credit facilities for Siam Freight Logistics ---------------- */
const FAC = {
  limit: 120000000, review: Date.UTC(2026, 10, 30),
  lines: [["TL-2024-000311", "Term loan", "เงินกู้ระยะยาว", 60000000, 38400000, "MLR − 1.00% = 6.10%", "Amortising to Sep 2029", "ผ่อนชำระถึง ก.ย. 2572", "lending"],
    ["RC-B2031", "Revolving credit, promissory notes", "วงเงินหมุนเวียน ตั๋วสัญญาใช้เงิน", 30000000, 18000000, "MOR − 0.50% = 6.80%", "1 to 6 months per note", "1 ถึง 6 เดือนต่อฉบับ", "lending"],
    ["OD-B2031", "Overdraft on CUR-B2031", "เงินเบิกเกินบัญชี CUR-B2031", 10000000, 0, "MOR = 7.30%", "On demand", "เมื่อทวงถาม", "lending"],
    ["BG-LINE", "Bank guarantees", "หนังสือค้ำประกัน", 15000000, 12000000, "Fee 1.50% a year", "BG-26-1102 to the Port Authority", "BG-26-1102 ให้การท่าเรือ", "trade"],
    ["FX-B2031", "FX settlement line", "วงเงินซื้อขายเงินตราต่างประเทศ", 10000000, 4100000, "Pre-settlement risk", "Forwards to Mar 2027", "สัญญาล่วงหน้าถึง มี.ค. 2570", "treasury"]],
  notes: [["PN-26-0815", 8000000, Date.UTC(2026, 7, 15), Date.UTC(2026, 10, 16)], ["PN-26-1003", 10000000, Date.UTC(2026, 9, 3), Date.UTC(2027, 0, 4)]],
  cov: "due", waiver: null, reviewSent: false,
  q3: { ebitda: 41200000, service: 36100000, netDebt: 128400000, ca: 62000000, cl: 54900000 },
};
const facUsed = () => FAC.lines.reduce((s, l) => s + l[4], 0);
const facLine = (id) => FAC.lines.find((l) => l[0] === id);
const facStop = () => FAC.cov === "breach" && FAC.waiver !== "granted";
const facRatios = (q) => ({ dscr: q.ebitda / q.service, lev: q.netDebt / q.ebitda, cr: q.ca / q.cl });
const COVENANTS = [["dscr", "Debt service cover", "ความสามารถในการชำระหนี้ (DSCR)", 1.2, "min", 1.22], ["lev", "Net debt to EBITDA", "หนี้สินสุทธิต่อ EBITDA", 3.5, "max", 3.1], ["cr", "Current ratio", "อัตราส่วนเงินทุนหมุนเวียน", 1.1, "min", 1.24]];
const covPass = (c, v) => (c[4] === "min" ? v >= c[3] : v <= c[3]);
function viewFacility() {
  const used = facUsed(), days = Math.round((FAC.review - BIZ) / 864e5), q3 = FAC.cov === "due" ? null : facRatios(FAC.q3);
  return recordPage({ title: "FAC-B2031", mono: true, lede: `${esc(t("Siam Freight Logistics"))} · party B-2031 · ${esc(tt("RM Wanida K. · internal grade 4", "RM วนิดา ก. · ระดับความเสี่ยงภายใน 4"))}`,
    pills: (facStop() ? P("crit", tt("Draw stop", "ระงับการเบิก")) : P("good", "Active")) + (FAC.cov === "due" ? P("warn", tt("Q3 covenant test due", "ถึงกำหนดทดสอบเงื่อนไข Q3")) : FAC.cov === "breach" ? P("crit", tt("DSCR breached", "ผิดเงื่อนไข DSCR")) : P("good", tt("Covenants met", "ผ่านเงื่อนไข"))) + P("info", tt(`Annual review in ${days} days`, `ทบทวนประจำปีอีก ${days} วัน`)),
    actions: `<button class="btn" type="button" data-flow="facReview">${esc(tt("Start annual review", "เริ่มทบทวนประจำปี"))}</button><button class="btn primary" type="button" data-flow="facDraw">${icon("i-cash")}${esc(tt("Draw down", "เบิกใช้วงเงิน"))}</button>`,
    facts: [[tt("Umbrella limit", "วงเงินรวม"), baht(FAC.limit, 0)], [tt("In use", "ใช้ไป"), baht(used, 0), "", `${Math.round(used / FAC.limit * 100)}%`], [tt("Available", "คงเหลือ"), baht(FAC.limit - used, 0), facStop() ? "crit" : "", facStop() ? tt("draw stop on RC and OD", "ระงับการเบิก RC และ OD") : ""],
      ["DSCR", q3 ? `${q3.dscr.toFixed(2)}x` : "1.22x", q3 && q3.dscr < 1.2 ? "crit" : "", q3 ? tt("Q3 2026 · min 1.20x", "Q3 2569 · ขั้นต่ำ 1.20x") : tt("Q2 2026 · min 1.20x", "Q2 2569 · ขั้นต่ำ 1.20x")], [tt("Collateral cover", "หลักประกันต่อภาระหนี้"), `${Math.round(facLending() / used * 100)}%`, "", tt("lending value", "มูลค่าที่ให้กู้ได้")], [tt("Next review", "ทบทวนครั้งถัดไป"), fd(FAC.review)]],
    panels: { limits: facLimits, drawdowns: facDrawdowns, covenants: facCovenants, collateral: facCollateral, review: facReviewTab } });
}
function facLimits() {
  const used = facUsed();
  return `<section class="card"><div class="card-head"><div><div class="card-title">${esc(tt("Limits", "วงเงิน"))}</div><div class="card-sub">${esc(tt(`Every line sits under one umbrella of ${baht(FAC.limit, 0)}; each also has its own limit.`, `ทุกวงเงินอยู่ภายใต้วงเงินรวม ${baht(FAC.limit, 0)} และมีวงเงินย่อยของตัวเอง`))}</div></div></div><div class="card-body"><div class="bars">
    <div class="bar-row"><span><b>${esc(tt("Umbrella", "วงเงินรวม"))}</b></span><span class="num">${baht(used, 0)} <span class="muted">/ ${baht(FAC.limit, 0)}</span></span><div class="bar"><span style="width:${used / FAC.limit * 100}%"></span></div></div>
    ${FAC.lines.map(([id, en, th, lim, out, , , , sys]) => { const pct = out / lim * 100, stop = facStop() && (id === "RC-B2031" || id === "OD-B2031"); return `<div class="bar-row"><span>${chip(sys)} <span class="rec">${esc(id)}</span> ${esc(tt(en, th))}${stop ? " " + P("crit", tt("Draw stop", "ระงับการเบิก")) : ""}</span><span class="num">${baht(out, 0)} <span class="muted">/ ${baht(lim, 0)}</span></span><div class="bar"><span class="${pct > 85 ? "warn" : ""}" style="width:${Math.max(pct, 1)}%"></span></div></div>`; }).join("")}</div></div></section>
    ${card(tt("Terms", "เงื่อนไข"), table({ cols: ["Line", "Pricing", "Tenor"], rows: FAC.lines.map(([id, , , , , price, ten, tenTh]) => [R(id), t(price), tt(ten, tenTh)]) }, tt("Terms", "เงื่อนไข")) + `<p class="note" style="margin-top:12px">${esc(tt("The fleet master agreement MA-1 is a separate ฿61.4m line in Leasing, with a cross-default to this facility.", "สัญญาหลักฟลีต MA-1 เป็นวงเงินแยก ฿61.4 ล้านในระบบลีสซิ่ง และมีเงื่อนไขผิดนัดข้ามสัญญากับวงเงินนี้"))}</p>`)}`;
}
function facDrawdowns() {
  const rows = FAC.notes.slice().reverse().map(([id, amt, from, to]) => [R(id), "RC-B2031", baht(amt), fd(from), fd(to), P(to < BIZ ? "" : "good", to < BIZ ? "Repaid" : "Active")]);
  return `<section class="card"><div class="card-head"><div><div class="card-title">${esc(tt("Drawdowns", "การเบิกใช้"))}</div><div class="card-sub">${esc(tt("Promissory notes under the revolving credit. Each rolls over or is repaid at maturity.", "ตั๋วสัญญาใช้เงินภายใต้วงเงินหมุนเวียน ต่ออายุหรือชำระคืนเมื่อครบกำหนด"))}</div></div><button class="btn primary" type="button" data-flow="facDraw">${esc(tt("Draw down", "เบิกใช้วงเงิน"))}</button></div>
    <div class="card-body flush">${table({ cols: ["Note", "Line", "Amount", "Drawn", "Matures", "State"], rows }, tt("Drawdowns", "การเบิกใช้"))}</div></section>
    ${card(tt("Conditions precedent", "เงื่อนไขก่อนการเบิก"), `<div class="list">${[[tt("Facility agreement and security documents signed", "ลงนามสัญญาวงเงินและเอกสารหลักประกันแล้ว"), true], [tt("Mortgage registered at the Land Office", "จดจำนองที่สำนักงานที่ดินแล้ว"), true], [tt("Business collateral registered with DBD", "จดทะเบียนหลักประกันทางธุรกิจกับกรมพัฒนาธุรกิจการค้าแล้ว"), true], [tt("No event of default continuing", "ไม่มีเหตุผิดนัดที่ยังไม่แก้ไข"), !facStop()]]
      .map(([d, ok]) => `<div class="li"><span class="sev ${ok ? "good" : "crit"}">${icon(ok ? "i-check" : "i-alert")}</span><div><strong>${esc(d)}</strong>${ok ? "" : `<p>${esc(tt("DSCR breached at Q3 2026 and not waived", "ผิดเงื่อนไข DSCR ณ Q3 2569 และยังไม่ได้รับการผ่อนผัน"))}</p>`}</div></div>`).join("")}</div>`)}`;
}
function facCovenants() {
  const q3 = FAC.cov === "due" ? null : facRatios(FAC.q3);
  const rows = COVENANTS.map((c) => { const v = q3 && q3[c[0]]; return [tt(c[1], c[2]), `${c[4] === "min" ? "≥" : "≤"} ${c[3].toFixed(2)}x`, `${c[5].toFixed(2)}x`, v ? `${v.toFixed(2)}x` : tt("Due 14 Nov", "ครบกำหนด 14 พ.ย."), !v ? P("warn", tt("Test due", "ถึงกำหนดทดสอบ")) : covPass(c, v) ? P("good", tt("Met", "ผ่าน")) : P("crit", tt("Breached", "ผิดเงื่อนไข"))]; });
  rows.push([tt("Audited accounts within 120 days of year end", "งบการเงินที่ตรวจสอบแล้วภายใน 120 วันหลังสิ้นปี"), tt("by 30 Apr", "ภายใน 30 เม.ย."), tt("28 Apr 2026", "28 เม.ย. 2569"), "—", P("good", tt("Met", "ผ่าน"))], [tt("Fleet and warehouse insured", "ประกันรถและคลังสินค้า"), tt("at all times", "ตลอดเวลา"), tt("Yes", "มี"), tt("Warehouse renews 30 Nov", "คลังสินค้าต่ออายุ 30 พ.ย."), P("warn", tt("Renewal due", "ถึงกำหนดต่ออายุ"))]);
  const btn = FAC.cov === "due" ? `<button class="btn primary" type="button" data-flow="covTest">${esc(tt("Test Q3 2026", "ทดสอบ Q3 2569"))}</button>` : FAC.cov === "breach" && !FAC.waiver ? `<button class="btn primary" type="button" data-flow="covWaiver">${esc(tt("Ask for a waiver", "ขอผ่อนผัน"))}</button>` : "";
  return `<section class="card"><div class="card-head"><div><div class="card-title">${esc(tt("Financial covenants", "เงื่อนไขทางการเงิน"))}</div><div class="card-sub">${esc(tt("Tested each quarter from management accounts, within 45 days of the quarter end. Q3 accounts arrived on 20 Oct.", "ทดสอบทุกไตรมาสจากงบการเงินฝ่ายบริหาร ภายใน 45 วันหลังสิ้นไตรมาส งบ Q3 มาถึงเมื่อ 20 ต.ค."))}</div></div>${btn}</div>
    <div class="card-body flush">${table({ cols: ["Covenant", "Threshold", "Q2 2026", "Q3 2026", "State"], rows }, tt("Covenants", "เงื่อนไข"))}</div></section>
    ${FAC.waiver ? notice(FAC.waiver === "granted" ? "good" : "info", FAC.waiver === "granted" ? tt("Waiver granted", "ได้รับการผ่อนผันแล้ว") : tt("Waiver with the credit committee, meeting 18 Nov", "คำขอผ่อนผันอยู่กับคณะกรรมการสินเชื่อ ประชุม 18 พ.ย."), tt("Until it is decided, the draw stop on the revolving credit and the overdraft stays.", "ระหว่างรอผล ยังระงับการเบิกวงเงินหมุนเวียนและเงินเบิกเกินบัญชี")) : ""}`;
}
const COLLATERAL = [["Land and warehouse, Bang Na km 23", "ที่ดินและคลังสินค้า บางนา กม. 23", "Title deed 12345 · mortgage ฿80,000,000", "โฉนด 12345 · จำนอง ฿80,000,000", 96000000, Date.UTC(2025, 2, 24), 0.7],
  ["Fleet of 42 trucks", "รถบรรทุก 42 คัน", "Business collateral, registered with DBD", "หลักประกันทางธุรกิจ จดทะเบียนกับกรมพัฒนาธุรกิจการค้า", 38500000, Date.UTC(2026, 5, 30), 0.5],
  ["Guarantee by Siam Freight Holdings Co., Ltd.", "การค้ำประกันโดย บริษัท สยามเฟรท โฮลดิ้งส์ จำกัด", "Parent company, unlimited", "บริษัทแม่ ไม่จำกัดวงเงิน", 0, Date.UTC(2024, 0, 11), 0],
  ["Guarantee by the managing director", "การค้ำประกันโดยกรรมการผู้จัดการ", "Personal, up to ฿20,000,000", "บุคคล ไม่เกิน ฿20,000,000", 0, Date.UTC(2024, 0, 11), 0]];
const facLending = () => COLLATERAL.reduce((s, c) => s + c[4] * c[6], 0);
function facCollateral() {
  const rows = COLLATERAL.map(([en, th, den, dth, v, at, hc]) => [tt(en, th), tt(den, dth), v ? baht(v, 0) : "—", fd(at), hc ? `${Math.round(hc * 100)}%` : "—", v ? baht(v * hc, 0) : "—"]);
  return `<section class="card"><div class="card-head"><div><div class="card-title">${esc(tt("Collateral and guarantees", "หลักประกันและการค้ำประกัน"))}</div><div class="card-sub">${esc(tt(`Lending value ${baht(facLending(), 0)} against ${baht(facUsed(), 0)} in use.`, `มูลค่าที่ให้กู้ได้ ${baht(facLending(), 0)} เทียบกับที่ใช้ไป ${baht(facUsed(), 0)}`))}</div></div></div><div class="card-body flush">${table({ cols: ["Security", "Charge", "Value", "Valued", "Advance rate", "Lending value"], rows }, tt("Collateral", "หลักประกัน"))}</div></section>
    <div class="grid-main">${card(tt("Coming up", "ที่จะถึง"), tl([[Date.UTC(2026, 10, 30), tt("Warehouse fire insurance expires", "ประกันอัคคีภัยคลังสินค้าหมดอายุ"), tt("Renewal asked of the customer on 15 Oct", "ขอให้ลูกค้าต่ออายุเมื่อ 15 ต.ค."), "warn"], [Date.UTC(2027, 5, 30), tt("Fleet revaluation", "ประเมินมูลค่ารถใหม่"), tt("Yearly", "ทุกปี"), ""], [Date.UTC(2028, 2, 24), tt("Land reappraisal", "ประเมินราคาที่ดินใหม่"), tt("Every 3 years, by a panel appraiser", "ทุก 3 ปี โดยผู้ประเมินในบัญชีของธนาคาร"), ""]]))}
      ${card(tt("Cover", "ความคุ้มครอง"), `<div class="bars"><div class="bar-row"><span>${esc(tt("Lending value to exposure", "มูลค่าที่ให้กู้ได้ต่อภาระหนี้"))}</span><span class="num">${Math.round(facLending() / facUsed() * 100)}%</span><div class="bar"><span style="width:${Math.min(100, facLending() / facUsed() * 100)}%"></span></div></div></div><p class="note" style="margin-top:12px">${esc(tt("Guarantees are not counted in the lending value; they stand behind it.", "ไม่นับการค้ำประกันในมูลค่าที่ให้กู้ได้ แต่เป็นหลักประกันเพิ่มเติม"))}</p>`)}</div>`;
}
function facReviewTab() {
  const items = [[tt("Audited accounts FY2025", "งบการเงินตรวจสอบแล้ว ปี 2568"), tt("Received 28 Apr", "ได้รับ 28 เม.ย."), "good"], [tt("Q3 management accounts", "งบการเงินฝ่ายบริหาร Q3"), tt("Received 20 Oct", "ได้รับ 20 ต.ค."), "good"],
    [tt("Q3 covenant test", "ทดสอบเงื่อนไข Q3"), FAC.cov === "due" ? tt("To do", "ยังไม่ทำ") : FAC.cov === "breach" ? tt("DSCR breached", "ผิดเงื่อนไข DSCR") : tt("Met", "ผ่าน"), FAC.cov === "due" ? "warn" : FAC.cov === "breach" ? "crit" : "good"],
    [tt("Internal grade", "ระดับความเสี่ยงภายใน"), FAC.cov === "breach" ? tt("4 → 5 proposed", "เสนอ 4 → 5") : "4", FAC.cov === "breach" ? "warn" : "good"], [tt("Collateral and insurance", "หลักประกันและประกันภัย"), tt("Warehouse insurance renewal pending", "รอต่ออายุประกันคลังสินค้า"), "warn"],
    [tt("KYC and beneficial owners", "KYC และผู้รับผลประโยชน์ที่แท้จริง"), tt("Refreshed 11 Jan 2026", "ทบทวนแล้ว 11 ม.ค. 2569"), "good"], [tt("Credit memo", "บันทึกเสนอสินเชื่อ"), FAC.reviewSent ? tt("With the credit committee", "อยู่กับคณะกรรมการสินเชื่อ") : tt("Drafted by Copilot; the RM checks it", "Copilot ร่างแล้ว RM ตรวจทาน"), FAC.reviewSent ? "good" : "info"]];
  return `<div class="grid-main">${card(tt(`Annual review, due ${fd(FAC.review)}`, `ทบทวนประจำปี ครบกำหนด ${fd(FAC.review)}`), `<div class="list">${items.map(([w, s, tone]) => `<div class="li"><span class="sev ${tone}">${icon(tone === "good" ? "i-check" : "i-alert")}</span><div><strong>${esc(w)}</strong><p>${esc(s)}</p></div></div>`).join("")}</div>`)}
    ${card(tt("Copilot's draft", "ร่างของ Copilot"), `<p style="font-size:14px;line-height:1.6">${esc(FAC.cov === "breach" ? tt("Renew the umbrella at ฿120m for 12 months. Q3 DSCR of 1.14x is below 1.20x after a fall in freight rates; leverage and liquidity are within limits. Recommend a two-quarter reset to 1.10x with a 0.25% margin step-up, and grade 5.", "ต่ออายุวงเงินรวม ฿120 ล้าน 12 เดือน DSCR Q3 1.14x ต่ำกว่า 1.20x หลังค่าขนส่งลดลง หนี้สินและสภาพคล่องอยู่ในเกณฑ์ เสนอปรับเกณฑ์เป็น 1.10x สองไตรมาส เพิ่มส่วนต่าง 0.25% และระดับ 5")
      : tt("Renew the umbrella at ฿120m for 12 months. The draft is finished once the Q3 covenant test is in.", "ต่ออายุวงเงินรวม ฿120 ล้าน 12 เดือน ร่างจะสมบูรณ์เมื่อทดสอบเงื่อนไข Q3 แล้ว"))}</p><p class="note" style="margin-top:10px">${esc(tt("Drawn from the ledger, the accounts and the covenant history. A person checks and signs it.", "สร้างจากบัญชีแยกประเภท งบการเงิน และประวัติเงื่อนไข มีคนตรวจและลงนาม"))}</p><div class="actions" style="margin-top:12px"><button class="btn primary" type="button" data-flow="facReview" ${FAC.reviewSent ? "disabled" : ""}>${esc(FAC.reviewSent ? tt("Sent", "ส่งแล้ว") : tt("Send to the credit committee", "ส่งคณะกรรมการสินเชื่อ"))}</button></div>`)}</div>`;
}
const facSub = () => "FAC-B2031 · " + t("Siam Freight Logistics");
Object.assign(FLOWS, {
  facDraw: () => ({ title: tt("Draw down", "เบิกใช้วงเงิน"), sub: facSub(), init: { line: "RC-B2031", amount: 5000000, tenor: "3" },
    fields: (d) => select("dline", tt("Line", "วงเงิน"), [["RC-B2031", tt("Revolving credit · available ", "วงเงินหมุนเวียน · คงเหลือ ") + baht(30000000 - facLine("RC-B2031")[4], 0)], ["OD-B2031", tt("Overdraft · available ", "เงินเบิกเกินบัญชี · คงเหลือ ") + baht(10000000 - facLine("OD-B2031")[4], 0)]], d.line) +
      money("damt", d.amount, t("Amount")) + select("dten", tt("Tenor, for a note", "อายุตั๋ว"), [["1", monthsTh(1)], ["3", monthsTh(3)], ["6", monthsTh(6)]], d.tenor),
    read: (d) => { const v = parseMoney($("#damt").value); d.line = $("#dline").value; d.tenor = $("#dten").value; if (isNaN(v) || v <= 0) return tt("Enter an amount in baht.", "ใส่จำนวนเงินเป็นบาท"); d.amount = v; return ""; },
    review: (d) => { const l = facLine(d.line), avail = l[3] - l[4], umb = FAC.limit - facUsed();
      if (facStop()) return { html: notice("crit", tt("Draw stop", "ระงับการเบิก"), tt("DSCR was breached at Q3 2026 and has not been waived, so no new money can be drawn on the revolving credit or the overdraft.", "ผิดเงื่อนไข DSCR ณ Q3 2569 และยังไม่ได้รับการผ่อนผัน จึงเบิกเงินใหม่จากวงเงินหมุนเวียนหรือเงินเบิกเกินบัญชีไม่ได้")) + `<p class="consequence">${esc(tt("Ask for a waiver on the Covenants tab, or have the customer cure the breach.", "ขอผ่อนผันในแท็บเงื่อนไข หรือให้ลูกค้าแก้ไขเหตุผิดเงื่อนไข"))}</p>`, blocked: true };
      if (d.amount > avail || d.amount > umb) return { html: notice("crit", tt("Over the limit", "เกินวงเงิน"), tt(`${d.line} has ${baht(avail, 0)} available and the umbrella ${baht(umb, 0)}.`, `${d.line} คงเหลือ ${baht(avail, 0)} วงเงินรวมคงเหลือ ${baht(umb, 0)}`)), blocked: true };
      const mat = addMonths(BIZ, +d.tenor), int = r2(d.amount * 0.068 * Math.round((mat - BIZ) / 864e5) / 365); d.mat = mat;
      return { html: quoteRows(d.line === "RC-B2031" ? [[t("Amount"), baht(d.amount)], [tt("Matures", "ครบกำหนด"), fd(mat)], [tt("Interest at 6.80%", "ดอกเบี้ย 6.80%"), baht(int)], [tt("Available after", "คงเหลือหลังเบิก"), baht(avail - d.amount, 0)]] : [[t("Amount"), baht(d.amount)], [tt("Available after", "คงเหลือหลังเบิก"), baht(avail - d.amount, 0)]]) +
        `<p class="consequence">${tt(`Credits <b>${baht(d.amount)}</b> to CUR-B2031 today${d.line === "RC-B2031" ? ` against a promissory note due ${fd(mat)}` : ""}. All conditions precedent are met.`, `โอน <b>${baht(d.amount)}</b> เข้า CUR-B2031 วันนี้${d.line === "RC-B2031" ? ` โดยออกตั๋วสัญญาใช้เงินครบกำหนด ${fd(mat)}` : ""} ผ่านเงื่อนไขก่อนการเบิกครบ`)}</p>`, confirm: tt("Draw down", "เบิกใช้"), auth: ["drawdown", d.amount] }; },
    done: (d) => { if (!d.logged && !(d.auth && !d.auth.ok)) { d.logged = true; facLine(d.line)[4] += d.amount; if (d.line === "RC-B2031") FAC.notes.push([`PN-26-1024-${FAC.notes.length}`, d.amount, BIZ, d.mat]); setTimeout(render, 0); }
      return tt(`${baht(d.amount)} credited to CUR-B2031.`, `โอน ${baht(d.amount)} เข้า CUR-B2031 แล้ว`); } }),
  covTest: () => ({ title: tt("Test covenants, Q3 2026", "ทดสอบเงื่อนไข Q3 2569"), sub: facSub(), init: { ...FAC.q3 },
    fields: (d) => `<p class="hint muted">${esc(tt("From the Q3 management accounts received on 20 Oct, twelve months to 30 Sep.", "จากงบการเงินฝ่ายบริหาร Q3 ที่ได้รับ 20 ต.ค. สิบสองเดือนถึง 30 ก.ย."))}</p>` + money("qe", d.ebitda, "EBITDA") + money("qs", d.service, tt("Debt service: interest and principal", "ภาระชำระหนี้: ดอกเบี้ยและเงินต้น")) + money("qn", d.netDebt, tt("Net debt", "หนี้สินสุทธิ")) + money("qa", d.ca, tt("Current assets", "สินทรัพย์หมุนเวียน")) + money("ql", d.cl, tt("Current liabilities", "หนี้สินหมุนเวียน")),
    read: (d) => { const v = ["qe", "qs", "qn", "qa", "ql"].map((id) => parseMoney($("#" + id).value)); if (v.some((x) => isNaN(x) || x <= 0)) return tt("Enter every figure in baht.", "ใส่ทุกตัวเลขเป็นบาท"); [d.ebitda, d.service, d.netDebt, d.ca, d.cl] = v; return ""; },
    review: (d) => { const r = facRatios(d), fails = COVENANTS.filter((c) => !covPass(c, r[c[0]]));
      return { html: table({ cols: ["Covenant", "Threshold", "Q3 2026", "State"], rows: COVENANTS.map((c) => [tt(c[1], c[2]), `${c[4] === "min" ? "≥" : "≤"} ${c[3].toFixed(2)}x`, `${r[c[0]].toFixed(2)}x`, covPass(c, r[c[0]]) ? P("good", tt("Met", "ผ่าน")) : P("crit", tt("Breached", "ผิดเงื่อนไข"))]) }, tt("Covenants", "เงื่อนไข")) +
        `<p class="consequence" style="margin-top:14px">${fails.length ? tt(`Records a breach of ${fails.map((c) => c[1].toLowerCase()).join(" and ")}. That is an event of default: a draw stop is set on the revolving credit and the overdraft (the term loan and guarantees are not affected), the RM and credit risk are told, and the loss allowance checks the facility for a move to Stage 2.`, `บันทึกการผิดเงื่อนไข${fails.map((c) => c[2]).join(" และ ")} ถือเป็นเหตุผิดนัด ระงับการเบิกวงเงินหมุนเวียนและเงินเบิกเกินบัญชี (ไม่กระทบเงินกู้ระยะยาวและหนังสือค้ำประกัน) แจ้ง RM และฝ่ายบริหารความเสี่ยงด้านเครดิต และตรวจการย้ายไป Stage 2 ในการคำนวณค่าเผื่อผลขาดทุน`)
          : tt("Records that every covenant is met for Q3 2026.", "บันทึกว่าผ่านทุกเงื่อนไขสำหรับ Q3 2569")}</p>`, confirm: tt("Record the test", "บันทึกผลทดสอบ") }; },
    done: (d) => { if (FAC.cov === "due") { Object.assign(FAC.q3, { ebitda: d.ebitda, service: d.service, netDebt: d.netDebt, ca: d.ca, cl: d.cl }); const r = facRatios(FAC.q3); FAC.cov = COVENANTS.every((c) => covPass(c, r[c[0]])) ? "met" : "breach"; setTimeout(render, 0); }
      return FAC.cov === "breach" ? tt("Breach recorded. Draw stop set on RC-B2031 and OD-B2031.", "บันทึกการผิดเงื่อนไขแล้ว ระงับการเบิก RC-B2031 และ OD-B2031") : tt("All covenants met.", "ผ่านทุกเงื่อนไข"); } }),
  covWaiver: () => ({ title: tt("Ask for a waiver", "ขอผ่อนผันเงื่อนไข"), sub: facSub(), init: { kind: "reset" },
    fields: (d) => `<fieldset class="field"><legend>${esc(tt("What to ask for", "ขออะไร"))}</legend><div class="radio-list">${[["once", tt("Waive Q3 2026 only", "ผ่อนผันเฉพาะ Q3 2569"), tt("Fee 0.05% of the umbrella: ฿60,000", "ค่าธรรมเนียม 0.05% ของวงเงินรวม: ฿60,000")], ["reset", tt("Reset DSCR to 1.10x for Q3 and Q4 2026", "ปรับเกณฑ์ DSCR เป็น 1.10x สำหรับ Q3 และ Q4 2569"), tt("Margin +0.25% until DSCR is back at 1.20x", "ส่วนต่าง +0.25% จนกว่า DSCR กลับมาที่ 1.20x")]].map(([v, b, s]) => `<label class="radio-card"><input type="radio" name="wkind" value="${v}" ${d.kind === v ? "checked" : ""}><span><b>${esc(b)}</b><small>${esc(s)}</small></span></label>`).join("")}</div></fieldset>`,
    read: (d) => { d.kind = document.querySelector("input[name=wkind]:checked").value; return ""; },
    review: (d) => ({ html: `<p class="consequence">${tt(`Sends the waiver request, with the Q3 accounts and Copilot's note on the fall in freight rates, to the credit committee for 18 Nov. The draw stop stays until it is decided.`, `ส่งคำขอผ่อนผันพร้อมงบ Q3 และบันทึกของ Copilot เรื่องค่าขนส่งที่ลดลง ให้คณะกรรมการสินเชื่อพิจารณาในการประชุม 18 พ.ย. ยังระงับการเบิกจนกว่าจะมีมติ`)}</p>`, confirm: tt("Send", "ส่ง"), auth: ["waiver", FAC.limit] }),
    done: () => { if (!FAC.waiver) { FAC.waiver = "sent"; setTimeout(render, 0); } return tt("Sent to the credit committee.", "ส่งคณะกรรมการสินเชื่อแล้ว"); } }),
  facReview: () => ({ title: tt("Annual review", "ทบทวนประจำปี"), sub: facSub(), init: {}, fields: () => kvHtml([[tt("Proposal", "ข้อเสนอ"), tt("Renew ฿120,000,000 for 12 months", "ต่ออายุ ฿120,000,000 12 เดือน")], [tt("Committee", "คณะกรรมการ"), tt("Credit committee, 18 Nov 2026", "คณะกรรมการสินเชื่อ 18 พ.ย. 2569")], [tt("Pack", "เอกสาร"), tt("Credit memo, accounts, covenant history, collateral, KYC", "บันทึกเสนอ งบการเงิน ประวัติเงื่อนไข หลักประกัน KYC")]]), read: () => "",
    review: () => ({ html: FAC.cov === "due" ? notice("crit", tt("Test the Q3 covenants first", "ทดสอบเงื่อนไข Q3 ก่อน"), tt("The committee needs the latest covenant results.", "คณะกรรมการต้องใช้ผลทดสอบเงื่อนไขล่าสุด")) : `<p class="consequence">${esc(tt("Sends the review pack to the credit committee. The facility stays available on its current terms until the committee decides.", "ส่งเอกสารทบทวนให้คณะกรรมการสินเชื่อ วงเงินยังใช้ได้ตามเงื่อนไขเดิมจนกว่าจะมีมติ"))}</p>`, blocked: FAC.cov === "due", confirm: tt("Send", "ส่ง") }),
    done: () => { if (!FAC.reviewSent) { FAC.reviewSent = true; setTimeout(render, 0); } return tt("Review pack sent to the credit committee.", "ส่งเอกสารทบทวนให้คณะกรรมการสินเชื่อแล้ว"); } }),
});

/* ---------------- the Lending overview: the pipeline, the book and what needs someone ---------------- */
function viewLendingOverview() {
  const s = sysById.lending, base = viewOverview(s), cut = base.lastIndexOf('<section class="card" aria-label=');
  const funnel = [["Received", "รับใบสมัคร", 184], ["Assessed", "ประเมินแล้ว", 162], ["Approved", "อนุมัติ", 111], ["Signed", "ลงนามแล้ว", 87], ["Disbursed", "จ่ายเงินแล้ว", 74]];
  const book = [["Personal loans", "฿12.06bn", "182,410", "4.1%", "2.9%", "14.2%"], ["Home loans", "฿9.84bn", "31,208", "1.2%", "1.1%", "5.4%"], ["SME term loans", "฿6.98bn", "4,912", "3.4%", "2.6%", "6.9%"], ["Overdrafts and revolving credit", "฿2.86bn", "6,377", "1.9%", "1.4%", "7.1%"]];
  const needs = [["crit", tt("Covenant test due: FAC-B2031", "ถึงกำหนดทดสอบเงื่อนไข: FAC-B2031"), tt("Siam Freight Logistics · Q3 accounts in since 20 Oct", "สยามเฟรท โลจิสติกส์ · งบ Q3 มาถึงตั้งแต่ 20 ต.ค."), "rec:FAC-B2031"],
    ["warn", tt("Rate review asked: LN-77120", "ขอทบทวนอัตรา: LN-77120"), tt("Anan Chaiyo is comparing a refinance at 2.90%", "คุณอนันต์กำลังเทียบข้อเสนอรีไฟแนนซ์ 2.90%"), "rec:LN-77120"],
    ["warn", tt("3 applications over ฿2,000,000 for committee", "3 ใบสมัครเกิน ฿2,000,000 รอคณะกรรมการ"), tt("Oldest 2 days", "เก่าสุด 2 วัน"), "lending/applications"], ["info", tt("Restructuring proposals", "ข้อเสนอปรับโครงสร้างหนี้"), tt("3 waiting, 1 drafted by Copilot", "รอ 3 รายการ ร่างโดย Copilot 1 รายการ"), "lending/restructuring"],
    ["info", tt("Servicing requests", "คำขอบริการ"), tt("4 open · median 3 hours", "เปิดอยู่ 4 รายการ · มัธยฐาน 3 ชั่วโมง"), "lending/servicing"]];
  const extra = `<div class="grid-main">
    <section class="card"><div class="card-head"><div><div class="card-title">${esc(tt("Applications today", "ใบสมัครวันนี้"))}</div><div class="card-sub">${esc(tt("From received to disbursed; 61% were decided automatically", "จากรับใบสมัครถึงจ่ายเงิน 61% ตัดสินอัตโนมัติ"))}</div></div><button class="btn" type="button" data-go="rec:APP-30416">${icon("i-plus")}${esc(t("New application"))}</button></div><div class="card-body"><div class="bars">${funnel.map(([en, th, n]) => `<div class="bar-row"><span>${esc(tt(en, th))}</span><span class="num">${n} <span class="muted">${Math.round(n / 184 * 100)}%</span></span><div class="bar"><span style="width:${n / 184 * 100}%"></span></div></div>`).join("")}</div></div></section>
    <section class="card"><div class="card-head"><div class="card-title">${esc(tt("Needs someone", "ต้องมีคนดูแล"))}</div></div><div class="card-body"><div class="list">${needs.map(([tone, w, sub, go]) => `<button class="li" type="button" data-go="${go}" style="background:none;border-left:0;border-right:0;border-bottom:0;text-align:left;width:100%;cursor:pointer;font:inherit;color:inherit"><span class="sev ${tone}">${icon(tone === "crit" ? "i-alert" : "i-arrow")}</span><div><strong>${esc(w)}</strong><p>${esc(sub)}</p></div></button>`).join("")}</div></div></section></div>
    <section class="card"><div class="card-head"><div><div class="card-title">${esc(tt("The book by product", "พอร์ตตามผลิตภัณฑ์"))}</div><div class="card-sub">${esc(tt("Live from the ledger; arrears and NPL by balance", "ข้อมูลสดจากบัญชีแยกประเภท ค้างชำระและ NPL ตามยอดหนี้"))}</div></div></div><div class="card-body flush">${table({ cols: ["Product", "Outstanding", "Accounts", "30+ days late", "NPL", "Yield"], rows: book.map(([n, ...r]) => [t(n), ...r]) }, tt("The book by product", "พอร์ตตามผลิตภัณฑ์"))}</div></section>`;
  return base.slice(0, cut) + extra + base.slice(cut);
}

/* ---------------- records, authorities and Thai labels for the screens above ---------------- */
Object.assign(RECS, {
  "LN-77120": { sys: "lending", sec: "loans", label: "LN-77120", kind: "Home loan", match: ["LN-77120"], view: () => viewHome(),
    tabs: [["summary", "Summary"], ["schedule", "Schedule", 18], ["payments", "Payments", 8], ["servicing", "Servicing"], ["letters", "Letters", 4]] },
  "APP-30416": { sys: "lending", sec: "applications", label: "APP-30416", kind: "Loan application", match: ["APP-30416"], view: () => viewIntake(),
    tabs: [["product", "Product"], ["applicant", "Applicant"], ["affordability", "Affordability"], ["collateral", "Security"], ["documents", "Documents"], ["decision", "Decision"], ["offer", "Offer and signature"]] },
  "FAC-B2031": { sys: "lending", sec: "facilities", label: "FAC-B2031", kind: "Credit facilities", match: ["FAC-B2031"], view: () => viewFacility(),
    tabs: [["limits", "Limits", 5], ["drawdowns", "Drawdowns"], ["covenants", "Covenants", 5], ["collateral", "Collateral", 4], ["review", "Annual review"]] },
});
ACTIONS.push(["service", "Loan servicing changes", "Credit officer"], ["waive", "Fee waivers", "Head of operations"], ["drawdown", "Drawdowns within approved limits", "Head of operations"], ["waiver", "Covenant waivers", "Credit committee"]);
Object.assign(AUTH.ops, { service: 5000000, waive: 5000, drawdown: 20000000 });
Object.assign(AUTH.credit, { service: 20000000, waive: 20000, drawdown: 50000000, waiver: 50000000 });
Object.assign(AUTH.teller, { waive: 500 });
Object.assign(TH, {
  "Facilities": "วงเงินสินเชื่อธุรกิจ", "Servicing": "งานบริการ", "Home loan": "สินเชื่อบ้าน", "Credit facilities": "วงเงินสินเชื่อธุรกิจ", "Letters": "หนังสือ",
  "Affordability": "ความสามารถชำระหนี้", "Offer and signature": "ข้อเสนอและลงนาม",
  "Drawdowns": "การเบิกใช้", "Annual review": "ทบทวนประจำปี",
  "Loan servicing changes": "เปลี่ยนเงื่อนไขสินเชื่อ", "Fee waivers": "ยกเว้นค่าธรรมเนียม", "Drawdowns within approved limits": "เบิกใช้ภายในวงเงินที่อนุมัติ", "Covenant waivers": "ผ่อนผันเงื่อนไขทางการเงิน",
  "Letter": "หนังสือ", "Existing debt": "หนี้เดิม", "Source": "แหล่งข้อมูล", "Monthly": "ต่อเดือน",
  "Pricing": "อัตราดอกเบี้ย", "Tenor": "ระยะเวลา", "Repaid": "ชำระคืนแล้ว", "Threshold": "เกณฑ์",
  "Charge": "การจดทะเบียน", "Valued": "ประเมินเมื่อ", "Advance rate": "อัตราให้กู้", "Lending value": "มูลค่าที่ให้กู้ได้",
  "Facility": "วงเงิน", "Next review": "ทบทวนครั้งถัดไป", "Asked for": "ขอ", "30+ days late": "ค้าง 30 วันขึ้นไป", "NPL": "NPL", "Yield": "ผลตอบแทน",
  "Overdrafts and revolving credit": "เงินเบิกเกินบัญชีและวงเงินหมุนเวียน",
  "Chalida Boonmee": "ชลิดา บุญมี", "Rate review": "ทบทวนอัตรา", "Due date to the 25th": "เปลี่ยนวันครบกำหนดเป็นวันที่ 25", "Interest certificate 2025": "หนังสือรับรองดอกเบี้ย 2568", 
  "Payment holiday": "พักชำระหนี้", "Email": "อีเมล", "DSCR breached": "ผิดเงื่อนไข DSCR", "Met": "ผ่าน", "Covenant test due": "ถึงกำหนดทดสอบเงื่อนไข", "FAC-B2031 · Q3 2026, by 14 Nov": "FAC-B2031 · Q3 2569 ภายใน 14 พ.ย.", "Branch 0123": "สาขา 0123", "Q2 2026": "Q2 2569", "Q3 2026": "Q3 2569",
  "Q3 test due": "ถึงกำหนดทดสอบ Q3", "Passed Q2": "ผ่าน Q2", "Stock audit monthly": "ตรวจสต็อกทุกเดือน", "Proposed": "เสนอ", "Draw stop": "ระงับการเบิก", "Fee 1.50% a year": "ค่าธรรมเนียม 1.50% ต่อปี", "Pre-settlement risk": "ความเสี่ยงก่อนส่งมอบ",
});

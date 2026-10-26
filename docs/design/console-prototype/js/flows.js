// Fabor console prototype · Action dialogs: enter, review and confirm, done.
// Classic scripts sharing one global scope; load order is set in index.html.
/* ---------------- action dialog: enter → review and confirm → done ---------------- */
let dlg = null;
const parseMoney = (v) => { const s = String(v).replace(/[฿,\s]/g, ""); return /^\d+(\.\d{1,2})?$/.test(s) ? Number(s) : NaN; };
function openDialog(kind) {
  dlg = { kind, step: 0, ref: "IDEM-" + Math.random().toString(16).slice(2, 10).toUpperCase(), from: "sav", amount: LOAN.overdue, promise: 12000, by: "2026-10-31", channel: "Call", error: "" };
  renderDialog();
}
function closeDialog() { dlg = null; $("#dialogHost").innerHTML = ""; }
/* generic flows: each says what to enter, what the review shows and what is typed to confirm */
const money = (id, val, label, hint) => `<div class="field"><label for="${id}">${esc(label)}</label><input class="input money" id="${id}" inputmode="decimal" value="${val ? esc(val.toLocaleString("en-US", { minimumFractionDigits: 2 })) : ""}" ${dlg.error ? 'aria-invalid="true" aria-describedby="flowErr"' : ""}>${hint ? `<span class="hint">${esc(hint)}</span>` : ""}</div>`;
const select = (id, label, opts, cur) => `<div class="field"><label for="${id}">${esc(label)}</label><select class="input" id="${id}">${opts.map(([v, l]) => `<option value="${esc(v)}" ${v === cur ? "selected" : ""}>${esc(l)}</option>`).join("")}</select></div>`;
const area = (id, label, val, hint) => `<div class="field"><label for="${id}">${esc(label)}</label><textarea class="input" id="${id}">${esc(val || "")}</textarea>${hint ? `<span class="hint">${esc(hint)}</span>` : ""}</div>`;
const quoteRows = (rows) => `<div class="quote">${rows.map(([k, v], i) => `<span class="${i === rows.length - 1 ? "total" : ""}">${esc(k)}</span><span class="num${i === rows.length - 1 ? " total" : ""}">${esc(v)}</span>`).join("")}</div>`;
const notice = (tone, title, text) => `<div class="alert ${tone}" role="${tone === "crit" ? "alert" : "status"}">${icon(tone === "crit" ? "i-alert" : "i-check")}<div><strong>${esc(title)}</strong>${text ? `<p>${esc(text)}</p>` : ""}</div></div>`;
const FLOWS = {
  fpPayoff: (vin) => ({ title: tt("Pay off a unit", "ชำระคืนรายคัน"), sub: "FP-DEMO · " + t("Bangna Motors"), init: { vin: vin || FP.units.find((u) => u.state === "sold").vin },
    fields: (d) => select("fvin", t("Vehicle"), FP.units.map((u) => [u.vin, `${u.vin} · ${u.model}`]), d.vin) + `<p class="hint muted">${esc(tt(`Paid from CUR-D0007, which holds ${baht(FP.dealerBal)}.`, `ตัดจาก CUR-D0007 ซึ่งมี ${baht(FP.dealerBal)}`))}</p>`,
    read: (d) => { d.vin = $("#fvin").value; return ""; },
    review: (d) => { const u = FP.units.find((x) => x.vin === d.vin), q = FP.payoff(u), over = q.total > FP.dealerBal;
      return { html: quoteRows([[tt("Outstanding on the unit", "ยอดคงค้างของรถ"), baht(q.principal)], [tt(`Interest since ${fdShort(Math.max(u.drawn, Date.UTC(2026, 9, 1)))}`, `ดอกเบี้ยตั้งแต่ ${fdShort(Math.max(u.drawn, Date.UTC(2026, 9, 1)))}`), baht(q.interest)], [tt("Payoff", "ยอดชำระคืน"), baht(q.total)]]) +
        (over ? notice("crit", tt(`CUR-D0007 is ${baht(r2(q.total - FP.dealerBal))} short`, `CUR-D0007 ขาดอีก ${baht(r2(q.total - FP.dealerBal))}`), tt("Ask the dealer to fund the account or pay by BAHTNET first.", "ให้ดีลเลอร์เติมเงินหรือโอน BAHTNET ก่อน")) :
        `<p class="consequence">${tt(`Takes <b>${baht(q.total)}</b> from CUR-D0007, leaving <b>${baht(r2(FP.dealerBal - q.total))}</b>. ${u.vin} leaves the line, its title goes to the buyer, and FP-DEMO frees <b>${baht(q.principal)}</b>.`, `ตัด <b>${baht(q.total)}</b> จาก CUR-D0007 คงเหลือ <b>${baht(r2(FP.dealerBal - q.total))}</b> รถ ${u.vin} ออกจากวงเงิน โอนกรรมสิทธิ์ให้ผู้ซื้อ และวงเงิน FP-DEMO ว่างเพิ่ม <b>${baht(q.principal)}</b>`)}</p>`),
        blocked: over, typed: u.vin, confirm: tt("Pay off", "ชำระคืน"), auth: ["payout", q.total] }; },
    done: (d) => tt(`${d.vin} is paid off and released.`, `ชำระคืน ${d.vin} และปลดออกจากวงเงินแล้ว`) }),
  hpSettle: () => ({ title: t("Settle early"), sub: "HP-2025-004812 · Napat Srisuk", init: {},
    fields: () => `<div class="field"><span class="lbl">${esc(t("Settlement date"))}</span><span class="static">${esc(fd(BIZ))}</span><span class="hint">${esc(t("The quote is valid for today only."))}</span></div>` + select("hfrom", t("Pay from"), [["branch", t("Cash or transfer at a branch")], ["dealer", tt("Trade-in through Bangna Motors", "เทิร์นรถผ่านบางนา มอเตอร์ส")]], "branch"),
    read: (d) => { d.from = $("#hfrom").value; return ""; },
    review: () => ({ html: hpQuote() + `<p class="consequence">${tt(`Closes HP-2025-004812 for <b>${baht(HP.total)}</b>, including a rebate of <b>${baht(HP.rebate)}</b>. A tax invoice is issued and the title of the Hilux transfers to Napat Srisuk.`, `ปิดสัญญา HP-2025-004812 ยอด <b>${baht(HP.total)}</b> รวมส่วนลด <b>${baht(HP.rebate)}</b> ออกใบกำกับภาษีและโอนกรรมสิทธิ์รถให้ผู้เช่าซื้อ`)}</p>`, typed: "HP-2025-004812", confirm: t("Confirm settlement"), auth: ["settle", HP.total] }),
    done: () => tt("HP-2025-004812 is settled. Tax invoice TI-2026-30118.", "ปิดสัญญา HP-2025-004812 แล้ว ใบกำกับภาษี TI-2026-30118") }),
  deposit: () => ({ title: tt("Cash deposit", "ฝากเงินสด"), sub: tt("Counter 3 · Somchai Prasert", "ช่อง 3 · สมชาย ประเสริฐ"), init: { amount: 0, acct: "SAV-C10", source: "" },
    fields: (d) => select("dacct", t("Account"), [["SAV-C10", `SAV-C10 · ${baht(LOAN.sav)}`]], d.acct) + money("damt", d.amount, t("Amount"), tt("From ฿2,000,000 the source of funds is required and a cash report is filed.", "ตั้งแต่ ฿2,000,000 ต้องระบุแหล่งที่มาของเงินและรายงาน ปปง.")) + `<div class="field"><label for="dsrc">${esc(tt("Source of funds", "แหล่งที่มาของเงิน"))}</label><input class="input" id="dsrc" value="${esc(d.source)}"></div>`,
    read: (d) => { const v = parseMoney($("#damt").value); d.source = $("#dsrc").value.trim(); if (isNaN(v) || v <= 0) return tt("Enter an amount in baht.", "ใส่จำนวนเงินเป็นบาท"); d.amount = v; return v >= 2000000 && !d.source ? tt("Say where the money comes from: it is required from ฿2,000,000.", "ระบุแหล่งที่มาของเงิน จำเป็นตั้งแต่ ฿2,000,000") : ""; },
    review: (d) => { const big = d.amount >= 2000000; return { html: `<p class="consequence">${tt(`Credits <b>${baht(d.amount)}</b> to SAV-C10, making it <b>${baht(r2(LOAN.sav + d.amount))}</b>. Your drawer goes up by the same amount.`, `เข้าบัญชี SAV-C10 <b>${baht(d.amount)}</b> ยอดใหม่ <b>${baht(r2(LOAN.sav + d.amount))}</b> เงินในลิ้นชักเพิ่มเท่ากัน`)}</p>` + (big ? notice("info", tt("A supervisor approves before the money is credited", "หัวหน้าต้องอนุมัติก่อนเข้าบัญชี"), tt("The AMLO cash transaction report is filed automatically.", "ระบบยื่นรายงานธุรกรรมเงินสดต่อ ปปง. อัตโนมัติ")) : ""), confirm: big ? tt("Send to supervisor", "ส่งให้หัวหน้า") : tt("Deposit", "ฝากเงิน"), auth: big ? null : ["cash", d.amount] }; },
    done: (d) => d.amount >= 2000000 ? tt("Sent to your supervisor. Receipt prints once approved.", "ส่งให้หัวหน้าแล้ว พิมพ์ใบเสร็จเมื่ออนุมัติ") : tt(`${baht(d.amount)} deposited. Receipt printed.`, `ฝาก ${baht(d.amount)} แล้ว พิมพ์ใบเสร็จแล้ว`) }),
  withdraw: () => ({ title: tt("Cash withdrawal", "ถอนเงินสด"), sub: tt("Counter 3 · Somchai Prasert", "ช่อง 3 · สมชาย ประเสริฐ"), init: { amount: 0 },
    fields: (d) => money("wamt", d.amount, t("Amount"), tt(`SAV-C10 holds ${baht(LOAN.sav)}.`, `SAV-C10 มี ${baht(LOAN.sav)}`)),
    read: (d) => { const v = parseMoney($("#wamt").value); if (isNaN(v) || v <= 0) return tt("Enter an amount in baht.", "ใส่จำนวนเงินเป็นบาท"); if (v > LOAN.sav) return tt(`SAV-C10 holds only ${baht(LOAN.sav)}.`, `SAV-C10 มีเพียง ${baht(LOAN.sav)}`); if (v > drawerTotal) return tt("Your drawer does not hold that much cash; ask the vault.", "เงินในลิ้นชักไม่พอ ขอจากห้องมั่นคง"); d.amount = v; return ""; },
    review: (d) => ({ html: `<p class="consequence">${tt(`Pays out <b>${baht(d.amount)}</b> from SAV-C10, leaving <b>${baht(r2(LOAN.sav - d.amount))}</b>.`, `จ่าย <b>${baht(d.amount)}</b> จาก SAV-C10 คงเหลือ <b>${baht(r2(LOAN.sav - d.amount))}</b>`)}</p>` + (d.amount > 50000 ? notice("info", tt("Check the ID card against the customer again", "ตรวจบัตรประชาชนกับตัวลูกค้าอีกครั้ง"), tt("Required above ฿50,000.", "จำเป็นเมื่อเกิน ฿50,000")) : ""), confirm: tt("Pay out", "จ่ายเงิน"), auth: ["cash", d.amount] }),
    done: (d) => tt(`${baht(d.amount)} paid out. Receipt printed.`, `จ่าย ${baht(d.amount)} แล้ว พิมพ์ใบเสร็จแล้ว`) }),
  approveProduct: () => ({ title: tt("Approve AUTO_HP_USED v2", "อนุมัติ AUTO_HP_USED v2"), sub: tt("As Compliance, the last checker", "ในฐานะฝ่ายกำกับ ผู้ตรวจคนสุดท้าย"), init: { note: "" },
    fields: (d) => area("anote", tt("Note for the record (optional)", "หมายเหตุ (ไม่บังคับ)"), d.note),
    read: (d) => { d.note = $("#anote").value; return ""; },
    review: () => ({ html: `<p class="consequence">${tt("Approves AUTO_HP_USED v2. It is the last approval, so the product goes live for dealers on <b>1 Nov 2026</b>. Version 1 stays for the contracts already open.", "อนุมัติ AUTO_HP_USED v2 เป็นการอนุมัติสุดท้าย ผลิตภัณฑ์เริ่มใช้กับดีลเลอร์ <b>1 พ.ย. 2569</b> สัญญาเดิมยังใช้เวอร์ชัน 1")}</p>`, confirm: tt("Approve", "อนุมัติ") }),
    done: () => tt("Approved. AUTO_HP_USED v2 is scheduled to go live on 1 Nov 2026.", "อนุมัติแล้ว AUTO_HP_USED v2 กำหนดเริ่มใช้ 1 พ.ย. 2569") }),
  requestChanges: () => ({ title: tt("Request changes", "ขอให้แก้ไข"), sub: "AUTO_HP_USED v2", init: { note: "" },
    fields: (d) => area("rnote", tt("What should change", "สิ่งที่ต้องแก้ไข"), d.note, tt("The maker sees this note.", "ผู้ทำจะเห็นหมายเหตุนี้")),
    read: (d) => { d.note = $("#rnote").value.trim(); return d.note ? "" : tt("Say what should change.", "ระบุสิ่งที่ต้องแก้ไข"); },
    review: () => ({ html: `<p class="consequence">${tt("Sends AUTO_HP_USED v2 back to Krit S. with your note. Risk's approval is cleared and must be given again after the change.", "ส่ง AUTO_HP_USED v2 กลับให้กฤษ ส. พร้อมหมายเหตุ การอนุมัติของฝ่ายความเสี่ยงจะถูกล้างและต้องอนุมัติใหม่")}</p>`, confirm: tt("Send back", "ส่งกลับ") }),
    done: () => tt("Sent back to Krit S.", "ส่งกลับให้กฤษ ส. แล้ว") }),
  logContact: () => ({ title: t("Log a contact"), sub: t("Somchai Prasert") + " · LN-A-C10", init: { ch: "Call", out: "Promise", note: "" },
    fields: (d) => select("lch", t("Channel"), [["Call", t("Call")], ["Branch visit", t("Branch visit")], ["LINE chat", t("LINE chat")]], d.ch) + select("lout", t("Outcome"), [["Promise", tt("Promised to pay", "นัดชำระ")], ["No answer", tt("No answer", "ไม่มีผู้รับสาย")], ["Dispute", tt("Disputes the debt", "โต้แย้งหนี้")], ["Hardship", tt("Financial hardship", "มีปัญหาทางการเงิน")]], d.out) + area("lnote", tt("Note", "บันทึก"), d.note),
    read: (d) => { d.ch = $("#lch").value; d.out = $("#lout").value; d.note = $("#lnote").value; return ""; },
    review: (d) => ({ html: `<p class="consequence">${tt(`Adds a ${d.ch.toLowerCase()} with the outcome “${d.out.toLowerCase()}” to the history of LN-A-C10 and C10.${d.out === "Hardship" ? " Hardship also opens a restructuring review." : ""}`, `บันทึกการติดต่อลงประวัติของ LN-A-C10 และ C10${d.out === "Hardship" ? " และเปิดการพิจารณาปรับโครงสร้างหนี้" : ""}`)}</p>`, confirm: t("Log a contact") }),
    done: () => tt("Contact logged.", "บันทึกการติดต่อแล้ว") }),
  bulk: (arg) => { const [kind, list] = arg.split("|"), ids = list.split(",").filter(Boolean), n = ids.length;
    const name = { remind: tt("Send reminders", "ส่งการแจ้งเตือน"), assign: tt("Assign to a collector", "มอบหมายให้เจ้าหน้าที่"), export: tt("Export rows", "ส่งออกแถว") }[kind];
    return { title: name, sub: tt(`${n} selected: ${ids.slice(0, 3).join(", ")}${n > 3 ? "…" : ""}`, `เลือก ${n} รายการ: ${ids.slice(0, 3).join(", ")}${n > 3 ? "…" : ""}`), init: { who: "Nok Saelim", ch: "SMS" },
      fields: (d) => kind === "assign" ? select("bwho", tt("Collector", "เจ้าหน้าที่"), [["Nok Saelim", "Nok Saelim · 42 in queue"], ["Pongsak R.", "Pongsak R. · 37 in queue"], ["Agent pool", tt("Agent pool", "กลุ่มเจ้าหน้าที่")]], d.who)
        : kind === "remind" ? select("bch", t("Channel"), [["SMS", "SMS"], ["LINE", "LINE"], ["Letter", tt("Letter", "จดหมาย")]], d.ch) + `<p class="hint muted">${esc(tt("Reminders are service messages, so they also reach customers who withdrew marketing consent.", "การแจ้งเตือนเป็นข้อความบริการ จึงส่งถึงลูกค้าที่ถอนความยินยอมการตลาดด้วย"))}</p>`
        : `<p class="muted">${esc(tt("CSV with the columns on screen. Personal data stays masked.", "ไฟล์ CSV ตามคอลัมน์บนหน้าจอ ข้อมูลส่วนบุคคลยังปิดบังอยู่"))}</p>`,
      read: (d) => { if ($("#bwho")) d.who = $("#bwho").value; if ($("#bch")) d.ch = $("#bch").value; return ""; },
      review: (d) => ({ html: `<p class="consequence">${kind === "assign" ? tt(`Moves <b>${n}</b> accounts to ${esc(d.who)}'s queue. Open promises and contact history move with them.`, `ย้าย <b>${n}</b> บัญชีไปยังคิวของ ${esc(d.who)} นัดชำระและประวัติการติดต่อย้ายไปด้วย`) : kind === "remind" ? tt(`Sends ${d.ch === "SMS" ? "an" : "a"} ${esc(d.ch)} reminder in Thai to <b>${n}</b> customers with the amount overdue and how to pay. Each one is logged on its loan.`, `ส่ง${esc(d.ch)}แจ้งเตือนภาษาไทยถึงลูกค้า <b>${n}</b> ราย พร้อมยอดค้างและวิธีชำระ บันทึกลงในแต่ละสัญญา`) : tt(`Exports <b>${n}</b> rows. The export itself is recorded in the audit trail.`, `ส่งออก <b>${n}</b> แถว การส่งออกจะถูกบันทึกในประวัติการตรวจสอบ`)}</p>`, confirm: name }),
      done: () => kind === "export" ? tt(`${n} rows exported.`, `ส่งออก ${n} แถวแล้ว`) : kind === "assign" ? tt(`${n} accounts assigned.`, `มอบหมาย ${n} บัญชีแล้ว`) : tt(`${n} reminders queued for sending.`, `จัดคิวส่งการแจ้งเตือน ${n} รายการแล้ว`) }; },
  fileSTR: () => ({ title: tt("File a suspicious transaction report", "ยื่นรายงานธุรกรรมที่มีเหตุอันควรสงสัย"), sub: "AML-2026-0418 · Pacific Import Trading", init: { grounds: tt(`Nine cash deposits totalling ${baht(AML_TOTAL, 0)} over ten days at three branches, each just under the ฿2,000,000 report threshold, made by a person who is not a director. Inconsistent with the declared cash turnover.`, `ฝากเงินสด 9 ครั้ง รวม ${baht(AML_TOTAL, 0)} ใน 10 วันที่ 3 สาขา ครั้งละต่ำกว่าเกณฑ์ ฿2,000,000 เล็กน้อย โดยผู้ที่ไม่ใช่กรรมการ ไม่สอดคล้องกับเงินสดหมุนเวียนที่แจ้ง`) },
    fields: (d) => area("strg", tt("Grounds for suspicion", "เหตุอันควรสงสัย"), d.grounds, tt("Sent to AMLO as written. Keep to facts.", "ส่งถึง ปปง. ตามที่เขียน ใช้ข้อเท็จจริงเท่านั้น")),
    read: (d) => { d.grounds = $("#strg").value.trim(); return d.grounds.length > 40 ? "" : tt("Describe the grounds in more detail.", "อธิบายเหตุอันควรสงสัยให้ละเอียดขึ้น"); },
    review: () => ({ html: `<p class="consequence">${tt(`Files report STR-2026-0094 with AMLO, attaching the nine deposits and the KYC file. The account stays open and <b>the customer is not told</b>; Pacific Import Trading moves to enhanced monitoring.`, `ยื่นรายงาน STR-2026-0094 ต่อ ปปง. แนบรายการฝาก 9 รายการและแฟ้ม KYC บัญชียังเปิดอยู่และ<b>ไม่แจ้งลูกค้า</b> Pacific Import Trading เข้าสู่การติดตามเข้มข้น`)}</p>`, typed: "AML-2026-0418", confirm: tt("File the report", "ยื่นรายงาน") }),
    done: (d) => { if (!d.applied) { d.applied = true; amlOutcome = tt("Reported to AMLO as STR-2026-0094 on 24 Oct 2026.", "รายงานต่อ ปปง. แล้ว เลขที่ STR-2026-0094 วันที่ 24 ต.ค. 2569"); setTimeout(render, 0); } return tt("Report STR-2026-0094 filed with AMLO.", "ยื่นรายงาน STR-2026-0094 ต่อ ปปง. แล้ว"); } }),
  closeCase: () => ({ title: tt("Close with no report", "ปิดเรื่องโดยไม่รายงาน"), sub: "AML-2026-0418", init: { why: "" },
    fields: (d) => area("ccw", tt("Why no report is needed", "เหตุที่ไม่ต้องรายงาน"), d.why, tt("A second investigator reviews closures of high-risk cases.", "ผู้สอบสวนคนที่สองทบทวนการปิดเรื่องความเสี่ยงสูง")),
    read: (d) => { d.why = $("#ccw").value.trim(); return d.why ? "" : tt("Say why.", "ระบุเหตุผล"); },
    review: () => ({ html: `<p class="consequence">${tt("Sends the closure to a second investigator. The alert rule keeps watching the account.", "ส่งการปิดเรื่องให้ผู้สอบสวนคนที่สอง กฎแจ้งเตือนยังคงติดตามบัญชีต่อ")}</p>`, confirm: tt("Send for review", "ส่งทบทวน") }),
    done: (d) => { if (!d.applied) { d.applied = true; amlOutcome = tt("Closure sent to a second investigator.", "ส่งการปิดเรื่องให้ผู้สอบสวนคนที่สองแล้ว"); setTimeout(render, 0); } return amlOutcome; } }),
  releasePayment: () => ({ title: tt("Release the payment", "ปล่อยรายการโอน"), sub: "TR-9918210 · $1,180,000.00", init: { why: tt("Beneficiary is the customer's registered HK subsidiary (HK 2213845); only the name is similar to the listed entity.", "ผู้รับเป็นบริษัทลูกที่จดทะเบียนในฮ่องกง (HK 2213845) มีเพียงชื่อคล้ายกับรายชื่อที่ถูกขึ้นบัญชี") },
    fields: (d) => area("rpw", tt("Why it is a false positive", "เหตุที่เป็นผลบวกลวง"), d.why),
    read: (d) => { d.why = $("#rpw").value.trim(); return d.why ? "" : tt("Say why.", "ระบุเหตุผล"); },
    review: () => ({ html: `<p class="consequence">${tt("Releases <b>$1,180,000.00</b> to HSBC Hong Kong before the 15:00 cut-off. The beneficiary is added to the good-guys list so the same name does not stop the next payment.", "ปล่อย <b>$1,180,000.00</b> ไป HSBC ฮ่องกง ก่อนตัดรอบ 15:00 และเพิ่มผู้รับในรายชื่อที่ตรวจแล้ว เพื่อไม่ให้ชื่อเดิมระงับรายการถัดไป")}</p>`, typed: "TR-9918210", confirm: tt("Release", "ปล่อยรายการ"), auth: ["payout", 1180000 * 36] }),
    done: (d) => { if (!d.applied) { d.applied = true; heldOutcome = d.auth && !d.auth.ok ? tt(`Release sent to the ${d.auth.second.toLowerCase()}.`, `ส่งการปล่อยรายการให้${t(d.auth.second)}แล้ว`) : tt("Released and sent at 10:05.", "ปล่อยและส่งแล้วเวลา 10:05"); setTimeout(render, 0); } return tt("Released.", "ปล่อยรายการแล้ว"); } }),
  rejectPayment: () => ({ title: tt("Reject and escalate", "ปฏิเสธและส่งต่อ"), sub: "TR-9918210", init: {},
    fields: () => `<p class="muted">${esc(tt("The customer is told the payment could not be made, not why.", "แจ้งลูกค้าว่าทำรายการไม่ได้ โดยไม่บอกเหตุผล"))}</p>`, read: () => "",
    review: () => ({ html: `<p class="consequence">${tt("Returns <b>$1,180,000.00</b> to CUR-B2031 and opens a compliance case with the screening evidence.", "คืน <b>$1,180,000.00</b> เข้า CUR-B2031 และเปิดเรื่องที่ฝ่ายกำกับพร้อมหลักฐานการคัดกรอง")}</p>`, confirm: tt("Reject", "ปฏิเสธ") }),
    done: (d) => { if (!d.applied) { d.applied = true; heldOutcome = tt("Rejected; compliance case opened.", "ปฏิเสธแล้ว เปิดเรื่องที่ฝ่ายกำกับ"); setTimeout(render, 0); } return heldOutcome; } }),
  decideApp: (kind) => ({ title: kind === "approve" ? tt("Approve APP-30413", "อนุมัติ APP-30413") : tt("Decline APP-30413", "ปฏิเสธ APP-30413"), sub: "Napat Srisuk · " + baht(APP.amount, 0), init: {},
    fields: () => kind === "approve" ? `<p class="muted">${esc(tt("Condition: proof of address before disbursement.", "เงื่อนไข: หลักฐานที่อยู่ก่อนจ่ายเงิน"))}</p>` : select("dreason", tt("Main reason", "เหตุผลหลัก"), [["dsr", tt("Debt service too high", "ภาระหนี้สูงเกินไป")], ["docs", tt("Documents not provided", "ไม่ได้ส่งเอกสาร")], ["policy", tt("Outside credit policy", "อยู่นอกนโยบายสินเชื่อ")]], "docs"),
    read: () => "",
    review: () => ({ html: `<p class="consequence">${kind === "approve" ? tt(`Approves <b>${baht(APP.amount)}</b> over ${APP.n} months at ${(APP.flat * 100).toFixed(2)}% flat. Bangna Motors is told within a minute; the cost-of-credit disclosure goes to the applicant to sign.`, `อนุมัติ <b>${baht(APP.amount)}</b> ${APP.n} เดือน ดอกเบี้ยคงที่ ${(APP.flat * 100).toFixed(2)}% แจ้งบางนา มอเตอร์สภายในหนึ่งนาที และส่งเอกสารเปิดเผยต้นทุนสินเชื่อให้ผู้สมัครลงนาม`) : tt("Declines the application and tells the applicant the main reason, as the BOT's responsible lending rules require.", "ปฏิเสธใบสมัครและแจ้งเหตุผลหลักให้ผู้สมัครตามหลักการให้สินเชื่ออย่างรับผิดชอบของ ธปท.")}</p>`, confirm: kind === "approve" ? tt("Approve", "อนุมัติ") : tt("Decline", "ปฏิเสธ"), auth: kind === "approve" ? ["credit", APP.amount] : null }),
    done: (d) => { if (!d.applied) { d.applied = true; appDecision = kind !== "approve" ? tt("Declined; the applicant was told the main reason.", "ปฏิเสธแล้ว แจ้งเหตุผลหลักให้ผู้สมัคร") : d.auth && !d.auth.ok ? tt(`Approval sent to the ${d.auth.second.toLowerCase()}.`, `ส่งการอนุมัติให้${t(d.auth.second)}แล้ว`) : tt("Approved with one condition.", "อนุมัติพร้อมเงื่อนไขหนึ่งข้อ"); setTimeout(render, 0); } return appDecision; } }),
  disburseApp: () => ({ title: tt("Disburse to the dealer", "จ่ายเงินให้ดีลเลอร์"), sub: "APP-30413 → HP-2026-004913", init: {}, fields: () => kvHtml([["To", "CUR-D0007"], [t("Amount"), baht(APP.amount)]]), read: () => "",
    review: () => ({ html: `<p class="consequence">${tt(`Pays <b>${baht(APP.amount)}</b> to Bangna Motors, opens contract HP-2026-004913 with 60 instalments, and pays the dealer's 2.00% commission of <b>${baht(APP.amount * 0.02)}</b> at month end.`, `จ่าย <b>${baht(APP.amount)}</b> ให้บางนา มอเตอร์ส เปิดสัญญา HP-2026-004913 จำนวน 60 งวด และจ่ายค่าคอมมิชชัน 2.00% <b>${baht(APP.amount * 0.02)}</b> ให้ดีลเลอร์ตอนสิ้นเดือน`)}</p>`, confirm: tt("Disburse", "จ่ายเงิน"), auth: ["payout", APP.amount] }),
    done: () => tt("Paid. Contract HP-2026-004913 is open.", "จ่ายแล้ว เปิดสัญญา HP-2026-004913") }),
  resolveExc: (i) => { const x = EXC[+i]; return { title: tt("Resolve exception", "แก้ไขรายการ"), sub: x[2], init: { how: "fixed", note: "" },
    fields: (d) => select("xhow", tt("Resolution", "วิธีแก้ไข"), [["fixed", tt("Fixed at the source", "แก้ที่ต้นทางแล้ว")], ["matched", tt("Matched or adjusted", "จับคู่หรือปรับปรุงแล้ว")], ["accepted", tt("Accepted as is, with a reason", "ยอมรับตามสภาพ พร้อมเหตุผล")]], d.how) + area("xnote", tt("What was done", "สิ่งที่ทำ"), d.note, tt("Kept with the exception in the audit trail.", "เก็บไว้กับรายการในประวัติการตรวจสอบ")),
    read: (d) => { d.how = $("#xhow").value; d.note = $("#xnote").value.trim(); return d.note ? "" : tt("Say what was done.", "ระบุสิ่งที่ทำ"); },
    review: () => ({ html: `<p class="consequence">${tt(`Closes “${esc(x[2])}” for ${esc(x[4])}. If the same check fails again, a new exception opens and links to this one.`, `ปิดรายการ “${esc(x[2])}” ของ ${esc(x[4])} หากการตรวจเดิมไม่ผ่านอีก จะเปิดรายการใหม่และเชื่อมกับรายการนี้`)}</p>`, confirm: tt("Resolve", "แก้ไข") }),
    done: (d) => { if (!d.applied) { d.applied = true; resolvedExc.add(+i); setTimeout(render, 0); } return tt("Resolved and recorded.", "แก้ไขและบันทึกแล้ว"); } }; },
  tdInstruction: () => ({ title: tt("Change maturity instruction", "เปลี่ยนคำสั่งเมื่อครบกำหนด"), sub: "TD-88140 · Siam Energy PCL", init: { how: "pay" },
    fields: (d) => select("tdhow", tt("At maturity", "เมื่อครบกำหนด"), [["pay", tt("Pay principal and interest to CUR-SE01", "โอนเงินต้นและดอกเบี้ยเข้า CUR-SE01")], ["roll", tt("Roll over principal for 6 months at 2.35%", "ฝากต่อเงินต้น 6 เดือน อัตรา 2.35%")], ["rollall", tt("Roll over principal and interest at 2.35%", "ฝากต่อเงินต้นและดอกเบี้ย อัตรา 2.35%")]], d.how) + `<p class="hint muted">${esc(tt("Customer instruction received by RM email; the signed form is attached.", "ได้รับคำสั่งลูกค้าทางอีเมลผ่าน RM แนบแบบฟอร์มที่ลงนามแล้ว"))}</p>`,
    read: (d) => { d.how = $("#tdhow").value; return ""; },
    review: (d) => ({ html: `<p class="consequence">${d.how === "pay" ? tt("Keeps the current instruction: on <b>29 Oct</b> principal and net interest go to CUR-SE01.", "คงคำสั่งเดิม: วันที่ <b>29 ต.ค.</b> โอนเงินต้นและดอกเบี้ยสุทธิเข้า CUR-SE01") : tt(`On <b>29 Oct</b> a new 6-month deposit opens at <b>2.35%</b>${d.how === "rollall" ? " with the interest added" : " and the net interest goes to CUR-SE01"}. Treasury's funding forecast is updated now.`, `วันที่ <b>29 ต.ค.</b> เปิดเงินฝากใหม่ 6 เดือน อัตรา <b>2.35%</b>${d.how === "rollall" ? " รวมดอกเบี้ย" : " และโอนดอกเบี้ยสุทธิเข้า CUR-SE01"} ปรับประมาณการเงินทุนของฝ่ายบริหารเงินทันที`)}</p>`, confirm: tt("Save instruction", "บันทึกคำสั่ง") }),
    done: () => tt("Maturity instruction saved.", "บันทึกคำสั่งแล้ว") }),
  fxDeal: () => ({ title: tt("New FX deal", "ดีล FX ใหม่"), sub: tt("Treasury dealing · spot", "ห้องค้าเงิน · ส่งมอบทันที"), init: { side: "sell", ccy: "USD", amt: 2400000 },
    fields: (d) => select("fside", tt("We", "ธนาคาร"), [["sell", tt("Sell to customer", "ขายให้ลูกค้า")], ["buy", tt("Buy from customer", "ซื้อจากลูกค้า")]], d.side) + select("fccy", t("Currency"), [["USD", "USD · 36.0000 / 36.0800"], ["JPY", "JPY · 0.2410 / 0.2425"], ["EUR", "EUR · 39.1500 / 39.2600"]], d.ccy) + money("famt", d.amt, t("Amount"), tt("Customer: Siam Freight Logistics.", "ลูกค้า: สยามเฟรท โลจิสติกส์")),
    read: (d) => { d.side = $("#fside").value; d.ccy = $("#fccy").value; const v = parseMoney($("#famt").value); if (isNaN(v) || v <= 0) return tt("Enter an amount.", "ใส่จำนวนเงิน"); d.amt = v; return ""; },
    review: (d) => { const q = { USD: [36.0, 36.08, 12.4, 25], JPY: [0.241, 0.2425, 288 * 0.0067, 500 * 0.0067], EUR: [39.15, 39.26, 1.1, 5] }[d.ccy], rate = d.side === "sell" ? q[1] : q[0], thb = r2(d.amt * rate);
      const usdEq = d.ccy === "USD" ? d.amt / 1e6 : d.ccy === "JPY" ? d.amt * 0.0067 / 1e6 : d.amt * 1.08 / 1e6, after = r2(q[2] + (d.side === "sell" ? -usdEq : usdEq)), over = Math.abs(after) > 25;
      return { html: quoteRows([[tt("Rate", "อัตรา"), rate.toFixed(4)], [tt("Value date", "วันส่งมอบ"), fd(Date.UTC(2026, 9, 28))], [tt("Open position after, $m", "ฐานะเปิดหลังดีล ล้านดอลลาร์"), after.toFixed(2)], [tt("THB amount", "จำนวนบาท"), baht(thb)]]) +
        (over ? notice("crit", tt("Over the $25m open position limit", "เกินวงเงินฐานะเปิด $25m"), tt("Cover the position first or ask the head of dealing.", "ปิดฐานะก่อนหรือขออนุมัติหัวหน้าห้องค้า")) : `<p class="consequence">${tt(`Books a spot deal: the bank ${d.side === "sell" ? "sells" : "buys"} <b>${d.amt.toLocaleString("en-US")} ${d.ccy}</b> at <b>${rate.toFixed(4)}</b>, settling <b>${baht(thb)}</b> against CUR-B2031 on 28 Oct.`, `บันทึกดีลส่งมอบทันที ธนาคาร${d.side === "sell" ? "ขาย" : "ซื้อ"} <b>${d.amt.toLocaleString("en-US")} ${d.ccy}</b> ที่ <b>${rate.toFixed(4)}</b> ชำระ <b>${baht(thb)}</b> กับ CUR-B2031 วันที่ 28 ต.ค.`)}</p>`), blocked: over, confirm: tt("Book deal", "บันทึกดีล"), auth: ["fx", thb] }; },
    done: () => tt("Deal FX-26-10-0927 booked and sent for confirmation.", "บันทึกดีล FX-26-10-0927 และส่งยืนยันแล้ว") }),
  restructure: () => ({ title: tt("Propose a restructuring", "เสนอปรับโครงสร้างหนี้"), sub: tt("Drafted by Copilot for LN-A-C10", "ร่างโดย Copilot สำหรับ LN-A-C10"), init: { term: "18" },
    fields: (d) => select("rterm", t("Term"), [["12", tt("12 months", "12 เดือน")], ["18", tt("18 months", "18 เดือน")], ["24", tt("24 months", "24 เดือน")]], d.term) + `<p class="hint muted">${esc(tt(`Capitalises the settlement balance of ${baht(LOAN.total)} at 15.00% from Nov 2026.`, `ทบยอด ${baht(LOAN.total)} เป็นเงินต้น ดอกเบี้ย 15.00% เริ่ม พ.ย. 2569`))}</p>`,
    read: (d) => { d.term = $("#rterm").value; return ""; },
    review: (d) => { const n = +d.term, r = 0.0125, pmt = r2(LOAN.total * r / (1 - Math.pow(1 + r, -n))); return { html: quoteRows([[tt("New principal", "เงินต้นใหม่"), baht(LOAN.total)], [t("Term"), tt(`${n} months`, `${n} เดือน`)], [tt("New instalment", "ค่างวดใหม่"), baht(pmt)]]) + `<p class="consequence">${tt(`Sends the proposal to a credit officer. If approved, the loan is modified under TFRS 9 and stays in Stage 3 until it has paid on time for <b>3 consecutive months or 3 instalments</b>, whichever is longer.`, `ส่งข้อเสนอให้เจ้าหน้าที่สินเชื่อ หากอนุมัติ สัญญาจะถูกปรับตาม TFRS 9 และอยู่ใน Stage 3 จนชำระตรงเวลา <b>3 เดือนติดต่อกันหรือ 3 งวด</b> แล้วแต่อย่างใดนานกว่า`)}</p>`, confirm: tt("Send to credit officer", "ส่งให้เจ้าหน้าที่สินเชื่อ") }; },
    done: () => tt("Sent to Wanida K. as AP-1190.", "ส่งให้วนิดา ก. แล้ว เลขที่ AP-1190") }),
};
function openFlow(name, arg) { const f = FLOWS[name](arg); dlg = { flow: f, step: 0, ref: "IDEM-" + Math.random().toString(16).slice(2, 10).toUpperCase(), error: "", ...f.init }; renderDialog(); }
// the review step says whether this person may do it alone, and who approves when they may not
function authNote(a) {
  return a.ok
    ? `<div class="auth ok">${icon("i-shield")}<span>${esc(tt(`Within your authority: ${a.name.toLowerCase()} up to ${baht(a.lim, 0)} as ${role.title.toLowerCase()}.`, `อยู่ในอำนาจของคุณ: ${t(a.name)} ไม่เกิน ${baht(a.lim, 0)} ในฐานะ${t(role.title)}`))}</span></div>`
    : `<div class="auth over">${icon("i-shield")}<span>${esc(tt(`Needs a second approver: the ${a.second.toLowerCase()}. Your limit for ${a.name.toLowerCase()} is ${baht(a.lim, 0)}.`, `ต้องมีผู้อนุมัติคนที่สอง: ${t(a.second)} วงเงินของคุณสำหรับ${t(a.name)}คือ ${baht(a.lim, 0)}`))}</span></div>`;
}
function renderFlow() {
  const d = dlg, f = d.flow;
  const steps = ["Enter", "Review and confirm", "Done"].map((l, i) => `<span class="step ${i === d.step ? "on" : i < d.step ? "done" : ""}"><b>${i < d.step ? "✓" : i + 1}</b>${esc(t(l))}</span>`).join("");
  const idem = `<span class="idem" title="Kept if you retry, so nothing posts twice">${esc(d.ref)}</span>`;
  let body, foot;
  if (d.step === 0) {
    body = f.fields(d) + (d.error ? `<p class="err" id="flowErr" role="alert" style="color:var(--crit);font-weight:500">${esc(d.error)}</p>` : "");
    foot = `${idem}<button class="btn" type="button" data-dlg="close">${esc(t("Cancel"))}</button><button class="btn primary" type="button" data-dlg="next">${esc(t("Next"))}</button>`;
  } else if (d.step === 1) {
    const r = f.review(d);
    d.auth = r.auth && !r.blocked ? authCheck(...r.auth) : null;
    if (d.auth && !d.auth.ok) r.confirm = tt(`Send to ${d.auth.second}`, `ส่งให้${t(d.auth.second)}`);
    body = r.html + (d.auth ? authNote(d.auth) : "") + (r.typed && !r.blocked ? `<div class="field"><label for="confirmId">${esc(tt(`Type ${r.typed} to confirm`, `พิมพ์ ${r.typed} เพื่อยืนยัน`))}</label><input class="input" id="confirmId" autocomplete="off" spellcheck="false"><span class="hint">${esc(tt("This cannot be undone.", "ย้อนกลับไม่ได้"))}</span></div>` : "");
    foot = `${idem}<button class="btn" type="button" data-dlg="back">${esc(t("Back"))}</button><button class="btn primary" type="button" id="dlgConfirm" data-dlg="confirm" data-typed="${esc(r.typed || "")}" ${r.blocked || r.typed ? "disabled" : ""}>${esc(r.confirm || "Confirm")}</button>`;
  } else {
    const doneText = f.done(d); // always run: flows record their outcome here
    body = notice("good", d.auth && !d.auth.ok ? tt(`Sent to the ${d.auth.second.toLowerCase()} for approval. It happens once they approve.`, `ส่งให้${t(d.auth.second)}อนุมัติแล้ว รายการจะเกิดขึ้นเมื่ออนุมัติ`) : doneText, t("Nothing was posted: this is a concept."));
    foot = `${idem}<button class="btn primary" type="button" data-dlg="close">${esc(t("Close"))}</button>`;
  }
  $("#dialogHost").innerHTML = `<div class="overlay center"><div class="sheet dialog" role="dialog" aria-modal="true" aria-labelledby="dlgT">
    <div class="dlg-head"><div style="min-width:0"><h2 id="dlgT">${esc(f.title)}</h2><p>${esc(f.sub)}</p></div><button class="icon-btn" type="button" data-dlg="close" aria-label="${esc(t("Close"))}" style="margin-left:auto">${icon("i-close")}</button></div>
    <div class="steps" aria-label="Steps">${steps}</div><div class="dlg-body">${body}</div><div class="dlg-foot">${foot}</div></div></div>`;
  ($("#dialogHost .dlg-body input, #dialogHost .dlg-body select, #dialogHost .dlg-body textarea") || $("#dialogHost .dlg-foot .btn.primary:not([disabled])") || $("#dialogHost [data-dlg=close]")).focus();
}

function renderDialog() {
  if (!dlg) return;
  if (dlg.flow) return renderFlow();
  const L = LOAN, d = dlg;
  const titles = { settle: ["Settle early", lang === "th" ? "ปิด LN-A-C10 ทั้งหมดวันนี้" : "Close LN-A-C10 in full today"], pay: ["Take payment", lang === "th" ? "รับชำระเข้า LN-A-C10" : "Pay toward LN-A-C10"], promise: ["Record promise", lang === "th" ? "นัดชำระของคุณสมชาย" : "A promise from Somchai Prasert"] };
  const steps = ["Enter", "Review and confirm", "Done"].map((l, i) => `<span class="step ${i === d.step ? "on" : i < d.step ? "done" : ""}"><b>${i < d.step ? "✓" : i + 1}</b>${esc(t(l))}</span>`).join("");
  let body = "", foot = "";
  const idem = `<span class="idem" title="Kept if you retry, so nothing posts twice">${esc(d.ref)}</span>`;
  if (d.step === 2) {
    const done = { settle: d.auth && !d.auth.ok ? tt(`Sent to the ${d.auth.second.toLowerCase()} for approval.`, `ส่งให้${t(d.auth.second)}อนุมัติแล้ว`) : lang === "th" ? "ปิดบัญชี LN-A-C10 แล้ว ใบเสร็จ RC-2026-104233" : "LN-A-C10 is settled. Receipt RC-2026-104233.", pay: lang === "th" ? `รับชำระ ${baht(d.amount)} จาก SAV-C10 แล้ว` : `${baht(d.amount)} taken from SAV-C10 and applied.`, promise: lang === "th" ? `บันทึกนัดชำระ ${baht(d.promise)} แล้ว` : `Promise of ${baht(d.promise)} recorded.` }[d.kind];
    body = `<div class="alert good" role="status">${icon("i-check")}<div><strong>${esc(done)}</strong><p>${esc(t("Nothing was posted: this is a concept."))}</p></div></div>`;
    foot = `${idem}<button class="btn primary" type="button" data-dlg="close">${esc(t("Close"))}</button>`;
  } else if (d.kind === "settle") {
    const short = d.from === "sav" ? r2(L.total - L.sav) : 0;
    if (d.step === 0) {
      body = `<div class="field"><span class="lbl">${esc(t("Settlement date"))}</span><span class="static">${esc(fd(BIZ))}</span><span class="hint">${esc(t("The quote is valid for today only."))}</span></div>
        <fieldset class="field"><legend>${esc(t("Pay from"))}</legend><div class="radio-list">
          <label class="radio-card"><input type="radio" name="from" value="sav" ${d.from === "sav" ? "checked" : ""}><span><b>SAV-C10</b><small>${esc(lang === "th" ? "บัญชีออมทรัพย์ของคุณสมชาย · คงเหลือ " : "Somchai Prasert's savings · balance ")}${baht(L.sav)}</small></span></label>
          <label class="radio-card"><input type="radio" name="from" value="branch" ${d.from === "branch" ? "checked" : ""}><span><b>${esc(t("Cash or transfer at a branch"))}</b><small>${esc(t("Received by the teller against a receipt"))}</small></span></label></div></fieldset>`;
      foot = `${idem}<button class="btn" type="button" data-dlg="close">${esc(t("Cancel"))}</button><button class="btn primary" type="button" data-dlg="next">${esc(t("Next"))}</button>`;
    } else {
      const quote = `<div class="quote"><span>${esc(t("Principal outstanding"))}</span><span class="num">${baht(L.principalOut)}</span><span>${esc(t("Interest billed, unpaid"))}</span><span class="num">${baht(L.billedInterest)}</span><span>${esc(t("Interest since 2 Oct"))}</span><span class="num">${baht(L.accrued)}</span><span>${esc(t("Default interest on overdue principal"))}</span><span class="num">${baht(L.defaultInterest)}</span><span class="total">${esc(t("Total to settle"))}</span><span class="total num">${baht(L.total)}</span></div>`;
      if (short > 0) {
        body = quote + `<div class="alert crit" role="alert">${icon("i-alert")}<div><strong>${esc(lang === "th" ? `SAV-C10 มีเงินไม่พอ ขาดอีก ${baht(short)}` : `SAV-C10 is ${baht(short)} short`)}</strong><p>${esc(lang === "th" ? `บัญชีมี ${baht(L.sav)} ให้ย้อนกลับไปเลือกชำระที่สาขา หรือใช้รับชำระบางส่วนแทน` : `It holds ${baht(L.sav)}. Go back and choose a branch payment, or take a part payment instead.`)}</p></div></div>`;
        foot = `${idem}<button class="btn" type="button" data-dlg="back">${esc(t("Back"))}</button><button class="btn primary" type="button" disabled>${esc(t("Confirm settlement"))}</button>`;
      } else {
        d.auth = authCheck("settle", L.total);
        body = quote + authNote(d.auth) + `<p class="consequence">${lang === "th" ? `ปิดบัญชี LN-A-C10 รับเงิน <b>${baht(L.total)}</b> ที่สาขา สัญญาจะปิด งวดที่เหลือ 5 งวดถูกยกเลิก และคืนรถ A4 ให้ลูกค้า` : `Settles LN-A-C10. <b>${baht(L.total)}</b> is received at the branch. The loan closes, the 5 unbilled instalments are cancelled, and vehicle A4 is released back to the customer.`}</p>
          <div class="field"><label for="confirmId">${esc(lang === "th" ? "พิมพ์ LN-A-C10 เพื่อยืนยัน" : "Type LN-A-C10 to confirm")}</label><input class="input" id="confirmId" autocomplete="off" spellcheck="false"><span class="hint">${esc(lang === "th" ? "ปิดบัญชีแล้วย้อนกลับไม่ได้" : "Settlement cannot be undone.")}</span></div>`;
        foot = `${idem}<button class="btn" type="button" data-dlg="back">${esc(t("Back"))}</button><button class="btn primary" type="button" id="dlgConfirm" data-dlg="confirm" data-typed="LN-A-C10" disabled>${esc(d.auth.ok ? t("Confirm settlement") : tt(`Send to ${d.auth.second}`, `ส่งให้${t(d.auth.second)}`))}</button>`;
      }
    }
  } else if (d.kind === "pay") {
    if (d.step === 0) {
      body = `<div class="field"><label for="amt">${esc(t("Amount"))}</label><input class="input money" id="amt" inputmode="decimal" value="${esc(d.amount.toLocaleString("en-US", { minimumFractionDigits: 2 }))}" ${d.error ? 'aria-invalid="true" aria-describedby="amtErr"' : ""}>
        <span class="hint">${esc(lang === "th" ? `ค้างชำระตอนนี้ ${baht(L.overdue)} · SAV-C10 มี ${baht(L.sav)}` : `Overdue now ${baht(L.overdue)} · SAV-C10 holds ${baht(L.sav)}`)}</span>${d.error ? `<span class="err" id="amtErr">${esc(d.error)}</span>` : ""}</div>
        <div class="field"><span class="lbl">${esc(t("Pay from"))}</span><span class="static">SAV-C10</span></div>`;
      foot = `${idem}<button class="btn" type="button" data-dlg="close">${esc(t("Cancel"))}</button><button class="btn primary" type="button" data-dlg="next">${esc(t("Next"))}</button>`;
    } else {
      let left = d.amount, k = 0; for (const r of L.late) { if (left + 1e-9 >= r.amount) { left = r2(left - r.amount); k++; } else break; }
      const clears = k === L.late.length;
      const lateAfter = clears ? 0 : L.daysLate(L.late[k].due);
      const after = r2(L.sav - d.amount);
      const en = clears ? `Takes <b>${baht(d.amount)}</b> from SAV-C10, leaving <b>${baht(after)}</b>. Clears all five overdue instalments, so the loan is no longer late. Default interest of <b>${baht(L.defaultInterest)}</b> stays due with the next instalment.`
        : `Takes <b>${baht(d.amount)}</b> from SAV-C10, leaving <b>${baht(after)}</b>. Pays ${k ? `instalments 6 to ${5 + k} in full and ` : ""}<b>${baht(left)}</b> toward instalment ${6 + k}. The loan stays late, now <b>${lateAfter} days</b>.`;
      const th = clears ? `ตัดเงิน <b>${baht(d.amount)}</b> จาก SAV-C10 คงเหลือ <b>${baht(after)}</b> ชำระงวดค้างครบทั้ง 5 งวด สัญญาไม่ค้างชำระแล้ว ดอกเบี้ยผิดนัด <b>${baht(L.defaultInterest)}</b> เรียกเก็บพร้อมงวดถัดไป`
        : `ตัดเงิน <b>${baht(d.amount)}</b> จาก SAV-C10 คงเหลือ <b>${baht(after)}</b> ${k ? `ชำระงวดที่ 6 ถึง ${5 + k} ครบ และ` : ""}ชำระ <b>${baht(left)}</b> เข้างวดที่ ${6 + k} สัญญายังค้างชำระ <b>${lateAfter} วัน</b>`;
      body = `<p class="consequence">${lang === "th" ? th : en}</p>`;
      foot = `${idem}<button class="btn" type="button" data-dlg="back">${esc(t("Back"))}</button><button class="btn primary" type="button" data-dlg="confirm">${esc(t("Confirm payment"))}</button>`;
    }
  } else {
    if (d.step === 0) {
      body = `<div class="field"><label for="pamt">${esc(t("Amount"))}</label><input class="input money" id="pamt" inputmode="decimal" value="${esc(d.promise.toLocaleString("en-US", { minimumFractionDigits: 2 }))}" ${d.error ? 'aria-invalid="true" aria-describedby="pErr"' : ""}>${d.error ? `<span class="err" id="pErr">${esc(d.error)}</span>` : ""}</div>
        <div class="field"><label for="pby">${esc(t("Pay by"))}</label><input class="input" id="pby" type="date" min="2026-10-24" max="2026-11-23" value="${esc(d.by)}"><span class="hint">${esc(lang === "th" ? "ไม่เกิน 30 วันตามนโยบาย" : "Up to 30 days ahead, by policy.")}</span></div>
        <div class="field"><label for="pch">${esc(t("How it was made"))}</label><select class="input" id="pch">${["Call", "Branch visit", "LINE chat"].map((c) => `<option value="${c}" ${c === d.channel ? "selected" : ""}>${esc(t(c))}</option>`).join("")}</select></div>`;
      foot = `${idem}<button class="btn" type="button" data-dlg="close">${esc(t("Cancel"))}</button><button class="btn primary" type="button" data-dlg="next">${esc(t("Next"))}</button>`;
    } else {
      const by = fd(Date.parse(d.by + "T00:00:00Z"));
      body = `<p class="consequence">${lang === "th" ? `บันทึกนัดชำระ <b>${baht(d.promise)}</b> ภายใน <b>${esc(by)}</b> ผ่าน${esc(t(d.channel))} งานติดตามจะหยุดแจ้งเตือนจนถึงวันนั้น และตรวจผลในวันถัดไป` : `Records a promise of <b>${baht(d.promise)}</b> by <b>${esc(by)}</b>, made by ${esc(t(d.channel).toLowerCase())}. Reminders pause until then; the promise is checked the next morning and marked kept or broken.`}</p>`;
      foot = `${idem}<button class="btn" type="button" data-dlg="back">${esc(t("Back"))}</button><button class="btn primary" type="button" data-dlg="confirm">${esc(t("Record the promise"))}</button>`;
    }
  }
  $("#dialogHost").innerHTML = `<div class="overlay center"><div class="sheet dialog" role="dialog" aria-modal="true" aria-labelledby="dlgT">
    <div class="dlg-head"><div style="min-width:0"><h2 id="dlgT">${esc(t(titles[d.kind][0]))}</h2><p>${esc(titles[d.kind][1])}</p></div><button class="icon-btn" type="button" data-dlg="close" aria-label="${esc(t("Close"))}" style="margin-left:auto">${icon("i-close")}</button></div>
    <div class="steps" aria-label="Steps">${steps}</div><div class="dlg-body">${body}</div><div class="dlg-foot">${foot}</div></div></div>`;
  ($("#dialogHost input:not([type=radio])") || $("#dialogHost input:checked") || $("#dialogHost .dlg-foot .btn.primary:not([disabled])") || $("#dialogHost [data-dlg=close]")).focus();
}
function dialogAction(a) {
  const d = dlg; if (!d) return;
  if (a === "close") return closeDialog();
  if (a === "back") { d.step = 0; d.error = ""; return renderDialog(); }
  if (a === "confirm") { d.step = 2; return renderDialog(); }
  if (a === "next" && d.flow) { d.error = d.flow.read(d) || ""; if (!d.error) d.step = 1; return renderDialog(); }
  if (a === "next") {
    if (d.kind === "pay") {
      const v = parseMoney($("#amt").value);
      d.error = isNaN(v) || v <= 0 ? (lang === "th" ? "ใส่จำนวนเงินเป็นบาท เช่น 6,268.16" : "Enter an amount in baht, for example 6,268.16.")
        : v > LOAN.sav ? (lang === "th" ? `SAV-C10 มีเพียง ${baht(LOAN.sav)}` : `SAV-C10 holds only ${baht(LOAN.sav)}.`) : v > LOAN.total ? (lang === "th" ? `เกินยอดปิดบัญชี ${baht(LOAN.total)}` : `That is more than the settlement of ${baht(LOAN.total)}.`) : "";
      if (!isNaN(v)) d.amount = v;
    }
    if (d.kind === "promise") {
      const v = parseMoney($("#pamt").value);
      d.error = isNaN(v) || v <= 0 ? (lang === "th" ? "ใส่จำนวนเงินเป็นบาท" : "Enter an amount in baht.") : "";
      if (!isNaN(v)) d.promise = v;
      d.by = $("#pby").value || d.by; d.channel = $("#pch").value;
    }
    if (!d.error) d.step = 1;
    renderDialog();
  }
}

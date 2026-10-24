// Fabor console prototype · Side panels, sign-in, tour, live feel, shell rendering and events. Starts the app.
// Classic scripts sharing one global scope; load order is set in index.html.
/* ---------------- side panels: Copilot and notifications ---------------- */
const chat = {};
let notesUnread = true;
// one grounded question for every system, so Copilot helps on every page
const SYSQ = {
  customers: ["Who needs a KYC review first?", "ใครต้องทบทวน KYC ก่อน", "Pacific Import Trading: an adverse media hit makes it high risk and it is due tomorrow. Compliance owns it; the three others are low or medium risk.", "Pacific Import Trading มีข่าวเชิงลบ ความเสี่ยงสูงและครบกำหนดพรุ่งนี้ ฝ่ายกำกับรับผิดชอบ อีกสามรายความเสี่ยงต่ำหรือกลาง", ["KYC reviews"]],
  branch: ["How is my drawer?", "ลิ้นชักของฉันเป็นอย่างไร", `It holds ${baht(drawerTotal)}, balanced at the 12:00 count and below the ฿500,000.00 limit. Above ฿400,000 send the excess to the vault.`, `มีเงินสด ${baht(drawerTotal)} ยอดตรงเมื่อนับ 12:00 ต่ำกว่าวงเงิน ฿500,000.00 หากเกิน ฿400,000 ให้ส่งเข้าห้องมั่นคง`, ["Cash drawer"]],
  deposits: ["Which term deposits mature this week?", "เงินฝากประจำใดครบสัปดาห์นี้", "TD-88102 (Pornthip Saelee, ฿500,000) rolls over on 27 Oct; TD-88140 (Siam Energy, ฿120,000,000) pays to current on 29 Oct, the one to watch for liquidity.", "TD-88102 (พรทิพย์ ฿500,000) ฝากต่อ 27 ต.ค. TD-88140 (สยามเอนเนอร์ยี ฿120,000,000) โอนเข้ากระแสรายวัน 29 ต.ค. ควรเฝ้าดูสภาพคล่อง", ["Term deposits"]],
  lending: ["What is driving the NPL ratio?", "อะไรทำให้ NPL เพิ่ม", "Personal loans: three loans passed 90 days this month, including LN-A-C10 and LN-A-C14. Home and SME books are flat.", "สินเชื่อส่วนบุคคล มี 3 สัญญาเกิน 90 วันในเดือนนี้ รวม LN-A-C10 และ LN-A-C14 พอร์ตบ้านและ SME คงที่", ["Loans", "NPL ratio"]],
  leasing: ["Which dealer is closest to its limit?", "ดีลเลอร์รายใดใกล้เต็มวงเงิน", "Bangna Motors at 92% of its group limit, with one sold unit on FP-DEMO waiting for payoff. Rama 9 Trucks is at 71% but has a payoff overdue on FP-2026-0011.", "บางนา มอเตอร์ส ใช้ 92% ของวงเงินรวม มีรถขายแล้วรอชำระคืนใน FP-DEMO 1 คัน พระราม 9 ทรัคส์ ใช้ 71% แต่ค้างชำระคืนใน FP-2026-0011", ["Floor plan", "Dealers"]],
  payments: ["Why is there an ITMX break?", "ทำไมมีรายการ ITMX ไม่ตรง", "One PromptPay credit of ฿4,200.00 in the 05:00 file has no matching ledger entry; the reconciliation agent matched it to a delayed posting on SAV-C14 and is waiting for a checker.", "รายการพร้อมเพย์เข้า ฿4,200.00 ในไฟล์ 05:00 ไม่มีรายการบัญชีคู่ เอเจนต์กระทบยอดจับคู่กับรายการล่าช้าของ SAV-C14 แล้ว รอผู้ตรวจ", ["Reconciliation"]],
  trade: ["Which LCs need action?", "LC ใดต้องดำเนินการ", "LC-26-0412 has a discrepant insurance certificate and must be answered by 29 Oct; LC-26-0418 has discrepant documents too.", "LC-26-0412 ใบรับรองประกันไม่ตรง ต้องตอบภายใน 29 ต.ค. LC-26-0418 มีเอกสารไม่ตรงเช่นกัน", ["Letters of credit"]],
  treasury: ["Can we take the $2.4m for the Hino LC?", "รับดีล $2.4m สำหรับ LC Hino ได้ไหม", "Yes: selling $2.4m takes the USD open position from $12.4m to $10.0m, inside the $25m limit. LCR stays near 148%.", "ได้ การขาย $2.4m ทำให้ฐานะ USD จาก $12.4m เหลือ $10.0m อยู่ในวงเงิน $25m และ LCR ยังใกล้ 148%", ["FX positions", "Liquidity"]],
  syndication: ["What fees are due soon?", "ค่าธรรมเนียมใดใกล้ครบ", "฿6,000,000 commitment fee on SYN-001 on 1 Nov and the ฿1,500,000 agency fee on SYN-004 on 15 Nov.", "ค่าธรรมเนียมผูกพัน ฿6,000,000 ของ SYN-001 วันที่ 1 พ.ย. และค่าตัวแทน ฿1,500,000 ของ SYN-004 วันที่ 15 พ.ย.", ["Fees"]],
  products: ["What is waiting in the factory?", "อะไรรออยู่ในโรงงานผลิตภัณฑ์", "AUTO_HP_USED v2 needs Compliance, SAVINGS_STD v2 needs Finance and Compliance, and EV_HP_NEW has not been simulated yet.", "AUTO_HP_USED v2 รอฝ่ายกำกับ SAVINGS_STD v2 รอการเงินและฝ่ายกำกับ และ EV_HP_NEW ยังไม่ได้จำลอง", ["Approvals", "Product Studio"]],
  finance: ["Is the ledger in balance?", "บัญชีสมดุลไหม", "Yes: debits equal credits for every posting today, and every sub-ledger matches the GL except ฿4,200.00 in suspense 2990 from the ITMX break.", "สมดุล ทุกรายการวันนี้เดบิตเท่ากับเครดิต บัญชีย่อยตรงกับ GL ยกเว้น ฿4,200.00 ในบัญชีพัก 2990 จากรายการ ITMX", ["Sub-ledger vs GL"]],
  ops: ["Is anything stuck?", "มีงานค้างไหม", "Two dead letters: capitalisation on dormant SAV-P9 failed five times. The queue is otherwise drained and posting p99 is 18 ms.", "มีงานล้มเหลว 2 รายการ: การทบต้นของ SAV-P9 ที่ไม่เคลื่อนไหวล้มเหลว 5 ครั้ง นอกนั้นคิวว่าง และเวลาบันทึก p99 อยู่ที่ 18 ms", ["Scheduler"]],
  agents: ["What did the agents do today?", "วันนี้เอเจนต์ทำอะไร", "Two proposals wait for a checker (a restructuring and an ITMX match); the promise plans for 214 accounts were escalated to a supervisor by policy.", "มี 2 ข้อเสนอรอผู้ตรวจ (ปรับโครงสร้างหนี้และจับคู่ ITMX) แผนนัดชำระ 214 บัญชีถูกส่งต่อให้หัวหน้าตามนโยบาย", ["Activity"]],
  admin: ["Any integration problems?", "การเชื่อมต่อมีปัญหาไหม", "DOPA ID checks have a 1.20% error rate today, above the usual 0.3%. Everything else is normal.", "การตรวจบัตรกับกรมการปกครองผิดพลาด 1.20% วันนี้ สูงกว่าปกติ 0.3% นอกนั้นปกติ", ["Integrations"]],
  analytics: ["Why is the Q2 vintage worse?", "ทำไมวินเทจไตรมาส 2 แย่กว่า", "Most of the extra arrears come from loans opened online with income checked by statement upload. Their 30-to-60 roll rate is 26%, against 18% for branch loans.", "ยอดค้างส่วนเกินส่วนใหญ่มาจากสัญญาที่เปิดออนไลน์และตรวจรายได้จากการอัปโหลดรายการเดินบัญชี อัตราไหล 30 → 60 วันอยู่ที่ 26% เทียบกับ 18% ของสาขา", ["Vintage", "Roll rates"]],
  compliance: ["Which alert should I take first?", "ควรรับการแจ้งเตือนไหนก่อน", `AML-ALR-7712: nine cash deposits of ${baht(AML_TOTAL, 0)} just under the report threshold, from a customer already rated high risk. It is open as case AML-2026-0418.`, `AML-ALR-7712: ฝากเงินสด 9 ครั้ง รวม ${baht(AML_TOTAL, 0)} ต่ำกว่าเกณฑ์รายงานเล็กน้อย จากลูกค้าที่มีความเสี่ยงสูงอยู่แล้ว เปิดเป็นเรื่อง AML-2026-0418`, ["Alerts", "Cases"]],
  account: ["What can I change here?", "เปลี่ยนอะไรได้บ้าง", "Style, theme, density, language, start page and which notifications reach you. They only affect your own view.", "สไตล์ ธีม ความหนาแน่น ภาษา หน้าแรก และการแจ้งเตือน มีผลเฉพาะมุมมองของคุณ", ["Settings"]],
};
function copilotContext() {
  const L = LOAN, src = (a) => a;
  if (current.rec === "LN-A-C10") {
    const pmt = r2(L.total * 0.0125 / (1 - Math.pow(1.0125, -18)));
    return { key: "LN-A-C10", label: "LN-A-C10", qs: [
      [tt("Summarise this loan", "สรุปสัญญานี้"), tt(`Personal loan of ${baht(L.P)} to Somchai Prasert, 15 months at 15.00%. Five instalments are paid and five unpaid since 2 Jun 2026, so it is ${LATE_DAYS} days late and in Stage 3. The Triton (A4) was repossessed on 18 Oct and is held for sale. Settling today costs ${baht(L.total)}; SAV-C10 holds ${baht(L.sav)}.`, `สินเชื่อส่วนบุคคล ${baht(L.P)} ของคุณสมชาย 15 งวด ดอกเบี้ย 15.00% ชำระแล้ว 5 งวด ค้าง 5 งวดตั้งแต่ 2 มิ.ย. 2569 ค้าง ${LATE_DAYS} วัน อยู่ใน Stage 3 รถไทรทัน (A4) ถูกยึดเมื่อ 18 ต.ค. และรอขาย ยอดปิดบัญชีวันนี้ ${baht(L.total)} บัญชี SAV-C10 มี ${baht(L.sav)}`), src([t("Schedule"), t("Collections"), "R-A4"])],
      [tt("Why is it Stage 3?", "ทำไมอยู่ใน Stage 3"), tt(`More than 90 days past due is the bank's Stage 3 trigger (credit-impaired). The allowance is exposure × PD 100% × LGD 45% = ${baht(L.allowance)}. PD and LGD here are test values; the bank supplies the real ones.`, `ค้างเกิน 90 วันเป็นเกณฑ์ Stage 3 ของธนาคาร (ด้อยค่าด้านเครดิต) ค่าเผื่อ = ยอดหนี้ × PD 100% × LGD 45% = ${baht(L.allowance)} ค่า PD และ LGD เป็นค่าทดสอบ ธนาคารต้องกำหนดค่าจริง`), src(["TFRS 9 policy", t("Loss allowance")])],
      [tt("Draft a restructuring", "ร่างการปรับโครงสร้างหนี้"), tt(`A plan within your authority: capitalise the settlement balance of ${baht(L.total)} and repay it over 18 months at 15.00% from Nov 2026, about ${baht(pmt)} a month. A credit officer approves it, and it is booked as a modification under TFRS 9.`, `แผนที่อยู่ในอำนาจของคุณ: ทบยอด ${baht(L.total)} เป็นเงินต้น ผ่อน 18 เดือน ดอกเบี้ย 15.00% เริ่ม พ.ย. 2569 ประมาณเดือนละ ${baht(pmt)} ต้องให้เจ้าหน้าที่สินเชื่ออนุมัติ และบันทึกเป็นการปรับเงื่อนไขตาม TFRS 9`), src([t("Schedule"), "Restructuring policy"]), "restructure"]] };
  }
  if (current.rec === "FP-DEMO") return { key: "FP-DEMO", label: "FP-DEMO", qs: [
    [tt("Which units need attention?", "รถคันไหนต้องดูแล"), tt(`MR0HA3CD5P0100013 was sold on 22 Oct: a payoff of ${baht(FP.payoff(FP.units[2]).total)} is due by 26 Oct. JTEBU3FJ9PK020301 has been on the floor ${FP.days(FP.units[3])} days; the 20% curtailment is paid and the next is due at 150 days. The others are within terms.`, `MR0HA3CD5P0100013 ขายเมื่อ 22 ต.ค. ต้องชำระคืน ${baht(FP.payoff(FP.units[2]).total)} ภายใน 26 ต.ค. JTEBU3FJ9PK020301 อยู่ในสต็อก ${FP.days(FP.units[3])} วัน ลดยอด 20% แล้ว ครั้งถัดไปที่ 150 วัน คันอื่นอยู่ในเงื่อนไข`), [t("Vehicles"), t("Stock audit")], "fpPayoff"],
    [tt("Is the dealer within limit?", "ดีลเลอร์อยู่ในวงเงินไหม"), tt(`FP-DEMO uses ${baht(FP.inUse)} of ${baht(FP.limit)} (${FP.pct}%). Across both lines Bangna Motors is at 92% of its group limit, so new draws above ฿1,000,000 need approval.`, `FP-DEMO ใช้ ${baht(FP.inUse)} จาก ${baht(FP.limit)} (${FP.pct}%) รวมทุกวงเงินบางนา มอเตอร์สใช้ 92% ของวงเงินรวม การเบิกใหม่เกิน ฿1,000,000 ต้องอนุมัติ`), [t("Dealer")]]] };
  if (current.rec === "HP-2025-004812") return { key: "HP", label: "HP-2025-004812", qs: [
    [tt("Explain the rebate", "อธิบายส่วนลด"), tt(`${HP.paid} of ${HP.n} instalments are paid, past the first third, so the tiered rule gives back ${HP.tier * 100}% of the unearned interest: ${baht(HP.rebate)} of ${baht(HP.unearned)}. Settling today costs ${baht(HP.total)} including VAT.`, `ชำระแล้ว ${HP.paid} จาก ${HP.n} งวด เกินหนึ่งในสามแรก ตามกฎขั้นบันไดจึงได้ส่วนลด ${HP.tier * 100}% ของดอกเบี้ยที่ยังไม่ถึงกำหนด คือ ${baht(HP.rebate)} จาก ${baht(HP.unearned)} ยอดปิดวันนี้ ${baht(HP.total)} รวม VAT`), ["TH-HP-VEHICLE-v1", t("Early settlement")], "hpSettle"]] };
  if (current.rec === "AUTO_HP_USED_v2") return { key: "AUTO", label: "AUTO_HP_USED v2", qs: [
    [tt("What changed from v1?", "เปลี่ยนอะไรจาก v1"), tt("The maximum rate drops from 18% to 15% effective to meet the rule pack, the term extends to 72 months for cars under 5 years old, the rebate moves to the tiered 60/70/100 rule, and the minimum down payment falls to 20%.", "อัตราสูงสุดลดจาก 18% เป็น 15% ตามชุดกฎ ขยายระยะเป็น 72 เดือนสำหรับรถอายุไม่เกิน 5 ปี เปลี่ยนส่วนลดเป็นขั้นบันได 60/70/100 และลดเงินดาวน์ขั้นต่ำเป็น 20%"), [t("Changes from v1")]],
    [tt("Any compliance risks?", "มีความเสี่ยงด้านกำกับไหม"), tt("All 1,200 scenarios pass the 15% rate cap and the disclosure checks. One item to confirm with counsel: the late fee on balloon payments is not covered by the rule pack.", "ทั้ง 1,200 สถานการณ์ผ่านเพดาน 15% และการตรวจการเปิดเผยข้อมูล ประเด็นที่ต้องยืนยันกับที่ปรึกษากฎหมาย: ค่าปรับล่าช้าของงวดบอลลูนยังไม่อยู่ในชุดกฎ"), ["SIM-2210", "TH-HP-VEHICLE-v1"], "approveProduct"]] };
  if (current.rec === "C10") return { key: "C10", label: t("Somchai Prasert"), qs: [
    [tt("Summarise this customer", "สรุปลูกค้ารายนี้"), tt(`Retail customer since 1 Dec 2025, KYC verified. Holds SAV-C10 (${baht(L.sav)}) and LN-A-C10, ${LATE_DAYS} days late. Marketing consent was withdrawn on 12 Aug; credit bureau consent is given. Last contact: notice of default on 5 Sep.`, `ลูกค้ารายย่อยตั้งแต่ 1 ธ.ค. 2568 ยืนยัน KYC แล้ว มีบัญชี SAV-C10 (${baht(L.sav)}) และ LN-A-C10 ค้าง ${LATE_DAYS} วัน ถอนความยินยอมการตลาดเมื่อ 12 ส.ค. ให้ความยินยอมเครดิตบูโร ติดต่อล่าสุด: หนังสือบอกกล่าว 5 ก.ย.`), [t("Accounts and contracts"), t("Consents")], "logContact"]] };
  if (current.sys === "collections") return { key: "coll", label: t("Collections & Recovery"), qs: [
    [tt("Who should I call first?", "ควรโทรหาใครก่อน"), tt("LN-A-C11 (Malee Wongsa): 65 days late with a promise due 31 Oct and a good contact history, so a call today has the best chance to cure. LN-A-C10 and LN-A-C14 are past 120 days and need a restructuring review rather than a call.", "LN-A-C11 (มาลี วงศ์ษา): ค้าง 65 วัน มีนัดชำระ 31 ต.ค. และติดต่อได้ดี โทรวันนี้มีโอกาสกลับมาปกติสูงสุด LN-A-C10 และ LN-A-C14 ค้างเกิน 120 วัน ควรพิจารณาปรับโครงสร้างแทนการโทร"), [t("Queue"), t("Promises")]]] };
  const sq = SYSQ[current.sys];
  if (sq && !current.rec) return { key: current.sys, label: t(sysById[current.sys].name) + " · " + sectionLabel(), qs: [[tt(sq[0], sq[1]), tt(sq[2], sq[3]), sq[4].map(t)]] };
  if (current.rec) return { key: current.rec, label: RECS[current.rec].label, qs: [[tt("Summarise this record", "สรุปรายการนี้"), tt(`${RECS[current.rec].label} is a ${RECS[current.rec].kind.toLowerCase()}. The header shows the figures that matter; each tab is one facet, and every action opens a review before anything moves.`, `${RECS[current.rec].label} เป็น${t(RECS[current.rec].kind)} ส่วนหัวแสดงตัวเลขสำคัญ แต่ละแท็บคือหนึ่งมุมมอง และทุกการทำรายการมีขั้นตอนตรวจทานก่อน`), [t(RECS[current.rec].kind)]]] };
  return { key: "wb", label: t(sysById[current.sys].name), qs: [
    [tt("What needs me first today?", "วันนี้ควรทำอะไรก่อน"), tt("Start with the write-off of LN-A-C14, which has waited a day, then the ITMX break before the 14:00 BAHTNET cut-off. The other approvals are under 3 hours old.", "เริ่มจากตัดหนี้สูญ LN-A-C14 ที่รอมา 1 วัน แล้วจัดการรายการ ITMX ก่อนตัดรอบ BAHTNET 14:00 รายการอนุมัติอื่นรอไม่เกิน 3 ชั่วโมง"), [t("Approvals"), tt("The bank's day", "วันทำการของธนาคาร")]]] };
}
// who changed what and when, with the values before and after, for every record
const HISTORY = {
  "LN-A-C10": [["24 Oct 2026 09:20", "Collections policy", "Next step", "Send letter", "Review for restructuring"], ["18 Oct 2026 14:05", "Recovery team · Pongsak R.", "Collateral A4", "Pledged", "Repossessed"], ["1 Oct 2026 00:00", "ECL run 09", "Stage", "2", "3"], ["5 Sep 2026 10:12", "Agent Nok", "Notice of default", "—", "Sent"], ["1 Aug 2026 06:00", "Scheduler", "Promise", "Open", "Broken"]],
  "C10": [["12 Aug 2026 19:40", "Customer · app", "Marketing consent", "Given", "Withdrawn"], ["2 Mar 2026 11:02", "Teller 4 · Branch 0123", "Address", "Bang Kapi", "Bang Na"], ["1 Dec 2025 09:31", "Onboarding ONB-6620", "KYC", "—", "Verified"]],
  "FP-DEMO": [["22 Oct 2026 16:41", "Bangna Motors · dealer portal", "MR0HA3CD5P0100013", "On the floor", "Sold"], ["16 Oct 2026 09:00", "Scheduler", "JTEBU3FJ9PK020301 outstanding", "฿1,500,000.00", "฿1,200,000.00"], ["1 Oct 2026 08:30", "Wanida K. · approved by Ploy C.", "Limit", "฿6,000,000.00", "฿6,800,000.00"]],
  "HP-2025-004812": [["5 Oct 2026 08:00", "Direct debit", "Instalments paid", "21", "22"], ["5 Jul 2025 13:20", "Insurance desk", "Insurer", "Dhipaya", "Viriyah"]],
  "TPL-HP-VEHICLE": [["1 Jul 2026 00:00", "Architecture board · approved", "Version", "v3", "v4"], ["28 Jun 2026 15:10", "Krit S. · approved by Compliance", "Rebate rule", "Rule of 78", "Tiered 60/70/100"]],
  "AUTO_HP_USED_v2": [["24 Oct 2026 08:10", "Wanida K. (Risk)", "Approval", "Waiting", "Approved"], ["23 Oct 2026 16:20", "Krit S.", "Maximum effective rate", "18.00%", "15.00%"], ["23 Oct 2026 16:18", "Krit S.", "Maximum term", "60 months", "72 months"]],
  "SAV-C10": [["23 Oct 2026 21:14", "Card system", "Hold HLD-30412", "—", "฿5,000.00"], ["1 Dec 2025 09:40", "Teller 4 · Branch 0123", "PromptPay proxy", "—", "08x-xxx-1180"]],
  "LC-26-0412": [["22 Oct 2026 10:05", "Trade operations", "Documents", "Not presented", "Presented, 1 discrepancy"], ["12 Oct 2026 09:30", "Hino Motors via MUFG", "Amendment AMD-1", "Requested", "Accepted"], ["10 Oct 2026 14:00", "Wanida K.", "Latest shipment", "15 Nov 2026", "30 Nov 2026"]],
  "ONB-7731": [["24 Oct 2026 09:36", "Napat Srisuk", "Liveness", "—", "Passed 97.4%"], ["24 Oct 2026 09:33", "NDID", "Identity", "—", "IAL 2.3"], ["24 Oct 2026 09:31", "DOPA", "ID card", "—", "Valid"]],
  "F2": [["5 Oct 2026 06:00", "Scheduler", "Arrears", "1 rent", "2 rents"], ["5 Sep 2026 06:00", "Scheduler", "Arrears", "—", "1 rent"]],
  "MA-1": [["24 Oct 2026 10:02", "Collections engine", "Cross-default", "Triggered", "Cured"], ["2 Sep 2026 15:30", "Wanida K. · approved by Ploy C.", "Schedules", "1", "2"]],
  "DLR-1": [["1 Oct 2026 08:30", "Wanida K. · approved by Ploy C.", "FP-DEMO limit", "฿6,000,000.00", "฿6,800,000.00"], ["3 Jun 2025 11:00", "Onboarding", "Status", "Prospect", "Active"]],
  "TD-88140": [["29 Apr 2026 09:12", "Teller 2 · Branch 0001", "Opened", "—", "฿120,000,000.00 at 2.45%"]],
  "BG-26-1102": [["2 Jan 2026 14:20", "Trade operations · approved by Wanida K.", "Status", "Draft", "Issued"]],
  "GL-1300": [["24 Oct 2026 06:00", "Reconciliation", "Difference", "฿0.00", "฿0.00"], ["1 Jan 2026 00:00", "Finance · Arunee T.", "Mapping", "Loans and advances", "Loans receivable"]],
};
function renderSide() {
  $("#app").classList.toggle("with-side", !!side);
  if (!side) { $("#sideHost").innerHTML = ""; return; }
  if (side === "history") {
    if (!current.rec) { side = null; return renderSide(); }
    const items = HISTORY[current.rec] || [];
    $("#sideHost").innerHTML = `<aside class="side" aria-label="${esc(tt("History", "ประวัติ"))}"><div class="side-head">${icon("i-history")}<div><h2>${esc(tt("History", "ประวัติ"))}</h2><div class="ctx">${esc(RECS[current.rec].label)}</div></div><button class="icon-btn" type="button" data-action="close-side" aria-label="${esc(t("Close"))}" style="margin-left:auto">${icon("i-close")}</button></div>
      <div class="side-body">${items.map(([w, who, f, b, a]) => `<div class="hist"><div class="who-when">${esc(loc(w))} · ${esc(who)}</div><strong>${esc(f)}</strong><div class="diff"><del>${esc(b)}</del>→<ins>${esc(a)}</ins></div></div>`).join("")}
      <p class="note">${esc(tt("Every change is kept with who made it, who approved it and the values before and after. History cannot be edited.", "ทุกการเปลี่ยนแปลงเก็บไว้พร้อมผู้ทำ ผู้อนุมัติ และค่าก่อนและหลัง ประวัติแก้ไขไม่ได้"))}</p></div></aside>`;
    return;
  }
  if (side === "notes") {
    const items = [["crit", "i-alert", tt("Promise broken", "ผิดนัดชำระ"), "LN-77012 · Arthit Wong · ฿12,000.00", "08:05", "collections/promises"], ["warn", "i-swap", tt("ITMX break found", "พบรายการ ITMX ไม่ตรง"), tt("฿4,200.00 in the 05:00 file, match proposed", "฿4,200.00 ในไฟล์ 05:00 เสนอจับคู่แล้ว"), "05:12", "payments/recon"],
      ["good", "i-check", tt("Sub-ledger matches GL", "บัญชีย่อยตรงกับ GL"), tt("Difference ฿0.00", "ผลต่าง ฿0.00"), "06:00", "finance/recon"], ["info", "i-cube", tt("AUTO_HP_USED v2 approved by Risk", "ฝ่ายความเสี่ยงอนุมัติ AUTO_HP_USED v2"), tt("Waiting for Compliance", "รอฝ่ายกำกับ"), tt("Yesterday", "เมื่อวาน"), "rec:AUTO_HP_USED_v2"],
      ["warn", "i-truck", tt("Unit sold, payoff due", "ขายรถแล้ว รอชำระคืน"), "MR0HA3CD5P0100013 · FP-DEMO", tt("Yesterday", "เมื่อวาน"), "rec:FP-DEMO"], ["info", "i-spark", tt("Copilot drafted 214 promise plans", "Copilot ร่างแผนนัดชำระ 214 บัญชี"), tt("Waiting for a supervisor", "รอหัวหน้า"), tt("Yesterday", "เมื่อวาน"), "agents/proposals"]]
      .filter((n) => has(n[5].startsWith("rec:") ? RECS[n[5].slice(4)].sys : n[5].split("/")[0]));
    $("#sideHost").innerHTML = `<aside class="side" aria-label="${esc(t("Notifications"))}"><div class="side-head">${icon("i-bell")}<h2>${esc(t("Notifications"))}</h2><button class="icon-btn" type="button" data-action="close-side" aria-label="${esc(t("Close"))}" style="margin-left:auto">${icon("i-close")}</button></div>
      <div class="side-body">${items.map(([tone, ic, h, p, w, go]) => `<button class="note-item" type="button" data-go="${go}"><span class="sev ${tone}">${icon(ic)}</span><span style="min-width:0"><strong>${esc(h)}</strong><p>${esc(p)}</p></span><span class="when">${esc(w)}</span></button>`).join("")}</div>
      <div class="side-foot"><button class="btn" type="button" data-go="account/settings">${esc(tt("Notification settings", "ตั้งค่าการแจ้งเตือน"))}</button></div></aside>`;
    return;
  }
  const ctx = copilotContext(), log = (chat[ctx.key] ||= []);
  $("#sideHost").innerHTML = `<aside class="side" aria-label="Copilot"><div class="side-head"><span class="tile" style="width:30px;height:30px">${icon("i-spark")}</span><div><h2>Fabor Copilot</h2><div class="ctx">${esc(tt("Looking at", "กำลังดู"))} ${esc(ctx.label)}</div></div><button class="icon-btn" type="button" data-action="close-side" aria-label="${esc(t("Close"))}" style="margin-left:auto">${icon("i-close")}</button></div>
    <div class="side-body" id="chatLog" aria-live="polite">
      <p class="note">${esc(tt("Copilot reads what you can read and drafts actions. It cannot post: everything it drafts opens the same review and approval as yours.", "Copilot อ่านได้เท่าที่คุณอ่านได้และร่างรายการให้ แต่บันทึกบัญชีเองไม่ได้ ทุกอย่างที่ร่างต้องผ่านการตรวจทานและอนุมัติเหมือนของคุณ"))}</p>
      ${log.map((m) => m.me ? `<div class="msg me">${esc(m.text)}</div>` : `<div class="msg ai">${esc(m.text)}${m.src ? `<div class="src">${m.src.map((s) => `<span>${esc(s)}</span>`).join("")}</div>` : ""}${m.flow ? `<div style="margin-top:10px"><button class="btn row-btn primary" type="button" data-flow="${m.flow}">${esc(tt("Open for review", "เปิดเพื่อตรวจทาน"))} ${icon("i-arrow")}</button></div>` : ""}</div>`).join("")}
      <div class="sugg">${ctx.qs.map((q, i) => `<button type="button" data-ask="${i}">${esc(q[0])}</button>`).join("")}</div></div>
    <form class="side-foot" id="chatForm"><label class="sr" for="chatIn">${esc(tt("Ask Copilot", "ถาม Copilot"))}</label><input class="input" id="chatIn" placeholder="${esc(tt("Ask about this page…", "ถามเกี่ยวกับหน้านี้…"))}" autocomplete="off"><button class="icon-btn" type="submit" aria-label="${esc(tt("Send", "ส่ง"))}">${icon("i-send")}</button></form></aside>`;
  const lg = $("#chatLog"); lg.scrollTop = lg.scrollHeight;
}
function ask(i, text) {
  const ctx = copilotContext(), log = (chat[ctx.key] ||= []);
  if (i != null) { const q = ctx.qs[i]; log.push({ me: true, text: q[0] }, { text: q[1], src: q[2], flow: q[3] }); }
  else if (text) log.push({ me: true, text }, { text: tt("In this concept I answer the suggested questions. In the product, answers cite the records they come from, and anything I draft goes through the same review and approval as yours.", "ในต้นแบบนี้ตอบได้เฉพาะคำถามที่แนะนำ ในระบบจริง คำตอบจะอ้างอิงรายการต้นทาง และทุกอย่างที่ร่างต้องผ่านการตรวจทานและอนุมัติเหมือนของคุณ") });
  renderSide(); $("#chatIn")?.focus();
}

/* ---------------- sign-in with MFA, and the idle session timeout ---------------- */
let signedIn = (() => { try { return sessionStorage.getItem("fabor.session") === "1"; } catch { return false; } })(), signStep = "id", signNote = "", lastActive = Date.now(), warned = false;
const wordmark = () => brand().name
  ? `<span class="wordmark"><span class="logo" aria-hidden="true">${brand().logo ? `<img src="${brand().logo}" alt="">` : esc(brand().mark || "")}</span>${esc(brand().name)} <small>on Fabor OS</small></span>`
  : `<span class="wordmark"><span class="logo" aria-hidden="true"><svg width="24" height="24" style="fill:currentColor"><use href="#logo-mark"/></svg></span>fabor <small>OS</small></span>`;

/* ---------------- bank branding, presenter mode and demo reset ---------------- */
function brand() { try { return JSON.parse(store.get(`fabor.brand.${tenant.id}`) || "{}"); } catch { return {}; } }
const tenantName = () => brand().name || t(tenant.name);
function applyBrand() {
  // appended after the stylesheet so these tokens win over the defaults at the same specificity
  const c = brand().color, el = $("#brandStyle") || document.body.appendChild(Object.assign(document.createElement("style"), { id: "brandStyle" }));
  // the accent and its derived tokens follow the bank's colour; dark mode gets a lighter tint of it
  el.textContent = c ? `:root{--accent:${c};--accent-hover:color-mix(in srgb,${c} 85%,#000);--accent-soft:color-mix(in srgb,${c} 12%,var(--surface));--accent-ink:#fff}
    @media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--accent:color-mix(in srgb,${c} 60%,#fff);--accent-hover:color-mix(in srgb,${c} 45%,#fff);--accent-soft:color-mix(in srgb,${c} 22%,var(--surface));--accent-ink:#0a0f1d}}
    :root[data-theme="dark"]{--accent:color-mix(in srgb,${c} 60%,#fff);--accent-hover:color-mix(in srgb,${c} 45%,#fff);--accent-soft:color-mix(in srgb,${c} 22%,var(--surface));--accent-ink:#0a0f1d}` : "";
}
const PRESENT = [
  ["Sign in", "Bank SSO or staff ID with a second factor; idle sessions end after 15 minutes.", () => signOut()],
  ["Workbench and tour", "What needs this person, from every system. The tour shows the main ideas.", () => { go("workbench", "today"); setTimeout(() => tourGo(0), 50); }],
  ["Preview as Collector", "The Workbench and pins change with the role.", () => { role = ROLES.find((r) => r.id === "collector"); go("workbench", "today"); }],
  ["Loan LN-A-C10", "One page per record: figures on top, a tab per facet.", () => { role = ROLES[0]; go(null, null, "LN-A-C10"); }],
  ["Settle early", "Quote line by line; savings ฿1,545.98 short; authority checked; id typed to confirm.", () => { go(null, null, "LN-A-C10"); openDialog("settle"); }],
  ["History", "Who changed what, who approved, before and after.", () => { go(null, null, "LN-A-C10"); side = "history"; render(); }],
  ["Copilot drafts", "Reads the screen, drafts a restructuring that a person approves.", () => { go(null, null, "LN-A-C10"); side = "copilot"; render(); ask(2); }],
  ["Floor plan payoff", "Dealer stock finance: payoff to the day, VIN typed to confirm.", () => { go(null, null, "FP-DEMO"); openFlow("fpPayoff"); }],
  ["Queue and bulk", "Tick rows, send reminders with one review; J and K move.", () => go("collections", "queue")],
  ["Ledger drill-down", "GL figure → journal → balanced postings → the loan.", () => { go(null, null, "GL-1300", "journals"); openJournal(2); }],
  ["Exception centre", "Every break and breach with an owner and a clock.", () => go("ops", "exceptions")],
  ["Customer app", "Pay in the app; it lands on the loan and the ledger at once.", () => go("channels", "preview")],
  ["Vintage and roll rates", "Q2 2026 is worsening faster; see where accounts move.", () => go("analytics", "vintage")],
  ["Month-end close", "No close night: a checklist of controls.", () => go("finance", "close")],
  ["Commercial bank: LC", "Same console, more systems: an LC with a discrepancy.", () => { tenant = TENANTS.find((x) => x.id === "commercial"); applyBrand(); go(null, null, "LC-26-0412"); }],
  ["Thai and dark", "Labels and dates switch together; Buddhist years in Thai.", () => { lang = "th"; store.set("fabor.lang", "th"); render(); }],
];
PRESENT.splice(9, 0, ["AML case", "Alert to investigation to a report to AMLO; the customer is never told.", () => go(null, null, "AML-2026-0418", "alert")], ["Held payment", "A sanctions name match stops a payment; a person releases it, within authority.", () => go(null, null, "TR-9918210", "screening")], ["Loan application", "Policy rules, a recommendation, a decision within authority, then disbursement.", () => go(null, null, "APP-30413", "credit")]);
PRESENT.push(["What if", "Move term and rate; instalment and modification loss follow.", () => go(null, null, "LN-A-C10", "whatif")], ["Home loan servicing", "Prepay, review the rate, pause or move the due date; each shows its effect first.", () => { go(null, null, "LN-77120", "servicing"); openFlow("hmPrepay"); }], ["New application", "Product to disbursement in seven steps; the decision engine approves in seconds.", () => go(null, null, "APP-30416")], ["Covenant breach", "Q3 figures break DSCR; a draw stop follows, then a waiver to committee.", () => { go(null, null, "FAC-B2031", "covenants"); openFlow("covTest"); }], ["Business account opening", "Owners traced to people, screening, a live risk score; high risk goes to compliance.", () => go(null, null, "AO-26-0412", "owners")], ["Legal orders", "An AMLO freeze: verify, apply, a second person checks; the customer is not told.", () => go(null, null, "ORD-26-0191")], ["Loss allowance run", "Stages follow the loans; scenarios, overlays and the movement, then post.", () => { role = ROLES.find((r) => r.id === "finance"); go(null, null, "ECL-2026-10", "loans"); }], ["BOT data set", "Validation catches what happened in the demo; fix the source, generate, a second person submits.", () => go(null, null, "DS-LOAN-2026-10", "validation")], ["Credit policy", "Change a limit, see the impact on 90 days of applications, approve and publish; the screens follow.", () => go(null, null, "POL-RETAIL", "authority")], ["Approval to payout", "Conditions with maker-checker, the e-contract, the Land Office, then the payout.", () => go(null, null, "DSB-30409", "conditions")], ["Credit review", "The officer adjusts income and debts, writes mitigants, and the approver follows amount and deviations.", () => { role = ROLES.find((r) => r.id === "credit"); go(null, null, "APP-30409", "worksheet"); }], ["Credit committee", "Conflicts, quorum and votes; the waiver lifts the draw stop.", () => go(null, null, "CC-2026-21")], ["Collections strategy", "Day by day, by bucket, within the contact rules.", () => go("collections", "strategy")], ["Hardship", "A collector logs hardship; the assessment finds what she can pay; an offer that fits.", () => { role = ROLES.find((r) => r.id === "collector"); go(null, null, "LN-A-C11", "hardship"); }], ["Legal and write-off", "From notice to suit, write-off against the allowance, recovery after.", () => go(null, null, "LN-A-C14", "legal")], ["Repossession and auction", "Notice of sale, the hammer price, and the shortfall.", () => go(null, null, "R-A4", "notices")], ["Before and after", "The same settlement: about 40 minutes and a night, against a minute.", () => go("workbench", "compare")]);
// five steps for a bank's leadership: the person's day, one record, the ledger, the customer, the difference
const EXEC = ["Workbench and tour", "Settle early", "Ledger drill-down", "Customer app", "Before and after"];
let presenting = false, presentStep = -1, presentExec = false;
const presentList = () => PRESENT.map((p, i) => [p, i]).filter(([p]) => !presentExec || EXEC.includes(p[0]));
function renderPresenter() {
  let el = $("#presenterHost");
  if (!el) { el = document.createElement("div"); el.id = "presenterHost"; document.body.appendChild(el); }
  if (!presenting || !signedIn) { el.innerHTML = ""; return; }
  const list = presentList(), pos = list.findIndex(([, i]) => i === presentStep), next = list[Math.min(list.length - 1, pos + 1)][1];
  el.innerHTML = `<div class="ribbon" role="note">${esc(tt("Sample data · not a live bank", "ข้อมูลตัวอย่าง · ไม่ใช่ธนาคารจริง"))}</div><aside class="presenter" aria-label="${esc(tt("Presenter mode", "โหมดผู้นำเสนอ"))}"><h2>${icon("i-spark")}${esc(tt("Presenter mode", "โหมดผู้นำเสนอ"))}<button class="icon-btn" type="button" data-action="presenter" aria-label="${esc(t("Close"))}" style="margin-left:auto;min-width:30px;height:30px;background:var(--ink-2);border-color:var(--ink-2);color:var(--on-ink)">${icon("i-close")}</button></h2>
    <div class="seg" role="group" aria-label="${esc(tt("Script", "บท"))}" style="background:var(--ink-2);border-color:var(--ink-2)"><button type="button" data-action="present-full" aria-pressed="${!presentExec}">${esc(tt(`Full · ${PRESENT.length}`, `เต็ม · ${PRESENT.length}`))}</button><button type="button" data-action="present-exec" aria-pressed="${presentExec}">${esc(tt("Executive · 5", "ผู้บริหาร · 5"))}</button></div>
    ${presentStep >= 0 ? `<div class="say">${esc(PRESENT[presentStep][1])}</div>` : `<div class="say">${esc(tt("Click a step: the console goes there and sets it up. This panel is for you; close it before sharing your screen if you prefer.", "คลิกขั้นตอน คอนโซลจะไปยังหน้านั้นและเตรียมให้"))}</div>`}
    <ol>${list.map(([[l], i], k) => `<li><button type="button" data-pstep="${i}" ${i === presentStep ? 'aria-current="step"' : ""}><span class="n">${k + 1}</span>${esc(l)}</button></li>`).join("")}</ol>
    <div class="row"><button class="btn" type="button" data-pstep="${next}">${esc(t("Next"))} ${icon("i-arrow")}</button><button class="btn" type="button" data-go="admin/branding">${esc(t("Branding"))}</button><button class="btn" type="button" data-action="reset">${esc(tt("Reset demo", "รีเซ็ตการสาธิต"))}</button></div></aside>`;
}
function resetDemo() {
  for (const k of Object.keys(mem)) delete mem[k];
  try { Object.keys(localStorage).filter((k) => k.startsWith("fabor.")).forEach((k) => localStorage.removeItem(k)); } catch {}
  try { sessionStorage.removeItem("fabor.session"); } catch {}
  location.reload();
}
function renderSignin() {
  const host = $("#signinHost");
  if (signedIn) { host.innerHTML = ""; return; }
  const form = signStep === "id" ? `
      <div><h1>${esc(tt("Sign in to the console", "เข้าสู่ระบบคอนโซล"))}</h1><p class="muted">${esc(tenantName())} · ${esc(tt("staff only", "สำหรับพนักงาน"))}</p></div>
      ${signNote ? notice("info", signNote, "") : ""}
      <button class="btn primary wide" type="button" data-sign="sso">${icon("i-shield")}${esc(tt("Continue with bank SSO", "เข้าสู่ระบบด้วย SSO ของธนาคาร"))}</button>
      <div class="divider">${esc(tt("or with a staff ID", "หรือด้วยรหัสพนักงาน"))}</div>
      <form class="signin-box" id="signForm" style="gap:12px"><div class="field"><label for="sid">${esc(tt("Staff ID or email", "รหัสพนักงานหรืออีเมล"))}</label><input class="input" id="sid" autocomplete="username" value="${esc(role.name.split(" ")[0].toLowerCase())}.${role.av.toLowerCase()}"></div>
        <div class="field"><label for="spw">${esc(tt("Password", "รหัสผ่าน"))}</label><input class="input" id="spw" type="password" autocomplete="current-password"><span class="hint">${esc(tt("Prototype: any password works and nothing is sent anywhere.", "ต้นแบบ: ใส่รหัสใดก็ได้ ไม่มีการส่งข้อมูลออก"))}</span></div>
        <button class="btn wide" type="submit">${esc(t("Next"))}</button></form>`
    : `<div><h1>${esc(tt("Confirm it's you", "ยืนยันตัวตน"))}</h1><p class="muted">${esc(tt("Enter the 6-digit code from Fabor Authenticator on your phone ending 42.", "ใส่รหัส 6 หลักจาก Fabor Authenticator บนโทรศัพท์ที่ลงท้าย 42"))}</p></div>
      <form class="signin-box" id="otpForm" style="gap:14px"><fieldset class="otp" aria-label="${esc(tt("6-digit code", "รหัส 6 หลัก"))}">${[0, 1, 2, 3, 4, 5].map((i) => `<input class="input" inputmode="numeric" maxlength="1" aria-label="${esc(tt(`Digit ${i + 1}`, `หลักที่ ${i + 1}`))}" data-otp="${i}" ${i === 0 ? 'autocomplete="one-time-code"' : ""}>`).join("")}</fieldset>
        <p class="err" id="otpErr" role="alert" style="color:var(--crit);font-size:12.5px;min-height:1em"></p>
        <button class="btn primary wide" type="submit">${icon("i-lock")}${esc(tt("Verify and sign in", "ยืนยันและเข้าสู่ระบบ"))}</button>
        <button class="btn wide" type="button" data-sign="back">${esc(t("Back"))}</button></form>
      <p class="muted" style="font-size:12.5px">${esc(tt("Prototype: any six digits work.", "ต้นแบบ: ใส่ตัวเลข 6 หลักใดก็ได้"))}</p>`;
  host.innerHTML = `<div class="signin" role="dialog" aria-modal="true" aria-label="${esc(tt("Sign in", "เข้าสู่ระบบ"))}">
    <section class="signin-art"><div style="color:var(--on-ink)">${wordmark().replace('class="wordmark"', 'class="wordmark" style="color:var(--on-ink)"')}</div>
      <div style="display:grid;gap:18px"><div class="ledger" aria-hidden="true"><div></div><div></div><div></div></div><h2>${esc(tt("Every system of the bank, one ledger underneath.", "ทุกระบบของธนาคาร บนบัญชีแยกประเภทเดียว"))}</h2><p>${esc(tt("Lending, deposits, leasing, trade and treasury post in real time to one immutable double-entry ledger. No batch window, no end-of-day surprises.", "สินเชื่อ เงินฝาก ลีสซิ่ง การค้า และบริหารเงิน บันทึกแบบเรียลไทม์ลงบัญชีคู่ที่แก้ไขไม่ได้ ไม่ต้องรอปิดงวด"))}</p></div>
      <p style="font-size:12px">${esc(tt(`Business date ${fd(BIZ)} · TLS · sessions end after 15 minutes idle`, `วันทำการ ${fd(BIZ)} · TLS · หมดเวลาเมื่อไม่ใช้งาน 15 นาที`))}</p></section>
    <section class="signin-form"><div class="signin-box">${wordmark()}${form}</div></section></div>`;
  ($("#signinHost [data-otp='0']") || $("#signinHost #spw") || $("#signinHost .btn.primary")).focus();
}
function finishSignin() {
  signedIn = true; signStep = "id"; signNote = ""; lastActive = Date.now(); warned = false;
  try { sessionStorage.setItem("fabor.session", "1"); } catch {}
  renderSignin(); toast(tt(`Signed in as ${role.name}. The session ends after 15 minutes idle.`, `เข้าสู่ระบบในชื่อ ${role.name} หมดเวลาเมื่อไม่ใช้งาน 15 นาที`), "good");
  if (!store.get("fabor.toured") && tenant) setTimeout(() => toast(tt("New here? Start the tour from the button on your Workbench.", "ใช้ครั้งแรก? เริ่มทัวร์ได้จากปุ่มบนโต๊ะทำงาน"), "info"), 1200);
}
function signOut(note) {
  signedIn = false; signStep = "id"; signNote = note || ""; side = null; dlg = null; $("#dialogHost").innerHTML = "";
  try { sessionStorage.removeItem("fabor.session"); } catch {}
  renderSignin();
}
["pointerdown", "keydown"].forEach((ev) => document.addEventListener(ev, () => { lastActive = Date.now(); }, true));
setInterval(() => {
  if (!signedIn) return;
  const idle = Date.now() - lastActive;
  if (idle > 15 * 60e3) signOut(tt("You were signed out after 15 minutes without activity. Nothing you entered was posted.", "ออกจากระบบอัตโนมัติหลังไม่ใช้งาน 15 นาที ข้อมูลที่กรอกไว้ไม่ถูกบันทึก"));
  else if (idle > 14 * 60e3 && !warned) { warned = true; toast(tt("You will be signed out in 1 minute. Move the mouse or press a key to stay.", "จะออกจากระบบใน 1 นาที ขยับเมาส์หรือกดปุ่มเพื่ออยู่ต่อ"), "warn"); }
  else if (idle < 14 * 60e3) warned = false;
}, 15000);

/* ---------------- guided tour for bank clients ---------------- */
let tourStep = null;
const TOUR = [
  { go: ["workbench", "today"], sel: ".needs", t: ["Your day starts here", "วันทำงานเริ่มที่นี่"], p: ["The Workbench collects what needs you from every system, so nobody hunts through menus. It changes with your role.", "โต๊ะทำงานรวมสิ่งที่รอคุณจากทุกระบบ ไม่ต้องค้นหาในเมนู และเปลี่ยนตามบทบาทของคุณ"] },
  { sel: ".rail", t: ["Every system, one tap away", "ทุกระบบในแตะเดียว"], p: ["Pin the systems you use; the grid opens all of them. Press G anywhere to switch.", "ปักหมุดระบบที่ใช้บ่อย ปุ่มตารางเปิดทุกระบบ กด G ได้ทุกที่เพื่อสลับระบบ"] },
  { sel: ".sys-switch", t: ["A short sidebar per system", "เมนูสั้นในแต่ละระบบ"], p: ["Lending shows lending, Treasury shows treasury. The left side never grows into a wall of links.", "สินเชื่อแสดงเฉพาะสินเชื่อ บริหารเงินแสดงเฉพาะบริหารเงิน เมนูซ้ายไม่ยาวเป็นกำแพง"] },
  { sel: ".tenant", t: ["One platform, many banks", "แพลตฟอร์มเดียว หลายธนาคาร"], p: ["A virtual bank, a retail bank and a commercial bank each license their own systems on the same core.", "ธนาคารดิจิทัล ธนาคารรายย่อย และธนาคารพาณิชย์ เลือกใช้ระบบของตนบนแกนเดียวกัน"] },
  { rec: "LN-A-C10", sel: ".facts", t: ["A record, at a glance", "ดูรายการได้ในพริบตา"], p: ["Every loan, lease, account and line has one page: the figures that matter on top, a tab for each facet.", "สินเชื่อ สัญญาเช่า บัญชี และวงเงินทุกรายการมีหน้าเดียว ตัวเลขสำคัญอยู่ด้านบน แต่ละแท็บคือหนึ่งมุมมอง"] },
  { sel: "[data-act=settle]", t: ["Money never moves without a review", "เงินไม่เคลื่อนโดยไม่มีการตรวจทาน"], p: ["Actions show the consequence in figures first. Irreversible ones ask for the record id to be typed.", "ทุกการทำรายการแสดงผลเป็นตัวเลขก่อน รายการที่ย้อนกลับไม่ได้ต้องพิมพ์รหัสยืนยัน"] },
  { sel: "[data-action=copilot]", t: ["Copilot drafts, people approve", "Copilot ร่าง คนอนุมัติ"], p: ["It answers from the records on screen and drafts actions that go through the same approvals as staff.", "ตอบจากข้อมูลบนหน้าจอ และร่างรายการที่ต้องผ่านการอนุมัติเหมือนพนักงาน"] },
  { sel: "[data-action=lang]", t: ["Thai and English", "ไทยและอังกฤษ"], p: ["Labels, messages and dates switch together; Thai dates use the Buddhist year.", "ป้าย ข้อความ และวันที่เปลี่ยนพร้อมกัน วันที่ภาษาไทยใช้ปีพุทธศักราช"] },
  { go: ["workbench", "today"], sel: "#stream", t: ["One live ledger underneath", "บัญชีแยกประเภทสดอยู่เบื้องหลัง"], p: ["Every posting lands in real time, debits equal credits, no batch window. That is what the whole console stands on.", "ทุกรายการบันทึกแบบเรียลไทม์ เดบิตเท่ากับเครดิต ไม่ต้องรอปิดงวด คอนโซลทั้งหมดตั้งอยู่บนสิ่งนี้"] },
];
function tourGo(i) {
  if (i < 0) return;
  if (i >= TOUR.length) return endTour();
  tourStep = i;
  const s = TOUR[i];
  if (s.go) go(...s.go); else if (s.rec && current.rec !== s.rec) go(null, null, s.rec);
  const el = $(s.sel), r = el && el.getBoundingClientRect();
  if (el && r.width) el.scrollIntoView({ block: "center", behavior: "instant" });
  const rect = el && el.getBoundingClientRect(), shown = rect && rect.width > 0 && rect.height > 0;
  const spot = shown ? `<div class="tour-spot" style="left:${rect.left - 6}px;top:${rect.top - 6}px;width:${rect.width + 12}px;height:${rect.height + 12}px"></div>` : `<div class="tour-spot" style="left:50%;top:50%;width:0;height:0"></div>`;
  const cw = Math.min(340, innerWidth - 32), below = shown && rect.bottom + 220 < innerHeight, right = shown && rect.right + cw + 24 < innerWidth && rect.width < 120;
  const left = shown ? (right ? rect.right + 16 : Math.max(16, Math.min(innerWidth - cw - 16, rect.left))) : (innerWidth - cw) / 2;
  const top = shown ? (right ? Math.max(16, Math.min(innerHeight - 220, rect.top)) : below ? rect.bottom + 14 : Math.max(16, rect.top - 200)) : innerHeight / 2 - 100;
  $("#tourHost").innerHTML = `${spot}<div class="tour-card" role="dialog" aria-modal="true" aria-labelledby="tourT" style="left:${left}px;top:${top}px"><h3 id="tourT">${esc(tt(...s.t))}</h3><p>${esc(tt(...s.p))}</p>
    <div class="row"><span class="muted">${i + 1} / ${TOUR.length}</span><button class="btn row-btn" type="button" data-tour="end">${esc(tt("Skip", "ข้าม"))}</button>${i ? `<button class="btn row-btn" type="button" data-tour="${i - 1}">${esc(t("Back"))}</button>` : ""}<button class="btn row-btn primary" type="button" data-tour="${i + 1}">${esc(i === TOUR.length - 1 ? tt("Finish", "เสร็จ") : t("Next"))}</button></div></div>`;
  $("#tourHost .tour-card .btn.primary").focus();
}
function endTour() { tourStep = null; $("#tourHost").innerHTML = ""; store.set("fabor.toured", "1"); }

/* ---------------- saved views, toasts and the live feel ---------------- */
const viewKey = () => `fabor.views.${tenant.id}.${role.id}`;
function savedViews() { try { const v = JSON.parse(store.get(viewKey()) || "[]"); return Array.isArray(v) ? v : []; } catch { return []; } }
function applySaved(v, tries = 0) {
  const c = $("#view .card [data-filter]")?.closest(".card");
  if (!c) { if (tries < 10) setTimeout(() => applySaved(v, tries + 1), 150); return; }
  c.querySelector("[data-filter]").value = v.q || "";
  c.querySelectorAll(".seg button").forEach((b) => b.setAttribute("aria-pressed", String((b.dataset.state || "") === (v.st || ""))));
  applyFilter(c);
}
function toast(msg, tone = "info") {
  let host = $("#toastHost");
  if (!host) { host = document.createElement("div"); host.id = "toastHost"; host.setAttribute("aria-live", "polite"); document.body.appendChild(host); }
  const el = document.createElement("div"); el.className = "toast " + tone; el.innerHTML = `${icon(tone === "good" ? "i-check" : tone === "warn" ? "i-alert" : "i-bell")}<span>${esc(msg)}</span>`;
  host.appendChild(el); setTimeout(() => el.remove(), 5200);
}
let chartDays = 30, postings = 3872934, tick = 0;
const STREAM = [];
const SOURCES = [["PromptPay in", "SAV-C14", 1250], ["Loan instalment", "LN-A-C13", 10450], ["Card purchase", "SAV-C10", -389], ["Accrual", "SAV-C14", 13.75], ["Bill payment", "CUR-B2031", -48211.6], ["PromptPay out", "SAV-P2", -2000], ["Dealer payoff", "FP-1", 742000], ["Fee", "CUR-B2031", -100]];
for (let i = 0; i < 6; i++) STREAM.push([...SOURCES[i], "09:4" + (i + 2)]);
const streamHtml = () => STREAM.slice(0, 6).map(([w, acct, a, tm]) => `<div class="li"><span class="sev ${a < 0 ? "warn" : "good"}">${icon("i-swap")}</span><div><strong>${esc(tt(w, { "PromptPay in": "พร้อมเพย์เข้า", "Loan instalment": "ค่างวดสินเชื่อ", "Card purchase": "ซื้อด้วยบัตร", "Accrual": "ดอกเบี้ยค้างรับ", "Bill payment": "ชำระบิล", "PromptPay out": "พร้อมเพย์ออก", "Dealer payoff": "ดีลเลอร์ชำระคืน", "Fee": "ค่าธรรมเนียม" }[w]))}</strong><p>${acct} · ${baht(a)}</p></div><span class="when">${tm}</span></div>`).join("");
const LIVE_TOASTS = [["ITMX file 12:00 processed · no breaks", "ไฟล์ ITMX 12:00 ประมวลผลแล้ว · ไม่มีรายการไม่ตรง", "good"], ["TR-9918202 approved by Ploy C.", "พลอย ช. อนุมัติ TR-9918202 แล้ว", "good"], ["Promise from LN-A-C11 is due in 7 days", "นัดชำระของ LN-A-C11 ครบใน 7 วัน", "info"], ["NDID response slower than usual", "NDID ตอบช้ากว่าปกติ", "warn"]];
setInterval(() => {
  tick++;
  postings += 40 + Math.floor(Math.random() * 60);
  document.querySelectorAll("[data-live=postings]").forEach((n) => { n.textContent = postings.toLocaleString("en-US"); });
  if (tick % 2 === 0) {
    const s = SOURCES[tick % SOURCES.length], d = new Date(); STREAM.unshift([...s, `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`]); STREAM.length = 8;
    const box = $("#stream"); if (box) box.innerHTML = streamHtml();
  }
  if (tick % 24 === 12 && !dlg) { const m = LIVE_TOASTS[(tick / 24 | 0) % LIVE_TOASTS.length]; toast(tt(m[0], m[1]), m[2]); }
}, 1500);

/* ---------------- shell rendering ---------------- */
let current = { sys: "workbench", sec: "today", rec: null, tab: "summary" };
const recent = (() => { try { return JSON.parse(store.get("fabor.recent") || "[]"); } catch { return []; } })();
const sectionLabel = () => t(sysById[current.sys].sections.find(([k]) => k === current.sec)[1]);

function go(sysId, secId, rec = null, tab = null) {
  if (rec && RECS[rec]) { sysId = RECS[rec].sys; secId = RECS[rec].sec; if (!has(sysId)) rec = null; }
  const s = has(sysId) && sysById[sysId] ? sysById[sysId] : sysById.workbench;
  const sec = s.sections.find(([k]) => k === secId) ? secId : s.sections[0][0];
  if (rec && s.id !== RECS[rec].sys) rec = null;
  current = { sys: s.id, sec, rec, tab: rec ? tab || RECS[rec].tabs[0][0] : null };
  if (rec) { recentRecs = [{ rec, at: Date.now() }, ...recentRecs.filter((x) => x.rec !== rec)].slice(0, 8); }
  store.set("fabor.last", s.id);
  if (!s.hidden && recent[0] !== s.id) { const i = recent.indexOf(s.id); if (i >= 0) recent.splice(i, 1); recent.unshift(s.id); recent.length = Math.min(recent.length, 6); store.set("fabor.recent", JSON.stringify(recent)); }
  try { history.replaceState(null, "", "#" + (rec || s.id)); } catch {}
  $("#drawerHost").innerHTML = "";
  render();
  $("#app").classList.remove("open"); $(".scrim-nav")?.remove();
  window.scrollTo(0, 0);
}

function renderRail(s) {
  $("#rail").innerHTML = `<div class="logo" role="img" aria-label="${esc(brand().name || "Fabor")}">${brand().logo ? `<img src="${brand().logo}" alt="">` : `<svg width="24" height="24" aria-hidden="true" style="fill:currentColor"><use href="#logo-mark"/></svg>`}</div>
    <div class="rail-group">${pins().map((id) => { const x = sysById[id]; return `<button class="rail-btn" type="button" data-sys="${id}" aria-label="${esc(t(x.name))}" aria-current="${id === s.id}">${icon(x.icon)}<span class="tip">${esc(t(x.name))}</span>${id === "collections" ? '<span class="dot"></span>' : ""}</button>`; }).join("")}</div>
    <div class="rail-sep" aria-hidden="true"></div>
    <button class="rail-btn" type="button" data-action="switcher" aria-label="${esc(t("All systems"))}">${icon("i-grid")}<span class="tip">${esc(t("All systems"))} <span class="kbd">G</span></span></button>
    <div class="rail-spacer"></div>
    <button class="rail-btn" type="button" data-action="theme" aria-label="${esc(t("Light or dark"))}">${icon("i-moon")}<span class="tip">${esc(t("Light or dark"))}</span></button>
    <button class="avatar avatar-btn" type="button" data-action="role" aria-haspopup="menu" aria-expanded="${roleOpen}" aria-label="${esc(role.name)}, ${esc(t(role.title))}">${role.av}</button>
    ${roleOpen ? `<div class="menu role-menu" role="menu"><div class="menu-head">${esc(t("Signed in as"))}</div>
      <button class="menu-item" type="button" role="menuitem" data-go="account/settings"><span class="mark">${role.av}</span><span class="tn"><b>${esc(role.name)}</b><small>${esc(t(role.title))} · ${esc(t("Settings"))}</small></span></button>
      <div class="menu-head">${esc(t("Preview as"))}</div>${ROLES.map((r) => `<button class="menu-item" type="button" role="menuitemradio" aria-checked="${r.id === role.id}" data-role="${r.id}"><span class="mark">${r.av}</span><span class="tn"><b>${esc(t(r.title))}</b><small>${esc(r.name)}</small></span>${r.id === role.id ? `<span class="ok">${icon("i-check")}</span>` : ""}</button>`).join("")}
      <div class="menu-head"></div><button class="menu-item" type="button" role="menuitem" data-action="presenter">${icon("i-spark")}<span class="tn"><b>${esc(presenting ? tt("Hide presenter mode", "ซ่อนโหมดผู้นำเสนอ") : tt("Presenter mode", "โหมดผู้นำเสนอ"))}</b></span></button><button class="menu-item" type="button" role="menuitem" data-action="lock">${icon("i-lock")}<span class="tn"><b>${esc(tt("Lock screen", "ล็อกหน้าจอ"))}</b></span></button><button class="menu-item" type="button" role="menuitem" data-action="signout">${icon("i-arrow")}<span class="tn"><b>${esc(tt("Sign out", "ออกจากระบบ"))}</b></span></button></div>` : ""}`;
}
function renderNav(s) {
  const recents = recent.filter((id) => id !== s.id && has(id)).slice(0, 4);
  $("#nav").innerHTML = `<button class="sys-switch" type="button" data-action="switcher" aria-haspopup="dialog"><span class="tile">${icon(s.icon)}</span><span style="min-width:0"><span class="name">${esc(t(s.name))}</span><span class="sub">${esc(t(s.desc))}</span></span><svg class="ico chev" aria-hidden="true"><use href="#i-chev"/></svg></button>
    <div class="nav-label">${esc(t("Sections"))}</div>
    <nav class="nav-list">${s.sections.map(([k, l, n, hot]) => { const c = n === "appr" ? approvals().length : n === "exc" ? excOpen().length : n; return `<button class="nav-item" type="button" data-sec="${k}" aria-current="${k === current.sec ? "page" : "false"}">${esc(t(l))}${c ? `<span class="count${hot ? " hot" : ""}">${c}</span>` : ""}</button>`; }).join("")}</nav>
    ${(() => { const v = savedViews().map((x, i) => [x, i]).filter(([x]) => x.sys === s.id); return v.length ? `<div class="nav-label">${esc(tt("Saved views", "มุมมองที่บันทึก"))}</div><nav class="nav-list">${v.map(([x, i]) => `<button class="nav-item" type="button" data-view="${i}">${icon("i-pin")}<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(x.name)}</span></button>`).join("")}</nav>` : ""; })()}
    <div class="nav-foot"><div class="nav-label">${esc(t("Recently used"))}</div>
      <div class="recent">${recents.map((id) => `<button class="chip-sys" type="button" data-sys="${id}">${icon(sysById[id].icon)}${esc(t(sysById[id].name))}</button>`).join("") || `<span class="faint" style="font-size:12px;padding:0 4px">${esc(t("Systems you open appear here."))}</span>`}</div>
      <div class="concept">${esc(t("Concept with sample data."))} ${esc(t("Thai covers navigation, Workbench, Lending and the loan page."))} <span class="kbd">G</span> ${esc(t("switch system"))}, <span class="kbd">⌘K</span> ${esc(lang === "th" ? "ค้นหา" : "search")}.</div></div>`;
}
function renderTop(s, label) {
  const density = document.documentElement.getAttribute("data-density") === "compact";
  const crumbs = current.rec ? `<span>${esc(t(s.name))}</span><span aria-hidden="true">/</span><span>${esc(label)}</span><span aria-hidden="true">/</span><b>${esc(current.rec)}</b>` : `<span>${esc(t(s.name))}</span><span aria-hidden="true">/</span><b>${esc(label)}</b>`;
  $("#top").innerHTML = `<button class="icon-btn menu-btn" type="button" data-action="menu" aria-label="${esc(t("Open menu"))}">${icon("i-menu")}</button>
    <div class="tenant-wrap"><button class="tenant" type="button" data-action="tenant" aria-haspopup="menu" aria-expanded="${tenantOpen}" aria-label="${esc(t("Switch tenant"))}: ${esc(tenantName())}"><span class="mark">${brand().logo ? `<img src="${brand().logo}" alt="" style="width:100%;height:100%;object-fit:contain;border-radius:inherit">` : esc(brand().mark || tenant.mark)}</span><span class="tn"><b>${esc(tenantName())}</b><small>${esc(t("Tenant"))} · ${tenant.systems.length} ${esc(t("systems"))}</small></span><svg class="ico chev faint" aria-hidden="true"><use href="#i-chev"/></svg></button>
      ${tenantOpen ? `<div class="menu" role="menu"><div class="menu-head">${esc(t("Switch tenant"))}</div>${TENANTS.map((x) => `<button class="menu-item" type="button" role="menuitemradio" aria-checked="${x.id === tenant.id}" data-tenant="${x.id}"><span class="mark">${x.mark}</span><span class="tn"><b>${esc(t(x.name))}</b><small>${esc(t(x.sub))} · ${x.systems.length} ${esc(t("systems"))}</small></span>${x.id === tenant.id ? `<span class="ok">${icon("i-check")}</span>` : ""}</button>`).join("")}</div>` : ""}</div>
    <div class="crumbs">${crumbs}</div>
    <button class="search" type="button" data-action="search">${icon("i-search")}<span>${esc(t("Search customers, contracts, accounts, VINs…"))}</span><span class="kbd">⌘K</span></button>
    <span class="daychip"><span class="pulse" aria-hidden="true"></span>${esc(t("Business date"))} <b class="num">${esc(fd(BIZ))}</b> · ${esc(t("no batch window"))}</span>
    <button class="icon-btn" type="button" data-action="lang" lang="${lang === "th" ? "en" : "th"}" aria-label="${lang === "th" ? "Switch to English" : "เปลี่ยนเป็นภาษาไทย"}">${lang === "th" ? "EN" : "ไทย"}</button>
    <button class="icon-btn" type="button" data-action="density" aria-pressed="${density}" aria-label="${esc(t("Compact rows"))}" title="${esc(t("Compact rows"))}">${icon("i-rows")}</button>
    <button class="icon-btn" type="button" data-action="copilot" aria-pressed="${side === "copilot"}" aria-label="Copilot" title="Copilot">${icon("i-spark")}</button>
    <button class="icon-btn" type="button" data-action="inbox" aria-label="${esc(t("Approvals waiting"))}: ${approvals().length}">${icon("i-inbox")}<span class="badge">${approvals().length}</span></button>
    <button class="icon-btn bell" type="button" data-action="notes" aria-pressed="${side === "notes"}" aria-label="${esc(t("Notifications"))}">${icon("i-bell")}${notesUnread ? '<span class="badge">6</span>' : ""}</button>`;
}

function render() {
  const s = sysById[current.sys], label = sectionLabel();
  document.documentElement.lang = lang;
  renderRail(s); renderNav(s); renderTop(s, label);
  const page = current.sys + "/" + current.sec;
  $("#view").innerHTML = current.rec ? RECS[current.rec].view()
    : current.sys === "analytics" && current.sec !== "scheduled" ? viewAnalytics(current.sec)
    : page === "branch/counter" ? viewCounter() : page === "branch/drawer" ? viewDrawer() : page === "account/settings" ? viewSettings()
    : page === "admin/authorities" ? viewAuthorities() : page === "admin/branding" ? viewBranding() : page === "ops/exceptions" ? viewExceptions()
    : page === "lending/overview" ? viewLendingOverview() : page === "collections/overview" ? viewCollectionsOverview() : page === "collections/strategy" ? viewStrategy() : page === "finance/close" ? viewClose() : page === "channels/preview" ? viewApp() : page === "workbench/compare" ? viewCompare()
    : current.sys === "workbench" && current.sec === "today" ? viewToday()
      : current.sys === "workbench" && current.sec === "approvals" ? viewApprovals()
        : current.sys === "customers" && current.sec === "c360" ? viewCustomer360()
          : current.sec === "overview" && OVERVIEW[s.id] ? viewOverview(s)
            : viewList(s, current.sec, label);
  $("#sysFilter").placeholder = t("Switch to… Deposits, Leasing, Treasury");
  $("#palInput").placeholder = t("Search customers, contracts, accounts, screens…");
  $("#palFoot").innerHTML = `<span><span class="kbd">↑</span> <span class="kbd">↓</span> ${esc(t("move"))}</span><span><span class="kbd">Enter</span> ${esc(t("open"))}</span><span><span class="kbd">G</span> ${esc(t("switch system"))}</span>`;
  renderSide();
  renderPresenter();
  // phones: a bottom bar with home, the first pinned systems, every system and this system's sections
  const tb = pins().filter((id) => id !== "workbench").slice(0, 2);
  $("#tabbar").innerHTML = [["workbench", "i-home", t("Workbench"), `data-sys="workbench"`], ...tb.map((id) => [id, sysById[id].icon, t(sysById[id].name), `data-sys="${id}"`]), ["", "i-grid", t("All systems"), `data-action="switcher"`], ["", "i-menu", t("Sections"), `data-action="menu"`]]
    .map(([id, ic, l, attr]) => `<button type="button" ${attr} ${id && id === current.sys ? 'aria-current="true"' : ""}>${icon(ic)}<span>${esc(l)}</span></button>`).join("");
  if (dlg) renderDialog();
}

/* ---------------- switcher ---------------- */
let selIndex = 0;
function renderSwitcher(q = "") {
  const needle = q.trim().toLowerCase();
  const groups = [...new Set(SYS.map((s) => s.group))];
  let n = 0;
  $("#sysGroups").innerHTML = groups.map((g) => {
    const items = SYS.filter((s) => s.group === g && !s.hidden && has(s.id) && (!needle || (s.name + " " + s.desc + " " + t(s.name) + " " + t(s.desc)).toLowerCase().includes(needle)));
    if (!items.length) return "";
    const pinned = pins();
    return `<div class="group"><h3>${esc(t(g))}</h3><div class="sys-grid">${items.map((s) => `<div class="sys-card-wrap"><button class="sys-card${n++ === selIndex ? " sel" : ""}" type="button" data-sys="${s.id}" aria-current="${s.id === current.sys}"><span class="tile">${icon(s.icon)}</span><span style="min-width:0"><span class="name">${esc(t(s.name))}</span><span class="desc">${esc(t(s.desc))}</span></span></button><button class="pin" type="button" data-pin="${s.id}" aria-pressed="${pinned.includes(s.id)}" aria-label="${esc(t(pinned.includes(s.id) ? "Unpin from rail" : "Pin to rail"))}: ${esc(t(s.name))}" title="${esc(t(pinned.includes(s.id) ? "Unpin from rail" : "Pin to rail"))}">${icon("i-pin")}</button></div>`).join("")}</div></div>`;
  }).join("") || '<p class="muted" style="padding:8px">No system matches. Try "loans", "fx" or "ledger".</p>';
}
function openSwitcher() { selIndex = 0; $("#sysFilter").value = ""; renderSwitcher(); $("#switcher").hidden = false; $("#sysFilter").focus(); }
function closeOverlays() { $("#switcher").hidden = true; $("#palette").hidden = true; }

/* ---------------- command palette ---------------- */
const RECORDS = [["LN-A-C10 · Somchai Prasert", "lending", "loans", "Loan · 144 days late", "LN-A-C10"], ["LN-77120 · Anan Chaiyo", "lending", "loans", "Home loan · active", "LN-77120"], ["FAC-B2031 · Siam Freight Logistics", "lending", "facilities", "Credit facilities · ฿120m umbrella", "FAC-B2031"], ["New loan application", "lending", "applications", "Product to disbursement", "APP-30416"], ["APP-30409 · Kittisak Wongsawat", "lending", "credit", "Credit review · home loan", "APP-30409"], ["CC-2026-21 · Credit committee", "lending", "committee", "18 Nov 2026 · 3 items", "CC-2026-21"], ["LN-A-C11 · Malee Wongsa", "collections", "queue", "Collections case · 65 days late", "LN-A-C11"], ["LN-A-C14 · Kittipong Siri", "collections", "legal", "Legal case and write-off", "LN-A-C14"], ["R-A4 · Mitsubishi Triton", "collections", "repossessions", "Repossession · auction 7 Nov", "R-A4"], ["DSB-30409 · Kittisak Wongsawat", "lending", "disbursements", "Disbursement · transfer 15 Nov", "DSB-30409"], ["Retail credit policy", "products", "policy", "Limits the bank sets · POL-RETAIL", "POL-RETAIL"], ["ECL-2026-10 · Loss allowance", "finance", "ecl", "October run · TFRS 9", "ECL-2026-10"], ["REC-2026-10 · Reconciliation", "finance", "recon", "Sub-ledgers against the GL", "REC-2026-10"], ["DS-LOAN-2026-10 · BOT loan data set", "finance", "reports", "Due 15 Nov 2026", "DS-LOAN-2026-10"], ["AO-26-0412 · Lanna Craft Export", "deposits", "opening", "Business account opening · KYC", "AO-26-0412"], ["ORD-26-0191 · AMLO freeze", "deposits", "orders", "CUR-B2087 · do not tell the customer", "ORD-26-0191"], ["SAV-30988 · Prapai Somsri", "deposits", "dormant", "Dormant account", "SAV-30988"], ["TD-88201 · Anan Chaiyo", "deposits", "term", "Matures 3 Nov", "TD-88201"], ["Somchai Prasert · C10", "customers", "directory", "Customer · retail", "C10"], ["Siam Freight Logistics", "customers", "c360", "Customer · B-2031"], ["FP-DEMO · Bangna Motors", "leasing", "floorplan", "Floor plan line · 63% in use", "FP-DEMO"],
  ["MR0HA3CD5P0100013", "leasing", "floorplan", "Vehicle on FP-DEMO · sold", "FP-DEMO"], ["HP-2025-004812 · Napat Srisuk", "leasing", "hp", "Hire purchase · Hilux Revo", "HP-2025-004812"], ["TPL-HP-VEHICLE", "products", "master", "Product template", "TPL-HP-VEHICLE"], ["AUTO_HP_USED v2", "products", "builder", "Product draft · in review", "AUTO_HP_USED_v2"], ["SAV-C14", "deposits", "accounts", "Savings · ฿1,003,806.11"], ["LC-26-0412", "trade", "lc", "Import LC · $2,400,000.00"], ["ITMX 24 Oct 05:00", "payments", "recon", "1 break · ฿4,200.00"], ["Settings", "account", "settings", "Your appearance, language and notifications"]];
let palItems = [], palSel = 0;
function renderPalette(q = "") {
  const needle = q.trim().toLowerCase();
  const recs = RECORDS.filter(([title, sid, , d]) => has(sid) && (!needle || (title + " " + d).toLowerCase().includes(needle))).slice(0, 5).map(([title, sid, sec, d, rec]) => ({ title, d, sid, sec, rec }));
  const screens = SYS.filter((s) => has(s.id)).flatMap((s) => s.sections.map(([k, l]) => ({ title: t(l), d: t(s.name), sid: s.id, sec: k, raw: l + " " + s.name }))).filter((x) => !needle || (x.title + " " + x.d + " " + x.raw).toLowerCase().includes(needle)).slice(0, needle ? 8 : 5);
  palItems = recs.concat(screens);
  palSel = Math.min(palSel, Math.max(0, palItems.length - 1));
  let i = 0;
  const row = (x) => `<button class="pal-item${i === palSel ? " sel" : ""}" type="button" data-i="${i++}"><span class="tile">${icon(sysById[x.sid].icon)}</span><span>${esc(x.title)}</span><small>${esc(x.d)}</small></button>`;
  $("#palList").innerHTML = (recs.length ? `<div class="pal-sec">${esc(t("Records"))}</div>${recs.map(row).join("")}` : "") + (screens.length ? `<div class="pal-sec">${esc(t("Go to"))}</div>${screens.map(row).join("")}` : "") || '<p class="muted" style="padding:12px">Nothing matches. Search by name, id, VIN or account.</p>';
}
function openPalette() { palSel = 0; $("#palInput").value = ""; renderPalette(); $("#palette").hidden = false; $("#palInput").focus(); }

/* ---------------- quick-look drawer ---------------- */
function openDrawer(title, sysId, cells, cols, rec) {
  const s = sysById[sysId];
  $("#drawerHost").innerHTML = `<div class="overlay" style="padding:0" data-close></div><aside class="drawer" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <div class="drawer-head"><span class="tile">${icon(s.icon)}</span><div style="min-width:0"><div class="eyebrow" style="margin-bottom:2px">${esc(t(s.name))}</div><h2 style="font-family:var(--font-display);font-size:22px;letter-spacing:-0.02em">${esc(title)}</h2></div><button class="icon-btn" type="button" data-close aria-label="${esc(t("Close"))}" style="margin-left:auto">${icon("i-close")}</button></div>
    <div class="drawer-body"><dl class="kv">${cols.map((c, i) => `<dt>${esc(t(c))}</dt><dd>${cells[i]}</dd>`).join("")}</dl>${rec ? "" : `<p class="note">${esc(t("In this concept, LN-A-C10 has a full record page. Other records open this quick look."))}</p>`}</div>
    <div class="drawer-foot"><button class="btn" type="button" data-close>${esc(t("Close"))}</button>${rec ? `<button class="btn primary" type="button" data-rec="${rec}">${esc(RECS[rec].label)} ${icon("i-arrow")}</button>` : ""}</div></aside>`;
  $("#drawerHost .icon-btn[data-close]")?.focus();
}

/* ---------------- events ---------------- */
// chart hover: the value under the pointer, against the same day last year
document.addEventListener("pointermove", (e) => {
  const wrap = e.target.closest?.(".chart-wrap");
  document.querySelectorAll(".chart-tip, .chart-line").forEach((n) => { if (!wrap || !wrap.contains(n)) n.remove(); });
  if (!wrap) return;
  const tips = JSON.parse(wrap.dataset.tips), box = wrap.getBoundingClientRect(), sc = box.width / 640, L = 46 * sc, W = (640 - 46 - 14) * sc;
  const i = Math.max(0, Math.min(tips.length - 1, Math.round(((e.clientX - box.left - L) / W) * (tips.length - 1)))), px = L + (i / (tips.length - 1)) * W;
  let tip = wrap.querySelector(".chart-tip"), line = wrap.querySelector(".chart-line");
  if (!tip) { tip = document.createElement("div"); tip.className = "chart-tip"; line = document.createElement("div"); line.className = "chart-line"; wrap.append(line, tip); }
  line.style.left = px + "px"; tip.style.left = Math.max(70, Math.min(box.width - 70, px)) + "px";
  tip.innerHTML = `${esc(tips[i][0])} · <b>${esc(tips[i][1])}</b> <span style="opacity:.7">${esc(tt("last year", "ปีก่อน"))} ${esc(tips[i][2])}</span>`;
});
document.addEventListener("submit", (e) => {
  if (e.target.id === "chatForm") { e.preventDefault(); const v = $("#chatIn").value.trim(); if (v) ask(null, v); }
  if (e.target.id === "signForm") { e.preventDefault(); if (!$("#sid").value.trim() || !$("#spw").value) { signNote = tt("Enter your staff ID and password.", "ใส่รหัสพนักงานและรหัสผ่าน"); renderSignin(); return; } signStep = "mfa"; renderSignin(); }
  if (e.target.id === "otpForm") { e.preventDefault(); const code = [...document.querySelectorAll("[data-otp]")].map((i) => i.value).join(""); if (!/^\d{6}$/.test(code)) { $("#otpErr").textContent = tt("Enter all six digits.", "ใส่ให้ครบ 6 หลัก"); return; } finishSignin(); }
});
// the code boxes move forward as you type, back on Backspace, and take a pasted code
document.addEventListener("input", (e) => { const i = e.target.dataset?.otp; if (i === undefined) return; e.target.value = e.target.value.replace(/\D/g, "").slice(-1); if (e.target.value && +i < 5) $(`[data-otp="${+i + 1}"]`).focus(); });
document.addEventListener("paste", (e) => { if (e.target.dataset?.otp === undefined) return; const d = (e.clipboardData.getData("text") || "").replace(/\D/g, "").slice(0, 6); if (!d) return; e.preventDefault(); [...d].forEach((c, k) => { const box = $(`[data-otp="${k}"]`); if (box) box.value = c; }); $(`[data-otp="${Math.min(5, d.length)}"]`)?.focus(); });
document.addEventListener("keydown", (e) => { const i = e.target.dataset?.otp; if (i !== undefined && e.key === "Backspace" && !e.target.value && +i > 0) $(`[data-otp="${+i - 1}"]`).focus(); });
// row selection for bulk actions
function updateBulk(cardEl) {
  const picks = [...cardEl.querySelectorAll("input[data-pick]")], on = picks.filter((p) => p.checked), bar = cardEl.querySelector(".bulkbar"), all = cardEl.querySelector("[data-pickall]");
  if (all) { all.checked = on.length > 0 && on.length === picks.length; all.indeterminate = on.length > 0 && on.length < picks.length; }
  if (bar) { bar.hidden = !on.length; bar.querySelector("[data-count]").textContent = tt(`${on.length} selected`, `เลือก ${on.length} รายการ`); }
}
document.addEventListener("change", (e) => {
  if (e.target.matches("[data-pickall]")) { const c = e.target.closest(".card"); c.querySelectorAll("tr:not([hidden]) input[data-pick]").forEach((p) => { p.checked = e.target.checked; }); updateBulk(c); }
  if (e.target.matches("[data-pick]")) updateBulk(e.target.closest(".card"));
});
document.addEventListener("click", (e) => {
  if (e.target.matches?.("input[type=checkbox]")) return;
  const pickCell = e.target.closest?.("td.pick, th.pick"); if (pickCell) { pickCell.querySelector("input").click(); return; }
  const bulkBtn = e.target.closest?.("[data-bulk]");
  if (bulkBtn) {
    const c = bulkBtn.closest(".card"), ids = [...c.querySelectorAll("input[data-pick]:checked")].map((p) => p.dataset.pick);
    if (bulkBtn.dataset.bulk === "clear") { c.querySelectorAll("input[data-pick]").forEach((p) => { p.checked = false; }); updateBulk(c); return; }
    openFlow("bulk", bulkBtn.dataset.bulk + "|" + ids.join(",")); return;
  }
  if (tenantOpen && !e.target.closest(".tenant-wrap")) { tenantOpen = false; renderTop(sysById[current.sys], sectionLabel()); }
  if (roleOpen && !e.target.closest(".role-menu, [data-action=role]")) { roleOpen = false; renderRail(sysById[current.sys]); }
  const el = e.target.closest("button, tr, [data-close]");
  if (!el) { if (e.target === $("#switcher") || e.target === $("#palette")) closeOverlays(); return; }
  if (el.dataset.dlg) return dialogAction(el.dataset.dlg);
  if (el.dataset.tour) { if (el.dataset.tour === "end") endTour(); else tourGo(+el.dataset.tour); return; }
  if (el.dataset.action === "tour") { tourGo(0); return; }
  if (el.dataset.action === "customize") { editingWb = !editingWb; render(); $("[data-action=customize]")?.focus(); return; }
  if (el.dataset.wb) { wbAction(el.dataset.wb, el.dataset.key); return; }
  if (el.dataset.sign === "sso") { el.disabled = true; el.textContent = tt("Redirecting to bank SSO…", "กำลังไปยัง SSO ของธนาคาร…"); setTimeout(finishSignin, 700); return; }
  if (el.dataset.sign === "back") { signStep = "id"; renderSignin(); return; }
  if (el.dataset.action === "lock") { roleOpen = false; signOut(tt("Screen locked. Sign in again to continue where you were.", "ล็อกหน้าจอแล้ว เข้าสู่ระบบอีกครั้งเพื่อทำต่อ")); render(); return; }
  if (el.dataset.action === "signout") { roleOpen = false; signOut(tt("You signed out.", "ออกจากระบบแล้ว")); render(); return; }
  if (el.dataset.flow) { openFlow(el.dataset.flow, el.dataset.arg); return; }
  if (el.dataset.pstep !== undefined) { presentStep = +el.dataset.pstep; closeDialog(); side = null; PRESENT[presentStep][2](); renderPresenter(); return; }
  if (el.dataset.swatch) { $("#bcolor").value = el.dataset.swatch; document.querySelectorAll("[data-swatch]").forEach((s) => s.setAttribute("aria-pressed", String(s === el))); return; }
  if (el.dataset.closeStep) { closeDone.add(el.dataset.closeStep); render(); toast(tt("Step marked done.", "ทำเครื่องหมายเสร็จแล้ว"), "good"); return; }
  if (el.dataset.app) {
    if (el.dataset.app === "paid" && !appPaid) { appPaid = true; STREAM.unshift(["Loan instalment", "LN-A-C10", LOAN.pay, new Date().toTimeString().slice(0, 5)]); toast(tt(`App payment of ${baht(LOAN.pay)} landed on LN-A-C10 and in the live postings.`, `การชำระ ${baht(LOAN.pay)} จากแอปเข้า LN-A-C10 และรายการบัญชีสดแล้ว`), "good"); }
    appScreen = el.dataset.app; render(); $(".phone-screen button")?.focus(); return;
  }
  if (el.dataset.ask !== undefined) { ask(+el.dataset.ask); return; }
  if (el.dataset.pin) { togglePin(el.dataset.pin); renderSwitcher($("#sysFilter").value); renderRail(sysById[current.sys]); return; }
  if (el.dataset.role) { role = ROLES.find((r) => r.id === el.dataset.role); store.set("fabor.role", role.id); roleOpen = false; go("workbench", "today"); return; }
  if (el.dataset.set) {
    const root = document.documentElement, v = el.dataset.val;
    if (el.dataset.set === "style") { if (v === "calm") root.setAttribute("data-style", "calm"); else root.removeAttribute("data-style"); store.set("fabor.style", v); }
    if (el.dataset.set === "theme") { if (v === "system") root.removeAttribute("data-theme"); else root.setAttribute("data-theme", v); store.set("fabor.theme", v); }
    if (el.dataset.set === "density") { if (v === "compact") root.setAttribute("data-density", "compact"); else root.removeAttribute("data-density"); store.set("fabor.density", v === "compact" ? "compact" : ""); }
    if (el.dataset.set === "lang") { lang = v; store.set("fabor.lang", v); }
    if (el.dataset.set === "start") store.set("fabor.start", v);
    render(); $(`[data-set="${el.dataset.set}"][data-val="${v}"]`)?.focus(); return;
  }
  if (el.dataset.go && el.dataset.go.startsWith("rec:")) { closeOverlays(); go(null, null, el.dataset.go.slice(4)); return; }
  if (el.matches("[data-close]")) { $("#drawerHost").innerHTML = ""; return; }
  if (el.dataset.tenant) { tenant = TENANTS.find((x) => x.id === el.dataset.tenant); store.set("fabor.tenant", tenant.id); tenantOpen = false; if (!has(current.sys)) go("workbench"); else render(); return; }
  if (el.closest("#switcher") && el.dataset.sys) { closeOverlays(); go(el.dataset.sys); return; }
  if (el.closest("#palList") && el.dataset.i) { const x = palItems[+el.dataset.i]; closeOverlays(); go(x.sid, x.sec, x.rec || null); return; }
  if (el.dataset.rec) { closeOverlays(); go(null, null, el.dataset.rec); return; }
  if (el.dataset.sys) { go(el.dataset.sys); return; }
  if (el.dataset.sec) { go(current.sys, el.dataset.sec); return; }
  if (el.dataset.go) { const [a, b] = el.dataset.go.split("/"); go(a, b); return; }
  if (el.dataset.tab) { current.tab = el.dataset.tab; render(); $(`#tab-${current.tab}`)?.focus(); return; }
  if (el.dataset.act) { openDialog(el.dataset.act); return; }
  if (el.dataset.state !== undefined && el.closest(".seg")) {
    el.parentElement.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b === el)));
    applyFilter(el.closest(".card"));
    return;
  }
  const a = el.dataset.action;
  if (a === "role") { roleOpen = !roleOpen; renderRail(sysById[current.sys]); $(".role-menu .menu-item")?.focus(); return; }
  if (a === "history") { side = side === "history" ? null : "history"; render(); $("[data-action=history]")?.focus(); return; }
  if (a === "presenter") { presenting = !presenting; roleOpen = false; render(); $(".presenter [data-pstep]")?.focus(); return; }
  if (a === "reset") { resetDemo(); return; }
  if (a === "present-full" || a === "present-exec") { presentExec = a === "present-exec"; presentStep = -1; renderPresenter(); return; }
  if (a === "app-reset") { appScreen = "home"; appPaid = false; render(); return; }
  if (a === "brand-apply" || a === "brand-clear") {
    const b = a === "brand-clear" ? {} : { ...brand(), name: $("#bname").value.trim(), mark: $("#bmark").value.trim().toUpperCase().slice(0, 3), color: $("#bcolor").value };
    store.set(`fabor.brand.${tenant.id}`, JSON.stringify(b)); applyBrand(); render();
    toast(a === "brand-clear" ? tt("Back to Fabor branding.", "กลับเป็นแบรนด์ Fabor แล้ว") : tt(`The console now wears ${b.name}'s colours.`, `คอนโซลใช้สีของ${b.name}แล้ว`), "good"); return;
  }
  if (a === "copilot" || a === "notes") { side = side === a ? null : a; if (a === "notes") notesUnread = false; render(); (side === "copilot" ? $("#chatIn") : $(`[data-action=${a}]`))?.focus(); return; }
  if (a === "close-side") { side = null; render(); return; }
  if (a === "retry") { delete listError[el.dataset.list]; seenLists.delete(el.dataset.list); render(); return; }
  if (a === "clear-filter") { const c = el.closest(".card"); c.querySelector("[data-filter]").value = ""; c.querySelector(".seg [data-state='']")?.click(); applyFilter(c); c.querySelector("[data-filter]").focus(); return; }
  if (a === "save-view") {
    const c = el.closest(".card"), q = c.querySelector("[data-filter]").value.trim(), st = c.querySelector(".seg [aria-pressed=true]")?.dataset.state || "";
    const name = [sectionLabel(), st, q && `“${q}”`].filter(Boolean).join(" · ");
    const views = savedViews(); views.push({ sys: current.sys, sec: current.sec, q, st, name }); store.set(viewKey(), JSON.stringify(views.slice(-8)));
    renderNav(sysById[current.sys]); toast(tt(`View saved under ${t(sysById[current.sys].name)}: ${name}`, `บันทึกมุมมองไว้ใน${t(sysById[current.sys].name)}: ${name}`), "good"); return;
  }
  if (a === "period") { chartDays = +el.dataset.days; render(); $(`[data-action=period][data-days="${chartDays}"]`)?.focus(); return; }
  if (el.dataset.view !== undefined) { const v = savedViews()[+el.dataset.view]; go(v.sys, v.sec); setTimeout(() => applySaved(v), 500); return; }
  if (el.dataset.journal !== undefined) { openJournal(+el.dataset.journal); return; }
  if (a === "switcher") return openSwitcher();
  if (a === "search") return openPalette();
  if (a === "inbox") return go("workbench", "approvals");
  if (a === "tenant") { tenantOpen = !tenantOpen; renderTop(sysById[current.sys], sectionLabel()); $(".menu-item[aria-checked=true]")?.focus(); return; }
  if (a === "lang") { lang = lang === "th" ? "en" : "th"; store.set("fabor.lang", lang); render(); $("[data-action=lang]")?.focus(); return; }
  if (a === "density") { const root = document.documentElement, on = root.getAttribute("data-density") !== "compact"; if (on) root.setAttribute("data-density", "compact"); else root.removeAttribute("data-density"); store.set("fabor.density", on ? "compact" : ""); render(); $("[data-action=density]")?.focus(); return; }
  if (a === "menu") { $("#app").classList.add("open"); const sc = document.createElement("div"); sc.className = "scrim-nav"; sc.addEventListener("click", () => { $("#app").classList.remove("open"); sc.remove(); }); document.body.appendChild(sc); return; }
  if (a === "theme") { const root = document.documentElement, dark = root.getAttribute("data-theme") === "dark" || (!root.hasAttribute("data-theme") && matchMedia("(prefers-color-scheme: dark)").matches); root.setAttribute("data-theme", dark ? "light" : "dark"); store.set("fabor.theme", dark ? "light" : "dark"); return; }
  if (el.tagName === "TR" && el.dataset.row !== undefined) { const spec = lists()[current.sys + "/" + current.sec]; const row = spec.rows[+el.dataset.row]; openDrawer(row[0].replace(/<[^>]+>/g, ""), current.sys, row, spec.cols); return; }
  if (el.tagName === "TR" && el.dataset.approval !== undefined) { const ap = APPROVALS[+el.dataset.approval]; openDrawer(t(ap[1]), ap[0], [esc(t(ap[2])), esc(t(ap[3])), P(ap[4], "Waiting for you")], ["Maker", "What it does", "State"], { products: "AUTO_HP_USED_v2", leasing: "FP-DEMO" }[ap[0]]); return; }
});
document.addEventListener("keydown", (e) => {
  if (!signedIn) return;
  if (tourStep !== null) { if (e.key === "Escape") endTour(); if (e.key === "ArrowRight") tourGo(tourStep + 1); if (e.key === "ArrowLeft") tourGo(tourStep - 1); return; }
  const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || "");
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); if (!dlg) openPalette(); return; }
  if (e.key === "Escape") {
    if (dlg) return closeDialog();
    if (tenantOpen || roleOpen) { tenantOpen = roleOpen = false; render(); return; }
    if (!$("#switcher").hidden || !$("#palette").hidden || $("#drawerHost").innerHTML) { closeOverlays(); $("#drawerHost").innerHTML = ""; return; }
    if (side) { side = null; render(); }
    return;
  }
  if (dlg) {
    if (e.key === "Enter" && document.activeElement?.id === "confirmId") { e.preventDefault(); if (!$("#dlgConfirm").disabled) dialogAction("confirm"); }
    else if (e.key === "Enter" && document.activeElement?.tagName === "INPUT" && document.activeElement.type !== "radio") { e.preventDefault(); $("#dialogHost [data-dlg=next]")?.click(); }
    return;
  }
  if (!typing && e.key.toLowerCase() === "g" && !e.metaKey && !e.ctrlKey && $("#switcher").hidden && $("#palette").hidden) { e.preventDefault(); openSwitcher(); return; }
  if (!typing && e.key === "/") { e.preventDefault(); openPalette(); return; }
  // keyboard queue: J and K move through rows, P and L act on the focused loan
  if (!typing && !e.metaKey && !e.ctrlKey && /^[jkpl]$/i.test(e.key) && $("#switcher").hidden && $("#palette").hidden) {
    const rows = [...document.querySelectorAll("#view tbody tr.click:not([hidden])")], i = rows.indexOf(document.activeElement), k = e.key.toLowerCase();
    if ((k === "j" || k === "k") && rows.length) { e.preventDefault(); rows[k === "j" ? Math.min(rows.length - 1, i + 1) : Math.max(0, i - 1)].focus(); return; }
    if (i >= 0 && current.sys === "collections") { e.preventDefault(); if (k === "p") openDialog("promise"); if (k === "l") openFlow("logContact"); return; }
  }
  if (e.key === "Enter" && document.activeElement?.tagName === "TR") { document.activeElement.click(); return; }
  if (document.activeElement?.getAttribute("role") === "tab" && (e.key === "ArrowRight" || e.key === "ArrowLeft")) {
    const tabs = [...document.querySelectorAll("[role=tab]")], i = tabs.indexOf(document.activeElement), nx = tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
    current.tab = nx.dataset.tab; render(); $(`#tab-${current.tab}`)?.focus(); return;
  }
  if (!$("#switcher").hidden) {
    const cards = [...document.querySelectorAll("#sysGroups .sys-card")];
    if (e.key === "ArrowDown" || e.key === "ArrowRight") { e.preventDefault(); selIndex = Math.min(cards.length - 1, selIndex + 1); renderSwitcher($("#sysFilter").value); }
    if (e.key === "ArrowUp" || e.key === "ArrowLeft") { e.preventDefault(); selIndex = Math.max(0, selIndex - 1); renderSwitcher($("#sysFilter").value); }
    if (e.key === "Enter" && cards[selIndex]) { e.preventDefault(); closeOverlays(); go(cards[selIndex].dataset.sys); }
  }
  if (!$("#palette").hidden) {
    if (e.key === "ArrowDown") { e.preventDefault(); palSel = Math.min(palItems.length - 1, palSel + 1); renderPalette($("#palInput").value); }
    if (e.key === "ArrowUp") { e.preventDefault(); palSel = Math.max(0, palSel - 1); renderPalette($("#palInput").value); }
    if (e.key === "Enter" && palItems[palSel]) { e.preventDefault(); const x = palItems[palSel]; closeOverlays(); go(x.sid, x.sec, x.rec || null); }
  }
});
$("#sysFilter").addEventListener("input", (e) => { selIndex = 0; renderSwitcher(e.target.value); });
$("#palInput").addEventListener("input", (e) => { palSel = 0; renderPalette(e.target.value); });
document.addEventListener("input", (e) => {
  if (e.target.id === "confirmId") { $("#dlgConfirm").disabled = e.target.value.trim().toUpperCase() !== $("#dlgConfirm").dataset.typed.toUpperCase(); return; }
  if (e.target.dataset.note) { store.set("fabor.note." + e.target.dataset.note, String(e.target.checked)); return; }
  if (e.target.dataset.whatif !== undefined) {
    const term = +$("#wiTerm").value, rate = +$("#wiRate").value;
    $("#wiTermV").textContent = term; $("#wiRateV").textContent = rate.toFixed(2); $("#wiOut").innerHTML = whatIfOut(whatIf(term, rate)); return;
  }
  if (e.target.matches("[data-filter]")) applyFilter(e.target.closest(".card"));
});
// text filter and state segment together, with an empty state when nothing is left
function applyFilter(cardEl) {
  const q = (cardEl.querySelector("[data-filter]")?.value || "").toLowerCase(), st = cardEl.querySelector(".seg [aria-pressed=true]")?.dataset.state || "";
  let shown = 0;
  cardEl.querySelectorAll("tbody tr:not(.empty-row)").forEach((tr) => { tr.hidden = (!!q && !tr.textContent.toLowerCase().includes(q)) || (!!st && tr.lastElementChild.textContent.trim() !== st); if (!tr.hidden) shown++; });
  const em = cardEl.querySelector(".empty-row"); if (em) em.hidden = shown > 0;
}
document.addEventListener("change", (e) => { if (dlg && e.target.name === "from") dlg.from = e.target.value; });

const savedTheme = store.get("fabor.theme");
if (savedTheme === "light" || savedTheme === "dark") document.documentElement.setAttribute("data-theme", savedTheme);
if (store.get("fabor.density") === "compact") document.documentElement.setAttribute("data-density", "compact");
if (store.get("fabor.style") === "calm") document.documentElement.setAttribute("data-style", "calm");
// a logo picked on the Branding page is kept as a data URL, small enough for browser storage
document.addEventListener("change", (e) => {
  if (e.target.id !== "blogo" || !e.target.files[0]) return;
  const f = e.target.files[0];
  if (f.size > 300 * 1024) { toast(tt("Use a logo under 300 KB.", "ใช้โลโก้ขนาดไม่เกิน 300 KB"), "warn"); return; }
  const rd = new FileReader();
  rd.onload = () => { store.set(`fabor.brand.${tenant.id}`, JSON.stringify({ ...brand(), logo: rd.result })); render(); };
  rd.readAsDataURL(f);
});
applyBrand();
renderSignin();
const start = (location.hash || "").replace("#", "");
if (RECS[start]) go(null, null, start);
else if (sysById[start]) go(start);
else go(store.get("fabor.start") === "last" && sysById[store.get("fabor.last")] ? store.get("fabor.last") : "workbench");

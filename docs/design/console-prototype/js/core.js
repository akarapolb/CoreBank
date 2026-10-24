// Fabor console prototype · Helpers, storage, language and dates.
// Classic scripts sharing one global scope; load order is set in index.html.
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const r2 = (x) => Math.round(x * 100) / 100;
const baht = (n, d = 2) => (n < 0 ? "−" : "") + "฿" + Math.abs(Number(n)).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
const icon = (id) => `<svg class="ico" aria-hidden="true"><use href="#${id}"/></svg>`;
// per-viewer preferences; kept in memory too, so the page works where storage is blocked
const mem = {};
const store = { get(k) { try { const v = localStorage.getItem(k); if (v !== null) return v; } catch {} return k in mem ? mem[k] : null; }, set(k, v) { mem[k] = v; try { localStorage.setItem(k, v); } catch {} } };

/* ---------------- language ---------------- */
let lang = store.get("fabor.lang") === "th" ? "th" : "en";
const TH = {
  // systems and groups
  "Workbench": "โต๊ะทำงาน", "Your work across every system": "งานของคุณในทุกระบบ",
  "Customers": "ลูกค้า", "Parties, KYC and every relationship": "ข้อมูลลูกค้า KYC และทุกความสัมพันธ์",
  "Deposits": "เงินฝาก", "Savings, current and term deposits": "ออมทรัพย์ กระแสรายวัน และฝากประจำ",
  "Lending": "สินเชื่อ", "Applications, loans and servicing": "ใบสมัคร สัญญาเงินกู้ และงานบริการ",
  "Leasing & Asset Finance": "ลีสซิ่งและสินเชื่อสินทรัพย์", "Leases, hire purchase, fleet, floor plan": "สัญญาเช่า เช่าซื้อ ฟลีต และฟลอร์แพลน",
  "Collections & Recovery": "ติดตามหนี้และเรียกคืน", "Arrears, promises, repossession": "ค้างชำระ นัดชำระ และยึดทรัพย์",
  "Payments": "การชำระเงิน", "PromptPay, transfers, reconciliation": "พร้อมเพย์ การโอน และกระทบยอด",
  "Trade Finance": "สินเชื่อการค้าต่างประเทศ", "Letters of credit and guarantees": "เลตเตอร์ออฟเครดิตและหนังสือค้ำประกัน",
  "Treasury": "บริหารเงิน", "Liquidity, FX and nostro": "สภาพคล่อง ปริวรรตเงินตรา และบัญชีนอสโตร",
  "Syndication": "สินเชื่อร่วม", "Agency, participations and fees": "ตัวแทนสินเชื่อ ส่วนร่วม และค่าธรรมเนียม",
  "Product Factory": "โรงงานผลิตภัณฑ์", "Design, simulate and approve products": "ออกแบบ จำลอง และอนุมัติผลิตภัณฑ์",
  "Finance & Risk": "การเงินและความเสี่ยง", "Ledger, GL, loss allowance, reporting": "บัญชีแยกประเภท ค่าเผื่อผลขาดทุน และรายงาน",
  "Operations": "ปฏิบัติการ", "Scheduler, audit and incidents": "ตัวจัดตารางงาน ประวัติการตรวจสอบ และเหตุขัดข้อง",
  "AI Agents": "เอเจนต์ AI", "Proposals checked by people and policy": "ข้อเสนอที่ผ่านการตรวจโดยคนและนโยบาย",
  "Admin": "ผู้ดูแลระบบ", "Users, roles, tenants, integrations": "ผู้ใช้ บทบาท ผู้เช่าระบบ และการเชื่อมต่อ",
  "Everyday": "ใช้งานประจำวัน", "Retail & business banking": "ธนาคารรายย่อยและธุรกิจ", "Corporate & markets": "ลูกค้าองค์กรและตลาดเงิน", "Control": "การควบคุม",
  // sections
  "Today": "วันนี้", "Approvals": "รออนุมัติ", "My tasks": "งานของฉัน", "Recently viewed": "ดูล่าสุด", "Overview": "ภาพรวม",
  "Customer 360": "ลูกค้า 360", "Directory": "รายชื่อลูกค้า", "Onboarding": "เปิดความสัมพันธ์", "KYC reviews": "ทบทวน KYC",
  "Accounts": "บัญชี", "Term deposits": "เงินฝากประจำ", "Interest and fees": "ดอกเบี้ยและค่าธรรมเนียม", "Statements": "รายการเดินบัญชี",
  "Applications": "ใบสมัคร", "Loans": "สัญญาเงินกู้", "Restructuring": "ปรับโครงสร้างหนี้", "Disbursements": "การเบิกจ่าย",
  "Leases": "สัญญาเช่า", "Hire purchase": "เช่าซื้อ", "Fleet agreements": "สัญญาฟลีต", "Floor plan": "ฟลอร์แพลน", "Assets": "ทรัพย์สิน", "Dealers": "ดีลเลอร์",
  "Queue": "คิวงาน", "Promises": "นัดชำระ", "Repossessions": "ยึดทรัพย์", "Write-offs": "ตัดหนี้สูญ",
  "Transfers": "การโอน", "PromptPay": "พร้อมเพย์", "Reconciliation": "กระทบยอด", "Limits": "วงเงิน",
  "Letters of credit": "เลตเตอร์ออฟเครดิต", "Guarantees": "หนังสือค้ำประกัน", "Documentary collections": "ตั๋วเรียกเก็บ",
  "Liquidity": "สภาพคล่อง", "FX positions": "ฐานะเงินตราต่างประเทศ", "Nostro accounts": "บัญชีนอสโตร",
  "Deals": "ดีล", "Participants": "ผู้ร่วมให้กู้", "Fees": "ค่าธรรมเนียม", "Catalogue": "แคตตาล็อก", "Builder": "ตัวสร้าง", "Simulations": "การจำลอง",
  "General ledger": "บัญชีแยกประเภททั่วไป", "Loss allowance": "ค่าเผื่อผลขาดทุน", "Sub-ledger vs GL": "บัญชีย่อยเทียบ GL", "Regulatory reports": "รายงานทางการ",
  "Scheduler": "ตัวจัดตารางงาน", "Audit trail": "ประวัติการตรวจสอบ", "Incidents": "เหตุขัดข้อง", "Proposals": "ข้อเสนอ", "Policies": "นโยบาย", "Activity": "กิจกรรม",
  "Users and roles": "ผู้ใช้และบทบาท", "Tenants": "ผู้เช่าระบบ", "Integrations": "การเชื่อมต่อ", "Settings": "การตั้งค่า",
  // shell
  "Search customers, contracts, accounts, VINs…": "ค้นหาลูกค้า สัญญา บัญชี เลขตัวถัง…", "Business date": "วันทำการ", "no batch window": "ไม่มีช่วงปิดระบบ",
  "Recently used": "ใช้ล่าสุด", "Systems you open appear here.": "ระบบที่คุณเปิดจะแสดงที่นี่", "Switch system": "สลับระบบ", "All systems": "ทุกระบบ",
  "Light or dark": "สว่างหรือมืด", "Compact rows": "แถวกระชับ", "Approvals waiting": "รออนุมัติ", "Notifications": "การแจ้งเตือน", "Open menu": "เปิดเมนู",
  "Tenant": "ผู้เช่าระบบ", "Switch tenant": "สลับผู้เช่าระบบ", "systems": "ระบบ", "Sections": "หัวข้อ",
  "Switch to… Deposits, Leasing, Treasury": "สลับไปที่… เงินฝาก ลีสซิ่ง บริหารเงิน", "Search customers, contracts, accounts, screens…": "ค้นหาลูกค้า สัญญา บัญชี หน้าจอ…",
  "Records": "รายการ", "Go to": "ไปที่", "move": "เลื่อน", "open": "เปิด", "switch system": "สลับระบบ",
  "Demo Virtual Bank": "ธนาคารดิจิทัล (เดโม)", "Demo Retail Bank": "ธนาคารรายย่อย (เดโม)", "Demo Commercial Bank": "ธนาคารพาณิชย์ (เดโม)",
  "Digital only, retail and SME": "ดิจิทัลล้วน รายย่อยและ SME", "Branches, retail lending and auto finance": "สาขา สินเชื่อรายย่อย และสินเชื่อรถยนต์", "Corporate, trade and markets": "ลูกค้าองค์กร การค้า และตลาดเงิน",
  // common
  "Export": "ส่งออก", "See all": "ดูทั้งหมด", "Open": "เปิด", "All": "ทั้งหมด", "Show": "แสดง", "Close": "ปิด", "Filter by id, name or amount": "กรองด้วยรหัส ชื่อ หรือจำนวนเงิน",
  "Onboard customer": "เปิดลูกค้าใหม่", "Open account": "เปิดบัญชี", "New application": "ใบสมัครใหม่", "Book a lease": "ทำสัญญาเช่า", "Assign queue": "มอบหมายคิว", "New transfer": "โอนเงินใหม่",
  "Issue LC": "ออก LC", "New deal": "ดีลใหม่", "New product": "ผลิตภัณฑ์ใหม่", "Run allowance": "คำนวณค่าเผื่อ", "Run backfill": "รันงานย้อนหลัง", "New policy": "นโยบายใหม่", "New": "ใหม่",
  "This period": "ช่วงนี้", "Same period last year": "ช่วงเดียวกันปีก่อน", "The records that need someone today": "รายการที่ต้องมีคนดูแลวันนี้",
  "In this concept, LN-A-C10 has a full record page. Other records open this quick look.": "ในต้นแบบนี้ รายการที่เป็นลิงก์มีหน้ารายละเอียดเต็ม รายการอื่นเปิดเป็นมุมมองย่อนี้",
  // lending overview
  "Loans outstanding": "ยอดสินเชื่อคงค้าง", "Applications today": "ใบสมัครวันนี้", "Approval rate": "อัตราอนุมัติ", "NPL ratio": "สัดส่วน NPL",
  "฿m per day, last 30 days": "ล้านบาทต่อวัน 30 วันล่าสุด", "Book by product": "พอร์ตตามผลิตภัณฑ์", "Personal loans": "สินเชื่อส่วนบุคคล", "Home loans": "สินเชื่อบ้าน", "SME term loans": "สินเชื่อ SME", "Overdrafts": "เงินเบิกเกินบัญชี",
  // columns
  "Customer": "ลูกค้า", "Status": "สถานะ", "Product": "ผลิตภัณฑ์", "Outstanding": "ยอดคงค้าง", "Overdue": "ยอดค้างชำระ", "Loan": "สัญญา", "Balance": "ยอดคงเหลือ", "Rate": "อัตรา",
  "Account": "บัญชี", "Amount": "จำนวนเงิน", "Days late": "วันค้าง", "Next step": "ขั้นตอนถัดไป", "Promise": "นัดชำระ", "Application": "ใบสมัคร", "Applicant": "ผู้สมัคร", "Score": "คะแนน", "Decision": "ผลพิจารณา",
  "Party id": "รหัสลูกค้า", "Segment": "กลุ่ม", "Products": "ผลิตภัณฑ์", "Since": "ตั้งแต่", "State": "สถานะ", "Request": "คำขอ", "System": "ระบบ", "Maker": "ผู้ทำรายการ", "What it does": "ผลของรายการ", "Waiting": "รอมาแล้ว",
  // statuses
  "Active": "ปกติ", "Verified": "ยืนยันแล้ว", "Review due": "ถึงกำหนดทบทวน", "Dormant": "ไม่เคลื่อนไหว", "Approved": "อนุมัติ", "Declined": "ปฏิเสธ", "Needs documents": "รอเอกสาร", "Credit committee": "คณะกรรมการสินเชื่อ",
  "Open ": "เปิดอยู่", "Broken": "ผิดนัด", "Kept": "ชำระตามนัด", "Sold": "ขายแล้ว", "Held for sale": "รอขาย", "Terminated": "สิ้นสุดแล้ว", "Arrears": "ค้างชำระ", "Non-accrual": "หยุดรับรู้รายได้",
  "In progress": "กำลังดำเนินการ", "Possible match": "อาจตรงรายชื่อ", "Documents missing": "เอกสารไม่ครบ", "Low": "ต่ำ", "Medium": "กลาง", "High": "สูง", "Live": "ใช้งานจริง", "In review": "อยู่ระหว่างตรวจ",
  "Queued": "รอคิว", "Dead letter": "งานล้มเหลว", "Matched": "ตรงกัน", "Review": "ตรวจสอบ", "Issued": "ออกแล้ว", "Discrepant documents": "เอกสารไม่ตรง", "Within limit": "อยู่ในวงเงิน", "On": "เปิด",
  "Waiting for checker": "รอผู้ตรวจ", "Escalated": "ส่งต่อแล้ว", "Within authority": "อยู่ในอำนาจ", "Passed": "ผ่าน", "Needs supervisor": "รอหัวหน้า", "Review for restructuring": "พิจารณาปรับโครงสร้าง",
  "Send letter": "ส่งจดหมาย", "Remind": "แจ้งเตือน", "Payoff overdue": "ค้างชำระคืน", "No cover": "ไม่มีประกัน", "Disposed": "จำหน่ายแล้ว", "Repossessed": "ยึดคืนแล้ว", "AI proposal · checker": "ข้อเสนอ AI · รอผู้ตรวจ",
  "Cross-default watch": "เฝ้าระวังผิดนัดข้ามสัญญา", "Waiting for you": "รอคุณ", "Paid": "ชำระแล้ว", "Due next": "งวดถัดไป", "Scheduled": "ตามกำหนด", "Late": "ค้างชำระ",
  // names
  "Somchai Prasert": "สมชาย ประเสริฐ", "Malee Wongsa": "มาลี วงศ์ษา", "Pimchanok Rattana": "พิมพ์ชนก รัตนะ", "Kittipong Siri": "กิตติพงษ์ ศิริ", "Anan Chaiyo": "อนันต์ ชัยโย",
  "Siam Freight Logistics": "สยามเฟรท โลจิสติกส์", "Bangna Motors": "บางนา มอเตอร์ส", "Rama 9 Trucks": "พระราม 9 ทรัคส์", "Personal loan": "สินเชื่อส่วนบุคคล", "Fleet schedule": "ตารางฟลีต",
  // today
  "Overdue loans in your queue": "สัญญาค้างชำระในคิวของคุณ", "Oldest 205 days · 31 promises due this week": "เก่าสุด 205 วัน · นัดชำระ 31 รายการสัปดาห์นี้",
  "Approvals waiting for you": "รายการรออนุมัติจากคุณ", "2 from AI agents, checked against policy": "2 รายการจากเอเจนต์ AI ตรวจกับนโยบายแล้ว",
  "Sold out of trust suspected": "สงสัยขายรถแล้วไม่ชำระคืน", "Rama 9 Trucks · payoff overdue 4 days": "พระราม 9 ทรัคส์ · ค้างชำระคืน 4 วัน",
  "KYC reviews due": "ถึงกำหนดทบทวน KYC", "1 adverse media hit needs compliance": "ข่าวเชิงลบ 1 รายการ รอฝ่ายกำกับ",
  "Maker-checker across every system, oldest first": "ผู้ทำ-ผู้ตรวจ ทุกระบบ เรียงจากเก่าสุด", "All approvals": "รายการอนุมัติทั้งหมด",
  "The bank's day": "วันทำการของธนาคาร", "Cut-offs and controls, Bangkok time": "เวลาตัดรอบและการควบคุม เวลากรุงเทพฯ",
  "ITMX settlement file received": "ได้รับไฟล์ชำระดุล ITMX", "1 break of ฿4,200.00, match proposed": "ไม่ตรง 1 รายการ ฿4,200.00 เสนอจับคู่แล้ว",
  "Sub-ledger to GL reconciliation": "กระทบยอดบัญชีย่อยกับ GL", "฿0.00 difference": "ผลต่าง ฿0.00", "Branches open": "สาขาเปิดทำการ", "412 teller drawers balanced": "ลิ้นชักพนักงาน 412 ลิ้นชักยอดตรง",
  "Term deposit maturities": "เงินฝากประจำครบกำหนด", "312 deposits, ฿612.4m": "312 บัญชี ฿612.4 ล้าน", "BAHTNET cut-off": "ตัดรอบ BAHTNET", "Corporate payouts above ฿2m": "โอนเงินองค์กรเกิน ฿2 ล้าน",
  "BOT liquidity report": "รายงานสภาพคล่อง ธปท.", "LCR 148%, auto-generated": "LCR 148% สร้างอัตโนมัติ", "Reporting cut": "ตัดรอบรายงาน", "Accrual keeps running per account": "คำนวณดอกเบี้ยค้างรับต่อเนื่องรายบัญชี",
  "Loans and leases": "สินเชื่อและสัญญาเช่า", "Postings today": "รายการบัญชีวันนี้", "Key figures": "ตัวเลขสำคัญ",
  "Publish product AUTO_HP_USED v2": "เผยแพร่ผลิตภัณฑ์ AUTO_HP_USED v2", "Restructure TL-2024-000311": "ปรับโครงสร้างหนี้ TL-2024-000311", "Match ITMX break of ฿4,200.00": "จับคู่รายการ ITMX ที่ไม่ตรง ฿4,200.00",
  "Write off LN-A-C14": "ตัดหนี้สูญ LN-A-C14", "Cash deposit above ฿2,000,000": "ฝากเงินสดเกิน ฿2,000,000",
  "Krit S. · Product Factory": "กฤษ ส. · โรงงานผลิตภัณฑ์", "RM copilot for Wanida K.": "ผู้ช่วย RM แทนคุณวนิดา", "Reconciliation agent": "เอเจนต์กระทบยอด", "Credit officer": "เจ้าหน้าที่สินเชื่อ", "Teller 4 · Branch 0123": "พนักงาน 4 · สาขา 0123",
  "1,200 scenarios passed · rate cap ≤ 15% checked": "ผ่าน 1,200 สถานการณ์ · ตรวจเพดานดอกเบี้ย ≤ 15% แล้ว", "Within authority · modification loss ฿18,412.20": "อยู่ในอำนาจอนุมัติ · ผลขาดทุนจากการปรับเงื่อนไข ฿18,412.20",
  "One item, 24 Oct 05:00 file": "1 รายการ ไฟล์ 24 ต.ค. 05:00", "135 days late · override needed before 360 days": "ค้าง 135 วัน · ต้องอนุมัติพิเศษก่อนครบ 360 วัน", "AMLO cash transaction report will be filed": "จะยื่นรายงานธุรกรรมเงินสดต่อ ปปง.",
  "Everything waiting for a checker, from people and AI agents, in one inbox. Agents act through the same limits and approvals as people.": "ทุกรายการที่รอผู้ตรวจ ทั้งจากคนและเอเจนต์ AI อยู่ในกล่องเดียว เอเจนต์ทำงานภายใต้วงเงินและการอนุมัติเดียวกับคน",
  // customer 360
  "Log a contact": "บันทึกการติดต่อ", "New facility": "วงเงินใหม่", "Across every system": "ทุกระบบในที่เดียว", "One timeline, each event links to its record": "ไทม์ไลน์เดียว ทุกเหตุการณ์ลิงก์ไปยังรายการ", "Limits and exposure": "วงเงินและภาระหนี้",
  // loan page
  "Summary": "สรุป", "Schedule": "ตารางผ่อน", "Collections": "การติดตาม", "Recovery": "การเรียกคืน", "Postings": "รายการบัญชี",
  "Record promise": "บันทึกนัดชำระ", "Take payment": "รับชำระ", "Settle early": "ปิดบัญชีก่อนกำหนด",
  "Outstanding principal": "เงินต้นคงค้าง", "Overdue, 5 instalments": "ค้างชำระ 5 งวด", "Next due": "งวดถัดไป", "Interest rate": "อัตราดอกเบี้ย", "a year, reducing balance": "ต่อปี ลดต้นลดดอก",
  "Collateral held for sale": "หลักประกันรอขาย", "45% of exposure": "45% ของยอดหนี้",
  "Contract": "สัญญา", "Principal": "เงินต้น", "Disbursed": "เบิกจ่าย", "Term": "ระยะเวลา", "Instalment": "ค่างวด", "Default interest": "ดอกเบี้ยผิดนัด", "Collateral": "หลักประกัน", "Repaid from": "ตัดชำระจาก",
  "What happens next": "สิ่งที่จะเกิดขึ้นต่อไป", "No.": "งวด", "Due": "ครบกำหนด", "Interest": "ดอกเบี้ย", "Balance after": "คงเหลือหลังงวด",
  "Received": "รับชำระ", "From": "จาก", "Reference": "เลขอ้างอิง", "Applied to": "ตัดชำระ", "Debit": "เดบิต", "Credit": "เครดิต", "Entry": "รายการ", "Date": "วันที่",
  "Contacts and promises, newest first": "การติดต่อและนัดชำระ ล่าสุดก่อน", "Every entry balances: total debits equal total credits.": "ทุกรายการสมดุล ยอดเดบิตรวมเท่ากับเครดิตรวม",
  "Vehicle": "รถ", "Registration": "ทะเบียน", "Taken": "ยึดเมื่อ", "Where": "สถานที่", "Forced-sale valuation": "ราคาประเมินขายทอดตลาด", "Towing and storage": "ค่าลากและค่าจอด", "Expected shortfall": "ส่วนขาดที่คาดไว้",
  "If the customer settles, the vehicle is returned. If not, it is sold and the shortfall stays owed.": "หากลูกค้าปิดบัญชี จะคืนรถให้ลูกค้า หากไม่ จะนำรถออกขายและส่วนที่ขาดยังเป็นหนี้อยู่",
  "Settlement today": "ยอดปิดบัญชีวันนี้",
  // dialogs
  "Enter": "กรอก", "Review and confirm": "ตรวจทานและยืนยัน", "Done": "เสร็จ", "Next": "ถัดไป", "Back": "ย้อนกลับ", "Cancel": "ยกเลิก",
  "Settlement date": "วันที่ปิดบัญชี", "The quote is valid for today only.": "ยอดนี้ใช้ได้เฉพาะวันนี้", "Pay from": "ชำระจาก",
  "Cash or transfer at a branch": "เงินสดหรือโอนที่สาขา", "Received by the teller against a receipt": "พนักงานรับเงินและออกใบเสร็จ",
  "Principal outstanding": "เงินต้นคงค้าง", "Interest billed, unpaid": "ดอกเบี้ยที่เรียกเก็บแล้วยังไม่ชำระ", "Interest since 2 Oct": "ดอกเบี้ยตั้งแต่ 2 ต.ค.", "Default interest on overdue principal": "ดอกเบี้ยผิดนัดจากเงินต้นค้างชำระ", "Total to settle": "ยอดปิดบัญชีรวม",
  "Confirm settlement": "ยืนยันการปิดบัญชี", "Confirm payment": "ยืนยันการรับชำระ", "Record the promise": "บันทึกนัดชำระ",
  "Pay by": "ชำระภายใน", "How it was made": "ช่องทาง", "Call": "โทรศัพท์", "Branch visit": "มาที่สาขา", "LINE chat": "แชต LINE",
  "Nothing was posted: this is a concept.": "ไม่มีการบันทึกบัญชีจริง นี่คือต้นแบบ",
  // concept footer
  "Concept with sample data.": "ต้นแบบพร้อมข้อมูลตัวอย่าง", "Thai covers navigation, Workbench, Lending and the loan page.": "ภาษาไทยครอบคลุมเมนู โต๊ะทำงาน สินเชื่อ และหน้าสัญญา",
  // collections history on the loan
  "SMS reminder sent": "ส่ง SMS แจ้งเตือน", "Instalment 6 unpaid": "งวดที่ 6 ยังไม่ชำระ", "Call, no answer": "โทรแล้ว ไม่มีผู้รับสาย", "Agent Nok · 2 attempts": "เจ้าหน้าที่นก · 2 ครั้ง",
  "Letter 1 sent": "ส่งจดหมายฉบับที่ 1", "To the registered address": "ส่งไปยังที่อยู่ตามทะเบียน", "Promise of ฿12,000.00 by 31 Jul": "นัดชำระ ฿12,000.00 ภายใน 31 ก.ค.",
  "Customer cited a delayed salary · call by agent Nok": "ลูกค้าแจ้งเงินเดือนออกช้า · เจ้าหน้าที่นกโทร", "Promise broken": "ผิดนัดชำระ", "Nothing received by 31 Jul": "ไม่ได้รับเงินภายใน 31 ก.ค.",
  "Notice of default sent": "ส่งหนังสือบอกกล่าวผิดนัด", "30 days to pay before termination": "ให้ชำระภายใน 30 วันก่อนบอกเลิกสัญญา", "Vehicle A4 repossessed": "ยึดรถ A4 คืนแล้ว",
  "Held for sale at the Bang Phli yard": "จอดรอขายที่ลานบางพลี", "Recommended: review for restructuring": "แนะนำ: พิจารณาปรับโครงสร้างหนี้", "Collections policy, 120 or more days late": "ตามนโยบายติดตามหนี้ ค้าง 120 วันขึ้นไป",
  "Amend LC-26-0418 expiry to 30 Nov": "แก้ไขวันหมดอายุ LC-26-0418 เป็น 30 พ.ย.", "Trade operations": "ฝ่ายปฏิบัติการการค้า", "Beneficiary consent received": "ได้รับความยินยอมจากผู้รับประโยชน์แล้ว",
  "Raise FP-DEMO limit to ฿30,000,000": "เพิ่มวงเงิน FP-DEMO เป็น ฿30,000,000", "Asset finance officer": "เจ้าหน้าที่สินเชื่อสินทรัพย์", "Bangna Motors at 92% of limit": "บางนา มอเตอร์ส ใช้วงเงิน 92%",
};
const t = (s) => (lang === "th" && TH[s]) || s;
const tt = (en, th) => (lang === "th" ? th : en);
Object.assign(TH, {
  // overview figures
  "Active customers": "ลูกค้าที่ใช้งาน", "Onboarded this week": "เปิดใหม่สัปดาห์นี้", "Consents withdrawn": "ถอนความยินยอม", "New customers per day": "ลูกค้าใหม่ต่อวัน",
  "Retail and SME, last 30 days": "รายย่อยและ SME 30 วันล่าสุด", "By segment": "ตามกลุ่มลูกค้า", "Retail": "รายย่อย", "Corporate": "องค์กร", "Virtual only": "ดิจิทัลล้วน",
  "Total deposits": "เงินฝากรวม", "Term deposits maturing (7d)": "เงินฝากประจำครบกำหนด (7 วัน)", "Cost of funds": "ต้นทุนเงินทุน", "Deposit balance": "ยอดเงินฝาก",
  "฿bn, last 30 days": "พันล้านบาท 30 วันล่าสุด", "Mix": "สัดส่วน", "Savings": "ออมทรัพย์", "Current": "กระแสรายวัน", "Foreign currency": "เงินตราต่างประเทศ",
  "Net investment in leases": "เงินลงทุนสุทธิในสัญญาเช่า", "Vehicles financed": "รถที่ให้สินเชื่อ", "Floor plan in use": "ใช้วงเงินฟลอร์แพลน", "Assets without cover": "ทรัพย์สินที่ไม่มีประกัน",
  "New contracts": "สัญญาใหม่", "Hire purchase and leases per day": "เช่าซื้อและสัญญาเช่าต่อวัน", "Dealer lines in use": "การใช้วงเงินดีลเลอร์",
  "Accounts in arrears": "บัญชีค้างชำระ", "Overdue amount": "ยอดค้างชำระ", "Promises kept (30d)": "นัดชำระที่ทำตาม (30 วัน)", "Cured this month": "กลับมาปกติเดือนนี้",
  "Roll rate 30 → 60 days": "อัตราไหล 30 → 60 วัน", "% of accounts, last 30 days": "% ของบัญชี 30 วันล่าสุด", "By bucket": "ตามช่วงวันค้าง", "1–29 days": "1–29 วัน", "30–59 days": "30–59 วัน", "60–89 days": "60–89 วัน", "90+ days": "90 วันขึ้นไป",
  "PromptPay today": "พร้อมเพย์วันนี้", "Value settled": "มูลค่าที่ชำระดุล", "ITMX breaks": "รายการ ITMX ไม่ตรง", "Straight-through rate": "อัตราประมวลผลอัตโนมัติ", "Transfers per minute": "การโอนต่อนาที",
  "Today, all channels": "วันนี้ ทุกช่องทาง", "Rails": "ช่องทางชำระ", "Bill payment": "ชำระบิล",
  "LCs outstanding": "LC คงค้าง", "Guarantees issued": "หนังสือค้ำประกันที่ออก", "Documents under review": "เอกสารรอตรวจ", "Expiring in 30 days": "หมดอายุใน 30 วัน", "Trade volume": "ปริมาณการค้า",
  "$m per day": "ล้านดอลลาร์ต่อวัน", "By product": "ตามผลิตภัณฑ์", "Import LC": "LC นำเข้า", "Export LC": "LC ส่งออก", "Bank guarantees": "หนังสือค้ำประกัน",
  "Net stable funding": "เงินทุนที่มั่นคงสุทธิ", "FX open position": "ฐานะ FX เปิด", "Nostro match rate": "อัตราจับคู่นอสโตร", "High-quality liquid assets": "สินทรัพย์สภาพคล่องสูง", "FX exposure by currency": "ฐานะ FX ตามสกุลเงิน",
  "Agency deals": "ดีลที่เป็นตัวแทน", "Commitments": "วงเงินผูกพัน", "Drawn": "เบิกใช้แล้ว", "Fees due (30d)": "ค่าธรรมเนียมครบกำหนด (30 วัน)", "Drawn balance": "ยอดเบิกใช้",
  "฿bn across agency deals": "พันล้านบาท ทุกดีลตัวแทน", "Our share by deal": "สัดส่วนของเราตามดีล", "Others": "อื่น ๆ",
  "Products live": "ผลิตภัณฑ์ที่ใช้งาน", "Drafts": "ฉบับร่าง", "Simulated scenarios": "สถานการณ์จำลอง", "Rule packs": "ชุดกฎ", "Contracts opened on new versions": "สัญญาที่เปิดบนเวอร์ชันใหม่",
  "per day": "ต่อวัน", "Live products by family": "ผลิตภัณฑ์ตามกลุ่ม", "Asset finance": "สินเชื่อสินทรัพย์", "Trade": "การค้า",
  "Loss allowance (ECL)": "ค่าเผื่อผลขาดทุน (ECL)", "Stage 3 share": "สัดส่วน Stage 3", "ECL by stage": "ECL ตาม Stage", "฿m, last 30 days": "ล้านบาท 30 วันล่าสุด",
  "Tasks due now": "งานที่ถึงกำหนด", "Tasks today": "งานวันนี้", "Dead letters": "งานล้มเหลว", "Posting p99": "เวลาบันทึกบัญชี p99", "Scheduler throughput": "ปริมาณงานของตัวจัดตารางงาน",
  "tasks per second": "งานต่อวินาที", "Work by type": "งานตามประเภท", "Accrual": "ดอกเบี้ยค้างรับ", "Billing": "ออกใบแจ้งหนี้", "Aging and penalties": "อายุหนี้และค่าปรับ", "Capitalisation": "ทบต้น",
  "Proposals waiting": "ข้อเสนอที่รอ", "Accepted (30d)": "ยอมรับ (30 วัน)", "Blocked by policy": "ถูกนโยบายปฏิเสธ", "Hours saved (30d)": "ชั่วโมงที่ประหยัด (30 วัน)", "Proposals per day": "ข้อเสนอต่อวัน",
  "across all agents": "ทุกเอเจนต์", "By agent": "ตามเอเจนต์", "RM copilot": "ผู้ช่วย RM",
  // columns
  "Channel": "ช่องทาง", "Step": "ขั้นตอน", "Reason": "เหตุผล", "Risk": "ความเสี่ยง", "Owner": "ผู้รับผิดชอบ", "Deposit": "เงินฝาก", "Matures": "ครบกำหนด", "At maturity": "เมื่อครบกำหนด",
  "Proposal": "ข้อเสนอ", "New rate": "อัตราใหม่", "Lease": "สัญญาเช่า", "Lessee": "ผู้เช่า", "Kind": "ประเภท", "Net investment": "เงินลงทุนสุทธิ", "Due now": "ถึงกำหนดตอนนี้",
  "Agreement": "สัญญาหลัก", "Schedules": "ตารางย่อย", "In use": "ใช้ไป", "Invoice": "ใบแจ้งหนี้", "Line": "วงเงิน", "Dealer": "ดีลเลอร์", "Sold, not paid off": "ขายแล้วยังไม่ชำระคืน",
  "Asset": "ทรัพย์สิน", "Cover": "ประกันภัย", "Name": "ชื่อ", "Commission": "ค่าคอมมิชชัน", "Lines": "วงเงิน", "Paid this month": "จ่ายเดือนนี้", "Hirer": "ผู้เช่าซื้อ", "Rebate rule": "กฎส่วนลด",
  "Promised": "จำนวนที่นัด", "Made": "นัดเมื่อ", "Case": "เรื่อง", "Outcome": "ผลลัพธ์", "File": "ไฟล์", "Rail": "ช่องทาง", "Items": "รายการ", "Difference": "ผลต่าง", "Proposed match": "การจับคู่ที่เสนอ",
  "Beneficiary": "ผู้รับประโยชน์", "Expiry": "วันหมดอายุ", "Currency": "สกุลเงิน", "Position": "ฐานะ", "Limit": "วงเงิน", "Use": "ใช้ไป", "Deal": "ดีล", "Borrower": "ผู้กู้", "Commitment": "วงเงินผูกพัน",
  "Our share": "สัดส่วนของเรา", "Next fee": "ค่าธรรมเนียมถัดไป", "Code": "รหัส", "Family": "กลุ่ม", "Version": "เวอร์ชัน", "Contracts": "สัญญา", "Stage": "Stage", "Exposure": "ยอดหนี้",
  "Allowance": "ค่าเผื่อ", "Type": "ประเภท", "Net": "สุทธิ", "Task": "งาน", "Attempts": "จำนวนครั้ง", "Last error": "ข้อผิดพลาดล่าสุด", "Agent": "เอเจนต์", "For": "สำหรับ", "Change": "การเปลี่ยนแปลง",
  "Policy check": "ตรวจนโยบาย", "User": "ผู้ใช้", "Roles": "บทบาท", "Systems": "ระบบ", "Last seen": "ใช้งานล่าสุด", "Users": "ผู้ใช้", "Region": "ภูมิภาค", "Record": "รายการ", "Priority": "ความสำคัญ",
  "Viewed": "ดูเมื่อ", "Tier": "ขั้น", "Fee": "ค่าธรรมเนียม", "Effective": "มีผล", "Period": "งวด", "Sent": "ส่งเมื่อ", "To": "ไปยัง", "Recovery expected": "คาดว่าจะได้คืน", "Proxy": "พร้อมเพย์ไอดี",
  "Registered": "ลงทะเบียน", "Transfers (30d)": "การโอน (30 วัน)", "Applies to": "ใช้กับ", "Per transaction": "ต่อรายการ", "Per day": "ต่อวัน", "Used today": "ใช้วันนี้", "Guarantee": "หนังสือค้ำประกัน",
  "Collection": "ตั๋วเรียกเก็บ", "Drawer": "ผู้สั่งจ่าย", "Drawee": "ผู้จ่าย", "Terms": "เงื่อนไข", "Bucket": "ช่วงเวลา", "Inflows": "เงินเข้า", "Outflows": "เงินออก", "Cumulative": "สะสม", "Nostro": "นอสโตร",
  "Bank": "ธนาคาร", "Our books": "บัญชีของเรา", "Their statement": "รายการของธนาคาร", "Participant": "ผู้ร่วมให้กู้", "Share": "สัดส่วน", "Run": "รอบ", "Scenarios": "สถานการณ์", "Passed ": "ผ่าน", "Failed": "ไม่ผ่าน",
  "Needs": "ต้องอนุมัติโดย", "Template": "แม่แบบ", "Building blocks": "ส่วนประกอบ", "Products using it": "ผลิตภัณฑ์ที่ใช้", "Rule pack": "ชุดกฎ", "Draft": "ฉบับร่าง", "Last change": "แก้ไขล่าสุด", "Simulation": "การจำลอง",
  "Ledger": "บัญชีย่อย", "Sub-ledger": "บัญชีย่อย", "GL balance": "ยอด GL", "Report": "รายงาน", "Regulator": "หน่วยงานกำกับ", "Prepared": "จัดทำ", "When": "เมื่อ", "Who": "ผู้ทำ", "Action": "การกระทำ",
  "Result": "ผล", "Incident": "เหตุขัดข้อง", "Started": "เริ่ม", "Impact": "ผลกระทบ", "Severity": "ความรุนแรง", "Policy": "นโยบาย", "May propose": "เสนอได้", "Checker": "ผู้ตรวจ", "Did": "ทำ",
  "Integration": "การเชื่อมต่อ", "Endpoint": "ปลายทาง", "Last call": "เรียกล่าสุด", "Error rate": "อัตราผิดพลาด", "Ticket": "บัตรคิว", "Service": "บริการ", "Counter": "ช่องบริการ", "Check": "รายการตรวจ",
  "Expected": "ตามระบบ", "Actual": "นับได้", "By": "โดย", "Note": "ธนบัตร", "Count": "จำนวน", "Value": "มูลค่า", "Time": "เวลา", "In": "รับเข้า", "Out": "จ่ายออก", "Purpose": "วัตถุประสงค์", "Legal basis": "ฐานทางกฎหมาย",
  "Opened": "เปิดเมื่อ", "Parameter": "พารามิเตอร์", "Default": "ค่าเริ่มต้น", "Allowed range": "ช่วงที่อนุญาต", "Who may change": "ผู้แก้ไขได้", "Source": "ที่มา", "Rule": "กฎ", "Field": "ฟิลด์",
  "VIN": "เลขตัวถัง", "Model": "รุ่น", "Days on floor": "วันในสต็อก", "Statement": "ใบแจ้งยอด", "Paid on": "ชำระเมื่อ",
  // common cells
  "Savings Standard": "ออมทรัพย์มาตรฐาน", "Business Current": "กระแสรายวันธุรกิจ", "USD Deposit": "เงินฝาก USD", "Roll over": "ฝากต่อ", "Pay to current": "โอนเข้ากระแสรายวัน", "Ask customer": "สอบถามลูกค้า",
  "Finance": "ลีสซิ่งทางการเงิน", "Operating": "ลีสซิ่งดำเนินงาน", "Car hire purchase": "เช่าซื้อรถยนต์", "SME term loan": "สินเชื่อ SME", "Periodic review": "ทบทวนตามรอบ", "Ownership change": "เปลี่ยนผู้ถือหุ้น",
  "Adverse media": "ข่าวเชิงลบ", "Address changed": "เปลี่ยนที่อยู่", "KYC team": "ทีม KYC", "Compliance": "ฝ่ายกำกับ", "App": "แอป", "Liveness check": "ตรวจใบหน้า", "Sanctions and PEP": "รายชื่อคว่ำบาตรและ PEP",
  "Consents": "ความยินยอม", "Beneficial owners": "ผู้รับผลประโยชน์", "Savings · Loan": "ออมทรัพย์ · สินเชื่อ", "Rate cut, term extension": "ลดดอกเบี้ย ขยายระยะเวลา", "Capitalise arrears": "ทบยอดค้างเข้าเงินต้น",
  "Payment holiday 2 months": "พักชำระ 2 เดือน", "60 months": "60 เดือน", "18 months": "18 เดือน", "Today": "วันนี้", "High ": "สูง",
});
Object.assign(TH, {
  "Transactions": "รายการเคลื่อนไหว", "Holds": "การอายัด", "Statement": "ใบแจ้งยอด", "Documents": "เอกสาร", "Amendments": "การแก้ไข", "Charges": "ค่าธรรมเนียม", "ID card": "บัตรประชาชน", "DOPA check": "ตรวจกรมการปกครอง",
  "NDID": "NDID", "Liveness": "ตรวจใบหน้า", "Journals": "รายการบัญชี", "Accounts and contracts": "บัญชีและสัญญา", "Contact history": "ประวัติการติดต่อ", "Vehicles": "รถยนต์", "Stock audit": "ตรวจสต็อก",
  "Early settlement": "ปิดบัญชีก่อนกำหนด", "Vehicle and insurance": "รถและประกันภัย", "Parameters": "พารามิเตอร์", "Changes from v1": "การเปลี่ยนแปลงจาก v1", "Setup": "การตั้งค่า",
  "Savings account": "บัญชีออมทรัพย์", "Import letter of credit": "LC นำเข้า", "General ledger account": "บัญชีแยกประเภท", "Floor plan line": "วงเงินฟลอร์แพลน", "Product template": "แม่แบบผลิตภัณฑ์", "Product draft": "ร่างผลิตภัณฑ์",
  "Description": "รายละเอียด", "Hold": "การอายัด", "Placed": "อายัดเมื่อ", "Until": "ถึง", "Document": "เอกสาร", "Required": "กำหนด", "Amendment": "การแก้ไข", "Requested": "ขอเมื่อ", "Charge": "ค่าธรรมเนียม",
  "Paid by": "ผู้จ่าย", "Journal": "รายการ", "What": "รายการ", "Disbursement": "การเบิกจ่าย", "Transfer": "การโอน", "Ticket": "บัตรคิว",
  "Complies": "ถูกต้อง", "Discrepant": "ไม่ตรง", "Payoff due": "รอชำระคืน", "Given": "ให้แล้ว", "Withdrawn": "ถอนแล้ว", "Not given": "ไม่ได้ให้", "Delivered": "ส่งถึงแล้ว", "Returned": "ตีกลับ",
  "Waiting for signature": "รอลงนาม", "Written off": "ตัดหนี้สูญแล้ว", "Sold to AMC": "ขายให้ AMC", "Settled": "ชำระดุลแล้ว", "Screening": "กำลังคัดกรอง", "Fraud rule": "กฎป้องกันทุจริต", "Claim received": "ได้รับการเรียกร้อง",
  "Sent to collecting bank": "ส่งธนาคารผู้เรียกเก็บแล้ว", "Accepted": "ยอมรับแล้ว", "Watch": "เฝ้าระวัง", "Break": "ไม่ตรง", "Not run": "ยังไม่รัน", "Done": "เสร็จ", "Resolved": "แก้ไขแล้ว", "Submitted": "ส่งแล้ว",
  "Ready": "พร้อม", "Drafting": "กำลังร่าง", "At counter": "อยู่ที่ช่อง", "Waiting": "รอ", "Automatic": "อัตโนมัติ", "To confirm with counsel": "ต้องยืนยันกับที่ปรึกษากฎหมาย", "Nobody": "ไม่มีใคร", "Template ": "แม่แบบ",
});
Object.assign(TH, {
  "Exception centre": "ศูนย์รายการผิดปกติ", "Limits and authorities": "วงเงินและอำนาจอนุมัติ", "Branding": "แบรนด์", "Month-end close": "ปิดบัญชีสิ้นเดือน", "Customer App": "แอปลูกค้า",
  "App preview": "ตัวอย่างแอป", "Releases": "เวอร์ชันที่ออก", "What customers see, on the same ledger": "สิ่งที่ลูกค้าเห็น บนบัญชีแยกประเภทเดียวกัน", "Exceptions, scheduler, audit and incidents": "รายการผิดปกติ ตัวจัดตารางงาน การตรวจสอบ และเหตุขัดข้อง",
  "Payouts and dealer payoffs": "การจ่ายเงินและชำระคืนดีลเลอร์", "Cash at the counter": "เงินสดที่เคาน์เตอร์", "FX deals": "ดีล FX", "Manual journals": "รายการบัญชีด้วยมือ",
  "Compliance & AML": "กำกับและป้องกันการฟอกเงิน", "Alerts, investigations and reports to AMLO": "การแจ้งเตือน การสอบสวน และรายงานต่อ ปปง.", "Alerts": "การแจ้งเตือน", "Cases": "เรื่องสอบสวน",
  "Reports to AMLO": "รายงานต่อ ปปง.", "Held payments": "รายการโอนที่ถูกระงับ", "Before and after": "ก่อนและหลัง", "What if": "ถ้าหาก", "AML case": "เรื่องสอบสวน AML", "Held payment": "รายการโอนที่ถูกระงับ",
  "Loan application": "ใบสมัครสินเชื่อ", "Alert": "การแจ้งเตือน", "Investigation": "การสอบสวน", "Screening": "การคัดกรอง", "Credit assessment": "การประเมินสินเชื่อ", "Disbursement ": "การเบิกจ่าย",
  "Credit approval": "อนุมัติสินเชื่อ", "Head of operations": "หัวหน้าฝ่ายปฏิบัติการ", "Typology": "รูปแบบ", "Investigator": "ผู้สอบสวน", "Opened ": "เปิดเมื่อ", "Filed": "ยื่นเมื่อ", "Where": "สถานที่",
  "Branch manager": "ผู้จัดการสาขา", "Head of dealing": "หัวหน้าห้องค้าเงิน", "Version": "เวอร์ชัน", "Platform": "แพลตฟอร์ม", "What changed": "สิ่งที่เปลี่ยน", "Released": "ออกเมื่อ", "Adoption": "การใช้งาน",
});
// dates in lists follow the language (Thai uses Buddhist years)
function loc(v) {
  let m = v.match(/^(\d{1,2}) ([A-Z][a-z]{2}) (\d{4})( \d\d:\d\d)?$/);
  if (m && MON.en.includes(m[2])) return fd(Date.UTC(+m[3], MON.en.indexOf(m[2]), +m[1])) + (m[4] || "");
  m = v.match(/^([A-Z][a-z]{2}) (\d{4})$/);
  if (m && MON.en.includes(m[1])) return lang === "th" ? `${MON.th[MON.en.indexOf(m[1])]} ${+m[2] + 543}` : v;
  return t(v);
}
const MON = { en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"], th: ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."] };
const fd = (ms) => { const d = new Date(ms); return `${d.getUTCDate()} ${MON[lang][d.getUTCMonth()]} ${d.getUTCFullYear() + (lang === "th" ? 543 : 0)}`; };
const fdShort = (ms) => { const d = new Date(ms); return `${d.getUTCDate()} ${MON[lang][d.getUTCMonth()]}`; };
const BIZ = Date.UTC(2026, 9, 24);

// smooth sample series: a trend plus autocorrelated noise, deterministic per seed
const series = (seed, n, base, drift, wiggle) => { let x = seed, e = 0; return Array.from({ length: n }, (_, i) => { x = (x * 9301 + 49297) % 233280; e = 0.6 * e + (x / 233280 - 0.5) * wiggle * 0.6; return Math.max(0, base + drift * i + e); }); };

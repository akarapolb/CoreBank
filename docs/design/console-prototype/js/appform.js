// Fabor console prototype · The loan application form: a field catalogue that drives the form, its checks,
// the document list and the review, from product to disbursement. tools/application-fields.mjs prints the
// catalogue as docs/design/loan-application-fields.md for the backend.
// Classic scripts sharing one global scope; load order is set in index.html.

/* ---------------- products ---------------- */
const INTAKE_PRODUCTS = {
  personal: { name: "Personal loan", th: "สินเชื่อส่วนบุคคล", code: "PERSONAL_LOAN_STD v1", rate: 0.15, min: 20000, max: 1000000, tmin: 12, tmax: 60, amount: 300000, term: 48, dsr: 60, minIncome: 15000, auto: 500000, contract: "LN-A-C15" },
  home: { name: "Home loan", th: "สินเชื่อบ้าน", code: "HOME_STD v3", rate: 0.0555, min: 500000, max: 20000000, tmin: 60, tmax: 360, amount: 2500000, term: 360, dsr: 70, minIncome: 20000, auto: 0, contract: "LN-77302" },
  car: { name: "Car hire purchase", th: "เช่าซื้อรถยนต์", code: "CAR_HP_NEW v2", rate: 0.0479, min: 100000, max: 3000000, tmin: 12, tmax: 84, amount: 850000, term: 72, dsr: 60, minIncome: 15000, auto: 1500000, contract: "HP-2026-005020" },
};

/* ---------------- the field catalogue ----------------
   A field: k key, en/th label, t type, o options [value, en, th], req required (or a test), when shown (a test), src where the value
   comes from, why the reason the bank collects it, ro read-only, wide full width, re redraw the form when it changes, hint [en, th]. */
const O = (...xs) => xs.map((x) => (Array.isArray(x) ? x : [x, x, x]));
const YN = O(["no", "No", "ไม่ใช่"], ["yes", "Yes", "ใช่"]);
const PROVINCES = O("Bangkok", "Nonthaburi", "Pathum Thani", "Samut Prakan", "Chon Buri", "Chiang Mai", "Khon Kaen", "Nakhon Ratchasima", "Phuket", "Songkhla", "Other");
const INDUSTRY = O(["logistics", "Logistics and transport", "โลจิสติกส์และขนส่ง"], ["manufacturing", "Manufacturing", "การผลิต"], ["retail", "Retail and wholesale", "ค้าปลีกค้าส่ง"], ["finance", "Finance and insurance", "การเงินและประกันภัย"], ["government", "Government", "ราชการ"], ["health", "Health", "สุขภาพ"], ["tech", "Technology", "เทคโนโลยี"], ["construction", "Construction and property", "ก่อสร้างและอสังหาริมทรัพย์"], ["hospitality", "Hotels and restaurants", "โรงแรมและร้านอาหาร"], ["agriculture", "Agriculture", "เกษตรกรรม"], ["other", "Other", "อื่น ๆ"]);
const BANKS = O(["this", "This bank", "ธนาคารนี้"], ["kbank", "Kasikornbank", "กสิกรไทย"], ["scb", "SCB", "ไทยพาณิชย์"], ["bbl", "Bangkok Bank", "กรุงเทพ"], ["ktb", "Krungthai", "กรุงไทย"], ["bay", "Krungsri", "กรุงศรี"], ["ttb", "ttb", "ทีทีบี"], ["other", "Other", "อื่น ๆ"]);
const RELATION = O(["parent", "Parent", "บิดามารดา"], ["sibling", "Brother or sister", "พี่น้อง"], ["spouse", "Spouse", "คู่สมรส"], ["child", "Child", "บุตร"], ["relative", "Other relative", "ญาติ"], ["friend", "Friend", "เพื่อน"], ["colleague", "Colleague", "เพื่อนร่วมงาน"]);
const OCC = O(["salaried", "Salaried, private company", "พนักงานบริษัทเอกชน"], ["civil", "Civil servant", "ข้าราชการ"], ["state", "State enterprise", "พนักงานรัฐวิสาหกิจ"], ["professional", "Self-employed professional", "ผู้ประกอบวิชาชีพอิสระ"], ["owner", "Business owner", "เจ้าของกิจการ"], ["freelance", "Freelance", "ฟรีแลนซ์"], ["retired", "Retired", "เกษียณ"]);
const labelled = (fn, label) => Object.assign(fn, { label });
const isEmp = labelled((f) => ["salaried", "civil", "state"].includes(f.occType), "occType is salaried, civil or state"), isSelf = labelled((f) => ["professional", "owner", "freelance"].includes(f.occType), "occType is professional, owner or freelance");
const isP = (...ps) => labelled(() => ps.includes(INTAKE.product), "product is " + ps.join(" or "));
const WHY = { policy: "Credit policy", bot: "BOT responsible lending", ltv: "BOT LTV measure", kyc: "KYC (AMLO)", aml: "AML/CFT (AMLO)", fatca: "FATCA and CRS", pdpa: "PDPA consent", related: "BOT related-party lending", contract: "The contract", ops: "Operations", conduct: "BOT market conduct", collateral: "Collateral and title", ncb: "Credit bureau (NCB) Act" };

const AF_STEPS = [["loan", "Loan", "สินเชื่อที่ขอ"], ["applicant", "Applicant", "ผู้กู้"], ["work", "Work and income", "อาชีพและรายได้"], ["finance", "Debts and assets", "ภาระหนี้และทรัพย์สิน"], ["coapp", "Co-borrower", "ผู้กู้ร่วม"],
  ["security", "Security", "หลักประกัน"], ["consents", "Declarations", "คำรับรองและความยินยอม"], ["documents", "Documents", "เอกสาร"], ["review", "Review and submit", "ตรวจทานและส่ง"], ["offer", "Offer and signature", "ข้อเสนอและลงนาม"]];

const AF = [
  /* ---- loan ---- */
  { s: "loan", id: "request", en: "Loan requested", th: "สินเชื่อที่ขอ", fields: [
    { k: "amount", en: "Amount", th: "วงเงินที่ขอ", t: "money", req: true, src: "customer", why: "policy" },
    { k: "term", en: "Term, months", th: "ระยะเวลา (เดือน)", t: "num", req: true, src: "customer", why: "policy" },
    { k: "purpose", en: "Purpose", th: "วัตถุประสงค์", t: "select", req: true, src: "customer", why: "bot", re: true, o: () => INTAKE.product === "home" ? O(["buy-new", "Buy a new home", "ซื้อบ้านใหม่"], ["buy-resale", "Buy a resale home", "ซื้อบ้านมือสอง"], ["build", "Build on own land", "ปลูกสร้างบนที่ดินตนเอง"], ["refinance", "Refinance from another bank", "รีไฟแนนซ์จากธนาคารอื่น"])
      : INTAKE.product === "car" ? O(["buy", "Buy the vehicle", "ซื้อรถยนต์"], ["refinance", "Refinance a car loan", "รีไฟแนนซ์สินเชื่อรถ"])
      : O(["education", "Education", "การศึกษา"], ["medical", "Medical costs", "ค่ารักษาพยาบาล"], ["home-improvement", "Home improvement", "ซ่อมแซมบ้าน"], ["refinance", "Pay off other debt", "ชำระหนี้อื่น"], ["wedding", "Wedding or family event", "งานแต่งงานหรืองานครอบครัว"], ["other", "Other", "อื่น ๆ"]) },
    { k: "purposeDetail", en: "Purpose, in the customer's words", th: "รายละเอียดวัตถุประสงค์", t: "text", req: true, when: (f) => f.purpose === "other", src: "customer", why: "bot", wide: true },
    { k: "refiLender", en: "Lender to pay off", th: "สถาบันการเงินที่จะปิดหนี้", t: "select", o: BANKS, req: true, when: (f) => f.purpose === "refinance", src: "customer", why: "policy" },
    { k: "refiAmount", en: "Payoff amount", th: "ยอดปิดหนี้", t: "money", req: true, when: (f) => f.purpose === "refinance", src: "customer", why: "policy", hint: ["From the other lender's payoff letter", "ตามหนังสือยืนยันยอดปิดหนี้"] },
    { k: "ratePackage", en: "Rate package", th: "แพ็กเกจอัตราดอกเบี้ย", t: "select", req: true, src: "customer", why: "contract", o: () => INTAKE.product === "home" ? O(["fix3", "2.99% fixed 3 years, then MRR − 1.75%", "คงที่ 2.99% 3 ปี จากนั้น MRR − 1.75%"], ["float", "MRR − 1.50% floating", "ลอยตัว MRR − 1.50%"])
      : INTAKE.product === "car" ? O(["fixed", "4.79% effective, fixed", "คงที่ 4.79% ต่อปี (อัตราที่แท้จริง)"]) : O(["fixed15", "15.00% effective, reducing balance", "15.00% ต่อปี ลดต้นลดดอก"]) },
    { k: "repayDay", en: "Due day each month", th: "วันครบกำหนดชำระ", t: "select", req: true, o: O(["1", "1st", "วันที่ 1"], ["5", "5th", "วันที่ 5"], ["10", "10th", "วันที่ 10"], ["15", "15th", "วันที่ 15"], ["25", "25th", "วันที่ 25"], ["28", "28th", "วันที่ 28"]), src: "customer", why: "contract" },
    { k: "repayMethod", en: "How instalments are paid", th: "วิธีชำระค่างวด", t: "select", req: true, re: true, o: O(["dd", "Direct debit, account at this bank", "หักบัญชีธนาคารนี้"], ["edda", "e-DDA from another bank", "e-DDA จากธนาคารอื่น"], ["payroll", "Payroll deduction", "หักเงินเดือน"], ["transfer", "PromptPay or transfer", "พร้อมเพย์หรือโอน"]), src: "customer", why: "ops" },
    { k: "repayAccount", en: "Account to debit", th: "บัญชีที่หัก", t: "text", req: true, when: (f) => f.repayMethod === "dd" || f.repayMethod === "edda", src: "customer", why: "ops" },
    { k: "disburseTo", en: "Pay the loan to", th: "จ่ายเงินกู้เข้า", t: "select", req: true, re: true, src: "customer", why: "ops", o: () => INTAKE.product === "home" ? O(["seller", "The seller, by cashier's cheque at the Land Office", "ผู้ขาย ด้วยแคชเชียร์เช็คที่สำนักงานที่ดิน"], ["developer", "The developer's account", "บัญชีผู้พัฒนาโครงการ"])
      : INTAKE.product === "car" ? O(["dealer", "The dealer, CUR-D0007", "ดีลเลอร์ CUR-D0007"]) : O(["own", "Savings SAV-C13 at this bank", "ออมทรัพย์ SAV-C13 ธนาคารนี้"], ["other", "An account at another bank", "บัญชีธนาคารอื่น"], ["lender", "Directly to the lender being paid off", "จ่ายตรงให้เจ้าหนี้เดิม"]) },
    { k: "disburseAccount", en: "Bank and account number", th: "ธนาคารและเลขบัญชี", t: "text", req: true, when: (f) => f.disburseTo === "other", src: "customer", why: "aml", hint: ["Must be in the applicant's name", "ต้องเป็นบัญชีชื่อผู้กู้"] }] },
  { s: "loan", id: "insurance", en: "Insurance", th: "ประกันภัย", sub: ["Optional cover is never a condition of the loan, and the customer chooses the insurer.", "ประกันที่เป็นทางเลือกไม่ใช่เงื่อนไขของสินเชื่อ และลูกค้าเลือกบริษัทประกันได้เอง"], fields: [
    { k: "creditLife", en: "Credit life cover", th: "ประกันคุ้มครองสินเชื่อ", t: "select", req: true, re: true, o: O(["none", "None", "ไม่ทำ"], ["financed", "Yes, premium added to the loan", "ทำ ชำระเบี้ยรวมในวงเงินกู้"], ["cash", "Yes, premium paid separately", "ทำ ชำระเบี้ยแยก"], ["assigned", "Existing life policy assigned", "โอนสิทธิ์กรมธรรม์ที่มีอยู่"]), src: "customer", why: "conduct" },
    { k: "insOptionalAck", en: "Told that this cover is optional and not a condition", th: "ได้แจ้งลูกค้าว่าประกันนี้เป็นทางเลือก ไม่ใช่เงื่อนไข", t: "check", req: true, when: (f) => f.creditLife && f.creditLife !== "none", src: "staff", why: "conduct", wide: true },
    { k: "fireInsurer", en: "Fire insurance", th: "ประกันอัคคีภัย", t: "select", req: true, when: isP("home"), o: O(["own", "Insurer of the customer's choice", "บริษัทประกันที่ลูกค้าเลือก"], ["partner", "One of the bank's partner insurers", "บริษัทประกันคู่ค้าของธนาคาร"]), src: "customer", why: "collateral", hint: ["Required on mortgaged property", "จำเป็นสำหรับทรัพย์ที่จำนอง"] },
    { k: "motorClass", en: "Motor insurance", th: "ประกันภัยรถยนต์", t: "select", req: true, when: isP("car"), o: O(["1", "Class 1", "ชั้น 1"], ["2+", "Class 2+", "ชั้น 2+"], ["3+", "Class 3+", "ชั้น 3+"]), src: "customer", why: "collateral" }] },
  { s: "loan", id: "channel", en: "Where the application came from", th: "ช่องทางการสมัคร", fields: [
    { k: "channel", en: "Channel", th: "ช่องทาง", t: "select", req: true, re: true, o: O(["branch", "Branch", "สาขา"], ["app", "Mobile app", "แอป"], ["dealer", "Dealer", "ดีลเลอร์"], ["rm", "Relationship manager", "ผู้ดูแลความสัมพันธ์"], ["telesales", "Telesales", "เทเลเซลส์"], ["broker", "Broker", "นายหน้า"]), src: "staff", why: "ops" },
    { k: "branch", en: "Branch", th: "สาขา", t: "text", req: true, when: (f) => f.channel === "branch", src: "staff", why: "ops" },
    { k: "staffCode", en: "Staff code", th: "รหัสพนักงาน", t: "text", req: true, src: "staff", why: "ops", ro: true },
    { k: "dealerCode", en: "Dealer code", th: "รหัสดีลเลอร์", t: "text", req: true, when: isP("car"), src: "staff", why: "ops" },
    { k: "campaign", en: "Campaign code", th: "รหัสแคมเปญ", t: "text", src: "staff", why: "ops" },
    { k: "referrer", en: "Referred by", th: "ผู้แนะนำ", t: "text", src: "staff", why: "ops" }] },

  /* ---- applicant ---- */
  { s: "applicant", id: "identity", en: "Identity", th: "ข้อมูลตัวตน", sub: ["From the customer record and the DOPA check; changes to identity go through KYC.", "จากข้อมูลลูกค้าและการตรวจกับกรมการปกครอง การแก้ไขข้อมูลตัวตนต้องผ่าน KYC"], fields: [
    { k: "title", en: "Title", th: "คำนำหน้า", t: "select", req: true, o: O(["mr", "Mr", "นาย"], ["mrs", "Mrs", "นาง"], ["miss", "Miss", "นางสาว"], ["other", "Other", "อื่น ๆ"]), src: "record", why: "kyc" },
    { k: "firstTh", en: "First name (Thai)", th: "ชื่อ (ไทย)", t: "text", req: true, src: "record", why: "kyc" },
    { k: "lastTh", en: "Last name (Thai)", th: "นามสกุล (ไทย)", t: "text", req: true, src: "record", why: "kyc" },
    { k: "firstEn", en: "First name (English)", th: "ชื่อ (อังกฤษ)", t: "text", req: true, src: "record", why: "kyc" },
    { k: "lastEn", en: "Last name (English)", th: "นามสกุล (อังกฤษ)", t: "text", req: true, src: "record", why: "kyc" },
    { k: "citizenId", en: "Citizen ID", th: "เลขประจำตัวประชาชน", t: "id", req: true, ro: true, src: "dopa", why: "kyc" },
    { k: "idIssued", en: "ID issued", th: "วันออกบัตร", t: "date", req: true, ro: true, src: "dopa", why: "kyc" },
    { k: "idExpiry", en: "ID expires", th: "วันบัตรหมดอายุ", t: "date", req: true, ro: true, src: "dopa", why: "kyc" },
    { k: "dob", en: "Date of birth", th: "วันเกิด", t: "date", req: true, ro: true, src: "dopa", why: "policy" },
    { k: "gender", en: "Sex", th: "เพศ", t: "select", req: true, o: O(["f", "Female", "หญิง"], ["m", "Male", "ชาย"]), src: "record", why: "kyc" },
    { k: "nationality", en: "Nationality", th: "สัญชาติ", t: "select", req: true, re: true, o: O(["th", "Thai", "ไทย"], ["other", "Other", "อื่น ๆ"]), src: "record", why: "kyc" },
    { k: "passport", en: "Passport number", th: "เลขหนังสือเดินทาง", t: "text", req: true, when: (f) => f.nationality === "other", src: "customer", why: "kyc" },
    { k: "workPermit", en: "Work permit number", th: "เลขใบอนุญาตทำงาน", t: "text", req: true, when: (f) => f.nationality === "other", src: "customer", why: "policy" },
    { k: "marital", en: "Marital status", th: "สถานภาพสมรส", t: "select", req: true, re: true, o: O(["single", "Single", "โสด"], ["married-reg", "Married, registered", "สมรส จดทะเบียน"], ["married", "Married, not registered", "สมรส ไม่จดทะเบียน"], ["divorced", "Divorced", "หย่า"], ["widowed", "Widowed", "หม้าย"]), src: "customer", why: "policy" },
    { k: "spouseName", en: "Spouse's name", th: "ชื่อคู่สมรส", t: "text", req: true, when: (f) => f.marital === "married-reg", src: "customer", why: "contract", hint: ["A registered spouse consents to a mortgage of marital property", "คู่สมรสที่จดทะเบียนต้องให้ความยินยอมในการจำนองสินสมรส"] },
    { k: "spouseId", en: "Spouse's citizen ID", th: "เลขประจำตัวประชาชนคู่สมรส", t: "id", req: true, when: (f) => f.marital === "married-reg", src: "customer", why: "contract" },
    { k: "dependants", en: "Dependants", th: "จำนวนผู้อยู่ในอุปการะ", t: "num", req: true, src: "customer", why: "policy" },
    { k: "education", en: "Education", th: "การศึกษา", t: "select", req: true, o: O(["below", "Below bachelor's", "ต่ำกว่าปริญญาตรี"], ["bachelor", "Bachelor's", "ปริญญาตรี"], ["master", "Master's", "ปริญญาโท"], ["doctorate", "Doctorate", "ปริญญาเอก"]), src: "customer", why: "policy" }] },
  { s: "applicant", id: "contact", en: "Contact", th: "การติดต่อ", fields: [
    { k: "mobile", en: "Mobile", th: "โทรศัพท์มือถือ", t: "tel", req: true, src: "record", why: "ops" },
    { k: "email", en: "Email", th: "อีเมล", t: "email", req: true, src: "record", why: "ops" },
    { k: "lineId", en: "LINE ID", th: "LINE ID", t: "text", src: "customer", why: "ops" },
    { k: "contactLang", en: "Language for letters", th: "ภาษาของเอกสาร", t: "select", req: true, o: O(["th", "Thai", "ไทย"], ["en", "English", "อังกฤษ"]), src: "customer", why: "conduct" },
    { k: "contactPref", en: "Preferred channel", th: "ช่องทางที่สะดวก", t: "select", req: true, o: O(["app", "The app", "แอป"], ["sms", "SMS", "SMS"], ["email", "Email", "อีเมล"], ["phone", "Phone", "โทรศัพท์"]), src: "customer", why: "conduct" }] },
  { s: "applicant", id: "regaddr", en: "Address on the house registration", th: "ที่อยู่ตามทะเบียนบ้าน", fields: [
    { k: "regNo", en: "House number", th: "บ้านเลขที่", t: "text", req: true, src: "dopa", why: "kyc" }, { k: "regMoo", en: "Moo", th: "หมู่", t: "text", src: "dopa", why: "kyc" },
    { k: "regVillage", en: "Village or building", th: "หมู่บ้าน/อาคาร", t: "text", src: "dopa", why: "kyc" }, { k: "regSoi", en: "Soi", th: "ซอย", t: "text", src: "dopa", why: "kyc" },
    { k: "regRoad", en: "Road", th: "ถนน", t: "text", src: "dopa", why: "kyc" }, { k: "regSub", en: "Subdistrict", th: "แขวง/ตำบล", t: "text", req: true, src: "dopa", why: "kyc" },
    { k: "regDist", en: "District", th: "เขต/อำเภอ", t: "text", req: true, src: "dopa", why: "kyc" }, { k: "regProv", en: "Province", th: "จังหวัด", t: "select", o: PROVINCES, req: true, src: "dopa", why: "kyc" },
    { k: "regPost", en: "Postcode", th: "รหัสไปรษณีย์", t: "post", req: true, src: "dopa", why: "kyc" }] },
  { s: "applicant", id: "curaddr", en: "Where the applicant lives", th: "ที่อยู่ปัจจุบัน", fields: [
    { k: "curSame", en: "Same as the house registration", th: "เหมือนที่อยู่ตามทะเบียนบ้าน", t: "check", re: true, src: "customer", why: "kyc", wide: true },
    { k: "curNo", en: "House number", th: "บ้านเลขที่", t: "text", req: true, when: (f) => !f.curSame, src: "customer", why: "kyc" }, { k: "curSub", en: "Subdistrict", th: "แขวง/ตำบล", t: "text", req: true, when: (f) => !f.curSame, src: "customer", why: "kyc" },
    { k: "curDist", en: "District", th: "เขต/อำเภอ", t: "text", req: true, when: (f) => !f.curSame, src: "customer", why: "kyc" }, { k: "curProv", en: "Province", th: "จังหวัด", t: "select", o: PROVINCES, req: true, when: (f) => !f.curSame, src: "customer", why: "kyc" },
    { k: "curPost", en: "Postcode", th: "รหัสไปรษณีย์", t: "post", req: true, when: (f) => !f.curSame, src: "customer", why: "kyc" },
    { k: "residence", en: "Home is", th: "ลักษณะที่อยู่อาศัย", t: "select", req: true, re: true, o: O(["own", "Owned outright", "เป็นเจ้าของ ไม่มีภาระ"], ["mortgage", "Owned with a mortgage", "เป็นเจ้าของ ติดจำนอง"], ["rent", "Rented", "เช่า"], ["family", "Family home", "บ้านครอบครัว"], ["employer", "Employer's housing", "บ้านพักสวัสดิการ"]), src: "customer", why: "policy" },
    { k: "yearsAt", en: "Years at this address", th: "อาศัยมา (ปี)", t: "num", req: true, src: "customer", why: "policy" },
    { k: "rent", en: "Monthly rent", th: "ค่าเช่าต่อเดือน", t: "money", req: true, when: (f) => f.residence === "rent", src: "customer", why: "policy" },
    { k: "mailTo", en: "Send letters to", th: "ที่อยู่ส่งเอกสาร", t: "select", req: true, o: O(["registered", "House registration address", "ที่อยู่ตามทะเบียนบ้าน"], ["current", "Current address", "ที่อยู่ปัจจุบัน"], ["work", "Work address", "ที่ทำงาน"]), src: "customer", why: "ops" }] },
  { s: "applicant", id: "emergency", en: "Emergency contact", th: "บุคคลที่ติดต่อได้กรณีฉุกเฉิน", fields: [
    { k: "emName", en: "Name", th: "ชื่อ-นามสกุล", t: "text", req: true, src: "customer", why: "ops" },
    { k: "emRel", en: "Relationship", th: "ความสัมพันธ์", t: "select", o: RELATION, req: true, src: "customer", why: "ops" },
    { k: "emMobile", en: "Mobile", th: "โทรศัพท์มือถือ", t: "tel", req: true, src: "customer", why: "ops" },
    { k: "emDiffAddr", en: "Does not live with the applicant", th: "ไม่ได้อาศัยอยู่กับผู้กู้", t: "check", req: true, src: "customer", why: "ops", wide: true }] },

  /* ---- work and income ---- */
  { s: "work", id: "occupation", en: "Occupation", th: "อาชีพ", fields: [
    { k: "occType", en: "Occupation", th: "อาชีพ", t: "select", o: OCC, req: true, re: true, src: "customer", why: "policy" }] },
  { s: "work", id: "employer", en: "Employer", th: "นายจ้าง", when: isEmp, fields: [
    { k: "employer", en: "Employer", th: "ชื่อนายจ้าง", t: "text", req: true, src: "customer", why: "policy" },
    { k: "industry", en: "Industry", th: "ประเภทธุรกิจ", t: "select", o: INDUSTRY, req: true, src: "customer", why: "policy" },
    { k: "employerReg", en: "Employer's registration number", th: "เลขทะเบียนนิติบุคคลของนายจ้าง", t: "text", src: "customer", why: "policy" },
    { k: "position", en: "Position", th: "ตำแหน่ง", t: "text", req: true, src: "customer", why: "policy" },
    { k: "department", en: "Department", th: "แผนก", t: "text", src: "customer", why: "policy" },
    { k: "empType", en: "Employment", th: "ประเภทการจ้าง", t: "select", req: true, o: O(["permanent", "Permanent", "พนักงานประจำ"], ["contract", "Fixed-term contract", "สัญญาจ้าง"], ["probation", "On probation", "ทดลองงาน"]), src: "customer", why: "policy" },
    { k: "startDate", en: "Started", th: "วันเริ่มงาน", t: "date", req: true, src: "customer", why: "policy" },
    { k: "workPhone", en: "Work phone", th: "โทรศัพท์ที่ทำงาน", t: "tel", req: true, src: "customer", why: "policy", hint: ["Used to confirm employment", "ใช้ยืนยันการทำงาน"] },
    { k: "workProv", en: "Workplace province", th: "จังหวัดที่ทำงาน", t: "select", o: PROVINCES, req: true, src: "customer", why: "policy" }] },
  { s: "work", id: "business", en: "Business", th: "กิจการ", when: isSelf, fields: [
    { k: "bizName", en: "Business name", th: "ชื่อกิจการ", t: "text", req: true, src: "customer", why: "policy" },
    { k: "bizReg", en: "Registration number", th: "เลขทะเบียนพาณิชย์/นิติบุคคล", t: "text", req: true, when: (f) => f.occType === "owner", src: "customer", why: "kyc" },
    { k: "bizType", en: "Industry", th: "ประเภทธุรกิจ", t: "select", o: INDUSTRY, req: true, src: "customer", why: "aml" },
    { k: "bizStart", en: "Trading since", th: "เริ่มกิจการ", t: "date", req: true, src: "customer", why: "policy" },
    { k: "bizRevenue", en: "Monthly revenue", th: "รายได้ต่อเดือน", t: "money", req: true, src: "statement", why: "policy" },
    { k: "bizProfit", en: "Monthly net profit", th: "กำไรสุทธิต่อเดือน", t: "money", req: true, src: "customer", why: "policy" },
    { k: "taxForm", en: "Personal tax return", th: "แบบแสดงรายการภาษี", t: "select", req: true, o: O(["pnd90", "PND 90", "ภ.ง.ด.90"], ["pnd91", "PND 91", "ภ.ง.ด.91"], ["none", "Not filed", "ไม่ได้ยื่น"]), src: "customer", why: "policy" }] },
  { s: "work", id: "pension", en: "Pension", th: "บำนาญ", when: (f) => f.occType === "retired", fields: [
    { k: "pension", en: "Monthly pension", th: "บำนาญต่อเดือน", t: "money", req: true, src: "statement", why: "policy" },
    { k: "pensionSource", en: "Paid by", th: "ผู้จ่ายบำนาญ", t: "text", req: true, src: "customer", why: "policy" }] },
  { s: "work", id: "income", en: "Income", th: "รายได้", sub: () => [`Variable income is counted at ${POLICY.haircut.variable}% and other income at ${POLICY.haircut.other}%, by credit policy.`, `รายได้ไม่ประจำนับ ${POLICY.haircut.variable}% และรายได้อื่นนับ ${POLICY.haircut.other}% ตามนโยบายสินเชื่อ`], when: (f) => f.occType !== "retired", fields: [
    { k: "salary", en: "Monthly salary", th: "เงินเดือน", t: "money", req: true, when: isEmp, src: "statement", why: "policy" },
    { k: "allowance", en: "Fixed allowances", th: "ค่าตอบแทนประจำอื่น", t: "money", when: isEmp, src: "statement", why: "policy" },
    { k: "variable", en: "Overtime, commission, bonus (6-month average)", th: "ค่าล่วงเวลา คอมมิชชัน โบนัส (เฉลี่ย 6 เดือน)", t: "money", when: isEmp, src: "statement", why: "policy" },
    { k: "otherInc", en: "Other income", th: "รายได้อื่น", t: "money", re: true, src: "customer", why: "policy" },
    { k: "otherSrc", en: "Other income from", th: "ที่มาของรายได้อื่น", t: "text", req: true, when: (f) => num(f.otherInc) > 0, src: "customer", why: "aml" },
    { k: "payrollBank", en: "Salary paid into", th: "ธนาคารที่รับเงินเดือน", t: "select", o: BANKS, req: true, when: isEmp, src: "statement", why: "policy" },
    { k: "incomeProof", en: "Income verified by", th: "ยืนยันรายได้โดย", t: "select", req: true, o: O(["statement-api", "Statements read with consent", "รายการเดินบัญชีผ่านความยินยอม"], ["payslip", "Payslip", "สลิปเงินเดือน"], ["cert", "Salary certificate", "หนังสือรับรองเงินเดือน"], ["eslip", "e-Payslip", "e-Payslip"], ["tax", "Tax return", "แบบแสดงรายการภาษี"]), src: "staff", why: "bot" }] },

  /* ---- debts and assets ---- */
  { s: "finance", id: "declared", en: "Debts the credit bureau does not show", th: "ภาระหนี้ที่ไม่ปรากฏในเครดิตบูโร", sub: ["Ask about these: they are common and change the debt service ratio.", "ควรสอบถามเสมอ เพราะพบบ่อยและมีผลต่อภาระหนี้ต่อรายได้"], fields: [
    { k: "coopLoan", en: "Savings cooperative loan, monthly", th: "เงินกู้สหกรณ์ ต่อเดือน", t: "money", src: "customer", why: "bot" },
    { k: "studentLoan", en: "Student loan (SLF), monthly", th: "กยศ. ต่อเดือน", t: "money", src: "customer", why: "bot" },
    { k: "informal", en: "Informal or family loans, monthly", th: "หนี้นอกระบบหรือในครอบครัว ต่อเดือน", t: "money", src: "customer", why: "bot" },
    { k: "otherObl", en: "Other obligations, monthly", th: "ภาระอื่น ต่อเดือน", t: "money", src: "customer", why: "bot", hint: ["Alimony, guarantees called", "ค่าเลี้ยงดู ภาระค้ำประกัน"] },
    { k: "livingCost", en: "Living costs, monthly", th: "ค่าใช้จ่ายในการครองชีพ ต่อเดือน", t: "money", req: true, src: "customer", why: "bot" }] },
  { s: "finance", id: "assets", en: "Assets", th: "ทรัพย์สิน", fields: [
    { k: "depositsOther", en: "Deposits at other banks", th: "เงินฝากธนาคารอื่น", t: "money", src: "customer", why: "policy" },
    { k: "investments", en: "Investments", th: "เงินลงทุน", t: "money", src: "customer", why: "policy" },
    { k: "propertyOwned", en: "Property owned", th: "อสังหาริมทรัพย์ที่มี", t: "select", req: true, o: O(["none", "None", "ไม่มี"], ["one", "One", "1 แห่ง"], ["more", "Two or more", "2 แห่งขึ้นไป"]), src: "customer", why: "ltv" },
    { k: "vehicles", en: "Vehicles owned", th: "จำนวนรถยนต์ที่มี", t: "num", src: "customer", why: "policy" }] },

  /* ---- co-borrower and guarantor ---- */
  { s: "coapp", id: "co", en: "Co-borrower", th: "ผู้กู้ร่วม", when: isP("home", "car"), fields: [
    { k: "hasCo", en: "Add a co-borrower", th: "มีผู้กู้ร่วม", t: "select", o: YN, req: true, re: true, src: "customer", why: "policy" },
    { k: "coRel", en: "Relationship", th: "ความสัมพันธ์", t: "select", req: true, when: (f) => f.hasCo === "yes", o: O(["spouse", "Spouse", "คู่สมรส"], ["parent", "Parent", "บิดามารดา"], ["sibling", "Brother or sister", "พี่น้อง"], ["child", "Child", "บุตร"]), src: "customer", why: "policy" },
    { k: "coName", en: "Name", th: "ชื่อ-นามสกุล", t: "text", req: true, when: (f) => f.hasCo === "yes", src: "customer", why: "kyc" },
    { k: "coId", en: "Citizen ID", th: "เลขประจำตัวประชาชน", t: "id", req: true, when: (f) => f.hasCo === "yes", src: "customer", why: "kyc" },
    { k: "coDob", en: "Date of birth", th: "วันเกิด", t: "date", req: true, when: (f) => f.hasCo === "yes", src: "customer", why: "policy" },
    { k: "coMobile", en: "Mobile", th: "โทรศัพท์มือถือ", t: "tel", req: true, when: (f) => f.hasCo === "yes", src: "customer", why: "ops" },
    { k: "coOcc", en: "Occupation", th: "อาชีพ", t: "select", o: OCC, req: true, when: (f) => f.hasCo === "yes", src: "customer", why: "policy" },
    { k: "coEmployer", en: "Employer or business", th: "นายจ้างหรือกิจการ", t: "text", req: true, when: (f) => f.hasCo === "yes", src: "customer", why: "policy" },
    { k: "coIncome", en: "Monthly income", th: "รายได้ต่อเดือน", t: "money", req: true, when: (f) => f.hasCo === "yes", src: "statement", why: "policy" },
    { k: "coDebts", en: "Monthly debt payments", th: "ภาระหนี้ต่อเดือน", t: "money", req: true, when: (f) => f.hasCo === "yes", src: "ncb", why: "bot" },
    { k: "coNcb", en: "Co-borrower gave credit bureau consent", th: "ผู้กู้ร่วมให้ความยินยอมตรวจเครดิตบูโรแล้ว", t: "check", req: true, when: (f) => f.hasCo === "yes", src: "customer", why: "ncb", wide: true }] },
  { s: "coapp", id: "guarantor", en: "Guarantor", th: "ผู้ค้ำประกัน", when: isP("car"), sub: ["A guarantor's liability is limited to the borrower's debt, under the Civil and Commercial Code.", "ความรับผิดของผู้ค้ำประกันจำกัดเท่าหนี้ของผู้กู้ ตามประมวลกฎหมายแพ่งและพาณิชย์"], fields: [
    { k: "hasGu", en: "Add a guarantor", th: "มีผู้ค้ำประกัน", t: "select", o: YN, req: true, re: true, src: "customer", why: "policy" },
    { k: "guName", en: "Name", th: "ชื่อ-นามสกุล", t: "text", req: true, when: (f) => f.hasGu === "yes", src: "customer", why: "kyc" },
    { k: "guId", en: "Citizen ID", th: "เลขประจำตัวประชาชน", t: "id", req: true, when: (f) => f.hasGu === "yes", src: "customer", why: "kyc" },
    { k: "guMobile", en: "Mobile", th: "โทรศัพท์มือถือ", t: "tel", req: true, when: (f) => f.hasGu === "yes", src: "customer", why: "ops" },
    { k: "guIncome", en: "Monthly income", th: "รายได้ต่อเดือน", t: "money", req: true, when: (f) => f.hasGu === "yes", src: "statement", why: "policy" },
    { k: "guNcb", en: "Guarantor gave credit bureau consent", th: "ผู้ค้ำประกันให้ความยินยอมตรวจเครดิตบูโรแล้ว", t: "check", req: true, when: (f) => f.hasGu === "yes", src: "customer", why: "ncb", wide: true }] },

  /* ---- security ---- */
  { s: "security", id: "property", en: "Property", th: "ทรัพย์ที่จำนอง", when: isP("home"), fields: [
    { k: "propType", en: "Property type", th: "ประเภททรัพย์", t: "select", req: true, o: O(["condo", "Condominium", "คอนโดมิเนียม"], ["townhouse", "Townhouse", "ทาวน์เฮาส์"], ["detached", "Detached house", "บ้านเดี่ยว"], ["land", "Land and house", "ที่ดินพร้อมบ้าน"], ["shophouse", "Shophouse", "อาคารพาณิชย์"]), src: "customer", why: "collateral" },
    { k: "project", en: "Project", th: "โครงการ", t: "text", req: true, src: "customer", why: "collateral" },
    { k: "developer", en: "Developer or seller", th: "ผู้พัฒนาโครงการหรือผู้ขาย", t: "text", req: true, src: "customer", why: "aml" },
    { k: "unitNo", en: "Unit or house number", th: "เลขที่ห้องชุด/บ้านเลขที่", t: "text", req: true, src: "customer", why: "collateral" },
    { k: "deedType", en: "Title document", th: "เอกสารสิทธิ์", t: "select", req: true, o: O(["chanote", "Title deed (Chanote)", "โฉนดที่ดิน"], ["ns3g", "Nor Sor 3 Gor", "น.ส.3 ก."], ["condo", "Condominium title", "หนังสือกรรมสิทธิ์ห้องชุด"]), src: "customer", why: "collateral" },
    { k: "deedNo", en: "Title number", th: "เลขที่เอกสารสิทธิ์", t: "text", req: true, src: "customer", why: "collateral" },
    { k: "size", en: "Size", th: "ขนาด", t: "text", req: true, src: "customer", why: "collateral", hint: ["Square metres, or rai-ngan-wah", "ตารางเมตร หรือ ไร่-งาน-วา"] },
    { k: "propProv", en: "Province", th: "จังหวัด", t: "select", o: PROVINCES, req: true, src: "customer", why: "collateral" },
    { k: "price", en: "Purchase price", th: "ราคาซื้อขาย", t: "money", req: true, src: "customer", why: "ltv" },
    { k: "booking", en: "Deposit already paid", th: "เงินจองและเงินทำสัญญาที่จ่ายแล้ว", t: "money", src: "customer", why: "policy" },
    { k: "downSource", en: "Down payment comes from", th: "ที่มาของเงินดาวน์", t: "select", req: true, o: O(["savings", "Own savings", "เงินออมของตนเอง"], ["gift", "A gift from family", "ครอบครัวให้"], ["sale", "Sale of another asset", "ขายทรัพย์สินอื่น"], ["other", "Other", "อื่น ๆ"]), src: "customer", why: "aml" },
    { k: "mortgageNo", en: "This is the customer's", th: "สัญญาจำนองที่อยู่อาศัยนี้เป็น", t: "select", req: true, re: true, o: O(["1", "First home-loan contract", "สัญญาที่ 1"], ["2", "Second home-loan contract", "สัญญาที่ 2"], ["3", "Third or later", "สัญญาที่ 3 ขึ้นไป"]), src: "ncb", why: "ltv" },
    { k: "firstMortgageDate", en: "First contract dated", th: "วันที่ทำสัญญาแรก", t: "date", req: true, when: (f) => f.mortgageNo !== "1", src: "ncb", why: "ltv", hint: ["The LTV limit on a second contract depends on how long the first has run", "เพดาน LTV ของสัญญาที่ 2 ขึ้นกับระยะเวลาผ่อนสัญญาแรก"] },
    { k: "appraisal", en: "Appraised value", th: "ราคาประเมิน", t: "money", req: true, ro: true, src: "appraiser", why: "ltv" },
    { k: "appraiser", en: "Appraisal report", th: "รายงานการประเมิน", t: "text", ro: true, src: "appraiser", why: "collateral", wide: true },
    { k: "transferDate", en: "Transfer at the Land Office", th: "วันโอนที่สำนักงานที่ดิน", t: "date", req: true, src: "customer", why: "ops" },
    { k: "landOffice", en: "Land Office", th: "สำนักงานที่ดิน", t: "text", req: true, src: "customer", why: "ops" }] },
  { s: "security", id: "vehicle", en: "Vehicle", th: "รถยนต์", when: isP("car"), fields: [
    { k: "carCond", en: "New or used", th: "รถใหม่หรือรถใช้แล้ว", t: "select", req: true, re: true, o: O(["new", "New", "รถใหม่"], ["used", "Used", "รถใช้แล้ว"]), src: "customer", why: "policy" },
    { k: "make", en: "Make", th: "ยี่ห้อ", t: "select", req: true, o: O("Toyota", "Honda", "Isuzu", "Mitsubishi", "Mazda", "Nissan", "BYD", "MG", "Other"), src: "customer", why: "collateral" },
    { k: "model", en: "Model", th: "รุ่น", t: "text", req: true, src: "customer", why: "collateral" },
    { k: "year", en: "Model year", th: "ปีรุ่น", t: "num", req: true, src: "customer", why: "policy" },
    { k: "fuel", en: "Power", th: "เชื้อเพลิง", t: "select", req: true, o: O(["petrol", "Petrol", "เบนซิน"], ["diesel", "Diesel", "ดีเซล"], ["hybrid", "Hybrid", "ไฮบริด"], ["ev", "Electric", "ไฟฟ้า"]), src: "customer", why: "collateral" },
    { k: "chassis", en: "Chassis number", th: "เลขตัวถัง", t: "text", req: true, when: (f) => f.carCond === "used", src: "customer", why: "collateral" },
    { k: "plate", en: "Registration", th: "ทะเบียนรถ", t: "text", req: true, when: (f) => f.carCond === "used", src: "customer", why: "collateral" },
    { k: "carPrice", en: "Cash price", th: "ราคาเงินสด", t: "money", req: true, src: "customer", why: "policy" },
    { k: "carDown", en: "Down payment", th: "เงินดาวน์", t: "money", req: true, src: "customer", why: "policy" },
    { k: "redbook", en: "Market value (price guide)", th: "ราคากลางตลาด", t: "money", req: true, ro: true, when: (f) => f.carCond === "used", src: "system", why: "policy" },
    { k: "carUse", en: "Used for", th: "การใช้งาน", t: "select", req: true, o: O(["personal", "Personal", "ส่วนบุคคล"], ["commercial", "Commercial", "เชิงพาณิชย์"]), src: "customer", why: "policy" }] },

  /* ---- declarations and consents ---- */
  { s: "consents", id: "data", en: "Credit bureau and personal data", th: "เครดิตบูโรและข้อมูลส่วนบุคคล", fields: [
    { k: "ncbConsent", en: "Credit bureau (NCB) consent", th: "ความยินยอมตรวจข้อมูลเครดิต (NCB)", t: "check", req: true, ro: true, src: "customer", why: "ncb", wide: true, hint: ["Given in the app at 10:24 with NDID; kept for the bureau's audit", "ให้ในแอปเวลา 10:24 ด้วย NDID เก็บไว้สำหรับการตรวจของเครดิตบูโร"] },
    { k: "pdpaMarketing", en: "Marketing by the bank", th: "การตลาดโดยธนาคาร", t: "select", o: YN, req: true, src: "customer", why: "pdpa", hint: ["Optional; the loan does not depend on it", "เป็นทางเลือก ไม่มีผลต่อสินเชื่อ"] },
    { k: "pdpaPartners", en: "Share with partners for offers", th: "ส่งข้อมูลให้พันธมิตรเพื่อเสนอสิทธิประโยชน์", t: "select", o: YN, req: true, src: "customer", why: "pdpa" }] },
  { s: "consents", id: "kyc", en: "Politically exposed persons and source of funds", th: "บุคคลที่มีสถานภาพทางการเมืองและแหล่งเงิน", fields: [
    { k: "pep", en: "Holds or held a prominent public position", th: "เป็นหรือเคยเป็นบุคคลที่มีสถานภาพทางการเมือง", t: "select", req: true, re: true, o: O(["no", "No", "ไม่ใช่"], ["self", "Yes, the applicant", "ใช่ ผู้กู้เอง"], ["family", "A family member", "สมาชิกในครอบครัว"], ["associate", "A close associate", "ผู้ใกล้ชิด"]), src: "customer", why: "aml" },
    { k: "pepDetail", en: "Position and country", th: "ตำแหน่งและประเทศ", t: "text", req: true, when: (f) => f.pep && f.pep !== "no", src: "customer", why: "aml" },
    { k: "fundsSource", en: "Repayments come from", th: "แหล่งเงินที่ใช้ชำระ", t: "select", req: true, o: O(["salary", "Salary", "เงินเดือน"], ["business", "Business income", "รายได้จากกิจการ"], ["pension", "Pension", "บำนาญ"], ["family", "Family support", "ครอบครัวสนับสนุน"], ["other", "Other", "อื่น ๆ"]), src: "customer", why: "aml" },
    { k: "beneficiary", en: "Who benefits from the loan", th: "ผู้รับประโยชน์จากสินเชื่อ", t: "select", req: true, re: true, o: O(["self", "The applicant", "ผู้กู้เอง"], ["other", "Someone else", "บุคคลอื่น"]), src: "customer", why: "aml" },
    { k: "beneficiaryName", en: "Beneficiary's name and relationship", th: "ชื่อผู้รับประโยชน์และความสัมพันธ์", t: "text", req: true, when: (f) => f.beneficiary === "other", src: "customer", why: "aml" }] },
  { s: "consents", id: "tax", en: "Tax residence", th: "ถิ่นที่อยู่ทางภาษี", fields: [
    { k: "usPerson", en: "US citizen, green-card holder or born in the US", th: "เป็นพลเมืองสหรัฐ ผู้ถือกรีนการ์ด หรือเกิดในสหรัฐ", t: "select", o: YN, req: true, re: true, src: "customer", why: "fatca" },
    { k: "usTin", en: "US taxpayer number", th: "เลขประจำตัวผู้เสียภาษีสหรัฐ", t: "text", req: true, when: (f) => f.usPerson === "yes", src: "customer", why: "fatca" },
    { k: "taxResOther", en: "Tax resident outside Thailand", th: "มีถิ่นที่อยู่ทางภาษีนอกประเทศไทย", t: "select", o: YN, req: true, re: true, src: "customer", why: "fatca" },
    { k: "taxCountry", en: "Country and tax number", th: "ประเทศและเลขผู้เสียภาษี", t: "text", req: true, when: (f) => f.taxResOther === "yes", src: "customer", why: "fatca" }] },
  { s: "consents", id: "related", en: "Related parties and legal history", th: "บุคคลที่เกี่ยวข้องและประวัติทางกฎหมาย", fields: [
    { k: "relatedBank", en: "Related to the bank's directors, executives or major shareholders", th: "เกี่ยวข้องกับกรรมการ ผู้บริหาร หรือผู้ถือหุ้นรายใหญ่ของธนาคาร", t: "select", req: true, o: O(["no", "No", "ไม่ใช่"], ["director", "A director", "กรรมการ"], ["executive", "An executive", "ผู้บริหาร"], ["shareholder", "A major shareholder", "ผู้ถือหุ้นรายใหญ่"], ["family", "Family of one of these", "ครอบครัวของบุคคลดังกล่าว"]), src: "customer", why: "related" },
    { k: "staff", en: "Employee of the bank", th: "เป็นพนักงานของธนาคาร", t: "select", o: YN, req: true, src: "customer", why: "related" },
    { k: "bankrupt", en: "Bankrupt, or in debt restructuring by court, in the last 5 years", th: "เคยล้มละลายหรือฟื้นฟูกิจการโดยศาลใน 5 ปี", t: "select", o: YN, req: true, re: true, src: "customer", why: "policy" },
    { k: "litigation", en: "Being sued over a debt", th: "อยู่ระหว่างถูกฟ้องเกี่ยวกับหนี้", t: "select", o: YN, req: true, re: true, src: "customer", why: "policy" },
    { k: "legalDetail", en: "Details", th: "รายละเอียด", t: "area", req: true, when: (f) => f.bankrupt === "yes" || f.litigation === "yes", src: "customer", why: "policy", wide: true }] },
  { s: "consents", id: "certify", en: "Confirmation", th: "การรับรอง", fields: [
    { k: "certify", en: "The applicant confirms the information is true and complete, and knows a false statement can end the loan", th: "ผู้กู้รับรองว่าข้อมูลถูกต้องครบถ้วน และทราบว่าการให้ข้อมูลเท็จอาจเป็นเหตุให้ยกเลิกสินเชื่อ", t: "check", req: true, src: "customer", why: "contract", wide: true }] },
];

/* ---------------- state: Pimchanok Rattana (C13), an existing customer, prefilled from the record ---------------- */
const AF_DEFAULTS = () => ({
  amount: "300000", term: "48", purpose: "", ratePackage: "fixed15", repayDay: "25", repayMethod: "edda", repayAccount: "Kasikornbank xxx-x-x2210-4", disburseTo: "own", creditLife: "", fireInsurer: "", motorClass: "1",
  channel: "branch", branch: "0123 Lat Phrao", staffCode: "OPS-0412 · Ploy C.", dealerCode: "DLR-0007 · Bangna Motors", campaign: "", referrer: "",
  title: "miss", firstTh: "พิมพ์ชนก", lastTh: "รัตนะ", firstEn: "Pimchanok", lastEn: "Rattana", citizenId: "1103700412344", idIssued: "2022-03-14", idExpiry: "2030-03-13", dob: "1995-03-14", gender: "f", nationality: "th", marital: "single", dependants: "0", education: "bachelor",
  mobile: "0812347713", email: "pimchanok.r@example.com", lineId: "", contactLang: "th", contactPref: "app",
  regNo: "88/12", regMoo: "", regVillage: "Lumpini Ville Lat Phrao", regSoi: "Lat Phrao 64", regRoad: "Lat Phrao", regSub: "Wang Thonglang", regDist: "Wang Thonglang", regProv: "Bangkok", regPost: "10310",
  curSame: true, residence: "rent", yearsAt: "3", rent: "9500", mailTo: "current", emName: "", emRel: "", emMobile: "", emDiffAddr: false,
  occType: "salaried", employer: "Siam Cold Chain Co., Ltd.", industry: "logistics", employerReg: "0105559012345", position: "Logistics manager", department: "Operations", empType: "permanent", startDate: "2020-06-01", workPhone: "", workProv: "Samut Prakan",
  salary: "72000", allowance: "0", variable: "13000", otherInc: "0", payrollBank: "kbank", incomeProof: "statement-api",
  coopLoan: "0", studentLoan: "0", informal: "0", otherObl: "0", livingCost: "18000", depositsOther: "240000", investments: "0", propertyOwned: "none", vehicles: "0",
  hasCo: "no", hasGu: "no",
  propType: "condo", project: "Ratchada Park Residence", developer: "Ratchada Park Co., Ltd.", unitNo: "1208, building B", deedType: "condo", deedNo: "88120", size: "34 sq m", propProv: "Bangkok", price: "3200000", booking: "50000", downSource: "savings", mortgageNo: "1",
  appraisal: "3050000", appraiser: "Panel appraiser · report AP-26-8812 · 21 Oct 2026", transferDate: "2026-12-15", landOffice: "Bangkok Land Office, Huai Khwang branch",
  carCond: "new", make: "Toyota", model: "Corolla Cross HEV Premium", year: "2026", fuel: "hybrid", carPrice: "1104000", carDown: "254000", redbook: "", carUse: "personal",
  ncbConsent: true, pdpaMarketing: "", pdpaPartners: "", pep: "", fundsSource: "salary", beneficiary: "self", usPerson: "", taxResOther: "no", relatedBank: "", staff: "no", bankrupt: "", litigation: "no", certify: false,
});
const INTAKE0 = () => ({ product: "personal", f: AF_DEFAULTS(), docs: {}, checked: false, decided: null, sent: false, paid: false });
let INTAKE = INTAKE0();
const num = (v) => { const n = parseMoney(v); return isNaN(n) ? 0 : n; };
const AF_SRC = { record: ["Customer record", "ข้อมูลลูกค้า"], dopa: ["DOPA", "กรมการปกครอง"], ncb: ["NCB", "เครดิตบูโร"], statement: ["Statements", "รายการเดินบัญชี"], appraiser: ["Appraiser", "ผู้ประเมิน"], system: ["Price guide", "ราคากลาง"], staff: ["Staff", "พนักงาน"], customer: ["Customer", "ลูกค้า"] };

/* ---------------- checks ---------------- */
function idValid(s) { const d = String(s).replace(/\D/g, ""); if (d.length !== 13) return false; let x = 0; for (let i = 0; i < 12; i++) x += +d[i] * (13 - i); return (11 - (x % 11)) % 10 === +d[12]; }
const shown = (x, f) => !x.when || x.when(f);
const sections = (step) => AF.filter((sec) => sec.s === step && shown(sec, INTAKE.f));
const isReq = (x, f) => typeof x.req === "function" ? x.req(f) : !!x.req;
function fieldError(x, f) {
  const v = f[x.k], empty = x.t === "check" ? !v : String(v ?? "").trim() === "";
  if (empty) return isReq(x, f) ? (x.t === "check" ? tt("Must be confirmed", "ต้องยืนยัน") : tt("Required", "จำเป็นต้องกรอก")) : "";
  if (x.t === "id" && !idValid(v)) return tt("Not a valid citizen ID: check the 13 digits", "เลขประจำตัวประชาชนไม่ถูกต้อง ตรวจสอบ 13 หลัก");
  if (x.t === "tel" && !/^0\d{8,9}$/.test(String(v).replace(/[\s-]/g, ""))) return tt("A Thai number, for example 081 234 5678", "เบอร์โทรไทย เช่น 081 234 5678");
  if (x.t === "email" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) return tt("Not an email address", "รูปแบบอีเมลไม่ถูกต้อง");
  if (x.t === "post" && !/^\d{5}$/.test(v)) return tt("Five digits", "ตัวเลข 5 หลัก");
  if (x.t === "money" && isNaN(parseMoney(v))) return tt("An amount in baht", "จำนวนเงินเป็นบาท");
  if (x.k === "idExpiry" && Date.parse(v) < BIZ) return tt("The ID card has expired", "บัตรหมดอายุแล้ว");
  if (x.k === "amount") { const p = INTAKE_PRODUCTS[INTAKE.product], a = num(v); if (a < p.min || a > p.max) return tt(`Between ${baht(p.min, 0)} and ${baht(p.max, 0)}`, `ระหว่าง ${baht(p.min, 0)} ถึง ${baht(p.max, 0)}`); }
  if (x.k === "term") { const p = INTAKE_PRODUCTS[INTAKE.product], n = +v; if (!(n >= p.tmin && n <= p.tmax)) return tt(`${p.tmin} to ${p.tmax} months`, `${p.tmin} ถึง ${p.tmax} เดือน`); }
  return "";
}
function missing(step) {
  const f = INTAKE.f, out = [];
  for (const sec of sections(step)) for (const x of sec.fields) if (shown(x, f)) { const e = fieldError(x, f); if (e) out.push({ x, e }); }
  return out;
}
const FORM_STEPS = ["loan", "applicant", "work", "finance", "coapp", "security", "consents"];
function completeness() {
  let total = 0, done = 0; const f = INTAKE.f;
  for (const s of FORM_STEPS) for (const sec of sections(s)) for (const x of sec.fields) if (shown(x, f) && isReq(x, f)) { total++; if (!fieldError(x, f)) done++; }
  return { total, done, pct: total ? Math.round(done / total * 100) : 100 };
}
const ageAt = (iso, at = BIZ) => { const d = new Date(Date.parse(iso)), b = new Date(at); return b.getUTCFullYear() - d.getUTCFullYear() - (b.getUTCMonth() < d.getUTCMonth() || (b.getUTCMonth() === d.getUTCMonth() && b.getUTCDate() < d.getUTCDate()) ? 1 : 0); };
const NCB_DEBTS = [["LN-A-C13", "Personal loan", "สินเชื่อส่วนบุคคล", "This bank", "ธนาคารนี้", 125000, 4151.79, "0 days late"], ["CC-KB-4471", "Credit card, ฿40,000 used of ฿80,000", "บัตรเครดิต ใช้ ฿40,000 จากวงเงิน ฿80,000", "Kasikornbank", "กสิกรไทย", 40000, 2000, "0 days late"]];
function intakeCalc() {
  const I = INTAKE, f = I.f, p = INTAKE_PRODUCTS[I.product], amount = num(f.amount), term = +f.term || p.term;
  const rate = I.product === "car" && f.carCond === "used" ? 0.0649 : p.rate, inst = r2(pmt(rate / 12, term, amount)), total = r2(inst * term);
  const co = f.hasCo === "yes" && I.product !== "personal";
  const own = f.occType === "retired" ? num(f.pension) : isSelf(f) ? num(f.bizProfit) + POLICY.haircut.other / 100 * num(f.otherInc) : num(f.salary) + num(f.allowance) + POLICY.haircut.variable / 100 * num(f.variable) + POLICY.haircut.other / 100 * num(f.otherInc);
  const income = r2(own + (co ? num(f.coIncome) : 0));
  const ncb = NCB_DEBTS.reduce((s, d) => s + d[6], 0), declared = num(f.coopLoan) + num(f.studentLoan) + num(f.informal) + num(f.otherObl);
  const debts = r2(ncb + declared + (co ? num(f.coDebts) : 0)), dsr = income ? (debts + inst) / income * 100 : 999;
  const age = f.dob ? ageAt(f.dob) : 0, ageEnd = age + Math.ceil(term / 12), service = isEmp(f) && f.startDate ? (BIZ - Date.parse(f.startDate)) / 864e5 / 365.25 : isSelf(f) && f.bizStart ? (BIZ - Date.parse(f.bizStart)) / 864e5 / 365.25 : 99;
  const ltvLim = I.product === "home" ? POLICY.ltvHome[f.mortgageNo] || POLICY.ltvHome[1] : I.product === "car" ? POLICY.ltvCar[f.carCond === "used" ? "used" : "new"] : 0;
  const ltvBase = I.product === "home" ? Math.min(num(f.appraisal), num(f.price) || Infinity) : I.product === "car" ? (f.carCond === "used" ? num(f.redbook) || num(f.carPrice) : num(f.carPrice)) : 0, ltv = ltvBase ? amount / ltvBase * 100 : 0;
  const capX = own >= POLICY.reg.capThreshold ? POLICY.reg.capHigh : POLICY.reg.capLow;
  const checks = [[tt(`Debt service ratio up to ${p.dsr}%`, `ภาระหนี้ต่อรายได้ไม่เกิน ${p.dsr}%`), `${dsr.toFixed(1)}%`, dsr <= p.dsr, "hard"],
    [tt(`Income at least ${baht(p.minIncome, 0)}`, `รายได้อย่างน้อย ${baht(p.minIncome, 0)}`), baht(income, 0), income >= p.minIncome, "hard"],
    ...(I.product === "personal" ? [[tt(`Up to ${capX} times monthly income (BOT)`, `ไม่เกิน ${capX} เท่าของรายได้ต่อเดือน (ธปท.)`), baht(own * capX, 0), amount <= own * capX, "hard"]] : []),
    ...(ltv ? [[tt(`Loan to value up to ${ltvLim}%`, `วงเงินต่อมูลค่าหลักประกันไม่เกิน ${ltvLim}%`), `${ltv.toFixed(1)}%`, ltv <= ltvLim, "hard"]] : []),
    ...(I.product === "car" ? [[tt("Amount within price less down payment", "วงเงินไม่เกินราคาหักเงินดาวน์"), baht(num(f.carPrice) - num(f.carDown), 0), amount <= num(f.carPrice) - num(f.carDown), "hard"]] : []),
    [tt("Age 20 to 65, and 65 or less at the end", "อายุ 20 ถึง 65 ปี และไม่เกิน 65 ปีเมื่อสิ้นสุดสัญญา"), tt(`${age} now, ${ageEnd} at the end`, `ตอนนี้ ${age} สิ้นสุดสัญญา ${ageEnd}`), age >= 20 && ageEnd <= 65, "hard"],
    [isSelf(f) ? tt("Trading for 2 years or more", "ประกอบกิจการ 2 ปีขึ้นไป") : tt("In the job for 1 year or more", "ทำงาน 1 ปีขึ้นไป"), service === 99 ? "—" : tt(`${service.toFixed(1)} years`, `${service.toFixed(1)} ปี`), service >= (isSelf(f) ? 2 : 1) && f.empType !== "probation", "hard"],
    [tt("Bureau score 600 or more, no 90-day arrears in 24 months", "คะแนนเครดิต 600 ขึ้นไป ไม่มีค้าง 90 วันใน 24 เดือน"), "702", true, "hard"],
    [tt("Not bankrupt in 5 years", "ไม่เคยล้มละลายใน 5 ปี"), f.bankrupt === "yes" ? tt("Yes", "เคย") : tt("No", "ไม่เคย"), f.bankrupt !== "yes", "hard"],
    [tt("Politically exposed: enhanced due diligence", "บุคคลที่มีสถานภาพทางการเมือง: ตรวจสอบเข้มข้น"), f.pep && f.pep !== "no" ? tt("Yes", "ใช่") : tt("No", "ไม่ใช่"), !(f.pep && f.pep !== "no"), "refer"],
    [tt("Related party: approval by the board (BOT)", "บุคคลที่เกี่ยวข้อง: อนุมัติโดยคณะกรรมการ (ธปท.)"), f.relatedBank && f.relatedBank !== "no" ? tt("Yes", "ใช่") : tt("No", "ไม่ใช่"), !(f.relatedBank && f.relatedBank !== "no"), "refer"],
    [tt("No debt litigation", "ไม่มีคดีเกี่ยวกับหนี้"), f.litigation === "yes" ? tt("Yes", "มี") : tt("No", "ไม่มี"), f.litigation !== "yes", "refer"]];
  const hardOk = checks.every((c) => c[3] !== "hard" || c[2]), refer = checks.filter((c) => c[3] === "refer" && !c[2]);
  const room = p.dsr / 100 * income - debts, maxLoan = Math.max(0, Math.min(I.product === "personal" ? own * capX : Infinity, room > 0 ? room * (1 - Math.pow(1 + rate / 12, -term)) / (rate / 12) : 0));
  return { p, amount, term, rate, inst, total, interest: r2(total - amount), income, own, debts, ncb, declared, dsr, ltv, ltvLim, checks, hardOk, refer, ok: hardOk, maxLoan, auto: hardOk && !refer.length && amount <= p.auto && I.product !== "home" };
}

/* ---------------- documents follow from the answers ---------------- */
function docsFor() {
  const f = INTAKE.f, P_ = INTAKE.product, list = [["id", "Citizen ID card", "บัตรประชาชน", "NDID and DOPA", true], ["housereg", "House registration", "ทะเบียนบ้าน", "Upload", true]];
  if (isEmp(f)) list.push(["payslip", "Latest payslip", "สลิปเงินเดือนล่าสุด", "e-Payslip", true], ["salarycert", "Salary certificate, under 30 days old", "หนังสือรับรองเงินเดือน อายุไม่เกิน 30 วัน", "Upload", true], ["stmt6", "Statements, 6 months", "รายการเดินบัญชี 6 เดือน", "Read with consent", true]);
  if (isSelf(f)) list.push(["stmt12", "Statements, 12 months", "รายการเดินบัญชี 12 เดือน", "Read with consent", true], ["bizreg", "Business registration", "หนังสือรับรองการจดทะเบียน", "DBD", f.occType === "owner"], ["tax", "Tax return, last year", "แบบแสดงรายการภาษีปีล่าสุด", "Upload", true]);
  if (f.occType === "retired") list.push(["pension", "Pension statement", "หลักฐานการรับบำนาญ", "Upload", true]);
  if (f.marital === "married-reg") list.push(["marriage", "Marriage certificate", "ทะเบียนสมรส", "Upload", P_ === "home"], ["spouseid", "Spouse's ID card", "บัตรประชาชนคู่สมรส", "Upload", P_ === "home"]);
  if (f.hasCo === "yes" && P_ !== "personal") list.push(["coid", "Co-borrower's ID card", "บัตรประชาชนผู้กู้ร่วม", "Upload", true], ["coinc", "Co-borrower's income proof", "หลักฐานรายได้ผู้กู้ร่วม", "Upload", true]);
  if (f.hasGu === "yes" && P_ === "car") list.push(["guid", "Guarantor's ID card", "บัตรประชาชนผู้ค้ำประกัน", "Upload", true]);
  if (P_ === "home") list.push(["spa", "Sale and purchase agreement", "สัญญาจะซื้อจะขาย", "Upload", true], ["deed", "Title deed copy", "สำเนาเอกสารสิทธิ์", "Upload", true], ["appraisal", "Appraisal report", "รายงานการประเมินราคา", "Appraiser", true], ["booking", "Booking receipt", "ใบเสร็จเงินจอง", "Upload", false]);
  if (P_ === "car") list.push(["quote", "Dealer's quotation", "ใบเสนอราคาจากดีลเลอร์", "Dealer portal", true], ...(f.carCond === "used" ? [["bluebook", "Vehicle registration book", "สำเนาเล่มทะเบียนรถ", "Upload", true]] : []));
  if (f.purpose === "refinance") list.push(["payoff", "Payoff letter from the other lender", "หนังสือยืนยันยอดปิดหนี้", "Upload", true]);
  const defaults = { id: "received", payslip: "received", stmt6: "received", stmt12: "received", appraisal: "received", quote: "received", bizreg: "received" };
  return list.map(([k, en, th, how, req]) => ({ k, en, th, how, req, state: INTAKE.docs[k] || defaults[k] || "missing" }));
}

/* ---------------- rendering ---------------- */
const policyTable = (c) => table({ cols: ["Rule", "Result"], rows: c.checks.map(([r, v, ok, kind]) => [`${esc(r)} <span class="muted">· ${esc(v)}</span>`, ok ? P("good", tt("Passes", "ผ่าน")) : kind === "refer" ? P("warn", tt("Refer", "ส่งพิจารณา")) : P("crit", tt("Fails", "ไม่ผ่าน"))]) }, tt("Credit policy", "นโยบายสินเชื่อ"));
function fieldHtml(x) {
  const f = INTAKE.f, v = f[x.k] ?? "", id = "f-" + x.k, err = INTAKE.checked ? fieldError(x, f) : "", req = isReq(x, f);
  const src = x.src && x.src !== "customer" ? ` <span class="src-tag">${esc(tt(...AF_SRC[x.src]))}</span>` : "";
  const label = `${esc(tt(x.en, x.th))}${req ? ' <span class="req" aria-hidden="true">*</span>' : ""}${src}`;
  const aria = `${req ? 'aria-required="true"' : ""} ${err ? `aria-invalid="true" aria-describedby="${id}-e"` : ""} ${x.ro ? "disabled" : ""}`;
  const hint = x.hint ? `<span class="hint">${esc(tt(...x.hint))}</span>` : "", errHtml = err ? `<span class="err" id="${id}-e">${esc(err)}</span>` : "";
  const opts = typeof x.o === "function" ? x.o() : x.o;
  let control;
  if (x.t === "check") return `<div class="field${x.wide ? " wide" : ""}"><label class="check" for="${id}"><input type="checkbox" id="${id}" data-f="${x.k}" ${v ? "checked" : ""} ${aria}><span>${label}</span></label>${hint}${errHtml}</div>`;
  if (x.t === "select") control = `<select class="input" id="${id}" data-f="${x.k}" ${aria}>${v === "" ? `<option value="" selected>${esc(tt("Choose…", "เลือก…"))}</option>` : ""}${opts.map(([ov, en, th]) => `<option value="${esc(ov)}" ${ov === v ? "selected" : ""}>${esc(tt(en, th))}</option>`).join("")}</select>`;
  else if (x.t === "area") control = `<textarea class="input" id="${id}" data-f="${x.k}" ${aria}>${esc(v)}</textarea>`;
  else { const type = x.t === "date" ? "date" : x.t === "email" ? "email" : x.t === "tel" ? "tel" : "text", mode = x.t === "money" ? "decimal" : ["num", "id", "post", "tel"].includes(x.t) ? "numeric" : "";
    const shownV = x.t === "money" && v !== "" && !isNaN(parseMoney(v)) ? parseMoney(v).toLocaleString("en-US") : x.t === "id" && v ? String(v).replace(/^(\d)(\d{4})(\d{5})(\d{2})(\d)$/, "$1-$2-$3-$4-$5") : v;
    control = `<input class="input${x.t === "money" ? " money" : ""}" id="${id}" data-f="${x.k}" type="${type}" ${mode ? `inputmode="${mode}"` : ""} value="${esc(shownV)}" autocomplete="off" ${aria}>`; }
  return `<div class="field${x.wide ? " wide" : ""}"><label for="${id}">${label}</label>${control}${hint}${errHtml}</div>`;
}
const sectionHtml = (sec) => `<section class="form-sec" aria-labelledby="sec-${sec.id}"><h3 id="sec-${sec.id}">${esc(tt(sec.en, sec.th))}</h3>${sec.sub ? `<p>${esc(tt(...(typeof sec.sub === "function" ? sec.sub() : sec.sub)))}</p>` : ""}<div class="form-grid">${sec.fields.filter((x) => shown(x, INTAKE.f)).map(fieldHtml).join("")}</div></section>`;
function summaryHtml() {
  const c = intakeCalc(), k = completeness(), tone = c.dsr > c.p.dsr ? "crit" : c.dsr > c.p.dsr * 0.85 ? "warn" : "";
  return `<section class="card sticky" aria-label="${esc(tt("Application summary", "สรุปใบสมัคร"))}"><div class="card-head"><div><div class="card-title">${esc(tt(c.p.name, c.p.th))}</div><div class="card-sub">${esc(c.p.code)}</div></div></div><div class="card-body" style="display:grid;gap:14px">
    ${quoteRows([[t("Amount"), baht(c.amount)], [t("Term"), monthsTh(c.term)], [tt("Income counted", "รายได้ที่นับ"), baht(c.income)], [t("Instalment"), baht(c.inst)]])}
    <div class="bars"><div class="bar-row"><span>${esc(tt("Debt service ratio", "ภาระหนี้ต่อรายได้"))}</span><span class="num">${c.dsr > 500 ? "—" : c.dsr.toFixed(1) + "%"} <span class="muted">/ ${c.p.dsr}%</span></span><div class="bar"><span class="${tone}" style="width:${Math.min(100, c.dsr)}%"></span></div></div>
      ${c.ltv ? `<div class="bar-row"><span>LTV</span><span class="num">${c.ltv.toFixed(1)}% <span class="muted">/ ${c.ltvLim}%</span></span><div class="bar"><span class="${c.ltv > c.ltvLim ? "crit" : ""}" style="width:${Math.min(100, c.ltv)}%"></span></div></div>` : ""}
      <div class="bar-row"><span>${esc(tt("Complete", "ความครบถ้วน"))}</span><span class="num">${k.done} / ${k.total}</span><div class="bar"><span class="${k.pct < 100 ? "warn" : ""}" style="width:${k.pct}%"></span></div></div></div>
    <p class="note">${esc(c.hardOk ? (c.refer.length ? tt("Within policy, but needs a person: ", "อยู่ในนโยบาย แต่ต้องให้เจ้าหน้าที่พิจารณา: ") + c.refer.map((r) => r[0]).join("; ") : tt("Within credit policy so far.", "อยู่ในนโยบายสินเชื่อ")) : tt("Outside credit policy: ", "อยู่นอกนโยบายสินเชื่อ: ") + c.checks.filter((r) => r[3] === "hard" && !r[2]).map((r) => r[0]).join("; "))}</p>
    <p class="hint muted" style="font-size:12px">${esc(tt("Saved as you type · APP-30416", "บันทึกอัตโนมัติ · APP-30416"))}</p></div></section>`;
}
function afStepBody(step) {
  const I = INTAKE, f = I.f, c = intakeCalc();
  if (step === "loan") return `<section class="form-sec"><h3>${esc(tt("Product", "ผลิตภัณฑ์"))}</h3><div class="choices" role="radiogroup" aria-label="${esc(t("Product"))}">${Object.entries(INTAKE_PRODUCTS).map(([k, x]) => `<button class="choice" type="button" role="radio" aria-checked="${k === I.product}" data-intake-product="${k}"><span class="row">${esc(tt(x.name, x.th))}<span class="tick">${icon("i-check")}</span></span><small>${esc(x.code)} · ${(x.rate * 100).toFixed(2)}%</small></button>`).join("")}</div></section>` + sections(step).map(sectionHtml).join("");
  if (step === "finance") return `<section class="form-sec"><h3>${esc(tt("Found at the credit bureau", "ข้อมูลจากเครดิตบูโร"))} <span class="src-tag">NCB</span></h3><p>${esc(tt("Checked at 10:26 with the consent given in the app. Score 702.", "ตรวจเมื่อ 10:26 ด้วยความยินยอมที่ให้ในแอป คะแนน 702"))}</p>${table({ cols: ["Account", "Lender", "Outstanding", "Monthly", "Worst in 24 months"], rows: NCB_DEBTS.map(([a, en, th, len, lth, bal, m, w]) => [`${a} · ${tt(en, th)}`, tt(len, lth), baht(bal), baht(m), tt(w, "ไม่เคยค้าง")]) }, "NCB")}</section>`
    + sections(step).map(sectionHtml).join("") + `<section class="form-sec"><h3>${esc(tt("Affordability", "ความสามารถในการชำระหนี้"))}</h3>${policyTable(c)}<p class="note" style="margin-top:12px">${esc(tt(`Most she can borrow over ${monthsTh(c.term).toLowerCase()} on this income: ${baht(Math.floor(c.maxLoan / 1000) * 1000, 0)}. Living costs of ${baht(num(f.livingCost), 0)} leave ${baht(Math.max(0, c.income - c.debts - c.inst - num(f.livingCost)), 0)} a month after the new instalment.`, `วงเงินสูงสุดใน ${monthsTh(c.term)} ที่รายได้นี้: ${baht(Math.floor(c.maxLoan / 1000) * 1000, 0)} หลังหักค่าครองชีพ ${baht(num(f.livingCost), 0)} และค่างวดใหม่ เหลือเดือนละ ${baht(Math.max(0, c.income - c.debts - c.inst - num(f.livingCost)), 0)}`))}</p></section>`;
  if (step === "coapp" && I.product === "personal") return notice("info", tt("No co-borrower or guarantor on personal loans", "สินเชื่อส่วนบุคคลไม่มีผู้กู้ร่วมหรือผู้ค้ำประกัน"), tt("The loan is decided on the applicant alone.", "พิจารณาจากผู้กู้เพียงคนเดียว"));
  if (step === "security" && I.product === "personal") return notice("good", tt("Unsecured: no collateral", "ไม่มีหลักประกัน"), tt("Priced on the scorecard and the debt service ratio.", "กำหนดราคาจากแบบจำลองคะแนนและภาระหนี้ต่อรายได้"));
  if (step === "documents") { const docs = docsFor();
    return `<section class="form-sec"><h3>${esc(tt("What this application needs", "เอกสารที่ใบสมัครนี้ต้องใช้"))}</h3><p>${esc(tt("The list follows the answers: occupation, marital status, co-borrower, product and purpose.", "รายการเปลี่ยนตามคำตอบ: อาชีพ สถานภาพสมรส ผู้กู้ร่วม ผลิตภัณฑ์ และวัตถุประสงค์"))}</p><div class="list">${docs.map((d) => `<div class="li"><span class="sev ${d.state === "received" ? "good" : d.state === "requested" ? "info" : d.req ? "warn" : "info"}">${icon(d.state === "received" ? "i-check" : "i-alert")}</span><div><strong>${esc(tt(d.en, d.th))}${d.req ? "" : ` <span class="muted">· ${esc(tt("optional", "ไม่บังคับ"))}</span>`}</strong><p>${esc(d.state === "received" ? tt(`Received · ${d.how}`, `ได้รับแล้ว · ${d.how}`) : d.state === "requested" ? tt("Asked for in the app", "ขอผ่านแอปแล้ว") : tt("Not received", "ยังไม่ได้รับ"))}</p></div>${d.state === "received" ? "" : `<div class="actions" style="margin-left:auto;width:auto;flex-wrap:nowrap">${d.state === "missing" ? `<button class="btn row-btn" type="button" data-doc="${d.k}" data-doc-state="requested">${esc(tt("Ask in the app", "ขอผ่านแอป"))}</button>` : ""}<button class="btn row-btn" type="button" data-doc="${d.k}" data-doc-state="received">${esc(tt("Mark received", "ได้รับแล้ว"))}</button></div>`}</div>`).join("")}</div></section>`; }
  if (step === "review") return reviewHtml(c);
  if (step === "offer") return offerHtml(c);
  return sections(step).map(sectionHtml).join("");
}
function reviewHtml(c) {
  const I = INTAKE, docs = docsFor(), docMiss = docs.filter((d) => d.req && d.state !== "received");
  const rows = FORM_STEPS.map((s) => { const m = missing(s), name = AF_STEPS.find((x) => x[0] === s); return `<div class="li"><span class="sev ${m.length ? "warn" : "good"}">${icon(m.length ? "i-alert" : "i-check")}</span><div><strong>${esc(tt(name[1], name[2]))}</strong><p>${m.length ? esc(m.slice(0, 4).map((x) => `${tt(x.x.en, x.x.th)}: ${x.e}`).join(" · ") + (m.length > 4 ? ` · +${m.length - 4}` : "")) : esc(tt("Complete", "ครบถ้วน"))}</p></div>${m.length ? `<button class="btn row-btn" type="button" data-fix="${s}|${m[0].x.k}" style="margin-left:auto">${esc(tt("Fix", "แก้ไข"))}</button>` : ""}</div>`; }).join("");
  const blockers = FORM_STEPS.reduce((n, s) => n + missing(s).length, 0);
  return `<section class="form-sec"><h3>${esc(tt("Before it is submitted", "ก่อนส่งพิจารณา"))}</h3><div class="list">${rows}
      <div class="li"><span class="sev ${docMiss.length ? "info" : "good"}">${icon(docMiss.length ? "i-alert" : "i-check")}</span><div><strong>${esc(t("Documents"))}</strong><p>${esc(docMiss.length ? tt(`${docMiss.length} still to come; they become conditions before disbursement: `, `ยังขาด ${docMiss.length} รายการ จะเป็นเงื่อนไขก่อนจ่ายเงิน: `) + docMiss.map((d) => tt(d.en, d.th)).join(", ") : tt("All received", "ได้รับครบ"))}</p></div></div></div></section>
    <section class="form-sec"><h3>${esc(tt("Credit policy", "นโยบายสินเชื่อ"))}</h3>${policyTable(c)}</section>
    <section class="form-sec">${I.decided ? notice(I.decided.ok ? "good" : "info", I.decided.text, I.decided.sub) : `<div class="actions"><button class="btn primary" type="button" data-flow="appSubmit">${esc(tt("Submit for decision", "ส่งพิจารณา"))}</button>${blockers ? `<span class="muted" style="font-size:13px">${esc(tt(`${blockers} answers still missing`, `ยังขาดข้อมูล ${blockers} รายการ`))}</span>` : ""}</div>`}</section>`;
}
function offerHtml(c) {
  const I = INTAKE, p = c.p;
  if (!I.decided || !I.decided.ok) return `<div class="state"><span class="sev info">${icon("i-clock")}</span><strong>${esc(tt("Opens once the application is approved", "เปิดเมื่ออนุมัติใบสมัครแล้ว"))}</strong></div>`;
  const conds = docsFor().filter((d) => d.req && d.state !== "received");
  return `<div class="grid-main"><div>${kvHtml([[t("Product"), `${tt(p.name, p.th)} · ${p.code}`], [t("Amount"), baht(c.amount)], [t("Term"), monthsTh(c.term)], [t("Instalment"), baht(c.inst)], [tt("Effective rate", "อัตราดอกเบี้ยที่แท้จริง"), INTAKE.product === "home" ? tt("2.99% for 3 years, then MRR − 1.75%", "2.99% สามปี จากนั้น MRR − 1.75%") : `${(c.rate * 100).toFixed(2)}%`], [tt("Total interest", "ดอกเบี้ยทั้งหมด"), baht(c.interest)], [tt("Fees", "ค่าธรรมเนียม"), INTAKE.product === "home" ? tt("Mortgage registration 1% at the Land Office; no bank fee", "ค่าจดจำนอง 1% ที่สำนักงานที่ดิน ไม่มีค่าธรรมเนียมธนาคาร") : tt("None", "ไม่มี")], [tt("Default interest", "ดอกเบี้ยผิดนัด"), tt("Contract rate + 3% a year on overdue principal only", "อัตราตามสัญญา + 3% ต่อปี เฉพาะเงินต้นที่ค้าง")], [tt("Insurance", "ประกัน"), INTAKE.f.creditLife === "none" ? tt("None taken; optional", "ไม่ได้ทำ เป็นทางเลือก") : tt("Credit life, chosen by the customer", "ประกันคุ้มครองสินเชื่อ ลูกค้าเลือกเอง")]])}
    ${conds.length ? `<div style="margin-top:14px">${notice("info", tt("Conditions before disbursement", "เงื่อนไขก่อนจ่ายเงิน"), conds.map((d) => tt(d.en, d.th)).join(", "))}</div>` : ""}</div>
    <div>${I.paid ? notice("good", tt(`Paid. Contract ${p.contract} is open.`, `จ่ายเงินแล้ว เปิดสัญญา ${p.contract}`), tt("The first instalment is due on " + INTAKE.f.repayDay + " Dec 2026.", `ค่างวดแรกครบกำหนดวันที่ ${INTAKE.f.repayDay} ธ.ค. 2569`))
      : I.sent ? `${notice("good", tt("Signed in the app with NDID at 10:44", "ลงนามในแอปด้วย NDID เวลา 10:44"), tt("The key facts sheet was opened before signing and is kept with the contract.", "เปิดอ่านเอกสารสรุปข้อมูลสำคัญก่อนลงนาม และเก็บไว้กับสัญญา"))}<div class="actions" style="margin-top:14px"><button class="btn primary" type="button" data-flow="appDisburse" ${conds.length ? "disabled" : ""}>${esc(tt("Disburse", "จ่ายเงิน"))}</button>${conds.length ? `<span class="muted" style="font-size:13px">${esc(tt("Waiting for the conditions", "รอเงื่อนไขครบ"))}</span>` : ""}</div>`
      : `<p class="muted">${esc(tt("The key facts sheet and the contract go to the customer's app to read and sign.", "เอกสารสรุปข้อมูลสำคัญและสัญญาส่งไปที่แอปของลูกค้าเพื่ออ่านและลงนาม"))}</p><div class="actions" style="margin-top:14px"><button class="btn primary" type="button" data-flow="appOffer">${esc(tt("Send to sign", "ส่งให้ลงนาม"))}</button></div>`}</div></div>`;
}
function viewIntake() {
  const steps = AF_STEPS, i = Math.max(0, steps.findIndex(([k]) => k === current.tab)), step = steps[i][0], p = INTAKE_PRODUCTS[INTAKE.product];
  const badge = (k) => { if (!FORM_STEPS.includes(k) || !INTAKE.checked) return ""; const n = missing(k).length; return n ? ` <span class="count hot">${n}</span>` : ""; };
  const name = `${INTAKE.f.firstEn} ${INTAKE.f.lastEn}`.trim();
  return `<button class="back" type="button" data-go="lending/applications">${icon("i-back")}${esc(t("Applications"))}</button>
    <div class="head"><div>${eyebrow(sysById.lending, "APP-30416")}<h1 class="title">${esc(tt(`${p.name}: ${name}`, `${p.th}: ${INTAKE.f.firstTh} ${INTAKE.f.lastTh}`))}</h1><p class="lede">${esc(tt(`Party C13 · started by Ploy C. at branch 0123, 10:31 · ${completeness().pct}% complete`, `รหัสลูกค้า C13 · เริ่มโดยพลอย ช. สาขา 0123 เวลา 10:31 · ครบ ${completeness().pct}%`))}</p></div><div class="actions"><button class="btn" type="button" data-intake-reset>${esc(tt("Start again", "เริ่มใหม่"))}</button><button class="btn primary" type="button" data-tab="review">${esc(tt("Review and submit", "ตรวจทานและส่ง"))}</button></div></div>
    <div class="steps" style="padding:0;border:0" aria-label="${esc(tt("Steps", "ขั้นตอน"))}">${steps.map(([k, en, th], n) => { const ok = n < i && !(INTAKE.checked && FORM_STEPS.includes(k) && missing(k).length); return `<button class="step ${n === i ? "on" : ok ? "done" : ""}" type="button" data-tab="${k}" style="border:0;background:transparent;padding:0" ${n === i ? 'aria-current="step"' : ""}><b>${ok ? "✓" : n + 1}</b>${esc(tt(en, th))}${badge(k)}</button>`; }).join("")}</div>
    ${(() => { const body = `<section class="card"><div class="card-head"><div class="card-title">${esc(tt(steps[i][1], steps[i][2]))}</div></div><div class="card-body">${afStepBody(step)}</div></section>`; return step === "review" || step === "offer" ? body : `<div class="grid-main">${body}<div id="inSum">${summaryHtml()}</div></div>`; })()}
    <div class="actions" style="justify-content:flex-end">${i > 0 ? `<button class="btn" type="button" data-tab="${steps[i - 1][0]}">${esc(t("Back"))}</button>` : ""}${i < steps.length - 1 ? `<button class="btn primary" type="button" data-tab="${steps[i + 1][0]}">${esc(t("Next"))}</button>` : ""}</div>`;
}

/* ---------------- flows ---------------- */
Object.assign(FLOWS, {
  appSubmit: () => ({ title: tt("Submit for decision", "ส่งพิจารณา"), sub: "APP-30416 · " + t("Pimchanok Rattana"), init: {}, fields: () => `<p class="muted">${esc(tt("The decision engine checks the answers, then runs the credit policy and the scorecard.", "ระบบตัดสินใจตรวจความครบถ้วนของข้อมูล แล้วตรวจนโยบายสินเชื่อและแบบจำลองคะแนน"))}</p>`, read: () => "",
    review: (d) => { const c = intakeCalc(), I = INTAKE, gaps = FORM_STEPS.flatMap((s) => missing(s)); d.c = c; I.checked = true;
      if (gaps.length) return { html: notice("crit", tt(`${gaps.length} answers are missing or wrong`, `ข้อมูลขาดหรือไม่ถูกต้อง ${gaps.length} รายการ`), gaps.slice(0, 6).map((g) => tt(g.x.en, g.x.th)).join(" · ") + (gaps.length > 6 ? " …" : "")) + `<p class="consequence">${esc(tt("Close this and use Fix on the review step. Each missing answer is marked on its step.", "ปิดหน้าต่างนี้แล้วกดแก้ไขในขั้นตรวจทาน ข้อมูลที่ขาดจะมีเครื่องหมายในแต่ละขั้นตอน"))}</p>`, blocked: true };
      if (!c.hardOk) return { html: notice("crit", tt("Outside credit policy", "อยู่นอกนโยบายสินเชื่อ"), c.checks.filter((x) => x[3] === "hard" && !x[2]).map((x) => `${x[0]}: ${x[1]}`).join(" · ")) + `<p class="consequence">${esc(tt("Change the amount or term, add a co-borrower, or decline and tell the applicant the main reason, as responsible lending requires.", "ปรับวงเงินหรือระยะเวลา เพิ่มผู้กู้ร่วม หรือปฏิเสธและแจ้งเหตุผลหลักให้ผู้สมัครตามหลักการให้สินเชื่ออย่างรับผิดชอบ"))}</p>`, blocked: true };
      if (c.auto) return { html: notice("good", tt("Within the automatic approval band", "อยู่ในเกณฑ์อนุมัติอัตโนมัติ"), tt(`Score 702, every rule passes, ${baht(c.amount, 0)} is within ${baht(c.p.auto, 0)}.`, `คะแนน 702 ผ่านทุกข้อ ${baht(c.amount, 0)} อยู่ในวงเงิน ${baht(c.p.auto, 0)}`)) + `<p class="consequence">${esc(tt("Approves the application now. Documents still to come become conditions before disbursement.", "อนุมัติใบสมัครทันที เอกสารที่ยังขาดจะเป็นเงื่อนไขก่อนจ่ายเงิน"))}</p>`, confirm: tt("Submit", "ส่ง") };
      const why = c.refer.length ? c.refer.map((r) => r[0]).join("; ") : INTAKE.product === "home" ? tt("Home loans are always decided by a credit officer.", "สินเชื่อบ้านพิจารณาโดยเจ้าหน้าที่สินเชื่อเสมอ") : tt(`Above the automatic band of ${baht(c.p.auto, 0)}.`, `เกินเกณฑ์อนุมัติอัตโนมัติ ${baht(c.p.auto, 0)}`);
      if (c.refer.length) { d.refer = why; return { html: notice("warn", tt("Referred for review", "ส่งพิจารณาเป็นกรณีพิเศษ"), why) + `<p class="consequence">${esc(tt("Every hard rule passes, but these answers need compliance and, for a related party, the board, before a credit decision.", "ผ่านเกณฑ์บังคับทุกข้อ แต่คำตอบเหล่านี้ต้องผ่านฝ่ายกำกับ และกรณีบุคคลที่เกี่ยวข้องต้องผ่านคณะกรรมการ ก่อนพิจารณาสินเชื่อ"))}</p>`, confirm: tt("Send for review", "ส่งพิจารณา") }; }
      return { html: notice("info", tt("Needs a credit decision by a person", "ต้องให้เจ้าหน้าที่พิจารณา"), why) + `<p class="consequence">${esc(tt("Every hard rule passes. The recommendation is to approve.", "ผ่านเกณฑ์บังคับทุกข้อ คำแนะนำคืออนุมัติ"))}</p>`, confirm: tt("Approve", "อนุมัติ"), auth: ["credit", c.amount] }; },
    done: (d) => { if (!INTAKE.decided) { const pending = d.auth && !d.auth.ok;
        INTAKE.decided = d.refer ? { ok: false, text: tt("Referred to compliance before a credit decision", "ส่งฝ่ายกำกับก่อนพิจารณาสินเชื่อ"), sub: d.refer } : pending ? { ok: false, text: tt(`With the ${d.auth.second.toLowerCase()} for a decision`, `อยู่ระหว่าง${t(d.auth.second)}พิจารณา`), sub: tt("Target: 4 working hours. The customer sees the progress in the app.", "เป้าหมาย 4 ชั่วโมงทำการ ลูกค้าเห็นความคืบหน้าในแอป") }
          : { ok: true, text: d.c.auto ? tt("Approved automatically in 2 seconds", "อนุมัติอัตโนมัติใน 2 วินาที") : tt("Approved within your authority", "อนุมัติภายในอำนาจของคุณ"), sub: tt("The offer is ready to send for signature.", "ข้อเสนอพร้อมส่งให้ลงนาม") };
        setTimeout(render, 0); }
      return INTAKE.decided.text; } }),
  appOffer: () => ({ title: tt("Send to sign", "ส่งให้ลงนาม"), sub: "APP-30416 · " + t("Pimchanok Rattana"), init: {}, fields: () => kvHtml([[tt("To", "ถึง"), tt("Pimchanok's app, with a push notification", "แอปของคุณพิมพ์ชนก พร้อมการแจ้งเตือน")], [tt("Signs with", "ลงนามด้วย"), "NDID"], [tt("Offer valid", "ข้อเสนอมีผล"), tt("7 days", "7 วัน")]]), read: () => "",
    review: () => ({ html: `<p class="consequence">${esc(tt("Sends the key facts sheet and the contract. She must open the key facts before she can sign.", "ส่งเอกสารสรุปข้อมูลสำคัญและสัญญา ลูกค้าต้องเปิดอ่านเอกสารสรุปก่อนจึงลงนามได้"))}</p>`, confirm: tt("Send", "ส่ง") }),
    done: () => { if (!INTAKE.sent) { INTAKE.sent = true; setTimeout(render, 0); } return tt("Sent. In this concept she signs at once.", "ส่งแล้ว ในต้นแบบนี้ลูกค้าลงนามทันที"); } }),
  appDisburse: () => { const p = INTAKE_PRODUCTS[INTAKE.product], f = INTAKE.f, amount = num(f.amount);
    const to = INTAKE.product === "car" ? "CUR-D0007 · " + t("Bangna Motors") : INTAKE.product === "home" ? tt("The seller, by cashier's cheque at the Land Office", "ผู้ขาย ด้วยแคชเชียร์เช็คที่สำนักงานที่ดิน") : f.disburseTo === "other" ? f.disburseAccount : f.disburseTo === "lender" ? tt("The lender being paid off", "เจ้าหนี้เดิม") : "SAV-C13";
    return { title: tt("Disburse", "จ่ายเงิน"), sub: `APP-30416 → ${p.contract}`, init: {}, fields: () => kvHtml([[tt("To", "ถึง"), to], [t("Amount"), baht(amount)]]), read: () => "",
      review: () => ({ html: `<p class="consequence">${tt(`Pays <b>${baht(amount)}</b> to ${esc(to)} and opens ${p.contract} with ${f.term} instalments on the ${f.repayDay}th. The ledger, the GL and the customer's app update at once.`, `จ่าย <b>${baht(amount)}</b> ให้ ${esc(to)} และเปิดสัญญา ${p.contract} ${f.term} งวด ครบกำหนดวันที่ ${f.repayDay} บัญชีแยกประเภท GL และแอปของลูกค้าอัปเดตทันที`)}</p>`, confirm: tt("Disburse", "จ่ายเงิน"), auth: ["payout", amount] }),
      done: (d) => { if (!(d.auth && !d.auth.ok) && !INTAKE.paid) { INTAKE.paid = true; setTimeout(render, 0); } return tt(`Paid. ${p.contract} is open.`, `จ่ายเงินแล้ว เปิดสัญญา ${p.contract}`); } }; },
});

/* ---------------- events: typing saves into the application; some answers redraw the form ---------------- */
const afFind = (k) => AF.flatMap((s) => s.fields).find((x) => x.k === k);
function afRefresh(focusId) {
  const sum = $("#inSum"); if (sum) sum.innerHTML = summaryHtml();
  if (focusId) { render(); const el = document.getElementById(focusId); if (el) el.focus(); }
}
document.addEventListener("input", (e) => {
  const k = e.target.dataset && e.target.dataset.f; if (!k) return;
  const x = afFind(k); INTAKE.f[k] = e.target.type === "checkbox" ? e.target.checked : e.target.value;
  if (INTAKE.decided && !INTAKE.paid) { INTAKE.decided = null; INTAKE.sent = false; }
  afRefresh(x && (x.re || e.target.type === "checkbox" || e.target.tagName === "SELECT") ? e.target.id : null);
});
document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-intake-product], [data-intake-reset], [data-doc], [data-fix]");
  if (!el) return;
  if (el.dataset.intakeReset !== undefined) { INTAKE = INTAKE0(); current.tab = "loan"; render(); return; }
  if (el.dataset.doc) { INTAKE.docs[el.dataset.doc] = el.dataset.docState; render(); toast(el.dataset.docState === "requested" ? tt("Asked for in the customer's app.", "ขอเอกสารผ่านแอปของลูกค้าแล้ว") : tt("Marked received. In this concept no file is stored.", "บันทึกว่าได้รับแล้ว ในต้นแบบนี้ไม่ได้เก็บไฟล์"), "good"); return; }
  if (el.dataset.fix) { const [s, k] = el.dataset.fix.split("|"); current.tab = s; render(); const f = document.getElementById("f-" + k); if (f) { f.focus(); f.scrollIntoView({ block: "center" }); } return; }
  const k = el.dataset.intakeProduct, p = INTAKE_PRODUCTS[k];
  Object.assign(INTAKE, { product: k, decided: null, sent: false, paid: false });
  Object.assign(INTAKE.f, { amount: String(p.amount), term: String(p.term), purpose: "", ratePackage: k === "home" ? "fix3" : k === "car" ? "fixed" : "fixed15", disburseTo: k === "home" ? "seller" : k === "car" ? "dealer" : "own", channel: k === "car" ? "dealer" : "branch" });
  render(); $(`[data-intake-product="${k}"]`)?.focus();
});

Object.assign(RECS, {
  "APP-30416": { sys: "lending", sec: "applications", label: "APP-30416", kind: "Loan application", match: ["APP-30416"], view: () => viewIntake(), tabs: AF_STEPS.map(([k, en]) => [k, en]) },
});
Object.assign(TH, { "Work and income": "อาชีพและรายได้", "Debts and assets": "ภาระหนี้และทรัพย์สิน", "Co-borrower": "ผู้กู้ร่วม", "Declarations": "คำรับรองและความยินยอม", "Review and submit": "ตรวจทานและส่ง",
  "Lender": "ผู้ให้กู้", "Worst in 24 months": "ค้างสูงสุดใน 24 เดือน" });

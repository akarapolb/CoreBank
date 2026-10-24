// Fabor console prototype · Opening accounts: a small form engine over field catalogues, used by the individual
// onboarding ONB-7731 and the business account opening AO-26-0412. Each field records its type, when it is required
// and shown, where its value comes from and why the bank collects it. tools/account-opening-fields.mjs prints both
// catalogues as docs/design/account-opening-fields.md. The regulatory points are to confirm with counsel.
// Classic scripts sharing one global scope; load order is set in index.html. Uses O, YN, PROVINCES, INDUSTRY, BANKS,
// RELATION and idValid from appform.js.

/* ---------------- the engine ---------------- */
const OBF = {};
const obShown = (x, f) => !x.when || x.when(f);
const obReq = (x, f) => (typeof x.req === "function" ? x.req(f) : !!x.req);
const obSecs = (F, step) => F.cat.filter((s) => s.s === step && obShown(s, F.st.f));
const daysAgo = (iso) => Math.round((BIZ - Date.parse(iso)) / 864e5);
function obErr(F, x) {
  const f = F.st.f, v = f[x.k], empty = x.t === "check" ? !v : String(v ?? "").trim() === "";
  if (empty) return obReq(x, f) ? (x.t === "check" ? tt("Must be confirmed", "ต้องยืนยัน") : tt("Required", "จำเป็นต้องกรอก")) : "";
  if (x.t === "id" && !idValid(v)) return tt("Not a valid 13-digit ID: check the digits", "เลขประจำตัว 13 หลักไม่ถูกต้อง ตรวจสอบตัวเลข");
  if (x.t === "tel" && !/^0\d{8,9}$/.test(String(v).replace(/[\s-]/g, ""))) return tt("A Thai number, for example 081 234 5678", "เบอร์โทรไทย เช่น 081 234 5678");
  if (x.t === "email" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) return tt("Not an email address", "รูปแบบอีเมลไม่ถูกต้อง");
  if (x.t === "post" && !/^\d{5}$/.test(v)) return tt("Five digits", "ตัวเลข 5 หลัก");
  if ((x.t === "money" || x.t === "pct") && isNaN(parseMoney(v))) return tt("A number", "ตัวเลข");
  if (x.t === "pct" && (num(v) < 0 || num(v) > 100)) return tt("Between 0 and 100", "ระหว่าง 0 ถึง 100");
  if (x.check) return x.check(v, f) || "";
  return "";
}
function obMissing(F, step) { const out = []; for (const sec of obSecs(F, step)) for (const x of sec.fields) if (obShown(x, F.st.f)) { const e = obErr(F, x); if (e) out.push({ x, e }); } return out; }
function obComplete(F) { let total = 0, done = 0; for (const [s] of F.steps) for (const sec of obSecs(F, s)) for (const x of sec.fields) if (obShown(x, F.st.f) && obReq(x, F.st.f)) { total++; if (!obErr(F, x)) done++; } return { total, done, pct: total ? Math.round(done / total * 100) : 100 }; }
const OB_SRC = { record: ["Customer record", "ข้อมูลลูกค้า"], dopa: ["DOPA", "กรมการปกครอง"], ndid: ["NDID", "NDID"], dbd: ["DBD", "กรมพัฒนาธุรกิจการค้า"], system: ["Screening", "ระบบตรวจรายชื่อ"], staff: ["Staff", "พนักงาน"], customer: ["Customer", "ลูกค้า"] };
const OB_WHY = { kyc: "KYC (AMLO)", aml: "AML/CFT (AMLO)", fatca: "FATCA and CRS", pdpa: "PDPA consent", conduct: "BOT market conduct", contract: "The account terms", ops: "Operations", dpa: "Deposit protection", tax: "Revenue Department", related: "BOT related-party rules", risk: "Customer risk rating" };
function obFieldHtml(F, x) {
  const f = F.st.f, v = f[x.k] ?? "", id = `of-${F.id}-${x.k}`, err = F.st.checked ? obErr(F, x) : "", req = obReq(x, f);
  const src = x.src && x.src !== "customer" ? ` <span class="src-tag">${esc(tt(...OB_SRC[x.src]))}</span>` : "";
  const label = `${esc(tt(x.en, x.th))}${req ? ' <span class="req" aria-hidden="true">*</span>' : ""}${src}`;
  const a = `data-of="${F.id}" data-ok="${x.k}" ${req ? 'aria-required="true"' : ""} ${err ? `aria-invalid="true" aria-describedby="${id}-e"` : ""} ${x.ro ? "disabled" : ""}`;
  const hint = x.hint ? `<span class="hint">${esc(tt(...x.hint))}</span>` : "", errH = err ? `<span class="err" id="${id}-e">${esc(err)}</span>` : "", opts = typeof x.o === "function" ? x.o(f) : x.o;
  if (x.t === "check") return `<div class="field${x.wide ? " wide" : ""}"><label class="check" for="${id}"><input type="checkbox" id="${id}" ${a} ${v ? "checked" : ""}><span>${label}</span></label>${hint}${errH}</div>`;
  let c;
  if (x.t === "select") c = `<select class="input" id="${id}" ${a}>${v === "" ? `<option value="" selected>${esc(tt("Choose…", "เลือก…"))}</option>` : ""}${opts.map(([ov, en, th]) => `<option value="${esc(ov)}" ${ov === v ? "selected" : ""}>${esc(tt(en, th))}</option>`).join("")}</select>`;
  else if (x.t === "area") c = `<textarea class="input" id="${id}" ${a}>${esc(v)}</textarea>`;
  else { const type = x.t === "date" ? "date" : x.t === "email" ? "email" : x.t === "tel" ? "tel" : "text", mode = x.t === "money" || x.t === "pct" ? "decimal" : ["num", "id", "post", "tel"].includes(x.t) ? "numeric" : "";
    const sv = x.t === "money" && v !== "" && !isNaN(parseMoney(v)) ? parseMoney(v).toLocaleString("en-US") : x.t === "id" && v ? String(v).replace(/^(\d)(\d{4})(\d{5})(\d{2})(\d)$/, "$1-$2-$3-$4-$5") : v;
    c = `<input class="input${x.t === "money" ? " money" : ""}" id="${id}" type="${type}" ${mode ? `inputmode="${mode}"` : ""} value="${esc(sv)}" autocomplete="off" ${a}>`; }
  return `<div class="field${x.wide ? " wide" : ""}"><label for="${id}">${label}</label>${c}${hint}${errH}</div>`;
}
const obSectionHtml = (F, sec) => `<section class="form-sec"><h3>${esc(tt(sec.en, sec.th))}</h3>${sec.sub ? `<p>${esc(tt(...sec.sub))}</p>` : ""}<div class="form-grid">${sec.fields.filter((x) => obShown(x, F.st.f)).map((x) => obFieldHtml(F, x)).join("")}</div></section>`;
const obBand = (s) => (s >= 8 ? ["High", "สูง", "crit"] : s >= 4 ? ["Medium", "กลาง", "warn"] : ["Low", "ต่ำ", "good"]);
const obRisk = (F) => { const fac = F.factors(F.st.f), s = fac.reduce((a, x) => a + x[1], 0); return { fac, score: s, band: obBand(s) }; };
function obSummary(F) {
  const r = obRisk(F), k = obComplete(F);
  return `<section class="card sticky" aria-label="${esc(tt("Summary", "สรุป"))}"><div class="card-head"><div><div class="card-title">${esc(F.title())}</div><div class="card-sub">${esc(F.id === "ind" ? "ONB-7731" : "AO-26-0412")}</div></div></div><div class="card-body" style="display:grid;gap:14px">
    <div class="bars"><div class="bar-row"><span>${esc(tt("Customer risk", "ความเสี่ยงของลูกค้า"))}</span><span class="num">${P(r.band[2], tt(r.band[0], r.band[1]))} <span class="muted">${r.score}</span></span><div class="bar"><span class="${r.band[2] === "good" ? "" : r.band[2]}" style="width:${Math.min(100, r.score * 8)}%"></span></div></div>
      <div class="bar-row"><span>${esc(tt("Complete", "ความครบถ้วน"))}</span><span class="num">${k.done} / ${k.total}</span><div class="bar"><span class="${k.pct < 100 ? "warn" : ""}" style="width:${k.pct}%"></span></div></div></div>
    <div class="list">${r.fac.length ? r.fac.map(([w, p]) => `<div class="li"><span class="sev ${p >= 3 ? "crit" : p >= 2 ? "warn" : "info"}">${esc("+" + p)}</span><div><strong style="font-weight:500">${esc(w)}</strong></div></div>`).join("") : `<p class="muted" style="font-size:13px">${esc(tt("No risk factors so far.", "ยังไม่มีปัจจัยความเสี่ยง"))}</p>`}</div>
    <p class="note">${esc(F.route(r).text)}</p><p class="hint muted" style="font-size:12px">${esc(tt("Saved as you type", "บันทึกอัตโนมัติ"))}</p></div></section>`;
}
function obReview(F) {
  const r = obRisk(F), rt = F.route(r), formSteps = F.steps.filter(([s]) => !["review"].includes(s)), blockers = formSteps.reduce((n, [s]) => n + obMissing(F, s).length, 0), extra = F.crossChecks ? F.crossChecks(F.st.f) : [];
  const rows = formSteps.map(([s, en, th]) => { const m = obMissing(F, s); return `<div class="li"><span class="sev ${m.length ? "warn" : "good"}">${icon(m.length ? "i-alert" : "i-check")}</span><div><strong>${esc(tt(en, th))}</strong><p>${m.length ? esc(m.slice(0, 4).map((x) => `${tt(x.x.en, x.x.th)}: ${x.e}`).join(" · ") + (m.length > 4 ? ` · +${m.length - 4}` : "")) : esc(tt("Complete", "ครบถ้วน"))}</p></div>${m.length ? `<button class="btn row-btn" type="button" data-ofix="${F.id}|${s}|${m[0].x.k}" style="margin-left:auto">${esc(tt("Fix", "แก้ไข"))}</button>` : ""}</div>`; }).join("");
  return `<section class="form-sec"><h3>${esc(tt("Before opening", "ก่อนเปิดบัญชี"))}</h3><div class="list">${rows}${extra.map((e) => `<div class="li"><span class="sev crit">${icon("i-alert")}</span><div><strong>${esc(e)}</strong></div></div>`).join("")}</div></section>
    <section class="form-sec"><h3>${esc(tt("Customer risk", "ความเสี่ยงของลูกค้า"))}</h3>${table({ cols: ["Factor", "Points"], rows: [...r.fac.map(([w, p]) => [w, String(p)]), [`<b>${esc(tt("Total", "รวม"))}</b>`, `<b>${r.score} · ${esc(tt(r.band[0], r.band[1]))}</b>`]] }, tt("Risk factors", "ปัจจัยความเสี่ยง"))}<p class="note" style="margin-top:12px">${esc(rt.text)}</p></section>
    <section class="form-sec">${F.st.state ? notice(F.st.state === "opened" ? "good" : "info", F.st.state === "opened" ? F.openedText() : rt.pendingText, F.st.state === "opened" ? F.openedSub() : "") : `<div class="actions"><button class="btn primary" type="button" data-flow="obOpen" data-arg="${F.id}">${esc(rt.button)}</button>${blockers + extra.length ? `<span class="muted" style="font-size:13px">${esc(tt(`${blockers + extra.length} things still to fix`, `ยังต้องแก้ไข ${blockers + extra.length} รายการ`))}</span>` : ""}</div>`}</section>`;
}
function obView(id) {
  const F = OBF[id], steps = F.steps, i = Math.max(0, steps.findIndex(([k]) => k === current.tab)), step = steps[i][0];
  const badge = (k) => { if (!F.st.checked || k === "review") return ""; const n = obMissing(F, k).length; return n ? ` <span class="count hot">${n}</span>` : ""; };
  const body = step === "review" ? obReview(F) : (F.intro && F.intro[step] ? F.intro[step]() : "") + obSecs(F, step).map((s) => obSectionHtml(F, s)).join("");
  const main = `<section class="card"><div class="card-head"><div class="card-title">${esc(tt(steps[i][1], steps[i][2]))}</div></div><div class="card-body">${body}</div></section>`;
  return `<button class="back" type="button" data-go="${F.back}">${icon("i-back")}${esc(t(F.backLabel))}</button>
    <div class="head"><div>${eyebrow(sysById[F.sys], F.id === "ind" ? "ONB-7731" : "AO-26-0412")}<h1 class="title">${esc(F.title())}</h1><p class="lede">${esc(F.sub())} · ${esc(tt(`${obComplete(F).pct}% complete`, `ครบ ${obComplete(F).pct}%`))}</p></div><div class="actions"><button class="btn" type="button" data-obreset="${id}">${esc(tt("Start again", "เริ่มใหม่"))}</button><button class="btn primary" type="button" data-tab="review">${esc(tt("Review and open", "ตรวจทานและเปิดบัญชี"))}</button></div></div>
    <div class="steps" style="padding:0;border:0" aria-label="${esc(tt("Steps", "ขั้นตอน"))}">${steps.map(([k, en, th], n) => { const ok = n < i && !(F.st.checked && k !== "review" && obMissing(F, k).length); return `<button class="step ${n === i ? "on" : ok ? "done" : ""}" type="button" data-tab="${k}" style="border:0;background:transparent;padding:0" ${n === i ? 'aria-current="step"' : ""}><b>${ok ? "✓" : n + 1}</b>${esc(tt(en, th))}${badge(k)}</button>`; }).join("")}</div>
    ${step === "review" ? main : `<div class="grid-main">${main}<div id="obSum-${id}">${obSummary(F)}</div></div>`}
    <div class="actions" style="justify-content:flex-end">${i > 0 ? `<button class="btn" type="button" data-tab="${steps[i - 1][0]}">${esc(t("Back"))}</button>` : ""}${i < steps.length - 1 ? `<button class="btn primary" type="button" data-tab="${steps[i + 1][0]}">${esc(t("Next"))}</button>` : ""}</div>`;
}

/* ---------------- shared option lists ---------------- */
const COUNTRIES = O(["TH", "Thailand", "ไทย"], ["MM", "Myanmar", "เมียนมา"], ["LA", "Laos", "ลาว"], ["KH", "Cambodia", "กัมพูชา"], ["CN", "China", "จีน"], ["HK", "Hong Kong", "ฮ่องกง"], ["SG", "Singapore", "สิงคโปร์"], ["JP", "Japan", "ญี่ปุ่น"], ["US", "United States", "สหรัฐอเมริกา"], ["GB", "United Kingdom", "สหราชอาณาจักร"], ["IR", "Iran", "อิหร่าน"], ["KP", "North Korea", "เกาหลีเหนือ"], ["OT", "Other", "อื่น ๆ"]);
const FATF_HIGH = ["IR", "KP", "MM"];
const HIGH_RISK_IND = ["gems", "moneyx", "gaming", "arms", "antiques", "usedcar", "realestate", "ngo"];
const IND_OCC = O(["salaried", "Salaried, private company", "พนักงานบริษัทเอกชน"], ["civil", "Civil servant or state enterprise", "ข้าราชการหรือรัฐวิสาหกิจ"], ["self", "Self-employed or business owner", "ประกอบธุรกิจส่วนตัว"], ["freelance", "Freelance", "ฟรีแลนซ์"], ["student", "Student", "นักเรียนนักศึกษา"], ["homemaker", "Homemaker", "แม่บ้าน/พ่อบ้าน"], ["retired", "Retired", "เกษียณ"], ["none", "Not working", "ไม่ได้ทำงาน"]);
const IND_INDUSTRY = [...INDUSTRY.filter(([v]) => v !== "other"), ...O(["gems", "Gems and jewellery", "อัญมณีและเครื่องประดับ"], ["moneyx", "Money exchange or remittance", "แลกเปลี่ยนเงินหรือโอนเงิน"], ["gaming", "Gaming or lottery", "การพนันหรือสลาก"], ["arms", "Arms and defence", "อาวุธและยุทโธปกรณ์"], ["antiques", "Antiques and art", "ของเก่าและงานศิลปะ"], ["usedcar", "Used car dealer", "ซื้อขายรถยนต์มือสอง"], ["realestate", "Real estate agent", "นายหน้าอสังหาริมทรัพย์"], ["ngo", "Charity or foundation", "มูลนิธิหรือองค์กรการกุศล"], ["other", "Other", "อื่น ๆ"])];
const BANDS_IN = O(["b1", "Under ฿15,000", "ต่ำกว่า ฿15,000"], ["b2", "฿15,000–30,000", "฿15,000–30,000"], ["b3", "฿30,001–50,000", "฿30,001–50,000"], ["b4", "฿50,001–100,000", "฿50,001–100,000"], ["b5", "฿100,001–300,000", "฿100,001–300,000"], ["b6", "Over ฿300,000", "เกิน ฿300,000"]);
const bandN = (v) => (v ? +String(v).slice(1) : 0);
const isEmpI = (f) => ["salaried", "civil"].includes(f.occType), isWorkingI = (f) => !["student", "homemaker", "retired", "none"].includes(f.occType);

/* ---------------- ONB-7731: Napat Srisuk opens a savings account at branch 0123 ---------------- */
const IND_STEPS = [["identity", "Identity", "ยืนยันตัวตน"], ["personal", "Personal details", "ข้อมูลส่วนตัว"], ["contact", "Contact and address", "การติดต่อและที่อยู่"], ["work", "Occupation and income", "อาชีพและรายได้"], ["purpose", "Purpose and activity", "วัตถุประสงค์และธุรกรรม"],
  ["dd", "Due diligence", "การตรวจสอบลูกค้า"], ["products", "Accounts and services", "บัญชีและบริการ"], ["consents", "Consents", "ความยินยอม"], ["review", "Review and open", "ตรวจทานและเปิดบัญชี"]];
const isThai = (f) => f.docType === "thai-id";
const IND_CAT = [
  { s: "identity", en: "Identity document", th: "เอกสารแสดงตน", fields: [
    { k: "docType", en: "Document", th: "เอกสาร", t: "select", req: true, re: true, o: O(["thai-id", "Thai citizen ID card", "บัตรประจำตัวประชาชน"], ["passport", "Passport (foreign national)", "หนังสือเดินทาง (ชาวต่างชาติ)"], ["alien", "Alien identity card", "ใบสำคัญประจำตัวคนต่างด้าว"]), src: "staff", why: "kyc" },
    { k: "citizenId", en: "Citizen ID", th: "เลขประจำตัวประชาชน", t: "id", req: true, ro: true, when: isThai, src: "dopa", why: "kyc" },
    { k: "laser", en: "Laser code (back of the card)", th: "รหัสหลังบัตร", t: "text", req: true, ro: true, when: isThai, src: "dopa", why: "kyc" },
    { k: "passportNo", en: "Passport number", th: "เลขหนังสือเดินทาง", t: "text", req: true, when: (f) => !isThai(f), src: "customer", why: "kyc" },
    { k: "passportCountry", en: "Issued by", th: "ประเทศที่ออก", t: "select", o: COUNTRIES, req: true, when: (f) => !isThai(f), src: "customer", why: "kyc" },
    { k: "visaType", en: "Visa", th: "ประเภทวีซ่า", t: "select", req: true, when: (f) => f.docType === "passport", o: O(["b", "Non-immigrant B (work)", "Non-B (ทำงาน)"], ["o", "Non-immigrant O (family)", "Non-O (ครอบครัว)"], ["ret", "Retirement", "เกษียณ"], ["ltr", "Long-term resident", "ผู้พำนักระยะยาว"], ["tourist", "Tourist", "ท่องเที่ยว"]), src: "customer", why: "kyc", hint: ["Tourists cannot open a savings account under bank policy", "นักท่องเที่ยวเปิดบัญชีออมทรัพย์ไม่ได้ตามนโยบายธนาคาร"], check: (v) => (v === "tourist" ? tt("Not eligible on a tourist visa", "วีซ่าท่องเที่ยวเปิดบัญชีไม่ได้") : "") },
    { k: "workPermit", en: "Work permit number", th: "เลขใบอนุญาตทำงาน", t: "text", req: true, when: (f) => f.docType === "passport" && f.visaType === "b", src: "customer", why: "kyc" },
    { k: "idIssued", en: "Issued", th: "วันออก", t: "date", req: true, ro: (f) => isThai(f), src: "dopa", why: "kyc" },
    { k: "idExpiry", en: "Expires", th: "วันหมดอายุ", t: "date", req: true, src: "dopa", why: "kyc", check: (v) => (Date.parse(v) < BIZ ? tt("Expired: ask for a valid document", "หมดอายุแล้ว: ขอเอกสารที่ยังไม่หมดอายุ") : "") }] },
  { s: "identity", en: "Verification", th: "การยืนยันตัวตน", sub: ["Read from the card and checked with DOPA and NDID; the customer sees the same results on the tablet.", "อ่านจากบัตรและตรวจกับกรมการปกครองและ NDID ลูกค้าเห็นผลเดียวกันบนแท็บเล็ต"], fields: [
    { k: "method", en: "How identity was verified", th: "วิธียืนยันตัวตน", t: "select", req: true, re: true, o: O(["branch", "In branch: card reader and face match", "ที่สาขา: เครื่องอ่านบัตรและเทียบใบหน้า"], ["ndid", "Remotely through NDID", "ทางไกลผ่าน NDID"], ["video", "Video call with a bank officer", "วิดีโอคอลกับเจ้าหน้าที่"]), src: "staff", why: "kyc" },
    { k: "dopaResult", en: "DOPA check", th: "ผลตรวจกรมการปกครอง", t: "text", ro: true, when: isThai, src: "dopa", why: "kyc" },
    { k: "faceScore", en: "Face match score", th: "คะแนนเทียบใบหน้า", t: "text", ro: true, src: "system", why: "kyc" },
    { k: "liveness", en: "Liveness", th: "การตรวจว่ามีชีวิต", t: "text", ro: true, src: "system", why: "kyc" },
    { k: "ndidIal", en: "NDID assurance level", th: "ระดับความน่าเชื่อถือ NDID", t: "select", req: true, when: (f) => f.method === "ndid", o: O(["2.3", "IAL 2.3", "IAL 2.3"], ["2.2", "IAL 2.2", "IAL 2.2"], ["2.1", "IAL 2.1: not enough to open", "IAL 2.1: ไม่พอสำหรับเปิดบัญชี"]), src: "ndid", why: "kyc", check: (v) => (v === "2.1" ? tt("IAL 2.3 or 2.2 is needed to open remotely", "เปิดบัญชีทางไกลต้องใช้ IAL 2.3 หรือ 2.2") : "") }] },

  { s: "personal", en: "Name and birth", th: "ชื่อและวันเกิด", fields: [
    { k: "title", en: "Title", th: "คำนำหน้า", t: "select", req: true, o: O(["mr", "Mr", "นาย"], ["mrs", "Mrs", "นาง"], ["miss", "Miss", "นางสาว"]), src: "dopa", why: "kyc" },
    { k: "firstTh", en: "First name (Thai)", th: "ชื่อ (ไทย)", t: "text", req: isThai, src: "dopa", why: "kyc" }, { k: "lastTh", en: "Last name (Thai)", th: "นามสกุล (ไทย)", t: "text", req: isThai, src: "dopa", why: "kyc" },
    { k: "firstEn", en: "First name (English)", th: "ชื่อ (อังกฤษ)", t: "text", req: true, src: "dopa", why: "kyc" }, { k: "lastEn", en: "Last name (English)", th: "นามสกุล (อังกฤษ)", t: "text", req: true, src: "dopa", why: "kyc" },
    { k: "prevName", en: "Previous name, if changed", th: "ชื่อเดิม (หากเปลี่ยนชื่อ)", t: "text", src: "customer", why: "aml", hint: ["Screened as well as the current name", "ตรวจรายชื่อทั้งชื่อเดิมและชื่อปัจจุบัน"] },
    { k: "dob", en: "Date of birth", th: "วันเกิด", t: "date", req: true, ro: true, src: "dopa", why: "kyc", check: (v) => (ageAt(v) < 15 ? tt("Under 15: open with a guardian", "อายุต่ำกว่า 15 ปี: เปิดพร้อมผู้ปกครอง") : "") },
    { k: "gender", en: "Sex", th: "เพศ", t: "select", req: true, o: O(["f", "Female", "หญิง"], ["m", "Male", "ชาย"]), src: "dopa", why: "kyc" },
    { k: "nationality", en: "Nationality", th: "สัญชาติ", t: "select", req: true, o: COUNTRIES, src: "dopa", why: "kyc" },
    { k: "nationality2", en: "Second nationality", th: "สัญชาติที่สอง", t: "select", o: [["", "None", "ไม่มี"], ...COUNTRIES], src: "customer", why: "fatca" },
    { k: "marital", en: "Marital status", th: "สถานภาพสมรส", t: "select", req: true, o: O(["single", "Single", "โสด"], ["married", "Married", "สมรส"], ["divorced", "Divorced", "หย่า"], ["widowed", "Widowed", "หม้าย"]), src: "customer", why: "kyc" },
    { k: "education", en: "Education", th: "การศึกษา", t: "select", o: O(["below", "Below bachelor's", "ต่ำกว่าปริญญาตรี"], ["bachelor", "Bachelor's", "ปริญญาตรี"], ["master", "Master's or above", "ปริญญาโทขึ้นไป"]), src: "customer", why: "kyc" }] },

  { s: "contact", en: "Contact", th: "การติดต่อ", fields: [
    { k: "mobile", en: "Mobile", th: "โทรศัพท์มือถือ", t: "tel", req: true, src: "customer", why: "ops" },
    { k: "mobileOtp", en: "Mobile confirmed by one-time code", th: "ยืนยันเบอร์มือถือด้วยรหัส OTP", t: "check", req: true, src: "system", why: "ops", hint: ["The number is checked against numbers linked to known mule accounts", "ตรวจเบอร์กับรายการเบอร์ที่ผูกกับบัญชีม้า"] },
    { k: "email", en: "Email", th: "อีเมล", t: "email", req: (f) => f.estatement === "email", src: "customer", why: "ops" },
    { k: "lineId", en: "LINE ID", th: "LINE ID", t: "text", src: "customer", why: "ops" },
    { k: "lang", en: "Language for documents", th: "ภาษาของเอกสาร", t: "select", req: true, o: O(["th", "Thai", "ไทย"], ["en", "English", "อังกฤษ"]), src: "customer", why: "conduct" }] },
  { s: "contact", en: "Address on the house registration", th: "ที่อยู่ตามทะเบียนบ้าน", when: isThai, fields: [
    { k: "regNo", en: "House number", th: "บ้านเลขที่", t: "text", req: true, ro: true, src: "dopa", why: "kyc" }, { k: "regSub", en: "Subdistrict", th: "แขวง/ตำบล", t: "text", req: true, ro: true, src: "dopa", why: "kyc" },
    { k: "regDist", en: "District", th: "เขต/อำเภอ", t: "text", req: true, ro: true, src: "dopa", why: "kyc" }, { k: "regProv", en: "Province", th: "จังหวัด", t: "select", o: PROVINCES, req: true, ro: true, src: "dopa", why: "kyc" }, { k: "regPost", en: "Postcode", th: "รหัสไปรษณีย์", t: "post", req: true, src: "dopa", why: "kyc" }] },
  { s: "contact", en: "Where the customer lives", th: "ที่อยู่ปัจจุบัน", fields: [
    { k: "curSame", en: "Same as the house registration", th: "เหมือนที่อยู่ตามทะเบียนบ้าน", t: "check", re: true, when: isThai, src: "customer", why: "kyc", wide: true },
    { k: "curLine", en: "Address", th: "ที่อยู่", t: "text", req: true, when: (f) => !isThai(f) || !f.curSame, src: "customer", why: "kyc", wide: true },
    { k: "curProv", en: "Province", th: "จังหวัด", t: "select", o: PROVINCES, req: true, when: (f) => !isThai(f) || !f.curSame, src: "customer", why: "kyc" }, { k: "curPost", en: "Postcode", th: "รหัสไปรษณีย์", t: "post", req: true, when: (f) => !isThai(f) || !f.curSame, src: "customer", why: "kyc" },
    { k: "residence", en: "Home is", th: "ลักษณะที่อยู่อาศัย", t: "select", req: true, o: O(["own", "Owned", "เป็นเจ้าของ"], ["rent", "Rented", "เช่า"], ["family", "Family home", "บ้านครอบครัว"], ["employer", "Employer's housing", "บ้านพักสวัสดิการ"]), src: "customer", why: "kyc" },
    { k: "mailTo", en: "Send letters to", th: "ที่อยู่ส่งเอกสาร", t: "select", req: true, o: O(["registered", "House registration address", "ที่อยู่ตามทะเบียนบ้าน"], ["current", "Current address", "ที่อยู่ปัจจุบัน"], ["work", "Work address", "ที่ทำงาน"]), src: "customer", why: "ops" }] },

  { s: "work", en: "Occupation", th: "อาชีพ", fields: [
    { k: "occType", en: "Occupation", th: "อาชีพ", t: "select", o: IND_OCC, req: true, re: true, src: "customer", why: "kyc" },
    { k: "employer", en: "Employer or business name", th: "ชื่อนายจ้างหรือกิจการ", t: "text", req: isWorkingI, when: isWorkingI, src: "customer", why: "kyc" },
    { k: "industry", en: "Industry", th: "ประเภทธุรกิจ", t: "select", o: IND_INDUSTRY, req: isWorkingI, when: isWorkingI, src: "customer", why: "aml", re: true },
    { k: "position", en: "Position", th: "ตำแหน่ง", t: "text", req: isEmpI, when: isWorkingI, src: "customer", why: "kyc" },
    { k: "workProv", en: "Workplace province", th: "จังหวัดที่ทำงาน", t: "select", o: PROVINCES, when: isWorkingI, src: "customer", why: "kyc" },
    { k: "school", en: "School or university", th: "สถานศึกษา", t: "text", req: true, when: (f) => f.occType === "student", src: "customer", why: "kyc" }] },
  { s: "work", en: "Income", th: "รายได้", fields: [
    { k: "incomeBand", en: "Monthly income", th: "รายได้ต่อเดือน", t: "select", o: BANDS_IN, req: true, re: true, src: "customer", why: "aml" },
    { k: "incomeSource", en: "Main source of income", th: "แหล่งรายได้หลัก", t: "select", req: true, o: O(["salary", "Salary", "เงินเดือน"], ["business", "Business", "ธุรกิจ"], ["family", "Family support", "ครอบครัวสนับสนุน"], ["pension", "Pension", "บำนาญ"], ["investment", "Investments or rent", "การลงทุนหรือค่าเช่า"], ["other", "Other", "อื่น ๆ"]), src: "customer", why: "aml" },
    { k: "incomeOther", en: "Other source, in the customer's words", th: "แหล่งรายได้อื่น", t: "text", req: true, when: (f) => f.incomeSource === "other", src: "customer", why: "aml" }] },

  { s: "purpose", en: "Why the account", th: "วัตถุประสงค์ของบัญชี", fields: [
    { k: "purpose", en: "Main purpose", th: "วัตถุประสงค์หลัก", t: "select", req: true, re: true, o: O(["salary", "Receive salary", "รับเงินเดือน"], ["savings", "Savings", "เก็บออม"], ["bills", "Pay bills and loans", "ชำระค่าบริการและสินเชื่อ"], ["business", "Receive business payments (sole trader)", "รับเงินจากการค้า (บุคคลธรรมดา)"], ["family", "Receive money from family abroad", "รับเงินจากครอบครัวต่างประเทศ"], ["other", "Other", "อื่น ๆ"]), src: "customer", why: "aml" },
    { k: "purposeOther", en: "Purpose, in the customer's words", th: "วัตถุประสงค์", t: "text", req: true, when: (f) => f.purpose === "other", src: "customer", why: "aml" }] },
  { s: "purpose", en: "Expected activity", th: "ธุรกรรมที่คาดหมาย", sub: ["This becomes the customer's expected profile; monitoring alerts when activity departs from it.", "ข้อมูลนี้เป็นพฤติกรรมที่คาดหมาย ระบบติดตามธุรกรรมแจ้งเตือนเมื่อแตกต่าง"], fields: [
    { k: "depBand", en: "Money in each month", th: "เงินเข้าต่อเดือน", t: "select", o: BANDS_IN, req: true, re: true, src: "customer", why: "aml" },
    { k: "txBand", en: "Transactions each month", th: "จำนวนรายการต่อเดือน", t: "select", req: true, o: O(["t1", "Up to 20", "ไม่เกิน 20"], ["t2", "21 to 100", "21 ถึง 100"], ["t3", "Over 100", "เกิน 100"]), src: "customer", why: "aml" },
    { k: "cash", en: "Cash use", th: "การใช้เงินสด", t: "select", req: true, re: true, o: O(["none", "Rarely", "แทบไม่ใช้"], ["some", "Sometimes, small amounts", "บางครั้ง จำนวนน้อย"], ["large", "Regularly, over ฿200,000 a month", "สม่ำเสมอ เกิน ฿200,000 ต่อเดือน"]), src: "customer", why: "aml" },
    { k: "intl", en: "Money sent or received abroad", th: "รับหรือโอนเงินต่างประเทศ", t: "select", o: YN, req: true, re: true, src: "customer", why: "aml" },
    { k: "intlCountry", en: "Main country", th: "ประเทศหลัก", t: "select", o: COUNTRIES, req: true, when: (f) => f.intl === "yes", re: true, src: "customer", why: "aml" },
    { k: "intlWhy", en: "Why", th: "เหตุผล", t: "text", req: true, when: (f) => f.intl === "yes", src: "customer", why: "aml" }] },
  { s: "purpose", en: "First deposit", th: "เงินฝากครั้งแรก", fields: [
    { k: "initAmount", en: "Amount", th: "จำนวนเงิน", t: "money", req: true, src: "customer", why: "aml" },
    { k: "initSource", en: "The money comes from", th: "ที่มาของเงิน", t: "select", req: true, re: true, o: O(["savings", "Own savings", "เงินออม"], ["salary", "Salary", "เงินเดือน"], ["sale", "Sale of property or a vehicle", "ขายทรัพย์สินหรือรถ"], ["gift", "Gift or inheritance", "ได้รับมรดกหรือของขวัญ"], ["loan", "A loan", "เงินกู้"], ["other", "Other", "อื่น ๆ"]), src: "customer", why: "aml" },
    { k: "initHow", en: "Paid by", th: "ฝากโดย", t: "select", req: true, o: O(["cash", "Cash at the counter", "เงินสดที่เคาน์เตอร์"], ["transfer", "Transfer from own account at another bank", "โอนจากบัญชีตนเองที่ธนาคารอื่น"], ["cheque", "Cheque", "เช็ค"]), src: "customer", why: "aml" }] },

  { s: "dd", en: "Politically exposed persons", th: "บุคคลที่มีสถานภาพทางการเมือง", fields: [
    { k: "pep", en: "Holds or held a prominent public position", th: "เป็นหรือเคยเป็นบุคคลที่มีสถานภาพทางการเมือง", t: "select", req: true, re: true, o: O(["no", "No", "ไม่ใช่"], ["self", "Yes, the customer", "ใช่ ลูกค้าเอง"], ["family", "A family member", "สมาชิกในครอบครัว"], ["associate", "A close associate", "ผู้ใกล้ชิด"]), src: "customer", why: "aml" },
    { k: "pepDetail", en: "Position, country and dates", th: "ตำแหน่ง ประเทศ และช่วงเวลา", t: "text", req: true, when: (f) => f.pep && f.pep !== "no", src: "customer", why: "aml", wide: true }] },
  { s: "dd", en: "Who the account is for", th: "ผู้ได้รับประโยชน์จากบัญชี", fields: [
    { k: "actingFor", en: "The customer opens it for", th: "ลูกค้าเปิดบัญชีเพื่อ", t: "select", req: true, re: true, o: O(["self", "Themselves", "ตนเอง"], ["other", "Someone else", "ผู้อื่น"]), src: "customer", why: "aml", hint: ["Someone opening an account for another person is a common sign of a mule account", "การเปิดบัญชีให้ผู้อื่นเป็นสัญญาณที่พบบ่อยของบัญชีม้า"] },
    { k: "actingName", en: "For whom, and why", th: "เพื่อใคร และเหตุผล", t: "text", req: true, when: (f) => f.actingFor === "other", src: "customer", why: "aml", wide: true }] },
  { s: "dd", en: "Tax residence", th: "ถิ่นที่อยู่ทางภาษี", fields: [
    { k: "usPerson", en: "US citizen, green-card holder or born in the US", th: "เป็นพลเมืองสหรัฐ ผู้ถือกรีนการ์ด หรือเกิดในสหรัฐ", t: "select", o: YN, req: true, re: true, src: "customer", why: "fatca" },
    { k: "usTin", en: "US taxpayer number", th: "เลขประจำตัวผู้เสียภาษีสหรัฐ", t: "text", req: true, when: (f) => f.usPerson === "yes", src: "customer", why: "fatca" },
    { k: "taxOther", en: "Tax resident outside Thailand", th: "มีถิ่นที่อยู่ทางภาษีนอกประเทศไทย", t: "select", o: YN, req: true, re: true, src: "customer", why: "fatca" },
    { k: "taxCountry", en: "Country", th: "ประเทศ", t: "select", o: COUNTRIES, req: true, when: (f) => f.taxOther === "yes", src: "customer", why: "fatca" },
    { k: "taxTin", en: "Tax number there", th: "เลขผู้เสียภาษีในประเทศนั้น", t: "text", req: (f) => f.taxNoTin !== "yes", when: (f) => f.taxOther === "yes", src: "customer", why: "fatca" },
    { k: "taxNoTin", en: "That country issues no tax number", th: "ประเทศนั้นไม่ออกเลขผู้เสียภาษี", t: "select", o: YN, when: (f) => f.taxOther === "yes", src: "customer", why: "fatca", re: true }] },
  { s: "dd", en: "Related parties and screening", th: "บุคคลที่เกี่ยวข้องและการตรวจรายชื่อ", fields: [
    { k: "relatedBank", en: "Related to the bank's directors or executives", th: "เกี่ยวข้องกับกรรมการหรือผู้บริหารของธนาคาร", t: "select", o: YN, req: true, src: "customer", why: "related" },
    { k: "staff", en: "Employee of the bank", th: "พนักงานของธนาคาร", t: "select", o: YN, req: true, src: "customer", why: "related" },
    { k: "screening", en: "Sanctions, PEP and adverse media screening", th: "ผลตรวจรายชื่อคว่ำบาตร PEP และข่าวเชิงลบ", t: "text", ro: true, src: "system", why: "aml", wide: true },
    { k: "muleCheck", en: "Mule-account check (shared watchlist and device)", th: "ตรวจบัญชีม้า (รายชื่อร่วมและอุปกรณ์)", t: "text", ro: true, src: "system", why: "aml", wide: true }] },

  { s: "products", en: "Account", th: "บัญชี", fields: [
    { k: "product", en: "Account type", th: "ประเภทบัญชี", t: "select", req: true, re: true, o: O(["sav", "Savings Standard, with passbook", "ออมทรัพย์มาตรฐาน มีสมุดบัญชี"], ["savapp", "Savings Plus, app only, 1.20%", "ออมทรัพย์พลัส ใช้ผ่านแอปเท่านั้น 1.20%"], ["fixed", "Fixed deposit", "เงินฝากประจำ"], ["current", "Current account with cheques", "บัญชีกระแสรายวันพร้อมเช็ค"]), src: "customer", why: "contract", check: (v, f) => (v === "current" && num(f.initAmount) < 10000 ? tt("A current account needs ฿10,000 to open", "บัญชีกระแสรายวันต้องเปิดด้วย ฿10,000") : "") },
    { k: "fixedTerm", en: "Term", th: "ระยะเวลา", t: "select", req: true, when: (f) => f.product === "fixed", o: RATE_CARD.map(([m, r]) => [String(m), `${m} months, ${(r * 100).toFixed(2)}%`, `${m} เดือน ${(r * 100).toFixed(2)}%`]), src: "customer", why: "contract" },
    { k: "currency", en: "Currency", th: "สกุลเงิน", t: "select", req: true, o: O(["THB", "Thai baht", "บาท"], ["USD", "US dollar (foreign currency deposit)", "ดอลลาร์สหรัฐ (เงินฝากเงินตราต่างประเทศ)"]), src: "customer", why: "contract" },
    { k: "ownership", en: "Held by", th: "ผู้ถือบัญชี", t: "select", req: true, re: true, o: O(["single", "The customer alone", "ลูกค้าคนเดียว"], ["and", "Jointly: both must sign", "ร่วมกัน: ต้องลงนามทั้งสองคน"], ["or", "Jointly: either may sign", "ร่วมกัน: คนใดคนหนึ่งลงนามได้"]), src: "customer", why: "contract" },
    { k: "jointName", en: "Joint holder", th: "ผู้ถือบัญชีร่วม", t: "text", req: true, when: (f) => f.ownership !== "single", src: "customer", why: "kyc", hint: ["The joint holder completes their own KYC", "ผู้ถือบัญชีร่วมต้องผ่าน KYC ของตนเอง"] },
    { k: "jointId", en: "Joint holder's citizen ID", th: "เลขประจำตัวประชาชนผู้ถือบัญชีร่วม", t: "id", req: true, when: (f) => f.ownership !== "single", src: "customer", why: "kyc" }] },
  { s: "products", en: "Services", th: "บริการ", fields: [
    { k: "passbook", en: "Passbook", th: "สมุดบัญชี", t: "select", o: YN, req: true, when: (f) => f.product === "sav", src: "customer", why: "ops" },
    { k: "card", en: "Debit card", th: "บัตรเดบิต", t: "select", req: true, re: true, when: (f) => f.product !== "fixed", o: O(["none", "None", "ไม่ทำ"], ["std", "Standard, ฿200 a year", "มาตรฐาน ปีละ ฿200"], ["plus", "Plus, ฿500 a year, travel cover included", "พลัส ปีละ ฿500 รวมประกันการเดินทาง"]), src: "customer", why: "contract" },
    { k: "cardAck", en: "Told that the card's insurance is optional: the standard card is available without it", th: "แจ้งแล้วว่าประกันในบัตรเป็นทางเลือก บัตรมาตรฐานไม่มีประกัน", t: "check", req: true, when: (f) => f.card === "plus", src: "staff", why: "conduct", wide: true },
    { k: "cardPrint", en: "Card issued", th: "การออกบัตร", t: "select", when: (f) => f.card && f.card !== "none", req: true, o: O(["instant", "Printed at the branch now", "พิมพ์ที่สาขาทันที"], ["post", "Sent by registered post", "ส่งทางไปรษณีย์ลงทะเบียน"]), src: "customer", why: "ops" },
    { k: "promptpay", en: "Link to PromptPay", th: "ผูกพร้อมเพย์", t: "select", req: true, re: true, when: (f) => f.product !== "fixed" && f.currency === "THB", o: O(["none", "No", "ไม่ผูก"], ["id", "Citizen ID", "เลขประจำตัวประชาชน"], ["mobile", "Mobile number", "เบอร์มือถือ"]), src: "customer", why: "ops", hint: ["An ID or number linked at another bank moves here only if the customer confirms", "หากผูกไว้กับธนาคารอื่น จะย้ายมาเมื่อลูกค้ายืนยันเท่านั้น"] },
    { k: "app", en: "Mobile banking", th: "โมบายแบงก์กิ้ง", t: "select", o: YN, req: true, src: "customer", why: "ops", hint: ["Enrolled on this device only; a new device needs face verification", "ลงทะเบียนเฉพาะเครื่องนี้ เครื่องใหม่ต้องยืนยันใบหน้า"] },
    { k: "sms", en: "SMS alerts, ฿20 a month", th: "แจ้งเตือน SMS เดือนละ ฿20", t: "select", o: YN, req: true, src: "customer", why: "contract" },
    { k: "estatement", en: "Statements by", th: "รับรายการเดินบัญชีทาง", t: "select", req: true, re: true, o: O(["app", "The app", "แอป"], ["email", "Email", "อีเมล"], ["post", "Post", "ไปรษณีย์"]), src: "customer", why: "ops" },
    { k: "cheque", en: "Cheque book", th: "สมุดเช็ค", t: "select", o: YN, req: true, when: (f) => f.product === "current", src: "customer", why: "ops" }] },

  { s: "consents", en: "Terms and notices", th: "เงื่อนไขและประกาศ", fields: [
    { k: "terms", en: "Account terms read and accepted, in the customer's language", th: "อ่านและยอมรับเงื่อนไขบัญชีในภาษาของลูกค้าแล้ว", t: "check", req: true, src: "customer", why: "conduct", wide: true },
    { k: "fees", en: "Fee schedule shown, including the dormant-account fee", th: "แสดงตารางค่าธรรมเนียม รวมค่าธรรมเนียมบัญชีไม่เคลื่อนไหวแล้ว", t: "check", req: true, src: "staff", why: "conduct", wide: true },
    { k: "dpa", en: "Told that deposits are protected up to ฿1,000,000 per depositor per bank", th: "แจ้งแล้วว่าเงินฝากได้รับความคุ้มครองไม่เกิน ฿1,000,000 ต่อผู้ฝากต่อธนาคาร", t: "check", req: true, src: "staff", why: "dpa", wide: true }] },
  { s: "consents", en: "Personal data", th: "ข้อมูลส่วนบุคคล", sub: ["Optional: the account does not depend on these.", "เป็นทางเลือก ไม่มีผลต่อการเปิดบัญชี"], fields: [
    { k: "pdpaMarketing", en: "Offers from the bank", th: "ข้อเสนอจากธนาคาร", t: "select", o: YN, req: true, src: "customer", why: "pdpa" },
    { k: "pdpaGroup", en: "Offers from the bank's group companies", th: "ข้อเสนอจากบริษัทในกลุ่ม", t: "select", o: YN, req: true, src: "customer", why: "pdpa" },
    { k: "pdpaPartners", en: "Offers from partners", th: "ข้อเสนอจากพันธมิตร", t: "select", o: YN, req: true, src: "customer", why: "pdpa" }] },
  { s: "consents", en: "Confirmation", th: "การรับรอง", fields: [
    { k: "certify", en: "The customer confirms the information is true, the account is for their own use, and they will not let anyone else use it", th: "ลูกค้ารับรองว่าข้อมูลถูกต้อง เปิดบัญชีเพื่อใช้เอง และจะไม่ให้ผู้อื่นใช้บัญชี", t: "check", req: true, src: "customer", why: "aml", wide: true }] },
];
const IND_DEFAULTS = () => ({ docType: "thai-id", citizenId: "3101200456789", laser: "ME0-1234567-89", passportNo: "", passportCountry: "", visaType: "", workPermit: "", idIssued: "2021-04-14", idExpiry: "2029-04-13", method: "branch", dopaResult: tt("Card active; laser code matches", "บัตรใช้งานได้ รหัสหลังบัตรตรงกัน"), faceScore: "97.4% (threshold 90%)", liveness: tt("Passed, 1 attempt", "ผ่าน 1 ครั้ง"), ndidIal: "",
  title: "mr", firstTh: "นภัทร", lastTh: "ศรีสุข", firstEn: "Napat", lastEn: "Srisuk", prevName: "", dob: "1991-04-14", gender: "m", nationality: "TH", nationality2: "", marital: "single", education: "bachelor",
  mobile: "0819917731", mobileOtp: true, email: "", lineId: "", lang: "th", regNo: "41/7", regSub: "Lat Yao", regDist: "Chatuchak", regProv: "Bangkok", regPost: "10900", curSame: true, curLine: "", curProv: "", curPost: "", residence: "rent", mailTo: "current",
  occType: "salaried", employer: "Bangkok Freight Forwarding Co., Ltd.", industry: "logistics", position: "", workProv: "Bangkok", school: "", incomeBand: "b3", incomeSource: "salary", incomeOther: "",
  purpose: "salary", purposeOther: "", depBand: "b3", txBand: "t2", cash: "none", intl: "no", intlCountry: "", intlWhy: "", initAmount: "5000", initSource: "savings", initHow: "cash",
  pep: "", pepDetail: "", actingFor: "", actingName: "", usPerson: "", usTin: "", taxOther: "no", taxCountry: "", taxTin: "", taxNoTin: "", relatedBank: "", staff: "no", screening: tt("Clear: 1 near match on name cleared (different date of birth)", "ไม่พบ: ชื่อใกล้เคียง 1 รายการ ตรวจแล้ววันเกิดไม่ตรง"), muleCheck: tt("Clear: number and device not on the shared watchlist", "ไม่พบ: เบอร์และอุปกรณ์ไม่อยู่ในรายชื่อเฝ้าระวัง"),
  product: "sav", fixedTerm: "", currency: "THB", ownership: "single", jointName: "", jointId: "", passbook: "yes", card: "std", cardAck: false, cardPrint: "instant", promptpay: "mobile", app: "yes", sms: "no", estatement: "app", cheque: "",
  terms: false, fees: false, dpa: false, pdpaMarketing: "", pdpaGroup: "", pdpaPartners: "", certify: false });
function indFactors(f) {
  const out = [], ind = (p, en, th) => out.push([tt(en, th), p]);
  if (f.nationality && f.nationality !== "TH") ind(2, "Foreign national", "ชาวต่างชาติ");
  if (f.method === "ndid" || f.method === "video") ind(1, "Opened without meeting in person", "เปิดบัญชีโดยไม่พบหน้า");
  if (HIGH_RISK_IND.includes(f.industry)) ind(3, "Higher-risk industry", "อุตสาหกรรมความเสี่ยงสูง");
  if (bandN(f.depBand) - bandN(f.incomeBand) >= 2) ind(2, "Money in well above the stated income", "เงินเข้าสูงกว่ารายได้ที่แจ้งมาก");
  if (f.cash === "large") ind(2, "Large regular cash", "ใช้เงินสดจำนวนมากสม่ำเสมอ");
  if (f.intl === "yes") ind(FATF_HIGH.includes(f.intlCountry) ? 4 : 1, FATF_HIGH.includes(f.intlCountry) ? "Transfers with a high-risk country" : "Transfers abroad", FATF_HIGH.includes(f.intlCountry) ? "โอนเงินกับประเทศความเสี่ยงสูง" : "โอนเงินต่างประเทศ");
  if (f.pep && f.pep !== "no") ind(4, "Politically exposed", "บุคคลที่มีสถานภาพทางการเมือง");
  if (f.actingFor === "other") ind(4, "Opening for someone else", "เปิดบัญชีให้ผู้อื่น");
  if (["loan", "other"].includes(f.initSource)) ind(1, "First deposit from a loan or other source", "เงินฝากครั้งแรกจากเงินกู้หรือแหล่งอื่น");
  return out;
}

/* ---------------- AO-26-0412: Lanna Craft Export Co., Ltd. ---------------- */
const BIZ_STEPS = [["company", "Company", "นิติบุคคล"], ["documents", "Documents", "เอกสาร"], ["people", "Directors and signatories", "กรรมการและผู้มีอำนาจลงนาม"], ["owners", "Owners", "ผู้ถือหุ้นและผู้รับผลประโยชน์"], ["activity", "Expected activity", "ธุรกรรมที่คาดหมาย"],
  ["dd", "Due diligence", "การตรวจสอบลูกค้า"], ["services", "Accounts and services", "บัญชีและบริการ"], ["mandate", "Signing mandate", "เงื่อนไขการลงนาม"], ["consents", "Declarations", "คำรับรอง"], ["review", "Review and open", "ตรวจทานและเปิดบัญชี"]];
const ENTITY = O(["co", "Private limited company", "บริษัทจำกัด"], ["pcl", "Public limited company", "บริษัทมหาชนจำกัด"], ["lp", "Limited partnership", "ห้างหุ้นส่วนจำกัด"], ["rp", "Registered ordinary partnership", "ห้างหุ้นส่วนสามัญนิติบุคคล"], ["foundation", "Foundation or association", "มูลนิธิหรือสมาคม"], ["branch", "Branch of a foreign company", "สาขาบริษัทต่างประเทศ"]);
const BANDS_BIZ = O(["m1", "Under ฿1m", "ต่ำกว่า ฿1 ล้าน"], ["m2", "฿1–5m", "฿1–5 ล้าน"], ["m3", "฿5–20m", "฿5–20 ล้าน"], ["m4", "฿20–100m", "฿20–100 ล้าน"], ["m5", "Over ฿100m", "เกิน ฿100 ล้าน"]);
const dirSec = (n) => ({ s: "people", en: n === 1 ? "Director 1" : `Director ${n}`, th: `กรรมการคนที่ ${n}`, when: n === 3 ? (f) => f.dir3On : null, fields: [
  { k: `dir${n}Name`, en: "Name", th: "ชื่อ-นามสกุล", t: "text", req: true, src: "dbd", why: "kyc" }, { k: `dir${n}Id`, en: "Citizen ID or passport", th: "เลขประจำตัวหรือหนังสือเดินทาง", t: "text", req: true, src: "customer", why: "kyc", check: (v) => (/^\d{13}$/.test(v) && !idValid(v) ? tt("Not a valid 13-digit ID", "เลขประจำตัวไม่ถูกต้อง") : "") },
  { k: `dir${n}Nat`, en: "Nationality", th: "สัญชาติ", t: "select", o: COUNTRIES, req: true, src: "customer", why: "kyc" }, { k: `dir${n}Role`, en: "Role", th: "ตำแหน่ง", t: "select", req: true, o: O(["md", "Managing director", "กรรมการผู้จัดการ"], ["fd", "Finance director", "ผู้อำนวยการการเงิน"], ["dir", "Director", "กรรมการ"]), src: "dbd", why: "kyc" },
  { k: `dir${n}Sign`, en: "Authorised to sign", th: "ผู้มีอำนาจลงนาม", t: "select", o: O(["a", "Yes, group A", "ใช่ กลุ่ม A"], ["b", "Yes, group B", "ใช่ กลุ่ม B"], ["no", "No", "ไม่ใช่"]), req: true, src: "dbd", why: "contract" },
  { k: `dir${n}Kyc`, en: "Identity verified", th: "ยืนยันตัวตนแล้ว", t: "select", o: O(["ndid", "With NDID", "ด้วย NDID"], ["branch", "At a branch", "ที่สาขา"], ["pending", "Not yet", "ยังไม่ยืนยัน"]), req: true, src: "staff", why: "kyc", check: (v) => (v === "pending" ? tt("Every director and signatory must be verified", "กรรมการและผู้มีอำนาจลงนามทุกคนต้องยืนยันตัวตน") : "") }] });
const shSec = (n) => ({ s: "owners", en: `Shareholder ${n}`, th: `ผู้ถือหุ้นรายที่ ${n}`, fields: [
  { k: `sh${n}Name`, en: "Name", th: "ชื่อ", t: "text", req: true, src: "dbd", why: "kyc" }, { k: `sh${n}Type`, en: "Is a", th: "ประเภท", t: "select", o: O(["person", "Person", "บุคคล"], ["company", "Company", "นิติบุคคล"]), req: true, re: true, src: "dbd", why: "kyc" },
  { k: `sh${n}Pct`, en: "Shares held, %", th: "สัดส่วนหุ้น %", t: "pct", req: true, src: "dbd", why: "kyc" }, { k: `sh${n}Country`, en: "Country", th: "ประเทศ", t: "select", o: COUNTRIES, req: true, src: "dbd", why: "aml" }] });
const uboSec = (n) => ({ s: "owners", en: `Beneficial owner ${n}`, th: `ผู้รับผลประโยชน์ที่แท้จริงรายที่ ${n}`, sub: n === 1 ? ["Every person who owns or controls 25% or more, directly or through companies.", "บุคคลธรรมดาทุกคนที่ถือหรือควบคุมตั้งแต่ 25% ขึ้นไป โดยตรงหรือผ่านนิติบุคคล"] : null, when: n === 2 ? (f) => f.ubo2On : null, fields: [
  { k: `ubo${n}Name`, en: "Name", th: "ชื่อ-นามสกุล", t: "text", req: true, src: "customer", why: "kyc" }, { k: `ubo${n}Id`, en: "Citizen ID or passport", th: "เลขประจำตัวหรือหนังสือเดินทาง", t: "text", req: true, src: "customer", why: "kyc" },
  { k: `ubo${n}Nat`, en: "Nationality", th: "สัญชาติ", t: "select", o: COUNTRIES, req: true, src: "customer", why: "kyc", re: true }, { k: `ubo${n}Pct`, en: "Effective ownership, %", th: "สัดส่วนที่แท้จริง %", t: "pct", req: true, src: "customer", why: "kyc" },
  { k: `ubo${n}How`, en: "Held through", th: "ถือผ่าน", t: "text", src: "customer", why: "kyc" }, { k: `ubo${n}Pep`, en: "Politically exposed", th: "บุคคลที่มีสถานภาพทางการเมือง", t: "select", o: YN, req: true, src: "customer", why: "aml", re: true },
  { k: `ubo${n}Wealth`, en: "Source of wealth", th: "แหล่งที่มาของความมั่งคั่ง", t: "text", req: (f) => f[`ubo${n}Pep`] === "yes" || (f[`ubo${n}Nat`] && f[`ubo${n}Nat`] !== "TH"), src: "customer", why: "aml", wide: true, hint: ["Needed for foreign or politically exposed owners", "จำเป็นสำหรับผู้ถือหุ้นต่างชาติหรือบุคคลที่มีสถานภาพทางการเมือง"] }] });
const BIZ_CAT = [
  { s: "company", en: "Registration", th: "การจดทะเบียน", fields: [
    { k: "regNo", en: "Registration number", th: "เลขทะเบียนนิติบุคคล", t: "id", req: true, ro: true, src: "dbd", why: "kyc" },
    { k: "nameTh", en: "Name (Thai)", th: "ชื่อ (ไทย)", t: "text", req: true, ro: true, src: "dbd", why: "kyc", wide: true }, { k: "nameEn", en: "Name (English)", th: "ชื่อ (อังกฤษ)", t: "text", req: true, src: "dbd", why: "kyc", wide: true },
    { k: "entity", en: "Type", th: "ประเภทนิติบุคคล", t: "select", o: ENTITY, req: true, re: true, src: "dbd", why: "kyc" }, { k: "regDate", en: "Registered", th: "วันจดทะเบียน", t: "date", req: true, ro: true, src: "dbd", why: "kyc" },
    { k: "capital", en: "Registered capital", th: "ทุนจดทะเบียน", t: "money", req: true, src: "dbd", why: "kyc" }, { k: "paidUp", en: "Paid-up capital", th: "ทุนชำระแล้ว", t: "money", req: true, src: "dbd", why: "kyc", check: (v, f) => (num(v) > num(f.capital) ? tt("More than the registered capital", "มากกว่าทุนจดทะเบียน") : "") },
    { k: "status", en: "DBD status", th: "สถานะที่กรมพัฒนาธุรกิจการค้า", t: "text", ro: true, src: "dbd", why: "kyc" }] },
  { s: "company", en: "Business", th: "การประกอบธุรกิจ", fields: [
    { k: "industry", en: "Industry", th: "ประเภทธุรกิจ", t: "select", o: IND_INDUSTRY, req: true, re: true, src: "customer", why: "aml" }, { k: "tsic", en: "TSIC code", th: "รหัส TSIC", t: "text", req: true, src: "dbd", why: "aml" },
    { k: "describe", en: "What the business does", th: "ลักษณะธุรกิจ", t: "area", req: true, src: "customer", why: "aml", wide: true },
    { k: "employees", en: "Employees", th: "จำนวนพนักงาน", t: "select", req: true, o: O(["e1", "Under 10", "ต่ำกว่า 10"], ["e2", "10 to 50", "10 ถึง 50"], ["e3", "51 to 200", "51 ถึง 200"], ["e4", "Over 200", "เกิน 200"]), src: "customer", why: "kyc" },
    { k: "revenue", en: "Revenue last year", th: "รายได้ปีล่าสุด", t: "select", o: BANDS_BIZ, req: true, src: "customer", why: "aml" }, { k: "vat", en: "VAT registered", th: "จดทะเบียนภาษีมูลค่าเพิ่ม", t: "select", o: YN, req: true, re: true, src: "customer", why: "tax" },
    { k: "listed", en: "Listed on a stock exchange", th: "จดทะเบียนในตลาดหลักทรัพย์", t: "select", o: YN, req: true, src: "customer", why: "kyc" }] },
  { s: "company", en: "Addresses and contact", th: "ที่อยู่และการติดต่อ", fields: [
    { k: "regAddr", en: "Registered office", th: "ที่ตั้งสำนักงานใหญ่", t: "text", req: true, ro: true, src: "dbd", why: "kyc", wide: true },
    { k: "opSame", en: "Operates from the registered office", th: "ประกอบการที่สำนักงานใหญ่", t: "check", re: true, src: "customer", why: "kyc", wide: true },
    { k: "opAddr", en: "Where it operates", th: "สถานที่ประกอบการ", t: "text", req: true, when: (f) => !f.opSame, src: "customer", why: "kyc", wide: true },
    { k: "visit", en: "Premises visited by the RM", th: "RM ไปเยี่ยมสถานประกอบการแล้ว", t: "select", o: O(["yes", "Yes", "ใช่"], ["photos", "Photos and map check only", "ตรวจรูปถ่ายและแผนที่เท่านั้น"], ["no", "No", "ไม่"]), req: true, src: "staff", why: "aml" },
    { k: "phone", en: "Office phone", th: "โทรศัพท์สำนักงาน", t: "tel", req: true, src: "customer", why: "ops" }, { k: "email", en: "Email", th: "อีเมล", t: "email", req: true, src: "customer", why: "ops" }, { k: "website", en: "Website", th: "เว็บไซต์", t: "text", src: "customer", why: "aml" }] },
  { s: "documents", en: "Received", th: "เอกสารที่ได้รับ", sub: ["Each is checked against the DBD record; certified copies signed by an authorised director, with the company seal if the affidavit requires one.", "ตรวจกับข้อมูลกรมพัฒนาธุรกิจการค้า สำเนารับรองโดยกรรมการผู้มีอำนาจ ประทับตราหากหนังสือรับรองกำหนด"], fields: [
    { k: "affDate", en: "Company affidavit dated", th: "วันที่ของหนังสือรับรองบริษัท", t: "date", req: true, src: "dbd", why: "kyc", check: (v) => (daysAgo(v) > 90 ? tt("Older than 3 months: ask for a new one", "เกิน 3 เดือน: ขอฉบับใหม่") : "") },
    { k: "docMoa", en: "Memorandum and articles", th: "หนังสือบริคณห์สนธิและข้อบังคับ", t: "check", req: (f) => f.entity !== "rp" && f.entity !== "lp", src: "staff", why: "kyc" },
    { k: "docShare", en: "Shareholder list (BOJ.5), under 3 months", th: "บัญชีรายชื่อผู้ถือหุ้น (บอจ.5) อายุไม่เกิน 3 เดือน", t: "check", req: (f) => ["co", "pcl"].includes(f.entity), src: "staff", why: "kyc" },
    { k: "docResolution", en: "Board resolution to open the accounts, naming the signatories", th: "มติกรรมการให้เปิดบัญชีและระบุผู้มีอำนาจลงนาม", t: "check", req: true, src: "staff", why: "contract" },
    { k: "docVat", en: "VAT certificate (Por Por 20)", th: "ภ.พ.20", t: "check", req: true, when: (f) => f.vat === "yes", src: "staff", why: "tax" },
    { k: "docAccounts", en: "Latest financial statements", th: "งบการเงินล่าสุด", t: "check", req: (f) => ["co", "pcl"].includes(f.entity), src: "staff", why: "aml" },
    { k: "docUboIds", en: "Identity documents for every beneficial owner", th: "เอกสารแสดงตนของผู้รับผลประโยชน์ที่แท้จริงทุกคน", t: "check", req: true, src: "staff", why: "kyc" },
    { k: "seal", en: "The affidavit requires the company seal", th: "หนังสือรับรองกำหนดให้ประทับตรา", t: "select", o: YN, req: true, src: "dbd", why: "contract" }] },
  dirSec(1), dirSec(2), { s: "people", en: "More directors", th: "กรรมการเพิ่มเติม", fields: [{ k: "dir3On", en: "Add a third director", th: "เพิ่มกรรมการคนที่สาม", t: "check", re: true, src: "customer", why: "kyc", wide: true }] }, dirSec(3),
  shSec(1), shSec(2), shSec(3), { s: "owners", en: "Ownership checks", th: "การตรวจโครงสร้างการถือหุ้น", fields: [
    { k: "nominee", en: "Any shareholder holds for someone else (nominee)", th: "มีผู้ถือหุ้นแทนบุคคลอื่น (นอมินี)", t: "select", o: YN, req: true, re: true, src: "customer", why: "aml" },
    { k: "layers", en: "Layers of companies to reach the owners", th: "จำนวนชั้นนิติบุคคลถึงผู้ถือหุ้นจริง", t: "num", req: true, src: "staff", why: "aml" }] },
  uboSec(1), { s: "owners", en: "More beneficial owners", th: "ผู้รับผลประโยชน์เพิ่มเติม", fields: [{ k: "ubo2On", en: "Add a second beneficial owner", th: "เพิ่มผู้รับผลประโยชน์รายที่สอง", t: "check", re: true, src: "customer", why: "kyc", wide: true }] }, uboSec(2),
  { s: "activity", en: "Money in and out", th: "เงินเข้าและออก", sub: ["The expected profile for monitoring.", "พฤติกรรมที่คาดหมายสำหรับการติดตามธุรกรรม"], fields: [
    { k: "inMonth", en: "Money in each month", th: "เงินเข้าต่อเดือน", t: "select", o: BANDS_BIZ, req: true, src: "customer", why: "aml" }, { k: "outMonth", en: "Money out each month", th: "เงินออกต่อเดือน", t: "select", o: BANDS_BIZ, req: true, src: "customer", why: "aml" },
    { k: "cashIn", en: "Cash deposits each month", th: "เงินสดฝากต่อเดือน", t: "select", req: true, re: true, o: O(["none", "None", "ไม่มี"], ["small", "Under ฿500,000", "ต่ำกว่า ฿500,000"], ["large", "฿500,000 or more", "฿500,000 ขึ้นไป"]), src: "customer", why: "aml" },
    { k: "intl", en: "Cross-border payments", th: "ธุรกรรมข้ามประเทศ", t: "select", o: YN, req: true, re: true, src: "customer", why: "aml" },
    { k: "intlCountries", en: "Main countries", th: "ประเทศหลัก", t: "text", req: true, when: (f) => f.intl === "yes", src: "customer", why: "aml", hint: ["Checked against FATF and sanctions lists", "ตรวจกับรายชื่อของ FATF และรายชื่อคว่ำบาตร"] },
    { k: "customers", en: "Main customers", th: "ลูกค้าหลัก", t: "text", req: true, src: "customer", why: "aml", wide: true }, { k: "suppliers", en: "Main suppliers", th: "ผู้ขายหลัก", t: "text", req: true, src: "customer", why: "aml", wide: true },
    { k: "otherBanks", en: "Accounts at other banks", th: "บัญชีที่ธนาคารอื่น", t: "select", o: BANKS, src: "customer", why: "aml" }] },
  { s: "activity", en: "First deposit", th: "เงินฝากครั้งแรก", fields: [
    { k: "initAmount", en: "Amount", th: "จำนวนเงิน", t: "money", req: true, src: "customer", why: "aml" }, { k: "initSource", en: "Comes from", th: "ที่มาของเงิน", t: "select", req: true, o: O(["trading", "Trading income", "รายได้จากการค้า"], ["capital", "Shareholders' capital", "ทุนจากผู้ถือหุ้น"], ["loan", "A loan", "เงินกู้"], ["other", "Other", "อื่น ๆ"]), src: "customer", why: "aml" }] },
  { s: "dd", en: "Tax classification", th: "การจัดประเภททางภาษี", fields: [
    { k: "fatcaClass", en: "FATCA and CRS classification", th: "การจัดประเภทตาม FATCA และ CRS", t: "select", req: true, re: true, o: O(["active", "Active non-financial entity", "นิติบุคคลที่ไม่ใช่สถาบันการเงิน ประเภทดำเนินธุรกิจ"], ["passive", "Passive non-financial entity", "นิติบุคคลที่ไม่ใช่สถาบันการเงิน ประเภทไม่ดำเนินธุรกิจ"], ["ffi", "Financial institution", "สถาบันการเงิน"]), src: "customer", why: "fatca", hint: ["Passive: more than half its income is passive (interest, dividends, rent)", "ไม่ดำเนินธุรกิจ: รายได้มากกว่าครึ่งเป็นรายได้จากการลงทุน"] },
    { k: "giin", en: "GIIN", th: "GIIN", t: "text", req: true, when: (f) => f.fatcaClass === "ffi", src: "customer", why: "fatca" },
    { k: "ctrlTax", en: "Controlling persons' tax residences", th: "ถิ่นที่อยู่ทางภาษีของผู้มีอำนาจควบคุม", t: "text", req: true, when: (f) => f.fatcaClass === "passive", src: "customer", why: "fatca", wide: true }] },
  { s: "dd", en: "Screening and risk indicators", th: "การตรวจรายชื่อและสัญญาณความเสี่ยง", fields: [
    { k: "screening", en: "Sanctions and PEP screening of the company, directors and owners", th: "ผลตรวจรายชื่อคว่ำบาตรและ PEP ของนิติบุคคล กรรมการ และผู้ถือหุ้น", t: "select", req: true, re: true, o: O(["clear", "Clear", "ไม่พบ"], ["near", "Near match, to review", "ชื่อใกล้เคียง ต้องตรวจ"], ["cleared", "Near match reviewed and cleared", "ชื่อใกล้เคียง ตรวจแล้ว"], ["hit", "Confirmed match", "ตรงกับรายชื่อ"]), src: "system", why: "aml", check: (v) => (v === "near" ? tt("Review the near match before opening", "ตรวจชื่อใกล้เคียงก่อนเปิดบัญชี") : v === "hit" ? tt("A confirmed match cannot be onboarded", "ไม่สามารถรับเป็นลูกค้าได้เมื่อตรงกับรายชื่อ") : "") },
    { k: "nearNote", en: "How the near match was cleared", th: "วิธีตรวจชื่อใกล้เคียง", t: "text", req: true, when: (f) => f.screening === "cleared", src: "staff", why: "aml", wide: true },
    { k: "adverse", en: "Adverse media found", th: "พบข่าวเชิงลบ", t: "select", o: YN, req: true, re: true, src: "system", why: "aml" },
    { k: "shell", en: "Signs of a shell company (no staff, no premises, mail-drop address)", th: "สัญญาณบริษัทเปลือก (ไม่มีพนักงาน ไม่มีสถานประกอบการ ใช้ที่อยู่รับจดหมาย)", t: "select", o: YN, req: true, re: true, src: "staff", why: "aml" },
    { k: "relatedBank", en: "Related to the bank's directors or executives", th: "เกี่ยวข้องกับกรรมการหรือผู้บริหารของธนาคาร", t: "select", o: YN, req: true, src: "customer", why: "related" }] },
  { s: "services", en: "Accounts", th: "บัญชี", fields: [
    { k: "current", en: "Business current account (THB)", th: "บัญชีกระแสรายวันธุรกิจ (บาท)", t: "select", o: YN, req: true, re: true, src: "customer", why: "contract" }, { k: "cheque", en: "Cheque book", th: "สมุดเช็ค", t: "select", o: YN, req: true, when: (f) => f.current === "yes", src: "customer", why: "ops" },
    { k: "savings", en: "Business savings account", th: "บัญชีออมทรัพย์ธุรกิจ", t: "select", o: YN, req: true, src: "customer", why: "contract" },
    { k: "fcd", en: "Foreign currency deposit", th: "บัญชีเงินฝากเงินตราต่างประเทศ", t: "select", req: true, o: O(["none", "None", "ไม่มี"], ["USD", "USD", "USD"], ["EUR", "EUR", "EUR"], ["CNY", "CNY", "CNY"]), src: "customer", why: "contract" }] },
  { s: "services", en: "Corporate internet banking", th: "อินเทอร์เน็ตแบงก์กิ้งสำหรับนิติบุคคล", fields: [
    { k: "ib", en: "Corporate internet banking", th: "อินเทอร์เน็ตแบงก์กิ้งนิติบุคคล", t: "select", o: YN, req: true, re: true, src: "customer", why: "ops" },
    { k: "ibAdmin1", en: "Administrator 1", th: "ผู้ดูแลระบบคนที่ 1", t: "text", req: true, when: (f) => f.ib === "yes", src: "customer", why: "ops" }, { k: "ibAdmin2", en: "Administrator 2", th: "ผู้ดูแลระบบคนที่ 2", t: "text", req: true, when: (f) => f.ib === "yes", src: "customer", why: "ops", hint: ["Two administrators: neither can add users alone", "ผู้ดูแลสองคน: คนเดียวเพิ่มผู้ใช้ไม่ได้"], check: (v, f) => (v && v === f.ibAdmin1 ? tt("Must be a different person", "ต้องเป็นคนละคน") : "") },
    { k: "ibUsers", en: "Other users", th: "ผู้ใช้อื่น", t: "num", req: true, when: (f) => f.ib === "yes", src: "customer", why: "ops" }, { k: "ibLimit", en: "Daily transfer limit", th: "วงเงินโอนต่อวัน", t: "money", req: true, when: (f) => f.ib === "yes", src: "customer", why: "ops" },
    { k: "payroll", en: "Payroll service", th: "บริการจ่ายเงินเดือน", t: "select", o: YN, req: true, src: "customer", why: "ops" }, { k: "stmt", en: "Statements", th: "รายการเดินบัญชี", t: "select", req: true, o: O(["monthly", "Monthly PDF", "PDF รายเดือน"], ["daily", "Daily file for accounting software", "ไฟล์รายวันสำหรับโปรแกรมบัญชี"]), src: "customer", why: "ops" }] },
  { s: "mandate", en: "Who may sign", th: "ผู้มีอำนาจลงนาม", sub: ["From the board resolution and the affidavit; the console enforces it on every channel.", "ตามมติกรรมการและหนังสือรับรอง คอนโซลบังคับใช้ทุกช่องทาง"], fields: [
    { k: "band1", en: "Up to", th: "ไม่เกิน", t: "money", req: true, src: "customer", why: "contract" },
    { k: "rule1", en: "Below that amount", th: "ต่ำกว่าวงเงินนี้", t: "select", req: true, o: O(["a1", "Any one group A signatory", "ผู้มีอำนาจกลุ่ม A คนใดคนหนึ่ง"], ["any1", "Any one signatory", "ผู้มีอำนาจคนใดคนหนึ่ง"], ["ab", "One from A with one from B", "A หนึ่งคนร่วมกับ B หนึ่งคน"]), src: "customer", why: "contract" },
    { k: "rule2", en: "Above that amount", th: "เกินวงเงินนี้", t: "select", req: true, o: O(["ab", "One from A with one from B", "A หนึ่งคนร่วมกับ B หนึ่งคน"], ["aa", "Two from group A", "กลุ่ม A สองคน"], ["all", "All signatories", "ผู้มีอำนาจทุกคน"]), src: "customer", why: "contract" },
    { k: "mandateSeal", en: "With the company seal", th: "ประทับตราบริษัท", t: "select", o: YN, req: true, src: "customer", why: "contract", check: (v, f) => (f.seal === "yes" && v === "no" ? tt("The affidavit requires the seal", "หนังสือรับรองกำหนดให้ประทับตรา") : "") }] },
  { s: "consents", en: "Declarations", th: "คำรับรอง", fields: [
    { k: "terms", en: "Business account terms and the fee schedule accepted", th: "ยอมรับเงื่อนไขบัญชีนิติบุคคลและตารางค่าธรรมเนียมแล้ว", t: "check", req: true, src: "customer", why: "conduct", wide: true },
    { k: "ownersTrue", en: "The ownership given is complete, and changes will be reported within 30 days", th: "ข้อมูลผู้ถือหุ้นครบถ้วน และจะแจ้งการเปลี่ยนแปลงภายใน 30 วัน", t: "check", req: true, src: "customer", why: "kyc", wide: true },
    { k: "pdpa", en: "Directors and owners were told how their personal data is used", th: "แจ้งกรรมการและผู้ถือหุ้นเรื่องการใช้ข้อมูลส่วนบุคคลแล้ว", t: "check", req: true, src: "staff", why: "pdpa", wide: true },
    { k: "certify", en: "Signed by the authorised directors, under the mandate above", th: "ลงนามโดยกรรมการผู้มีอำนาจตามเงื่อนไขข้างต้น", t: "check", req: true, src: "customer", why: "contract", wide: true }] },
];
const BIZ_DEFAULTS = () => ({ regNo: "0505562004416", nameTh: "บริษัท ลานนาคราฟท์ เอ็กซ์พอร์ต จำกัด", nameEn: "Lanna Craft Export Co., Ltd.", entity: "co", regDate: "2019-03-12", capital: "5000000", paidUp: "5000000", status: tt("Operating; no changes in the last 6 months", "ยังดำเนินกิจการ ไม่มีการเปลี่ยนแปลงใน 6 เดือน"),
  industry: "manufacturing", tsic: "16299", describe: "Designs and exports handmade furniture and woven textiles from workshops in San Kamphaeng.", employees: "e3", revenue: "m4", vat: "yes", listed: "no",
  regAddr: "88 Moo 4, San Kamphaeng, Chiang Mai 50130", opSame: true, opAddr: "", visit: "yes", phone: "053331447", email: "finance@lannacraft.example", website: "lannacraft.example",
  affDate: "2026-10-02", docMoa: true, docShare: true, docResolution: true, docVat: true, docAccounts: true, docUboIds: false, seal: "no",
  dir1Name: "Kanya Inthawong", dir1Id: "1509900123453", dir1Nat: "TH", dir1Role: "md", dir1Sign: "a", dir1Kyc: "ndid", dir2Name: "Somboon Kaewdee", dir2Id: "1009900456121", dir2Nat: "TH", dir2Role: "fd", dir2Sign: "b", dir2Kyc: "pending", dir3On: false, dir3Name: "", dir3Id: "", dir3Nat: "", dir3Role: "", dir3Sign: "", dir3Kyc: "",
  sh1Name: "Kanya Inthawong", sh1Type: "person", sh1Pct: "55", sh1Country: "TH", sh2Name: "Golden Bridge Holdings Ltd.", sh2Type: "company", sh2Pct: "40", sh2Country: "HK", sh3Name: "Three employees", sh3Type: "person", sh3Pct: "5", sh3Country: "TH", nominee: "no", layers: "1",
  ubo1Name: "Kanya Inthawong", ubo1Id: "1509900123453", ubo1Nat: "TH", ubo1Pct: "55", ubo1How: "Directly", ubo1Pep: "no", ubo1Wealth: "", ubo2On: true, ubo2Name: "Chan Wai Ming", ubo2Id: "K12345678 (Hong Kong)", ubo2Nat: "HK", ubo2Pct: "40", ubo2How: "Golden Bridge Holdings Ltd., 100%", ubo2Pep: "no", ubo2Wealth: "",
  inMonth: "m2", outMonth: "m2", cashIn: "none", intl: "yes", intlCountries: "United States, Germany, Hong Kong", customers: "Furniture importers in the US and Germany", suppliers: "Teak and textile workshops in Chiang Mai and Lamphun", otherBanks: "kbank", initAmount: "500000", initSource: "trading",
  fatcaClass: "active", giin: "", ctrlTax: "", screening: "near", nearNote: "", adverse: "no", shell: "no", relatedBank: "no",
  current: "yes", cheque: "yes", savings: "no", fcd: "USD", ib: "yes", ibAdmin1: "Kanya Inthawong", ibAdmin2: "Somboon Kaewdee", ibUsers: "2", ibLimit: "2000000", payroll: "yes", stmt: "daily",
  band1: "500000", rule1: "a1", rule2: "ab", mandateSeal: "no", terms: false, ownersTrue: false, pdpa: false, certify: false });
function bizFactors(f) {
  const out = [], ind = (p, en, th) => out.push([tt(en, th), p]);
  ind({ co: 1, pcl: 0, lp: 1, rp: 1, foundation: 3, branch: 2 }[f.entity] ?? 1, `Entity: ${(ENTITY.find((e) => e[0] === f.entity) || ["", "—"])[1]}`, `ประเภท: ${(ENTITY.find((e) => e[0] === f.entity) || ["", "", "—"])[2]}`);
  if ([f.sh1Country, f.sh2Country, f.sh3Country, f.ubo1Nat, f.ubo2On ? f.ubo2Nat : "TH"].some((c) => c && c !== "TH")) ind(2, "Foreign owner", "มีผู้ถือหุ้นต่างชาติ");
  if (f.intl === "yes") ind(/iran|korea|myanmar/i.test(f.intlCountries) ? 4 : 2, /iran|korea|myanmar/i.test(f.intlCountries) ? "Cross-border with a high-risk country" : "Cross-border payments", /iran|korea|myanmar/i.test(f.intlCountries) ? "ธุรกรรมข้ามประเทศกับประเทศความเสี่ยงสูง" : "ธุรกรรมข้ามประเทศ");
  if (HIGH_RISK_IND.includes(f.industry)) ind(3, "Higher-risk industry", "อุตสาหกรรมความเสี่ยงสูง");
  if (f.cashIn === "large") ind(2, "Large cash deposits", "ฝากเงินสดจำนวนมาก");
  if (f.ubo1Pep === "yes" || (f.ubo2On && f.ubo2Pep === "yes")) ind(4, "A beneficial owner is politically exposed", "ผู้รับผลประโยชน์เป็นบุคคลที่มีสถานภาพทางการเมือง");
  if (f.adverse === "yes") ind(3, "Adverse media", "ข่าวเชิงลบ");
  if (f.nominee === "yes") ind(4, "Nominee shareholders", "ผู้ถือหุ้นแทน (นอมินี)");
  if (f.shell === "yes") ind(4, "Shell-company signs", "สัญญาณบริษัทเปลือก");
  if (num(f.layers) >= 2) ind(2, "Ownership through several layers", "ถือหุ้นผ่านหลายชั้น");
  if (f.fatcaClass === "passive") ind(1, "Passive entity", "นิติบุคคลประเภทไม่ดำเนินธุรกิจ");
  if (f.regDate && daysAgo(f.regDate) < 365) ind(1, "Registered less than a year ago", "จดทะเบียนไม่ถึงหนึ่งปี");
  if (f.visit === "no") ind(1, "Premises not checked", "ยังไม่ตรวจสถานประกอบการ");
  return out;
}
const bizCross = (f) => { const e = [], tot = num(f.sh1Pct) + num(f.sh2Pct) + num(f.sh3Pct); if (Math.abs(tot - 100) > 0.01) e.push(tt(`Shareholdings add up to ${tot}%, not 100%`, `สัดส่วนผู้ถือหุ้นรวม ${tot}% ไม่ใช่ 100%`)); if (!f.ubo2On && num(f.sh2Pct) >= 25 && f.sh2Type === "company") e.push(tt("Shareholder 2 is a company with 25% or more: name the person behind it", "ผู้ถือหุ้นรายที่ 2 เป็นนิติบุคคลถือ 25% ขึ้นไป: ระบุบุคคลธรรมดาที่อยู่เบื้องหลัง")); return e; };

/* ---------------- the two forms ---------------- */
const routeFor = (who) => (r) => r.band[2] === "crit" ? { text: tt("High risk: enhanced due diligence, then compliance and a senior manager approve.", "ความเสี่ยงสูง: ตรวจสอบเข้มข้น แล้วให้ฝ่ายกำกับและผู้บริหารระดับสูงอนุมัติ"), button: tt("Send to compliance", "ส่งฝ่ายกำกับ"), pendingText: tt("With compliance for enhanced due diligence", "อยู่กับฝ่ายกำกับเพื่อตรวจสอบเข้มข้น") }
  : r.band[2] === "warn" ? { text: tt(`Medium risk: the ${who} approves; reviewed every 2 years.`, `ความเสี่ยงกลาง: ${who === "branch manager" ? "ผู้จัดการสาขา" : "หัวหน้าฝ่ายสินเชื่อธุรกิจ"}อนุมัติ ทบทวนทุก 2 ปี`), button: tt(`Send to the ${who}`, `ส่งให้${who === "branch manager" ? "ผู้จัดการสาขา" : "หัวหน้าฝ่าย"}`), pendingText: tt(`With the ${who}`, `อยู่กับ${who === "branch manager" ? "ผู้จัดการสาขา" : "หัวหน้าฝ่าย"}`), approve: true }
  : { text: tt("Low risk: opens now, checked by a second person within the day; reviewed every 3 years.", "ความเสี่ยงต่ำ: เปิดบัญชีได้ทันที บุคคลที่สองตรวจภายในวัน ทบทวนทุก 3 ปี"), button: tt("Open the account", "เปิดบัญชี") };
OBF.ind = { id: "ind", sys: "customers", back: "customers/onboarding", backLabel: "Onboarding", steps: IND_STEPS, cat: IND_CAT, defaults: IND_DEFAULTS, st: { f: IND_DEFAULTS(), checked: false, state: null }, factors: indFactors, route: routeFor("branch manager"),
  title: () => tt(`New customer: ${OBF.ind.st.f.firstEn} ${OBF.ind.st.f.lastEn}`.trim(), `ลูกค้าใหม่: ${OBF.ind.st.f.firstTh || OBF.ind.st.f.firstEn} ${OBF.ind.st.f.lastTh || OBF.ind.st.f.lastEn}`), sub: () => tt("Branch 0123, counter 3 · started 09:31", "สาขา 0123 ช่อง 3 · เริ่ม 09:31"),
  openedText: () => tt("Opened: SAV-77310", "เปิดบัญชีแล้ว: SAV-77310"), openedSub: () => { const f = OBF.ind.st.f; return [f.card !== "none" ? tt("debit card printed", "พิมพ์บัตรเดบิตแล้ว") : "", f.promptpay !== "none" ? tt("PromptPay linked", "ผูกพร้อมเพย์แล้ว") : "", f.app === "yes" ? tt("app enrolment sent by SMS", "ส่งลิงก์ลงทะเบียนแอปทาง SMS") : ""].filter(Boolean).join(" · "); } };
OBF.biz = { id: "biz", sys: "deposits", back: "deposits/opening", backLabel: "Account opening", steps: BIZ_STEPS, cat: BIZ_CAT, defaults: BIZ_DEFAULTS, st: { f: BIZ_DEFAULTS(), checked: false, state: null }, factors: bizFactors, route: routeFor("head of business banking"), crossChecks: bizCross,
  title: () => tt(OBF.biz.st.f.nameEn, OBF.biz.st.f.nameTh), sub: () => tt("Business account opening · RM Pakorn T., Chiang Mai branch · started 22 Oct", "เปิดบัญชีนิติบุคคล · RM ปกรณ์ ท. สาขาเชียงใหม่ · เริ่ม 22 ต.ค."),
  openedText: () => tt("Opened: CUR-B4471 and FCD-B4471", "เปิดบัญชีแล้ว: CUR-B4471 และ FCD-B4471"), openedSub: () => tt("Signing mandate and internet banking users set up; first KYC review in 2028.", "ตั้งเงื่อนไขการลงนามและผู้ใช้อินเทอร์เน็ตแบงก์กิ้งแล้ว ทบทวน KYC ครั้งแรกปี 2571") };
for (const F of Object.values(OBF)) for (const sec of F.cat) for (const x of sec.fields) if (typeof x.ro === "function") { const ro = x.ro; Object.defineProperty(x, "ro", { get: () => ro(F.st.f) }); }

Object.assign(FLOWS, {
  obOpen: (id) => { const F = OBF[id]; return { title: F.route(obRisk(F)).button, sub: `${id === "ind" ? "ONB-7731" : "AO-26-0412"} · ${F.title()}`, init: {}, fields: () => `<p class="muted">${esc(tt("Checks every answer, then opens or routes the application by its risk.", "ตรวจทุกคำตอบ แล้วเปิดบัญชีหรือส่งพิจารณาตามระดับความเสี่ยง"))}</p>`, read: () => "",
    review: (d) => { F.st.checked = true; const gaps = F.steps.flatMap(([s]) => (s === "review" ? [] : obMissing(F, s))), extra = F.crossChecks ? F.crossChecks(F.st.f) : [], r = obRisk(F), rt = F.route(r);
      if (gaps.length || extra.length) return { html: notice("crit", tt(`${gaps.length + extra.length} things to fix`, `ต้องแก้ไข ${gaps.length + extra.length} รายการ`), [...gaps.slice(0, 6).map((g) => tt(g.x.en, g.x.th)), ...extra].join(" · ")) + `<p class="consequence">${esc(tt("Close this and use Fix on the review step.", "ปิดหน้าต่างนี้แล้วกดแก้ไขในขั้นตรวจทาน"))}</p>`, blocked: true };
      d.r = r; return { html: quoteRows([[tt("Customer risk", "ความเสี่ยงของลูกค้า"), `${tt(r.band[0], r.band[1])} · ${r.score}`]]) + `<p class="consequence">${esc(rt.text)}</p>`, confirm: rt.button }; },
    done: (d) => { if (!F.st.state) { F.st.state = d.r.band[2] === "good" ? "opened" : "routed"; setTimeout(render, 0); } return F.st.state === "opened" ? F.openedText() : F.route(d.r).pendingText; } }; },
});
document.addEventListener("input", (e) => { const id = e.target.dataset && e.target.dataset.of; if (!id) return; const F = OBF[id], k = e.target.dataset.ok, x = F.cat.flatMap((s) => s.fields).find((y) => y.k === k);
  F.st.f[k] = e.target.type === "checkbox" ? e.target.checked : e.target.value; if (F.st.state) F.st.state = null;
  if (x && (x.re || e.target.type === "checkbox" || e.target.tagName === "SELECT")) { const fid = e.target.id; render(); document.getElementById(fid)?.focus(); } else { const s = $(`#obSum-${id}`); if (s) s.innerHTML = obSummary(F); } });
document.addEventListener("click", (e) => { const el = e.target.closest("[data-ofix], [data-obreset]"); if (!el) return;
  if (el.dataset.obreset) { const F = OBF[el.dataset.obreset]; F.st = { f: F.defaults(), checked: false, state: null }; current.tab = F.steps[0][0]; render(); return; }
  const [id, s, k] = el.dataset.ofix.split("|"); current.tab = s; render(); const fe = document.getElementById(`of-${id}-${k}`); if (fe) { fe.focus(); fe.scrollIntoView({ block: "center" }); } });

Object.assign(RECS, {
  "ONB-7731": { sys: "customers", sec: "onboarding", label: "ONB-7731", kind: "Onboarding", match: ["ONB-7731"], view: () => obView("ind"), tabs: IND_STEPS.map(([k, en]) => [k, en]) },
  "AO-26-0412": { sys: "deposits", sec: "opening", label: "AO-26-0412", kind: "Account opening", match: ["AO-26-0412"], view: () => obView("biz"), tabs: BIZ_STEPS.map(([k, en]) => [k, en]) },
});
Object.assign(TH, { "Identity": "ยืนยันตัวตน", "Personal details": "ข้อมูลส่วนตัว", "Contact and address": "การติดต่อและที่อยู่", "Occupation and income": "อาชีพและรายได้", "Due diligence": "การตรวจสอบลูกค้า", "Accounts and services": "บัญชีและบริการ", "Consents": "ความยินยอม", "Review and open": "ตรวจทานและเปิดบัญชี",
  "Company": "นิติบุคคล", "Directors and signatories": "กรรมการและผู้มีอำนาจลงนาม", "Owners": "ผู้ถือหุ้นและผู้รับผลประโยชน์", "Expected activity": "ธุรกรรมที่คาดหมาย", "Signing mandate": "เงื่อนไขการลงนาม", "Declarations": "คำรับรอง" });

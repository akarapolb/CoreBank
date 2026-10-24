// Fabor console prototype · Charts and the shared views: overview, list, Workbench, approvals, Customer 360.
// Classic scripts sharing one global scope; load order is set in index.html.
/* ---------------- charts ---------------- */
const uid = () => "g" + Math.random().toString(36).slice(2, 8);
function spark(values) {
  const w = 160, h = 34, min = Math.min(...values), max = Math.max(...values), span = max - min || 1, id = uid();
  const line = values.map((v, i) => (i ? "L" : "M") + (i * (w / (values.length - 1))).toFixed(1) + " " + (h - 3 - ((v - min) / span) * (h - 6)).toFixed(1)).join(" ");
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--accent);stop-opacity:.2"/><stop offset="1" style="stop-color:var(--accent);stop-opacity:0"/></linearGradient></defs><path d="${line} L${w} ${h} L0 ${h} Z" fill="url(#${id})"/><path d="${line}" style="fill:none;stroke:var(--accent);stroke-width:1.6" vector-effect="non-scaling-stroke"/></svg>`;
}
function niceTicks(min, max, count = 4) {
  const span = max - min || 1, step0 = span / count, mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= step0);
  const ticks = []; for (let v = Math.floor(min / step) * step; v <= Math.ceil(max / step) * step + step / 2; v += step) ticks.push(+v.toFixed(6));
  return ticks;
}
function areaChart(values, compare, fmt) {
  const W = 640, H = 220, L = 46, Rp = 14, T = 12, B = 26;
  const ticks = niceTicks(Math.min(...values, ...compare), Math.max(...values, ...compare)), y0 = ticks[0], y1 = ticks[ticks.length - 1];
  const x = (i, n) => L + (i * (W - L - Rp)) / (n - 1), y = (v) => T + (H - T - B) * (1 - (v - y0) / (y1 - y0 || 1));
  const path = (vs) => vs.map((v, i) => (i ? "L" : "M") + x(i, vs.length).toFixed(1) + " " + y(v).toFixed(1)).join(" ");
  const n = values.length, dayOf = (i) => BIZ - (n - 1 - i) * 864e5, days = [0, 1, 2, 3, 4].map((k) => dayOf(Math.round((k * (n - 1)) / 4))), id = uid(), last = values[n - 1];
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Last 30 days, ending at ${esc(fmt(last))}"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--accent);stop-opacity:.22"/><stop offset="1" style="stop-color:var(--accent);stop-opacity:0"/></linearGradient></defs>`;
  ticks.forEach((tk) => { s += `<line class="gl" x1="${L}" x2="${W - Rp}" y1="${y(tk).toFixed(1)}" y2="${y(tk).toFixed(1)}"/><text x="${L - 8}" y="${(y(tk) + 3.5).toFixed(1)}" text-anchor="end">${esc(fmt(tk))}</text>`; });
  days.forEach((d, i) => { s += `<text x="${(L + (i * (W - L - Rp)) / (days.length - 1)).toFixed(1)}" y="${H - 6}" text-anchor="${i === 0 ? "start" : i === days.length - 1 ? "end" : "middle"}">${esc(fdShort(d))}</text>`; });
  s += `<path class="line2" d="${path(compare)}"/><path d="${path(values)} L${x(values.length - 1, values.length).toFixed(1)} ${y(y0).toFixed(1)} L${L} ${y(y0).toFixed(1)} Z" fill="url(#${id})"/><path d="${path(values)}" style="fill:none;stroke:var(--accent);stroke-width:2"/>`;
  s += `<circle cx="${x(values.length - 1, values.length).toFixed(1)}" cy="${y(last).toFixed(1)}" r="4.5" style="fill:var(--surface);stroke:var(--accent);stroke-width:2.5"/></svg>`;
  const tips = values.map((v, i) => [fdShort(dayOf(i)), fmt(v), fmt(compare[i])]);
  return `<div class="chart-wrap" data-tips='${esc(JSON.stringify(tips)).replace(/'/g, "&#39;")}'>${s}</div>`;
}

const NUMERIC = /Balance|Amount|Outstanding|Overdue|Principal|Net investment|Due now|Promised|Exposure|Allowance|Debit|Credit|^Net$|Commitment|Paid this month|Invoice|Position|MTM|Limit|Days late|Items|Difference|Instalment|Interest/;
function table(spec, label, bulk) {
  const plain = (h) => String(h).replace(/<[^>]+>/g, "").trim();
  return `<div class="table-wrap"><table><caption class="sr">${esc(label)}</caption><thead><tr>${bulk ? `<th class="pick" scope="col"><input type="checkbox" data-pickall aria-label="${esc(tt("Select all rows", "เลือกทุกแถว"))}"></th>` : ""}${spec.cols.map((c) => `<th class="${NUMERIC.test(c) ? "r" : ""}" scope="col">${esc(t(c))}</th>`).join("")}</tr></thead><tbody>${spec.rows.map((r, ri) => {
    const html = r.join(""), hit = recOf(html);
    return `<tr class="click" tabindex="0" data-row="${ri}"${hit ? ` data-rec="${hit.id}"` : ""}>${bulk ? `<td class="pick"><input type="checkbox" data-pick="${esc(plain(r[0]))}" aria-label="${esc(tt("Select", "เลือก"))} ${esc(plain(r[0]))}"></td>` : ""}${r.map((v, i) => {
      let cell = /[<>]/.test(v) ? v : esc(loc(v));
      if (hit) cell = cell.replace(`class="rec">${esc(hit.m)}<`, `class="rec link">${esc(hit.m)}<`);
      return `<td class="${NUMERIC.test(spec.cols[i]) ? "r num" : ""}">${cell}</td>`;
    }).join("")}</tr>`;
  }).join("")}<tr class="empty-row" hidden><td colspan="${spec.cols.length + (bulk ? 1 : 0)}"><div class="state"><strong>${esc(tt("Nothing matches this filter", "ไม่มีรายการตรงกับตัวกรอง"))}</strong><button class="btn row-btn" type="button" data-action="clear-filter">${esc(tt("Clear filter", "ล้างตัวกรอง"))}</button></div></td></tr></tbody></table></div>`;
}

/* ---------------- views ---------------- */
const newLabel = (s) => t(({ customers: "Onboard customer", deposits: "Open account", lending: "New application", leasing: "Book a lease", collections: "Assign queue", payments: "New transfer", trade: "Issue LC", treasury: "New deal", syndication: "New deal", products: "New product", finance: "Run allowance", ops: "Run backfill", agents: "New policy" })[s.id] || "New");
const newBtn = (s) => `<button class="btn primary" type="button" ${({ customers: 'data-go="rec:ONB-7731"', deposits: 'data-go="rec:ONB-7731"', treasury: 'data-flow="fxDeal"', products: 'data-go="rec:TPL-HP-VEHICLE"', collections: 'data-go="collections/queue"' })[s.id] || ""}>${icon("i-plus")}${esc(newLabel(s))}</button>`;
const eyebrow = (s, extra) => `<div class="eyebrow">${icon(s.icon)}${esc(t(s.name))}${extra ? " · " + esc(extra) : ""}</div>`;

function viewOverview(s) {
  const o = OVERVIEW[s.id], L_ = lists();
  const values = series(o.chart[2] * 7, chartDays, o.chart[3] - o.chart[4] * (chartDays - 30), o.chart[4], o.chart[5]);
  const compare = series(o.chart[2] * 13, chartDays, (o.chart[3] - o.chart[4] * (chartDays - 30)) * 0.94, o.chart[4] * 0.5, o.chart[5] * 0.5);
  const period = `<div class="seg" role="group" aria-label="${esc(tt("Period", "ช่วงเวลา"))}">${[7, 30, 90].map((d) => `<button type="button" data-action="period" data-days="${d}" aria-pressed="${d === chartDays}">${d}${tt("d", " วัน")}</button>`).join("")}</div>`;
  const fmt = (v) => (v >= 1000 ? Math.round(v).toLocaleString("en-US") : v >= 100 ? String(Math.round(v)) : v.toFixed(1));
  const firstList = s.sections.find(([k]) => L_[s.id + "/" + k]);
  const lede = lang === "th" ? `${t(s.desc)} ข้อมูลสดจากบัญชีแยกประเภท ไม่ต้องรอปิดงวด` : `${s.desc}. Live from the ledger, without a batch window.`;
  return `
    <div class="head"><div>${eyebrow(s)}<h1 class="title">${esc(t("Overview"))}</h1><p class="lede">${esc(lede)}</p></div>
      <div class="actions"><button class="btn" type="button">${icon("i-arrow")}${esc(t("Export"))}</button>${newBtn(s)}</div></div>
    <section class="kpis" aria-label="${esc(t("Key figures"))}">${o.kpis.map(([l, v, d, tone, seed]) => `<div class="card kpi"><div class="label"><span>${esc(t(l))}</span>${d ? `<span class="delta ${tone}">${esc(d)}</span>` : ""}</div><div class="value">${l === "Postings today" ? `<span data-live="postings">${postings.toLocaleString("en-US")}</span>` : esc(v)}</div>${spark(series(seed, 24, 50, tone === "flat" ? 0.1 : 0.5, 10))}</div>`).join("")}</section>
    <div class="grid-main">
      <section class="card" aria-label="${esc(t(o.chart[0]))}"><div class="card-head"><div><div class="card-title">${esc(t(o.chart[0]))}</div><div class="card-sub">${esc(t(o.chart[1]))}</div></div><div class="legend"><span><i></i>${esc(t("This period"))}</span><span><i class="alt"></i>${esc(t("Same period last year"))}</span></div>${period}</div><div class="card-body">${areaChart(values, compare, fmt)}</div></section>
      <section class="card" aria-label="${esc(t(o.side[0]))}"><div class="card-head"><div class="card-title">${esc(t(o.side[0]))}</div></div><div class="card-body"><div class="bars">${o.side[1].map(([n, p, tone]) => `<div class="bar-row"><span>${esc(t(n))}</span><span class="num muted">${p}%</span><div class="bar"><span class="${tone}" style="width:${p}%"></span></div></div>`).join("")}</div></div></section>
    </div>
    ${firstList ? `<section class="card" aria-label="${esc(t(firstList[1]))}"><div class="card-head"><div><div class="card-title">${esc(t(firstList[1]))}</div><div class="card-sub">${esc(t("The records that need someone today"))}</div></div><button class="btn" type="button" data-go="${s.id}/${firstList[0]}">${esc(t("See all"))} ${icon("i-arrow")}</button></div><div class="card-body flush">${table(L_[s.id + "/" + firstList[0]], t(firstList[1]))}</div></section>` : ""}`;
}

// the first visit to a list shows a loading state; one list fails until retried, to show the error state
const seenLists = new Set(), listError = { "trade/docs": true };
function viewList(s, key, label) {
  const spec = lists()[s.id + "/" + key], full = s.id + "/" + key;
  if (!spec) return viewPlaceholder(s, label);
  const headHtml = `<div class="head"><div>${eyebrow(s)}<h1 class="title">${esc(label)}</h1></div><div class="actions">${newBtn(s)}</div></div>`;
  if (listError[full]) return headHtml + `<section class="card"><div class="card-body"><div class="state"><span class="sev crit">${icon("i-alert")}</span><strong>${esc(tt("This list could not be loaded", "โหลดรายการนี้ไม่ได้"))}</strong><p>${esc(tt("The SWIFT gateway did not answer within 10 seconds. Nothing was changed; the rest of the console works.", "เกตเวย์ SWIFT ไม่ตอบภายใน 10 วินาที ไม่มีอะไรเปลี่ยนแปลง ส่วนอื่นของคอนโซลใช้งานได้ตามปกติ"))}</p><button class="btn" type="button" data-action="retry" data-list="${full}">${esc(tt("Try again", "ลองอีกครั้ง"))}</button></div></div></section>`;
  if (!seenLists.has(full)) {
    setTimeout(() => { seenLists.add(full); if (current.sys + "/" + current.sec === full && !current.rec) render(); }, 450);
    return headHtml + `<section class="card" aria-busy="true" aria-label="${esc(tt("Loading", "กำลังโหลด"))}"><div class="toolbar"><span class="sk" style="width:220px;height:30px"></span></div><div class="card-body" style="display:grid;gap:16px">${Array.from({ length: Math.min(6, spec.rows.length + 1) }, (_, i) => `<span class="sk" style="width:${92 - i * 7}%"></span>`).join("")}</div></section>`;
  }
  const lastText = (cell) => (cell.match(/>([^<]+)<\/span>$/) || [])[1];
  const states = [...new Set(spec.rows.map((r) => lastText(r[r.length - 1])).filter(Boolean))];
  const lede = lang === "th" ? `แสดง ${spec.rows.length} รายการจากข้อมูลจริง คลิกแถวเพื่อดูรายละเอียด ทุกการทำรายการมีขั้นตอนตรวจทานก่อนเงินเคลื่อนไหว` : `${spec.rows.length} shown from the live book. Click a row for the record; actions open a review before anything moves.`;
  return `
    <div class="head"><div>${eyebrow(s)}<h1 class="title">${esc(label)}</h1><p class="lede">${esc(lede)}</p></div>
      <div class="actions"><button class="btn" type="button">${icon("i-arrow")}${esc(t("Export"))}</button>${newBtn(s)}</div></div>
    <section class="card" aria-label="${esc(label)}">
      <div class="toolbar"><label class="filter">${icon("i-search")}<span class="sr">${esc(t("Filter by id, name or amount"))}</span><input data-filter placeholder="${esc(t("Filter by id, name or amount"))}"></label>
        <div class="seg" role="group" aria-label="${esc(t("Show"))}"><button type="button" aria-pressed="true" data-state="">${esc(t("All"))}<span class="c">${spec.rows.length}</span></button>${states.slice(0, 4).map((st) => `<button type="button" aria-pressed="false" data-state="${esc(st)}">${esc(st)}<span class="c">${spec.rows.filter((r) => lastText(r[r.length - 1]) === st).length}</span></button>`).join("")}</div>
        <button class="btn row-btn" type="button" data-action="save-view" style="margin-left:auto">${icon("i-pin")}${esc(tt("Save view", "บันทึกมุมมอง"))}</button></div>
      ${full === "collections/queue" ? `<div class="keyhint"><span class="kbd">J</span> <span class="kbd">K</span> ${esc(tt("move", "เลื่อน"))} · <span class="kbd">Enter</span> ${esc(tt("open", "เปิด"))} · <span class="kbd">P</span> ${esc(tt("record promise", "บันทึกนัดชำระ"))} · <span class="kbd">L</span> ${esc(tt("log contact", "บันทึกการติดต่อ"))}</div>` : ""}
      ${table(spec, label, true)}
      <div class="bulkbar" hidden role="region" aria-label="${esc(tt("Selected rows", "แถวที่เลือก"))}"><b data-count></b>${s.id === "collections" ? `<button class="btn" type="button" data-bulk="remind">${esc(tt("Send reminder", "ส่งการแจ้งเตือน"))}</button><button class="btn" type="button" data-bulk="assign">${esc(tt("Assign", "มอบหมาย"))}</button>` : ""}<button class="btn" type="button" data-bulk="export">${esc(t("Export"))}</button><button class="btn" type="button" data-bulk="clear">${esc(tt("Clear", "ล้าง"))}</button></div>
    </section>`;
}

function viewPlaceholder(s, label) {
  return `<div class="head"><div>${eyebrow(s)}<h1 class="title">${esc(label)}</h1><p class="lede">This section follows the same list, detail and review patterns as the rest of ${esc(t(s.name))}.</p></div></div>
    <section class="card"><div class="card-body"><div class="list">
      <div class="li"><span class="sev info">${icon("i-layers")}</span><div><strong>List</strong><p>Search, filters with counts, saved views in the address.</p></div></div>
      <div class="li"><span class="sev info">${icon("i-arrow")}</span><div><strong>Detail</strong><p>One header with the facts that matter, tabs for each facet, links to related records in other systems. See LN-A-C10 under Lending, Loans.</p></div></div>
      <div class="li"><span class="sev good">${icon("i-check")}</span><div><strong>Actions</strong><p>Enter, review with the consequence in figures, confirm. Irreversible actions ask for the id to be typed.</p></div></div>
    </div></div></section>`;
}

function viewToday() {
  const opsNeeds = [["collections", "Overdue loans in your queue", "128", "crit", "Oldest 205 days · 31 promises due this week", "collections/queue"],
    ["workbench", "Approvals waiting for you", String(approvals().length), "warn", "2 from AI agents, checked against policy", "workbench/approvals"],
    ["leasing", "Sold out of trust suspected", "1", "crit", "Rama 9 Trucks · payoff overdue 4 days", "leasing/floorplan"],
    ["customers", "KYC reviews due", "4", "warn", "1 adverse media hit needs compliance", "customers/kyc"]];
  const needs = (role.needs || opsNeeds).filter((n) => has(n[0]));
  const day = [["05:00", "ITMX settlement file received", "1 break of ฿4,200.00, match proposed", "done"], ["06:00", "Sub-ledger to GL reconciliation", "฿0.00 difference", "done"],
    ["08:30", "Branches open", "412 teller drawers balanced", "done"], ["11:00", "Term deposit maturities", "312 deposits, ฿612.4m", "now"], ["14:00", "BAHTNET cut-off", "Corporate payouts above ฿2m", ""],
    ["16:30", "BOT liquidity report", "LCR 148%, auto-generated", ""], ["23:59", "Reporting cut", "Accrual keeps running per account", ""]].filter((d) => tenant.id !== "virtual" || d[1] !== "Branches open");
  const words = ["No", "One", "Two", "Three", "Four"];
  const lede = lang === "th" ? `วันนี้มี ${needs.length} เรื่องที่รอคุณ งานอื่นทั้ง${tenantName()} เป็นไปตามเวลา` : `${words[needs.length]} things need you today. Everything else at ${tenantName()} is running on time.`;
  const head = `
    <div class="head"><div>${eyebrow(sysById.workbench)}<h1 class="title">${esc(tt(`Good morning, ${role.first}`, `สวัสดีตอนเช้า คุณ${role.th}`))}</h1><p class="lede">${esc(lede)}</p></div>
      <div class="actions"><button class="btn" type="button" data-action="customize" aria-pressed="${editingWb}">${esc(editingWb ? tt("Done", "เสร็จ") : tt("Customise", "ปรับแต่ง"))}</button><button class="btn" type="button" data-action="switcher">${icon("i-grid")}${esc(t("Switch system"))} <span class="kbd">G</span></button><button class="btn primary" type="button" data-action="tour">${icon("i-spark")}${esc(tt("Take the tour", "เริ่มทัวร์"))}</button></div></div>`;
  const W = { needs: `<section class="needs" aria-label="Needs you">${needs.map(([sid, title, n, tone, p, go]) => `<button class="need" type="button" data-go="${go}"><span class="top-row"><span class="tile">${icon(sysById[sid].icon)}</span>${esc(t(sysById[sid].name))}</span><span class="big ${tone}">${n}</span><strong>${esc(t(title))}</strong><p>${esc(t(p))}</p><span class="go">${esc(t("Open"))} ${icon("i-arrow")}</span></button>`).join("")}</section>`, work: `<div class="grid-main">
      <section class="card" aria-label="${esc(t("Approvals waiting for you"))}"><div class="card-head"><div><div class="card-title">${esc(t("Approvals waiting for you"))}</div><div class="card-sub">${esc(t("Maker-checker across every system, oldest first"))}</div></div><button class="btn" type="button" data-go="workbench/approvals">${esc(t("All approvals"))} ${icon("i-arrow")}</button></div>
        <div class="card-body"><div class="list">${approvals().slice(0, 5).map(([sid, title, m, d, tone]) => `<div class="li"><span class="sev ${tone}">${icon(sysById[sid].icon)}</span><div><strong>${esc(t(title))}</strong><p>${esc(t(m))} · ${esc(t(d))}</p></div><span class="when">${esc(t(sysById[sid].name))}</span></div>`).join("")}</div></div></section>
      <section class="card" aria-label="${esc(t("The bank's day"))}"><div class="card-head"><div><div class="card-title">${esc(t("The bank's day"))}</div><div class="card-sub">${esc(t("Cut-offs and controls, Bangkok time"))}</div></div></div>
        <div class="card-body"><div class="timeline">${day.map(([tm, w, d, st]) => `<div class="tl ${st}"><span class="t">${tm}</span><span class="rail-dot"><i></i></span><div class="what"><strong>${esc(t(w))}</strong><span>${esc(t(d))}</span></div></div>`).join("")}</div></div></section>
    </div>`, stream: has("finance") ? `<section class="card" aria-label="${esc(tt("Live postings", "รายการบัญชีสด"))}"><div class="card-head"><div><div class="card-title"><span class="pulse" style="display:inline-block;margin-right:8px"></span>${esc(tt("Live postings", "รายการบัญชีสด"))}</div><div class="card-sub">${esc(tt("Every posting across the bank as it lands in the ledger", "ทุกรายการบัญชีของธนาคารทันทีที่บันทึก"))}</div></div><button class="btn" type="button" data-go="rec:GL-1300">GL 1300 ${icon("i-arrow")}</button></div><div class="card-body"><div class="list" id="stream">${streamHtml()}</div></div></section>` : "", kpis: `<section class="kpis" aria-label="${esc(t("Key figures"))}">${[["Deposits", "฿48.21bn", "+1.8%", "up", 21], ["Loans and leases", "฿41.60bn", "+2.7%", "up", 31], ["NPL ratio", "2.14%", "+0.07 pt", "down", 34], ["Postings today", "3,872,934", "Σ debit = Σ credit", "flat", 111]].map(([l, v, d, tone, seed]) => `<div class="card kpi"><div class="label"><span>${esc(t(l))}</span><span class="delta ${tone}">${esc(d)}</span></div><div class="value">${l === "Postings today" ? `<span data-live="postings">${postings.toLocaleString("en-US")}</span>` : esc(v)}</div>${spark(series(seed, 24, 50, tone === "flat" ? 0.1 : 0.5, 10))}</div>`).join("")}</section>` };
  return head + wbLayout(W);
}
// the Workbench is made of widgets people can reorder or hide
let editingWb = false;
const WB_NAMES = { needs: ["Needs you", "รอคุณ"], work: ["Approvals and the bank's day", "รออนุมัติและวันทำการ"], stream: ["Live postings", "รายการบัญชีสด"], kpis: ["Key figures", "ตัวเลขสำคัญ"] };
function wbState() { try { const s = JSON.parse(store.get(`fabor.wb.${role.id}`) || "null"); if (s && Array.isArray(s.order)) return s; } catch {} return { order: ["needs", "work", "stream", "kpis"], hidden: [] }; }
function wbLayout(W) {
  const st = wbState(), order = st.order.filter((k) => W[k]), shown = order.filter((k) => !st.hidden.includes(k));
  const tools = (k, i) => `<div class="widget-tools"><button class="btn" type="button" data-wb="up" data-key="${k}" ${i === 0 ? "disabled" : ""} aria-label="${esc(tt("Move up", "เลื่อนขึ้น"))}: ${esc(tt(...WB_NAMES[k]))}">↑</button><button class="btn" type="button" data-wb="down" data-key="${k}" ${i === shown.length - 1 ? "disabled" : ""} aria-label="${esc(tt("Move down", "เลื่อนลง"))}: ${esc(tt(...WB_NAMES[k]))}">↓</button><button class="btn" type="button" data-wb="hide" data-key="${k}">${esc(tt("Hide", "ซ่อน"))}</button></div>`;
  const hiddenBar = editingWb && st.hidden.length ? `<div class="note" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">${esc(tt("Hidden:", "ซ่อนอยู่:"))} ${st.hidden.filter((k) => W[k]).map((k) => `<button class="btn row-btn" type="button" data-wb="show" data-key="${k}">${icon("i-plus")}${esc(tt(...WB_NAMES[k]))}</button>`).join("")}<button class="btn row-btn" type="button" data-wb="reset" style="margin-left:auto">${esc(tt("Reset layout", "คืนค่าเริ่มต้น"))}</button></div>` : "";
  return `<div class="${editingWb ? "editing" : ""}" style="display:grid;gap:var(--gap)">${hiddenBar}${shown.map((k, i) => `<div class="widget">${tools(k, i)}${W[k]}</div>`).join("")}</div>`;
}
function wbAction(a, k) {
  const st = wbState(), visible = st.order.filter((x) => !st.hidden.includes(x)), i = visible.indexOf(k);
  if (a === "up" || a === "down") { const j = a === "up" ? i - 1 : i + 1; const other = visible[j]; if (other) { const oi = st.order.indexOf(k), oj = st.order.indexOf(other); [st.order[oi], st.order[oj]] = [st.order[oj], st.order[oi]]; } }
  if (a === "hide") st.hidden.push(k);
  if (a === "show") st.hidden = st.hidden.filter((x) => x !== k);
  store.set(`fabor.wb.${role.id}`, JSON.stringify(a === "reset" ? { order: ["needs", "work", "stream", "kpis"], hidden: [] } : st));
  render(); $(`[data-wb="${a}"][data-key="${k}"]`)?.focus();
}

function viewApprovals() {
  return `<div class="head"><div>${eyebrow(sysById.workbench)}<h1 class="title">${esc(t("Approvals"))}</h1><p class="lede">${esc(t("Everything waiting for a checker, from people and AI agents, in one inbox. Agents act through the same limits and approvals as people."))}</p></div></div>
    <section class="card" aria-label="${esc(t("Approvals"))}"><div class="table-wrap"><table><caption class="sr">${esc(t("Approvals"))}</caption><thead><tr>${["Request", "System", "Maker", "What it does", "Waiting"].map((c) => `<th scope="col">${esc(t(c))}</th>`).join("")}</tr></thead><tbody>
    ${approvals().map(([sid, title, m, d, tone, wait]) => `<tr class="click" tabindex="0" data-approval="${APPROVALS.findIndex((a) => a[1] === title)}"><td><span class="rec">${esc(t(title))}</span></td><td>${chip(sid)}</td><td>${esc(t(m))}</td><td class="muted">${esc(t(d))}</td><td>${P(tone, wait)}</td></tr>`).join("")}
    </tbody></table></div></section>`;
}

function viewCustomer360() {
  const rel = [["deposits", "฿18.65m", "2 accounts · current and USD"], ["lending", "฿112,498.98", "Fleet schedules MS-1, MS-4"], ["leasing", "฿61.4m", "Master agreement MA-2025-0031"], ["trade", "$2.40m", "LC-26-0412 to Hino Motors"]].filter((r) => has(r[0]));
  const events = [[Date.UTC(2026, 9, 24), "lending", "Collection of ฿49,652.35 cleared the fleet invoice", "done"], [Date.UTC(2026, 9, 24), "collections", "Cross-default evaluated and cured", "done"], [Date.UTC(2026, 9, 22), "trade", "LC-26-0412 documents presented", "done"], [Date.UTC(2026, 9, 18), "customers", "Covenant: Debt/EBITDA 3.1x against 3.5x", ""], [Date.UTC(2026, 9, 2), "deposits", "USD deposit opened, $412,880.00", ""]].filter((e) => has(e[1]));
  return `
    <div class="head"><div class="profile"><span class="big-av">SF</span><div>${eyebrow(sysById.customers, t("Customer 360"))}<h1 class="title">${esc(t("Siam Freight Logistics"))}</h1><p class="lede">Corporate · party B-2031 · RM Wanida K. · risk grade 4 · KYC verified 11 Jan 2026</p></div></div>
      <div class="actions"><button class="btn" type="button">${esc(t("Log a contact"))}</button><button class="btn primary" type="button">${icon("i-plus")}${esc(t("New facility"))}</button></div></div>
    <section class="rel" aria-label="Relationship across systems">${rel.map(([sid, v, d]) => `<button class="card" type="button" data-go="${sid}/overview"><span class="k">${icon(sysById[sid].icon)}${esc(t(sysById[sid].name))}</span><span class="v">${esc(v)}</span><span class="muted" style="font-size:12.5px">${esc(d)}</span></button>`).join("")}</section>
    <div class="grid-main">
      <section class="card" aria-label="${esc(t("Across every system"))}"><div class="card-head"><div><div class="card-title">${esc(t("Across every system"))}</div><div class="card-sub">${esc(t("One timeline, each event links to its record"))}</div></div></div><div class="card-body"><div class="timeline">${events.map(([d, sid, w, st]) => `<div class="tl ${st}"><span class="t">${esc(fdShort(d))}</span><span class="rail-dot"><i></i></span><div class="what"><strong>${esc(w)}</strong><span style="display:block;margin-top:4px">${chip(sid)}</span></div></div>`).join("")}</div></div></section>
      <section class="card" aria-label="${esc(t("Limits and exposure"))}"><div class="card-head"><div class="card-title">${esc(t("Limits and exposure"))}</div></div><div class="card-body"><div class="bars">${[["Group limit ฿250.0m", 56, ""], ["Fleet facility ฿80.0m", 77, "warn"], ["Trade line $5.0m", 48, ""], ["Settlement limit ฿40.0m", 12, ""]].map(([n, p, tone]) => `<div class="bar-row"><span>${esc(n)}</span><span class="num muted">${p}%</span><div class="bar"><span class="${tone}" style="width:${p}%"></span></div></div>`).join("")}</div><p class="note" style="margin-top:16px">Personal data stays in the vault. Names and ids shown here come from the party record, not from the PII store.</p></div></section>
    </div>`;
}

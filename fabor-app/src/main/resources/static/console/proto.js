(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var r2 = function (x) { return Math.round((x + Number.EPSILON) * 100) / 100; };
  var fmt = function (x) { return x.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  var fmt0 = function (x) { return Math.round(x).toLocaleString("en-US"); };
  var MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  var fdate = function (d) { return d.getDate() + " " + MONTHS[d.getMonth()] + " " + d.getFullYear(); };
  var addMonths = function (d, k) { return new Date(d.getFullYear(), d.getMonth() + k, d.getDate()); };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  var BUSINESS_DATE = new Date(2026, 9, 13);
  var VAT = 0.07;

  /* ---------- Schedule engine (mirrors engines/engine-schedule) ---------- */
  function solveMonthlyRate(P, flows) {
    var total = flows.reduce(function (a, b) { return a + b; }, 0);
    if (total <= P) return 0;
    var pv = function (r) { var s = 0; for (var k = 0; k < flows.length; k++) s += flows[k] / Math.pow(1 + r, k + 1); return s - P; };
    var lo = 0, hi = 1;
    for (var i = 0; i < 200; i++) { var mid = (lo + hi) / 2; if (pv(mid) > 0) lo = mid; else hi = mid; }
    return (lo + hi) / 2;
  }
  function buildSchedule(o) {
    var P = o.principal, n = o.n, B = r2(P * (o.balloonPct || 0)), inst, r, totalFlat = null;
    var flows = [];
    if (o.rateType === "FLAT") {
      totalFlat = r2(P * o.rate * n / 12);
      inst = r2((P - B + totalFlat) / n);
      for (var k = 0; k < n; k++) flows.push(inst);
      flows[n - 1] = r2(flows[n - 1] + B);
      r = solveMonthlyRate(P, flows);
    } else {
      r = o.rate / 12;
      var pvB = B / Math.pow(1 + r, n);
      inst = r === 0 ? r2((P - B) / n) : r2((P - pvB) * r / (1 - Math.pow(1 + r, -n)));
      for (var j = 0; j < n; j++) flows.push(inst);
      flows[n - 1] = r2(flows[n - 1] + B);
    }
    var rows = [], bal = P, sumInt = 0, sumVat = 0;
    for (var i = 1; i <= n; i++) {
      var pay = flows[i - 1], interest = r2(bal * r), principal = r2(pay - interest);
      if (i === n) { principal = r2(bal); interest = r2(pay - principal); }
      bal = r2(bal - principal);
      var vat = o.vat ? r2(pay * VAT) : 0;
      sumInt += interest; sumVat += vat;
      rows.push({ k: i, due: addMonths(o.firstDue, i - 1), pay: pay, interest: interest, principal: principal, vat: vat, total: r2(pay + vat), bal: bal });
    }
    return { rows: rows, inst: inst, monthly: r, eir: r * 12, totalInterest: r2(sumInt), totalVat: r2(sumVat), balloon: B };
  }

  /* ---------- Contract sample: HP-2025-004812 ---------- */
  var HP = { principal: 840000, rate: 0.0279, rateType: "FLAT", n: 60, balloonPct: 0, vat: true, firstDue: new Date(2025, 3, 15) };
  var hp = buildSchedule(HP);
  var billed = hp.rows.filter(function (x) { return x.due <= BUSINESS_DATE; });
  var overdue = billed[billed.length - 1];
  var paidCount = billed.length - 1;
  var dpd = Math.round((BUSINESS_DATE - overdue.due) / 86400000);
  var penalty = r2(overdue.total * 0.15 / 365 * dpd);
  var next = hp.rows[billed.length];
  var accrued = r2(next.interest * dpd / 30);
  var principalOutstanding = overdue.bal;

  function renderContract() {
    $("#contractChips").innerHTML =
      '<span class="chip warn">DPD ' + dpd + ' · bucket 1–30</span><span class="chip">TFRS 9 stage 1</span><span class="chip acc">Title retained</span>';
    $("#contractTerms").innerHTML =
      "<dt>Cash price</dt><dd class='mono'>1,050,000.00</dd>" +
      "<dt>Down payment</dt><dd class='mono'>210,000.00 (20%)</dd>" +
      "<dt>Financed</dt><dd class='mono'>" + fmt(HP.principal) + "</dd>" +
      "<dt>Flat rate</dt><dd class='mono'>" + (HP.rate * 100).toFixed(2) + "% p.a.</dd>" +
      "<dt>Effective rate</dt><dd class='mono'>" + (hp.eir * 100).toFixed(2) + "% p.a.</dd>" +
      "<dt>Term</dt><dd class='mono'>60 months · first due " + fdate(HP.firstDue) + "</dd>" +
      "<dt>Installment</dt><dd class='mono'>" + fmt(hp.inst) + " + VAT " + fmt(r2(hp.inst * VAT)) + "</dd>" +
      "<dt>Paid</dt><dd class='mono'>" + paidCount + " of 60</dd>";
    var bals = [
      ["PRINCIPAL", principalOutstanding], ["PRINCIPAL_DUE", overdue.principal], ["INTEREST_DUE", overdue.interest],
      ["INTEREST_ACCRUED", accrued], ["VAT_DUE", overdue.vat], ["PENALTY_DUE", penalty]
    ];
    var tot = 0;
    $("#balTable").innerHTML = bals.map(function (b) { tot += b[1]; return "<tr><td class='mono'>" + b[0] + "</td><td class='num'>" + fmt(b[1]) + "</td></tr>"; }).join("") +
      "<tr><td><strong>Exposure</strong></td><td class='num'><strong>" + fmt(r2(tot)) + "</strong></td></tr>";
    var settlePrincipal = r2(principalOutstanding);
    var dueNow = r2(overdue.total + penalty);
    var accVat = r2(accrued * VAT);
    $("#settleQuote").innerHTML =
      "<dt>Outstanding principal</dt><dd class='num'>" + fmt(settlePrincipal) + "</dd>" +
      "<dt>Accrued interest</dt><dd class='num'>" + fmt(accrued) + "</dd>" +
      "<dt>VAT on accrued</dt><dd class='num'>" + fmt(accVat) + "</dd>" +
      "<dt>Overdue installment + charge</dt><dd class='num'>" + fmt(dueNow) + "</dd>" +
      "<dt><strong>Settle today</strong></dt><dd class='num'><strong>" + fmt(r2(settlePrincipal + accrued + accVat + dueNow)) + "</strong></dd>" +
      "<dt>Interest not charged</dt><dd class='num'>" + fmt(r2(hp.rows.slice(billed.length).reduce(function (a, x) { return a + x.interest; }, 0) - accrued)) + "</dd>";
    renderSchedule(false);
  }
  var schedAll = false;
  function renderSchedule(all) {
    var start = all ? 0 : Math.max(0, billed.length - 4), end = all ? hp.rows.length : Math.min(hp.rows.length, billed.length + 6);
    $("#schedBody").innerHTML = hp.rows.slice(start, end).map(function (x) {
      var st, cls = "";
      if (x.k <= paidCount) { st = "<span class='chip good'>Paid</span>"; cls = "paid"; }
      else if (x.k === overdue.k) { st = "<span class='chip warn'>Overdue " + dpd + "d</span>"; cls = "hl"; }
      else st = "<span class='chip'>Scheduled</span>";
      return "<tr class='" + cls + "'><td class='mono'>" + x.k + "</td><td class='mono'>" + fdate(x.due) + "</td><td class='num'>" + fmt(x.pay) + "</td><td class='num'>" + fmt(x.interest) + "</td><td class='num'>" + fmt(x.principal) + "</td><td class='num'>" + fmt(x.vat) + "</td><td class='num'>" + fmt(x.total) + "</td><td class='num'>" + fmt(x.bal) + "</td><td>" + st + "</td></tr>";
    }).join("");
    $("#schedNote").textContent = all ? "All 60 installments" : "Installments " + (start + 1) + "–" + end + " of 60";
    $("#schedToggle").textContent = all ? "Show around today" : "Show all installments";
  }
  $("#schedToggle").addEventListener("click", function () { schedAll = !schedAll; renderSchedule(schedAll); });

  /* ---------- Customer facilities ---------- */
  var facilities = [
    { name: "Group limit · Siam Freight Group", limit: 250e6, used: 139.35e6, child: false },
    { name: "Term loan TL-2024-000311", limit: 120e6, used: 96e6, child: true },
    { name: "Leasing line · fleet MA-2025-0031", limit: 80e6, used: 36.15e6, child: true },
    { name: "Overdraft OD-200118", limit: 30e6, used: 7.2e6, child: true },
    { name: "Trade line", limit: 20e6, used: 0, child: true }
  ];
  $("#facilities").innerHTML = facilities.map(function (f) {
    var pct = f.limit ? f.used / f.limit * 100 : 0;
    return "<div class='fac" + (f.child ? " child" : "") + "'><span>" + esc(f.name) + "</span><span class='mono muted'>" + fmt0(f.used) + " / " + fmt0(f.limit) + " · " + pct.toFixed(0) + "%</span><div class='bar'><span class='" + (pct >= 75 ? "warn" : "") + "' style='width:" + pct.toFixed(1) + "%'></span></div></div>";
  }).join("");

  /* ---------- Ledger batches ---------- */
  var nextBatch = 88214;
  function bid() { return "PB-20261013-" + (nextBatch++); }
  var C = "HP-2025-004812";
  var batches = [
    { id: bid(), time: "09:42:07", value: "13 Oct 2026", actor: { type: "SYSTEM", name: "payments-hub" }, reason: "PromptPay transfer in", legs: [
      { acct: "GL 1190 PromptPay settlement", bt: "—", side: "DR", amt: 25000, ccy: "THB" },
      { acct: "SAV-0012-88310 · Kanya P.", bt: "PRINCIPAL", side: "CR", amt: 25000, ccy: "THB" } ] },
    { id: bid(), time: "00:00:04", value: "13 Oct 2026", actor: { type: "SYSTEM", name: "scheduler" }, reason: "Daily interest accrual · " + C, legs: [
      { acct: C, bt: "INTEREST_ACCRUED", side: "DR", amt: r2(next.interest / 30), ccy: "THB" },
      { acct: "GL 4110 Interest income · HP", bt: "—", side: "CR", amt: r2(next.interest / 30), ccy: "THB" } ] },
    { id: bid(), time: "00:00:05", value: "13 Oct 2026", actor: { type: "SYSTEM", name: "scheduler" }, reason: "Late charge, 15% p.a. on overdue installment · " + C, legs: [
      { acct: C, bt: "PENALTY_DUE", side: "DR", amt: r2(overdue.total * 0.15 / 365), ccy: "THB" },
      { acct: "GL 4190 Penalty income", bt: "—", side: "CR", amt: r2(overdue.total * 0.15 / 365), ccy: "THB" } ] },
    { id: bid(), time: "08:15:31", value: "12 Oct 2026", actor: { type: "HUMAN", name: "Somchai T. · checked by Ploy C." }, reason: "Manual journal · suspense clearing, ticket OPS-5521", legs: [
      { acct: "GL 1990 Suspense", bt: "—", side: "DR", amt: 12400, ccy: "THB" },
      { acct: "CUR-0031-10442 · Mae Fah Foods", bt: "PRINCIPAL", side: "CR", amt: 12400, ccy: "THB" } ] },
    { id: bid(), time: "00:00:09", value: "13 Oct 2026", actor: { type: "SYSTEM", name: "scheduler" }, reason: "Term deposit interest, 15% withholding tax", legs: [
      { acct: "GL 5110 Interest expense · deposits", bt: "—", side: "DR", amt: 3125, ccy: "THB" },
      { acct: "TD-0044-20918 · Arthit W.", bt: "PRINCIPAL", side: "CR", amt: 2656.25, ccy: "THB" },
      { acct: "GL 2150 Withholding tax payable", bt: "—", side: "CR", amt: 468.75, ccy: "THB" } ] },
    { id: bid(), time: "10:03:55", value: "13 Oct 2026", actor: { type: "HUMAN", name: "Treasury desk" }, reason: "FX conversion USD → THB at 36.50 · Siam Freight", legs: [
      { acct: "FCD-0090-55120 · Siam Freight", bt: "PRINCIPAL", side: "DR", amt: 10000, ccy: "USD" },
      { acct: "GL 1810 FX position USD", bt: "—", side: "CR", amt: 10000, ccy: "USD" },
      { acct: "GL 1811 FX position THB", bt: "—", side: "DR", amt: 365000, ccy: "THB" },
      { acct: "CUR-0090-55100 · Siam Freight", bt: "PRINCIPAL", side: "CR", amt: 365000, ccy: "THB" } ] },
    { id: bid(), time: "00:00:03", value: "15 Sep 2026", actor: { type: "SYSTEM", name: "scheduler" }, reason: "Installment " + overdue.k + " billed · " + C, legs: [
      { acct: C, bt: "PRINCIPAL_DUE", side: "DR", amt: overdue.principal, ccy: "THB" },
      { acct: C, bt: "PRINCIPAL", side: "CR", amt: overdue.principal, ccy: "THB" },
      { acct: C, bt: "INTEREST_DUE", side: "DR", amt: overdue.interest, ccy: "THB" },
      { acct: C, bt: "INTEREST_ACCRUED", side: "CR", amt: overdue.interest, ccy: "THB" },
      { acct: C, bt: "VAT_DUE", side: "DR", amt: overdue.vat, ccy: "THB" },
      { acct: "GL 2140 Output VAT payable", bt: "—", side: "CR", amt: overdue.vat, ccy: "THB" } ] }
  ];
  var actorFilter = "ALL";
  function actorChip(a) {
    var cls = a.type === "AGENT" ? "agent" : a.type === "HUMAN" ? "acc" : "";
    return "<span class='chip " + cls + "'>" + a.type + "</span>";
  }
  function renderBatches() {
    var list = batches.filter(function (b) { return actorFilter === "ALL" || b.actor.type === actorFilter; });
    $("#batches").innerHTML = list.length ? list.map(function (b) {
      var sums = {};
      b.legs.forEach(function (l) { sums[l.ccy] = sums[l.ccy] || { DR: 0, CR: 0 }; sums[l.ccy][l.side] = r2(sums[l.ccy][l.side] + l.amt); });
      var bal = Object.keys(sums).map(function (c) {
        var ok = Math.abs(sums[c].DR - sums[c].CR) < 0.005;
        return "<span><span class='label'>" + c + "</span> <span class='mono'>Dr " + fmt(sums[c].DR) + " · Cr " + fmt(sums[c].CR) + "</span> <span class='chip " + (ok ? "good" : "crit") + "'>" + (ok ? "balanced" : "unbalanced") + "</span></span>";
      }).join("");
      var legs = "<div class='tbl-wrap'><table><thead><tr><th>Account</th><th>Balance type</th><th class='num'>Debit</th><th class='num'>Credit</th><th>Ccy</th></tr></thead><tbody>" +
        b.legs.map(function (l) { return "<tr><td>" + esc(l.acct) + "</td><td class='mono'>" + l.bt + "</td><td class='num'>" + (l.side === "DR" ? fmt(l.amt) : "") + "</td><td class='num'>" + (l.side === "CR" ? fmt(l.amt) : "") + "</td><td class='mono'>" + l.ccy + "</td></tr>"; }).join("") +
        "</tbody></table></div>";
      return "<details class='batch'><summary><span class='mono'>" + b.id + "<br><span class='muted'>booked " + b.time + " · value " + b.value + "</span></span><span>" + esc(b.reason) + "<br><span class='muted'>" + esc(b.actor.name) + "</span></span>" + actorChip(b.actor) + "<span class='chip good'>Σ Dr = Σ Cr</span></summary><div class='legs'><div class='balanced'>" + bal + "</div>" + legs + "</div></details>";
    }).join("") : "<div class='panel muted'>No batches from this actor yet. Run the AI agent case to create one.</div>";
  }
  $$("[data-actor]").forEach(function (b) {
    b.addEventListener("click", function () {
      actorFilter = b.getAttribute("data-actor");
      $$("[data-actor]").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
      renderBatches();
    });
  });

  /* ---------- Approvals ---------- */
  var ME = "Ploy Chaiyaporn";
  var approvals = [
    { id: "APR-1041", title: "Publish product AUTO_HP_USED v2", kind: "Product", maker: "Krit S. · Product", agent: null, detail: "Effective rate cap check passed (≤ 15%). 1,200 simulated scenarios matched golden tests.", status: "PENDING" },
    { id: "APR-1042", title: "Manual journal ฿12,400.00 · suspense clearing", kind: "Journal", maker: "Ploy Chaiyaporn", agent: null, detail: "You created this journal, so a different checker must approve it.", status: "PENDING" },
    { id: "APR-1043", title: "Restructure TL-2024-000311 · extend 24 months", kind: "Modification", maker: "RM copilot", agent: "on behalf of Wanida K. (RM)", detail: "Installment falls from ฿2.41M to ฿1.73M. Modification loss ฿0.62M under TFRS 9. Stage moves 1 → 2.", status: "PENDING" }
  ];
  function updateBadge() {
    var n = approvals.filter(function (a) { return a.status === "PENDING"; }).length;
    $("#apprBadge").textContent = n;
    $("#apprBadge").hidden = n === 0;
  }
  function renderApprovals() {
    $("#apprList").innerHTML = approvals.map(function (a) {
      var self = a.maker === ME;
      var state = a.status === "PENDING" ? "" : "<span class='chip " + (a.status === "APPROVED" ? "good" : "crit") + "'>" + (a.status === "APPROVED" ? "Approved by you" : "Rejected · " + esc(a.reason)) + "</span>";
      var actions = a.status !== "PENDING" ? state :
        "<div class='row'><button class='btn primary' type='button' data-approve='" + a.id + "'" + (self ? " disabled" : "") + ">Approve</button></div>" +
        "<div class='reason'><input id='rs-" + a.id + "' placeholder='Reason to reject' aria-label='Reason to reject " + a.id + "'><button class='btn danger' type='button' data-reject='" + a.id + "'>Reject</button></div>" +
        "<div class='err' id='er-" + a.id + "'></div>";
      return "<div class='appr'><div><div class='row'><span class='mono muted'>" + a.id + "</span><span class='chip'>" + a.kind + "</span>" + (a.agent ? "<span class='chip agent'>AI proposed</span>" : "") + "</div><h3 style='margin-top:6px'>" + esc(a.title) + "</h3><p style='margin-top:4px'>" + esc(a.detail) + "</p><div class='meta' style='margin-top:6px'><span>Maker: " + esc(a.maker) + "</span>" + (a.agent ? "<span>" + esc(a.agent) + "</span>" : "") + "</div></div><div class='act'>" + actions + "</div></div>";
    }).join("");
    $$("[data-approve]").forEach(function (b) { b.addEventListener("click", function () { decide(b.getAttribute("data-approve"), "APPROVED"); }); });
    $$("[data-reject]").forEach(function (b) { b.addEventListener("click", function () { decide(b.getAttribute("data-reject"), "REJECTED"); }); });
    updateBadge();
  }
  function decide(id, st) {
    var a = approvals.filter(function (x) { return x.id === id; })[0];
    if (st === "REJECTED") {
      var v = $("#rs-" + id).value.trim();
      if (!v) { $("#er-" + id).textContent = "Add a reason before rejecting. The maker sees it."; return; }
      a.reason = v;
    }
    a.status = st;
    renderApprovals();
    toast(a.id + (st === "APPROVED" ? " approved" : " rejected"));
  }

  /* ---------- Product Studio ---------- */
  var CAPS = { HP_NEW: 0.10, HP_USED: 0.15, HP_MOTO: 0.23, PL: 0.25, LEASE: null };
  var CAP_NAME = { HP_NEW: "new car hire purchase", HP_USED: "used car hire purchase", HP_MOTO: "motorcycle hire purchase", PL: "personal loan", LEASE: "" };
  function studioInput() {
    return {
      code: $("#pCode").value.trim().toUpperCase() || "UNNAMED",
      family: $("#pFamily").value,
      rateType: $("#pRateType").value,
      rate: Math.max(0, parseFloat($("#pRate").value) || 0) / 100,
      principal: Math.max(0, parseFloat($("#pPrincipal").value) || 0),
      n: parseInt($("#pTerm").value, 10),
      balloonPct: Math.min(50, Math.max(0, parseFloat($("#pBalloon").value) || 0)) / 100,
      fee: Math.max(0, parseFloat($("#pFee").value) || 0),
      vat: $("#pVat").checked,
      firstDue: addMonths(BUSINESS_DATE, 1)
    };
  }
  function renderStudio() {
    var o = studioInput();
    var s = o.principal > 0 ? buildSchedule(o) : null;
    if (!s) {
      $("#oInst").textContent = "—"; $("#oEir").textContent = "—"; $("#oInt").textContent = "—";
      $("#checks").innerHTML = "<div><span class='chip crit'>Fail</span><span>Enter a financed amount above zero.</span></div>";
      $("#studioChart").innerHTML = ""; $("#chartCap").textContent = ""; $("#yaml").textContent = "";
      return null;
    }
    var eirWithFee = o.fee > 0 ? solveMonthlyRate(o.principal - o.fee, s.rows.map(function (x) { return x.pay; })) * 12 : s.eir;
    $("#oInst").textContent = "฿" + fmt(s.inst);
    $("#oInstVat").textContent = o.vat ? "฿" + fmt(r2(s.inst * (1 + VAT))) + " with VAT" : "No VAT";
    $("#oEir").textContent = (eirWithFee * 100).toFixed(2) + "%";
    $("#oInt").textContent = "฿" + fmt0(s.totalInterest);
    $("#oVat").textContent = o.vat ? "VAT over term ฿" + fmt0(s.totalVat) : "Interest over term";

    var checks = [];
    var cap = CAPS[o.family];
    if (cap !== null) {
      var ok = eirWithFee <= cap + 1e-9;
      checks.push([ok ? "good" : "crit", ok ? "Pass" : "Fail", "Effective rate " + (eirWithFee * 100).toFixed(2) + "% against the " + (cap * 100).toFixed(0) + "% cap for " + CAP_NAME[o.family] + "."]);
    } else {
      checks.push(["good", "Pass", "No regulatory rate cap for equipment finance leases. Lessor accounting under TFRS 16."]);
    }
    if (o.family.indexOf("HP") === 0 && o.rateType === "FLAT") checks.push(["good", "Pass", "Flat rate converted to an effective rate for disclosure. Interest income recognized on the effective-rate basis."]);
    if (o.family === "PL" && o.vat) checks.push(["crit", "Fail", "Personal loan interest is not subject to VAT. Turn VAT off."]);
    else if (o.family !== "PL" && !o.vat) checks.push(["warn", "Check", "Hire purchase and lease installments normally carry VAT 7%."]);
    else checks.push(["good", "Pass", o.vat ? "VAT 7% applied at each due date, with a tax invoice per installment." : "No VAT on this product."]);
    if (o.balloonPct > 0) checks.push(["warn", "Check", "Balloon of ฿" + fmt0(s.balloon) + " due with the last installment. Requires an affordability check at maturity."]);
    var sumP = s.rows.reduce(function (a, x) { return a + x.principal; }, 0);
    checks.push([Math.abs(sumP - o.principal) < 0.01 ? "good" : "crit", Math.abs(sumP - o.principal) < 0.01 ? "Pass" : "Fail", "Schedule repays principal exactly: ฿" + fmt(r2(sumP)) + "."]);
    $("#checks").innerHTML = checks.map(function (c) { return "<div><span class='chip " + c[0] + "'>" + c[1] + "</span><span>" + c[2] + "</span></div>"; }).join("");
    $("#submitProduct").disabled = checks.some(function (c) { return c[0] === "crit"; });

    drawChart(s, o);
    var fam = { HP_NEW: "ASSET_FINANCE", HP_USED: "ASSET_FINANCE", HP_MOTO: "ASSET_FINANCE", LEASE: "LEASE", PL: "LOAN" }[o.family];
    var y = [
      "product: " + o.code, "version: draft", "family: " + fam, "currency: THB", "",
      "parameters:", "  principal: { min: 50000, max: 5000000 }", "  term_months: { allowed: [" + o.n + "] }", "  balloon_pct: { max: " + o.balloonPct.toFixed(2) + " }", "",
      "pricing:", "  rate_type: " + o.rateType, "  rate: " + (o.rate * 100).toFixed(2) + "%", "  disclosed_rate: EFFECTIVE   # " + (eirWithFee * 100).toFixed(2) + "% at these inputs", "  day_count: ACT_365F", "",
      "schedule:", "  method: " + (o.rateType === "FLAT" ? "ANNUITY_FROM_FLAT" : "ANNUITY") + (o.balloonPct > 0 ? "_BALLOON" : ""), "  frequency: MONTHLY", "  holiday_rule: FOLLOWING", "",
      "income_recognition:", "  method: EIR" + (o.fee > 0 ? "\n  deferred_fees: [ORIGINATION_FEE]" : ""), "",
      "tax:", o.vat ? "  vat: { applies_to: [INSTALLMENT], rate: 0.07, point: DUE_DATE }" : "  vat: none", "",
      "fees:" + (o.fee > 0 ? "\n  - { code: ORIGINATION_FEE, trigger: DISBURSEMENT, amount: \"" + o.fee + "\" }" : ""),
      "  - { code: LATE_CHARGE, trigger: DAILY_WHILE_OVERDUE,", "      amount: \"overdue_installment * 0.15 / 365\" }", "",
      "repayment_waterfall: [FEES_DUE, PENALTY_DUE, VAT_DUE, INTEREST_DUE, PRINCIPAL_DUE]",
      "rule_pack: TH" + (cap !== null ? "   # cap " + (cap * 100).toFixed(0) + "% effective" : ""),
      "accounting: { gl_mapping: " + (fam === "LOAN" ? "loan_standard_th_v1" : fam === "LEASE" ? "lease_tfrs16_v1" : "hp_standard_th_v2") + " }"
    ];
    $("#yaml").textContent = y.join("\n");
    return { o: o, s: s, eir: eirWithFee };
  }
  function drawChart(s, o) {
    var svg = $("#studioChart");
    var rows = s.balloon > 0 ? s.rows.slice(0, -1) : s.rows;
    var W = 640, H = 230, L = 60, R = 630, T = 14, B = 196;
    var max = Math.max.apply(null, rows.map(function (x) { return x.pay; }));
    var step = Math.pow(10, Math.floor(Math.log10(max)));
    var top = Math.ceil(max / step) * step;
    if (top / step > 6) { step *= 2; top = Math.ceil(max / step) * step; }
    var y = function (v) { return B - v / top * (B - T); };
    var bw = (R - L) / rows.length;
    var out = [];
    for (var t = 0; t <= top + 1e-6; t += step) {
      out.push("<line x1='" + L + "' x2='" + R + "' y1='" + y(t).toFixed(1) + "' y2='" + y(t).toFixed(1) + "' stroke='currentColor' opacity='0.12'/>");
      out.push("<text class='edge' x='" + (L - 6) + "' y='" + (y(t) + 4).toFixed(1) + "' text-anchor='end'>" + fmt0(t) + "</text>");
    }
    rows.forEach(function (x, i) {
      var x0 = L + i * bw + bw * 0.15, w = Math.max(1, bw * 0.7);
      out.push("<rect x='" + x0.toFixed(1) + "' y='" + y(x.principal).toFixed(1) + "' width='" + w.toFixed(1) + "' height='" + (B - y(x.principal)).toFixed(1) + "' style='fill:var(--accent)'/>");
      out.push("<rect x='" + x0.toFixed(1) + "' y='" + y(x.pay).toFixed(1) + "' width='" + w.toFixed(1) + "' height='" + (y(x.principal) - y(x.pay)).toFixed(1) + "' style='fill:var(--s2)'/>");
    });
    [1, Math.ceil(rows.length / 2), rows.length].forEach(function (k) {
      out.push("<text class='edge' x='" + (L + (k - 0.5) * bw).toFixed(1) + "' y='" + (B + 16) + "' text-anchor='middle'>" + k + "</text>");
    });
    out.push("<rect x='" + L + "' y='" + (H - 12) + "' width='10' height='10' style='fill:var(--accent)'/><text class='edge' x='" + (L + 14) + "' y='" + (H - 3) + "'>principal</text>");
    out.push("<rect x='" + (L + 84) + "' y='" + (H - 12) + "' width='10' height='10' style='fill:var(--s2)'/><text class='edge' x='" + (L + 98) + "' y='" + (H - 3) + "'>interest</text>");
    out.push("<text class='edge' x='" + R + "' y='" + (H - 3) + "' text-anchor='end'>installment number</text>");
    svg.innerHTML = out.join("");
    $("#chartCap").textContent = "Each bar is one installment before VAT, in THB. Interest shrinks as principal is repaid, even on a flat-rate product, because income is recognized on the effective rate." + (s.balloon > 0 ? " The balloon of ฿" + fmt0(s.balloon) + " with the last installment is not drawn." : "");
  }
  $$("#studioForm input, #studioForm select").forEach(function (el) { el.addEventListener("input", renderStudio); el.addEventListener("change", renderStudio); });
  $("#pFamily").addEventListener("change", function () {
    var f = $("#pFamily").value;
    var preset = { HP_NEW: ["FLAT", 2.79, 840000, true, "AUTO_HP_NEW"], HP_USED: ["FLAT", 4.5, 450000, true, "AUTO_HP_USED"], HP_MOTO: ["FLAT", 11, 60000, true, "MOTO_HP"], LEASE: ["EFFECTIVE", 6.25, 3500000, true, "EQUIP_FIN_LEASE"], PL: ["EFFECTIVE", 18, 200000, false, "PERSONAL_LOAN"] }[f];
    $("#pRateType").value = preset[0]; $("#pRate").value = preset[1]; $("#pPrincipal").value = preset[2]; $("#pVat").checked = preset[3]; $("#pCode").value = preset[4];
    renderStudio();
  });
  var submitted = 0;
  $("#submitProduct").addEventListener("click", function () {
    var r = renderStudio();
    if (!r) return;
    submitted++;
    approvals.unshift({ id: "APR-" + (1050 + submitted), title: "Publish product " + r.o.code + " (draft " + submitted + ")", kind: "Product", maker: "You, in Product Studio", agent: null,
      detail: "Effective rate " + (r.eir * 100).toFixed(2) + "%, installment ฿" + fmt(r.s.inst) + ", " + r.o.n + " months. Rule checks passed.", status: "PENDING" });
    renderApprovals();
    toast(r.o.code + " sent to Approvals as APR-" + (1050 + submitted));
  });
  $("#copyYaml").addEventListener("click", function () {
    var b = this, txt = $("#yaml").textContent;
    var done = function () { toast("Definition copied"); };
    try {
      navigator.clipboard.writeText(txt).then(done, function () { selectYaml(); });
    } catch (e) { selectYaml(); }
  });
  function selectYaml() { var range = document.createRange(); range.selectNodeContents($("#yaml")); var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range); }

  /* ---------- AI agent case ---------- */
  var agents = [
    { name: "Customer assistant", may: "Waive fees up to ฿1,000 per customer per year. Propose modifications.", on: true },
    { name: "Collections agent", may: "Record promises to pay. No waivers.", on: true },
    { name: "Ops copilot", may: "Propose journals and reconciliation matches only.", on: true },
    { name: "RM copilot", may: "Draft credit memos. Propose restructures.", on: true }
  ];
  function renderAgents() {
    $("#agentReg").innerHTML = agents.map(function (a, i) {
      return "<tr><td>" + a.name + "</td><td>" + a.may + "</td><td><button type='button' class='switch' role='switch' aria-checked='" + a.on + "' aria-label='Enable " + a.name + "' data-ag='" + i + "'></button></td></tr>";
    }).join("");
    $$("[data-ag]").forEach(function (s) { s.addEventListener("click", function () { var a = agents[+s.getAttribute("data-ag")]; a.on = !a.on; renderAgents(); }); });
  }
  var overdueTotal = overdue.total;
  var steps = [
    { kind: "user", text: "I was in hospital last month and missed my car payment. Can I skip next month's payment?" },
    { kind: "tool", tool: "contracts.get", args: "{ id: \"" + C + "\" }", result: "AUTO_HP_NEW v3 · " + paidCount + " of 60 paid · installment ฿" + fmt(overdueTotal) + " with VAT", decision: "Allowed · read" },
    { kind: "tool", tool: "delinquency.get", args: "{ id: \"" + C + "\" }", result: "DPD " + dpd + " · overdue ฿" + fmt(overdueTotal) + " · late charge ฿" + fmt(penalty), decision: "Allowed · read" },
    { kind: "tool", tool: "policy.check", args: "{ action: \"payment_holiday\", months: 1 }", result: "Product allows 1 holiday per 12 months. Contract is overdue, so a person must approve.", decision: "Needs a checker", blocked: true },
    { kind: "tool", tool: "modifications.propose", args: "{ type: \"payment_holiday\", months: 1, interest: \"deferred\" }", result: "Simulated: term 60 → 61 months, installment unchanged, deferred interest ฿" + fmt(next.interest) + ". Sent to Approvals.", decision: "Proposed · APR-1044", propose: true },
    { kind: "tool", tool: "fees.waive", args: "{ fee: \"LATE_CHARGE\", amount: " + penalty.toFixed(2) + " }", result: "฿" + fmt(penalty) + " is within the ฿1,000 authority. Posted as a reversal batch.", decision: "Executed", exec: true },
    { kind: "agent", text: "I'm sorry you were unwell. I've waived the ฿" + fmt(penalty) + " late charge. Your September payment of ฿" + fmt(overdueTotal) + " is still due. I've asked our team to approve a one-month payment holiday for November; you'll get an answer today, and your monthly payment stays the same." }
  ];
  var stepIdx = 0;
  function nowTime() { var d = new Date(); return ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2) + ":" + ("0" + d.getSeconds()).slice(-2); }
  function runStep() {
    if (stepIdx >= steps.length) return;
    if (!agents[0].on) {
      $("#convo").insertAdjacentHTML("beforeend", "<div class='tool blocked'><span class='ti'><svg class='ico'><use href='#i-alert'/></svg></span><strong>Gateway refused the call</strong><span>Customer assistant is turned off. Turn it on under Delegated authority to continue.</span></div>");
      return;
    }
    var s = steps[stepIdx++];
    var c = $("#convo");
    if (s.kind === "user") c.insertAdjacentHTML("beforeend", "<div class='msg me'><span class='who'>Napat Srisuk · mobile app</span><div class='bubble'>" + esc(s.text) + "</div></div>");
    else if (s.kind === "agent") c.insertAdjacentHTML("beforeend", "<div class='msg agent'><span class='who'>Customer assistant</span><div class='bubble'>" + esc(s.text) + "</div></div>");
    else {
      c.insertAdjacentHTML("beforeend", "<div class='tool " + (s.blocked ? "blocked" : s.exec ? "ok" : "") + "'><span class='ti'><svg class='ico'><use href='#" + (s.blocked ? "i-alert" : s.exec ? "i-check" : "i-tool") + "'/></svg></span><span class='call'>" + esc(s.tool) + " " + esc(s.args) + "</span><span>" + esc(s.result) + "</span><span class='label'>" + esc(s.decision) + "</span></div>");
      var a = $("#audit");
      if (a.querySelector("td[colspan]")) a.innerHTML = "";
      a.insertAdjacentHTML("beforeend", "<tr><td class='mono'>" + nowTime() + "</td><td class='mono'>" + esc(s.tool) + "</td><td>" + esc(s.decision) + "</td></tr>");
      if (s.propose) {
        approvals.unshift({ id: "APR-1044", title: "Payment holiday, 1 month · " + C, kind: "Modification", maker: "Customer assistant", agent: "on behalf of Napat Srisuk (customer)", detail: "Contract is " + dpd + " days overdue, above the agent's authority. Interest of ฿" + fmt(next.interest) + " deferred to a new installment 61.", status: "PENDING" });
        renderApprovals();
      }
      if (s.exec) {
        batches.unshift({ id: bid(), time: nowTime(), value: "13 Oct 2026", actor: { type: "AGENT", name: "Customer assistant · for Napat Srisuk" }, reason: "Late charge waiver · " + C, legs: [
          { acct: "GL 4190 Penalty income", bt: "—", side: "DR", amt: penalty, ccy: "THB" },
          { acct: C, bt: "PENALTY_DUE", side: "CR", amt: penalty, ccy: "THB" } ] });
        renderBatches();
        toast("Late charge waived by AI agent · ฿" + fmt(penalty));
      }
      if (s.propose) toast("Payment holiday sent to Approvals as APR-1044");
    }
    $("#agentStep").disabled = stepIdx >= steps.length;
    $("#agentStep span").textContent = stepIdx >= steps.length ? "Case complete" : "Run next step";
  }
  $("#agentStep").addEventListener("click", runStep);
  $("#agentReset").addEventListener("click", function () {
    stepIdx = 0; $("#convo").innerHTML = "";
    $("#audit").innerHTML = "<tr><td colspan='3' class='muted'>No tool calls yet. Run the first step.</td></tr>";
    approvals = approvals.filter(function (a) { return a.id !== "APR-1044"; });
    batches = batches.filter(function (b) { return b.actor.type !== "AGENT"; });
    renderApprovals(); renderBatches();
    $("#agentStep").disabled = false; $("#agentStep span").textContent = "Run next step";
  });

  /* ---------- Overview ---------- */
  function drawSpark() {
    var pts = [], v = 3300, seed = 7;
    var rnd = function () { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    for (var i = 0; i < 60; i++) { v += (rnd() - 0.48) * 260; v = Math.max(2700, Math.min(4300, v)); pts.push(v); }
    var L = 50, R = 630, T = 10, B = 150, lo = 2500, hi = 4500;
    var x = function (i) { return L + i * (R - L) / 59; }, y = function (q) { return B - (q - lo) / (hi - lo) * (B - T); };
    var line = pts.map(function (q, i) { return x(i).toFixed(1) + "," + y(q).toFixed(1); }).join(" ");
    var out = [];
    [2500, 3500, 4500].forEach(function (t) {
      out.push("<line x1='" + L + "' x2='" + R + "' y1='" + y(t) + "' y2='" + y(t) + "' stroke='currentColor' opacity='0.12'/><text class='edge' x='" + (L - 6) + "' y='" + (y(t) + 4) + "' text-anchor='end'>" + fmt0(t) + "</text>");
    });
    out.push("<polygon points='" + L + "," + B + " " + line + " " + R + "," + B + "' style='fill:var(--accent)' opacity='0.12'/>");
    out.push("<polyline points='" + line + "' fill='none' stroke='var(--accent)' stroke-width='2'/>");
    out.push("<circle cx='" + x(59) + "' cy='" + y(pts[59]).toFixed(1) + "' r='4' style='fill:var(--accent)'/>");
    out.push("<text class='edge' x='" + L + "' y='166'>60 min ago</text><text class='edge' x='" + R + "' y='166' text-anchor='end'>now</text>");
    $("#spark").innerHTML = out.join("");
    $("#tpsNow").textContent = fmt0(pts[59]) + " /s now";
  }
  var feed = [
    ["PromptPay in", "SAV · Kanya P.", 25000], ["Card hold", "CUR · Mae Fah Foods", 1840.5], ["Loan repayment", "PL-2026-018331", 6120], ["Interest accrual", "HP-2025-004812", r2(next.interest / 30)],
    ["Bill payment", "SAV · Arthit W.", 1290], ["Dealer disbursement", "HP-2026-007702", 612000], ["QR merchant pay", "CUR · Baan Kafe", 85], ["Lease rental + VAT", "FL-2025-000118", 48150]
  ];
  var streamOn = true, postings = 3841220, feedI = 0;
  function pushStream() {
    var f = feed[feedI++ % feed.length], d = new Date();
    var t = ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2) + ":" + ("0" + d.getSeconds()).slice(-2);
    var el = $("#stream");
    var inbound = /in|repayment|Lease/.test(f[0]);
    el.insertAdjacentHTML("afterbegin", "<div class='stream-row'><span class='ic" + (inbound ? " in" : "") + "'><svg class='ico' style='width:15px;height:15px'><use href='#" + (inbound ? "i-in" : "i-out") + "'/></svg></span><span class='mono muted'>" + t + "</span><span>" + f[0] + " <span class='muted'>· " + f[1] + "</span></span><span class='num'>" + fmt(f[2]) + "</span></div>");
    while (el.children.length > 12) el.removeChild(el.lastChild);
    postings += 3000 + Math.floor(Math.random() * 1200);
    $("#kpiPostings").textContent = fmt0(postings);
  }
  for (var i = 0; i < 8; i++) pushStream();
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function setStreamBtn() { $("#streamToggle span").textContent = streamOn ? "Pause" : "Resume"; $("#streamToggle use").setAttribute("href", streamOn ? "#i-pause" : "#i-play"); }
  if (reduce) { streamOn = false; setStreamBtn(); }
  var tick = 0;
  setInterval(function () { tick++; var calm = document.documentElement.getAttribute("data-style") === "calm"; if (streamOn && !document.hidden && current === "overview" && (!calm || tick % 3 === 0)) pushStream(); }, 1400);
  $("#streamToggle").addEventListener("click", function () { streamOn = !streamOn; setStreamBtn(); });

  /* ---------- Architecture detail ---------- */
  var ARCH = {
    channels: ["Channels", "Mobile, internet banking, back-office, RM workstation and partner portals.", ["Hold no business logic", "Call public APIs only", "Reference apps prove every API"], "React or native apps, OpenAPI clients"],
    apigw: ["API gateway", "The single public entry point for apps and partners.", ["OAuth2 / OIDC with Keycloak", "Idempotency-Key on every write", "Rate limits and API versions"], "Apache APISIX (Kong OSS as alternative)"],
    agentgw: ["Agent gateway", "Exposes the same APIs to AI agents as MCP tools.", ["Delegated authority per agent and per tool", "Policy check (OPA) before every write", "Records prompt, tools, model version and outcome", "Kill switch per agent"], "MCP SDK, OPA, LiteLLM"],
    workflow: ["Workflow workers", "Long-running business processes as durable sagas.", ["Onboarding, origination, disbursement", "Restructuring, repossession, remarketing", "Compensations instead of distributed transactions"], "Temporal (Flowable or Operaton if required)"],
    scheduler: ["Scheduler", "Due work for every account, without a nightly batch, at billion-account scale.", ["Partitioned time-wheel: a due-queue per ledger shard", "Accrual computed per account, posted on events; GL accrual posted daily in aggregate", "Month-end peaks spread by booking time, value date unchanged", "Back-valued events replay from the value date"], "Due-queue tables, SKIP LOCKED workers (ADR-0007)"],
    party: ["party", "Customers, relationships, group hierarchies, KYC status and consents.", ["Group exposure over the relationship graph", "PII stored in a tokenization vault", "PDPA consent and purpose"], "Java 21, Spring Boot, MyBatis, PostgreSQL"],
    catalog: ["product-catalog", "Versioned product definitions, pricing tables and fee schedules.", ["Typed building blocks plus CEL formulas", "Simulation and golden tests before publish", "Maker-checker publishing"], "cel-java, JSON Schema"],
    deposit: ["deposit", "Savings, current, term deposits, pockets, sweeps and overdraft.", ["Tiered interest", "Withholding tax on interest", "Dormancy rules"], "Java 21, MyBatis"],
    lending: ["lending", "Loans and credit lines: schedules, accrual, billing, allocation, restructuring.", ["Annuity, equal principal, bullet, balloon, stepped", "EIR income recognition", "Waterfall allocation and DPD aging"], "engine-schedule, engine-interest"],
    leasing: ["leasing", "Hire purchase and leases with the asset at the centre.", ["Annuity from flat rate, residual value", "VAT per installment, tax invoices", "Title, insurance, repossession, remarketing", "TFRS 16 lessor accounting"], "engine-schedule, engine-tax"],
    limits: ["limits & collateral", "Facility trees, exposure, collateral, guarantees and covenants.", ["Atomic limit check on drawdown", "LTV and haircut monitoring", "Covenant tests and breach workflow"], "Java 21, MyBatis"],
    collections: ["collections", "Delinquency strategies, promises to pay and agent assignment.", ["Consumes DelinquencyChanged events", "AI propensity-to-pay models", "Conduct rules per jurisdiction"], "Java 21, Kafka consumers"],
    payments: ["payments-hub", "Adapters to payment rails. Not a payment switch.", ["PromptPay and ITMX", "ISO 20022 and SWIFT", "Posts settlement batches to the ledger"], "Java 21, ISO 20022 libraries"],
    ledger: ["ledger", "The only service that moves value.", ["Balanced batches, per currency", "Immutable: corrections are reversals", "Balances updated in the same transaction", "Value date and booking time on every posting", "Sharded by account, explicit row locks"], "PostgreSQL default, Oracle certified, plain JDBC"],
    ai: ["ai-decisioning", "Model serving for credit, fraud, AML and pricing.", ["Fraud score inside the posting budget (< 30 ms)", "Reason codes for every adverse decision", "Drift monitoring with rule-based fallback"], "MLflow, KServe, vLLM, LiteLLM"],
    kafka: ["Kafka event backbone", "Every state change, published from a transactional outbox.", ["Schemas versioned in Apicurio", "Replay rebuilds any downstream view", "Consumers are idempotent"], "Apache Kafka on Strimzi, Debezium, Apicurio"],
    accounting: ["accounting", "Maps postings to the GL and runs TFRS 9 and TFRS 16.", ["Sub-ledger to GL reconciled to zero daily", "ECL staging and provisions", "Period close without stopping postings"], "Java 21, Iceberg"],
    reporting: ["reporting", "Regulatory and management reporting from events.", ["BOT data returns", "Deposit protection reports", "Point-in-time correct"], "Iceberg, Trino, dbt Core, ClickHouse"],
    features: ["feature store", "The same features for model training and live scoring.", ["Point-in-time correct joins", "Online lookups in about 1 ms", "Consent-gated features"], "Feast, Valkey, Iceberg"],
    notify: ["notifications", "Statements, alerts and e-Tax invoices.", ["Event-driven", "Per-customer channel preferences", "e-Tax invoice per HP installment"], "Java 21, Kafka consumers"],
    platform: ["Platform", "Runs every service the same way, in a cell.", ["mTLS between all services", "Secrets in OpenBao, keys in the bank's HSM", "Traces, metrics and logs via OpenTelemetry", "GitOps with Argo CD, infra in OpenTofu"], "Kubernetes or OpenShift, Istio, Keycloak, OPA"]
  };
  function showArch(id, g) {
    var d = ARCH[id]; if (!d) return;
    $$("#archSvg .clk").forEach(function (x) { x.classList.toggle("sel", x.getAttribute("data-id") === id); });
    $("#archDetail").innerHTML = "<span class='label'>Component</span><h2>" + esc(d[0]) + "</h2><p>" + esc(d[1]) + "</p><ul class='rules'>" + d[2].map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul><div><span class='label'>Open-source stack</span><p class='mono' style='margin-top:4px;font-size:12.5px'>" + esc(d[3]) + "</p></div>";
  }
  $$("#archSvg .clk").forEach(function (g) {
    g.setAttribute("role", "button");
    g.setAttribute("aria-label", ARCH[g.getAttribute("data-id")][0]);
    g.addEventListener("click", function () { showArch(g.getAttribute("data-id")); });
    g.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); showArch(g.getAttribute("data-id")); } });
  });
  showArch("ledger");

  /* ---------- Routing ---------- */
  var VIEWS = ["overview", "builder", "customer", "contract", "assetfin", "trade", "treasury", "syndication", "studio", "ledger", "approvals", "agents", "branch", "corporate", "architecture", "modules", "settings"];
  var current = "overview";
  var TITLES = { overview: "Overview", customer: "Customer 360", contract: "Contracts", studio: "Product Studio", ledger: "Ledger", approvals: "Approvals", agents: "AI agents", architecture: "Architecture", modules: "Modules", settings: "Settings", branch: "Branch and teller", corporate: "Corporate banking", assetfin: "Fleet and floor plan", trade: "Trade finance", treasury: "Treasury", syndication: "Syndication", builder: "Master Builder" };
  function applyRoute() {
    var h = (location.hash || "").replace("#", "");
    current = VIEWS.indexOf(h) >= 0 ? h : "overview";
    VIEWS.forEach(function (v) { $("#view-" + v).hidden = v !== current; });
    $$(".nav").forEach(function (a) { if (a.getAttribute("data-view") === current) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
    $("#crumbGroup").textContent = current === "architecture" || current === "modules" ? "Blueprint" : current === "settings" ? "Account" : (current === "trade" || current === "treasury" || current === "syndication") ? "Markets and trade" : current === "branch" ? "Retail banking" : current === "corporate" ? "Commercial banking" : "Operate";
    var need = current === "branch" ? "retail" : current === "corporate" ? "commercial" : null;
    if (need && tenant !== need) setTenant(need, true);
    $("#crumbPage").textContent = TITLES[current];
    window.scrollTo(0, 0);
  }
  function route() {
    if (document.startViewTransition && !reduce && document.visibilityState === "visible") document.startViewTransition(applyRoute);
    else applyRoute();
  }
  window.addEventListener("hashchange", route);

  /* ---------- Toasts ---------- */
  function toast(msg) {
    var t = document.createElement("div");
    t.className = "toast";
    t.innerHTML = "<svg class='ico'><use href='#i-check'/></svg><span></span>";
    t.querySelector("span").textContent = msg;
    $("#toasts").appendChild(t);
    setTimeout(function () { t.remove(); }, 3200);
  }
  $("#bell").addEventListener("click", function () { toast("4 items need attention. See Overview."); });

  /* ---------- Theme: light, dark or follow the system ---------- */
  function setTheme(mode, save) {
    if (mode === "system") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", mode);
    $$("[data-theme-set]").forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-theme-set") === mode)); });
    var tr = $("#th-" + mode); if (tr) tr.checked = true;
    if (save) { try { localStorage.setItem("fabor-theme", mode); } catch (e) {} }
  }
  $$("[data-theme-set]").forEach(function (b) { b.addEventListener("click", function () { setTheme(b.getAttribute("data-theme-set"), true); }); });
  (function () { var m = null; try { m = localStorage.getItem("fabor-theme"); } catch (e) {} if (m === "light" || m === "dark") setTheme(m, false); else if (document.documentElement.getAttribute("data-theme")) setTheme(document.documentElement.getAttribute("data-theme"), false); })();


  /* ---------- Tenants: virtual, retail, commercial ---------- */
  var TENANTS = {
    virtual: { name: "Demo Virtual Bank", sub: "TH01 · Digital only", dep: "฿48.21bn", depD: "412,880 accounts", loan: "฿31.74bn", loanD: "96,415 contracts", npl: "2.14%", seg: null },
    retail: { name: "Demo Retail Bank", sub: "TH02 · 412 branches", dep: "฿612.40bn", depD: "6.2M accounts", loan: "฿488.90bn", loanD: "1.94M contracts", npl: "3.02%", seg: "Retail banking" },
    commercial: { name: "Demo Commercial Bank", sub: "TH03 · 38 business centres", dep: "฿905.70bn", depD: "84,300 accounts", loan: "฿1.12tn", loanD: "21,640 facilities", npl: "2.71%", seg: "Commercial banking" }
  };
  var tenant = "virtual";
  function setTenant(t, quiet) {
    tenant = t; var d = TENANTS[t];
    $("#wsName").textContent = d.name; $("#wsSub").textContent = d.sub;
    $("#kDep").textContent = d.dep; $("#kDepD").textContent = d.depD; $("#kLoan").textContent = d.loan; $("#kLoanD").textContent = d.loanD; $("#kNpl").textContent = d.npl;
    $("#segNav").hidden = !d.seg; if (d.seg) $("#segLabel").textContent = d.seg;
    $$("#segNav [data-seg]").forEach(function (a) { a.hidden = a.getAttribute("data-seg") !== t; });
    $$("[data-tenant]").forEach(function (b) { b.setAttribute("aria-current", String(b.getAttribute("data-tenant") === t)); });
    closeWs();
    if (!quiet) toast("Switched to " + d.name);
  }
  function closeWs() { $("#wsMenu").hidden = true; $("#wsBtn").setAttribute("aria-expanded", "false"); }
  $("#wsBtn").addEventListener("click", function (e) { e.stopPropagation(); var m = $("#wsMenu"); m.hidden = !m.hidden; this.setAttribute("aria-expanded", String(!m.hidden)); });
  $$("[data-tenant]").forEach(function (b) { b.addEventListener("click", function () { var t = b.getAttribute("data-tenant"); setTenant(t); location.hash = t === "retail" ? "branch" : t === "commercial" ? "corporate" : "overview"; }); });
  document.addEventListener("click", function (e) { if (!e.target.closest(".ws-wrap")) closeWs(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeWs(); });

  /* ---------- Retail: teller ---------- */
  var drawer = { open: 500000, cin: 186400, cout: 92250, limit: 1500000 };
  function renderDrawer() {
    var cur = drawer.open + drawer.cin - drawer.cout, pct = Math.min(100, cur / drawer.limit * 100);
    $("#drawer").innerHTML = "<dt>Opened 08:30</dt><dd class='num'>" + fmt(drawer.open) + "</dd><dt>Cash in</dt><dd class='num'>" + fmt(drawer.cin) + "</dd><dt>Cash out</dt><dd class='num'>" + fmt(drawer.cout) + "</dd><dt><strong>In drawer</strong></dt><dd class='num'><strong>" + fmt(cur) + "</strong></dd>";
    $("#drawerBar").style.width = pct.toFixed(1) + "%";
    $("#drawerBar").className = pct >= 80 ? "warn" : "";
    $("#drawerNote").textContent = pct >= 80 ? "Above 80% of the ฿1,500,000 drawer limit. Sweep excess cash to the vault." : "Drawer limit ฿1,500,000. The drawer is ledger account GL 1010-0123-04.";
  }
  $("#tPost").addEventListener("click", function () {
    var amt = r2(parseFloat($("#tAmt").value) || 0), acct = $("#tAcct").value, res = $("#tResult");
    res.hidden = false;
    if (amt <= 0) { res.className = "result warn"; res.textContent = "Enter an amount above zero."; return; }
    if (amt > 2000000) {
      res.className = "result warn"; res.textContent = "Needs a supervisor override. Sent to Approvals; the cash stays in the suspense tray until approved.";
      approvals.unshift({ id: "APR-" + (1060 + approvals.length), title: "Supervisor override · cash deposit ฿" + fmt(amt), kind: "Override", maker: "Teller 4 · Branch 0123", agent: null, detail: "Cash deposit above ฿2,000,000 to " + acct + ". AMLO cash transaction report will be filed.", status: "PENDING" });
      renderApprovals(); toast("Override request sent to Approvals"); return;
    }
    drawer.cin += amt; renderDrawer();
    batches.unshift({ id: bid(), time: nowTime(), value: "13 Oct 2026", actor: { type: "HUMAN", name: "Teller 4 · Branch 0123 Silom" }, reason: "Cash deposit · " + ($("#tRef").value || "counter"), legs: [
      { acct: "GL 1010-0123-04 Teller drawer · Silom", bt: "—", side: "DR", amt: amt, ccy: "THB" },
      { acct: acct, bt: "PRINCIPAL", side: "CR", amt: amt, ccy: "THB" } ] });
    renderBatches();
    res.className = "result ok"; res.textContent = "Posted ฿" + fmt(amt) + " to " + acct + ". Receipt printed and SMS sent. See it in Ledger.";
    toast("Cash deposit posted · ฿" + fmt(amt));
  });
  function renderMortgage() {
    var mrr = Math.max(0, parseFloat($("#mMrr").value) || 0) / 100, oldRate = 0.073 - 0.015, newRate = Math.max(0, mrr - 0.015);
    var P = 3214500, n = 262;
    var pay = function (r) { var m = r / 12; return m === 0 ? P / n : P * m / (1 - Math.pow(1 + m, -n)); };
    var oldPay = r2(pay(oldRate)), newPay = r2(pay(newRate)), el = $("#mResult");
    if ($("#mMode").value === "pay") {
      var diff = r2(newPay - oldPay);
      el.className = "result " + (diff <= 0 ? "ok" : "warn");
      el.innerHTML = "Rate " + (oldRate * 100).toFixed(2) + "% → <strong>" + (newRate * 100).toFixed(2) + "%</strong>. Installment ฿" + fmt(oldPay) + " → <strong>฿" + fmt(newPay) + "</strong> (" + (diff <= 0 ? "" : "+") + fmt(diff) + " a month).";
    } else {
      var m = newRate / 12, months = m === 0 ? Math.ceil(P / oldPay) : Math.ceil(-Math.log(1 - P * m / oldPay) / Math.log(1 + m));
      el.className = "result " + (months <= n ? "ok" : "warn");
      el.innerHTML = isFinite(months) ? "Rate " + (oldRate * 100).toFixed(2) + "% → <strong>" + (newRate * 100).toFixed(2) + "%</strong>. Installment stays ฿" + fmt(oldPay) + "; term " + n + " → <strong>" + months + " months</strong>." : "At this rate the current installment no longer covers interest. Choose Change installment.";
    }
  }
  $("#mMrr").addEventListener("input", renderMortgage); $("#mMode").addEventListener("change", renderMortgage);

  /* ---------- Commercial: credit application ---------- */
  var LEVELS = [["Branch credit head", 10, "Nattapong S."], ["Senior credit officer", 50, "Kanokwan R."], ["Credit committee", 200, "Weekly, Thursday"], ["Board credit committee", Infinity, "Monthly"]];
  function renderCredit() {
    var inc = Math.max(0, parseFloat($("#cInc").value) || 0), tenor = parseInt($("#cTenor").value, 10);
    var annualPay = inc * (1 / tenor + 0.035), cf = 73.8 + inc * 0.12, ds = 52.0 + annualPay, dscr = cf / ds;
    var groupUsed = 139.35 + inc, lvl = 0;
    while (inc > LEVELS[lvl][1]) lvl++;
    var c = [];
    c.push([dscr >= 1.25 ? "good" : "crit", dscr >= 1.25 ? "Pass" : "Fail", "Pro forma DSCR " + dscr.toFixed(2) + "x against the 1.25x covenant."]);
    c.push([groupUsed <= 250 ? "good" : "warn", groupUsed <= 250 ? "Pass" : "Check", "Group exposure ฿" + groupUsed.toFixed(1) + "M against a ฿250M group limit" + (groupUsed <= 250 ? "." : "; the group limit must be raised too.")]);
    c.push(["good", "Pass", "New trucks are collateral with title retained; loan to value 85% at a ฿" + (inc / 0.85).toFixed(1) + "M purchase price."]);
    $("#cChecks").innerHTML = c.map(function (x) { return "<div><span class='chip " + x[0] + "'>" + x[1] + "</span><span>" + x[2] + "</span></div>"; }).join("");
    $("#cMatrix").innerHTML = LEVELS.map(function (L, i) { return "<tr class='" + (i === lvl ? "on" : "") + "'><td>" + L[0] + "</td><td class='num'>" + (isFinite(L[1]) ? "฿" + L[1] + "M" : "Above ฿200M") + "</td><td>" + L[2] + "</td></tr>"; }).join("");
    $("#cRouteNote").textContent = "Goes to " + LEVELS[lvl][0].toLowerCase() + (dscr < 1.25 ? ", flagged as a covenant exception." : ".");
    return { inc: inc, lvl: lvl, dscr: dscr };
  }
  $("#cInc").addEventListener("input", renderCredit); $("#cTenor").addEventListener("change", renderCredit);
  $("#cRoute").addEventListener("click", function () {
    var r = renderCredit();
    approvals.unshift({ id: "APR-" + (1070 + approvals.length), title: "Credit application CA-2026-0412 · leasing line +฿" + r.inc + "M", kind: "Credit", maker: "Wanida K. · RM", agent: null, detail: "Siam Freight Logistics. Pro forma DSCR " + r.dscr.toFixed(2) + "x. Routed to " + LEVELS[r.lvl][0] + ".", status: "PENDING" });
    renderApprovals(); toast("CA-2026-0412 routed to " + LEVELS[r.lvl][0]);
  });
  $("#bulkAuth").addEventListener("click", function () {
    $("#bulkStatus").innerHTML = "<span class='chip good'>Authorized · releasing 410 payments</span>";
    this.disabled = true; toast("Payroll file authorized · 410 payments released");
  });
  renderDrawer(); renderMortgage(); renderCredit();

  /* ---------- Asset finance: fleet ---------- */
  function showAf(which) {
    $("#af-fleet").hidden = which !== "fleet"; $("#af-floor").hidden = which !== "floor";
    $$("[data-af]").forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-af") === which)); });
  }
  $$("[data-af]").forEach(function (b) { b.addEventListener("click", function () { showAf(b.getAttribute("data-af")); }); });
  var FLEET_LIMIT = 80000000, FLAT = { 48: 0.031, 60: 0.0325, 72: 0.0345 };
  var fleet = [
    { id: "S-01", model: "Isuzu FVM 6-wheel", units: 12, per: 2082500, n: 60, flat: 0.032, start: new Date(2024, 1, 10), cc: "CC-120 Line haul" },
    { id: "S-02", model: "Hino 500 FG 6-wheel", units: 10, per: 2210000, n: 60, flat: 0.032, start: new Date(2024, 7, 10), cc: "CC-120 Line haul" },
    { id: "S-03", model: "Isuzu NLR reefer", units: 8, per: 1402500, n: 48, flat: 0.031, start: new Date(2025, 2, 10), cc: "CC-210 Cold chain" },
    { id: "S-04", model: "Isuzu D-Max Spark pickup", units: 8, per: 476000, n: 60, flat: 0.0325, start: new Date(2025, 9, 10), cc: "CC-300 Last mile" }
  ];
  function fleetCalc(f) {
    var sch = buildSchedule({ principal: f.per, rate: f.flat, rateType: "FLAT", n: f.n, balloonPct: 0, vat: true, firstDue: addMonths(f.start, 1) });
    var paid = sch.rows.filter(function (x) { return x.due <= BUSINESS_DATE; }).length;
    var outPer = paid === 0 ? f.per : sch.rows[paid - 1].bal;
    return { monthly: r2(sch.rows[0].total * f.units), out: r2(outPer * f.units), inst: sch.rows[0].total, end: addMonths(f.start, f.n), eir: sch.eir };
  }
  function renderFleet() {
    var units = 0, out = 0, inv = 0;
    $("#fTable").innerHTML = fleet.map(function (f) {
      var c = fleetCalc(f); units += f.units; out += c.out; inv += c.monthly;
      return "<tr><td class='mono'>" + f.id + "</td><td>" + esc(f.model) + "</td><td class='num'>" + f.units + "</td><td class='num'>" + fmt(f.per) + "</td><td class='mono'>" + f.n + "m · " + (f.flat * 100).toFixed(2) + "%</td><td class='mono'>" + fdate(f.start) + "</td><td class='num'>" + fmt(c.monthly) + "</td><td class='num'>" + fmt(c.out) + "</td><td>" + esc(f.cc) + "</td></tr>";
    }).join("");
    $("#fUnits").textContent = units; $("#fSched").textContent = fleet.length + " schedules";
    $("#fOut").textContent = "฿" + (out / 1e6).toFixed(1) + "M"; $("#fLim").textContent = "of ฿80.0M · " + (out / FLEET_LIMIT * 100).toFixed(0) + "% used";
    $("#fInv").textContent = "฿" + fmt0(inv);
    return out;
  }
  function fleetQuote() {
    var parts = $("#fModel").value.split("|"), price = +parts[1], count = Math.max(1, parseInt($("#fCount").value, 10) || 1);
    var down = Math.min(50, Math.max(0, parseFloat($("#fDown").value) || 0)) / 100, n = parseInt($("#fTerm").value, 10);
    var latest = fleet.reduce(function (a, f) { return addMonths(f.start, f.n) > a ? addMonths(f.start, f.n) : a; }, new Date(0));
    if ($("#fCoterm").checked) { var start = addMonths(BUSINESS_DATE, 0); n = Math.max(12, (latest.getFullYear() - start.getFullYear()) * 12 + latest.getMonth() - start.getMonth()); }
    var flat = FLAT[n] || FLAT[60];
    var f = { id: "S-0" + (fleet.length + 1), model: parts[0], units: count, per: r2(price * (1 - down)), n: n, flat: flat, start: BUSINESS_DATE, cc: $("#fCC").value };
    var c = fleetCalc(f), out = renderFleet(), avail = FLEET_LIMIT - out, need = f.per * count;
    var ok = need <= avail;
    $("#fResult").className = "result " + (ok ? "ok" : "warn");
    $("#fResult").innerHTML = count + " × " + esc(f.model) + ", financed ฿" + fmt0(need) + " over " + n + " months at " + (flat * 100).toFixed(2) + "% flat (" + (c.eir * 100).toFixed(2) + "% effective). Adds <strong>฿" + fmt(c.monthly) + "</strong> a month with VAT." +
      (ok ? " Within the available ฿" + (avail / 1e6).toFixed(1) + "M." : " Exceeds the available ฿" + (avail / 1e6).toFixed(1) + "M; needs a limit increase (see Corporate banking).");
    $("#fAdd").disabled = !ok;
    return ok ? f : null;
  }
  $$("#fForm input, #fForm select").forEach(function (el) { el.addEventListener("input", fleetQuote); el.addEventListener("change", fleetQuote); });
  $("#fAdd").addEventListener("click", function () {
    var f = fleetQuote(); if (!f) return;
    fleet.push(f); renderFleet(); fleetQuote();
    batches.unshift({ id: bid(), time: nowTime(), value: "13 Oct 2026", actor: { type: "SYSTEM", name: "leasing · fleet call-off" }, reason: "Fleet schedule " + f.id + " activated · MA-2025-0031 · paid to dealer", legs: [
      { acct: "MA-2025-0031/" + f.id, bt: "PRINCIPAL", side: "DR", amt: r2(f.per * f.units), ccy: "THB" },
      { acct: "GL 2310 Dealer settlement payable", bt: "—", side: "CR", amt: r2(f.per * f.units), ccy: "THB" } ] });
    renderBatches();
    toast("Schedule " + f.id + " created · " + f.units + " vehicles");
  });

  /* ---------- Asset finance: floor plan ---------- */
  var FP_LINE = 150000000, FP_RATE = 0.055;
  var units = [
    { vin: "MR0BA3CD7P0412287", model: "Fortuner Legender", type: "New", amt: 1532000, days: 41, free: 60, sot: true },
    { vin: "MR0HA3CD1P0409915", model: "Hilux Revo Rocco", type: "New", amt: 1095000, days: 18, free: 60 },
    { vin: "MR2B29F30P1178203", model: "Yaris Ativ", type: "New", amt: 498000, days: 77, free: 60 },
    { vin: "MR2K29F30P1170044", model: "Corolla Cross HEV", type: "New", amt: 1089000, days: 126, free: 60 },
    { vin: "JTMHX3JH5P4019775", model: "Alphard HEV", type: "New", amt: 4120000, days: 188, free: 60 },
    { vin: "MR0FB3CD8M0371120", model: "Hilux Revo 2021", type: "Used", amt: 512000, days: 64, free: 0 },
    { vin: "MR2B29F30N1102671", model: "Yaris 2022", type: "Used", amt: 338000, days: 133, free: 0 },
    { vin: "MR0HA3CD4P0399982", model: "Hilux Champ", type: "Demo", amt: 455000, days: 92, free: 30 }
  ];
  function curtailPct(d) { return d >= 270 ? 1 : d >= 180 ? 0.25 : d >= 120 ? 0.10 : 0; }
  function renderFloor() {
    var out = 0, due = 0, mix = { New: 0, Used: 0, Demo: 0 }, live = 0;
    $("#pTable").innerHTML = units.map(function (u, i) {
      if (u.paid) return "<tr class='paid'><td class='mono'>" + u.vin + "</td><td>" + u.model + "</td><td>" + u.type + "</td><td class='num'>" + fmt(u.amt) + "</td><td class='num'>" + u.days + "</td><td><span class='chip good'>Paid off · " + esc(u.paid) + "</span></td><td class='num'>—</td><td class='num'>—</td><td></td></tr>";
      live++; mix[u.type]++; out += u.amt;
      var billable = Math.max(0, Math.min(30, u.days - u.free));
      var interest = r2(u.amt * FP_RATE * billable / 365);
      var pct = curtailPct(u.days), crossed = curtailPct(u.days) > curtailPct(u.days - 30), curt = crossed ? r2(u.amt * (pct - curtailPct(u.days - 30))) : 0;
      due += interest + curt;
      var st = u.sot ? "<span class='chip agent'>Check: sold?</span>" : u.days <= u.free ? "<span class='chip'>Free period</span>" : curt > 0 ? "<span class='chip warn'>Curtailment " + (pct * 100) + "%</span>" : "<span class='chip acc'>Interest bearing</span>";
      return "<tr" + (u.sot ? " class='hl'" : "") + "><td class='mono'>" + u.vin + "</td><td>" + u.model + "</td><td>" + u.type + "</td><td class='num'>" + fmt(u.amt) + "</td><td class='num'>" + u.days + "</td><td>" + st + "</td><td class='num'>" + fmt(interest) + "</td><td class='num'>" + (curt ? fmt(curt) : "—") + "</td><td><button class='btn' type='button' data-sell='" + i + "' style='padding:4px 10px;font-size:12.5px;white-space:nowrap'>Record sale</button></td></tr>";
    }).join("");
    $("#pUnits").textContent = live; $("#pMix").textContent = mix.New + " new · " + mix.Used + " used · " + mix.Demo + " demo";
    $("#pOut").textContent = "฿" + (out / 1e6).toFixed(1) + "M"; $("#pLim").textContent = "of ฿150.0M · " + (out / FP_LINE * 100).toFixed(0) + "% used";
    $("#pDue").textContent = "฿" + fmt0(due);
    $$("[data-sell]").forEach(function (b) { b.addEventListener("click", function () { sellUnit(+b.getAttribute("data-sell")); }); });
  }
  function sellUnit(i) {
    var u = units[i], ownHp = !u.sot;
    u.paid = ownHp ? "from retail HP payout" : "dealer repaid";
    batches.unshift({ id: bid(), time: nowTime(), value: "13 Oct 2026", actor: { type: "SYSTEM", name: "leasing · floor plan" }, reason: "Floor plan payoff " + u.vin + (ownHp ? " · netted from retail HP disbursement" : " · dealer transfer"), legs: [
      { acct: ownHp ? "GL 2310 Dealer settlement payable (retail HP payout)" : "GL 1190 PromptPay settlement", bt: "—", side: "DR", amt: u.amt, ccy: "THB" },
      { acct: "FP-2026-0007/" + u.vin.slice(-6), bt: "PRINCIPAL", side: "CR", amt: u.amt, ccy: "THB" } ] });
    if (u.sot) { u.sot = false; $("#sotAlert").hidden = true; }
    renderBatches(); renderFloor();
    toast(u.model + " paid off · ฿" + fmt(u.amt));
  }
  $("#sotAudit").addEventListener("click", function () {
    approvals.unshift({ id: "APR-" + (1080 + approvals.length), title: "Stock audit · Bangna Motors · VIN MR0BA3CD7P0412287", kind: "Audit", maker: "Collections agent", agent: "on behalf of Floor plan desk", detail: "Unit registered to a retail buyer on 9 Oct 2026 and not repaid. Field auditor to sight remaining 7 units within 24 hours; dealer line frozen for new drawdowns until resolved.", status: "PENDING" });
    renderApprovals(); toast("Stock audit opened and dealer line frozen");
  });
  renderFleet(); fleetQuote(); renderFloor();

  /* ---------- Trade finance ---------- */
  var LC_STEPS = ["Applied", "Issued MT700", "Amended MT707", "Documents presented", "Examination", "Accepted", "Paid at maturity"];
  var lcAt = 4;
  function renderLc() {
    $("#lcSteps").innerHTML = LC_STEPS.map(function (t, i) { return "<li class='" + (i < lcAt ? "done" : i === lcAt && lcAt === 4 ? "now" : "") + "'>" + (i < lcAt ? "✓ " : "") + t + "</li>"; }).join("");
  }
  var LC_DOCS = [
    ["good", "OK", "Commercial invoice: USD 1,236,400.00, within the ±5% tolerance (field 39A)."],
    ["crit", "Discrepancy", "Bill of lading: shipped on board 2 Oct 2026, after the latest shipment date 30 Sep 2026 (field 44C)."],
    ["crit", "Discrepancy", "Bill of lading: port of discharge Bangkok Port; LC requires Laem Chabang (field 44F)."],
    ["good", "OK", "Insurance certificate: 110% of CIF value, covering Institute Cargo Clauses (A) (field 46A)."],
    ["good", "OK", "Packing list and certificate of origin (Japan) consistent with the invoice."],
    ["good", "OK", "Screening: parties, vessel NYK Aurora, ports and goods (HS 8418) clear."]
  ];
  $("#lcDocs").innerHTML = LC_DOCS.map(function (d) { return "<div><span class='chip " + d[0] + "'>" + d[1] + "</span><span>" + d[2] + "</span></div>"; }).join("");
  $("#lcAccept").addEventListener("click", function () {
    var amt = 1236400, res = $("#lcResult");
    lcAt = 6; renderLc();
    $("#lcStatus").textContent = "Accepted · matures 31 Dec 2026"; $("#lcStatus").className = "chip good";
    batches.unshift({ id: bid(), time: nowTime(), value: "13 Oct 2026", actor: { type: "HUMAN", name: "Trade checker · waiver from applicant" }, reason: "LC-IMP-2026-0188 accepted · contingent to acceptance liability", legs: [
      { acct: "LC-IMP-2026-0188 · contra (memo)", bt: "CONTINGENT_LC", side: "DR", amt: amt, ccy: "USD" },
      { acct: "LC-IMP-2026-0188", bt: "CONTINGENT_LC", side: "CR", amt: amt, ccy: "USD" },
      { acct: "Customer liability on acceptance · Siam Freight", bt: "PRINCIPAL", side: "DR", amt: amt, ccy: "USD" },
      { acct: "GL 2420 Acceptances payable", bt: "—", side: "CR", amt: amt, ccy: "USD" } ] });
    renderBatches();
    res.hidden = false; res.className = "result ok";
    res.textContent = "Accepted with the applicant's waiver. MT732 sent; USD 1,236,400.00 moved from contingent to acceptance liability, payable 31 Dec 2026.";
    this.disabled = true; $("#lcRefuse").disabled = true;
    toast("LC accepted · acceptance liability booked");
  });
  $("#lcRefuse").addEventListener("click", function () {
    var res = $("#lcResult"); res.hidden = false; res.className = "result warn";
    res.textContent = "Refusal drafted as MT734 listing 2 discrepancies; documents held at the presenter's disposal pending instructions. Sent to a second checker.";
    approvals.unshift({ id: "APR-" + (1090 + approvals.length), title: "Refuse presentation · LC-IMP-2026-0188", kind: "Trade", maker: "Trade examiner", agent: null, detail: "Late shipment (2 Oct vs 30 Sep) and port of discharge. MT734 must go before 15 Oct 2026.", status: "PENDING" });
    renderApprovals(); toast("MT734 refusal sent for second check");
  });
  renderLc();

  /* ---------- Treasury ---------- */
  var POS = [
    { c: "USD", pos: 18400000, mid: 36.50, lim: 1000e6 },
    { c: "EUR", pos: -3100000, mid: 39.70, lim: 300e6 },
    { c: "JPY", pos: 420000000, mid: 0.2440, lim: 250e6 },
    { c: "SGD", pos: 2600000, mid: 27.95, lim: 150e6 },
    { c: "CNY", pos: -12000000, mid: 5.08, lim: 150e6 }
  ];
  function renderPos() {
    var longs = 0, shorts = 0;
    $("#posTable").innerHTML = POS.map(function (p) {
      var thb = p.pos * p.mid, pct = Math.min(100, Math.abs(thb) / p.lim * 100); if (thb >= 0) longs += thb; else shorts -= thb;
      return "<tr><td class='mono'>" + p.c + "</td><td class='num " + (p.pos >= 0 ? "up" : "down") + "'>" + (p.pos >= 0 ? "+" : "") + fmt0(p.pos) + "</td><td class='num'>" + p.mid.toFixed(p.mid < 1 ? 4 : 2) + "</td><td class='num'>" + fmt0(thb) + "</td><td><div class='mini' title='" + pct.toFixed(0) + "% of ฿" + fmt0(p.lim) + "'><span class='" + (pct > 75 ? "warn" : "") + "' style='width:" + pct.toFixed(1) + "%'></span></div></td></tr>";
    }).join("");
    $("#nop").textContent = "฿" + (Math.max(longs, shorts) / 1e6).toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "M";
  }
  function fxQuote() {
    var usd = POS[0], side = $("#fxSide").value, amt = Math.max(0, parseFloat($("#fxAmt").value) || 0), fwd = $("#fxType").value === "fwd";
    var pts = fwd ? -0.055 : 0, margin = 0.08, rate = r2((usd.mid + pts + (side === "sell" ? -margin : margin)) * 100) / 100;
    $("#fxQuote").className = "result";
    $("#fxQuote").innerHTML = "Customer " + (side === "sell" ? "sells" : "buys") + " USD " + fmt0(amt) + " at <strong>" + rate.toFixed(4) + "</strong> (" + (fwd ? "mid " + usd.mid.toFixed(2) + ", forward points " + pts.toFixed(3) : "mid " + usd.mid.toFixed(2)) + ", margin 0.08). THB " + fmt(r2(amt * rate)) + ". Counterparty and settlement limits OK.";
    return { side: side, amt: amt, rate: rate };
  }
  $$("#fxForm select, #fxForm input").forEach(function (el) { el.addEventListener("input", fxQuote); el.addEventListener("change", fxQuote); });
  $("#fxBook").addEventListener("click", function () {
    var q = fxQuote(); if (!q.amt) return;
    var thb = r2(q.amt * q.rate), sell = q.side === "sell";
    POS[0].pos += sell ? q.amt : -q.amt; renderPos();
    batches.unshift({ id: bid(), time: nowTime(), value: $("#fxType").value === "fwd" ? "13 Nov 2026" : "15 Oct 2026", actor: { type: "HUMAN", name: "FX desk · Siam Freight Logistics" }, reason: "Customer FX " + (sell ? "sells" : "buys") + " USD at " + q.rate.toFixed(4), legs: [
      { acct: "FCD-0090-55120 · Siam Freight", bt: "PRINCIPAL", side: sell ? "DR" : "CR", amt: q.amt, ccy: "USD" },
      { acct: "GL 1810 FX position USD", bt: "—", side: sell ? "CR" : "DR", amt: q.amt, ccy: "USD" },
      { acct: "GL 1811 FX position THB", bt: "—", side: sell ? "DR" : "CR", amt: thb, ccy: "THB" },
      { acct: "CUR-0090-55100 · Siam Freight", bt: "PRINCIPAL", side: sell ? "CR" : "DR", amt: thb, ccy: "THB" } ] });
    renderBatches(); toast("FX deal booked · USD position updated");
  });
  var NOSTRO = [
    ["MT950 :61: CHIPS in, ref INV-88231", 412500.00, "PB-20261012-88021 · export proceeds", "auto"],
    ["MT950 :61: Fedwire out, ref LC-IMP-2026-0141", -864000.00, "PB-20261012-87990 · LC payment", "auto"],
    ["MT950 :61: CLS pay-in, ref FX-2026-55210", -2000000.00, "PB-20261012-87412 · FX swap leg", "auto"],
    ["MT950 :61: Fedwire in, ref SFL-PO-7781", 249975.00, "", "break"],
    ["MT950 :61: Interest credit Sep", 1184.22, "PB-20261001-10012 · nostro interest", "auto"]
  ];
  function renderNostro() {
    var breaks = NOSTRO.filter(function (n) { return n[3] === "break"; }).length;
    $("#nostroTable").innerHTML = NOSTRO.map(function (n, i) {
      var st = n[3] === "auto" ? "<span class='chip good'>Auto-matched</span>" : n[3] === "ai" ? "<span class='chip good'>Matched · AI proposal accepted</span>" :
        "<div style='display:flex;flex-direction:column;gap:6px'><span class='chip agent'>AI proposal</span><span style='font-size:12.5px'>Matches customer receipt of USD 250,000.00 from Siam Freight less USD 25.00 intermediary charge. Book the charge to GL 5230.</span><button class='btn' type='button' data-nostro='" + i + "' style='align-self:flex-start;padding:4px 10px;font-size:12.5px'>Accept proposal</button></div>";
      return "<tr><td>" + n[0] + "</td><td class='num'>" + fmt(n[1]) + "</td><td>" + (n[2] || "—") + "</td><td>" + st + "</td></tr>";
    }).join("");
    $("#nostroChip").textContent = breaks ? breaks + " break" : "All matched"; $("#nostroChip").className = "chip " + (breaks ? "warn" : "good");
    $("#nostroRate").textContent = breaks ? "97.8%" : "100%";
    $$("[data-nostro]").forEach(function (b) { b.addEventListener("click", function () { var n = NOSTRO[+b.getAttribute("data-nostro")]; n[3] = "ai"; n[2] = "PB-20261013-88102 · receipt USD 250,000.00 less charge 25.00"; renderNostro(); toast("Nostro break matched"); }); });
  }
  setInterval(function () {
    if (current !== "treasury" || document.hidden || reduce || document.documentElement.getAttribute("data-style") === "calm") return;
    POS.forEach(function (p) { p.mid = p.mid * (1 + (Math.random() - 0.5) * 0.0006); });
    renderPos(); fxQuote();
  }, 2000);
  renderPos(); fxQuote(); renderNostro();

  /* ---------- Syndication ---------- */
  var COMMIT = 6000e6, DRAWN = 3600e6, MARGIN = 0.0185;
  var LENDERS = [
    { n: "Demo Commercial Bank (agent)", s: 0.25, agent: true },
    { n: "Andaman Bank", s: 0.20 }, { n: "Chao Phraya Bank", s: 0.20 }, { n: "Lanna Bank", s: 0.20 }, { n: "Siam Infrastructure Fund", s: 0.15 }
  ];
  function proRata(total) {
    var satang = Math.round(total * 100), parts = LENDERS.map(function (l) { return Math.floor(satang * l.s); });
    var resid = satang - parts.reduce(function (a, b) { return a + b; }, 0), ai = LENDERS.findIndex(function (l) { return l.agent; });
    parts[ai] += resid;
    return parts.map(function (p) { return p / 100; });
  }
  function renderSyn() {
    $("#synReg").innerHTML = LENDERS.map(function (l) { return "<tr><td>" + esc(l.n) + "</td><td class='num'>" + (l.s * 100).toFixed(2) + "%</td><td class='num'>" + fmt0(COMMIT * l.s) + "</td><td class='num'>" + fmt0(DRAWN * l.s) + "</td></tr>"; }).join("");
    $("#synDrawn").textContent = "Drawn ฿" + fmt0(DRAWN / 1e6) + "M · available ฿" + fmt0((COMMIT - DRAWN) / 1e6) + "M";
    $("#synLenders").textContent = LENDERS.length;
    var opts = LENDERS.map(function (l, i) { return "<option value='" + i + "'>" + esc(l.n) + "</option>"; }).join("");
    var f = $("#trFrom").value, t = $("#trTo").value;
    $("#trFrom").innerHTML = opts; $("#trTo").innerHTML = opts + "<option value='new'>Bangkok Pension Fund (new lender)</option>";
    $("#trFrom").value = f || "3"; $("#trTo").value = t || "new";
    renderDd(); renderRfr(); trQuote();
  }
  function renderDd() {
    var amt = Math.max(0, parseFloat($("#ddAmt").value) || 0) * 1e6, avail = COMMIT - DRAWN;
    if (amt > avail) { $("#ddTable").innerHTML = "<tr><td colspan='2' class='err'>Exceeds the available ฿" + fmt0(avail / 1e6) + "M.</td></tr>"; $("#ddSend").disabled = true; return; }
    $("#ddSend").disabled = amt <= 0;
    var parts = proRata(amt);
    $("#ddTable").innerHTML = LENDERS.map(function (l, i) { return "<tr><td>" + esc(l.n) + "</td><td class='num'>" + fmt(parts[i]) + "</td></tr>"; }).join("") + "<tr><td><strong>Total</strong></td><td class='num'><strong>" + fmt(amt) + "</strong></td></tr>";
  }
  function renderRfr() {
    var start = new Date(2026, 8, 15), end = new Date(2026, 9, 15), days = Math.round((end - start) / 86400000), seed = 3, prod = 1, d = new Date(start), last = 1.48, bdays = 0;
    var rnd = function () { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    while (d < end) {
      var dow = d.getDay(), n = 1;
      if (dow === 5) n = 3; else if (dow === 6 || dow === 0) { d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1); continue; }
      last = Math.max(1.30, Math.min(1.60, last + (rnd() - 0.5) * 0.02)); bdays++;
      prod *= 1 + (last / 100) * n / 365;
      d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
    }
    var comp = (prod - 1) * 365 / days, allIn = comp + MARGIN, interest = r2(DRAWN * allIn * days / 365);
    $("#rfrCalc").innerHTML = "<dt>Observation</dt><dd>" + bdays + " business days, 5-day lookback</dd><dt>Compounded THOR</dt><dd class='mono'>" + (comp * 100).toFixed(5) + "%</dd><dt>All-in rate</dt><dd class='mono'>" + (allIn * 100).toFixed(5) + "%</dd><dt>On drawn</dt><dd class='mono'>" + fmt(DRAWN) + " × " + days + "/365</dd><dt><strong>Interest due</strong></dt><dd class='mono'><strong>" + fmt(interest) + "</strong></dd>";
    var parts = proRata(interest);
    $("#rfrDist").innerHTML = LENDERS.map(function (l, i) { return "<tr><td>" + esc(l.n) + "</td><td class='num'>" + fmt(parts[i]) + "</td></tr>"; }).join("");
  }
  function trQuote() {
    var from = LENDERS[+$("#trFrom").value], to = $("#trTo").value, pct = Math.max(0, parseFloat($("#trPct").value) || 0) / 100, el = $("#trResult");
    if (!from) return null;
    if (to === $("#trFrom").value) { el.className = "result warn"; el.textContent = "Seller and buyer must be different."; return null; }
    if (pct > from.s + 1e-9) { el.className = "result warn"; el.textContent = esc(from.n) + " holds only " + (from.s * 100).toFixed(2) + "%."; return null; }
    var accrued = r2(DRAWN * pct * (MARGIN + 0.0148) * 5 / 365);
    el.className = "result"; el.innerHTML = "Transfers ฿" + fmt0(COMMIT * pct) + " commitment (฿" + fmt0(DRAWN * pct) + " drawn). Interest accrued from 15 Oct to settlement, about ฿" + fmt(accrued) + ", goes to the seller; the buyer earns from 20 Oct.";
    return { from: from, to: to, pct: pct };
  }
  $("#ddAmt").addEventListener("input", renderDd);
  $("#ddSend").addEventListener("click", function () { var amt = (parseFloat($("#ddAmt").value) || 0); toast("Funding notices sent to " + LENDERS.length + " lenders · ฿" + fmt0(amt) + "M"); });
  ["#trFrom", "#trTo", "#trPct"].forEach(function (id) { $(id).addEventListener("input", trQuote); $(id).addEventListener("change", trQuote); });
  $("#trBook").addEventListener("click", function () {
    var q = trQuote(); if (!q) return;
    q.from.s = r2((q.from.s - q.pct) * 10000) / 10000;
    if (q.to === "new") LENDERS.push({ n: "Bangkok Pension Fund", s: q.pct }); else LENDERS[+q.to].s = r2((LENDERS[+q.to].s + q.pct) * 10000) / 10000;
    LENDERS = LENDERS.filter(function (l) { return l.s > 0; });
    $("#trFrom").value = ""; $("#trTo").value = "";
    renderSyn(); toast("Transfer recorded · lender register updated");
  });
  renderSyn();

  /* ---------- Master Builder ---------- */
  var MB_FAM = { HP_NEW: "Hire purchase · new car", HP_USED: "Hire purchase · used car", HP_MOTO: "Hire purchase · motorcycle", LEASE: "Finance lease · equipment", PL: "Personal loan", HOME: "Home loan" };
  var MB_TPL = {
    HP_NEW: { code: "AUTO_HP_NEW", family: "HP_NEW", rateType: "FLAT", rate: 2.79, base: 0, minAmt: 100000, maxAmt: 5000000, terms: [12, 24, 36, 48, 60, 72, 84], sampleAmt: 840000, sampleTerm: 60, balloon: 0, grace: 0, method: "ANNUITY", feePct: 0, vat: true, lateRate: 15, nonAccrual: 90, writeOff: 360, prepay: true, prepayFee: 0, holidays: 1, waterfall: ["FEES_DUE", "PENALTY_DUE", "VAT_DUE", "INTEREST_DUE", "PRINCIPAL_DUE"], income: "EIR", gl: "hp_standard_th_v2" },
    HP_USED: { code: "AUTO_HP_USED", family: "HP_USED", rateType: "FLAT", rate: 4.5, minAmt: 100000, maxAmt: 2000000, terms: [12, 24, 36, 48, 60, 72], sampleAmt: 450000, sampleTerm: 48 },
    HP_MOTO: { code: "MOTO_HP", family: "HP_MOTO", rateType: "FLAT", rate: 9.5, minAmt: 20000, maxAmt: 150000, terms: [12, 24, 36, 48], sampleAmt: 65000, sampleTerm: 36 },
    LEASE: { code: "EQUIP_FIN_LEASE", family: "LEASE", rateType: "EFFECTIVE", rate: 6.25, minAmt: 500000, maxAmt: 50000000, terms: [24, 36, 48, 60], sampleAmt: 3500000, sampleTerm: 48, balloon: 10, gl: "lease_tfrs16_v1" },
    PL: { code: "PERSONAL_LOAN", family: "PL", rateType: "EFFECTIVE", rate: 18, minAmt: 20000, maxAmt: 1000000, terms: [12, 24, 36, 48, 60], sampleAmt: 200000, sampleTerm: 36, vat: false, feePct: 1, waterfall: ["FEES_DUE", "PENALTY_DUE", "INTEREST_DUE", "PRINCIPAL_DUE"], gl: "loan_standard_th_v1" },
    HOME: { code: "HOME_LOAN_FLOAT", family: "HOME", rateType: "FLOATING", rate: -1.5, base: 6.95, minAmt: 500000, maxAmt: 20000000, terms: [120, 180, 240, 300, 360], sampleAmt: 3000000, sampleTerm: 360, vat: false, prepayFee: 3, holidays: 0, waterfall: ["FEES_DUE", "PENALTY_DUE", "INTEREST_DUE", "PRINCIPAL_DUE"], gl: "mortgage_th_v1" }
  };
  function mbFrom(key) { var b = JSON.parse(JSON.stringify(MB_TPL.HP_NEW)); var t = MB_TPL[key]; Object.keys(t).forEach(function (k) { b[k] = JSON.parse(JSON.stringify(t[k])); }); b.template = key; return b; }
  var B = mbFrom("HP_NEW"), BASE = JSON.parse(JSON.stringify(B)), mbStep = 0;
  var MB_STEPS = ["Basics", "Pricing", "Schedule", "Fees and tax", "Repayment and arrears", "Changes and early settlement", "Accounting", "Review and simulate"];
  var ALL_TERMS = [6, 12, 18, 24, 36, 48, 60, 72, 84, 120, 180, 240, 300, 360];
  function annualRate() { return (B.rateType === "FLOATING" ? B.base + B.rate : B.rate) / 100; }
  function mbSchedule(P, n) {
    var bal = Math.min(50, Math.max(0, B.balloon)) / 100;
    if (B.method === "EQUAL_PRINCIPAL" && B.rateType !== "FLAT") {
      var r = annualRate() / 12, pr = r2(P / n), rows = [], b = P, si = 0;
      for (var k = 1; k <= n; k++) { var it = r2(b * r), pp = k === n ? b : pr; b = r2(b - pp); si += it; rows.push({ pay: r2(pp + it), interest: it, principal: pp, bal: b, vat: B.vat ? r2((pp + it) * VAT) : 0 }); }
      return { rows: rows, inst: rows[0].pay, eir: annualRate(), totalInterest: r2(si), balloon: 0 };
    }
    var s = buildSchedule({ principal: P, rate: annualRate(), rateType: B.rateType === "FLAT" ? "FLAT" : "EFFECTIVE", n: n, balloonPct: bal, vat: B.vat, firstDue: addMonths(BUSINESS_DATE, 1) });
    if (B.grace > 0 && B.rateType !== "FLAT") {
      var gi = r2(P * annualRate() / 12), g = [];
      for (var i = 0; i < B.grace; i++) g.push({ pay: gi, interest: gi, principal: 0, bal: P, vat: B.vat ? r2(gi * VAT) : 0 });
      s.rows = g.concat(s.rows); s.totalInterest = r2(s.totalInterest + gi * B.grace);
    }
    return s;
  }
  function mbChecks() {
    var c = [], cap = CAPS[B.family === "HOME" ? "PL" : B.family], P = B.sampleAmt, n = B.sampleTerm;
    var s = mbSchedule(P, n), fee = r2(P * B.feePct / 100);
    var eir = solveMonthlyRate(P - fee, s.rows.map(function (x) { return x.pay; })) * 12;
    var add = function (step, lvl, msg) { c.push({ step: step, lvl: lvl, msg: msg }); };
    if (!/^[A-Z][A-Z0-9_]{2,30}$/.test(B.code)) add(0, "crit", "Product code must be 3–31 capital letters, digits or underscores.");
    if (B.minAmt <= 0 || B.minAmt >= B.maxAmt) add(1, "crit", "Minimum amount must be above zero and below the maximum.");
    if (P < B.minAmt || P > B.maxAmt) add(1, "crit", "Example amount ฿" + fmt0(P) + " is outside ฿" + fmt0(B.minAmt) + "–" + fmt0(B.maxAmt) + ".");
    if (B.family === "HOME") { if (B.rateType !== "FLOATING") add(1, "warn", "Home loans in this market are usually floating (MRR ± spread)."); }
    else if (cap) add(1, eir <= cap + 1e-9 ? "good" : "crit", "Effective rate " + (eir * 100).toFixed(2) + "% against the " + (cap * 100).toFixed(0) + "% cap for " + MB_FAM[B.family].toLowerCase() + ".");
    else add(1, "good", "No regulatory rate cap for equipment finance leases.");
    if (B.rateType === "FLAT" && B.family.indexOf("HP") !== 0) add(1, "warn", "Flat rates are normally used only for hire purchase; disclose the effective rate.");
    if (!B.terms.length) add(2, "crit", "Choose at least one term.");
    else if (B.terms.indexOf(n) < 0) add(2, "crit", "Example term " + n + " months is not one of the allowed terms.");
    if (B.balloon > 0 && ["HP_NEW", "HP_USED", "LEASE"].indexOf(B.family) < 0) add(2, "crit", "Balloon or residual value applies only to car hire purchase and leases.");
    if (B.balloon > 40) add(2, "warn", "Balloon above 40% raises refinancing risk at maturity.");
    if (B.grace > 0 && B.rateType === "FLAT") add(2, "crit", "Grace periods need an effective or floating rate; a flat rate cannot defer principal correctly.");
    if (B.method === "EQUAL_PRINCIPAL" && B.rateType === "FLAT") add(2, "crit", "Equal principal needs an effective or floating rate.");
    if ((B.family === "PL" || B.family === "HOME") && B.vat) add(3, "crit", "Loan interest is not subject to VAT; turn VAT off.");
    if (B.family.indexOf("HP") === 0 && !B.vat) add(3, "warn", "Hire purchase installments normally carry VAT 7%.");
    if (B.feePct > 3) add(3, "warn", "Upfront fee above 3% will draw conduct scrutiny.");
    var wf = B.waterfall.join(",");
    if (B.waterfall[B.waterfall.length - 1] !== "PRINCIPAL_DUE") add(4, "warn", "Most rule packs allocate principal last.");
    if (B.lateRate > 15) add(4, "crit", "Late charge above 15% a year exceeds the default conduct limit in this rule pack.");
    if (B.nonAccrual > 90) add(4, "crit", "Stop recognizing interest no later than 90 days past due (TFRS 9 stage 3).");
    if (B.writeOff <= B.nonAccrual) add(4, "crit", "Write-off must come after the non-accrual point.");
    if (B.family.indexOf("HP") === 0 && B.prepayFee > 0) add(5, "crit", "Hire purchase early settlement must give the interest rebate; an extra prepayment fee is not allowed in this rule pack.");
    if (!B.prepay && B.family !== "LEASE") add(5, "warn", "Blocking early settlement is unusual for retail credit and may breach conduct rules.");
    if (B.income !== "EIR") add(6, "crit", "TFRS 9 requires effective-interest income for amortized-cost loans.");
    var sumP = s.rows.reduce(function (a, x) { return a + x.principal; }, 0) + (s.balloon || 0) * 0;
    add(7, Math.abs(sumP - P) < 0.05 ? "good" : "crit", "Schedule repays the example principal exactly: ฿" + fmt(r2(sumP)) + ".");
    return { c: c, s: s, eir: eir, fee: fee };
  }
  function mbYaml(r) {
    return [
      "product: " + B.code, "version: draft", "family: " + ({ LEASE: "LEASE", PL: "LOAN", HOME: "LOAN" }[B.family] || "ASSET_FINANCE"), "rule_pack: TH/" + B.family, "currency: THB", "",
      "parameters:", "  principal: { min: " + B.minAmt + ", max: " + B.maxAmt + " }", "  term_months: { allowed: [" + B.terms.join(", ") + "] }", "  balloon_pct: { max: " + B.balloon + " }", "  grace_months: " + B.grace, "",
      "pricing:", "  rate_type: " + B.rateType, B.rateType === "FLOATING" ? "  rate: MRR " + (B.rate >= 0 ? "+ " : "- ") + Math.abs(B.rate).toFixed(2) + "%   # MRR today " + B.base.toFixed(2) + "%" : "  rate: " + B.rate.toFixed(2) + "%", "  disclosed_rate: EFFECTIVE   # " + (r.eir * 100).toFixed(2) + "% on the example", "",
      "schedule:", "  method: " + (B.rateType === "FLAT" ? "ANNUITY_FROM_FLAT" : B.method) + (B.balloon > 0 ? "_BALLOON" : ""), "  frequency: MONTHLY", "",
      "fees:", B.feePct > 0 ? "  - { code: ORIGINATION_FEE, trigger: DISBURSEMENT, amount: \"principal * " + (B.feePct / 100).toFixed(4) + "\" }" : "  []",
      "tax:", B.vat ? "  vat: { applies_to: [INSTALLMENT], rate: 0.07, point: DUE_DATE }" : "  vat: none", "",
      "repayment_waterfall: [" + B.waterfall.join(", ") + "]",
      "delinquency: { late_charge: \"overdue * " + (B.lateRate / 100).toFixed(2) + " / 365\", non_accrual_dpd: " + B.nonAccrual + ", write_off_dpd: " + B.writeOff + " }",
      "early_settlement: { allowed: " + B.prepay + ", fee_pct: " + B.prepayFee + (B.family.indexOf("HP") === 0 ? ", rebate: TH_HP_EIR" : "") + " }",
      "payment_holidays: { per_12_months: " + B.holidays + ", interest: DEFERRED }",
      "income_recognition: { method: " + B.income + (B.feePct > 0 ? ", deferred_fees: [ORIGINATION_FEE]" : "") + " }",
      "accounting: { gl_mapping: " + B.gl + " }"
    ].join("\n");
  }
  function field(label, k, type, extra) {
    var v = B[k], id = "mb-" + k;
    if (type === "select") return "<div class='field'><label for='" + id + "'>" + label + "</label><select id='" + id + "' data-k='" + k + "'>" + extra.map(function (o) { return "<option value='" + o[0] + "'" + (String(v) === String(o[0]) ? " selected" : "") + ">" + o[1] + "</option>"; }).join("") + "</select></div>";
    if (type === "check") return "<div class='field check'><input id='" + id + "' type='checkbox' data-k='" + k + "'" + (v ? " checked" : "") + "><label for='" + id + "'>" + label + "</label></div>";
    return "<div class='field'><label for='" + id + "'>" + label + "</label><input id='" + id + "' type='" + type + "' data-k='" + k + "' value='" + esc(v) + "'" + (extra || "") + "></div>";
  }
  function stepHtml(i, r) {
    var h = "<div class='panel-head'><h2>" + (i + 1) + ". " + MB_STEPS[i] + "</h2><span class='muted' style='font-size:12.5px'>Step " + (i + 1) + " of 8</span></div>";
    if (i === 0) h += "<div class='form'>" + field("Product code", "code", "text") + field("Family and rule pack", "family", "select", Object.keys(MB_FAM).map(function (k) { return [k, MB_FAM[k]]; })) + "<div class='field'><label>Currency</label><input value='THB' disabled></div><div class='field'><label>Segment</label><input value='" + (B.family === "LEASE" ? "SME, corporate" : "Retail, SME") + "' disabled></div></div><p class='note'>Changing the family loads that rule pack's caps, tax and conduct rules into the checks.</p>";
    if (i === 1) h += "<div class='form'>" + field("Rate type", "rateType", "select", [["FLAT", "Flat, on original principal"], ["EFFECTIVE", "Effective, on outstanding"], ["FLOATING", "Floating, MRR ± spread"]]) +
      (B.rateType === "FLOATING" ? field("Spread over MRR, %", "rate", "number", " step='0.05'") + field("MRR today, %", "base", "number", " step='0.05'") : field("Rate, % per year", "rate", "number", " step='0.01' min='0'")) +
      field("Minimum amount, THB", "minAmt", "number", " step='1000' min='0'") + field("Maximum amount, THB", "maxAmt", "number", " step='1000' min='0'") + "</div><p class='note'>Risk-based pricing tables by grade and term can be attached here; the example uses one rate.</p>";
    if (i === 2) h += "<div class='field'><label>Allowed terms, months</label><div class='termset'>" + ALL_TERMS.map(function (t) { return "<label><input type='checkbox' data-term='" + t + "'" + (B.terms.indexOf(t) >= 0 ? " checked" : "") + ">" + t + "</label>"; }).join("") + "</div></div><div class='form'>" +
      field("Installment method", "method", "select", [["ANNUITY", "Equal installments"], ["EQUAL_PRINCIPAL", "Equal principal"]]) + field("Balloon or residual, %", "balloon", "number", " step='5' min='0' max='50'") + field("Grace, interest-only months", "grace", "number", " step='1' min='0' max='12'") + "<div class='field'><label>Frequency</label><input value='Monthly' disabled></div></div>";
    if (i === 3) h += "<div class='form'>" + field("Origination fee, % of amount", "feePct", "number", " step='0.25' min='0'") + field("VAT 7% on each installment", "vat", "check") + "</div><p class='note'>Fees are amortized into interest income with the effective rate. VAT is charged at each due date with an e-Tax invoice.</p>";
    if (i === 4) h += "<div class='field'><label>Repayment waterfall: incoming money pays these in order</label><div class='order'>" + B.waterfall.map(function (w, j) { return "<div><span>" + (j + 1) + ". " + w + "</span><button type='button' data-up='" + j + "' aria-label='Move " + w + " up'>↑</button><button type='button' data-down='" + j + "' aria-label='Move " + w + " down'>↓</button></div>"; }).join("") + "</div></div><div class='form'>" +
      field("Late charge, % per year on overdue", "lateRate", "number", " step='0.5' min='0'") + field("Stop accruing interest at, days past due", "nonAccrual", "number", " step='30' min='30'") + field("Write off at, days past due", "writeOff", "number", " step='30' min='90'") + "</div>";
    if (i === 5) h += "<div class='form'>" + field("Allow early settlement", "prepay", "check") + field("Early settlement fee, % of outstanding", "prepayFee", "number", " step='0.5' min='0'") + field("Payment holidays per 12 months", "holidays", "number", " step='1' min='0' max='3'") + "</div><p class='note'>" + (B.family.indexOf("HP") === 0 ? "Hire purchase settlements use the rule pack's interest rebate (TH_HP_EIR): unearned interest is not charged." : "Partial prepayments reduce the term by default; the customer can choose to reduce the installment instead.") + "</p>";
    if (i === 6) h += "<div class='form'>" + field("Income recognition", "income", "select", [["EIR", "Effective interest (TFRS 9)"], ["STRAIGHT", "Straight line"]]) + field("GL mapping", "gl", "select", [["hp_standard_th_v2", "Hire purchase · TH v2"], ["lease_tfrs16_v1", "Finance lease · TFRS 16"], ["loan_standard_th_v1", "Consumer loan · TH v1"], ["mortgage_th_v1", "Mortgage · TH v1"]]) + "</div><p class='note'>Every balance type maps to GL accounts per event; the mapping is versioned and needs maker-checker to change.</p>";
    if (i === 7) {
      var s = r.s, P = B.sampleAmt, n = B.sampleTerm, rows = s.rows, inst = rows[0].pay + rows[0].vat;
      var totalPaid = rows.reduce(function (a, x) { return a + x.pay + x.vat; }, 0);
      var late = r2((rows[5] ? rows[5].pay + rows[5].vat : inst) * B.lateRate / 100 / 365 * 90);
      var m = Math.min(24, Math.floor(n / 2)), outM = rows[m - 1] ? rows[m - 1].bal : P, saved = rows.slice(m).reduce(function (a, x) { return a + x.interest; }, 0);
      var floatTxt = "Not applicable: fixed or flat rate.";
      if (B.rateType === "FLOATING") { var save = B.base; B.base += 1; var s2 = mbSchedule(P, n); B.base = save; floatTxt = "Installment ฿" + fmt(rows[0].pay) + " → ฿" + fmt(s2.rows[0].pay) + " (+" + fmt(r2(s2.rows[0].pay - rows[0].pay)) + ")"; }
      h += "<p class='muted'>Example: ฿" + fmt0(P) + " over " + n + " months. Change the example in step 2 or 3.</p><div class='tbl-wrap'><table><thead><tr><th>Scenario</th><th>Outcome</th></tr></thead><tbody>" +
        "<tr><td>Pays on time</td><td>Total paid ฿" + fmt(r2(totalPaid)) + " · interest ฿" + fmt(s.totalInterest) + (B.vat ? " · VAT ฿" + fmt(r2(rows.reduce(function (a, x) { return a + x.vat; }, 0))) : "") + "</td></tr>" +
        "<tr><td>Misses months 6 and 7, catches up in month 8</td><td>Late charges about ฿" + fmt(late) + " at " + B.lateRate + "% a year; days past due peak at 60, stage 2</td></tr>" +
        "<tr><td>Settles early after " + m + " months</td><td>" + (B.prepay ? "Pays ฿" + fmt(r2(outM * (1 + B.prepayFee / 100))) + "; saves ฿" + fmt(r2(saved)) + " of interest" + (B.prepayFee ? " (fee " + B.prepayFee + "%)" : "") : "Not allowed by this product") + "</td></tr>" +
        "<tr><td>MRR rises 1%</td><td>" + floatTxt + "</td></tr>" +
        "<tr><td>Takes a payment holiday</td><td>" + (B.holidays > 0 ? "Term " + n + " → " + (n + 1) + " months; deferred interest ฿" + fmt(rows[1] ? rows[1].interest : 0) : "Not offered") + "</td></tr>" +
        "</tbody></table></div>";
      var diffs = Object.keys(B).filter(function (k) { return k !== "template" && JSON.stringify(B[k]) !== JSON.stringify(BASE[k]); });
      h += "<h3>Changes from the " + MB_FAM[BASE.family].toLowerCase() + " template</h3>" + (diffs.length ? "<div class='understood'>" + diffs.map(function (k) { return "<span class='chip acc'>" + k + ": " + esc(JSON.stringify(BASE[k])) + " → " + esc(JSON.stringify(B[k])) + "</span>"; }).join("") + "</div>" : "<p class='muted'>No changes from the template.</p>");
    }
    h += "<div class='row' style='justify-content:space-between;margin-top:6px'><button class='btn' type='button' id='mbPrev'" + (i === 0 ? " disabled" : "") + ">Back</button>" + (i < 7 ? "<button class='btn primary' type='button' id='mbNext'>Next: " + MB_STEPS[i + 1] + "</button>" : "") + "</div>";
    return h;
  }
  function renderMbSide(r) {
    var P = B.sampleAmt, n = B.sampleTerm, row = r.s.rows[Math.min(B.grace, r.s.rows.length - 1)] || r.s.rows[0];
    $("#mbExample").textContent = "Example ฿" + fmt0(P) + " · " + n + "m";
    $("#mbInst").textContent = "฿" + fmt(row.pay);
    $("#mbInstD").textContent = (B.vat ? "฿" + fmt(r2(row.pay + row.vat)) + " with VAT" : "No VAT") + (B.grace ? " · after " + B.grace + " grace months" : "");
    $("#mbEir").textContent = isFinite(r.eir) ? (r.eir * 100).toFixed(2) + "%" : "—";
    var bad = r.c.filter(function (x) { return x.lvl === "crit"; }).length, warn = r.c.filter(function (x) { return x.lvl === "warn"; }).length;
    $("#mbCheckSum").textContent = bad ? bad + " to fix" : warn ? warn + " to review" : "All pass";
    $("#mbCheckSum").className = "chip " + (bad ? "crit" : warn ? "warn" : "good");
    $("#mbChecks").innerHTML = r.c.map(function (x) { return "<div><span class='chip " + x.lvl + "'>" + (x.lvl === "good" ? "Pass" : x.lvl === "warn" ? "Check" : "Fix") + "</span><span><span class='muted'>Step " + (x.step + 1) + ":</span> " + esc(x.msg) + "</span></div>"; }).join("");
    $("#mbYaml").textContent = mbYaml(r);
    $("#mbPublish").disabled = bad > 0;
    $("#mbSteps").innerHTML = MB_STEPS.map(function (t, i) {
      var st = r.c.some(function (x) { return x.step === i && x.lvl === "crit"; }) ? "bad" : "ok";
      return "<button type='button' class='" + st + "' data-step='" + i + "'" + (i === mbStep ? " aria-current='step'" : "") + "><span class='num'>" + (st === "bad" ? "!" : i + 1) + "</span>" + t + "</button>";
    }).join("");
    $$("#mbSteps [data-step]").forEach(function (b) { b.addEventListener("click", function () { mbStep = +b.getAttribute("data-step"); renderMb(); }); });
  }
  function renderMb() {
    var r = mbChecks();
    $("#mbStep").innerHTML = stepHtml(mbStep, r);
    renderMbSide(r);
    $("#mbTpl").innerHTML = Object.keys(MB_TPL).map(function (k) { var t = MB_TPL[k]; return "<button type='button' data-tpl='" + k + "' aria-pressed='" + (B.template === k) + "'><strong>" + MB_FAM[k] + "</strong><span>" + (t.rateType || "FLAT").toLowerCase() + " · " + fmt0(t.minAmt) + "–" + fmt0(t.maxAmt) + "</span></button>"; }).join("");
    $$("#mbTpl [data-tpl]").forEach(function (b) { b.addEventListener("click", function () { B = mbFrom(b.getAttribute("data-tpl")); BASE = JSON.parse(JSON.stringify(B)); mbStep = 0; $("#mbUnderstood").hidden = true; renderMb(); }); });
    var prev = $("#mbPrev"), next = $("#mbNext");
    if (prev) prev.addEventListener("click", function () { mbStep = Math.max(0, mbStep - 1); renderMb(); });
    if (next) next.addEventListener("click", function () { mbStep = Math.min(7, mbStep + 1); renderMb(); });
    $$("#mbStep [data-term]").forEach(function (cb) { cb.addEventListener("change", function () { var t = +cb.getAttribute("data-term"); if (cb.checked) B.terms.push(t); else B.terms = B.terms.filter(function (x) { return x !== t; }); B.terms.sort(function (a, b) { return a - b; }); renderMbSide(mbChecks()); }); });
    $$("#mbStep [data-up], #mbStep [data-down]").forEach(function (bt) { bt.addEventListener("click", function () { var up = bt.hasAttribute("data-up"), j = +(bt.getAttribute(up ? "data-up" : "data-down")), k = up ? j - 1 : j + 1; if (k < 0 || k >= B.waterfall.length) return; var t = B.waterfall[j]; B.waterfall[j] = B.waterfall[k]; B.waterfall[k] = t; renderMb(); }); });
  }
  $("#view-builder").addEventListener("input", onMbField); $("#view-builder").addEventListener("change", onMbField);
  function onMbField(e) {
    var el = e.target, k = el.getAttribute && el.getAttribute("data-k"); if (!k) return;
    var v = el.type === "checkbox" ? el.checked : el.type === "number" ? (parseFloat(el.value) || 0) : el.value;
    if (k === "code") v = String(v).toUpperCase();
    B[k] = v;
    if (k === "family" || k === "rateType") { if (k === "family" && v === "HOME" && B.rateType !== "FLOATING") { B.rateType = "FLOATING"; B.base = 6.95; B.rate = -1.5; } renderMb(); return; }
    renderMbSide(mbChecks());
  }
  function parseBrief(t) {
    var x = t.toLowerCase(), got = [], assume = [], b = null;
    var fam = /motor ?(cycle|bike)/.test(x) ? "HP_MOTO" : /used car|second[- ]hand/.test(x) ? "HP_USED" : /home loan|mortgage|house|condo/.test(x) ? "HOME" : /lease|leasing|equipment|machinery/.test(x) ? "LEASE" : /personal loan|cash loan/.test(x) ? "PL" : /hire purchase|\bhp\b|car|pickup|vehicle/.test(x) ? "HP_NEW" : null;
    b = mbFrom(fam || "PL"); if (fam) got.push("Family: " + MB_FAM[fam]); else assume.push("Family not stated; assumed personal loan");
    var num = function (n, u) { var v = parseFloat(String(n).replace(/,/g, "")); u = (u || "").toLowerCase(); return u === "k" || u === "thousand" ? v * 1e3 : u === "m" || u === "million" || u === "mn" ? v * 1e6 : v; };
    var am = x.match(/฿?\s*([\d.,]+)\s*(k|m|mn|million|thousand)?\s*(?:baht|thb|฿)?\s*(?:to|-|–)\s*฿?\s*([\d.,]+)\s*(k|m|mn|million|thousand)?/);
    if (am && !/month|year/.test(x.slice(am.index, am.index + am[0].length + 8))) { b.minAmt = num(am[1], am[2] || am[4]); b.maxAmt = num(am[3], am[4]); got.push("Amount ฿" + fmt0(b.minAmt) + "–" + fmt0(b.maxAmt)); }
    else assume.push("Amount range from the template");
    var tm = x.match(/(\d+)\s*(?:to|-|–)\s*(\d+)\s*(months?|years?)/);
    if (tm) { var mul = /year/.test(tm[3]) ? 12 : 1, lo = +tm[1] * mul, hi = +tm[2] * mul; b.terms = ALL_TERMS.filter(function (v) { return v >= lo && v <= hi; }); if (!b.terms.length) b.terms = [hi]; got.push("Terms " + lo + "–" + hi + " months"); }
    else assume.push("Terms from the template");
    var fl = x.match(/flat\s*(?:rate\s*(?:of\s*)?)?(\d+(?:\.\d+)?)\s*%|(\d+(?:\.\d+)?)\s*%\s*flat/), mrr = x.match(/mrr\s*([-−+])\s*(\d+(?:\.\d+)?)/), eff = x.match(/(\d+(?:\.\d+)?)\s*%\s*(?:a year|p\.?a\.?|per year|effective|interest)/);
    if (fl) { b.rateType = "FLAT"; b.rate = +(fl[1] || fl[2]); got.push("Flat rate " + b.rate + "%"); }
    else if (mrr) { b.rateType = "FLOATING"; b.base = 6.95; b.rate = (mrr[1] === "+" ? 1 : -1) * +mrr[2]; got.push("Floating MRR " + mrr[1] + " " + mrr[2] + "%"); }
    else if (eff) { b.rateType = "EFFECTIVE"; b.rate = +eff[1]; got.push("Effective rate " + b.rate + "%"); }
    else assume.push("Rate from the template");
    var bl = x.match(/(\d+)\s*%\s*(?:balloon|residual)|(?:balloon|residual)\s*(?:of\s*)?(\d+)\s*%/); if (bl) { b.balloon = +(bl[1] || bl[2]); got.push("Balloon " + b.balloon + "%"); }
    var gr = x.match(/(\d+)[- ]?months?\s*grace|grace\s*(?:period\s*)?(?:of\s*)?(\d+)/); if (gr) { b.grace = +(gr[1] || gr[2]); got.push("Grace " + b.grace + " months"); }
    var fe = x.match(/(\d+(?:\.\d+)?)\s*%\s*(?:processing|origination|upfront|front[- ]end)?\s*fee|(?:processing|origination|upfront)\s*fee\s*(?:of\s*)?(\d+(?:\.\d+)?)\s*%/); if (fe) { b.feePct = +(fe[1] || fe[2]); got.push("Fee " + b.feePct + "%"); }
    if (/no (early|pre)[- ]?(settlement|payment)? ?fee|no prepayment (penalty|fee)/.test(x)) { b.prepayFee = 0; got.push("No early settlement fee"); }
    if (/no vat|without vat/.test(x)) { b.vat = false; got.push("No VAT"); } else if (/\bvat\b/.test(x)) { b.vat = true; got.push("VAT 7%"); }
    if (/equal principal/.test(x)) { b.method = "EQUAL_PRINCIPAL"; got.push("Equal principal"); }
    b.code = (fam ? MB_TPL[fam].code : "NEW_LOAN") + "_V2";
    b.sampleAmt = Math.round(Math.min(b.maxAmt, Math.max(b.minAmt, (b.minAmt + b.maxAmt) / 3)) / 1000) * 1000;
    b.sampleTerm = b.terms[Math.floor(b.terms.length / 2)] || b.terms[0];
    assume.push("Example contract ฿" + fmt0(b.sampleAmt) + " over " + b.sampleTerm + " months");
    return { b: b, got: got, assume: assume };
  }
  $("#mbDraft").addEventListener("click", function () {
    var r = parseBrief($("#mbBrief").value);
    B = r.b; BASE = mbFrom(B.template); mbStep = 7;
    var u = $("#mbUnderstood"); u.hidden = false;
    u.innerHTML = "<div class='understood' style='margin-top:4px'>" + r.got.map(function (g) { return "<span class='chip good'>" + esc(g) + "</span>"; }).join("") + r.assume.map(function (g) { return "<span class='chip warn'>Assumed: " + esc(g) + "</span>"; }).join("") + "</div><p class='note' style='margin-top:8px'>Draft loaded into the builder and opened at Review. Every value stays editable; the copilot never publishes.</p>";
    renderMb(); toast("Copilot drafted " + B.code);
  });
  $("#mbReset").addEventListener("click", function () { B = mbFrom("HP_NEW"); BASE = JSON.parse(JSON.stringify(B)); mbStep = 0; $("#mbUnderstood").hidden = true; renderMb(); });
  $("#mbPublish").addEventListener("click", function () {
    var r = mbChecks();
    if (window.FABOR && window.FABOR.live && window.FABOR.live.active()) { window.FABOR.live.submitProduct(B, r); return; }  // LIVE: signed in, send to the real Master Builder
    approvals.unshift({ id: "APR-" + (1100 + approvals.length), title: "Publish product " + B.code + " (Master Builder)", kind: "Product", maker: "You, in Master Builder", agent: null, detail: MB_FAM[B.family] + ". Effective rate " + (r.eir * 100).toFixed(2) + "% on the example; " + r.c.filter(function (x) { return x.lvl === "warn"; }).length + " items flagged for review. Golden tests generated from 5 scenarios.", status: "PENDING" });
    renderApprovals(); toast(B.code + " sent to Approvals");
  });
  $("#mbCopy").addEventListener("click", function () { var t = $("#mbYaml").textContent; try { navigator.clipboard.writeText(t).then(function () { toast("Definition copied"); }, function () {}); } catch (e) {} });
  renderMb();



  /* ---------- Interface style: Modern or Calm ---------- */
  function setStyle(mode, save) {
    var apply = function () {
      if (mode === "calm") document.documentElement.setAttribute("data-style", "calm");
      else document.documentElement.removeAttribute("data-style");
      var r = $("#st-" + mode); if (r) r.checked = true;
    };
    if (save && document.startViewTransition && !reduce) document.startViewTransition(apply); else apply();
    if (save) { try { localStorage.setItem("fabor-style", mode); } catch (e) {} }
  }
  $$("input[name='style']").forEach(function (r) { r.addEventListener("change", function () { setStyle(r.value, true); flashSaved(); }); });
  $$("input[name='theme']").forEach(function (r) { r.addEventListener("change", function () { setTheme(r.value, true); flashSaved(); }); });
  var savedTimer;
  function flashSaved() { var n = $("#savedNote"); n.hidden = false; clearTimeout(savedTimer); savedTimer = setTimeout(function () { n.hidden = true; }, 2000); }
  (function () { var m = null; try { m = localStorage.getItem("fabor-style"); } catch (e) {} if (m === "calm") setStyle("calm", false); })();

  /* ---------- Command palette ---------- */
  var pal = $("#palette"), palInput = $("#palInput"), palList = $("#palList"), palSel = 0, palItems = [];
  var ICON = { overview: "i-overview", customer: "i-customer", contract: "i-contract", studio: "i-studio", ledger: "i-ledger", approvals: "i-approve", agents: "i-agent", architecture: "i-arch", modules: "i-modules", settings: "i-gear", branch: "i-branch", corporate: "i-corp", assetfin: "i-truck", trade: "i-globe", treasury: "i-fx", syndication: "i-synd", builder: "i-wand" };
  var COMMANDS = VIEWS.map(function (v) { return { group: "Go to", label: TITLES[v], icon: ICON[v], run: function () { location.hash = v; } }; }).concat([
    { group: "Records", label: "HP-2025-004812 · Napat Srisuk", hint: "Hire purchase", icon: "i-contract", run: function () { location.hash = "contract"; } },
    { group: "Records", label: "Siam Freight Logistics Co., Ltd.", hint: "P-200118", icon: "i-customer", run: function () { location.hash = "customer"; } },
    { group: "Records", label: "TL-2024-000311 · restructure proposal", hint: "APR-1043", icon: "i-approve", run: function () { location.hash = "approvals"; } },
    { group: "Records", label: "MA-2025-0031 · fleet master agreement", hint: "Siam Freight", icon: "i-truck", run: function () { location.hash = "assetfin"; showAf("fleet"); } },
    { group: "Records", label: "FP-2026-0007 · Bangna Motors floor plan", hint: "Dealer", icon: "i-truck", run: function () { location.hash = "assetfin"; showAf("floor"); } },
    { group: "Records", label: "LC-IMP-2026-0188 · import LC", hint: "USD 1.28M", icon: "i-globe", run: function () { location.hash = "trade"; } },
    { group: "Records", label: "SY-2026-004 · syndicated loan", hint: "฿6,000M", icon: "i-synd", run: function () { location.hash = "syndication"; } },
    { group: "Switch bank", label: "Demo Virtual Bank", icon: "i-swap", run: function () { setTenant("virtual"); location.hash = "overview"; } },
    { group: "Switch bank", label: "Demo Retail Bank", icon: "i-swap", run: function () { setTenant("retail"); location.hash = "branch"; } },
    { group: "Switch bank", label: "Demo Commercial Bank", icon: "i-swap", run: function () { setTenant("commercial"); location.hash = "corporate"; } },
    { group: "Actions", label: "Build a product with Master Builder", icon: "i-wand", run: function () { location.hash = "builder"; } },
    { group: "Actions", label: "New hire-purchase product", icon: "i-plus", run: function () { location.hash = "studio"; $("#pFamily").value = "HP_USED"; $("#pFamily").dispatchEvent(new Event("change")); } },
    { group: "Actions", label: "Replay AI servicing case", icon: "i-play", run: function () { location.hash = "agents"; } },
    { group: "Actions", label: "Use Calm style", icon: "i-gear", run: function () { setStyle("calm", true); } },
    { group: "Actions", label: "Use Modern style", icon: "i-gear", run: function () { setStyle("modern", true); } },
    { group: "Actions", label: "Switch to dark theme", icon: "i-moon", run: function () { setTheme("dark", true); } },
    { group: "Actions", label: "Switch to light theme", icon: "i-sun", run: function () { setTheme("light", true); } }
  ]);
  function renderPalette() {
    var q = palInput.value.trim().toLowerCase();
    palItems = COMMANDS.filter(function (c) { return !q || (c.label + " " + (c.hint || "") + " " + c.group).toLowerCase().indexOf(q) >= 0; });
    if (palSel >= palItems.length) palSel = Math.max(0, palItems.length - 1);
    var html = "", lastGroup = "";
    palItems.forEach(function (c, i) {
      if (c.group !== lastGroup) { html += "<li class='grp' role='presentation'>" + c.group + "</li>"; lastGroup = c.group; }
      html += "<li role='option' data-i='" + i + "' aria-selected='" + (i === palSel) + "'><svg class='ico'><use href='#" + c.icon + "'/></svg><span class='grow'>" + esc(c.label) + "</span>" + (c.hint ? "<span class='muted mono' style='font-size:12px'>" + esc(c.hint) + "</span>" : "") + "</li>";
    });
    palList.innerHTML = html || "<li class='grp'>No matches. Try a contract number or a screen name.</li>";
    var sel = palList.querySelector("[aria-selected='true']"); if (sel) sel.scrollIntoView({ block: "nearest" });
  }
  function openPalette() { if (pal.open) return; palInput.value = ""; palSel = 0; renderPalette(); pal.showModal(); palInput.focus(); }
  function runPalette(i) { var c = palItems[i]; if (!c) return; pal.close(); c.run(); }
  if (!("commandForElement" in HTMLButtonElement.prototype)) $("#openPalette").addEventListener("click", openPalette);
  pal.addEventListener("toggle", function (e) { if (e.newState === "open") { palInput.value = ""; palSel = 0; renderPalette(); palInput.focus(); } });
  palInput.addEventListener("input", function () { palSel = 0; renderPalette(); });
  palInput.addEventListener("keydown", function (e) {
    if (e.key === "ArrowDown") { e.preventDefault(); palSel = Math.min(palItems.length - 1, palSel + 1); renderPalette(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); palSel = Math.max(0, palSel - 1); renderPalette(); }
    else if (e.key === "Enter") { e.preventDefault(); runPalette(palSel); }
  });
  palList.addEventListener("click", function (e) { var li = e.target.closest("[data-i]"); if (li) runPalette(+li.getAttribute("data-i")); });
  pal.addEventListener("click", function (e) { if (e.target === pal) pal.close(); });
  document.addEventListener("keydown", function (e) { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); openPalette(); } });

  /* ---------- KPI sparklines (sample trends) ---------- */
  $$("svg[data-spk]").forEach(function (svg, n) {
    var kind = svg.getAttribute("data-spk"), pts = [], v = 50, seed = 11 + n * 7;
    var rnd = function () { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    for (var i = 0; i < 24; i++) {
      var drift = { up: 1.2, npl: 0.5, down: -1.1, flat: 0, zero: 0 }[kind];
      v += drift + (rnd() - 0.5) * (kind === "zero" ? 0 : 6);
      pts.push(v);
    }
    var lo = Math.min.apply(null, pts), hi = Math.max.apply(null, pts), span = hi - lo || 1;
    var line = pts.map(function (q, i) { return (i * 160 / 23).toFixed(1) + "," + (26 - (q - lo) / span * 22).toFixed(1); }).join(" ");
    var col = kind === "npl" ? "var(--crit)" : kind === "zero" ? "var(--money)" : "var(--accent)";
    svg.innerHTML = "<polygon points='0,30 " + line + " 160,30' style='fill:" + col + ";opacity:.12'/><polyline points='" + line + "' style='fill:none;stroke:" + col + ";stroke-width:1.6' vector-effect='non-scaling-stroke'/>";
  });

  /* LIVE: the only seam between the prototype and the real services. live.js fills these views with API data once signed in. */
  window.FABOR = {
    $: $, $$: $$, fmt: fmt, fdate: fdate, esc: esc, toast: toast, r2: r2, live: null,
    setApprovals: function (list) { approvals = list; renderApprovals(); },
    setBatches: function (list) { batches = list; renderBatches(); },
    setMe: function (name) { ME = name; }
  };
  drawSpark(); renderContract(); renderBatches(); renderApprovals(); renderStudio(); renderAgents(); applyRoute();
  window.dispatchEvent(new Event("fabor-ready"));
})();

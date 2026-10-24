'use strict';
/*
 * Live layer for the console. proto.js is the design prototype as delivered; this file fills its screens with real data once
 * somebody is signed in, using only the components the prototype already defines (panel, form, field, chip, result, kv, table).
 * Screens that are not listed in the Access panel stay on the prototype's sample data.
 */
(function () {
  var F = window.FABOR, $ = F.$, $$ = F.$$, esc = F.esc, fmt = F.fmt, toast = F.toast;
  var ROLES = ['PRODUCT', 'RISK', 'FINANCE', 'COMPLIANCE'];
  var cfg = { mode: 'token' };
  var known = {};                                   // party id -> deposit account, for the teller's account list

  var store = {
    get: function (k) { try { return sessionStorage.getItem(k) || ''; } catch (e) { return ''; } },
    set: function (k, v) { try { sessionStorage.setItem(k, v); } catch (e) { /* storage unavailable: keep working without it */ } }
  };
  var thb = function (minor) { return fmt(minor / 100); };
  var minor = function (v) { return Math.round(parseFloat(v) * 100); };
  var iso = function (d) { return d.toISOString().slice(0, 10); };
  var el = function (html) { var t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; };

  function claims(jwt) {
    try { return JSON.parse(atob(jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); } catch (e) { return {}; }
  }
  function signedIn() {
    var exp = Number(store.get('expires') || 0);
    if (cfg.mode === 'oidc') return !!store.get('token') && (!exp || exp > Date.now());
    return !!store.get('token') && !!store.get('actor');
  }

  async function api(method, path, body, contentType) {
    var headers = { 'Authorization': 'Bearer ' + store.get('token') };
    if (cfg.mode !== 'oidc' && store.get('actor')) headers['X-Actor'] = store.get('actor');
    if (body !== undefined && body !== null) headers['Content-Type'] = contentType || 'application/json';
    var res = await fetch('/api/v1' + path, { method: method, headers: headers,
      body: body === undefined || body === null ? undefined : (contentType ? body : JSON.stringify(body)) });
    var text = await res.text(), data = null;
    try { data = text ? JSON.parse(text) : null; } catch (e) { data = { message: text }; }
    if (!res.ok) throw new Error(data && (data.message || data.error) ? (data.message || data.error) : 'HTTP ' + res.status);
    return data;
  }
  function fail(what) { return function (e) { toast(what + ' failed. ' + e.message); }; }

  // ---------------------------------------------------------------- sign-in (Settings > Access)
  var access = el(
    '<div class="panel" id="accessPanel"><h2>Access</h2><div>' +
    '<div class="set-row"><div><h3>Sign in</h3><p id="accessState"></p></div>' +
    '<form class="form" id="accessForm" style="min-width:300px">' +
    '<div class="field"><label for="acActor">Actor</label><input id="acActor" autocomplete="off" placeholder="your name"></div>' +
    '<div class="field"><label for="acToken">Bearer token</label><input id="acToken" type="password" autocomplete="off"></div>' +
    '<div class="row"><button class="btn primary" type="submit" id="acUse">Use</button><button class="btn" type="button" id="acSignIn" hidden>Sign in</button><button class="btn" type="button" id="acSignOut" hidden>Sign out</button></div>' +
    '</form></div>' +
    '<div class="set-row"><div><h3>Scheduler</h3><p>Queue any billing, accrual or penalty work that is due for active loans and accounts. Safe to repeat.</p></div>' +
    '<div><button class="btn" type="button" id="acBackfill">Run backfill</button><div class="result" id="acBackfillOut" hidden></div></div></div>' +
    '<div class="set-row"><div><h3>What is live</h3><p>Master Builder and Approvals, Customer 360 and Contracts (look up or create, with collections and repossession), Ledger (by account), and cash deposits in Branch and teller use the real services. ' +
    'Fleet and floor plan (open an agreement or a dealer line by id) is live too, with the Assets, Leases and Dealers tabs, and Overview shows real totals. The loss allowance run is below, in this screen. Product Studio, Trade finance, Treasury, Syndication, Corporate banking and AI agents still show sample data.</p></div></div>' +
    '</div></div>');
  $('#view-settings .panel').after(access);

  function paintSession() {
    var on = signedIn(), c = on && cfg.mode === 'oidc' ? claims(store.get('token')) : {};
    var who = cfg.mode === 'oidc' ? (c.preferred_username || c.sub || '') : store.get('actor');
    $('#accessState').textContent = on ? 'Signed in as ' + who + '. The screens listed below read and write real data.' : 'Not signed in. Every screen shows the prototype\'s sample data.';
    $$('#accessForm .field').forEach(function (f) { f.hidden = cfg.mode === 'oidc'; });
    $('#acUse').hidden = cfg.mode === 'oidc';
    $('#acSignIn').hidden = cfg.mode !== 'oidc' || on;
    $('#acSignOut').hidden = !on;
    var foot = $('.side-foot');
    foot.querySelector('.avatar').textContent = on ? (who || '?').slice(0, 2).toUpperCase() : 'PC';
    foot.querySelector('strong').textContent = on ? who : 'Ploy Chaiyaporn';
    foot.querySelector('span:not(.avatar)').textContent = on ? 'Signed in' : 'Sample data · sign in under Settings';
    F.setMe(on ? who : 'Ploy Chaiyaporn');
    $('#view-approvals .view-head .chip').textContent = on ? 'You: ' + who : 'You: Ploy Chaiyaporn · checker';
    $('#view-settings .view-head .eyebrow').textContent = on ? who + ' · Signed in' : 'Ploy Chaiyaporn · Operations checker';
  }

  var REDIRECT = location.origin + '/console/index.html';
  function b64url(bytes) { var s = ''; bytes.forEach(function (b) { s += String.fromCharCode(b); }); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  function randomString(n) { var a = new Uint8Array(n); crypto.getRandomValues(a); return b64url(a); }
  async function startLogin() {
    var verifier = randomString(48), state = randomString(16);
    store.set('pkce_verifier', verifier); store.set('pkce_state', state);
    var digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
    var p = new URLSearchParams({ response_type: 'code', client_id: cfg.clientId, redirect_uri: REDIRECT, scope: cfg.scope, state: state,
      code_challenge: b64url(new Uint8Array(digest)), code_challenge_method: 'S256' });
    location.assign(cfg.authorizationEndpoint + (cfg.authorizationEndpoint.indexOf('?') >= 0 ? '&' : '?') + p);
  }
  async function finishLogin(code, state) {
    var expected = store.get('pkce_state'), verifier = store.get('pkce_verifier');
    store.set('pkce_state', ''); store.set('pkce_verifier', '');
    history.replaceState(null, '', '/console/index.html');                    // the code must not stay in the address bar
    location.hash = 'settings';
    if (!expected || state !== expected || !verifier) { toast('Sign-in rejected: the response did not match this browser session'); return; }
    var res = await fetch(cfg.tokenEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'authorization_code', code: code, redirect_uri: REDIRECT, client_id: cfg.clientId, code_verifier: verifier }) });
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok || !data.access_token) { toast('Sign-in failed: ' + (data.error_description || data.error || res.status)); return; }
    store.set('token', data.access_token);
    store.set('expires', String(Date.now() + (Number(data.expires_in) || 300) * 1000));
  }

  $('#accessForm').addEventListener('submit', function (e) {
    e.preventDefault();
    store.set('actor', $('#acActor').value.trim()); store.set('token', $('#acToken').value.trim());
    paintSession(); refresh(); toast('Signed in as ' + store.get('actor'));
  });
  $('#acSignIn').addEventListener('click', startLogin);
  $('#acBackfill').addEventListener('click', function () {
    if (!signedIn()) { toast('Sign in first'); return; }
    api('POST', '/admin/scheduler/backfill').then(function (r) { var o = $('#acBackfillOut'); o.hidden = false; o.className = 'result ok'; o.textContent = r.queued + ' tasks queued'; }, fail('Backfill'));
  });
  $('#acSignOut').addEventListener('click', function () { store.set('token', ''); store.set('expires', ''); store.set('actor', ''); location.hash = 'settings'; location.reload(); });

  // ---------------------------------------------------------------- Master Builder -> real draft, check and submit
  function toDsl(B, version) {
    var fam = B.family === 'LEASE' ? 'LEASE' : (B.family === 'PL' || B.family === 'HOME') ? 'LOAN' : 'ASSET_FINANCE';
    var rate = ((B.rateType === 'FLOATING' ? B.base + B.rate : B.rate) / 100).toFixed(6).replace(/0+$/, '').replace(/\.$/, '.0');
    var late = (B.lateRate / 100 / 365).toFixed(6).replace(/0+$/, '');
    var y = ['product: ' + B.code, 'version: ' + version, 'family: ' + fam, 'currency: THB', 'segment: [' + (B.family === 'LEASE' ? 'SME' : 'RETAIL') + ']', '',
      'parameters:', '  principal:   { min: ' + B.minAmt + ', max: ' + B.maxAmt + ', default: ' + B.sampleAmt + ' }',
      '  term_months: { allowed: [' + B.terms.join(', ') + '] }', '',
      'pricing:', '  rate_type: ' + (B.rateType === 'EFFECTIVE' ? 'FIXED' : B.rateType), '  rate: ' + rate, '  disclosed_rate: EFFECTIVE', '  day_count: ACT_365F', '',
      'schedule:', '  method: ' + (B.rateType === 'FLAT' ? 'ANNUITY_FROM_FLAT' : B.method), '  frequency: MONTHLY',
      '  first_due: { rule: ONE_PERIOD_AFTER_DISBURSEMENT }', '  holiday_rule: FOLLOWING', '', 'fees:'];
    if (B.feePct > 0) y.push('  - code: ORIGINATION_FEE', '    trigger: DISBURSEMENT', '    amount: "rate(principal, ' + (B.feePct / 100) + ')"');
    y.push('  - code: LATE_CHARGE', '    trigger: DAILY_WHILE_OVERDUE', '    amount: "rate(overdue, ' + late + ')"', '',
      'repayment_waterfall: [' + B.waterfall.join(', ') + ']', '');
    if (B.vat) y.push('tax:', '  vat: { applies_to: [FEES], rate: 0.07, point: DUE_DATE }', '');
    y.push('early_settlement:', '  allowed: ' + !!B.prepay, '  rebate: ' + (B.family.indexOf('HP') === 0 ? 'EIR' : 'NONE'), '',
      'delinquency:', '  buckets: [1, 30, 60, 90]', '  non_accrual_at_dpd: ' + B.nonAccrual, '  write_off_at_dpd: ' + B.writeOff, '',
      'accounting:', '  gl_mapping: ' + B.gl);
    return y.join('\n') + '\n';
  }

  async function submitProduct(B) {
    try {
      var versions = await api('GET', '/products/' + encodeURIComponent(B.code) + '/versions');
      var next = versions.reduce(function (m, v) { return Math.max(m, v.version); }, 0) + 1;
      var draft = await api('POST', '/products/drafts', toDsl(B, next), 'text/plain');
      var report = await api('GET', '/products/drafts/' + encodeURIComponent(draft.id) + '/check');
      var errors = (report.issues || []).filter(function (i) { return i.severity === 'ERROR'; });
      if (errors.length) {
        toast('The services rejected ' + B.code + ': ' + errors.map(function (i) { return i.message; }).join('; '));
        await refresh(); return;
      }
      await api('POST', '/products/drafts/' + encodeURIComponent(draft.id) + '/submit');
      toast(B.code + ' v' + next + ' sent to Approvals');
      await refresh(); location.hash = 'approvals';
    } catch (e) { fail('Submit')(e); }
  }

  // ---------------------------------------------------------------- Approvals = open product drafts
  function approvalOf(d) {
    var done = Object.keys(d.approvals || {}), missing = ROLES.filter(function (r) { return done.indexOf(r) < 0; });
    return { id: d.id, title: 'Publish product ' + d.product + ' v' + d.version, kind: 'Product', maker: d.author, agent: null, status: 'PENDING',
      detail: d.status === 'DRAFT' ? 'Draft, not submitted for review yet.' :
        (done.length ? 'Approved by ' + done.map(function (r) { return r + ' (' + d.approvals[r] + ')'; }).join(', ') + '. ' : 'No approvals yet. ') +
        (missing.length ? 'Still needed: ' + missing.join(', ') + '.' : 'All four approvals are in; ready to publish.'),
      draft: d, missing: missing };
  }

  async function loadApprovals() {
    var drafts = await api('GET', '/products/drafts');
    var list = drafts.map(approvalOf);
    F.setApprovals(list);
    var host = $('#apprList');
    if (!list.length) host.innerHTML = '<p class="muted">No product drafts are waiting. Send one from Master Builder.</p>';
    list.forEach(function (a) {
      var card = host.querySelector('[data-approve="' + a.id + '"]'); card = card && card.closest('.appr');
      var act = card.querySelector('.act'), d = a.draft, id = encodeURIComponent(d.id);
      var h = '<div class="row"><button class="btn" type="button" data-live="check">Check</button>';
      if (d.status === 'DRAFT') h += '<button class="btn primary" type="button" data-live="submit">Submit for review</button>';
      else if (a.missing.length) h += '<select aria-label="Approve as role" data-live="role" style="padding:9px 11px;border:1px solid var(--line);border-radius:var(--r);background:var(--surface);color:var(--fg)">' + a.missing.map(function (r) { return '<option>' + r + '</option>'; }).join('') + '</select>' +
        '<button class="btn primary" type="button" data-live="approve">Approve</button>';
      else h += '<button class="btn primary" type="button" data-live="publish">Publish</button>';
      act.innerHTML = h + '</div><div class="result" data-live="report" hidden></div>';
      var report = act.querySelector('[data-live=report]');
      var on = function (what, fn) { var b = act.querySelector('[data-live=' + what + ']'); if (b) b.addEventListener('click', function () { fn().then(loadApprovals, fail(what)); }); };
      var showReport = function (r) {
        var errs = (r.issues || []).filter(function (i) { return i.severity === 'ERROR'; }).length, warns = (r.issues || []).length - errs;
        report.hidden = false; report.className = 'result ' + (errs ? 'warn' : 'ok');
        report.innerHTML = (errs ? errs + ' errors, ' : 'No errors, ') + warns + ' warnings · ' + (r.scenarios || []).length + ' scenarios · golden <span class="mono">' + esc((r.goldenHash || '').slice(0, 12)) + '</span>' +
          (r.issues || []).map(function (i) { return '<br>' + esc(i.severity) + ' · ' + esc(i.path) + ': ' + esc(i.message); }).join('');
      };
      act.querySelector('[data-live=check]').addEventListener('click', function () { api('GET', '/products/drafts/' + id + '/check').then(showReport, fail('Check')); });
      on('submit', function () { return api('POST', '/products/drafts/' + id + '/submit'); });
      on('approve', function () { return api('POST', '/products/drafts/' + id + '/approve', { role: act.querySelector('[data-live=role]').value }).then(function () { toast('Approved'); }); });
      on('publish', function () { return api('POST', '/products/drafts/' + id + '/publish').then(function (v) { toast(v.product + ' v' + v.version + ' published'); }); });
    });
  }

  // ---------------------------------------------------------------- Ledger by account
  var ledgerHead = $('#view-ledger .view-head');
  var ledgerForm = el('<form class="row" id="ledgerForm" style="margin-bottom:14px"><div class="field" style="min-width:300px"><label for="lgAcct">Ledger account</label>' +
    '<input id="lgAcct" placeholder="dep:SAV-P1 · loan:LN-APP1:principal · gl:vat-payable" autocomplete="off"></div>' +
    '<button class="btn primary" type="submit" style="align-self:flex-end">Load postings</button></form>');
  ledgerHead.after(ledgerForm);
  ledgerForm.addEventListener('submit', function (e) { e.preventDefault(); if (signedIn()) loadLedger($('#lgAcct').value.trim()); else toast('Sign in under Settings first'); });
  async function loadLedger(account) {
    try {
      var rows = await api('GET', '/ledger/batches?account=' + encodeURIComponent(account) + '&limit=30');
      F.setBatches(rows.map(function (b) {
        var t = new Date(b.recordedAt), p = function (n) { return ('0' + n).slice(-2); };
        return { id: b.id, time: p(t.getHours()) + ':' + p(t.getMinutes()) + ':' + p(t.getSeconds()), value: F.fdate(new Date(b.valueDate + 'T00:00:00')),
          actor: { type: b.origin, name: b.origin === 'SYSTEM' ? 'scheduler' : 'customer or staff instruction' }, reason: b.reason,
          legs: b.legs.map(function (l) { return { acct: l.account, bt: l.balanceType, side: l.direction, amt: l.minor / 100, ccy: l.currency }; }) };
      }));
      if (!rows.length) $('#batches').innerHTML = '<div class="panel muted">No postings on ' + esc(account) + ' yet.</div>';
    } catch (e) { fail('Load postings')(e); }
  }

  // ---------------------------------------------------------------- Customer 360: register, look up
  var custHead = $('#view-customer .view-head');
  var custTools = el(
    '<div class="grid g2" id="custTools"><div class="panel"><h2>Look up a customer</h2>' +
    '<form class="row" id="custLookup"><div class="field" style="flex:1"><label for="cuId">Party id</label><input id="cuId" autocomplete="off" placeholder="P1"></div>' +
    '<button class="btn primary" type="submit" style="align-self:flex-end">Open</button></form>' +
    '<p class="note">Personal data stays in the vault; this screen shows the party, its account and its contracts.</p></div>' +
    '<div class="panel"><h2>Register a customer</h2><form class="form" id="custRegister">' +
    '<div class="field"><label for="rgId">Party id</label><input id="rgId" required></div>' +
    '<div class="field"><label for="rgName">Full name</label><input id="rgName" required></div>' +
    '<div class="field"><label for="rgNid">National id</label><input id="rgNid" required inputmode="numeric"></div>' +
    '<div class="field"><label for="rgPhone">Phone</label><input id="rgPhone" required inputmode="tel"></div>' +
    '<div class="field"><label for="rgDob">Date of birth</label><input id="rgDob" type="date" required></div>' +
    '<div class="field"><label for="rgDoc">Document reference</label><input id="rgDoc" value="doc-1"></div>' +
    '<div class="field check"><input id="rgKyc" type="checkbox" checked><label for="rgKyc">Consent: KYC processing</label></div>' +
    '<div class="field check"><input id="rgBur" type="checkbox" checked><label for="rgBur">Consent: credit bureau</label></div>' +
    '</form><div class="row"><button class="btn primary" type="button" id="rgGo"><svg class="ico"><use href="#i-check"/></svg><span>Register</span></button></div>' +
    '<div class="result" id="rgOut" hidden></div></div></div>');
  custHead.after(custTools);
  $('#custLookup').addEventListener('submit', function (e) { e.preventDefault(); openCustomer($('#cuId').value.trim()); });
  $('#rgGo').addEventListener('click', async function () {
    var f = $('#custRegister'); if (!f.reportValidity()) return;
    if (!signedIn()) { toast('Sign in under Settings first'); return; }
    var consents = [];
    if ($('#rgKyc').checked) consents.push({ purpose: 'KYC_PROCESSING', version: 1, channel: 'CONSOLE' });
    if ($('#rgBur').checked) consents.push({ purpose: 'CREDIT_BUREAU', version: 1, channel: 'CONSOLE' });
    try {
      var p = await api('POST', '/customers', { partyId: $('#rgId').value, fullName: $('#rgName').value, nationalId: $('#rgNid').value,
        phone: $('#rgPhone').value, dateOfBirth: $('#rgDob').value, documentRef: $('#rgDoc').value, consents: consents });
      var out = $('#rgOut'); out.hidden = false; out.className = 'result ok';
      out.textContent = 'Registered ' + p.id + ' · ' + p.status + (p.depositAccountId ? ' · account ' + p.depositAccountId : '');
      toast('Customer ' + p.id + ' registered'); openCustomer(p.id);
    } catch (e) { var o = $('#rgOut'); o.hidden = false; o.className = 'result warn'; o.textContent = e.message; }
  });

  async function openCustomer(id) {
    if (!signedIn()) { toast('Sign in under Settings first'); return; }
    try {
      var c = await api('GET', '/customers/' + encodeURIComponent(id));
      if (c.depositAccountId) known[c.partyId] = c.depositAccountId;
      var details = await Promise.all(c.loans.map(function (l) { return api('GET', '/loans/' + encodeURIComponent(l.id) + '/detail'); }));
      $('#view-customer .view-head .label').textContent = 'Party ' + c.partyId + ' · Individual';
      $('#h-customer').textContent = c.partyId;
      $('#view-customer .view-head p').textContent = 'Retail customer with ' + (c.depositAccountId ? 'deposit account ' + c.depositAccountId : 'no deposit account yet') + ' and ' + c.loans.length + ' loan' + (c.loans.length === 1 ? '' : 's') + '.';
      $('#view-customer .view-head .row').innerHTML = '<span class="chip ' + (c.status === 'ACTIVE' ? 'good' : 'warn') + '">' + esc(c.status) + '</span>';
      var rows = '';
      details.forEach(function (d) {
        var pct = d.principalMinor ? d.outstandingMinor / d.principalMinor * 100 : 0;
        rows += "<div class='fac child' data-loan='" + esc(d.id) + "' style='cursor:pointer'><span>Loan " + esc(d.id) + ' · ' + esc(d.productCode) + " v" + d.productVersion + "</span><span class='mono muted'>" +
          thb(d.outstandingMinor) + ' / ' + thb(d.principalMinor) + ' · ' + pct.toFixed(0) + "%</span><div class='bar'><span class='" + (d.dpd > 0 ? 'warn' : '') + "' style='width:" + pct.toFixed(1) + "%'></span></div></div>";
      });
      $('#facilities').innerHTML = rows || '<p class="muted">No contracts yet.</p>';
      $$('#facilities [data-loan]').forEach(function (r) { r.addEventListener('click', function () { openLoan(r.getAttribute('data-loan')); }); });
      var panels = $$('#view-customer .grid.g-wide .panel');
      panels[1].innerHTML = '<h2>Profile</h2><dl class="kv"><dt>Party</dt><dd class="mono">' + esc(c.partyId) + '</dd><dt>Status</dt><dd>' + esc(c.status) + '</dd>' +
        '<dt>Deposit account</dt><dd class="mono">' + esc(c.depositAccountId || 'none') + '</dd><dt>Contracts</dt><dd>' + c.loans.length + '</dd></dl>' +
        '<p class="note">Name, national id and phone are tokens in the PII vault and are not shown here.</p>';
      $$('#view-customer .grid.g2:not(#custTools)').forEach(function (g) { g.hidden = true; });   // covenants and collateral belong to commercial credit (Phase 3)
    } catch (e) { fail('Open customer')(e); }
  }

  // ---------------------------------------------------------------- Contracts: apply, load, repay, settle
  var contractHead = $('#view-contract .view-head');
  var today = iso(new Date());
  var contractTools = el(
    '<div class="grid g2" id="loanTools"><div class="panel"><h2>Open a contract</h2>' +
    '<form class="row" id="loanLookup"><div class="field" style="flex:1"><label for="lnId">Loan id</label><input id="lnId" autocomplete="off" placeholder="LN-APP1"></div>' +
    '<button class="btn primary" type="submit" style="align-self:flex-end">Open</button></form>' +
    '<div class="row" id="loanActions" hidden style="margin-top:12px"><div class="field"><label for="lnPay">Repayment, THB</label><input id="lnPay" type="number" min="0.01" step="0.01"></div>' +
    '<button class="btn" type="button" id="lnRepay" style="align-self:flex-end">Record repayment</button>' +
    '<button class="btn" type="button" id="lnSettle" style="align-self:flex-end">Settle early</button></div>' +
    '<div class="result" id="lnOut" hidden></div></div>' +
    '<div class="panel"><h2>Apply for a loan</h2><form class="form" id="loanApply">' +
    '<div class="field"><label for="apId">Application id</label><input id="apId" required></div>' +
    '<div class="field"><label for="apParty">Party id</label><input id="apParty" required></div>' +
    '<div class="field"><label for="apProd">Product code</label><input id="apProd" value="PERSONAL_LOAN_STD" required></div>' +
    '<div class="field"><label for="apVer">Product version</label><input id="apVer" type="number" min="1" value="1" required></div>' +
    '<div class="field"><label for="apAmt">Amount, THB</label><input id="apAmt" type="number" min="1" step="0.01" required></div>' +
    '<div class="field"><label for="apTerm">Term, months</label><input id="apTerm" type="number" min="1" value="12" required></div>' +
    '<div class="field"><label for="apInst">Monthly installment, THB</label><input id="apInst" type="number" min="1" step="0.01" required></div>' +
    '<div class="field"><label for="apInc">Monthly income, THB</label><input id="apInc" type="number" min="0" step="0.01" required></div>' +
    '<div class="field"><label for="apDebt">Existing monthly debt, THB</label><input id="apDebt" type="number" min="0" step="0.01" value="0" required></div>' +
    '<div class="field"><label for="apEmp">Months at employer</label><input id="apEmp" type="number" min="0" value="24" required></div>' +
    '<div class="field"><label for="apAsOf">Application date</label><input id="apAsOf" type="date" value="' + today + '" required></div>' +
    '</form><div class="row"><button class="btn primary" type="button" id="apGo"><svg class="ico"><use href="#i-check"/></svg><span>Decide</span></button></div>' +
    '<div class="result" id="apOut" hidden></div></div></div>');
  contractHead.after(contractTools);
  var currentLoan = null;
  $('#loanLookup').addEventListener('submit', function (e) { e.preventDefault(); openLoan($('#lnId').value.trim()); });
  $('#apGo').addEventListener('click', async function () {
    var f = $('#loanApply'); if (!f.reportValidity()) return;
    if (!signedIn()) { toast('Sign in under Settings first'); return; }
    var out = $('#apOut'); out.hidden = false;
    try {
      var d = await api('POST', '/loans/applications', { applicationId: $('#apId').value, partyId: $('#apParty').value, productCode: $('#apProd').value,
        productVersion: Number($('#apVer').value), amountMinor: minor($('#apAmt').value), termMonths: Number($('#apTerm').value),
        monthlyInstalmentMinor: minor($('#apInst').value), monthlyIncomeMinor: minor($('#apInc').value), existingDebtMinor: minor($('#apDebt').value),
        monthsAtEmployer: Number($('#apEmp').value), asOf: $('#apAsOf').value, currency: 'THB' });
      out.className = 'result ' + (d.decision === 'APPROVE' ? 'ok' : 'warn');
      out.innerHTML = '<strong>' + esc(d.decision) + '</strong> · score ' + d.score + (d.loanId ? ' · loan ' + esc(d.loanId) : '') +
        (d.reasons || []).map(function (r) { return '<br><span class="mono">' + esc(r.code) + '</span> ' + esc(r.text); }).join('');
      if (d.loanId) { toast('Loan ' + d.loanId + ' approved'); openLoan(d.loanId); }
    } catch (e) { out.className = 'result warn'; out.textContent = e.message; }
  });
  $('#lnRepay').addEventListener('click', function () { moveLoan('repayments', { amountMinor: minor($('#lnPay').value) }); });
  $('#lnSettle').addEventListener('click', function () { moveLoan('settlement', { amountMinor: 0 }); });
  async function moveLoan(kind, extra) {
    if (!currentLoan) return;
    try {
      await api('POST', '/loans/' + encodeURIComponent(currentLoan) + '/' + kind, Object.assign({ reference: 'console-' + Date.now(), currency: 'THB', valueDate: today }, extra));
      toast(kind === 'settlement' ? 'Loan settled' : 'Repayment recorded'); openLoan(currentLoan);
    } catch (e) { var o = $('#lnOut'); o.hidden = false; o.className = 'result warn'; o.textContent = e.message; }
  }

  async function openLoan(id) {
    if (!signedIn()) { toast('Sign in under Settings first'); return; }
    try {
      var d = await api('GET', '/loans/' + encodeURIComponent(id) + '/detail');
      currentLoan = d.id; location.hash = 'contract'; $('#loanActions').hidden = false; $('#lnId').value = d.id;
      var fd = function (s) { return F.fdate(new Date(s + 'T00:00:00')); };
      var billedOut = d.instalments.filter(function (i) { return i.billed; });
      var due = { p: 0, i: 0, pen: 0 };
      billedOut.forEach(function (i) { due.p += i.principalMinor - i.principalPaidMinor; due.i += i.interestMinor - i.interestPaidMinor; due.pen += i.penaltyMinor; });
      var paid = d.instalments.filter(function (i) { return i.settled; }).length, n = d.instalments.length;
      $('#view-contract .view-head .label').textContent = 'Loan · ' + d.productCode + ' v' + d.productVersion;
      $('#h-contract').textContent = d.id + ' · ' + d.party;
      $('#view-contract .view-head p').textContent = 'Disbursed ' + fd(d.disbursedOn) + (d.generation ? '. Restructured ' + d.generation + ' time' + (d.generation === 1 ? '' : 's') + '.' : '.');
      $('#contractChips').innerHTML = '<span class="chip ' + (d.dpd > 0 ? 'warn' : 'good') + '">DPD ' + d.dpd + '</span><span class="chip">' + esc(d.status) + '</span>';
      $('#contractTerms').innerHTML = '<dt>Principal</dt><dd class="mono">' + thb(d.principalMinor) + '</dd><dt>Outstanding principal</dt><dd class="mono">' + thb(d.outstandingMinor) + '</dd>' +
        '<dt>Disbursed</dt><dd class="mono">' + fd(d.disbursedOn) + '</dd><dt>Term</dt><dd class="mono">' + n + ' months</dd>' +
        (d.rateOverride ? '<dt>Restructured rate</dt><dd class="mono">' + (d.rateOverride * 100).toFixed(2) + '% p.a.</dd>' : '') + '<dt>Paid</dt><dd class="mono">' + paid + ' of ' + n + '</dd>';
      var bals = [['PRINCIPAL', d.outstandingMinor], ['PRINCIPAL_DUE', due.p], ['INTEREST_DUE', due.i], ['PENALTY_DUE', due.pen]], tot = 0;
      $('#balTable').innerHTML = bals.map(function (b) { tot += b[1]; return "<tr><td class='mono'>" + b[0] + "</td><td class='num'>" + thb(b[1]) + '</td></tr>'; }).join('') +
        "<tr><td><strong>Exposure</strong></td><td class='num'><strong>" + thb(tot) + '</strong></td></tr>';
      var payNow = due.p + due.i + due.pen;
      $('#settleQuote').parentElement.querySelector('h2').textContent = 'Payable now';
      $('#settleQuote').previousElementSibling.textContent = 'What the customer can pay now: billed items that are still unpaid. A full early-settlement quote is calculated when you settle.';
      $('#settleQuote').innerHTML = '<dt>Billed principal</dt><dd class="num">' + thb(due.p) + '</dd><dt>Billed interest</dt><dd class="num">' + thb(due.i) + '</dd>' +
        '<dt>Penalty</dt><dd class="num">' + thb(due.pen) + '</dd><dt><strong>Payable now</strong></dt><dd class="num"><strong>' + thb(payNow) + '</strong></dd>';
      var after = d.principalMinor, firstOpen = d.instalments.findIndex(function (i) { return !i.settled; });
      var rows = d.instalments.map(function (i, k) {
        after -= i.principalMinor; var inst = i.principalMinor + i.interestMinor, owed = i.billed ? i.principalMinor - i.principalPaidMinor + i.interestMinor - i.interestPaidMinor + i.penaltyMinor - 0 : inst;
        var overdue = i.billed && !i.settled && i.dueDate < today;
        var st = i.settled ? "<span class='chip good'>Paid</span>" : overdue ? "<span class='chip warn'>Overdue</span>" : i.billed ? "<span class='chip acc'>Billed</span>" : "<span class='chip'>Scheduled</span>";
        return { k: k, html: "<tr class='" + (i.settled ? 'paid' : k === firstOpen ? 'hl' : '') + "'><td class='mono'>" + i.number + "</td><td class='mono'>" + fd(i.dueDate) + "</td><td class='num'>" + thb(inst) +
          "</td><td class='num'>" + thb(i.interestMinor) + "</td><td class='num'>" + thb(i.principalMinor) + "</td><td class='num'>—</td><td class='num'>" + thb(i.settled ? 0 : owed) +
          "</td><td class='num'>" + thb(Math.max(0, after)) + '</td><td>' + st + '</td></tr>' };
      });
      var showAll = false, paint = function () {
        var from = showAll ? 0 : Math.max(0, firstOpen - 2), to = showAll ? rows.length : Math.min(rows.length, (firstOpen < 0 ? rows.length : firstOpen) + 6);
        $('#schedBody').innerHTML = rows.slice(from, to).map(function (r) { return r.html; }).join('');
        $('#schedNote').textContent = showAll ? 'All ' + n + ' installments' : 'Installments ' + (from + 1) + '–' + to + ' of ' + n;
        $('#schedToggle').textContent = showAll ? 'Show around today' : 'Show all installments';
      };
      var tg = $('#schedToggle'), fresh = tg.cloneNode(true); tg.replaceWith(fresh);          // drop the prototype's handler, which redraws sample rows
      fresh.addEventListener('click', function () { showAll = !showAll; paint(); });
      $('#schedBody').closest('table').querySelector('thead th:nth-child(6)').textContent = 'VAT';          // the schedule's own header, not the queue's
      paint();
      loadLoanCollections(d.id);
      loadRepossession(d.id);
    } catch (e) { fail('Open contract')(e); }
  }

  // ---------------------------------------------------------------- Collections (on the Contracts screen): worklist, contacts, promises
  var STEP = { REMIND: ['Remind', ''], CALL: ['Call', 'acc'], LETTER: ['Send letter', 'warn'], FIELD_VISIT: ['Field visit', 'warn'],
    RESTRUCTURE_REVIEW: ['Review for restructuring', 'crit'], WRITE_OFF_REVIEW: ['Review for write-off', 'crit'] };
  var stepChip = function (a) { var s = STEP[a] || [a, '']; return "<span class='chip " + s[1] + "'>" + esc(s[0]) + '</span>'; };
  var promiseCell = function (i) {
    return i.promiseBroken ? "<span class='chip crit'>Broken</span>" : i.openPromiseBy ? "<span class='chip acc'>By " + esc(i.openPromiseBy) + '</span>' : "<span class='muted'>—</span>";
  };
  var collectionsPanel = el(
    '<div class="panel" id="collectionsPanel"><div class="panel-head"><h2>Collections queue</h2><div class="row"><span class="muted" id="colNote"></span>' +
    '<button class="btn" type="button" id="colRefresh">Refresh</button></div></div>' +
    '<div class="tbl-wrap"><table><thead><tr><th>Loan</th><th>Customer</th><th class="num">Days late</th><th class="num">Overdue</th><th>Next step</th><th class="num">Contacts</th><th>Promise</th></tr></thead>' +
    '<tbody id="colBody"></tbody></table></div>' +
    '<p class="note">Days late run from the oldest billed installment that is still unpaid. The next step follows the product delinquency buckets; restructuring and write-off stay a decision for a person. Click a row to open the loan.</p></div>');
  contractTools.after(collectionsPanel);
  var loanCol = el(
    '<div class="panel" id="loanCollections" hidden><h2>Collections on this loan</h2><p class="muted" id="lcStatus"></p>' +
    '<div class="grid g2"><form class="form" id="lcContact"><div class="field"><label for="lcChannel">Contact channel</label><select id="lcChannel">' +
    '<option>CALL</option><option>SMS</option><option>LETTER</option><option>VISIT</option><option>EMAIL</option></select></div>' +
    '<div class="field"><label for="lcNote">Note</label><input id="lcNote" autocomplete="off"></div><div class="row"><button class="btn" type="submit">Log contact</button></div></form>' +
    '<form class="form" id="lcPromise"><div class="field"><label for="lcAmt">Promised, THB</label><input id="lcAmt" type="number" min="0.01" step="0.01" required></div>' +
    '<div class="field"><label for="lcBy">Pay by</label><input id="lcBy" type="date" required></div>' +
    '<div class="field"><label for="lcPNote">Note</label><input id="lcPNote" autocomplete="off"></div><div class="row"><button class="btn primary" type="submit">Record promise</button></div></form></div>' +
    '<div class="tbl-wrap"><table><thead><tr><th>Date</th><th>Type</th><th>Detail</th></tr></thead><tbody id="lcBody"></tbody></table></div>' +
    '<div class="result" id="lcOut" hidden></div></div>');
  collectionsPanel.after(loanCol);
  $('#lcBy').value = iso(new Date(Date.now() + 7 * 86400000));
  var queueByLoan = {}, colLoan = null;

  async function loadQueue() {
    try {
      var q = await api('GET', '/collections/queue?asOf=' + today);
      queueByLoan = {};
      q.forEach(function (i) { queueByLoan[i.loanId] = i; });
      $('#colBody').innerHTML = q.map(function (i) {
        return "<tr data-col-loan='" + esc(i.loanId) + "' style='cursor:pointer'><td class='mono'>" + esc(i.loanId) + "</td><td class='mono'>" + esc(i.party) + "</td><td class='num'>" + i.daysPastDue +
          "</td><td class='num'>" + thb(i.overdue) + '</td><td>' + stepChip(i.recommended) + "</td><td class='num'>" + i.contacts + '</td><td>' + promiseCell(i) + '</td></tr>';
      }).join('') || "<tr><td colspan='7' class='muted'>Nothing is overdue.</td></tr>";
      $('#colNote').textContent = q.length + ' loan' + (q.length === 1 ? '' : 's') + ' overdue as of ' + today;
      $$('#colBody [data-col-loan]').forEach(function (r) { r.addEventListener('click', function () { openLoan(r.getAttribute('data-col-loan')); }); });
    } catch (e) { fail('Load collections queue')(e); }
  }
  $('#colRefresh').addEventListener('click', function () { if (signedIn()) loadQueue(); else toast('Sign in under Settings first'); });

  async function loadLoanCollections(id) {
    colLoan = id;
    $('#loanCollections').hidden = false;
    $('#lcOut').hidden = true;
    try {
      await loadQueue();
      var events = await api('GET', '/collections/' + encodeURIComponent(id));
      var i = queueByLoan[id];
      $('#lcStatus').textContent = i ? i.daysPastDue + ' days late, ฿' + thb(i.overdue) + ' overdue. Next step: ' + (STEP[i.recommended] || [i.recommended])[0].toLowerCase() + '.' +
        (i.lastContact ? ' Last contact ' + i.lastContact + '.' : ' Not contacted yet.') + (i.promiseBroken ? ' The last promise was broken.' : i.openPromiseBy ? ' A promise is open until ' + i.openPromiseBy + '.' : '')
        : 'Nothing is overdue on this loan.';
      $('#lcBody').innerHTML = events.slice().reverse().map(function (e) {
        var what = e.kind === 'PROMISE' ? 'Promise to pay' : 'Contact · ' + e.channel.toLowerCase();
        return "<tr><td class='mono'>" + esc(e.date) + '</td><td>' + what + '</td><td>' + (e.kind === 'PROMISE' ? esc('฿' + thb(e.promisedAmount) + ' by ' + e.payBy) + (e.note ? ' · ' + esc(e.note) : '') : esc(e.note || '')) + '</td></tr>';
      }).join('') || "<tr><td colspan='3' class='muted'>No contacts or promises recorded.</td></tr>";
    } catch (e) { say('#lcOut', 'warn', e.message); }
  }
  $('#lcContact').addEventListener('submit', async function (e) {
    e.preventDefault();
    if (!colLoan) return;
    try {
      await api('POST', '/collections/' + encodeURIComponent(colLoan) + '/contacts', { reference: 'console-' + Date.now(), date: today, channel: $('#lcChannel').value, note: $('#lcNote').value });
      $('#lcNote').value = '';
      await loadLoanCollections(colLoan);
      say('#lcOut', 'ok', 'Contact logged.');
    } catch (err) { say('#lcOut', 'warn', err.message); }
  });
  $('#lcPromise').addEventListener('submit', async function (e) {
    e.preventDefault();
    if (!colLoan) return;
    try {
      await api('POST', '/collections/' + encodeURIComponent(colLoan) + '/promises', { reference: 'console-' + Date.now(), date: today, amount: minor($('#lcAmt').value), payBy: $('#lcBy').value, note: $('#lcPNote').value });
      $('#lcAmt').value = '';
      $('#lcPNote').value = '';
      await loadLoanCollections(colLoan);
      say('#lcOut', 'ok', 'Promise recorded.');
    } catch (err) { say('#lcOut', 'warn', err.message); }
  });

  // ---------------------------------------------------------------- Branch and teller: cash deposit posts to the ledger
  var tAcct = $('#tAcct');
  var acctInput = el('<input id="tAcct" list="tAcctList" autocomplete="off" placeholder="SAV-P1">');
  var acctList = el('<datalist id="tAcctList"></datalist>');
  tAcct.replaceWith(acctInput); acctInput.after(acctList);
  $('#tPost').addEventListener('click', async function (e) {
    if (!signedIn()) return;                                           // signed out: the prototype's own sample handler runs
    e.stopImmediatePropagation();
    var res = $('#tResult'), amt = parseFloat($('#tAmt').value) || 0; res.hidden = false;
    if (amt <= 0) { res.className = 'result warn'; res.textContent = 'Enter an amount above zero.'; return; }
    try {
      var acct = acctInput.value.trim();
      await api('POST', '/accounts/' + encodeURIComponent(acct) + '/deposits', { reference: 'teller-' + Date.now(), amountMinor: minor(amt), currency: 'THB', valueDate: today });
      var bal = await api('GET', '/accounts/' + encodeURIComponent(acct) + '/balance?asOf=' + today);
      res.className = 'result ok'; res.textContent = 'Posted ฿' + fmt(amt) + ' to ' + acct + '. Balance now ฿' + thb(bal.minor) + '.';
      toast('Cash deposit posted · ฿' + fmt(amt));
    } catch (err) { res.className = 'result warn'; res.textContent = err.message; }
  }, true);
  function fillAccounts() { acctList.innerHTML = Object.keys(known).map(function (p) { return '<option value="' + esc(known[p]) + '">' + esc(p) + '</option>'; }).join(''); }
  setInterval(fillAccounts, 1500);

  // the prototype's forms only prevent submission; keep that behaviour now that the inline handlers are gone
  // ---------------------------------------------------------------- Fleet and floor plan
  var fleetBox = $('#af-fleet'), floorBox = $('#af-floor');
  var daysBetween = function (a, b) { return Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000); };
  function setKpi(box, i, label, value, note) {
    var k = box.querySelectorAll('.kpi')[i];
    if (label) k.querySelector('.label').textContent = label;
    k.querySelector('.v').textContent = value;
    k.querySelector('.d').textContent = note;
  }
  function say(id, cls, text) { var o = $(id); o.hidden = false; o.className = 'result ' + cls; o.textContent = text; }

  // fleet: one master agreement and its schedules
  fleetBox.prepend(el(
    '<div class="panel" id="fleetTools"><h2>Open a master agreement</h2>' +
    '<form class="row" id="fleetLookup"><div class="field" style="flex:1"><label for="maId">Agreement id</label><input id="maId" autocomplete="off" placeholder="MA-1"></div>' +
    '<button class="btn primary" type="submit" style="align-self:flex-end">Open</button></form>' +
    '<div class="row" id="fleetActions" hidden style="margin-top:12px"><div class="field"><label for="maPay">Payment, THB</label><input id="maPay" type="number" min="0.01" step="0.01"></div>' +
    '<button class="btn" type="button" id="maCollect" style="align-self:flex-end">Collect payment</button>' +
    '<button class="btn" type="button" id="maEval" style="align-self:flex-end">Evaluate cross-default</button>' +
    '<button class="btn" type="button" id="maCure" style="align-self:flex-end">Cure</button></div>' +
    '<div class="result" id="maOut" hidden></div></div>'));
  var currentMaster = null;
  $('#fleetLookup').addEventListener('submit', function (e) { e.preventDefault(); openMaster($('#maId').value.trim()); });
  async function openMaster(id) {
    if (!signedIn()) { toast('Sign in under Settings first'); return; }
    try {
      var base = '/masters/' + encodeURIComponent(id);
      var m = await api('GET', base);
      var got = await Promise.all([api('GET', base + '/facility'), api('GET', base + '/schedules'), api('GET', base + '/invoice?asOf=' + today)]);
      var fac = got[0], schedules = got[1], inv = got[2];
      var details = await Promise.all(schedules.map(function (s) { return api('GET', '/loans/' + encodeURIComponent(s.loanId) + '/detail'); }));
      currentMaster = m.id;
      var units = schedules.reduce(function (n, s) { return n + s.assetIds.length; }, 0);
      setKpi(fleetBox, 0, null, m.id, m.party + ' · ' + m.status.toLowerCase() + ' · cross-default at ' + m.crossDefaultDpd + ' days');
      setKpi(fleetBox, 1, null, String(units), schedules.length + ' schedule' + (schedules.length === 1 ? '' : 's'));
      var pct = fac.limitMinor ? fac.utilisationMinor / fac.limitMinor * 100 : 0;
      setKpi(fleetBox, 2, null, '฿' + thb(fac.utilisationMinor), 'of ฿' + thb(fac.limitMinor) + ' · ' + pct.toFixed(0) + '% used');
      setKpi(fleetBox, 3, 'Invoice today', '฿' + thb(inv.total), inv.lines.length + ' instalment' + (inv.lines.length === 1 ? '' : 's') + ' due, oldest first');
      $('#fTable').innerHTML = schedules.map(function (s, i) {
        var d = details[i], n = s.assetIds.length, first = d.instalments[0];
        return "<tr><td class='mono'>" + esc(s.loanId) + "</td><td>" + (n ? esc(s.assetIds.join(', ')) : "<span class='muted'>no vehicles recorded</span>") + "</td><td class='num'>" + (n || '—') +
          "</td><td class='num'>" + (n ? thb(Math.round(d.principalMinor / n)) : '—') + "</td><td class='mono'>" + s.term + 'm · ' + (s.lockedRate * 100).toFixed(2) + "%</td><td class='mono'>" + esc(s.calledOffOn) +
          "</td><td class='num'>" + (first ? thb(first.principalMinor + first.interestMinor) : '—') + "</td><td class='num'>" + thb(d.outstandingMinor) + "</td><td><span class='muted'>—</span></td></tr>";
      }).join('') || "<tr><td colspan='9' class='muted'>No schedules drawn yet.</td></tr>";
      $('#af-fleet thead th:nth-child(7)').textContent = 'First instalment';      // the loan view carries no VAT, so the prototype's "with VAT" would mislead
      $('#fleetActions').hidden = false;
      $('#maOut').hidden = true;
    } catch (e) { fail('Open master agreement')(e); }
  }
  async function masterAction(path, ok) {
    if (!currentMaster) return;
    try {
      var r = await api('POST', '/masters/' + encodeURIComponent(currentMaster) + path);
      await openMaster(currentMaster);
      say('#maOut', 'ok', ok(r));
    } catch (e) { say('#maOut', 'warn', e.message); }
  }
  $('#maEval').addEventListener('click', function () {
    masterAction('/evaluation?asOf=' + today, function (r) { return 'Agreement is ' + r.status + (r.status === 'DEFAULTED' ? ': a schedule is at or past ' + r.crossDefaultDpd + ' days.' : '.'); });
  });
  $('#maCure').addEventListener('click', function () {
    masterAction('/cure?asOf=' + today, function (r) { return r.status === 'ACTIVE' ? 'Cured: the agreement is ACTIVE again.' : 'Not cured: the agreement is ' + r.status + '.'; });
  });
  $('#maCollect').addEventListener('click', async function () {
    var amt = minor($('#maPay').value);
    if (!currentMaster || !(amt > 0)) { say('#maOut', 'warn', 'Enter an amount above zero.'); return; }
    try {
      await api('POST', '/masters/' + encodeURIComponent(currentMaster) + '/collections', { reference: 'console-' + Date.now(), amountMinor: amt, date: today });
      await openMaster(currentMaster);
      say('#maOut', 'ok', 'Collected ฿' + thb(amt) + ' across the schedules, oldest first.');
      toast('Payment collected');
    } catch (e) { say('#maOut', 'warn', e.message); }
  });

  // floor plan: one dealer line and its units
  floorBox.prepend(el(
    '<div class="panel" id="floorTools"><h2>Open a dealer line</h2>' +
    '<form class="row" id="floorLookup"><div class="field" style="flex:1"><label for="fpId">Line id</label><input id="fpId" autocomplete="off" placeholder="FP-1"></div>' +
    '<button class="btn primary" type="submit" style="align-self:flex-end">Open</button></form>' +
    '<div id="floorActions" hidden>' +
    '<form class="row" id="fpDraw" style="margin-top:12px;flex-wrap:wrap"><div class="field"><label for="fpUnit">Unit (VIN)</label><input id="fpUnit" autocomplete="off" required></div>' +
    '<div class="field"><label for="fpType">Type</label><select id="fpType"><option>NEW</option><option>USED</option><option>DEMO</option></select></div>' +
    '<div class="field"><label for="fpAmt">Amount, THB</label><input id="fpAmt" type="number" min="0.01" step="0.01" required></div>' +
    '<div class="field"><label for="fpSup">Distributor account</label><input id="fpSup" autocomplete="off" required></div>' +
    '<button class="btn primary" type="submit" style="align-self:flex-end">Draw unit</button></form>' +
    '<form class="row" id="fpAudit" style="margin-top:12px"><div class="field" style="flex:1"><label for="fpFound">Units found on the lot (VINs, separated by spaces or commas)</label><input id="fpFound" autocomplete="off"></div>' +
    '<button class="btn" type="submit" style="align-self:flex-end">Run stock audit</button></form>' +
    '<div class="row" style="margin-top:12px"><button class="btn" type="button" id="fpFreeze">Freeze line</button><button class="btn" type="button" id="fpUnfreeze">Unfreeze line</button></div></div>' +
    '<div class="result" id="fpOut" hidden></div></div>'));
  var currentLine = null;
  $('#floorLookup').addEventListener('submit', function (e) { e.preventDefault(); openLine($('#fpId').value.trim()); });
  async function openLine(id) {
    if (!signedIn()) { toast('Sign in under Settings first'); return; }
    try {
      var base = '/floorplans/' + encodeURIComponent(id);
      var line = await api('GET', base);
      var got = await Promise.all([api('GET', base + '/units'), api('GET', base + '/statement?asOf=' + today), api('GET', base + '/exposure')]);
      var units = got[0], st = got[1], exp = got[2];
      currentLine = line.id;
      var due = {};
      st.rows.forEach(function (r) { due[r.unitId] = r; });
      var stock = units.filter(function (u) { return u.status === 'OPEN' && !u.soldOn; });
      var mix = ['NEW', 'USED', 'DEMO'].map(function (t) {
        var n = stock.filter(function (u) { return u.type === t; }).length;
        return n ? n + ' ' + t.toLowerCase() : '';
      }).filter(Boolean).join(' · ');
      setKpi(floorBox, 0, null, line.dealerId, 'Line ' + line.id + ' · ' + line.status.toLowerCase());
      setKpi(floorBox, 1, null, String(stock.length), mix || 'no unsold units');
      setKpi(floorBox, 2, null, '฿' + thb(exp.exposureMinor), 'of ฿' + thb(line.limit) + ' · ' + (line.limit ? (exp.exposureMinor / line.limit * 100).toFixed(0) : 0) + '% used');
      setKpi(floorBox, 3, 'Due now', '฿' + thb(st.total), 'Interest plus curtailments as of today');
      var steps = line.curtailments.map(function (c) { return c.cumulativePercent + '% at ' + c.atDay + ' days'; }).join(', ');
      floorBox.querySelector('.panel-head .chip').textContent = (line.annualRate * 100).toFixed(2) + '% a year after each type\'s free days · ' + (steps ? 'curtailment ' + steps : 'no curtailment steps');
      $('#pTable').innerHTML = units.map(function (u) {
        var r = due[u.unitId], overdue = r && r.saleOverdue;
        var chip = u.status === 'PAID' ? "<span class='chip good'>Paid</span>" : overdue ? "<span class='chip crit'>Sold, payoff overdue</span>" :
          u.soldOn ? "<span class='chip warn'>Sold " + esc(u.soldOn) + "</span>" : "<span class='chip'>In stock</span>";
        var acts = u.status === 'OPEN' ? (u.soldOn ? '' : "<button class='btn' type='button' data-fp-sale='" + esc(u.unitId) + "'>Record sale</button> ") +
          "<button class='btn' type='button' data-fp-payoff='" + esc(u.unitId) + "'>Pay off</button>" : '';
        return "<tr><td class='mono'>" + esc(u.unitId) + "</td><td><span class='muted'>—</span></td><td>" + esc(u.type.toLowerCase()) + "</td><td class='num'>" + thb(u.drawn) +
          "</td><td class='num'>" + daysBetween(u.drawnOn, today) + "</td><td>" + chip + "</td><td class='num'>" + (r ? thb(r.interestDue) : '—') + "</td><td class='num'>" + (r ? thb(r.principalDue) : '—') +
          "</td><td>" + acts + "</td></tr>";
      }).join('') || "<tr><td colspan='9' class='muted'>No units drawn yet.</td></tr>";
      $$('#pTable [data-fp-sale]').forEach(function (b) {
        b.addEventListener('click', function () { unitAction(b.getAttribute('data-fp-sale'), '/sale', { soldOn: today }, 'Sale recorded'); });
      });
      $$('#pTable [data-fp-payoff]').forEach(function (b) {
        b.addEventListener('click', function () { unitAction(b.getAttribute('data-fp-payoff'), '/payoff', { reference: 'console-' + Date.now(), date: today }, 'Unit paid off'); });
      });
      $('#af-floor thead th:nth-child(7)').textContent = 'Interest owed';          // accrued so far, not just this month
      $('#sotAlert').hidden = true;
      $('#floorActions').hidden = false;
      $('#fpOut').hidden = true;
    } catch (e) { fail('Open dealer line')(e); }
  }
  async function unitAction(unit, path, body, done) {
    try {
      await api('POST', '/floorplans/' + encodeURIComponent(currentLine) + '/units/' + encodeURIComponent(unit) + path, body);
      await openLine(currentLine);
      say('#fpOut', 'ok', done + ': ' + unit + '.');
    } catch (e) { say('#fpOut', 'warn', e.message); }
  }
  $('#fpDraw').addEventListener('submit', async function (e) {
    e.preventDefault();
    var unit = $('#fpUnit').value.trim();
    try {
      await api('POST', '/floorplans/' + encodeURIComponent(currentLine) + '/units', { unitId: unit, type: $('#fpType').value,
        amountMinor: minor($('#fpAmt').value), date: today, supplierAccountId: $('#fpSup').value.trim() });
      await openLine(currentLine);
      say('#fpOut', 'ok', 'Drew ' + unit + ' on the line.');
      toast('Unit drawn');
    } catch (err) { say('#fpOut', 'warn', err.message); }
  });
  $('#fpAudit').addEventListener('submit', async function (e) {
    e.preventDefault();
    try {
      var found = $('#fpFound').value.split(/[\s,]+/).filter(Boolean);
      var a = await api('POST', '/floorplans/' + encodeURIComponent(currentLine) + '/stock-audit', { asOf: today, found: found });
      var list = function (title, ids) { return ids.length ? '<p><strong>' + title + ':</strong> ' + ids.map(esc).join(', ') + '</p>' : ''; };
      var panel = $('#sotAlert');
      panel.innerHTML = '<div class="row"><span class="chip ' + (a.clean ? 'good' : 'warn') + '">Stock audit · ' + (a.clean ? 'clean' : 'findings') + '</span><span class="muted" style="font-size:12px">' +
        a.checked + ' open unit' + (a.checked === 1 ? '' : 's') + ' checked against ' + found.length + ' found on the lot, as of ' + esc(a.asOf) + '</span></div>' +
        (a.clean ? '<p>Every open unit is on the lot and no unknown unit was found.</p>' :
          list('Possible sold out of trust (not on the lot)', a.missing) + list('Sold and not paid off in the window', a.saleOverdue) + list('On the lot but not on this line', a.unexpected));
      panel.hidden = false;
    } catch (err) { say('#fpOut', 'warn', err.message); }
  });
  async function lineStatus(path, text) {
    try {
      await api('POST', '/floorplans/' + encodeURIComponent(currentLine) + path);
      await openLine(currentLine);
      say('#fpOut', 'ok', text);
    } catch (e) { say('#fpOut', 'warn', e.message); }
  }
  $('#fpFreeze').addEventListener('click', function () { lineStatus('/freeze', 'Line frozen: no new drawdowns.'); });
  $('#fpUnfreeze').addEventListener('click', function () { lineStatus('/unfreeze', 'Line is active again.'); });

  // ---------------------------------------------------------------- Assets: a third tab on the Fleet and floor plan screen
  var afSeg = $('#view-assetfin .seg');
  var extraTabs = [];
  function addTab(key, label, box, load) {
    var btn = el('<button type="button" data-af="' + key + '" aria-pressed="false">' + label + '</button>');
    afSeg.appendChild(btn);
    $('#view-assetfin').appendChild(box);
    extraTabs.push(box);
    btn.addEventListener('click', function () {
      extraTabs.forEach(function (x) { x.hidden = x !== box; });
      $('#af-fleet').hidden = true; $('#af-floor').hidden = true;
      $$('#view-assetfin [data-af]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === btn)); });
      if (signedIn() && load) load();
    });
  }
  $$('#view-assetfin [data-af=fleet], #view-assetfin [data-af=floor]').forEach(function (b) {
    b.addEventListener('click', function () { extraTabs.forEach(function (x) { x.hidden = true; }); });
  });
  var assetsBox = el(
    '<div id="af-assets" class="grid" style="gap:20px" hidden>' +
    '<div class="panel" id="assetTools"><h2>Open an asset</h2>' +
    '<form class="row" id="assetLookup"><div class="field" style="flex:1"><label for="asId">Asset id</label><input id="asId" autocomplete="off" placeholder="A1"></div>' +
    '<button class="btn primary" type="submit" style="align-self:flex-end">Open</button></form>' +
    '<div class="result" id="asOut" hidden></div></div>' +
    '<div class="kpis k4" id="assetKpis" hidden>' +
    '<div class="kpi"><span class="label">Asset</span><span class="v" id="akAsset" style="font-size:20px"></span><span class="d" id="akAssetD"></span></div>' +
    '<div class="kpi"><span class="label">Status</span><span class="v" id="akStatus" style="font-size:20px"></span><span class="d" id="akStatusD"></span></div>' +
    '<div class="kpi"><span class="label">Contract</span><span class="v" id="akContract" style="font-size:20px"></span><span class="d" id="akContractD"></span></div>' +
    '<div class="kpi"><span class="label">Insurance today</span><span class="v" id="akCover" style="font-size:20px"></span><span class="d" id="akCoverD"></span></div></div>' +
    '<div class="grid g2" id="assetPanels" hidden>' +
    '<div class="panel"><h2>Details</h2><dl class="kv" id="assetKv"></dl></div>' +
    '<div class="panel"><h2>Title history</h2><div class="tbl-wrap"><table><thead><tr><th>Date</th><th>From</th><th>To</th><th>Note</th></tr></thead><tbody id="assetTitle"></tbody></table></div></div></div>' +
    '<div class="panel" id="assetActions" hidden><h2>Actions on this asset</h2>' +
    '<form class="row" id="asDeliver" style="flex-wrap:wrap"><div class="field"><label for="asReg">Registration no.</label><input id="asReg" autocomplete="off"></div>' +
    '<div class="field"><label for="asEng">Engine no.</label><input id="asEng" autocomplete="off"></div><button class="btn" type="submit" style="align-self:flex-end">Record delivery</button></form>' +
    '<form class="row" id="asActivate" style="flex-wrap:wrap;margin-top:10px"><div class="field"><label for="asContract">Contract (loan or lease id)</label><input id="asContract" autocomplete="off"></div>' +
    '<div class="field check"><input id="asIns" type="checkbox" checked><label for="asIns">Insurance required</label></div><button class="btn" type="submit" style="align-self:flex-end">Put under contract</button></form>' +
    '<form class="row" id="asPolicy" style="flex-wrap:wrap;margin-top:10px"><div class="field"><label for="asInsurer">Insurer</label><input id="asInsurer" autocomplete="off"></div>' +
    '<div class="field"><label for="asPolNo">Policy no.</label><input id="asPolNo" autocomplete="off"></div>' +
    '<div class="field"><label for="asFrom">From</label><input id="asFrom" type="date"></div><div class="field"><label for="asTo">To</label><input id="asTo" type="date"></div>' +
    '<div class="field"><label for="asSum">Sum insured, THB</label><input id="asSum" type="number" min="0.01" step="0.01"></div>' +
    '<div class="field"><label for="asPrem">Premium, THB</label><input id="asPrem" type="number" min="0" step="0.01" value="0"></div>' +
    '<div class="field check"><input id="asFin" type="checkbox"><label for="asFin">Premium financed</label></div><button class="btn" type="submit" style="align-self:flex-end">Add policy</button></form>' +
    '<form class="row" id="asPlace" style="flex-wrap:wrap;margin-top:10px"><div class="field"><label for="asLoc">Location</label><input id="asLoc" autocomplete="off"></div>' +
    '<button class="btn" type="submit" style="align-self:flex-end">Move</button>' +
    '<div class="field"><label for="asCond">Condition</label><select id="asCond"><option>NEW</option><option>GOOD</option><option>FAIR</option><option>POOR</option><option>DAMAGED</option></select></div>' +
    '<button class="btn" type="button" id="asSetCond" style="align-self:flex-end">Set condition</button></form>' +
    '<div class="row" style="margin-top:10px"><button class="btn" type="button" id="asTitle">Transfer title to customer</button><button class="btn" type="button" id="asReturn">Return to lessor</button></div></div>' +
    '<div class="panel"><h2>Register an asset</h2><form class="form" id="asOrder">' +
    '<div class="field"><label for="orId">Asset id</label><input id="orId" required></div>' +
    '<div class="field"><label for="orKind">Kind</label><select id="orKind"><option>VEHICLE</option><option>EQUIPMENT</option></select></div>' +
    '<div class="field"><label for="orMake">Make</label><input id="orMake" required></div><div class="field"><label for="orModel">Model</label><input id="orModel" required></div>' +
    '<div class="field"><label for="orSerial">Serial or VIN</label><input id="orSerial" required></div><div class="field"><label for="orDealer">Dealer id</label><input id="orDealer" required></div>' +
    '<div class="field"><label for="orCost">Cost, THB</label><input id="orCost" type="number" min="0.01" step="0.01" required></div>' +
    '<div class="field"><label for="orLoc">Location</label><input id="orLoc"></div></form>' +
    '<div class="row"><button class="btn primary" type="button" id="orGo"><svg class="ico"><use href="#i-plus"/></svg><span>Order asset</span></button></div></div>' +
    '<div class="panel"><div class="panel-head"><h2>Needs attention</h2><button class="btn" type="button" id="asRefresh">Refresh</button></div>' +
    '<h3 style="margin-bottom:6px">Active assets with no insurance today</h3><div class="tbl-wrap"><table><thead><tr><th>Asset</th><th>Make and model</th><th>Contract</th><th>Location</th></tr></thead><tbody id="asUninsured"></tbody></table></div>' +
    '<h3 style="margin:14px 0 6px">Cover ending within 30 days</h3><div class="tbl-wrap"><table><thead><tr><th>Asset</th><th>Make and model</th><th>Contract</th><th>Location</th></tr></thead><tbody id="asExpiring"></tbody></table></div></div>' +
    '</div>');
  addTab('assets', 'Assets', assetsBox, function () { loadAttention(); });
  var currentAsset = null;
  $('#assetLookup').addEventListener('submit', function (e) { e.preventDefault(); openAsset($('#asId').value.trim()); });
  var attentionRows = function (list) {
    return list.map(function (a) {
      return "<tr data-asset='" + esc(a.id) + "' style='cursor:pointer'><td class='mono'>" + esc(a.id) + '</td><td>' + esc(a.make + ' ' + a.model) + "</td><td class='mono'>" + esc(a.contractId || '—') + '</td><td>' + esc(a.location || '—') + '</td></tr>';
    }).join('') || "<tr><td colspan='4' class='muted'>None.</td></tr>";
  };
  async function loadAttention() {
    try {
      var got = await Promise.all([api('GET', '/assets/uninsured?day=' + today), api('GET', '/assets/expiring-cover?day=' + today + '&days=30')]);
      $('#asUninsured').innerHTML = attentionRows(got[0]);
      $('#asExpiring').innerHTML = attentionRows(got[1]);
      $$('#asUninsured [data-asset], #asExpiring [data-asset]').forEach(function (r) { r.addEventListener('click', function () { openAsset(r.getAttribute('data-asset')); }); });
    } catch (e) { fail('Load assets needing attention')(e); }
  }
  $('#asRefresh').addEventListener('click', function () { if (signedIn()) loadAttention(); else toast('Sign in under Settings first'); });

  async function openAsset(id) {
    if (!signedIn()) { toast('Sign in under Settings first'); return; }
    try {
      var base = '/assets/' + encodeURIComponent(id);
      var got = await Promise.all([api('GET', base), api('GET', base + '/title-history'), api('GET', base + '/coverage?day=' + today)]);
      var a = got[0], title = got[1], cov = got[2];
      currentAsset = a.id;
      $('#asId').value = a.id;
      $('#assetKpis').hidden = false; $('#assetPanels').hidden = false; $('#assetActions').hidden = false;
      $('#akAsset').textContent = a.id;
      $('#akAssetD').textContent = a.make + ' ' + a.model + (a.registrationNo ? ' · ' + a.registrationNo : '');
      $('#akStatus').textContent = a.status.toLowerCase();
      $('#akStatusD').textContent = 'Condition ' + a.condition.toLowerCase() + (a.location ? ' · ' + a.location : '');
      $('#akContract').textContent = a.contractId || 'none';
      $('#akContractD').textContent = 'Title held by the ' + a.titleHolder.toLowerCase();
      $('#akCover').textContent = cov.covered ? 'covered' : 'not covered';
      $('#akCoverD').textContent = cov.covered ? cov.policy.insurer + ' · to ' + cov.policy.to : 'no policy in force today';
      $('#assetKv').innerHTML = '<dt>Serial or VIN</dt><dd class="mono">' + esc(a.serialNo) + '</dd><dt>Engine no.</dt><dd class="mono">' + esc(a.engineNo || '—') + '</dd>' +
        '<dt>Registration</dt><dd class="mono">' + esc(a.registrationNo || '—') + '</dd><dt>Dealer</dt><dd class="mono">' + esc(a.dealerId) + '</dd>' +
        '<dt>Cost</dt><dd class="mono">' + thb(a.cost) + ' ' + esc(a.currency) + '</dd><dt>Kind</dt><dd>' + esc(a.kind.toLowerCase()) + '</dd>';
      $('#assetTitle').innerHTML = title.map(function (t) {
        return "<tr><td class='mono'>" + esc(t.on) + '</td><td>' + esc(t.from ? t.from.toLowerCase() : '—') + '</td><td>' + esc(t.to.toLowerCase()) + '</td><td>' + esc(t.note || t.reference || '') + '</td></tr>';
      }).join('') || "<tr><td colspan='4' class='muted'>No title events yet.</td></tr>";
      $('#asOut').hidden = true;
    } catch (e) { fail('Open asset')(e); }
  }
  async function assetCall(path, body, done) {
    if (!currentAsset) { say('#asOut', 'warn', 'Open an asset first.'); return; }
    try {
      await api('POST', '/assets/' + encodeURIComponent(currentAsset) + path, body);
      await openAsset(currentAsset);
      say('#asOut', 'ok', done);
      loadAttention();
    } catch (e) { say('#asOut', 'warn', e.message); }
  }
  $('#asDeliver').addEventListener('submit', function (e) {
    e.preventDefault();
    assetCall('/delivery', { registrationNo: $('#asReg').value.trim(), engineNo: $('#asEng').value.trim(), date: today }, 'Delivery recorded; the title is registered with the lessor.');
  });
  $('#asActivate').addEventListener('submit', function (e) {
    e.preventDefault();
    assetCall('/activation', { contractId: $('#asContract').value.trim(), date: today, insuranceRequired: $('#asIns').checked }, 'The asset is now under contract ' + $('#asContract').value.trim() + '.');
  });
  $('#asPolicy').addEventListener('submit', function (e) {
    e.preventDefault();
    assetCall('/policies', { insurer: $('#asInsurer').value.trim(), policyNo: $('#asPolNo').value.trim(), from: $('#asFrom').value, to: $('#asTo').value,
      sumInsuredMinor: minor($('#asSum').value), premiumMinor: minor($('#asPrem').value || '0'), financed: $('#asFin').checked }, 'Policy added.');
  });
  $('#asPlace').addEventListener('submit', function (e) {
    e.preventDefault();
    assetCall('/location', { location: $('#asLoc').value.trim() }, 'Location updated.');
  });
  $('#asSetCond').addEventListener('click', function () { assetCall('/condition', { condition: $('#asCond').value }, 'Condition updated.'); });
  $('#asTitle').addEventListener('click', function () { assetCall('/title-transfer', { date: today, reference: 'console-' + Date.now() }, 'Title passed to the customer.'); });
  $('#asReturn').addEventListener('click', function () { assetCall('/return', null, 'Returned to the lessor.'); });
  $('#orGo').addEventListener('click', async function () {
    var f = $('#asOrder');
    if (!f.reportValidity()) return;
    if (!signedIn()) { toast('Sign in under Settings first'); return; }
    try {
      var a = await api('POST', '/assets', { id: $('#orId').value.trim(), kind: $('#orKind').value, make: $('#orMake').value.trim(), model: $('#orModel').value.trim(),
        serialNo: $('#orSerial').value, dealerId: $('#orDealer').value.trim(), costMinor: minor($('#orCost').value), currency: 'THB', location: $('#orLoc').value.trim() });
      say('#asOut', 'ok', 'Ordered ' + a.id + ' (serial ' + a.serialNo + ').');
      toast('Asset ' + a.id + ' registered');
      openAsset(a.id);
    } catch (e) { say('#asOut', 'warn', e.message); }
  });

  // ---------------------------------------------------------------- Leases: a fourth tab on the Fleet and floor plan screen
  var leasesBox = el(
    '<div id="af-leases" class="grid" style="gap:20px" hidden>' +
    '<div class="panel" id="leaseTools"><h2>Open a lease</h2>' +
    '<form class="row" id="leaseLookup"><div class="field" style="flex:1"><label for="lsId">Lease id</label><input id="lsId" autocomplete="off" placeholder="F1"></div>' +
    '<button class="btn primary" type="submit" style="align-self:flex-end">Open</button></form>' +
    '<div class="result" id="lsOut" hidden></div></div>' +
    '<div class="kpis k4" id="leaseKpis" hidden>' +
    '<div class="kpi"><span class="label">Lease</span><span class="v" id="lkLease" style="font-size:20px"></span><span class="d" id="lkLeaseD"></span></div>' +
    '<div class="kpi"><span class="label">Status</span><span class="v" id="lkStatus" style="font-size:20px"></span><span class="d" id="lkStatusD"></span></div>' +
    '<div class="kpi"><span class="label">Due now</span><span class="v" id="lkDue"></span><span class="d">Accrued periods not yet collected</span></div>' +
    '<div class="kpi"><span class="label">Net investment carried</span><span class="v" id="lkCarry"></span><span class="d" id="lkCarryD"></span></div></div>' +
    '<div class="panel" id="leaseActions" hidden><h2>Actions on this lease</h2>' +
    '<div class="row"><button class="btn" type="button" id="lsAccrue">Accrue every period that is due</button><span class="muted" id="lsAccrueNote"></span></div>' +
    '<form class="row" id="lsCollect" style="flex-wrap:wrap;margin-top:10px"><div class="field"><label for="lsPay">Payment, THB</label><input id="lsPay" type="number" min="0.01" step="0.01"></div>' +
    '<button class="btn" type="submit" style="align-self:flex-end">Collect from the customer account</button></form>' +
    '<form class="row" id="lsEnd" style="flex-wrap:wrap;margin-top:10px"><div class="field"><label for="lsFee">Termination fee, THB</label><input id="lsFee" type="number" min="0" step="0.01" value="0"></div>' +
    '<button class="btn" type="submit" style="align-self:flex-end">Terminate early (finance lease)</button>' +
    '<div class="field"><label for="lsPrice">Purchase price, THB</label><input id="lsPrice" type="number" min="0.01" step="0.01"></div>' +
    '<button class="btn" type="button" id="lsBuy" style="align-self:flex-end">Record purchase option</button></form></div>' +
    '<div class="panel" id="leasePeriods" hidden><h2>Periods</h2><div class="tbl-wrap"><table><thead><tr><th>#</th><th>Due</th><th class="num">Payment</th><th class="num">Income or rent recognised</th>' +
    '<th class="num">Depreciation</th><th>Accrued</th><th class="num">Paid</th></tr></thead><tbody id="lsBody"></tbody></table></div></div>' +
    '<div class="grid g2"><div class="panel"><h2>Book a finance lease</h2><form class="form" id="lsFinForm">' +
    '<div class="field"><label for="fnId">Lease id</label><input id="fnId" required></div><div class="field"><label for="fnParty">Party id</label><input id="fnParty" required></div>' +
    '<div class="field"><label for="fnAcct">Customer account</label><input id="fnAcct" required placeholder="SAV-P1"></div>' +
    '<div class="field"><label for="fnFair">Fair value, THB</label><input id="fnFair" type="number" min="0.01" step="0.01" required></div>' +
    '<div class="field"><label for="fnCosts">Initial direct costs, THB</label><input id="fnCosts" type="number" min="0" step="0.01" value="0"></div>' +
    '<div class="field"><label for="fnPay">Payment per period, THB</label><input id="fnPay" type="number" min="0.01" step="0.01" required></div>' +
    '<div class="field"><label for="fnN">Periods</label><input id="fnN" type="number" min="1" value="36" required></div>' +
    '<div class="field"><label for="fnRes">Residual value, THB</label><input id="fnRes" type="number" min="0" step="0.01" value="0"></div>' +
    '<div class="field"><label for="fnStart">Start date</label><input id="fnStart" type="date" required></div>' +
    '<div class="field"><label for="fnFreq">Frequency</label><select id="fnFreq"><option>MONTHLY</option><option>QUARTERLY</option><option>SEMI_ANNUAL</option><option>ANNUAL</option></select></div></form>' +
    '<div class="row"><button class="btn primary" type="button" id="fnGo"><svg class="ico"><use href="#i-plus"/></svg><span>Book finance lease</span></button></div></div>' +
    '<div class="panel"><h2>Book an operating lease</h2><form class="form" id="lsOpForm">' +
    '<div class="field"><label for="opId">Lease id</label><input id="opId" required></div><div class="field"><label for="opParty">Party id</label><input id="opParty" required></div>' +
    '<div class="field"><label for="opAcct">Customer account</label><input id="opAcct" required placeholder="SAV-P1"></div>' +
    '<div class="field"><label for="opCost">Asset cost, THB</label><input id="opCost" type="number" min="0.01" step="0.01" required></div>' +
    '<div class="field"><label for="opRes">Residual value, THB</label><input id="opRes" type="number" min="0" step="0.01" value="0"></div>' +
    '<div class="field"><label for="opRents">Rent per period, THB (comma separated)</label><input id="opRents" required placeholder="0, 5000, 5000, 5000"></div>' +
    '<div class="field"><label for="opStart">Start date</label><input id="opStart" type="date" required></div>' +
    '<div class="field"><label for="opFreq">Frequency</label><select id="opFreq"><option>MONTHLY</option><option>QUARTERLY</option><option>SEMI_ANNUAL</option><option>ANNUAL</option></select></div></form>' +
    '<div class="row"><button class="btn primary" type="button" id="opGo"><svg class="ico"><use href="#i-plus"/></svg><span>Book operating lease</span></button></div></div></div>' +
    '</div>');
  addTab('leases', 'Leases', leasesBox, null);
  $('#fnStart').value = today; $('#opStart').value = today;
  var currentLease = null;
  $('#leaseLookup').addEventListener('submit', function (e) { e.preventDefault(); openLease($('#lsId').value.trim()); });
  async function openLease(id) {
    if (!signedIn()) { toast('Sign in under Settings first'); return; }
    try {
      var base = '/leases/' + encodeURIComponent(id);
      var l = await api('GET', base);
      var due = await api('GET', base + '/due');
      var carry = l.kind === 'FINANCE' ? await api('GET', base + '/carrying?date=' + today) : null;
      currentLease = l.id;
      $('#lsId').value = l.id;
      $('#leaseKpis').hidden = false; $('#leaseActions').hidden = false; $('#leasePeriods').hidden = false;
      $('#lkLease').textContent = l.id;
      $('#lkLeaseD').textContent = l.kind.toLowerCase() + ' lease · party ' + l.party + ' · from ' + l.startDate;
      $('#lkStatus').textContent = l.status.toLowerCase();
      $('#lkStatusD').textContent = l.periods.filter(function (p) { return p.accrued; }).length + ' of ' + l.periods.length + ' periods accrued';
      $('#lkDue').textContent = '฿' + thb(due.dueMinor);
      $('#lkCarry').textContent = carry ? '฿' + thb(carry.carryingMinor) : 'not applicable';
      $('#lkCarryD').textContent = carry ? 'What an early termination would clear, before any fee' : 'Operating leases keep the asset on the books';
      var next = l.periods.find(function (p) { return !p.accrued; });
      $('#lsAccrueNote').textContent = next ? 'Next to accrue: period ' + next.number + ', due ' + next.dueDate + '.' : 'Every period is accrued.';
      $('#lsBody').innerHTML = l.periods.map(function (p) {
        return "<tr><td class='mono'>" + p.number + "</td><td class='mono'>" + esc(p.dueDate) + "</td><td class='num'>" + thb(p.payment) + "</td><td class='num'>" + thb(l.kind === 'FINANCE' ? p.income : p.rentRecognised) +
          "</td><td class='num'>" + (l.kind === 'FINANCE' ? '—' : thb(p.depreciation)) + '</td><td>' + (p.accrued ? "<span class='chip good'>Accrued</span>" : "<span class='chip'>Scheduled</span>") +
          "</td><td class='num'>" + thb(p.paid) + '</td></tr>';
      }).join('');
      $('#lsOut').hidden = true;
    } catch (e) { fail('Open lease')(e); }
  }
  async function leaseCall(path, body, done) {
    if (!currentLease) { say('#lsOut', 'warn', 'Open a lease first.'); return; }
    try {
      await api('POST', '/leases/' + encodeURIComponent(currentLease) + path, body);
      await openLease(currentLease);
      say('#lsOut', 'ok', done);
    } catch (e) { say('#lsOut', 'warn', e.message); }
  }
  $('#lsAccrue').addEventListener('click', async function () {
    if (!currentLease) return;
    var done = 0;
    try {
      var base = '/leases/' + encodeURIComponent(currentLease);
      var l = await api('GET', base);
      var due = l.periods.filter(function (p) { return !p.accrued && p.dueDate <= today; });
      if (!due.length) { say('#lsOut', 'warn', 'No period is due for accrual yet.'); return; }
      for (var k = 0; k < due.length; k++) { await api('POST', base + '/accrual/' + due[k].number + '?asOf=' + today); done++; }
      await openLease(currentLease);
      say('#lsOut', 'ok', 'Accrued ' + done + ' period' + (done === 1 ? '' : 's') + ', oldest first.');
    } catch (e) { await openLease(currentLease); say('#lsOut', 'warn', (done ? 'Accrued ' + done + ' before stopping. ' : '') + e.message); }
  });
  $('#lsCollect').addEventListener('submit', function (e) {
    e.preventDefault();
    leaseCall('/collections', { reference: 'console-' + Date.now(), amountMinor: minor($('#lsPay').value), date: today }, 'Collected ฿' + $('#lsPay').value + ' from the customer account.');
  });
  $('#lsEnd').addEventListener('submit', function (e) {
    e.preventDefault();
    leaseCall('/termination', { reference: 'console-' + Date.now(), feeMinor: minor($('#lsFee').value || '0'), date: today }, 'Lease terminated: the net investment was cleared and the unaccrued periods cancelled.');
  });
  $('#lsBuy').addEventListener('click', function () {
    leaseCall('/purchase', { reference: 'console-' + Date.now(), priceMinor: minor($('#lsPrice').value), date: today }, 'Purchase recorded: the residual was released and the difference booked as a gain or loss.');
  });
  $('#fnGo').addEventListener('click', async function () {
    var f = $('#lsFinForm');
    if (!f.reportValidity()) return;
    if (!signedIn()) { toast('Sign in under Settings first'); return; }
    try {
      var l = await api('POST', '/leases/finance', { id: $('#fnId').value.trim(), party: $('#fnParty').value.trim(), depositAccountId: $('#fnAcct').value.trim(),
        fairValueMinor: minor($('#fnFair').value), directCostsMinor: minor($('#fnCosts').value || '0'), paymentMinor: minor($('#fnPay').value), periods: Number($('#fnN').value),
        residualMinor: minor($('#fnRes').value || '0'), start: $('#fnStart').value, frequency: $('#fnFreq').value });
      say('#lsOut', 'ok', 'Booked finance lease ' + l.id + ' with ' + l.periods.length + ' periods.');
      toast('Lease ' + l.id + ' booked');
      openLease(l.id);
    } catch (e) { say('#lsOut', 'warn', e.message); }
  });
  $('#opGo').addEventListener('click', async function () {
    var f = $('#lsOpForm');
    if (!f.reportValidity()) return;
    if (!signedIn()) { toast('Sign in under Settings first'); return; }
    try {
      var rents = $('#opRents').value.split(',').map(function (x) { return minor(x.trim() || '0'); });
      var l = await api('POST', '/leases/operating', { id: $('#opId').value.trim(), party: $('#opParty').value.trim(), depositAccountId: $('#opAcct').value.trim(),
        assetCostMinor: minor($('#opCost').value), residualMinor: minor($('#opRes').value || '0'), rentsMinor: rents, start: $('#opStart').value, frequency: $('#opFreq').value });
      say('#lsOut', 'ok', 'Booked operating lease ' + l.id + ' with ' + l.periods.length + ' periods.');
      toast('Lease ' + l.id + ' booked');
      openLease(l.id);
    } catch (e) { say('#lsOut', 'warn', e.message); }
  });

  // ---------------------------------------------------------------- Dealers: a fifth tab on the Fleet and floor plan screen
  var dealersBox = el(
    '<div id="af-dealers" class="grid" style="gap:20px" hidden>' +
    '<div class="panel"><div class="panel-head"><h2>Dealers</h2><button class="btn" type="button" id="dlRefresh">Refresh</button></div>' +
    '<div class="tbl-wrap"><table><thead><tr><th>Dealer</th><th>Name</th><th>Tax id</th><th class="num">Commission</th><th>Status</th><th></th></tr></thead><tbody id="dlBody"></tbody></table></div>' +
    '<div class="result" id="dlOut" hidden></div></div>' +
    '<div class="grid g2"><div class="panel"><h2>Onboard a dealer</h2><form class="form" id="dlForm">' +
    '<div class="field"><label for="dlId">Dealer id</label><input id="dlId" required></div><div class="field"><label for="dlName">Name</label><input id="dlName" required></div>' +
    '<div class="field"><label for="dlTax">Tax id</label><input id="dlTax" required inputmode="numeric"></div>' +
    '<div class="field"><label for="dlRate">Commission, % of asset cost (0 to 20)</label><input id="dlRate" type="number" min="0" max="20" step="0.01" value="2" required></div></form>' +
    '<div class="row"><button class="btn primary" type="button" id="dlGo"><svg class="ico"><use href="#i-plus"/></svg><span>Onboard dealer</span></button></div></div>' +
    '<div class="panel"><h2>Pay a dealer</h2><p class="muted">Pays the dealer of an active asset the whole cost plus the commission, once per asset. A suspended dealer is not paid.</p>' +
    '<form class="row" id="dlPay"><div class="field" style="flex:1"><label for="dlAsset">Asset id</label><input id="dlAsset" autocomplete="off" placeholder="A2" required></div>' +
    '<button class="btn primary" type="submit" style="align-self:flex-end">Pay dealer</button></form></div></div></div>');
  addTab('dealers', 'Dealers', dealersBox, function () { loadDealers(); });
  async function loadDealers() {
    try {
      var list = await api('GET', '/dealers');
      $('#dlBody').innerHTML = list.map(function (d) {
        var on = d.status === 'ACTIVE';
        return "<tr><td class='mono'>" + esc(d.id) + '</td><td>' + esc(d.name) + "</td><td class='mono'>" + esc(d.taxId) + "</td><td class='num'>" + (d.commissionRate * 100).toFixed(2) + '%</td><td>' +
          "<span class='chip " + (on ? 'good' : 'warn') + "'>" + esc(d.status.toLowerCase()) + "</span></td><td><button class='btn' type='button' data-dealer='" + esc(d.id) + "' data-do='" + (on ? 'suspension' : 'reinstatement') + "'>" +
          (on ? 'Suspend' : 'Reinstate') + '</button></td></tr>';
      }).join('') || "<tr><td colspan='6' class='muted'>No dealers onboarded yet.</td></tr>";
      $$('#dlBody [data-dealer]').forEach(function (b) {
        b.addEventListener('click', async function () {
          try {
            await api('POST', '/dealers/' + encodeURIComponent(b.getAttribute('data-dealer')) + '/' + b.getAttribute('data-do'));
            await loadDealers();
            say('#dlOut', 'ok', 'Dealer ' + b.getAttribute('data-dealer') + (b.getAttribute('data-do') === 'suspension' ? ' suspended.' : ' reinstated.'));
          } catch (e) { say('#dlOut', 'warn', e.message); }
        });
      });
    } catch (e) { fail('Load dealers')(e); }
  }
  $('#dlRefresh').addEventListener('click', function () { if (signedIn()) loadDealers(); else toast('Sign in under Settings first'); });
  $('#dlGo').addEventListener('click', async function () {
    var f = $('#dlForm');
    if (!f.reportValidity()) return;
    if (!signedIn()) { toast('Sign in under Settings first'); return; }
    try {
      var d = await api('POST', '/dealers', { id: $('#dlId').value.trim(), name: $('#dlName').value.trim(), taxId: $('#dlTax').value.trim(), commissionRate: Number($('#dlRate').value) / 100 });
      await loadDealers();
      say('#dlOut', 'ok', 'Onboarded ' + d.name + ' (' + d.id + ').');
      toast('Dealer ' + d.id + ' onboarded');
    } catch (e) { say('#dlOut', 'warn', e.message); }
  });
  $('#dlPay').addEventListener('submit', async function (e) {
    e.preventDefault();
    if (!signedIn()) { toast('Sign in under Settings first'); return; }
    try {
      var r = await api('POST', '/dealers/payments', { assetId: $('#dlAsset').value.trim(), date: today });
      say('#dlOut', 'ok', 'Paid ฿' + thb(r.paidMinor) + ' for asset ' + r.assetId + ' (cost plus commission).');
    } catch (err) { say('#dlOut', 'warn', err.message); }
  });

  // ---------------------------------------------------------------- Repossession and sale, on the Contracts screen under collections
  var repoPanel = el(
    '<div class="panel" id="loanRepossession" hidden><h2>Repossession and sale</h2><p class="muted" id="rpStatus"></p>' +
    '<form class="row" id="rpForm" style="flex-wrap:wrap"><div class="field"><label for="rpAsset">Asset under this loan</label><select id="rpAsset"></select></div>' +
    '<div class="field"><label for="rpLoc">Where it is held</label><input id="rpLoc" autocomplete="off"></div>' +
    '<div class="field"><label for="rpCond">Condition found</label><select id="rpCond"><option>GOOD</option><option selected>FAIR</option><option>POOR</option><option>DAMAGED</option></select></div>' +
    '<button class="btn" type="submit" style="align-self:flex-end">Repossess</button></form>' +
    '<form class="row" id="rpSale" style="flex-wrap:wrap;margin-top:10px"><div class="field"><label for="rpCase">Open case</label><select id="rpCase"></select></div>' +
    '<div class="field"><label for="rpProceeds">Sale proceeds, THB</label><input id="rpProceeds" type="number" min="0.01" step="0.01"></div>' +
    '<div class="field"><label for="rpCosts">Costs of recovery and sale, THB</label><input id="rpCosts" type="number" min="0" step="0.01" value="0"></div>' +
    '<div class="field check"><input id="rpOk" type="checkbox"><label for="rpOk">I understand the sale settles the loan or writes it off</label></div>' +
    '<button class="btn primary" type="submit" style="align-self:flex-end">Record sale</button></form>' +
    '<div class="tbl-wrap"><table><thead><tr><th>Case</th><th>Asset</th><th>Taken</th><th>Status</th><th class="num">Proceeds</th><th class="num">Costs</th><th class="num">Owed at sale</th><th class="num">Shortfall</th><th class="num">Surplus</th></tr></thead>' +
    '<tbody id="rpBody"></tbody></table></div><div class="result" id="rpOut" hidden></div></div>');
  $('#loanCollections').after(repoPanel);
  var rpLoan = null;
  async function loadRepossession(id) {
    rpLoan = id;
    $('#loanRepossession').hidden = false;
    $('#rpOut').hidden = true;
    try {
      var got = await Promise.all([api('GET', '/repossessions/loan/' + encodeURIComponent(id)), api('GET', '/assets/contract/' + encodeURIComponent(id))]);
      var cases = got[0], assets = got[1].filter(function (a) { return a.status === 'ACTIVE'; }), open = cases.filter(function (c) { return c.status === 'OPEN'; });
      $('#rpStatus').textContent = open.length ? 'An asset is held and waiting for sale.' : assets.length ? 'Assets under this loan can be repossessed once an installment is overdue.' : 'No active asset is recorded under this loan.';
      $('#rpAsset').innerHTML = assets.map(function (a) { return '<option value="' + esc(a.id) + '">' + esc(a.id + ' · ' + a.make + ' ' + a.model) + '</option>'; }).join('');
      $('#rpCase').innerHTML = open.map(function (c) { return '<option value="' + esc(c.reference) + '">' + esc(c.reference + ' · ' + c.assetId) + '</option>'; }).join('');
      $('#rpBody').innerHTML = cases.map(function (c) {
        var sold = c.status === 'SOLD';
        return "<tr><td class='mono'>" + esc(c.reference) + "</td><td class='mono'>" + esc(c.assetId) + "</td><td class='mono'>" + esc(c.repossessedOn) + "</td><td><span class='chip " + (sold ? 'good' : 'warn') + "'>" +
          esc(c.status.toLowerCase()) + "</span></td><td class='num'>" + (sold ? thb(c.proceeds) : '—') + "</td><td class='num'>" + (sold ? thb(c.costs) : '—') + "</td><td class='num'>" + (sold ? thb(c.owed) : '—') +
          "</td><td class='num'>" + (sold ? thb(c.shortfall) : '—') + "</td><td class='num'>" + (sold ? thb(c.surplus) : '—') + '</td></tr>';
      }).join('') || "<tr><td colspan='9' class='muted'>No repossession cases on this loan.</td></tr>";
    } catch (e) { say('#rpOut', 'warn', e.message); }
  }
  $('#rpForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    if (!rpLoan || !$('#rpAsset').value) { say('#rpOut', 'warn', 'There is no active asset under this loan to repossess.'); return; }
    try {
      var r = await api('POST', '/repossessions', { reference: 'console-' + Date.now(), loanId: rpLoan, assetId: $('#rpAsset').value, date: today, location: $('#rpLoc').value.trim(), condition: $('#rpCond').value });
      await loadRepossession(rpLoan);
      say('#rpOut', 'ok', 'Repossessed ' + r.assetId + '. Record the sale when it is sold.');
    } catch (err) { say('#rpOut', 'warn', err.message); }
  });
  $('#rpSale').addEventListener('submit', async function (e) {
    e.preventDefault();
    if (!$('#rpCase').value) { say('#rpOut', 'warn', 'There is no open case to sell.'); return; }
    if (!$('#rpOk').checked) { say('#rpOut', 'warn', 'Tick the confirmation first: the sale settles the loan or writes it off.'); return; }
    try {
      var r = await api('POST', '/repossessions/' + encodeURIComponent($('#rpCase').value) + '/sale', { date: today, proceeds: Number($('#rpProceeds').value), costs: Number($('#rpCosts').value || '0') });
      $('#rpOk').checked = false;
      await loadRepossession(rpLoan);
      say('#rpOut', r.shortfall > 0 ? 'warn' : 'ok', r.shortfall > 0 ? 'Sold. The loan was written off; ฿' + thb(r.shortfall) + ' stays owed by the customer.' :
        'Sold. The loan is settled' + (r.surplus > 0 ? '; ฿' + thb(r.surplus) + ' stays in the customer account.' : '.'));
      openLoan(rpLoan);
    } catch (err) { say('#rpOut', 'warn', err.message); }
  });

  // ---------------------------------------------------------------- Settings: loss allowance (TFRS 9) run and preview
  var eclPanel = el(
    '<div class="panel" id="eclPanel"><h2>Loss allowance (TFRS 9)</h2><div>' +
    '<div class="set-row"><div><h3>Daily run</h3><p>Assesses every loan and books the change in its allowance for today. It needs the bank PD and LGD in the app settings; without them it refuses to run. ' +
    'Safe to repeat: a loan is booked once per day. Closed and written-off loans have their allowance released.</p></div>' +
    '<div><button class="btn" type="button" id="eclRun">Run for today</button><div class="result" id="eclRunOut" hidden></div></div></div>' +
    '<div class="set-row"><div><h3>Preview a loan</h3><p>What the allowance would be today for one loan, without booking anything.</p></div>' +
    '<form class="form" id="eclPreview" style="min-width:300px"><div class="field"><label for="eclLoan">Loan id</label><input id="eclLoan" autocomplete="off" placeholder="LN-APP1" required></div>' +
    '<div class="field check"><input id="eclRisk" type="checkbox"><label for="eclRisk">Assume credit risk has increased</label></div>' +
    '<div class="row"><button class="btn" type="submit">Preview</button></div><div class="result" id="eclPrevOut" hidden></div></form></div>' +
    '</div></div>');
  access.after(eclPanel);
  var pct = function (x) { return (Number(x) * 100).toFixed(2).replace(/\.?0+$/, '') + '%'; };
  $('#eclRun').addEventListener('click', async function () {
    if (!signedIn()) { toast('Sign in under Settings first'); return; }
    try {
      var r = await api('POST', '/ecl/run?asOf=' + today);
      var money = Object.keys(r.allowanceByCurrency).map(function (c) { return thb(r.allowanceByCurrency[c]) + ' ' + c; }).join(', ') || 'nothing';
      say('#eclRunOut', r.failures.length ? 'warn' : 'ok', 'Assessed ' + r.assessed + ' loan' + (r.assessed === 1 ? '' : 's') + ' (stage 1: ' + r.stage1 + ', stage 2: ' + r.stage2 + ', stage 3: ' + r.stage3 + '). ' +
        r.inactive + ' closed or written-off loan' + (r.inactive === 1 ? '' : 's') + ' released. Allowance held: ' + money + '.' + (r.failures.length ? ' Not booked: ' + r.failures.join('; ') : ''));
    } catch (e) { say('#eclRunOut', 'warn', e.message); }
  });
  $('#eclPreview').addEventListener('submit', async function (e) {
    e.preventDefault();
    if (!signedIn()) { toast('Sign in under Settings first'); return; }
    try {
      var r = await api('GET', '/ecl/loans/' + encodeURIComponent($('#eclLoan').value.trim()) + '?asOf=' + today + '&riskIncreased=' + $('#eclRisk').checked);
      say('#eclPrevOut', 'ok', r.loanId + ': ' + r.stage.replace('_', ' ').toLowerCase() + ' · PD ' + pct(r.horizonPd) + ' · LGD ' + pct(r.lgd) + ' · exposure ฿' + thb(r.exposureMinor) +
        ' · allowance ฿' + thb(r.allowanceMinor) + '.');
    } catch (err) { say('#eclPrevOut', 'warn', err.message); }
  });

  // ---------------------------------------------------------------- Overview: real totals instead of the prototype's sample numbers
  async function loadOverview() {
    if (!signedIn()) return;
    try {
      var o = await api('GET', '/overview?asOf=' + today);
      var toggle = $('#streamToggle');
      if (toggle && toggle.textContent.trim() === 'Pause') toggle.click();       // the sample stream writes into the Postings tile this replaces
      var tiles = $$('#view-overview .kpis .kpi');
      var tile = function (i, label, value, note) {
        var k = tiles[i], spk = k.querySelector('.spk');
        if (spk) spk.remove();                                    // the sparkline is sample data
        k.querySelector('.label').textContent = label;
        k.querySelector('.v').textContent = value;
        if (i === 3) k.querySelector('.v').insertAdjacentHTML('beforeend', '<span id="kpiPostings" hidden></span>');   // the prototype's stream timer writes here
        k.querySelector('.d').textContent = note;
      };
      tile(0, 'Deposits', '฿' + thb(o.depositsMinor), o.depositAccounts + ' account' + (o.depositAccounts === 1 ? '' : 's'));
      tile(1, 'Loans', '฿' + thb(o.loansOutstandingMinor), o.activeLoans + ' active loan' + (o.activeLoans === 1 ? '' : 's') + ', principal outstanding');
      tile(2, 'NPL ratio', (o.nplRatio * 100).toFixed(2) + '%', '฿' + thb(o.nonPerformingMinor) + ' at 90+ days or non-accrual');
      tile(3, 'Overdue loans', String(o.overdueLoans), 'Open Contracts for the collections queue');
      tile(4, 'Loss allowance held', '฿' + thb(o.lossAllowanceMinor), 'TFRS 9, booked per loan');
      tile(5, 'Assets without cover', String(o.uninsuredAssets), 'Active assets with no insurance today');
      $('#spark').closest('.panel').hidden = true;                // sample charts and stream: no real source for them yet
      $('#stream').closest('.panel').hidden = true;
      var items = [];
      var sev = function (cls, icon, title, text) {
        return '<div class="sev ' + cls + '"><i><svg class="ico"><use href="#' + icon + '"/></svg></i><div><strong>' + esc(title) + '</strong><p class="muted">' + esc(text) + '</p></div></div>';
      };
      if (o.overdueLoans > 0) items.push(sev(o.nplRatio > 0 ? 'crit' : 'warn', 'i-alert', o.overdueLoans + ' overdue loan' + (o.overdueLoans === 1 ? '' : 's'), 'Work the queue under Contracts: contacts, promises, and the recommended next step.'));
      if (o.uninsuredAssets > 0) items.push(sev('warn', 'i-alert', o.uninsuredAssets + ' active asset' + (o.uninsuredAssets === 1 ? '' : 's') + ' without insurance', 'See Needs attention on the Assets tab of Fleet and floor plan.'));
      if (!items.length) items.push(sev('good', 'i-check', 'Nothing needs attention', 'No overdue loans and every active asset is insured.'));
      var panel = $$('#view-overview .grid .panel').filter(function (p) { return !p.hidden; })[0];
      panel.querySelector('.panel-head .label').textContent = (o.overdueLoans > 0 ? 1 : 0) + (o.uninsuredAssets > 0 ? 1 : 0) + ' open';
      panel.querySelector('.panel-head').nextElementSibling.innerHTML = items.join('');
    } catch (e) { fail('Load overview')(e); }
  }
  window.addEventListener('hashchange', function () { if (location.hash === '#overview') loadOverview(); });

  document.addEventListener('submit', function (e) { if (e.target.matches('form.form')) e.preventDefault(); });

  async function refresh() {
    paintSession();
    if (!signedIn()) return;
    try { await loadApprovals(); } catch (e) { fail('Load approvals')(e); }
    await loadQueue();
    await loadOverview();
  }

  F.live = { active: signedIn, submitProduct: submitProduct };

  (async function init() {
    try { var r = await fetch('/console/config.json'); if (r.ok) cfg = await r.json(); } catch (e) { /* token mode */ }
    $('#acActor').value = store.get('actor'); $('#acToken').value = cfg.mode === 'oidc' ? '' : store.get('token');
    var q = new URLSearchParams(location.search);
    if (cfg.mode === 'oidc' && q.get('code')) await finishLogin(q.get('code'), q.get('state'));
    else if (q.get('error')) { history.replaceState(null, '', '/console/index.html'); location.hash = 'settings'; toast('Sign-in was not completed: ' + q.get('error')); }
    if (cfg.mode === 'oidc' && store.get('token') && Number(store.get('expires') || 0) <= Date.now()) { store.set('token', ''); toast('Your session expired. Sign in again.'); }
    await refresh();
  })();
})();

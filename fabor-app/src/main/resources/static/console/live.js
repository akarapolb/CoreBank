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
    '<div class="set-row"><div><h3>What is live</h3><p>Master Builder and Approvals, Customer 360 and Contracts (look up or create), Ledger (by account), and cash deposits in Branch and teller use the real services. ' +
    'Fleet and floor plan (open an agreement or a dealer line by id) is live too. Overview, Product Studio, Trade finance, Treasury, Syndication, Corporate banking and AI agents still show sample data.</p></div></div>' +
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
      $('#view-contract thead th:nth-child(6)').textContent = 'VAT';
      paint();
    } catch (e) { fail('Open contract')(e); }
  }

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

  document.addEventListener('submit', function (e) { if (e.target.matches('form.form')) e.preventDefault(); });

  async function refresh() {
    paintSession();
    if (!signedIn()) return;
    try { await loadApprovals(); } catch (e) { fail('Load approvals')(e); }
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

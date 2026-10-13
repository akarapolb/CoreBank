'use strict';
// Plain JavaScript, no build step. The token and actor live in sessionStorage only (cleared when the tab closes).
const $ = (id) => document.getElementById(id);
const store = {
  get(k) { try { return sessionStorage.getItem(k) || ''; } catch (e) { return ''; } },
  set(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { /* storage unavailable: keep working without it */ } },
};

function say(message, ok) {
  const s = $('status');
  s.textContent = message;
  s.className = 'status ' + (ok ? 'ok' : 'err');
  s.hidden = false;
}

async function api(method, path, body, contentType) {
  const headers = { 'Authorization': 'Bearer ' + store.get('token') };
  const actor = store.get('actor');
  if (actor) headers['X-Actor'] = actor;
  if (body !== undefined && body !== null) headers['Content-Type'] = contentType || 'application/json';
  const res = await fetch('/api/v1' + path, {
    method, headers,
    body: body === undefined || body === null ? undefined : (contentType ? body : JSON.stringify(body)),
  });
  let data = null;
  const text = await res.text();
  try { data = text ? JSON.parse(text) : null; } catch (e) { data = { raw: text }; }
  if (!res.ok) {
    const msg = data && (data.message || data.error) ? `${data.error || res.status}: ${data.message || ''}` : `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

async function run(label, fn, out) {
  try {
    const result = await fn();
    if (out) out.textContent = JSON.stringify(result, null, 2);
    say(label + ' done', true);
    return result;
  } catch (e) {
    if (out) out.textContent = '';
    say(label + ' failed. ' + e.message, false);
    return null;
  }
}

// ---- tabs
document.querySelectorAll('.tabs button').forEach((b) => b.addEventListener('click', () => {
  document.querySelectorAll('.tabs button').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
  document.querySelectorAll('.panel').forEach((p) => { p.hidden = p.id !== b.dataset.tab; });
}));

// ---- auth
// Two ways in. OIDC (default in production): authorization code flow with PKCE as a public client; the access token
// stays in sessionStorage and is sent as a bearer token. Token mode (development): paste a token and an actor name.
const REDIRECT = location.origin + '/console/index.html';

function b64url(bytes) {
  let s = '';
  bytes.forEach((b) => { s += String.fromCharCode(b); });
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function randomString(n) {
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  return b64url(a);
}
async function challengeFor(verifier) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return b64url(new Uint8Array(digest));
}
function claims(jwt) {
  try {
    return JSON.parse(atob(jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
  } catch (e) {
    return {};
  }
}

async function loadConfig() {
  try {
    const r = await fetch('/console/config.json');
    return r.ok ? await r.json() : { mode: 'token' };
  } catch (e) {
    return { mode: 'token' };
  }
}

async function startLogin(cfg) {
  const verifier = randomString(48);
  const state = randomString(16);
  store.set('pkce_verifier', verifier);
  store.set('pkce_state', state);
  const params = new URLSearchParams({
    response_type: 'code', client_id: cfg.clientId, redirect_uri: REDIRECT, scope: cfg.scope, state,
    code_challenge: await challengeFor(verifier), code_challenge_method: 'S256',
  });
  location.assign(cfg.authorizationEndpoint + (cfg.authorizationEndpoint.includes('?') ? '&' : '?') + params);
}

async function finishLogin(cfg, code, state) {
  const expected = store.get('pkce_state');
  const verifier = store.get('pkce_verifier');
  store.set('pkce_state', '');
  store.set('pkce_verifier', '');
  history.replaceState(null, '', '/console/index.html');          // the code must not stay in the address bar
  if (!expected || state !== expected || !verifier) {
    say('Sign-in rejected: the response did not match this browser session', false);
    return;
  }
  const res = await fetch(cfg.tokenEndpoint, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: REDIRECT, client_id: cfg.clientId, code_verifier: verifier }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    say('Sign-in failed: ' + (data.error_description || data.error || res.status), false);
    return;
  }
  store.set('token', data.access_token);
  store.set('expires', String(Date.now() + (Number(data.expires_in) || 300) * 1000));
  say('Signed in', true);
}

function showSession(cfg) {
  const who = $('who');
  const token = store.get('token');
  const exp = Number(store.get('expires') || 0);
  const signedIn = cfg.mode === 'oidc' && token && (!exp || exp > Date.now());
  if (cfg.mode === 'oidc' && token && exp && exp <= Date.now()) {
    store.set('token', '');
    say('Your session expired. Sign in again.', false);
  }
  $('auth').hidden = cfg.mode === 'oidc';
  $('signin').hidden = cfg.mode !== 'oidc' || signedIn;
  $('signout').hidden = !signedIn;
  const c = signedIn ? claims(token) : {};
  who.textContent = signedIn ? 'Signed in as ' + (c.preferred_username || c.sub || 'unknown') : '';
}

(async () => {
  const cfg = await loadConfig();
  $('actor').value = store.get('actor');
  $('token').value = cfg.mode === 'oidc' ? '' : store.get('token');
  $('auth').addEventListener('submit', (e) => {
    e.preventDefault();
    store.set('actor', $('actor').value.trim());
    store.set('token', $('token').value.trim());
    say('Credentials set for this tab', true);
  });
  $('signin').addEventListener('click', () => startLogin(cfg));
  $('signout').addEventListener('click', () => { store.set('token', ''); store.set('expires', ''); showSession(cfg); say('Signed out', true); });
  const q = new URLSearchParams(location.search);
  if (cfg.mode === 'oidc' && q.get('code')) {
    await finishLogin(cfg, q.get('code'), q.get('state'));
  } else if (q.get('error')) {
    history.replaceState(null, '', '/console/index.html');
    say('Sign-in was not completed: ' + q.get('error'), false);
  }
  showSession(cfg);
})();

// ---- products
function esc(s) { const d = document.createElement('div'); d.textContent = String(s); return d.innerHTML; }

function renderReport(r) {
  const rows = (r.issues || []).map((i) => `<tr><td class="issue-${esc(i.severity)}">${esc(i.severity)}</td><td>${esc(i.path)}</td><td>${esc(i.message)}</td></tr>`).join('');
  const scen = (r.scenarios || []).map((s) => `<tr><td>${esc(s.scenario)}</td><td>${esc(s.instalments)}</td><td>${esc(s.totalPaidByCustomer)}</td><td>${esc(s.effectiveRate)}</td></tr>`).join('');
  $('report').innerHTML =
    `<h3>Check: ${r.issues && r.issues.some((i) => i.severity === 'ERROR') ? 'errors found' : 'no errors'}</h3>` +
    (rows ? `<table><thead><tr><th>Severity</th><th>Where</th><th>What</th></tr></thead><tbody>${rows}</tbody></table>` : '<p class="hint">No findings.</p>') +
    (scen ? `<h3>Standard scenarios</h3><table><thead><tr><th>Scenario</th><th>Instalments</th><th>Total paid (satang)</th><th>Effective rate</th></tr></thead><tbody>${scen}</tbody></table>` : '') +
    `<p class="hint">Golden hash: <code>${esc(r.goldenHash || '')}</code></p>`;
}

$('createDraft').addEventListener('click', async () => {
  const d = await run('Create draft', () => api('POST', '/products/drafts', $('yaml').value, 'text/plain'));
  if (d) $('draftId').value = d.id;
});
$('check').addEventListener('click', async () => {
  const r = await run('Check', () => api('GET', `/products/drafts/${encodeURIComponent($('draftId').value)}/check`));
  if (r) renderReport(r);
});
$('submit').addEventListener('click', () => run('Submit', () => api('POST', `/products/drafts/${encodeURIComponent($('draftId').value)}/submit`)));
$('approve').addEventListener('click', () => run('Approve', () => api('POST', `/products/drafts/${encodeURIComponent($('draftId').value)}/approve`, { role: $('role').value })));
$('publish').addEventListener('click', () => run('Publish', () => api('POST', `/products/drafts/${encodeURIComponent($('draftId').value)}/publish`)));
$('listVersions').addEventListener('click', async () => {
  const list = await run('List versions', () => api('GET', `/products/${encodeURIComponent($('versionsCode').value)}/versions`));
  if (list) {
    $('versions').querySelector('tbody').innerHTML = list.map((v) =>
      `<tr><td>${esc(v.product)}</td><td>${esc(v.version)}</td><td>${esc(v.publishedBy)}</td><td><code>${esc((v.goldenHash || '').slice(0, 12))}</code></td><td>${v.retired ? 'yes' : 'no'}</td></tr>`).join('');
  }
});

// ---- customers
$('registerForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  const consents = [];
  if (f.get('kyc')) consents.push({ purpose: 'KYC_PROCESSING', version: 1, channel: 'CONSOLE' });
  if (f.get('bureau')) consents.push({ purpose: 'CREDIT_BUREAU', version: 1, channel: 'CONSOLE' });
  const body = { partyId: f.get('partyId'), fullName: f.get('fullName'), nationalId: f.get('nationalId'), phone: f.get('phone'),
    dateOfBirth: f.get('dateOfBirth'), documentRef: f.get('documentRef'), consents };
  run('Register customer', () => api('POST', '/customers', body), $('registerOut'));
});

// ---- accounts
function move() {
  const f = new FormData($('moveForm'));
  return { account: f.get('account'), body: { reference: f.get('reference'), amountMinor: Number(f.get('amount')), currency: 'THB', valueDate: f.get('valueDate') } };
}
$('doDeposit').addEventListener('click', () => { const m = move(); run('Deposit', () => api('POST', `/accounts/${encodeURIComponent(m.account)}/deposits`, m.body), $('moveOut')); });
$('doWithdraw').addEventListener('click', () => { const m = move(); run('Withdrawal', () => api('POST', `/accounts/${encodeURIComponent(m.account)}/withdrawals`, m.body), $('moveOut')); });
$('doBalance').addEventListener('click', () => { const m = move(); run('Balance', () => api('GET', `/accounts/${encodeURIComponent(m.account)}/balance?asOf=${encodeURIComponent(m.body.valueDate)}`), $('moveOut')); });

// ---- loans
$('loanForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  const num = (k) => Number(f.get(k));
  const body = { applicationId: f.get('applicationId'), partyId: f.get('partyId'), productCode: f.get('productCode'),
    productVersion: num('productVersion'), amountMinor: num('amountMinor'), termMonths: num('termMonths'),
    monthlyInstalmentMinor: num('monthlyInstalmentMinor'), monthlyIncomeMinor: num('monthlyIncomeMinor'),
    existingDebtMinor: num('existingDebtMinor'), monthsAtEmployer: num('monthsAtEmployer'), asOf: f.get('asOf'), currency: 'THB' };
  run('Loan decision', () => api('POST', '/loans/applications', body), $('loanOut'));
});
function servicing() {
  const f = new FormData($('servicingForm'));
  return { id: f.get('loanId'), date: f.get('date'), body: { reference: f.get('reference'), amountMinor: Number(f.get('amount') || 0), currency: 'THB', valueDate: f.get('date') } };
}
$('doLoan').addEventListener('click', () => { const s = servicing(); run('Loan', () => api('GET', `/loans/${encodeURIComponent(s.id)}?asOf=${encodeURIComponent(s.date)}`), $('servicingOut')); });
$('doRepay').addEventListener('click', () => { const s = servicing(); run('Repayment', () => api('POST', `/loans/${encodeURIComponent(s.id)}/repayments`, s.body), $('servicingOut')); });
$('doSettle').addEventListener('click', () => { const s = servicing(); run('Settlement', () => api('POST', `/loans/${encodeURIComponent(s.id)}/settlement`, s.body), $('servicingOut')); });

// ---- operations
$('backfill').addEventListener('click', () => run('Backfill', () => api('POST', '/admin/scheduler/backfill', {}), $('opsOut')));

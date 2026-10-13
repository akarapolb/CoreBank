'use strict';
const $ = (id) => document.getElementById(id);
const store = {
  get(k) { try { return sessionStorage.getItem(k) || ''; } catch (e) { return ''; } },
  set(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { /* no storage: the session just will not survive a reload */ } },
};
const REDIRECT = location.origin + '/app/index.html';
const baht = (minor) => (minor / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' THB';
function note(text, bad) { const m = $('msg'); m.textContent = text; m.className = 'msg' + (bad ? ' err' : ''); m.hidden = !text; }

// ---- sign-in: OIDC authorization code with PKCE, or a development token
function b64url(bytes) { let s = ''; bytes.forEach((b) => { s += String.fromCharCode(b); }); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function rand(n) { const a = new Uint8Array(n); crypto.getRandomValues(a); return b64url(a); }
async function challenge(v) { return b64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(v)))); }
function claims(jwt) { try { return JSON.parse(atob(jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); } catch (e) { return {}; } }

async function login(cfg) {
  const verifier = rand(48), state = rand(16);
  store.set('v', verifier); store.set('s', state);
  const q = new URLSearchParams({ response_type: 'code', client_id: cfg.clientId, redirect_uri: REDIRECT, scope: cfg.scope, state,
    code_challenge: await challenge(verifier), code_challenge_method: 'S256' });
  location.assign(cfg.authorizationEndpoint + (cfg.authorizationEndpoint.includes('?') ? '&' : '?') + q);
}
async function finish(cfg, code, state) {
  const ok = store.get('s') && state === store.get('s') && store.get('v');
  const verifier = store.get('v');
  store.set('s', ''); store.set('v', '');
  history.replaceState(null, '', '/app/index.html');
  if (!ok) { $('loginMsg').textContent = 'Sign-in could not be verified. Please try again.'; return; }
  const res = await fetch(cfg.tokenEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: REDIRECT, client_id: cfg.clientId, code_verifier: verifier }) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) { $('loginMsg').textContent = 'Sign-in failed. Please try again.'; return; }
  store.set('token', data.access_token);
  store.set('expires', String(Date.now() + (Number(data.expires_in) || 300) * 1000));
}
function signedIn() {
  const t = store.get('token'), e = Number(store.get('expires') || 0);
  return Boolean(t) && (!e || e > Date.now());
}

// ---- API
async function api(method, path, body) {
  const headers = { 'Authorization': 'Bearer ' + store.get('token') };
  if (store.get('party')) headers['X-Party'] = store.get('party');
  if (store.get('party')) headers['X-Actor'] = store.get('party');
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch('/api/v1/me' + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (e) { data = null; }
  if (res.status === 401) { signOut(); throw new Error('Your session ended. Please sign in again.'); }
  if (!res.ok) throw new Error((data && data.message) || 'Something went wrong');
  return data;
}

// ---- views
function esc(s) { const d = document.createElement('div'); d.textContent = String(s); return d.innerHTML; }
async function loadHome() {
  const [profile, bal, loans] = await Promise.all([api('GET', ''), api('GET', '/balance'), api('GET', '/loans')]);
  $('hello').textContent = 'Hello, ' + profile.partyId;
  $('balance').textContent = baht(bal.minor);
  $('asOf').textContent = 'as of ' + bal.asOf;
  const next = loans.map((l) => l.next).filter(Boolean).sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
  $('nextCard').hidden = !next;
  if (next) {
    $('nextAmount').textContent = baht(next.amountMinor);
    $('nextDue').innerHTML = next.overdue ? '<span class="over">Overdue since ' + esc(next.dueDate) + '</span>' : 'due ' + esc(next.dueDate);
  }
}
async function loadActivity() {
  const rows = await api('GET', '/activity?limit=50');
  $('activityEmpty').hidden = rows.length > 0;
  $('activityList').innerHTML = rows.map((r) => `<li><span>${esc(r.label)}<span class="sub">${esc(r.date)}</span></span>` +
    `<span class="${r.direction === 'IN' ? 'in' : 'out'}">${r.direction === 'IN' ? '+' : '−'}${esc(baht(r.minor))}</span></li>`).join('');
}
async function loadLoans() {
  const loans = await api('GET', '/loans');
  $('loansEmpty').hidden = loans.length > 0;
  $('loanList').innerHTML = loans.map((l) => {
    const pct = l.instalments ? Math.round(100 * l.paid / l.instalments) : 0;
    const pay = l.payableMinor > 0 ? `<button class="primary wide" data-pay="${esc(l.id)}" data-amount="${l.payableMinor}">Pay ${esc(baht(l.payableMinor))}</button>` : '';
    return `<div class="card"><span class="label">${esc(l.id)} · ${esc(l.status.toLowerCase().replace('_', ' '))}</span>` +
      `<span class="mid">${esc(baht(l.outstandingMinor))}</span><span class="note">outstanding of ${esc(baht(l.principalMinor))}</span>` +
      `<progress max="100" value="${pct}" aria-label="Loan repaid"></progress>` +
      `<span class="note">${l.paid} of ${l.instalments} payments made</span>${pay}</div>`;
  }).join('');
}
const loaders = { home: loadHome, activity: loadActivity, loans: loadLoans };
async function show(view) {
  document.querySelectorAll('.view').forEach((v) => { v.hidden = v.id !== view; });
  document.querySelectorAll('.tabbar button').forEach((b) => { if (b.dataset.view === view) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
  note('');
  try { await loaders[view](); } catch (e) { note(e.message, true); }
}
function enter() { $('login').hidden = true; $('shell').hidden = false; show('home'); }
function signOut() { store.set('token', ''); store.set('expires', ''); store.set('party', ''); $('shell').hidden = true; $('login').hidden = false; }

document.querySelectorAll('.tabbar button').forEach((b) => b.addEventListener('click', () => show(b.dataset.view)));
$('signout').addEventListener('click', signOut);
$('loanList').addEventListener('click', (e) => {
  const b = e.target.closest('[data-pay]');
  if (!b) return;
  const amount = Number(b.dataset.amount);
  $('confirmTitle').textContent = 'Pay ' + baht(amount);
  $('confirmText').textContent = 'This is taken from your savings account for loan ' + b.dataset.pay + '.';
  const dlg = $('confirm');
  dlg.returnValue = '';
  dlg.addEventListener('close', async () => {
    if (dlg.returnValue !== 'ok') return;
    try {
      await api('POST', '/loans/' + encodeURIComponent(b.dataset.pay) + '/repayments', { reference: rand(9), amountMinor: amount });
      note('Payment made', false);
      await loadLoans();
    } catch (err) { note(err.message, true); }
  }, { once: true });
  dlg.showModal();
});

(async () => {
  let cfg = { mode: 'token' };
  try { const r = await fetch('/app/config.json'); if (r.ok) cfg = await r.json(); } catch (e) { /* offline: stay on the sign-in screen */ }
  const q = new URLSearchParams(location.search);
  if (cfg.mode === 'oidc' && q.get('code')) await finish(cfg, q.get('code'), q.get('state'));
  if (signedIn()) { enter(); }
  else {
    $('login').hidden = false;
    $('signin').hidden = cfg.mode !== 'oidc';
    $('devForm').hidden = cfg.mode === 'oidc';
    $('signin').addEventListener('click', () => login(cfg));
    $('devForm').addEventListener('submit', (e) => { e.preventDefault(); store.set('token', $('devToken').value.trim()); store.set('party', $('devParty').value.trim()); enter(); });
  }
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/app/sw.js', { scope: '/app/' }).catch(() => { /* optional */ });
})();

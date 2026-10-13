// Browser smoke test of the console (the design prototype wired to the services) against a running app in token mode
// (app on :18080, token ui-smoke-token-123456). Usage: NODE_PATH=$(npm root -g) node scripts/console-smoke.js
const { chromium } = require('playwright');
const BASE = 'http://localhost:18080', TOKEN = 'ui-smoke-token-123456';
const api = async (method, path, actor, body) => {
  const r = await fetch(BASE + '/api/v1' + path, { method, headers: { Authorization: 'Bearer ' + TOKEN, 'X-Actor': actor, 'Content-Type': 'application/json' }, body: body && JSON.stringify(body) });
  const t = await r.text(); if (!r.ok) throw new Error(`${method} ${path} -> ${r.status} ${t}`); return t ? JSON.parse(t) : null;
};
const publishSavings = async () => {
  const yaml = require('fs').readFileSync('fabor-app/src/test/resources/products/savings.yaml', 'utf8');
  const d = await fetch(BASE + '/api/v1/products/drafts', { method: 'POST', headers: { Authorization: 'Bearer ' + TOKEN, 'X-Actor': 'maya', 'Content-Type': 'text/plain' }, body: yaml }).then((r) => r.json());
  await api('POST', `/products/drafts/${d.id}/submit`, 'maya');
  for (const [a, r] of [['bob', 'PRODUCT'], ['rita', 'RISK'], ['fin', 'FINANCE'], ['carl', 'COMPLIANCE']]) await api('POST', `/products/drafts/${d.id}/approve`, a, { role: r });
  await api('POST', `/products/drafts/${d.id}/publish`, 'maya');
};
(async () => {
  await publishSavings();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' && !/status of 4\d\d/.test(m.text())) errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  const signIn = async (actor, token = TOKEN) => {
    await page.goto(BASE + '/console/index.html#settings');
    await page.fill('#acActor', actor); await page.fill('#acToken', token); await page.click('#acUse'); await page.waitForTimeout(400);
  };
  const toastText = () => page.locator('#toasts .toast').last().textContent();

  // not signed in: the prototype's sample data, and the sign-in state says so
  await page.goto(BASE + '/console/index.html#approvals');
  console.log('signed out ->', (await page.textContent('#apprList')).includes('AUTO_HP_USED') ? 'sample approvals' : 'unexpected');

  // wrong token: the services refuse, the console says so
  await signIn('maya', 'wrong-token');
  await page.goto(BASE + '/console/index.html#builder'); await page.click('#mbPublish'); await page.waitForTimeout(800);
  console.log('wrong token ->', await toastText());

  // real flow through the Master Builder and Approvals
  await signIn('maya');
  await page.goto(BASE + '/console/index.html#builder'); await page.waitForTimeout(500);
  await page.click('#mbTpl >> text=Personal'); await page.click('#mbPublish'); await page.waitForURL(/#approvals/); await page.waitForSelector('[data-live=check]');
  await page.click('[data-live=check]'); await page.waitForSelector('[data-live=report]:not([hidden])');
  console.log('server check ->', (await page.textContent('[data-live=report]')).replace(/\s+/g, ' ').slice(0, 120));
  const draft = (await api('GET', '/products/drafts', 'maya'))[0];
  for (const [a, r] of [['bob', 'PRODUCT'], ['rita', 'RISK'], ['fin', 'FINANCE'], ['carl', 'COMPLIANCE']]) await api('POST', `/products/drafts/${draft.id}/approve`, a, { role: r });
  await signIn('maya'); await page.goto(BASE + '/console/index.html#approvals'); await page.click('[data-live=publish]'); await page.waitForTimeout(800);
  console.log('published ->', await toastText());
  console.log('versions ->', JSON.stringify(await api('GET', '/products/PERSONAL_LOAN/versions', 'maya')).slice(0, 100));

  // customer 360: register, then it opens
  await signIn('ops'); await page.goto(BASE + '/console/index.html#customer');
  await page.fill('#rgId', 'P1'); await page.fill('#rgName', 'Anong Suksan'); await page.fill('#rgNid', '1101700230678'); await page.fill('#rgPhone', '0812345678'); await page.fill('#rgDob', '1990-06-01');
  await page.click('#rgGo'); await page.waitForTimeout(1200);
  console.log('register ->', (await page.textContent('#rgOut')).trim());
  // scheduler backfill from Settings
  await page.goto(BASE + '/console/index.html#settings'); await page.click('#acBackfill'); await page.waitForSelector('#acBackfillOut:not([hidden])');
  console.log('backfill ->', await page.textContent('#acBackfillOut'));
  // phone width: no horizontal scroll
  await page.setViewportSize({ width: 390, height: 800 });
  console.log('mobile horizontal overflow:', await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth));
  console.log('console errors:', JSON.stringify(errors));
  await browser.close();
})().catch((e) => { console.error('SMOKE FAILED', e); process.exit(1); });

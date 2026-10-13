// Browser test of the customer web app on a phone-sized screen, against an app started with SPRING_PROFILES_ACTIVE=demo,
// FABOR_AUTH_MODE=token and FABOR_API_TOKEN=ui-smoke-token-123456 on :18080. It sets up one customer and a loan through
// the staff API, then uses the app as that customer.  NODE_PATH=$(npm root -g) node scripts/app-smoke.js
const { chromium, devices } = require('playwright');
const fs = require('fs');
const BASE = 'http://localhost:18080';
const TOKEN = 'ui-smoke-token-123456';
const yamls = [process.env.SAVINGS_YAML || 'fabor-app/src/test/resources/products/savings.yaml', process.env.LOAN_YAML || 'fabor-app/src/test/resources/products/personal-loan.yaml'];

async function staff(method, path, actor, body, type) {
  const r = await fetch(BASE + '/api/v1' + path, { method, headers: { Authorization: 'Bearer ' + TOKEN, 'X-Actor': actor, 'Content-Type': type || 'application/json' },
    body: body === undefined ? undefined : (type ? body : JSON.stringify(body)) });
  const t = await r.text();
  if (!r.ok) throw new Error(`${method} ${path} -> ${r.status} ${t}`);
  return t ? JSON.parse(t) : null;
}
async function publish(yaml) {
  const d = await staff('POST', '/products/drafts', 'maya', yaml, 'text/plain');
  await staff('POST', `/products/drafts/${d.id}/submit`, 'maya');
  for (const [a, r] of [['bob', 'PRODUCT'], ['rita', 'RISK'], ['fin', 'FINANCE'], ['carl', 'COMPLIANCE']]) await staff('POST', `/products/drafts/${d.id}/approve`, a, { role: r });
  await staff('POST', `/products/drafts/${d.id}/publish`, 'maya');
}

(async () => {
  for (const y of yamls) await publish(fs.readFileSync(y, 'utf8'));
  const today = new Date().toISOString().slice(0, 10);
  await staff('POST', '/customers', 'ops', { partyId: 'P1', fullName: 'Anong Suksan', nationalId: '1101700230678', phone: '0812345678', dateOfBirth: '1990-06-01', documentRef: 'd',
    consents: [{ purpose: 'KYC_PROCESSING', version: 1, channel: 'API' }, { purpose: 'CREDIT_BUREAU', version: 1, channel: 'API' }] });
  const d = await staff('POST', '/loans/applications', 'ops', { applicationId: 'APP1', partyId: 'P1', productCode: 'PERSONAL_LOAN_STD', productVersion: 1, amountMinor: 10000000, termMonths: 12,
    monthlyInstalmentMinor: 916800, monthlyIncomeMinor: 5000000, existingDebtMinor: 500000, monthsAtEmployer: 36, asOf: today, currency: 'THB' });
  console.log('setup: decision', d.decision, d.loanId);

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['Pixel 7'] });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(BASE + '/app/index.html');
  await page.fill('#devToken', TOKEN); await page.fill('#devParty', 'P1');
  await page.click('#devForm button[type=submit]');
  await page.waitForSelector('#balance:not(:empty)');
  await page.waitForFunction(() => document.getElementById('balance').textContent !== '–');
  console.log('hello:', await page.textContent('#hello'));
  console.log('balance:', await page.textContent('#balance'));
  await page.click('[data-view=activity]');
  await page.waitForSelector('#activityList li');
  console.log('activity:', (await page.textContent('#activityList')).replace(/\s+/g, ' ').trim());
  await page.click('[data-view=loans]');
  await page.waitForSelector('#loanList .card');
  console.log('loan:', (await page.textContent('#loanList')).replace(/\s+/g, ' ').trim().slice(0, 140));
  console.log('pay button shown (nothing billed yet):', (await page.locator('[data-pay]').count()) > 0);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  console.log('horizontal overflow:', overflow);
  await page.screenshot({ path: process.env.SCREENSHOT || '/tmp/app.png' });
  // a different customer id sees nothing of P1's data
  await page.click('#signout');
  await page.fill('#devToken', TOKEN); await page.fill('#devParty', 'P2');
  await page.click('#devForm button[type=submit]');
  await page.waitForFunction(() => /./.test(document.getElementById('msg').textContent));
  console.log('other customer ->', await page.textContent('#msg'));
  console.log('page errors:', JSON.stringify(errors));
  await browser.close();
})().catch((e) => { console.error('SMOKE FAILED', e); process.exit(1); });

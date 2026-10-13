// Takes the Phase 1 screenshots in docs/ui/ against an app started in demo mode (see scripts/app-smoke.js for the setup).
const { chromium, devices } = require('playwright');
const fs = require('fs');
const BASE = 'http://localhost:18080', TOKEN = 'ui-smoke-token-123456', OUT = process.env.OUT || 'docs/ui';
const yamls = ['fabor-app/src/test/resources/products/savings.yaml', 'fabor-app/src/test/resources/products/personal-loan.yaml'];
async function staff(method, path, actor, body, type) {
  const r = await fetch(BASE + '/api/v1' + path, { method, headers: { Authorization: 'Bearer ' + TOKEN, 'X-Actor': actor, 'Content-Type': type || 'application/json' },
    body: body === undefined ? undefined : (type ? body : JSON.stringify(body)) });
  const t = await r.text(); if (!r.ok) throw new Error(`${method} ${path} -> ${r.status} ${t}`); return t ? JSON.parse(t) : null;
}
const iso = (d) => d.toISOString().slice(0, 10);
(async () => {
  const browser = await chromium.launch();
  // ---------- console
  const page = await browser.newPage({ viewport: { width: 1180, height: 860 } });
  const wait = (re) => page.waitForFunction((r) => new RegExp(r).test(document.getElementById('status').textContent), re.source, { timeout: 15000 });
  const as = async (actor) => { await page.fill('#actor', actor); await page.fill('#token', TOKEN); await page.click('#auth button'); };
  await page.goto(BASE + '/console/index.html');
  await as('maya');
  for (const y of yamls) {
    await page.fill('#yaml', fs.readFileSync(y, 'utf8')); await page.click('#createDraft'); await wait(/Create draft done/);
    await page.click('#check'); await wait(/Check done/);
    if (y.includes('personal')) await page.screenshot({ path: `${OUT}/console-1-master-builder-check.png`, fullPage: true });
    await page.click('#submit'); await wait(/Submit done/);
    for (const [a, r] of [['bob', 'PRODUCT'], ['rita', 'RISK'], ['fin', 'FINANCE'], ['carl', 'COMPLIANCE']]) { await as(a); await page.selectOption('#role', r); await page.click('#approve'); await wait(/Approve done/); }
    await as('maya'); await page.click('#publish'); await wait(/Publish done/);
  }
  await page.fill('#versionsCode', 'PERSONAL_LOAN_STD'); await page.click('#listVersions'); await wait(/List versions done/);
  await page.screenshot({ path: `${OUT}/console-2-published-version.png`, fullPage: true });

  await page.click('[data-tab=customers]');
  await as('ops');
  await page.fill('[name=partyId]', 'P1'); await page.fill('[name=fullName]', 'Anong Suksan'); await page.fill('[name=nationalId]', '1101700230678');
  await page.fill('[name=phone]', '0812345678'); await page.fill('[name=dateOfBirth]', '1990-06-01');
  await page.click('#registerForm button[type=submit]'); await wait(/Register customer done/);
  await page.screenshot({ path: `${OUT}/console-3-customer-registered.png`, fullPage: true });

  const disb = new Date(Date.now() - 75 * 86400000);
  await page.click('[data-tab=loans]');
  const f = { applicationId: 'APP1', partyId: 'P1', amountMinor: '10000000', termMonths: '12', monthlyInstalmentMinor: '916800', monthlyIncomeMinor: '5000000', existingDebtMinor: '500000', monthsAtEmployer: '36', asOf: iso(disb) };
  for (const [k, v] of Object.entries(f)) await page.fill(`#loanForm [name=${k}]`, v);
  await page.click('#loanForm button[type=submit]'); await wait(/Loan decision done/);
  await page.screenshot({ path: `${OUT}/console-4-loan-decision.png`, fullPage: true });

  // a declined application shows its reasons
  for (const [k, v] of Object.entries({ ...f, applicationId: 'APP2', amountMinor: '40000000', monthlyInstalmentMinor: '3600000', existingDebtMinor: '3500000' })) await page.fill(`#loanForm [name=${k}]`, v);
  await page.click('#loanForm button[type=submit]'); await wait(/Loan decision done/);
  await page.screenshot({ path: `${OUT}/console-5-loan-declined-with-reasons.png`, fullPage: true });

  await page.click('[data-tab=accounts]');
  await page.fill('#moveForm [name=account]', 'SAV-P1'); await page.fill('#moveForm [name=reference]', 'r1'); await page.fill('#moveForm [name=amount]', '1'); await page.fill('#moveForm [name=valueDate]', iso(new Date()));
  await page.click('#doBalance'); await wait(/Balance done/);
  await page.screenshot({ path: `${OUT}/console-6-account-balance.png`, fullPage: true });

  // ---------- mobile app: the scheduler has billed the overdue instalments by now
  await new Promise((r) => setTimeout(r, 6000));
  const ctx = await browser.newContext({ ...devices['Pixel 7'] });
  const app = await ctx.newPage();
  await app.goto(BASE + '/app/index.html');
  await app.screenshot({ path: `${OUT}/app-0-sign-in.png` });
  await app.fill('#devToken', TOKEN); await app.fill('#devParty', 'P1'); await app.click('#devForm button[type=submit]');
  await app.waitForFunction(() => document.getElementById('balance').textContent !== '–'); await app.waitForTimeout(400);
  await app.screenshot({ path: `${OUT}/app-1-home.png` });
  await app.click('[data-view=activity]'); await app.waitForSelector('#activityList li'); await app.waitForTimeout(400);
  await app.screenshot({ path: `${OUT}/app-2-activity.png` });
  await app.click('[data-view=loans]'); await app.waitForSelector('#loanList .card'); await app.waitForTimeout(400);
  await app.screenshot({ path: `${OUT}/app-3-loans.png` });
  if (await app.locator('[data-pay]').count()) {
    await app.click('[data-pay]'); await app.waitForTimeout(300);
    await app.screenshot({ path: `${OUT}/app-4-confirm-payment.png` });
    await app.click('#confirmOk'); await app.waitForFunction(() => /Payment made/.test(document.getElementById('msg').textContent), null, { timeout: 10000 }); await app.waitForTimeout(500);
    await app.screenshot({ path: `${OUT}/app-5-after-payment.png` });
  }
  const dark = await browser.newContext({ ...devices['Pixel 7'], colorScheme: 'dark' });
  const d = await dark.newPage();
  await d.goto(BASE + '/app/index.html'); await d.fill('#devToken', TOKEN); await d.fill('#devParty', 'P1'); await d.click('#devForm button[type=submit]');
  await d.waitForFunction(() => document.getElementById('balance').textContent !== '–'); await d.waitForTimeout(400);
  await d.screenshot({ path: `${OUT}/app-6-home-dark.png` });
  await browser.close();
  console.log(fs.readdirSync(OUT).filter((x) => x.endsWith('.png')).join('\n'));
})().catch((e) => { console.error('TOUR FAILED', e); process.exit(1); });

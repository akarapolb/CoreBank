// Browser smoke test of the console against a running app in token mode (app on :18080, token ui-smoke-token-123456).
// Usage: NODE_PATH=$(npm root -g) node scripts/console-smoke.js
const { chromium } = require('playwright');
const fs = require('fs');
const yaml = fs.readFileSync(process.env.PRODUCT_YAML || 'lending/src/test/resources/personal-loan.yaml', 'utf8');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => chromium.launch());
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('http://localhost:18080/console/index.html');
  const as = async (actor) => { await page.fill('#actor', actor); await page.fill('#token', 'ui-smoke-token-123456'); await page.click('#auth button'); };
  const expectStatus = async (re) => { await page.waitForFunction((r) => new RegExp(r).test(document.getElementById('status').textContent), re.source, { timeout: 10000 }); };
  // wrong token first: the UI must show an error, not crash
  await page.fill('#actor', 'maya'); await page.fill('#token', 'wrong-token'); await page.click('#auth button');
  await page.fill('#yaml', yaml); await page.click('#createDraft');
  await expectStatus(/failed.*unauthorized/i);
  console.log('wrong token ->', await page.textContent('#status'));
  // real flow
  await as('maya');
  await page.click('#createDraft'); await expectStatus(/Create draft done/);
  const id = await page.inputValue('#draftId'); console.log('draft', id);
  await page.click('#check'); await expectStatus(/Check done/);
  console.log('report:', (await page.textContent('#report')).replace(/\s+/g, ' ').slice(0, 160));
  await page.click('#submit'); await expectStatus(/Submit done/);
  for (const [actor, role] of [['bob', 'PRODUCT'], ['rita', 'RISK'], ['fin', 'FINANCE'], ['carl', 'COMPLIANCE']]) {
    await as(actor); await page.selectOption('#role', role); await page.click('#approve'); await expectStatus(/Approve done/);
  }
  await as('maya'); await page.click('#publish'); await expectStatus(/Publish done/);
  await page.fill('#versionsCode', 'PERSONAL_LOAN_STD'); await page.click('#listVersions'); await expectStatus(/List versions done/);
  console.log('versions row:', (await page.textContent('#versions tbody')).replace(/\s+/g, ' '));
  // a second publish by the same flow must be refused (maker-checker already used): try approving again as same role
  await as('zed'); await page.selectOption('#role', 'RISK'); await page.click('#approve');
  await expectStatus(/Approve failed/);
  console.log('re-approve ->', await page.textContent('#status'));
  // customers tab
  await page.click('[data-tab=customers]');
  await page.fill('[name=partyId]', 'P1'); await page.fill('[name=fullName]', 'Anong Suksan'); await page.fill('[name=nationalId]', '1101700230678');
  await page.fill('[name=phone]', '0812345678'); await page.fill('[name=dateOfBirth]', '1990-06-01');
  await as('ops'); await page.click('#registerForm button[type=submit]'); await expectStatus(/Register customer (done|failed)/);
  console.log('register ->', (await page.textContent('#registerOut')).replace(/\s+/g, ' '));
  // ops tab
  await page.click('[data-tab=ops]'); await page.click('#backfill'); await expectStatus(/Backfill done/);
  console.log('backfill ->', (await page.textContent('#opsOut')).replace(/\s+/g, ' '));
  await page.screenshot({ path: process.env.SCREENSHOT || '/tmp/console.png' });
  // mobile width has no horizontal scroll
  await page.setViewportSize({ width: 390, height: 800 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  console.log('mobile horizontal overflow:', overflow);
  console.log('console errors:', JSON.stringify(errors));
  await browser.close();
})().catch((e) => { console.error('SMOKE FAILED', e); process.exit(1); });

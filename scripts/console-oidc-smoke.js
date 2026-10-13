// Browser test of the console's OIDC sign-in (authorization code + PKCE) against scripts/mock-idp.js and an app in OIDC mode.
// Start the mock IdP on :18090 and the app on :18080 with the console variables set (see docs/quickstart.md), then:
//   NODE_PATH=$(npm root -g) node scripts/console-oidc-smoke.js
const { chromium } = require('playwright');
const fs = require('fs');
const yaml = fs.readFileSync(process.env.PRODUCT_YAML || 'lending/src/test/resources/personal-loan.yaml', 'utf8');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const status = () => page.textContent('#status');
  const waitStatus = (re) => page.waitForFunction((r) => new RegExp(r).test(document.getElementById('status').textContent), re.source, { timeout: 10000 });

  await page.goto('http://localhost:18080/console/index.html');
  await page.waitForSelector('#signin:not([hidden])');
  console.log('manual token form hidden in OIDC mode:', await page.isHidden('#auth'));
  // not signed in: the API refuses
  await page.fill('#yaml', yaml);
  await page.click('#createDraft');
  await waitStatus(/failed/);
  console.log('before sign-in ->', await status());

  // sign in through the identity provider
  await page.click('#signin');
  await page.waitForURL(/\/console\/index\.html(\?|$)/);
  await page.waitForSelector('#signout:not([hidden])');
  console.log('who:', await page.textContent('#who'));
  console.log('code removed from address bar:', !page.url().includes('code='));
  await page.fill('#yaml', yaml);
  await page.click('#createDraft');
  await waitStatus(/Create draft done/);
  console.log('create draft as signed-in maker ->', await status());
  await page.click('#publish');
  await waitStatus(/Publish failed/);
  console.log('maker cannot publish ->', await status());

  // sign out, then a user with no roles: authenticated but forbidden
  await page.click('#signout');
  await page.goto('http://localhost:18080/console/index.html');
  await page.evaluate(() => sessionStorage.clear());
  const ctx = browser.contexts()[0];
  await page.route('**/authorize*', (route) => {
    const u = new URL(route.request().url());
    u.searchParams.set('login_hint', 'nobody');
    route.continue({ url: u.toString() });
  });
  await page.reload();
  await page.click('#signin');
  await page.waitForSelector('#signout:not([hidden])');
  await page.fill('#yaml', yaml);
  await page.click('#createDraft');
  await waitStatus(/failed/);
  console.log('no-role user ->', await status());
  console.log('page errors:', JSON.stringify(errors));
  await browser.close();
})().catch((e) => { console.error('SMOKE FAILED', e); process.exit(1); });

// Browser test of the console's OIDC sign-in (authorization code + PKCE) against scripts/mock-idp.js and an app in OIDC mode.
// Start the mock IdP on :18090 and the app on :18080 with the console variables set (see docs/quickstart.md), then:
//   NODE_PATH=$(npm root -g) node scripts/console-oidc-smoke.js
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const toast = async () => { await page.waitForTimeout(900); return page.locator('#toasts .toast').last().textContent(); };
  const submit = async () => { await page.goto('http://localhost:18080/console/index.html#builder'); await page.waitForTimeout(500);
    await page.click('#mbTpl >> text=Personal'); await page.click('#mbPublish'); return toast(); };

  await page.goto('http://localhost:18080/console/index.html#settings');
  await page.waitForSelector('#acSignIn:not([hidden])');
  console.log('token form hidden in OIDC mode:', await page.isHidden('#acToken'));
  console.log('before sign-in ->', await page.textContent('#accessState'));

  await page.click('#acSignIn');                                          // through the identity provider and back
  await page.waitForSelector('#acSignOut:not([hidden])');
  console.log('after sign-in ->', await page.textContent('#accessState'));
  console.log('code removed from address bar:', !page.url().includes('code='));
  console.log('maker submits a product ->', await submit());

  // a user with no roles, in a fresh browser session: authenticated but forbidden
  const other = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await other.route('**/authorize*', (route) => { const u = new URL(route.request().url()); u.searchParams.set('login_hint', 'nobody'); route.continue({ url: u.toString() }); });
  await other.goto('http://localhost:18080/console/index.html#settings');
  await other.click('#acSignIn'); await other.waitForSelector('#acSignOut:not([hidden])');
  await other.click('#view-builder', { force: true }).catch(() => {});
  await other.goto('http://localhost:18080/console/index.html#builder'); await other.waitForTimeout(500);
  await other.click('#mbTpl >> text=Personal'); await other.click('#mbPublish'); await other.waitForTimeout(900);
  const noRole = await other.locator('#toasts .toast').last().textContent();
  console.log('no-role user ->', noRole);
  console.log('page errors:', JSON.stringify(errors));
  await browser.close();
})().catch((e) => { console.error('SMOKE FAILED', e); process.exit(1); });

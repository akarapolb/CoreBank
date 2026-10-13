// Screenshot tour of the staff console and the customer app against a running demo app (see docs/quickstart.md).
// Usage: NODE_PATH=$(npm root -g) OUT=docs/ui node scripts/ui-tour.js
const { chromium, devices } = require('playwright');
const fs=require('fs');
const BASE='http://localhost:18080', TOKEN='ui-smoke-token-123456', OUT=process.env.OUT||'docs/ui';
fs.mkdirSync(OUT,{recursive:true});
const iso=d=>d.toISOString().slice(0,10);
async function staff(method,path,actor,body){const r=await fetch(BASE+'/api/v1'+path,{method,headers:{Authorization:'Bearer '+TOKEN,'X-Actor':actor,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});const t=await r.text();if(!r.ok)throw new Error(method+path+' '+r.status+' '+t);return t?JSON.parse(t):null}
(async()=>{
 const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1440,height:900}});
 const errs=[]; p.on('console',m=>{if(m.type()==='error')errs.push(m.text())}); p.on('pageerror',e=>errs.push('PAGE '+e));
 const shot=async(n,full)=>{await p.waitForTimeout(600); await p.screenshot({path:`${OUT}/${n}.png`,fullPage:!!full})};
 const as=async(a)=>{await p.goto(BASE+'/console/index.html#settings'); await p.waitForTimeout(500); await p.fill('#acActor',a); await p.fill('#acToken',TOKEN); await p.click('#acUse'); await p.waitForTimeout(400)};
 const go=async h=>{await p.evaluate(h=>{location.hash=h},h); await p.waitForTimeout(500)};
 // products: savings via API (maker maya), personal loan through the Master Builder screen
 const sav=require('fs').readFileSync('fabor-app/src/test/resources/products/savings.yaml','utf8');
 const d=await fetch(BASE+'/api/v1/products/drafts',{method:'POST',headers:{Authorization:'Bearer '+TOKEN,'X-Actor':'maya','Content-Type':'text/plain'},body:sav}).then(r=>r.json());
 await staff('POST',`/products/drafts/${d.id}/submit`,'maya');
 for(const [a,r] of [['bob','PRODUCT'],['rita','RISK'],['fin','FINANCE'],['carl','COMPLIANCE']]) await staff('POST',`/products/drafts/${d.id}/approve`,a,{role:r});
 await staff('POST',`/products/drafts/${d.id}/publish`,'maya');

 await as('maya'); await go('builder'); await shot('console-01-master-builder',true);
 await p.click('#mbTpl >> text=Personal'); await shot('console-02-master-builder-personal-loan',true);
 await p.click('#mbPublish'); await p.waitForTimeout(1500); await shot('console-03-approvals-pending');
 await p.click('[data-live=check]'); await shot('console-04-approvals-server-check');
 const dr=await staff('GET','/products/drafts','maya'); const id=dr.find(x=>x.product==='PERSONAL_LOAN').id;
 for(const [a,r] of [['bob','PRODUCT'],['rita','RISK'],['fin','FINANCE'],['carl','COMPLIANCE']]) await staff('POST',`/products/drafts/${id}/approve`,a,{role:r});
 await as('maya'); await go('approvals'); await shot('console-05-approvals-ready-to-publish');
 await p.click('[data-live=publish]'); await p.waitForTimeout(1000);

 await as('ops'); await go('customer');
 await p.fill('#rgId','P1'); await p.fill('#rgName','Anong Suksan'); await p.fill('#rgNid','1101700230678'); await p.fill('#rgPhone','0812345678'); await p.fill('#rgDob','1990-06-01');
 await p.click('#rgGo'); await p.waitForTimeout(1500); await shot('console-06-customer-360',true);

 await go('branch'); await p.fill('#tAcct','SAV-P1'); await p.fill('#tAmt','50000'); await p.click('#tPost'); await p.waitForTimeout(800); await shot('console-07-teller-deposit',true);

 const disb=new Date(Date.now()-75*86400000);
 await go('contract');
 const f={apProd:'PERSONAL_LOAN',apId:'APP1',apParty:'P1',apAmt:'100000',apTerm:'12',apInst:'9168',apInc:'50000',apDebt:'5000',apEmp:'36',apAsOf:iso(disb)};
 for(const [k,v] of Object.entries(f)) await p.fill('#'+k,v);
 await p.click('#apGo'); await p.waitForTimeout(2500); await shot('console-08-contract-approved',true);
 await go('contract');
 for(const [k,v] of Object.entries({apId:'APP2',apAmt:'400000',apInst:'36000',apDebt:'35000'})) await p.fill('#'+k,v);
 await p.click('#apGo'); await p.waitForTimeout(1500); await shot('console-09-loan-declined',true);
 await new Promise(r=>setTimeout(r,6000));
 await p.fill('#lnId','LN-APP1'); await p.click('#loanLookup button'); await p.waitForTimeout(1500); await shot('console-10-contract-overdue',true);
 await go('ledger'); await p.fill('#lgAcct','dep:SAV-P1'); await p.click('#ledgerForm button'); await p.waitForTimeout(1200);
 await p.click('#batches details >> nth=0'); await shot('console-11-ledger-postings',true);
 console.log(errs.join('\n')||'no console errors');
  // ---------- mobile app: the scheduler has billed the overdue instalments by now
  await new Promise((r) => setTimeout(r, 6000));
  const ctx = await b.newContext({ ...devices['Pixel 7'] });
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
  const dark = await b.newContext({ ...devices['Pixel 7'], colorScheme: 'dark' });
  const dk = await dark.newPage();
  await dk.goto(BASE + '/app/index.html'); await dk.fill('#devToken', TOKEN); await dk.fill('#devParty', 'P1'); await dk.click('#devForm button[type=submit]');
  await dk.waitForFunction(() => document.getElementById('balance').textContent !== '–'); await dk.waitForTimeout(400);
  await dk.screenshot({ path: `${OUT}/app-6-home-dark.png` });
  await b.close();
  console.log(fs.readdirSync(OUT).filter((x) => x.endsWith('.png')).join('\n'));
})().catch((e) => { console.error('TOUR FAILED', e); process.exit(1); });

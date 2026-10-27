(function(){
const out=[], errs=[];
window.addEventListener("error",e=>errs.push("onerror: "+e.message+" @"+e.lineno));
const bad=(where)=>{const h=document.body.innerHTML; const m=h.match(/undefined|NaN|\[object Object\]|Infinity/g); if(m) errs.push(where+": contains "+[...new Set(m)].join(","));};
const step=(name,fn)=>{try{fn();bad(name);out.push("ok "+name);}catch(e){errs.push(name+": "+e.message+"\n"+(e.stack||"").split("\n").slice(0,3).join(" | "));}};
try{ finishSignin(); }catch(e){errs.push("signin "+e.message)}
const flow=(name,arg,setup,expect)=>step("flow "+name+(arg?":"+arg:""),()=>{
  openFlow(name,arg); if(setup) setup();
  dialogAction("next"); if(dlg.step!==1) throw new Error("did not reach review: "+dlg.error);
  const html=$("#dialogHost").innerHTML; if(expect&&!expect.every(x=>html.includes(x))) throw new Error("review missing "+expect.filter(x=>!html.includes(x)).join(" / ")+" :: "+$("#dialogHost .dlg-body").textContent.slice(0,400));
  const btn=$("#dlgConfirm"); if(btn&&btn.disabled&&!btn.dataset.typed) {out.push("  (blocked) "+name+": "+$("#dialogHost .dlg-body").textContent.slice(0,160)); closeDialog(); return;}
  dialogAction("confirm"); if(dlg.step!==2) throw new Error("not done");
  out.push("  done "+name+": "+$("#dialogHost .dlg-body strong").textContent);
  closeDialog();
});
for (const L of ["en","th"]) {
  lang=L;
  ["overview","loans","facilities","servicing","applications","restructuring"].forEach(sec=>step(L+" lending/"+sec,()=>{seenLists.add("lending/"+sec);go("lending",sec);}));
  for (const rec of ["LN-77120","APP-30416","FAC-B2031","LN-A-C10","APP-30413"]) for (const [tab] of RECS[rec].tabs) step(L+" "+rec+"/"+tab,()=>go(null,null,rec,tab));
  step(L+" authorities",()=>go("admin","authorities"));
  step(L+" c360",()=>go("customers","c360"));
  step(L+" workbench credit",()=>{role=ROLES.find(r=>r.id==="credit");go("workbench","today");});
  role=ROLES[0];
}
lang="en"; role=ROLES[0];
go(null,null,"LN-77120");
flow("hmPrepay",null,null,["2,590,243.96","33 months sooner"]);
flow("hmPrepay",null,()=>{document.querySelector("input[name=pmode][value=instalment]").checked=true; $("#pfrom").value="transfer";},["New instalment"]);
flow("hmReprice",null,null,["3.10%","Modification loss"]);
flow("hmHoliday",null,null,["Interest added"]);
flow("hmHoliday",null,()=>{document.querySelector("input[name=hhow][value=spread]").checked=true;},["New instalment"]);
flow("hmDueDate",null,null,["28 Nov 2026"]);
flow("hmDueDate",null,()=>{$("#hday").value="5"},["5 Dec 2026"]);
flow("hmMandate"); flow("hmWaive"); flow("hmLetter",null,null,["95,226.50"]);
step("prepay validation",()=>{openFlow("hmPrepay");$("#pamt").value="9,000,000";dialogAction("next");if(dlg.step!==0||!dlg.error)throw new Error("no error");out.push("  err: "+dlg.error);closeDialog();});
step("home servicing log",()=>{go(null,null,"LN-77120","servicing"); if(!$("#view").textContent.includes("Prepayment of")) throw new Error("log missing");});
role=ROLES.find(r=>r.id==="collector");
flow("hmPrepay",null,null,["Needs a second approver"]);
role=ROLES[0];

// ---- application form ----
const setF=(k,v)=>{const el=document.getElementById("f-"+k); if(!el) throw new Error("no field "+k+" on "+current.tab); if(el.type==="checkbox") el.checked=v; else el.value=v; el.dispatchEvent(new Event("input",{bubbles:true}));};
const fillAt=(tab,kv)=>step("fill "+tab,()=>{go(null,null,"APP-30416",tab); for(const [k,v] of Object.entries(kv)) setF(k,v);});
for (const prod of ["personal","home","car"]) for (const L of ["en","th"]) { lang=L; step(L+" form "+prod,()=>{INTAKE=INTAKE0(); go(null,null,"APP-30416","loan"); $(`[data-intake-product="${prod}"]`).click(); for (const [k] of AF_STEPS) go(null,null,"APP-30416",k);}); }
lang="en"; INTAKE=INTAKE0();
step("count fields",()=>{out.push("  catalogue: "+AF.reduce((n,s)=>n+s.fields.length,0)+" fields in "+AF.length+" sections; personal required now "+completeness().done+"/"+completeness().total);});
go(null,null,"APP-30416","review");
flow("appSubmit",null,null,["answers are missing"]);
step("badges after check",()=>{render(); out.push("  step badges: "+[...document.querySelectorAll(".steps .count")].map(e=>e.parentElement.textContent).join(" | "));});
step("bad id",()=>{INTAKE.f.spouseId="1234567890123"; INTAKE.f.marital="married-reg"; go(null,null,"APP-30416","applicant"); const e=$("#f-spouseId-e"); if(!e) throw new Error("no id error"); out.push("  id error: "+e.textContent); INTAKE.f.marital="single";});
fillAt("loan",{purpose:"education",creditLife:"none"});
fillAt("applicant",{emName:"Somsri Rattana",emRel:"parent",emMobile:"0891112233",emDiffAddr:true});
fillAt("work",{workPhone:"027001234"});
fillAt("consents",{pdpaMarketing:"no",pdpaPartners:"no",pep:"no",usPerson:"no",relatedBank:"no",bankrupt:"no",certify:true});
step("complete",()=>{const k=completeness(); out.push("  completeness "+k.done+"/"+k.total); if(k.done!==k.total) throw new Error("still missing "+FORM_STEPS.flatMap(s=>missing(s)).map(m=>m.x.k).join(","));});
step("summary live",()=>{go(null,null,"APP-30416","loan"); setF("amount","400000"); out.push("  summary: "+$("#inSum").textContent.replace(/\s+/g," ").slice(0,140)); setF("amount","300000");});
go(null,null,"APP-30416","review");
flow("appSubmit",null,null,["automatic approval"]);
step("offer conditions",()=>{go(null,null,"APP-30416","offer"); out.push("  offer: "+$("#view .alert")?.textContent.slice(0,140));});
flow("appOffer");
step("disburse blocked",()=>{render(); if(!$('[data-flow="appDisburse"]').disabled) throw new Error("disburse not blocked by conditions");});
step("docs received",()=>{go(null,null,"APP-30416","documents"); let b; while((b=$('[data-doc-state="received"]'))) b.click(); document.querySelectorAll(".toast").forEach(t=>t.remove()); go(null,null,"APP-30416","offer"); if($('[data-flow="appDisburse"]').disabled) throw new Error("still blocked");});
flow("appDisburse");
step("paid",()=>{render(); if(!$("#view").textContent.includes("LN-A-C15 is open")) throw new Error("not paid");});
// PEP is referred
step("pep",()=>{INTAKE.decided=null; INTAKE.f.pep="self"; INTAKE.f.pepDetail="Provincial council member, Thailand"; go(null,null,"APP-30416","review");});
flow("appSubmit",null,null,["Referred"]);
// home with co-borrower goes to a credit officer
step("home",()=>{const f=INTAKE.f; INTAKE=INTAKE0(); Object.assign(INTAKE.f,f,{pep:"no",pepDetail:""}); go(null,null,"APP-30416","loan"); $('[data-intake-product="home"]').click();});
fillAt("loan",{purpose:"buy-new",fireInsurer:"own"});
fillAt("coapp",{hasCo:"yes"});
fillAt("coapp",{coRel:"sibling",coName:"Pakorn Rattana",coId:"3100500788123",coDob:"1992-01-20",coMobile:"0815556677",coOcc:"salaried",coEmployer:"Bangkok Hospital",coIncome:"55000",coDebts:"3000",coNcb:true});
step("home docs",()=>{go(null,null,"APP-30416","documents"); out.push("  home docs: "+docsFor().map(d=>d.k+":"+d.state).join(" "));});
go(null,null,"APP-30416","review");
flow("appSubmit",null,null,["credit officer"]);
// car, low income: declined by policy
step("car",()=>{INTAKE.decided=null; go(null,null,"APP-30416","loan"); $('[data-intake-product="car"]').click(); INTAKE.f.purpose="buy"; INTAKE.f.salary="15000"; INTAKE.f.variable="0"; INTAKE.f.hasCo="no"; INTAKE.f.hasGu="no"; go(null,null,"APP-30416","review");});
flow("appSubmit",null,null,["Outside credit policy"]);

// facility
go(null,null,"FAC-B2031");
flow("facReview");
flow("facDraw",null,null,["6.80%"]);
flow("covTest",null,null,["1.14x","Breached"]);
step("fac breach",()=>{render(); if(!$("#view").textContent.includes("Draw stop")) throw new Error("no draw stop");});
flow("facDraw");
flow("covWaiver",null,null,["Credit committee"]);
flow("facReview");
step("fac tabs after",()=>{for(const [tab] of RECS["FAC-B2031"].tabs) go(null,null,"FAC-B2031",tab);});
step("palette",()=>{openPalette(); $("#palInput").value="FAC"; renderPalette("FAC"); out.push("  palette: "+$("#palList").textContent.slice(0,120)); closeOverlays();});
step("presenter",()=>{const i=PRESENT.findIndex(p=>p[0]==="Commercial facilities"); if(i<0) throw new Error("no step"); PRESENT[i][2](); closeDialog();});
step("new btn",()=>{seenLists.add("lending/loans");go("lending","loans"); $('#view .head .btn.primary').click(); if(current.rec!=="APP-30416") throw new Error("new button went to "+current.rec);});

// ---- credit review and committee ----
for (const L of ["en","th"]) { lang=L;
  for (const rec of ["APP-30409","CC-2026-21"]) for (const [tab] of RECS[rec].tabs) step(L+" "+rec+"/"+tab,()=>go(null,null,rec,tab));
  ["credit","committee"].forEach(sec=>step(L+" lending/"+sec,()=>{seenLists.add("lending/"+sec);go("lending",sec);})); }
lang="en"; role=ROLES[0]; UW=UW0();
go(null,null,"APP-30409","decision");
flow("uwApprove",null,null,["Not ready to approve"]);
step("worksheet pct",()=>{go(null,null,"APP-30409","worksheet"); const before=uwCalc().dsr; const sel=$('[data-uw-pct="k3"]'); sel.value="0"; sel.dispatchEvent(new Event("change",{bubbles:true})); out.push("  DSR "+before.toFixed(1)+" -> "+uwCalc().dsr.toFixed(1)+"; history "+HISTORY["APP-30409"].length);});
step("mitigants",()=>{go(null,null,"APP-30409","policy"); for (const k of ["tenure","ltv"]) { const ta=$("#mit-"+k); ta.value="Policy TEN-02 / first home, joint borrowers"; ta.dispatchEvent(new Event("input",{bubbles:true})); ta.dispatchEvent(new Event("change",{bubbles:true})); } if(uwCalc().unmitigated.length) throw new Error("still unmitigated");});
go(null,null,"APP-30409","applicants");
flow("uwVerify");
role=ROLES.find(r=>r.id==="credit"); go(null,null,"APP-30409","decision");
flow("uwApprove",null,null,["Head of retail credit"]);
step("status pending",()=>{render(); out.push("  status: "+UW.status.label);});
step("reopen",()=>{$("[data-uw-reopen]").click(); if(UW.status) throw new Error("not reopened");});
flow("uwCounter",null,null,["Within your authority"]);
step("counter status",()=>{out.push("  status: "+UW.status.label);});
step("reopen2",()=>{go(null,null,"APP-30409","decision"); $("[data-uw-reopen]").click(); go(null,null,"APP-30409","worksheet"); const cb=$('[data-uw-debt="d3"]'); cb.checked=false; cb.dispatchEvent(new Event("change",{bubbles:true}));});
step("payoff cond default",()=>{openFlow("uwApprove"); const on=[...document.querySelectorAll("input[name=ucond]:checked")].map(x=>x.value); closeDialog(); if(!on.includes("payoff")) throw new Error("payoff not ticked: "+on);});
flow("uwDecline",null,null,["National Credit Bureau"]);
step("reopen3",()=>{go(null,null,"APP-30409","decision"); $("[data-uw-reopen]").click();});
flow("uwCommittee");
step("cc has item",()=>{if(!CC.items.some(x=>x.id==="APP-30409")) throw new Error("not on agenda"); go(null,null,"CC-2026-21","agenda");});
flow("ccVote",String(CC.items.findIndex(x=>x.id==="APP-30409")),null,["Approved"]);
step("uw after cc",()=>{out.push("  after committee: "+UW.status.label);});
COM.submitted=true;
flow("ccVote","0",null,["Approved"]);
step("conflict voters",()=>{out.push("  voters on item 0: "+ccVoters(CC.items[0]).map(m=>m[0]).join(", "));});
step("waiver not ready",()=>{go(null,null,"CC-2026-21","agenda"); out.push("  waiver item ready: "+ccReady(CC.items[1])+" (FAC.waiver="+FAC.waiver+")");});

// waiver lifts the draw stop (after the facility steps)
flow("ccVote","1",null,["draw stop is lifted"]);
step("draw stop lifted",()=>{if(facStop()) throw new Error("still stopped"); out.push("  FAC.waiver="+FAC.waiver);});
flow("facDraw",null,null,["6.80%"]);

// ---- collections ----
for (const L of ["en","th"]) { lang=L;
  for (const rec of ["LN-A-C11","LN-A-C14","R-A4"]) for (const [tab] of RECS[rec].tabs) step(L+" "+rec+"/"+tab,()=>go(null,null,rec,tab));
  ["overview","queue","promises","hardship","legal","repossessions","writeoffs","strategy"].forEach(sec=>step(L+" collections/"+sec,()=>{seenLists.add("collections/"+sec);go("collections",sec);}));
  step(L+" lending loans",()=>{seenLists.add("lending/loans");go("lending","loans");}); }
lang="en"; role=ROLES.find(r=>r.id==="collector");
step("malee numbers",()=>{out.push("  MAL dpd "+MAL.dpd+" due "+MAL.due+" principal "+MAL.principalOut+" npl "+fd(MAL.npl));});
go(null,null,"LN-A-C11","contact");
flow("colContact",null,()=>{$("#cout").value="noanswer";},["does not count"]);
flow("colContact",null,()=>{$("#cout").value="hardship";},["hardship assessment"]);
step("second rpc blocked",()=>{openFlow("colContact"); $("#cout").value="refused"; dialogAction("next"); if(dlg.step!==0||!dlg.error) throw new Error("not blocked"); out.push("  blocked: "+dlg.error.slice(0,60)); closeDialog();});
step("hardship live",()=>{go(null,null,"LN-A-C11","hardship"); const i=$("#hs-now"); i.value="15,000"; i.dispatchEvent(new Event("input",{bubbles:true})); out.push("  affordable @15k: "+hsCalc().affordable+" fits "+hsCalc().opts.filter(o=>o.fits).map(o=>o.k)); i.value="17,500"; i.dispatchEvent(new Event("input",{bubbles:true})); out.push("  affordable @17.5k: "+hsCalc().affordable+" opts "+hsCalc().opts.map(o=>o.k+":"+o.inst+(o.fits?"✓":"✗")).join(" "));});
step("promise flow",()=>{go(null,null,"LN-A-C11","promises");});
flow("colPromise",null,null,["Total promised"]);
step("promise bad date",()=>{openFlow("colPromise"); $("#pd0").value="2026-11-20"; dialogAction("next"); if(!dlg.error) throw new Error("no error"); out.push("  promise err: "+dlg.error); closeDialog();});
step("pick fit",()=>{const f=hsCalc().opts.find(o=>!o.fits); if(f){ openFlow("colRestructure",f.k); dialogAction("next"); const b=$("#dlgConfirm"); out.push("  unfit option blocked: "+(b&&b.disabled)); closeDialog(); }});
flow("colRestructure",hsCalc().opts.find(o=>o.fits).k,null,["Modification result"]);
step("accept",()=>{go(null,null,"LN-A-C11","restructure"); $("[data-mal-accept]").click(); if(!MALC.accepted) throw new Error("not accepted"); out.push("  "+$("#view .alert strong").textContent);});
role=ROLES.find(r=>r.id==="credit");
go(null,null,"LN-A-C14","legal");
flow("kitCourt");
flow("kitWriteOff",null,null,["New loss in income"]);
flow("kitRecover");
flow("kitSell",null,null,["Debt Collection Act"]);
step("kit after",()=>{go(null,null,"LN-A-C14","recovery"); out.push("  recoveries "+KIT.recoveries.length+" sold "+KIT.sold);});
role=ROLES[0];
go(null,null,"R-A4","notices");
flow("repoNotice");
flow("repoAuction",null,()=>{$("#hprice").value="48,000";},["Below the reserve"]);
step("not sold yet",()=>{if(REPO.sold) throw new Error("sold below reserve");});
flow("repoAuction",null,null,["Shortfall"]);
step("settlement",()=>{go(null,null,"R-A4","settlement"); out.push("  "+$("#view .quote").textContent.replace(/\s+/g," ").slice(0,200));});
step("auth table",()=>{go("admin","authorities"); if(!$("#view").textContent.includes("Write-offs and debt sales")) throw new Error("no row");});


// ---- approval to payout ----
for (const L of ["en","th"]) { lang=L; for (const [tab] of RECS["DSB-30409"].tabs) step(L+" DSB/"+tab,()=>go(null,null,"DSB-30409",tab)); step(L+" disbursements",()=>{seenLists.add("lending/disbursements");go("lending","disbursements");}); }
lang="en"; role=ROLES.find(r=>r.id==="credit"); DSB=DSB0();
go(null,null,"DSB-30409","payout");
flow("dsbPay",null,null,["Not ready to pay"]);
step("verify own blocked",()=>{go(null,null,"DSB-30409","conditions"); $('[data-cond="down"][data-cond-to="verified"]').click(); if(DSB.conds[0].state!=="received") throw new Error("verified by maker");});
step("ops verifies",()=>{role=ROLES.find(r=>r.id==="ops"); render(); $('[data-cond="down"][data-cond-to="verified"]').click(); if(DSB.conds[0].state!=="verified") throw new Error("not verified");});
step("receive payoff",()=>{$('[data-cond="payoff"][data-cond-to="received"]').click(); role=ROLES.find(r=>r.id==="credit"); render(); $('[data-cond="payoff"][data-cond-to="verified"]').click(); out.push("  payoff "+DSB.conds[1].state);});
step("receive juristic",()=>{$('[data-cond="juristic"][data-cond-to="received"]').click(); role=ROLES.find(r=>r.id==="ops"); render(); $('[data-cond="juristic"][data-cond-to="verified"]').click(); role=ROLES.find(r=>r.id==="credit"); render();});
step("verify spouse",()=>{role=ROLES.find(r=>r.id==="ops"); render(); $('[data-cond="spouse"][data-cond-to="verified"]').click(); role=ROLES.find(r=>r.id==="credit"); render(); if(DSB.conds.find(c=>c.k==="spouse").state!=="verified") throw new Error("spouse not verified");});
flow("dsbWaive","titlecheck",()=>{$("#wwhy").value="Search done 14 Oct; seller title clean";},["Within your authority"]);
flow("dsbRegister",null,null,["Do not register yet"]);
flow("dsbSend");
flow("dsbInsure");
flow("dsbRegister",null,null,["Records mortgage"]);
step("gate",()=>{out.push("  gate: "+JSON.stringify(dsbGate()));});
role=ROLES[0];
flow("dsbPay",null,null,["opens LN-77455"]);
step("paid",()=>{go(null,null,"DSB-30409","payout"); if(!DSB.paid) throw new Error("not paid"); out.push("  "+$("#view .alert strong").textContent);});
step("uw link",()=>{UW.status={tone:"good",label:"Approved",text:"x",sub:""}; go(null,null,"APP-30409","decision"); if(!$('[data-go="rec:DSB-30409"]')) throw new Error("no link"); UW=UW0();});


// ---- credit policy ----
for (const L of ["en","th"]) { lang=L; for (const [tab] of RECS["POL-RETAIL"].tabs) step(L+" POL/"+tab,()=>go(null,null,"POL-RETAIL",tab)); step(L+" products/policy",()=>{seenLists.add("products/policy");go("products","policy");}); }
lang="en"; UW=UW0(); role=ROLES.find(r=>r.id==="product");
const setPol=(path,v)=>{const el=document.querySelector(`[data-pol="${path}"]`); if(!el) throw new Error("no input "+path); el.value=v; el.dispatchEvent(new Event("input",{bubbles:true})); el.dispatchEvent(new Event("change",{bubbles:true}));};
step("before",()=>{out.push("  before: uw need "+uwCalc().need+" devs "+uwCalc().devs.map(d=>d.k)+"; hardship affordable "+hsCalc().affordable);});
step("loosen reg",()=>{go(null,null,"POL-RETAIL","reg"); setPol("reg.capHigh","6"); if(!polErrors().length) throw new Error("no error"); out.push("  reg error: "+polErrors()[0]); setPol("reg.capHigh","5");});
step("edit",()=>{go(null,null,"POL-RETAIL","authority"); setPol("levels.officer","2,500,000"); go(null,null,"POL-RETAIL","collateral"); setPol("ltvHome.1","95"); go(null,null,"POL-RETAIL","collections"); setPol("hardshipShare","60"); out.push("  changes: "+polChanges().length);});
step("impact",()=>{go(null,null,"POL-RETAIL","impact"); out.push("  impact: "+$("#view tbody").textContent.replace(/\s+/g," ").slice(0,220));});
flow("polSubmit",null,()=>{$("#pnote").value="Retain first-home buyers; align officer authority with average ticket";},["Approval rate"]);
step("self approve blocked",()=>{openFlow("polApprove"); dialogAction("next"); if(dlg.step!==0) throw new Error("maker approved"); out.push("  "+dlg.error.slice(0,60)); closeDialog();});
role=ROLES.find(r=>r.id==="credit");
flow("polApprove");
flow("polPublish",null,null,["Applies at once"]);
step("after",()=>{out.push("  after: v"+POLICY.version+" uw need "+uwCalc().need+" devs "+uwCalc().devs.map(d=>d.k)+"; hardship affordable "+hsCalc().affordable+"; LEVELS[0] "+LEVELS[0][2]); go(null,null,"APP-30409","policy"); go(null,null,"POL-RETAIL","changes");});


// ---- finance and month-end ----
for (const L of ["en","th"]) { lang=L; for (const rec of ["ECL-2026-10","REC-2026-10","DS-LOAN-2026-10"]) for (const [tab] of RECS[rec].tabs) step(L+" "+rec+"/"+tab,()=>go(null,null,rec,tab)); ["ecl","recon","reports","close","overview"].forEach(sec=>step(L+" finance/"+sec,()=>{seenLists.add("finance/"+sec);go("finance",sec);})); }
lang="en"; role=ROLES.find(r=>r.id==="finance");
step("ecl state",()=>{const c=eclRunCalc(); out.push("  loans: "+c.loans.map(l=>l.id+":S"+l.stage+":"+Math.round(l.ecl)).join(" ")); out.push("  required "+mn(c.required)+" held "+mn(c.held)+" topup "+mn(c.topup));});
step("severe",()=>{go(null,null,"ECL-2026-10","summary"); const s=$("#eclW"); s.value="severe"; s.dispatchEvent(new Event("change",{bubbles:true})); out.push("  severe required "+mn(eclRunCalc().required)); });
step("severe blocked",()=>{openFlow("eclRun"); dialogAction("next"); if(dlg.step!==0) throw new Error("posted severe"); closeDialog();});
step("back to board",()=>{const s=$("#eclW"); s.value="board"; s.dispatchEvent(new Event("change",{bubbles:true}));});
step("movement",()=>{go(null,null,"ECL-2026-10","movement"); out.push("  "+$("#view .quote").textContent.replace(/\s+/g," ").slice(0,330));});
flow("eclOverlay",null,()=>{$("#owhy").value="Rubber price fall, southern provinces"; $("#oev").value="Arrears 1-30 up 18% in Songkhla since Aug";},[]);
step("report before",()=>{go(null,null,"DS-LOAN-2026-10","validation"); out.push("  rules failing: "+rptRules().filter(r=>!r.ok).map(r=>r.k));});
step("fix same person refused",()=>{const r0=role; role=ROLES.find(r=>r.id==="finance"); const b=$("[data-rpt-fix]"); if(!b) return; const k=b.dataset.rptFix; b.click(); $("[data-rpt-fix]").click(); if(RPT.fix[k]) throw new Error("same person checked their own fix"); out.push("  proposed by "+RPT.prop[k]); role=r0; document.querySelectorAll(".toast").forEach(t=>t.remove());});
step("fix",()=>{const r0=role; let b,n=0; while((b=$("[data-rpt-fix]")) && n++<20){ const k=b.dataset.rptFix; role=ROLES.find(r=>r.id===(RPT.prop[k]&&RPT.prop[k]!=="ops"?"ops":"finance")); b.click(); render(); } role=r0; if($("[data-rpt-fix]")) throw new Error("fixes left"); document.querySelectorAll(".toast").forEach(t=>t.remove());});
step("close before",()=>{seenLists.add("finance/close"); go("finance","close"); out.push("  close: "+CLOSE.map(x=>x[0]+"="+((closeDone.has(x[0])?"done":finCloseState(x))||x[4])).join(" "));});
go(null,null,"ECL-2026-10","summary");
flow("eclRun",null,null,["Top-up to post"]);
go(null,null,"REC-2026-10","breaks");
flow("recExplain","accrual");
step("resolve suspense",()=>{resolvedExc.add(0);});
step("recon",()=>{out.push("  recon done "+recDone());});
go(null,null,"DS-LOAN-2026-10","validation");
flow("rptGenerate");
step("self submit blocked",()=>{openFlow("rptSubmit"); dialogAction("next"); if(dlg.step!==0) throw new Error("maker submitted"); closeDialog();});
role=ROLES.find(r=>r.id==="credit");
flow("rptSubmit");
step("close mark suspense",()=>{closeDone.add("suspense"); go("finance","close"); out.push("  close: "+CLOSE.map(x=>x[0]+"="+((closeDone.has(x[0])?"done":finCloseState(x))||x[4])).join(" "));});
flow("closeSignoff");
step("closed",()=>{go("finance","close"); if(!closeSent || closeDone.has("signoff")) throw new Error("sign-off should be with the CFO"); if(!$("#view").textContent.includes("With the CFO")) throw new Error("no CFO state");});


// ---- deposits ----
for (const L of ["en","th"]) { lang=L; for (const rec of ["ORD-26-0187","ORD-26-0191","ORD-26-0193","SAV-30988","TD-88102","TD-88201","STM-2026-10","SAV-C10"]) for (const [tab] of RECS[rec].tabs) step(L+" "+rec+"/"+tab,()=>go(null,null,rec,tab)); ["overview","accounts","opening","orders","dormant","term","interest","statements"].forEach(sec=>step(L+" deposits/"+sec,()=>{seenLists.add("deposits/"+sec);go("deposits",sec);})); }
lang="en"; role=ROLES[0];
go(null,null,"ORD-26-0191");
flow("ordVerify","ORD-26-0191");
flow("ordApply","ORD-26-0191");
step("self check blocked",()=>{openFlow("ordCheck","ORD-26-0191"); dialogAction("next"); if(dlg.step!==0) throw new Error("maker checked"); closeDialog();});
role=ROLES.find(r=>r.id==="credit");
flow("ordCheck","ORD-26-0191");
flow("ordCheck","ORD-26-0193");
step("orders",()=>{out.push("  orders: "+Object.entries(ORDST).map(([k,v])=>k+"="+v.state).join(" ")); go(null,null,"ORD-26-0191"); out.push("  "+$("#view .facts").textContent.replace(/\s+/g," ").slice(0,160));});
role=ROLES[0];
go(null,null,"SAV-30988");
flow("dormTrace"); flow("dormReactivate");
role=ROLES.find(r=>r.id==="finance"); flow("dormFee",null,null,["17,904"]); role=ROLES[0];
step("td calc",()=>{const a=tdCalc("TD-88102"), b=tdCalc("TD-88201"); out.push("  TD-88102 gross "+a.gross+" wht "+a.wht+" total "+a.total+"; TD-88201 total "+b.total+" vs HOME "+(HOME.td+HOME.tdInterest));});
go(null,null,"TD-88201");
flow("tdRoll","TD-88201",null,["LN-77120"]);
step("loan sees td",()=>{out.push("  HOME.tdToLoan "+HOME.tdToLoan+"; list instr "+tdInstrText(TDS["TD-88201"]));});
flow("tdRoll","TD-88102",()=>{$("#tterm").value="12";},["2.25%"]);
go(null,null,"STM-2026-10","exceptions");
step("stm fix",()=>{$("[data-stm-fix]").click();});
flow("stmRun");


// ---- onboarding: individual and business ----
for (const L of ["en","th"]) { lang=L; for (const rec of ["ONB-7731","AO-26-0412"]) for (const [tab] of RECS[rec].tabs) step(L+" "+rec+"/"+tab,()=>go(null,null,rec,tab)); }
lang="en"; role=ROLES[0];
const setO=(id,k,v)=>{const el=document.getElementById(`of-${id}-${k}`); if(!el) throw new Error("no field "+k+" on "+current.tab); if(el.type==="checkbox") el.checked=v; else el.value=v; el.dispatchEvent(new Event("input",{bubbles:true}));};
step("ind counts",()=>{const n=IND_CAT.reduce((a,s)=>a+s.fields.length,0), b=BIZ_CAT.reduce((a,s)=>a+s.fields.length,0); out.push("  fields: individual "+n+", business "+b+"; ind complete "+obComplete(OBF.ind).done+"/"+obComplete(OBF.ind).total+" risk "+obRisk(OBF.ind).score);});
go(null,null,"ONB-7731","review");
flow("obOpen","ind",null,["things to fix"]);
step("ind fill",()=>{go(null,null,"ONB-7731","personal"); go(null,null,"ONB-7731","work"); setO("ind","position","Customs clerk"); go(null,null,"ONB-7731","dd"); setO("ind","pep","no"); setO("ind","actingFor","self"); setO("ind","usPerson","no"); setO("ind","relatedBank","no"); go(null,null,"ONB-7731","consents"); for (const k of ["terms","fees","dpa"]) setO("ind",k,true); setO("ind","pdpaMarketing","no"); setO("ind","pdpaGroup","no"); setO("ind","pdpaPartners","no"); setO("ind","certify",true); const left=IND_STEPS.flatMap(([s])=>s==="review"?[]:obMissing(OBF.ind,s)).map(m=>m.x.k); out.push("  ind missing after fill: "+left);});
step("ind high risk",()=>{go(null,null,"ONB-7731","dd"); setO("ind","actingFor","other"); go(null,null,"ONB-7731","purpose"); setO("ind","intl","yes"); setO("ind","intlCountry","MM"); setO("ind","intlWhy","family"); out.push("  ind risk now "+obRisk(OBF.ind).score+" "+obRisk(OBF.ind).band[0]);});
step("ind back to low",()=>{go(null,null,"ONB-7731","dd"); setO("ind","actingFor","self"); go(null,null,"ONB-7731","purpose"); setO("ind","intl","no");});
step("ind validation",()=>{go(null,null,"ONB-7731","products"); setO("ind","product","current"); OBF.ind.st.checked=true; render(); const e=document.getElementById("of-ind-product-e"); out.push("  current check: "+(e&&e.textContent)); setO("ind","product","sav");});
step("ind foreign",()=>{go(null,null,"ONB-7731","identity"); setO("ind","docType","passport"); out.push("  passport fields: "+["passportNo","visaType","citizenId"].map(k=>k+":"+!!document.getElementById("of-ind-"+k)).join(" ")); setO("ind","docType","thai-id");});
go(null,null,"ONB-7731","review");
flow("obOpen","ind",null,["Low"]);
step("ind opened",()=>{render(); out.push("  "+$("#view .alert").textContent.slice(0,140));});
go(null,null,"AO-26-0412","review");
flow("obOpen","biz",null,["things to fix"]);
step("biz fill",()=>{go(null,null,"AO-26-0412","documents"); setO("biz","docUboIds",true); go(null,null,"AO-26-0412","people"); setO("biz","dir2Kyc","branch"); go(null,null,"AO-26-0412","owners"); setO("biz","ubo2Wealth","Owner of a Hong Kong trading firm since 2004; audited accounts"); go(null,null,"AO-26-0412","dd"); setO("biz","screening","cleared"); setO("biz","nearNote","Different date of birth and nationality"); go(null,null,"AO-26-0412","consents"); for (const k of ["terms","ownersTrue","pdpa","certify"]) setO("biz",k,true); const left=BIZ_STEPS.flatMap(([s])=>s==="review"?[]:obMissing(OBF.biz,s)).map(m=>m.x.k); out.push("  biz missing: "+left+" cross: "+bizCross(OBF.biz.st.f)+" risk "+obRisk(OBF.biz).score+" "+obRisk(OBF.biz).band[0]);});
step("biz cross",()=>{go(null,null,"AO-26-0412","owners"); setO("biz","sh3Pct","15"); out.push("  cross: "+bizCross(OBF.biz.st.f)); setO("biz","sh3Pct","5");});
go(null,null,"AO-26-0412","review");
flow("obOpen","biz",null,["head of business banking"]);
step("biz pep",()=>{OBF.biz.st.state=null; go(null,null,"AO-26-0412","owners"); setO("biz","ubo2Pep","yes"); out.push("  biz with PEP: "+obRisk(OBF.biz).score+" "+obRisk(OBF.biz).band[0]);});
go(null,null,"AO-26-0412","review");
flow("obOpen","biz",null,["compliance"]);
step("lists",()=>{seenLists.add("deposits/opening"); go("deposits","opening"); seenLists.add("customers/onboarding"); go("customers","onboarding");});

// commercial credit
CC.items[0].state=null; COM.submitted=false;
flow("ccVote","0",null,["Not on the agenda yet"]);
for (const L of ["en","th"]) { lang=L; role=ROLES.find(r=>r.id==="credit"); for (const [tab] of RECS["APP-30414"].tabs) step(L+" APP-30414/"+tab,()=>go(null,null,"APP-30414",tab)); }
lang="en";
step("com base",()=>{const p=project(COM.stress,false),s=project(),r=rating(),q=raroc(),c=comCover(); out.push("  base min "+p.min.toFixed(2)+" stressed "+s.min.toFixed(2)+" grade "+r.grade+" pd "+r.pd+" rate "+q.rate.toFixed(2)+" raroc "+q.raroc.toFixed(1)+" cover "+c.pct.toFixed(0)+" | "+spread().map(x=>x.y+" ebitda "+x.ebitda.toFixed(1)+" de "+x.de.toFixed(2)+" cr "+x.cr.toFixed(2)+" ic "+x.ic.toFixed(1)).join("; "));});
step("com adj off",()=>{go(null,null,"APP-30414","financials"); const cb=$('[data-com-adj="oneoff"]'); cb.checked=false; cb.dispatchEvent(new Event("change",{bubbles:true})); out.push("  oneoff off FY24 ebitda "+spread()[1].ebitda.toFixed(1)); cb.checked=true; $('[data-com-adj="oneoff"]').dispatchEvent(new Event("change",{bubbles:true}));});
step("com stress slider",()=>{go(null,null,"APP-30414","capacity"); const r=$('[data-com-stress="rev"]'); r.value="25"; r.dispatchEvent(new Event("input",{bubbles:true})); out.push("  rev -25%: "+$("#comStressOut").textContent); r.value="5"; r.dispatchEvent(new Event("input",{bubbles:true}));});
step("com qual",()=>{go(null,null,"APP-30414","rating"); const s=$('[data-com-qual="mgmt"]'); s.value="1"; s.dispatchEvent(new Event("change",{bubbles:true})); out.push("  mgmt 1 grade "+rating().grade+" rate "+raroc().rate.toFixed(2)); s.value="4"; $('[data-com-qual="mgmt"]').dispatchEvent(new Event("change",{bubbles:true}));});
COM.stress.rev=30; COM.stress.margin=4; COM.stress.rate=4;
flow("comSubmit",null,null,["Outside policy"]);
COM.stress.rev=5; COM.stress.margin=0.5; COM.stress.rate=1;
flow("comSubmit",null,null,["agenda"]);
step("com drawdowns closed",()=>{go(null,null,"APP-30414","drawdowns"); if(!$("#view").textContent.includes("committee approves")) throw new Error("open before approval");});
go(null,null,"CC-2026-21","agenda");
flow("ccVote","0",null,["Approved"]);
go(null,null,"APP-30414","drawdowns");
role=ROLES[0];
for (const i of ["0","1","2","3"]) { go(null,null,"APP-30414","drawdowns"); flow("comDraw",i,null,["Undrawn loan left"]); }
step("com drawn",()=>{go(null,null,"APP-30414","drawdowns"); out.push("  draws "+COM.draws.join(",")+" | "+$("#view .card-sub").textContent.slice(0,40));});
step("com memo",()=>{go(null,null,"APP-30414","memo"); out.push("  "+$("#view .card-body").textContent.slice(0,300));});

// commercial banking
for (const L of ["en","th"]) { lang=L; role=ROLES.find(r=>r.id==="credit"); tenant=TENANTS.find(x=>x.id==="retail");
  for (const rec of ["B-0414","EW-B3107"]) for (const [tab] of RECS[rec].tabs) step(L+" "+rec+"/"+tab,()=>go(null,null,rec,tab));
  step(L+" lending/monitoring",()=>go("lending","monitoring")); step(L+" customers/directory",()=>{seenLists.add("customers/directory");go("customers","directory");});
  tenant=TENANTS.find(x=>x.id==="commercial");
  for (const rec of ["LC-26-0412","BG-26-1108"]) for (const [tab] of RECS[rec].tabs) step(L+" "+rec+"/"+tab,()=>go(null,null,rec,tab));
  step(L+" trade/guarantees",()=>{seenLists.add("trade/guarantees");go("trade","guarantees");});
}
lang="en"; tenant=TENANTS.find(x=>x.id==="retail"); role=ROLES[0];
go(null,null,"B-0414","contacts");
flow("kiCall",null,()=>{$("#kcw").value="Agreed year-end stock plan"; $("#kcn").value="Send the increase request";},["relationship timeline"]);
step("ki call listed",()=>{go(null,null,"B-0414","contacts"); if(!$("#view").textContent.includes("Agreed year-end")) throw new Error("call missing");});
role=ROLES.find(r=>r.id==="credit");
flow("kiExcess",null,null,["46,000,000"]);
step("ki facts",()=>{go(null,null,"B-0414","exposure"); out.push("  KI: "+[...document.querySelectorAll(".fact")].map(f=>f.textContent).join(" | ").slice(0,400));});
step("ki calendar",()=>{go(null,null,"B-0414","calendar"); out.push("  cal: "+$("#panel tbody").textContent.slice(0,200));});
go(null,null,"EW-B3107","signals");
step("ew score",()=>{out.push("  score "+ewScore()+" "+ewBand()[1]); const c=$('[data-ew-sig="5"]'); c.checked=true; c.dispatchEvent(new Event("change",{bubbles:true})); out.push("  after explain "+ewScore()); const c2=$('[data-ew-sig="5"]'); c2.checked=false; c2.dispatchEvent(new Event("change",{bubbles:true}));});
step("ew plan",()=>{go(null,null,"EW-B3107","plan"); const c=$('[data-ew-act="0"]'); c.checked=true; c.dispatchEvent(new Event("change",{bubbles:true})); out.push("  done "+EW.done.size);});
flow("ewClassify",null,()=>{$("#ewc").value="monitor"; $("#eww").value="test";},["Against the score"]);
EW.cls=null;
flow("ewClassify",null,()=>{$("#eww").value="Lost customer, OD hardcore, cheques returned";},["792,000"]);
flow("ewFreeze");
step("monitoring after",()=>{go("lending","monitoring"); out.push("  "+$("#view .facts").textContent);});
tenant=TENANTS.find(x=>x.id==="commercial"); role=ROLES[0];
go(null,null,"LC-26-0412","examine");
step("lc flip",()=>{const c=$('[data-lc-chk="7"]'); c.checked=true; c.dispatchEvent(new Event("change",{bubbles:true})); out.push("  disc after flip "+lcDisc().length+" payable "+lcPayable()); const c2=$('[data-lc-chk="7"]'); c2.checked=false; c2.dispatchEvent(new Event("change",{bubbles:true}));});
flow("lcRefuse",null,null,["77J","INSURANCE CERTIFICATE"]);
LCS.decision=null;
flow("lcWaiver",null,null,["30 Oct"]);
flow("lcAnswer",null,null,["discrepancy fee"]);
go(null,null,"LC-26-0412","settle");
flow("lcSettle",null,()=>{$("#lhow").value="debit";},["Not enough"]);
flow("lcSettle",null,null,["TR-26-0412","77,900,04"]);
step("lc settled",()=>{go(null,null,"LC-26-0412","settle"); out.push("  "+$("#panel").textContent.slice(0,240));});
go(null,null,"BG-26-1108","demand");
flow("bgDecide",null,null,["Tell the applicant first"]);
flow("bgNotify");
flow("bgDecide",null,null,["2,850,000"]);
step("bg list",()=>{go("trade","guarantees"); out.push("  "+$("#view tbody").textContent.slice(0,200));});
tenant=TENANTS.find(x=>x.id==="retail"); role=ROLES[0];

// prototype fixes P1, P6, P7, P12
step("P1 credit authority",()=>{const r0=role; role=ROLES.find(r=>r.id==="credit"); const a=authCheck("credit",1500000), b=authCheck("credit",5000000), c=authCheck("credit",20000000); role=ROLES.find(r=>r.id==="ops"); const d=authCheck("credit",500000); role=r0; out.push("  P1 "+[a.ok,b.second,c.second,d.second].join(" | ")); if(!a.ok||b.second!=="Head of retail credit"||c.second!=="Credit committee"||d.second!=="Credit officer") throw new Error("credit routing");});
tenant=TENANTS.find(x=>x.id==="commercial"); role=ROLES[0];
go(null,null,"BG-26-1102","claims");
flow("bgAmend",null,null,["URDG 758"]);
step("P6 claim too big",()=>{openFlow("bgClaim"); $("#bgca").value="13,000,000"; dialogAction("next"); if(dlg.step!==0||!dlg.error) throw new Error("no error"); closeDialog();});
flow("bgClaim",null,null,["five business days"]);
step("P6 claims tab",()=>{go(null,null,"BG-26-1102","claims"); out.push("  "+$("#view .pills").textContent+" | "+$("#panel").textContent.slice(0,80));});
tenant=TENANTS.find(x=>x.id==="retail"); role=ROLES[0];
step("P7 queue and fees",()=>{out.push("  pyOther "+pyOther()+" released "+PAYQ.py.released+" queue "+payQueue().map(r=>r[1].replace(/<[^>]+>/g,"")).join(","));});
step("P12 monitoring",()=>{go("lending","monitoring"); out.push("  "+$("#view .facts").textContent);});

const pre=document.createElement("pre"); pre.id="testout"; pre.textContent="ERRORS:"+errs.length+"\n"+errs.join("\n")+"\n---\n"+out.join("\n"); document.body.appendChild(pre);
})();

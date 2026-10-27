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
  const btn=$("#dlgConfirm"); if(btn&&btn.disabled&&!btn.dataset.typed) {out.push("  (blocked) "+name+": "+$("#dialogHost .dlg-body").textContent.slice(0,180)); closeDialog(); return;}
  dialogAction("confirm"); if(dlg.step!==2) throw new Error("not done");
  out.push("  done "+name+": "+$("#dialogHost .dlg-body strong").textContent);
  closeDialog();
});
const err=(name,setup,want)=>step("err "+name,()=>{openFlow(name); setup(); dialogAction("next"); if(dlg.step!==0||!dlg.error.includes(want)) throw new Error("expected error "+want+" got "+dlg.error); out.push("  err "+name+": "+dlg.error); closeDialog();});
const pages=["counter","drawer","vault","bqueue","eod"];
for (const L of ["en","th"]) for (const r of ["teller","ops","manager"]) { lang=L; role=ROLES.find(x=>x.id===r); pages.forEach(p=>step(`${L} ${r} branch/${p}`,()=>{seenLists.add("branch/"+p); go("branch",p);})); }
lang="en";
step("sections",()=>out.push("  "+sysById.branch.sections.map(s=>s[0]).join(",")));
step("start",()=>out.push("  cash "+brCash()+" vault "+brVaultNow()));
role=ROLES.find(x=>x.id==="teller");
go("branch","counter");
// large withdrawal: ID required, scam blocked, teller sends to manager, ops pays with top-up
err("brBigOut",()=>{$("#bwid").checked=false;},"ID card");
flow("brBigOut",null,()=>{$("#bwid").checked=true; $("#bwwhy").value="told";},["Possible scam"]);
flow("brBigOut",null,()=>{$("#bwid").checked=true;},["Top-up from the vault first","Needs a second approver"]);
step("pending out",()=>{go("branch","counter"); if(!BR.pendingOut) throw new Error("no pending"); out.push("  "+$("#view").textContent.match(/Withdrawal ฿650,000[^.]*/)[0]);});
role=ROLES.find(x=>x.id==="manager");
flow("brBigOut",null,()=>{$("#bwid").checked=true;},["Within your authority"]);
step("after withdrawal",()=>out.push("  cash "+brCash()+" pending "+BR.pendingOut));
// large deposit: source required, CTR + structuring, teller -> manager, ops accepts
role=ROLES.find(x=>x.id==="teller");
err("brBigIn",()=>{$("#biid").checked=true;},"Say where");
flow("brBigIn",null,()=>{$("#bisrc").value="Week's takings from 3 shops"; $("#biid").checked=true;},["Cash transaction report","Possible structuring","Needs a second approver"]);
role=ROLES.find(x=>x.id==="manager");
flow("brBigIn",null,()=>{$("#bisrc").value="Week's takings from 3 shops"; $("#biid").checked=true;},["Possible structuring"]);
step("over limit",()=>{go("branch","counter"); if(!$("#view").textContent.includes("over its ฿500,000 limit")) throw new Error("no over-limit notice"); out.push("  cash "+brCash());});
// vault: self is refused; sell the excess
err("brVault",()=>{$("#brsec").value="self";},"Dual control");
flow("brVault",null,null,["To the vault"]);
step("after vault",()=>out.push("  cash "+brCash()+" vault "+brVaultNow()));
flow("brFake",null,null,["CF-26-1024-01"]);
// end of day: sell back blocked before count; count short 100; diff approval teller -> pending, ops approves
role=ROLES.find(x=>x.id==="teller");
flow("brSellBack",null,null,["does not balance"]);
err("brCount",()=>{$("#bcwhy").value="";},"explain");
flow("brCount",null,()=>{$("#bcwhy").value="Probably paid ฿100 too much in change at 12:31";},["Short","GL 1990"]);
flow("brDiff",null,null,["GL 1990","Needs a second approver"]);
step("diff pending",()=>{if(BR.diff.state!=="pending") throw new Error("approved by teller");});
flow("brVaultCount",null,null,["still out"]);
flow("brClose",null,null,["Not ready"]);
role=ROLES.find(x=>x.id==="manager");
flow("brDiff",null,null,["Within your authority"]);
flow("brSellBack",null,null,["sealed bags"]);
flow("brVaultCount",null,()=>{$("#bvcamt").value="1,000";},["short"]);
flow("brVaultCount",null,null,["Difference"]);
flow("brClose",null,null,["checklist is not finished"]);
step("checklist",()=>{go("branch","eod"); for (const k of BR_CHECKS.map(c=>c[0])) { const c=$(`[data-br-chk="${k}"]`); c.checked=true; c.dispatchEvent(new Event("change",{bubbles:true})); } out.push("  checks "+BR.chk.size);});
role=ROLES.find(x=>x.id==="teller");
flow("brClose",null,null,["Needs a second approver"]);
role=ROLES.find(x=>x.id==="manager");
flow("brClose",null,null,["Closes branch 0123"]);
step("closed",()=>{go("branch","eod"); out.push("  "+$("#view .alert").textContent.slice(0,80)+" | "+$("#view .list").textContent.slice(0,300));});
for (const L of ["en","th"]) { lang=L; pages.forEach(p=>step(`${L} after branch/${p}`,()=>go("branch",p))); }
lang="en";
step("drawer after",()=>{go("branch","drawer"); out.push("  "+$("#view .facts").textContent);});
step("vault after",()=>{go("branch","vault"); out.push("  "+$("#view .facts").textContent);});
const pre=document.createElement("pre"); pre.id="testout"; pre.textContent="ERRORS:"+errs.length+"\n"+errs.join("\n")+"\n---\n"+out.join("\n"); document.body.appendChild(pre);
})();

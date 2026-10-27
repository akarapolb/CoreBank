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
tenant=TENANTS.find(x=>x.id==="commercial");
for (const L of ["en","th"]) { lang=L; role=ROLES.find(r=>r.id==="finance");
  step(L+" treasury/overview",()=>go("treasury","overview"));
  for (const sec of ["liquidity","alm","deals","fx","nostro"]) step(L+" treasury/"+sec,()=>{seenLists.add("treasury/"+sec);go("treasury",sec);});
  for (const rec of ["LCR-2026-10","ALM-2026-10","FX-26-10-0918","NOS-EUR-01"]) for (const [tab] of RECS[rec].tabs) step(L+" "+rec+"/"+tab,()=>go(null,null,rec,tab));
}
lang="en";
step("lcr base",()=>{const c=lcrCalc(1); out.push("  LCR "+c.ratio.toFixed(1)+" hqla "+c.hqla.toFixed(2)+" out "+c.out.toFixed(2)+" in "+c.capped.toFixed(2)+" net "+c.net.toFixed(2)+" warn@"+lcrAt(120)+" breach@"+lcrAt(100));});
step("lcr slider",()=>{go(null,null,"LCR-2026-10","stress"); const r=$("[data-lcr-mult]"); r.value="2"; r.dispatchEvent(new Event("input",{bubbles:true})); out.push("  x2: "+$("#lcrStressOut").textContent.slice(0,220));});
flow("cfpInvoke",null,()=>{$("#cfps").value="act";},["20.0"]);
step("alm",()=>{const w=almWorst(100); out.push("  NII "+w.nii.toFixed(3)+" ("+w.niiPct.toFixed(1)+"%) EVE "+w.eve.toFixed(2)+" ("+w.evePct.toFixed(1)+"%)"); go(null,null,"ALM-2026-10","sensitivity"); const r=$("[data-alm-shock]"); r.value="200"; r.dispatchEvent(new Event("input",{bubbles:true})); out.push("  +200: "+$("#almOut").textContent);});
step("fx facts",()=>{go(null,null,"FX-26-10-0918","deal"); out.push("  "+$("#view .facts").textContent.slice(0,300));});
flow("fxResolve",null,()=>{$("#fxw").value="theirs";},["recording"]);
flow("fxResolve",null,null,["MT399"]);
flow("fxResolve",null,null,["both legs"]);
step("fx matched",()=>{go(null,null,"FX-26-10-0918","confirm"); if(FXD.cover!=="matched") throw new Error("not matched");});
role=ROLES.find(r=>r.id==="ops");
flow("nosMatch");
flow("nosPost",null,null,["Someone other"]);
flow("nosApprove",null,null,["You prepared"]);
role=ROLES.find(r=>r.id==="finance");
flow("nosApprove",null,null,["46,980.00"]);
step("nos done",()=>{go(null,null,"NOS-EUR-01","lines"); out.push("  "+$("#view .pills").textContent+" | "+$("#view .facts").textContent.slice(0,160));});
step("overview after",()=>{go("treasury","overview"); out.push("  "+$("#view .facts").textContent);});
step("th overview after",()=>{lang="th"; go("treasury","overview"); lang="en";});
const pre=document.createElement("pre"); pre.id="testout"; pre.textContent="ERRORS:"+errs.length+"\n"+errs.join("\n")+"\n---\n"+out.join("\n"); document.body.appendChild(pre);
})();

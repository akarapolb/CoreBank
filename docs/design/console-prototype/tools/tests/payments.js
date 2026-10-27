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
role=ROLES[0];
for (const L of ["en","th"]) { lang=L;
  step(L+" payments/overview",()=>go("payments","overview"));
  for (const sec of ["transfers","batches","standing","recalls","held","promptpay","limits"]) step(L+" payments/"+sec,()=>{seenLists.add("payments/"+sec);go("payments",sec);});
  for (const rec of ["TR-9918231","TR-9918203","PAY-26-10-0414","RCL-26-1024-03"]) for (const [tab] of RECS[rec].tabs) step(L+" "+rec+"/"+tab,()=>go(null,null,rec,tab));
}
lang="en";
step("overview facts",()=>{go("payments","overview"); out.push("  "+$("#view .facts").textContent); out.push("  sections "+sysById.payments.sections.map(s=>s[0]).join(","));});
go(null,null,"TR-9918231");
flow("bnApprove",null,null,["Call-back first"]);
flow("bnCallback");
role=ROLES.find(r=>r.id==="credit");
flow("bnApprove",null,null,["You entered"]);
role=ROLES[0];
flow("bnApprove",null,null,["31,850,000.00","Within your authority"]);
go(null,null,"TR-9918203");
flow("swSend",null,()=>{$("#swpur").value="318004";},["Screening is not cleared"]);
flow("swClear");
step("purpose required",()=>{openFlow("swSend"); dialogAction("next"); if(dlg.step!==0||!dlg.error) throw new Error("no error"); out.push("  err: "+dlg.error); closeDialog();});
flow("swSend",null,()=>{$("#swsrc").value="thb"; $("#swch").value="OUR"; $("#swpur").value="318004";},["8,659,200.00","318004"]);
flow("swSend",null,()=>{$("#swch").value="OUR"; $("#swpur").value="318004";},["FCD-B2031 · $240,000.00"]);
step("sw tracker",()=>{go(null,null,"TR-9918203","tracker"); out.push("  "+$("#panel").textContent.slice(0,200));});
go(null,null,"PAY-26-10-0414");
step("py initial",()=>out.push("  items "+pyItems()+" total "+pyTotal()));
step("py include closed",()=>{go(null,null,"PAY-26-10-0414","exceptions"); const c=$('[data-py-ex="3"]'); c.checked=false; c.dispatchEvent(new Event("change",{bubbles:true}));});
flow("pyRelease",null,null,["Rows that cannot be paid"]);
step("py exclude all bad",()=>{for (const i of [3,1]) {const c=$(`[data-py-ex="${i}"]`); c.checked=true; c.dispatchEvent(new Event("change",{bubbles:true}));} out.push("  items "+pyItems()+" total "+pyTotal());});
flow("pyRelease",null,null,["Today"]);
go(null,null,"RCL-26-1024-03");
flow("rcSend");
flow("rcOutcome",null,null,["SAV-40218"]);
step("overview after",()=>{go("payments","overview"); out.push("  "+$("#view .card-body.flush").textContent.slice(0,10)); });
lang="th"; step("th overview after",()=>go("payments","overview")); step("th rc",()=>go(null,null,"RCL-26-1024-03","process")); lang="en";
const pre=document.createElement("pre"); pre.id="testout"; pre.textContent="ERRORS:"+errs.length+"\n"+errs.join("\n")+"\n---\n"+out.join("\n"); document.body.appendChild(pre);
})();

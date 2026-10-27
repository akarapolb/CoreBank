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
  const btn=$("#dlgConfirm"); if(btn&&btn.disabled&&!btn.dataset.typed) {out.push("  (blocked) "+name+": "+$("#dialogHost .dlg-body").textContent.slice(0,200)); closeDialog(); return;}
  dialogAction("confirm"); if(dlg.step!==2) throw new Error("not done");
  out.push("  done "+name+": "+$("#dialogHost .dlg-body strong").textContent);
  closeDialog();
});
tenant=TENANTS.find(x=>x.id==="retail");
for (const L of ["en","th"]) { lang=L; role=ROLES[0];
  for (const rec of ["HPQ-26-1031","HP-2025-004812","O1","DLR-1"]) for (const [tab] of RECS[rec].tabs) step(L+" "+rec+"/"+tab,()=>go(null,null,rec,tab));
  for (const sec of ["overview","leases","hp","quotes","books","ends","dealers"]) step(L+" leasing/"+sec,()=>{seenLists.add("leasing/"+sec);go("leasing",sec);});
}
lang="en"; role=ROLES.find(r=>r.id==="credit");
go(null,null,"HPQ-26-1031","quote");
step("hpq calc",()=>{const c=hpqCalc(); out.push("  fin "+c.fin+" inst "+c.inst+" total "+c.total+" eff "+c.eff.toFixed(2)+" dsr "+c.dsr.toFixed(1)+" subsidy "+c.subsidy+" pay "+c.pay+" comm "+c.commission);});
flow("hpqTerms",null,()=>{$("#qflat").value="6.1";},["Above the cap"]);
flow("hpqTerms",null,()=>{$("#qterm").value="72";},["Effective rate"]);
step("after terms",()=>{out.push("  term "+HPQ.term+" eff "+hpqCalc().eff.toFixed(2)); HPQ.term=60;});
flow("hpqApprove",null,null,["Approves"]);
step("contract tab",()=>{go(null,null,"HPQ-26-1031","contract"); if(!$("#panel").textContent.includes("disclosure")&&!$("#panel").textContent.includes("Disclosure")) throw new Error("no disclosure");});
step("sign needs ack",()=>{openFlow("hpqSign"); dialogAction("next"); if(dlg.step!==0||!dlg.error) throw new Error("no error"); out.push("  err: "+dlg.error); closeDialog();});
flow("hpqSign",null,()=>{$("#qdisc").checked=true;},["e-signature"]);
role=ROLES[0];
flow("hpqPay",null,null,["Paid now"]);
for (let i=0;i<3;i++) flow("hpqBook");
step("hpq book",()=>{go(null,null,"HPQ-26-1031","book"); out.push("  "+$("#panel").textContent.slice(0,260)); go("leasing","books"); out.push("  books: "+$("#view tbody").textContent.slice(0,200));});
go(null,null,"HP-2025-004812","servicing");
flow("hpIns",null,null,["beneficiary"]);
flow("hpReg",null,null,["DLT"]);
go(null,null,"HP-2025-004812","settle");
flow("hpSettle",null,()=>{ if($("#hfrom")) $("#hfrom").value=$("#hfrom").options[0].value; },null);
step("hp book after settle",()=>{go(null,null,"HP-2025-004812","book"); out.push("  "+$("#view .pills").textContent+" | "+$("#panel").textContent.slice(0,200));});
flow("hpRelease",null,null,["at the DLT"]);
HPX.reg=null;
flow("hpRelease",null,null,["power of attorney"]);
go(null,null,"O1","inspection");
step("o1 charges",()=>{out.push("  charges "+JSON.stringify(o1Charges())); const c=$('[data-o1-dmg="3"]'); c.checked=false; c.dispatchEvent(new Event("change",{bubbles:true})); out.push("  after dispute "+JSON.stringify(o1Charges()));});
step("o1 accounting",()=>{go(null,null,"O1","accounting"); out.push("  "+$("#panel").textContent.slice(0,300));});
flow("leEnd",null,()=>{$("#lech").value="return"; $("#legw").value="8,000";},["auction","second approver"]);
flow("leEnd",null,()=>{$("#lech").value="extend";},["31 Oct 2027"]);
O1.choice=null;
flow("leEnd",null,null,["735,000"]);
go(null,null,"DLR-1","clawback");
step("dlr",()=>{out.push("  "+JSON.stringify(dlrRun()));});
flow("dlrRun",null,null,["50 Tawi"]);
step("dlr after",()=>{go(null,null,"DLR-1","clawback"); go(null,null,"DLR-1","scorecard"); go(null,null,"DLR-1","lines");});
lang="th"; step("th HPQ after",()=>{go(null,null,"HPQ-26-1031","payout"); go(null,null,"O1","options"); go(null,null,"HP-2025-004812","book");}); lang="en";
const pre=document.createElement("pre"); pre.id="testout"; pre.textContent="ERRORS:"+errs.length+"\n"+errs.join("\n")+"\n---\n"+out.join("\n"); document.body.appendChild(pre);
})();

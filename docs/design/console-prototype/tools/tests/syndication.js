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
tenant=TENANTS.find(x=>x.id==="commercial"); role=ROLES[0];
const tabsAll=(L)=>{ for (const [tab] of RECS["SYN-001"].tabs) step(L+" SYN-001/"+tab,()=>go(null,null,"SYN-001",tab)); for (const [sec] of sysById.syndication.sections) step(L+" syndication/"+sec,()=>{seenLists.add("syndication/"+sec); go("syndication",sec);}); };
for (const L of ["en","th"]) { lang=L; tabsAll(L); }
lang="en";
step("numbers",()=>{const th=syThor(); out.push("  THOR "+th.comp.toFixed(4)+" allin "+th.allIn.toFixed(4)+" days "+th.days+" interest "+th.interest+" | due "+syDue().map(d=>d[0]+"="+d[3]).join(", ")+" | count "+JSON.stringify(syCount()));});
go(null,null,"SYN-001","votes");
flow("synCountVote",null,null,["Not passed"]);
flow("synVote",null,()=>{$("#svl").value="bbl"; $("#svv").value="yes";},["66⅔%"]);
step("count after bbl",()=>{const c=syCount(); out.push("  pct "+c.pct.toFixed(2)+" passes "+c.passes+" ifCounted "+c.ifCounted.toFixed(2));});
flow("synCountVote",null,null,["Declare"]);
step("covenant amended",()=>{go(null,null,"SYN-001","facility"); if(!$("#view").textContent.includes("4.0×")) throw new Error("no amendment");});
go(null,null,"SYN-001","transfers");
flow("synRegister",null,null,["KYC not complete"]);
flow("synKyc",null,()=>{for(let i=0;i<4;i++) $("#sk"+i).checked=true;},["4 of 4"]);
flow("synRegister",null,null,["12% → 8%"]);
step("register after",()=>{go(null,null,"SYN-001","lenders"); out.push("  lenders "+syLenders().map(l=>l[0]+":"+l[3]).join(","));});
go(null,null,"SYN-001","drawdowns");
flow("synNotice",null,null,["ICBC"]);
go(null,null,"SYN-001","payments");
flow("synDistribute",null,()=>{$("#sda").value="100,000,000.00";},["A short payment"]);
SY.paid=null;
flow("synDistribute",null,null,["Andaman"]);
step("distributed",()=>{go(null,null,"SYN-001","payments"); out.push("  "+$("#panel").textContent.slice(0,300));});
role=ROLES.find(r=>r.id==="credit");
step("credit role distribute",()=>{SY.paid=null; openFlow("synDistribute"); dialogAction("next"); out.push("  credit: "+$("#dialogHost .auth").textContent.slice(0,120)); closeDialog();});
role=ROLES[0];
for (const L of ["en","th"]) { lang=L; tabsAll(L+" after"); }
lang="en";
step("overview facts",()=>{go("syndication","overview"); out.push("  "+$("#view .facts").textContent);});
const pre=document.createElement("pre"); pre.id="testout"; pre.textContent="ERRORS:"+errs.length+"\n"+errs.join("\n")+"\n---\n"+out.join("\n"); document.body.appendChild(pre);
})();

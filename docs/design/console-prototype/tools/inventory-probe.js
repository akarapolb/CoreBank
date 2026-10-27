(function(){ finishSignin(); lang="en";
const d={ recs:Object.entries(RECS).map(([id,r])=>({id,sys:r.sys,sec:r.sec,kind:r.kind,tabs:(r.tabs||[]).map(x=>x[1])})),
 flows:Object.keys(FLOWS), actions:ACTIONS, auth:AUTH, roles:ROLES.map(r=>({id:r.id,name:r.name,title:r.title})),
 systems:SYS.map(s=>({id:s.id,name:s.name,sections:s.sections.map(x=>x[1])})), tenants:TENANTS.map(t=>({id:t.id,name:t.name,systems:t.systems})) };
const pre=document.createElement("pre"); pre.id="inv"; pre.textContent=JSON.stringify(d); document.body.appendChild(pre); })();

(function(){ const out=[], errs=[]; window.addEventListener("error",e=>errs.push(e.message));
finishSignin(); presenting=true;
PRESENT.forEach((p,i)=>{ try { p[2](); const h=document.body.innerHTML; const bad=(h.match(/undefined|NaN|\[object Object\]/g)||[]); out.push(`${i+1}. [${p[3]}] ${p[0]} → ${current.rec||current.sys+"/"+current.sec} · ${tenant.id} · ${role.id} · ${lang}${dlg?" · dialog":""}${side?" · "+side:""}${bad.length?" BAD:"+bad[0]:""}`); } catch(e){ errs.push(i+" "+p[0]+": "+e.message); } });
finishSignin(); lang="en"; presentExec=true; renderPresenter(); const execList=[...document.querySelectorAll(".presenter li button")].map(b=>b.textContent.trim());
presentExec=false; renderPresenter(); const chaps=[...document.querySelectorAll(".presenter li.chap")].map(c=>c.textContent);
const pre=document.createElement("pre"); pre.id="walk"; pre.textContent="steps "+PRESENT.length+"\nchapters "+chaps.join(" | ")+"\nexec "+execList.join(" | ")+"\nERR "+errs.join(" ;; ")+"\n"+out.join("\n"); document.body.appendChild(pre); })();

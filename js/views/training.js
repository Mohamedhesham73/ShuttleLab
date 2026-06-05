import { state, esc, fmtDate } from "../core.js";
import { USERS } from "../config.js";
import { listenTraining, postTraining } from "../data.js";

export function renderTraining(){
  const view = document.getElementById("view");
  const coach = state.role==="coach";
  const roster = USERS.filter(u=>u.role!=="coach");
  let listUnsub = null;

  view.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:14px;">
      <span class="muted" style="font-size:14px;">Training plan ${coach?"":"· written for you by your coach"}</span>
      ${coach?`<select id="trainSel" style="width:auto;">${roster.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join("")}</select>`:""}
    </div>
    ${coach?`<div class="card" style="padding:16px;margin-bottom:14px;">
      <textarea id="trainText" rows="3" placeholder="Write this player's training…" style="margin-bottom:10px;resize:vertical;"></textarea>
      <button class="btn pri" id="postTrain">Post to player</button><div id="trainErr" class="err"></div>
    </div>`:""}
    <div id="trainList"><div class="muted">Loading…</div></div>`;

  const startList = (uid)=>{
    if(listUnsub){ try{ listUnsub(); }catch(e){} }
    listUnsub = listenTraining(uid, (items, err)=>{
      const el = document.getElementById("trainList"); if(!el) return;
      if(err){ el.innerHTML = `<div class="err">${esc(err.message)}</div>`; return; }
      el.innerHTML = items.length ? items.map(it=>`<div class="card fade" style="padding:16px;margin-bottom:10px;">
          <div class="muted" style="font-size:12px;margin-bottom:5px;">${esc(it.byName||"Coach")} · ${fmtDate(it.dateISO)}</div>
          <div style="font-size:14px;line-height:1.6;white-space:pre-wrap;">${esc(it.text)}</div></div>`).join("")
        : '<div class="muted">No training posted yet.</div>';
    });
    state.unsub.push(()=>{ if(listUnsub){ try{ listUnsub(); }catch(e){} } });
  };

  if(coach){
    const sel = document.getElementById("trainSel");
    let target = roster[0] ? String(roster[0].id) : null;
    if(target) startList(target);
    sel.onchange = (e)=>{ target = e.target.value; startList(target); };
    document.getElementById("postTrain").onclick = async ()=>{
      const txt = document.getElementById("trainText").value.trim();
      const errEl = document.getElementById("trainErr"); errEl.textContent = "";
      if(!txt || !target) return;
      try{
        await postTraining({ uid:String(target), text:txt, byName:state.name, dateISO:new Date().toISOString().slice(0,10), ts:Date.now() });
        document.getElementById("trainText").value = "";
      }catch(e){ errEl.textContent = "Couldn't post: " + (e.message||e); }
    };
  } else {
    startList(String(state.user.id));
  }
}

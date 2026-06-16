import { state, esc, fmtDate, toast, autoGrow } from "../core.js";
import { TOURNAMENTS } from "../config.js";
import { listenTraining, postTraining, listenPlan, getPlan, savePlan, listenSchedule, saveSchedule } from "../data.js";

// ---- date helpers ----
function d(iso){ try{ return new Date(iso+"T00:00:00"); }catch(e){ return null; } }
function fmtRange(a,b){
  const A=d(a), B=d(b||a); if(!A) return "";
  const mo=x=>x.toLocaleDateString(undefined,{month:"short"});
  if(!b || a===b) return A.getDate()+" "+mo(A)+" "+A.getFullYear();
  const sameMonth = A.getMonth()===B.getMonth() && A.getFullYear()===B.getFullYear();
  return sameMonth
    ? A.getDate()+"–"+B.getDate()+" "+mo(B)+" "+B.getFullYear()
    : A.getDate()+" "+mo(A)+" – "+B.getDate()+" "+mo(B)+" "+B.getFullYear();
}
function daysUntil(iso){ const t=new Date(); t.setHours(0,0,0,0); const x=d(iso); if(!x) return 9999; return Math.round((x-t)/86400000); }
function whenLabel(t){
  const ds=daysUntil(t.start), de=daysUntil(t.end||t.start);
  if(de<0) return { txt:"Finished", col:"var(--muted)" };
  if(ds<=0 && de>=0) return { txt:"Happening now", col:"var(--up)" };
  if(ds===0) return { txt:"Today", col:"var(--brand)" };
  if(ds<=14) return { txt:"In "+ds+" day"+(ds>1?"s":""), col:"var(--brand)" };
  return { txt:"In "+ds+" days", col:"var(--muted)" };
}
function nextId(list){
  let best=null;
  list.forEach(t=>{ if(daysUntil(t.end||t.start)>=0){ if(!best || daysUntil(t.start)<daysUntil(best.start)) best=t; } });
  return best ? best.id : null;
}

// visual season timeline — phases as colour-coded bands, tournaments as flags,
// a "today" line, all mapped onto one date axis (build/peak/taper periodisation).
function phaseColor(title){ const s=(title||"").toLowerCase();
  if(/base|build|prep/.test(s)) return "#5db9ff";
  if(/peak|comp/.test(s)) return "#a4dd2b";
  if(/taper/.test(s)) return "#ffd34d";
  if(/recover|rest|off/.test(s)) return "#9aa49a";
  return "#c77dff"; }
function timelineHTML(plan, tours){
  const blocks=(plan.blocks||[]).filter(b=>b.start);
  const curated=(tours||[]).filter(t=>(plan.tournaments||[]).includes(t.id));
  const tours2=curated.concat((plan.travel||[]).map(t=>({ ...t, travel:true })));
  const dates=[]; blocks.forEach(b=>{ dates.push(+d(b.start)); if(b.end) dates.push(+d(b.end)); });
  tours2.forEach(t=>{ dates.push(+d(t.start)); if(t.end) dates.push(+d(t.end)); });
  if(dates.length<1) return "";
  dates.push(Date.now());
  let min=Math.min.apply(null,dates), max=Math.max.apply(null,dates);
  const pad=(max-min)*0.06 || 86400000*3; min-=pad; max+=pad; const span=max-min||1;
  const pct=ms=>((ms-min)/span*100);
  const bars=blocks.map(b=>{ const x1=pct(+d(b.start)), x2=pct(+d(b.end||b.start)), w=Math.max(2.5,x2-x1), c=phaseColor(b.title);
    return `<div title="${esc(b.title)}" style="position:absolute;left:${x1}%;width:${w}%;top:22px;height:22px;background:${c}33;border:1px solid ${c};border-radius:6px;overflow:hidden;"><span style="font-size:10px;color:${c};padding:1px 4px;white-space:nowrap;">${esc(b.title)}</span></div>`; }).join("");
  const flags=tours2.map(t=>{ const x=pct(+d(t.start)); return `<div title="${esc(t.name)} · ${esc(fmtRange(t.start,t.end))}" style="position:absolute;left:${x}%;top:0;transform:translateX(-50%);">${t.travel?"✈":"🏆"}<div style="width:1px;height:48px;background:${t.travel?"#5dd0b1":"#ffd34d"};opacity:.55;margin:0 auto;"></div></div>`; }).join("");
  const tx=pct(Date.now());
  const lbl=ms=>new Date(ms).toLocaleDateString(undefined,{month:"short",year:"2-digit"});
  return `<div class="card" style="padding:16px;margin-bottom:14px;">
    <div class="disp" style="font-size:15px;margin-bottom:10px;">📅 Season timeline</div>
    <div style="position:relative;height:66px;">
      <div style="position:absolute;left:${tx}%;top:0;bottom:16px;width:2px;background:var(--brand);transform:translateX(-1px);"></div>
      <div style="position:absolute;left:${tx}%;top:48px;transform:translateX(-50%);font-size:9px;color:var(--brand);">today</div>
      ${flags}${bars}
    </div>
    <div style="display:flex;justify-content:space-between;font-size:10px;" class="muted"><span>${lbl(min)}</span><span>${lbl(max)}</span></div>
  </div>`;
}

export function renderTraining(){
  const view = document.getElementById("view");
  const coach = state.role==="coach";
  const roster = state.roster.filter(u=>u.role==="player");
  let msgUnsub = null;          // live messages listener (re-pointed on player switch)
  let TOURS = TOURNAMENTS;      // effective schedule (coach overrides, else code default)

  // ============================ PLAYER VIEW ============================
  if(!coach){
    view.innerHTML = `
      <div class="muted" style="font-size:14px;margin-bottom:14px;">Your season plan · written for you by your coach</div>
      <div id="planView"><div class="muted">Loading…</div></div>
      <div style="margin-top:18px;">
        <div class="muted" style="font-size:12px;margin-bottom:6px;">Messages from your coach</div>
        <div id="msgList"><div class="muted">Loading…</div></div>
      </div>`;

    let lastPlan = {};
    const val = id => { const e=document.getElementById(id); return e? e.value.trim() : ""; };
    function wireTravel(){
      const add = document.getElementById("trvAdd");
      if(add) add.onclick = async ()=>{
        const name=val("trvName"), start=val("trvStart"), end=val("trvEnd")||start, place=val("trvPlace");
        const err=document.getElementById("trvErr"); if(err) err.textContent="";
        if(!name){ if(err) err.textContent=" Name the tournament."; return; }
        if(!start){ if(err) err.textContent=" Pick a start date."; return; }
        const travel=(lastPlan.travel||[]).concat([{ id:"tr"+Date.now(), name, start, end, place:place||"Abroad" }]);
        try{ await savePlan(String(state.user.id), { travel }); }catch(e){ if(err) err.textContent=" Couldn't save: "+(e.message||e); }
      };
      document.querySelectorAll("[data-trvdel]").forEach(b=>{
        b.onclick = async ()=>{
          const travel=(lastPlan.travel||[]).filter(t=>String(t.id)!==String(b.dataset.trvdel));
          try{ await savePlan(String(state.user.id), { travel }); }catch(e){ toast("Couldn't remove — check your connection.","err"); }
        };
      });
    }
    const paint = ()=>{
      const el=document.getElementById("planView"); if(!el) return;
      el.innerHTML = planReadHTML(lastPlan, TOURS) + travelEditHTML(lastPlan);
      wireTravel();
    };
    state.unsub.push(listenPlan(String(state.user.id), (plan, err)=>{
      if(err){ const el=document.getElementById("planView"); if(el) el.innerHTML=`<div class="err">${esc(err.message)}</div>`; return; }
      lastPlan = plan||{}; paint();
    }));
    state.unsub.push(listenSchedule(list=>{ TOURS = (list&&list.length)? list : TOURNAMENTS; paint(); }));
    startMessages(String(state.user.id));
    return;
  }

  // ============================ COACH VIEW ============================
  const TARGET_MAX = 2000;
  let curUid = roster[0] ? String(roster[0].id) : null;
  let plan = { target:"", blocks:[], tournaments:[] };
  let draftTarget = "";                 // in-progress target text (separate from the saved one)
  let editingSchedule = false;
  const playerName = uid => { const p=roster.find(r=>String(r.id)===String(uid)); return p?p.name:""; };

  view.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:14px;">
      <span class="muted" style="font-size:14px;">Game Plan</span>
      ${roster.length?`<select id="trainSel" style="width:auto;">${roster.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join("")}</select>`:""}
    </div>
    <div id="planEdit"><div class="muted">Loading…</div></div>
    <div class="card" style="padding:16px;margin-top:16px;">
      <div class="disp" style="font-size:15px;margin-bottom:10px;">Message the player</div>
      <textarea id="msgText" rows="2" placeholder="A quick note for this player…" style="margin-bottom:10px;resize:none;overflow:hidden;"></textarea>
      <button class="btn pri" id="msgPost">Post</button><div id="msgErr" class="err"></div>
      <div id="msgList" style="margin-top:12px;"></div>
    </div>`;

  if(!roster.length){ document.getElementById("planEdit").innerHTML = `<div class="muted">No players on the roster yet.</div>`; return; }

  autoGrow(document.getElementById("msgText"));

  const sel = document.getElementById("trainSel");
  sel.onchange = ()=>{ curUid = sel.value; selectPlayer(curUid); };

  document.getElementById("msgPost").onclick = async ()=>{
    const txt=document.getElementById("msgText").value.trim();
    const errEl=document.getElementById("msgErr"); errEl.textContent="";
    if(!txt || !curUid) return;
    try{
      await postTraining({ uid:String(curUid), text:txt, byName:state.name, dateISO:new Date().toISOString().slice(0,10), ts:Date.now() });
      document.getElementById("msgText").value="";
    }catch(e){ errEl.textContent="Couldn't post: "+(e.message||e); }
  };

  // keep TOURS live; don't redraw while the coach is mid-edit of the schedule
  state.unsub.push(listenSchedule(list=>{
    TOURS = (list&&list.length)? list : TOURNAMENTS;
    if(!editingSchedule && curUid) renderEdit();
  }));

  async function selectPlayer(uid){
    document.getElementById("planEdit").innerHTML = `<div class="muted">Loading…</div>`;
    try{ plan = await getPlan(uid); }catch(e){ plan = {}; }
    plan = plan || {}; plan.blocks = plan.blocks||[]; plan.tournaments = plan.tournaments||[];
    draftTarget = "";                   // fresh box for each player
    renderEdit();
    startMessages(uid);
  }

  // preserve the in-progress target text across re-renders triggered by other edits
  function captureDraft(){ const t=document.getElementById("tgtText"); if(t) draftTarget = t.value; }

  function renderEdit(){
    const el = document.getElementById("planEdit");
    const blocks = (plan.blocks||[]).slice().sort((a,b)=>(a.start||"").localeCompare(b.start||""));
    const picked = new Set(plan.tournaments||[]);

    el.innerHTML = `
      ${timelineHTML(plan, TOURS)}
      <div class="card" style="padding:16px;margin-bottom:14px;">
        <div class="disp" style="font-size:15px;margin-bottom:8px;">🎯 Season target</div>
        ${plan.target ? `<div style="border:1px solid var(--line);border-left:3px solid var(--brand);border-radius:10px;padding:10px 12px;margin-bottom:10px;">
          <div class="muted" style="font-size:12px;margin-bottom:3px;">Current target for ${esc(playerName(curUid))}${plan.targetAt?` · saved ${esc(fmtDate(new Date(plan.targetAt).toISOString().slice(0,10)))}`:""}</div>
          <div style="font-size:14px;line-height:1.55;white-space:pre-wrap;">${esc(plan.target)}</div>
        </div>` : ""}
        <textarea id="tgtText" rows="2" maxlength="${TARGET_MAX}" placeholder="${plan.target?"Write a new target to replace the current one…":"e.g. Reach beep level 11 · medal at U17 singles · sharper net play"}" style="resize:none;overflow:hidden;margin-bottom:8px;">${esc(draftTarget)}</textarea>
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
          <button class="btn pri" id="tgtSave">${plan.target?"Update target":"Save target"}</button>
          <span id="tgtCount" class="muted" style="font-size:12px;">${draftTarget.length} / ${TARGET_MAX}</span>
          <span id="tgtMsg" class="muted" style="font-size:13px;"></span>
        </div>
      </div>

      <div class="card" style="padding:16px;margin-bottom:14px;">
        <div class="disp" style="font-size:15px;margin-bottom:10px;">🗓️ Plan phases</div>
        <div id="blkList" style="display:flex;flex-direction:column;gap:8px;margin-bottom:12px;">
          ${blocks.length ? blocks.map(b=>`
            <div style="display:flex;gap:10px;align-items:flex-start;border:1px solid var(--line);border-radius:10px;padding:10px 12px;">
              <div style="flex:1;">
                <div class="muted" style="font-size:12px;">${esc(fmtRange(b.start,b.end))}</div>
                <div class="disp" style="font-size:14px;">${esc(b.title||"")}</div>
                ${b.details?`<div style="font-size:13px;line-height:1.5;white-space:pre-wrap;margin-top:3px;">${esc(b.details)}</div>`:""}
              </div>
              <button class="btn" data-del="${esc(b.id)}" style="padding:4px 9px;font-size:12px;color:var(--down);border-color:var(--down);">Delete</button>
            </div>`).join("") : `<div class="muted" style="font-size:13px;">No phases yet — add one below.</div>`}
        </div>
        <div style="border-top:1px solid var(--line);padding-top:12px;">
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;">
            <div style="flex:1;min-width:130px;"><label style="font-size:12px;">Start</label><input type="date" id="blkStart"></div>
            <div style="flex:1;min-width:130px;"><label style="font-size:12px;">End</label><input type="date" id="blkEnd"></div>
          </div>
          <input id="blkTitle" placeholder="Focus (e.g. Base endurance block)" style="margin-bottom:8px;">
          <textarea id="blkDetails" rows="2" placeholder="What to work on this phase…" style="resize:none;overflow:hidden;margin-bottom:8px;"></textarea>
          <button class="btn" id="blkAdd">+ Add phase</button><span id="blkErr" class="err"></span>
        </div>
      </div>

      <div class="card" style="padding:16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;gap:8px;">
          <div class="disp" style="font-size:15px;">🏆 Tournaments for this player</div>
          <button class="btn" id="schEditBtn" style="padding:5px 10px;font-size:12px;">✎ Edit schedule</button>
        </div>
        <div class="muted" style="font-size:12px;margin-bottom:10px;">Tap a tournament to add it to this player's calendar.</div>
        <div style="display:flex;flex-direction:column;gap:7px;">
          ${TOURS.map(t=>{
            const on = picked.has(t.id);
            return `<div data-tg="${esc(t.id)}" style="display:flex;gap:10px;align-items:center;border:1px solid ${on?"var(--brand)":"var(--line)"};border-radius:10px;padding:9px 11px;cursor:pointer;">
              <span style="font-size:16px;">${on?"⭐":"☆"}</span>
              <div style="flex:1;">
                <div class="disp" style="font-size:14px;">${esc(t.name)}</div>
                <div class="muted" style="font-size:12px;">${esc(t.cats||"")} · ${esc(fmtRange(t.start,t.end))} · ${esc(t.place||"TBD")}</div>
              </div>
            </div>`;
          }).join("")}
        </div>
      </div>

      ${(plan.travel&&plan.travel.length) ? `<div class="card" style="padding:16px;margin-top:14px;border-left:3px solid var(--brand);">
        <div class="disp" style="font-size:15px;margin-bottom:8px;">✈ Traveling abroad (added by the player)</div>
        ${plan.travel.slice().sort((a,b)=>(a.start||"").localeCompare(b.start||"")).map(t=>`
          <div style="border:1px solid var(--line);border-radius:10px;padding:9px 11px;margin-bottom:8px;">
            <div class="disp" style="font-size:14px;">${esc(t.name)}</div>
            <div class="muted" style="font-size:12px;">${esc(fmtRange(t.start,t.end))} · ${esc(t.place||"Abroad")}</div>
          </div>`).join("")}
      </div>` : ``}`;

    {
      const ta=document.getElementById("tgtText"), count=document.getElementById("tgtCount");
      autoGrow(ta, el=>{ draftTarget = el.value; if(count) count.textContent = el.value.length+" / "+TARGET_MAX; });
      autoGrow(document.getElementById("blkDetails"));
    }

    document.getElementById("tgtSave").onclick = async ()=>{
      captureDraft();
      const m=document.getElementById("tgtMsg");
      const text=(draftTarget||"").trim();
      if(!text){ m.style.color="var(--down)"; m.textContent="Write a target first."; return; }
      m.style.color="var(--muted)"; m.textContent="Saving…";
      try{
        const at=Date.now();
        await savePlan(curUid, { target:text, targetAt:at });
        plan.target=text; plan.targetAt=at; draftTarget="";   // saved → clear the box, show the card
        renderEdit();
        const m2=document.getElementById("tgtMsg"); if(m2){ m2.style.color="var(--brand)"; m2.textContent="Saved."; }
      }
      catch(e){ m.style.color="var(--down)"; m.textContent="Couldn't save: "+(e.message||e); }
    };

    document.getElementById("blkAdd").onclick = async ()=>{
      const start=document.getElementById("blkStart").value;
      const end=document.getElementById("blkEnd").value || start;
      const title=document.getElementById("blkTitle").value.trim();
      const details=document.getElementById("blkDetails").value.trim();
      const errEl=document.getElementById("blkErr"); errEl.textContent="";
      if(!start){ errEl.textContent=" Pick a start date."; return; }
      if(!title){ errEl.textContent=" Give it a focus."; return; }
      captureDraft();
      plan.blocks = (plan.blocks||[]).concat([{ id:Date.now(), start, end, title, details }]);
      try{ await savePlan(curUid, { blocks: plan.blocks }); renderEdit(); }
      catch(e){ errEl.textContent=" Couldn't save: "+(e.message||e); }
    };

    el.querySelectorAll("[data-del]").forEach(btn=>{
      btn.onclick = async ()=>{
        captureDraft();
        plan.blocks = (plan.blocks||[]).filter(b=>String(b.id)!==String(btn.dataset.del));
        try{ await savePlan(curUid, { blocks: plan.blocks }); renderEdit(); }catch(e){ toast("Couldn't save — check your connection.","err"); }
      };
    });

    el.querySelectorAll("[data-tg]").forEach(row=>{
      row.onclick = async ()=>{
        captureDraft();
        const id=row.dataset.tg, set=new Set(plan.tournaments||[]);
        if(set.has(id)) set.delete(id); else set.add(id);
        plan.tournaments = Array.from(set);
        try{ await savePlan(curUid, { tournaments: plan.tournaments }); renderEdit(); }catch(e){ toast("Couldn't save — check your connection.","err"); }
      };
    });

    document.getElementById("schEditBtn").onclick = ()=>{ editingSchedule = true; renderScheduleEditor(); };
  }

  // ---- coach: edit the shared tournament schedule (venues/dates/etc.) ----
  function renderScheduleEditor(){
    const work = JSON.parse(JSON.stringify(TOURS));
    const el = document.getElementById("planEdit");

    const rowHTML = (t,i)=>`
      <div data-row="${i}" style="border:1px solid var(--line);border-radius:10px;padding:11px;margin-bottom:10px;">
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;">
          <input data-f="name" value="${esc(t.name||"")}" placeholder="Tournament name" style="flex:1;">
          <button class="btn" data-rm style="padding:4px 9px;font-size:12px;color:var(--down);border-color:var(--down);">✕</button>
        </div>
        <input data-f="cats" value="${esc(t.cats||"")}" placeholder="Categories (e.g. Singles · Doubles · Mixed)" style="margin-bottom:8px;">
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;">
          <div style="flex:1;min-width:120px;"><label style="font-size:12px;">Start</label><input type="date" data-f="start" value="${esc(t.start||"")}"></div>
          <div style="flex:1;min-width:120px;"><label style="font-size:12px;">End</label><input type="date" data-f="end" value="${esc(t.end||"")}"></div>
        </div>
        <input data-f="place" value="${esc(t.place||"")}" placeholder="Venue (or TBD)">
      </div>`;

    el.innerHTML = `
      <div class="card" style="padding:16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;gap:8px;">
          <div class="disp" style="font-size:15px;">✎ Edit tournament schedule</div>
          <button class="btn" id="schCancel" style="padding:5px 10px;font-size:12px;">Cancel</button>
        </div>
        <div class="muted" style="font-size:12px;margin-bottom:12px;">Changes here update the schedule for the whole team.</div>
        <div id="schRows">${work.map((t,i)=>rowHTML(t,i)).join("")}</div>
        <button class="btn" id="schAdd" style="margin-bottom:14px;">+ Add tournament</button>
        <div style="border-top:1px solid var(--line);padding-top:12px;">
          <button class="btn pri" id="schSave">Save schedule</button>
          <span id="schMsg" class="muted" style="margin-left:10px;font-size:13px;"></span>
        </div>
      </div>`;

    function wire(){
      el.querySelectorAll("[data-row]").forEach(row=>{
        const i = parseInt(row.dataset.row,10);
        row.querySelectorAll("[data-f]").forEach(inp=>{ inp.oninput = ()=>{ work[i][inp.dataset.f] = inp.value; }; });
        const rm = row.querySelector("[data-rm]");
        if(rm) rm.onclick = ()=>{ work.splice(i,1); redraw(); };
      });
    }
    function redraw(){ document.getElementById("schRows").innerHTML = work.map((t,i)=>rowHTML(t,i)).join(""); wire(); }
    wire();

    document.getElementById("schAdd").onclick = ()=>{
      work.push({ id:"tc"+Date.now(), name:"", cats:"", start:"", end:"", place:"TBD" });
      redraw();
    };
    document.getElementById("schCancel").onclick = ()=>{ editingSchedule = false; renderEdit(); };
    document.getElementById("schSave").onclick = async ()=>{
      const msg=document.getElementById("schMsg");
      for(const t of work){
        if(!(t.name||"").trim()){ msg.style.color="var(--down)"; msg.textContent="Every tournament needs a name."; return; }
        if(!t.start){ msg.style.color="var(--down)"; msg.textContent="Every tournament needs a start date."; return; }
        if(!t.end) t.end = t.start;
      }
      msg.style.color="var(--muted)"; msg.textContent="Saving…";
      try{
        await saveSchedule(work);
        editingSchedule = false;
        TOURS = work;
        renderEdit();
      }catch(e){ msg.style.color="var(--down)"; msg.textContent="Couldn't save: "+(e.message||e); }
    };
  }

  selectPlayer(curUid);

  // ---- shared: live messages list (coach & player) ----
  function startMessages(uid){
    if(msgUnsub){ try{ msgUnsub(); }catch(e){} }   // detach previous player's listener
    msgUnsub = listenTraining(uid, (items, err)=>{
      const el=document.getElementById("msgList"); if(!el) return;
      if(err){ el.innerHTML=`<div class="err">${esc(err.message)}</div>`; return; }
      el.innerHTML = items.length ? items.map(it=>`
        <div class="card fade" style="padding:12px 14px;margin-bottom:8px;">
          <div class="muted" style="font-size:12px;margin-bottom:4px;">${esc(it.byName||"Coach")} · ${esc(fmtDate(it.dateISO))}</div>
          <div style="font-size:14px;line-height:1.55;white-space:pre-wrap;">${esc(it.text)}</div>
        </div>`).join("") : '<div class="muted" style="font-size:13px;">No messages yet.</div>';
    });
    state.unsub.push(()=>{ if(msgUnsub){ try{ msgUnsub(); }catch(e){} } });
  }
}

// ---- player read-only render of the plan (target + phases + tournaments) ----
function planReadHTML(plan, tours){
  const target = plan.target ? esc(plan.target) : "";
  const blocks = (plan.blocks||[]).slice().sort((a,b)=>(a.start||"").localeCompare(b.start||""));
  const curated = (tours||[]).filter(t=>(plan.tournaments||[]).includes(t.id)).map(t=>({ ...t, travel:false }));
  const travel = (plan.travel||[]).map(t=>({ id:t.id, name:t.name, cats:"Abroad", start:t.start, end:t.end, place:t.place||"Abroad", travel:true }));
  const myTours = curated.concat(travel).sort((a,b)=>(a.start||"").localeCompare(b.start||""));
  const next = nextId(myTours);

  const targetCard = `<div class="card" style="padding:16px;margin-bottom:14px;border-left:3px solid var(--brand);">
    <div class="disp" style="font-size:15px;margin-bottom:6px;">🎯 Season target</div>
    ${target ? `<div style="font-size:15px;line-height:1.6;white-space:pre-wrap;">${target}</div>`
             : `<div class="muted" style="font-size:13px;">Your coach hasn't set a season target yet.</div>`}
  </div>`;

  const phaseCard = `<div class="card" style="padding:16px;margin-bottom:14px;">
    <div class="disp" style="font-size:15px;margin-bottom:10px;">🗓️ Plan phases</div>
    ${blocks.length ? blocks.map(b=>`
      <div style="display:flex;gap:12px;margin-bottom:10px;">
        <div style="width:5px;border-radius:5px;background:var(--brand);flex:0 0 auto;"></div>
        <div>
          <div class="muted" style="font-size:12px;">${esc(fmtRange(b.start,b.end))}</div>
          <div class="disp" style="font-size:14px;">${esc(b.title||"")}</div>
          ${b.details?`<div style="font-size:13px;line-height:1.55;white-space:pre-wrap;margin-top:3px;">${esc(b.details)}</div>`:""}
        </div>
      </div>`).join("") : `<div class="muted" style="font-size:13px;">No phases set yet.</div>`}
  </div>`;

  const tourCard = `<div class="card" style="padding:16px;">
    <div class="disp" style="font-size:15px;margin-bottom:10px;">🏆 Your tournaments</div>
    ${myTours.length ? myTours.map(t=>{
      const w=whenLabel(t); const isNext = t.id===next; const hl = isNext || t.travel;
      return `<div style="display:flex;gap:10px;align-items:center;border:1px solid ${hl?"var(--brand)":"var(--line)"};border-radius:10px;padding:10px 12px;margin-bottom:8px;">
        <div style="flex:1;">
          <div class="disp" style="font-size:14px;">${esc(t.name)}${t.travel?` <span class="chip on" style="font-size:10px;padding:1px 7px;">✈ TRAVEL</span>`:""}${isNext?` <span class="chip on" style="font-size:10px;padding:1px 7px;">NEXT</span>`:""}</div>
          <div class="muted" style="font-size:12px;">${esc(t.cats||"")} · ${esc(fmtRange(t.start,t.end))} · ${esc(t.place||"TBD")}</div>
        </div>
        <div style="font-size:12px;color:${w.col};white-space:nowrap;">${esc(w.txt)}</div>
      </div>`;
    }).join("") : `<div class="muted" style="font-size:13px;">No tournaments added for you yet.</div>`}
  </div>`;

  return targetCard + timelineHTML(plan, tours) + phaseCard + tourCard;
}

// ---- player: add/remove tournaments they're traveling to (abroad) ----
function travelEditHTML(plan){
  const trv = (plan.travel||[]).slice().sort((a,b)=>(a.start||"").localeCompare(b.start||""));
  return `<div class="card" style="padding:16px;margin-top:14px;">
    <div class="disp" style="font-size:15px;margin-bottom:4px;">✈ Traveling to a tournament?</div>
    <div class="muted" style="font-size:12px;margin-bottom:10px;">Add tournaments you're playing abroad — your coach will see them on your calendar.</div>
    ${trv.map(t=>`<div style="display:flex;gap:10px;align-items:center;border:1px solid var(--line);border-radius:10px;padding:9px 11px;margin-bottom:8px;">
        <div style="flex:1;"><div class="disp" style="font-size:14px;">${esc(t.name)}</div>
        <div class="muted" style="font-size:12px;">${esc(fmtRange(t.start,t.end))} · ${esc(t.place||"Abroad")}</div></div>
        <button class="btn" data-trvdel="${esc(t.id)}" style="padding:4px 9px;font-size:12px;color:var(--down);border-color:var(--down);">Remove</button>
      </div>`).join("")}
    <div style="border-top:1px solid var(--line);padding-top:12px;margin-top:${trv.length?"4px":"0"};">
      <input id="trvName" placeholder="Tournament name" style="margin-bottom:8px;">
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;">
        <div style="flex:1;min-width:120px;"><label style="font-size:12px;">Start</label><input type="date" id="trvStart"></div>
        <div style="flex:1;min-width:120px;"><label style="font-size:12px;">End</label><input type="date" id="trvEnd"></div>
      </div>
      <input id="trvPlace" placeholder="City / country (e.g. Dubai, UAE)" style="margin-bottom:8px;">
      <button class="btn pri" id="trvAdd">Add to my calendar</button><span id="trvErr" class="err"></span>
    </div>
  </div>`;
}

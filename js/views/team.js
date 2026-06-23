import { state, esc, navigate, avatar, testById } from "../core.js";
import { TESTS } from "../config.js";
import { listenAllMeasurements } from "../data.js";
import { cardFromSessions, tierColor, overallOfSession } from "../rating.js";

export function renderTeam(){
  const view = document.getElementById("view");
  const roster = state.roster.filter(u=>u.role==="player");
  let board = TESTS[0].id;
  let latestByUid = {}, sessionsByUid = {};

  const draw = ()=>{
    const bm = testById(board);
    const ranked = roster.map(p=>{
      const sess = latestByUid[String(p.id)];
      const val = sess && sess.results?.[bm.id]?.best;
      return { p, val: (val==null?null:val) };
    }).filter(x=>x.val!=null).sort((a,b)=> bm.higher ? b.val-a.val : a.val-b.val);

    view.innerHTML = `<div class="card fade" style="padding:18px;margin-bottom:18px;">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:12px;">
          <span class="disp" style="font-size:16px;">🏆 Ladder</span>
          <select id="boardSel" style="width:auto;">${TESTS.map(t=>`<option value="${t.id}" ${t.id===board?"selected":""}>${t.name}</option>`).join("")}</select>
        </div>
        ${ranked.length?ranked.map((r,i)=>`<div style="display:flex;align-items:center;gap:12px;padding:9px 0;border-top:${i?"1px solid var(--line)":"none"};">
          <span class="num" style="width:22px;font-size:18px;font-weight:700;color:${i===0?"var(--brand)":"var(--muted)"};">${i+1}</span>
          ${avatar(r.p.name, r.p.photo, 28)}
          <span style="flex:1;font-size:15px;">${esc(r.p.name)}</span>
          <span class="num" style="font-size:20px;font-weight:700;">${r.val}</span>
          <span class="disp muted" style="font-size:12px;width:38px;">${bm.unit}</span></div>`).join("")
          :'<div class="muted" style="font-size:13px;">No results logged yet.</div>'}
      </div>
      <div class="disp" style="font-size:18px;margin-bottom:14px;">Squad · ${roster.length} players</div>
      <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(230px,1fr));">
        ${roster.slice().sort((a,b)=>((cardFromSessions(sessionsByUid[String(b.id)]||[]).overall||-1)-(cardFromSessions(sessionsByUid[String(a.id)]||[]).overall||-1))).map(p=>{
          const ss = sessionsByUid[String(p.id)] || [];
          const card = cardFromSessions(ss);
          const tCol = tierColor(card.tier);
          const sess = latestByUid[String(p.id)];
          const done = sess ? `Last test ${new Date((sess.dateISO||"")+"T00:00:00").toLocaleDateString(undefined,{month:"short",day:"numeric"})}` : "No test yet";
          // attention arrow — overall of latest vs previous session
          let arrow = "", flag = "";
          if(ss.length>=2){
            const dlt = (overallOfSession(ss[ss.length-1].results)||0) - (overallOfSession(ss[ss.length-2].results)||0);
            if(dlt>0) arrow = `<span style="color:var(--up);font-size:13px;">▲ ${dlt}</span>`;
            else if(dlt<0){ arrow = `<span style="color:var(--down);font-size:13px;">▼ ${Math.abs(dlt)}</span>`; flag = "border-left:3px solid var(--down);"; }
            else arrow = `<span class="muted" style="font-size:13px;">— level</span>`;
          }
          return `<div class="card fade" style="padding:16px;cursor:pointer;${flag}" data-id="${p.id}" data-name="${esc(p.name)}" data-ov="${card.overall==null?-1:card.overall}">
            <div style="display:flex;align-items:center;gap:11px;">
              <div style="text-align:center;flex:0 0 auto;min-width:40px;">
                <div class="num" style="font-size:28px;font-weight:800;color:var(--brand);line-height:1;">${card.overall==null?"—":card.overall}</div>
                <div class="disp" style="font-size:9px;letter-spacing:.1em;color:${tCol};">${card.tier}</div>
              </div>
              ${avatar(p.name,p.photo,40)}
              <div style="flex:1;min-width:0;">
                <div class="disp" style="font-size:17px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(p.name)}</div>
                <div style="margin-top:2px;">${arrow}</div>
              </div>
            </div>
            <div class="muted" style="font-size:12px;margin-top:10px;">${done}</div>
            <div style="margin-top:10px;"><span class="btn" style="padding:6px 12px;font-size:12px;">Open ›</span></div></div>`;
        }).join("")}
      </div>`;

    document.getElementById("boardSel").onchange = (e)=>{ board = e.target.value; draw(); };
    document.querySelectorAll("[data-id]").forEach(el=>{
      el.onclick = ()=>navigate("p360", { targetId:el.dataset.id, targetName:el.dataset.name });
    });
  };

  view.innerHTML = `<div class="muted">Loading team…</div>`;
  state.unsub.push(listenAllMeasurements((all, err)=>{
    if(err){ view.innerHTML = `<div class="err">Couldn't load team: ${esc(err.message)}</div>`; return; }
    latestByUid = {}; sessionsByUid = {};
    all.forEach(m=>{
      const k = String(m.uid);
      if(!latestByUid[k] || (m.dateISO||"") > (latestByUid[k].dateISO||"")) latestByUid[k] = m;
      (sessionsByUid[k] = sessionsByUid[k] || []).push(m);
    });
    Object.keys(sessionsByUid).forEach(k=>sessionsByUid[k].sort((a,b)=>(a.dateISO||"").localeCompare(b.dateISO||"")));
    draw();
  }));
}

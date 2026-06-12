import { state, esc, navigate, avatar, testById } from "../core.js";
import { TESTS } from "../config.js";
import { listenAllMeasurements } from "../data.js";

export function renderTeam(){
  const view = document.getElementById("view");
  const roster = state.roster.filter(u=>u.role!=="coach");
  let board = TESTS[0].id;
  let latestByUid = {};

  const draw = ()=>{
    const bm = testById(board);
    const ranked = roster.map(p=>{
      const sess = latestByUid[String(p.id)];
      const val = sess && sess.results?.[bm.id]?.best;
      return { p, val: (val==null?null:val) };
    }).filter(x=>x.val!=null).sort((a,b)=> bm.higher ? b.val-a.val : a.val-b.val);

    view.innerHTML = `<div class="card fade" style="padding:18px;margin-bottom:18px;">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:12px;">
          <span class="disp" style="font-size:16px;">🏆 Leaderboard</span>
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
      <div class="disp" style="font-size:18px;margin-bottom:14px;">Team · ${roster.length} players</div>
      <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(220px,1fr));">
        ${roster.map(p=>{
          const sess = latestByUid[String(p.id)];
          const done = sess ? `Last test ${new Date((sess.dateISO||"")+"T00:00:00").toLocaleDateString(undefined,{month:"short",day:"numeric"})}` : "No test yet";
          return `<div class="card fade" style="padding:16px;cursor:pointer;" data-id="${p.id}" data-name="${esc(p.name)}">
            <div style="display:flex;align-items:center;gap:11px;">${avatar(p.name,p.photo,40)}<div class="disp" style="font-size:18px;">${esc(p.name)}</div></div>
            <div class="muted" style="font-size:12px;margin-top:10px;">${done}</div>
            <div style="margin-top:10px;"><span class="btn" style="padding:6px 12px;font-size:12px;">Open ›</span></div></div>`;
        }).join("")}
      </div>`;

    document.getElementById("boardSel").onchange = (e)=>{ board = e.target.value; draw(); };
    document.querySelectorAll("[data-id]").forEach(el=>{
      el.onclick = ()=>navigate("dash", { targetId:el.dataset.id, targetName:el.dataset.name });
    });
  };

  view.innerHTML = `<div class="muted">Loading team…</div>`;
  state.unsub.push(listenAllMeasurements((all, err)=>{
    if(err){ view.innerHTML = `<div class="err">Couldn't load team: ${esc(err.message)}</div>`; return; }
    latestByUid = {};
    all.forEach(m=>{
      const k = String(m.uid);
      if(!latestByUid[k] || (m.dateISO||"") > (latestByUid[k].dateISO||"")) latestByUid[k] = m;
    });
    draw();
  }));
}

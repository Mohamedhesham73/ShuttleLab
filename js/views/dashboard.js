import { state, esc, r1, fmtDate, testById, avatar, navigate } from "../core.js";
import { TESTS, USERS } from "../config.js";
import { listenMeasurements, listenGoals, setGoal } from "../data.js";
import { openReport } from "../report.js";

export function renderDashboard(){
  const view = document.getElementById("view");
  const showBack = String(state.targetId) !== String(state.user.id);
  const u = USERS.find(x=>String(x.id)===String(state.targetId));
  const name = state.targetName || state.name;

  let sessions = [], goals = {}, loadedM = false, chart = null;

  const draw = ()=>{
    if(!loadedM) return;
    const back = showBack ? `<button class="btn" id="back" style="margin-bottom:14px;padding:7px 12px;font-size:12px;">← Back to team</button>` : "";
    const title = `<div style="display:flex;align-items:center;gap:12px;">${avatar(name, u&&u.photo, 40)}<div class="disp" style="font-size:26px;">${esc(name)}</div></div>`;

    if(!sessions.length){
      view.innerHTML = `${back}${title}<div class="card fade" style="padding:22px;margin-top:14px;"><div class="muted">No test sessions yet. Open <b style="color:var(--brand)">Log</b> to record the first one.</div></div>`;
      wireBack(); return;
    }

    const latest = sessions[sessions.length-1];
    const prev = sessions.length>1 ? sessions[sessions.length-2] : null;
    const improved = [], declined = [];
    if(prev){
      TESTS.forEach(t=>{
        const a = latest.results?.[t.id]?.best, b = prev.results?.[t.id]?.best;
        if(a==null||b==null||a===b) return;
        const better = t.higher ? a>b : a<b;
        const pct = b ? Math.abs((a-b)/b*100) : 0;
        (better?improved:declined).push({ t, pct:r1(pct) });
      });
    }

    const cards = TESTS.map(t=>{
      const res = latest.results?.[t.id];
      if(!res) return "";
      const sub = t.multi ? `avg ${res.avg} · ${t.higher?"higher":"lower"} better` : "single";
      return `<div class="mc"><div class="muted" style="font-size:13px;">${t.name}</div>
        <div style="display:flex;align-items:baseline;gap:5px;margin-top:2px;"><span class="num" style="font-size:26px;font-weight:700;">${res.best}</span><span class="muted" style="font-size:12px;">${t.unit}${t.multi?" best":""}</span></div>
        <div class="muted" style="font-size:12px;margin-top:3px;">${sub}</div></div>`;
    }).join("");

    const compare = prev ? `<div class="grid fade" style="grid-template-columns:1fr 1fr;margin-bottom:18px;">
        <div class="card" style="padding:16px;"><div class="disp" style="color:var(--up);font-size:14px;margin-bottom:8px;">▲ Better since last test</div>
          ${improved.length?improved.map(x=>`<div style="display:flex;justify-content:space-between;font-size:14px;padding:3px 0;"><span>${x.t.name}</span><span class="num" style="color:var(--up)">+${x.pct}%</span></div>`).join(""):'<span class="muted" style="font-size:13px;">—</span>'}</div>
        <div class="card" style="padding:16px;"><div class="disp" style="color:var(--down);font-size:14px;margin-bottom:8px;">◆ Focus next</div>
          ${declined.length?declined.map(x=>`<div style="display:flex;justify-content:space-between;font-size:14px;padding:3px 0;"><span>${x.t.name}</span><span class="num" style="color:var(--down)">${x.pct}%</span></div>`).join(""):'<span class="muted" style="font-size:13px;">Nothing dropped 🎯</span>'}</div>
      </div>` : `<div class="card fade" style="padding:14px 16px;margin-bottom:18px;"><span class="muted" style="font-size:13px;">First test logged — this is the baseline. The next session unlocks the better / focus comparison.</span></div>`;

    const goalTests = TESTS.filter(t=>goals[t.id]!=null);
    const goalsBlock = `<div class="card fade" style="padding:18px;margin-bottom:18px;">
      <div class="disp" style="font-size:16px;margin-bottom:12px;">Goals</div>
      ${goalTests.length?goalTests.map(t=>{
        const cur = latest.results?.[t.id]?.best; const tgt = goals[t.id];
        let pct = 0; if(cur!=null && tgt) pct = t.higher ? (cur/tgt*100) : (tgt/cur*100);
        pct = Math.max(0, Math.min(100, Math.round(pct)));
        return `<div style="margin-bottom:12px;"><div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px;"><span>${t.name}</span><span class="muted">${cur==null?"—":cur} → <span style="color:var(--brand)">${tgt}${t.unit}</span></span></div><div class="bar"><div style="width:${pct}%"></div></div></div>`;
      }).join(""):'<div class="muted" style="font-size:14px;">No goals set yet.</div>'}
      ${state.role==="coach"?`<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;">
        <select id="goalTest" style="flex:2;min-width:140px;">${TESTS.map(t=>`<option value="${t.id}">${t.name}</option>`).join("")}</select>
        <input id="goalVal" type="number" step="any" placeholder="target" style="flex:1;min-width:90px;">
        <button class="btn pri" id="goalSet">Set goal</button></div>`:""}
    </div>`;

    view.innerHTML = `${back}
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
        ${title}
        <button class="btn" id="pdfBtn"><span style="color:var(--brand)">⤓</span> Export PDF</button>
      </div>
      <div class="muted" style="font-size:13px;margin:6px 0 16px;">Last test ${fmtDate(latest.dateISO)} · ${sessions.length} session${sessions.length>1?"s":""}</div>
      ${compare}
      <div class="card fade" style="padding:18px;margin-bottom:18px;">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:8px;">
          <span class="muted" style="font-size:14px;">Trend</span>
          <select id="trendSel" style="width:auto;">${TESTS.map(t=>`<option value="${t.id}">${t.name}</option>`).join("")}</select>
        </div>
        <div style="position:relative;height:230px;"><canvas id="trend"></canvas></div>
      </div>
      <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(150px,1fr));margin-bottom:18px;">${cards}</div>
      ${goalsBlock}`;

    wireBack();
    document.getElementById("pdfBtn").onclick = ()=>openReport(name, sessions, goals);
    if(state.role==="coach"){
      document.getElementById("goalSet").onclick = ()=>{
        const tid = document.getElementById("goalTest").value;
        const val = parseFloat(document.getElementById("goalVal").value);
        if(!isNaN(val)) setGoal(state.targetId, tid, val);
      };
    }

    const drawTrend = (tid)=>{
      const t = testById(tid);
      const pts = sessions.filter(s=>s.results?.[tid]?.best!=null).map(s=>({ x:fmtDate(s.dateISO), y:s.results[tid].best }));
      if(chart) chart.destroy();
      chart = new window.Chart(document.getElementById("trend"), {
        type:"line",
        data:{ labels:pts.map(p=>p.x), datasets:[{ data:pts.map(p=>p.y), borderColor:"#9bd534", backgroundColor:"rgba(155,213,52,.12)", borderWidth:2.5, fill:true, tension:.35, pointRadius:4, pointBackgroundColor:"#9bd534" }] },
        options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{display:false}, title:{ display:true, text:(t.higher?"higher is better":"lower is better"), color:"#8f9a86", font:{size:11} } }, scales:{ x:{ grid:{color:"rgba(255,255,255,.06)"}, ticks:{color:"#8f9a86"} }, y:{ grid:{color:"rgba(255,255,255,.06)"}, ticks:{color:"#8f9a86"} } } }
      });
    };
    drawTrend(TESTS[0].id);
    document.getElementById("trendSel").onchange = (e)=>drawTrend(e.target.value);
  };

  const wireBack = ()=>{ const b=document.getElementById("back"); if(b) b.onclick=()=>navigate("team"); };

  view.innerHTML = `<div class="muted">Loading…</div>`;
  state.unsub.push(listenMeasurements(state.targetId, (arr, err)=>{
    if(err){ view.innerHTML = `<div class="err">Couldn't load data: ${esc(err.message)}</div>`; return; }
    sessions = arr; loadedM = true; draw();
  }));
  state.unsub.push(listenGoals(state.targetId, (g, err)=>{
    if(!err && g) goals = g; draw();
  }));
}

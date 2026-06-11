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

  // All-time personal best for a test, plus when it was set, whether it's brand
  // new this session, and how far it has come from the very first test.
  const pbInfo = (t)=>{
    const vals = sessions.filter(s=>s.results?.[t.id]?.best!=null)
      .map(s=>({ v:s.results[t.id].best, d:s.dateISO }));
    if(!vals.length) return null;
    let pb = vals[0];
    vals.forEach(x=>{ if(t.higher ? x.v>pb.v : x.v<pb.v) pb = x; });
    const latestDate = sessions[sessions.length-1].dateISO;
    let priorPB = null;
    vals.filter(x=>x.d!==latestDate).forEach(x=>{ if(priorPB===null || (t.higher ? x.v>priorPB : x.v<priorPB)) priorPB = x.v; });
    const isNew = pb.d===latestDate && priorPB!=null && (t.higher ? pb.v>priorPB : pb.v<priorPB);
    const first = vals[0].v;
    let improvePct = null;
    if(first && pb.v!=null) improvePct = r1(t.higher ? (pb.v-first)/Math.abs(first)*100 : (first-pb.v)/Math.abs(first)*100);
    return { best:pb.v, date:pb.d, isNew, improvePct };
  };

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

    // ---- personal bests ----
    const pbMap = {};
    TESTS.forEach(t=>{ pbMap[t.id] = pbInfo(t); });
    const newPBs = TESTS.filter(t=>pbMap[t.id] && pbMap[t.id].isNew);
    const badge = `<span style="background:linear-gradient(180deg,var(--brand2),var(--brand));color:var(--brandink);font-size:10px;font-weight:700;padding:2px 7px;border-radius:999px;margin-left:4px;letter-spacing:.03em;">NEW PB</span>`;
    const pbCards = TESTS.map(t=>{
      const p = pbMap[t.id];
      if(!p) return "";
      const imp = (p.improvePct!=null && p.improvePct>0.5) ? `<div style="font-size:11px;margin-top:3px;color:var(--up);">+${p.improvePct}% from first</div>` : "";
      return `<div class="mc"><div class="muted" style="font-size:13px;">${t.name}</div>
        <div style="display:flex;align-items:baseline;gap:5px;margin-top:2px;flex-wrap:wrap;"><span class="num" style="font-size:24px;font-weight:700;">${p.best}</span><span class="muted" style="font-size:12px;">${t.unit}</span>${p.isNew?badge:""}</div>
        <div class="muted" style="font-size:11px;margin-top:3px;">best · ${fmtDate(p.date)}</div>${imp}</div>`;
    }).join("");
    const pbBlock = `<div class="card fade" style="padding:18px;margin-bottom:18px;">
      <div class="disp" style="font-size:16px;margin-bottom:12px;">Personal bests</div>
      <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(150px,1fr));">${pbCards}</div>
    </div>`;

    const cards = TESTS.map(t=>{
      const res = latest.results?.[t.id];
      if(!res) return "";
      const sub = t.multi ? `avg ${res.avg} · ${t.higher?"higher":"lower"} better` : "single";
      return `<div class="mc"><div class="muted" style="font-size:13px;">${t.name}</div>
        <div style="display:flex;align-items:baseline;gap:5px;margin-top:2px;"><span class="num" style="font-size:26px;font-weight:700;">${res.best}</span><span class="muted" style="font-size:12px;">${t.unit}${t.multi?" best":""}</span></div>
        <div class="muted" style="font-size:12px;margin-top:3px;">${sub}</div></div>`;
    }).join("");

    const compare = prev ? `<div class="grid fade" style="grid-template-columns:repeat(auto-fit,minmax(230px,1fr));margin-bottom:18px;">
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

    const pbHeadline = newPBs.length ? ` · <span style="color:var(--brand);font-weight:600;">${newPBs.length} new PB${newPBs.length>1?"s":""} this session</span>` : "";

    view.innerHTML = `${back}
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
        ${title}
        <button class="btn" id="pdfBtn"><span style="color:var(--brand)">⤓</span> Export PDF</button>
      </div>
      <div class="muted" style="font-size:13px;margin:6px 0 16px;">Last test ${fmtDate(latest.dateISO)} · ${sessions.length} session${sessions.length>1?"s":""}${pbHeadline}</div>
      ${compare}
      ${pbBlock}
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
      const ss = sessions.filter(s=>s.results?.[tid]?.best!=null);
      const labels = ss.map(s=>fmtDate(s.dateISO));
      const ys = ss.map(s=>s.results[tid].best);
      const p = pbMap[tid];
      const pbVal = p ? p.best : null;
      const pointBg = ys.map(y=> (pbVal!=null && y===pbVal) ? "#ffd34d" : "#9bd534");
      const pointR  = ys.map(y=> (pbVal!=null && y===pbVal) ? 6 : 4);
      const datasets = [{ label:"Result", data:ys, borderColor:"#9bd534", backgroundColor:"rgba(155,213,52,.12)", borderWidth:2.5, fill:true, tension:.35, pointRadius:pointR, pointBackgroundColor:pointBg, pointBorderColor:pointBg }];
      if(pbVal!=null && ys.length>1){
        datasets.push({ label:"Personal best", data:ys.map(()=>pbVal), borderColor:"rgba(255,211,77,.85)", borderWidth:1.5, borderDash:[6,6], pointRadius:0, fill:false, tension:0 });
      }
      if(chart) chart.destroy();
      chart = new window.Chart(document.getElementById("trend"), {
        type:"line",
        data:{ labels, datasets },
        options:{ responsive:true, maintainAspectRatio:false,
          plugins:{
            legend:{ display: pbVal!=null && ys.length>1, labels:{ color:"#8f9a86", boxWidth:12, font:{size:11} } },
            title:{ display:true, text:(t.higher?"higher is better":"lower is better")+(pbVal!=null?` · PB ${pbVal}${t.unit}`:""), color:"#8f9a86", font:{size:11} } },
          scales:{ x:{ grid:{color:"rgba(255,255,255,.06)"}, ticks:{color:"#8f9a86"} }, y:{ grid:{color:"rgba(255,255,255,.06)"}, ticks:{color:"#8f9a86"} } } }
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

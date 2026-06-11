import { state, esc, avatar, fmtDate } from "../core.js";
import { TESTS, USERS } from "../config.js";
import { listenAllMeasurements } from "../data.js";

export function renderLeaderboard(){
  const view = document.getElementById("view");
  let all = [], testId = TESTS[0].id, mode = "best";   // mode: "best" | "latest"

  // Best (all-time) or latest value for one player on the current test.
  const valueFor = (uid)=>{
    const t = TESTS.find(x=>x.id===testId);
    const sess = all.filter(m=>String(m.uid)===String(uid) && m.results && m.results[testId] && m.results[testId].best!=null);
    if(!sess.length) return null;
    if(mode==="latest"){
      sess.sort((a,b)=>(a.dateISO||"").localeCompare(b.dateISO||""));
      const last = sess[sess.length-1];
      return { v:last.results[testId].best, d:last.dateISO };
    }
    let bestv = null, bd = null;
    sess.forEach(m=>{ const v=m.results[testId].best; if(bestv===null || (t.higher ? v>bestv : v<bestv)){ bestv=v; bd=m.dateISO; } });
    return { v:bestv, d:bd };
  };

  const draw = ()=>{
    const t = TESTS.find(x=>x.id===testId);

    const uids = Array.from(new Set(all.map(m=>String(m.uid))));
    let entries = uids.map(uid=>{
      const u = USERS.find(x=>String(x.id)===String(uid));
      if(u && u.role==="coach") return null;          // leaderboard is for players
      const r = valueFor(uid);
      if(!r) return null;
      return { uid, name: u ? u.name : ("#"+uid), photo: u && u.photo, v:r.v, d:r.d };
    }).filter(Boolean);

    entries.sort((a,b)=> t.higher ? b.v-a.v : a.v-b.v);
    let rank = 0, lastV = null;
    entries.forEach((e,i)=>{ if(lastV===null || e.v!==lastV){ rank = i+1; lastV = e.v; } e.rank = rank; });

    const have = new Set(entries.map(e=>String(e.uid)));
    const noData = USERS.filter(u=>u.role==="player" && !have.has(String(u.id)));

    const rows = entries.map(e=>{
      const me = String(e.uid)===String(state.user.id);
      const medal = e.rank===1?"#ffd34d":e.rank===2?"#cfd6dd":e.rank===3?"#e0a973":"var(--muted)";
      return `<div class="card" style="display:flex;align-items:center;gap:12px;padding:12px 14px;${me?'border-color:var(--brand);box-shadow:0 0 0 1px var(--brand) inset;':''}">
        <div style="width:26px;text-align:center;font-weight:700;font-size:16px;color:${medal};">${e.rank}</div>
        ${avatar(e.name, e.photo, 32)}
        <div style="flex:1;min-width:0;">
          <div class="disp" style="font-size:15px;">${esc(e.name)}${me?' <span class="muted" style="font-size:11px;">(you)</span>':''}</div>
          <div class="muted" style="font-size:11px;">${mode==="best"?"best":"latest"} · ${fmtDate(e.d)}</div>
        </div>
        <div style="text-align:right;white-space:nowrap;"><span class="num" style="font-size:20px;font-weight:700;${e.rank===1?'color:var(--brand);':''}">${e.v}</span> <span class="muted" style="font-size:12px;">${t.unit}</span></div>
      </div>`;
    }).join("");

    const noRows = noData.length
      ? `<div class="muted" style="font-size:12px;margin-top:12px;">No result yet: ${noData.map(u=>esc(u.name)).join(", ")}</div>`
      : "";

    view.innerHTML = `
      <div class="logo-txt" style="font-size:20px;margin-bottom:12px;">Team leaderboard</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;">
        ${TESTS.map(x=>`<span class="chip ${x.id===testId?"on":""}" data-test="${x.id}">${esc(x.name)}</span>`).join("")}
      </div>
      <div style="display:flex;gap:6px;align-items:center;margin-bottom:14px;flex-wrap:wrap;">
        <span class="chip ${mode==="best"?"on":""}" data-mode="best">All-time best</span>
        <span class="chip ${mode==="latest"?"on":""}" data-mode="latest">Latest</span>
        <span class="muted" style="font-size:11px;margin-left:auto;">${t.higher?"higher is better":"lower is better"}</span>
      </div>
      ${entries.length ? `<div style="display:flex;flex-direction:column;gap:8px;">${rows}</div>` : '<div class="muted">No results logged for this test yet.</div>'}
      ${noRows}`;

    view.querySelectorAll("[data-test]").forEach(el=>el.onclick=()=>{ testId = el.dataset.test; draw(); });
    view.querySelectorAll("[data-mode]").forEach(el=>el.onclick=()=>{ mode = el.dataset.mode; draw(); });
  };

  view.innerHTML = `<div class="muted">Loading leaderboard…</div>`;
  state.unsub.push(listenAllMeasurements((arr, err)=>{
    if(err){ view.innerHTML = `<div class="err">Couldn't load leaderboard: ${esc(err.message)}</div>`; return; }
    all = arr || []; draw();
  }));
}

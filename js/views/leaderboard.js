import { state, esc, avatar, fmtDate } from "../core.js";
import { TESTS } from "../config.js";
import { listenAllMeasurements, notify } from "../data.js";
import { cardFromSessions, overallOfSession } from "../rating.js";
import { listenLadder, saveLadder } from "../data.js";

export function renderLeaderboard(){
  const view = document.getElementById("view");
  const coach = state.role === "coach";
  let all = [], testId = TESTS[0].id, mode = "best";   // mode: "best" | "latest"
  let tab = "stats", ladder = null, sessionsByUid = {};

  const tabsHtml = ()=>`<div style="display:flex;gap:6px;margin-bottom:12px;"><span class="chip ${tab==="stats"?"on":""}" data-tab="stats">📊 Rankings</span><span class="chip ${tab==="challenge"?"on":""}" data-tab="challenge">⚔ Challenge</span></div>`;
  const wireTabs = ()=> view.querySelectorAll("[data-tab]").forEach(el=>el.onclick=()=>{ tab=el.dataset.tab; draw(); });
  const overallOf = id => cardFromSessions(sessionsByUid[String(id)]||[]).overall || 0;

  const ghost = (size)=>`<span style="width:${size}px;height:${size}px;border-radius:50%;background:rgba(255,255,255,.08);display:inline-flex;align-items:center;justify-content:center;color:var(--muted);font-size:13px;flex:0 0 auto;">?</span>`;

  // Best (all-time) or latest value for one player on the current test.
  const valueFor = (uid)=>{
    if(testId==="overall"){
      const ss = all.filter(m=>String(m.uid)===String(uid));
      if(!ss.length) return null;
      const sorted = ss.slice().sort((a,b)=>(a.dateISO||"").localeCompare(b.dateISO||""));
      const last = sorted[sorted.length-1];
      if(mode==="latest"){ const ov=overallOfSession(last.results); return ov==null?null:{ v:ov, d:last.dateISO }; }
      const ov = cardFromSessions(ss).overall; return ov==null?null:{ v:ov, d:last.dateISO };
    }
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

  const draw = ()=> tab==="challenge" ? renderChallenge() : renderStats();

  const renderStats = ()=>{
    const t = testId==="overall" ? { id:"overall", name:"Overall", unit:"OVR", higher:true } : TESTS.find(x=>x.id===testId);

    const uids = Array.from(new Set(all.map(m=>String(m.uid))));

    // crowns — the all-time leader of each test wears a 👑
    const crownsByUid = {};
    TESTS.forEach(tt=>{
      let lead=null, lv=null;
      uids.forEach(uid=>{
        const u=state.roster.find(x=>String(x.id)===String(uid)); if(u&&u.role==="coach") return;
        const sess=all.filter(m=>String(m.uid)===String(uid) && m.results && m.results[tt.id] && m.results[tt.id].best!=null);
        if(!sess.length) return;
        let bv=null; sess.forEach(m=>{ const v=m.results[tt.id].best; if(bv===null||(tt.higher?v>bv:v<bv)) bv=v; });
        if(lv===null || (tt.higher? bv>lv : bv<lv)){ lv=bv; lead=String(uid); }
      });
      if(lead){ (crownsByUid[lead]=crownsByUid[lead]||[]).push(tt.name); }
    });
    let entries = uids.map(uid=>{
      const u = state.roster.find(x=>String(x.id)===String(uid));
      if(u && u.role==="coach") return null;          // leaderboard is for players
      const r = valueFor(uid);
      if(!r) return null;
      return { uid, name: u ? u.name : ("#"+uid), photo: u && u.photo, v:r.v, d:r.d };
    }).filter(Boolean);

    entries.sort((a,b)=> t.higher ? b.v-a.v : a.v-b.v);
    let rank = 0, lastV = null;
    entries.forEach((e,i)=>{ if(lastV===null || e.v!==lastV){ rank = i+1; lastV = e.v; } e.rank = rank; });

    const have = new Set(entries.map(e=>String(e.uid)));
    const noData = state.roster.filter(u=>u.role==="player" && !have.has(String(u.id)));

    const rows = entries.map(e=>{
      const me = String(e.uid)===String(state.user.id);
      const medal = e.rank===1?"#ffd34d":e.rank===2?"#cfd6dd":e.rank===3?"#e0a973":"var(--muted)";
      // Coach sees everyone; a player sees only their own name — others are hidden.
      const showName = coach || me;
      const cr = crownsByUid[String(e.uid)] || [];
      const crowns = cr.length ? ` <span title="Leads: ${cr.map(esc).join(', ')}" style="font-size:12px;">${"👑".repeat(Math.min(cr.length,3))}${cr.length>3?"+"+(cr.length-3):""}</span>` : "";
      const nameHtml = (showName ? `${esc(e.name)}${me?' <span class="muted" style="font-size:11px;">(you)</span>':''}` : `<span class="muted">Player</span>`) + crowns;
      const av = showName ? avatar(e.name, e.photo, 32) : ghost(32);
      return `<div class="card" style="display:flex;align-items:center;gap:12px;padding:12px 14px;${me?'border-color:var(--brand);box-shadow:0 0 0 1px var(--brand) inset;':''}">
        <div style="width:26px;text-align:center;font-weight:700;font-size:16px;color:${medal};">${e.rank}</div>
        ${av}
        <div style="flex:1;min-width:0;">
          <div class="disp" style="font-size:15px;">${nameHtml}</div>
          <div class="muted" style="font-size:11px;">${mode==="best"?"best":"latest"} · ${fmtDate(e.d)}</div>
        </div>
        <div style="text-align:right;white-space:nowrap;"><span class="num" style="font-size:20px;font-weight:700;${e.rank===1?'color:var(--brand);':''}">${e.v}</span> <span class="muted" style="font-size:12px;">${t.unit}</span></div>
      </div>`;
    }).join("");

    let noRows = "";
    if(noData.length){
      noRows = coach
        ? `<div class="muted" style="font-size:12px;margin-top:12px;">No result yet: ${noData.map(u=>esc(u.name)).join(", ")}</div>`
        : `<div class="muted" style="font-size:12px;margin-top:12px;">${noData.length} teammate${noData.length>1?"s":""} haven't logged this test yet.</div>`;
    }

    const note = coach ? "" : `<div class="muted" style="font-size:12px;margin-bottom:10px;">Names are hidden — you can see the rankings and your own place.</div>`;

    view.innerHTML = `
      <div class="logo-txt" style="font-size:20px;margin-bottom:12px;">The Ladder</div>
      ${tabsHtml()}
      ${note}
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;">
        <span class="chip ${testId==="overall"?"on":""}" data-test="overall">⭐ Overall</span>
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
    wireTabs();
  };

  // ---------------- CHALLENGE LADDER ----------------
  const renderChallenge = ()=>{
    const players = state.roster.filter(u=>u.role==="player");
    const nameOf = id => { const u=players.find(p=>String(p.id)===String(id)); return u?u.name:("#"+id); };
    const photoOf = id => { const u=players.find(p=>String(p.id)===String(id)); return u&&u.photo; };
    // order: saved, else seed by Overall rating; append any newcomers
    let order = (ladder && Array.isArray(ladder.order)) ? ladder.order.filter(id=>players.some(p=>String(p.id)===String(id))) : null;
    if(!order) order = players.map(p=>String(p.id)).sort((a,b)=>overallOf(b)-overallOf(a));
    players.forEach(p=>{ if(!order.includes(String(p.id))) order.push(String(p.id)); });
    const pending = ladder && ladder.pending;
    const meId = String(state.user.id);
    const myIdx = order.indexOf(meId);

    const resolve = (winnerId)=>{
      const c=pending.challengerId, d=pending.defenderId;
      const next = order.slice();
      if(String(winnerId)===String(c)){ const ci=next.indexOf(String(c)), di=next.indexOf(String(d)); if(ci>=0&&di>=0){ next[ci]=String(d); next[di]=String(c); } }
      saveLadder({ order:next, pending:null }).catch(()=>{});
    };
    const challenge = (defenderId)=>{ saveLadder({ order, pending:{ challengerId:meId, defenderId:String(defenderId), ts:Date.now() } }).catch(()=>{}); notify("ladder", { opponentId:String(defenderId) }); };

    const rows = order.map((id,i)=>{
      const me = String(id)===meId;
      const aboveId = i>0 ? order[i-1] : null;
      const involved = pending && (String(pending.challengerId)===String(id) || String(pending.defenderId)===String(id));
      const medal = i===0?"#ffd34d":i===1?"#cfd6dd":i===2?"#e0a973":"var(--muted)";
      let action = "";
      if(!pending && me && aboveId){ action = `<button class="btn" data-chal="${esc(aboveId)}" style="padding:6px 11px;font-size:12px;">⚔ Challenge ${esc(nameOf(aboveId).split(" ")[0])}</button>`; }
      else if(pending && involved && (meId===String(pending.challengerId) || meId===String(pending.defenderId))){
        // either of the two players reports the winner
        action = `<div style="display:flex;gap:6px;flex-wrap:wrap;"><button class="btn pri" data-win="${esc(pending.challengerId)}" style="padding:5px 9px;font-size:11px;">${esc(nameOf(pending.challengerId).split(" ")[0])} won</button><button class="btn" data-win="${esc(pending.defenderId)}" style="padding:5px 9px;font-size:11px;">${esc(nameOf(pending.defenderId).split(" ")[0])} won</button></div>`;
      } else if(involved){ action = `<span class="muted" style="font-size:11px;">in a challenge…</span>`; }
      return `<div class="card" style="display:flex;align-items:center;gap:12px;padding:11px 13px;${me?'border-color:var(--brand);box-shadow:0 0 0 1px var(--brand) inset;':''}">
        <div style="width:24px;text-align:center;font-weight:700;font-size:16px;color:${medal};">${i+1}</div>
        ${avatar(nameOf(id), photoOf(id), 30)}
        <div style="flex:1;min-width:0;"><div class="disp" style="font-size:15px;">${esc(nameOf(id))}${me?' <span class="muted" style="font-size:11px;">(you)</span>':''}</div><div class="muted" style="font-size:11px;">OVR ${overallOf(id)||"—"}</div></div>
        ${action}
      </div>`;
    }).join("");

    const banner = pending
      ? `<div class="card" style="padding:12px 14px;margin-bottom:12px;border-color:var(--brand);"><span style="font-size:14px;">⚔ <b>${esc(nameOf(pending.challengerId))}</b> challenged <b>${esc(nameOf(pending.defenderId))}</b>.</span><div class="muted" style="font-size:12px;margin-top:3px;">Play it on court — then either player taps who won. Winner takes the higher rung.</div></div>`
      : `<div class="muted" style="font-size:12px;margin-bottom:12px;">Challenge the player one rung above you. Win on court, climb the ladder. Tap your own row to challenge up.</div>`;

    view.innerHTML = `
      <div class="logo-txt" style="font-size:20px;margin-bottom:12px;">The Ladder</div>
      ${tabsHtml()}
      ${banner}
      <div style="display:flex;flex-direction:column;gap:8px;">${rows}</div>
      ${coach&&pending?`<button class="btn" id="ladCancel" style="margin-top:12px;padding:6px 12px;font-size:12px;">Cancel the challenge</button>`:""}
      ${coach?`<button class="btn" id="ladReset" style="margin-top:12px;margin-left:8px;padding:6px 12px;font-size:12px;">Reset order to ratings</button>`:""}`;

    wireTabs();
    view.querySelectorAll("[data-chal]").forEach(el=>el.onclick=()=>challenge(el.dataset.chal));
    view.querySelectorAll("[data-win]").forEach(el=>el.onclick=()=>resolve(el.dataset.win));
    const cancel=document.getElementById("ladCancel"); if(cancel) cancel.onclick=()=>saveLadder({ pending:null }).catch(()=>{});
    const reset=document.getElementById("ladReset"); if(reset) reset.onclick=()=>{ const o=players.map(p=>String(p.id)).sort((a,b)=>overallOf(b)-overallOf(a)); saveLadder({ order:o, pending:null }).catch(()=>{}); };
  };

  view.innerHTML = `<div class="muted">Loading leaderboard…</div>`;
  state.unsub.push(listenAllMeasurements((arr, err)=>{
    if(err){ view.innerHTML = `<div class="err">Couldn't load leaderboard: ${esc(err.message)}</div>`; return; }
    all = arr || [];
    sessionsByUid = {};
    all.forEach(m=>{ const k=String(m.uid); (sessionsByUid[k]=sessionsByUid[k]||[]).push(m); });
    draw();
  }));
  state.unsub.push(listenLadder((l)=>{ ladder = l; if(tab==="challenge") draw(); }));
}

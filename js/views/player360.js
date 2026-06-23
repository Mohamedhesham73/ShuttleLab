import { state, esc, fmtDate, avatar, navigate } from "../core.js";
import { TESTS } from "../config.js";
import { cardFromSessions, tierColor, overallOfSession } from "../rating.js";
import {
  listenMeasurements, listenTraining, listenPlan, listenDrills,
  listenVideos, listenLadder, listenMyChannels, listenCoachChatAll, listenProgress
} from "../data.js";
import {
  uidForId, assignedStaff, trainingCountSince, ladderRank,
  assignedToPlayer, newest, lastTsForChannels, playerChannels
} from "./player360.data.js";

// ---- small card wrapper with an optional "open full view" link ----
function card(title, body, goView, goLabel){
  const link = goView
    ? `<span class="btn" data-p360go="${goView}" style="padding:4px 10px;font-size:11px;cursor:pointer;">${esc(goLabel || "Open ›")}</span>`
    : "";
  return `<div class="card fade" style="padding:18px;margin-bottom:18px;">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;gap:8px;">
      <span class="disp" style="font-size:16px;">${esc(title)}</span>${link}
    </div>${body}</div>`;
}

function buildHeader(u, name, sessions){
  const cardData = cardFromSessions(sessions || []);
  const tCol = tierColor(cardData.tier);
  const last = (sessions && sessions.length) ? sessions[sessions.length-1] : null;
  const lastDate = last ? fmtDate(last.dateISO) : "No test yet";
  let flag = "";
  if(sessions && sessions.length >= 2){
    const d = (overallOfSession(sessions[sessions.length-1].results) || 0)
            - (overallOfSession(sessions[sessions.length-2].results) || 0);
    if(d < 0) flag = `<span style="color:var(--down);font-size:13px;margin-left:8px;">▼ ${Math.abs(d)}</span>`;
    else if(d > 0) flag = `<span style="color:var(--up);font-size:13px;margin-left:8px;">▲ ${d}</span>`;
  }
  return `
    <button class="btn" id="p360back" style="padding:6px 12px;font-size:12px;margin-bottom:14px;">‹ Team</button>
    <div class="card fade" style="padding:20px;margin-bottom:18px;">
      <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;">
        ${avatar(name, u && u.photo, 48)}
        <div style="flex:1;min-width:0;">
          <div class="disp" style="font-size:24px;">${esc(name)}${flag}</div>
          <div class="muted" style="font-size:12px;margin-top:2px;">Last test · ${esc(lastDate)}</div>
        </div>
        <div style="text-align:center;">
          <div class="num" style="font-size:40px;font-weight:800;color:var(--brand);line-height:1;">${cardData.overall==null?"—":cardData.overall}</div>
          <div class="disp" style="font-size:11px;letter-spacing:.12em;color:${tCol};">${cardData.tier}</div>
        </div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px;">
        <span class="btn" data-p360go="dash" style="padding:6px 12px;font-size:12px;cursor:pointer;">Full test dashboard ›</span>
        <span class="btn" data-p360go="support" style="padding:6px 12px;font-size:12px;cursor:pointer;">Support ›</span>
        <span class="btn" data-p360go="library" style="padding:6px 12px;font-size:12px;cursor:pointer;">Library ›</span>
      </div>
    </div>`;
}

function buildChips(id, sessions, training, ladder, drills, videos){
  const cardData = cardFromSessions(sessions || []);
  const since = Date.now() - 30*864e5;
  const t30 = trainingCountSince(training, since);
  const rank = ladderRank(ladder, id);
  const dCount = assignedToPlayer(drills, id).length;
  const vCount = assignedToPlayer(videos, id).length;
  const chip = (label, val) => `<div style="flex:1;min-width:96px;border:1px solid var(--line);border-radius:10px;padding:10px 12px;">
    <div class="muted" style="font-size:11px;">${label}</div>
    <div class="num" style="font-size:20px;font-weight:700;margin-top:2px;">${val}</div></div>`;
  return `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px;">
    ${chip("Overall", cardData.overall==null?"—":cardData.overall)}
    ${chip("Train · 30d", t30)}
    ${chip("Ladder", rank==null?"—":"#"+rank)}
    ${chip("Drills", dCount)}
    ${chip("Films", vCount)}
  </div>`;
}

function buildTests(sessions){
  if(!sessions || !sessions.length){
    return card("Tests", `<div class="muted" style="font-size:13px;">No test sessions yet.</div>`, "dash", "Full dashboard ›");
  }
  const latest = sessions[sessions.length-1];
  const prev = sessions.length > 1 ? sessions[sessions.length-2] : null;
  const improved = [], declined = [];
  if(prev) TESTS.forEach(t => {
    const a = latest.results?.[t.id]?.best, b = prev.results?.[t.id]?.best;
    if(a==null || b==null || a===b) return;
    const better = t.higher ? a>b : a<b;
    const pct = b ? Math.abs((a-b)/b*100) : 0;
    (better ? improved : declined).push({ name:t.name, pct:Math.round(pct*10)/10 });
  });
  improved.sort((x,y) => y.pct-x.pct);
  declined.sort((x,y) => y.pct-x.pct);
  const top = (arr, col, sign, empty) => arr.length
    ? `<div style="display:flex;justify-content:space-between;font-size:14px;padding:2px 0;"><span>${esc(arr[0].name)}</span><span class="num" style="color:${col};">${sign}${arr[0].pct}%</span></div>`
    : `<span class="muted" style="font-size:13px;">${empty}</span>`;
  const body = prev
    ? `<div class="disp" style="color:var(--up);font-size:13px;margin-bottom:4px;">▲ Better</div>${top(improved,"var(--up)","+","—")}
       <div class="disp" style="color:var(--down);font-size:13px;margin:10px 0 4px;">◆ Focus</div>${top(declined,"var(--down)","","Nothing dropped 🎯")}`
    : `<span class="muted" style="font-size:13px;">First test logged — baseline only.</span>`;
  return card("Tests & athlete", body, "dash", "Full dashboard ›");
}

function buildTraining(training){
  const rows = (training || []).slice().sort((a,b) => (b.ts||0)-(a.ts||0)).slice(0,5);
  const body = rows.length
    ? rows.map(t => `<div style="padding:8px 0;border-top:1px solid var(--line);">
        <div class="muted" style="font-size:12px;">${esc(t.byName || "Coach")} · ${esc(fmtDate(t.dateISO))}</div>
        <div style="font-size:14px;white-space:pre-wrap;">${esc(t.text || "")}</div></div>`).join("")
    : `<div class="muted" style="font-size:13px;">No training logged yet.</div>`;
  return card("Training log", body, "train", "Open ›");
}

function buildPlan(plan){
  const target = plan && plan.target;
  const blocks = (plan && Array.isArray(plan.blocks)) ? plan.blocks : [];
  const tgt = target
    ? `<div style="border-left:3px solid var(--brand);padding:6px 12px;margin-bottom:10px;">
        <div class="muted" style="font-size:11px;margin-bottom:2px;">Season target</div>
        <div style="font-size:14px;line-height:1.5;white-space:pre-wrap;">${esc(target)}</div></div>`
    : `<div class="muted" style="font-size:13px;margin-bottom:10px;">No season target set.</div>`;
  const ph = blocks.length
    ? `<div class="muted" style="font-size:11px;margin-bottom:4px;">Phases</div>` +
      blocks.slice(0,4).map(b => `<div style="display:flex;justify-content:space-between;font-size:13px;padding:2px 0;">
        <span>${esc(b.title || "")}</span><span class="muted">${esc(b.start || "")}${b.end ? " → " + esc(b.end) : ""}</span></div>`).join("")
    : `<div class="muted" style="font-size:13px;">No phases yet.</div>`;
  return card("Season plan", tgt + ph, "train", "Open ›");
}

export function renderPlayer360(){
  const view = document.getElementById("view");
  // coach-only: anyone else falls back to their own dashboard
  if(state.role !== "coach"){
    navigate("dash", { targetId:String(state.user.id), targetName:state.name });
    return;
  }
  const id = String(state.targetId);
  const u = state.roster.find(x => String(x.id) === id);
  const name = (u && u.name) || state.targetName || "Player";
  const playerUid = uidForId(state.roster, id);

  // live state, filled by listeners below
  let sessions = [], training = [], plan = null, drills = [], videos = [],
      ladder = null, channels = [], chats = [], progress = [];

  const draw = () => {
    view.innerHTML =
      buildHeader(u, name, sessions) +
      buildChips(id, sessions, training, ladder, drills, videos) +
      buildTests(sessions) +
      buildTraining(training) +
      buildPlan(plan);
    wire();
  };

  const wire = () => {
    const b = document.getElementById("p360back");
    if(b) b.onclick = () => navigate("team");
    view.querySelectorAll("[data-p360go]").forEach(el => {
      el.onclick = () => navigate(el.dataset.p360go, { targetId:id, targetName:name });
    });
  };

  view.innerHTML = `<div class="muted">Loading player…</div>`;
  draw();

  state.unsub.push(listenMeasurements(id, (arr, err) => {
    if(!err){ sessions = (arr || []).slice().sort((a,b) => (a.dateISO||"").localeCompare(b.dateISO||"")); draw(); }
  }));
  state.unsub.push(listenTraining(id, (arr, err) => { if(!err){ training = arr || []; draw(); } }));
  state.unsub.push(listenDrills((arr, err) => { if(!err){ drills = arr || []; draw(); } }));
  state.unsub.push(listenVideos((arr, err) => { if(!err){ videos = arr || []; draw(); } }));
  state.unsub.push(listenLadder((d, err) => { if(!err){ ladder = d || null; draw(); } }));
  state.unsub.push(listenPlan(id, (p, err) => { if(!err){ plan = p || null; draw(); } }));
}

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
    view.innerHTML = buildHeader(u, name, sessions);
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
}

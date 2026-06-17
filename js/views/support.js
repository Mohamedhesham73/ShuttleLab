import { state, esc, autoGrow } from "../core.js";
import {
  loadMembers, setStaffMember, provisionChannels,
  listenMyChannels, listenChat, sendChat, listenProgress, addProgress, notify
} from "../data.js";

const TYPE_LABEL = {
  coach_mental:  "🔒 With the coach (private)",
  mental_player: "Mental coach",
  coach_fitness: "Coach ↔ trainer",
  fitness_player:"Fitness trainer"
};

// Render a live chat for one channel into `el`. Returns an unsubscribe fn.
function mountChat(el, channel){
  el.innerHTML = `
    <div id="chatList" style="display:flex;flex-direction:column;gap:6px;max-height:46vh;overflow:auto;padding:4px 2px;"></div>
    <div style="display:flex;gap:8px;align-items:flex-end;margin-top:8px;">
      <textarea id="chatIn" rows="1" placeholder="Message…" style="flex:1;resize:none;overflow:hidden;"></textarea>
      <button class="btn pri" id="chatSend" style="padding:9px 14px;">Send</button>
    </div>`;
  const list = el.querySelector("#chatList"), input = el.querySelector("#chatIn");
  autoGrow(input);
  const canPost = channel.members.includes(String(state.uid));
  if(!canPost){ input.disabled=true; input.placeholder="You can read this conversation but not post in it."; el.querySelector("#chatSend").style.display="none"; }
  const unsub = listenChat(channel.id, state.uid, (msgs, err)=>{
    if(err){ list.innerHTML=`<div class="err">${esc(err.message)}</div>`; return; }
    list.innerHTML = (msgs||[]).map(m=>{
      const mine = String(m.fromUid)===String(state.uid);
      return `<div style="align-self:${mine?"flex-end":"flex-start"};max-width:80%;background:${mine?"var(--brand)":"var(--line)"};color:${mine?"#0b1410":"inherit"};padding:7px 11px;border-radius:12px;font-size:14px;white-space:pre-wrap;">${esc(m.text)}</div>`;
    }).join("") || `<div class="muted" style="font-size:12px;">No messages yet.</div>`;
    list.scrollTop = list.scrollHeight;
  });
  const send = async ()=>{ const t=input.value.trim(); if(!t) return; input.value=""; autoGrow(input); try{ await sendChat(channel, state.uid, t); notify("chat", { channelId: channel.id }); }catch(e){ alert("Couldn't send: "+(e.message||e)); } };
  el.querySelector("#chatSend").onclick = send;
  return unsub;
}

export function renderSupport(){
  const r = state.role;
  if(r==="mental_coach" || r==="fitness_trainer") return renderStaffView();
  if(r==="player") return renderPlayerView();
  return renderCoachSupport();
}

// A reusable "list of my channels, click one to open the chat" screen.
function channelListScreen(title, subtitle, filterTypes){
  const view = document.getElementById("view");
  view.innerHTML = `
    <div class="disp" style="font-size:18px;margin-bottom:4px;">${esc(title)}</div>
    <div class="muted" style="font-size:13px;margin-bottom:14px;">${esc(subtitle)}</div>
    <div id="supList"><div class="muted">Loading…</div></div>
    <div id="supChat"></div>`;
  let chatUnsub = null;
  const open = (ch)=>{
    if(chatUnsub){ chatUnsub(); chatUnsub=null; }
    const other = state.role==="player" ? ch.staffName : ch.playerName;
    const host = document.getElementById("supChat");
    host.innerHTML =
      `<div class="card" style="padding:14px;margin-top:14px;">
         <div class="disp" style="font-size:15px;margin-bottom:10px;">${esc(TYPE_LABEL[ch.type]||"Chat")} · ${esc(other||"")}</div>
         <div id="chatMount"></div>
       </div>
       ${(ch.type==="fitness_player") ? `<div class="card" style="padding:14px;margin-top:12px;"><div class="disp" style="font-size:15px;margin-bottom:10px;">Fitness progress</div><div id="progMount"></div></div>`:""}`;
    chatUnsub = mountChat(document.getElementById("chatMount"), ch);
    if(ch.type==="fitness_player") mountProgress(document.getElementById("progMount"), ch.playerUid, ch);
  };
  state.unsub.push(listenMyChannels(state.uid, (chans, err)=>{
    const el=document.getElementById("supList"); if(!el) return;
    if(err){ el.innerHTML=`<div class="err">${esc(err.message)}</div>`; return; }
    const list = (chans||[]).filter(c=>filterTypes.includes(c.type));
    if(!list.length){ el.innerHTML=`<div class="muted" style="font-size:13px;">Nothing here yet.</div>`; return; }
    el.innerHTML = list.map(c=>{
      const label = state.role==="player" ? (TYPE_LABEL[c.type]) : (c.playerName||"Player");
      const sub = state.role==="player" ? (c.staffName||"") : (TYPE_LABEL[c.type]);
      return `<div data-ch="${esc(c.id)}" style="display:flex;justify-content:space-between;align-items:center;padding:11px 13px;border:1px solid var(--line);border-radius:10px;margin-bottom:8px;cursor:pointer;">
        <div><div style="font-size:14px;">${esc(label)}</div><div class="muted" style="font-size:12px;">${esc(sub)}</div></div><span class="muted">›</span></div>`;
    }).join("");
    el.querySelectorAll("[data-ch]").forEach(row=>row.onclick=()=>{ const c=list.find(x=>x.id===row.dataset.ch); if(c) open(c); });
  }));
}

function renderStaffView(){
  const role = state.role==="mental_coach" ? "mental coach" : "fitness trainer";
  const types = state.role==="mental_coach" ? ["coach_mental","mental_player"] : ["coach_fitness","fitness_player"];
  channelListScreen("My players", "You're the "+role+". Tap a conversation to open it.", types);
}

function renderPlayerView(){
  channelListScreen("My team", "Your mental coach and fitness trainer.",
    ["mental_player","coach_fitness","fitness_player"]);
}

async function renderCoachSupport(){
  const view = document.getElementById("view");
  view.innerHTML = `
    <div class="disp" style="font-size:18px;margin-bottom:4px;">Support staff</div>
    <div class="muted" style="font-size:13px;margin-bottom:14px;">Assign each mental coach / fitness trainer to players. Assigning provisions their private channels.</div>
    <div id="staffList"><div class="muted">Loading…</div></div>
    <div id="coachChat"></div>`;
  const members = await loadMembers();
  const players = members.filter(m=>m.role==="player");
  const staff   = members.filter(m=>m.role==="mental_coach" || m.role==="fitness_trainer");
  const el = document.getElementById("staffList");
  if(!staff.length){ el.innerHTML=`<div class="muted" style="font-size:13px;">No support accounts yet. Create their logins in Firebase, set their <code>role</code> to <code>mental_coach</code> or <code>fitness_trainer</code> in <code>members</code>, then they'll appear here to assign.</div>`; }
  else el.innerHTML = staff.map(s=>{
    const assigned = new Set((s.assigned||[]).map(String));
    return `<div class="card" style="padding:14px;margin-bottom:12px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <div><b>${esc(s.name)}</b> <span class="muted" style="font-size:12px;">· ${s.role==="mental_coach"?"Mental coach":"Fitness trainer"}</span></div>
      </div>
      <div style="display:flex;gap:7px;flex-wrap:wrap;">
        ${players.map(p=>`<span class="chip ${assigned.has(String(p.id))?"on":""}" data-staff="${esc(s.uid)}" data-player="${esc(p.uid)}">${esc(p.name)}</span>`).join("")}
      </div>
    </div>`;
  }).join("");

  el.querySelectorAll("[data-player]").forEach(chip=>chip.onclick=async ()=>{
    const sUid=chip.dataset.staff, pUid=chip.dataset.player;
    const s=staff.find(x=>x.uid===sUid), p=players.find(x=>x.uid===pUid);
    const on = !chip.classList.contains("on"); chip.classList.toggle("on",on);
    const assigned = new Set((s.assigned||[]).map(String));
    if(on) assigned.add(String(pUid)); else assigned.delete(String(pUid));
    s.assigned = [...assigned];
    try{
      await setStaffMember(sUid, { assigned:s.assigned });
      if(on) await provisionChannels(state.uid, { uid:p.uid, name:p.name }, { uid:s.uid, name:s.name, role:s.role });
      if(on) notify("assign", { playerId: p.uid, staffId: s.uid });
    }catch(e){ chip.classList.toggle("on",!on); alert("Couldn't save: "+(e.message||e)); }
  });

  let chatUnsub=null;
  state.unsub.push(listenMyChannels(state.uid, (chans, err)=>{
    const box=document.getElementById("coachChat"); if(!box) return;
    if(err){ box.innerHTML=`<div class="err">${esc(err.message)}</div>`; return; }
    const byPlayer={};
    (chans||[]).forEach(c=>{ (byPlayer[c.playerName||c.playerUid] ||= []).push(c); });
    box.innerHTML = `<div class="disp" style="font-size:15px;margin:18px 0 10px;">All conversations</div>` +
      Object.keys(byPlayer).map(name=>`<div style="margin-bottom:10px;"><div class="muted" style="font-size:12px;margin-bottom:5px;">${esc(name)}</div>${
        byPlayer[name].map(c=>`<span class="chip" data-open="${esc(c.id)}" style="margin:0 6px 6px 0;">${esc(TYPE_LABEL[c.type]||c.type)}</span>`).join("")
      }</div>`).join("") + `<div id="coachChatMount"></div>`;
    box.querySelectorAll("[data-open]").forEach(ch=>ch.onclick=()=>{
      const c=(chans||[]).find(x=>x.id===ch.dataset.open); if(!c) return;
      if(chatUnsub){ chatUnsub(); chatUnsub=null; }
      const mount=document.getElementById("coachChatMount");
      mount.innerHTML=`<div class="card" style="padding:14px;margin-top:10px;"><div class="disp" style="font-size:15px;margin-bottom:10px;">${esc(TYPE_LABEL[c.type])} · ${esc(c.playerName)}</div><div id="cMount"></div></div>`;
      chatUnsub = mountChat(document.getElementById("cMount"), c);
    });
  }));
}

// Renders a progress timeline for `playerUid` into `el`. If `fitnessChannel`
// is provided AND the viewer is its trainer, shows a compose box.
function mountProgress(el, playerUid, fitnessChannel){
  const canPost = fitnessChannel && fitnessChannel.members.includes(String(state.uid)) && state.role==="fitness_trainer";
  el.innerHTML = `
    ${canPost ? `<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:12px;">
      <input id="progTitle" type="text" placeholder="Progress title (e.g. Week 4 — endurance)">
      <textarea id="progNote" rows="2" placeholder="What improved, numbers, next focus…" style="resize:none;overflow:hidden;"></textarea>
      <button class="btn pri" id="progAdd" style="align-self:flex-start;padding:8px 14px;">Add entry</button>
    </div>`:""}
    <div id="progList"><div class="muted" style="font-size:12px;">Loading…</div></div>`;
  if(canPost){
    autoGrow(el.querySelector("#progNote"));
    el.querySelector("#progAdd").onclick = async ()=>{
      const t=el.querySelector("#progTitle").value.trim(), n=el.querySelector("#progNote").value.trim();
      if(!t && !n) return;
      try{ await addProgress(fitnessChannel, state.uid, t, n); notify("progress", { channelId: fitnessChannel.id }); el.querySelector("#progTitle").value=""; el.querySelector("#progNote").value=""; autoGrow(el.querySelector("#progNote")); }
      catch(e){ alert("Couldn't save: "+(e.message||e)); }
    };
  }
  state.unsub.push(listenProgress(playerUid, state.uid, (rows, err)=>{
    const list=el.querySelector("#progList"); if(!list) return;
    if(err){ list.innerHTML=`<div class="err">${esc(err.message)}</div>`; return; }
    list.innerHTML = (rows||[]).length ? rows.map(p=>`
      <div style="border:1px solid var(--line);border-left:3px solid var(--brand);border-radius:10px;padding:10px 12px;margin-bottom:8px;">
        <div class="muted" style="font-size:11px;">${new Date(p.ts).toLocaleDateString()}</div>
        ${p.title?`<div style="font-size:14px;font-weight:500;">${esc(p.title)}</div>`:""}
        ${p.note?`<div style="font-size:13px;white-space:pre-wrap;line-height:1.5;">${esc(p.note)}</div>`:""}
      </div>`).join("") : `<div class="muted" style="font-size:12px;">No progress logged yet.</div>`;
  }));
}

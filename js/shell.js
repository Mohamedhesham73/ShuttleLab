import { state, navigate, avatar, clearUnsub } from "./core.js";
import { signOutUser } from "./auth.js";
import { pushState, enablePush, disablePush } from "./push.js";

export function logout(){
  clearUnsub();
  state.user = null;
  if(state._render) state._render();
  signOutUser().catch(()=>{});
}

const roleLabel = r => ({ coach:"Coach", player:"Player", mental_coach:"Mental coach", fitness_trainer:"Fitness trainer" })[r] || r;

export function header(){
  const staff = state.role==="mental_coach" || state.role==="fitness_trainer";
  const tabs = staff
    ? [["support","My players"]]
    : state.role==="coach"
    ? [["team","Squad"],["train","Game Plan"],["library","Court Lab"],["matches","Film Room"],["board","Ladder"],["mind","Mind Room"],["support","Support"]]
    : [["dash","Progress"],["log","Testing"],["train","Game Plan"],["library","Court Lab"],["matches","Film Room"],["board","Ladder"],["mind","Mind Room"],["support","My team"]];
  return `<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
    <div class="brand"><span class="logo-txt" style="font-size:22px;">Shuttle<b>Lab</b></span></div>
    <div style="display:flex;align-items:center;gap:10px;">
      <span class="pill">${avatar(state.name, state.user.photo, 26)}<span class="disp">${state.name}</span><span class="disp muted" style="font-size:11px;">· ${roleLabel(state.role)}</span></span>
      <button class="btn" id="pushToggle" title="Notifications" style="padding:7px 10px;font-size:13px;">🔔</button>
      <button class="btn" style="padding:7px 12px;font-size:12px;" id="logout">Sign out</button>
    </div>
  </div>
  <div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap;">
    ${tabs.map(([k,l])=>`<span class="tab ${state.view===k?"on":""}" data-go="${k}">${l}</span>`).join("")}
  </div>`;
}

export function wireShell(){
  const lo = document.getElementById("logout");
  if(lo) lo.onclick = logout;
  const pb = document.getElementById("pushToggle");
  if(pb){
    pushState().then(s=>{ pb.style.opacity = s==="on" ? "1" : "0.45"; pb.title = s==="on" ? "Notifications on" : "Turn on notifications"; });
    pb.onclick = async ()=>{
      const s = await pushState();
      if(s === "on"){ await disablePush(); pb.style.opacity="0.45"; pb.title="Turn on notifications"; return; }
      const r = await enablePush();
      if(r.ok){ pb.style.opacity="1"; pb.title="Notifications on"; }
      else if(r.reason==="ios-install") alert("Open ShuttleLab from your Home Screen icon to turn on notifications.");
      else if(r.reason==="denied") alert("Notifications are blocked. Enable them for this app in your phone's settings.");
      else alert("Notifications aren't available on this device/browser.");
    };
  }
  document.querySelectorAll("[data-go]").forEach(el=>{
    el.onclick = ()=>{
      const v = el.dataset.go;
      if(v==="dash") navigate("dash", { targetId:String(state.user.id), targetName:state.name });
      else navigate(v);
    };
  });
}

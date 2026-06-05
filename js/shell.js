import { state, navigate, avatar, clearUnsub } from "./core.js";

export function logout(){
  try{ localStorage.removeItem("sl_uid"); }catch(e){}
  clearUnsub();
  state.user = null;
  if(state._render) state._render();
}

export function header(){
  const tabs = state.role==="coach"
    ? [["team","Team"],["log","Log"],["train","Training"],["library","Library"]]
    : [["dash","Dashboard"],["log","Log"],["train","Training"],["library","Library"]];
  return `<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
    <div class="brand"><span class="logo-txt" style="font-size:22px;">Shuttle<b>Lab</b></span></div>
    <div style="display:flex;align-items:center;gap:10px;">
      <span class="pill">${avatar(state.name, state.user.photo, 26)}<span class="disp">${state.name}</span><span class="disp muted" style="font-size:11px;">· ${state.role}</span></span>
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
  document.querySelectorAll("[data-go]").forEach(el=>{
    el.onclick = ()=>{
      const v = el.dataset.go;
      if(v==="dash") navigate("dash", { targetId:String(state.user.id), targetName:state.name });
      else navigate(v);
    };
  });
}

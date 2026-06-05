import { state, clearUnsub } from "./core.js";
import { USERS } from "./config.js";
import { header, wireShell } from "./shell.js";
import { renderLogin } from "./views/login.js";
import { renderDashboard } from "./views/dashboard.js";
import { renderTeam } from "./views/team.js";
import { renderLog } from "./views/log.js";
import { renderTraining } from "./views/training.js";
import { renderLibrary } from "./views/library.js";

const VIEWS = {
  dash: renderDashboard,
  team: renderTeam,
  log: renderLog,
  train: renderTraining,
  library: renderLibrary
};

function renderApp(){
  clearUnsub();
  if(!state.user){ renderLogin(); return; }
  document.getElementById("root").innerHTML =
    `<div class="wrap">${header()}<div id="view" style="margin-top:22px;"></div></div>`;
  wireShell();
  (VIEWS[state.view] || renderDashboard)();
}

// Let any module trigger a re-render via navigate()/login/logout.
state._render = renderApp;

// Restore the last signed-in user (kept in this browser only).
(function boot(){
  let id = null;
  try{ id = localStorage.getItem("sl_uid"); }catch(e){}
  const u = id ? USERS.find(x=>String(x.id)===String(id)) : null;
  if(u){
    state.user = u; state.role = u.role; state.name = u.name;
    state.view = u.role==="coach" ? "team" : "dash";
    state.targetId = String(u.id); state.targetName = u.name;
  }
  renderApp();
})();

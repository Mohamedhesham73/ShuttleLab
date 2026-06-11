import { state, clearUnsub } from "./core.js";
import { watchAuth, userFromEmail, signOutUser } from "./auth.js";
import { header, wireShell } from "./shell.js";
import { renderLogin } from "./views/login.js";
import { renderDashboard } from "./views/dashboard.js";
import { renderTeam } from "./views/team.js";
import { renderLog } from "./views/log.js";
import { renderTraining } from "./views/training.js";
import { renderLibrary } from "./views/library.js";
import { renderMatches } from "./views/matches.js";

const VIEWS = {
  dash: renderDashboard,
  team: renderTeam,
  log: renderLog,
  train: renderTraining,
  library: renderLibrary,
  matches: renderMatches
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

// Real auth gate. We render only after Firebase tells us who (if anyone) is
// signed in. Firebase keeps the session in this browser, so refreshes stay
// logged in — no manual localStorage handling needed.
watchAuth((fbUser)=>{
  if(fbUser){
    const u = userFromEmail(fbUser.email);
    if(!u){ signOutUser(); return; }   // signed in, but not on the roster → reject
    const fresh = !state.user || String(state.user.id) !== String(u.id);
    state.user = u; state.role = u.role; state.name = u.name;
    state.targetId = String(u.id); state.targetName = u.name;
    if(fresh) state.view = u.role==="coach" ? "team" : "dash";
    renderApp();
  }else{
    clearUnsub();
    state.user = null;
    renderApp();
  }
});

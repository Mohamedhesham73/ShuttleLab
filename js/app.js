import { state, clearUnsub } from "./core.js";
import { watchAuth, signOutUser } from "./auth.js";
import { loadMembers } from "./data.js";
import { header, wireShell } from "./shell.js";
import { renderLogin } from "./views/login.js";
import { renderDashboard } from "./views/dashboard.js";
import { renderTeam } from "./views/team.js";
import { renderLog } from "./views/log.js";
import { renderTraining } from "./views/training.js";
import { renderLibrary } from "./views/library.js";
import { renderMatches } from "./views/matches.js";
import { renderLeaderboard } from "./views/leaderboard.js";
import { renderMindRoom } from "./views/mindroom.js";

const VIEWS = {
  dash: renderDashboard,
  team: renderTeam,
  log: renderLog,
  train: renderTraining,
  library: renderLibrary,
  matches: renderMatches,
  board: renderLeaderboard,
  mind: renderMindRoom
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
watchAuth(async (fbUser)=>{
  if(fbUser){
    // Load the roster from Firestore (protected: only signed-in users can read it),
    // then figure out who this account is by matching their Auth UID.
    let members;
    try{
      members = await loadMembers();
    }catch(e){
      console.error("Couldn't load the team roster from Firestore:", e);
      signOutUser(); return;
    }
    state.roster = members.map(m=>({ id:m.id, name:m.name, role:m.role, photo:m.photo }));

    const me = members.find(m=>m.uid === fbUser.uid);
    if(!me){ console.error("Signed-in account has no 'members' doc (UID "+fbUser.uid+")."); signOutUser(); return; }

    const u = { id:me.id, name:me.name, role:me.role, photo:me.photo };
    const fresh = !state.user || String(state.user.id) !== String(u.id);
    state.user = u; state.uid = fbUser.uid; state.role = u.role; state.name = u.name;
    state.targetId = String(u.id); state.targetName = u.name;
    if(fresh) state.view = u.role==="coach" ? "team" : "dash";
    renderApp();
  }else{
    clearUnsub();
    state.user = null; state.uid = null; state.roster = [];
    renderApp();
  }
});

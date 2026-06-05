import { state } from "../core.js";
import { USERS } from "../config.js";

export function renderLogin(){
  const root = document.getElementById("root");
  root.innerHTML = `<div class="center" style="background:linear-gradient(rgba(8,10,9,.80),rgba(8,10,9,.93)),url('cover.png') center/cover no-repeat;">
    <div class="card fade" style="padding:30px;max-width:400px;width:100%;">
      <div style="text-align:center;margin-bottom:22px;">
        <img src="logo.png" alt="ShuttleLab" style="max-width:260px;width:100%;height:auto;" onerror="this.style.display='none';document.getElementById('lf').style.display='block'">
        <div id="lf" style="display:none;">
          <span class="logo-txt">Shuttle<b>Lab</b></span>
          <div class="tag" style="margin-top:5px;">Measure. Improve. Dominate.</div>
        </div>
      </div>
      <label>Email</label>
      <input id="email" type="email" autocomplete="username" placeholder="you@email.com" />
      <div style="height:12px"></div>
      <label>Password</label>
      <input id="pw" type="password" autocomplete="current-password" placeholder="••••••••" />
      <div id="loginErr" class="err"></div>
      <button class="btn pri" id="loginBtn" style="width:100%;margin-top:16px;">Sign in</button>
    </div>
  </div>`;

  const go = ()=>{
    const email = document.getElementById("email").value.trim().toLowerCase();
    const pw = document.getElementById("pw").value;
    const errEl = document.getElementById("loginErr");
    errEl.textContent = "";
    if(!email || !pw){ errEl.textContent = "Enter your email and password."; return; }
    const u = USERS.find(x=>x.email.toLowerCase()===email && x.password===pw);
    if(!u){ errEl.textContent = "Wrong email or password."; return; }
    try{ localStorage.setItem("sl_uid", String(u.id)); }catch(e){}
    state.user = u; state.role = u.role; state.name = u.name;
    state.view = u.role==="coach" ? "team" : "dash";
    state.targetId = String(u.id); state.targetName = u.name;
    if(state._render) state._render();
  };
  document.getElementById("loginBtn").onclick = go;
  document.getElementById("pw").addEventListener("keydown", e=>{ if(e.key==="Enter") go(); });
}

import { signIn } from "../auth.js";

function authErr(e){
  const c = (e && e.code) || "";
  if(c.includes("invalid-credential") || c.includes("wrong-password") || c.includes("user-not-found"))
    return "Wrong email or password.";
  if(c.includes("invalid-email"))      return "That doesn't look like a valid email.";
  if(c.includes("too-many-requests"))  return "Too many tries — wait a minute, then try again.";
  if(c.includes("network"))            return "Network problem — check your connection.";
  if(c.includes("user-disabled"))      return "This account has been disabled.";
  return "Couldn't sign in. " + ((e && e.message) || "");
}

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

  const go = async ()=>{
    const email = document.getElementById("email").value.trim().toLowerCase();
    const pw = document.getElementById("pw").value;
    const errEl = document.getElementById("loginErr");
    const btn = document.getElementById("loginBtn");
    errEl.textContent = "";
    if(!email || !pw){ errEl.textContent = "Enter your email and password."; return; }
    btn.disabled = true; const label = btn.textContent; btn.textContent = "Signing in…";
    try{
      await signIn(email, pw);
      // app.js is watching auth state — it sets up the app and re-renders.
    }catch(e){
      btn.disabled = false; btn.textContent = label;
      errEl.textContent = authErr(e);
    }
  };
  document.getElementById("loginBtn").onclick = go;
  document.getElementById("pw").addEventListener("keydown", e=>{ if(e.key==="Enter") go(); });
  document.getElementById("email").addEventListener("keydown", e=>{ if(e.key==="Enter") document.getElementById("pw").focus(); });
}

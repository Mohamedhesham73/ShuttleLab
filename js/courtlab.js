// =============================================================
//  COURT LAB — the unified, BWF-accurate court engine.
//  One drill is stored as 3D court data (metres) and can be
//  watched from three projections: bird's-eye, side, front.
//
//  mountCourtLab(container, opts) → { getPoints, hasShots, getView, destroy }
//    opts.points   saved steps (or undefined for new)
//    opts.mode     "edit" | "play"
//    opts.category "singles" | "doubles" | "mixed"
//    opts.view     "bird" | "side" | "front"   (switchable live)
//    opts.feed     "drill" | "multi"           (multi = coach-fed multi-shuttle)
//
//  Real dimensions (Laws of Badminton): court 13.40 × 6.10 m,
//  singles sidelines 0.46 m in, net 1.524 m centre / 1.55 m posts,
//  short service line 1.98 m from net, doubles long service line
//  0.76 m in from the baseline, lines 40 mm wide. Serve struck
//  below 1.15 m, lands in the diagonal service court.
// =============================================================

const CT = {
  W:6.1, L:13.4, NET:6.7,
  SSLA:4.72, SSLB:8.68,        // short service lines
  DLSA:0.76, DLSB:12.64,       // doubles long service lines
  SIN:0.46, SXL:5.64, CX:3.05, // singles sidelines, centre line
  NETH:1.55, NETC:1.524, NETB:0.76, LW:0.04
};

// Shot library. z0 = contact height (m), h = extra arc height, dur = flight s.
// serve:true → target validated against the legal diagonal service court.
const SHOTS = {
  servelow: { name:"Low serve",        grp:"Serves",    serve:true, z0:1.05, h:0.18, dur:1.0,  tip:"Skim the tape; land just past the short service line. Takes the attack away." },
  servehigh:{ name:"High serve",       grp:"Serves",    serve:true, z0:1.05, h:6.0,  dur:2.4,  tip:"Singles weapon — push them to the very back; the shuttle drops vertically." },
  serveflick:{name:"Flick serve",      grp:"Serves",    serve:true, z0:1.05, h:2.6,  dur:1.3,  tip:"Surprise over a rushing receiver — back of the box. Use sparingly." },
  servedrive:{name:"Drive serve",      grp:"Serves",    serve:true, z0:1.05, h:0.7,  dur:0.8,  tip:"Flat and fast at the shoulder. Risky — situational." },
  clear:    { name:"Clear (defensive)",grp:"Rear court", z0:2.7, h:4.6, dur:1.7, def:true,  tip:"High and deep to the baseline — buys time to recover." },
  attclear: { name:"Attacking clear",  grp:"Rear court", z0:2.7, h:2.2, dur:1.1,            tip:"Flatter, behind their racket shoulder — steals their time." },
  drop:     { name:"Drop shot",        grp:"Rear court", z0:2.7, h:0.3, dur:1.4,            tip:"Rear court to front court — land it before the short service line." },
  fastdrop: { name:"Fast drop / cut",  grp:"Rear court", z0:2.7, h:0.1, dur:1.0,            tip:"Sliced and steeper — lands mid front-court, harder to lift well." },
  smash:    { name:"Smash",            grp:"Attack",     z0:2.85,h:0,   dur:0.55,           tip:"Steep, at the body or the gaps. Mid-court is the killing zone." },
  jsmash:   { name:"Jump smash",       grp:"Attack",     z0:3.15,h:0,   dur:0.5,            tip:"Higher contact = steeper angle. Punish a short lift with it." },
  halfsmash:{ name:"Half smash",       grp:"Attack",     z0:2.8, h:0.05,dur:0.8,            tip:"Placement over power — steep to the sidelines, stay balanced." },
  kill:     { name:"Net kill",         grp:"Net",        z0:1.5, h:0,   dur:0.35,           tip:"Loose net shot? Pounce — straight down, no backswing." },
  net:      { name:"Net shot",         grp:"Net",        z0:1.0, h:0.3, dur:1.0,            tip:"Tumble it tight over the tape — force the lift you want to smash." },
  lift:     { name:"Lift / lob",       grp:"Defense",    z0:0.85,h:4.2, dur:1.6, def:true,  tip:"Under pressure at the net: high to the back and reset your defense." },
  block:    { name:"Block (vs smash)", grp:"Defense",    z0:0.95,h:0.5, dur:1.0, def:true,  tip:"Soft hands — kill their pace, drop it short, turn defense into attack." },
  drive:    { name:"Drive",            grp:"Mid court",  z0:1.5, h:0.12,dur:0.6,            tip:"Flat exchange at net height — win the mid-court battle." },
  push:     { name:"Push",             grp:"Mid court",  z0:1.3, h:0.35,dur:0.9,            tip:"Into the gap between front and rear player — doubles bread and butter." }
};
const SHOT_GROUPS = ["Serves","Rear court","Attack","Mid court","Net","Defense"];

const TEAM_COL = { A:"#a4dd2b", B:"#5db9ff", C:"#cfd6cd" };

function shotById(id){ return SHOTS[id] || SHOTS.clear; }

// ---- formations & players ----
function makePlayers(cat, feed){
  const mixedLbl = i => i===1 ? "W" : "M";
  const mk = (team)=> cat==="singles"
    ? [{ p:team+"1", team, lbl:team==="A"?"A":"B" }]
    : [1,2].map(i=>({ p:team+i, team, lbl: cat==="mixed" ? mixedLbl(i) : team+i }));
  if(feed==="multi"){
    return mk("A").concat([{ p:"C", team:"C", lbl:"C" }]);   // C = coach / feeder
  }
  return mk("A").concat(mk("B"));
}
function formationFor(cat, team, stance){
  const sgn = team==="A" ? -1 : 1;
  const Y = d => CT.NET + sgn*d;
  if(cat==="singles") return [{ p:team+"1", x:CT.CX, y:Y(2.9) }];
  if(stance==="attack")
    return [{ p:team+"1", x:CT.CX, y:Y(1.6) }, { p:team+"2", x:CT.CX, y:Y(4.3) }];
  return [{ p:team+"1", x:1.6, y:Y(3.3) }, { p:team+"2", x:4.5, y:Y(3.3) }];
}
function basePositions(cat, feed){
  const pos = {};
  if(feed==="multi"){
    formationFor(cat,"A", cat==="singles"?"base":"defend").forEach(f=>{ pos[f.p]={x:f.x,y:f.y}; });
    pos["C"] = { x:CT.CX, y:7.4 };   // feeder: front court, other side of the net
  }else{
    ["A","B"].forEach(t=>formationFor(cat,t,"defend").forEach(f=>{ pos[f.p]={x:f.x,y:f.y}; }));
  }
  return pos;
}
function positionsUpTo(cat, feed, steps, n){
  const pos = basePositions(cat, feed);
  for(let i=0;i<n;i++){
    (steps[i].pre||[]).forEach(m=>{ pos[m.p]={x:m.x,y:m.y}; });
    (steps[i].moves||[]).forEach(m=>{ pos[m.p]={x:m.x,y:m.y}; });
  }
  return pos;
}

// ---- legal service court (target box) for a server standing at (x,y) ----
function serveBox(cat, sx, sy){
  const fromA = sy < CT.NET;
  const rightHalf = sx >= CT.CX;                 // absolute right half
  const tx = rightHalf ? 0 : 1;                  // target = opposite absolute half
  const single = cat==="singles";
  const x1 = tx===1 ? CT.CX : (single? CT.SIN : 0);
  const x2 = tx===1 ? (single? CT.SXL : CT.W) : CT.CX;
  const y1 = fromA ? CT.SSLB : (single? 0 : CT.DLSA);
  const y2 = fromA ? (single? CT.L : CT.DLSB) : CT.SSLA;
  return { x1:Math.min(x1,x2), x2:Math.max(x1,x2), y1:Math.min(y1,y2), y2:Math.max(y1,y2) };
}
function inBox(b,x,y,eps){ eps=eps||0.05; return x>=b.x1-eps && x<=b.x2+eps && y>=b.y1-eps && y<=b.y2+eps; }
function inCourt(cat,x,y){
  const xs1 = cat==="singles" ? CT.SIN : 0, xs2 = cat==="singles" ? CT.SXL : CT.W;
  return x>=xs1-0.05 && x<=xs2+0.05 && y>=-0.05 && y<=CT.L+0.05;
}

// ---- projections: court (x,y,z metres) → screen ----
function makeProj(view){
  if(view==="side"){
    const padX=28, Sy=(740-2*padX)/CT.L, base=232, Sz=26;
    return { vb:"0 0 740 270",
      pt:(x,y,z)=>[padX + y*Sy, base - (z||0)*Sz],
      scl:()=>1, kind:"side" };
  }
  if(view==="front"){
    const cx=190, hy=110, f=240, camZ=1.7, camD=4;
    return { vb:"0 0 380 320",
      pt:(x,y,z)=>{ const s=f/((y||0)+camD); return [cx+(x-CT.CX)*s, hy+(camZ-(z||0))*s]; },
      scl:(x,y)=>f/((y||0)+camD)/40, kind:"front",
      inv:(sx,sy)=>{ const s=(sy-hy)/camZ; if(s<=0.01) return null; const d=f/s; return { x:CT.CX+(sx-cx)/s, y:d-camD }; } };
  }
  const pad=26, S=40;
  return { vb:"0 0 "+(CT.W*S+2*pad)+" "+(CT.L*S+2*pad),
    pt:(x,y,z)=>[pad + x*S, pad + (CT.L-y)*S],
    scl:(x,y,z)=>0.9+(z||0)*0.10, kind:"bird",
    inv:(sx,sy)=>({ x:(sx-pad)/S, y:CT.L-(sy-pad)/S }) };
}

// court line segments (floor)
function courtLines(){
  const L=[], add=(x1,y1,x2,y2)=>L.push([x1,y1,x2,y2]);
  add(0,0,CT.W,0); add(0,CT.L,CT.W,CT.L);                    // baselines
  add(0,0,0,CT.L); add(CT.W,0,CT.W,CT.L);                    // doubles sidelines
  add(CT.SIN,0,CT.SIN,CT.L); add(CT.SXL,0,CT.SXL,CT.L);      // singles sidelines
  add(0,CT.SSLA,CT.W,CT.SSLA); add(0,CT.SSLB,CT.W,CT.SSLB);  // short service lines
  add(0,CT.DLSA,CT.W,CT.DLSA); add(0,CT.DLSB,CT.W,CT.DLSB);  // doubles long service
  add(CT.CX,0,CT.CX,CT.SSLA); add(CT.CX,CT.SSLB,CT.CX,CT.L); // centre lines
  return L;
}

// 3D flight position for a shot
function flightPos(traj, t){
  const x = traj.x1+(traj.x2-traj.x1)*t, y = traj.y1+(traj.y2-traj.y1)*t;
  const z = traj.z0*(1-t) + traj.h*Math.sin(Math.PI*t);
  return { x, y, z };
}

export function mountCourtLab(container, opts){
  opts = opts || {};
  const editing = (opts.mode||"edit") !== "play";
  const cat = opts.category || "singles";
  const feed = opts.feed || "drill";
  let view = opts.view || "bird";
  let steps = Array.isArray(opts.points) ? JSON.parse(JSON.stringify(opts.points)) : [];
  const players = makePlayers(cat, feed);
  let pos = positionsUpTo(cat, feed, steps, steps.length);
  let pend = null;                                   // pending tap-1 {from, hitter, side}
  let proj = makeProj(view);
  let anim = { on:false, raf:null, tasks:[], i:0, el:0, last:0 };
  const uid = "cl"+Math.floor(Math.random()*1e6);
  const gid = s => container.querySelector("#"+uid+s);

  const VIEWS = [["bird","Bird's-eye"],["side","Side"],["front","Front"]];
  const catName = cat==="singles"?"Singles":cat==="doubles"?"Doubles":"Mixed doubles";

  container.innerHTML = `
    <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:8px;">
      ${VIEWS.map(v=>`<span class="chip ${view===v[0]?"on":""}" id="${uid}v_${v[0]}">${v[1]}</span>`).join("")}
      <span class="muted" style="font-size:12px;margin-left:auto;">${catName} · ${feed==="multi"?"Multi-shuttle":"Drill"}</span>
    </div>
    <div style="display:flex;justify-content:center;background:#0b1410;border:1px solid var(--line);border-radius:14px;overflow:hidden;">
      <svg id="${uid}svg" viewBox="${proj.vb}" style="width:100%;max-width:${view==="bird"?"330":"720"}px;height:auto;touch-action:manipulation;">
        <g id="${uid}floor"></g><g id="${uid}zone"></g><g id="${uid}lines"></g><g id="${uid}net"></g>
        <g id="${uid}routes"></g><g id="${uid}pl"></g>
        <circle id="${uid}ring" r="7" fill="none" stroke="#fff" stroke-width="1.6" stroke-dasharray="3 3" opacity="0"/>
        <g id="${uid}sh" opacity="0"><path d="M 3 0 L -6 -4.4 L -3.4 0 L -6 4.4 Z" fill="#eef4ee" stroke="#0b1410" stroke-width="0.7"/><circle cx="3.6" cy="0" r="2.3" fill="#fff" stroke="#9aa49a" stroke-width="0.7"/></g>
        <text id="${uid}out" font-size="11" fill="#ff7b7b" text-anchor="middle" opacity="0">OUT</text>
      </svg>
    </div>
    ${editing ? `
    <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
      <select id="${uid}shot" style="flex:1;min-width:150px;">
        ${SHOT_GROUPS.map(g=>`<optgroup label="${g}">${Object.keys(SHOTS).filter(k=>SHOTS[k].grp===g).map(k=>`<option value="${k}">${SHOTS[k].name}</option>`).join("")}</optgroup>`).join("")}
      </select>
      <span class="chip on" id="${uid}rot">Auto-rotate</span>
      <button class="btn" id="${uid}undo" style="padding:7px 11px;font-size:12px;">Undo</button>
      <button class="btn" id="${uid}clr" style="padding:7px 11px;font-size:12px;">Clear</button>
    </div>
    <div id="${uid}tip" class="muted" style="font-size:12px;margin-top:6px;line-height:1.5;"></div>
    <input id="${uid}note" type="text" placeholder="Coaching note for the last shot (optional)" style="width:100%;margin-top:8px;">` : ``}
    <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
      <button class="btn" id="${uid}play" style="padding:8px 14px;">▶ Play</button>
      <button class="btn" id="${uid}rst" style="padding:8px 12px;">↺</button>
      <select id="${uid}spd" style="width:auto;"><option value="1">1×</option><option value="0.6">0.6×</option><option value="0.35">0.35×</option></select>
      <span id="${uid}hint" class="muted" style="font-size:12px;flex:1;min-width:140px;"></span>
    </div>
    <div id="${uid}list" style="margin-top:10px;display:flex;flex-direction:column;gap:5px;"></div>`;

  // ---------- static painting ----------
  function paintCourt(){
    const P = proj.pt;
    const corners = [P(0,0,0),P(CT.W,0,0),P(CT.W,CT.L,0),P(0,CT.L,0)];
    gid("floor").innerHTML = proj.kind==="side"
      ? `<line x1="${P(0,0,0)[0]}" y1="${P(0,0,0)[1]}" x2="${P(0,CT.L,0)[0]}" y2="${P(0,CT.L,0)[1]}" stroke="#2c5c48" stroke-width="3"/>`
      : `<polygon points="${corners.map(c=>c.join(",")).join(" ")}" fill="#14543e"/>
         <polygon points="${[P(0,CT.SSLA,0),P(CT.W,CT.SSLA,0),P(CT.W,CT.SSLB,0),P(0,CT.SSLB,0)].map(c=>c.join(",")).join(" ")}" fill="#0f4634"/>`;
    const lw = proj.kind==="bird" ? CT.LW*40 : 1.4;
    gid("lines").innerHTML = proj.kind==="side"
      ? [0,CT.SSLA,CT.NET,CT.SSLB,CT.DLSA,CT.DLSB,CT.L].map(y=>{ const p=P(0,y,0); return `<line x1="${p[0]}" y1="${p[1]-4}" x2="${p[0]}" y2="${p[1]+4}" stroke="#cfe3d6" stroke-width="1.4"/>`; }).join("")
      : courtLines().map(s=>{ const a=P(s[0],s[1],0), b=P(s[2],s[3],0); return `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="#e8f4ec" stroke-width="${lw}" stroke-linecap="square"/>`; }).join("");
    // net
    if(proj.kind==="bird"){
      const a=P(0,CT.NET,0), b=P(CT.W,CT.NET,0);
      gid("net").innerHTML = `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="#0b1410" stroke-width="5"/><line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="#9fb4a6" stroke-width="2" stroke-dasharray="4 3"/><circle cx="${a[0]}" cy="${a[1]}" r="3" fill="#cfd6cd"/><circle cx="${b[0]}" cy="${b[1]}" r="3" fill="#cfd6cd"/>`;
    }else{
      const tA=P(0,CT.NET,CT.NETH), tB=P(CT.W,CT.NET,CT.NETH), bA=P(0,CT.NET,CT.NETB), bB=P(CT.W,CT.NET,CT.NETB), fA=P(0,CT.NET,0);
      gid("net").innerHTML = proj.kind==="side"
        ? `<line x1="${fA[0]}" y1="${fA[1]}" x2="${tA[0]}" y2="${tA[1]}" stroke="#cfd6cd" stroke-width="2"/><line x1="${tA[0]-5}" y1="${tA[1]}" x2="${tA[0]+5}" y2="${tA[1]}" stroke="#fff" stroke-width="2.4"/>`
        : `<polygon points="${[tA,tB,bB,bA].map(c=>c.join(",")).join(" ")}" fill="rgba(255,255,255,.10)" stroke="#9fb4a6" stroke-width="0.8"/><line x1="${tA[0]}" y1="${tA[1]}" x2="${tB[0]}" y2="${tB[1]}" stroke="#fff" stroke-width="2"/>`;
    }
  }

  function zoneHTML(b){
    const P=proj.pt;
    const pts=[P(b.x1,b.y1,0),P(b.x2,b.y1,0),P(b.x2,b.y2,0),P(b.x1,b.y2,0)];
    return `<polygon points="${pts.map(c=>c.join(",")).join(" ")}" fill="rgba(164,221,43,.18)" stroke="#a4dd2b" stroke-width="1.4" stroke-dasharray="5 4"/>`;
  }

  function playerHTML(pl, p){
    const P=proj.pt, col=TEAM_COL[pl.team];
    if(proj.kind==="bird"){
      const c=P(p.x,p.y,0);
      return `<g data-pl="${pl.p}" transform="translate(${c[0]},${c[1]})"><circle r="9" fill="${col}" fill-opacity="0.92" stroke="#0b1410" stroke-width="1.4"/><text y="3.5" font-size="9" text-anchor="middle" fill="#0b1410" font-weight="700">${pl.lbl}</text></g>`;
    }
    const f=P(p.x,p.y,0), h=P(p.x,p.y,1.62), s = proj.scl(p.x,p.y,0);
    const r = Math.max(3, 5.5*s);
    return `<g data-pl="${pl.p}"><line x1="${f[0]}" y1="${f[1]}" x2="${h[0]}" y2="${h[1]}" stroke="${col}" stroke-width="${Math.max(2,3*s)}" stroke-linecap="round"/><circle cx="${h[0]}" cy="${h[1]-r*0.9}" r="${r}" fill="${col}"/><text x="${h[0]}" y="${f[1]+12}" font-size="9" text-anchor="middle" fill="${col}">${pl.lbl}</text></g>`;
  }

  function routeHTML(st, i, active){
    const sh=shotById(st.shot), P=proj.pt;
    const traj={ x1:st.from.x, y1:st.from.y, x2:st.to.x, y2:st.to.y, z0:sh.z0, h:sh.h };
    let d=""; for(let k=0;k<=24;k++){ const fp=flightPos(traj,k/24), p=P(fp.x,fp.y,fp.z); d+=(k?"L":"M")+p[0].toFixed(1)+" "+p[1].toFixed(1)+" "; }
    const mid=P((st.from.x+st.to.x)/2,(st.from.y+st.to.y)/2, sh.h*0.8+sh.z0*0.4);
    const land=P(st.to.x,st.to.y,0);
    const col = st.side==="A"?TEAM_COL.A:st.side==="B"?TEAM_COL.B:"#fff";
    return `<path d="${d}" fill="none" stroke="${col}" stroke-width="${active?2.4:1.5}" opacity="${active?0.95:0.55}" stroke-dasharray="${active?"none":"4 4"}"/>
      <circle cx="${land[0]}" cy="${land[1]}" r="3.4" fill="none" stroke="${col}" stroke-width="1.4" opacity="0.8"/>
      ${st.out?`<text x="${land[0]}" y="${land[1]-6}" font-size="10" fill="#ff7b7b" text-anchor="middle">OUT</text>`:""}
      <g transform="translate(${mid[0]},${mid[1]})"><circle r="7.5" fill="#0b1410" stroke="${col}" stroke-width="1.2"/><text y="3.4" font-size="9" fill="${col}" text-anchor="middle" font-weight="700">${i+1}</text></g>`;
  }

  function redraw(activeIdx){
    paintCourt();
    gid("zone").innerHTML = (pend && shotById(curShot()).serve) ? zoneHTML(serveBox(cat, pend.from.x, pend.from.y)) : "";
    gid("routes").innerHTML = steps.map((s,i)=>routeHTML(s,i, i===activeIdx)).join("");
    gid("pl").innerHTML = players.map(pl=>playerHTML(pl, pos[pl.p])).join("");
    if(pend){ const c=proj.pt(pend.from.x,pend.from.y,0); const r=gid("ring"); r.setAttribute("cx",c[0]); r.setAttribute("cy",c[1]); r.setAttribute("opacity","1"); }
    else gid("ring").setAttribute("opacity","0");
    paintList(activeIdx);
  }

  function paintList(activeIdx){
    const el=gid("list"); if(!el) return;
    el.innerHTML = steps.length ? steps.map((s,i)=>{
      const sh=shotById(s.shot);
      return `<div data-st="${i}" style="display:flex;gap:8px;align-items:center;padding:7px 10px;border:1px solid ${i===activeIdx?"var(--brand)":"var(--line)"};border-radius:9px;cursor:pointer;">
        <span style="width:8px;height:8px;border-radius:50%;background:${s.side==="A"?TEAM_COL.A:TEAM_COL.B};flex:0 0 auto;"></span>
        <div style="flex:1;font-size:13px;"><b>${i+1}.</b> ${sh.name}${s.hitter?` <span class="muted" style="font-size:11px;">· ${s.hitter}</span>`:""}${s.out?` <span style="color:#ff7b7b;font-size:11px;">OUT</span>`:""}${s.note?`<div class="muted" style="font-size:12px;">${s.note.replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]))}</div>`:""}</div>
        ${editing?`<button class="btn" data-del="${i}" style="padding:2px 8px;font-size:11px;">✕</button>`:""}
      </div>`;
    }).join("") : `<div class="muted" style="font-size:12px;">${editing?"No shots yet — pick a shot, tap where it's hit from, then where it lands.":"No shots in this drill yet."}</div>`;
    el.querySelectorAll("[data-st]").forEach(row=>row.onclick=(e)=>{ if(e.target.dataset.del!==undefined) return; previewStep(parseInt(row.dataset.st,10)); });
    el.querySelectorAll("[data-del]").forEach(b=>b.onclick=(e)=>{ e.stopPropagation(); steps.splice(parseInt(b.dataset.del,10),1); pos=positionsUpTo(cat,feed,steps,steps.length); pend=null; redraw(); });
  }

  // ---------- editing ----------
  const curShot = ()=> editing ? gid("shot").value : "clear";
  function hint(msg, warn){ const h=gid("hint"); if(h){ h.textContent=msg; h.style.color = warn?"var(--down)":"var(--muted)"; } }
  function tipLine(){ const t=gid("tip"); if(t){ const sh=shotById(curShot()); t.innerHTML = `<b style="color:var(--brand)">${sh.name}:</b> ${sh.tip}`; } }

  function nearestPlayer(x,y,teamFilter){
    let best=null, bd=1e9;
    players.forEach(pl=>{
      if(teamFilter && pl.team!==teamFilter) return;
      if(pl.team==="C") return;
      const p=pos[pl.p], d=(p.x-x)*(p.x-x)+(p.y-y)*(p.y-y);
      if(d<bd){ bd=d; best=pl; }
    });
    return best;
  }

  function svgPoint(evt){
    const svg=gid("svg"), pt=svg.createSVGPoint();
    const s=evt.touches&&evt.touches[0]?evt.touches[0]:evt;
    pt.x=s.clientX; pt.y=s.clientY;
    const m=svg.getScreenCTM(); if(!m) return null;
    const sp=pt.matrixTransform(m.inverse());
    if(proj.inv){ const c=proj.inv(sp.x,sp.y); if(!c) return null; return { x:Math.max(0,Math.min(CT.W,c.x)), y:Math.max(0,Math.min(CT.L,c.y)) }; }
    // side view: y from screen-x, keep lateral centre (use bird/front for exact width placement)
    const padX=28, Sy=(740-56)/CT.L;
    return { x:CT.CX, y:Math.max(0,Math.min(CT.L,(sp.x-padX)/Sy)) };
  }

  function onTap(evt){
    if(!editing) return;
    const c=svgPoint(evt); if(!c) return;
    const sh=shotById(curShot());
    if(!pend){
      let side = c.y < CT.NET ? "A" : "B";
      if(feed==="multi" && side!=="A"){ hint("Tap on the training side (the feeder sends shuttles there).", true); return; }
      const hitter=nearestPlayer(c.x,c.y, feed==="multi" ? "A" : side);
      pend={ from:c, side, hitter: hitter?hitter.p:null };
      if(sh.serve) hint("Legal box highlighted — diagonal service court ("+(cat==="singles"?"long & narrow":"short & wide")+"). Tap where the serve lands.");
      else hint("Now tap where the "+sh.name.toLowerCase()+" lands.");
      redraw(); return;
    }
    // tap 2 — target
    if(sh.serve){
      const box=serveBox(cat,pend.from.x,pend.from.y);
      if(!inBox(box,c.x,c.y)){ hint("Illegal serve — it must land in the highlighted diagonal service court.", true); return; }
    }
    const sameSide = (c.y<CT.NET) === (pend.from.y<CT.NET);
    if(sameSide && !sh.serve){ hint("The shuttle has to cross the net — tap a target on the other side.", true); return; }
    addStep(pend, c, sh);
  }

  function addStep(p, target, sh){
    const autoRot = !editing || gid("rot").classList.contains("on");
    const st = { shot:curShot(), from:{x:+p.from.x.toFixed(2),y:+p.from.y.toFixed(2)}, to:{x:+target.x.toFixed(2),y:+target.y.toFixed(2)}, side:p.side, hitter:p.hitter, note:"", pre:[], moves:[] };
    st.out = !sh.serve && !inCourt(cat, target.x, target.y);
    if(p.hitter) st.pre.push({ p:p.hitter, x:st.from.x, y:st.from.y });
    if(sh.serve && feed!=="multi"){
      const box=serveBox(cat,st.from.x,st.from.y);
      const recv=nearestPlayer((box.x1+box.x2)/2,(box.y1+box.y2)/2, p.side==="A"?"B":"A");
      if(recv){ const ry = st.side==="A" ? box.y1+ (cat==="singles"?1.0:0.4) : box.y2-(cat==="singles"?1.0:0.4); st.pre.push({ p:recv.p, x:(box.x1+box.x2)/2, y:ry }); }
    }
    if(autoRot){
      if(cat==="singles"){
        ["A","B"].forEach(t=>{ if(feed==="multi"&&t==="B")return; formationFor(cat,t,"base").forEach(f=>st.moves.push({p:f.p,x:f.x,y:f.y})); });
      }else{
        const atk = !sh.def;   // attacking shot → hitter's team takes front-back
        const ht=p.side, ot=ht==="A"?"B":"A";
        formationFor(cat,ht, atk?"attack":"defend").forEach(f=>st.moves.push({p:f.p,x:f.x,y:f.y}));
        if(feed!=="multi") formationFor(cat,ot, atk?"defend":"attack").forEach(f=>st.moves.push({p:f.p,x:f.x,y:f.y}));
      }
    }else if(p.hitter){
      st.moves.push({ p:p.hitter, x:st.from.x, y:st.from.y });
    }
    steps.push(st); pend=null;
    pos=positionsUpTo(cat,feed,steps,steps.length);
    hint("Added. Tap the next shot — or press ▶ Play to watch it.");
    redraw();
    previewStep(steps.length-1);
  }

  // ---------- playback ----------
  const speed = ()=> parseFloat(gid("spd").value)||1;
  function stopAnim(){ anim.on=false; if(anim.raf) cancelAnimationFrame(anim.raf); anim.raf=null; gid("sh").setAttribute("opacity","0"); const b=gid("play"); if(b) b.textContent="▶ Play"; }

  function tasksForStep(st, idx){
    const sh=shotById(st.shot), T=[];
    (st.pre||[]).forEach(m=>T.push({ type:"move", p:m.p, to:{x:m.x,y:m.y}, dur:0.4 }));
    if(feed==="multi"){
      const f=pos["C"]||{x:CT.CX,y:7.4};
      T.push({ type:"fly", traj:{x1:f.x,y1:f.y,x2:st.from.x,y2:st.from.y,z0:1.2,h:1.1}, dur:0.7, idx });
    }
    T.push({ type:"fly", traj:{x1:st.from.x,y1:st.from.y,x2:st.to.x,y2:st.to.y,z0:sh.z0,h:sh.h}, dur:sh.dur, idx });
    (st.moves||[]).forEach(m=>T.push({ type:"move", p:m.p, to:{x:m.x,y:m.y}, dur:0.45, group:"rec"+idx }));
    return T;
  }
  // merge same-group move tasks so recoveries glide together
  function mergedTasksForStep(st, i){
    const raw=tasksForStep(st, i), out=[], groups={};
    raw.forEach(t=>{
      if(t.type==="move" && t.group){ (groups[t.group]=groups[t.group]||{type:"multimove",items:[],dur:t.dur}).items.push(t); }
      else out.push(t);
    });
    Object.keys(groups).forEach(g=>out.push(groups[g]));
    return out;
  }
  function buildTasks(fromIdx){
    let T=[];
    for(let i=fromIdx;i<steps.length;i++) T=T.concat(mergedTasksForStep(steps[i], i));
    return T;
  }

  function applyTask(t, k){
    if(t.type==="move"){
      if(!t.fromPos) t.fromPos={ ...pos[t.p] };
      pos[t.p]={ x:t.fromPos.x+(t.to.x-t.fromPos.x)*k, y:t.fromPos.y+(t.to.y-t.fromPos.y)*k };
      gid("pl").innerHTML = players.map(pl=>playerHTML(pl,pos[pl.p])).join("");
    }else if(t.type==="multimove"){
      t.items.forEach(it=>{ if(!it.fromPos) it.fromPos={...pos[it.p]}; pos[it.p]={ x:it.fromPos.x+(it.to.x-it.fromPos.x)*k, y:it.fromPos.y+(it.to.y-it.fromPos.y)*k }; });
      gid("pl").innerHTML = players.map(pl=>playerHTML(pl,pos[pl.p])).join("");
    }else if(t.type==="fly"){
      const g=gid("sh"); g.setAttribute("opacity","1");
      const fp=flightPos(t.traj,k), p=proj.pt(fp.x,fp.y,fp.z);
      const prev=flightPos(t.traj,Math.max(0,k-0.04)), pp=proj.pt(prev.x,prev.y,prev.z);
      const ang=Math.atan2(p[1]-pp[1],p[0]-pp[0])*180/Math.PI;
      const s=proj.scl(fp.x,fp.y,fp.z)*1.1;
      g.setAttribute("transform",`translate(${p[0]},${p[1]}) rotate(${ang}) scale(${s})`);
      if(t.idx!==undefined && t._mark!==t.idx){ t._mark=t.idx; gid("routes").innerHTML=steps.map((s2,i2)=>routeHTML(s2,i2,i2===t.idx)).join(""); paintList(t.idx); }
    }
  }

  function run(tasks){
    stopAnim(); anim.on=true; anim.tasks=tasks; anim.i=0; anim.el=0; anim.last=0;
    gid("play").textContent="❚❚ Pause";
    anim.raf=requestAnimationFrame(animLoop);
  }

  function playAll(){
    if(!steps.length) return;
    pos=positionsUpTo(cat,feed,steps,0); redraw();
    run(buildTasks(0));
  }
  function previewStep(i){
    pos=positionsUpTo(cat,feed,steps,i); redraw(i);
    run(mergedTasksForStep(steps[i], i));
  }

  // ---------- wiring ----------
  gid("svg").addEventListener("pointerdown", onTap);
  function animLoop(t2){
    if(!anim.on) return;
    if(!document.body.contains(gid("svg"))){ stopAnim(); return; }
    if(!anim.last) anim.last=t2;
    anim.el += (t2-anim.last)*speed(); anim.last=t2;
    const t=anim.tasks[anim.i];
    if(!t){ stopAnim(); pos=positionsUpTo(cat,feed,steps,steps.length); redraw(); return; }
    const k=Math.min(1, anim.el/(t.dur*1000));
    applyTask(t,k);
    if(k>=1){ anim.i++; anim.el=0; }
    anim.raf=requestAnimationFrame(animLoop);
  }
  gid("play").onclick=()=>{
    if(anim.on){ anim.on=false; if(anim.raf) cancelAnimationFrame(anim.raf); gid("play").textContent="▶ Play"; return; }
    if(anim.tasks.length && anim.i<anim.tasks.length){ anim.on=true; anim.last=0; gid("play").textContent="❚❚ Pause"; anim.raf=requestAnimationFrame(animLoop); return; }
    playAll();
  };
  gid("rst").onclick=()=>{ stopAnim(); pos=positionsUpTo(cat,feed,steps,steps.length); pend=null; redraw(); };
  VIEWS.forEach(v=>{ gid("v_"+v[0]).onclick=()=>{ if(view===v[0])return; view=v[0]; proj=makeProj(view); const svg=gid("svg"); svg.setAttribute("viewBox",proj.vb); svg.style.maxWidth = view==="bird"?"330px":"720px"; VIEWS.forEach(w=>gid("v_"+w[0]).classList.toggle("on",w[0]===view)); stopAnim(); pend=null; redraw(); }; });
  if(editing){
    gid("shot").onchange=()=>{ pend=null; tipLine(); redraw(); hint("Tap where the shot is hit from."); };
    gid("rot").onclick=function(){ this.classList.toggle("on"); };
    gid("undo").onclick=()=>{ steps.pop(); pos=positionsUpTo(cat,feed,steps,steps.length); pend=null; redraw(); };
    gid("clr").onclick=()=>{ steps=[]; pos=basePositions(cat,feed); pend=null; redraw(); };
    gid("note").oninput=function(){ if(steps.length){ steps[steps.length-1].note=this.value; paintList(); } };
    tipLine();
    hint(feed==="multi" ? "Multi-shuttle: tap where the feed lands (player hits from there), then where the player's shot goes." : "Pick a shot, tap where it's hit from, then where it lands.");
  }else{
    hint("Press ▶ Play to watch. Switch views any time — same drill, three angles.");
  }
  redraw();

  return {
    getPoints: ()=> JSON.parse(JSON.stringify(steps)),
    hasShots: ()=> steps.length>0,
    getView: ()=> view,
    destroy: ()=> stopAnim()
  };
}

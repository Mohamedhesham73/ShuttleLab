// =============================================================
//  PRO COURT (Singles) — a real 3D-projected badminton court with
//  posed athlete figures, switchable cameras and a seekable rally
//  timeline. Classic-court controls: shot select + colour palette +
//  Recover + Move + note + step list + play/speed.
//
//  mountProCourt(container, opts) → { getPoints, hasShots, destroy }
//    opts.points  saved data — legacy array of steps, or
//                 { steps, feeder:{x,y}, nA, nB }
//    opts.mode    "edit" | "play"
//    opts.feed    "drill" | "multi"
//
//  Coach controls EVERYTHING: squad size per side (1–4, e.g. 3v1),
//  where each player stands (Move tool), who hits (nearest to the
//  tap), where the shuttle goes, and where anyone goes afterwards.
//  Multi-shuttle: the feeder is placeable anywhere and feeds the
//  EXACT point the player hits from — the player is already there
//  and strikes directly, no run-up. Every trajectory is lifted to
//  clear the net tape.
// =============================================================

const CT = { W:6.1, L:13.4, NET:6.7, SSLA:4.72, SSLB:8.68, DLSA:0.76, DLSB:12.64, SIN:0.46, SXL:5.64, CX:3.05, NETH:1.55, NETB:0.76 };
const NETH_D = 1.34, NETB_D = 0.58;   // drawn net (slightly shorter, so cleared shots show daylight)
const VW=760, VH=430;

const SHOTS = {
  servelow: { name:"Low serve",   serve:true, z0:1.05, h:0.18, dur:1.05, pose:"serve" },
  servehigh:{ name:"High serve",  serve:true, z0:1.05, h:6.0,  dur:2.3,  pose:"serve" },
  serveflick:{name:"Flick serve", serve:true, z0:1.05, h:2.6,  dur:1.35, pose:"serve" },
  clear:    { name:"Clear",            z0:2.7,  h:4.4,  dur:1.65, pose:"overhead" },
  attclear: { name:"Attacking clear",  z0:2.7,  h:2.1,  dur:1.1,  pose:"overhead" },
  drop:     { name:"Drop shot",        z0:2.7,  h:0.3,  dur:1.35, pose:"overhead" },
  fastdrop: { name:"Fast drop / cut",  z0:2.7,  h:0.1,  dur:0.95, pose:"overhead" },
  smash:    { name:"Smash",            z0:2.85, h:0,    dur:0.55, pose:"overhead" },
  jsmash:   { name:"Jump smash",       z0:3.15, h:0,    dur:0.5,  pose:"jump" },
  halfsmash:{ name:"Half smash",       z0:2.8,  h:0.05, dur:0.8,  pose:"overhead" },
  drive:    { name:"Drive",            z0:1.6,  h:0.12, dur:0.6,  pose:"drive" },
  push:     { name:"Push",             z0:1.3,  h:0.35, dur:0.9,  pose:"drive" },
  net:      { name:"Net shot",         z0:1.0,  h:0.3,  dur:1.0,  pose:"lunge" },
  kill:     { name:"Net kill",         z0:1.9,  h:0,    dur:0.35, pose:"lunge" },
  lift:     { name:"Lift / lob",       z0:0.85, h:4.2,  dur:1.55, pose:"lunge" },
  block:    { name:"Block (defense)",  z0:0.95, h:0.5,  dur:1.0,  pose:"defense" }
};
const SHOT_ORDER = ["servelow","servehigh","serveflick","clear","attclear","drop","fastdrop","smash","jsmash","halfsmash","drive","push","net","kill","lift","block"];
const FAST = { smash:1, jsmash:1, halfsmash:1, kill:1, drive:1 };
const DCOLS = ["#a4dd2b","#ffd34d","#ff9f45","#ff5d6c","#ff8ad8","#c77dff","#8a7bff","#5db9ff","#34d8b5","#e03131","#9aa49a","#ffffff"];

const CAMS = {
  broadcast:{ name:"Broadcast", C:[3.05,-9.0,5.4], T:[3.05,7.6,0.1], F:580 },
  corner:   { name:"Corner",    C:[-6.2,-4.6,5.0], T:[3.05,7.0,0.2], F:520 },
  side:     { name:"Side",      C:[-9.8,6.7,2.4],  T:[3.05,6.7,0.9], F:470 },
  bird:     { name:"Bird's-eye",C:[3.05,6.7,15.5], T:[3.05,6.74,0],  F:480 }
};

const POSES = {
  ready:   { head:[0,1.58], neck:[0,1.42], hip:[0,.9],  kL:[-.2,.5],  fL:[-.26,0],  kR:[.2,.5],  fR:[.26,0],  hL:[-.32,1.05], hR:[.34,1.18], rk:[.6,1.5] },
  run:     { head:[.08,1.6],neck:[.06,1.44],hip:[0,.92], kL:[-.28,.5], fL:[-.42,.06],kR:[.3,.48], fR:[.44,0],  hL:[-.36,1.2],  hR:[.38,1.05], rk:[.64,1.28] },
  lunge:   { head:[.22,1.45],neck:[.18,1.3],hip:[-.05,.66],kL:[.42,.4],fL:[.58,0],  kR:[-.4,.34],fR:[-.58,.06],hL:[-.3,.95],   hR:[.7,1.0],   rk:[1.04,1.04] },
  overhead:{ head:[.02,1.66],neck:[.05,1.5],hip:[0,.95], kL:[-.25,.5], fL:[-.33,.02],kR:[.22,.52],fR:[.3,.08], hL:[-.3,1.55],  hR:[.18,1.98], rk:[.3,2.32] },
  jump:    { head:[.02,2.06],neck:[.05,1.9],hip:[0,1.34],kL:[-.22,1.02],fL:[-.3,.66],kR:[.3,.98], fR:[.4,.6],  hL:[-.32,1.92], hR:[.22,2.36], rk:[.34,2.7] },
  serve:   { head:[0,1.6],  neck:[-.02,1.45],hip:[0,.92],kL:[-.18,.5], fL:[-.24,0],  kR:[.2,.5],  fR:[.3,0],   hL:[.3,1.12],   hR:[.26,.8],   rk:[.5,.6] },
  drive:   { head:[.04,1.56],neck:[.03,1.4],hip:[0,.86], kL:[-.24,.48],fL:[-.32,0],  kR:[.26,.46],fR:[.36,0],  hL:[-.34,1.1],  hR:[.5,1.3],   rk:[.86,1.4] },
  defense: { head:[0,1.4],  neck:[0,1.26], hip:[0,.68], kL:[-.34,.4], fL:[-.46,0],  kR:[.34,.4], fR:[.46,0],  hL:[-.4,.95],   hR:[.42,1.0],  rk:[.72,1.12] },
  feeder:  { head:[0,1.36], neck:[0,1.22], hip:[0,.66], kL:[-.26,.36],fL:[-.34,0],  kR:[.28,.36],fR:[.36,0],  hL:[.3,.9],     hR:[.34,.78],  rk:[.56,.62] }
};
const JOINTS = ["head","neck","hip","kL","fL","kR","fR","hL","hR","rk"];

const vsub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const vdot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const vcross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const vnorm=a=>{const l=Math.hypot(a[0],a[1],a[2])||1;return [a[0]/l,a[1]/l,a[2]/l];};
const vlerp=(a,b,k)=>[a[0]+(b[0]-a[0])*k,a[1]+(b[1]-a[1])*k,a[2]+(b[2]-a[2])*k];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const dist2=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const ease=k=>k<.5?2*k*k:1-Math.pow(-2*k+2,2)/2;

function serveBox(sx,sy){
  const fromA = sy < CT.NET, rightHalf = sx >= CT.CX;
  const x1 = rightHalf ? CT.SIN : CT.CX, x2 = rightHalf ? CT.CX : CT.SXL;
  const y1 = fromA ? CT.SSLB : 0, y2 = fromA ? CT.L : CT.SSLA;
  return { x1:Math.min(x1,x2), x2:Math.max(x1,x2), y1:Math.min(y1,y2), y2:Math.max(y1,y2) };
}
const inBox=(b,x,y)=> x>=b.x1-0.05 && x<=b.x2+0.05 && y>=b.y1-0.05 && y<=b.y2+0.05;
const inSingles=(x,y)=> x>=CT.SIN-0.05 && x<=CT.SXL+0.05 && y>=-0.05 && y<=CT.L+0.05;
// tr.z1 = arrival height (0 = lands on the floor; contact height when the
// next player takes it straight out of the air)
function flightPos(tr,k){ return { x:tr.x1+(tr.x2-tr.x1)*k, y:tr.y1+(tr.y2-tr.y1)*k, z:tr.z0*(1-k)+(tr.z1||0)*k+tr.h*Math.sin(Math.PI*k) }; }
// lift any net-crossing trajectory so it clears the real tape (1.55 m)
function clearNet(tr){
  if((tr.y1<CT.NET)===(tr.y2<CT.NET)) return tr;
  const k=(CT.NET-tr.y1)/((tr.y2-tr.y1)||0.001), sk=Math.max(0.05,Math.sin(Math.PI*k));
  const z=tr.z0*(1-k)+(tr.z1||0)*k+tr.h*sk;
  if(z < CT.NETH+0.05) tr.h=(CT.NETH+0.05-tr.z0*(1-k)-(tr.z1||0)*k)/sk;
  return tr;
}

export function mountProCourt(container, opts){
  opts = opts || {};
  const editing = (opts.mode||"edit") !== "play";
  const feed = opts.feed || "drill";
  const uid = "pc"+Math.floor(Math.random()*1e6);
  const gid = s => container.querySelector("#"+uid+s);

  // ---- saved data (legacy array OR {steps, feeder, nA, nB}) ----
  let meta = { nA:1, nB:1, feeder:{x:3.05,y:7.6}, bases:{}, rate:"normal" };
  let steps = [];
  if(Array.isArray(opts.points)) steps = JSON.parse(JSON.stringify(opts.points));
  else if(opts.points && typeof opts.points==="object"){
    steps = JSON.parse(JSON.stringify(opts.points.steps||[]));
    meta.nA = clamp(opts.points.nA||1,1,4); meta.nB = clamp(opts.points.nB||1,1,4);
    if(opts.points.feeder) meta.feeder = { x:opts.points.feeder.x, y:opts.points.feeder.y };
    if(opts.points.bases) meta.bases = JSON.parse(JSON.stringify(opts.points.bases));
    if(opts.points.rate) meta.rate = opts.points.rate;
  }
  const FEEDRATE = { fast:{gap:0.35,fd:0.45}, normal:{gap:0.9,fd:0.6}, slow:{gap:1.6,fd:0.78} };
  steps.forEach(s=>{ if(s.p==="A")s.p="A1"; if(s.p==="B")s.p="B1"; if(s.hitter==="A")s.hitter="A1"; if(s.hitter==="B")s.hitter="B1"; });

  function spread(n){ return n===1?[3.05]: n===2?[1.8,4.3]: n===3?[1.2,3.05,4.9]:[0.9,2.5,3.6,5.2]; }
  function buildPlayers(){
    const arr=[], bx=meta.bases||{};
    spread(meta.nA).forEach((x,i)=>{ const id="A"+(i+1); arr.push({ p:id, jersey:"#a4dd2b", base: bx[id]?{...bx[id]}:{x, y:3.8} }); });
    if(feed==="multi") arr.push({ p:"C", jersey:"#aab4ab", base:{...meta.feeder}, feeder:true });
    else spread(meta.nB).forEach((x,i)=>{ const id="B"+(i+1); arr.push({ p:id, jersey:"#5db9ff", base: bx[id]?{...bx[id]}:{x, y:9.6} }); });
    return arr;
  }
  let players = buildPlayers();

  // ---- camera ----
  let cam = { C:[...CAMS.broadcast.C], T:[...CAMS.broadcast.T], F:CAMS.broadcast.F };
  let basis = null;
  function calcBasis(){
    const f = vnorm(vsub(cam.T, cam.C));
    const up = Math.abs(f[2])>0.96 ? [0,1,0] : [0,0,1];
    const r = vnorm(vcross(f,up)), u = vcross(r,f);
    basis = { f, r, u, bird: f[2] < -0.95 };
  }
  calcBasis();
  function proj(x,y,z){
    const d=[x-cam.C[0], y-cam.C[1], (z||0)-cam.C[2]];
    const zc=vdot(d,basis.f); if(zc<0.4) return null;
    return [VW/2 + vdot(d,basis.r)*cam.F/zc, VH/2 - vdot(d,basis.u)*cam.F/zc, zc];
  }
  function floorPoint(sx,sy){
    const dir=[ basis.f[0]+basis.r[0]*(sx-VW/2)/cam.F+basis.u[0]*(VH/2-sy)/cam.F,
                basis.f[1]+basis.r[1]*(sx-VW/2)/cam.F+basis.u[1]*(VH/2-sy)/cam.F,
                basis.f[2]+basis.r[2]*(sx-VW/2)/cam.F+basis.u[2]*(VH/2-sy)/cam.F ];
    if(dir[2] >= -1e-4) return null;
    const t = -cam.C[2]/dir[2];
    return { x:clamp(cam.C[0]+dir[0]*t, -0.6, CT.W+0.6), y:clamp(cam.C[1]+dir[1]*t, -1.2, CT.L+1.2) };
  }

  // ---- shell ----
  container.innerHTML = `
    <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:8px;">
      ${Object.keys(CAMS).map(k=>`<span class="chip ${k==="broadcast"?"on":""}" id="${uid}cam_${k}">🎥 ${CAMS[k].name}</span>`).join("")}
      <span class="muted" style="font-size:12px;margin-left:auto;">Singles · ${feed==="multi"?"Multi-shuttle":"Drill"}</span>
    </div>
    <div style="display:flex;justify-content:center;background:linear-gradient(#0a1822,#0c1410);border:1px solid var(--line);border-radius:14px;overflow:hidden;">
      <svg id="${uid}svg" viewBox="0 0 ${VW} ${VH}" style="width:100%;height:auto;touch-action:manipulation;">
        <g id="${uid}floor"></g><g id="${uid}zone"></g><g id="${uid}routes"></g>
        <g id="${uid}far"></g><g id="${uid}net"></g><g id="${uid}near"></g><g id="${uid}fx"></g>
        <circle id="${uid}ring" r="8" fill="none" stroke="#fff" stroke-width="1.6" stroke-dasharray="3 3" opacity="0"/>
      </svg>
    </div>
    <div id="${uid}note" class="muted" style="font-size:13px;min-height:18px;margin-top:6px;text-align:center;"></div>
    ${editing ? `
    <div style="margin-top:6px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
      <select id="${uid}shot" style="flex:1;min-width:130px;">${SHOT_ORDER.map(k=>`<option value="${k}">${SHOTS[k].name}</option>`).join("")}</select>
      <span class="chip" id="${uid}ss">Set start</span>
      <span class="chip" id="${uid}mv">Move</span>
      ${feed==="multi" ? `<span class="chip" id="${uid}fd">Place feeder</span><select id="${uid}rate" style="width:auto;font-size:12px;"><option value="fast">Rapid feed</option><option value="normal">Steady feed</option><option value="slow">Relaxed feed</option></select>` : ``}
      <button class="btn" id="${uid}rec" style="padding:7px 11px;font-size:12px;">Recover</button>
      <button class="btn" id="${uid}undo" style="padding:7px 11px;font-size:12px;">Undo</button>
      <button class="btn" id="${uid}clr" style="padding:7px 11px;font-size:12px;">Clear</button>
    </div>
    ${feed!=="multi" ? `<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:8px;">
      <span class="muted" style="font-size:12px;">Players</span>
      <span style="display:flex;gap:5px;align-items:center;">
        <button class="btn" id="${uid}am" style="padding:3px 9px;font-size:12px;">−</button>
        <span id="${uid}an" style="color:#a4dd2b;font-weight:600;font-size:13px;min-width:14px;text-align:center;">${meta.nA}</span>
        <button class="btn" id="${uid}ap" style="padding:3px 9px;font-size:12px;">+</button>
      </span>
      <span class="muted" style="font-size:12px;">vs</span>
      <span style="display:flex;gap:5px;align-items:center;">
        <button class="btn" id="${uid}bm" style="padding:3px 9px;font-size:12px;">−</button>
        <span id="${uid}bn" style="color:#5db9ff;font-weight:600;font-size:13px;min-width:14px;text-align:center;">${meta.nB}</span>
        <button class="btn" id="${uid}bp" style="padding:3px 9px;font-size:12px;">+</button>
      </span>
      <span class="muted" style="font-size:12px;">— e.g. 3 vs 1 for pressure drills</span>
    </div>` : ``}
    <div id="${uid}pal" style="display:flex;gap:7px;align-items:center;flex-wrap:wrap;margin-top:8px;"><span class="muted" style="font-size:12px;">Colour</span></div>
    <input id="${uid}noteIn" type="text" placeholder="Coaching note for the last shot (optional)" style="width:100%;margin-top:8px;">` : ``}
    <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
      <button class="btn" id="${uid}play" style="padding:8px 14px;">▶ Play</button>
      <button class="btn" id="${uid}rst" style="padding:8px 12px;">↺</button>
      <select id="${uid}spd" style="width:auto;"><option value="1.5">Fast</option><option value="1" selected>Normal</option><option value="0.5">Slow</option></select>
      <span id="${uid}hint" class="muted" style="font-size:12px;flex:1;min-width:140px;"></span>
    </div>
    <div id="${uid}list" style="margin-top:10px;display:flex;flex-direction:column;gap:5px;"></div>`;

  let drawColor = DCOLS[0], pend = null, raf = null, playing = false;
  let tCur = 0, stopAt = 0, lastTs = 0, activeIdx = -1, loopT0 = 0;
  let tl = null;
  let mvSel = null, mvOn = false, fdOn = false;   // Move tool / Place-feeder tool
  let ssSel = null, ssOn = false;                 // Set-start tool (positions, not steps)

  // ---------- static rendering ----------
  function polyPts(arr){ return arr.filter(Boolean).map(p=>p[0].toFixed(1)+","+p[1].toFixed(1)).join(" "); }
  function line3(x1,y1,x2,y2,col,wM){
    const a=proj(x1,y1,0), b=proj(x2,y2,0); if(!a||!b) return "";
    const w=Math.max(0.8, wM*cam.F/((a[2]+b[2])/2));
    return `<line x1="${a[0].toFixed(1)}" y1="${a[1].toFixed(1)}" x2="${b[0].toFixed(1)}" y2="${b[1].toFixed(1)}" stroke="${col}" stroke-width="${w.toFixed(1)}"/>`;
  }
  function renderStatic(){
    calcBasis();
    const mat=[proj(-2,-2.5,0),proj(CT.W+2,-2.5,0),proj(CT.W+2,CT.L+2.5,0),proj(-2,CT.L+2.5,0)];
    const crt=[proj(0,0,0),proj(CT.W,0,0),proj(CT.W,CT.L,0),proj(0,CT.L,0)];
    let f = `<polygon points="${polyPts(mat)}" fill="#10221c"/>`;
    if(crt.every(Boolean)) f += `<polygon points="${polyPts(crt)}" fill="#1a6b4e"/>
      <polygon points="${polyPts([proj(0,CT.SSLA,0),proj(CT.W,CT.SSLA,0),proj(CT.W,CT.SSLB,0),proj(0,CT.SSLB,0)])}" fill="#155c43"/>`;
    gid("floor").innerHTML = f + [
      [0,0,CT.W,0],[0,CT.L,CT.W,CT.L],[0,0,0,CT.L],[CT.W,0,CT.W,CT.L],
      [CT.SIN,0,CT.SIN,CT.L],[CT.SXL,0,CT.SXL,CT.L],
      [0,CT.SSLA,CT.W,CT.SSLA],[0,CT.SSLB,CT.W,CT.SSLB],
      [0,CT.DLSA,CT.W,CT.DLSA],[0,CT.DLSB,CT.W,CT.DLSB],
      [CT.CX,0,CT.CX,CT.SSLA],[CT.CX,CT.SSLB,CT.CX,CT.L]
    ].map(s=>line3(s[0],s[1],s[2],s[3],"#e9f5ec",0.04)).join("");
    const tA=proj(0,CT.NET,NETH_D), tB=proj(CT.W,CT.NET,NETH_D), bA=proj(0,CT.NET,NETB_D), bB=proj(CT.W,CT.NET,NETB_D);
    const fA=proj(0,CT.NET,0), fB=proj(CT.W,CT.NET,0);
    let net="";
    if(tA&&tB&&bA&&bB){
      net += `<polygon points="${polyPts([tA,tB,bB,bA])}" fill="rgba(210,230,220,.13)"/>`;
      for(let i=1;i<13;i++){ const x=CT.W*i/13, a=proj(x,CT.NET,NETH_D), b=proj(x,CT.NET,NETB_D); if(a&&b) net+=`<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="rgba(220,235,228,.35)" stroke-width="0.7"/>`; }
      for(let j=1;j<4;j++){ const z=NETB_D+(NETH_D-NETB_D)*j/4, a=proj(0,CT.NET,z), b=proj(CT.W,CT.NET,z); if(a&&b) net+=`<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="rgba(220,235,228,.3)" stroke-width="0.7"/>`; }
      net += `<line x1="${tA[0]}" y1="${tA[1]}" x2="${tB[0]}" y2="${tB[1]}" stroke="#fff" stroke-width="2.4"/>`;
      if(fA) net += `<line x1="${fA[0]}" y1="${fA[1]}" x2="${tA[0]}" y2="${tA[1]}" stroke="#cfd6cd" stroke-width="2"/>`;
      if(fB) net += `<line x1="${fB[0]}" y1="${fB[1]}" x2="${tB[0]}" y2="${tB[1]}" stroke="#cfd6cd" stroke-width="2"/>`;
    }
    gid("net").innerHTML = net;
    gid("zone").innerHTML = (pend && SHOTS[curShot()].serve)
      ? (()=>{ const b=serveBox(pend.from.x,pend.from.y);
          const pts=[proj(b.x1,b.y1,0),proj(b.x2,b.y1,0),proj(b.x2,b.y2,0),proj(b.x1,b.y2,0)];
          return pts.every(Boolean) ? `<polygon points="${polyPts(pts)}" fill="rgba(164,221,43,.20)" stroke="#a4dd2b" stroke-width="1.4" stroke-dasharray="6 4"/>` : ""; })()
      : "";
    gid("routes").innerHTML = steps.map((st,i)=>{
      if(st.rec) return "";
      const sh=SHOTS[st.shot]||SHOTS.clear;
      const tr=clearNet({x1:st.from.x,y1:st.from.y,x2:st.to.x,y2:st.to.y,z0:sh.z0,h:sh.h});
      let d="",ok=true;
      for(let k=0;k<=22;k++){ const fp=flightPos(tr,k/22), p=proj(fp.x,fp.y,fp.z); if(!p){ok=false;break;} d+=(k?"L":"M")+p[0].toFixed(1)+" "+p[1].toFixed(1)+" "; }
      if(!ok) return "";
      const land=proj(st.to.x,st.to.y,0), mid=proj((st.from.x+st.to.x)/2,(st.from.y+st.to.y)/2,Math.max(tr.z0*0.5,tr.h*0.9));
      return `<path d="${d}" fill="none" stroke="${st.color}" stroke-width="${i===activeIdx?2.6:1.5}" opacity="${i===activeIdx?0.95:0.5}" stroke-dasharray="${i===activeIdx?"none":"5 4"}"/>
        ${land?`<circle cx="${land[0]}" cy="${land[1]}" r="3.4" fill="none" stroke="${st.color}" stroke-width="1.3" opacity="0.8"/>`:""}
        ${st.out&&land?`<text x="${land[0]}" y="${land[1]-6}" font-size="10" fill="#ff7b7b" text-anchor="middle">OUT</text>`:""}
        ${mid?`<g transform="translate(${mid[0]},${mid[1]})"><circle r="7.2" fill="#0c1410" stroke="${st.color}" stroke-width="1.2"/><text y="3.3" font-size="9" fill="${st.color}" text-anchor="middle" font-weight="700">${stepNo(i)}</text></g>`:""}`;
    }).join("");
    if(pend){ const c=proj(pend.from.x,pend.from.y,0); if(c){ gid("ring").setAttribute("cx",c[0]); gid("ring").setAttribute("cy",c[1]); gid("ring").setAttribute("opacity","1"); } }
    else gid("ring").setAttribute("opacity","0");
  }
  function stepNo(i){ let n=0; for(let k=0;k<=i;k++) if(!steps[k].rec) n++; return n; }

  // ---------- figures ----------
  function poseJoints(name, blend, from){
    const a=POSES[from||"ready"], b=POSES[name]||POSES.ready, out={};
    JOINTS.forEach(j=>{ out[j]=[ a[j][0]+(b[j][0]-a[j][0])*blend, a[j][1]+(b[j][1]-a[j][1])*blend ]; });
    return out;
  }
  function figureSVG(pl, st){
    const anchor = proj(st.x, st.y, 0);
    if(!anchor) return { svg:"", far: st.y>CT.NET };
    if(basis.bird){
      return { far: st.y>CT.NET, svg:`<circle cx="${anchor[0]}" cy="${anchor[1]}" r="7.5" fill="${pl.jersey}" stroke="#0c1410" stroke-width="1.3"/><text x="${anchor[0]}" y="${anchor[1]+3.1}" font-size="8" text-anchor="middle" fill="#0c1410" font-weight="700">${pl.p}</text>` };
    }
    const FIG = 0.8;
    const s = cam.F/anchor[2];
    const J = poseJoints(st.pose, st.blend==null?1:st.blend, st.poseFrom);
    const P = (j)=>{ const lx=J[j][0]*st.face*FIG, lz=(J[j][1]+(st.zoff||0))*FIG;
      return proj(st.x + basis.r[0]*lx, st.y + basis.r[1]*lx, lz); };
    const pts={}; let ok=true;
    JOINTS.forEach(j=>{ pts[j]=P(j); if(!pts[j]) ok=false; });
    if(!ok) return { svg:"", far: st.y>CT.NET };
    const w = m => Math.max(0.9, m*s);
    const L=(a,b,col,wm)=>`<line x1="${pts[a][0].toFixed(1)}" y1="${pts[a][1].toFixed(1)}" x2="${pts[b][0].toFixed(1)}" y2="${pts[b][1].toFixed(1)}" stroke="${col}" stroke-width="${w(wm).toFixed(1)}" stroke-linecap="round"/>`;
    const shadow = `<ellipse cx="${anchor[0]}" cy="${anchor[1]}" rx="${(0.26*s).toFixed(1)}" ry="${(0.08*s).toFixed(1)}" fill="rgba(0,0,0,.32)"/>`;
    const rkLen = Math.hypot(pts.rk[0]-pts.hR[0], pts.rk[1]-pts.hR[1]);
    const rkAng = Math.atan2(pts.rk[1]-pts.hR[1], pts.rk[0]-pts.hR[0])*180/Math.PI;
    const racket = `<line x1="${pts.hR[0]}" y1="${pts.hR[1]}" x2="${pts.rk[0]}" y2="${pts.rk[1]}" stroke="#9aa49a" stroke-width="${w(0.02)}"/>
      <ellipse cx="${pts.rk[0]}" cy="${pts.rk[1]}" rx="${Math.max(1.6,rkLen*0.32)}" ry="${Math.max(1.1,rkLen*0.22)}" transform="rotate(${rkAng.toFixed(0)} ${pts.rk[0]} ${pts.rk[1]})" fill="rgba(230,240,235,.16)" stroke="#aeb8af" stroke-width="${w(0.014)}"/>`;
    const shoe = Math.max(1.4, 0.05*s);
    const svg = shadow
      + L("hip","kL","#16201a",0.062) + L("kL","fL","#16201a",0.055)
      + L("hip","kR","#16201a",0.062) + L("kR","fR","#16201a",0.055)
      + `<line x1="${(pts.fL[0]-shoe).toFixed(1)}" y1="${pts.fL[1]}" x2="${(pts.fL[0]+shoe).toFixed(1)}" y2="${pts.fL[1]}" stroke="#e8efe6" stroke-width="${w(0.03)}" stroke-linecap="round"/>`
      + `<line x1="${(pts.fR[0]-shoe).toFixed(1)}" y1="${pts.fR[1]}" x2="${(pts.fR[0]+shoe).toFixed(1)}" y2="${pts.fR[1]}" stroke="#e8efe6" stroke-width="${w(0.03)}" stroke-linecap="round"/>`
      + L("neck","hip",pl.jersey,0.125)
      + L("neck","hL","#d9b08c",0.04) + L("neck","hR","#d9b08c",0.04)
      + `<circle cx="${pts.head[0].toFixed(1)}" cy="${pts.head[1].toFixed(1)}" r="${(0.075*s).toFixed(1)}" fill="#d9b08c"/>`
      + racket;
    return { svg, far: st.y>CT.NET };
  }

  function shuttleSVG(x,y,z,px,py){
    const p=proj(x,y,z); if(!p) return "";
    const prev = (px!=null) ? proj(px,py==null?y:py, z) : null;
    let ang=0;
    if(prev) ang=Math.atan2(p[1]-prev[1],p[0]-prev[0])*180/Math.PI;
    const s=clamp(cam.F/p[2]*0.022, 0.55, 1.9);
    const g=proj(x,y,0);
    const shR = g ? clamp(0.09*cam.F/g[2]*(1+z*0.25), 1.5, 6) : 0;
    return (g?`<ellipse cx="${g[0].toFixed(1)}" cy="${g[1].toFixed(1)}" rx="${shR.toFixed(1)}" ry="${(shR*0.45).toFixed(1)}" fill="rgba(0,0,0,.28)"/>`:"")
      + `<g transform="translate(${p[0].toFixed(1)},${p[1].toFixed(1)}) rotate(${ang.toFixed(0)}) scale(${s.toFixed(2)})">`
      +   `<path d="M 2.4 0 L -5.4 -3.4 Q -6.6 0 -5.4 3.4 Z" fill="#f4f8f3" stroke="#aab4ab" stroke-width="0.6"/>`
      +   `<line x1="1.8" y1="0" x2="-5.2" y2="-2.1" stroke="#c4cec5" stroke-width="0.45"/>`
      +   `<line x1="1.8" y1="0" x2="-5.6" y2="0" stroke="#c4cec5" stroke-width="0.45"/>`
      +   `<line x1="1.8" y1="0" x2="-5.2" y2="2.1" stroke="#c4cec5" stroke-width="0.45"/>`
      +   `<circle cx="2.9" cy="0" r="1.9" fill="#efe7da" stroke="#b89a7a" stroke-width="0.7"/>`
      + `</g>`;
  }

  // ---------- timeline ----------
  function nearestOf(P, x, y, prefix){
    let best=null, bd=1e9;
    players.forEach(pl=>{
      if(prefix && pl.p[0]!==prefix) return;
      if(pl.feeder) return;
      const q=P[pl.p]; if(!q) return;
      const d=(q.x-x)*(q.x-x)+(q.y-y)*(q.y-y);
      if(d<bd){ bd=d; best=pl.p; }
    });
    return best;
  }
  function compile(){
    const movers=[], flights=[], poses=[], fx=[], segs=[];
    const P={}; players.forEach(pl=>P[pl.p]={x:pl.base.x,y:pl.base.y});
    const avail={}; players.forEach(pl=>avail[pl.p]=0);
    const oneVone = feed!=="multi" && meta.nA===1 && meta.nB===1;
    const nextHit=(i)=>{ for(let k=i+1;k<steps.length;k++){ if(!steps[k].rec) return steps[k]; } return null; };
    let prevFlight=null, tEnd=0, lastContact=0;

    steps.forEach((st,i)=>{
      if(st.rec){
        if(!P[st.p]){ segs.push([tEnd,tEnd,i]); return; }
        // choreographed movement runs IN PARALLEL with the rally, not after it
        const t0=Math.max(avail[st.p], lastContact?lastContact+0.12:0);
        const dur=clamp(dist2(P[st.p],st.to)/4.8,0.25,1.3);
        movers.push({p:st.p,from:{...P[st.p]},to:{...st.to},t0,t1:t0+dur});
        P[st.p]={...st.to}; avail[st.p]=t0+dur;
        tEnd=Math.max(tEnd,t0+dur);
        segs.push([t0,t0+dur,i]);
        return;
      }
      const sh=SHOTS[st.shot]||SHOTS.clear;
      const side = st.from.y<CT.NET ? "A" : "B";
      const hitter = (st.hitter && P[st.hitter]) ? st.hitter : nearestOf(P, st.from.x, st.from.y, feed==="multi"?"A":side);
      if(!hitter){ segs.push([tEnd,tEnd,i]); return; }
      let contact, seg0;
      const chained = feed!=="multi" && prevFlight && dist2(prevFlight.to, st.from)<0.5;
      if(feed==="multi"){
        // reposition while the feeder reloads, then strike the feed DIRECTLY —
        // the feed arrives exactly at the player's contact point and height.
        // Feed rate sets the rhythm; at Rapid the previous answer can still
        // be airborne when the next feed launches (real multi-shuttle).
        const rt=FEEDRATE[meta.rate]||FEEDRATE.normal;
        const tSnap=Math.max(avail[hitter], lastContact?lastContact+rt.gap:0.1);
        const gd=clamp(dist2(P[hitter],st.from)/6,0.05,0.4);
        movers.push({p:hitter,from:{...P[hitter]},to:{...st.from},t0:tSnap,t1:tSnap+gd});
        P[hitter]={...st.from};
        const tFeed=tSnap+gd+0.12;
        contact=tFeed+rt.fd; seg0=tSnap;
        flights.push({t0:tFeed,t1:contact,tr:clearNet({x1:meta.feeder.x,y1:meta.feeder.y,x2:st.from.x,y2:st.from.y,z0:1.15,z1:sh.z0,h:0.9}),feed:true,idx:i});
        poses.push({p:"C",pose:"serve",t0:tFeed-0.12,t1:tFeed+0.3});
        poses.push({p:hitter,pose:sh.pose,t0:contact-0.25,t1:contact+0.2});
      }else if(chained){
        // rally continuity: arrive DURING the incoming flight and take the
        // shuttle out of the air the instant it reaches the contact point
        contact=prevFlight.t1; seg0=prevFlight.t0;
        let t0=Math.max(avail[hitter], prevFlight.t0+0.05);
        if(t0>contact-0.15) t0=Math.max(0,contact-0.3);
        const t1=Math.min(contact-0.05, t0+clamp(dist2(P[hitter],st.from)/5,0.12,1.2));
        movers.push({p:hitter,from:{...P[hitter]},to:{...st.from},t0,t1:Math.max(t1,t0+0.08)});
        P[hitter]={...st.from};
        poses.push({p:hitter,pose:sh.pose,t0:contact-0.22,t1:contact+0.2});
      }else{
        const t0=Math.max(avail[hitter], prevFlight?prevFlight.t1:0);
        const runDur=clamp(dist2(P[hitter],st.from)/5,0.25,1.2);
        movers.push({p:hitter,from:{...P[hitter]},to:{...st.from},t0,t1:t0+runDur});
        P[hitter]={...st.from};
        contact=t0+runDur+0.16; seg0=t0;
        poses.push({p:hitter,pose:sh.pose,t0:t0+runDur,t1:contact+0.2});
      }
      avail[hitter]=contact+0.2;
      // if the NEXT shot is played from this landing spot, the shuttle never
      // touches the ground — it flies to the next player's contact height
      const nh=nextHit(i);
      const willChain = feed!=="multi" && nh && dist2(nh.from, st.to)<0.5;
      const z1 = willChain ? (SHOTS[nh.shot]||SHOTS.clear).z0 : 0;
      flights.push({t0:contact,t1:contact+sh.dur,tr:clearNet({x1:st.from.x,y1:st.from.y,x2:st.to.x,y2:st.to.y,z0:sh.z0,z1,h:sh.h}),idx:i,color:st.color});
      fx.push({kind:"hit",t:contact,x:st.from.x,y:st.from.y,z:sh.z0});
      if(!willChain && feed!=="multi") fx.push({kind:"land",t:contact+sh.dur,x:st.to.x,y:st.to.y,out:st.out});
      // automatic rally habits in pure 1v1 (with squads the coach choreographs)
      if(oneVone){
        const other = hitter==="A1"?"B1":"A1";
        if(FAST[st.shot]) poses.push({p:other,pose:"defense",t0:contact+sh.dur*0.35,t1:contact+sh.dur+0.15});
        const nhh = nh ? ((nh.hitter&&P[nh.hitter])?nh.hitter:(nh.from.y<CT.NET?"A1":"B1")) : null;
        if(nhh!==hitter){
          const hb=players.find(q=>q.p===hitter).base;
          movers.push({p:hitter,from:{...P[hitter]},to:{...hb},t0:contact+0.15,t1:contact+0.15+clamp(dist2(P[hitter],hb)/4.5,0.3,1.3)});
          P[hitter]={...hb};
        }
        if(!nh){
          const ob=players.find(q=>q.p===other).base;
          movers.push({p:other,from:{...P[other]},to:{...ob},t0:contact+sh.dur*0.5,t1:contact+sh.dur*0.5+clamp(dist2(P[other],ob)/5,0.3,1.2)});
          P[other]={...ob};
        }
      }
      prevFlight={t0:contact,t1:contact+sh.dur,to:{...st.to},idx:i};
      lastContact=contact;
      tEnd=Math.max(tEnd, contact+sh.dur+0.3);
      segs.push([seg0, contact+sh.dur, i]);
    });
    return { movers, flights, poses, fx, segs, total:tEnd };
  }

  function evalAt(t){
    const st={};
    players.forEach(pl=>{ st[pl.p]={ x:pl.base.x, y:pl.base.y, pose:pl.feeder?"feeder":"ready", poseFrom:pl.feeder?"feeder":"ready", blend:1, face:pl.p[0]==="B"?-1:1, zoff:0, moving:false }; });
    tl.movers.forEach(m=>{
      const s=st[m.p]; if(!s) return;
      if(t>=m.t1){ s.x=m.to.x; s.y=m.to.y; }
      else if(t>=m.t0){ const k=ease((t-m.t0)/(m.t1-m.t0)); s.x=m.from.x+(m.to.x-m.from.x)*k; s.y=m.from.y+(m.to.y-m.from.y)*k; s.moving=true;
        if(Math.abs(m.to.x-m.from.x)>0.15) s.face=Math.sign(m.to.x-m.from.x);
        s.zoff=Math.abs(Math.sin((t-m.t0)*9))*0.05; }
    });
    players.forEach(pl=>{ const s=st[pl.p]; if(s.moving && !pl.feeder){ s.pose="run"; s.blend=1; s.poseFrom="ready"; } });
    tl.poses.forEach(pe=>{
      const s=st[pe.p]; if(!s) return;
      if(t>=pe.t0 && t<=pe.t1+0.15){
        const inK=clamp((t-pe.t0)/0.15,0,1), outK=clamp((t-pe.t1)/0.15,0,1);
        s.pose=pe.pose; s.poseFrom = s.moving?"run":"ready"; s.blend = inK;
        if(t>pe.t1) s.blend = 1-outK;
      }
    });
    const shuttles=[];
    tl.flights.forEach(fl=>{
      if(t>=fl.t0 && t<=fl.t1){
        const k=(t-fl.t0)/(fl.t1-fl.t0), fp=flightPos(fl.tr,k), pv=flightPos(fl.tr,Math.max(0,k-0.05));
        shuttles.push({ ...fp, px:pv.x, py:pv.y, idx:fl.idx });
      }
    });
    return { st, shuttles };
  }

  function renderDynamic(t){
    const { st, shuttles } = tl ? evalAt(t) : { st:null, shuttles:[] };
    let far="", near="";
    players.forEach(pl=>{
      const ps = st ? st[pl.p] : { x:pl.base.x, y:pl.base.y, pose:pl.feeder?"feeder":"ready", poseFrom:"ready", blend:1, face:pl.p[0]==="B"?-1:1, zoff:0 };
      const fig=figureSVG(pl, ps);
      if(fig.far) far+=fig.svg; else near+=fig.svg;
    });
    (shuttles||[]).forEach(shu=>{
      const s=shuttleSVG(shu.x,shu.y,shu.z,shu.px,shu.py);
      if(shu.y>CT.NET) far+=s; else near+=s;
    });
    if(shuttles && shuttles.length){
      const last=shuttles[shuttles.length-1];
      if(tl && last.idx!==activeIdx){ activeIdx=last.idx; renderStatic(); markList(activeIdx); showNote(activeIdx); }
    }
    gid("far").innerHTML=far; gid("near").innerHTML=near;
    let fxs="";
    if(tl) tl.fx.forEach(e=>{
      const dt=t-e.t;
      if(e.kind==="hit" && dt>=0 && dt<0.28){ const p=proj(e.x,e.y,e.z); if(p){ const r=4+dt*60; fxs+=`<circle cx="${p[0]}" cy="${p[1]}" r="${r}" fill="none" stroke="#fff" stroke-width="2" opacity="${(1-dt/0.28).toFixed(2)}"/>`; } }
      if(e.kind==="land" && dt>=0 && dt<0.5){
        const rM=0.12+dt*0.8, pts=[];
        for(let a=0;a<10;a++){ const an=a/10*Math.PI*2, p=proj(e.x+Math.cos(an)*rM, e.y+Math.sin(an)*rM, 0); if(p) pts.push(p); }
        if(pts.length>4) fxs+=`<polygon points="${polyPts(pts)}" fill="none" stroke="${e.out?"#ff7b7b":"#fff"}" stroke-width="1.6" opacity="${(1-dt/0.5).toFixed(2)}"/>`;
      }
    });
    gid("fx").innerHTML=fxs;
  }

  // ---------- list / notes ----------
  function esc(s){ return String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c])); }
  function paintList(){
    const el=gid("list"); if(!el) return;
    el.innerHTML = steps.length ? steps.map((s,i)=>{
      const name = s.rec ? esc(s.p)+" → moves" : ((SHOTS[s.shot]||{}).name||s.shot);
      return `<div data-st="${i}" style="display:flex;gap:8px;align-items:center;padding:7px 10px;border:1px solid ${i===activeIdx?"var(--brand)":"var(--line)"};border-radius:9px;cursor:pointer;">
        <span style="width:8px;height:8px;border-radius:50%;background:${s.rec?"#888":s.color};flex:0 0 auto;"></span>
        <div style="flex:1;font-size:13px;">${s.rec?"":"<b>"+stepNo(i)+".</b> "}${esc(name)}${(!s.rec&&s.hitter)?` <span class="muted" style="font-size:11px;">· ${esc(s.hitter)}</span>`:""}${s.out?` <span style="color:#ff7b7b;font-size:11px;">OUT</span>`:""}${s.note?`<div class="muted" style="font-size:12px;">${esc(s.note)}</div>`:""}</div>
        ${editing?`<button class="btn" data-del="${i}" style="padding:2px 8px;font-size:11px;">✕</button>`:""}
      </div>`;
    }).join("") : `<div class="muted" style="font-size:12px;">${editing?"No shots yet — pick a shot + colour, tap where it's hit from, then where it lands.":"No shots in this drill yet."}</div>`;
    el.querySelectorAll("[data-st]").forEach(row=>row.onclick=(e)=>{ if(e.target.dataset.del!==undefined) return; previewSeg(parseInt(row.dataset.st,10)); });
    el.querySelectorAll("[data-del]").forEach(b=>b.onclick=(e)=>{ e.stopPropagation(); steps.splice(parseInt(b.dataset.del,10),1); afterStepsChange(); });
  }
  function markList(i){
    const el=gid("list"); if(!el) return;
    el.querySelectorAll("[data-st]").forEach(r=>{ r.style.borderColor = (parseInt(r.dataset.st,10)===i)?"var(--brand)":"var(--line)"; });
  }
  function showNote(i){
    const n=gid("note"); if(!n) return;
    const s=steps[i];
    n.textContent = (s && !s.rec && s.note) ? "“"+s.note+"”" : "";
  }
  function hint(msg,warn){ const h=gid("hint"); if(h){ h.textContent=msg; h.style.color=warn?"var(--down)":"var(--muted)"; } }

  // ---------- edit ----------
  const curShot = ()=> editing ? gid("shot").value : "clear";
  function svgXY(evt){
    const svg=gid("svg"), pt=svg.createSVGPoint();
    const s=evt.touches&&evt.touches[0]?evt.touches[0]:evt;
    pt.x=s.clientX; pt.y=s.clientY;
    const m=svg.getScreenCTM(); if(!m) return null;
    const sp=pt.matrixTransform(m.inverse());
    return floorPoint(sp.x, sp.y);
  }
  function curPositions(){
    if(!tl) tl=compile();
    const snap=evalAt(tl.total), out={};
    players.forEach(pl=>{ out[pl.p]={x:snap.st[pl.p].x, y:snap.st[pl.p].y}; });
    return out;
  }
  function onTap(evt){
    if(!editing || playing) return;
    const c=svgXY(evt); if(!c) return;
    // place-feeder tool
    if(fdOn){
      meta.feeder={x:+c.x.toFixed(2), y:+c.y.toFixed(2)};
      const fp=players.find(q=>q.p==="C"); if(fp) fp.base={...meta.feeder};
      fdOn=false; gid("fd").classList.remove("on");
      hint("Feeder placed. He'll feed every shuttle from there.");
      afterStepsChange(); return;
    }
    // set-start tool: starting positions, NOT steps — nothing plays
    if(ssOn){
      const P=curPositions();
      if(!ssSel){
        let best=null,bd=1e9;
        players.forEach(pl=>{ const q=P[pl.p], d=(q.x-c.x)*(q.x-c.x)+(q.y-c.y)*(q.y-c.y); if(d<bd){bd=d;best=pl.p;} });
        ssSel=best;
        hint("Now tap where "+ssSel+" should START.");
        return;
      }
      if(ssSel==="C") meta.feeder={x:+c.x.toFixed(2), y:+c.y.toFixed(2)};
      else meta.bases[ssSel]={x:+c.x.toFixed(2), y:+c.y.toFixed(2)};
      players=buildPlayers();
      const who=ssSel; ssSel=null; ssOn=false; gid("ss").classList.remove("on");
      afterStepsChange();
      hint(who+" starts there now. Set another, or build shots.");
      return;
    }
    // move tool: pick a player, then a destination
    if(mvOn){
      if(!mvSel){
        const P=curPositions();
        let best=null,bd=1e9;
        players.forEach(pl=>{ const q=P[pl.p], d=(q.x-c.x)*(q.x-c.x)+(q.y-c.y)*(q.y-c.y); if(d<bd){bd=d;best=pl.p;} });
        mvSel=best;
        hint("Now tap where "+mvSel+" should go.");
        return;
      }
      // before any shots exist, "moving" a player just sets their lineup —
      // it only becomes a real drill move once the rally has begun
      if(!steps.some(s=>!s.rec)){
        if(mvSel==="C") meta.feeder={x:+c.x.toFixed(2), y:+c.y.toFixed(2)};
        else meta.bases[mvSel]={x:+c.x.toFixed(2), y:+c.y.toFixed(2)};
        players=buildPlayers();
        const who=mvSel; mvSel=null; mvOn=false; gid("mv").classList.remove("on");
        afterStepsChange();
        hint(who+" placed in the lineup (no shots yet). During a rally, Move becomes a real move.");
        return;
      }
      steps.push({ rec:true, p:mvSel, to:{x:+c.x.toFixed(2), y:+c.y.toFixed(2)} });
      const done=mvSel; mvSel=null; mvOn=false; gid("mv").classList.remove("on");
      afterStepsChange();
      hint(done+" will make that move during the rally. ▶ Play to watch.");
      return;
    }
    const sh=SHOTS[curShot()];
    if(!pend){
      if(feed==="multi" && c.y>=CT.NET-0.15){ hint("Tap on the player's side — the feeder sends shuttles there.", true); return; }
      const P=curPositions();
      const side = c.y<CT.NET ? "A" : "B";
      const hitter = nearestOf(P, c.x, c.y, feed==="multi" ? "A" : side);
      pend={ from:{x:+c.x.toFixed(2), y:+c.y.toFixed(2)}, hitter };
      hint(sh.serve ? "Legal service court highlighted — tap where the serve lands." : "Now tap where the "+sh.name.toLowerCase()+" lands"+(hitter?" ("+hitter+" hits)":"")+".");
      renderStatic(); return;
    }
    if(sh.serve && !inBox(serveBox(pend.from.x,pend.from.y), c.x, c.y)){ hint("Illegal serve — it must land in the highlighted diagonal box.", true); return; }
    if(!sh.serve && feed!=="multi" && ((c.y<CT.NET)===(pend.from.y<CT.NET))){ hint("The shuttle must cross the net — tap the other side.", true); return; }
    const st={ shot:curShot(), color:drawColor, from:pend.from, to:{x:+c.x.toFixed(2), y:+c.y.toFixed(2)}, hitter:pend.hitter, note:"" };
    st.out = !sh.serve && !inSingles(st.to.x, st.to.y);
    // reachability check: in a chained rally, can the hitter cover the ground
    // during the incoming flight? (~6 m/s is elite court speed)
    let warn="";
    if(feed!=="multi" && !sh.serve && pend.hitter){
      let prev=null; for(let i2=steps.length-1;i2>=0;i2--){ if(!steps[i2].rec){ prev=steps[i2]; break; } }
      if(prev && dist2(prev.to, st.from)<0.5){
        const Pnow=curPositions();
        const q=Pnow[pend.hitter];
        const v = q ? dist2(q, st.from)/Math.max(0.25,(SHOTS[prev.shot]||SHOTS.clear).dur) : 0;
        if(v>6) warn=" ⚠ "+pend.hitter+" would need ~"+Math.round(v)+" m/s to get there in time — probably unreachable.";
      }
    }
    steps.push(st); pend=null;
    afterStepsChange();
    hint("Added. Next shot, Move a player, or ▶ Play."+warn, !!warn);
  }
  function afterStepsChange(){
    tl=compile(); pend=null; activeIdx=-1; stop();
    renderStatic(); renderDynamic(tl.total); paintList(); showNote(-1);
  }

  // ---------- transport ----------
  const speed=()=>parseFloat(gid("spd").value)||1;
  function stop(){ playing=false; if(raf) cancelAnimationFrame(raf); raf=null; const b=gid("play"); if(b) b.textContent="▶ Play"; }
  function loop(ts){
    if(!playing) return;
    if(!document.body.contains(gid("svg"))){ stop(); return; }
    if(!lastTs) lastTs=ts;
    tCur += (ts-lastTs)/1000*speed(); lastTs=ts;
    if(tCur>=stopAt) tCur = loopT0-0.35;   // loop again and again until paused
    renderDynamic(Math.max(0,tCur));
    raf=requestAnimationFrame(loop);
  }
  function playFrom(t0, t1){
    if(!tl || !tl.total) return;
    tCur=t0; stopAt=t1; loopT0=t0; lastTs=0; playing=true;
    gid("play").textContent="❚❚ Pause";
    raf=requestAnimationFrame(loop);
  }
  function previewSeg(i){
    if(!tl) tl=compile();
    const seg=tl.segs.find(s=>s[2]===i); if(!seg) return;
    activeIdx=i; renderStatic(); markList(i); showNote(i);
    playFrom(seg[0], seg[1]);
  }

  // ---------- camera ----------
  function setCam(key){
    Object.keys(CAMS).forEach(k=>gid("cam_"+k).classList.toggle("on",k===key));
    const from={C:[...cam.C],T:[...cam.T],F:cam.F}, to=CAMS[key];
    const t0=performance.now();
    const tw=(ts)=>{
      if(!document.body.contains(gid("svg"))) return;
      const k=ease(clamp((ts-t0)/600,0,1));
      cam.C=vlerp(from.C,to.C,k); cam.T=vlerp(from.T,to.T,k); cam.F=from.F+(to.F-from.F)*k;
      renderStatic(); renderDynamic(playing?tCur:(tl?Math.min(tCur,tl.total):0));
      if(k<1) requestAnimationFrame(tw);
    };
    requestAnimationFrame(tw);
  }

  // ---------- wire ----------
  gid("svg").addEventListener("pointerdown", onTap);
  Object.keys(CAMS).forEach(k=>{ gid("cam_"+k).onclick=()=>setCam(k); });
  gid("play").onclick=()=>{ if(playing){ stop(); } else if(tl && stopAt>0 && tCur<stopAt){ lastTs=0; playing=true; gid("play").textContent="❚❚ Pause"; raf=requestAnimationFrame(loop); } else { tCur=0; activeIdx=-1; playFrom(0, tl?tl.total:0); } };
  gid("rst").onclick=()=>{ stop(); tCur=0; stopAt=0; activeIdx=-1; renderStatic(); renderDynamic(0); markList(-1); showNote(-1); };
  if(editing){
    DCOLS.forEach(c=>{
      const b=document.createElement("button");
      b.style.cssText="width:20px;height:20px;border-radius:50%;cursor:pointer;padding:0;background:"+c+";border:2px solid "+(c===drawColor?"#fff":"transparent")+";";
      b.onclick=()=>{ drawColor=c; Array.prototype.forEach.call(gid("pal").querySelectorAll("button"),(x,i)=>{ x.style.border="2px solid "+(DCOLS[i]===drawColor?"#fff":"transparent"); }); };
      gid("pal").appendChild(b);
    });
    gid("shot").onchange=()=>{ pend=null; renderStatic(); hint(SHOTS[curShot()].serve?"Serve: tap where the server stands — the legal box will light up.":"Tap where the shot is hit from."); };
    gid("ss").onclick=function(){ ssOn=!ssOn; ssSel=null; mvOn=false; mvSel=null; fdOn=false; gid("mv").classList.remove("on"); const f0=gid("fd"); if(f0) f0.classList.remove("on"); this.classList.toggle("on",ssOn); pend=null; renderStatic(); hint(ssOn?"Set start: tap a player, then tap where they should start. (Positions only — nothing plays.)":"Set start cancelled."); };
    gid("mv").onclick=function(){ mvOn=!mvOn; mvSel=null; ssOn=false; ssSel=null; fdOn=false; gid("ss").classList.remove("on"); const f=gid("fd"); if(f) f.classList.remove("on"); this.classList.toggle("on",mvOn); pend=null; renderStatic(); hint(mvOn?"Move: tap a player to pick them up.":"Move cancelled."); };
    const fd=gid("fd");
    if(fd) fd.onclick=function(){ fdOn=!fdOn; mvOn=false; mvSel=null; ssOn=false; ssSel=null; gid("mv").classList.remove("on"); gid("ss").classList.remove("on"); this.classList.toggle("on",fdOn); pend=null; renderStatic(); hint(fdOn?"Tap anywhere on the court to place the feeder.":"Feeder placement cancelled."); };
    const rate=gid("rate");
    if(rate){ rate.value=meta.rate; rate.onchange=()=>{ meta.rate=rate.value; afterStepsChange(); hint("Feed rhythm: "+rate.options[rate.selectedIndex].text+"."); }; }
    gid("rec").onclick=()=>{
      let p="A1";
      for(let i=steps.length-1;i>=0;i--){ if(!steps[i].rec){ p = steps[i].hitter || (feed==="multi" ? "A1" : (steps[i].from.y<CT.NET?"A1":"B1")); break; } }
      const pl=players.find(q=>q.p===p); if(!pl) return;
      steps.push({ rec:true, p, to:{...pl.base} });
      afterStepsChange();
      hint(p+" will recover to base during the rally.");
    };
    gid("undo").onclick=()=>{ steps.pop(); afterStepsChange(); };
    gid("clr").onclick=()=>{ steps=[]; afterStepsChange(); };
    gid("noteIn").oninput=function(){ for(let i=steps.length-1;i>=0;i--){ if(!steps[i].rec){ steps[i].note=this.value; paintList(); break; } } };
    if(feed!=="multi"){
      const setN=(team,delta)=>{
        if(team==="A") meta.nA=clamp(meta.nA+delta,1,4); else meta.nB=clamp(meta.nB+delta,1,4);
        gid("an").textContent=meta.nA; gid("bn").textContent=meta.nB;
        players=buildPlayers(); afterStepsChange();
        hint("Squad: "+meta.nA+" vs "+meta.nB+". Tap near a player to make them the hitter.");
      };
      gid("ap").onclick=()=>setN("A",1); gid("am").onclick=()=>setN("A",-1);
      gid("bp").onclick=()=>setN("B",1); gid("bm").onclick=()=>setN("B",-1);
    }
    hint(feed==="multi" ? "Multi-shuttle: tap where the feed lands (the player hits directly from there), then where the answer goes." : "Pick a shot + colour, tap where it's hit from, then where it lands.");
  }else{
    hint("Press ▶ Play — and try the camera angles while it runs.");
  }
  tl=compile();
  renderStatic(); renderDynamic(tl.total||0); paintList();

  return {
    getPoints: ()=> JSON.parse(JSON.stringify({ steps, feeder:meta.feeder, nA:meta.nA, nB:meta.nB, bases:meta.bases, rate:meta.rate })),
    hasShots: ()=> steps.some(s=>!s.rec),
    getView: ()=> "broadcast",
    destroy: ()=> stop()
  };
}

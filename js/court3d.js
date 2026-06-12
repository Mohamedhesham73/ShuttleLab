// =============================================================
//  PRO COURT (Singles) — a real 3D-projected badminton court with
//  posed athlete figures. Keeps the classic courts' control style:
//  shot select + colour palette + Recover + Clear + note + step
//  list + play/pause/speed — and adds switchable 3D cameras
//  (Broadcast / Corner / Side / Bird's-eye) with smooth glides.
//
//  mountProCourt(container, opts) → { getPoints, hasShots, destroy }
//    opts.points  saved steps     opts.mode "edit"|"play"
//    opts.feed    "drill"|"multi" (multi = coach-fed multi-shuttle)
//
//  Court is BWF-exact (13.40×6.10 m, singles lines 0.46 m in, net
//  1.524/1.55 m, short service 1.98 m, lines 40 mm). Serves are
//  validated against the legal diagonal singles service court.
// =============================================================

const CT = { W:6.1, L:13.4, NET:6.7, SSLA:4.72, SSLB:8.68, DLSA:0.76, DLSB:12.64, SIN:0.46, SXL:5.64, CX:3.05, NETH:1.55, NETB:0.76 };
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
  drive:    { name:"Drive",            z0:1.5,  h:0.12, dur:0.6,  pose:"drive" },
  push:     { name:"Push",             z0:1.3,  h:0.35, dur:0.9,  pose:"drive" },
  net:      { name:"Net shot",         z0:1.0,  h:0.3,  dur:1.0,  pose:"lunge" },
  kill:     { name:"Net kill",         z0:1.5,  h:0,    dur:0.35, pose:"lunge" },
  lift:     { name:"Lift / lob",       z0:0.85, h:4.2,  dur:1.55, pose:"lunge" },
  block:    { name:"Block (defense)",  z0:0.95, h:0.5,  dur:1.0,  pose:"defense" }
};
const SHOT_ORDER = ["servelow","servehigh","serveflick","clear","attclear","drop","fastdrop","smash","jsmash","halfsmash","drive","push","net","kill","lift","block"];
const DCOLS = ["#a4dd2b","#ffd34d","#ff5d6c","#5db9ff","#c77dff","#ffffff"];

const CAMS = {
  broadcast:{ name:"Broadcast", C:[3.05,-7.2,4.6], T:[3.05,8.0,0.2], F:640 },
  corner:   { name:"Corner",    C:[-5.0,-4.0,4.6], T:[3.05,7.0,0.3], F:560 },
  side:     { name:"Side",      C:[-9.8,6.7,2.4],  T:[3.05,6.7,0.9], F:470 },
  bird:     { name:"Bird's-eye",C:[3.05,6.7,15.5], T:[3.05,6.74,0],  F:480 }
};

// athlete poses — joints in metres, local frame (lx lateral, lz up from feet)
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
function flightPos(tr,k){ return { x:tr.x1+(tr.x2-tr.x1)*k, y:tr.y1+(tr.y2-tr.y1)*k, z:tr.z0*(1-k)+tr.h*Math.sin(Math.PI*k) }; }

export function mountProCourt(container, opts){
  opts = opts || {};
  const editing = (opts.mode||"edit") !== "play";
  const feed = opts.feed || "drill";
  let steps = Array.isArray(opts.points) ? JSON.parse(JSON.stringify(opts.points)) : [];
  const uid = "pc"+Math.floor(Math.random()*1e6);
  const gid = s => container.querySelector("#"+uid+s);

  // players
  const players = [{ p:"A", jersey:"#a4dd2b", base:{x:CT.CX,y:3.8} }];
  if(feed==="multi") players.push({ p:"C", jersey:"#aab4ab", base:{x:CT.CX,y:7.6}, feeder:true });
  else players.push({ p:"B", jersey:"#5db9ff", base:{x:CT.CX,y:9.6} });

  // camera
  let cam = { C:[...CAMS.broadcast.C], T:[...CAMS.broadcast.T], F:CAMS.broadcast.F };
  let camTw = null, basis = null;
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

  // ---------- shell ----------
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
      <button class="btn" id="${uid}rec" style="padding:7px 11px;font-size:12px;">Recover</button>
      <button class="btn" id="${uid}undo" style="padding:7px 11px;font-size:12px;">Undo</button>
      <button class="btn" id="${uid}clr" style="padding:7px 11px;font-size:12px;">Clear</button>
    </div>
    <div id="${uid}pal" style="display:flex;gap:7px;align-items:center;flex-wrap:wrap;margin-top:8px;"><span class="muted" style="font-size:12px;">Colour</span></div>
    <input id="${uid}noteIn" type="text" placeholder="Coaching note for the last shot (optional)" style="width:100%;margin-top:8px;">` : ``}
    <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
      <button class="btn" id="${uid}play" style="padding:8px 14px;">▶ Play</button>
      <button class="btn" id="${uid}rst" style="padding:8px 12px;">↺</button>
      <select id="${uid}spd" style="width:auto;"><option value="1">1×</option><option value="0.6">0.6×</option><option value="0.35">0.35×</option></select>
      <span id="${uid}hint" class="muted" style="font-size:12px;flex:1;min-width:140px;"></span>
    </div>
    <div id="${uid}list" style="margin-top:10px;display:flex;flex-direction:column;gap:5px;"></div>`;

  let drawColor = DCOLS[0], pend = null, raf = null, playing = false;
  let tCur = 0, stopAt = 0, lastTs = 0, activeIdx = -1;
  let tl = null;   // compiled timeline

  // ---------- static rendering ----------
  function polyPts(arr){ return arr.filter(Boolean).map(p=>p[0].toFixed(1)+","+p[1].toFixed(1)).join(" "); }
  function line3(x1,y1,x2,y2,col,wM,dash){
    const a=proj(x1,y1,0), b=proj(x2,y2,0); if(!a||!b) return "";
    const w=Math.max(0.8, wM*cam.F/((a[2]+b[2])/2));
    return `<line x1="${a[0].toFixed(1)}" y1="${a[1].toFixed(1)}" x2="${b[0].toFixed(1)}" y2="${b[1].toFixed(1)}" stroke="${col}" stroke-width="${w.toFixed(1)}"${dash?` stroke-dasharray="${dash}"`:""}/>`;
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
    // net with mesh
    const tA=proj(0,CT.NET,CT.NETH), tB=proj(CT.W,CT.NET,CT.NETH), bA=proj(0,CT.NET,CT.NETB), bB=proj(CT.W,CT.NET,CT.NETB);
    const fA=proj(0,CT.NET,0), fB=proj(CT.W,CT.NET,0);
    let net="";
    if(tA&&tB&&bA&&bB){
      net += `<polygon points="${polyPts([tA,tB,bB,bA])}" fill="rgba(210,230,220,.13)"/>`;
      for(let i=1;i<13;i++){ const x=CT.W*i/13, a=proj(x,CT.NET,CT.NETH), b=proj(x,CT.NET,CT.NETB); if(a&&b) net+=`<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="rgba(220,235,228,.35)" stroke-width="0.7"/>`; }
      for(let j=1;j<4;j++){ const z=CT.NETB+(CT.NETH-CT.NETB)*j/4, a=proj(0,CT.NET,z), b=proj(CT.W,CT.NET,z); if(a&&b) net+=`<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="rgba(220,235,228,.3)" stroke-width="0.7"/>`; }
      net += `<line x1="${tA[0]}" y1="${tA[1]}" x2="${tB[0]}" y2="${tB[1]}" stroke="#fff" stroke-width="2.6"/>`;
      if(fA) net += `<line x1="${fA[0]}" y1="${fA[1]}" x2="${tA[0]}" y2="${tA[1]}" stroke="#cfd6cd" stroke-width="2"/>`;
      if(fB) net += `<line x1="${fB[0]}" y1="${fB[1]}" x2="${tB[0]}" y2="${tB[1]}" stroke="#cfd6cd" stroke-width="2"/>`;
    }
    gid("net").innerHTML = net;
    // serve zone
    gid("zone").innerHTML = (pend && SHOTS[curShot()].serve)
      ? (()=>{ const b=serveBox(pend.from.x,pend.from.y);
          const pts=[proj(b.x1,b.y1,0),proj(b.x2,b.y1,0),proj(b.x2,b.y2,0),proj(b.x1,b.y2,0)];
          return pts.every(Boolean) ? `<polygon points="${polyPts(pts)}" fill="rgba(164,221,43,.20)" stroke="#a4dd2b" stroke-width="1.4" stroke-dasharray="6 4"/>` : ""; })()
      : "";
    // routes
    gid("routes").innerHTML = steps.map((st,i)=>{
      if(st.rec) return "";
      const sh=SHOTS[st.shot]||SHOTS.clear;
      const tr={x1:st.from.x,y1:st.from.y,x2:st.to.x,y2:st.to.y,z0:sh.z0,h:sh.h};
      let d="",ok=true;
      for(let k=0;k<=22;k++){ const fp=flightPos(tr,k/22), p=proj(fp.x,fp.y,fp.z); if(!p){ok=false;break;} d+=(k?"L":"M")+p[0].toFixed(1)+" "+p[1].toFixed(1)+" "; }
      if(!ok) return "";
      const land=proj(st.to.x,st.to.y,0), mid=proj((st.from.x+st.to.x)/2,(st.from.y+st.to.y)/2,Math.max(sh.z0*0.5,sh.h*0.9));
      return `<path d="${d}" fill="none" stroke="${st.color}" stroke-width="${i===activeIdx?2.6:1.5}" opacity="${i===activeIdx?0.95:0.5}" stroke-dasharray="${i===activeIdx?"none":"5 4"}"/>
        ${land?`<circle cx="${land[0]}" cy="${land[1]}" r="3.4" fill="none" stroke="${st.color}" stroke-width="1.3" opacity="0.8"/>`:""}
        ${st.out&&land?`<text x="${land[0]}" y="${land[1]-6}" font-size="10" fill="#ff7b7b" text-anchor="middle">OUT</text>`:""}
        ${mid?`<g transform="translate(${mid[0]},${mid[1]})"><circle r="7.2" fill="#0c1410" stroke="${st.color}" stroke-width="1.2"/><text y="3.3" font-size="9" fill="${st.color}" text-anchor="middle" font-weight="700">${stepNo(i)}</text></g>`:""}`;
    }).join("");
    // pending ring
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
      return { far: st.y>CT.NET, svg:`<circle cx="${anchor[0]}" cy="${anchor[1]}" r="9" fill="${pl.jersey}" stroke="#0c1410" stroke-width="1.4"/><text x="${anchor[0]}" y="${anchor[1]+3.4}" font-size="9" text-anchor="middle" fill="#0c1410" font-weight="700">${pl.p}</text>` };
    }
    const s = cam.F/anchor[2];
    const J = poseJoints(st.pose, st.blend==null?1:st.blend, st.poseFrom);
    const P = (j)=>{ const lx=J[j][0]*st.face, lz=J[j][1]+(st.zoff||0);
      return proj(st.x + basis.r[0]*lx, st.y + basis.r[1]*lx, lz); };
    const pts={}; let ok=true;
    JOINTS.forEach(j=>{ pts[j]=P(j); if(!pts[j]) ok=false; });
    if(!ok) return { svg:"", far: st.y>CT.NET };
    const w = m => Math.max(1, m*s);
    const L=(a,b,col,wm)=>`<line x1="${pts[a][0].toFixed(1)}" y1="${pts[a][1].toFixed(1)}" x2="${pts[b][0].toFixed(1)}" y2="${pts[b][1].toFixed(1)}" stroke="${col}" stroke-width="${w(wm).toFixed(1)}" stroke-linecap="round"/>`;
    const shadow = `<ellipse cx="${anchor[0]}" cy="${anchor[1]}" rx="${(0.34*s).toFixed(1)}" ry="${(0.10*s).toFixed(1)}" fill="rgba(0,0,0,.35)"/>`;
    const rkLen = Math.hypot(pts.rk[0]-pts.hR[0], pts.rk[1]-pts.hR[1]);
    const rkAng = Math.atan2(pts.rk[1]-pts.hR[1], pts.rk[0]-pts.hR[0])*180/Math.PI;
    const racket = `<line x1="${pts.hR[0]}" y1="${pts.hR[1]}" x2="${pts.rk[0]}" y2="${pts.rk[1]}" stroke="#9aa49a" stroke-width="${w(0.025)}"/>
      <ellipse cx="${pts.rk[0]}" cy="${pts.rk[1]}" rx="${Math.max(2,rkLen*0.34)}" ry="${Math.max(1.4,rkLen*0.24)}" transform="rotate(${rkAng.toFixed(0)} ${pts.rk[0]} ${pts.rk[1]})" fill="rgba(230,240,235,.18)" stroke="#aeb8af" stroke-width="${w(0.018)}"/>`;
    const svg = shadow
      + L("hip","kL","#16201a",0.085) + L("kL","fL","#16201a",0.075)
      + L("hip","kR","#16201a",0.085) + L("kR","fR","#16201a",0.075)
      + `<line x1="${pts.fL[0]-2}" y1="${pts.fL[1]}" x2="${pts.fL[0]+2}" y2="${pts.fL[1]}" stroke="#e8efe6" stroke-width="${w(0.04)}"/>`
      + `<line x1="${pts.fR[0]-2}" y1="${pts.fR[1]}" x2="${pts.fR[0]+2}" y2="${pts.fR[1]}" stroke="#e8efe6" stroke-width="${w(0.04)}"/>`
      + L("neck","hip",pl.jersey,0.17)
      + L("neck","hL","#d9b08c",0.05) + L("neck","hR","#d9b08c",0.05)
      + `<circle cx="${pts.head[0].toFixed(1)}" cy="${pts.head[1].toFixed(1)}" r="${(0.095*s).toFixed(1)}" fill="#d9b08c"/>`
      + racket;
    return { svg, far: st.y>CT.NET };
  }

  function shuttleSVG(x,y,z,px,py){
    const p=proj(x,y,z); if(!p) return "";
    const prev = (px!=null) ? proj(px,py==null?y:py, z) : null;
    const s=cam.F/p[2]*0.26;
    let ang=0;
    if(prev) ang=Math.atan2(p[1]-prev[1],p[0]-prev[0])*180/Math.PI;
    const g=proj(x,y,0);
    return (g?`<ellipse cx="${g[0]}" cy="${g[1]}" rx="${Math.max(2,0.12*cam.F/g[2]*(1+z*0.3))}" ry="${Math.max(1,0.05*cam.F/g[2]*(1+z*0.3))}" fill="rgba(0,0,0,.25)"/>`:"")
      + `<g transform="translate(${p[0].toFixed(1)},${p[1].toFixed(1)}) rotate(${ang.toFixed(0)}) scale(${Math.max(0.5,s).toFixed(2)})"><path d="M 3 0 L -7 -4.8 L -4 0 L -7 4.8 Z" fill="#eef4ee" stroke="#0c1410" stroke-width="0.8"/><circle cx="4" cy="0" r="2.6" fill="#fff" stroke="#9aa49a" stroke-width="0.8"/></g>`;
  }

  // ---------- timeline (compiled, seekable) ----------
  function compile(){
    const movers=[], flights=[], poses=[], fx=[], segs=[];
    const P={}; players.forEach(pl=>P[pl.p]={x:pl.base.x,y:pl.base.y});
    let t=0;
    const nextHit=(i)=>{ for(let k=i+1;k<steps.length;k++){ if(!steps[k].rec) return steps[k]; } return null; };
    steps.forEach((st,i)=>{
      const seg0=t;
      if(st.rec){
        const dur=clamp(dist2(P[st.p],st.to)/4.5,0.3,1.3);
        movers.push({p:st.p,from:{...P[st.p]},to:{...st.to},t0:t,t1:t+dur});
        P[st.p]={...st.to}; t+=dur; segs.push([seg0,t,i]); return;
      }
      const sh=SHOTS[st.shot]||SHOTS.clear;
      const hitter = feed==="multi" ? "A" : (st.from.y<CT.NET?"A":"B");
      const runDur=clamp(dist2(P[hitter],st.from)/5,0.25,1.2);
      movers.push({p:hitter,from:{...P[hitter]},to:{...st.from},t0:t,t1:t+runDur});
      P[hitter]={...st.from};
      const prep=0.16, contact=t+runDur+prep;
      if(feed==="multi"){
        const f=P["C"]||{x:CT.CX,y:7.6};
        flights.push({t0:contact-0.6,t1:contact,tr:{x1:f.x,y1:f.y,x2:st.from.x,y2:st.from.y,z0:1.15,h:1.0},feed:true,idx:i});
        poses.push({p:"C",pose:"serve",t0:contact-0.7,t1:contact-0.3});
      }
      poses.push({p:hitter,pose:sh.pose,t0:t+runDur,t1:contact+0.2});
      flights.push({t0:contact,t1:contact+sh.dur,tr:{x1:st.from.x,y1:st.from.y,x2:st.to.x,y2:st.to.y,z0:sh.z0,h:sh.h},idx:i,color:st.color});
      fx.push({kind:"hit",t:contact,x:st.from.x,y:st.from.y,z:sh.z0});
      fx.push({kind:"land",t:contact+sh.dur,x:st.to.x,y:st.to.y,out:st.out});
      // the other player anticipates during the flight
      const nh=nextHit(i);
      if(feed!=="multi"){
        const other = hitter==="A"?"B":"A";
        const dest = (nh && ((nh.from.y<CT.NET?"A":"B")===other)) ? {...nh.from} : {...players.find(q=>q.p===other).base};
        const md=clamp(dist2(P[other],dest)/5,0.2,Math.max(0.4,sh.dur));
        movers.push({p:other,from:{...P[other]},to:dest,t0:contact,t1:contact+md});
        P[other]=dest;
      }else{
        // trainee recovers to base between feeds unless next feed is close
        const dest = (nh) ? {...nh.from} : {...players[0].base};
        const back = {...players[0].base};
        const md=clamp(dist2(P["A"],back)/5,0.2,0.8);
        movers.push({p:"A",from:{...P["A"]},to:back,t0:contact+0.15,t1:contact+0.15+md});
        P["A"]=back;
      }
      t=contact+sh.dur+0.3;
      segs.push([seg0,t,i]);
    });
    return { movers, flights, poses, fx, segs, total:t };
  }

  function evalAt(t){
    const st={};
    players.forEach(pl=>{ st[pl.p]={ x:pl.base.x, y:pl.base.y, pose:pl.feeder?"feeder":"ready", poseFrom:pl.feeder?"feeder":"ready", blend:1, face:pl.p==="B"?-1:1, zoff:0, moving:false }; });
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
        s.pose=pe.pose; s.poseFrom = s.moving?"run":"ready"; s.blend = inK*(1-outK*0);
        if(t>pe.t1) s.blend = 1-outK;
      }
    });
    let shuttle=null;
    tl.flights.forEach(fl=>{
      if(t>=fl.t0 && t<=fl.t1){
        const k=(t-fl.t0)/(fl.t1-fl.t0), fp=flightPos(fl.tr,k), pv=flightPos(fl.tr,Math.max(0,k-0.05));
        shuttle={ ...fp, px:pv.x, py:pv.y, idx:fl.idx };
      }
    });
    return { st, shuttle };
  }

  function renderDynamic(t){
    const { st, shuttle } = tl ? evalAt(t) : { st:null, shuttle:null };
    let far="", near="";
    players.forEach(pl=>{
      const ps = st ? st[pl.p] : { x:pl.base.x, y:pl.base.y, pose:pl.feeder?"feeder":"ready", poseFrom:"ready", blend:1, face:pl.p==="B"?-1:1, zoff:0 };
      const fig=figureSVG(pl, ps);
      if(fig.far) far+=fig.svg; else near+=fig.svg;
    });
    if(shuttle){
      const s=shuttleSVG(shuttle.x,shuttle.y,shuttle.z,shuttle.px,shuttle.py);
      if(shuttle.y>CT.NET) far+=s; else near+=s;
      if(tl && shuttle.idx!==activeIdx){ activeIdx=shuttle.idx; renderStatic(); markList(activeIdx); showNote(activeIdx); }
    }
    gid("far").innerHTML=far; gid("near").innerHTML=near;
    // fx
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
      const name = s.rec ? "Recover to base" : (SHOTS[s.shot]||{}).name||s.shot;
      return `<div data-st="${i}" style="display:flex;gap:8px;align-items:center;padding:7px 10px;border:1px solid ${i===activeIdx?"var(--brand)":"var(--line)"};border-radius:9px;cursor:pointer;">
        <span style="width:8px;height:8px;border-radius:50%;background:${s.rec?"#888":s.color};flex:0 0 auto;"></span>
        <div style="flex:1;font-size:13px;">${s.rec?"":"<b>"+stepNo(i)+".</b> "}${esc(name)}${s.out?` <span style="color:#ff7b7b;font-size:11px;">OUT</span>`:""}${s.note?`<div class="muted" style="font-size:12px;">${esc(s.note)}</div>`:""}</div>
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
  function onTap(evt){
    if(!editing || playing) return;
    const c=svgXY(evt); if(!c) return;
    const sh=SHOTS[curShot()];
    if(!pend){
      if(feed==="multi" && c.y>=CT.NET-0.15){ hint("Tap on the player's side — the feeder sends shuttles there.", true); return; }
      pend={ from:{x:+c.x.toFixed(2), y:+c.y.toFixed(2)} };
      hint(sh.serve ? "Legal service court highlighted — tap where the serve lands." : "Now tap where the "+sh.name.toLowerCase()+" lands.");
      renderStatic(); return;
    }
    if(sh.serve && !inBox(serveBox(pend.from.x,pend.from.y), c.x, c.y)){ hint("Illegal serve — it must land in the highlighted diagonal box.", true); return; }
    if(!sh.serve && feed!=="multi" && ((c.y<CT.NET)===(pend.from.y<CT.NET))){ hint("The shuttle must cross the net — tap the other side.", true); return; }
    const st={ shot:curShot(), color:drawColor, from:pend.from, to:{x:+c.x.toFixed(2), y:+c.y.toFixed(2)}, note:"" };
    st.out = !sh.serve && !inSingles(st.to.x, st.to.y);
    steps.push(st); pend=null;
    const ni=steps.length-1;
    afterStepsChange();
    hint("Added. Tap the next shot, Recover, or ▶ Play.");
    previewSeg(ni);
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
    if(tCur>=stopAt){ tCur=stopAt; renderDynamic(tCur); stop(); return; }
    renderDynamic(tCur);
    raf=requestAnimationFrame(loop);
  }
  function playFrom(t0, t1){
    if(!tl || !tl.total) return;
    tCur=t0; stopAt=t1; lastTs=0; playing=true;
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
  gid("play").onclick=()=>{ if(playing){ stop(); } else if(tl && tCur>0 && tCur<tl.total){ lastTs=0; playing=true; gid("play").textContent="❚❚ Pause"; raf=requestAnimationFrame(loop); } else { tCur=0; activeIdx=-1; playFrom(0, tl?tl.total:0); } };
  gid("rst").onclick=()=>{ stop(); tCur=0; activeIdx=-1; renderStatic(); renderDynamic(0); markList(-1); showNote(-1); };
  if(editing){
    DCOLS.forEach(c=>{
      const b=document.createElement("button");
      b.style.cssText="width:20px;height:20px;border-radius:50%;cursor:pointer;padding:0;background:"+c+";border:2px solid "+(c===drawColor?"#fff":"transparent")+";";
      b.onclick=()=>{ drawColor=c; Array.prototype.forEach.call(gid("pal").querySelectorAll("button"),(x,i)=>{ x.style.border="2px solid "+(DCOLS[i]===drawColor?"#fff":"transparent"); }); };
      gid("pal").appendChild(b);
    });
    gid("shot").onchange=()=>{ pend=null; renderStatic(); hint(SHOTS[curShot()].serve?"Serve: tap where the server stands — the legal box will light up.":"Tap where the shot is hit from."); };
    gid("rec").onclick=()=>{
      let p="A";
      for(let i=steps.length-1;i>=0;i--){ if(!steps[i].rec){ p = feed==="multi" ? "A" : (steps[i].from.y<CT.NET?"A":"B"); break; } }
      const base=players.find(q=>q.p===p).base;
      steps.push({ rec:true, p, to:{...base} });
      afterStepsChange(); previewSeg(steps.length-1);
    };
    gid("undo").onclick=()=>{ steps.pop(); afterStepsChange(); };
    gid("clr").onclick=()=>{ steps=[]; afterStepsChange(); };
    gid("noteIn").oninput=function(){ for(let i=steps.length-1;i>=0;i--){ if(!steps[i].rec){ steps[i].note=this.value; paintList(); break; } } };
    hint(feed==="multi" ? "Multi-shuttle: tap where the feed lands, then where the player's answer goes." : "Pick a shot + colour, tap where it's hit from, then where it lands.");
  }else{
    hint("Press ▶ Play — and try the camera angles while it runs.");
  }
  tl=compile();
  renderStatic(); renderDynamic(tl.total||0); paintList();

  return {
    getPoints: ()=> JSON.parse(JSON.stringify(steps)),
    hasShots: ()=> steps.some(s=>!s.rec),
    getView: ()=> "broadcast",
    destroy: ()=> stop()
  };
}

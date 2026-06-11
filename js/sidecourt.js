// Side Court — the side-view, self-explaining drill animator, as an app module.
// mountSideCourt(container, { points, mode }) builds the court + controls inside
// `container` and returns { getPoints, destroy }.
//   mode "edit"  → coach builds: tap where the player hits FROM, then the target.
//   mode "play"  → read-only playback of a saved drill.

export function mountSideCourt(container, opts){
  opts = opts || {};
  const mode = opts.mode || "edit";
  const editing = mode === "edit";
  const SVGNS = "http://www.w3.org/2000/svg";
  const S = (tag, attrs, parent)=>{ const e=document.createElementNS(SVGNS,tag); if(attrs) for(const k in attrs) e.setAttribute(k,attrs[k]); if(parent) parent.appendChild(e); return e; };
  const clearEl = el=>{ while(el.firstChild) el.removeChild(el.firstChild); };
  const lerp=(a,b,t)=>a+(b-a)*t;
  const proj=(L,W)=>{ const nx=lerp(35,325,L), fx=lerp(52,308,L); return [lerp(nx,fx,W), lerp(152,100,W)]; };
  const NETX = Math.round(proj(0.5,0.5)[0]);
  const PAL = ["#ffffff","#ffd34d","#ff8a4c","#ff5d6c","#c77dff","#5db9ff","#46e3b0","#a3e635"];

  container.innerHTML = `
    <div style="display:flex;justify-content:center;">
      <svg id="scCv" viewBox="0 0 360 200" role="img" style="width:100%;max-width:360px;height:auto;touch-action:manipulation;">
        <defs><linearGradient id="scGrn" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#33a878"></stop><stop offset="1" stop-color="#2b8e66"></stop></linearGradient></defs>
        <g id="scCourt"></g>
        <path id="scRoute" fill="none" stroke="#ffffff" stroke-width="1.2" stroke-dasharray="2 5" opacity="0.3"></path>
        <g id="scMarks"></g>
        <circle id="scRing" cx="0" cy="0" r="6" fill="none" stroke="#fff" stroke-width="2" opacity="0"></circle>
        <circle id="scPending" cx="0" cy="0" r="6" fill="none" stroke="#fff" stroke-width="1.5" stroke-dasharray="3 3" opacity="0"></circle>
        <ellipse id="scShd" cx="112" cy="123" rx="6" ry="2.6" fill="#000" fill-opacity="0.32"></ellipse>
        <g id="scPlayer" stroke="#eafff0" stroke-width="2.2" stroke-linecap="round" fill="none" transform="translate(112,123) scale(0.55)"></g>
        <g id="scTrail"></g>
        <g id="scPop"></g>
        <circle id="scShuttle" cx="112" cy="98" r="3.2" fill="#fff" stroke="#0c3026" stroke-width="1" opacity="0"></circle>
      </svg>
    </div>
    <div style="margin-top:12px;display:flex;flex-direction:column;gap:10px;">
      ${editing ? `<div id="scEdit" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
        <select id="scShot" style="flex:1;min-width:120px;">
          <option>Net shot</option><option>Net kill</option><option>Lift</option><option>Drive</option><option>Push</option><option>Drop</option><option>Cut / slice</option><option>Smash</option><option>Clear</option><option>Block (defense)</option>
        </select>
        <button class="btn" id="scRec" style="padding:7px 11px;font-size:12px;">Recover</button>
        <button class="btn" id="scClear" style="padding:7px 11px;font-size:12px;">Clear</button>
        <input id="scNote" placeholder="Coaching note (optional)" style="width:100%;">
        <div id="scPal" style="display:flex;gap:7px;align-items:center;flex-wrap:wrap;width:100%;"><span class="muted" style="font-size:12px;">Colour</span></div>
        <span id="scHint" class="muted" style="font-size:12px;width:100%;">Pick a shot + colour, then tap where the player hits <b>from</b>.</span>
      </div>` : ``}
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
        <button class="btn pri" id="scPlay" style="padding:8px 14px;">▶ Play</button>
        <button class="btn" id="scRestart" style="padding:8px 11px;">↻</button>
        <select id="scSpeed" style="width:auto;"><option value="1240">Slow</option><option value="620" selected>Normal</option><option value="410">Fast</option></select>
      </div>
      <div id="scSteps" style="display:flex;flex-direction:column;gap:6px;"></div>
    </div>`;

  const $ = id => container.querySelector("#"+id);
  const cv=$("scCv"), court=$("scCourt"), shd=$("scShd"), player=$("scPlayer"), route=$("scRoute"), marks=$("scMarks"),
        trail=$("scTrail"), pop=$("scPop"), shuttle=$("scShuttle"), ring=$("scRing"), pendEl=$("scPending"), stepsEl=$("scSteps");

  let selectedColor = "#ffd34d";
  const bp = proj(0.25,0.55), BASE = { x:Math.round(bp[0]), y:Math.round(bp[1]) };
  const DEFHINT = 'Pick a shot + colour, then tap where the player hits <b>from</b>.';

  function buildPalette(){
    const pal=$("scPal"); if(!pal) return;
    PAL.forEach(c=>{ const b=document.createElement("button"); b.setAttribute("data-col",c);
      b.style.cssText="width:22px;height:22px;border-radius:50%;background:"+c+";border:2px solid "+(c===selectedColor?"#fff":"transparent")+";cursor:pointer;padding:0;";
      b.onclick=()=>{ selectedColor=c; Array.prototype.forEach.call(pal.querySelectorAll("button"),s=>{ s.style.borderColor=s.getAttribute("data-col")===selectedColor?"#fff":"transparent"; }); };
      pal.appendChild(b); });
  }

  function buildCourt(){
    clearEl(court);
    S("polygon",{points:"18,160 40,93 40,113 18,180",fill:"#7c6238"},court);
    S("polygon",{points:"342,160 320,93 320,113 342,180",fill:"#7c6238"},court);
    S("polygon",{points:"18,160 342,160 342,180 18,180",fill:"#9a7c49"},court);
    S("rect",{x:18,y:178,width:324,height:4,fill:"#5a472b"},court);
    for(let k=0;k<46;k++){ S("circle",{cx:(20+Math.random()*320).toFixed(1),cy:(179+Math.random()*2.4).toFixed(1),r:0.6,fill:"#43341e"},court); }
    S("polygon",{points:"18,160 342,160 320,93 40,93",fill:"#bfa269"},court);
    const a=proj(0,0),b=proj(1,0),c=proj(1,1),d=proj(0,1);
    S("polygon",{points:a[0].toFixed(1)+","+a[1].toFixed(1)+" "+b[0].toFixed(1)+","+b[1].toFixed(1)+" "+c[0].toFixed(1)+","+c[1].toFixed(1)+" "+d[0].toFixed(1)+","+d[1].toFixed(1),fill:"url(#scGrn)"},court);
    const LN=[[0,0,1,0],[0,1,1,1],[0,0,0,1],[1,0,1,1],[0,0.0754,1,0.0754],[0,0.9246,1,0.9246],[0.0567,0,0.0567,1],[0.9433,0,0.9433,1],[0.3522,0,0.3522,1],[0.6478,0,0.6478,1],[0,0.5,0.3522,0.5],[0.6478,0.5,1,0.5]];
    let dd="";
    for(let i=0;i<LN.length;i++){ const A=proj(LN[i][0],LN[i][1]), B=proj(LN[i][2],LN[i][3]); dd+="M"+A[0].toFixed(1)+" "+A[1].toFixed(1)+"L"+B[0].toFixed(1)+" "+B[1].toFixed(1); }
    S("path",{d:dd,fill:"none",stroke:"#08312a","stroke-width":5,"stroke-linecap":"round","stroke-linejoin":"round","vector-effect":"non-scaling-stroke",opacity:0.55},court);
    S("path",{d:dd,fill:"none",stroke:"#ffffff","stroke-width":3,"stroke-linecap":"round","stroke-linejoin":"round","vector-effect":"non-scaling-stroke"},court);
    const nn=proj(0.5,0), nf=proj(0.5,1);
    S("line",{x1:nn[0],y1:nn[1],x2:nn[0],y2:nn[1]-12,stroke:"#202020","stroke-width":2.4},court);
    S("line",{x1:nf[0],y1:nf[1],x2:nf[0],y2:nf[1]-11,stroke:"#202020","stroke-width":2},court);
    S("line",{x1:nn[0],y1:nn[1]-12,x2:nf[0],y2:nf[1]-11,stroke:"#f2f6f2","stroke-width":0.8,opacity:0.7},court);
  }

  function RDY(){ return { x:BASE.x, y:BASE.y, shot:"Ready (base)", note:"Low split-step, racket up." }; }
  function REC(){ return { x:BASE.x, y:BASE.y, shot:"Recover to base", note:"" }; }

  let points = (opts.points && opts.points.length) ? JSON.parse(JSON.stringify(opts.points)) : [RDY()];
  let actions=[], ai=0, frac=0, last=null, playing=false, raf=null, pending=null;

  const depthScale = y => 0.44 + (y-100)/52*0.18;
  const isShot = p => p.shot && p.shot!=="Ready (base)" && p.shot!=="Recover to base";
  const stepColor = p => p.col || (isShot(p) ? "#ffd34d" : "#8aa07e");

  function drawFigure(x,footY,jump,pose){
    const s=depthScale(footY);
    shd.setAttribute("cx",x.toFixed(1)); shd.setAttribute("cy",footY.toFixed(1)); shd.setAttribute("rx",Math.max(1.6,(6*s+2)-(jump||0)*0.14).toFixed(1));
    player.setAttribute("transform","translate("+x.toFixed(1)+","+(footY-(jump||0)).toFixed(1)+") scale("+s.toFixed(3)+")");
    clearEl(player);
    if(pose==="smash"){
      S("line",{x1:-2.5,y1:0,x2:-1,y2:-10},player); S("line",{x1:2.5,y1:0,x2:1,y2:-10},player);
      S("line",{x1:0,y1:-10,x2:0,y2:-20,"stroke-width":3.4},player);
      S("line",{x1:0,y1:-17,x2:8.5,y2:-23},player);
      S("ellipse",{cx:10.5,cy:-25.5,rx:3,ry:4.6,transform:"rotate(-32 10.5 -25.5)"},player);
      S("circle",{cx:0,cy:-24,r:3.6,fill:"#eafff0",stroke:"none"},player); return;
    }
    let P;
    if(pose==="overhead") P={la:[-3,0,-1.5,-10],lb:[3,0,1.5,-10],to:[0,-10,0,-21],hd:[0,-25],fa:[0,-20,-8,-29],ra:[0,-20,7,-41],rk:[9,-46,-6]};
    else if(pose==="mid") P={la:[-3.5,0,-1,-9],lb:[3.5,0,1.5,-9],to:[0,-9,1,-19],hd:[1.5,-23],fa:[1,-17,-7,-13],ra:[1,-17,17,-17],rk:[20,-17,-92]};
    else if(pose==="low") P={la:[-4,0,-2,-7],lb:[4,0,2,-7],to:[0,-7,2,-16],hd:[3,-19.5],fa:[2,-15,-6,-12],ra:[2,-15,15,-4],rk:[18,-1.5,-125]};
    else P={la:[-2.5,0,-1,-10],lb:[2.5,0,1,-10],to:[0,-10,0,-20],hd:[0,-24],fa:[0,-18,-6,-22],ra:[0,-18,8,-24],rk:[10,-26,-32]};
    S("line",{x1:P.la[0],y1:P.la[1],x2:P.la[2],y2:P.la[3]},player);
    S("line",{x1:P.lb[0],y1:P.lb[1],x2:P.lb[2],y2:P.lb[3]},player);
    S("line",{x1:P.to[0],y1:P.to[1],x2:P.to[2],y2:P.to[3],"stroke-width":3.4},player);
    S("line",{x1:P.fa[0],y1:P.fa[1],x2:P.fa[2],y2:P.fa[3],"stroke-width":1.8,opacity:0.85},player);
    S("line",{x1:P.ra[0],y1:P.ra[1],x2:P.ra[2],y2:P.ra[3]},player);
    S("ellipse",{cx:P.rk[0],cy:P.rk[1],rx:3,ry:4.6,transform:"rotate("+P.rk[2]+" "+P.rk[0]+" "+P.rk[1]+")"},player);
    S("circle",{cx:P.hd[0],cy:P.hd[1],r:3.6,fill:"#eafff0",stroke:"none"},player);
  }
  const placeFigure = (x,y)=>drawFigure(x,y,0,"ready");

  const shotKind = s => s==="Smash"?"smash":s==="Net kill"?"spike":(s==="Clear"||s==="Lift")?"lob":(s==="Drive"||s==="Push")?"flat":"dip";
  const poseFor = s => s==="Smash"?"smash":(s==="Clear"||s==="Drop"||s==="Cut / slice"||s==="Net kill")?"overhead":(s==="Drive"||s==="Push")?"mid":"low";
  const arrowDir = s => { const k=shotKind(s); return k==="lob"?"up":k==="flat"?"flat":"down"; };
  const JUMP=38, JCUT=15;
  const racketPt=(p,t)=>{ const sc=depthScale(p.y), j=JUMP*Math.sin(Math.PI*t); return [p.x+15*sc,(p.y-j)-45*sc]; };
  const smashFlight=(p,u)=>{ const C0=racketPt(p,0.5),Cc=[NETX,84],T=[p.tx,p.ty],uu=1-u; return [uu*uu*C0[0]+2*uu*u*Cc[0]+u*u*T[0], uu*uu*C0[1]+2*uu*u*Cc[1]+u*u*T[1]]; };
  const racketCut=(p,t)=>{ const sc=depthScale(p.y), j=JCUT*Math.sin(Math.PI*t); return [p.x+9*sc,(p.y-j)-44*sc]; };
  const cutFlight=(p,u)=>{ const C0=racketCut(p,0.5),Cc=[NETX,84],T=[p.tx,p.ty],uu=1-u; return [uu*uu*C0[0]+2*uu*u*Cc[0]+u*u*T[0], uu*uu*C0[1]+2*uu*u*Cc[1]+u*u*T[1]]; };
  const contactPoint=(p)=>{ const sc=depthScale(p.y), pose=poseFor(p.shot); if(pose==="overhead") return[p.x+9*sc,p.y-44*sc]; if(pose==="mid") return[p.x+18*sc,p.y-17*sc]; return[p.x+16*sc,p.y-3*sc]; };
  const originPoint=(p)=> p.shot==="Smash"?racketPt(p,0.5):p.shot==="Cut / slice"?racketCut(p,0.5):contactPoint(p);
  function flightPos(p,t){
    const kind=shotKind(p.shot), s=contactPoint(p), e=[(p.tx!=null?p.tx:p.x),(p.ty!=null?p.ty:p.y)];
    if(kind==="lob") return[lerp(s[0],e[0],t),lerp(s[1],e[1],t)-62*Math.sin(Math.PI*t)];
    if(kind==="flat") return[lerp(s[0],e[0],t),lerp(s[1],e[1],t)-9*Math.sin(Math.PI*t)];
    if(kind==="spike") return[lerp(s[0],e[0],t),lerp(s[1],e[1],t)-6*Math.sin(Math.PI*t)];
    const C=[NETX,Math.min(s[1],e[1],86)-4], uu=1-t;
    return[uu*uu*s[0]+2*uu*t*C[0]+t*t*e[0], uu*uu*s[1]+2*uu*t*C[1]+t*t*e[1]];
  }
  function shuttleAt(p,t){
    if(p.shot==="Smash"){ if(t<0.5) return racketPt(p,t); return smashFlight(p,(t-0.5)/0.5); }
    if(p.shot==="Cut / slice"){ if(t<0.5) return racketCut(p,t); return cutFlight(p,(t-0.5)/0.5); }
    return flightPos(p,t);
  }
  function arcPath(p){ let fn; if(p.shot==="Smash") fn=u=>smashFlight(p,u); else if(p.shot==="Cut / slice") fn=u=>cutFlight(p,u); else fn=u=>flightPos(p,u);
    let pp=fn(0), d="M"+pp[0].toFixed(1)+" "+pp[1].toFixed(1); for(let i=1;i<=22;i++){ pp=fn(i/22); d+=" L"+pp[0].toFixed(1)+" "+pp[1].toFixed(1); } return d; }
  const labelFor = s => (s||"").replace(" (defense)","").replace("Cut / slice","Cut");
  function drawArrow(tx,ty,dir,c){ let tri;
    if(dir==="down") tri=(tx-3.3)+","+(ty+5)+" "+(tx+3.3)+","+(ty+5)+" "+tx+","+(ty+11.5);
    else if(dir==="up") tri=(tx-3.3)+","+(ty+11.5)+" "+(tx+3.3)+","+(ty+11.5)+" "+tx+","+(ty+5);
    else tri=(tx+4.5)+","+(ty+4.8)+" "+(tx+4.5)+","+(ty+11.2)+" "+(tx+10.5)+","+(ty+8);
    S("polygon",{points:tri,fill:c,stroke:"#06241b","stroke-width":0.6,"paint-order":"stroke"},marks);
  }
  function drawPop(cx,cy,pk,col){ clearEl(pop); if(pk<0||pk>1) return; const op=(1-pk)*0.9, r=2+8*pk;
    S("circle",{cx:cx.toFixed(1),cy:cy.toFixed(1),r:r.toFixed(1),fill:"none",stroke:"#ffffff","stroke-width":(1.6*(1-pk)+0.4).toFixed(2),opacity:op.toFixed(2)},pop);
    for(let i=0;i<6;i++){ const a=(i/6)*Math.PI*2-Math.PI/2, r1=2+3*pk, r2=4+8*pk;
      S("line",{x1:(cx+Math.cos(a)*r1).toFixed(1),y1:(cy+Math.sin(a)*r1).toFixed(1),x2:(cx+Math.cos(a)*r2).toFixed(1),y2:(cy+Math.sin(a)*r2).toFixed(1),stroke:col,"stroke-width":(1.4*(1-pk)+0.3).toFixed(2),"stroke-linecap":"round",opacity:op.toFixed(2)},pop); }
  }
  function clearFx(){ shuttle.setAttribute("opacity","0"); ring.setAttribute("opacity","0"); clearEl(trail); clearEl(pop); }

  function animateShot(p,t){
    const col=stepColor(p);
    const rtx=(p.tx!=null)?p.tx:p.x, rty=(p.ty!=null)?p.ty:p.y;
    if(p.shot==="Smash") drawFigure(p.x,p.y,JUMP*Math.sin(Math.PI*t),"smash");
    else if(p.shot==="Cut / slice") drawFigure(p.x,p.y,JCUT*Math.sin(Math.PI*t),"overhead");
    else drawFigure(p.x,p.y,0,poseFor(p.shot));
    const pos=shuttleAt(p,t), x=pos[0], y=pos[1];
    clearEl(trail);
    const N=8, win=0.18; for(let k=N;k>=1;k--){ const tt=t-(k/N)*win; if(tt<=0) continue; const tp=shuttleAt(p,tt), f=1-k/N; S("circle",{cx:tp[0].toFixed(1),cy:tp[1].toFixed(1),r:(0.8+2.2*f).toFixed(2),fill:col,opacity:(0.05+0.32*f).toFixed(2)},trail); }
    const isJump=(p.shot==="Smash"||p.shot==="Cut / slice"), contactT=isJump?0.5:0.0;
    const cpt=originPoint(p); drawPop(cpt[0],cpt[1],(t-contactT)/0.2,col);
    shuttle.setAttribute("cx",x.toFixed(1)); shuttle.setAttribute("cy",y.toFixed(1)); shuttle.setAttribute("fill",col); shuttle.setAttribute("opacity","1");
    ring.setAttribute("cx",rtx.toFixed(1)); ring.setAttribute("cy",rty.toFixed(1)); ring.setAttribute("stroke",col); ring.setAttribute("r",(4+6*t).toFixed(1)); ring.setAttribute("opacity",(0.25+0.5*t).toFixed(2));
  }

  function drawRoute(){
    let d=""; points.forEach((p,i)=>{ d+=(i?" L":"M")+p.x+" "+p.y; }); route.setAttribute("d",d);
    clearEl(marks);
    points.forEach(p=>{ if(isShot(p)&&p.tx!=null){ const c=stepColor(p);
      S("path",{d:arcPath(p),fill:"none",stroke:c,"stroke-width":1.6,"stroke-dasharray":"4 3","stroke-linecap":"round",opacity:0.6},marks);
      S("circle",{cx:p.tx,cy:p.ty,r:3.4,fill:"#0c2a22",stroke:c,"stroke-width":1.7,opacity:0.95},marks);
      drawArrow(p.tx,p.ty,arrowDir(p.shot),c);
      const lt=S("text",{x:p.tx,y:(p.ty-6),"text-anchor":"middle","font-size":7.5,"font-weight":700,fill:c,opacity:0.97,stroke:"#06241b","stroke-width":0.5,"paint-order":"stroke"},marks); lt.textContent=labelFor(p.shot);
    }});
    points.forEach((p,i)=>{ const c=stepColor(p); S("circle",{cx:p.x,cy:p.y,r:6.5,fill:c,stroke:"#0c3026","stroke-width":0.8},marks);
      const tx=S("text",{x:p.x,y:p.y+2.8,"text-anchor":"middle","font-size":8,"font-weight":700,fill:"#0c2018"},marks); tx.textContent=(i+1); });
  }

  function renderSteps(){
    stepsEl.innerHTML="";
    if(points.length<=1){ const e=document.createElement("div"); e.className="muted"; e.style.cssText="font-size:12px;padding:4px 2px;"; e.textContent = editing ? "Empty court. Add shots below." : "This drill has no shots yet."; stepsEl.appendChild(e); }
    points.forEach((p,i)=>{
      const row=document.createElement("div"); row.style.cssText="display:flex;gap:8px;align-items:flex-start;padding:7px 9px;border-radius:8px;cursor:pointer;border:0.5px solid var(--line);";
      const dot=document.createElement("span"); dot.style.cssText="width:11px;height:11px;border-radius:50%;flex:0 0 auto;margin-top:3px;background:"+stepColor(p)+";";
      const txt=document.createElement("div"); txt.style.flex="1";
      const sh=document.createElement("div"); sh.textContent=(i+1)+". "+(p.shot||"Step"); sh.style.cssText="font-size:13px;color:var(--ink,inherit);"; txt.appendChild(sh);
      if(p.note){ const nt=document.createElement("div"); nt.textContent=p.note; nt.className="muted"; nt.style.cssText="font-size:12px;line-height:1.45;"; txt.appendChild(nt); }
      row.appendChild(dot); row.appendChild(txt);
      if(editing){ const del=document.createElement("button"); del.textContent="×"; del.style.cssText="margin-left:auto;border:none;background:transparent;color:var(--muted);cursor:pointer;font-size:16px;line-height:1;padding:2px 4px;"; del.onclick=(e)=>{ e.stopPropagation(); points.splice(i,1); pause(); buildAll(); }; row.appendChild(del); }
      row.onclick=()=>jumpTo(i);
      stepsEl.appendChild(row);
    });
  }
  function highlight(i){ Array.prototype.forEach.call(stepsEl.children,(c,idx)=>{ c.style.background = (idx===i)?"var(--panel2,rgba(255,255,255,.05))":"transparent"; }); }

  function buildActions(){ const a=[]; for(let i=1;i<points.length;i++){ a.push({k:"move",from:i-1,to:i}); if(isShot(points[i])) a.push({k:"hit",at:i}); } if(points.length>1) a.push({k:"move",from:points.length-1,to:0}); return a; }
  const curPoint = act => act.k==="move" ? act.to : act.at;
  function buildAll(){ actions=buildActions(); drawRoute(); renderSteps(); ai=0; frac=0; clearFx(); if(points.length){ placeFigure(points[0].x,points[0].y); highlight(0); } }
  const ease = p => p<0.5 ? 2*p*p : 1-Math.pow(-2*p+2,2)/2;
  const hitFactor = s => s==="Smash"?1.7:s==="Cut / slice"?1.4:(s==="Drive"||s==="Net kill")?0.62:s==="Push"?0.82:(s==="Clear"||s==="Lift")?1.12:(s==="Drop"||s==="Net shot"||s==="Block (defense)")?1.25:0.95;

  function loop(ts){
    if(!playing) return;
    if(!document.body.contains(cv)){ playing=false; return; }
    if(last===null) last=ts; const dt=ts-last; last=ts; if(actions.length===0){ playing=false; return; }
    const act=actions[ai], sp=parseFloat($("scSpeed").value)||620; let dur;
    if(act.k==="move") dur=sp; else dur=sp*hitFactor(points[act.at].shot);
    frac+=dt/dur;
    if(act.k==="move"){ clearFx(); const a=points[act.from], b=points[act.to], e=ease(Math.min(frac,1)); placeFigure(a.x+(b.x-a.x)*e,a.y+(b.y-a.y)*e); }
    else animateShot(points[act.at],Math.min(frac,1));
    if(frac>=1){ frac=0; if(act.k==="hit") clearFx(); ai++; if(ai>=actions.length) ai=0; highlight(curPoint(actions[ai])); }
    raf=requestAnimationFrame(loop);
  }
  function play(){ if(points.length<2) return; playing=true; last=null; highlight(curPoint(actions[ai])); $("scPlay").textContent="❚❚ Pause"; raf=requestAnimationFrame(loop); }
  function pause(){ playing=false; if(raf) cancelAnimationFrame(raf); raf=null; const b=$("scPlay"); if(b) b.textContent="▶ Play"; }
  function actionArrivingAt(i){ for(let k=0;k<actions.length;k++){ if(actions[k].k==="move"&&actions[k].to===i) return k; } return 0; }
  function jumpTo(i){ ai=actionArrivingAt(i); frac=0; clearFx(); placeFigure(points[i].x,points[i].y); highlight(i); }

  $("scPlay").onclick=()=>{ playing?pause():play(); };
  $("scRestart").onclick=()=>{ ai=0; frac=0; clearFx(); if(points[0]) placeFigure(points[0].x,points[0].y); highlight(0); };
  if($("scSpeed")) $("scSpeed");

  if(editing){
    buildPalette();
    const svgPoint=(evt)=>{ const pt=cv.createSVGPoint(); const s=evt.touches&&evt.touches[0]?evt.touches[0]:evt; pt.x=s.clientX; pt.y=s.clientY; const m=cv.getScreenCTM(); return m?pt.matrixTransform(m.inverse()):null; };
    const cancelPending=()=>{ pending=null; pendEl.setAttribute("opacity","0"); $("scHint").innerHTML=DEFHINT; };
    cv.addEventListener("click",(evt)=>{
      const l=svgPoint(evt); if(!l) return;
      if(pending===null){ pending={x:Math.round(l.x),y:Math.round(l.y)}; pendEl.setAttribute("cx",pending.x); pendEl.setAttribute("cy",pending.y); pendEl.setAttribute("stroke",selectedColor); pendEl.setAttribute("opacity","1"); $("scHint").innerHTML='Now tap <b>where the shot lands</b>.'; }
      else { points.push({ x:pending.x, y:pending.y, shot:$("scShot").value, note:$("scNote").value.trim(), tx:Math.round(l.x), ty:Math.round(l.y), col:selectedColor }); $("scNote").value=""; cancelPending(); pause(); buildAll(); }
    });
    $("scRec").onclick=()=>{ cancelPending(); points.push(REC()); pause(); buildAll(); };
    $("scClear").onclick=()=>{ cancelPending(); pause(); points=[RDY()]; buildAll(); };
  }

  buildCourt(); buildAll();

  return {
    getPoints: ()=>points,
    hasShots: ()=>points.some(isShot),
    destroy: ()=>{ playing=false; if(raf) cancelAnimationFrame(raf); raf=null; }
  };
}

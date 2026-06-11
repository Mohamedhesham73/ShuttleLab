// Solo Court — the locked top-down perspective single-player drill animator,
// as an app module. Same API as mountSideCourt:
// mountSoloCourt(container, { points, mode }) → { getPoints, hasShots, destroy }
//   mode "edit" → coach builds (two-tap: hit-from, then where it lands)
//   mode "play" → read-only playback.

export function mountSoloCourt(container, opts){
  opts = opts || {};
  const editing = (opts.mode || "edit") !== "play";

  container.innerHTML = `
    <div style="display:flex;justify-content:center;">
      <svg id="soCourt" viewBox="0 0 340 410" role="img" style="width:100%;max-width:330px;height:auto;touch-action:manipulation;">
        <defs><linearGradient id="soFloor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0c3026"></stop><stop offset="1" stop-color="#1d5742"></stop></linearGradient></defs>
        <g id="soCourtg"></g>
        <path id="soRoute" fill="none" stroke="#ffffff" stroke-width="1.4" stroke-dasharray="3 4" opacity="0.4"></path>
        <g id="soMarks"></g>
        <path id="soGhost" fill="none" stroke="#e8efe6" stroke-width="1.4" stroke-dasharray="2 4" opacity="0"></path>
        <text id="soGhostLbl" font-size="10" fill="#e8efe6" text-anchor="middle" opacity="0"></text>
        <circle id="soRing" cx="0" cy="0" r="6" fill="none" stroke="#ffffff" stroke-width="2" opacity="0"></circle>
        <circle id="soPending" cx="0" cy="0" r="7" fill="none" stroke="#ffffff" stroke-width="1.6" stroke-dasharray="3 3" opacity="0"></circle>
        <ellipse id="soShd" cx="170" cy="290" rx="8" ry="3.5" fill="#000000" fill-opacity="0.3"></ellipse>
        <g id="soPlayer" stroke="#eafff0" stroke-width="2.2" stroke-linecap="round" fill="none" transform="translate(170,290)">
          <line x1="-2.5" y1="0" x2="-1" y2="-10"></line><line x1="2.5" y1="0" x2="1" y2="-10"></line>
          <line x1="0" y1="-10" x2="0" y2="-20" stroke-width="3.4"></line>
          <line x1="-0.5" y1="-17" x2="8.5" y2="-23"></line>
          <ellipse cx="10.5" cy="-25.5" rx="3" ry="4.6" transform="rotate(-32 10.5 -25.5)"></ellipse>
          <circle cx="0" cy="-24" r="3.6" fill="#eafff0" stroke="none"></circle>
        </g>
        <circle id="soShuttle" cx="170" cy="280" r="3.6" fill="#ffffff" stroke="#0c3026" stroke-width="1" opacity="0"></circle>
      </svg>
    </div>
    <div style="margin-top:12px;display:flex;flex-direction:column;gap:10px;">
      ${editing ? `<div id="soEdit" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
        <select id="soShot" style="flex:1;min-width:110px;"><option>Net shot</option><option>Net kill</option><option>Lift</option><option>Drive</option><option>Push</option><option>Drop</option><option>Cut / slice</option><option>Smash</option><option>Clear</option><option>Block (defense)</option></select>
        <button class="btn" id="soRec" style="padding:7px 11px;font-size:12px;">Recover</button>
        <button class="btn" id="soClear" style="padding:7px 11px;font-size:12px;">Clear</button>
        <input id="soNote" type="text" placeholder="Coaching note (optional)" style="width:100%;">
        <div id="soPal" style="display:flex;gap:7px;align-items:center;flex-wrap:wrap;width:100%;"><span class="muted" style="font-size:12px;">Colour</span></div>
        <span id="soHint" class="muted" style="font-size:12px;width:100%;">Pick a shot + colour, then tap where the player hits <b>from</b>.</span>
      </div>` : ``}
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
        <button class="btn pri" id="soPlay" style="padding:8px 14px;">▶ Play</button>
        <button class="btn" id="soRestart" style="padding:8px 11px;">↻</button>
        <select id="soSpeed" style="width:auto;"><option value="1240">Slow</option><option value="620" selected>Normal</option><option value="410">Fast</option></select>
        <button class="btn" id="soRep" style="padding:8px 11px;font-size:13px;">Replies: on</button>
      </div>
      <div id="soSteps" style="display:flex;flex-direction:column;gap:6px;"></div>
    </div>`;

  const gid = id => container.querySelector("#"+id);
  const svg=gid("soCourt"), courtg=gid("soCourtg"), shd=gid("soShd"), player=gid("soPlayer"), route=gid("soRoute"), marks=gid("soMarks"),
        shuttle=gid("soShuttle"), ring=gid("soRing"), ghost=gid("soGhost"), ghostLbl=gid("soGhostLbl"), pendEl=gid("soPending"),
        playBtn=gid("soPlay"), speedSel=gid("soSpeed"), shotSel=gid("soShot"), noteInp=gid("soNote"), stepsEl=gid("soSteps"),
        repBtn=gid("soRep"), hintEl=gid("soHint");

  const lerp=(a,b,t)=>a+(b-a)*t;
  const gp=v=>1-(1-v)*(1-v);
  const proj=(u,v)=>{ const g=gp(v), lx=lerp(25,90,g), rx=lerp(315,250,g); return [lerp(lx,rx,u), lerp(385,95,g)]; };
  const PAL=["#ffffff","#ffd34d","#ff8a4c","#ff5d6c","#c77dff","#5db9ff","#46e3b0","#a3e635"];
  let selectedColor="#ffd34d";

  function buildPalette(){ const pal=gid("soPal"); if(!pal) return; PAL.forEach(c=>{ const b=document.createElement("button"); b.setAttribute("data-col",c); b.style.cssText="width:22px;height:22px;border-radius:50%;background:"+c+";border:2px solid "+(c===selectedColor?"#ffffff":"transparent")+";cursor:pointer;padding:0;"; b.onclick=()=>{ selectedColor=c; Array.prototype.forEach.call(pal.querySelectorAll("button"),s=>{ s.style.borderColor=(s.getAttribute("data-col")===selectedColor)?"#ffffff":"transparent"; }); }; pal.appendChild(b); }); }

  function WL(u1,v1,u2,v2){ const a=proj(u1,v1),b=proj(u2,v2); return '<line x1="'+a[0].toFixed(1)+'" y1="'+a[1].toFixed(1)+'" x2="'+b[0].toFixed(1)+'" y2="'+b[1].toFixed(1)+'" stroke="#ffffff" stroke-width="1" stroke-opacity="0.78"/>'; }
  function buildCourt(){
    const a=proj(0,0),b=proj(1,0),c=proj(1,1),d=proj(0,1);
    let h='<polygon points="'+a[0].toFixed(1)+','+a[1].toFixed(1)+' '+b[0].toFixed(1)+','+b[1].toFixed(1)+' '+c[0].toFixed(1)+','+c[1].toFixed(1)+' '+d[0].toFixed(1)+','+d[1].toFixed(1)+'" fill="url(#soFloor)" stroke="#ffffff" stroke-width="2" stroke-opacity="0.9"/>';
    h+=WL(0.0754,0,0.0754,1)+WL(0.9246,0,0.9246,1)+WL(0,0.0567,1,0.0567)+WL(0,0.9433,1,0.9433)+WL(0,0.3522,1,0.3522)+WL(0,0.6478,1,0.6478)+WL(0.5,0,0.5,0.3522)+WL(0.5,0.6478,0.5,1);
    const nl=proj(0,0.5), nr=proj(1,0.5), top=nl[1]-30;
    h+='<rect x="'+nl[0].toFixed(1)+'" y="'+top.toFixed(1)+'" width="'+(nr[0]-nl[0]).toFixed(1)+'" height="30" fill="#ffffff" fill-opacity="0.05"/>';
    for(let i=1;i<14;i++){ const mx=lerp(nl[0],nr[0],i/14); h+='<line x1="'+mx.toFixed(1)+'" y1="'+top.toFixed(1)+'" x2="'+mx.toFixed(1)+'" y2="'+nl[1].toFixed(1)+'" stroke="#ffffff" stroke-width="0.5" stroke-opacity="0.16"/>'; }
    h+='<line x1="'+nl[0].toFixed(1)+'" y1="'+(top+10).toFixed(1)+'" x2="'+nr[0].toFixed(1)+'" y2="'+(top+10).toFixed(1)+'" stroke="#ffffff" stroke-width="0.5" stroke-opacity="0.14"/>';
    h+='<line x1="'+nl[0].toFixed(1)+'" y1="'+(top+20).toFixed(1)+'" x2="'+nr[0].toFixed(1)+'" y2="'+(top+20).toFixed(1)+'" stroke="#ffffff" stroke-width="0.5" stroke-opacity="0.14"/>';
    h+='<line x1="'+nl[0].toFixed(1)+'" y1="'+top.toFixed(1)+'" x2="'+nr[0].toFixed(1)+'" y2="'+top.toFixed(1)+'" stroke="#ffffff" stroke-width="2.4"/>';
    h+='<line x1="'+nl[0].toFixed(1)+'" y1="'+nl[1].toFixed(1)+'" x2="'+nr[0].toFixed(1)+'" y2="'+nr[1].toFixed(1)+'" stroke="#e8efe6" stroke-width="1.2" stroke-opacity="0.6"/>';
    h+='<line x1="'+nl[0].toFixed(1)+'" y1="'+(top-3).toFixed(1)+'" x2="'+nl[0].toFixed(1)+'" y2="'+nl[1].toFixed(1)+'" stroke="#d6e6d6" stroke-width="2.6"/>';
    h+='<line x1="'+nr[0].toFixed(1)+'" y1="'+(top-3).toFixed(1)+'" x2="'+nr[0].toFixed(1)+'" y2="'+nr[1].toFixed(1)+'" stroke="#d6e6d6" stroke-width="2.6"/>';
    courtg.innerHTML=h;
  }

  const bp=proj(0.5,0.18), BASE={x:Math.round(bp[0]),y:Math.round(bp[1])};
  const DEFHINT='Pick a shot + colour, then tap where the player hits <b>from</b>.';
  const RDY=()=>({x:BASE.x,y:BASE.y,shot:"Ready (base)",note:"Low split-step, racket up."});
  const REC=()=>({x:BASE.x,y:BASE.y,shot:"Recover to base",note:""});

  let points = (opts.points && opts.points.length) ? JSON.parse(JSON.stringify(opts.points)) : [RDY()];
  let repliesOn=true, actions=[], ai=0, frac=0, last=null, playing=false, raf=null, pending=null;

  const depthScale=y=>(0.6+(y-95)/290*0.6);
  const isShot=p=>p.shot && p.shot!=="Ready (base)" && p.shot!=="Recover to base";
  const stepColor=p=>p.col || (isShot(p)?"#ffd34d":"#8aa07e");
  const placeFigure=(x,y)=>{ shd.setAttribute("cx",x.toFixed(1)); shd.setAttribute("cy",y.toFixed(1)); player.setAttribute("transform","translate("+x.toFixed(1)+","+y.toFixed(1)+") scale("+depthScale(y).toFixed(3)+")"); };

  function shotMeta(name){ const o={peak:20,attack:false,reply:""};
    if(name==="Clear"||name==="Lift"){ o.peak=58; } else if(name==="Drive"){ o.peak=16; o.attack=true; o.reply="counter-drive"; }
    else if(name==="Push"){ o.peak=16; } else if(name==="Smash"){ o.peak=12; o.attack=true; o.reply="block to net"; }
    else if(name==="Net kill"){ o.peak=8; o.attack=true; } else if(name==="Drop"||name==="Cut / slice"){ o.peak=24; o.reply="net shot / lift"; }
    else if(name==="Net shot"){ o.peak=12; o.reply="lift"; } else if(name==="Block (defense)"){ o.peak=12; }
    return o;
  }
  const autoTarget=px=>{ const sc=proj(px<170?0.12:0.88,0.6); return {x:sc[0],y:sc[1]}; };
  const clearFx=()=>{ shuttle.setAttribute("opacity","0"); ring.setAttribute("opacity","0"); ghost.setAttribute("opacity","0"); ghostLbl.setAttribute("opacity","0"); };

  function animateShot(p,t){
    placeFigure(p.x,p.y);
    const m=shotMeta(p.shot), s=depthScale(p.y), at=autoTarget(p.x), col=stepColor(p);
    const tx=(p.tx!=null)?p.tx:at.x, ty=(p.ty!=null)?p.ty:at.y;
    const sx0=p.x, sy0=p.y-22*s, sx=sx0+(tx-sx0)*t, sy=(sy0+(ty-sy0)*t)-m.peak*Math.sin(Math.PI*t);
    shuttle.setAttribute("cx",sx.toFixed(1)); shuttle.setAttribute("cy",sy.toFixed(1)); shuttle.setAttribute("fill",col); shuttle.setAttribute("opacity","1");
    ring.setAttribute("cx",tx.toFixed(1)); ring.setAttribute("cy",ty.toFixed(1)); ring.setAttribute("stroke",col); ring.setAttribute("r",(5+7*t).toFixed(1)); ring.setAttribute("opacity",(0.25+0.5*t).toFixed(2));
    if(repliesOn && m.attack && t>0.8){ const mx=(tx+BASE.x)/2, my=(ty+BASE.y)/2-26; ghost.setAttribute("d","M"+tx.toFixed(0)+" "+ty.toFixed(0)+" Q"+mx.toFixed(0)+" "+my.toFixed(0)+" "+BASE.x+" "+(BASE.y-12)); ghost.setAttribute("opacity","0.5"); if(m.reply){ ghostLbl.textContent="likely: "+m.reply; ghostLbl.setAttribute("x",mx.toFixed(0)); ghostLbl.setAttribute("y",(my-4).toFixed(0)); ghostLbl.setAttribute("opacity","0.85"); } }
  }
  function drawRoute(){
    let d=""; points.forEach((p,i)=>{ d+=(i?" L":"M")+p.x+" "+p.y; }); route.setAttribute("d",d);
    let h="";
    points.forEach(p=>{ if(isShot(p)&&p.tx!=null){ const c=stepColor(p); h+='<line x1="'+p.x+'" y1="'+p.y+'" x2="'+p.tx+'" y2="'+p.ty+'" stroke="'+c+'" stroke-width="1.6" opacity="0.5"/><circle cx="'+p.tx+'" cy="'+p.ty+'" r="3.8" fill="none" stroke="'+c+'" stroke-width="1.8" opacity="0.85"/>'; } });
    points.forEach((p,i)=>{ const c=stepColor(p); h+='<ellipse cx="'+p.x+'" cy="'+p.y+'" rx="11" ry="5.5" fill="'+c+'" stroke="#0c3026" stroke-width="0.8"></ellipse><text x="'+p.x+'" y="'+(p.y+3)+'" text-anchor="middle" font-size="10" font-weight="600" fill="#0c2018">'+(i+1)+'</text>'; });
    marks.innerHTML=h;
  }
  function renderSteps(){
    stepsEl.innerHTML="";
    if(points.length<=1){ const e=document.createElement("div"); e.className="muted"; e.style.cssText="font-size:12px;padding:4px 2px;"; e.textContent = editing ? "Empty court. Add shots below." : "This drill has no shots yet."; stepsEl.appendChild(e); }
    points.forEach((p,i)=>{
      const row=document.createElement("div"); row.setAttribute("data-i",i);
      row.style.cssText="display:flex;gap:8px;align-items:flex-start;padding:7px 9px;border-radius:8px;cursor:pointer;border:0.5px solid var(--line);";
      const dot=document.createElement("span"); dot.style.cssText="width:11px;height:11px;border-radius:50%;flex:0 0 auto;margin-top:3px;background:"+stepColor(p)+";";
      const txt=document.createElement("div"); txt.style.flex="1";
      const sh=document.createElement("div"); sh.textContent=(i+1)+". "+(p.shot||"Step"); sh.style.cssText="font-size:13px;"; txt.appendChild(sh);
      if(p.note){ const nt=document.createElement("div"); nt.textContent=p.note; nt.className="muted"; nt.style.cssText="font-size:12px;line-height:1.45;"; txt.appendChild(nt); }
      row.appendChild(dot); row.appendChild(txt);
      if(editing){ const del=document.createElement("button"); del.textContent="×"; del.style.cssText="margin-left:auto;border:none;background:transparent;color:var(--muted);cursor:pointer;font-size:16px;line-height:1;padding:2px 4px;"; del.onclick=(e)=>{ e.stopPropagation(); points.splice(i,1); pause(); buildAll(); }; row.appendChild(del); }
      row.onclick=()=>jumpTo(i);
      stepsEl.appendChild(row);
    });
  }
  function highlight(i){ Array.prototype.forEach.call(stepsEl.children,c=>{ const di=c.getAttribute("data-i"); c.style.background=(di!=null && parseInt(di)===i)?"var(--panel2,rgba(255,255,255,.06))":"transparent"; }); }

  function buildActions(){ const a=[]; for(let i=1;i<points.length;i++){ a.push({k:"move",from:i-1,to:i}); if(isShot(points[i])) a.push({k:"hit",at:i}); } if(points.length>1) a.push({k:"move",from:points.length-1,to:0}); return a; }
  const curPoint=act=>act.k==="move"?act.to:act.at;
  function buildAll(){ actions=buildActions(); drawRoute(); renderSteps(); ai=0; frac=0; clearFx(); if(points.length){ placeFigure(points[0].x,points[0].y); highlight(0); } }
  const ease=p=>p<0.5?2*p*p:1-Math.pow(-2*p+2,2)/2;
  function loop(ts){
    if(!playing) return;
    if(!document.body.contains(svg)){ playing=false; return; }
    if(last===null) last=ts; const dt=ts-last; last=ts;
    if(actions.length===0){ playing=false; return; }
    const act=actions[ai], dur=act.k==="move"?(parseFloat(speedSel.value)||620):Math.max(440,(parseFloat(speedSel.value)||620)*0.9);
    frac+=dt/dur;
    if(act.k==="move"){ clearFx(); const a=points[act.from], b=points[act.to], e=ease(Math.min(frac,1)); placeFigure(a.x+(b.x-a.x)*e, a.y+(b.y-a.y)*e); }
    else { animateShot(points[act.at], Math.min(frac,1)); }
    if(frac>=1){ frac=0; if(act.k==="hit") clearFx(); ai++; if(ai>=actions.length) ai=0; highlight(curPoint(actions[ai])); }
    raf=requestAnimationFrame(loop);
  }
  function play(){ if(points.length<2) return; playing=true; last=null; highlight(curPoint(actions[ai])); playBtn.textContent="❚❚ Pause"; raf=requestAnimationFrame(loop); }
  function pause(){ playing=false; if(raf) cancelAnimationFrame(raf); raf=null; if(playBtn) playBtn.textContent="▶ Play"; }
  playBtn.onclick=()=>{ playing?pause():play(); };
  gid("soRestart").onclick=()=>{ ai=0; frac=0; clearFx(); if(points[0]) placeFigure(points[0].x,points[0].y); highlight(0); };
  function actionArrivingAt(i){ for(let k=0;k<actions.length;k++){ if(actions[k].k==="move"&&actions[k].to===i) return k; } return 0; }
  function jumpTo(i){ ai=actionArrivingAt(i); frac=0; clearFx(); placeFigure(points[i].x,points[i].y); highlight(i); }

  repBtn.onclick=()=>{ repliesOn=!repliesOn; repBtn.textContent="Replies: "+(repliesOn?"on":"off"); if(!repliesOn){ ghost.setAttribute("opacity","0"); ghostLbl.setAttribute("opacity","0"); } };

  if(editing){
    buildPalette();
    const svgPoint=(evt)=>{ const pt=svg.createSVGPoint(); const s=evt.touches&&evt.touches[0]?evt.touches[0]:evt; pt.x=s.clientX; pt.y=s.clientY; const m=svg.getScreenCTM(); return m?pt.matrixTransform(m.inverse()):null; };
    const cancelPending=()=>{ pending=null; pendEl.setAttribute("opacity","0"); hintEl.innerHTML=DEFHINT; };
    svg.addEventListener("click",(evt)=>{
      const l=svgPoint(evt); if(!l) return;
      if(pending===null){ pending={x:Math.round(l.x),y:Math.round(l.y)}; pendEl.setAttribute("cx",pending.x); pendEl.setAttribute("cy",pending.y); pendEl.setAttribute("stroke",selectedColor); pendEl.setAttribute("opacity","1"); hintEl.innerHTML='Now tap the far court — <b>where it lands</b> (cross or straight).'; }
      else { points.push({x:pending.x,y:pending.y,shot:shotSel.value,note:noteInp.value.trim(),tx:Math.round(l.x),ty:Math.round(l.y),col:selectedColor}); noteInp.value=""; cancelPending(); pause(); buildAll(); }
    });
    gid("soRec").onclick=()=>{ cancelPending(); points.push(REC()); pause(); buildAll(); };
    gid("soClear").onclick=()=>{ cancelPending(); pause(); points=[RDY()]; buildAll(); };
  }

  buildCourt(); buildAll();

  return {
    getPoints: ()=>points,
    hasShots: ()=>points.some(isShot),
    destroy: ()=>{ playing=false; if(raf) cancelAnimationFrame(raf); raf=null; }
  };
}

import { state, esc } from "../core.js";
import { listenDrills, addDrill, updateDrill, deleteDrill, getPrivate, savePrivate } from "../data.js";
import { mountSideCourt } from "../sidecourt.js";
import { mountSoloCourt } from "../solocourt.js";
import { mountCourtLab } from "../courtlab.js";
import { mountProCourt } from "../court3d.js";

const CATS = ["Shots","Footwork","Strength","Conditioning","Tactics"];

// Classic courts (locked mockup engines) — still open old saved drills.
const COURTS = [
  { kind:"side", name:"Side Court (classic)", blurb:"Side-on 3D view — see each shot's height & arc.", mount:mountSideCourt },
  { kind:"solo", name:"Solo Court (classic)", blurb:"Top-down perspective — footwork & shot placement.", mount:mountSoloCourt }
];
const courtBy = kind => COURTS.find(c=>c.kind===kind);

// Court Lab option labels (the new BWF-accurate engine).
const LAB_CATS  = [["singles","Singles"],["doubles","Doubles"],["mixed","Mixed doubles"]];
const LAB_VIEWS = [["bird","Bird's-eye"],["side","Side view"],["front","Front view"]];
const LAB_MODES = [["drill","Drills"],["multi","Multi-shuttle"]];
const labLabel = c => {
  const f=(arr,k)=>{ const x=arr.find(a=>a[0]===k); return x?x[1]:k; };
  if(c.kind==="pro3d") return (c.category==="mixed"?"Mixed doubles":c.category==="doubles"?"Doubles":"Singles")+" · Pro 3D · "+f(LAB_MODES,c.mode||"drill");
  return f(LAB_CATS,c.category)+" · "+f(LAB_VIEWS,c.view||"bird")+" · "+f(LAB_MODES,c.mode||"drill");
};
const playersList = ()=> state.roster.filter(u=>u.role==="player");

// "Send to" picker — value is "team" or an array of player ids.
function makeAssign(initial){
  let team = (initial===undefined || initial==="team" || (Array.isArray(initial) && initial.length===0));
  const set = new Set(Array.isArray(initial) ? initial.map(String) : []);
  if(team) set.clear();
  return {
    value(){ return team ? "team" : Array.from(set); },
    render(){
      const ps = playersList();
      return `<div class="muted" style="font-size:12px;margin:2px 0 6px;">Send to</div>
        <div data-assign style="display:flex;gap:7px;flex-wrap:wrap;">
          <span class="chip ${team?"on":""}" data-aid="__team">Whole team</span>
          ${ps.map(p=>`<span class="chip ${(!team&&set.has(String(p.id)))?"on":""}" data-aid="${esc(String(p.id))}">${esc(p.name)}</span>`).join("")}
        </div>`;
    },
    wire(root){
      root.querySelectorAll("[data-aid]").forEach(el=>el.onclick=()=>{
        const id = el.dataset.aid;
        if(id==="__team"){ team=true; set.clear(); }
        else { team=false; if(set.has(id)) set.delete(id); else set.add(id); if(set.size===0) team=true; }
        root.querySelectorAll("[data-aid]").forEach(c=>{ const cid=c.dataset.aid; c.classList.toggle("on", cid==="__team" ? team : (!team && set.has(cid))); });
      });
    }
  };
}

function assignLabel(d){
  const a = d.assignedTo;
  if(a===undefined || a==="team") return "Whole team";
  if(Array.isArray(a) && a.length){
    return "Sent to " + a.map(id=>{ const u=state.roster.find(x=>String(x.id)===String(id)); return u?u.name:"?"; }).join(", ");
  }
  return "Whole team";
}
function visibleTo(d){
  if(state.role==="coach") return true;
  const a = d.assignedTo;
  if(a===undefined || a==="team") return true;
  if(Array.isArray(a)) return a.length===0 || a.map(String).includes(String(state.user.id));
  return true;
}

export function renderLibrary(){
  const view = document.getElementById("view");
  const coach = state.role==="coach";
  let drills = [], filter = "All", screen = null, mounted = null;

  const destroyMount = ()=>{ if(mounted){ try{ mounted.destroy(); }catch(e){} mounted=null; } };
  const leaveCourt = ()=>{ destroyMount(); screen=null; draw(); };
  const openPick  = ()=>{ screen={ mode:"pick", lab:{ category:"singles", view:"bird", feed:"drill" } }; draw(); };
  const openBuild = (kind, drill, lab)=>{ screen={ mode:"build", kind, drill, lab }; draw(); };
  const openPlay  = (drill)=>{ screen={ mode:"play", drill }; draw(); };
  const openChallenge = (drill)=>{ screen={ mode:"challenge", drill }; draw(); };

  // ---------------- COURT PICKER (Court Lab hierarchy) ----------------
  const renderPick = ()=>{
    const lab = screen.lab;
    const row = (label, opts, key)=>`
      <div class="muted" style="font-size:12px;margin:12px 0 6px;letter-spacing:.04em;">${label}</div>
      <div style="display:flex;gap:7px;flex-wrap:wrap;">
        ${opts.map(o=>`<span class="chip ${lab[key]===o[0]?"on":""}" data-lab="${key}:${o[0]}">${o[1]}</span>`).join("")}
      </div>`;
    view.innerHTML = `
      <button class="btn" id="ctBack" style="margin-bottom:14px;padding:7px 12px;font-size:12px;">← Back to library</button>
      <div class="card" style="padding:18px;">
        <div class="disp" style="font-size:18px;margin-bottom:4px;">Court Lab</div>
        <div class="muted" style="font-size:13px;line-height:1.5;">A true-scale badminton court — official lines, real serve boxes, players that rotate like a real pair. Pick the game, the camera, and the training mode.</div>
        ${row("1 · DISCIPLINE", LAB_CATS, "category")}
        <div class="muted" style="font-size:12px;margin:12px 0 0;line-height:1.6;">🎥 The <b style="color:var(--brand)">Pro 3D court</b> — Broadcast, Corner, Side and Bird's-eye cameras built in, switchable even mid-replay.${lab.category==="doubles"?" Real pair rotation: front-and-back ↔ side-by-side.":""}${lab.category==="mixed"?" Mixed rotation: the woman holds the front, the man covers the rear in attack.":""}</div>
        ${row("2 · TRAINING MODE", LAB_MODES, "feed")}
        <div class="muted" style="font-size:12px;margin-top:10px;line-height:1.5;">${lab.feed==="multi" ? "Multi-shuttle: a feeder throws shuttle after shuttle — you place each feed and the player's answer." : "Drills: build a rally shot by shot — players move and recover automatically."}</div>
        <button class="btn pri" id="labStart" style="width:100%;margin-top:14px;">Start building →</button>
        <div style="border-top:1px solid var(--line);margin-top:16px;padding-top:12px;">
          <div class="muted" style="font-size:12px;margin-bottom:8px;">Classic courts</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            ${COURTS.map(c=>`<button class="btn" data-pick="${c.kind}" style="padding:7px 12px;font-size:12px;">${esc(c.name)}</button>`).join("")}
          </div>
        </div>
      </div>`;
    document.getElementById("ctBack").onclick = leaveCourt;
    view.querySelectorAll("[data-lab]").forEach(el=>el.onclick=()=>{
      const [k,v]=el.dataset.lab.split(":"); screen.lab[k]=v; draw();
    });
    document.getElementById("labStart").onclick = ()=>openBuild("pro3d", null, { ...screen.lab });
    view.querySelectorAll("[data-pick]").forEach(el=>el.onclick=()=>openBuild(el.dataset.pick, null));
  };

  // ---------------- COURT BUILD / WATCH ----------------
  const renderCourtScreen = ()=>{
    const { drill, mode } = screen;
    const kind = (mode==="play"||mode==="challenge") ? (drill.court && drill.court.kind) : screen.kind;
    const isLab = kind === "lab", isPro = kind === "pro3d";
    const entry = (isLab||isPro) ? null : (courtBy(kind) || COURTS[0]);
    const mountIt = (el, mountMode, points, labOpts)=> isPro
      ? mountProCourt(el, { mode:mountMode, points, feed:labOpts.feed, category:labOpts.category })
      : isLab
        ? mountCourtLab(el, { mode:mountMode, points, category:labOpts.category, view:labOpts.view, feed:labOpts.feed })
        : entry.mount(el, { mode:mountMode, points });

    if(mode === "play"){
      const c = drill.court || {};
      view.innerHTML = `
        <button class="btn" id="ctBack" style="margin-bottom:14px;padding:7px 12px;font-size:12px;">← Back to library</button>
        <div class="card" style="padding:16px;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap;">
            <div class="disp" style="font-size:18px;">${esc(drill.title)}</div>
            <span class="chip">${esc((isLab||isPro) ? labLabel(c) : entry.name)}</span>
          </div>
          <div id="ctMount"></div>
        </div>`;
      document.getElementById("ctBack").onclick = leaveCourt;
      mounted = mountIt(document.getElementById("ctMount"), "play", c.points,
        { category:c.category||"singles", view:c.view||"bird", feed:c.mode||"drill" });
      return;
    }

    if(mode === "challenge"){
      const c = drill.court || {};
      view.innerHTML = `
        <button class="btn" id="ctBack" style="margin-bottom:14px;padding:7px 12px;font-size:12px;">← Back to library</button>
        <div class="card" style="padding:16px;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap;">
            <div class="disp" style="font-size:18px;">🎮 ${esc(drill.title)}</div>
            <span class="chip">${esc(labLabel(c))}</span>
          </div>
          <div class="muted" style="font-size:13px;margin-bottom:10px;">Read the play — tap where each shot should go <b>before</b> it's revealed. The closer to the coach's target, the more points. <span id="chBest"></span></div>
          <div id="ctMount"></div>
        </div>`;
      document.getElementById("ctBack").onclick = leaveCourt;
      // show personal best, then persist a new best on finish
      getPrivate(state.uid).then(p=>{
        const best=(p&&p.challenges&&p.challenges[drill.docId])||0;
        const el=document.getElementById("chBest");
        if(el && best) el.innerHTML = `Your best: <b style="color:var(--brand);">${best}%</b>`;
      }).catch(()=>{});
      const onScore = async (r)=>{
        try{
          const p=await getPrivate(state.uid);
          const ch=(p&&p.challenges)||{};
          if(!ch[drill.docId] || r.pct>ch[drill.docId]){ ch[drill.docId]=r.pct; await savePrivate(state.uid,{challenges:ch}); }
        }catch(e){}
      };
      mounted = mountProCourt(document.getElementById("ctMount"), { mode:"play", challenge:true, points:c.points, feed:c.mode||"drill", category:c.category||"singles", onScore });
      return;
    }

    // build / edit
    const lab = (isLab||isPro) ? (screen.lab || {
      category:(drill&&drill.court&&drill.court.category)||"singles",
      view:(drill&&drill.court&&drill.court.view)||"bird",
      feed:(drill&&drill.court&&drill.court.mode)||"drill"
    }) : null;
    const assign = makeAssign(drill ? drill.assignedTo : undefined);
    view.innerHTML = `
      <button class="btn" id="ctBack" style="margin-bottom:14px;padding:7px 12px;font-size:12px;">← Back to library</button>
      <div class="card" style="padding:16px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap;">
          <div class="disp" style="font-size:18px;">${drill ? "Edit court drill" : "New court drill"}</div>
          <span class="chip on">${esc((isLab||isPro) ? labLabel({kind, category:lab.category,view:lab.view,mode:lab.feed}) : entry.name)}</span>
        </div>
        <input id="ctTitle" placeholder="Drill name (e.g. Attack: clear → drop → smash)" style="margin-bottom:12px;" value="${drill?esc(drill.title):""}">
        <div id="ctMount"></div>
        <div id="ctAssign" style="margin-top:14px;">${assign.render()}</div>
        <div style="display:flex;gap:8px;margin-top:14px;align-items:center;flex-wrap:wrap;">
          <button class="btn pri" id="ctSave">${drill?"Save changes":"Save to library"}</button>
          <button class="btn" id="ctCancel" style="padding:8px 12px;">Cancel</button>
          <span id="ctMsg" class="muted" style="font-size:13px;"></span>
        </div>
      </div>`;
    document.getElementById("ctBack").onclick = leaveCourt;
    document.getElementById("ctCancel").onclick = leaveCourt;
    assign.wire(document.getElementById("ctAssign"));
    mounted = mountIt(document.getElementById("ctMount"), "edit", drill && drill.court && drill.court.points, lab||{});
    document.getElementById("ctSave").onclick = async ()=>{
      const title = document.getElementById("ctTitle").value.trim();
      const msg = document.getElementById("ctMsg");
      if(!title){ msg.style.color="var(--down)"; msg.textContent="Give the drill a name."; return; }
      if(!mounted.hasShots()){ msg.style.color="var(--down)"; msg.textContent="Add at least one shot first."; return; }
      const court = isPro
        ? { kind:"pro3d", category:lab.category||"singles", mode:lab.feed, points:mounted.getPoints(), dna:(mounted.getDNA?mounted.getDNA():null) }
        : isLab
          ? { kind:"lab", category:lab.category, view:(mounted.getView?mounted.getView():lab.view), mode:lab.feed, points:mounted.getPoints() }
          : { kind, points:mounted.getPoints() };
      const payload = { title, category:"Court", court, assignedTo:assign.value(), ts:Date.now() };
      msg.style.color="var(--muted)"; msg.textContent="Saving…";
      try{
        if(drill && drill.docId) await updateDrill(drill.docId, payload);
        else await addDrill(payload);
        leaveCourt();
      }catch(e){ msg.style.color="var(--down)"; msg.textContent="Couldn't save: "+(e.message||e); }
    };
  };

  // ---------------- LIBRARY LIST ----------------
  const renderList = ()=>{
    const mine = drills.filter(visibleTo);
    const cats = ["All", ...Array.from(new Set(mine.map(d=>d.category).filter(Boolean)))];
    const shown = mine.filter(d=>filter==="All" || d.category===filter);
    const textAssign = makeAssign(undefined);
    view.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:14px;">
        <div style="display:flex;gap:6px;flex-wrap:wrap;">${cats.map(c=>`<span class="chip ${filter===c?"on":""}" data-cat="${esc(c)}">${esc(c)}</span>`).join("")}</div>
        ${coach?`<div style="display:flex;gap:8px;flex-wrap:wrap;"><button class="btn" id="addCourtBtn">+ Court drill</button><button class="btn pri" id="addDrillBtn">+ Add drill</button></div>`:""}
      </div>
      ${coach?`<div id="drillForm" class="card" style="padding:16px;margin-bottom:14px;display:none;">
        <div style="display:flex;gap:10px;margin-bottom:10px;flex-wrap:wrap;">
          <input id="dTitle" placeholder="Title (e.g. Cross-court drop)" style="flex:2;min-width:150px;">
          <select id="dCat" style="flex:1;min-width:120px;">${CATS.map(c=>`<option>${c}</option>`).join("")}</select>
        </div>
        <textarea id="dDesc" rows="3" placeholder="How to do it, reps, focus points…" style="margin-bottom:10px;resize:vertical;"></textarea>
        <input id="dVideo" placeholder="Video link (optional)" style="margin-bottom:10px;">
        <div id="dAssign" style="margin-bottom:12px;">${textAssign.render()}</div>
        <button class="btn pri" id="dSave">Save to library</button><div id="dErr" class="err"></div>
      </div>`:""}
      <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(230px,1fr));">
        ${shown.length?shown.map(d=>{
          const isCourt = !!d.court;
          const cName = isCourt ? ((d.court.kind==="lab"||d.court.kind==="pro3d") ? labLabel(d.court) : ((courtBy(d.court.kind)||{}).name || "Court")) : "";
          return `<div class="card fade" style="padding:16px;">
            <span class="chip on" style="display:inline-block;margin-bottom:8px;">${esc(d.category||(isCourt?"Court":"Drill"))}</span>
            ${isCourt?`<span class="chip" style="display:inline-block;margin:0 0 8px 6px;">${esc(cName)}</span>`:""}
            <div class="disp" style="font-size:18px;margin-bottom:6px;">${esc(d.title)}</div>
            <div class="muted" style="font-size:14px;line-height:1.6;">${esc(d.desc||"")}</div>
            ${(isCourt && d.court.dna && d.court.dna.shots) ? (()=>{ const n=d.court.dna; const col={Light:"#9aa49a",Moderate:"#ffd34d",High:"#ff9f45",Elite:"#ff5d6c"}[n.level]||"#9aa49a"; return `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:9px;align-items:center;"><span style="background:${col}22;color:${col};border:1px solid ${col};border-radius:20px;padding:2px 10px;font-size:11px;font-weight:600;">🧬 ${esc(n.level)}</span><span class="muted" style="font-size:12px;">${n.total} m · ${n.shots} shots · ${n.jumps} jumps</span></div>`; })() : ""}
            ${coach?`<div class="muted" style="font-size:12px;margin-top:8px;">${esc(assignLabel(d))}</div>`:""}
            ${isCourt?`<div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;">
                <button class="btn pri" data-openct="${esc(d.docId)}" style="padding:6px 12px;font-size:13px;">▶ Open court</button>
                ${d.court.kind==="pro3d"?`<button class="btn" data-playct="${esc(d.docId)}" style="padding:6px 11px;font-size:12px;">🎮 Play it</button>`:""}
                ${coach?`<button class="btn" data-editct="${esc(d.docId)}" style="padding:6px 11px;font-size:12px;">Edit</button>
                <button class="btn" data-delct="${esc(d.docId)}" style="padding:6px 11px;font-size:12px;">Delete</button>`:""}
              </div>`
             : (d.videoUrl?`<a href="${esc(d.videoUrl)}" target="_blank" rel="noreferrer" class="disp" style="font-size:13px;display:inline-block;margin-top:10px;">Watch video →</a>`:"")}
          </div>`;
        }).join("") : '<div class="muted">No drills yet'+(coach?' — add the first one.':'.')+'</div>'}
      </div>`;

    view.querySelectorAll("[data-cat]").forEach(el=>el.onclick=()=>{ filter = el.dataset.cat; draw(); });
    view.querySelectorAll("[data-openct]").forEach(el=>el.onclick=()=>{ const d=drills.find(x=>x.docId===el.dataset.openct); if(d) openPlay(d); });
    view.querySelectorAll("[data-playct]").forEach(el=>el.onclick=()=>{ const d=drills.find(x=>x.docId===el.dataset.playct); if(d) openChallenge(d); });
    view.querySelectorAll("[data-editct]").forEach(el=>el.onclick=()=>{ const d=drills.find(x=>x.docId===el.dataset.editct); if(d) openBuild(d.court&&d.court.kind, d); });
    view.querySelectorAll("[data-delct]").forEach(el=>el.onclick=async ()=>{ const id=el.dataset.delct; if(confirm("Delete this court drill?")){ try{ await deleteDrill(id); }catch(e){} } });

    if(coach){
      const form = document.getElementById("drillForm");
      textAssign.wire(document.getElementById("dAssign"));
      document.getElementById("addDrillBtn").onclick = ()=>{ form.style.display = form.style.display==="none"?"block":"none"; };
      document.getElementById("addCourtBtn").onclick = openPick;
      document.getElementById("dSave").onclick = async ()=>{
        const title = document.getElementById("dTitle").value.trim();
        const errEl = document.getElementById("dErr"); errEl.textContent = "";
        if(!title){ errEl.textContent = "Give it a title."; return; }
        try{
          await addDrill({
            title,
            category: document.getElementById("dCat").value,
            desc: document.getElementById("dDesc").value.trim(),
            videoUrl: document.getElementById("dVideo").value.trim(),
            assignedTo: textAssign.value(),
            ts: Date.now()
          });
          form.style.display = "none";
        }catch(e){ errEl.textContent = "Couldn't save: " + (e.message||e); }
      };
    }
  };

  const draw = ()=>{
    if(!screen) return renderList();
    if(screen.mode==="pick") return renderPick();
    return renderCourtScreen();
  };

  view.innerHTML = `<div class="muted">Loading library…</div>`;
  state.unsub.push(listenDrills((arr, err)=>{
    if(err){ view.innerHTML = `<div class="err">Couldn't load library: ${esc(err.message)}</div>`; return; }
    drills = arr; if(!screen) draw();
  }));
}

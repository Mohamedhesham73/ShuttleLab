import { state, esc } from "../core.js";
import { listenDrills, addDrill, updateDrill, deleteDrill } from "../data.js";
import { mountSideCourt } from "../sidecourt.js";
import { mountSoloCourt } from "../solocourt.js";

const CATS = ["Shots","Footwork","Strength","Conditioning","Tactics"];

// Court registry — add a future court (Double / Mix / Drill) by adding ONE line.
// kind is stored on the drill; the picker, builder and player all read this list.
const COURTS = [
  { kind:"side", name:"Side Court", blurb:"Side-on 3D view — see each shot's height & arc.", mount:mountSideCourt },
  { kind:"solo", name:"Solo Court", blurb:"Top-down perspective — footwork & shot placement.", mount:mountSoloCourt }
];
const courtBy = kind => COURTS.find(c=>c.kind===kind);

export function renderLibrary(){
  const view = document.getElementById("view");
  const coach = state.role==="coach";
  let drills = [], filter = "All", screen = null, mounted = null;

  const destroyMount = ()=>{ if(mounted){ try{ mounted.destroy(); }catch(e){} mounted=null; } };
  const leaveCourt = ()=>{ destroyMount(); screen=null; draw(); };
  const openPick  = ()=>{ screen={ mode:"pick" }; draw(); };
  const openBuild = (kind, drill)=>{ screen={ mode:"build", kind, drill }; draw(); };
  const openPlay  = (drill)=>{ screen={ mode:"play", drill }; draw(); };

  // ---------------- COURT PICKER ----------------
  const renderPick = ()=>{
    view.innerHTML = `
      <button class="btn" id="ctBack" style="margin-bottom:14px;padding:7px 12px;font-size:12px;">← Back to library</button>
      <div class="card" style="padding:18px;">
        <div class="disp" style="font-size:18px;margin-bottom:4px;">Choose a court</div>
        <div class="muted" style="font-size:13px;margin-bottom:14px;">More court types are coming — they'll show up here.</div>
        <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(220px,1fr));">
          ${COURTS.map(c=>`<button class="card" data-pick="${c.kind}" style="text-align:left;padding:16px;cursor:pointer;border:0.5px solid var(--line);">
            <div class="disp" style="font-size:16px;margin-bottom:4px;">${esc(c.name)}</div>
            <div class="muted" style="font-size:13px;line-height:1.5;">${esc(c.blurb)}</div>
          </button>`).join("")}
        </div>
      </div>`;
    document.getElementById("ctBack").onclick = leaveCourt;
    view.querySelectorAll("[data-pick]").forEach(el=>el.onclick=()=>openBuild(el.dataset.pick, null));
  };

  // ---------------- COURT BUILD / WATCH ----------------
  const renderCourtScreen = ()=>{
    const { drill, mode } = screen;
    const kind = mode==="play" ? (drill.court && drill.court.kind) : screen.kind;
    const entry = courtBy(kind) || COURTS[0];

    if(mode === "play"){
      view.innerHTML = `
        <button class="btn" id="ctBack" style="margin-bottom:14px;padding:7px 12px;font-size:12px;">← Back to library</button>
        <div class="card" style="padding:16px;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap;">
            <div class="disp" style="font-size:18px;">${esc(drill.title)}</div>
            <span class="chip">${esc(entry.name)}</span>
          </div>
          <div id="ctMount"></div>
        </div>`;
      document.getElementById("ctBack").onclick = leaveCourt;
      mounted = entry.mount(document.getElementById("ctMount"), { mode:"play", points: drill.court && drill.court.points });
      return;
    }

    // build / edit
    view.innerHTML = `
      <button class="btn" id="ctBack" style="margin-bottom:14px;padding:7px 12px;font-size:12px;">← Back to library</button>
      <div class="card" style="padding:16px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap;">
          <div class="disp" style="font-size:18px;">${drill ? "Edit court drill" : "New court drill"}</div>
          <span class="chip on">${esc(entry.name)}</span>
        </div>
        <input id="ctTitle" placeholder="Drill name (e.g. Attack: clear → drop → smash)" style="margin-bottom:12px;" value="${drill?esc(drill.title):""}">
        <div id="ctMount"></div>
        <div style="display:flex;gap:8px;margin-top:14px;align-items:center;flex-wrap:wrap;">
          <button class="btn pri" id="ctSave">${drill?"Save changes":"Save to library"}</button>
          <button class="btn" id="ctCancel" style="padding:8px 12px;">Cancel</button>
          <span id="ctMsg" class="muted" style="font-size:13px;"></span>
        </div>
      </div>`;
    document.getElementById("ctBack").onclick = leaveCourt;
    document.getElementById("ctCancel").onclick = leaveCourt;
    mounted = entry.mount(document.getElementById("ctMount"), { mode:"edit", points: drill && drill.court && drill.court.points });
    document.getElementById("ctSave").onclick = async ()=>{
      const title = document.getElementById("ctTitle").value.trim();
      const msg = document.getElementById("ctMsg");
      if(!title){ msg.style.color="var(--down)"; msg.textContent="Give the drill a name."; return; }
      if(!mounted.hasShots()){ msg.style.color="var(--down)"; msg.textContent="Add at least one shot first."; return; }
      const payload = { title, category:"Court", court:{ kind, points:mounted.getPoints() }, ts:Date.now() };
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
    const cats = ["All", ...Array.from(new Set(drills.map(d=>d.category).filter(Boolean)))];
    const shown = drills.filter(d=>filter==="All" || d.category===filter);
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
        <input id="dVideo" placeholder="Video link (optional)" style="margin-bottom:12px;">
        <button class="btn pri" id="dSave">Save to library</button><div id="dErr" class="err"></div>
      </div>`:""}
      <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(230px,1fr));">
        ${shown.length?shown.map(d=>{
          const isCourt = !!d.court;
          const cName = isCourt ? ((courtBy(d.court.kind)||{}).name || "Court") : "";
          return `<div class="card fade" style="padding:16px;">
            <span class="chip on" style="display:inline-block;margin-bottom:8px;">${esc(d.category||(isCourt?"Court":"Drill"))}</span>
            ${isCourt?`<span class="chip" style="display:inline-block;margin:0 0 8px 6px;">${esc(cName)}</span>`:""}
            <div class="disp" style="font-size:18px;margin-bottom:6px;">${esc(d.title)}</div>
            <div class="muted" style="font-size:14px;line-height:1.6;">${esc(d.desc||"")}</div>
            ${isCourt?`<div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;">
                <button class="btn pri" data-openct="${esc(d.docId)}" style="padding:6px 12px;font-size:13px;">▶ Open court</button>
                ${coach?`<button class="btn" data-editct="${esc(d.docId)}" style="padding:6px 11px;font-size:12px;">Edit</button>
                <button class="btn" data-delct="${esc(d.docId)}" style="padding:6px 11px;font-size:12px;">Delete</button>`:""}
              </div>`
             : (d.videoUrl?`<a href="${esc(d.videoUrl)}" target="_blank" rel="noreferrer" class="disp" style="font-size:13px;display:inline-block;margin-top:10px;">Watch video →</a>`:"")}
          </div>`;
        }).join("") : '<div class="muted">No drills yet'+(coach?' — add the first one.':'.')+'</div>'}
      </div>`;

    view.querySelectorAll("[data-cat]").forEach(el=>el.onclick=()=>{ filter = el.dataset.cat; draw(); });
    view.querySelectorAll("[data-openct]").forEach(el=>el.onclick=()=>{ const d=drills.find(x=>x.docId===el.dataset.openct); if(d) openPlay(d); });
    view.querySelectorAll("[data-editct]").forEach(el=>el.onclick=()=>{ const d=drills.find(x=>x.docId===el.dataset.editct); if(d) openBuild(d.court&&d.court.kind, d); });
    view.querySelectorAll("[data-delct]").forEach(el=>el.onclick=async ()=>{ const id=el.dataset.delct; if(confirm("Delete this court drill?")){ try{ await deleteDrill(id); }catch(e){} } });

    if(coach){
      const form = document.getElementById("drillForm");
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

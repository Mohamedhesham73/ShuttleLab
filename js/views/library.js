import { state, esc } from "../core.js";
import { listenDrills, addDrill } from "../data.js";

const CATS = ["Shots","Footwork","Strength","Conditioning","Tactics"];

export function renderLibrary(){
  const view = document.getElementById("view");
  const coach = state.role==="coach";
  let drills = [], filter = "All";

  const draw = ()=>{
    const cats = ["All", ...Array.from(new Set(drills.map(d=>d.category).filter(Boolean)))];
    const shown = drills.filter(d=>filter==="All" || d.category===filter);
    view.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:14px;">
        <div style="display:flex;gap:6px;flex-wrap:wrap;">${cats.map(c=>`<span class="chip ${filter===c?"on":""}" data-cat="${esc(c)}">${esc(c)}</span>`).join("")}</div>
        ${coach?`<button class="btn pri" id="addDrillBtn">+ Add drill</button>`:""}
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
        ${shown.length?shown.map(d=>`<div class="card fade" style="padding:16px;">
          <span class="chip on" style="display:inline-block;margin-bottom:8px;">${esc(d.category||"Drill")}</span>
          <div class="disp" style="font-size:18px;margin-bottom:6px;">${esc(d.title)}</div>
          <div style="font-size:14px;line-height:1.6;" class="muted">${esc(d.desc||"")}</div>
          ${d.videoUrl?`<a href="${esc(d.videoUrl)}" target="_blank" rel="noreferrer" class="disp" style="font-size:13px;display:inline-block;margin-top:10px;">Watch video →</a>`:""}
        </div>`).join("") : '<div class="muted">No drills yet'+(coach?' — add the first one.':'.')+'</div>'}
      </div>`;

    document.querySelectorAll("[data-cat]").forEach(el=>el.onclick=()=>{ filter = el.dataset.cat; draw(); });
    if(coach){
      const form = document.getElementById("drillForm");
      document.getElementById("addDrillBtn").onclick = ()=>{ form.style.display = form.style.display==="none"?"block":"none"; };
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

  view.innerHTML = `<div class="muted">Loading library…</div>`;
  state.unsub.push(listenDrills((arr, err)=>{
    if(err){ view.innerHTML = `<div class="err">Couldn't load library: ${esc(err.message)}</div>`; return; }
    drills = arr; draw();
  }));
}

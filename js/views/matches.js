import { state, esc } from "../core.js";
import { listenVideos, addVideo, updateVideo, deleteVideo, markVideoWatched, getPlaybackUrl } from "../data.js";
import { uploadToR2 } from "../r2upload.js";

// =============================================================
//  MATCHES — the film-room.
//  Coach loads a video (YouTube or direct link), pins notes to
//  exact seconds, marks auto-pause / slow-mo points, draws on the
//  frame, and assigns it to a player or the whole team. Players
//  watch it back with everything firing automatically.
//
//  Video files themselves are NOT stored in Firebase (keeps it
//  free). We store the link + all coaching data per video doc.
//  Phase 2: real file upload (Firebase Storage) + voice notes.
// =============================================================

const TYPES = ["Match", "Drill", "Multi-shuttle", "Other"];
const DCOLS = ["#a4dd2b", "#ffd34d", "#ff5d6c", "#5db9ff", "#c77dff", "#ffffff"];
const NOTE_HOLD = 2;          // seconds a note stays on screen
const DW = 1000, DH = 562;    // drawing-overlay coordinate space (16:9)
const players = () => state.roster.filter(u => u.role === "player");

function fmt(t){ t = t || 0; const m = Math.floor(t/60), s = Math.floor(t%60); return m + ":" + (s<10?"0":"") + s; }

// ---- figure out what kind of link we were given ----
function parseSource(raw){
  const u = (raw || "").trim();
  if(!u) return null;
  let m = u.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  if(m) return { kind: "youtube", id: m[1] };
  if(/^https?:\/\//.test(u)) return { kind: "url", url: u };
  return null;
}

// ---- load the YouTube IFrame API once, on demand ----
let _ytQueue = [];
function ytLoad(cb){
  if(window.YT && window.YT.Player){ cb(); return; }
  _ytQueue.push(cb);
  if(document.getElementById("yt-api")) return;
  const s = document.createElement("script");
  s.id = "yt-api"; s.src = "https://www.youtube.com/iframe_api";
  const prev = window.onYouTubeIframeAPIReady;
  window.onYouTubeIframeAPIReady = function(){ if(prev) try{ prev(); }catch(e){} _ytQueue.forEach(f=>f()); _ytQueue = []; };
  document.head.appendChild(s);
}

export function renderMatches(opts){
  opts = opts || {};
  const myUploads = opts.mode === "myuploads";   // player's own "My Videos" page
  const view = document.getElementById("view");
  const coach = state.role === "coach";
  const canPost = coach || myUploads;            // who sees the upload form
  let videos = [];
  let current = null;   // open video docId (so live updates don't clobber the editor)

  // ---------- LIST SCREEN ----------
  function renderList(){
    let mine;
    if(myUploads){
      // My Videos: only the clips this player uploaded.
      mine = videos.filter(v => String(v.submittedBy) === String(state.user.id));
    } else if(coach){
      mine = videos;
    } else {
      mine = videos.filter(v =>
        v.assignedTo === "team" ||
        (Array.isArray(v.assignedTo) && v.assignedTo.map(String).includes(String(state.user.id)))
      );
    }

    view.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:14px;">
        <div class="logo-txt" style="font-size:20px;">${myUploads ? "My Videos" : "Film room"}</div>
        ${canPost ? `<button class="btn pri" id="addVidBtn">+ Add video</button>` : ``}
      </div>

      ${myUploads ? `<div class="muted" style="font-size:13px;margin-bottom:14px;">Upload your match or training clips here. Your coach will analyse them and add notes you can watch back.</div>` : ``}

      ${canPost ? `<div id="vidForm" class="card" style="padding:16px;margin-bottom:16px;display:none;">
        <div style="display:flex;gap:10px;margin-bottom:10px;flex-wrap:wrap;">
          <input id="vTitle" placeholder="Title (e.g. Quarterfinal vs. Hassan — game 2)" style="flex:2;min-width:170px;">
          <select id="vType" style="flex:1;min-width:130px;">${TYPES.map(t=>`<option>${t}</option>`).join("")}</select>
        </div>
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:10px;">
          <label class="btn" style="cursor:pointer;"><input id="vFile" type="file" accept="video/*" style="display:none;"> Upload from device</label>
          <span class="muted" style="font-size:12px;">— or paste a link below</span>
        </div>
        <input id="vLink" placeholder="YouTube link or direct video URL (.mp4)" style="margin-bottom:6px;">
        <div class="muted" style="font-size:12px;margin-bottom:10px;">Any footage works — match, drill, or multi-shuttle. Phone or laptop, both fine.</div>
        <div id="vProg" class="muted" style="font-size:12px;margin-bottom:10px;display:none;"></div>
        <button class="btn pri" id="vSave">Create from link</button><div id="vErr" class="err"></div>
      </div>` : ``}

      <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(250px,1fr));">
        ${mine.length ? mine.map(v=>`
          <div class="card fade" data-open="${esc(v.docId)}" style="padding:0;overflow:hidden;cursor:pointer;">
            <div style="position:relative;aspect-ratio:16/9;background:#0c2018;">
              ${v.source && v.source.kind==="youtube"
                ? `<img src="https://img.youtube.com/vi/${esc(v.source.id)}/hqdefault.jpg" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;" onerror="this.remove()">`
                : `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:13px;">video</div>`}
              <span style="position:absolute;left:8px;top:8px;" class="chip on">${esc(v.type||"Match")}</span>
              <span style="position:absolute;right:8px;bottom:8px;background:rgba(0,0,0,.55);color:#fff;font-size:11px;padding:3px 8px;border-radius:20px;">${(v.markers&&v.markers.length)||0} notes</span>
            </div>
            <div style="padding:13px 15px;">
              <div class="disp" style="font-size:16px;margin-bottom:4px;">${esc(v.title||"Untitled")}</div>
              <div class="muted" style="font-size:12px;">${myUploads ? myStatus(v) : assignLabel(v)}</div>
              ${coach && v.submittedBy ? `<div class="muted" style="font-size:12px;margin-top:3px;color:var(--brand);">📤 Submitted by ${esc(submitterName(v))}</div>` : ""}
              ${coach && audienceIds(v).length ? `<div class="muted" style="font-size:12px;margin-top:3px;">Seen by ${seenCount(v)}/${audienceIds(v).length}</div>` : ""}
            </div>
          </div>`).join("")
          : `<div class="muted">${myUploads ? "You haven't uploaded any clips yet — tap “+ Add video” to send your first one to the coach." : (coach ? "No videos yet — add the first one." : "Your coach hasn't shared any videos yet.")}</div>`}
      </div>`;

    view.querySelectorAll("[data-open]").forEach(el=>{
      el.onclick = ()=>{ const v = videos.find(x=>x.docId===el.dataset.open); if(v) openVideo(v); };
    });

    if(canPost){
      const form = document.getElementById("vidForm");
      // A player's "My Videos" upload is tagged with submittedBy and auto-shared
      // back to themselves so the coach can find it and they can watch the notes.
      const ownerFields = myUploads
        ? { submittedBy: String(state.user.id), assignedTo: [String(state.user.id)] }
        : { assignedTo: [] };
      document.getElementById("addVidBtn").onclick = ()=>{ form.style.display = form.style.display==="none" ? "block" : "none"; };
      document.getElementById("vSave").onclick = async ()=>{
        const title = document.getElementById("vTitle").value.trim();
        const link  = document.getElementById("vLink").value.trim();
        const errEl = document.getElementById("vErr"); errEl.textContent = "";
        if(!title){ errEl.textContent = "Give it a title."; return; }
        const src = parseSource(link);
        if(!src){ errEl.textContent = "Paste a YouTube link or a direct video URL."; return; }
        try{
          const ref = await addVideo({
            title, type: document.getElementById("vType").value,
            source: src, markers: [], ...ownerFields,
            createdBy: String(state.user.id), ts: Date.now()
          });
          form.style.display = "none";
          // open it straight away (coach: to add notes; player: to confirm upload)
          openVideo({ docId: ref.id, title, type: document.getElementById("vType").value, source: src, markers: [], ...ownerFields });
        }catch(e){ errEl.textContent = "Couldn't save: " + (e.message||e); }
      };

      document.getElementById("vFile").onchange = async function(){
        const f = this.files && this.files[0];
        if(!f) return;
        const errEl = document.getElementById("vErr"); errEl.textContent = "";
        const prog = document.getElementById("vProg");
        const title = document.getElementById("vTitle").value.trim() || f.name.replace(/\.[^.]+$/, "");
        const type = document.getElementById("vType").value;
        prog.style.display = "block"; prog.textContent = "Preparing…";
        try{
          const { key, url, hash, deduped } = await uploadToR2(f, { onProgress: p => { prog.textContent = "Uploading… " + Math.round(p*100) + "%"; } });
          prog.textContent = deduped ? "Already uploaded — linking…" : "Finishing…";
          const src = { kind: "r2", key, url: url || null };
          const ref = await addVideo({ title, type, source: src, contentHash: hash, markers: [], ...ownerFields, createdBy: String(state.user.id), ts: Date.now() });
          form.style.display = "none"; prog.style.display = "none"; this.value = "";
          openVideo({ docId: ref.id, title, type, source: src, markers: [], ...ownerFields });
        }catch(e){
          prog.style.display = "none";
          errEl.textContent = "Upload failed: " + (e.message||e);
        }
      };
    }
  }

  function assignLabel(v){
    if(v.assignedTo === "team") return "Shared with the whole team";
    if(Array.isArray(v.assignedTo) && v.assignedTo.length){
      const names = v.assignedTo.map(id => { const u = state.roster.find(x=>String(x.id)===String(id)); return u ? u.name : "?"; });
      return "Sent to " + names.join(", ");
    }
    return coach ? "Not sent yet" : "";
  }

  // ---- My Videos helpers ----
  function submitterName(v){
    const u = state.roster.find(x=>String(x.id)===String(v.submittedBy));
    return u ? u.name : "a player";
  }
  function myStatus(v){
    const n = (v.markers && v.markers.length) || 0;
    return n ? ("Coach added " + n + " coaching point" + (n>1?"s":"")) : "Awaiting coach analysis";
  }

  // ---- watched / done tracking helpers ----
  function audienceIds(v){
    if(v.assignedTo === "team") return players().map(p=>String(p.id));
    return Array.isArray(v.assignedTo) ? v.assignedTo.map(String) : [];
  }
  function seenCount(v){
    const wb = v.watchedBy || {};
    return audienceIds(v).filter(id=>wb[id]).length;
  }
  function seenWhen(ts){
    try{ return new Date(ts).toLocaleDateString(undefined,{ month:"short", day:"numeric" }); }
    catch(e){ return ""; }
  }
  function seenPanelHTML(v){
    const ids = audienceIds(v);
    if(!ids.length){
      return `<div class="card" style="padding:14px;margin-top:16px;">
        <div class="disp" style="font-size:15px;margin-bottom:8px;">Who's watched</div>
        <div class="muted" style="font-size:13px;">Send this to a player or the team to start tracking who's watched it.</div></div>`;
    }
    const wb = v.watchedBy || {};
    const rows = ids.map(id=>{
      const us = state.roster.find(x=>String(x.id)===String(id));
      const nm = us ? us.name : ("#"+id);
      const w = wb[id];
      const right = w
        ? `<span style="color:var(--up);">✓ ${seenWhen(w.ts)}${w.count>1?` · ${w.count}×`:""}</span>`
        : `<span class="muted">Not yet</span>`;
      return `<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;font-size:14px;"><span>${esc(nm)}</span>${right}</div>`;
    }).join("");
    return `<div class="card" style="padding:14px;margin-top:16px;">
      <div class="disp" style="font-size:15px;margin-bottom:8px;">Who's watched <span class="muted" style="font-size:13px;">· ${seenCount(v)}/${ids.length}</span></div>
      ${rows}</div>`;
  }

  // ---------- DETAIL / FILM-ROOM SCREEN ----------
  function openVideo(v){
    current = v.docId;
    const work = JSON.parse(JSON.stringify(v));
    work.markers = work.markers || [];
    work.assignedTo = work.assignedTo || [];

    view.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
        <button class="btn" id="backBtn" style="padding:7px 12px;font-size:12px;">← Back</button>
        <div class="disp" style="font-size:18px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(work.title||"Untitled")}</div>
        <span class="chip on">${esc(work.type||"Match")}</span>
      </div>

      <div id="flmStage" style="position:relative;width:100%;aspect-ratio:16/9;border-radius:14px;overflow:hidden;background:#000;">
        <div id="mediaMount" style="position:absolute;inset:0;width:100%;height:100%;"></div>
        <svg id="flmOv" viewBox="0 0 ${DW} ${DH}" style="position:absolute;inset:0;width:100%;height:100%;touch-action:none;pointer-events:${coach?"auto":"none"};"></svg>
        <div id="flmNote" style="position:absolute;left:10px;right:10px;top:10px;display:none;background:rgba(8,24,18,0.88);border:1px solid rgba(164,221,43,.35);border-radius:10px;padding:9px 12px;color:#eafff0;">
          <div style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--brand);margin-bottom:3px;"><span id="flmNoteMeta">Note</span></div>
          <div id="flmNoteText" style="font-size:13px;line-height:1.45;"></div>
          <button class="btn pri" id="flmResume" style="display:none;margin-top:8px;padding:5px 12px;font-size:12px;">▶ Resume</button>
        </div>
        <div id="flmSlow" style="position:absolute;right:10px;bottom:10px;display:none;background:rgba(8,24,18,0.8);color:#5db9ff;font-size:11px;padding:3px 9px;border-radius:20px;">slow-mo</div>
        <div id="flmLoad" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:13px;">Loading video…</div>
      </div>

      <div style="position:relative;height:14px;margin:12px 2px 2px;">
        <div style="position:absolute;top:50%;left:0;right:0;height:3px;transform:translateY(-50%);background:var(--line2);border-radius:3px;"></div>
        <div id="flmProg" style="position:absolute;top:50%;left:0;height:3px;transform:translateY(-50%);background:var(--muted);border-radius:3px;width:0%;"></div>
        <div id="flmMk"></div>
      </div>
      <input id="flmScrub" type="range" min="0" max="1000" value="0" step="1" style="width:100%;">

      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:8px;">
        <button class="btn" id="flmPlay" style="padding:8px 14px;">▶ Play</button>
        <span id="flmTime" class="muted" style="font-size:13px;font-variant-numeric:tabular-nums;">0:00 / 0:00</span>
        <select id="flmSpd" style="width:auto;"><option value="1">1×</option><option value="0.5">0.5×</option><option value="0.25">0.25×</option></select>
        ${coach ? `<button class="btn pri" id="flmAdd" style="margin-left:auto;">+ Note here</button>` : ``}
      </div>

      ${coach ? `<div id="flmEditor" class="card" style="padding:14px;margin-top:14px;display:none;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
          <div class="disp" style="font-size:15px;">Note at <span id="flmEdTime">0:00</span></div>
          <button class="btn" id="flmEdDel" style="padding:5px 10px;font-size:12px;">Delete</button>
        </div>
        <textarea id="flmEdNote" rows="2" placeholder="What should the player notice here?" style="width:100%;resize:vertical;margin-bottom:10px;"></textarea>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:10px;">
          <span class="chip" id="flmTgPause">Auto-pause</span>
          <span class="chip" id="flmTgSlow">Slow-mo</span>
          <select id="flmSlowSpd" style="width:auto;font-size:12px;display:none;"><option value="0.5">to 0.5×</option><option value="0.25">to 0.25×</option></select>
        </div>
        <div style="border-top:1px solid var(--line);padding-top:10px;">
          <div class="muted" style="font-size:12px;margin-bottom:6px;">Draw on the frame</div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
            <span class="chip" id="flmTArrow">Arrow</span>
            <span class="chip" id="flmTCircle">Circle</span>
            <span id="flmPal" style="display:flex;gap:6px;margin-left:4px;"></span>
            <button class="btn" id="flmClr" style="margin-left:auto;padding:5px 10px;font-size:12px;">Clear</button>
          </div>
        </div>
        <button class="btn" id="flmEdDone" style="width:100%;margin-top:12px;">Done</button>
      </div>` : ``}

      <div style="margin-top:14px;">
        <div class="muted" style="font-size:12px;margin-bottom:6px;">Coaching points</div>
        <div id="flmList" style="display:flex;flex-direction:column;gap:6px;"></div>
      </div>

      ${coach ? `<div class="card" style="padding:14px;margin-top:16px;">
        <div class="disp" style="font-size:15px;margin-bottom:10px;">Send to</div>
        <div id="flmAssign" style="display:flex;gap:7px;flex-wrap:wrap;margin-bottom:12px;"></div>
        <button class="btn pri" id="flmSaveBtn">Save & send</button>
        <span id="flmSaveMsg" class="muted" style="margin-left:10px;font-size:13px;"></span>
        <div style="border-top:1px solid var(--line);margin-top:14px;padding-top:12px;">
          <button class="btn" id="flmDelVid" style="color:var(--down);border-color:var(--down);">🗑 Delete video</button>
          <span class="muted" style="margin-left:8px;font-size:12px;">Removes it for everyone.</span>
        </div>
      </div>
      ${seenPanelHTML(work)}` : ``}
    `;

    document.getElementById("backBtn").onclick = ()=>{ stopLoop(); current = null; renderList(); };

    // ---------- engine ----------
    const stage = document.getElementById("flmStage");
    const ov = document.getElementById("flmOv");
    const markers = work.markers;
    let media = null, ready = false, dur = 0, cur = 0, lastT = 0, playing = false, raf = null;
    let sel = null, tool = null, drawColor = "#a4dd2b", drawing = null, shownId = null;
    let recordedWatch = false;

    // colour palette for drawings (coach only)
    if(coach){
      const pal = document.getElementById("flmPal");
      DCOLS.forEach(c=>{
        const b = document.createElement("button");
        b.style.cssText = "width:20px;height:20px;border-radius:50%;cursor:pointer;padding:0;background:"+c+";border:2px solid "+(c===drawColor?"#fff":"transparent")+";";
        b.onclick = ()=>{ drawColor = c; Array.prototype.forEach.call(pal.children,(x,i)=>{ x.style.border = "2px solid "+(DCOLS[i]===drawColor?"#fff":"transparent"); }); };
        pal.appendChild(b);
      });
    }

    function getDur(){ return (media && media.getDur && isFinite(media.getDur())) ? media.getDur() : (dur||0); }
    function activeSlow(t){ let best=null; markers.forEach(m=>{ if(m.slow && t>=m.t && t<=m.t+2.5){ if(best===null||m.slowSpd<best) best=m.slowSpd; } }); return best; }

    function arrowHead(d){
      const ang=Math.atan2(d.y2-d.y1,d.x2-d.x1), L=22, w=13, ax=d.x2, ay=d.y2;
      const p1x=ax-L*Math.cos(ang)+w*Math.sin(ang), p1y=ay-L*Math.sin(ang)-w*Math.cos(ang);
      const p2x=ax-L*Math.cos(ang)-w*Math.sin(ang), p2y=ay-L*Math.sin(ang)+w*Math.cos(ang);
      return ax+","+ay+" "+p1x.toFixed(0)+","+p1y.toFixed(0)+" "+p2x.toFixed(0)+","+p2y.toFixed(0);
    }
    function showOverlay(m){
      ov.innerHTML = "";
      if(!m || !m.draws) return;
      const NS="http://www.w3.org/2000/svg";
      m.draws.forEach(d=>{
        if(d.type==="arrow"){
          const l=document.createElementNS(NS,"line"); l.setAttribute("x1",d.x1);l.setAttribute("y1",d.y1);l.setAttribute("x2",d.x2);l.setAttribute("y2",d.y2);l.setAttribute("stroke",d.color);l.setAttribute("stroke-width","7");l.setAttribute("stroke-linecap","round"); ov.appendChild(l);
          const p=document.createElementNS(NS,"polygon"); p.setAttribute("points",arrowHead(d)); p.setAttribute("fill",d.color); ov.appendChild(p);
        }else{
          const c=document.createElementNS(NS,"circle"); c.setAttribute("cx",d.cx);c.setAttribute("cy",d.cy);c.setAttribute("r",d.r);c.setAttribute("fill","none");c.setAttribute("stroke",d.color);c.setAttribute("stroke-width","7"); ov.appendChild(c);
        }
      });
    }
    function showNote(m, withResume){
      document.getElementById("flmNoteMeta").textContent = "At "+fmt(m.t)+(m.slow?" · slow-mo":"");
      document.getElementById("flmNoteText").textContent = m.note || "(no note)";
      document.getElementById("flmNote").style.display = "block";
      document.getElementById("flmResume").style.display = withResume ? "inline-flex" : "none";
      showOverlay(m); shownId = m.id;
    }
    function hideNote(){ document.getElementById("flmNote").style.display="none"; shownId=null; showOverlay(coach?sel:null); }
    function updateFlash(t){
      let an=null; markers.forEach(m=>{ if(t>=m.t && t<m.t+NOTE_HOLD){ if(an===null||m.t>an.t) an=m; } });
      if(an){ if(shownId!==an.id) showNote(an, false); }
      else if(shownId!==null){ hideNote(); }
    }
    function paintUI(t){
      const d=getDur();
      document.getElementById("flmScrub").value = d?Math.round(t/d*1000):0;
      document.getElementById("flmProg").style.width = (d?t/d*100:0)+"%";
      document.getElementById("flmTime").textContent = fmt(t)+" / "+fmt(d);
      const sl=activeSlow(t); document.getElementById("flmSlow").style.display = (sl&&playing)?"block":"none";
    }
    function seek(t, fromUser){
      cur=Math.max(0,Math.min(getDur()||0,t));
      if(media&&media.seek) media.seek(cur);
      paintUI(cur); lastT=cur; if(fromUser) updateFlash(cur);
    }
    function findPause(a,b){ let hit=null; markers.forEach(m=>{ if(m.pause && m.t>a && m.t<=b){ if(hit===null||m.t<hit.t) hit=m; } }); return hit; }

    function renderMk(){
      const lay=document.getElementById("flmMk"); lay.innerHTML="";
      const d=getDur();
      markers.forEach(m=>{
        const el=document.createElement("div");
        el.style.cssText="position:absolute;top:50%;transform:translate(-50%,-50%);width:11px;height:11px;border-radius:50%;border:2px solid #fff;cursor:pointer;background:"+m.color+";left:"+(d?m.t/d*100:0)+"%;";
        el.title=m.note||"";
        el.onclick=()=>{ pauseV(); seek(m.t); if(coach) openEditor(m); else showNote(m,false); };
        lay.appendChild(el);
      });
      const list=document.getElementById("flmList"); list.innerHTML="";
      if(!markers.length){ list.innerHTML='<div class="muted" style="font-size:12px;">'+(coach?"No notes yet — scrub to a moment and tap “Note here”.":"No coaching points on this clip yet.")+'</div>'; return; }
      markers.slice().sort((a,b)=>a.t-b.t).forEach(m=>{
        const r=document.createElement("div");
        r.style.cssText="display:flex;align-items:center;gap:9px;padding:9px 11px;border:1px solid var(--line);border-radius:10px;cursor:pointer;";
        const tags=(m.pause?" · pause":"")+(m.slow?" · slow":"")+((m.draws&&m.draws.length)?" · draw":"");
        r.innerHTML='<span style="width:9px;height:9px;border-radius:50%;flex:0 0 auto;background:'+m.color+';"></span>'+
          '<div style="flex:1;"><div class="muted" style="font-size:12px;font-variant-numeric:tabular-nums;">'+fmt(m.t)+esc(tags)+'</div>'+
          '<div style="font-size:14px;">'+esc(m.note||"(no note)")+'</div></div>';
        r.onclick=()=>{ pauseV(); seek(m.t); if(coach) openEditor(m); else showNote(m,false); };
        list.appendChild(r);
      });
    }

    // ----- coach editor -----
    function openEditor(m){
      if(!coach) return;
      sel=m;
      const ed=document.getElementById("flmEditor"); ed.style.display="block";
      document.getElementById("flmEdTime").textContent=fmt(m.t);
      document.getElementById("flmEdNote").value=m.note||"";
      document.getElementById("flmTgPause").classList.toggle("on",!!m.pause);
      document.getElementById("flmTgSlow").classList.toggle("on",!!m.slow);
      document.getElementById("flmSlowSpd").style.display=m.slow?"inline-block":"none";
      document.getElementById("flmSlowSpd").value=String(m.slowSpd||0.5);
      tool=null; document.getElementById("flmTArrow").classList.remove("on"); document.getElementById("flmTCircle").classList.remove("on");
      showOverlay(m);
    }
    function closeEditor(){ const ed=document.getElementById("flmEditor"); if(ed) ed.style.display="none"; sel=null; tool=null; showOverlay(null); }

    if(coach){
      document.getElementById("flmAdd").onclick=()=>{
        pauseV();
        const m={ id:Date.now(), t:Math.round(cur*10)/10, note:"", pause:true, slow:false, slowSpd:0.5, draws:[], color:"#a4dd2b" };
        markers.push(m); renderMk(); openEditor(m);
      };
      document.getElementById("flmEdNote").oninput=function(){ if(sel){ sel.note=this.value; renderMk(); } };
      document.getElementById("flmTgPause").onclick=function(){ if(!sel)return; sel.pause=!sel.pause; this.classList.toggle("on",sel.pause); renderMk(); };
      document.getElementById("flmTgSlow").onclick=function(){ if(!sel)return; sel.slow=!sel.slow; this.classList.toggle("on",sel.slow); document.getElementById("flmSlowSpd").style.display=sel.slow?"inline-block":"none"; renderMk(); };
      document.getElementById("flmSlowSpd").onchange=function(){ if(sel) sel.slowSpd=parseFloat(this.value); };
      document.getElementById("flmTArrow").onclick=function(){ tool=tool==="arrow"?null:"arrow"; this.classList.toggle("on",tool==="arrow"); document.getElementById("flmTCircle").classList.remove("on"); };
      document.getElementById("flmTCircle").onclick=function(){ tool=tool==="circle"?null:"circle"; this.classList.toggle("on",tool==="circle"); document.getElementById("flmTArrow").classList.remove("on"); };
      document.getElementById("flmClr").onclick=()=>{ if(sel){ sel.draws=[]; showOverlay(sel); renderMk(); } };
      document.getElementById("flmEdDel").onclick=()=>{ if(!sel)return; const i=markers.indexOf(sel); if(i>=0) markers.splice(i,1); closeEditor(); renderMk(); };
      document.getElementById("flmEdDone").onclick=()=>closeEditor();

      // drawing on the frame
      const ovPt=(evt)=>{ const pt=ov.createSVGPoint(); const s=evt.touches&&evt.touches[0]?evt.touches[0]:evt; pt.x=s.clientX; pt.y=s.clientY; const m=ov.getScreenCTM(); return m?pt.matrixTransform(m.inverse()):null; };
      const startDraw=(evt)=>{ if(!sel||!tool)return; evt.preventDefault(); const p=ovPt(evt); if(!p)return; drawing = tool==="arrow" ? {type:"arrow",color:drawColor,x1:p.x,y1:p.y,x2:p.x,y2:p.y} : {type:"circle",color:drawColor,cx:p.x,cy:p.y,r:4}; };
      const moveDraw=(evt)=>{ if(!drawing)return; evt.preventDefault(); const p=ovPt(evt); if(!p)return; if(drawing.type==="arrow"){ drawing.x2=p.x; drawing.y2=p.y; } else { drawing.r=Math.max(6,Math.hypot(p.x-drawing.cx,p.y-drawing.cy)); } showOverlay({draws:sel.draws.concat([drawing])}); };
      const endDraw=()=>{ if(!drawing)return; sel.draws.push(drawing); drawing=null; showOverlay(sel); renderMk(); };
      ov.addEventListener("mousedown",startDraw); ov.addEventListener("mousemove",moveDraw); window.addEventListener("mouseup",endDraw);
      ov.addEventListener("touchstart",startDraw,{passive:false}); ov.addEventListener("touchmove",moveDraw,{passive:false}); ov.addEventListener("touchend",endDraw);

      // assignment chips
      const ass=document.getElementById("flmAssign");
      const isTeam = work.assignedTo==="team";
      const selectedIds = Array.isArray(work.assignedTo) ? work.assignedTo.map(String) : [];
      const teamChip=document.createElement("span"); teamChip.className="chip"+(isTeam?" on":""); teamChip.textContent="Whole team"; ass.appendChild(teamChip);
      const pchips=[];
      players().forEach(p=>{
        const c=document.createElement("span"); c.className="chip"+((!isTeam && selectedIds.includes(String(p.id)))?" on":""); c.textContent=p.name; c.dataset.pid=String(p.id);
        c.onclick=()=>{ teamChip.classList.remove("on"); c.classList.toggle("on"); };
        ass.appendChild(c); pchips.push(c);
      });
      teamChip.onclick=()=>{ const on=!teamChip.classList.contains("on"); teamChip.classList.toggle("on",on); if(on) pchips.forEach(c=>c.classList.remove("on")); };

      document.getElementById("flmSaveBtn").onclick=async ()=>{
        let assignedTo;
        if(teamChip.classList.contains("on")) assignedTo="team";
        else assignedTo=pchips.filter(c=>c.classList.contains("on")).map(c=>c.dataset.pid);
        const msg=document.getElementById("flmSaveMsg"); msg.textContent="Saving…"; msg.style.color="var(--muted)";
        try{
          await updateVideo(work.docId, { title:work.title, type:work.type, markers, assignedTo });
          work.assignedTo=assignedTo;
          msg.style.color="var(--brand)";
          msg.textContent = assignedTo==="team" ? "Saved & shared with the team." :
            (assignedTo.length ? "Saved & sent." : "Saved. (Not sent to anyone yet.)");
        }catch(e){ msg.style.color="var(--down)"; msg.textContent="Couldn't save: "+(e.message||e); }
      };

      document.getElementById("flmDelVid").onclick=async ()=>{
        if(!confirm("Delete “"+(work.title||"this video")+"”? This removes it for everyone and can't be undone.")) return;
        const btn=document.getElementById("flmDelVid"); btn.disabled=true; btn.textContent="Deleting…";
        try{
          await deleteVideo(work.docId);
          stopLoop(); current=null; renderList();
        }catch(e){
          btn.disabled=false; btn.textContent="🗑 Delete video";
          const msg=document.getElementById("flmSaveMsg"); msg.style.color="var(--down)"; msg.textContent="Couldn't delete: "+(e.message||e);
        }
      };
    }

    // ----- transport -----
    function stopLoop(){ playing=false; if(raf) cancelAnimationFrame(raf); raf=null; }
    function loop(){
      if(!playing) return;
      if(!document.body.contains(stage)){ stopLoop(); return; }   // left the view
      const base=parseFloat(document.getElementById("flmSpd").value)||1;
      const prev=lastT; cur=media.getTime()||0;
      const sl=activeSlow(cur); if(media.setRate) media.setRate(sl?Math.min(base,sl):base);
      const hit=findPause(prev,cur);
      if(hit){ media.pause(); seek(hit.t); pauseV(); sel=hit; if(coach) openEditor(hit); else showNote(hit,true); return; }
      paintUI(cur); lastT=cur; updateFlash(cur);
      raf=requestAnimationFrame(loop);
    }
    function playV(){
      if(!ready) return;
      if(getDur() && cur>=getDur()-0.05) seek(0);
      playing=true; lastT=cur; hideNote();
      if(media.setRate) media.setRate(parseFloat(document.getElementById("flmSpd").value)||1);
      media.play();
      document.getElementById("flmPlay").textContent="❚❚ Pause";
      if(!coach && !recordedWatch){
        recordedWatch = true;
        const pid = String(state.user.id);
        const existing = (work.watchedBy && work.watchedBy[pid]) || {};
        const payload = { ts: Date.now(), count: (existing.count||0)+1, name: state.name };
        work.watchedBy = work.watchedBy || {}; work.watchedBy[pid] = payload;
        try{ markVideoWatched(work.docId, pid, payload); }catch(e){}
      }
      raf=requestAnimationFrame(loop);
    }
    function pauseV(){ playing=false; if(raf) cancelAnimationFrame(raf); raf=null; if(media&&media.pause) media.pause(); document.getElementById("flmPlay").textContent="▶ Play"; document.getElementById("flmSlow").style.display="none"; }
    document.getElementById("flmPlay").onclick=()=>{ playing?pauseV():playV(); };
    document.getElementById("flmResume").onclick=()=>{ document.getElementById("flmNote").style.display="none"; playV(); };
    document.getElementById("flmScrub").oninput=function(){ seek(this.value/1000*(getDur()||0), true); };

    // ----- create the media (YouTube or HTML5) -----
    const mount=document.getElementById("mediaMount");
    function onReady(){
      ready=true; dur=getDur();
      const l=document.getElementById("flmLoad"); if(l) l.style.display="none";
      paintUI(0); renderMk();
    }
    const src=work.source;
    if(src && src.kind==="youtube"){
      const holder=document.createElement("div"); holder.id="ytmount"; holder.style.cssText="width:100%;height:100%;"; mount.appendChild(holder);
      ytLoad(()=>{
        if(!document.getElementById("ytmount")) return;
        media = (function(){
          let p=null;
          const api={ getTime:()=>p&&p.getCurrentTime?p.getCurrentTime():0, getDur:()=>p&&p.getDuration?p.getDuration():0, seek:t=>{ if(p&&p.seekTo) p.seekTo(t,true); }, play:()=>{ if(p) p.playVideo(); }, pause:()=>{ if(p) p.pauseVideo(); }, setRate:r=>{ try{ if(p) p.setPlaybackRate(r); }catch(e){} } };
          p=new YT.Player("ytmount",{ videoId:src.id, playerVars:{ controls:0, modestbranding:1, rel:0, playsinline:1, disablekb:1, fs:0, iv_load_policy:3 }, events:{ onReady:()=>onReady() } });
          return api;
        })();
      });
    } else if(src && (src.kind==="url" || src.kind==="r2")){
      const mountVideo = (url)=>{
        if(!url){ const l=document.getElementById("flmLoad"); if(l){ l.textContent="Couldn't load this video."; l.style.color="var(--down)"; } return; }
        const v=document.createElement("video"); v.playsInline=true; v.setAttribute("webkit-playsinline",""); v.preload="metadata"; v.src=url;
        v.style.cssText="width:100%;height:100%;object-fit:contain;background:#000;"; mount.appendChild(v);
        media={ getTime:()=>v.currentTime||0, getDur:()=>(v.duration&&isFinite(v.duration))?v.duration:0, seek:t=>{ try{ v.currentTime=t; }catch(e){} }, play:()=>v.play(), pause:()=>v.pause(), setRate:r=>{ try{ v.playbackRate=r; }catch(e){} } };
        v.addEventListener("loadedmetadata", onReady);
        v.addEventListener("ended", ()=>pauseV());
        v.addEventListener("error", ()=>{ const l=document.getElementById("flmLoad"); if(l){ l.textContent="Couldn't load this video."; l.style.color="var(--down)"; } });
      };
      if(src.kind==="url"){ mountVideo(src.url); }
      else { getPlaybackUrl(src).then(u=>{ if(document.body.contains(mount)) mountVideo(u); }).catch(()=>mountVideo(null)); }
    } else {
      const l=document.getElementById("flmLoad"); if(l){ l.textContent="No valid video link on this clip."; }
    }

    renderMk();
  }

  // ---------- boot ----------
  view.innerHTML = `<div class="muted">Loading film room…</div>`;
  state.unsub.push(listenVideos((arr, err)=>{
    if(err){ view.innerHTML = `<div class="err">Couldn't load videos: ${esc(err.message)}</div>`; return; }
    videos = arr;
    if(!current) renderList();   // don't clobber an open editor
  }));
}

// Player's "My Videos" page — same film-room, but lists only their own uploads
// and lets them upload new clips for the coach to analyse.
export function renderMyVideos(){ return renderMatches({ mode: "myuploads" }); }

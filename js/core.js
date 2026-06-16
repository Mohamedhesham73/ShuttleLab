import { TESTS } from "./config.js";

// Shared app state. _render is set by app.js to the main render function.
export const state = {
  user:null, uid:null, role:"player", name:"", view:"dash",
  targetId:null, targetName:"",
  // The team roster, loaded from Firestore after login (see app.js).
  // Shape per entry: { id, name, role, photo } — NO emails ship to the browser.
  roster:[],
  unsub:[], _render:null
};

export const r1 = (n)=>Math.round(n*10)/10;
export const testById = (id)=>TESTS.find(t=>t.id===id);
export const esc = (s)=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
export const fmtDate = (iso)=>{ try{ return new Date(iso+"T00:00:00").toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"}); }catch(e){ return iso; } };

export function bestAvg(vals, higher){
  const v = vals.filter(x=>x!=null && !isNaN(x));
  if(!v.length) return null;
  const best = higher ? Math.max(...v) : Math.min(...v);
  const avg = r1(v.reduce((a,b)=>a+b,0)/v.length);
  return { vals:v, best, avg };
}

export function avatar(name, photo, size){
  size = size || 34;
  const init = esc(((name||"?").trim()[0]||"?")).toUpperCase();
  return `<span style="position:relative;display:inline-flex;width:${size}px;height:${size}px;border-radius:50%;overflow:hidden;flex:0 0 auto;background:var(--panel2);border:1px solid var(--line);align-items:center;justify-content:center;">
    <span class="disp" style="color:var(--brand);font-size:${Math.round(size*0.45)}px;">${init}</span>
    ${photo?`<img src="${esc(photo)}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;" onerror="this.remove()">`:""}
  </span>`;
}

// Small transient message, bottom-centre. kind "err" = red edge, else brand.
export function toast(msg, kind){
  let el = document.getElementById("__toast");
  if(!el){
    el = document.createElement("div"); el.id = "__toast";
    el.style.cssText = "position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:9999;max-width:90%;padding:11px 16px;border-radius:12px;font-size:13px;color:#fff;background:rgba(20,24,20,.96);border:1px solid var(--line);box-shadow:0 6px 24px rgba(0,0,0,.45);opacity:0;transition:opacity .25s;pointer-events:none;text-align:center;";
    document.body.appendChild(el);
  }
  el.style.borderColor = kind==="err" ? "var(--down)" : "var(--brand)";
  el.textContent = msg; el.style.opacity = "1";
  clearTimeout(el._t); el._t = setTimeout(()=>{ el.style.opacity = "0"; }, 2800);
}

// Make a textarea grow with its content (Twitter-style) instead of showing a
// drag-to-resize handle. Pass an optional onInput callback (e.g. a char counter).
export function autoGrow(el, onInput){
  if(!el) return;
  el.style.resize = "none";
  el.style.overflow = "hidden";
  const fit = ()=>{ el.style.height = "auto"; el.style.height = Math.max(el.scrollHeight, 40) + "px"; };
  el.addEventListener("input", ()=>{ fit(); if(onInput) onInput(el); });
  requestAnimationFrame(fit);   // size correctly once laid out
  return fit;
}

// Detach all live Firestore listeners (called on every view change).
export function clearUnsub(){
  state.unsub.forEach(u=>{ try{ u(); }catch(e){} });
  state.unsub = [];
}

// Change view (and optionally which player we're looking at), then re-render.
export function navigate(view, opts={}){
  state.view = view;
  if(opts.targetId !== undefined){ state.targetId = String(opts.targetId); state.targetName = opts.targetName; }
  if(state._render) state._render();
}

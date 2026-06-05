import { TESTS } from "./config.js";

// Shared app state. _render is set by app.js to the main render function.
export const state = {
  user:null, role:"player", name:"", view:"dash",
  targetId:null, targetName:"", unsub:[], _render:null
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

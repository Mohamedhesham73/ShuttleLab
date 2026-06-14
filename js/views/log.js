import { state, esc, bestAvg, navigate } from "../core.js";
import { TESTS } from "../config.js";
import { saveMeasurement } from "../data.js";

export function renderLog(){
  const view = document.getElementById("view");
  const today = new Date().toISOString().slice(0,10);
  const roster = state.roster.filter(u=>u.role!=="coach");

  const inputs = TESTS.map(t=>{
    if(t.multi){
      return `<div style="margin-bottom:14px;"><label>${t.name} (${t.unit}) — attempts, best kept automatically</label>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          ${[1,2,3].map(i=>`<input type="number" step="any" inputmode="decimal" placeholder="${i}" data-test="${t.id}" class="att" style="flex:1;min-width:70px;">`).join("")}
        </div></div>`;
    }
    return `<div style="margin-bottom:14px;"><label>${t.name} (${t.unit})</label><input type="number" step="any" inputmode="decimal" placeholder="—" data-single="${t.id}">${t.id==="beep"?`<button class="btn" id="beepRun" type="button" style="margin-top:8px;padding:7px 12px;font-size:12px;">🔊 Run the beep test</button>`:""}</div>`;
  }).join("");

  const opts = (state.role==="coach")
    ? roster.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join("")
    : `<option value="${state.user.id}">${esc(state.name)}</option>`;

  view.innerHTML = `<div class="card fade" style="padding:22px;max-width:620px;">
    <div class="disp" style="font-size:18px;margin-bottom:16px;">New test session</div>
    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr));margin-bottom:16px;">
      <div><label>Player</label><select id="logPlayer" ${state.role==="coach"?"":"disabled"}>${opts}</select></div>
      <div><label>Date</label><input type="date" id="logDate" value="${today}"></div>
    </div>
    ${inputs}
    <div id="logErr" class="err"></div>
    <button class="btn pri" id="saveBtn" style="width:100%;margin-top:8px;">Save session</button>
  </div>`;

  // ---- built-in multistage (bleep) test player ----
  const beepBtn = document.getElementById("beepRun");
  if(beepBtn) beepBtn.onclick = ()=>{
    const SH=[7,8,8,9,9,10,10,11,11,11,12,12,13,13,13,14,14,15,15,16,16];  // shuttles per level, L1..L21
    let ctx; try{ ctx=new (window.AudioContext||window.webkitAudioContext)(); }catch(e){}
    let level=0, shuttle=0, running=true, started=false, timer=null, count=5;
    const wrap=document.createElement("div");
    wrap.style.cssText="position:fixed;inset:0;z-index:9998;background:rgba(6,8,7,.95);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:24px;text-align:center;";
    wrap.innerHTML=`<div class="disp" style="font-size:14px;letter-spacing:.12em;color:var(--muted);">MULTISTAGE BEEP TEST</div>
      <div id="bpLevel" class="num" style="font-size:64px;font-weight:800;color:var(--brand);line-height:1;">—</div>
      <div id="bpInfo" class="muted" style="font-size:15px;">Get ready…</div>
      <div class="muted" style="font-size:12px;max-width:300px;line-height:1.5;">Run the 20 m and be at the line on every beep. When you can't keep up, tap stop — your level is saved into the form.</div>
      <button id="bpStop" class="btn pri" type="button" style="margin-top:8px;padding:12px 28px;font-size:16px;">Stop & save level</button>`;
    document.getElementById("view").appendChild(wrap);
    const gone=()=>!document.body.contains(wrap);
    const beep=(f,d)=>{ if(!ctx)return; const o=ctx.createOscillator(),g=ctx.createGain(),t=ctx.currentTime; o.type="sine"; o.frequency.value=f; g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(0.4,t+0.01); g.gain.exponentialRampToValueAtTime(0.0001,t+(d||0.18)); o.connect(g).connect(ctx.destination); o.start(t); o.stop(t+(d||0.2)); };
    const show=()=>{ const el=document.getElementById("bpLevel"), inf=document.getElementById("bpInfo"); if(el) el.textContent=level+1; if(inf) inf.textContent="Shuttle "+shuttle+" / "+SH[level]+" · "+(8+level*0.5).toFixed(1)+" km/h"; };
    const nextShuttle=()=>{
      if(!running) return; if(gone()){ stop(true); return; }
      shuttle++;
      if(shuttle>SH[level]){ level++; shuttle=1; if(level>=SH.length){ return stop(); } beep(1320,0.22); setTimeout(()=>beep(1320,0.22),150); }
      else beep(900,0.16);
      show();
      timer=setTimeout(nextShuttle, (72/(8+level*0.5))*1000);
    };
    const tick=()=>{
      if(!running) return; if(gone()){ stop(true); return; }
      if(count>0){ const inf=document.getElementById("bpInfo"); if(inf) inf.textContent="Starting in "+count+"…"; beep(700,0.12); count--; timer=setTimeout(tick,1000); }
      else { started=true; const inf=document.getElementById("bpInfo"); if(inf) inf.textContent="GO!"; beep(1100,0.3); level=0; shuttle=0; show(); timer=setTimeout(nextShuttle,(72/8)*1000); }
    };
    function stop(silent){
      running=false; if(timer) clearTimeout(timer); timer=null;
      if(!silent && started){ const inp=document.querySelector('[data-single="beep"]'); if(inp) inp.value=level+1; }
      try{ if(ctx) ctx.close(); }catch(e){}
      wrap.remove();
    }
    wrap.querySelector("#bpStop").onclick=()=>stop();
    tick();
  };

  document.getElementById("saveBtn").onclick = async ()=>{
    const errEl = document.getElementById("logErr"); errEl.textContent = "";
    const sel = document.getElementById("logPlayer");
    const playerId = sel.value;
    const playerName = sel.selectedOptions[0].textContent;
    const dateISO = document.getElementById("logDate").value;
    if(!dateISO){ errEl.textContent = "Pick a date."; return; }
    const results = {};
    TESTS.forEach(t=>{
      if(t.multi){
        const vals = [...document.querySelectorAll(`.att[data-test="${t.id}"]`)].map(i=>parseFloat(i.value)).filter(v=>!isNaN(v));
        const ba = bestAvg(vals, t.higher); if(ba) results[t.id] = ba;
      } else {
        const v = parseFloat(document.querySelector(`[data-single="${t.id}"]`).value);
        if(!isNaN(v)) results[t.id] = { vals:[v], best:v, avg:v };
      }
    });
    if(!Object.keys(results).length){ errEl.textContent = "Enter at least one result."; return; }
    document.getElementById("saveBtn").textContent = "Saving…";
    try{
      await saveMeasurement({ uid:String(playerId), name:playerName, dateISO, ts:Date.now(), results });
      navigate("dash", { targetId:String(playerId), targetName:playerName });
    }catch(e){
      document.getElementById("saveBtn").textContent = "Save session";
      errEl.textContent = "Couldn't save: " + (e.message||e);
    }
  };
}

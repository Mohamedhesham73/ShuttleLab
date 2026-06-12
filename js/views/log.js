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
    return `<div style="margin-bottom:14px;"><label>${t.name} (${t.unit})</label><input type="number" step="any" inputmode="decimal" placeholder="—" data-single="${t.id}"></div>`;
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

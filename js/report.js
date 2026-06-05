import { TESTS } from "./config.js";
import { fmtDate } from "./core.js";

// Opens a clean, printable one-page report. The browser's print dialog
// lets you "Save as PDF" — that's the real paper.
export function openReport(name, sessions, goals){
  goals = goals || {};
  if(!sessions.length){ alert("No test sessions yet for "+name+"."); return; }
  const latest = sessions[sessions.length-1];
  const prev   = sessions.length>1 ? sessions[sessions.length-2] : null;
  const base   = location.origin;

  const rows = TESTS.map(t=>{
    const res = latest.results && latest.results[t.id];
    if(!res) return "";
    const now = res.best;
    let change = "—", color = "#6b6b63";
    if(prev && prev.results && prev.results[t.id]){
      const was = prev.results[t.id].best;
      if(was !== now){
        const better = t.higher ? now>was : now<was;
        const d = Math.round((now-was)*100)/100;
        change = (d>0?"+":"") + d;
        color = better ? "#3B6D11" : "#A32D2D";
      }
    }
    return `<tr style="border-bottom:.5px solid #e3e1d8;">
      <td style="padding:6px 0;">${t.name}</td>
      <td>${prev && prev.results && prev.results[t.id] ? prev.results[t.id].best : "—"}</td>
      <td>${now} ${t.unit}</td>
      <td style="text-align:right;color:${color};">${change}</td></tr>`;
  }).join("");

  const goalRows = TESTS.filter(t=>goals[t.id]!=null).map(t=>{
    const res = latest.results && latest.results[t.id];
    const cur = res ? res.best : null;
    return `<tr style="border-bottom:.5px solid #e3e1d8;"><td style="padding:5px 0;">${t.name}</td>
      <td>${cur==null?"—":cur}</td><td>${goals[t.id]} ${t.unit}</td></tr>`;
  }).join("");

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${name} — ShuttleLab report</title>
  <style>
    body{font-family:Arial,Helvetica,sans-serif;color:#23241f;max-width:680px;margin:24px auto;padding:0 24px;line-height:1.6;}
    h1{font-size:18px;margin:0;} table{width:100%;border-collapse:collapse;font-size:13px;}
    th{text-align:left;color:#6b6b63;font-weight:600;border-bottom:1px solid #d8d6cc;padding:6px 0;}
    .muted{color:#6b6b63;} .head{display:flex;justify-content:space-between;align-items:flex-start;}
    .rule{border-top:2px solid #23241f;margin:10px 0 14px;}
    img{height:34px;} .sign{display:flex;gap:40px;margin-top:34px;}
    .sign div{flex:1;border-top:1px solid #23241f;padding-top:5px;font-size:12px;color:#6b6b63;}
    @media print{ button{display:none;} body{margin:0;} }
  </style></head><body>
    <div class="head">
      <img src="${base}/logo.png" alt="ShuttleLab" onerror="this.style.display='none'">
      <div style="text-align:right;"><h1>Progress report</h1><div class="muted" style="font-size:12px;">Generated ${fmtDate(new Date().toISOString().slice(0,10))}</div></div>
    </div>
    <div class="rule"></div>
    <p style="margin:0 0 14px;"><b>${name}</b> &nbsp;·&nbsp; <span class="muted">Last test ${fmtDate(latest.dateISO)} · ${sessions.length} session(s)</span></p>
    <h3 style="font-size:14px;margin:0 0 6px;">Test results</h3>
    <table><thead><tr><th>Metric</th><th>Last</th><th>Now</th><th style="text-align:right;">Change</th></tr></thead><tbody>${rows}</tbody></table>
    ${goalRows?`<h3 style="font-size:14px;margin:22px 0 6px;">Goals</h3>
      <table><thead><tr><th>Metric</th><th>Current</th><th>Target</th></tr></thead><tbody>${goalRows}</tbody></table>`:""}
    <div class="sign"><div>Player signature</div><div>Coach signature</div></div>
    <button onclick="window.print()" style="margin-top:26px;padding:10px 18px;border:0;background:#9bd534;border-radius:8px;font-weight:bold;cursor:pointer;">Print / Save as PDF</button>
  </body></html>`;

  const w = window.open("", "_blank");
  if(!w){ alert("Please allow pop-ups to open the report."); return; }
  w.document.open(); w.document.write(html); w.document.close();
}

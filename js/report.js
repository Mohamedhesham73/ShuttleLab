import { TESTS } from "./config.js";
import { fmtDate } from "./core.js";

// Opens a clean, printable report. The browser's print dialog lets you
// "Save as PDF" — that's the real paper. Now includes personal bests and
// the trend charts (rendered to images so they print reliably).
export function openReport(name, sessions, goals){
  goals = goals || {};
  if(!sessions.length){ alert("No test sessions yet for "+name+"."); return; }
  const latest = sessions[sessions.length-1];
  const prev   = sessions.length>1 ? sessions[sessions.length-2] : null;
  const base   = location.origin;

  // ---- all-time personal best per test ----
  const pbInfo = (t)=>{
    const vals = sessions.filter(s=>s.results && s.results[t.id] && s.results[t.id].best!=null)
      .map(s=>({ v:s.results[t.id].best, d:s.dateISO }));
    if(!vals.length) return null;
    let pb = vals[0];
    vals.forEach(x=>{ if(t.higher ? x.v>pb.v : x.v<pb.v) pb = x; });
    const first = vals[0].v;
    let imp = null;
    if(first && pb.v!=null) imp = Math.round((t.higher ? (pb.v-first)/Math.abs(first) : (first-pb.v)/Math.abs(first))*1000)/10;
    return { best:pb.v, date:pb.d, improvePct:imp };
  };

  // ---- render one test's trend chart to a PNG data-URL ----
  const chartImage = (t)=>{
    if(!window.Chart) return null;
    const ss = sessions.filter(s=>s.results && s.results[t.id] && s.results[t.id].best!=null);
    if(!ss.length) return null;
    const labels = ss.map(s=>fmtDate(s.dateISO));
    const ys = ss.map(s=>s.results[t.id].best);
    const p = pbInfo(t); const pbVal = p ? p.best : null;
    const cv = document.createElement("canvas");
    cv.width = 900; cv.height = 300;
    cv.style.cssText = "position:absolute;left:-99999px;top:0;width:900px;height:300px;";
    document.body.appendChild(cv);
    const pointBg = ys.map(y=>(pbVal!=null && y===pbVal) ? "#c79a00" : "#5f9e16");
    const pointR  = ys.map(y=>(pbVal!=null && y===pbVal) ? 5 : 3);
    const datasets = [{ label:"Result", data:ys, borderColor:"#5f9e16", backgroundColor:"rgba(95,158,22,.12)", borderWidth:2.5, fill:true, tension:.35, pointRadius:pointR, pointBackgroundColor:pointBg, pointBorderColor:pointBg }];
    if(pbVal!=null && ys.length>1){
      datasets.push({ label:"Personal best", data:ys.map(()=>pbVal), borderColor:"#c79a00", borderWidth:1.5, borderDash:[6,6], pointRadius:0, fill:false, tension:0 });
    }
    let img = null;
    try{
      const ch = new window.Chart(cv, {
        type:"line",
        data:{ labels, datasets },
        options:{ responsive:false, animation:false, devicePixelRatio:2,
          plugins:{
            legend:{ display: pbVal!=null && ys.length>1, labels:{ color:"#6b6b63", boxWidth:12, font:{size:12} } },
            title:{ display:true, text: t.name + " — " + (t.higher?"higher is better":"lower is better") + (pbVal!=null?(" · PB "+pbVal+t.unit):""), color:"#23241f", font:{size:14, weight:"bold"} } },
          scales:{ x:{ grid:{color:"#e7e5dc"}, ticks:{color:"#6b6b63"} }, y:{ grid:{color:"#e7e5dc"}, ticks:{color:"#6b6b63"} } } }
      });
      img = ch.toBase64Image("image/png", 1);
      ch.destroy();
    }catch(e){ img = null; }
    document.body.removeChild(cv);
    return img;
  };

  // ---- result rows (last vs now) ----
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

  // ---- personal best rows ----
  const pbRows = TESTS.map(t=>{
    const p = pbInfo(t);
    if(!p) return "";
    const imp = (p.improvePct!=null && p.improvePct>0.5) ? `<span style="color:#3B6D11;">+${p.improvePct}%</span>` : "—";
    return `<tr style="border-bottom:.5px solid #e3e1d8;"><td style="padding:5px 0;">${t.name}</td>
      <td><b>${p.best} ${t.unit}</b></td><td>${fmtDate(p.date)}</td><td style="text-align:right;">${imp}</td></tr>`;
  }).join("");

  // ---- goal rows ----
  const goalRows = TESTS.filter(t=>goals[t.id]!=null).map(t=>{
    const res = latest.results && latest.results[t.id];
    const cur = res ? res.best : null;
    return `<tr style="border-bottom:.5px solid #e3e1d8;"><td style="padding:5px 0;">${t.name}</td>
      <td>${cur==null?"—":cur}</td><td>${goals[t.id]} ${t.unit}</td></tr>`;
  }).join("");

  // ---- charts (images) ----
  const charts = TESTS.map(t=>{
    const img = chartImage(t);
    return img ? `<div class="chart"><img src="${img}" alt="${t.name} trend"></div>` : "";
  }).join("");

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${name} — ShuttleLab report</title>
  <style>
    body{font-family:Arial,Helvetica,sans-serif;color:#23241f;max-width:720px;margin:24px auto;padding:0 24px;line-height:1.6;}
    h1{font-size:18px;margin:0;} table{width:100%;border-collapse:collapse;font-size:13px;}
    th{text-align:left;color:#6b6b63;font-weight:600;border-bottom:1px solid #d8d6cc;padding:6px 0;}
    .muted{color:#6b6b63;} .head{display:flex;justify-content:space-between;align-items:flex-start;}
    .rule{border-top:2px solid #23241f;margin:10px 0 14px;}
    .logo{height:34px;}
    .chart{page-break-inside:avoid;margin-bottom:14px;}
    .chart img{width:100%;height:auto;border:.5px solid #e3e1d8;border-radius:6px;}
    .sign{display:flex;gap:40px;margin-top:34px;}
    .sign div{flex:1;border-top:1px solid #23241f;padding-top:5px;font-size:12px;color:#6b6b63;}
    h3{font-size:14px;margin:22px 0 6px;}
    @media print{ button{display:none;} body{margin:0;} }
  </style></head><body>
    <div class="head">
      <img class="logo" src="${base}/logo.png" alt="ShuttleLab" onerror="this.style.display='none'">
      <div style="text-align:right;"><h1>Progress report</h1><div class="muted" style="font-size:12px;">Generated ${fmtDate(new Date().toISOString().slice(0,10))}</div></div>
    </div>
    <div class="rule"></div>
    <p style="margin:0 0 14px;"><b>${name}</b> &nbsp;·&nbsp; <span class="muted">Last test ${fmtDate(latest.dateISO)} · ${sessions.length} session(s)</span></p>

    <h3 style="margin-top:0;">Personal bests</h3>
    <table><thead><tr><th>Metric</th><th>Best</th><th>Date set</th><th style="text-align:right;">From first</th></tr></thead><tbody>${pbRows}</tbody></table>

    <h3>Test results — latest</h3>
    <table><thead><tr><th>Metric</th><th>Last</th><th>Now</th><th style="text-align:right;">Change</th></tr></thead><tbody>${rows}</tbody></table>

    ${charts?`<h3>Progress charts</h3>${charts}`:""}

    ${goalRows?`<h3>Goals</h3>
      <table><thead><tr><th>Metric</th><th>Current</th><th>Target</th></tr></thead><tbody>${goalRows}</tbody></table>`:""}

    <div class="sign"><div>Player signature</div><div>Coach signature</div></div>
    <button onclick="window.print()" style="margin-top:26px;padding:10px 18px;border:0;background:#9bd534;border-radius:8px;font-weight:bold;cursor:pointer;">Print / Save as PDF</button>
  </body></html>`;

  const w = window.open("", "_blank");
  if(!w){ alert("Please allow pop-ups to open the report."); return; }
  w.document.open(); w.document.write(html); w.document.close();
}

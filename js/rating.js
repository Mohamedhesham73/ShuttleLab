// =============================================================
//  RATING — turns the six fitness tests into a single "Overall"
//  athlete rating (20–99) + per-stat ratings, FIFA-card style.
//  Bands are sensible starting points; tune in BANDS as you learn
//  your squad's real ranges.
// =============================================================
import { TESTS } from "./config.js";

const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
const tById = id => TESTS.find(t=>t.id===id);

// worst -> 30-ish rating, best -> 99-ish. For "lower is better" tests,
// worst is the BIGGER (slower) number.
// Standard tests anchored to published norms (weak→~40, elite→~99):
//  beep test: teen avg 7-9, team-sport 12-14, elite endurance 15+ (topendsports)
//  vertical jump: teen avg ~50cm, excellent >71cm
//  standing long jump: teen mid 150-196cm, excellent adult >250cm
// The three court tests below are the coach's CUSTOM drills — no public norms;
// these worst/best are placeholders pending the coach's real times.
export const BANDS = {
  beep:    { worst:5,   best:14,  label:"Endurance",   icon:"🫁" },
  vjump:   { worst:28,  best:65,  label:"Power",       icon:"💥" },
  ljump:   { worst:160, best:255, label:"Drive",       icon:"🚀" },
  inout:   { worst:18,  best:9,   label:"Agility",     icon:"⚡" },
  fbcourt: { worst:16,  best:8,   label:"Court speed", icon:"🏃" },
  fhbh:    { worst:20,  best:10,  label:"Reflexes",    icon:"🛡️" }
};

export function statRating(id, val){
  const cfg = BANDS[id], t = tById(id);
  if(!cfg || !t || val==null || isNaN(val)) return null;
  const frac = t.higher ? (val-cfg.worst)/(cfg.best-cfg.worst)
                        : (cfg.worst-val)/(cfg.worst-cfg.best);
  return Math.round(clamp(30 + frac*69, 20, 99));
}

// all-time best per test across a list of measurement docs
export function bestsFromSessions(sessions){
  const best = {};
  (sessions||[]).forEach(s=>{
    const r = s.results || {};
    TESTS.forEach(t=>{
      const v = r[t.id] && r[t.id].best;
      if(v==null) return;
      if(best[t.id]==null || (t.higher ? v>best[t.id] : v<best[t.id])) best[t.id] = v;
    });
  });
  return best;
}

export function cardFromBests(best){
  const stats = [];
  TESTS.forEach(t=>{
    const cfg = BANDS[t.id]; if(!cfg) return;
    const v = best[t.id];
    stats.push({ id:t.id, label:cfg.label, icon:cfg.icon, rating:statRating(t.id, v), val:v, unit:t.unit, higher:t.higher });
  });
  const rated = stats.filter(s=>s.rating!=null);
  const overall = rated.length ? Math.round(rated.reduce((a,s)=>a+s.rating,0)/rated.length) : null;
  return { overall, tier:tierOf(overall), stats };
}

export function cardFromSessions(sessions){ return cardFromBests(bestsFromSessions(sessions)); }

// overall computed from ONE session's results (for trend / attention arrows)
export function overallOfSession(results){
  const rated = [];
  TESTS.forEach(t=>{ const v = results && results[t.id] && results[t.id].best; const r = statRating(t.id, v); if(r!=null) rated.push(r); });
  return rated.length ? Math.round(rated.reduce((a,b)=>a+b,0)/rated.length) : null;
}

export function tierOf(overall){
  if(overall==null) return "—";
  return overall>=85 ? "Elite" : overall>=75 ? "Gold" : overall>=65 ? "Silver" : "Bronze";
}
export function tierColor(tier){
  return tier==="Elite" ? "#a4dd2b" : tier==="Gold" ? "#ffd34d" : tier==="Silver" ? "#cfd6dd" : tier==="Bronze" ? "#e0a973" : "#8c9882";
}
export function ratingColor(r){
  if(r==null) return "#8c9882";
  return r>=85 ? "#ffd34d" : r>=70 ? "#a4dd2b" : r>=50 ? "#eaf1e2" : "#ff8a8a";
}

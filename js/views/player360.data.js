// Pure, import-free data derivation for the Player 360 view.
// Kept separate from rendering so it can be unit-tested under node:test.

// Map the app data-key id ("1".."4") to the member's Firebase auth uid.
export function uidForId(roster, id){
  const m = (roster || []).find(x => String(x.id) === String(id));
  return m ? m.uid : null;
}

// The mental coach / fitness trainer assigned to this player (by auth uid).
export function assignedStaff(roster, playerUid){
  const out = { mental:null, fitness:null };
  (roster || []).forEach(m => {
    const a = (m.assigned || []).map(String);
    if(!a.includes(String(playerUid))) return;
    if(m.role === "mental_coach") out.mental = m;
    else if(m.role === "fitness_trainer") out.fitness = m;
  });
  return out;
}

// Count training docs whose ts is on/after a cutoff (ms epoch).
export function trainingCountSince(training, sinceTs){
  return (training || []).filter(t => (t.ts || 0) >= sinceTs).length;
}

// 1-based ladder position for a player id, or null if no ladder / not present.
export function ladderRank(ladder, id){
  const order = ladder && Array.isArray(ladder.order) ? ladder.order.map(String) : null;
  if(!order) return null;
  const i = order.indexOf(String(id));
  return i < 0 ? null : i + 1;
}

// Drills/videos assigned to this player id: assignedTo === "team" or array contains id.
export function assignedToPlayer(items, id){
  return (items || []).filter(it => {
    const a = it.assignedTo;
    return a === "team" || (Array.isArray(a) && a.map(String).includes(String(id)));
  });
}

// Item with the largest numeric key (default "ts"), or null when empty.
export function newest(arr, key){
  key = key || "ts";
  let best = null;
  (arr || []).forEach(x => { if(best === null || (x[key] || 0) > (best[key] || 0)) best = x; });
  return best;
}

// Max ts among messages whose channelId is in the given list, or null.
export function lastTsForChannels(messages, channelIds){
  const set = new Set((channelIds || []).map(String));
  let max = null;
  (messages || []).forEach(m => {
    if(set.has(String(m.channelId)) && (m.ts || 0) > (max || 0)) max = m.ts;
  });
  return max;
}

// Channels belonging to a player (by auth uid).
export function playerChannels(channels, playerUid){
  return (channels || []).filter(c => String(c.playerUid) === String(playerUid));
}

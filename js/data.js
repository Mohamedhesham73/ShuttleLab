import { db, storage, auth } from "./firebase.js";
import { collection, addDoc, doc, setDoc, deleteDoc, onSnapshot, query, where, getDocs, getDoc }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { ref, uploadBytesResumable, getDownloadURL }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

// ---- Team roster (members) ----
// The roster lives in Firestore so names/roles never ship inside the site's code.
// Each doc's ID is the person's Firebase Auth UID; fields: { id, name, role, photo }.
export async function loadMembers(){
  const snap = await getDocs(collection(db,"members"));
  const a = []; snap.forEach(d=>a.push({ uid:d.id, ...d.data() }));
  return a;
}
// Read ONE member doc (everyone may read their own — used so support staff,
// who cannot list the whole roster, can still load their own account).
export async function getMember(uid){
  const d = await getDoc(doc(db,"members",String(uid)));
  return d.exists() ? { uid:d.id, ...d.data() } : null;
}

// ---- Measurements ----
export function listenMeasurements(uid, cb){
  return onSnapshot(query(collection(db,"measurements"), where("uid","==",String(uid))),
    s=>{ const a=[]; s.forEach(d=>a.push(d.data())); a.sort((x,y)=>(x.dateISO||"").localeCompare(y.dateISO||"")); cb(a); },
    err=>cb(null, err));
}
export function listenAllMeasurements(cb){
  return onSnapshot(collection(db,"measurements"),
    s=>{ const a=[]; s.forEach(d=>a.push(d.data())); cb(a); },
    err=>cb(null, err));
}
export function saveMeasurement(data){ return addDoc(collection(db,"measurements"), data); }

// ---- Training (per player) ----
export function listenTraining(uid, cb){
  return onSnapshot(query(collection(db,"training"), where("uid","==",String(uid))),
    s=>{ const a=[]; s.forEach(d=>a.push(d.data())); a.sort((x,y)=>(y.ts||0)-(x.ts||0)); cb(a); },
    err=>cb(null, err));
}
export function postTraining(data){ return addDoc(collection(db,"training"), data); }

// ---- Season plan (one doc per player): { target, blocks[], tournaments[] } ----
export function listenPlan(uid, cb){
  return onSnapshot(doc(db,"plans",String(uid)),
    d=>cb(d.exists()? d.data() : {}),
    err=>cb(null, err));
}
export async function getPlan(uid){
  const d = await getDoc(doc(db,"plans",String(uid)));
  return d.exists()? d.data() : {};
}
export function savePlan(uid, data){ return setDoc(doc(db,"plans",String(uid)), data, { merge:true }); }

// Shared tournament schedule (coach-editable). Lives in a special plans doc so
// it reuses the plans collection's rule. cb(list|null) — null = use code default.
export function listenSchedule(cb){
  return onSnapshot(doc(db,"plans","__schedule"),
    d=>cb(d.exists() && Array.isArray(d.data().list) ? d.data().list : null),
    err=>cb(null, err));
}
export function saveSchedule(list){ return setDoc(doc(db,"plans","__schedule"), { list }, { merge:true }); }

// Mind Room "gift jar": the coach's own encouragements, mixed into what players
// receive. Shared doc, reuses the plans rule. cb(list of strings).
export function listenGiftJar(cb){
  return onSnapshot(doc(db,"plans","__giftjar"),
    d=>cb(d.exists() && Array.isArray(d.data().list) ? d.data().list : []),
    err=>cb([], err));
}
export function saveGiftJar(list){ return setDoc(doc(db,"plans","__giftjar"), { list }, { merge:true }); }

// Challenge ladder: shared order + one pending challenge. Reuses the plans rule.
export function listenLadder(cb){
  return onSnapshot(doc(db,"plans","__ladder"),
    d=>cb(d.exists()? d.data() : null),
    err=>cb(null, err));
}
export function saveLadder(data){ return setDoc(doc(db,"plans","__ladder"), data, { merge:true }); }

// ---- Private per-user store (Mind Room mood "stars"). Owner-only by rules. ----
export async function getPrivate(uid){
  const d = await getDoc(doc(db,"private",String(uid)));
  return d.exists() ? d.data() : {};
}
export function savePrivate(uid, data){ return setDoc(doc(db,"private",String(uid)), data, { merge:true }); }

// ---- Player → coach messages (Mind Room). Sender/coach only by rules. ----
export function addMessage(data){ return addDoc(collection(db,"messages"), data); }
export function listenMessages(cb){
  return onSnapshot(collection(db,"messages"),
    s=>{ const a=[]; s.forEach(d=>a.push({ docId:d.id, ...d.data() })); a.sort((x,y)=>(y.ts||0)-(x.ts||0)); cb(a); },
    err=>cb(null, err));
}

// ---- Delete objects from R2 (coach only; the server enforces it). ----
export async function deleteR2(keys){
  const list = (keys||[]).filter(Boolean);
  if(!list.length) return;
  const user = auth.currentUser; if(!user) return;
  const token = await user.getIdToken();
  await fetch("/api/r2-delete", {
    method:"POST",
    headers:{ "Content-Type":"application/json", Authorization:"Bearer "+token },
    body: JSON.stringify({ keys:list })
  }).catch(()=>{});  // best-effort cleanup; never blocks the user-facing delete
}

// ---- Drill / shot library ----
export function listenDrills(cb){
  return onSnapshot(collection(db,"drills"),
    s=>{ const a=[]; s.forEach(d=>a.push({ docId:d.id, ...d.data() })); a.sort((x,y)=>(y.ts||0)-(x.ts||0)); cb(a); },
    err=>cb(null, err));
}
export function addDrill(data){ return addDoc(collection(db,"drills"), data); }
export function updateDrill(docId, data){ return setDoc(doc(db,"drills",docId), data, { merge:true }); }
export function deleteDrill(docId){ return deleteDoc(doc(db,"drills",docId)); }

// ---- Goals / targets (one doc per player) ----
export function listenGoals(uid, cb){
  return onSnapshot(doc(db,"goals",String(uid)),
    d=>cb(d.exists()? d.data() : {}),
    err=>cb(null, err));
}
export function setGoal(uid, testId, val){
  return setDoc(doc(db,"goals",String(uid)), { [testId]: val }, { merge:true });
}

// ---- Match / film-room videos ----
export function listenVideos(cb){
  return onSnapshot(collection(db,"videos"),
    s=>{ const a=[]; s.forEach(d=>a.push({ docId:d.id, ...d.data() })); a.sort((x,y)=>(y.ts||0)-(x.ts||0)); cb(a); },
    err=>cb(null, err));
}
export function addVideo(data){ return addDoc(collection(db,"videos"), data); }
export function updateVideo(docId, data){ return setDoc(doc(db,"videos",docId), data, { merge:true }); }
export function deleteVideo(docId){ return deleteDoc(doc(db,"videos",docId)); }

// Record that a player has watched a video (merges into the video's watchedBy map).
export function markVideoWatched(docId, playerId, info){
  return setDoc(doc(db,"videos",docId), { watchedBy: { [String(playerId)]: info } }, { merge:true });
}

// Upload a video file to Firebase Storage; resolves with a streamable URL.
// (Legacy — kept as a fallback. R2 upload now lives in js/r2upload.js.)
// onProgress(fraction 0..1) is called as it uploads.
export function uploadVideoFile(file, onProgress){
  const safe = (file.name || "video").replace(/[^a-zA-Z0-9._-]/g, "_");
  const r = ref(storage, "videos/" + Date.now() + "_" + safe);
  const task = uploadBytesResumable(r, file, { contentType: file.type || "video/mp4" });
  return new Promise((resolve, reject)=>{
    task.on("state_changed",
      s=>{ if(onProgress && s.totalBytes) onProgress(s.bytesTransferred / s.totalBytes); },
      err=>reject(err),
      async ()=>{ try{ resolve(await getDownloadURL(task.snapshot.ref)); }catch(e){ reject(e); } });
  });
}

// ---- R2 video helpers ----
// Find an already-uploaded video by its file fingerprint (dedupe).
export async function findVideoByHash(hash){
  const snap = await getDocs(query(collection(db,"videos"), where("contentHash","==",hash)));
  let found = null; snap.forEach(d=>{ if(!found) found = { docId:d.id, ...d.data() }; });
  return found;
}

// ---- Support team: roles, channels, messages, progress ----
const CHAN_ID = (type, playerUid, staffUid) => `${type}__${playerUid}__${staffUid}`;

// Coach sets a staff member's role + assigned players (members write = coach only).
export function setStaffMember(uid, data){ return setDoc(doc(db,"members",String(uid)), data, { merge:true }); }

// Coach provisions the channels for one (player, staff) pairing. Idempotent.
export async function provisionChannels(coachUid, player, staff){
  const base = { playerUid:player.uid, playerName:player.name||"", staffUid:staff.uid, staffName:staff.name||"", coachUid:String(coachUid), createdAt:Date.now() };
  const defs = staff.role==="mental_coach"
    ? [["coach_mental", [coachUid,staff.uid], [coachUid,staff.uid]],
       ["mental_player",[staff.uid,player.uid], [coachUid,staff.uid,player.uid]]]
    : [["coach_fitness", [coachUid,staff.uid], [coachUid,staff.uid,player.uid]],
       ["fitness_player",[staff.uid,player.uid], [coachUid,staff.uid,player.uid]]];
  for(const [type,members,readers] of defs){
    await setDoc(doc(db,"channels",CHAN_ID(type,player.uid,staff.uid)),
      { ...base, type, members, readers }, { merge:true });
  }
}

// Channels this user may see (readers contains them).
export function listenMyChannels(uid, cb){
  return onSnapshot(query(collection(db,"channels"), where("readers","array-contains",String(uid))),
    s=>{ const a=[]; s.forEach(d=>a.push({ id:d.id, ...d.data() })); cb(a); },
    err=>cb(null, err));
}

// Live messages in one channel, oldest->newest. Query by readers (not channelId)
// so the security rule (uid in readers) can prove the query safe — Firestore
// rules are NOT filters, so a channelId-only query is denied. Filter to the
// channel client-side.
export function listenChat(channelId, uid, cb){
  return onSnapshot(query(collection(db,"chatMessages"), where("readers","array-contains",String(uid))),
    s=>{ const a=[]; s.forEach(d=>{ const m={ id:d.id, ...d.data() }; if(m.channelId===channelId) a.push(m); }); a.sort((x,y)=>(x.ts||0)-(y.ts||0)); cb(a); },
    err=>cb(null, err));
}
export function sendChat(channel, fromUid, text){
  return addDoc(collection(db,"chatMessages"),
    { channelId:channel.id, fromUid:String(fromUid), text:String(text), ts:Date.now(), readers:channel.readers });
}

// Fitness progress for a player. Query by readers (same reason as listenChat),
// filter to the player client-side.
export function listenProgress(playerUid, uid, cb){
  return onSnapshot(query(collection(db,"progress"), where("readers","array-contains",String(uid))),
    s=>{ const a=[]; s.forEach(d=>{ const p={ id:d.id, ...d.data() }; if(String(p.playerUid)===String(playerUid)) a.push(p); }); a.sort((x,y)=>(y.ts||0)-(x.ts||0)); cb(a); },
    err=>cb(null, err));
}
export function addProgress(fitnessChannel, fromUid, title, note){
  return addDoc(collection(db,"progress"),
    { channelId:fitnessChannel.id, playerUid:fitnessChannel.playerUid, staffUid:String(fromUid),
      coachUid:fitnessChannel.coachUid, title:String(title||""), note:String(note||""),
      ts:Date.now(), readers:fitnessChannel.readers });
}

// Resolve a playable URL for a video source.
//  - public bucket: source.url is directly playable
//  - private bucket: fetch a short-lived signed GET URL from our API
export async function getPlaybackUrl(source){
  if(!source) return null;
  if(source.url && /^https?:\/\//.test(source.url)) return source.url;
  if(source.kind === "r2" && source.key){
    const user = auth.currentUser;
    if(!user) throw new Error("Not signed in");
    const token = await user.getIdToken();
    const r = await fetch("/api/r2-play-url?key=" + encodeURIComponent(source.key), { headers:{ Authorization:"Bearer "+token } });
    if(!r.ok) throw new Error("Couldn't get playback URL ("+r.status+")");
    return (await r.json()).url;
  }
  return null;
}

// ---- Web Push ----
export function getVapidPublicKey(){
  return fetch("/api/vapid-public").then(r=>r.json()).then(d=>d.key);
}
// One subscription per user (their one device). We do NOT read first — the
// pushSubs rule is read:false for privacy, so a read-modify-write would be
// denied. Just overwrite; the server prunes dead endpoints on send.
export function savePushSub(uid, memberId, sub){
  return setDoc(doc(db,"pushSubs",String(uid)),
    { memberId:String(memberId), subs:[ JSON.parse(JSON.stringify(sub)) ] }, { merge:true });
}
export function removePushSub(uid){
  return setDoc(doc(db,"pushSubs",String(uid)), { subs:[] }, { merge:true });
}
// Fire-and-forget notification trigger (never blocks the user action).
export async function notify(kind, payload){
  try{
    const user = auth.currentUser; if(!user) return;
    const token = await user.getIdToken();
    await fetch("/api/notify", {
      method:"POST",
      headers:{ "Content-Type":"application/json", Authorization:"Bearer "+token },
      body: JSON.stringify({ kind, ...(payload||{}) })
    });
  }catch(e){ /* best-effort */ }
}

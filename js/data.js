import { db, storage, auth } from "./firebase.js";
import { collection, addDoc, doc, setDoc, deleteDoc, onSnapshot, query, where, getDocs }
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

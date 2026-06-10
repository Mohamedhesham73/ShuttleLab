import { db, storage } from "./firebase.js";
import { collection, addDoc, doc, setDoc, deleteDoc, onSnapshot, query, where }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { ref, uploadBytesResumable, getDownloadURL }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

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

// Upload a video file to Firebase Storage; resolves with a streamable URL.
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

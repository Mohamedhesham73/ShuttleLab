// POST /api/notify { kind, ...ids } — auth required. Validates the caller and
// computes recipients SERVER-SIDE, then sends a content-free Web Push to each.
import webpush from "web-push";
import admin from "firebase-admin";
import { verifyAuth, isCoach } from "./_lib/firebaseAdmin.js";

function initVapid(){
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:coach@shuttlelab.app",
    process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
}
const db = () => admin.firestore();

// Coach check that mirrors the Firestore rules: claim/email OR member-doc role.
async function callerIsCoach(me){
  if(isCoach(me)) return true;
  const d = await db().doc("members/"+me.uid).get();
  return d.exists && d.data().role === "coach";
}
async function nameOfUid(uid){
  const d = await db().doc("members/"+uid).get();
  return (d.exists && d.data().name) ? d.data().name : "Someone";
}
async function coachUids(){
  const s = await db().collection("members").where("role","==","coach").get();
  return s.docs.map(d=>d.id);
}
// pushSubs for a set of AUTH uids
async function subsByAuthUids(uids){
  const out = [];
  for(const uid of uids){
    const d = await db().doc("pushSubs/"+uid).get();
    if(d.exists && Array.isArray(d.data().subs)) out.push({ uid, subs:d.data().subs });
  }
  return out;
}
// pushSubs for a set of MEMBER ids
async function subsByMemberIds(ids){
  const out = [];
  for(const id of ids){
    const s = await db().collection("pushSubs").where("memberId","==",String(id)).limit(1).get();
    if(!s.empty && Array.isArray(s.docs[0].data().subs)) out.push({ uid:s.docs[0].id, subs:s.docs[0].data().subs });
  }
  return out;
}
// send one payload to a list of {uid, subs}; prune dead subscriptions
async function sendTo(targets, payload){
  const body = JSON.stringify(payload);
  for(const t of targets){
    const alive = [];
    for(const sub of t.subs){
      try{ await webpush.sendNotification(sub, body); alive.push(sub); }
      catch(err){ if(!(err && (err.statusCode===404 || err.statusCode===410))) alive.push(sub); }
    }
    if(alive.length !== t.subs.length){
      await db().doc("pushSubs/"+t.uid).set({ subs:alive }, { merge:true });
    }
  }
}

export default async function handler(req, res){
  if(req.method !== "POST"){ res.status(405).json({ error:"Method not allowed" }); return; }
  try{
    initVapid();
    const me = await verifyAuth(req);          // { uid, email, role? }
    const { kind } = req.body || {};
    let targets = [], payload = null;

    if(kind === "chat" || kind === "progress"){
      const ch = await db().doc("channels/"+req.body.channelId).get();
      if(!ch.exists){ res.status(404).json({ error:"no channel" }); return; }
      const c = ch.data();
      const allowed = kind==="chat" ? (c.members||[]).includes(me.uid) : c.staffUid===me.uid;
      if(!allowed){ res.status(403).json({ error:"not a member" }); return; }
      const recips = (c.readers||[]).filter(u=>u!==me.uid);
      targets = await subsByAuthUids(recips);
      const name = await nameOfUid(me.uid);
      payload = kind==="chat"
        ? { title:"ShuttleLab", body:"New message from "+name, url:"/?go=support", tag:"chat-"+req.body.channelId }
        : { title:"ShuttleLab", body:"New fitness progress for "+(c.playerName||"a player"), url:"/?go=support", tag:"progress-"+req.body.channelId };
    }
    else if(kind === "assign"){
      if(!(await callerIsCoach(me))){ res.status(403).json({ error:"coach only" }); return; }
      targets = await subsByAuthUids([req.body.staffId].filter(Boolean));
      const pname = await nameOfUid(req.body.playerId);
      payload = { title:"ShuttleLab", body:"You've been assigned to "+pname, url:"/?go=support", tag:"assign" };
    }
    else if(kind === "mind"){
      const recips = await coachUids();
      targets = await subsByAuthUids(recips.filter(u=>u!==me.uid));
      const name = await nameOfUid(me.uid);
      payload = { title:"ShuttleLab", body:"New message from "+name, url:"/", tag:"mind" };
    }
    else if(kind === "training" || kind === "plan" || kind === "test" || kind === "goal"){
      if(!(await callerIsCoach(me))){ res.status(403).json({ error:"coach only" }); return; }
      targets = await subsByMemberIds([req.body.playerId].filter(Boolean));
      const BODIES = {
        training: "New note from your coach",
        plan: "Your coach updated your season plan",
        test: "Your coach logged your new test results",
        goal: "Your coach set a new target for you"
      };
      payload = { title:"ShuttleLab", body: BODIES[kind],
        url: (kind==="test"||kind==="goal") ? "/?go=dash" : "/?go=train", tag:kind };
    }
    else if(kind === "film"){
      if(!(await callerIsCoach(me))){ res.status(403).json({ error:"coach only" }); return; }
      const v = await db().doc("videos/"+req.body.videoId).get();
      const a = v.exists ? v.data().assignedTo : null;
      let ids = [];
      if(a === "team"){ const s = await db().collection("members").where("role","==","player").get(); ids = s.docs.map(d=>d.data().id); }
      else if(Array.isArray(a)) ids = a;
      targets = await subsByMemberIds(ids);
      payload = { title:"ShuttleLab", body:"New film from your coach", url:"/?go=matches", tag:"film" };
    }
    else if(kind === "ladder"){
      targets = await subsByMemberIds([req.body.opponentId].filter(Boolean));
      const name = await nameOfUid(me.uid);
      payload = { title:"ShuttleLab", body:name+" challenged you on the ladder", url:"/?go=board", tag:"ladder" };
    }
    else if(kind === "drill"){
      if(!(await callerIsCoach(me))){ res.status(403).json({ error:"coach only" }); return; }
      const a = req.body.assignedTo;
      let ids = [];
      if(a === "team"){ const s = await db().collection("members").where("role","==","player").get(); ids = s.docs.map(d=>d.data().id); }
      else if(Array.isArray(a)) ids = a;
      targets = await subsByMemberIds(ids);
      payload = { title:"ShuttleLab", body:"New drill from your coach", url:"/?go=library", tag:"drill" };
    }
    else { res.status(400).json({ error:"unknown kind" }); return; }

    await sendTo(targets, payload);
    res.status(200).json({ sent: targets.length });
  }catch(e){
    res.status(e.status || 500).json({ error: e.message || "Server error" });
  }
}

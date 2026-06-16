import { readFileSync } from "node:fs";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import {
  initializeTestEnvironment, assertFails, assertSucceeds
} from "@firebase/rules-unit-testing";
import {
  doc, getDoc, setDoc, addDoc, collection, getDocs, query, where
} from "firebase/firestore";

let env;
const COACH="coach1", PLAYER="player1", MENTAL="mental1", FIT="fit1", OUTSIDER="player2";

before(async ()=>{
  env = await initializeTestEnvironment({
    projectId: "shuttlelab-174d2",
    firestore: { rules: readFileSync("firestore.rules","utf8"), host:"127.0.0.1", port:8080 }
  });
  await env.withSecurityRulesDisabled(async (ctx)=>{
    const db = ctx.firestore();
    await setDoc(doc(db,"members",COACH),  { id:COACH, name:"Coach", role:"coach" });
    await setDoc(doc(db,"members",PLAYER), { id:PLAYER, name:"Koka", role:"player" });
    await setDoc(doc(db,"members",OUTSIDER),{ id:OUTSIDER, name:"Alya", role:"player" });
    await setDoc(doc(db,"members",MENTAL), { id:MENTAL, name:"MC", role:"mental_coach", assigned:[PLAYER] });
    await setDoc(doc(db,"members",FIT),    { id:FIT, name:"FT", role:"fitness_trainer", assigned:[PLAYER] });
    const mk=(type,members,readers)=>setDoc(doc(db,"channels",`${type}__${PLAYER}__${type.startsWith("coach")?(type==="coach_mental"?MENTAL:FIT):(type==="mental_player"?MENTAL:FIT)}`),
      { type, playerUid:PLAYER, staffUid:type.includes("mental")?MENTAL:FIT, coachUid:COACH, members, readers });
    await mk("coach_mental",  [COACH,MENTAL], [COACH,MENTAL]);
    await mk("mental_player", [MENTAL,PLAYER],[COACH,MENTAL,PLAYER]);
    await mk("coach_fitness", [COACH,FIT],    [COACH,FIT,PLAYER]);
    await mk("fitness_player",[FIT,PLAYER],   [COACH,FIT,PLAYER]);
  });
});
after(async ()=>{ await env.cleanup(); });

const as = uid => env.authenticatedContext(uid).firestore();
const secretId = `coach_mental__${PLAYER}__${MENTAL}`;
const mpId     = `mental_player__${PLAYER}__${MENTAL}`;

test("player CANNOT read the secret coach-mental channel", async ()=>{
  await assertFails(getDoc(doc(as(PLAYER),"channels",secretId)));
});
test("mental coach CAN read the secret channel", async ()=>{
  await assertSucceeds(getDoc(doc(as(MENTAL),"channels",secretId)));
});
test("player CANNOT read a secret-channel message", async ()=>{
  await env.withSecurityRulesDisabled(async (ctx)=>{
    await addDoc(collection(ctx.firestore(),"chatMessages"),
      { channelId:secretId, fromUid:COACH, text:"hush", ts:1, readers:[COACH,MENTAL] });
  });
  await assertFails(getDocs(query(collection(as(PLAYER),"chatMessages"), where("channelId","==",secretId))));
});
test("coach CAN post to the secret channel; outsider staff CANNOT", async ()=>{
  await assertSucceeds(addDoc(collection(as(COACH),"chatMessages"),
    { channelId:secretId, fromUid:COACH, text:"hi", ts:2, readers:[COACH,MENTAL] }));
  await assertFails(addDoc(collection(as(FIT),"chatMessages"),
    { channelId:secretId, fromUid:FIT, text:"sneak", ts:3, readers:[COACH,FIT] }));
});
test("message create is rejected if readers don't match the channel", async ()=>{
  await assertFails(addDoc(collection(as(MENTAL),"chatMessages"),
    { channelId:mpId, fromUid:MENTAL, text:"x", ts:4, readers:[MENTAL] }));
});
test("player CAN read the fitness coach-trainer thread", async ()=>{
  await assertSucceeds(getDoc(doc(as(PLAYER),"channels",`coach_fitness__${PLAYER}__${FIT}`)));
});
test("staff CANNOT read measurements / plans / other members", async ()=>{
  await assertFails(getDocs(collection(as(MENTAL),"measurements")));
  await assertFails(getDoc(doc(as(MENTAL),"plans",PLAYER)));
  await assertFails(getDoc(doc(as(MENTAL),"members",OUTSIDER)));
});
test("staff CAN read their own member doc + assigned player", async ()=>{
  await assertSucceeds(getDoc(doc(as(MENTAL),"members",MENTAL)));
  await assertSucceeds(getDoc(doc(as(MENTAL),"members",PLAYER)));
});
test("player + coach keep full app access", async ()=>{
  await assertSucceeds(getDocs(collection(as(PLAYER),"measurements")));
  await assertSucceeds(getDoc(doc(as(COACH),"members",OUTSIDER)));
});
test("only coach provisions channels", async ()=>{
  const c = { type:"mental_player", playerUid:PLAYER, staffUid:MENTAL, coachUid:COACH, members:[MENTAL,PLAYER], readers:[COACH,MENTAL,PLAYER] };
  await assertFails(setDoc(doc(as(MENTAL),"channels","x__y__z"), c));
  await assertSucceeds(setDoc(doc(as(COACH),"channels","x__y__z"), c));
});
test("only the fitness trainer logs progress; the player cannot", async ()=>{
  const fpId = `fitness_player__${PLAYER}__${FIT}`;
  await assertFails(addDoc(collection(as(PLAYER),"progress"),
    { channelId:fpId, playerUid:PLAYER, staffUid:PLAYER, coachUid:COACH, title:"x", note:"", ts:1, readers:[COACH,FIT,PLAYER] }));
  await assertSucceeds(addDoc(collection(as(FIT),"progress"),
    { channelId:fpId, playerUid:PLAYER, staffUid:FIT, coachUid:COACH, title:"week 1", note:"good", ts:2, readers:[COACH,FIT,PLAYER] }));
});

# Support Team — Private Channels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `mental_coach` and `fitness_trainer` accounts that can only message their assigned players and the coach, through channels with a strict, rule-enforced visibility model (coach↔mental-coach is secret; the fitness side is fully transparent to the player).

**Architecture:** Two new Firestore collections (`channels`, `chatMessages`) plus a `progress` collection. Each message copies its channel's `readers` UID list so read rules are a single `array-contains`-style check with no `get()`. The coach provisions channels when assigning staff. Existing collections are tightened so the new roles can't touch them. A new `js/views/support.js` renders role-specific views; `app.js`/`shell.js` route the new roles to it.

**Tech Stack:** Vanilla ES modules (no build), Firebase Auth + Firestore (CDN SDK in the browser), Firestore security rules. Rules are tested with the Firebase Emulator + `@firebase/rules-unit-testing` run under Node's built-in test runner. UI is verified with `node --check` + the local static preview harness + manual per-role walkthrough (this repo has no UI test framework).

**Reference spec:** `docs/superpowers/specs/2026-06-16-support-team-private-channels-design.md`

---

## Data shapes (used across all tasks — keep names exact)

```
members/{uid}        { id, name, role, photo, assigned? }
  role ∈ 'coach' | 'player' | 'mental_coach' | 'fitness_trainer'
  assigned: [playerUid, …]   (staff roles only)

channels/{channelId} { type, playerUid, playerName, staffUid, staffName,
                       coachUid, members:[uid…], readers:[uid…], createdAt }
  channelId = `${type}__${playerUid}__${staffUid}`
  type ∈ 'coach_mental' | 'mental_player' | 'coach_fitness' | 'fitness_player'
  members = who may post;  readers = who may read (⊇ members)

chatMessages/{auto}  { channelId, fromUid, text, ts, readers:[uid…] }

progress/{auto}      { channelId, playerUid, staffUid, coachUid,
                       title, note, ts, readers:[uid…] }
  channelId references the player's 'fitness_player' channel
```

Visibility (readers) per channel type:
- `coach_mental`  → `[coachUid, staffUid]`            (SECRET — no player)
- `mental_player` → `[coachUid, staffUid, playerUid]`
- `coach_fitness` → `[coachUid, staffUid, playerUid]`
- `fitness_player`→ `[coachUid, staffUid, playerUid]`
- `progress`      → same as `fitness_player`

---

## Phase 1 — Firestore rules backbone + emulator tests

### Task 1: Add the emulator + rules test harness

**Files:**
- Create: `firebase.json`
- Create: `.firebaserc`
- Modify: `package.json`
- Create: `test/rules.test.mjs`

- [ ] **Step 1: Add emulator config.** Create `firebase.json`:

```json
{
  "firestore": { "rules": "firestore.rules" },
  "emulators": { "firestore": { "port": 8080 }, "ui": { "enabled": false } }
}
```

- [ ] **Step 2: Add a project alias.** Create `.firebaserc`:

```json
{ "projects": { "default": "shuttlelab-174d2" } }
```

- [ ] **Step 3: Add dev deps + scripts.** In `package.json`, add a `devDependencies` block and a `scripts` block (merge with the existing object — keep `dependencies` as-is):

```json
  "scripts": {
    "test:rules": "firebase emulators:exec --only firestore \"node --test test/rules.test.mjs\""
  },
  "devDependencies": {
    "@firebase/rules-unit-testing": "^3.0.4",
    "firebase": "^10.12.2",
    "firebase-tools": "^13.0.0"
  }
```

- [ ] **Step 4: Install.** Run: `npm install`
  Expected: installs without error. (Java 11+ must be present for the emulator. If `firebase` CLI login is needed it is NOT — `emulators:exec` runs offline.)

- [ ] **Step 5: Write the failing rules test.** Create `test/rules.test.mjs`. This is the security contract — it must fail first because the rules don't exist yet.

```js
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
  // Seed members + channels with security disabled.
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

test("player CANNOT read the secret coach↔mental channel", async ()=>{
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
    { channelId:mpId, fromUid:MENTAL, text:"x", ts:4, readers:[MENTAL] }));  // missing coach+player
});
test("player CAN read the fitness coach↔trainer thread", async ()=>{
  await assertSucceeds(getDoc(doc(as(PLAYER),"channels",`coach_fitness__${PLAYER}__${FIT}`)));
});
test("staff CANNOT read measurements / plans / other members", async ()=>{
  await assertFails(getDocs(collection(as(MENTAL),"measurements")));
  await assertFails(getDoc(doc(as(MENTAL),"plans",PLAYER)));
  await assertFails(getDoc(doc(as(MENTAL),"members",OUTSIDER)));   // not their player
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
```

- [ ] **Step 6: Run it — expect FAIL.** Run: `npm run test:rules`
  Expected: the emulator boots, tests RUN and **fail** (current rules don't define `channels`/`chatMessages` and don't restrict staff). This proves the harness works.

### Task 2: Write the new security rules

**Files:**
- Modify: `firestore.rules` (replace the whole file)

- [ ] **Step 1: Replace `firestore.rules` with:**

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function signedIn() { return request.auth != null; }
    function meExists() { return signedIn() && exists(/databases/$(database)/documents/members/$(request.auth.uid)); }
    function myRole() { return meExists() ? get(/databases/$(database)/documents/members/$(request.auth.uid)).data.role : "none"; }
    function isCoach() {
      return signedIn() && (
        request.auth.token.role == 'coach' ||
        request.auth.token.email == 'coach@shuttlelab.app' ||
        myRole() == 'coach'
      );
    }
    function isStaff() { return myRole() == 'mental_coach' || myRole() == 'fitness_trainer'; }
    function notStaff() { return signedIn() && !isStaff(); }
    function myAssigned() { return get(/databases/$(database)/documents/members/$(request.auth.uid)).data.get('assigned', []); }
    function chan(id) { return get(/databases/$(database)/documents/channels/$(id)).data; }

    // Members: coach writes. Coach + players read all (dashboards/leaderboard).
    // Staff read only their own doc + their assigned players.
    match /members/{id} {
      allow read:  if isCoach() || myRole() == 'player'
                   || (signedIn() && id == request.auth.uid)
                   || (isStaff() && id in myAssigned());
      allow write: if isCoach();
    }

    // Everything below is fenced off from support staff.
    match /measurements/{id} { allow read, write: if notStaff(); }
    match /goals/{id}        { allow read, write: if notStaff(); }
    match /drills/{id}       { allow read, write: if notStaff(); }
    match /training/{id}     { allow read, write: if notStaff(); }

    match /plans/{id} {
      allow read:  if notStaff();
      allow write: if isCoach() || (notStaff() && id != '__schedule' && id != '__giftjar');
    }

    match /private/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }

    // Mind Room player→coach messages (unchanged behaviour; staff excluded).
    match /messages/{id} {
      allow create: if notStaff() && request.resource.data.fromUid == request.auth.uid;
      allow read:   if isCoach() || (notStaff() && resource.data.fromUid == request.auth.uid);
      allow update, delete: if isCoach();
    }

    match /videos/{id} {
      allow read:   if notStaff();
      allow create: if notStaff();
      allow delete: if isCoach() || (notStaff() && resource.data.submittedUid == request.auth.uid);
      allow update: if isCoach()
        || (notStaff() && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['watchedBy']));
    }

    // ---- Support-team channels (coach-provisioned) ----
    match /channels/{id} {
      allow read:   if signedIn() && request.auth.uid in resource.data.readers;
      allow create, update, delete: if isCoach();
    }
    match /chatMessages/{id} {
      allow read:   if signedIn() && request.auth.uid in resource.data.readers;
      allow create: if signedIn()
        && request.resource.data.fromUid == request.auth.uid
        && request.auth.uid in chan(request.resource.data.channelId).members
        && request.resource.data.readers == chan(request.resource.data.channelId).readers;
      allow update, delete: if isCoach();
    }
    match /progress/{id} {
      allow read:   if signedIn() && request.auth.uid in resource.data.readers;
      allow create: if signedIn()
        && request.resource.data.staffUid == request.auth.uid
        && request.auth.uid in chan(request.resource.data.channelId).members
        && request.resource.data.readers == chan(request.resource.data.channelId).readers;
      allow update, delete: if isCoach() || (signedIn() && resource.data.staffUid == request.auth.uid);
    }
  }
}
```

- [ ] **Step 2: Run the rules tests — expect PASS.** Run: `npm run test:rules`
  Expected: all tests PASS.

- [ ] **Step 3: Commit.**

```bash
git add firebase.json .firebaserc package.json package-lock.json test/rules.test.mjs firestore.rules
git commit -m "Support team: Firestore rules + emulator tests (secret channels, staff fenced off)"
```

---

## Phase 2 — Data layer (`js/data.js`)

### Task 3: Channel/message/progress API + assignment

**Files:**
- Modify: `js/data.js` (append a new section at the end, before the closing of the file)

- [ ] **Step 1: Add the functions.** Append to `js/data.js`:

```js
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

// Live messages in one channel, oldest→newest.
export function listenChat(channelId, cb){
  return onSnapshot(query(collection(db,"chatMessages"), where("channelId","==",channelId)),
    s=>{ const a=[]; s.forEach(d=>a.push({ id:d.id, ...d.data() })); a.sort((x,y)=>(x.ts||0)-(y.ts||0)); cb(a); },
    err=>cb(null, err));
}
export function sendChat(channel, fromUid, text){
  return addDoc(collection(db,"chatMessages"),
    { channelId:channel.id, fromUid:String(fromUid), text:String(text), ts:Date.now(), readers:channel.readers });
}

// Fitness progress for a player (readers rule gates who sees it).
export function listenProgress(playerUid, cb){
  return onSnapshot(query(collection(db,"progress"), where("playerUid","==",String(playerUid))),
    s=>{ const a=[]; s.forEach(d=>a.push({ id:d.id, ...d.data() })); a.sort((x,y)=>(y.ts||0)-(x.ts||0)); cb(a); },
    err=>cb(null, err));
}
export function addProgress(fitnessChannel, fromUid, title, note){
  return addDoc(collection(db,"progress"),
    { channelId:fitnessChannel.id, playerUid:fitnessChannel.playerUid, staffUid:String(fromUid),
      coachUid:fitnessChannel.coachUid, title:String(title||""), note:String(note||""),
      ts:Date.now(), readers:fitnessChannel.readers });
}
```

- [ ] **Step 2: Syntax check.** Run: `node --check js/data.js`
  Expected: no output (passes).

- [ ] **Step 3: Commit.**

```bash
git add js/data.js
git commit -m "Support team: data.js channel/message/progress API"
```

---

## Phase 3 — Roles in app state + restricted nav

### Task 4: Carry `assigned` into state and route the new roles

**Files:**
- Modify: `js/app.js:52`, `js/app.js:57`, `js/app.js:61`, `js/app.js:15-24`
- Modify: `js/shell.js:12-14`

- [ ] **Step 1: Carry `assigned` into the roster + user.** In `js/app.js`, change the roster map (line 52) to:

```js
    state.roster = members.map(m=>({ id:m.id, name:m.name, role:m.role, photo:m.photo, uid:m.uid, assigned:m.assigned||[] }));
```

and the `u` object (line 57) to:

```js
    const u = { id:me.id, name:me.name, role:me.role, photo:me.photo, assigned:me.assigned||[] };
```

- [ ] **Step 2: Default the new roles to the support view.** In `js/app.js` change line 61 to:

```js
    if(fresh) state.view = u.role==="coach" ? "team" : (u.role==="player" ? "dash" : "support");
```

- [ ] **Step 3: Register the support view.** In `js/app.js`, add the import after line 13:

```js
import { renderSupport } from "./views/support.js";
```

and add to the `VIEWS` map (inside the object, after `mind: renderMindRoom`):

```js
  ,support: renderSupport
```

- [ ] **Step 4: Role-based tabs.** In `js/shell.js` replace the `const tabs = …` ternary (lines 12-14) with:

```js
  const staff = state.role==="mental_coach" || state.role==="fitness_trainer";
  const tabs = staff
    ? [["support","My players"]]
    : state.role==="coach"
    ? [["team","Squad"],["train","Game Plan"],["library","Court Lab"],["matches","Film Room"],["board","Ladder"],["mind","Mind Room"],["support","Support"]]
    : [["dash","Progress"],["log","Testing"],["train","Game Plan"],["library","Court Lab"],["matches","Film Room"],["board","Ladder"],["mind","Mind Room"],["support","My team"]];
```

- [ ] **Step 5: Syntax check.** Run: `node --check js/app.js && node --check js/shell.js`
  Expected: no output.

- [ ] **Step 6: Commit.**

```bash
git add js/app.js js/shell.js
git commit -m "Support team: carry assigned into state, route new roles to support view"
```

---

## Phase 4 — The support view (chat + role branches)

### Task 5: Shared chat component

**Files:**
- Create: `js/views/support.js`

- [ ] **Step 1: Create `js/views/support.js` with the chat renderer + a role dispatcher.** (Later tasks fill the branches.)

```js
import { state, esc, autoGrow } from "../core.js";
import {
  loadMembers, setStaffMember, provisionChannels,
  listenMyChannels, listenChat, sendChat, listenProgress, addProgress
} from "../data.js";

const TYPE_LABEL = {
  coach_mental:  "🔒 With the coach (private)",
  mental_player: "Mental coach",
  coach_fitness: "Coach ↔ trainer",
  fitness_player:"Fitness trainer"
};

// Render a live chat for one channel into `el`. Returns an unsubscribe fn.
function mountChat(el, channel){
  el.innerHTML = `
    <div id="chatList" style="display:flex;flex-direction:column;gap:6px;max-height:46vh;overflow:auto;padding:4px 2px;"></div>
    <div style="display:flex;gap:8px;align-items:flex-end;margin-top:8px;">
      <textarea id="chatIn" rows="1" placeholder="Message…" style="flex:1;resize:none;overflow:hidden;"></textarea>
      <button class="btn pri" id="chatSend" style="padding:9px 14px;">Send</button>
    </div>`;
  const list = el.querySelector("#chatList"), input = el.querySelector("#chatIn");
  autoGrow(input);
  const canPost = channel.members.includes(String(state.uid));
  if(!canPost){ input.disabled=true; input.placeholder="You can read this conversation but not post in it."; el.querySelector("#chatSend").style.display="none"; }
  const unsub = listenChat(channel.id, (msgs, err)=>{
    if(err){ list.innerHTML=`<div class="err">${esc(err.message)}</div>`; return; }
    list.innerHTML = (msgs||[]).map(m=>{
      const mine = String(m.fromUid)===String(state.uid);
      return `<div style="align-self:${mine?"flex-end":"flex-start"};max-width:80%;background:${mine?"var(--brand)":"var(--line)"};color:${mine?"#0b1410":"inherit"};padding:7px 11px;border-radius:12px;font-size:14px;white-space:pre-wrap;">${esc(m.text)}</div>`;
    }).join("") || `<div class="muted" style="font-size:12px;">No messages yet.</div>`;
    list.scrollTop = list.scrollHeight;
  });
  const send = async ()=>{ const t=input.value.trim(); if(!t) return; input.value=""; autoGrow(input); try{ await sendChat(channel, state.uid, t); }catch(e){ alert("Couldn't send: "+(e.message||e)); } };
  el.querySelector("#chatSend").onclick = send;
  return unsub;
}

export function renderSupport(){
  const r = state.role;
  if(r==="mental_coach" || r==="fitness_trainer") return renderStaffView();
  if(r==="player") return renderPlayerView();
  return renderCoachSupport();
}
```

- [ ] **Step 2: Syntax check.** Run: `node --check js/views/support.js`
  Expected: fails with the three render functions undefined — that's expected; they're added next. (To unblock `node --check`, which only checks syntax not references, this will actually PASS. If it errors on syntax, fix it.)

- [ ] **Step 3: Commit.**

```bash
git add js/views/support.js
git commit -m "Support team: chat component + role dispatcher"
```

### Task 6: Staff view (their players → channels) + player view (My team)

**Files:**
- Modify: `js/views/support.js` (add `renderStaffView`, `renderPlayerView`)

- [ ] **Step 1: Add both views.** Append to `js/views/support.js`:

```js
// A reusable "list of my channels, click one to open the chat" screen.
function channelListScreen(title, subtitle, filterTypes){
  const view = document.getElementById("view");
  view.innerHTML = `
    <div class="disp" style="font-size:18px;margin-bottom:4px;">${esc(title)}</div>
    <div class="muted" style="font-size:13px;margin-bottom:14px;">${esc(subtitle)}</div>
    <div id="supList"><div class="muted">Loading…</div></div>
    <div id="supChat"></div>`;
  let chatUnsub = null;
  const open = (ch)=>{
    if(chatUnsub){ chatUnsub(); chatUnsub=null; }
    const who = ch.type.includes("player") || ch.type==="coach_mental" || ch.type==="coach_fitness"
      ? (state.role==="player" ? ch.staffName : ch.playerName) : ch.playerName;
    document.getElementById("supChat").innerHTML =
      `<div class="card" style="padding:14px;margin-top:14px;">
         <div class="disp" style="font-size:15px;margin-bottom:10px;">${esc(TYPE_LABEL[ch.type]||"Chat")} · ${esc(who||"")}</div>
         <div id="chatMount"></div>
       </div>`;
    chatUnsub = mountChat(document.getElementById("chatMount"), ch);
  };
  state.unsub.push(listenMyChannels(state.uid, (chans, err)=>{
    const el=document.getElementById("supList"); if(!el) return;
    if(err){ el.innerHTML=`<div class="err">${esc(err.message)}</div>`; return; }
    const list = (chans||[]).filter(c=>filterTypes.includes(c.type));
    // group by the "other" person
    if(!list.length){ el.innerHTML=`<div class="muted" style="font-size:13px;">Nothing here yet.</div>`; return; }
    el.innerHTML = list.map(c=>{
      const label = state.role==="player" ? (TYPE_LABEL[c.type]) : (c.playerName||"Player");
      const sub = state.role==="player" ? (c.staffName||"") : (TYPE_LABEL[c.type]);
      return `<div data-ch="${esc(c.id)}" style="display:flex;justify-content:space-between;align-items:center;padding:11px 13px;border:1px solid var(--line);border-radius:10px;margin-bottom:8px;cursor:pointer;">
        <div><div style="font-size:14px;">${esc(label)}</div><div class="muted" style="font-size:12px;">${esc(sub)}</div></div><span class="muted">›</span></div>`;
    }).join("");
    el.querySelectorAll("[data-ch]").forEach(row=>row.onclick=()=>{ const c=list.find(x=>x.id===row.dataset.ch); if(c) open(c); });
  }));
}

function renderStaffView(){
  const role = state.role==="mental_coach" ? "mental coach" : "fitness trainer";
  const types = state.role==="mental_coach" ? ["coach_mental","mental_player"] : ["coach_fitness","fitness_player"];
  channelListScreen("My players", "You're the "+role+". Tap a conversation to open it.", types);
}

function renderPlayerView(){
  // players see their mental + fitness chats (incl. the readable coach↔trainer thread)
  channelListScreen("My team", "Your mental coach and fitness trainer.",
    ["mental_player","coach_fitness","fitness_player"]);
}
```

- [ ] **Step 2: Syntax check.** Run: `node --check js/views/support.js`
  Expected: passes.

- [ ] **Step 3: Browser smoke test.** Create `_sup_smoke.html` at repo root that stubs `state` and mounts a chat against a fake channel (no Firestore), to confirm the chat component renders and the textarea auto-grows:

```html
<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="css/styles.css">
<div class="wrap"><div id="view"></div></div>
<script type="module">
  import { state } from "./js/core.js";
  state.uid="me"; state.role="player"; state.unsub=[];
  // minimal manual mount: reuse mountChat indirectly via a fake channel list is complex;
  // instead just confirm the module imports without error:
  import("./js/views/support.js").then(m=>{ document.getElementById("view").textContent="support.js loaded: "+(typeof m.renderSupport); });
</script>
```
Run via the static preview server (`.claude/launch.json` "static" → `npx serve -l 5179 .`), open `/_sup_smoke.html`, confirm it prints `support.js loaded: function`. Then delete `_sup_smoke.html`.

- [ ] **Step 4: Commit.**

```bash
git add js/views/support.js
git commit -m "Support team: staff view + player My-team view"
```

### Task 7: Coach support screen (assign staff → provision channels + see all channels)

**Files:**
- Modify: `js/views/support.js` (add `renderCoachSupport`)

- [ ] **Step 1: Add the coach screen.** Append to `js/views/support.js`:

```js
async function renderCoachSupport(){
  const view = document.getElementById("view");
  view.innerHTML = `
    <div class="disp" style="font-size:18px;margin-bottom:4px;">Support staff</div>
    <div class="muted" style="font-size:13px;margin-bottom:14px;">Assign each mental coach / fitness trainer to players. Assigning provisions their private channels.</div>
    <div id="staffList"><div class="muted">Loading…</div></div>
    <div id="coachChat"></div>`;
  const members = await loadMembers();
  const players = members.filter(m=>m.role==="player");
  const staff   = members.filter(m=>m.role==="mental_coach" || m.role==="fitness_trainer");
  const el = document.getElementById("staffList");
  if(!staff.length){ el.innerHTML=`<div class="muted" style="font-size:13px;">No support accounts yet. Create their logins in Firebase, set their <code>role</code> to <code>mental_coach</code> or <code>fitness_trainer</code> in <code>members</code>, then they'll appear here to assign.</div>`; }
  else el.innerHTML = staff.map(s=>{
    const assigned = new Set((s.assigned||[]).map(String));
    return `<div class="card" style="padding:14px;margin-bottom:12px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <div><b>${esc(s.name)}</b> <span class="muted" style="font-size:12px;">· ${s.role==="mental_coach"?"Mental coach":"Fitness trainer"}</span></div>
      </div>
      <div style="display:flex;gap:7px;flex-wrap:wrap;">
        ${players.map(p=>`<span class="chip ${assigned.has(String(p.id))?"on":""}" data-staff="${esc(s.uid)}" data-player="${esc(p.uid)}">${esc(p.name)}</span>`).join("")}
      </div>
    </div>`;
  }).join("");

  el.querySelectorAll("[data-player]").forEach(chip=>chip.onclick=async ()=>{
    const sUid=chip.dataset.staff, pUid=chip.dataset.player;
    const s=staff.find(x=>x.uid===sUid), p=players.find(x=>x.uid===pUid);
    const on = !chip.classList.contains("on"); chip.classList.toggle("on",on);
    const assigned = new Set((s.assigned||[]).map(String));
    if(on) assigned.add(String(pUid)); else assigned.delete(String(pUid));
    s.assigned = [...assigned];
    try{
      await setStaffMember(sUid, { assigned:s.assigned });
      if(on) await provisionChannels(state.uid, { uid:p.uid, name:p.name }, { uid:s.uid, name:s.name, role:s.role });
    }catch(e){ chip.classList.toggle("on",!on); alert("Couldn't save: "+(e.message||e)); }
  });

  // The coach also reads every channel — reuse the same list screen below.
  channelListScreen.__coachAppend && channelListScreen.__coachAppend();
}
```

- [ ] **Step 2: Let the coach browse all channels too.** Still in `renderCoachSupport`, replace the last line (`channelListScreen.__coachAppend …`) with an inline channel browser appended under `#coachChat`:

```js
  let chatUnsub=null;
  state.unsub.push(listenMyChannels(state.uid, (chans, err)=>{
    const box=document.getElementById("coachChat"); if(!box) return;
    if(err){ box.innerHTML=`<div class="err">${esc(err.message)}</div>`; return; }
    const byPlayer={};
    (chans||[]).forEach(c=>{ (byPlayer[c.playerName||c.playerUid] ||= []).push(c); });
    box.innerHTML = `<div class="disp" style="font-size:15px;margin:18px 0 10px;">All conversations</div>` +
      Object.keys(byPlayer).map(name=>`<div style="margin-bottom:10px;"><div class="muted" style="font-size:12px;margin-bottom:5px;">${esc(name)}</div>${
        byPlayer[name].map(c=>`<span class="chip" data-open="${esc(c.id)}" style="margin:0 6px 6px 0;">${esc(TYPE_LABEL[c.type]||c.type)}</span>`).join("")
      }</div>`).join("") + `<div id="coachChatMount"></div>`;
    box.querySelectorAll("[data-open]").forEach(ch=>ch.onclick=()=>{
      const c=(chans||[]).find(x=>x.id===ch.dataset.open); if(!c) return;
      if(chatUnsub){ chatUnsub(); chatUnsub=null; }
      const mount=document.getElementById("coachChatMount");
      mount.innerHTML=`<div class="card" style="padding:14px;margin-top:10px;"><div class="disp" style="font-size:15px;margin-bottom:10px;">${esc(TYPE_LABEL[c.type])} · ${esc(c.playerName)}</div><div id="cMount"></div></div>`;
      chatUnsub = mountChat(document.getElementById("cMount"), c);
    });
  }));
```

(Delete the placeholder `channelListScreen.__coachAppend && …` line from Step 1.)

- [ ] **Step 3: Syntax check.** Run: `node --check js/views/support.js`
  Expected: passes.

- [ ] **Step 4: Commit.**

```bash
git add js/views/support.js
git commit -m "Support team: coach assign + browse-all-channels screen"
```

---

## Phase 5 — Fitness progress log

### Task 8: Progress timeline + trainer compose

**Files:**
- Modify: `js/views/support.js` (extend the fitness chat screen with a Progress section)

- [ ] **Step 1: Add a progress panel helper.** Append to `js/views/support.js`:

```js
// Renders a progress timeline for `playerUid` into `el`. If `fitnessChannel`
// is provided AND the viewer is its trainer, shows a compose box.
function mountProgress(el, playerUid, fitnessChannel){
  const canPost = fitnessChannel && fitnessChannel.members.includes(String(state.uid)) && state.role==="fitness_trainer";
  el.innerHTML = `
    ${canPost ? `<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:12px;">
      <input id="progTitle" type="text" placeholder="Progress title (e.g. Week 4 — endurance)">
      <textarea id="progNote" rows="2" placeholder="What improved, numbers, next focus…" style="resize:none;overflow:hidden;"></textarea>
      <button class="btn pri" id="progAdd" style="align-self:flex-start;padding:8px 14px;">Add entry</button>
    </div>`:""}
    <div id="progList"><div class="muted" style="font-size:12px;">Loading…</div></div>`;
  if(canPost){
    autoGrow(el.querySelector("#progNote"));
    el.querySelector("#progAdd").onclick = async ()=>{
      const t=el.querySelector("#progTitle").value.trim(), n=el.querySelector("#progNote").value.trim();
      if(!t && !n) return;
      try{ await addProgress(fitnessChannel, state.uid, t, n); el.querySelector("#progTitle").value=""; el.querySelector("#progNote").value=""; autoGrow(el.querySelector("#progNote")); }
      catch(e){ alert("Couldn't save: "+(e.message||e)); }
    };
  }
  state.unsub.push(listenProgress(playerUid, (rows, err)=>{
    const list=el.querySelector("#progList"); if(!list) return;
    if(err){ list.innerHTML=`<div class="err">${esc(err.message)}</div>`; return; }
    list.innerHTML = (rows||[]).length ? rows.map(p=>`
      <div style="border:1px solid var(--line);border-left:3px solid var(--brand);border-radius:10px;padding:10px 12px;margin-bottom:8px;">
        <div class="muted" style="font-size:11px;">${new Date(p.ts).toLocaleDateString()}</div>
        ${p.title?`<div style="font-size:14px;font-weight:500;">${esc(p.title)}</div>`:""}
        ${p.note?`<div style="font-size:13px;white-space:pre-wrap;line-height:1.5;">${esc(p.note)}</div>`:""}
      </div>`).join("") : `<div class="muted" style="font-size:12px;">No progress logged yet.</div>`;
  }));
}
```

- [ ] **Step 2: Surface progress where a fitness channel is opened.** In `channelListScreen`'s `open(ch)` function, after mounting the chat, append a progress card when the channel is on the fitness side:

Replace the body of `open = (ch)=>{ … }` with:

```js
  const open = (ch)=>{
    if(chatUnsub){ chatUnsub(); chatUnsub=null; }
    const other = state.role==="player" ? ch.staffName : ch.playerName;
    const host = document.getElementById("supChat");
    host.innerHTML =
      `<div class="card" style="padding:14px;margin-top:14px;">
         <div class="disp" style="font-size:15px;margin-bottom:10px;">${esc(TYPE_LABEL[ch.type]||"Chat")} · ${esc(other||"")}</div>
         <div id="chatMount"></div>
       </div>
       ${(ch.type==="fitness_player") ? `<div class="card" style="padding:14px;margin-top:12px;"><div class="disp" style="font-size:15px;margin-bottom:10px;">Fitness progress</div><div id="progMount"></div></div>`:""}`;
    chatUnsub = mountChat(document.getElementById("chatMount"), ch);
    if(ch.type==="fitness_player") mountProgress(document.getElementById("progMount"), ch.playerUid, ch);
  };
```

- [ ] **Step 3: Syntax check.** Run: `node --check js/views/support.js`
  Expected: passes.

- [ ] **Step 4: Commit.**

```bash
git add js/views/support.js
git commit -m "Support team: fitness progress timeline + trainer compose"
```

---

## Phase 6 — Deploy rules + full manual verification

### Task 9: Deploy rules and verify every role end-to-end

**Files:** none (operational)

- [ ] **Step 1: Re-run the rules tests.** Run: `npm run test:rules`
  Expected: all PASS.

- [ ] **Step 2: Deploy the rules.** Run: `firebase deploy --only firestore:rules`
  Expected: "Deploy complete." (Requires `firebase login` once.)

- [ ] **Step 3: Seed real staff.** In the Firebase console: create the email/password logins for the support staff; add a `members/{uid}` doc for each with `{ id, name, role:'mental_coach'|'fitness_trainer' }`. (Assignments are done in-app next.)

- [ ] **Step 4: Coach walkthrough.** Sign in as the coach → **Support** tab → assign a mental coach and a fitness trainer to a player. Confirm chips toggle and persist on refresh.

- [ ] **Step 5: Privacy walkthrough.** Sign in as that player → **My team**: confirm they see the mental-coach chat, both fitness threads, and progress — and that the **coach↔mental-coach** conversation is **absent**. In the browser devtools console (signed in as the player) run a direct query for the secret channel's messages and confirm it returns an error/empty:

```js
// paste in console while signed in as the player
firebase /* via app's db */; // expect permission-denied for chatMessages where channelId == the coach_mental id
```

- [ ] **Step 6: Staff walkthrough.** Sign in as the mental coach → confirm only **My players** is visible (no Squad/Testing/Court Lab/etc.), only the assigned player(s) show, the secret coach channel works, and that navigating to `measurements`/`plans` via console is denied.

- [ ] **Step 7: Regression.** Sign in as coach and as a player; confirm Dashboard, Testing, Game Plan, Court Lab, Film Room, Ladder, and Mind Room all still load (the rule tightening didn't break them).

- [ ] **Step 8: Commit any fixes, then push.**

```bash
git push origin main
```

---

## Self-review notes (author)

- **Spec coverage:** roles+accounts (Task 4, Task 9.3), flexible assignment (Task 7), channel model & visibility (Tasks 2,3,7), staff restricted app (Task 4 nav + Task 2 rules), player/coach/staff views (Tasks 5–7), security backbone (Tasks 1–2), fitness progress (Task 8), scope/non-goals respected (text-only, no notifications, Mind Room untouched), deploy + verify (Task 9). ✓
- **Type consistency:** `channel.id`, `members`, `readers`, `playerUid`, `staffUid`, `coachUid`, `type` used identically across data.js and support.js and rules; `CHAN_ID`/`channelId` consistent; `addProgress(fitnessChannel,…)` matches the `progress` doc shape and the rules' `chan(channelId).readers` check. ✓
- **Known follow-ups (out of scope):** unread badges/notifications, voice/image messages, a coach UI to create logins. Listed as v1 exclusions in the spec.

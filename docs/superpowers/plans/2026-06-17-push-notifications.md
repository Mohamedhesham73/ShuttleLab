# Web Push Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Send content-free push notifications (messages, assignments, plan updates, etc.) to the coach/players/staff on their installed iOS PWAs, with no background app and no battery drain.

**Architecture:** Standard Web Push (VAPID) — the client subscribes via `PushManager` and stores the subscription in `pushSubs/{authUid}`; a Vercel function `/api/notify` (using the `web-push` lib + the existing `firebase-admin` auth) decides recipients server-side and sends; the existing `sw.js` shows the notification. Client code pings `/api/notify` after each relevant write.

**Tech Stack:** Web Push API + `web-push` (npm), Firebase Admin (already wired), Vercel serverless functions, vanilla ES modules, Firestore rules (emulator-tested).

**Reference spec:** `docs/superpowers/specs/2026-06-17-push-notifications-design.md`

---

## Identity note (used throughout)

- `channels.readers` / `channels.members` / `pushSubs` doc IDs are **Firebase Auth UIDs**.
- `training`/`plan`/`film`/`ladder` reference players by **member id** (the `id` field,
  e.g. "2"). The endpoint resolves a member id to subscriptions via
  `pushSubs where memberId == <id>`; `pushSubs.memberId` is stored at subscribe time.
- `assign` passes **auth uids** (support.js uses `p.uid`/`s.uid` = member doc id = auth uid).

---

## Phase 1 — Storage + rule

### Task 1: `pushSubs` security rule + test

**Files:**
- Modify: `firestore.rules`
- Modify: `test/rules.test.mjs`

- [ ] **Step 1: Add a failing test.** In `test/rules.test.mjs`, append before the final closing:

```js
test("a user may write only their own pushSubs; nobody else reads them", async ()=>{
  await assertSucceeds(setDoc(doc(as(PLAYER),"pushSubs",PLAYER), { memberId:PLAYER, subs:[] }));
  await assertFails(setDoc(doc(as(PLAYER),"pushSubs",OUTSIDER), { memberId:OUTSIDER, subs:[] }));
  await assertFails(getDoc(doc(as(PLAYER),"pushSubs",PLAYER)));   // clients never read
});
```

- [ ] **Step 2: Run — expect FAIL.** Run: `npm run test:rules`
  Expected: the new test fails (no `pushSubs` rule yet; default-deny makes the write fail).

- [ ] **Step 3: Add the rule.** In `firestore.rules`, immediately after the `match /private/{uid}` block, add:

```
    // Web Push subscriptions — a user writes only their own; only the admin
    // send-endpoint (which bypasses rules) ever reads them.
    match /pushSubs/{uid} {
      allow read:  if false;
      allow write: if request.auth != null && request.auth.uid == uid;
    }
```

- [ ] **Step 4: Run — expect PASS.** Run: `npm run test:rules`
  Expected: all tests pass (Java 11+ required for the emulator).

- [ ] **Step 5: Commit.**

```bash
git add firestore.rules test/rules.test.mjs
git commit -m "Push: pushSubs collection rule (owner-write, no client read) + test"
```

---

## Phase 2 — Server (the send endpoint)

### Task 2: `web-push` dep + VAPID public endpoint

**Files:**
- Modify: `package.json`
- Create: `api/vapid-public.js`

- [ ] **Step 1: Add the dependency.** In `package.json`, add `"web-push": "^3.6.7"` to the
  `dependencies` object (keep the others). Then run: `npm install`
  Expected: installs without error.

- [ ] **Step 2: Create the public-key endpoint.** Create `api/vapid-public.js`:

```js
// GET /api/vapid-public -> { key } : the (non-secret) VAPID public key for the client.
export default function handler(req, res){
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.status(200).json({ key: process.env.VAPID_PUBLIC_KEY || "" });
}
```

- [ ] **Step 3: Commit.**

```bash
git add package.json package-lock.json api/vapid-public.js
git commit -m "Push: web-push dependency + /api/vapid-public endpoint"
```

### Task 3: `/api/notify` send endpoint

**Files:**
- Create: `api/notify.js`

- [ ] **Step 1: Create the endpoint.** Create `api/notify.js`:

```js
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

async function memberByField(id){
  const s = await db().collection("members").where("id","==",String(id)).limit(1).get();
  return s.empty ? null : { uid:s.docs[0].id, ...s.docs[0].data() };
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
      if(!isCoach(me)){ res.status(403).json({ error:"coach only" }); return; }
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
    else if(kind === "training" || kind === "plan"){
      if(!isCoach(me)){ res.status(403).json({ error:"coach only" }); return; }
      targets = await subsByMemberIds([req.body.playerId].filter(Boolean));
      payload = { title:"ShuttleLab",
        body: kind==="training" ? "New note from your coach" : "Your coach updated your season plan",
        url:"/?go=train", tag:kind };
    }
    else if(kind === "film"){
      if(!isCoach(me)){ res.status(403).json({ error:"coach only" }); return; }
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
    else { res.status(400).json({ error:"unknown kind" }); return; }

    await sendTo(targets, payload);
    res.status(200).json({ sent: targets.length });
  }catch(e){
    res.status(e.status || 500).json({ error: e.message || "Server error" });
  }
}
```

- [ ] **Step 2: Lint the file parses.** Run: `node --check api/notify.js`
  Expected: no output.

- [ ] **Step 3: Commit.**

```bash
git add api/notify.js
git commit -m "Push: /api/notify send endpoint (server-side recipients, content-free)"
```

---

## Phase 3 — Client subscribe + send helper

### Task 4: `data.js` push helpers

**Files:**
- Modify: `js/data.js`

- [ ] **Step 1: Append the helpers** to the end of `js/data.js` (it already imports
  `auth`, `doc`, `setDoc`, `getDoc`, `collection`):

```js
// ---- Web Push ----
export function getVapidPublicKey(){
  return fetch("/api/vapid-public").then(r=>r.json()).then(d=>d.key);
}
export async function savePushSub(uid, memberId, sub){
  const ref = doc(db,"pushSubs",String(uid));
  const cur = await getDoc(ref);
  const subs = (cur.exists() && Array.isArray(cur.data().subs)) ? cur.data().subs : [];
  const next = subs.filter(s=>s && s.endpoint!==sub.endpoint).concat([JSON.parse(JSON.stringify(sub))]);
  return setDoc(ref, { memberId:String(memberId), subs:next }, { merge:true });
}
export async function removePushSub(uid, sub){
  const ref = doc(db,"pushSubs",String(uid));
  const cur = await getDoc(ref); if(!cur.exists()) return;
  const subs = (Array.isArray(cur.data().subs)?cur.data().subs:[]).filter(s=>s && s.endpoint!==sub.endpoint);
  return setDoc(ref, { subs }, { merge:true });
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
```

- [ ] **Step 2: Verify.** Run: `node --check js/data.js`
  Expected: no output.

- [ ] **Step 3: Commit.**

```bash
git add js/data.js
git commit -m "Push: data.js client helpers (vapid key, save/remove sub, notify)"
```

### Task 5: `js/push.js` + menu toggle

**Files:**
- Create: `js/push.js`
- Modify: `js/shell.js`

- [ ] **Step 1: Create `js/push.js`:**

```js
import { state } from "./core.js";
import { getVapidPublicKey, savePushSub, removePushSub } from "./data.js";

function urlB64ToUint8(base64){
  const pad = "=".repeat((4 - base64.length % 4) % 4);
  const b = (base64 + pad).replace(/-/g,"+").replace(/_/g,"/");
  const raw = atob(b);
  return Uint8Array.from([...raw].map(c=>c.charCodeAt(0)));
}
const supported = ()=> "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
const isStandalone = ()=> window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
const isIOS = ()=> /iPhone|iPad|iPod/.test(navigator.userAgent);

export async function pushState(){
  if(!supported()) return "unsupported";
  if(Notification.permission === "denied") return "denied";
  try{
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = reg && await reg.pushManager.getSubscription();
    return sub ? "on" : "off";
  }catch(e){ return "off"; }
}
export async function enablePush(){
  if(!supported()) return { ok:false, reason: (isIOS() && !isStandalone()) ? "ios-install" : "unsupported" };
  const perm = await Notification.requestPermission();
  if(perm !== "granted") return { ok:false, reason:"denied" };
  const reg = await navigator.serviceWorker.ready;
  const key = await getVapidPublicKey();
  if(!key) return { ok:false, reason:"no-key" };
  const sub = await reg.pushManager.subscribe({ userVisibleOnly:true, applicationServerKey: urlB64ToUint8(key) });
  await savePushSub(state.uid, state.user.id, sub.toJSON());
  return { ok:true };
}
export async function disablePush(){
  try{
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = reg && await reg.pushManager.getSubscription();
    if(sub){ try{ await removePushSub(state.uid, sub.toJSON()); }catch(e){} await sub.unsubscribe(); }
  }catch(e){}
  return { ok:true };
}
```

- [ ] **Step 2: Add the toggle to the header.** In `js/shell.js`, import at the top:

```js
import { pushState, enablePush, disablePush } from "./push.js";
```

In `header()`, inside the `<div style="display:flex;align-items:center;gap:10px;">` block,
add the bell button BEFORE the sign-out button:

```js
      <button class="btn" id="pushToggle" title="Notifications" style="padding:7px 10px;font-size:13px;">🔔</button>
```

- [ ] **Step 3: Wire it.** In `js/shell.js` `wireShell()`, after the logout wiring, add:

```js
  const pb = document.getElementById("pushToggle");
  if(pb){
    pushState().then(s=>{ pb.style.opacity = s==="on" ? "1" : "0.45"; pb.title = s==="on" ? "Notifications on" : "Turn on notifications"; });
    pb.onclick = async ()=>{
      const s = await pushState();
      if(s === "on"){ await disablePush(); pb.style.opacity="0.45"; pb.title="Turn on notifications"; return; }
      const r = await enablePush();
      if(r.ok){ pb.style.opacity="1"; pb.title="Notifications on"; }
      else if(r.reason==="ios-install") alert("Open ShuttleLab from your Home Screen icon to turn on notifications.");
      else if(r.reason==="denied") alert("Notifications are blocked. Enable them for this app in your phone's settings.");
      else alert("Notifications aren't available on this device/browser.");
    };
  }
```

- [ ] **Step 4: Verify.** Run: `node --check js/push.js && node --check js/shell.js`
  Expected: no output.

- [ ] **Step 5: Commit.**

```bash
git add js/push.js js/shell.js
git commit -m "Push: client subscribe module + menu bell toggle"
```

---

## Phase 4 — Service worker + deep-link

### Task 6: `sw.js` push handlers + `app.js` `?go=`

**Files:**
- Modify: `sw.js`
- Modify: `js/app.js`

- [ ] **Step 1: Bump the cache + add handlers.** In `sw.js`, change `const CACHE = "shuttlelab-v4";`
  to `const CACHE = "shuttlelab-v5";`, then add at the END of the file:

```js
self.addEventListener("push", (e)=>{
  let d = {}; try{ d = e.data ? e.data.json() : {}; }catch(_){}
  e.waitUntil(self.registration.showNotification(d.title || "ShuttleLab", {
    body: d.body || "",
    data: { url: d.url || "/" },
    tag: d.tag || "shuttlelab",
    icon: "icons/icon-192.png",
    badge: "icons/icon-192.png"
  }));
});
self.addEventListener("notificationclick", (e)=>{
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "/";
  e.waitUntil((async ()=>{
    const all = await self.clients.matchAll({ type:"window", includeUncontrolled:true });
    for(const c of all){ if("focus" in c){ try{ await c.navigate(url); }catch(_){} return c.focus(); } }
    if(self.clients.openWindow) return self.clients.openWindow(url);
  })());
});
```

- [ ] **Step 2: Read `?go=` on load.** In `js/app.js`, inside `watchAuth`, immediately after
  the line `if(fresh) state.view = u.role==="coach" ? "team" : (u.role==="player" ? "dash" : "support");`
  add:

```js
    const go = new URLSearchParams(location.search).get("go");
    if(go && VIEWS[go]){ state.view = go; history.replaceState({}, "", location.pathname); }
```

- [ ] **Step 3: Verify.** Run: `node --check js/app.js`
  Expected: no output. (`sw.js` is a worker script; a quick `node --check sw.js` should also pass.)
  Run: `node --check sw.js`

- [ ] **Step 4: Commit.**

```bash
git add sw.js js/app.js
git commit -m "Push: service-worker push/notificationclick handlers, cache v5, ?go deep-link"
```

---

## Phase 5 — Triggers

### Task 7: Fire `notify()` after each relevant write

**Files:**
- Modify: `js/views/support.js`, `js/views/mindroom.js`, `js/views/training.js`,
  `js/views/matches.js`, `js/views/leaderboard.js`

- [ ] **Step 1: support.js — import + 3 triggers.** In `js/views/support.js`, add `notify`
  to the existing `../data.js` import. Then:
  - In `mountChat`'s `send`, change `await sendChat(channel, state.uid, t);` to:
    ```js
    await sendChat(channel, state.uid, t); notify("chat", { channelId: channel.id });
    ```
  - In `mountProgress`'s add handler, change `await addProgress(fitnessChannel, state.uid, t, n);` to:
    ```js
    await addProgress(fitnessChannel, state.uid, t, n); notify("progress", { channelId: fitnessChannel.id });
    ```
  - In `renderCoachSupport`'s chip click, after the `if(on) await provisionChannels(...)` line, add:
    ```js
        if(on) notify("assign", { playerId: p.uid, staffId: s.uid });
    ```

- [ ] **Step 2: mindroom.js — import + trigger.** In `js/views/mindroom.js`, add `notify` to
  the `../data.js` import. After `await addMessage({ fromUid:state.uid, ... });` (the
  player→coach send) add:
  ```js
          notify("mind", {});
  ```

- [ ] **Step 3: training.js — import + 2 triggers.** In `js/views/training.js`, add `notify`
  to the `../data.js` import. Then:
  - After `await postTraining({ uid:String(curUid), ... });` add:
    ```js
      notify("training", { playerId: curUid });
    ```
  - After the target save `await savePlan(curUid, { target:text, targetAt:at });` add:
    ```js
        notify("plan", { playerId: curUid });
    ```
  (Leave the block/tournament saves without a notification — the target is the
  player-facing change; YAGNI on the rest.)

- [ ] **Step 4: matches.js — import + trigger.** In `js/views/matches.js`, add `notify` to
  the `../data.js` import. After `await updateVideo(work.docId, { title:work.title, type:work.type, markers, assignedTo });` add:
  ```js
          if(assignedTo && assignedTo !== "" ) notify("film", { videoId: work.docId });
  ```

- [ ] **Step 5: leaderboard.js — import + trigger.** In `js/views/leaderboard.js`, add
  `notify` to the `../data.js` import. Change the `challenge` arrow to also notify:
  ```js
    const challenge = (defenderId)=>{ saveLadder({ order, pending:{ challengerId:meId, defenderId:String(defenderId), ts:Date.now() } }).catch(()=>{}); notify("ladder", { opponentId:String(defenderId) }); };
  ```

- [ ] **Step 6: Verify all parse.** Run:
  `for f in support mindroom training matches leaderboard; do node --check js/views/$f.js; done`
  Expected: no output.

- [ ] **Step 7: Commit.**

```bash
git add js/views/support.js js/views/mindroom.js js/views/training.js js/views/matches.js js/views/leaderboard.js
git commit -m "Push: fire notify() after chat/progress/assign/mind/training/plan/film/ladder writes"
```

---

## Phase 6 — Setup, deploy, verify

### Task 8: VAPID keys, deploy, end-to-end on iPhone

**Files:** none (operational)

- [ ] **Step 1: Generate VAPID keys.** Run: `npx web-push generate-vapid-keys`
  Copy the Public Key and Private Key it prints.

- [ ] **Step 2: Set Vercel env vars** (Vercel dashboard → Project → Settings → Environment
  Variables), for Production:
  - `VAPID_PUBLIC_KEY` = the public key
  - `VAPID_PRIVATE_KEY` = the private key
  - `VAPID_SUBJECT` = `mailto:` + a real email (e.g. `mailto:coach@shuttlelab.app`)

- [ ] **Step 3: Run the rules tests then deploy rules.**
  Run: `npm run test:rules` (expect all pass), then `npx firebase deploy --only firestore:rules`.

- [ ] **Step 4: Push to deploy the app + functions.**
  ```bash
  git push origin main
  ```
  Wait for Vercel to finish deploying (the new `/api/notify` + `/api/vapid-public` go live).

- [ ] **Step 5: Enable on a phone.** On an installed iOS PWA, open the menu → tap 🔔 →
  allow. Confirm in Firestore that `pushSubs/{yourUid}` now has a `subs` array.

- [ ] **Step 6: End-to-end per kind.** From a second account, trigger each event and confirm
  the right account gets a content-free notification and tapping opens the right page:
  - player → coach Mind Room message (coach notified)
  - support chat message (the other channel readers notified, NOT the sender)
  - coach assigns a staff member (staff notified)
  - fitness trainer logs progress (coach + player notified)
  - coach posts a training note / updates a target (player notified)
  - coach sends a film (assigned players notified)
  - ladder challenge (challenged player notified)

- [ ] **Step 7: Off + prune.** Toggle 🔔 off → confirm `subs` emptied and no more pushes.

---

## Self-review notes (author)

- **Spec coverage:** mechanism/VAPID (Tasks 2,3,8), opt-in menu toggle + iOS hint (Task 5),
  content-free sender+type (Task 3 payloads), `pushSubs` model+rule (Tasks 1,4), send
  endpoint with server-side recipients for every kind (Task 3), triggers across all views
  (Task 7), SW handlers + deep-link (Task 6), setup/deploy/verify (Task 8), scope (no quiet
  hours / inbox; never notify self — endpoint filters `me.uid`). ✓
- **Type consistency:** `notify(kind, payload)` signature matches all call sites; payload
  keys (`channelId`, `playerId`, `staffId`, `videoId`, `opponentId`) match what `api/notify.js`
  reads; `savePushSub(uid, memberId, sub)` matches `push.js`; auth-uid vs member-id handling
  documented in the Identity note and applied per kind. ✓
- **Deferred (out of scope):** per-page deep-link for the `mind` kind (opens app root —
  coach reads Mind Room messages in-app); quiet hours; multi-event mute; in-app inbox.

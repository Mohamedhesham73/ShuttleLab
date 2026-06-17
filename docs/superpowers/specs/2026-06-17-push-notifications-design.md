# Web Push notifications

**Date:** 2026-06-17
**Status:** Approved (design)
**Area:** new Vercel function `api/notify.js`, service worker `sw.js`, a client
notifications module + menu toggle, a `pushSubs` collection + rule, and small
`/api/notify` pings added after the relevant writes.

## Goal

Notify the coach, players, and support staff on their phones when something relevant
happens (a message, an assignment, a plan update, …) **without the app running in the
background** — so nobody has to open the app every day to check. Uses standard Web Push,
which the phone's OS delivers and which wakes the service worker only to show the
notification (no battery drain).

## Environment note

The entire user base is on **iPhone with the PWA already installed to the Home Screen**
(confirmed). iOS Web Push needs an installed PWA on iOS 16.4+, so this is satisfied for
everyone. The "add to Home Screen first" path is a graceful fallback, not the norm.

## Mechanism

Standard **Web Push with VAPID keys** — NOT the Firebase Cloud Messaging SDK. This plugs
directly into the existing single `sw.js` and works uniformly on installed iOS PWAs,
Android, and desktop. Server sends via the `web-push` npm package; auth reuses the
existing `verifyAuth` helper.

## Opt-in (menu toggle)

- A 🔔 **Notifications** item in the header menu (`shell.js`), shown for every signed-in
  role. States: **Off** → tap → `Notification.requestPermission()` (must be user-gesture
  triggered) → `registration.pushManager.subscribe({ userVisibleOnly:true,
  applicationServerKey: <VAPID public> })` → save the subscription → **On**. Tap again to
  unsubscribe + remove the saved subscription.
- If `Notification`/`PushManager` is unavailable, or (iOS) the app isn't running as an
  installed PWA (`navigator.standalone !== true` / not display-mode standalone), the
  toggle shows a short hint ("Open the installed app / Add to Home Screen") instead of
  failing silently.
- Lives in a new client module `js/push.js` (`enablePush()`, `disablePush()`,
  `pushState()`), wired by `shell.js`.

## Notification content (content-free)

Every push carries **sender + type only — never message text** (safe for the secret
coach↔mental channel and for lock screens; nothing sensitive passes through Apple/Google
push servers). Examples: "New message from Bassem", "Coach updated your season plan",
"You've been assigned to Koka", "Mostafa logged new fitness progress", "H challenged you
on the ladder". Payload shape: `{ title, body, url, tag }`. Tapping focuses/opens the app
at `url`.

## Data model

`pushSubs/{authUid}` — `{ memberId, subs: [ <PushSubscription JSON>, … ] }`.
- One doc per user (keyed by Firebase Auth UID); `subs` is an array so a user can have
  several devices. Subscriptions are de-duped by `endpoint`; dead ones are pruned on send.
- `memberId` (the member doc's `id` field) is stored so the send endpoint can find a
  recipient identified by member id (training/plan/film/ladder use member ids; channels
  use auth uids directly).

Security rule:
```
match /pushSubs/{uid} {
  allow read:  if false;                       // only the admin endpoint reads these
  allow write: if request.auth != null && request.auth.uid == uid;
}
```

## Send endpoint — `POST /api/notify`

Body: `{ kind, id }` (+ extra ids per kind). Flow: `verifyAuth(req)` → for the `kind`,
read Firestore via admin to **validate the caller and compute recipients**, then send a
content-free push to each recipient's subscriptions. The client never specifies
recipients, so it cannot spam arbitrary people. Best-effort: dead subs (HTTP 404/410)
are removed from the user's `pushSubs` doc.

Recipient rules per kind (caller = `verifyAuth` uid):

| kind | caller must be | recipients | body |
| --- | --- | --- | --- |
| `chat` `{channelId}` | a member of the channel | `channel.readers` minus caller (auth uids) | "New message from {callerName}" |
| `mind` | a player | all coaches (members role==coach) | "New message from {callerName}" |
| `training` `{playerId}` | coach | the player (member id → auth uid) | "New note from your coach" |
| `plan` `{playerId}` | coach | the player | "Your coach updated your season plan" |
| `film` `{videoId}` | coach | `video.assignedTo` players (or all players if "team") | "New film from your coach" |
| `assign` `{playerId, staffId}` | coach | the staff member | "You've been assigned to {playerName}" |
| `progress` `{channelId}` | the channel's `staffUid` | `channel.readers` minus caller | "New fitness progress for {playerName}" |
| `ladder` `{opponentId}` | a player | the opponent player | "{callerName} challenged you on the ladder" |

`callerName` / `playerName` come from the `members` docs (admin read). Recipients given as
member ids are resolved to subscriptions via `pushSubs where memberId == id`; recipients
given as auth uids (channel readers) via `pushSubs/{authUid}` directly.

## Client triggers

After each successful write, fire-and-forget a `POST /api/notify` (never block the user
action; `.catch(()=>{})` like `deleteR2`). A small helper `notify(kind, payload)` in
`js/data.js` attaches the Firebase ID token and posts. Call sites:
- `support.js` `sendChat` → `notify('chat',{channelId})`; `addProgress` →
  `notify('progress',{channelId})`; coach assign in `renderCoachSupport` →
  `notify('assign',{playerId,staffId})`.
- `mindroom.js` player→coach send → `notify('mind')`.
- `training.js` `postTraining` → `notify('training',{playerId})`; target/plan saves →
  `notify('plan',{playerId})`.
- `matches.js` `flmSaveBtn` (assign/send film) → `notify('film',{videoId})`.
- `leaderboard.js` challenge → `notify('ladder',{opponentId})`.

## Service worker (`sw.js`)

Add (and bump `CACHE` to `shuttlelab-v5`):
- `self.addEventListener('push', e => …)` — parse JSON payload, `showNotification(title,
  { body, data:{url}, tag, icon:'icons/icon-192.png', badge:… })`.
- `self.addEventListener('notificationclick', e => …)` — `close()`, then focus an open
  client at `url` or `clients.openWindow(url)`.

## Setup the user does once

- Generate a VAPID key pair: `npx web-push generate-vapid-keys`.
- Set in Vercel env: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`
  (`mailto:` address). The public key (not secret) reaches the client via a tiny
  `GET /api/vapid-public` endpoint returning `{ key }` — no build step needed, and the
  private key never leaves the server.
- Add `web-push` to `package.json` dependencies.
- Each user taps 🔔 in the menu once to allow notifications.

## Scope for v1 (YAGNI)

- On/off only — **no** quiet hours, **no** per-event mute, **no** in-app notification
  inbox. Easy to add later.
- Never notify a user about their **own** action (the endpoint excludes the caller).
- No notification grouping/threading beyond a per-conversation `tag`.

## Non-goals

- No email/SMS fallback.
- No Firebase Cloud Messaging SDK.
- No change to who-can-read-what (notifications are content-free and recipient logic
  mirrors the existing channel/visibility rules).

## Testing / verification

1. `web-push` payload/endpoint unit check where feasible; manual end-to-end is primary.
2. On an installed iOS PWA: toggle 🔔 on → permission granted → `pushSubs/{uid}` written.
3. Trigger each `kind` (send a chat, assign staff, post a note, etc.) from one account and
   confirm the **right** other accounts get a content-free notification, and tapping opens
   the right page.
4. Confirm the caller never notifies themselves; confirm a non-member calling `/api/notify`
   for a channel is rejected (recipient logic is server-side).
5. Turn 🔔 off → subscription removed → no more notifications.
6. Dead-subscription pruning: uninstall/clear one device, confirm sends to it stop erroring
   the others.

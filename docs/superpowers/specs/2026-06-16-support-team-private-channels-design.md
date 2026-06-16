# Support team — mental coaches & fitness trainers with private channels

**Date:** 2026-06-16
**Status:** Approved (design)
**Area:** new roles + messaging layer + Firestore security rules. Touches
`firestore.rules`, `js/data.js`, `js/app.js`, `js/shell.js`, `js/core.js`, and adds
new view module(s) under `js/views/`.

## Goal

Give each player a support team around the coach — **mental coaches** and **fitness
trainers** — who get their own restricted accounts and can only communicate, through
tightly-scoped channels, with the coach and their assigned players. One conversation is
provably secret; the rest follow a clear visibility model. Privacy is enforced by
Firestore security rules, not just by hiding UI.

## Roles & accounts

- Two new roles stored in the `members` doc `role` field: `mental_coach` and
  `fitness_trainer`. (Existing roles: `player`, `coach`.)
- **Flexible count.** The admin creates the email/password logins in the Firebase
  Console (same as players today). A new coach-only **"Support staff"** screen then sets
  each person's role and **assigns the players they cover** (one or many).
- Assignment lives on the staff member's doc: `members/{uid}.assigned = [playerUid, …]`.
  Only the coach can write `members` (existing rule), so a staff member cannot change
  their own role or assignments.
- Day-1 setup (for reference): 3 mental + 3 fitness — Koka & Mahmoud share one mental +
  one fitness; Alya has her own pair; H has his own pair.

## Channels & visibility

For each (player ↔ staff) assignment, the coach provisions channels. Visibility:

| Channel | Who writes | Who reads |
| --- | --- | --- |
| **Coach ↔ Mental coach** | coach, mental coach | coach, mental coach — **secret; player blind** |
| **Mental coach ↔ Player** | mental coach, player | mental coach, player, coach |
| **Coach ↔ Fitness trainer** | coach, fitness trainer | coach, fitness trainer, player |
| **Fitness trainer ↔ Player** | fitness trainer, player | fitness trainer, player, coach |
| **Fitness progress log** | fitness trainer | fitness trainer, player, coach |

Net effect:
- The **coach reads everything**.
- The **player** reads their mental-coach chat, both fitness threads, and the progress
  log — but **never** the coach↔mental-coach channel.
- A **staff member** sees **only** their assigned players' channels — nothing else in
  the app.
- The **only secret** in the system is Coach ↔ Mental coach. The entire fitness side is
  transparent to the player.

## Data model

New collections (existing ones unchanged except rules):

- `channels/{channelId}` — provisioned by the coach when assigning staff. Fields:
  `{ type, playerUid, staffUid, coachUid, members:[uid…], readers:[uid…], createdAt }`
  where `type ∈ { "coach_mental", "mental_player", "coach_fitness", "fitness_player" }`.
  `members` = who may post; `readers` = who may read (superset of members; for the
  secret channel `readers` excludes the player).
- `chatMessages/{id}` — `{ channelId, fromUid, text, ts, readers:[uid…] }`. On create,
  `readers` is copied from the channel so the read rule needs no `get()` (scales for
  long threads).
- `progress/{id}` — fitness progress entries: `{ playerUid, staffUid, title, note, ts,
  readers:[fitnessUid, playerUid, coachUid] }`.

`members/{uid}` gains `assigned:[playerUid…]` for staff roles.

## Security rules (the backbone)

- **Read a message:** `request.auth.uid in resource.data.readers`.
- **Create a message:** `request.resource.data.fromUid == request.auth.uid` AND the
  author is a `member` of the channel AND `request.resource.data.readers` equals the
  channel's `readers` (validated with a single `get()` on the channel doc at create).
- **Channels & progress:** channels are created/updated by the coach only. Progress
  entries are created by the assigned fitness trainer; read by `readers`.
- **Fence the new roles out of everything else.** Today most collections allow any
  signed-in user to read/write. Tighten the rules so `measurements`, `goals`, `drills`,
  `training`, `plans`, `videos`, `private`, and the existing `messages` (Mind Room)
  exclude `mental_coach` / `fitness_trainer`. A rules helper reads the caller's
  `members/{uid}` doc to get their role: `isStaff()`, `isCoach()`, `isPlayer()`.
- The secret channel is provably private: its messages carry a `readers` list without
  the player, so even a direct database query by the player returns nothing.

> Note: this modifies **live** security rules. Implementation will add the new rules and
> tighten existing ones carefully, test against each role, and deploy deliberately.

## What each person's app looks like

- **Mental coach / fitness trainer:** a stripped-down shell — no dashboard, leaderboard,
  films, drills, plans, Court Lab, or other players. A **"My players"** list (their
  assignments); tapping a player opens their channel(s). Fitness trainers also get a
  **"Progress"** tab to post dated entries. `app.js` routes these roles to this view by
  default; `shell.js` shows only the support tab(s).
- **Player:** a new **"My team"** tab → mental-coach chat, fitness-trainer chat
  (including the readable coach↔trainer thread), and a read-only progress timeline.
- **Coach:** a **"Support staff"** screen (create-assignments + manage), and from each
  player a **"Support"** area showing all four channels + the progress log.

## Components (isolation & boundaries)

- `js/data.js` — channel/message/progress CRUD + listeners (`listenChannel`,
  `sendChatMessage`, `listenProgress`, `addProgress`, `provisionChannels`,
  `setAssignment`).
- `js/views/support.js` — the staff + player support views (chat UI, progress).
- Coach "Support staff" management — a coach-only screen (in `support.js` or a small
  `js/views/staff.js`).
- `shell.js` / `app.js` — role-based nav + default view for the new roles.
- `firestore.rules` — the rules described above.

## Scope for v1 (YAGNI)

- **Text messages only.** Voice notes / images deferred (recorder + R2 already exist).
- **Progress log = dated note entries** (title + note); not wired into the test system.
  The fitness trainer does **not** see the player's fitness test results/ratings.
- **No push notifications / unread badges** in v1.
- The existing **Mind Room** (player→coach mood messages, gift jar) is untouched; this is
  a separate messaging layer.

## Non-goals

- Staff cannot see any other player's data, the leaderboard, films, drills, plans, or the
  Mind Room.
- No in-app account (login) creation — logins are made in the Firebase Console.
- No changes to the rating/test system, Court Lab, or Film Room.

## Testing / verification

Manual, per role (the app has no automated test harness):

1. **Rules unit-style checks** (Firebase rules simulator or a scratch script) for each
   collection × role: confirm a player CANNOT read a `coach_mental` message; a staff
   member CANNOT read measurements/plans/other players; the coach CAN read all channels.
2. Coach assigns a mental coach + fitness trainer to a player → channels appear for all
   parties; secret channel hidden from the player.
3. Each role logs in → sees only the intended views/tabs.
4. Messages post and appear live for exactly the intended readers.
5. Fitness progress entry shows for trainer, player, and coach; not for unrelated staff.
6. Existing features (dashboard, leaderboard, plans, films, Mind Room) still work for
   coach and players after the rule tightening.

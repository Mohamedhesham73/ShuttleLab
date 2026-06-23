# Player 360 — Design Spec

**Date:** 2026-06-23
**Status:** Approved (design), pending implementation plan
**Area:** ShuttleLab PWA — new coach-facing view

## Purpose

Give the head coach a single screen that aggregates **everything** about one
player — tests, training, season plan, assigned drills/film, ladder standing,
and support-team activity — with quick links to drill into the existing full
views. Today the coach taps a player in **Team** and lands on the test-centric
**dashboard** (`dash`); Player 360 becomes the richer landing hub, with the
dashboard kept as the deep-dive for tests.

## Scope & non-goals

- **In scope:** a new read-only aggregation view. Every section is a compact
  summary that links into the existing full view for any real work.
- **Out of scope (YAGNI):** no new writes, no new Firestore collections, no
  edits to how players see their own dashboard, no new notification kinds.
  All actions are navigation links to existing views.

## Audience & visibility

- **Coach-only.** `renderPlayer360` is guarded to `state.role === "coach"`.
  If a non-coach somehow routes to `p360`, fall back to their default view.
- Only the coach's **Team** roster links into `p360`, so players and support
  staff never reach it. This is what makes it safe to surface support-team
  ("secret" mental-channel) activity here — the coach already reads all
  channels they provisioned; nothing is exposed to a player.

## Architecture

- **New file:** `js/views/player360.js`, exporting `renderPlayer360()`.
- **Routing:** register `p360: renderPlayer360` in the `VIEWS` map in
  `js/app.js`.
- **Entry point:** in `js/views/team.js`, change the roster card tap from
  `navigate("dash", …)` to `navigate("p360", { targetId, targetName })`.
- **Within the view:**
  - **Back** → `navigate("team")`.
  - **Full test dashboard ›** → `navigate("dash", { targetId, targetName })`.
  - Section links → `support`, `library`, `matches`, `train` (carrying
    `targetId` where the destination view honors it).
- **Lifecycle:** follows the existing pattern — push all `onSnapshot`
  unsubscribes onto `state.unsub`; `clearUnsub()` on navigation handles teardown.
- The player is identified by `state.targetId` (the app data key, e.g. "1".."4"),
  consistent with every other player-keyed view.

## Sections (top to bottom)

1. **Header** — back button; avatar + name + role; FIFA **overall + tier**
   badge; last-test date; a decline flag (▼) if the latest test's overall
   dropped vs the previous session. Quick links: Full test dashboard, Support,
   Library.
2. **At-a-glance chips** — Overall · Last test date · Training sessions in the
   last 30 days · Ladder rank · Drills assigned · Films assigned.
3. **Tests & athlete** — overall, tier, and the top **▲ better** and
   **◆ focus** test, reusing `cardFromSessions` and the same better/focus
   comparison the dashboard uses. Links to the full dashboard.
4. **Training log** — the last ~5 training sessions (date + note/title), most
   recent first.
5. **Season plan** — current season target text plus a short summary of plan
   phases / tournaments.
6. **Drills & film** — drills whose `assignedTo` includes this player (count +
   latest few) and videos assigned/watched (count + latest few), each linking
   to Library / Film.
7. **Support summary** — the player's assigned mental coach and fitness trainer
   (reverse lookup over `members.assigned`), with the **last message/progress
   date** per thread. Empty/uncovered states handled gracefully ("No mental
   coach assigned yet").

## Data sources (all existing, read-only)

Keyed by the player's `id` unless noted:

- `listenMeasurements(id)` → sessions for the athlete card, better/focus, last test.
- `listenTraining(id)` → training log + 30-day count.
- `listenPlan(id)` → season target + phases.
- `listenGoals(id)` → (optional, only if a section needs it).
- `listenDrills(cb)` → filter `assignedTo` contains `id`.
- `listenVideos(cb)` → filter assigned/watched for `id`.
- `listenLadder(cb)` → ladder rank for `id`.
- `listenMyChannels(coachUid)` (keyed by **auth uid**, per the "rules are not
  filters" constraint) → filter to this player; derive last activity. Reading
  per-thread last message/progress dates may reuse `listenChat` /
  `listenProgress` or a lightweight read — exact mechanism decided at
  implementation time, but must stay query-by-`readers`-array-contains.

Reused helpers from `rating.js`: `cardFromSessions`, `tierColor`,
`overallOfSession`. Shared UI/util from `core.js`: `avatar`, `esc`, `fmtDate`,
`navigate`, `state`.

## Error & empty states

- Each section renders independently; a failed/empty listener shows a muted
  "Nothing yet" line, never blocks the rest of the page.
- Listener errors surface inline (matching `team.js` / `dashboard.js` style),
  not as a full-page failure.
- A player with no data at all still shows the header and empty section cards.

## Risks

- **Low overall** — read-only, additive, reuses established patterns.
- Main thing to verify: the support summary reads only channels the coach is
  already a reader of (no rules violation), and shows nothing for players with
  no support staff assigned (Mahmoud, H today).
- The Team → 360 routing change means the coach no longer lands directly on
  `dash`; the 360 header's "Full test dashboard" link preserves one-tap access.

## Verification

- `node --check js/views/player360.js`, `js/views/team.js`, `js/app.js`.
- Manual smoke as the coach: Team → tap player → 360 renders all sections;
  links route correctly; Back returns to Team; a player with no support staff
  shows graceful empty states.
- Confirm a non-coach cannot reach `p360`.

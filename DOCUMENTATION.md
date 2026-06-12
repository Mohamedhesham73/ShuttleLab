# ShuttleLab — Full Documentation

**Measure. Improve. Dominate.**

Live site: **https://shuttle-lab-mu.vercel.app**
Last updated: 13 June 2026

---

## 1. What ShuttleLab is

ShuttleLab is the private training platform for our badminton team — one coach
(Ahmed Salah) and his players. It runs in any browser on a phone or laptop and
can be installed like a real app. It covers the full coaching loop:

- **Measure** — log fitness-test results and watch progress over a season.
- **Plan** — season targets, dated training phases, and a tournament calendar
  per player.
- **Train** — a professional 3D drill builder (the **Pro Court**) for singles,
  doubles and mixed, plus a drill library.
- **Analyse** — a film room where the coach pins notes, drawings, slow-motion
  and his own voice onto match videos.
- **Support** — the Mind Room, a calming space that looks after the players'
  heads, not just their legs.

Everyone signs in with their own account. The coach sees the whole team;
players see themselves (and what the coach shares with them).

### Install it like an app
Open the site on a phone → browser menu → **Add to Home Screen**. It gets the
ShuttleLab icon, opens full-screen, and the app shell works even with a weak
connection. Stay signed in across visits — re-login is only needed on a new
device or after signing out.

---

## 2. Accounts & roles

| Role | Who | Tabs |
|---|---|---|
| **Coach** | Ahmed Salah | Team · Training · Library · Matches · Leaderboard · Mind Room |
| **Player** | H, KOKA, Mahmoud, Alya El Ghandour | Dashboard · Log · Training · Library · Videos · Leaderboard · Mind Room |

- Sign-in uses a **private email + password** per person (the emails are
  internal IDs like `name@shuttlelab.app`, not real mailboxes).
- The team roster (names, roles, photos) lives in the protected database — it
  is **not** visible in the site's code, and no emails ship to the browser.
- Players add their **own** test results (the coach no longer has a Log tab);
  the coach sees everything everywhere else.

---

## 3. Page-by-page guide

### 3.1 Dashboard (players; coach sees it per player via Team)
The player's progress home:
- **Trend chart** per test with a dashed gold **personal-best line** and a gold
  dot on the PB session.
- **Personal bests** — all-time best per test, the date, improvement since the
  first session, and a green **NEW PB** badge when the latest session breaks
  one ("N new PBs this session" in the header).
- **Goals** — the coach sets a target per test; progress shows against it.
- **Compare** — current values vs the previous session.
- **Export PDF** *(coach only)* — a printable report: personal bests, trend
  charts, results table, goals and signature lines. Use the browser's
  "Save as PDF" (allow pop-ups).

### 3.2 Team (coach)
The whole squad at a glance — every player's latest results per test, with
tap-through to each player's full Dashboard.

### 3.3 Log (players)
Record a test session: pick the date, enter results. Multi-attempt tests give
three boxes — the app keeps the **best and the average** automatically.

**The six tests**

| Test | Unit | Better is | Attempts |
|---|---|---|---|
| Beep test | level | higher | single |
| Vertical jump | cm | higher | 3 |
| Standing long jump | cm | higher | 3 |
| In-out agility | s | lower | 3 |
| Forward & backward court | s | lower | 3 |
| Forehand & backhand defense | s | lower | 3 |

(Tests are configurable in `js/config.js`.)

### 3.4 Training — the season-planning hub
The coach picks a player and manages three sections; the player sees them
read-only (live-updating):

1. **🎯 Season target** — one pinned goal statement for the season.
2. **🗓️ Plan phases** — dated training blocks (start → end, focus, details)
   stacked into a timeline, e.g. *"1 Jan → 1 Feb · Base endurance."*
3. **🏆 Tournaments** — the coach **stars** events from the shared schedule for
   each player. The player sees only their starred events, sorted by date,
   with a days-until countdown and a **NEXT** badge on the soonest.
   - **✎ Edit schedule** (coach): change any tournament's name, categories,
     dates or venue, add or remove events — updates the whole team's calendar.
     The 2026 federation schedule is pre-loaded.
   - **✈ Traveling?** (player): players add tournaments they're playing
     abroad — these appear on their calendar with a ✈ TRAVEL badge and are
     surfaced to the coach in a highlighted card.
4. **Messages** — a running coach → player notes thread.

### 3.5 Library — drills & the Pro Court
Two kinds of entries, both assignable to the **whole team or chosen players**
("Send to" picker). Players only see what's sent to them.

- **Text drills** — title, category (Shots/Footwork/Strength/Conditioning/
  Tactics) and description.
- **Court drills** — built in the **Pro Court** (see section 4). Cards show
  the discipline and mode (e.g. *"Doubles · Pro 3D · Multi-shuttle"*) with
  **▶ Open court** for everyone and Edit/Delete for the coach.
- **Classic courts** — the original Side Court and Solo Court remain available
  and all old saved drills still open.

### 3.6 Matches / Videos — the film room
**Coach side (Matches):**
- **Add video** by uploading a file (phone or laptop) or pasting a
  YouTube/direct link. Uploads go to our own private cloud storage with a
  live progress %, a 500 MB limit, and duplicate detection.
- Open a video to coach it:
  - **+ Note here** pins a coaching point to the exact second.
  - Per point: written note, **auto-pause**, **slow-motion** (0.5× / 0.25×),
    **drawings** on the frame (arrows/circles, colour palette), and a
    **voice note** — tap ● Record, speak the correction, and it plays in the
    player's ear automatically at that moment (🔊 Hear coach to replay).
  - **Save & send** to the team or specific players.
- **Who's watched** — per video: ✓ with date, view counts, "Not yet";
  cards show *"Seen by X/Y."*
- **🗑 Delete video** removes it for everyone and also cleans the stored files.
- Player uploads appear here flagged **"📤 Submitted by [name]."**

**Player side (Videos):** two sub-tabs —
- **From your coach** — assigned videos; playback fires the coach's notes,
  pauses, slow-mo, drawings and voice automatically.
- **My uploads** — players (e.g. abroad without the coach) upload their own
  clips for analysis; status shows *"Awaiting coach analysis"* →
  *"Coach added N coaching points."* Players can delete their own uploads.

### 3.7 Leaderboard
Rankings per test (all-time best, or Latest toggle), medals for the top three.
**Privacy:** the coach sees full names; players see the rankings and their own
highlighted place, but other players appear anonymously.

### 3.8 Mind Room — the team's quiet corner
A page that's different every single time you enter:
- Tap the glowing **door** → fall into a randomly chosen world (starry night,
  fireflies, floating lanterns, falling petals, rain) with a breathing orb to
  follow. **Tap anywhere** to scatter light. **Shake the phone** for a new
  world. (There's a hidden surprise too — tap the breathing word five times.)
- **A word for you** — a powerful encouragement in Coach Ahmed's voice,
  different each visit. The coach's **My words** jar adds his own messages to
  the rotation, signed by him.
- **Hold my hand** — a wordless calming game: pop slow bubbles, each whispers
  a kind word.
- **Leave a star** — a one-tap mood check-in that builds a private
  constellation **only that player can ever see** (stored in a private,
  owner-only space — not even the coach can read it).
- **Talk to [coach]** — sends a private note straight to the coach; only the
  sender and the coach can read it. The coach reads these under **Messages**
  in his Mind Room.

---

## 4. The Pro Court — full manual

The Pro Court is a true 3D-projected badminton court with posed athlete
figures, used for **Singles, Doubles and Mixed doubles**, in two modes:
**Drills** (rallies) and **Multi-shuttle** (coach-fed).

### 4.1 The court itself
Exact to the Laws of Badminton: 13.40 × 6.10 m, singles sidelines 0.46 m in,
net 1.524 m centre / 1.55 m posts, short service lines 1.98 m from the net,
doubles long service line 0.76 m from the baseline, 40 mm lines. Every
net-crossing shot is automatically lifted to clear the tape — nothing ever
flies through the net.

### 4.2 Cameras
Four angles, switchable any time — even mid-replay — with a smooth glide:
**🎥 Broadcast** (TV angle, default) · **Corner** · **Side** (best for arcs
and smash angles) · **Bird's-eye** (best for patterns and rotations).

### 4.3 Building a drill
1. Pick a **shot** and a **colour** (22-colour palette incl. dark tones).
2. **Tap where it's hit from** — the nearest player on that side becomes the
   hitter (shown in the hint).
3. **Tap where it lands.** The step joins the list; landings outside the legal
   court are tagged **OUT**; impossible chained shots get a ⚠ *"probably
   unreachable"* warning (it never blocks you).
4. Optional **coaching note** per shot; tap any step in the list to watch just
   that step; ✕ deletes it.

**Serves are law-enforced:** choose a serve, tap the server's position, and
the **legal diagonal service box lights up** — *long & narrow* in singles,
*short & wide* in doubles/mixed. A target outside it is refused.

### 4.4 Positioning vs choreography (important!)
- **Set start** — tap a player, tap a spot: sets their **starting lineup**.
  Never part of the drill; nothing plays. (Using **Move** before any shots
  exist does the same thing automatically.)
- **Move** — once the rally has shots: tap a player, tap a destination — a
  **real choreographed movement** that runs *during* the rally, in parallel
  with the shuttle.
- **Recover** — one tap sends the last hitter back to base.

### 4.5 How the rally plays
- Players run to the shuttle, strike with the right body action — deep lunge
  at the net, overhead arch, an airborne **jump smash**, a small hop for the
  **slice/cut drop**, a low crouch in defense — with pose blending, shadows
  and rackets.
- **Contact points are real:** the shuttle launches from the racket — a net
  shot leaves from the outstretched hand in front of the lunge, an overhead
  from above the head — never from the player's chest.
- **Rally continuity:** when the next shot is taken from where the previous
  one arrives, the shuttle **never touches the floor** — the receiver runs in
  *during* the flight and takes it out of the air. Landing rings only appear
  when a rally truly ends.
- In **1v1 singles**, real rally habits are automatic: the hitter recovers to
  base *while* the opponent covers, and defenders crouch against smashes.

### 4.6 Doubles & Mixed rotation
With a 2v2 lineup and **Auto rotate** on (default):
- An **attacking shot** (smash, drop, kill…) flows that pair into
  **front-and-back** — in level doubles whoever is nearer the net takes the
  front; **in mixed the woman always takes the front and the man the rear** —
  while the opponents flatten **side-by-side** (left player stays left).
- A **lift or clear swaps the stances.** Rotations flow during the flight.
- Turn **Auto rotate off** to choreograph every movement yourself with Move.
- Mixed pairs are marked **W / M** on court.

### 4.7 Squads
In Drills, set each side from **1 to 4 players** (e.g. **3 vs 1**, 2 vs 1
pressure drills). With more than 1v1, automatic movement steps aside — the
coach controls everything; the hitter is always the player nearest your tap.

### 4.8 Multi-shuttle
- **Place feeder** anywhere on the court (saved with the drill).
- Tap where each feed lands → tap the player's answer. The **feeder releases
  first and the player chases during the flight** — both meet at the exact
  contact point and the strike happens on arrival. No waiting, no run-up.
- **Feed rate** — Rapid / Steady / Relaxed rhythm (saved). At Rapid, several
  shuttles can be airborne at once, like a real basket session.

### 4.9 Watching
**▶ Play loops the drill again and again until you pause.** Speed control:
Fast / Normal / Slow. ↺ restarts. Tapping a step in the list loops just that
step — perfect for drilling one moment.

### 4.10 The shot library

| Shot | Contact | Flight | Body |
|---|---|---|---|
| Low serve | low, front foot | skims the tape, just past the short line | serve stance |
| High serve | low, front foot | very high, drops vertically at the back | serve stance |
| Flick serve | low, front foot | surprise arc to the back of the box | serve stance |
| Clear | overhead | high & deep to the baseline | overhead |
| Attacking clear | overhead | flatter, behind the shoulder | overhead |
| Drop shot | overhead | floats down before the short line | overhead |
| **Slice / cut drop** | high overhead | **steep & fast, near-smash** | **small hop** |
| Smash | high overhead | straight steep descent | overhead |
| Jump smash | highest point | steepest angle | full jump |
| Half smash | overhead | steep, placed | overhead |
| Drive | side-front, chest height | flat exchange | side hit |
| Push | side-front | into the mid-court gap | side hit |
| Net shot | arm outstretched at the tape | tumbles tight over | deep lunge |
| Net kill | reaching above the tape | straight down | lunge |
| Lift / lob | low, in front, under the shuttle | high to the rear | lunge |
| Block | low, in front | soft reply short | low defense |

---

## 5. Privacy & security

- **Sign-in:** Firebase Authentication; passwords never appear in the code.
  Sessions persist per browser.
- **Roster privacy:** names/roles live in the database, readable only after
  sign-in; **no emails ship in the site's code**.
- **Database rules** (enforced server-side):
  - Test data, goals, drills, training and plans: any signed-in member.
  - Shared tournament schedule & the coach's gift jar: **coach-write-only**.
  - Videos: anyone signed-in may create (players upload their own clips);
    only the coach edits content or deletes any clip; a player may delete a
    clip **they** uploaded; players may only update watched-status otherwise.
  - **Mind Room mood stars:** owner-only — nobody else, including the coach.
  - **Mind Room messages:** readable only by the sender and the coach.
- **Video storage:** private Cloudflare R2 bucket. Files are reached only via
  short-lived signed links issued to signed-in users; upload permission is
  checked server-side; deleting a video also deletes its files (coach-gated).
- **Leaderboard:** players see rankings but other players' names are hidden.

---

## 6. Technical overview (for future maintainers)

**Stack:** plain HTML/CSS/JavaScript (ES modules, no framework) · Firebase
Auth + Firestore (data) · Cloudflare R2 via Vercel serverless functions
(video/voice files) · Chart.js (charts) · PWA service worker.

**Hosting:** GitHub `Mohamedhesham73/ShuttleLab` → Vercel auto-deploys
`main`. Firebase project: `shuttlelab-174d2`.

**Key files**

| Path | What it is |
|---|---|
| `index.html` | shell, fonts, Chart.js, service-worker registration |
| `sw.js` | PWA worker (network-first, offline fallback) |
| `js/config.js` | Firebase config, tests, tournaments, upload limit, coach contact |
| `js/app.js` | auth gate, roster load, routing |
| `js/core.js` | shared state, helpers, toasts |
| `js/auth.js` / `js/firebase.js` | sign-in / Firebase setup |
| `js/data.js` | every Firestore read/write + R2 helpers |
| `js/shell.js` | header + tab navigation |
| `js/views/*.js` | one file per page (dashboard, team, log, training, library, matches, leaderboard, mindroom, login) |
| `js/court3d.js` | **the Pro Court engine** (3D cameras, figures, timeline) |
| `js/courtlab.js`, `js/sidecourt.js`, `js/solocourt.js` | legacy court engines (old saved drills) |
| `js/r2upload.js` | browser → R2 upload with progress/dedupe |
| `js/report.js` | PDF report |
| `api/r2-upload-url.js` | presigned upload URL (any signed-in member) |
| `api/r2-play-url.js` | presigned playback URL (signed-in) |
| `api/r2-delete.js` | delete stored files (coach only) |
| `api/_lib/` | R2 client + Firebase admin token verification |
| `firestore.rules` | the database rules (publish via Firebase console) |

**Firestore collections:** `members` (roster; doc ID = Auth UID),
`measurements`, `goals`, `training`, `plans` (per player + `__schedule`,
`__giftjar`), `drills`, `videos`, `private/{uid}` (mood stars),
`messages` (player→coach).

**Vercel environment variables:** `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`,
`R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `COACH_EMAILS`, `MAX_UPLOAD_MB`,
`FIREBASE_SERVICE_ACCOUNT` (full service-account JSON).

**Deploying a change:** push to `main` → Vercel builds automatically.
Database-rule changes additionally require pasting `firestore.rules` into
Firebase Console → Firestore → Rules → Publish.

---

## 7. Common admin tasks

- **Add a team member:** Firebase Console → Authentication → Add user (fake
  email + password) → copy their UID → Firestore → `members` → new doc with
  **Document ID = that UID** and fields `id` (number), `name`, `role`
  (`player`/`coach`), `photo` (optional `imgs/Name.jpeg`).
- **Change the tests:** edit `TESTS` in `js/config.js`.
- **Update tournament venues/dates:** in-app — Training → 🏆 → ✎ Edit schedule.
- **Add the coach's WhatsApp later:** set `COACH_CONTACT.whatsapp` in
  `js/config.js` (full international number, digits only).
- **Lost R2 keys:** create a new R2 API token in Cloudflare, update the two
  key variables in Vercel, redeploy.

---

## 8. Roadmap

Agreed next ideas (in rough order):
1. **Drill DNA label** — every drill auto-computes its training load (metres
   run, lunges, jumps, smashes, court-zone split, intensity).
2. **Playable drills** — players tap where they'd hit before the feed arrives;
   scored decision training with a Tactical-IQ leaderboard.
3. **On-court mode** — big step-by-step display + audible feed metronome at
   the chosen feed rate; optional coach voice per step.
4. **Shuttle-cam & player's-eye** camera presets.
5. **One-tap drill remix** — mirrored / roles swapped / faster variants.
6. **Film-room ↔ drill links** — pin a drill to a video moment: mistake →
   corrective drill in one tap.
7. Ongoing: ever-finer shot realism in the Pro Court.

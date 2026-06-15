# Court Lab — mobile expand + drag-to-aim crosshair

**Date:** 2026-06-15
**Status:** Implemented
**Area:** `js/court3d.js` — `mountProCourt` (the engine the live "Court Lab → Start
building" flow actually uses, `kind:"pro3d"`). Also ported to the legacy
`js/courtlab.js` (`mountCourtLab`, `kind:"lab"`) so old saved "lab" drills benefit too.
No data-format or save/share changes.

> Implementation note: the design was first written against `courtlab.js`, but the live
> drill builder mounts `mountProCourt` from `court3d.js` (see `js/views/library.js` —
> `openBuild("pro3d", …)`). The feature was therefore implemented in `court3d.js`. Because
> that engine is landscape-projected, **Expand** also reframes to a portrait bird's-eye
> camera (viewBox swaps to `460×820`) so the tall court fills a phone screen.

## Problem

On a phone, building a drill in the Court Lab is hard. The bird's-eye court renders at
only ~330px wide for a full 13.4m × 6.1m court, so:

1. The exact "hit from" / "lands here" tap point is tiny, and the coach's **fingertip
   covers the spot** he is aiming at.
2. When two players sit close together, the wrong one gets selected
   (`nearestPlayer` resolves to a neighbour).
3. The court is generally cramped to work in.

The coach asked for a way to enlarge the court on the phone, edit comfortably, then
shrink it back — the drill is the same either way and sends to the player as today.

## Goal

Make drill editing comfortable and precise on a phone, without changing the drill data
model, playback, or the save/share flow.

## Non-goals (YAGNI)

- Pinch-to-zoom / free pan.
- Landscape rotation.
- Any change to playback, the shot library, the stored `steps` format, or the
  save/share path.
- Desktop behaviour change beyond the shared press-drag placement (no finger offset on
  mouse).

## Approach (approved: "B")

Two cooperating additions, both inside `mountCourtLab` in `js/courtlab.js`:

### 1. Expand mode

- A new **⤢ Expand** chip placed alongside the existing view chips
  (`Bird's-eye / Side / Front`) in the top toolbar row.
- Tapping it puts the **court container** into a fullscreen state: `position:fixed;
  inset:0`, a dark backdrop, and the court `<svg>` resized to fit the screen height
  (`height:~86vh; width:auto; max-width:96vw`). Tap targets grow ~2.5×.
- All existing controls are children of the same container, so the shot `<select>`,
  Undo/Clear, and the tip line travel into the expanded view automatically and keep
  working. The step list and playback controls may stay below / scroll; they are not
  required while placing shots.
- The chip flips to **⤡ Done**; tapping restores the inline size (the prior
  `max-width` for the current view).
- Implementation: toggle inline styles on the container + set `svg.style` (mirroring how
  view-switching already sets `svg.style.maxWidth`). On collapse, restore the
  per-view `max-width` (`330px` bird, `720px` side/front). No global CSS, no DOM
  duplication.

### 2. Drag-to-aim crosshair (the fat-finger fix)

Replace the single `pointerdown` placement with **press → drag → release**, reusing the
existing `svgPoint` coordinate math (which is `getScreenCTM`-based and therefore correct
at any render size).

- Refactor `onTap(evt)` into a pure `commitPoint(courtPt)` that runs the existing
  tap-1 (`pend`) / tap-2 (`addStep`) logic. Pointer handlers compute the court point and
  call `commitPoint` on release.
- **Touch / pen** (`evt.pointerType !== "mouse"`): the live target point is computed from
  the fingertip position **shifted up ~48px in screen space** before mapping to court
  coordinates. The crosshair (ring + cross + small label "hit from" / "lands here") is
  drawn there, with a thin dashed connector line down to a faint dot at the actual
  fingertip. The target is therefore never hidden by the finger.
- **Mouse**: no offset; the crosshair sits at the pointer (precise click-drag).
- On `pointermove`, update crosshair + connector + label live. While the first
  (`pend === null`) point is being placed, highlight the **nearest player** with the
  existing dashed ring so the coach sees which player will be selected.
- On `pointerup`, call `commitPoint(target)`; the rest of the pipeline
  (`pend` → legal-serve checks → `addStep` → auto-rotation → preview) is unchanged.
- Side effect: because placement is now precise, `nearestPlayer` resolves to the
  intended player — fixing pain #2 for free.

### 3. Small details

- During editing, set the court `<svg>` `touch-action:none` so a drag-to-aim gesture
  does not scroll the page. (Currently `touch-action:manipulation`.)
- The up-shifted crosshair near the top edge clamps inside the court — already handled by
  `svgPoint`'s `Math.max/Math.min` court clamps.
- Reuse the existing `#ring` element for the nearest-player highlight; add a small
  crosshair `<g>` (ring + cross + connector + label) to the SVG template, hidden by
  default (`opacity:0`).

## Components touched (all in `js/courtlab.js`)

| Unit | Change |
| --- | --- |
| Toolbar HTML (`container.innerHTML`) | Add **⤢ Expand** chip; add crosshair `<g>` to the SVG. |
| `onTap` | Split into `commitPoint(c)` + new `pointerdown/move/up` drag handlers. |
| New `setExpanded(bool)` | Toggle fullscreen container styles + svg sizing; flip chip label. |
| New `renderCrosshair(courtPt, fingerPt, phase)` | Position crosshair, connector, label, nearest-player ring. |
| SVG wiring | Replace the single `pointerdown→onTap` listener with the drag trio; add `touch-action:none`; wire the Expand chip. |

## Data flow

Touch/mouse → `svgPoint` (offset applied for touch) → `renderCrosshair` (live, on move)
→ on release `commitPoint` → existing `pend`/`addStep` pipeline → `steps` (unchanged
shape) → existing save/share.

## Error / edge handling

- Reuses existing guards: illegal-serve box check, "shuttle must cross the net",
  out-of-court detection — all run inside `commitPoint` exactly as before.
- Multi-shuttle "training side" guard unchanged.
- Pointer capture (`setPointerCapture`) so a drag that leaves the SVG still commits
  cleanly.
- Collapsing expand mode mid-edit keeps `pend`/`steps` intact.

## Testing / verification

Manual, on a phone-sized viewport (the engine has no test harness today):

1. Expand → court fills screen; shot select + Undo/Clear reachable; Done restores size.
2. Touch-drag placement: crosshair floats above finger; connector visible; label reads
   "hit from" then "lands here"; release commits at the crosshair, not the fingertip.
3. Two close players: dragging the "hit from" point highlights and selects the intended
   one.
4. Mouse placement on desktop: no offset, precise, still works.
5. Serve still validates against the legal box; out-of-court still flagged; auto-rotation
   and playback unchanged.
6. Save the drill and confirm it sends/loads as before (data format untouched).

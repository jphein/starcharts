# Editable goal with magical starlight overhaul

**Issue:** [#44](https://github.com/jphein/starcharts/issues/44) — allow editing the goal count on an existing chart.

**Status:** design approved verbally 2026-05-06; pending spec review before plan + implementation.

## Problem

`goalCount` is set at chart creation and effectively immutable: the `charts.update` perm rule allows only `completedAt` writes, and there's no UI affordance. Clay (and likely other groups) want to retune the goal mid-chart when it turns out too easy or too ambitious.

## Solution shape

Three coupled changes, landing together in one PR:

1. **Permission rule** — extend `charts.update` to permit a `goalCount`-only write by group members on charts that haven't completed yet.
2. **Inline edit affordance** — tap the `X / goalCount` capsule in `ChartSky`'s top bar to swap the `goalCount` numeral for an input. Mirrors the click-to-rename pattern in `Dashboard.tsx:174-218`.
3. **Magical animation overhaul** — the goal display gains a permanent enchanted presence (aura on the numeral, starlight fill bar, slow drifting motes) and editing triggers a small ceremony that reaches into the surrounding sky.

The third item is the one that makes the editing moment feel native to the chart sky — the goal is the brightest star in the field, and changing it is a small ritual.

## Permission rule

Extend `app/src/instant.perms.ts` `charts.update`. The existing `completedAt`-only clause stays untouched. Add an OR with a `goalCount`-only clause:

```
update:
  "auth.id != null && " +
  "auth.id in data.ref('group.members.id') && " +
  "(" +
  "  (request.modifiedFields.all(field, field == 'completedAt') && " +
  "   data.completedAt == null && " +
  "   newData.completedAt != null) " +
  "  || " +
  "  (request.modifiedFields.all(field, field == 'goalCount') && " +
  "   data.completedAt == null && " +
  "   newData.goalCount > 0)" +
  ")"
```

**Why these constraints:**

- `modifiedFields.all` keeps each clause field-pinned. A partial `update({ goalCount })` puts only `goalCount` in the modified set; nothing else can ride along.
- `data.completedAt == null` blocks goal edits on completed charts. Per the v1 design brief, completed charts become memories — their goal is a recorded fact, not editable.
- `newData.goalCount > 0` is the rule-level integrity guard. The "must be ≥ current total stars" guardrail is enforced UI-side because rules can't cheaply aggregate `gifts.count` for a chart.
- History entry added at the top of `instant.perms.ts` describing this clause.

CI auto-pushes perms on merge to main (commit `b143d0c`), so no manual `npx instant-cli push perms` step.

## UI surfaces

### `components/StarlightFill.tsx` (new)

A thin (~4px) glowing bar that sits beneath the X / goalCount text. Pure presentational.

- **Props:** `value: number`, `goal: number`, `editing?: boolean`, `belowMin?: boolean`.
- **Width:** filled portion = `clamp(value / goal, 0, 1) * 100%`, animated via `@react-spring/web useSpring` so live edits glide between target ratios without juddering.
- **Visual:** linear gradient `var(--sc-gold)` → soft white at the leading edge; brighter pulsing "comet head" on the right edge of the fill (framer-motion opacity 0.6→1→0.6 over 1.4s).
- **Motes:** 2 motes idle, 5 motes when `editing`. Each is a small `motion.div` with `box-shadow` glow, drifting sinusoidally along the fill (same vocabulary as `Star.tsx:44-49`'s drift).
- **`belowMin` state:** clamps fill at 100%, leading edge desaturates to dim copper, pulse speeds up — visual signal that the input value isn't accepted.
- **Reduced motion:** static fill, no motes, no pulse — bar still expresses the ratio.

### `components/GoalCapsule.tsx` (new)

Replaces the existing `<div style={progressStyle}>` block in `ChartSky.tsx:572-576`. Owns the goal display, the inline edit, and the aura/mote affordances. Stateful but local — no global plumbing.

- **Idle render:** `X / goalCount` text + StarlightFill underneath. The `goalCount` numeral has a `drop-shadow` aura that twinkles (opacity 0.85→1→0.85, 2.5s — Star.tsx vocabulary). At fill ≥ 50% the aura widens; at ≥ 90% a faint halo orbits the capsule; at 100% the bar shimmers white-gold.
- **Tap → edit:** capsule scales 1 → 1.05 → 1 (~400ms summon). The `goalCount` span swaps for a numeric `<input>` with the same serif italic styling. 6 fresh motes spawn from the goalCount glyph and orbit the capsule. Fires `onEditingChange(true)` so ChartSky can dim the sky.
- **Live editing:** as the user types, the StarlightFill spring updates. The lower-bound check (`newGoal < currentTotal`) drives the `belowMin` state on StarlightFill and reveals an italic caption beneath the input: "needs at least N to keep your stars." Enter is disabled while `belowMin`.
- **Commit (Enter):** motes converge inward; a gold radial pulse expands outward from the numeral; `onCommit(newGoal)` fires. The `onCommit` prop returns a `Promise` (parent runs `db.transact(charts[id].update({ goalCount }))` and returns the transact promise). GoalCapsule awaits it and then sets local `editing` to `false`; the displayed numeral reflects whatever `chart.goalCount` is on the next render (driven by the realtime echo, not the local draft).
- **Cancel (Esc / blur with no commit):** motes scatter, capsule reverts. No transact.
- **Completed charts:** if `chart.completedAt != null`, capsule renders read-only — no tap target, no aura pulse. Matches the perm rule: editing isn't allowed once completed.
- **Reduced motion:** aura still glows but doesn't pulse, no motes, no orbiting halo, no scale bounce. Edit still works; the StarlightFill spring runs with `immediate: true` so the bar snaps to its target width without animating.

### `screens/ChartSky.tsx` integration

- Replace the inline progress div with `<GoalCapsule chart={chart} totalCount={totalCount} onCommit={...} onEditingChange={setEditing}/>`.
- Add a sibling overlay `<SkyEditOverlay editing={editing}/>` mounted when `editing === true`. Two responsibilities:
  1. Apply a `~25% opacity` filter (or a `motion.div` with `mix-blend-multiply` at low alpha) over the canvas/Sky wrapper so the goal capsule visually claims focus.
  2. Render 4–6 inward-tracing starlight threads from canvas edges toward the capsule centre — thin `motion.div` lines animating along straight paths, each looping (`repeat: Infinity`) for as long as the overlay is mounted.
- Wrap the existing canvas in a ref-tagged element so the overlay knows the bounds.
- The existing pan / cluster-drag pointer handlers must not fire while `editing === true` — gate the `handlePointerDown` early-return on `editing`.

## Data flow

```
GoalCapsule (local state: editing, draftValue)
  ├─ tap → editing=true → onEditingChange(true) → ChartSky mounts SkyEditOverlay
  ├─ keystroke → draftValue updates → StarlightFill spring re-targets
  ├─ Enter (valid) → onCommit(draftValue)
  │     └─ ChartSky → db.transact(charts[id].update({ goalCount }))
  │           └─ realtime echoes → useChart returns new goalCount → GoalCapsule re-renders idle
  │                 └─ editing=false → SkyEditOverlay unmounts
  └─ Esc/blur → editing=false → SkyEditOverlay unmounts, no transact
```

The chart row is the source of truth — the optimistic local draft is discarded on commit; the rendered capsule reflects whatever `chart.goalCount` becomes after InstantDB confirms.

## Error handling

- **Permission denied** (e.g., chart completed between render and commit): catch the rejected `db.transact` promise. Reset `draftValue` to `chart.goalCount`, exit editing, log to console. Don't show a modal — the capsule snapping back is sufficient feedback for the rare race.
- **Network failure**: InstantDB queues offline; the optimistic state holds until reconnect. No special handling.
- **Below-min input**: handled UI-side before commit (Enter disabled). Cannot reach the transact.

## Testing

The project doesn't have a test framework (per CLAUDE.md it's not a test-suite project). Verification is manual in the dev server:

- Tap the goal → input appears, motes spawn, sky dims.
- Type a new value above current total → bar springs, no caption, Enter commits, capsule settles to new fill.
- Type a value below current total → caption appears, Enter no-ops with a red pulse, Esc reverts.
- Type 0 or negative → caption appears (perm rule would also reject if it leaked through).
- Refresh — new goal persists.
- Complete a chart, navigate back → goal capsule has no edit affordance.
- Toggle OS reduced-motion → no pulses, no motes, no orbiting; tap-to-edit still works.

## Out of scope

- FAB / gift arrival / celebrate animation polish — separate issue if at all.
- Goal-edit history (audit log of who changed the goal when) — not requested in #44.
- Lowering goal to exactly currentTotal: allowed; the chart will auto-complete on the next gift via the existing `GiftFlow.tsx:234` check. Not making this its own ceremony in v1.

## Files touched

- `app/src/instant.perms.ts` — perm clause + history entry.
- `app/src/components/StarlightFill.tsx` — new.
- `app/src/components/GoalCapsule.tsx` — new.
- `app/src/screens/ChartSky.tsx` — replace progress div, add SkyEditOverlay sibling, gate pan handler on editing flag.

## Risks

- **Pan gesture conflicting with edit input** — addressed by gating `handlePointerDown` on `editing` and ensuring the input lives inside a stop-propagation wrapper.
- **Aura pulse vestibular issues** — addressed by `useReducedMotion` honoring everywhere the new components animate.
- **Permission rule typo** — InstantDB rule errors are silent at write time (the transact rejects with a generic "permission denied"). Mitigation: test the new clause path in the dev server before merging.

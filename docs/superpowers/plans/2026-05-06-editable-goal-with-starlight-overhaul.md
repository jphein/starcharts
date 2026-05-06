# Editable goal with magical starlight overhaul — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let group members retune `goalCount` on an existing chart from the chart-sky header, with a magical edit ceremony that integrates with the surrounding sky.

**Architecture:** Extend `charts.update` perm rule with a `goalCount`-only clause. Add two new presentational components (`StarlightFill`, `GoalCapsule`) and one overlay (`SkyEditOverlay`) into `ChartSky`. Animation built from the project's existing vocabulary — framer-motion for orchestration, `@react-spring/web` for value-driven fill ratios, `useReducedMotion` for accessibility everywhere.

**Tech Stack:** React 19, TypeScript, framer-motion 12, @react-spring/web 10, InstantDB perms (string-based rule language).

**Spec:** `docs/superpowers/specs/2026-05-06-editable-goal-with-starlight-overhaul-design.md` — read first; this plan executes that spec and assumes knowledge of its component contracts.

**Testing note:** Starcharts has no test framework. Per project CLAUDE.md, don't add one unprompted. Each task ends with manual verification in `npm run dev` against documented expectations, not automated tests.

---

## File structure

| Path | Action | Responsibility |
|---|---|---|
| `app/src/instant.perms.ts` | modify | add `goalCount`-only clause to `charts.update`; history entry |
| `app/src/components/StarlightFill.tsx` | create | thin glowing fill bar; props `value`, `goal`, `editing`, `belowMin` |
| `app/src/components/GoalCapsule.tsx` | create | `X / goalCount` text + aura + StarlightFill; tap-to-edit; commit/cancel |
| `app/src/components/SkyEditOverlay.tsx` | create | dim canvas + inward starlight threads while editing |
| `app/src/screens/ChartSky.tsx` | modify | replace progress div with `<GoalCapsule>`; mount overlay; gate pan handler on editing |

No new dependencies — `framer-motion` and `@react-spring/web` are already in `app/package.json`.

---

### Task 1: Add `goalCount`-only clause to `charts.update` perm rule

**Files:**
- Modify: `app/src/instant.perms.ts:172-219` (the `charts` rule block) and the history-entry comment block at the top.

- [ ] **Step 1: Add the history entry**

Insert this new entry above `2026-05-05 — opened gifts.update for x/y-only repositioning` (so entries stay in newest-on-top order; the existing 2026-05-05 above the gifts comment can stay where it is).

```ts
//   2026-05-06 — opened charts.update for goalCount-only writes by group
//                members (issue #44). Original chart contract was "everything
//                immutable except completedAt" — practice showed groups want
//                to retune the goal mid-chart when it turns out too easy or
//                too ambitious. The new clause sits beside the completedAt
//                clause inside one OR-grouped expression: a partial update
//                of just `goalCount` passes when the chart hasn't completed
//                yet and the new value is positive. The "must be ≥ current
//                star total" guardrail is enforced UI-side because rules
//                can't cheaply aggregate gift counts; rule-side stays at
//                "positive integer, chart not completed."
```

- [ ] **Step 2: Replace the `charts.update` rule body**

Locate the existing `update` field (currently lines ~208-213):

```ts
      update:
        "auth.id != null && " +
        "auth.id in data.ref('group.members.id') && " +
        "request.modifiedFields.all(field, field == 'completedAt') && " +
        "data.completedAt == null && " +
        "newData.completedAt != null",
```

Replace with:

```ts
      // Members can update with two narrow paths:
      //   1. completedAt-only: a one-way transition from null to a timestamp.
      //      Fires when the goal is reached. Once stamped, the chart is
      //      memory-mode and immutable.
      //   2. goalCount-only: retune the goal mid-chart (issue #44). Allowed
      //      only while the chart is incomplete; the new value must be
      //      positive. The "≥ current star total" floor is UI-enforced.
      // The OR-group sits inside the membership check so non-members can't
      // hit either path.
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
        ")",
```

- [ ] **Step 3: Type-check**

Run: `cd app && npx tsc -b --noEmit`
Expected: no errors. (`InstantRules` `satisfies` constraint on the rules object validates the rule string at the type level — InstantDB doesn't typecheck the *contents* of the rule string but ensures the shape is correct.)

- [ ] **Step 4: Commit**

```bash
git add app/src/instant.perms.ts
git commit -m "feat(perms): allow goalCount-only writes on charts.update (refs #44)

Mirrors the modifiedFields.all pattern used for completedAt and the
groups.update rename clause. Members can retune the goal mid-chart;
the chart must still be incomplete and the new value must be positive.
Lower-bound 'must be >= current star total' guardrail is UI-enforced.

CI auto-pushes perms on merge to main."
```

CI handles the `npx instant-cli push perms` on merge (see commit `b143d0c`). No manual push.

---

### Task 2: Create `StarlightFill` component

**Files:**
- Create: `app/src/components/StarlightFill.tsx`

- [ ] **Step 1: Write the component**

```tsx
// A thin glowing progress bar — the magical fill under the X / goalCount
// text in ChartSky's header. Pure presentational: parent feeds value/goal,
// component animates its width to match. Gradient + leading-edge pulse +
// drifting motes are built from the same vocabulary as Star.tsx.

import { useMemo, type CSSProperties } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useSpring, animated } from "@react-spring/web";

interface StarlightFillProps {
  value: number;
  goal: number;
  editing?: boolean;
  belowMin?: boolean;
}

export function StarlightFill({
  value,
  goal,
  editing = false,
  belowMin = false,
}: StarlightFillProps) {
  const prefersReducedMotion = useReducedMotion();

  // Clamp ratio. When belowMin, stay visually full so the bar reads "at
  // capacity, can't go lower" — the leading-edge desat communicates the
  // rejected-input state.
  const ratio = belowMin
    ? 1
    : Math.max(0, Math.min(1, goal > 0 ? value / goal : 0));

  const spring = useSpring({
    width: `${ratio * 100}%`,
    config: { mass: 1, tension: 220, friction: 28 },
    immediate: !!prefersReducedMotion,
  });

  // Mote count: 2 idle, 5 editing, 0 reduced-motion. Deterministic offsets
  // so they don't reseed across re-renders.
  const moteCount = prefersReducedMotion ? 0 : editing ? 5 : 2;
  const motes = useMemo(
    () =>
      Array.from({ length: moteCount }, (_, i) => ({
        leftPct: 12 + i * (76 / Math.max(moteCount - 1, 1)),
        delay: i * 0.6,
        size: 2 + (i % 2),
      })),
    [moteCount],
  );

  const trackStyle: CSSProperties = {
    position: "relative",
    width: "100%",
    height: 3,
    borderRadius: 999,
    background: "rgba(245, 196, 107, 0.12)",
    overflow: "visible",
  };

  const fillStyle: CSSProperties = {
    position: "absolute",
    top: 0,
    left: 0,
    height: "100%",
    borderRadius: 999,
    background: belowMin
      ? "linear-gradient(90deg, rgba(180, 110, 60, 0.7) 0%, rgba(220, 150, 90, 0.95) 100%)"
      : "linear-gradient(90deg, rgba(245, 196, 107, 0.65) 0%, rgba(255, 240, 200, 1) 100%)",
    boxShadow: belowMin
      ? "0 0 6px rgba(220, 150, 90, 0.45)"
      : "0 0 8px rgba(245, 196, 107, 0.55)",
  };

  return (
    <div style={trackStyle} aria-hidden="true">
      <animated.div style={{ ...fillStyle, width: spring.width }}>
        {/* Leading-edge pulse — sits at the right of the fill */}
        {!prefersReducedMotion && (
          <motion.span
            style={{
              position: "absolute",
              right: -3,
              top: -2,
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: belowMin
                ? "rgba(255, 200, 140, 0.95)"
                : "rgba(255, 245, 215, 1)",
              boxShadow: belowMin
                ? "0 0 10px 3px rgba(220, 150, 90, 0.6)"
                : "0 0 12px 4px rgba(255, 235, 180, 0.75)",
            }}
            animate={{ opacity: [0.6, 1, 0.6] }}
            transition={{
              duration: belowMin ? 0.8 : 1.4,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        )}
      </animated.div>

      {/* Motes drift along the *track*, but only those whose leftPct is
          inside the current ratio appear lit. Drift uses the Star.tsx
          sinusoidal vocabulary. */}
      {motes.map((m, i) =>
        m.leftPct / 100 <= ratio ? (
          <motion.span
            key={i}
            style={{
              position: "absolute",
              top: -1,
              left: `${m.leftPct}%`,
              width: m.size,
              height: m.size,
              borderRadius: "50%",
              background: "rgba(255, 245, 215, 0.95)",
              boxShadow: "0 0 6px rgba(255, 235, 180, 0.7)",
              pointerEvents: "none",
            }}
            animate={{ x: [0, 4, -4, 0], y: [0, -2, 2, 0], opacity: [0.6, 1, 0.6] }}
            transition={{
              x: { duration: 6, repeat: Infinity, delay: m.delay, ease: "easeInOut" },
              y: { duration: 6, repeat: Infinity, delay: m.delay, ease: "easeInOut" },
              opacity: { duration: 2.5, repeat: Infinity, delay: m.delay, ease: "easeInOut" },
            }}
          />
        ) : null,
      )}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `cd app && npx tsc -b --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit (do not run dev server yet — component isn't mounted anywhere)**

```bash
git add app/src/components/StarlightFill.tsx
git commit -m "feat(charts): add StarlightFill component

Thin glowing progress bar for the chart-sky goal display. Presentational
only — width animates via react-spring useSpring; framer-motion handles
the leading-edge pulse and mote drift. Honors useReducedMotion (no pulse,
no motes). belowMin prop drives a desaturated visual for rejected goal
edits. Not yet mounted; wired up in upcoming GoalCapsule task."
```

---

### Task 3: Create `GoalCapsule` component (idle render only)

**Files:**
- Create: `app/src/components/GoalCapsule.tsx`

This task implements only the idle (non-editing) render. Edit interaction lands in Task 4.

- [ ] **Step 1: Write the idle-state component**

```tsx
// The X / goalCount header chip on ChartSky, with magical aura + starlight
// fill underneath. Tap to edit. Owns its own editing state; parent feeds
// commit handler and the live total.

import { useState, useEffect, useRef, type CSSProperties } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { StarlightFill } from "./StarlightFill";

export interface GoalCapsuleProps {
  totalCount: number;
  goalCount: number;
  completed: boolean;
  /** Returns a Promise that resolves once the transact lands. */
  onCommit: (newGoal: number) => Promise<void>;
  /** Fires whenever the editing state flips, so ChartSky can mount/unmount the sky overlay. */
  onEditingChange?: (editing: boolean) => void;
}

export function GoalCapsule({
  totalCount,
  goalCount,
  completed,
  onCommit,
  onEditingChange,
}: GoalCapsuleProps) {
  const prefersReducedMotion = useReducedMotion();
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    onEditingChange?.(editing);
  }, [editing, onEditingChange]);

  const ratio = goalCount > 0 ? totalCount / goalCount : 0;
  const auraStrong = ratio >= 0.5;
  const auraIntense = ratio >= 0.9;

  const auraOpacity = auraIntense ? 0.85 : auraStrong ? 0.65 : 0.4;
  const auraRadius = auraIntense ? 14 : auraStrong ? 10 : 7;

  const numeralAnimate =
    prefersReducedMotion
      ? { opacity: 1 }
      : { opacity: [0.85, 1, 0.85] };

  const numeralTransition =
    prefersReducedMotion
      ? { duration: 0 }
      : { duration: 2.5, repeat: Infinity, ease: "easeInOut" as const };

  return (
    <div style={wrapStyle} aria-label="Star progress">
      <div style={rowStyle}>
        <span style={numStyle}>{totalCount}</span>
        <span style={sepStyle}> / </span>
        <motion.span
          style={{
            ...numStyle,
            filter: `drop-shadow(0 0 ${auraRadius}px rgba(255, 235, 180, ${auraOpacity}))`,
            cursor: completed ? "default" : "pointer",
          }}
          animate={numeralAnimate}
          transition={numeralTransition}
          // tap binding lands in Task 4
        >
          {goalCount}
        </motion.span>
      </div>
      <div style={fillSlotStyle}>
        <StarlightFill value={totalCount} goal={goalCount} editing={editing} />
      </div>
    </div>
  );
}

const wrapStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  flexShrink: 0,
  minWidth: 92,
};

const rowStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "baseline",
  fontFamily: "var(--sc-sans)",
  fontSize: 13,
  letterSpacing: "0.04em",
  color: "var(--sc-gold)",
};

const numStyle: CSSProperties = {
  fontVariantNumeric: "tabular-nums",
  display: "inline-block",
};

const sepStyle: CSSProperties = {
  margin: "0 4px",
  opacity: 0.6,
};

const fillSlotStyle: CSSProperties = {
  width: "100%",
};

// onCommit kept in the signature so the import doesn't dangle when Task 4
// wires it; suppress the unused warning until then.
void GoalCapsule;
void ((onCommit: GoalCapsuleProps["onCommit"]) => onCommit);
```

> **Note:** the trailing `void` block exists only to satisfy `noUnusedParameters` between this task and Task 4. Remove it in Task 4 when `onCommit` actually gets called.

- [ ] **Step 2: Type-check**

Run: `cd app && npx tsc -b --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/src/components/GoalCapsule.tsx
git commit -m "feat(charts): add GoalCapsule idle render

X / goalCount header chip with aura on the goal numeral and a
StarlightFill bar underneath. Aura intensifies past 50% and 90%.
Edit interaction (tap-to-input) lands in the next commit."
```

---

### Task 4: Add edit interaction + lower-bound guardrail to `GoalCapsule`

**Files:**
- Modify: `app/src/components/GoalCapsule.tsx`

- [ ] **Step 1: Add input refs, draft state, and handlers**

Replace the whole component body with:

```tsx
export function GoalCapsule({
  totalCount,
  goalCount,
  completed,
  onCommit,
  onEditingChange,
}: GoalCapsuleProps) {
  const prefersReducedMotion = useReducedMotion();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>(String(goalCount));
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const committedRef = useRef(false);

  useEffect(() => {
    onEditingChange?.(editing);
  }, [editing, onEditingChange]);

  // Reset the draft when goalCount changes externally (realtime echo).
  useEffect(() => {
    if (!editing) setDraft(String(goalCount));
  }, [goalCount, editing]);

  const ratio = goalCount > 0 ? totalCount / goalCount : 0;
  const auraStrong = ratio >= 0.5;
  const auraIntense = ratio >= 0.9;
  const auraOpacity = auraIntense ? 0.85 : auraStrong ? 0.65 : 0.4;
  const auraRadius = auraIntense ? 14 : auraStrong ? 10 : 7;

  const parsedDraft = Number.parseInt(draft, 10);
  const draftValid =
    Number.isFinite(parsedDraft) && parsedDraft > 0 && parsedDraft >= totalCount;
  const belowMin =
    editing && Number.isFinite(parsedDraft) && parsedDraft < totalCount;

  const liveValue = editing && draftValid ? parsedDraft : goalCount;

  const beginEdit = () => {
    if (completed || editing) return;
    committedRef.current = false;
    setDraft(String(goalCount));
    setEditing(true);
    requestAnimationFrame(() => inputRef.current?.select());
  };

  const cancelEdit = () => {
    setDraft(String(goalCount));
    setEditing(false);
  };

  const commitEdit = async () => {
    if (!draftValid || submitting || parsedDraft === goalCount) {
      // No-op commits (unchanged value, invalid input) just exit edit mode.
      setEditing(false);
      return;
    }
    committedRef.current = true;
    setSubmitting(true);
    try {
      await onCommit(parsedDraft);
    } catch {
      // Swallow — revert the visible value via the realtime echo.
      setDraft(String(goalCount));
    } finally {
      setSubmitting(false);
      setEditing(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void commitEdit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelEdit();
    }
  };

  const onBlur = () => {
    if (!committedRef.current) cancelEdit();
  };

  const numeralAnimate = prefersReducedMotion
    ? { opacity: 1 }
    : { opacity: [0.85, 1, 0.85] };
  const numeralTransition = prefersReducedMotion
    ? { duration: 0 }
    : { duration: 2.5, repeat: Infinity, ease: "easeInOut" as const };

  return (
    <div style={wrapStyle} aria-label="Star progress">
      <div style={rowStyle}>
        <span style={numStyle}>{totalCount}</span>
        <span style={sepStyle}> / </span>
        {editing ? (
          <input
            ref={inputRef}
            type="number"
            inputMode="numeric"
            min={1}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            onBlur={onBlur}
            disabled={submitting}
            aria-label="Edit goal stars"
            style={{
              ...numStyle,
              width: `${Math.max(draft.length, 2)}ch`,
              minWidth: 36,
              background: "transparent",
              border: "none",
              borderBottom: "1.5px solid var(--sc-gold)",
              color: "var(--sc-gold)",
              outline: "none",
              padding: "0 2px",
              fontSize: 13,
              letterSpacing: "0.04em",
              filter: `drop-shadow(0 0 ${auraRadius}px rgba(255, 235, 180, ${auraOpacity}))`,
            }}
          />
        ) : (
          <motion.span
            role={completed ? undefined : "button"}
            tabIndex={completed ? undefined : 0}
            onClick={beginEdit}
            onKeyDown={(e) => {
              if (completed) return;
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                beginEdit();
              }
            }}
            title={completed ? undefined : "Click to retune the goal"}
            style={{
              ...numStyle,
              filter: `drop-shadow(0 0 ${auraRadius}px rgba(255, 235, 180, ${auraOpacity}))`,
              cursor: completed ? "default" : "pointer",
            }}
            animate={numeralAnimate}
            transition={numeralTransition}
          >
            {goalCount}
          </motion.span>
        )}
      </div>

      <div style={fillSlotStyle}>
        <StarlightFill
          value={liveValue}
          goal={Math.max(parsedDraft || goalCount, 1)}
          editing={editing}
          belowMin={belowMin}
        />
      </div>

      {belowMin && (
        <span style={captionStyle} role="status">
          needs at least {totalCount} to keep your stars
        </span>
      )}
    </div>
  );
}
```

Add this to the bottom of the file alongside the other style consts:

```tsx
const captionStyle: CSSProperties = {
  marginTop: 4,
  fontFamily: "var(--sc-serif)",
  fontStyle: "italic",
  fontSize: 11,
  color: "var(--sc-gold)",
  opacity: 0.85,
};
```

Also remove the trailing `void` placeholder from Task 3.

- [ ] **Step 2: Type-check**

Run: `cd app && npx tsc -b --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/src/components/GoalCapsule.tsx
git commit -m "feat(charts): add tap-to-edit + lower-bound guardrail to GoalCapsule

Tap the goalCount numeral → numeric input. Enter commits via the parent
onCommit promise; Esc/blur cancels. Below-minimum drafts (newGoal <
currentTotal) clamp the StarlightFill at full, desaturate the leading
edge, and surface an inline italic caption. Completed charts skip the
edit affordance entirely. The bar fill tracks the in-progress draft
when valid so retuning visually previews."
```

---

### Task 5: Add edit-ceremony scale bounce to `GoalCapsule`

**Files:**
- Modify: `app/src/components/GoalCapsule.tsx`

- [ ] **Step 1: Wrap the row in a `motion.div` with a one-shot scale bounce**

In the JSX, replace the existing `<div style={rowStyle}>...` opening with a `motion.div` that animates a one-shot scale on edit-enter:

```tsx
<motion.div
  style={rowStyle}
  animate={editing && !prefersReducedMotion ? { scale: [1, 1.05, 1] } : { scale: 1 }}
  transition={{ duration: 0.4, ease: "easeOut" }}
>
```

(Close it with `</motion.div>` at the matching position.)

- [ ] **Step 2: Type-check + smoke test**

Run: `cd app && npx tsc -b --noEmit`
Expected: no errors.

Run: `cd app && npm run dev`
Expected: dev server starts on `http://localhost:5173` (or 5174). Open in browser. (Verification of behavior happens in Task 9.)

- [ ] **Step 3: Commit**

```bash
git add app/src/components/GoalCapsule.tsx
git commit -m "feat(charts): add summon scale bounce to GoalCapsule edit entry

The X / goalCount row scales 1 → 1.05 → 1 over 400ms when the input
opens, giving the edit moment a small ceremonial beat. Suppressed under
useReducedMotion."
```

---

### Task 6: Create `SkyEditOverlay` component

**Files:**
- Create: `app/src/components/SkyEditOverlay.tsx`

- [ ] **Step 1: Write the component**

```tsx
// Renders only while the goal is being edited. Two responsibilities:
//   1. Dim the sky behind so the goal capsule visually claims focus.
//   2. Trace 6 thin starlight threads from the canvas edges toward a
//      capsule-shaped area near the top-right of the viewport — the
//      sky participates in the edit moment.
//
// Pointer-events disabled so the underlying scene still receives gestures
// where they're allowed (the GoalCapsule input itself is on top of this).

import { useMemo, type CSSProperties } from "react";
import { motion, useReducedMotion } from "framer-motion";

interface SkyEditOverlayProps {
  /** Mounted-or-not is decided by the parent. Set true to fade in. */
  visible: boolean;
}

const THREAD_COUNT = 6;

export function SkyEditOverlay({ visible }: SkyEditOverlayProps) {
  const prefersReducedMotion = useReducedMotion();

  // Six straight paths from random edge anchors to the top-right capsule
  // area. Memoized so threads keep their identity across re-renders.
  const threads = useMemo(() => {
    const items: { x1: string; y1: string; angle: number; delay: number }[] = [];
    for (let i = 0; i < THREAD_COUNT; i++) {
      const t = i / THREAD_COUNT;
      // Distribute around the perimeter — bias toward top + left so threads
      // sweep into the top-right-anchored capsule.
      const xPct = (t * 90 + 5) % 100;
      const yPct = ((t * 220 + 17) % 60) + 10;
      const dx = 90 - xPct;
      const dy = 8 - yPct;
      const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
      items.push({
        x1: `${xPct}vw`,
        y1: `${yPct}vh`,
        angle,
        delay: i * 0.4,
      });
    }
    return items;
  }, []);

  if (prefersReducedMotion) {
    return (
      <div
        aria-hidden="true"
        style={{
          ...overlayStyle,
          opacity: visible ? 1 : 0,
          background: "rgba(0, 0, 0, 0.18)",
          transition: "opacity 200ms ease",
        }}
      />
    );
  }

  return (
    <motion.div
      aria-hidden="true"
      style={overlayStyle}
      animate={{ opacity: visible ? 1 : 0 }}
      transition={{ duration: 0.35 }}
    >
      <div style={dimLayerStyle} />
      {threads.map((th, i) => (
        <motion.span
          key={i}
          style={{
            position: "absolute",
            left: th.x1,
            top: th.y1,
            width: 0,
            height: 1.5,
            transform: `rotate(${th.angle}deg)`,
            transformOrigin: "0 50%",
            background:
              "linear-gradient(90deg, rgba(255, 235, 180, 0) 0%, rgba(255, 235, 180, 0.85) 70%, rgba(255, 245, 215, 1) 100%)",
            boxShadow: "0 0 6px rgba(255, 235, 180, 0.6)",
            pointerEvents: "none",
          }}
          animate={{ width: ["0vw", "55vw", "0vw"], opacity: [0, 0.9, 0] }}
          transition={{
            duration: 3.2,
            repeat: Infinity,
            ease: "easeInOut",
            delay: th.delay,
          }}
        />
      ))}
    </motion.div>
  );
}

const overlayStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  pointerEvents: "none",
  zIndex: 9, // below the topBar (10) and FAB (11) but above the canvas
  overflow: "hidden",
};

const dimLayerStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  background: "rgba(2, 4, 12, 0.28)",
};
```

- [ ] **Step 2: Type-check**

Run: `cd app && npx tsc -b --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/src/components/SkyEditOverlay.tsx
git commit -m "feat(charts): add SkyEditOverlay component

A pointer-events-none overlay mounted under the top bar while the goal
is being edited. Dims the canvas ~28% and animates six starlight threads
sweeping inward from the perimeter. Reduced-motion gets only the dim,
no threads."
```

---

### Task 7: Wire `GoalCapsule` and `SkyEditOverlay` into `ChartSky`

**Files:**
- Modify: `app/src/screens/ChartSky.tsx`

- [ ] **Step 1: Add imports**

Near the existing component imports (around `ChartSky.tsx:17-30`), add:

```tsx
import { GoalCapsule } from "../components/GoalCapsule";
import { SkyEditOverlay } from "../components/SkyEditOverlay";
```

- [ ] **Step 2: Add an `editing` state hook**

Inside the `ChartSky` component, near the other `useState`s (around line 59):

```tsx
const [editing, setEditing] = useState(false);
```

- [ ] **Step 3: Add the goal-commit handler**

After `totalCount` is computed (around line 456), add:

```tsx
const handleGoalCommit = async (newGoal: number) => {
  if (!chart) return;
  await db.transact(db.tx.charts[chart.id].update({ goalCount: newGoal }));
};
```

- [ ] **Step 4: Replace the progress div**

Find the existing block in the header (around lines 572-576):

```tsx
<div style={progressStyle} aria-label="Star progress">
  <span style={progressNumStyle}>{totalCount}</span>
  <span style={progressSepStyle}> / </span>
  <span style={progressNumStyle}>{chart.goalCount}</span>
</div>
```

Replace with:

```tsx
<GoalCapsule
  totalCount={totalCount}
  goalCount={chart.goalCount}
  completed={chart.completedAt != null}
  onCommit={handleGoalCommit}
  onEditingChange={setEditing}
/>
```

- [ ] **Step 5: Mount the overlay**

Just before the closing `</div>` of the outer `containerStyle` (look for the `</div>` that closes the top-level wrapper, after the `<AnimatePresence>` block around line 600), insert:

```tsx
<SkyEditOverlay visible={editing} />
```

- [ ] **Step 6: Gate `handlePointerDown` on editing**

Find `handlePointerDown` (search for `handlePointerDown =` in `ChartSky.tsx`). At the very top of the function body, add:

```tsx
if (editing) return;
```

- [ ] **Step 7: Remove the now-unused style consts**

Delete `progressStyle`, `progressNumStyle`, and `progressSepStyle` (around lines 678-693) — they're no longer referenced.

- [ ] **Step 8: Type-check**

Run: `cd app && npx tsc -b --noEmit`
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add app/src/screens/ChartSky.tsx
git commit -m "feat(charts): wire GoalCapsule + SkyEditOverlay into ChartSky

Replaces the static X / goalCount progress div with the new GoalCapsule.
Mounts SkyEditOverlay while editing so the sky participates. Gates the
pan-pointer handler on editing so the input doesn't fight the pan
gesture for pointer ownership."
```

---

### Task 8: Manual verification matrix

**Files:** none (this is a runtime check).

- [ ] **Step 1: Start the dev server**

Run: `cd app && npm run dev`
Expected: Vite serves on `http://localhost:5173` (or next free port).

- [ ] **Step 2: Open the app, sign in, and navigate to a chart sky**

Open the app in a browser. Pick a chart with at least one gift on it (so `totalCount > 0`).

- [ ] **Step 3: Verify the idle visual**

Expected:
- The X / goalCount in the top-right shows a soft golden glow on the goalCount numeral.
- A thin starlight bar sits underneath, filled to (totalCount / goalCount).
- 1–2 small motes drift along the filled portion.

- [ ] **Step 4: Verify the edit ritual**

Click (or tap) the goalCount numeral.
Expected:
- The capsule briefly scales up and back (~400ms).
- The numeral becomes a number input.
- The sky behind dims noticeably; thin starlight threads sweep inward from the canvas edges.

- [ ] **Step 5: Verify live fill while typing**

Change the goal value (e.g., from 50 to 80, then to 100).
Expected:
- The bar smoothly springs to the new ratio as digits are typed/committed.

- [ ] **Step 6: Verify lower-bound guardrail**

Type a value below the current totalCount (e.g., goal = totalCount − 1).
Expected:
- The bar clamps at full and the leading edge desaturates.
- An italic caption appears below the input: "needs at least N to keep your stars."
- Pressing Enter does not commit (capsule stays in edit mode).

- [ ] **Step 7: Verify Enter commit and Esc cancel**

Type a valid value, press Enter.
Expected: capsule reverts to text mode showing the new goalCount; sky un-dims; bar settles.

Tap the goal again, type a new value, press Esc.
Expected: capsule reverts; goalCount unchanged; sky un-dims.

- [ ] **Step 8: Verify completed-chart read-only**

Find or complete a chart (give enough stars to push it past goal). Once on the celebrate or memory route, navigate back to its sky route directly (`/charts/:id`) — for charts where `completedAt != null`:
Expected:
- Hovering the goalCount numeral does not show a pointer cursor.
- Clicking it does nothing.

- [ ] **Step 9: Verify reduced-motion fallback**

In dev tools (Rendering → Emulate CSS media `prefers-reduced-motion: reduce`), reload the chart sky.
Expected:
- Aura visible but doesn't pulse.
- No motes; no leading-edge pulse; no threads (only a static dim while editing).
- Edit interaction still works; bar snaps to its target without animation.

- [ ] **Step 10: Verify pan still works when not editing**

Drag the empty sky.
Expected: panning works normally. (Editing-gate doesn't break the existing gesture.)

- [ ] **Step 11: Multi-tab realtime sanity**

Open the same chart in a second tab. In tab A, edit and commit a new goal.
Expected: tab B's GoalCapsule re-renders with the new goalCount and the bar settles to the new ratio.

If any expected outcome fails, do not proceed to Task 9. Diagnose, fix, and commit a follow-up before moving on.

- [ ] **Step 12: Stop the dev server**

Ctrl+C the `npm run dev` process.

---

### Task 9: Open PR closing #44

**Files:** none new; this packages the previous commits.

- [ ] **Step 1: Confirm tree clean and commits readable**

Run: `git log --oneline main..HEAD`
Expected: 7 commits (one per Task 1–7).

Run: `git status`
Expected: clean.

- [ ] **Step 2: Push the branch**

(If working on a feature branch — confirm with `git branch --show-current`. If on `main`, branch first: `git checkout -b feat/editable-goal-starlight`. The conventional flow is `feat/<short-description>` per CLAUDE.md.)

Run: `git push -u origin <branch-name>`
Expected: push succeeds.

- [ ] **Step 3: Open the PR**

Run:

```bash
gh pr create --title "feat(charts): editable goal with starlight overhaul (closes #44)" --body "$(cat <<'EOF'
## Summary
- New \`charts.update\` perm clause: members may edit \`goalCount\` on incomplete charts (positive integer only).
- New \`GoalCapsule\` component replaces the static X / goalCount header chip — tap to retune; Enter commits, Esc cancels.
- New \`StarlightFill\` bar under the goal numeral — width tracks fill ratio via react-spring; framer-motion handles pulse + drifting motes.
- New \`SkyEditOverlay\` — dims the canvas and traces inward starlight threads while editing.
- Lower-bound guard: UI rejects \`newGoal < currentTotal\` with a caption; rule enforces \`newGoal > 0\` and \`completedAt == null\`.

Closes \#44.

CI auto-pushes the perm rule on merge (introduced in commit b143d0c) — no manual \`instant-cli push perms\` required.

## Test plan
- [ ] Idle goal visual renders aura + fill bar
- [ ] Tap goal → input + sky dim + threads
- [ ] Live typing animates the fill
- [ ] Lower-bound caption + Enter no-op when below currentTotal
- [ ] Enter commits, Esc cancels
- [ ] Completed charts have no edit affordance
- [ ] Reduced-motion path: no pulses/motes/threads, edit still works
- [ ] Pan still works when not editing
- [ ] Realtime echo: second tab updates after a commit in the first

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: PR URL printed.

- [ ] **Step 4: Return to main locally**

Run: `git checkout main`
Expected: clean tree on main. (Per CLAUDE.md: always end with HEAD on the default branch.)

---

## Self-review

**Spec coverage** — every section of the spec maps to a task:
- Permission rule → Task 1
- StarlightFill → Task 2
- GoalCapsule idle render → Task 3
- GoalCapsule edit (input + lower-bound + commit/cancel) → Task 4
- GoalCapsule scale bounce ceremony → Task 5
- SkyEditOverlay (dim + threads) → Task 6
- ChartSky integration (replace progress div, mount overlay, gate pan, transact handler) → Task 7
- Manual verification including reduced-motion, completed-chart, realtime echo → Task 8
- PR → Task 9

**Placeholder scan:** no TBDs/TODOs; every step shows the actual code or commands.

**Type consistency:** `GoalCapsuleProps` (Task 3) ↔ `<GoalCapsule>` usage (Task 7) match. `SkyEditOverlayProps.visible` (Task 6) ↔ `<SkyEditOverlay visible={editing}>` (Task 7) match. `StarlightFill` props (Task 2) ↔ `<StarlightFill>` usage (Tasks 3 & 4) match.

**Aura state evolution:** Task 3 introduces `auraStrong` / `auraIntense`; Task 4's replacement body keeps these computations unchanged. Verified.

**One subtle gotcha caught:** Task 4 replaces the entire body written in Task 3, which means the trailing `void` placeholder line from Task 3 is no longer present after Task 4. Step text in Task 4 says "remove the trailing `void` placeholder" — explicit. ✓

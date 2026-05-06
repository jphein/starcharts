// The X / goalCount header chip on ChartSky, with magical aura + starlight
// fill underneath. Tap to edit. Owns its own editing state; parent feeds
// commit handler and the live total.
//
// Idle: goalCount numeral wears a soft golden drop-shadow aura that pulses
// 0.85 → 1 → 0.85 over 2.5s (Star.tsx vocabulary). Underneath, a
// StarlightFill bar tracks `totalCount / goalCount`. The aura widens past
// 50% and 90% so the goal feels closer to the brightest star in the field
// as the chart fills up.
//
// Edit: tapping the goal numeral swaps it for a numeric input, scales the
// row 1 → 1.05 → 1 over 400ms, and tells the parent (via onEditingChange)
// so it can mount the SkyEditOverlay. While editing, the bar previews
// the in-progress draft so retuning shows a live ratio change. A draft
// below currentTotal flips StarlightFill into belowMin and surfaces an
// inline italic caption; Enter no-ops in that state.

import { useState, useEffect, useRef, type CSSProperties, type KeyboardEvent } from "react";
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
  const [draft, setDraft] = useState<string>(String(goalCount));
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const committedRef = useRef(false);

  useEffect(() => {
    onEditingChange?.(editing);
  }, [editing, onEditingChange]);

  // No need to sync `draft` from `goalCount` outside of editing: the JSX
  // renders `goalCount` directly when not editing, and `beginEdit` seeds
  // `draft` fresh each time the user opens the input.

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

  // Preview the in-progress draft when valid; otherwise fall back to the
  // committed goal so the bar doesn't flicker during invalid keystrokes.
  const previewGoal = editing && draftValid ? parsedDraft : goalCount;

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
    if (submitting) return;
    // Invalid drafts (empty, zero, < currentTotal) keep the editor open so
    // the user can correct — Enter is a no-op while belowMin or otherwise
    // invalid, and the inline caption explains why. Cancel still exits via
    // Esc/blur.
    if (!draftValid) return;
    // Unchanged values exit cleanly without firing a transact.
    if (parsedDraft === goalCount) {
      setEditing(false);
      return;
    }
    committedRef.current = true;
    setSubmitting(true);
    try {
      await onCommit(parsedDraft);
    } catch {
      // Swallow — the realtime echo will keep the visible value in sync.
      setDraft(String(goalCount));
    } finally {
      setSubmitting(false);
      setEditing(false);
    }
  };

  const onInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void commitEdit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelEdit();
    }
  };

  const onInputBlur = () => {
    if (!committedRef.current) cancelEdit();
  };

  const onTriggerKeyDown = (e: KeyboardEvent<HTMLSpanElement>) => {
    if (completed) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      beginEdit();
    }
  };

  const numeralAnimate = prefersReducedMotion
    ? { opacity: 1 }
    : { opacity: [0.85, 1, 0.85] };
  const numeralTransition = prefersReducedMotion
    ? { duration: 0 }
    : { duration: 2.5, repeat: Infinity, ease: "easeInOut" as const };

  // One-shot scale bounce when the edit ritual begins.
  const rowAnimate =
    editing && !prefersReducedMotion
      ? { scale: [1, 1.05, 1] }
      : { scale: 1 };

  return (
    <div style={wrapStyle} aria-label="Star progress">
      <motion.div
        style={rowStyle}
        animate={rowAnimate}
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
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
            onKeyDown={onInputKeyDown}
            onBlur={onInputBlur}
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
            onKeyDown={onTriggerKeyDown}
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
      </motion.div>

      <div style={fillSlotStyle}>
        <StarlightFill
          value={totalCount}
          goal={Math.max(previewGoal, 1)}
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

const captionStyle: CSSProperties = {
  marginTop: 4,
  fontFamily: "var(--sc-serif)",
  fontStyle: "italic",
  fontSize: 11,
  color: "var(--sc-gold)",
  opacity: 0.85,
};

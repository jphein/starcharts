// A pair of stacked chevron buttons (up / down) for stepping a
// numeric field. Used inline next to GoalCapsule's edit input and
// embedded in CreateChart's goal-stars field.
//
// Visual: thin gold chevrons on a transparent track. Hover lifts the
// active arrow with a soft drop-shadow aura matching the goal-numeral
// vocabulary in GoalCapsule. Pressing flickers a brighter glow and
// nudges the chevron down 1px.
//
// Behavior: uses `onMouseDown` + `preventDefault` so a click never
// pulls focus off the sibling input — otherwise we'd cancel an
// in-flight inline edit before the step handler fires. Buttons are
// `tabIndex={-1}` by default; keyboard users step the underlying
// `<input type="number">` directly via ArrowUp/ArrowDown (still wired
// natively even with the spinner CSS hidden).
//
// Sizing: `sm` matches GoalCapsule's 13px inline row; `md` matches
// CreateChart's full-width form field.

import type { CSSProperties, MouseEvent } from "react";
import { motion, useReducedMotion } from "framer-motion";

export interface StarStepperProps {
  onStepUp: () => void;
  onStepDown: () => void;
  disableUp?: boolean;
  disableDown?: boolean;
  size?: "sm" | "md";
  ariaLabelUp?: string;
  ariaLabelDown?: string;
  style?: CSSProperties;
}

const SIZE_TOKENS = {
  sm: { btn: 14, icon: 9, gap: 1, stroke: 1.4 },
  md: { btn: 18, icon: 11, gap: 2, stroke: 1.6 },
} as const;

export function StarStepper({
  onStepUp,
  onStepDown,
  disableUp = false,
  disableDown = false,
  size = "md",
  ariaLabelUp = "Increment",
  ariaLabelDown = "Decrement",
  style,
}: StarStepperProps) {
  const prefersReducedMotion = useReducedMotion();
  const tokens = SIZE_TOKENS[size];

  const stepHandler =
    (action: () => void, disabled: boolean) =>
    (e: MouseEvent<HTMLButtonElement>) => {
      // preventDefault keeps focus on the sibling input so an inline
      // edit doesn't blur-cancel mid-step.
      e.preventDefault();
      if (disabled) return;
      action();
    };

  return (
    <div
      style={{
        display: "inline-flex",
        flexDirection: "column",
        gap: tokens.gap,
        userSelect: "none",
        ...style,
      }}
      data-stepper="true"
    >
      <ChevronButton
        direction="up"
        size={tokens}
        disabled={disableUp}
        ariaLabel={ariaLabelUp}
        prefersReducedMotion={Boolean(prefersReducedMotion)}
        onMouseDown={stepHandler(onStepUp, disableUp)}
      />
      <ChevronButton
        direction="down"
        size={tokens}
        disabled={disableDown}
        ariaLabel={ariaLabelDown}
        prefersReducedMotion={Boolean(prefersReducedMotion)}
        onMouseDown={stepHandler(onStepDown, disableDown)}
      />
    </div>
  );
}

interface ChevronButtonProps {
  direction: "up" | "down";
  size: (typeof SIZE_TOKENS)[keyof typeof SIZE_TOKENS];
  disabled: boolean;
  ariaLabel: string;
  prefersReducedMotion: boolean;
  onMouseDown: (e: MouseEvent<HTMLButtonElement>) => void;
}

function ChevronButton({
  direction,
  size,
  disabled,
  ariaLabel,
  prefersReducedMotion,
  onMouseDown,
}: ChevronButtonProps) {
  // Thin chevron path scaled to the icon viewBox (16x16). Round line
  // caps soften the tip so the arrow reads as ornament, not control.
  const path =
    direction === "up" ? "M3 10 L8 4.5 L13 10" : "M3 6 L8 11.5 L13 6";

  return (
    <motion.button
      type="button"
      tabIndex={-1}
      aria-label={ariaLabel}
      aria-disabled={disabled || undefined}
      data-stepper="true"
      onMouseDown={onMouseDown}
      whileHover={disabled || prefersReducedMotion ? undefined : { scale: 1.12 }}
      whileTap={disabled || prefersReducedMotion ? undefined : { scale: 0.92, y: 1 }}
      transition={{ type: "spring", stiffness: 520, damping: 22 }}
      style={{
        width: size.btn,
        height: size.btn,
        padding: 0,
        background: "transparent",
        border: "none",
        borderRadius: 4,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--sc-gold)",
        opacity: disabled ? 0.28 : 0.78,
        cursor: disabled ? "not-allowed" : "pointer",
        filter: disabled
          ? "none"
          : "drop-shadow(0 0 4px rgba(243, 196, 107, 0.0))",
        transition: "opacity 140ms ease, filter 180ms ease",
      }}
      onMouseEnter={(e) => {
        if (disabled) return;
        e.currentTarget.style.opacity = "1";
        e.currentTarget.style.filter =
          "drop-shadow(0 0 6px rgba(255, 235, 180, 0.55))";
      }}
      onMouseLeave={(e) => {
        if (disabled) return;
        e.currentTarget.style.opacity = "0.78";
        e.currentTarget.style.filter =
          "drop-shadow(0 0 4px rgba(243, 196, 107, 0.0))";
      }}
    >
      <svg
        width={size.icon}
        height={size.icon}
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden="true"
      >
        <path
          d={path}
          stroke="currentColor"
          strokeWidth={size.stroke}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </motion.button>
  );
}

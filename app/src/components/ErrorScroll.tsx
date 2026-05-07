// ErrorScroll — the canonical error/warning banner for the app.
//
// Replaces the duplicated `errorStyle: { italic serif, muted, 0.85rem }`
// pattern that was inlined in every form/screen, and gives previously
// silent failure paths (goalCount editor, group rename, chart delete)
// a styled surface.
//
// Visual language follows app/src/design tokens:
//   - background: var(--sc-surface) with the same backdrop blur as cards
//   - left rule: var(--sc-gold) hairline (the "herald's mark")
//   - top + bottom hairlines: faint stroke (the unfurled-scroll motif)
//   - primary text: italic serif (matches the existing inline style)
//   - detail text: sans, faint
//
// All colors come from CSS vars so the component automatically tracks the
// active sky palette / dark vs. light mode.

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { CSSProperties, ReactNode } from "react";

export type ErrorScrollTone = "soft" | "warning";

export interface ErrorScrollProps {
  /** When falsy, the banner unmounts (with exit animation). Use this to gate
   * conditional rendering and let AnimatePresence handle the transition. */
  show?: boolean;
  /** Primary message — italic serif, the part the user actually reads. */
  message: ReactNode;
  /** Optional secondary line — sans-serif, faint. For technical / contextual
   * detail like a server message or a retry-after hint. */
  detail?: ReactNode;
  /** "soft" = inline validation feedback (no shadow, gold rule).
   *  "warning" = server / perms / rejection (subtle shadow, warmer rule). */
  tone?: ErrorScrollTone;
  /** Adds a small "✕" dismiss control. Omit for inline form errors that
   * clear themselves on next submit. */
  onDismiss?: () => void;
  /** Default "left" for inline form errors, "center" for full-card empty
   * states (e.g. SummonFlow's error phase). */
  align?: "left" | "center";
  /** ARIA role — default "alert". Use "status" for less urgent updates. */
  role?: "alert" | "status";
  /** Extra style overrides (margin, width, etc.) applied to the wrapper. */
  style?: CSSProperties;
  /** Test / DOM hook. */
  id?: string;
}

export function ErrorScroll({
  show = true,
  message,
  detail,
  tone = "soft",
  onDismiss,
  align = "left",
  role = "alert",
  style,
  id,
}: ErrorScrollProps) {
  const reduceMotion = useReducedMotion();

  return (
    <AnimatePresence initial={false}>
      {show ? (
        <motion.div
          id={id}
          role={role}
          aria-live={role === "alert" ? "assertive" : "polite"}
          initial={
            reduceMotion ? { opacity: 0 } : { opacity: 0, y: -4 }
          }
          animate={
            reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }
          }
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -2 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          style={{ ...wrapStyle(tone, align), ...style }}
        >
          <span aria-hidden="true" style={hairlineTopStyle} />

          <div style={bodyStyle(align)}>
            <p style={messageStyle}>{message}</p>
            {detail ? <p style={detailStyle}>{detail}</p> : null}
          </div>

          {onDismiss ? (
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Dismiss"
              style={dismissStyle}
            >
              ✕
            </button>
          ) : null}

          <span aria-hidden="true" style={hairlineBottomStyle} />
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

// ── styles ──────────────────────────────────────────────────────────────

function wrapStyle(tone: ErrorScrollTone, align: "left" | "center"): CSSProperties {
  // The left rule colour shifts subtly between tones — both pulled from
  // tokens so the dark/light/palette switch works without code changes.
  const leftRule =
    tone === "warning" ? "var(--sc-gold)" : "var(--sc-gold)";
  return {
    position: "relative",
    display: "flex",
    alignItems: "flex-start",
    gap: 12,
    margin: 0,
    padding: "10px 14px 10px 14px",
    background: "var(--sc-surface)",
    backdropFilter: "blur(14px) saturate(140%)",
    WebkitBackdropFilter: "blur(14px) saturate(140%)",
    border: "1px solid var(--sc-stroke)",
    borderLeft: `2px solid ${leftRule}`,
    borderRadius: "var(--sc-radius-inline, 8px)",
    boxShadow:
      tone === "warning"
        ? "var(--sc-shadow-tile, 0 8px 28px rgba(0,0,0,0.18))"
        : "none",
    textAlign: align,
    // Allow callers to tighten / loosen the surrounding gap by layering
    // their own marginTop via the `style` prop.
  };
}

const bodyStyle = (align: "left" | "center"): CSSProperties => ({
  flex: 1,
  display: "flex",
  flexDirection: "column",
  gap: 4,
  textAlign: align,
});

const messageStyle: CSSProperties = {
  margin: 0,
  fontFamily: "var(--sc-serif)",
  fontStyle: "italic",
  fontWeight: 500,
  color: "var(--sc-fg)",
  fontSize: "0.95rem",
  lineHeight: 1.4,
};

const detailStyle: CSSProperties = {
  margin: 0,
  fontFamily: "var(--sc-sans)",
  color: "var(--sc-fg-faint)",
  fontSize: "0.78rem",
  letterSpacing: "0.04em",
  lineHeight: 1.5,
};

const dismissStyle: CSSProperties = {
  flexShrink: 0,
  background: "transparent",
  border: "none",
  color: "var(--sc-fg-faint)",
  fontFamily: "var(--sc-sans)",
  fontSize: 14,
  lineHeight: 1,
  cursor: "pointer",
  padding: "2px 4px",
  borderRadius: 4,
  transition: "color 120ms ease",
};

// Top + bottom hairlines — the visual "scroll edge". Faint, decorative.
const hairlineTopStyle: CSSProperties = {
  position: "absolute",
  top: 3,
  left: 12,
  right: 12,
  height: 1,
  background: "var(--sc-stroke)",
  opacity: 0.6,
  pointerEvents: "none",
};

const hairlineBottomStyle: CSSProperties = {
  position: "absolute",
  bottom: 3,
  left: 12,
  right: 12,
  height: 1,
  background: "var(--sc-stroke)",
  opacity: 0.6,
  pointerEvents: "none",
};

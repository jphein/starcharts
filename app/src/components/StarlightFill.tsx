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

  // Clamp the ratio. When belowMin, render fully so the bar reads
  // "at capacity, can't go lower" — the desaturated leading edge
  // communicates the rejected-input state.
  const ratio = belowMin
    ? 1
    : Math.max(0, Math.min(1, goal > 0 ? value / goal : 0));

  const spring = useSpring({
    width: `${ratio * 100}%`,
    config: { mass: 1, tension: 220, friction: 28 },
    immediate: !!prefersReducedMotion,
  });

  // 2 motes idle, 5 editing, 0 reduced-motion. Deterministic so they
  // don't reseed across re-renders.
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

  return (
    <div style={trackStyle} aria-hidden="true">
      <animated.div
        style={{
          ...fillStyle,
          width: spring.width,
          background: belowMin
            ? "linear-gradient(90deg, rgba(180, 110, 60, 0.7) 0%, rgba(220, 150, 90, 0.95) 100%)"
            : "linear-gradient(90deg, rgba(245, 196, 107, 0.65) 0%, rgba(255, 240, 200, 1) 100%)",
          boxShadow: belowMin
            ? "0 0 6px rgba(220, 150, 90, 0.45)"
            : "0 0 8px rgba(245, 196, 107, 0.55)",
        }}
      >
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
};

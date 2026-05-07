// Renders only while the goal is being edited. Two responsibilities:
//   1. Dim the sky behind so the goal capsule visually claims focus.
//   2. Trace 6 thin starlight threads from the canvas edges toward the
//      top-right where the goal capsule sits — the sky participates in
//      the edit moment.
//
// Pointer-events disabled so the underlying scene still receives gestures
// where they're allowed (the GoalCapsule input itself is on top of this).
// Reduced-motion path drops the threads and keeps only a static dim.

import { useMemo, type CSSProperties } from "react";
import { motion, useReducedMotion } from "framer-motion";

interface SkyEditOverlayProps {
  /** True while the goal is being edited; controls the fade in/out. */
  visible: boolean;
}

const THREAD_COUNT = 6;

export function SkyEditOverlay({ visible }: SkyEditOverlayProps) {
  const prefersReducedMotion = useReducedMotion();

  // Six straight paths from random-ish edge anchors toward the top-right
  // capsule area. Memoized so threads keep their identity across renders.
  const threads = useMemo(() => {
    const items: { x1: string; y1: string; angle: number; delay: number }[] = [];
    for (let i = 0; i < THREAD_COUNT; i++) {
      const t = i / THREAD_COUNT;
      // Bias anchors toward top + left so threads sweep into the
      // top-right-anchored goal capsule.
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
          background: "rgba(2, 4, 12, 0.28)",
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
  // Below the topBar (10) and FAB (11) but above the canvas.
  zIndex: 9,
  overflow: "hidden",
};

const dimLayerStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  background: "rgba(2, 4, 12, 0.28)",
};

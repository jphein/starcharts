import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import { motion, useReducedMotion } from "framer-motion";
import styles from "./Star.module.css";

export interface StarProps {
  style: string;
  customImageUrl?: string;
  x: number;
  y: number;
  size?: number;
  count?: 1 | 2 | 3 | 5;
  onClick?: () => void;
  alt: string;
  delay?: number;
  // When set, emitted as a `data-gift-id` attribute so a parent's
  // pointer handler can `closest('[data-gift-id]')` to identify which
  // cluster a press landed on (used by ChartSky's drag-to-reposition).
  giftId?: string;
  // True for gifts that arrive after initial page load — triggers a
  // more dramatic pop-in entrance so the new star draws the eye.
  isNew?: boolean;
}

const COUNT_SCALE: Record<number, number> = { 1: 1.0, 2: 1.15, 3: 1.3, 5: 1.6 };

export function Star({
  style,
  customImageUrl,
  x,
  y,
  size = 50,
  count = 1,
  onClick,
  alt,
  delay = 0,
  giftId,
  isNew = false,
}: StarProps) {
  const prefersReducedMotion = useReducedMotion();
  // Two-phase animation: "enter" plays once on mount, then "loop" runs forever.
  // Using a ref guard so the phase flips exactly once even if onAnimationComplete
  // fires more than once (e.g. on re-renders during the entrance).
  const [phase, setPhase] = useState<"enter" | "loop">("enter");
  const loopStarted = useRef(false);

  const countScale = COUNT_SCALE[count] ?? 1.0;
  const renderSize = size * countScale;
  const glowPx = Math.round(renderSize * 0.35 * (1 + (count - 1) * 0.18));

  const src = customImageUrl ?? `/stars/${style}.png`;

  // Per-instance drift offsets so a cluster doesn't move in unison.
  const drift = useMemo(() => {
    const seed = (x * 1000 + y * 1731 + delay * 97) % 1;
    const dx = (Math.sin(seed * 12.9898) * 0.5 + 0.5) * 4 - 2;
    const dy = (Math.cos(seed * 78.233) * 0.5 + 0.5) * 4 - 2;
    return { dx, dy };
  }, [x, y, delay]);

  const interactive = Boolean(onClick);

  const handleKeyDown = (e: KeyboardEvent<HTMLImageElement>) => {
    if (!onClick) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick();
    }
  };

  function handleAnimationComplete() {
    if (!loopStarted.current) {
      loopStarted.current = true;
      setPhase("loop");
    }
  }

  if (prefersReducedMotion) {
    return (
      <motion.img
        src={src}
        alt={alt}
        draggable={false}
        className={`${styles.star} ${interactive ? styles.button : ""}`}
        style={{
          left: `${x * 100}%`,
          top: `${y * 100}%`,
          width: renderSize,
          height: renderSize,
          transform: "translate(-50%, -50%)",
          filter: `drop-shadow(0 0 ${glowPx}px rgba(255,235,180,0.4))`,
        }}
        onClick={onClick}
        role={interactive ? "button" : undefined}
        tabIndex={interactive ? 0 : undefined}
        onKeyDown={interactive ? handleKeyDown : undefined}
        aria-label={interactive ? alt : undefined}
        data-gift-id={giftId}
      />
    );
  }

  // Entrance: new stars pop dramatically (0 → 1.5x → settle);
  // existing stars on page load fade+scale in more gently, staggered by delay.
  const enterAnimate = isNew
    ? { scale: [0, 1.6, 0.85, 1.15, 1], opacity: [0, 1, 1, 1, 1] }
    : { scale: 1, opacity: 1 };
  const enterTransition = isNew
    ? {
        duration: 0.65,
        ease: "easeOut" as const,
        times: [0, 0.35, 0.55, 0.75, 1],
      }
    : {
        scale: {
          type: "spring" as const,
          stiffness: 280,
          damping: 18,
          delay: delay * 0.4,
        },
        opacity: { duration: 0.35, ease: "easeOut" as const, delay: delay * 0.4 },
      };

  // Loop: gentle scale pulse layered on top of the existing opacity twinkle + drift.
  const loopAnimate = {
    opacity: [0.82, 1.0, 0.82],
    scale: [1, 1.06, 0.97, 1],
    x: [0, drift.dx, -drift.dx, 0],
    y: [0, drift.dy, -drift.dy, 0],
  };
  const loopTransition = {
    opacity: {
      duration: 2.5 + (delay % 1.5),
      repeat: Infinity,
      ease: "easeInOut" as const,
      delay,
    },
    scale: {
      duration: 3.5 + (delay % 2),
      repeat: Infinity,
      ease: "easeInOut" as const,
      delay,
    },
    x: {
      duration: 8,
      repeat: Infinity,
      ease: "easeInOut" as const,
      delay,
    },
    y: {
      duration: 8,
      repeat: Infinity,
      ease: "easeInOut" as const,
      delay,
    },
  };

  return (
    <motion.img
      src={src}
      alt={alt}
      draggable={false}
      className={`${styles.star} ${interactive ? styles.button : ""}`}
      style={{
        left: `${x * 100}%`,
        top: `${y * 100}%`,
        width: renderSize,
        height: renderSize,
        transform: "translate(-50%, -50%)",
        filter: `drop-shadow(0 0 ${glowPx}px rgba(255,235,180,0.4))`,
      }}
      initial={{ scale: 0, opacity: 0 }}
      animate={phase === "enter" ? enterAnimate : loopAnimate}
      transition={phase === "enter" ? enterTransition : loopTransition}
      onAnimationComplete={handleAnimationComplete}
      onClick={onClick}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={interactive ? handleKeyDown : undefined}
      aria-label={interactive ? alt : undefined}
      data-gift-id={giftId}
    />
  );
}

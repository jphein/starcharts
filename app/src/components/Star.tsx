import { useMemo, type KeyboardEvent } from "react";
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
}: StarProps) {
  const prefersReducedMotion = useReducedMotion();

  const scale = COUNT_SCALE[count] ?? 1.0;
  const renderSize = size * scale;
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

  const animate = prefersReducedMotion
    ? { opacity: 1, x: 0, y: 0 }
    : {
        opacity: [0.85, 1.0, 0.85],
        x: [0, drift.dx, -drift.dx, 0],
        y: [0, drift.dy, -drift.dy, 0],
      };

  const transition = prefersReducedMotion
    ? { duration: 0 }
    : {
        opacity: {
          duration: 2.5,
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
      animate={animate}
      transition={transition}
      onClick={onClick}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={interactive ? handleKeyDown : undefined}
      aria-label={interactive ? alt : undefined}
      data-gift-id={giftId}
    />
  );
}

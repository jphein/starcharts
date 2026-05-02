import { useMemo, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import styles from "./Sky.module.css";

interface SkyProps {
  children?: ReactNode;
  dustCount?: number;
  seed?: number;
}

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface DustMote {
  left: string;
  top: string;
  size: number;
  duration: number;
  delay: number;
}

const NEBULAE = [
  { className: styles.nebula1, delay: 0 },
  { className: styles.nebula2, delay: 2 },
  { className: styles.nebula3, delay: 4 },
];

export function Sky({ children, dustCount = 40, seed = 1337 }: SkyProps) {
  const prefersReducedMotion = useReducedMotion();

  const dust = useMemo<DustMote[]>(() => {
    const rng = mulberry32(seed);
    const motes: DustMote[] = [];
    for (let i = 0; i < dustCount; i++) {
      motes.push({
        left: `${rng() * 100}%`,
        top: `${rng() * 100}%`,
        size: rng() < 0.7 ? 1 : 2,
        duration: 2 + rng() * 2,
        delay: rng() * 3,
      });
    }
    return motes;
  }, [dustCount, seed]);

  const breatheAnimation = prefersReducedMotion
    ? undefined
    : { scale: [1, 1.08, 1] };

  return (
    <div className={styles.wrap} aria-hidden={false}>
      {NEBULAE.map((n, i) => (
        <motion.div
          key={i}
          className={`${styles.nebula} ${n.className}`}
          animate={breatheAnimation}
          transition={
            prefersReducedMotion
              ? undefined
              : {
                  duration: 6,
                  ease: "easeInOut",
                  repeat: Infinity,
                  delay: n.delay,
                }
          }
        />
      ))}

      <div className={styles.dustLayer} aria-hidden="true">
        {dust.map((d, i) => (
          <span
            key={i}
            className={styles.dust}
            style={
              {
                left: d.left,
                top: d.top,
                width: d.size,
                height: d.size,
                "--scTwinkleDur": `${d.duration}s`,
                "--scTwinkleDelay": `${d.delay}s`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>

      <div className={styles.content}>{children}</div>
    </div>
  );
}

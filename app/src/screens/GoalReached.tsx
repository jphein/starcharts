// First-mount-only celebration when a chart's goal is reached.
//
// The chart's full sky is rendered beneath; a centered spring-zoomed serif
// reward line rises into view with a small letterspaced eyebrow above and an
// italic "complete" stamp below. We mark the celebration as "seen" via
// sessionStorage on first mount so revisiting bounces straight to memory.

import { useEffect, useMemo, type CSSProperties } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { Sky } from "../components/Sky";
import { LoadingSky } from "../components/LoadingSky";
import { Star } from "../components/Star";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { useChart } from "../hooks/useChart";
import { useGiftsForChart } from "../hooks/useGiftsForChart";
import { expandClusterPositions } from "../lib/starPositioning";

function celebratedKey(chartId: string): string {
  return `sc_celebrated_${chartId}`;
}

function normalizeCount(n: number): 1 | 2 | 3 | 5 {
  if (n >= 5) return 5;
  if (n >= 3) return 3;
  if (n >= 2) return 2;
  return 1;
}

export default function GoalReached() {
  const { id: chartId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion();

  const { user, isLoading: userLoading } = useCurrentUser();
  const { chart, isLoading: chartLoading } = useChart(chartId);
  const { gifts } = useGiftsForChart(chartId);

  // Auth gate.
  useEffect(() => {
    if (!userLoading && !user) {
      navigate("/sign-in", { replace: true });
    }
  }, [userLoading, user, navigate]);

  // Chart gate: missing chart bounces to dashboard.
  useEffect(() => {
    if (!chartLoading && chartId && chart === null) {
      navigate("/dashboard", { replace: true });
    }
  }, [chartLoading, chart, chartId, navigate]);

  // Celebration gate. Two cases:
  //   1. Chart isn't actually complete → bounce back to active sky.
  //   2. We've already shown this user the celebration → bounce to memory.
  // Otherwise mark as seen and play once.
  useEffect(() => {
    if (!chart || !chartId) return;
    if (chart.completedAt == null) {
      navigate(`/charts/${chartId}`, { replace: true });
      return;
    }
    if (typeof window === "undefined") return;
    const key = celebratedKey(chartId);
    if (window.sessionStorage.getItem(key) === "1") {
      navigate(`/charts/${chartId}/memory`, { replace: true });
      return;
    }
    window.sessionStorage.setItem(key, "1");
  }, [chart, chartId, navigate]);

  const clusters = useMemo(() => {
    return gifts.flatMap((gift) =>
      expandClusterPositions(gift).map((pos, idx) => ({
        key: `${gift.id}-${idx}`,
        gift,
        pos,
        delay: (idx % 5) * 0.4,
      })),
    );
  }, [gifts]);

  if (userLoading || !user || chartLoading || !chart) {
    return <LoadingSky />;
  }

  return (
    <div style={containerStyle}>
      <Sky>
        {clusters.map(({ key, gift, pos, delay }) => (
          <Star
            key={key}
            style={gift.style}
            customImageUrl={
              gift.style === "custom" ? gift.starImageUrl : undefined
            }
            x={pos.x}
            y={pos.y}
            count={normalizeCount(gift.count)}
            alt={gift.reason}
            delay={delay}
          />
        ))}
      </Sky>

      <div style={burstWrapStyle}>
        <motion.div
          style={eyebrowStyle}
          initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={
            prefersReducedMotion
              ? { duration: 0 }
              : { duration: 0.6, delay: 0.05, ease: "easeOut" }
          }
        >
          {chart.name}
        </motion.div>

        <motion.div
          style={rewardStyle}
          initial={
            prefersReducedMotion
              ? { opacity: 1, scale: 1 }
              : { opacity: 0, scale: 0.6 }
          }
          animate={{ opacity: 1, scale: 1 }}
          transition={
            prefersReducedMotion
              ? { duration: 0 }
              : { type: "spring", damping: 14, stiffness: 160, delay: 0.15 }
          }
        >
          {chart.reward}
        </motion.div>

        <motion.div
          style={stampStyle}
          initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={
            prefersReducedMotion
              ? { duration: 0 }
              : { duration: 0.5, delay: 0.7, ease: "easeOut" }
          }
        >
          ✦ complete
        </motion.div>

        <motion.button
          type="button"
          onClick={() => navigate(`/charts/${chartId}/memory`, { replace: true })}
          style={ctaStyle}
          initial={
            prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }
          }
          animate={{ opacity: 1, y: 0 }}
          transition={
            prefersReducedMotion
              ? { duration: 0 }
              : { duration: 0.5, delay: 0.95, ease: "easeOut" }
          }
        >
          Mark complete
        </motion.button>
      </div>
    </div>
  );
}

const containerStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  color: "var(--sc-fg)",
  overflow: "hidden",
};

const burstWrapStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  textAlign: "center",
  padding: "32px 24px",
  pointerEvents: "none",
  background:
    "radial-gradient(circle at 50% 50%, rgba(0,0,0,0.0) 0%, rgba(0,0,0,0.45) 100%)",
};

const eyebrowStyle: CSSProperties = {
  fontFamily: "var(--sc-sans)",
  fontSize: 11,
  letterSpacing: "0.3em",
  textTransform: "uppercase",
  color: "var(--sc-gold)",
  marginBottom: 18,
};

const rewardStyle: CSSProperties = {
  fontFamily: "var(--sc-serif)",
  fontWeight: 500,
  fontSize: "clamp(36px, 9vw, 72px)",
  lineHeight: 1.05,
  letterSpacing: "-0.01em",
  color: "var(--sc-fg)",
  textShadow:
    "0 4px 28px rgba(0,0,0,0.5), 0 0 40px rgba(255,220,150,0.3)",
  maxWidth: 560,
  marginBottom: 18,
};

const stampStyle: CSSProperties = {
  fontFamily: "var(--sc-serif)",
  fontStyle: "italic",
  fontSize: 14,
  color: "var(--sc-fg-muted)",
  letterSpacing: "0.04em",
  marginBottom: 32,
};

const ctaStyle: CSSProperties = {
  pointerEvents: "auto",
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "12px 24px",
  borderRadius: 999,
  border: "none",
  background: "var(--sc-gold)",
  color: "#1a0f00",
  fontFamily: "var(--sc-sans)",
  fontSize: 14,
  fontWeight: 500,
  cursor: "pointer",
  boxShadow:
    "0 1px 0 rgba(255,255,255,0.4) inset, 0 8px 28px rgba(0,0,0,0.45), 0 0 24px rgba(245,196,107,0.32)",
};

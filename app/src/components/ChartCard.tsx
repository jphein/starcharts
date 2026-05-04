import { useState, useMemo, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { Sky } from "./Sky";
import { Star } from "./Star";
import { useGiftsForChart } from "../hooks/useGiftsForChart";
import { expandClusterPositions } from "../lib/starPositioning";
import type { Chart } from "../types";

interface ChartCardProps {
  chart: Chart;
}

const PREVIEW_STAR_SIZE = 26;
const MAX_PREVIEW_STARS = 12;

const cardBase: CSSProperties = {
  position: "relative",
  height: 180,
  borderRadius: 18,
  border: "1px solid var(--sc-stroke)",
  boxShadow: "var(--sc-shadow-tile, 0 8px 28px rgba(0,0,0,0.18))",
  overflow: "hidden",
  cursor: "pointer",
  transition: "transform 200ms ease",
  background: "var(--sc-bg-deep, #0a0e2c)",
};

const capsuleBase: CSSProperties = {
  position: "absolute",
  background: "var(--sc-surface)",
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
  border: "1px solid var(--sc-stroke)",
  padding: "6px 10px",
  borderRadius: "var(--sc-radius-inline, 8px)",
  pointerEvents: "none",
  maxWidth: "70%",
};

export function ChartCard({ chart }: ChartCardProps) {
  const navigate = useNavigate();
  const [hover, setHover] = useState(false);
  const isComplete = chart.completedAt != null;

  const seed = hashSeed(chart.id);

  const { gifts } = useGiftsForChart(chart.id);
  const totalStarCount = useMemo(
    () => gifts.reduce((sum, g) => sum + g.count, 0),
    [gifts],
  );
  const previewStars = useMemo(() => {
    const positions: { x: number; y: number; style: string; customImageUrl?: string }[] = [];
    for (const gift of gifts) {
      if (positions.length >= MAX_PREVIEW_STARS) break;
      for (const pos of expandClusterPositions(gift)) {
        if (positions.length >= MAX_PREVIEW_STARS) break;
        positions.push({ x: pos.x, y: pos.y, style: gift.style, customImageUrl: gift.starImageUrl || undefined });
      }
    }
    return positions;
  }, [gifts]);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => navigate(`/charts/${chart.id}`)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          navigate(`/charts/${chart.id}`);
        }
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        ...cardBase,
        transform: hover ? "translateY(-2px)" : "translateY(0)",
      }}
    >
      <div style={{ position: "absolute", inset: 0 }}>
        <Sky dustCount={12} seed={seed} />
      </div>

      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        {previewStars.map((star, i) => (
          <Star
            key={i}
            style={star.style}
            customImageUrl={star.customImageUrl}
            x={star.x}
            y={star.y}
            size={PREVIEW_STAR_SIZE}
            alt=""
            delay={i * 0.15}
          />
        ))}
      </div>

      <div
        style={{
          ...capsuleBase,
          top: 12,
          left: 12,
          fontFamily: "var(--sc-serif)",
          fontWeight: "var(--sc-serif-weight, 500)" as CSSProperties["fontWeight"],
          fontSize: 18,
          color: "var(--sc-fg)",
          lineHeight: 1.15,
        }}
      >
        {chart.name}
      </div>

      <div
        style={{
          ...capsuleBase,
          left: 12,
          bottom: 12,
          fontFamily: "var(--sc-sans)",
          fontSize: 11,
          color: "var(--sc-fg-muted)",
          maxWidth: "55%",
          lineHeight: 1.35,
        }}
      >
        {chart.reward}
      </div>

      <div
        style={{
          ...capsuleBase,
          right: 12,
          bottom: 12,
          fontFamily: "var(--sc-sans)",
          fontSize: 11,
          color: "var(--sc-gold)",
          letterSpacing: "0.03em",
          whiteSpace: "nowrap",
          maxWidth: "none",
          padding: "5px 10px",
          borderRadius: 999,
        }}
      >
        {isComplete ? (
          <em style={{ fontStyle: "italic", opacity: 0.9 }}>complete</em>
        ) : (
          `${totalStarCount} of ${chart.goalCount}`
        )}
      </div>
    </div>
  );
}

function hashSeed(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

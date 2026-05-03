// Hero scene: a chart's full sky, alive with every gift its members have given.
//
// Each gift expands into a deterministic cluster (anchor + N-1 satellites) so
// every client sees the same arrangement once the realtime row arrives. The
// translucent top bar mirrors Dashboard's frosted header style; the bottom-
// right "Give a star" CTA is the only authoring affordance — taps anywhere
// on a star open the GiftCard bottom-sheet.
//
// Goal handling: when the chart's `completedAt` flips to a value we haven't
// celebrated yet (sessionStorage `sc_celebrated_${chartId}` not set), we
// route to /charts/:id/celebrate. If the flag is already set, the chart
// is in memory mode and we bounce to /charts/:id/memory instead.

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { Sky } from "../components/Sky";
import { Star } from "../components/Star";
import { GiftCard } from "../components/GiftCard";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { useCurrentGroup } from "../hooks/useCurrentGroup";
import { useChart } from "../hooks/useChart";
import {
  useGiftsForChart,
  type GiftWithLinks,
} from "../hooks/useGiftsForChart";
import { expandClusterPositions } from "../lib/starPositioning";

function celebratedKey(chartId: string): string {
  return `sc_celebrated_${chartId}`;
}

export default function ChartSky() {
  const { id: chartId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { user, isLoading: userLoading } = useCurrentUser();
  const { group, isLoading: groupLoading } = useCurrentGroup();
  const { chart, isLoading: chartLoading } = useChart(chartId);
  const { gifts, isLoading: giftsLoading } = useGiftsForChart(chartId);

  const [selectedGift, setSelectedGift] = useState<GiftWithLinks | null>(null);

  // Auth gate.
  useEffect(() => {
    if (!userLoading && !user) {
      navigate("/sign-in", { replace: true });
    }
  }, [userLoading, user, navigate]);

  // Group gate.
  useEffect(() => {
    if (!userLoading && user && !groupLoading && !group) {
      navigate("/group-setup", { replace: true });
    }
  }, [userLoading, user, groupLoading, group, navigate]);

  // Chart gate: if loaded but missing, bounce home.
  useEffect(() => {
    if (!chartLoading && chartId && chart === null) {
      navigate("/dashboard", { replace: true });
    }
  }, [chartLoading, chart, chartId, navigate]);

  // Goal-reached routing: if completedAt arrives and we haven't celebrated,
  // go to /celebrate. If we've already celebrated this chart, send to memory.
  useEffect(() => {
    if (!chart || !chartId || chart.completedAt == null) return;
    const celebrated =
      typeof window !== "undefined" &&
      window.sessionStorage.getItem(celebratedKey(chartId)) === "1";
    if (celebrated) {
      navigate(`/charts/${chartId}/memory`, { replace: true });
    } else {
      navigate(`/charts/${chartId}/celebrate`, { replace: true });
    }
  }, [chart, chartId, navigate]);

  const totalCount = useMemo(
    () => gifts.reduce((sum, g) => sum + g.count, 0),
    [gifts],
  );

  // Render the empty sky while gating/loading so the page never flashes the
  // wrong content.
  if (
    userLoading ||
    !user ||
    groupLoading ||
    !group ||
    chartLoading ||
    !chart
  ) {
    return (
      <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
        <Sky />
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <Sky>
        {!giftsLoading &&
          gifts.flatMap((gift) => {
            const positions = expandClusterPositions(gift);
            const altBase = gift.reason.length > 60
              ? `${gift.reason.slice(0, 57)}…`
              : gift.reason;
            return positions.map((pos, idx) => (
              <Star
                key={`${gift.id}-${idx}`}
                style={gift.style}
                customImageUrl={
                  gift.starImageUrl && gift.starImageUrl.startsWith("data:")
                    ? gift.starImageUrl
                    : undefined
                }
                x={pos.x}
                y={pos.y}
                count={normalizeCount(gift.count)}
                onClick={() => setSelectedGift(gift)}
                alt={altBase}
                delay={(idx % 5) * 0.4}
              />
            ));
          })}
      </Sky>

      <header style={topBarStyle}>
        <button
          type="button"
          onClick={() => navigate("/dashboard")}
          style={iconButtonStyle}
          aria-label="Back to dashboard"
          title="Back to dashboard"
        >
          ←
        </button>

        <div style={titleWrapStyle}>
          <h1 style={titleStyle}>{chart.name}</h1>
        </div>

        <div style={progressStyle} aria-label="Star progress">
          <span style={progressNumStyle}>{totalCount}</span>
          <span style={progressSepStyle}> / </span>
          <span style={progressNumStyle}>{chart.goalCount}</span>
        </div>
      </header>

      <button
        type="button"
        onClick={() => navigate(`/charts/${chartId}/give`)}
        style={fabStyle}
      >
        <span aria-hidden="true" style={{ fontSize: 16 }}>
          ✦
        </span>
        Give a star
      </button>

      <AnimatePresence>
        {selectedGift && (
          <GiftCard
            key={selectedGift.id}
            gift={selectedGift}
            onClose={() => setSelectedGift(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// Star count prop is typed as 1 | 2 | 3 | 5 — clamp gift.count down to the
// nearest tier so a count of 4 reads as a 3-cluster, 6+ as a 5-cluster, etc.
function normalizeCount(n: number): 1 | 2 | 3 | 5 {
  if (n >= 5) return 5;
  if (n >= 3) return 3;
  if (n >= 2) return 2;
  return 1;
}

const containerStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  color: "var(--sc-fg)",
  overflow: "hidden",
};

const topBarStyle: CSSProperties = {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: "16px 20px",
  background: "var(--sc-surface)",
  backdropFilter: "blur(20px) saturate(160%)",
  WebkitBackdropFilter: "blur(20px) saturate(160%)",
  borderBottom: "1px solid var(--sc-stroke)",
  zIndex: 10,
};

const iconButtonStyle: CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 999,
  background: "var(--sc-surface)",
  border: "1px solid var(--sc-stroke)",
  color: "var(--sc-fg)",
  fontSize: 16,
  lineHeight: 1,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

const titleWrapStyle: CSSProperties = {
  flex: 1,
  textAlign: "center",
  minWidth: 0,
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontFamily: "var(--sc-serif)",
  fontWeight: 500,
  fontSize: 18,
  letterSpacing: "-0.005em",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const progressStyle: CSSProperties = {
  fontFamily: "var(--sc-sans)",
  fontSize: 13,
  letterSpacing: "0.04em",
  color: "var(--sc-gold)",
  flexShrink: 0,
};

const progressNumStyle: CSSProperties = {
  fontVariantNumeric: "tabular-nums",
};

const progressSepStyle: CSSProperties = {
  margin: "0 4px",
  opacity: 0.6,
};

const fabStyle: CSSProperties = {
  position: "absolute",
  right: 20,
  bottom: 24,
  zIndex: 11,
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "12px 22px",
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

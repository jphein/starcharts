// Read-only twin of ChartSky for charts whose goal has already been reached.
//
// Same gift rendering and tap-to-open-card behavior; the top bar swaps the
// progress numbers for an italic "Memory · {date}" stamp and the floating
// "Give a star" CTA is hidden so completed skies stay frozen.

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { Sky } from "../components/Sky";
import { Star } from "../components/Star";
import { GiftCard } from "../components/GiftCard";
import { PresencePanel } from "../components/PresencePanel";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { useCurrentGroup } from "../hooks/useCurrentGroup";
import { useChart } from "../hooks/useChart";
import {
  useGiftsForChart,
  type GiftWithLinks,
} from "../hooks/useGiftsForChart";
import { expandClusterPositions } from "../lib/starPositioning";

const memoryDateFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function normalizeCount(n: number): 1 | 2 | 3 | 5 {
  if (n >= 5) return 5;
  if (n >= 3) return 3;
  if (n >= 2) return 2;
  return 1;
}

export default function ConstellationMemory() {
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

  // Chart gate.
  useEffect(() => {
    if (!chartLoading && chartId && chart === null) {
      navigate("/dashboard", { replace: true });
    }
  }, [chartLoading, chart, chartId, navigate]);

  // If the chart isn't actually complete, redirect back to the live sky so
  // we never render "Memory" over an in-progress chart.
  useEffect(() => {
    if (chart && chartId && chart.completedAt == null) {
      navigate(`/charts/${chartId}`, { replace: true });
    }
  }, [chart, chartId, navigate]);

  const memoryLabel = useMemo(() => {
    if (!chart?.completedAt) return "";
    return memoryDateFormatter.format(new Date(chart.completedAt));
  }, [chart?.completedAt]);

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
            const altBase =
              gift.reason.length > 60
                ? `${gift.reason.slice(0, 57)}…`
                : gift.reason;
            return positions.map((pos, idx) => (
              <Star
                key={`${gift.id}-${idx}`}
                style={gift.style}
                customImageUrl={
                  gift.style === "custom" ? gift.starImageUrl : undefined
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

        <div style={trailingStyle}>
          <PresencePanel chartId={chart.id} />
          <div style={memoryStampStyle} aria-label="Memory date">
            <span aria-hidden="true" style={{ marginRight: 4 }}>✦</span>
            Memory · {memoryLabel}
          </div>
        </div>
      </header>

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

const trailingStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 12,
  flexShrink: 0,
};

const memoryStampStyle: CSSProperties = {
  fontFamily: "var(--sc-serif)",
  fontStyle: "italic",
  fontSize: 12,
  color: "var(--sc-fg-muted)",
  flexShrink: 0,
  letterSpacing: "0.02em",
};

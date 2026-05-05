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

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { Sky } from "../components/Sky";
import { LoadingSky } from "../components/LoadingSky";
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
import { db } from "../db/client";

// Bounds for repositioning. Match the clamp used by
// `expandClusterPositions` so a dragged anchor never pushes its
// satellites past the visible canvas edges.
const ANCHOR_MIN = 0.05;
const ANCHOR_MAX = 0.95;
// Movement threshold (in screen pixels) before a press becomes a drag.
// Below this, a release fires the star's onClick (open GiftCard).
const DRAG_THRESHOLD_PX = 5;

function celebratedKey(chartId: string): string {
  return `sc_celebrated_${chartId}`;
}

export default function ChartSky() {
  const { id: chartId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const { user, isLoading: userLoading } = useCurrentUser();
  const { group, isLoading: groupLoading } = useCurrentGroup();
  const { chart, isLoading: chartLoading } = useChart(chartId);
  const { gifts, isLoading: giftsLoading } = useGiftsForChart(chartId);

  const [selectedGift, setSelectedGift] = useState<GiftWithLinks | null>(null);

  // ── Panning + cluster drag ───────────────────────────────────────────────
  const canvasRef = useRef<HTMLDivElement>(null);
  // Start centered on the 2× canvas so the full star field is reachable.
  const panRef = useRef({
    x: -(window.innerWidth / 2),
    y: -(window.innerHeight / 2),
  });
  // Sky-pan gesture state (only set while panning the empty sky).
  const dragState = useRef<{
    px: number; py: number; panX: number; panY: number;
  } | null>(null);
  // Cluster-drag gesture state (only set while a press started on a star).
  // `committed` flips true once movement crosses DRAG_THRESHOLD_PX, at which
  // point we stop suppressing onClick and start visually translating the
  // cluster wrapper.
  const clusterDragRef = useRef<{
    giftId: string; px: number; py: number; committed: boolean;
  } | null>(null);
  // DOM refs for each cluster wrapper, keyed by gift id. We mutate
  // `style.transform` directly during drag for per-frame smoothness instead
  // of routing every pointermove through React state.
  const clusterRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const dragMoved = useRef(false);
  const activePointerId = useRef<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  function applyTransform() {
    if (!canvasRef.current) return;
    canvasRef.current.style.transform =
      `translate(${panRef.current.x}px, ${panRef.current.y}px)`;
  }

  function clampedPan(x: number, y: number) {
    return {
      x: Math.min(0, Math.max(-window.innerWidth, x)),
      y: Math.min(0, Math.max(-window.innerHeight, y)),
    };
  }

  function clampAnchor(v: number): number {
    if (v < ANCHOR_MIN) return ANCHOR_MIN;
    if (v > ANCHOR_MAX) return ANCHOR_MAX;
    return v;
  }

  // The pointer handlers are attached once on mount, so they capture a
  // stale `gifts` closure. Mirror it into a ref so onUp can resolve the
  // current x/y of the dragged gift to compute the new position.
  const giftsRef = useRef<GiftWithLinks[]>(gifts);
  useEffect(() => {
    giftsRef.current = gifts;
  }, [gifts]);

  // No dependency array: fires after every render so the transform is applied
  // as soon as the canvas element actually mounts (the loading gate keeps it
  // out of the DOM until user+group+chart are ready, so a one-shot [] effect
  // fires while canvasRef is still null and the initial offset is never set).
  useLayoutEffect(() => { applyTransform(); });

  useEffect(() => {
    function onResize() {
      panRef.current = clampedPan(panRef.current.x, panRef.current.y);
      applyTransform();
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // After load, pan to the most-populated area of the sky.
  // If we just returned from GiftFlow (navigate state carries focusX/focusY),
  // center on the new gift instead so the user sees what they just sent up.
  // The flag ensures we only set the initial position once per mount.
  const initialPanDone = useRef(false);
  useEffect(() => {
    if (initialPanDone.current) return;

    const state = location.state as { focusX?: number; focusY?: number } | null;
    if (state?.focusX != null && state?.focusY != null) {
      initialPanDone.current = true;
      panRef.current = clampedPan(
        window.innerWidth / 2 - state.focusX * window.innerWidth * 2,
        window.innerHeight / 2 - state.focusY * window.innerHeight * 2,
      );
      applyTransform();
      return;
    }

    if (giftsLoading || gifts.length === 0) return;

    initialPanDone.current = true;
    const cx = gifts.reduce((s, g) => s + g.x, 0) / gifts.length;
    const cy = gifts.reduce((s, g) => s + g.y, 0) / gifts.length;
    panRef.current = clampedPan(
      window.innerWidth / 2 - cx * window.innerWidth * 2,
      window.innerHeight / 2 - cy * window.innerHeight * 2,
    );
    applyTransform();
  }, [location.state, giftsLoading, gifts]);

  // Global move/up listeners keep drag smooth when the pointer moves fast
  // off the pan surface, without using setPointerCapture (which redirects
  // click events away from stars and breaks tap-to-open).
  //
  // Two gesture state machines coexist — only one is live at a time:
  //   - `dragState`         — sky pan
  //   - `clusterDragRef`    — cluster reposition
  // `handlePointerDown` decides which one to start based on whether the
  // press landed on a `[data-gift-id]` element.
  useEffect(() => {
    function onMove(e: PointerEvent) {
      if (e.pointerId !== activePointerId.current) return;

      if (clusterDragRef.current) {
        const dx = e.clientX - clusterDragRef.current.px;
        const dy = e.clientY - clusterDragRef.current.py;
        if (
          !clusterDragRef.current.committed &&
          (Math.abs(dx) > DRAG_THRESHOLD_PX || Math.abs(dy) > DRAG_THRESHOLD_PX)
        ) {
          clusterDragRef.current.committed = true;
          dragMoved.current = true;
        }
        if (clusterDragRef.current.committed) {
          const el = clusterRefs.current.get(clusterDragRef.current.giftId);
          if (el) el.style.transform = `translate(${dx}px, ${dy}px)`;
        }
        return;
      }

      if (!dragState.current) return;
      const dx = e.clientX - dragState.current.px;
      const dy = e.clientY - dragState.current.py;
      if (!dragMoved.current && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
        dragMoved.current = true;
      }
      panRef.current = clampedPan(
        dragState.current.panX + dx,
        dragState.current.panY + dy,
      );
      applyTransform();
    }
    function onUp(e: PointerEvent) {
      if (e.pointerId !== activePointerId.current) return;
      activePointerId.current = null;

      // Cluster-drag commit: write new x/y to the gift row, then drop
      // the inline transform so the realtime row update can take over
      // visually without a flicker.
      const cd = clusterDragRef.current;
      if (cd?.committed) {
        const dxPx = e.clientX - cd.px;
        const dyPx = e.clientY - cd.py;
        // The canvas is 200vw × 200vh, so a 1px screen delta is
        // 1/(2 × innerWidth) of normalized canvas space.
        const dxNorm = dxPx / (window.innerWidth * 2);
        const dyNorm = dyPx / (window.innerHeight * 2);
        const giftSnapshot = giftsRef.current.find((g) => g.id === cd.giftId);
        if (giftSnapshot) {
          const newX = clampAnchor(giftSnapshot.x + dxNorm);
          const newY = clampAnchor(giftSnapshot.y + dyNorm);
          // Only write when the position actually changed past the
          // 4-decimal precision we serialize at — InstantDB happily
          // accepts no-op updates, but they're noise on the wire.
          if (
            Math.abs(newX - giftSnapshot.x) > 1e-4 ||
            Math.abs(newY - giftSnapshot.y) > 1e-4
          ) {
            void db.transact(
              db.tx.gifts[cd.giftId].update({ x: newX, y: newY }),
            );
          }
        }
        const el = clusterRefs.current.get(cd.giftId);
        if (el) el.style.transform = "";
      }
      clusterDragRef.current = null;
      dragState.current = null;
      setIsDragging(false);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, []);

  function handlePointerDown(e: React.PointerEvent) {
    if (e.button !== 0) return;
    // Press on a cluster → candidate cluster-drag (don't pan the sky).
    // Press on empty sky → sky-pan (existing behaviour).
    const giftEl = (e.target as HTMLElement).closest("[data-gift-id]");
    const giftId = giftEl?.getAttribute("data-gift-id");
    if (giftId) {
      activePointerId.current = e.pointerId;
      clusterDragRef.current = {
        giftId,
        px: e.clientX,
        py: e.clientY,
        committed: false,
      };
      dragMoved.current = false;
      return;
    }
    activePointerId.current = e.pointerId;
    dragState.current = {
      px: e.clientX, py: e.clientY,
      panX: panRef.current.x, panY: panRef.current.y,
    };
    dragMoved.current = false;
    setIsDragging(true);
  }

  // Suppress star clicks that are actually the end of a drag gesture
  // (either pan or cluster reposition).
  function handleClickCapture(e: React.MouseEvent) {
    if (dragMoved.current) {
      e.stopPropagation();
      dragMoved.current = false;
    }
  }
  // ─────────────────────────────────────────────────────────────────────────

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
    return <LoadingSky />;
  }

  return (
    <div style={containerStyle}>
      {/* Pan surface — fills the viewport and captures drag gestures */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          cursor: isDragging ? "grabbing" : "grab",
          touchAction: "none",
        }}
        onPointerDown={handlePointerDown}
        onClickCapture={handleClickCapture}
      >
        {/* Canvas — 2× the viewport, shifted so its centre fills the screen */}
        <div
          ref={canvasRef}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "200vw",
            height: "200vh",
            willChange: "transform",
          }}
        >
          <Sky style={{ height: "200vh" }} />

          {/* Stars are siblings of Sky so their % coords span the full canvas.
              Each gift gets its own `[data-gift-id]` wrapper so the cluster
              can be translated as a unit during drag (and so handlePointerDown
              can identify which cluster a press landed on via .closest()). */}
          <div style={{ position: "absolute", inset: 0 }}>
            {!giftsLoading &&
              gifts.map((gift) => {
                const positions = expandClusterPositions(gift);
                const altBase =
                  gift.reason.length > 60
                    ? `${gift.reason.slice(0, 57)}…`
                    : gift.reason;
                return (
                  <div
                    key={gift.id}
                    data-gift-id={gift.id}
                    ref={(el) => {
                      if (el) clusterRefs.current.set(gift.id, el);
                      else clusterRefs.current.delete(gift.id);
                    }}
                    style={{ position: "absolute", inset: 0 }}
                  >
                    {positions.map((pos, idx) => (
                      <Star
                        key={idx}
                        giftId={gift.id}
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
                    ))}
                  </div>
                );
              })}
          </div>
        </div>
      </div>

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
          <div style={progressStyle} aria-label="Star progress">
            <span style={progressNumStyle}>{totalCount}</span>
            <span style={progressSepStyle}> / </span>
            <span style={progressNumStyle}>{chart.goalCount}</span>
          </div>
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
            currentUserId={user.id}
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

const trailingStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 12,
  flexShrink: 0,
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

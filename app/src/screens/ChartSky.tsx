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
import { GoalCapsule } from "../components/GoalCapsule";
import { SkyEditOverlay } from "../components/SkyEditOverlay";
import { ErrorScroll } from "../components/ErrorScroll";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { useCurrentGroup } from "../hooks/useCurrentGroup";
import { useChart } from "../hooks/useChart";
import {
  useGiftsForChart,
  type GiftWithLinks,
} from "../hooks/useGiftsForChart";
import { expandClusterPositions } from "../lib/starPositioning";
import { db } from "../db/client";

// Bounds for the dragged anchor. Intentionally a touch tighter than
// `starPositioning.ts`'s satellite clamp (0.04..0.96): the anchor
// itself is the cluster's first star, so we keep it well clear of
// the canvas edge rather than relying on the satellite-only clamp
// to rescue it. The satellite clamp still runs at render time, so
// off-anchor satellites that would otherwise spill past the edge
// get pulled back to 0.04..0.96.
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

  // Freeze the set of gift IDs that are present on initial load so we can
  // mark any gifts that arrive later as `isNew` for the dramatic pop entrance.
  const initialGiftIds = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!giftsLoading && initialGiftIds.current === null) {
      initialGiftIds.current = new Set(gifts.map((g) => g.id));
    }
  }, [giftsLoading, gifts]);

  const [selectedGift, setSelectedGift] = useState<GiftWithLinks | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editingGoal, setEditingGoal] = useState(false);
  const [editingChartName, setEditingChartName] = useState(false);
  const [chartNameInput, setChartNameInput] = useState("");
  const chartNameInputRef = useRef<HTMLInputElement>(null);
  // Surfaced near the top of the screen for chart-scope failures (e.g.
  // delete rejected by perms). Auto-dismissable.
  const [chartError, setChartError] = useState<string | null>(null);

  // Async commit handler for GoalCapsule. Validation (positive integer,
  // not below current totalCount) lives inside GoalCapsule; we just wrap
  // the transact and let any rejection bubble up so the capsule can
  // surface it. The realtime echo of `chart.goalCount` keeps the visible
  // value in sync once the write lands.
  async function handleGoalCommit(newGoal: number): Promise<void> {
    if (!chartId) return;
    await db.transact(db.tx.charts[chartId].update({ goalCount: newGoal }));
  }

  const startEditingChartName = () => {
    if (!chart) return;
    setChartNameInput(chart.name);
    setEditingChartName(true);
    setTimeout(() => chartNameInputRef.current?.select(), 0);
  };

  const commitChartNameEdit = async () => {
    const trimmed = chartNameInput.trim();
    setEditingChartName(false);
    if (trimmed && trimmed !== chart?.name && chartId) {
      try {
        await db.transact(db.tx.charts[chartId].update({ name: trimmed }));
      } catch (err) {
        const message =
          err instanceof Error && err.message
            ? err.message
            : "Couldn't rename this chart — please try again.";
        setChartError(message);
      }
    }
  };

  const cancelChartNameEdit = () => {
    setEditingChartName(false);
    setChartNameInput("");
  };

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
  // `baseOffsetX/Y` captures any inline transform already on the wrapper
  // at drag-start (e.g. from a previous drag whose pending write hasn't
  // confirmed yet), so a second drag doesn't cause a visual jump.
  const clusterDragRef = useRef<{
    giftId: string; px: number; py: number; committed: boolean;
    baseOffsetX: number; baseOffsetY: number;
  } | null>(null);
  // DOM refs for each cluster wrapper, keyed by gift id. We mutate
  // `style.transform` directly during drag for per-frame smoothness instead
  // of routing every pointermove through React state.
  const clusterRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  // Per-gift "we wrote this position, waiting for realtime to confirm" map.
  // While a write is in-flight, we keep the inline drag transform applied
  // so the cluster doesn't snap back to its old anchor in the gap before
  // the row update arrives. The effect below clears the transform once
  // the gift's x/y in `gifts` matches what we wrote.
  const pendingWrites = useRef<
    Map<string, { expectedX: number; expectedY: number }>
  >(new Map());
  // Per-gift timeout IDs for failure-revert animations. Tracked so we can
  // cancel an in-progress animation and clear its transition before a new
  // drag starts on the same cluster.
  const failTimeouts = useRef<Map<string, ReturnType<typeof window.setTimeout>>>(new Map());
  const dragMoved = useRef(false);
  const activePointerId = useRef<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Cancel any in-progress failure-revert animation for a cluster, clearing
  // both the scheduled timeout and the CSS transition so that subsequent
  // per-frame transform updates are not accidentally animated.
  function cancelFailTimeout(id: string) {
    const tid = failTimeouts.current.get(id);
    if (tid !== undefined) {
      window.clearTimeout(tid);
      failTimeouts.current.delete(id);
      const el = clusterRefs.current.get(id);
      if (el) el.style.transition = "";
    }
  }

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

  // When a realtime row update arrives, drop the inline drag transform
  // for any cluster whose pending position has now caught up. This is
  // what eliminates the snap-back-then-update flash on the success path:
  // we keep the drag transform applied through the round-trip and only
  // clear it when the row's stored x/y matches what we wrote.
  useEffect(() => {
    if (pendingWrites.current.size === 0) return;
    for (const [giftId, expected] of pendingWrites.current) {
      const g = gifts.find((g) => g.id === giftId);
      if (
        g &&
        Math.abs(g.x - expected.expectedX) < 1e-3 &&
        Math.abs(g.y - expected.expectedY) < 1e-3
      ) {
        pendingWrites.current.delete(giftId);
        const el = clusterRefs.current.get(giftId);
        if (el) el.style.transform = "";
      }
    }
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
          if (el) {
            const totalDx = clusterDragRef.current.baseOffsetX + dx;
            const totalDy = clusterDragRef.current.baseOffsetY + dy;
            el.style.transform = `translate(${totalDx}px, ${totalDy}px)`;
          }
        }
        return;
      }

      if (!dragState.current) return;
      const dx = e.clientX - dragState.current.px;
      const dy = e.clientY - dragState.current.py;
      if (!dragMoved.current && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
        dragMoved.current = true;
      }
      const next = clampedPan(
        dragState.current.panX + dx,
        dragState.current.panY + dy,
      );
      // Re-anchor the drag origin whenever the pan is clamped at an edge.
      // Without this, overshooting the boundary accumulates in the delta so
      // the user must drag back through the entire overshoot before the
      // canvas starts moving again — making panning feel broken after
      // hitting an edge.
      if (next.x !== dragState.current.panX + dx) {
        dragState.current.panX = next.x;
        dragState.current.px = e.clientX;
      }
      if (next.y !== dragState.current.panY + dy) {
        dragState.current.panY = next.y;
        dragState.current.py = e.clientY;
      }
      panRef.current = next;
      applyTransform();
    }
    function onUp(e: PointerEvent) {
      if (e.pointerId !== activePointerId.current) return;
      activePointerId.current = null;

      // Cluster-drag commit: write new x/y to the gift row. Keep the
      // inline drag transform applied; it gets cleared by the effect
      // above once the realtime row reflects the new position. On
      // failure we animate the transform back to (0, 0) so the user
      // sees a clear "didn't take" instead of a silent revert.
      const cd = clusterDragRef.current;
      if (cd?.committed) {
        const dxPx = e.clientX - cd.px;
        const dyPx = e.clientY - cd.py;
        // The canvas is 200vw × 200vh, so a 1px screen delta is
        // 1/(2 × innerWidth) of normalized canvas space.
        const dxNorm = dxPx / (window.innerWidth * 2);
        const dyNorm = dyPx / (window.innerHeight * 2);
        const giftId = cd.giftId;
        const wrapper = clusterRefs.current.get(giftId);
        // If there is a pending (unconfirmed) write for this gift, use its
        // expected position as the base so a second drag compounds correctly
        // on top of the first. Otherwise fall back to the last realtime
        // snapshot.
        const pendingBase = pendingWrites.current.get(giftId);
        const giftSnapshot = giftsRef.current.find((g) => g.id === giftId);
        const baseX = pendingBase?.expectedX ?? giftSnapshot?.x;
        const baseY = pendingBase?.expectedY ?? giftSnapshot?.y;
        if (baseX != null && baseY != null) {
          const newX = clampAnchor(baseX + dxNorm);
          const newY = clampAnchor(baseY + dyNorm);
          // Only write when the position actually changed past the
          // 4-decimal precision we serialize at — InstantDB happily
          // accepts no-op updates, but they're noise on the wire.
          if (
            Math.abs(newX - baseX) > 1e-4 ||
            Math.abs(newY - baseY) > 1e-4
          ) {
            pendingWrites.current.set(giftId, {
              expectedX: newX,
              expectedY: newY,
            });
            db.transact(
              db.tx.gifts[giftId].update({ x: newX, y: newY }),
            ).catch((err) => {
              console.warn("[chart-sky] cluster reposition failed", err);
              pendingWrites.current.delete(giftId);
              // Animate the transform back to origin so the snap-back
              // reads as a deliberate "didn't take" rather than a
              // glitch. Cancel any previous failure animation and store
              // the new timeout so a subsequent drag can cancel it.
              if (wrapper) {
                cancelFailTimeout(giftId);
                wrapper.style.transition = "transform 220ms ease-out";
                wrapper.style.transform = "";
                const tid = window.setTimeout(() => {
                  if (wrapper) wrapper.style.transition = "";
                  failTimeouts.current.delete(giftId);
                }, 240);
                failTimeouts.current.set(giftId, tid);
              }
            });
          } else if (wrapper) {
            // No-op drag (sub-threshold movement from base) — restore the
            // wrapper to the baseOffset transform that was already applied
            // at drag start. If a pending write is in-flight, keep its
            // transform; otherwise clear it entirely.
            wrapper.style.transform = pendingBase
              ? `translate(${cd.baseOffsetX}px, ${cd.baseOffsetY}px)`
              : "";
          }
        } else if (wrapper) {
          wrapper.style.transform = "";
        }
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
      // Read the cluster's current inline transform offset so that a
      // second drag while the first pending write is in-flight starts from
      // the right visual anchor and doesn't cause a jump.
      let baseOffsetX = 0;
      let baseOffsetY = 0;
      const wrapper = clusterRefs.current.get(giftId);
      // If a failure-revert animation is in progress for this cluster,
      // cancel it and clear the transition immediately so per-frame
      // transform updates during the new drag aren't accidentally animated.
      cancelFailTimeout(giftId);
      if (wrapper?.style.transform) {
        const m = wrapper.style.transform.match(
          /translate\(\s*(-?[\d.]+(?:e[+-]?\d+)?)px,\s*(-?[\d.]+(?:e[+-]?\d+)?)px\s*\)/,
        );
        if (m) {
          baseOffsetX = parseFloat(m[1]) || 0;
          baseOffsetY = parseFloat(m[2]) || 0;
        }
      }
      clusterDragRef.current = {
        giftId,
        px: e.clientX,
        py: e.clientY,
        committed: false,
        baseOffsetX,
        baseOffsetY,
      };
      dragMoved.current = false;
      // Cursor feedback: same `grab → grabbing` state as the pan
      // gesture so the surface acknowledges the press immediately.
      setIsDragging(true);
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
                    // The wrapper is full-canvas (so its child stars can
                    // position via `%`), but `pointer-events: none` lets
                    // empty-sky presses pass through to the pan surface
                    // underneath. Stars themselves set `pointer-events:
                    // auto` in Star.module.css, so the press only lands
                    // here when the pointer is actually on a star image —
                    // the press handler then walks `closest('[data-gift-id]')`
                    // back up to identify the cluster.
                    style={{
                      position: "absolute",
                      inset: 0,
                      pointerEvents: "none",
                    }}
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
                        isNew={
                          initialGiftIds.current != null &&
                          !initialGiftIds.current.has(gift.id)
                        }
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
          {editingChartName ? (
            <input
              ref={chartNameInputRef}
              value={chartNameInput}
              onChange={(e) => setChartNameInput(e.target.value)}
              onBlur={commitChartNameEdit}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitChartNameEdit();
                if (e.key === "Escape") cancelChartNameEdit();
              }}
              style={{
                margin: 0,
                fontFamily: "var(--sc-serif)",
                fontWeight: 500,
                fontSize: 18,
                letterSpacing: "-0.005em",
                background: "transparent",
                border: "none",
                borderBottom: "2px solid var(--sc-gold)",
                color: "var(--sc-fg)",
                outline: "none",
                padding: "0 2px",
                width: `${Math.max(chartNameInput.length, 4)}ch`,
                minWidth: 80,
                maxWidth: 320,
                textAlign: "center",
              }}
            />
          ) : (
            <h1
              onClick={startEditingChartName}
              title="Click to rename"
              style={{ ...titleStyle, cursor: "text" }}
            >
              {chart.name}
            </h1>
          )}
        </div>

        <div style={trailingStyle}>
          <PresencePanel chartId={chart.id} />
          <GoalCapsule
            totalCount={totalCount}
            goalCount={chart.goalCount}
            completed={chart.completedAt != null}
            onCommit={handleGoalCommit}
            onEditingChange={setEditingGoal}
          />
        </div>

      </header>

      {/*
        Floating error banner for chart-scope failures (delete rejected,
        etc.). Goal-edit errors live inside GoalCapsule. Anchored under the
        top bar so it doesn't fight the canvas. Auto-positioned so it
        doesn't push layout.
      */}
      <div style={errorOverlayStyle}>
        <ErrorScroll
          show={!!chartError}
          message={chartError ?? ""}
          tone="warning"
          onDismiss={() => setChartError(null)}
          align="left"
          style={{ pointerEvents: "auto" }}
        />
      </div>

      {confirmDelete && (
        <div style={confirmOverlayStyle}>
          <span style={confirmTextStyle}>Delete this chart?</span>
          <button
            type="button"
            onClick={() => setConfirmDelete(false)}
            style={confirmCancelStyle}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              setConfirmDelete(false);
              db.transact(db.tx.charts[chartId!].delete()).catch((err) => {
                console.warn("[chart-sky] delete failed", err);
                const message =
                  err instanceof Error && err.message
                    ? err.message
                    : "Couldn't delete this chart — please try again.";
                setChartError(message);
              });
            }}
            style={confirmDeleteStyle}
          >
            Delete
          </button>
        </div>
      )}

      {chart.completedAt == null && (
        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          style={deleteButtonStyle}
          aria-label="Delete chart"
        >
          🗑 Delete chart
        </button>
      )}

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
            currentUserSeed={user.avatarSeed}
          />
        )}
      </AnimatePresence>

      <SkyEditOverlay visible={editingGoal} />
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

// Floating banner stack for chart-scope errors (delete failed, goal save
// failed/invalid). Sits just below the top bar, above the canvas; doesn't
// affect layout because parent is `overflow: hidden` and we're absolute.
const errorOverlayStyle: CSSProperties = {
  position: "absolute",
  top: 76, // just below top bar (~64px) with a small gap
  left: 16,
  right: 16,
  zIndex: 15,
  display: "flex",
  flexDirection: "column",
  gap: 8,
  pointerEvents: "none", // children re-enable for the dismiss button
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

const deleteButtonStyle: CSSProperties = {
  position: "fixed",
  bottom: 14,
  // Sits to the right of the Sigil pill (~200px wide) anchored at left: 14px
  left: 224,
  zIndex: 50,
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  height: 32,
  padding: "0 12px",
  borderRadius: 999,
  background: "var(--sc-surface)",
  border: "1px solid var(--sc-stroke)",
  color: "var(--sc-fg-muted)",
  fontFamily: "var(--sc-sans)",
  fontSize: 11,
  letterSpacing: "0.04em",
  cursor: "pointer",
  whiteSpace: "nowrap",
  backdropFilter: "blur(14px) saturate(160%)",
  WebkitBackdropFilter: "blur(14px) saturate(160%)",
  boxShadow: "0 4px 18px rgba(0,0,0,0.28)",
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

const confirmOverlayStyle: CSSProperties = {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  zIndex: 20,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
  padding: "14px 20px",
  background: "rgba(20,10,0,0.92)",
  backdropFilter: "blur(12px)",
  WebkitBackdropFilter: "blur(12px)",
  borderBottom: "1px solid var(--sc-stroke)",
};

const confirmTextStyle: CSSProperties = {
  fontFamily: "var(--sc-sans)",
  fontSize: 14,
  color: "var(--sc-fg)",
  flex: 1,
};

const confirmCancelStyle: CSSProperties = {
  padding: "6px 16px",
  borderRadius: 999,
  border: "1px solid var(--sc-stroke)",
  background: "none",
  color: "var(--sc-fg)",
  fontFamily: "var(--sc-sans)",
  fontSize: 13,
  cursor: "pointer",
};

const confirmDeleteStyle: CSSProperties = {
  padding: "6px 16px",
  borderRadius: 999,
  border: "none",
  background: "#c0392b",
  color: "#fff",
  fontFamily: "var(--sc-sans)",
  fontSize: 13,
  fontWeight: 500,
  cursor: "pointer",
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

// Live presence dots for a chart's room.
//
// Joins InstantDB's "charts" room keyed by chartId. Each peer that has
// the chart open shows up as a small HSL dot (seeded the same way as
// MemberDots so a single user keeps a stable color across the app), and
// a "+ N here" chip appears once more than four peers are present.
//
// We publish our own displayName/avatarSeed via useSyncPresence so peers
// can render us with a name + color too. Caller passes a valid chart id
// (the chart-gate effects in ChartSky / ConstellationMemory ensure that).
//
// The panel is clickable: tapping it opens a popover listing who is here.

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { db } from "../db/client";
import { useCurrentUser } from "../hooks/useCurrentUser";

interface PresencePanelProps {
  chartId: string;
}

const MAX_VISIBLE = 4;

function hashString(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function colorForSeed(seed: string): string {
  const h = hashString(seed || "anon");
  const hue = h % 360;
  const sat = 55 + ((h >>> 8) % 20);
  const light = 70 + ((h >>> 16) % 10);
  return `hsl(${hue} ${sat}% ${light}%)`;
}

const dotStyle: CSSProperties = {
  width: 10,
  height: 10,
  borderRadius: "50%",
  display: "inline-block",
  flexShrink: 0,
  boxShadow:
    "0 0 0 1px rgba(255,255,255,0.22), 0 0 8px rgba(255,255,255,0.18)",
};

const chipStyle: CSSProperties = {
  marginLeft: 4,
  fontFamily: "var(--sc-sans)",
  fontSize: 11,
  letterSpacing: "0.04em",
  color: "var(--sc-fg-muted)",
  fontVariantNumeric: "tabular-nums",
};

const dropdownStyle: CSSProperties = {
  minWidth: 180,
  background: "var(--sc-bg, #0d0a14)",
  border: "1px solid var(--sc-stroke)",
  borderRadius: 12,
  boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  position: "fixed",
  zIndex: 9999,
};

export function PresencePanel({ chartId }: PresencePanelProps) {
  const { user } = useCurrentUser();
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<{ top: number; left: number } | null>(null);
  const anchorRef = useRef<HTMLButtonElement>(null);

  const room = db.room("charts", chartId);

  // Publish our own presence so peers can see us. Re-syncs whenever the
  // user's name/seed changes (e.g. right after profile setup).
  db.rooms.useSyncPresence(
    room,
    {
      displayName: user?.displayName ?? "",
      avatarSeed: user?.avatarSeed ?? user?.id ?? "",
    },
    [user?.displayName, user?.avatarSeed, user?.id],
  );

  const { peers } = db.rooms.usePresence(room, {
    keys: ["displayName", "avatarSeed"],
  });

  // peers excludes the current user by peer ID, but on reconnect the old
  // connection can briefly linger and show up as a phantom peer. Filter by
  // user identity too so the current user never sees their own dot.
  const mySeed = user?.avatarSeed || user?.id || "";
  const peerEntries = Object.values(peers ?? {}).filter(
    (p) => !mySeed || p.avatarSeed !== mySeed,
  );

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (anchorRef.current && !anchorRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  if (peerEntries.length === 0) {
    return null;
  }

  const visible = peerEntries.slice(0, MAX_VISIBLE);
  const overflow = peerEntries.length - visible.length;

  function handleToggle() {
    if (!open && anchorRef.current) {
      const r = anchorRef.current.getBoundingClientRect();
      setRect({ top: r.bottom + 8, left: r.left });
    }
    setOpen((o) => !o);
  }

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        onClick={handleToggle}
        aria-label={`${peerEntries.length} also viewing — click to see who`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          padding: "4px 10px",
          borderRadius: 999,
          background: open ? "rgba(255,255,255,0.07)" : "var(--sc-surface)",
          border: "1px solid var(--sc-stroke)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          cursor: "pointer",
          transition: "background 150ms ease",
        }}
      >
        {visible.map((p) => {
          const seed = p.avatarSeed || p.displayName || p.peerId;
          return (
            <span
              key={p.peerId}
              style={{ ...dotStyle, background: colorForSeed(seed) }}
            />
          );
        })}
        {overflow > 0 && <span style={chipStyle}>+ {overflow} here</span>}
      </button>

      {open &&
        rect &&
        createPortal(
          <div style={{ ...dropdownStyle, top: rect.top, left: rect.left }}>
            <span
              style={{
                padding: "8px 14px 6px",
                fontFamily: "var(--sc-sans)",
                fontSize: 10,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "var(--sc-fg-faint)",
              }}
            >
              Also viewing
            </span>
            <div style={{ height: 1, background: "var(--sc-stroke)", margin: "0 0 4px" }} />
            {peerEntries.map((p) => {
              const seed = p.avatarSeed || p.displayName || p.peerId;
              const name = p.displayName?.trim() || "Someone";
              return (
                <div
                  key={p.peerId}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "9px 14px",
                    fontFamily: "var(--sc-sans)",
                    fontSize: 13,
                    color: "var(--sc-fg)",
                  }}
                >
                  <span
                    style={{
                      ...dotStyle,
                      width: 10,
                      height: 10,
                      background: colorForSeed(seed),
                      flexShrink: 0,
                    }}
                  />
                  {name}
                </div>
              );
            })}
          </div>,
          document.body,
        )}
    </>
  );
}

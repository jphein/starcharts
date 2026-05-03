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

import { type CSSProperties } from "react";
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

const wrapStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  padding: "4px 10px",
  borderRadius: 999,
  background: "var(--sc-surface)",
  border: "1px solid var(--sc-stroke)",
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
};

const chipStyle: CSSProperties = {
  marginLeft: 4,
  fontFamily: "var(--sc-sans)",
  fontSize: 11,
  letterSpacing: "0.04em",
  color: "var(--sc-fg-muted)",
  fontVariantNumeric: "tabular-nums",
};

export function PresencePanel({ chartId }: PresencePanelProps) {
  const { user } = useCurrentUser();

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

  // peers excludes the current user by default; render them as dots.
  const peerEntries = Object.values(peers ?? {});
  if (peerEntries.length === 0) {
    return null;
  }

  const visible = peerEntries.slice(0, MAX_VISIBLE);
  const overflow = peerEntries.length - visible.length;

  return (
    <span style={wrapStyle} aria-label={`${peerEntries.length} viewing`}>
      {visible.map((p) => {
        const seed = p.avatarSeed || p.displayName || p.peerId;
        const title = p.displayName?.trim() || "someone";
        return (
          <span
            key={p.peerId}
            title={title}
            style={{ ...dotStyle, background: colorForSeed(seed) }}
          />
        );
      })}
      {overflow > 0 && <span style={chipStyle}>+ {overflow} here</span>}
    </span>
  );
}

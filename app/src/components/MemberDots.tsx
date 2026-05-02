import type { CSSProperties } from "react";
import type { User } from "../types";

interface MemberDotsProps {
  members: User[];
  showCount?: boolean;
}

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
  width: 12,
  height: 12,
  borderRadius: "50%",
  display: "inline-block",
  flexShrink: 0,
  boxShadow: "0 0 0 1px rgba(255,255,255,0.18), 0 0 6px rgba(255,255,255,0.12)",
};

export function MemberDots({ members, showCount = false }: MemberDotsProps) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
      }}
    >
      {members.map((m) => (
        <span
          key={m.id}
          title={m.displayName}
          style={{ ...dotStyle, background: colorForSeed(m.avatarSeed || m.id) }}
        />
      ))}
      {showCount && (
        <span
          style={{
            marginLeft: 6,
            fontFamily: "var(--sc-sans)",
            fontSize: 11,
            color: "var(--sc-fg-muted)",
            letterSpacing: "0.04em",
          }}
        >
          · {members.length} {members.length === 1 ? "member" : "members"}
        </span>
      )}
    </span>
  );
}

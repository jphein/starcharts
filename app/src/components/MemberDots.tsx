import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
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

export function MemberDots({ members, showCount = false }: MemberDotsProps) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<{ top: number; left: number } | null>(null);
  const anchorRef = useRef<HTMLButtonElement>(null);

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
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          background: "none",
          border: "none",
          padding: "4px 6px",
          borderRadius: 999,
          cursor: "pointer",
          transition: "background 150ms ease",
          ...(open ? { background: "rgba(255,255,255,0.07)" } : {}),
        }}
        aria-label="View members"
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
              Members
            </span>
            <div style={{ height: 1, background: "var(--sc-stroke)", margin: "0 0 4px" }} />
            {members.map((m) => (
              <div
                key={m.id}
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
                    background: colorForSeed(m.avatarSeed || m.id),
                    flexShrink: 0,
                  }}
                />
                {m.displayName || "Anonymous"}
              </div>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}

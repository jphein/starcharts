// Loading-state wrapper around <Sky />. The bare starfield reads as a
// blank page when a query takes longer than a frame to resolve, so we
// fade in a small italic hint after a short delay — fast loads stay
// silent, slow loads explain themselves.

import { Sky } from "./Sky";

interface LoadingSkyProps {
  hint?: string;
}

export function LoadingSky({ hint = "loading the sky…" }: LoadingSkyProps) {
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      <Sky>
        <div style={hintStyle}>
          <p style={textStyle}>{hint}</p>
        </div>
      </Sky>
      <style>{keyframes}</style>
    </div>
  );
}

const hintStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "grid",
  placeItems: "center",
  pointerEvents: "none",
};

const textStyle: React.CSSProperties = {
  margin: 0,
  fontFamily: "var(--sc-serif)",
  fontStyle: "italic",
  color: "var(--sc-fg-muted)",
  fontSize: "0.95rem",
  letterSpacing: "0.01em",
  opacity: 0,
  animation: "scLoadingHint 1200ms ease-out 350ms forwards",
};

const keyframes = `
  @keyframes scLoadingHint {
    from { opacity: 0; transform: translateY(4px); }
    to   { opacity: 1; transform: translateY(0); }
  }
`;

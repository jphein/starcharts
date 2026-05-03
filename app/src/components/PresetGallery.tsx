// 4-col grid of preset star thumbnails for the gift flow.
//
// 14 presets fill the first 14 cells of a 4×4 layout, with the last
// row's two trailing cells naturally empty. Selected cell carries a
// gold ring; each cell is a real <button> for keyboard support.

import { PRESETS, presetUrl } from "../lib/presets";

interface PresetGalleryProps {
  selected: string | null;
  onSelect: (slug: string) => void;
}

export function PresetGallery({ selected, onSelect }: PresetGalleryProps) {
  return (
    <div role="radiogroup" aria-label="Choose a star style" style={gridStyle}>
      {PRESETS.map((preset) => {
        const isSelected = selected === preset.slug;
        return (
          <button
            key={preset.slug}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-label={preset.label}
            onClick={() => onSelect(preset.slug)}
            style={cellStyle(isSelected)}
          >
            <span style={thumbWrapStyle}>
              <img
                src={presetUrl(preset.slug)}
                alt=""
                draggable={false}
                style={thumbImgStyle}
              />
            </span>
            <span style={labelStyle}>{preset.label}</span>
          </button>
        );
      })}
    </div>
  );
}

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: 12,
  width: "100%",
};

function cellStyle(selected: boolean): React.CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 6,
    padding: "10px 6px 8px",
    background: selected ? "var(--sc-surface-solid)" : "var(--sc-surface)",
    border: "1px solid var(--sc-stroke)",
    borderRadius: "var(--sc-radius-tile, 14px)",
    outline: selected ? "2px solid var(--sc-gold)" : "none",
    outlineOffset: 2,
    cursor: "pointer",
    color: "var(--sc-fg)",
    fontFamily: "var(--sc-sans)",
    transition: "outline-color 120ms ease, background 120ms ease, filter 120ms ease",
    filter: selected ? "brightness(1.08)" : undefined,
    minHeight: 96,
  };
}

const thumbWrapStyle: React.CSSProperties = {
  width: 56,
  height: 56,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const thumbImgStyle: React.CSSProperties = {
  width: "100%",
  height: "100%",
  objectFit: "contain",
  filter: "drop-shadow(0 0 8px rgba(255,235,180,0.35))",
  pointerEvents: "none",
};

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--sc-fg-muted)",
  textAlign: "center",
  lineHeight: 1.2,
};

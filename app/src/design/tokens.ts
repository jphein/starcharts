// Design tokens — typed port of design_handoff/.../tokens.jsx
// Source of truth for type pairings and sky palettes. Reviewer-tweak
// PERSONAS data from the handoff is intentionally dropped — sample
// data comes from InstantDB queries in M2+.

export type SkyMode = "dark" | "light";

export interface SkyPaletteVariant {
  gradient: string[];
  nebulae: { color: string; alpha: number }[];
  dust: string;
  fg: string;
  fgMuted: string;
  fgFaint: string;
  surface: string;
  surfaceSolid: string;
  stroke: string;
  gold: string;
}

export interface SkyPalette {
  label: string;
  dark: SkyPaletteVariant;
  light: SkyPaletteVariant;
}

export type SkyPaletteId = "midnight" | "nebula" | "dawn" | "aurora";

export const SKY_PALETTES: Record<SkyPaletteId, SkyPalette> = {
  midnight: {
    label: "Midnight",
    dark: {
      gradient: ["#040616", "#0a0e2c", "#101536", "#06081a"],
      nebulae: [
        { color: "#3b2d6e", alpha: 0.35 },
        { color: "#1c4e7a", alpha: 0.28 },
        { color: "#5a2a52", alpha: 0.22 },
      ],
      dust: "#9bb0e8",
      fg: "#f4f1e6",
      fgMuted: "rgba(244,241,230,0.62)",
      fgFaint: "rgba(244,241,230,0.32)",
      surface: "rgba(20,24,52,0.72)",
      surfaceSolid: "#0d1130",
      stroke: "rgba(244,241,230,0.14)",
      gold: "#f3c46b",
    },
    light: {
      gradient: ["#fde8d4", "#fbd4c2", "#f5b8b8", "#d99dbe"],
      nebulae: [
        { color: "#ffd8a8", alpha: 0.6 },
        { color: "#f4a8b6", alpha: 0.5 },
        { color: "#cfa9d4", alpha: 0.35 },
      ],
      dust: "#7a4a5a",
      fg: "#3b2330",
      fgMuted: "rgba(59,35,48,0.62)",
      fgFaint: "rgba(59,35,48,0.32)",
      surface: "rgba(255,251,245,0.78)",
      surfaceSolid: "#fff7ec",
      stroke: "rgba(59,35,48,0.14)",
      gold: "#c98a3c",
    },
  },
  nebula: {
    label: "Nebula",
    dark: {
      gradient: ["#08051c", "#1a0a3a", "#2a0d54", "#100530"],
      nebulae: [
        { color: "#7b2dc4", alpha: 0.45 },
        { color: "#c43d8a", alpha: 0.32 },
        { color: "#2a4cc4", alpha: 0.30 },
      ],
      dust: "#d6b8ff",
      fg: "#f6effa",
      fgMuted: "rgba(246,239,250,0.62)",
      fgFaint: "rgba(246,239,250,0.32)",
      surface: "rgba(40,18,72,0.72)",
      surfaceSolid: "#160830",
      stroke: "rgba(246,239,250,0.16)",
      gold: "#f5c46b",
    },
    light: {
      gradient: ["#f5e6ff", "#e8c8f5", "#d8a8e8", "#c084d4"],
      nebulae: [
        { color: "#e8b8ff", alpha: 0.6 },
        { color: "#ff9fc8", alpha: 0.5 },
        { color: "#a8c8ff", alpha: 0.4 },
      ],
      dust: "#5a2a6e",
      fg: "#2a0e3a",
      fgMuted: "rgba(42,14,58,0.6)",
      fgFaint: "rgba(42,14,58,0.32)",
      surface: "rgba(255,250,254,0.8)",
      surfaceSolid: "#fdf5ff",
      stroke: "rgba(42,14,58,0.14)",
      gold: "#9a3da8",
    },
  },
  dawn: {
    label: "Dawn",
    dark: {
      gradient: ["#0a1838", "#1a2c5a", "#3a3060", "#180d2a"],
      nebulae: [
        { color: "#ff8a5a", alpha: 0.30 },
        { color: "#5a7adc", alpha: 0.30 },
        { color: "#c45a8a", alpha: 0.25 },
      ],
      dust: "#ffd4a8",
      fg: "#fff4e8",
      fgMuted: "rgba(255,244,232,0.62)",
      fgFaint: "rgba(255,244,232,0.32)",
      surface: "rgba(28,40,80,0.72)",
      surfaceSolid: "#0f1a3a",
      stroke: "rgba(255,244,232,0.16)",
      gold: "#ffc878",
    },
    light: {
      gradient: ["#ffeed4", "#ffd5b8", "#ffb6a0", "#e8a8c0"],
      nebulae: [
        { color: "#ffdab0", alpha: 0.65 },
        { color: "#ffb0a0", alpha: 0.55 },
        { color: "#e8b0d0", alpha: 0.4 },
      ],
      dust: "#8a4030",
      fg: "#3a1c20",
      fgMuted: "rgba(58,28,32,0.62)",
      fgFaint: "rgba(58,28,32,0.32)",
      surface: "rgba(255,250,242,0.8)",
      surfaceSolid: "#fff5e8",
      stroke: "rgba(58,28,32,0.14)",
      gold: "#c46a3a",
    },
  },
  aurora: {
    label: "Aurora",
    dark: {
      gradient: ["#03120c", "#062420", "#0a3a32", "#021a14"],
      nebulae: [
        { color: "#2dc4a8", alpha: 0.35 },
        { color: "#5ac46a", alpha: 0.28 },
        { color: "#3a78c4", alpha: 0.30 },
      ],
      dust: "#b8ffd4",
      fg: "#eaf6ee",
      fgMuted: "rgba(234,246,238,0.62)",
      fgFaint: "rgba(234,246,238,0.32)",
      surface: "rgba(8,40,32,0.72)",
      surfaceSolid: "#06241c",
      stroke: "rgba(234,246,238,0.16)",
      gold: "#a8e8b8",
    },
    light: {
      gradient: ["#e8fbf0", "#c8f0d8", "#a8e0d4", "#88c8d8"],
      nebulae: [
        { color: "#a8f0c8", alpha: 0.6 },
        { color: "#a8e8e0", alpha: 0.5 },
        { color: "#c8d8f0", alpha: 0.4 },
      ],
      dust: "#1c4a3a",
      fg: "#0f2820",
      fgMuted: "rgba(15,40,32,0.62)",
      fgFaint: "rgba(15,40,32,0.32)",
      surface: "rgba(248,255,250,0.82)",
      surfaceSolid: "#f0fbf4",
      stroke: "rgba(15,40,32,0.14)",
      gold: "#3a8a6a",
    },
  },
};

export interface TypePairing {
  label: string;
  serif: string;
  sans: string;
  serifWeight: number;
}

export type TypePairingId = "cormorant" | "fraunces" | "ebgaramond";

export const TYPE_PAIRINGS: Record<TypePairingId, TypePairing> = {
  cormorant: {
    label: "Cormorant + Inter",
    serif: '"Cormorant Garamond", "EB Garamond", Georgia, serif',
    sans: '"Inter", system-ui, sans-serif',
    serifWeight: 500,
  },
  fraunces: {
    label: "Fraunces + DM Sans",
    serif: '"Fraunces", "Cormorant Garamond", Georgia, serif',
    sans: '"DM Sans", system-ui, sans-serif',
    serifWeight: 500,
  },
  ebgaramond: {
    label: "EB Garamond + Inter",
    serif: '"EB Garamond", Georgia, serif',
    sans: '"Inter", system-ui, sans-serif',
    serifWeight: 500,
  },
};

// v1 defaults locked per design-port plan §3.
export const DEFAULT_PALETTE: SkyPaletteId = "midnight";
export const DEFAULT_TYPE_PAIRING: TypePairingId = "cormorant";
export const DEFAULT_MODE: SkyMode = "dark";

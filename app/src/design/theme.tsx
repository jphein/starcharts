import { useEffect, type ReactNode } from "react";
import {
  SKY_PALETTES,
  TYPE_PAIRINGS,
  DEFAULT_PALETTE,
  DEFAULT_TYPE_PAIRING,
  DEFAULT_MODE,
  type SkyPaletteId,
  type TypePairingId,
  type SkyMode,
} from "./tokens";

interface ThemeProviderProps {
  paletteId?: SkyPaletteId;
  typePairingId?: TypePairingId;
  mode?: SkyMode;
  children: ReactNode;
}

export function ThemeProvider({
  paletteId = DEFAULT_PALETTE,
  typePairingId = DEFAULT_TYPE_PAIRING,
  mode = DEFAULT_MODE,
  children,
}: ThemeProviderProps) {
  useEffect(() => {
    const palette = SKY_PALETTES[paletteId][mode];
    const pairing = TYPE_PAIRINGS[typePairingId];
    const root = document.documentElement;

    const [edge, deep, mid, far] = palette.gradient;
    root.style.setProperty("--sc-bg-edge", edge);
    root.style.setProperty("--sc-bg-deep", deep);
    root.style.setProperty("--sc-bg-mid", mid);
    root.style.setProperty("--sc-bg-far", far);

    root.style.setProperty("--sc-fg", palette.fg);
    root.style.setProperty("--sc-fg-muted", palette.fgMuted);
    root.style.setProperty("--sc-fg-faint", palette.fgFaint);

    root.style.setProperty("--sc-surface", palette.surface);
    root.style.setProperty("--sc-surface-solid", palette.surfaceSolid);
    root.style.setProperty("--sc-stroke", palette.stroke);

    root.style.setProperty("--sc-gold", palette.gold);
    root.style.setProperty("--sc-dust", palette.dust);

    palette.nebulae.forEach((n, i) => {
      root.style.setProperty(`--sc-nebula-${i + 1}`, hexToRgba(n.color, n.alpha));
    });

    root.style.setProperty("--sc-serif", pairing.serif);
    root.style.setProperty("--sc-sans", pairing.sans);
    root.style.setProperty("--sc-serif-weight", String(pairing.serifWeight));

    root.dataset.skyMode = mode;
    root.dataset.skyPalette = paletteId;
  }, [paletteId, typePairingId, mode]);

  return <>{children}</>;
}

function hexToRgba(hex: string, alpha: number): string {
  const v = hex.replace("#", "");
  const r = parseInt(v.slice(0, 2), 16);
  const g = parseInt(v.slice(2, 4), 16);
  const b = parseInt(v.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

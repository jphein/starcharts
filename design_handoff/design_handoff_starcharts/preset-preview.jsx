// preset-preview.jsx — small static preset preview used in galleries.
// Renders a single star at a fixed size on a tiny canvas, animating.

const { useEffect: usePreviewEffect, useRef: usePreviewRef } = React;

function PresetPreview({ presetId, size = 56, paletteKey = 'midnight', theme = 'dark', interactive = true }) {
  const canvasRef = usePreviewRef(null);
  usePreviewEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    const colors = window.SC_TOKENS.SKY_PALETTES[paletteKey][theme];
    const PRESETS = window.SC_STARS.PRESETS;
    const preset = PRESETS[presetId];
    let raf;
    const start = performance.now();
    const tick = () => {
      const t = (performance.now() - start) / 1000;
      ctx.clearRect(0, 0, size, size);
      // tiny gradient bg
      const bg = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      bg.addColorStop(0, colors.gradient[1]);
      bg.addColorStop(1, colors.gradient[0]);
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2, 0, 6.28);
      ctx.fill();
      if (preset) preset.draw(ctx, size / 2, size / 2, size * 0.18, t, 0.3);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [presetId, size, paletteKey, theme]);
  return (
    <canvas
      ref={canvasRef}
      style={{
        width: size, height: size, borderRadius: '50%',
        cursor: interactive ? 'pointer' : 'default',
        display: 'block',
      }}
    />
  );
}

window.SC_PRESET_PREVIEW = { PresetPreview };

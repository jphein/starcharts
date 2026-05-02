// sky.jsx — the Sky React component. Renders a chart's stars to canvas with
// parallax background dust, nebula gradients, cluster recency layering, tap
// detection, and a landing animation for newly-arriving stars.
//
// Usage:
//   <Sky theme={t} palette={p} gifts={[{id, count, style, custom_image_url, created_at, ...}]}
//        density={'regular'} animation={'drifty'} interactive
//        onTapGift={g => …} arrivingGiftId={id} />

const { useEffect, useRef, useState, useCallback, useMemo } = React;

// Deterministic PRNG so cluster positions are stable across renders.
function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashId(id) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Place a cluster of N stars centered at (cx, cy) — hand-placed-feeling, not
// gridded. Uses jittered concentric arrangement.
function placeCluster(cx, cy, count, seed, scale) {
  const rng = mulberry32(seed);
  const positions = [];
  if (count === 1) {
    positions.push([cx, cy]);
    return positions;
  }
  // First star at center, others around in a soft cloud
  positions.push([cx, cy]);
  for (let i = 1; i < count; i++) {
    const ring = i < 4 ? 1 : (i < 8 ? 2 : 3);
    const baseR = scale * (0.55 + ring * 0.5) * (0.85 + rng() * 0.5);
    const a = rng() * Math.PI * 2;
    const dx = Math.cos(a) * baseR;
    const dy = Math.sin(a) * baseR;
    positions.push([cx + dx, cy + dy]);
  }
  return positions;
}

// Decide cluster anchor for a gift in normalized 0..1 coords.
// Stable per gift id. Avoids edges and slightly biases newer gifts toward
// upper-front area so they read first.
function clusterAnchor(giftId, idxFromNewest, totalGifts) {
  const seed = hashId(giftId);
  const rng = mulberry32(seed);
  // The first ~6 gifts (newest) tend to sit in upper-mid; older ones spread
  // throughout. This creates the recency-foreground effect.
  const front = idxFromNewest < 6;
  const x = 0.08 + rng() * 0.84;
  const y = front
    ? 0.18 + rng() * 0.45
    : 0.10 + rng() * 0.78;
  return [x, y];
}

// Densitiy / animation tweak resolution
const DENSITY_SCALE = { sparse: 0.78, regular: 1.0, dense: 1.28 };
const ANIM_SPEED = { still: 0.0, drifty: 1.0, lively: 1.8 };

function Sky({
  theme = 'dark',
  paletteKey = 'midnight',
  gifts = [],
  density = 'regular',
  animation = 'drifty',
  interactive = true,
  onTapGift,
  arrivingGiftId,
  showProgress = false,
  goalCount = 50,
  small = false,
  presence = [],
  onCanvasReady,
}) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const [size, setSize] = useState({ w: 400, h: 600 });
  const animSpeed = ANIM_SPEED[animation] ?? 1.0;
  const dScale = DENSITY_SCALE[density] ?? 1.0;
  const PALETTE = window.SC_TOKENS.SKY_PALETTES[paletteKey] || window.SC_TOKENS.SKY_PALETTES.midnight;
  const colors = PALETTE[theme];
  const PRESETS = window.SC_STARS.PRESETS;

  // Resize observer
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const r = entry.contentRect;
      setSize({ w: Math.max(120, r.width), h: Math.max(120, r.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Compute stable star positions
  const placedStars = useMemo(() => {
    // Sort gifts newest-first
    const sorted = [...gifts].sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
    const W = size.w, H = size.h;
    const baseSize = Math.min(W, H);
    const out = [];
    sorted.forEach((g, idxFromNewest) => {
      const [nx, ny] = clusterAnchor(g.id, idxFromNewest, sorted.length);
      const cx = nx * W;
      const cy = ny * H;
      // Recency depth: 0 = newest (front), 1 = oldest (back)
      const depth = sorted.length > 1 ? idxFromNewest / (sorted.length - 1) : 0;
      // Newest stars are bigger and brighter; older are smaller and fainter
      const sizeMult = 1.0 - depth * 0.55;
      const alphaMult = 1.0 - depth * 0.55;
      const starSize = baseSize * (small ? 0.018 : 0.022) * sizeMult * dScale;
      const positions = placeCluster(cx, cy, g.count || 1, hashId(g.id), starSize * 2.4);
      const seed = hashId(g.id);
      const seedF = (seed % 1000) / 1000;
      positions.forEach(([x, y], k) => {
        out.push({
          giftId: g.id,
          style: g.style,
          x, y,
          size: starSize * (0.92 + ((seed + k) % 7) / 30),
          alpha: alphaMult,
          depth,
          seed: seedF + k * 0.13,
          customImage: g.style === 'custom' ? g.custom_image_url : null,
          isArriving: g.id === arrivingGiftId,
          arrivedAt: g._arrivedAt || 0,
        });
      });
    });
    return out;
  }, [gifts, size.w, size.h, dScale, small, arrivingGiftId]);

  // Custom-image cache
  const imgCacheRef = useRef(new Map());
  useEffect(() => {
    placedStars.forEach((s) => {
      if (s.customImage && !imgCacheRef.current.has(s.customImage)) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = s.customImage;
        imgCacheRef.current.set(s.customImage, img);
      }
    });
  }, [placedStars]);

  // Distant background dust (deterministic per palette+size)
  const dust = useMemo(() => {
    const rng = mulberry32(42);
    const W = size.w, H = size.h;
    const count = Math.floor((W * H) / 1800);
    const arr = [];
    for (let i = 0; i < count; i++) {
      arr.push({
        x: rng() * W,
        y: rng() * H,
        r: rng() * 1.0 + 0.3,
        alpha: 0.22 + rng() * 0.45,
        twinkle: rng() * Math.PI * 2,
        depth: rng(),
      });
    }
    return arr;
  }, [size.w, size.h, paletteKey]);

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size.w * dpr;
    canvas.height = size.h * dpr;
    canvas.style.width = `${size.w}px`;
    canvas.style.height = `${size.h}px`;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    let raf;
    const start = performance.now();

    const tick = () => {
      const now = performance.now();
      const t = ((now - start) / 1000) * animSpeed;
      const tReal = (now - start) / 1000;
      const W = size.w, H = size.h;
      ctx.clearRect(0, 0, W, H);

      // ── Background gradient sky
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      const stops = colors.gradient;
      stops.forEach((c, i) => bg.addColorStop(i / (stops.length - 1), c));
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // ── Nebula blobs (very soft radial gradients, drift slowly)
      colors.nebulae.forEach((n, i) => {
        const cx = W * (0.2 + 0.6 * (i / Math.max(1, colors.nebulae.length - 1)))
          + Math.sin(t * 0.06 + i) * W * 0.04;
        const cy = H * (0.25 + 0.5 * ((i * 0.41) % 1))
          + Math.cos(t * 0.05 + i * 1.3) * H * 0.05;
        const r = Math.max(W, H) * (0.45 + 0.15 * (i % 2));
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        grad.addColorStop(0, window.SC_STARS.rgba(n.color, n.alpha));
        grad.addColorStop(0.6, window.SC_STARS.rgba(n.color, n.alpha * 0.4));
        grad.addColorStop(1, window.SC_STARS.rgba(n.color, 0));
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);
      });

      // ── Distant dust stars (parallax drift)
      ctx.save();
      ctx.fillStyle = colors.dust;
      const drift = t * (animSpeed > 0 ? 1 : 0);
      dust.forEach((d) => {
        const px = (d.x + drift * (4 + d.depth * 8)) % W;
        const py = d.y;
        const tw = 0.6 + 0.4 * Math.sin(tReal * (1.0 + d.depth * 1.5) + d.twinkle);
        ctx.globalAlpha = d.alpha * tw * (theme === 'dark' ? 1 : 0.55);
        ctx.beginPath();
        ctx.arc(px, py, d.r, 0, 6.28);
        ctx.fill();
      });
      ctx.restore();

      // ── Stars: depth-sorted, oldest first so newest stars are on top
      const sorted = [...placedStars].sort((a, b) => b.depth - a.depth);
      sorted.forEach((s) => {
        let scale = 1;
        let extraAlpha = 1;
        // Landing animation: from t=0 to ~1.0s after arrival
        if (s.arrivedAt) {
          const dt = (now - s.arrivedAt) / 1000;
          if (dt < 1.4) {
            const k = Math.max(0, dt / 1.4);
            // ease out elastic-ish
            scale = 0.1 + (1 - Math.pow(1 - k, 3)) * 1.0;
            extraAlpha = Math.min(1, k * 1.4);
          }
        }
        ctx.save();
        ctx.globalAlpha = s.alpha * extraAlpha;
        if (s.customImage) {
          const img = imgCacheRef.current.get(s.customImage);
          if (img && img.complete && img.naturalWidth) {
            const sz = s.size * 4 * scale;
            ctx.translate(s.x, s.y);
            // glow behind
            const grd = ctx.createRadialGradient(0, 0, 0, 0, 0, sz * 0.9);
            grd.addColorStop(0, 'rgba(255,255,220,0.55)');
            grd.addColorStop(1, 'rgba(255,255,220,0)');
            ctx.fillStyle = grd;
            ctx.beginPath(); ctx.arc(0, 0, sz * 0.9, 0, 6.28); ctx.fill();
            ctx.drawImage(img, -sz / 2, -sz / 2, sz, sz);
          } else {
            // forming placeholder
            const grd = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.size * 3);
            grd.addColorStop(0, 'rgba(255,240,200,0.7)');
            grd.addColorStop(1, 'rgba(255,240,200,0)');
            ctx.fillStyle = grd;
            ctx.beginPath(); ctx.arc(s.x, s.y, s.size * 3, 0, 6.28); ctx.fill();
          }
        } else {
          const preset = PRESETS[s.style] || PRESETS.gold;
          ctx.translate(0, 0);
          // Slow drift (very gentle)
          const dx = Math.sin(t * 0.2 + s.seed * 4) * 0.6 * dScale;
          const dy = Math.cos(t * 0.15 + s.seed * 3) * 0.4 * dScale;
          if (scale !== 1) {
            ctx.translate(s.x + dx, s.y + dy);
            ctx.scale(scale, scale);
            preset.draw(ctx, 0, 0, s.size, t, s.seed);
          } else {
            preset.draw(ctx, s.x + dx, s.y + dy, s.size, t, s.seed);
          }
        }
        ctx.restore();
      });

      // ── Presence: subtle ambient indicators (other people viewing)
      if (presence && presence.length) {
        presence.forEach((p, i) => {
          const px = W * 0.5 + Math.cos(t * 0.4 + i) * W * 0.32;
          const py = H * 0.5 + Math.sin(t * 0.4 + i) * H * 0.28;
          ctx.save();
          ctx.globalAlpha = 0.22 + 0.1 * Math.sin(tReal * 1.5 + i);
          const grd = ctx.createRadialGradient(px, py, 0, px, py, 28);
          grd.addColorStop(0, p.color || '#ffffff');
          grd.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = grd;
          ctx.beginPath(); ctx.arc(px, py, 28, 0, 6.28); ctx.fill();
          ctx.restore();
        });
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    if (onCanvasReady) onCanvasReady(canvas);
    return () => cancelAnimationFrame(raf);
  }, [size, placedStars, dust, colors, animSpeed, dScale, theme, presence]);

  // Tap/click handler
  const handleTap = useCallback((e) => {
    if (!interactive || !onTapGift) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    // Find closest star within hit radius (depth-aware: front stars first)
    const sorted = [...placedStars].sort((a, b) => a.depth - b.depth);
    let bestId = null;
    let bestDist = Infinity;
    sorted.forEach((s) => {
      const d = Math.hypot(s.x - cx, s.y - cy);
      const hit = s.size * 5;
      if (d < hit && d < bestDist) {
        bestDist = d;
        bestId = s.giftId;
      }
    });
    if (bestId) {
      const g = gifts.find((x) => x.id === bestId);
      if (g) onTapGift(g);
    }
  }, [placedStars, gifts, interactive, onTapGift]);

  return (
    <div ref={wrapRef} style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <canvas
        ref={canvasRef}
        onClick={handleTap}
        style={{ display: 'block', cursor: interactive ? 'pointer' : 'default' }}
      />
    </div>
  );
}

window.SC_SKY = { Sky, placeCluster, hashId, mulberry32 };

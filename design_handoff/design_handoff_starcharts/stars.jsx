// stars.jsx — canvas star rendering engine + 12 preset families.
// A "star" is drawn into a 2d canvas context at (x, y, size, t) where t is the
// global animation clock in seconds. Each preset is a function that paints
// itself, including its own glow + sparkle micro-animation.
//
// All presets use the same base 4-point + 4-point cross with a soft glow,
// then add their own twist: color palette, ring, ember, comet trail, etc.
// Distinctive at a glance, even at 6px.

// Drawing helpers ----------------------------------------------------------
function radialGrad(ctx, x, y, r, stops) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  for (const [t, c] of stops) g.addColorStop(t, c);
  return g;
}

// 4-point sharp star path: long horizontal/vertical points, short diagonals.
function starPath(ctx, x, y, size, sharpness = 0.18) {
  const s = size;
  const inner = s * sharpness;
  ctx.beginPath();
  ctx.moveTo(x, y - s);
  ctx.lineTo(x + inner, y - inner);
  ctx.lineTo(x + s, y);
  ctx.lineTo(x + inner, y + inner);
  ctx.lineTo(x, y + s);
  ctx.lineTo(x - inner, y + inner);
  ctx.lineTo(x - s, y);
  ctx.lineTo(x - inner, y - inner);
  ctx.closePath();
}

// 6-point softer "burst" star
function burstPath(ctx, x, y, size, points = 6, sharpness = 0.4) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? size : size * sharpness;
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

// Soft circular glow halo
function drawGlow(ctx, x, y, r, color, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = radialGrad(ctx, x, y, r, [
    [0, color],
    [0.4, color.replace(/[\d.]+\)$/, '0.4)')],
    [1, color.replace(/[\d.]+\)$/, '0)')],
  ]);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// Cross-flare: long thin horizontal+vertical light streak
function drawFlare(ctx, x, y, len, thickness, color, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  // Horizontal
  const gh = ctx.createLinearGradient(x - len, y, x + len, y);
  gh.addColorStop(0, 'rgba(255,255,255,0)');
  gh.addColorStop(0.5, color);
  gh.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gh;
  ctx.fillRect(x - len, y - thickness / 2, len * 2, thickness);
  // Vertical
  const gv = ctx.createLinearGradient(x, y - len, x, y + len);
  gv.addColorStop(0, 'rgba(255,255,255,0)');
  gv.addColorStop(0.5, color);
  gv.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gv;
  ctx.fillRect(x - thickness / 2, y - len, thickness, len * 2);
  ctx.restore();
}

// Helpers for color
function rgba(c, a) {
  // Accepts #rrggbb or rgb()
  if (c.startsWith('#')) {
    const r = parseInt(c.slice(1, 3), 16);
    const g = parseInt(c.slice(3, 5), 16);
    const b = parseInt(c.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${a})`;
  }
  return c.replace(/[\d.]+\)$/, `${a})`);
}

// ─────────────────────────────────────────────────────────────
// Preset families: 12 distinctive stars.
// Each preset = { id, label, swatch (hex for menus), draw(ctx, x, y, size, t, seed) }
// `seed` is a per-cluster jitter (0..1). Twinkle / drift uses (t + seed*7).
// ─────────────────────────────────────────────────────────────
const PRESETS = {
  gold: {
    id: 'gold', label: 'Gold sparkle', swatch: '#f5c46b',
    draw(ctx, x, y, size, t, seed = 0) {
      const tw = 0.85 + 0.15 * Math.sin(t * 2.4 + seed * 7);
      drawGlow(ctx, x, y, size * 4.5, rgba('#f5c46b', 0.55 * tw));
      drawFlare(ctx, x, y, size * 3.2, size * 0.18, rgba('#fff4cc', 0.9 * tw));
      // Core
      const grad = radialGrad(ctx, x, y, size, [
        [0, '#fffbe8'], [0.4, '#ffe39a'], [1, '#c98a3c'],
      ]);
      ctx.fillStyle = grad;
      starPath(ctx, x, y, size, 0.22);
      ctx.fill();
      // Hot pinprick
      ctx.fillStyle = rgba('#ffffff', 0.95);
      ctx.beginPath(); ctx.arc(x, y, size * 0.18, 0, 6.28); ctx.fill();
    },
  },

  ruby: {
    id: 'ruby', label: 'Ruby twinkle', swatch: '#e8537a',
    draw(ctx, x, y, size, t, seed = 0) {
      const tw = 0.82 + 0.18 * Math.sin(t * 3 + seed * 5);
      drawGlow(ctx, x, y, size * 4.2, rgba('#e8537a', 0.55 * tw));
      drawFlare(ctx, x, y, size * 2.8, size * 0.15, rgba('#ffd0d8', 0.85 * tw));
      const grad = radialGrad(ctx, x, y, size, [
        [0, '#fff0f4'], [0.35, '#ff9bb0'], [0.75, '#d33860'], [1, '#7a1838'],
      ]);
      ctx.fillStyle = grad;
      starPath(ctx, x, y, size, 0.2);
      ctx.fill();
      ctx.fillStyle = rgba('#ffffff', 0.85 * tw);
      ctx.beginPath(); ctx.arc(x, y - size * 0.25, size * 0.15, 0, 6.28); ctx.fill();
    },
  },

  amethyst: {
    id: 'amethyst', label: 'Amethyst nebula', swatch: '#a87dd6',
    draw(ctx, x, y, size, t, seed = 0) {
      const tw = 0.82 + 0.18 * Math.sin(t * 1.8 + seed * 4);
      // Nebulous outer haze
      drawGlow(ctx, x, y, size * 5.5, rgba('#7c4ec8', 0.4 * tw));
      drawGlow(ctx, x, y, size * 3.5, rgba('#d8a8ff', 0.4 * tw));
      drawFlare(ctx, x, y, size * 2.6, size * 0.13, rgba('#ecd0ff', 0.8));
      const grad = radialGrad(ctx, x, y, size, [
        [0, '#fbf0ff'], [0.4, '#d4a0f0'], [1, '#5a2d9c'],
      ]);
      ctx.fillStyle = grad;
      burstPath(ctx, x, y, size, 5, 0.42);
      ctx.fill();
    },
  },

  pearl: {
    id: 'pearl', label: 'Moon pearl', swatch: '#e8e4d8',
    draw(ctx, x, y, size, t, seed = 0) {
      const tw = 0.88 + 0.12 * Math.sin(t * 1.4 + seed * 3);
      drawGlow(ctx, x, y, size * 4.0, rgba('#e8e4d8', 0.6 * tw));
      // Orb body — round, satiny
      const grad = radialGrad(ctx, x - size * 0.2, y - size * 0.25, size * 1.1, [
        [0, '#ffffff'], [0.4, '#fbf6ec'], [0.8, '#d8cfb8'], [1, '#a89e88'],
      ]);
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(x, y, size * 0.85, 0, 6.28); ctx.fill();
      // Sheen highlight
      ctx.fillStyle = rgba('#ffffff', 0.7 * tw);
      ctx.beginPath();
      ctx.ellipse(x - size * 0.25, y - size * 0.35, size * 0.28, size * 0.14, -0.6, 0, 6.28);
      ctx.fill();
      // Subtle ring
      ctx.strokeStyle = rgba('#ffffff', 0.25);
      ctx.lineWidth = size * 0.06;
      ctx.beginPath(); ctx.arc(x, y, size * 0.95, 0, 6.28); ctx.stroke();
    },
  },

  jade: {
    id: 'jade', label: 'Emerald glint', swatch: '#5fc89a',
    draw(ctx, x, y, size, t, seed = 0) {
      const tw = 0.84 + 0.16 * Math.sin(t * 2.6 + seed * 6);
      drawGlow(ctx, x, y, size * 4.0, rgba('#5fc89a', 0.55 * tw));
      drawFlare(ctx, x, y, size * 2.6, size * 0.14, rgba('#d0fae0', 0.85 * tw));
      const grad = radialGrad(ctx, x, y, size, [
        [0, '#f0fff5'], [0.4, '#a8e8c0'], [1, '#1a6a4a'],
      ]);
      ctx.fillStyle = grad;
      starPath(ctx, x, y, size, 0.24);
      ctx.fill();
      // Inner facet
      ctx.fillStyle = rgba('#ffffff', 0.5 * tw);
      starPath(ctx, x, y, size * 0.4, 0.3);
      ctx.fill();
    },
  },

  aurora: {
    id: 'aurora', label: 'Aurora ribbon', swatch: '#7ee0c8',
    draw(ctx, x, y, size, t, seed = 0) {
      const tw = 0.85 + 0.15 * Math.sin(t * 1.6 + seed * 4);
      // Layered glows in three colours
      drawGlow(ctx, x, y, size * 5.5, rgba('#5fc4d8', 0.32 * tw));
      drawGlow(ctx, x - size * 0.4, y, size * 3.5, rgba('#a8f0c8', 0.32 * tw));
      drawGlow(ctx, x + size * 0.4, y, size * 3.5, rgba('#d8a8e8', 0.32 * tw));
      drawFlare(ctx, x, y, size * 2.6, size * 0.12, rgba('#ddfff0', 0.8));
      // Ribbon arc through star
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(0.4 + 0.2 * Math.sin(t * 0.5 + seed));
      ctx.strokeStyle = rgba('#a8f0c8', 0.55);
      ctx.lineWidth = size * 0.35;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-size * 1.6, size * 0.3);
      ctx.quadraticCurveTo(0, -size * 0.4, size * 1.6, size * 0.1);
      ctx.stroke();
      ctx.restore();
      // Core
      const grad = radialGrad(ctx, x, y, size, [
        [0, '#fbffff'], [0.4, '#a8f0e0'], [1, '#3a7a8a'],
      ]);
      ctx.fillStyle = grad;
      starPath(ctx, x, y, size * 0.85, 0.22);
      ctx.fill();
    },
  },

  copper: {
    id: 'copper', label: 'Copper ember', swatch: '#d8794a',
    draw(ctx, x, y, size, t, seed = 0) {
      const tw = 0.82 + 0.18 * Math.sin(t * 3.2 + seed * 8);
      drawGlow(ctx, x, y, size * 4.0, rgba('#d8794a', 0.55 * tw));
      drawFlare(ctx, x, y, size * 2.4, size * 0.14, rgba('#ffd0a8', 0.85 * tw));
      const grad = radialGrad(ctx, x, y - size * 0.1, size, [
        [0, '#fff5e0'], [0.35, '#ffb878'], [0.75, '#c4582a'], [1, '#5a2008'],
      ]);
      ctx.fillStyle = grad;
      starPath(ctx, x, y, size, 0.26);
      ctx.fill();
      // Ember flicker spots
      ctx.fillStyle = rgba('#ffe0b8', 0.7 * tw);
      ctx.beginPath();
      ctx.arc(x - size * 0.2, y - size * 0.15, size * 0.1, 0, 6.28);
      ctx.fill();
    },
  },

  frost: {
    id: 'frost', label: 'Frost crystal', swatch: '#b8dcf0',
    draw(ctx, x, y, size, t, seed = 0) {
      const tw = 0.88 + 0.12 * Math.sin(t * 2.0 + seed * 5);
      drawGlow(ctx, x, y, size * 3.8, rgba('#b8dcf0', 0.55 * tw));
      drawFlare(ctx, x, y, size * 3.2, size * 0.10, rgba('#f0faff', 0.95 * tw));
      // 6-point hexagonal crystal
      ctx.save();
      ctx.translate(x, y);
      ctx.strokeStyle = rgba('#e8f5ff', 0.85);
      ctx.lineWidth = size * 0.14;
      ctx.lineCap = 'round';
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a) * size, Math.sin(a) * size);
        // small barbs
        ctx.moveTo(Math.cos(a) * size * 0.55 - Math.sin(a) * size * 0.15,
                   Math.sin(a) * size * 0.55 + Math.cos(a) * size * 0.15);
        ctx.lineTo(Math.cos(a) * size * 0.7, Math.sin(a) * size * 0.7);
        ctx.moveTo(Math.cos(a) * size * 0.55 + Math.sin(a) * size * 0.15,
                   Math.sin(a) * size * 0.55 - Math.cos(a) * size * 0.15);
        ctx.lineTo(Math.cos(a) * size * 0.7, Math.sin(a) * size * 0.7);
        ctx.stroke();
      }
      ctx.restore();
      // Hot center
      ctx.fillStyle = rgba('#ffffff', 0.9 * tw);
      ctx.beginPath(); ctx.arc(x, y, size * 0.22, 0, 6.28); ctx.fill();
    },
  },

  rose: {
    id: 'rose', label: 'Cosmic rose', swatch: '#f0a0c0',
    draw(ctx, x, y, size, t, seed = 0) {
      const tw = 0.85 + 0.15 * Math.sin(t * 1.8 + seed * 4);
      drawGlow(ctx, x, y, size * 4.5, rgba('#f0a0c0', 0.5 * tw));
      drawFlare(ctx, x, y, size * 2.4, size * 0.13, rgba('#ffe0ec', 0.8));
      // Rose-petal: layered offset stars
      ctx.save();
      ctx.translate(x, y);
      for (let i = 0; i < 3; i++) {
        ctx.rotate(0.4);
        const grad = radialGrad(ctx, 0, 0, size * (1 - i * 0.18), [
          [0, '#fff0f6'], [0.5, '#f5b8d0'], [1, '#a83d6a'],
        ]);
        ctx.fillStyle = grad;
        ctx.globalAlpha = 0.7;
        burstPath(ctx, 0, 0, size * (1 - i * 0.18), 5, 0.55);
        ctx.fill();
      }
      ctx.restore();
    },
  },

  comet: {
    id: 'comet', label: 'Comet trail', swatch: '#a8c8ff',
    draw(ctx, x, y, size, t, seed = 0) {
      const tw = 0.85 + 0.15 * Math.sin(t * 2.4 + seed * 6);
      // Trailing tail streaming away (toward upper-left)
      const ang = -0.7 + 0.1 * Math.sin(t * 0.5 + seed);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(ang);
      const tail = ctx.createLinearGradient(0, 0, -size * 5, 0);
      tail.addColorStop(0, rgba('#ffffff', 0.9 * tw));
      tail.addColorStop(0.3, rgba('#a8c8ff', 0.5));
      tail.addColorStop(1, rgba('#a8c8ff', 0));
      ctx.fillStyle = tail;
      ctx.beginPath();
      ctx.moveTo(0, -size * 0.35);
      ctx.lineTo(0, size * 0.35);
      ctx.lineTo(-size * 5, size * 0.05);
      ctx.lineTo(-size * 5, -size * 0.05);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      // Head
      drawGlow(ctx, x, y, size * 3.2, rgba('#a8c8ff', 0.6 * tw));
      const grad = radialGrad(ctx, x, y, size, [
        [0, '#ffffff'], [0.4, '#cce0ff'], [1, '#3a6ab8'],
      ]);
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(x, y, size * 0.7, 0, 6.28); ctx.fill();
    },
  },

  rainbow: {
    id: 'rainbow', label: 'Rainbow burst', swatch: '#f5a8d0',
    draw(ctx, x, y, size, t, seed = 0) {
      const tw = 0.85 + 0.15 * Math.sin(t * 2.2 + seed * 5);
      drawGlow(ctx, x, y, size * 5.0, rgba('#f5a8d0', 0.32));
      drawGlow(ctx, x, y, size * 3.5, rgba('#a8c8f5', 0.32));
      drawGlow(ctx, x, y, size * 2.5, rgba('#a8f0c0', 0.32));
      // Conic-ish layered ribbons
      const colors = ['#ff8a8a', '#ffc070', '#f5e87a', '#9be8a0', '#7ad0e8', '#a8a0e8', '#e8a0d8'];
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(t * 0.15 + seed);
      for (let i = 0; i < colors.length; i++) {
        ctx.rotate((Math.PI * 2) / colors.length);
        ctx.fillStyle = rgba(colors[i], 0.75 * tw);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, size * 1.0, -0.18, 0.18);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
      // Hot core
      ctx.fillStyle = rgba('#ffffff', 0.95);
      ctx.beginPath(); ctx.arc(x, y, size * 0.32, 0, 6.28); ctx.fill();
    },
  },

  dragon: {
    id: 'dragon', label: 'Dragon fire', swatch: '#ff6a3a',
    draw(ctx, x, y, size, t, seed = 0) {
      const tw = 0.78 + 0.22 * Math.sin(t * 4.0 + seed * 9);
      // Hot bloom
      drawGlow(ctx, x, y, size * 5.0, rgba('#ff3a1a', 0.5 * tw));
      drawGlow(ctx, x, y, size * 2.8, rgba('#ffd070', 0.7 * tw));
      drawFlare(ctx, x, y, size * 3.2, size * 0.18, rgba('#fff0a8', 0.95 * tw));
      // Spiky 8-point
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(t * 0.3 + seed);
      const grad = radialGrad(ctx, 0, 0, size, [
        [0, '#ffffff'], [0.25, '#ffe070'], [0.6, '#ff6a3a'], [1, '#7a1408'],
      ]);
      ctx.fillStyle = grad;
      burstPath(ctx, 0, 0, size, 8, 0.32);
      ctx.fill();
      ctx.restore();
    },
  },
};

// Ordered list of presets (for galleries)
const PRESET_LIST = [
  'gold', 'ruby', 'amethyst', 'pearl',
  'jade', 'aurora', 'copper', 'frost',
  'rose', 'comet', 'rainbow', 'dragon',
];

// Draw a generic distant background star (small, plain)
function drawDistantStar(ctx, x, y, size, alpha, t = 0) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x, y, size, 0, 6.28);
  ctx.fill();
  ctx.restore();
}

window.SC_STARS = { PRESETS, PRESET_LIST, drawDistantStar, rgba };

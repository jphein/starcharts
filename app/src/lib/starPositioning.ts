// Star placement helpers for chart skies.
//
// `pickGiftAnchor` chooses a normalized (x, y) anchor for a brand-new gift
// in the [0.05, 0.95] viewport, biased away from existing gifts so clusters
// don't pile on top of each other (Poisson-disc-ish — see design plan §8.1).
//
// `expandClusterPositions` renders the per-star positions for one gift's
// cluster deterministically: same gift.id always yields the same layout
// across clients so the cluster is stable when the realtime row arrives.

interface AnchorInput {
  x: number;
  y: number;
}

const MIN_AXIS = 0.05;
const MAX_AXIS = 0.95;
const DEFAULT_MIN_DIST = 0.06;
const ANCHOR_ATTEMPTS = 10;

const CLAMP_MIN = 0.04;
const CLAMP_MAX = 0.96;
const MAX_CLUSTER = 20;

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function distSq(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

function minDistanceTo(
  point: { x: number; y: number },
  others: AnchorInput[],
): number {
  if (others.length === 0) return Infinity;
  let best = Infinity;
  for (const o of others) {
    const d2 = distSq(point.x, point.y, o.x, o.y);
    if (d2 < best) best = d2;
  }
  return Math.sqrt(best);
}

export function pickGiftAnchor(
  existingGifts: AnchorInput[],
  minDist: number = DEFAULT_MIN_DIST,
): { x: number; y: number } {
  let bestPoint = { x: rand(MIN_AXIS, MAX_AXIS), y: rand(MIN_AXIS, MAX_AXIS) };
  let bestScore = minDistanceTo(bestPoint, existingGifts);
  if (bestScore >= minDist) return bestPoint;

  for (let i = 1; i < ANCHOR_ATTEMPTS; i++) {
    const candidate = {
      x: rand(MIN_AXIS, MAX_AXIS),
      y: rand(MIN_AXIS, MAX_AXIS),
    };
    const score = minDistanceTo(candidate, existingGifts);
    if (score >= minDist) return candidate;
    if (score > bestScore) {
      bestScore = score;
      bestPoint = candidate;
    }
  }

  return bestPoint;
}

// FNV-1a 32-bit hash. Cheap, deterministic, gives good seed entropy.
function fnv1a(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

// mulberry32 PRNG — small, fast, good enough for layout jitter.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clampAxis(v: number): number {
  if (v < CLAMP_MIN) return CLAMP_MIN;
  if (v > CLAMP_MAX) return CLAMP_MAX;
  return v;
}

export function expandClusterPositions(
  gift: { id: string; x: number; y: number; count: number },
): { x: number; y: number }[] {
  const n = Math.min(Math.max(gift.count, 1), MAX_CLUSTER);
  if (n === 1) {
    return [{ x: gift.x, y: gift.y }];
  }

  const radius = n <= 3 ? 0.06 : 0.09;
  const rng = mulberry32(fnv1a(gift.id));
  const positions: { x: number; y: number }[] = [
    { x: gift.x, y: gift.y },
  ];

  const satellites = n - 1;
  // Random angular offset (per cluster) so two adjacent clusters don't both
  // start at angle 0; jitter each radius so the ring doesn't look mechanical.
  const angleOffset = rng() * Math.PI * 2;
  for (let i = 0; i < satellites; i++) {
    const angle = angleOffset + (i / satellites) * Math.PI * 2;
    const jitter = 0.7 + rng() * 0.5; // 0.7..1.2 of nominal radius
    const r = radius * jitter;
    positions.push({
      x: clampAxis(gift.x + Math.cos(angle) * r),
      y: clampAxis(gift.y + Math.sin(angle) * r),
    });
  }

  return positions;
}

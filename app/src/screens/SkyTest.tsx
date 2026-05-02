import { Sky } from "../components/Sky";
import { Star } from "../components/Star";

const SLUGS = [
  "gold-sparkle",
  "ruby-twinkle",
  "amethyst-nebula",
  "silver-crescent",
  "aurora-ribbon",
  "pearl-shimmer",
  "comet-trail",
  "supernova-bloom",
  "emerald-glint",
  "copper-ember",
  "frost-crystal",
  "cosmic-rose",
  "rainbow-burst",
  "dragon-fire",
] as const;

type Slug = (typeof SLUGS)[number];

interface SampleStar {
  id: number;
  style: Slug;
  x: number;
  y: number;
  count: 1 | 2 | 3 | 5;
  delay: number;
  alt: string;
}

// Hand-picked positions (0..1 normalized) for natural sky distribution.
// Loose clusters near upper-left and lower-right; sparser in between.
const POSITIONS: Array<[number, number]> = [
  [0.08, 0.12], [0.22, 0.06], [0.37, 0.14], [0.54, 0.09], [0.71, 0.17], [0.88, 0.08],
  [0.14, 0.26], [0.29, 0.32], [0.46, 0.22], [0.63, 0.30], [0.82, 0.27], [0.94, 0.38],
  [0.06, 0.44], [0.19, 0.52], [0.33, 0.47], [0.49, 0.56], [0.67, 0.50], [0.78, 0.60],
  [0.11, 0.66], [0.25, 0.74], [0.41, 0.70], [0.58, 0.78], [0.73, 0.72], [0.90, 0.80],
  [0.16, 0.86], [0.38, 0.90], [0.52, 0.84], [0.69, 0.92], [0.84, 0.88], [0.04, 0.78],
];

// 30 stars: ~70% count=1 (21), ~20% count=2 (6), ~7% count=3 (2), ~3% count=5 (1).
const COUNTS: Array<1 | 2 | 3 | 5> = [
  1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
  2, 2, 2, 2, 2, 2,
  3, 3,
  5,
];

const STARS: SampleStar[] = POSITIONS.map(([x, y], i) => {
  const slug = SLUGS[i % SLUGS.length];
  const count = COUNTS[i % COUNTS.length];
  return {
    id: i,
    style: slug,
    x,
    y,
    count,
    delay: (i * 0.37) % 6,
    alt: `${slug} star — sample`,
  };
});

export default function SkyTest() {
  return (
    <Sky>
      {STARS.map((s) => (
        <Star
          key={s.id}
          style={s.style}
          x={s.x}
          y={s.y}
          count={s.count}
          delay={s.delay}
          alt={s.alt}
        />
      ))}
    </Sky>
  );
}

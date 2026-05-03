// Preset star catalogue.
//
// Display order is the order shown in PresetGallery. Slugs match the
// 14 PNG sprites under public/stars/{slug}.png shipped in M1.

export interface Preset {
  slug: string;
  label: string;
}

export const PRESETS: Preset[] = [
  { slug: "gold-sparkle", label: "Gold Sparkle" },
  { slug: "ruby-twinkle", label: "Ruby Twinkle" },
  { slug: "amethyst-nebula", label: "Amethyst Nebula" },
  { slug: "silver-crescent", label: "Silver Crescent" },
  { slug: "aurora-ribbon", label: "Aurora Ribbon" },
  { slug: "pearl-shimmer", label: "Pearl Shimmer" },
  { slug: "comet-trail", label: "Comet Trail" },
  { slug: "supernova-bloom", label: "Supernova Bloom" },
  { slug: "emerald-glint", label: "Emerald Glint" },
  { slug: "copper-ember", label: "Copper Ember" },
  { slug: "frost-crystal", label: "Frost Crystal" },
  { slug: "cosmic-rose", label: "Cosmic Rose" },
  { slug: "rainbow-burst", label: "Rainbow Burst" },
  { slug: "dragon-fire", label: "Dragon Fire" },
];

export function presetUrl(slug: string): string {
  return `/stars/${slug}.png`;
}

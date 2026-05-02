// tokens.jsx — design tokens, themes, sample data for Starcharts.
// Exports to window so other Babel scripts can read them.

// ─────────────────────────────────────────────────────────────
// Type pairings
// ─────────────────────────────────────────────────────────────
const TYPE_PAIRINGS = {
  cormorant: {
    label: 'Cormorant + Inter',
    serif: '"Cormorant Garamond", "EB Garamond", Georgia, serif',
    sans: '"Inter", system-ui, sans-serif',
    googleFonts: 'family=Cormorant+Garamond:wght@400;500;600;700&family=Inter:wght@400;500;600;700',
    serifWeight: 500,
  },
  fraunces: {
    label: 'Fraunces + DM Sans',
    serif: '"Fraunces", "Cormorant Garamond", Georgia, serif',
    sans: '"DM Sans", system-ui, sans-serif',
    googleFonts: 'family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=DM+Sans:wght@400;500;600;700',
    serifWeight: 500,
  },
  ebgaramond: {
    label: 'EB Garamond + Inter',
    serif: '"EB Garamond", Georgia, serif',
    sans: '"Inter", system-ui, sans-serif',
    googleFonts: 'family=EB+Garamond:wght@400;500;600;700&family=Inter:wght@400;500;600;700',
    serifWeight: 500,
  },
};

// ─────────────────────────────────────────────────────────────
// Sky palettes — each is dark + light, plus background colour ramps
// for nebulae and dust. Tweakable.
// ─────────────────────────────────────────────────────────────
const SKY_PALETTES = {
  midnight: {
    label: 'Midnight',
    dark: {
      // Deep navy with a subtle indigo lift
      gradient: ['#040616', '#0a0e2c', '#101536', '#06081a'],
      nebulae: [
        { color: '#3b2d6e', alpha: 0.35 },
        { color: '#1c4e7a', alpha: 0.28 },
        { color: '#5a2a52', alpha: 0.22 },
      ],
      dust: '#9bb0e8',
      fg: '#f4f1e6',
      fgMuted: 'rgba(244,241,230,0.62)',
      fgFaint: 'rgba(244,241,230,0.32)',
      surface: 'rgba(20,24,52,0.72)',
      surfaceSolid: '#0d1130',
      stroke: 'rgba(244,241,230,0.14)',
      gold: '#f3c46b',
    },
    light: {
      // Dawn — warm rose-gold horizon
      gradient: ['#fde8d4', '#fbd4c2', '#f5b8b8', '#d99dbe'],
      nebulae: [
        { color: '#ffd8a8', alpha: 0.6 },
        { color: '#f4a8b6', alpha: 0.5 },
        { color: '#cfa9d4', alpha: 0.35 },
      ],
      dust: '#7a4a5a',
      fg: '#3b2330',
      fgMuted: 'rgba(59,35,48,0.62)',
      fgFaint: 'rgba(59,35,48,0.32)',
      surface: 'rgba(255,251,245,0.78)',
      surfaceSolid: '#fff7ec',
      stroke: 'rgba(59,35,48,0.14)',
      gold: '#c98a3c',
    },
  },
  nebula: {
    label: 'Nebula',
    dark: {
      gradient: ['#08051c', '#1a0a3a', '#2a0d54', '#100530'],
      nebulae: [
        { color: '#7b2dc4', alpha: 0.45 },
        { color: '#c43d8a', alpha: 0.32 },
        { color: '#2a4cc4', alpha: 0.30 },
      ],
      dust: '#d6b8ff',
      fg: '#f6effa',
      fgMuted: 'rgba(246,239,250,0.62)',
      fgFaint: 'rgba(246,239,250,0.32)',
      surface: 'rgba(40,18,72,0.72)',
      surfaceSolid: '#160830',
      stroke: 'rgba(246,239,250,0.16)',
      gold: '#f5c46b',
    },
    light: {
      gradient: ['#f5e6ff', '#e8c8f5', '#d8a8e8', '#c084d4'],
      nebulae: [
        { color: '#e8b8ff', alpha: 0.6 },
        { color: '#ff9fc8', alpha: 0.5 },
        { color: '#a8c8ff', alpha: 0.4 },
      ],
      dust: '#5a2a6e',
      fg: '#2a0e3a',
      fgMuted: 'rgba(42,14,58,0.6)',
      fgFaint: 'rgba(42,14,58,0.32)',
      surface: 'rgba(255,250,254,0.8)',
      surfaceSolid: '#fdf5ff',
      stroke: 'rgba(42,14,58,0.14)',
      gold: '#9a3da8',
    },
  },
  dawn: {
    label: 'Dawn',
    dark: {
      gradient: ['#0a1838', '#1a2c5a', '#3a3060', '#180d2a'],
      nebulae: [
        { color: '#ff8a5a', alpha: 0.30 },
        { color: '#5a7adc', alpha: 0.30 },
        { color: '#c45a8a', alpha: 0.25 },
      ],
      dust: '#ffd4a8',
      fg: '#fff4e8',
      fgMuted: 'rgba(255,244,232,0.62)',
      fgFaint: 'rgba(255,244,232,0.32)',
      surface: 'rgba(28,40,80,0.72)',
      surfaceSolid: '#0f1a3a',
      stroke: 'rgba(255,244,232,0.16)',
      gold: '#ffc878',
    },
    light: {
      gradient: ['#ffeed4', '#ffd5b8', '#ffb6a0', '#e8a8c0'],
      nebulae: [
        { color: '#ffdab0', alpha: 0.65 },
        { color: '#ffb0a0', alpha: 0.55 },
        { color: '#e8b0d0', alpha: 0.4 },
      ],
      dust: '#8a4030',
      fg: '#3a1c20',
      fgMuted: 'rgba(58,28,32,0.62)',
      fgFaint: 'rgba(58,28,32,0.32)',
      surface: 'rgba(255,250,242,0.8)',
      surfaceSolid: '#fff5e8',
      stroke: 'rgba(58,28,32,0.14)',
      gold: '#c46a3a',
    },
  },
  aurora: {
    label: 'Aurora',
    dark: {
      gradient: ['#03120c', '#062420', '#0a3a32', '#021a14'],
      nebulae: [
        { color: '#2dc4a8', alpha: 0.35 },
        { color: '#5ac46a', alpha: 0.28 },
        { color: '#3a78c4', alpha: 0.30 },
      ],
      dust: '#b8ffd4',
      fg: '#eaf6ee',
      fgMuted: 'rgba(234,246,238,0.62)',
      fgFaint: 'rgba(234,246,238,0.32)',
      surface: 'rgba(8,40,32,0.72)',
      surfaceSolid: '#06241c',
      stroke: 'rgba(234,246,238,0.16)',
      gold: '#a8e8b8',
    },
    light: {
      gradient: ['#e8fbf0', '#c8f0d8', '#a8e0d4', '#88c8d8'],
      nebulae: [
        { color: '#a8f0c8', alpha: 0.6 },
        { color: '#a8e8e0', alpha: 0.5 },
        { color: '#c8d8f0', alpha: 0.4 },
      ],
      dust: '#1c4a3a',
      fg: '#0f2820',
      fgMuted: 'rgba(15,40,32,0.62)',
      fgFaint: 'rgba(15,40,32,0.32)',
      surface: 'rgba(248,255,250,0.82)',
      surfaceSolid: '#f0fbf4',
      stroke: 'rgba(15,40,32,0.14)',
      gold: '#3a8a6a',
    },
  },
};

// ─────────────────────────────────────────────────────────────
// Audience persona — affects sample data tone
// ─────────────────────────────────────────────────────────────
const PERSONAS = {
  family: {
    label: 'Family',
    groupName: 'The Okafor Family',
    members: [
      { id: 'm1', name: 'Mom',   color: '#f7c66a', avatar: '🌻' },
      { id: 'm2', name: 'Dad',   color: '#7ca8e8', avatar: '🪻' },
      { id: 'm3', name: 'Aria',  color: '#f08aa8', avatar: '🐝' },
      { id: 'm4', name: 'Theo',  color: '#8adcb8', avatar: '🦊' },
    ],
    activeChart: { name: 'Summer of Kindness', goal: 50, reward: 'Family camping at Pinecrest' },
    completedChart: { name: 'Spring Reading Goal', goal: 30, reward: 'Bookstore afternoon — pick anything' },
    sampleReasons: [
      { honoree: 'm3', giver: 'm1', reason: 'for reading to your brother before bed', count: 2, style: 'gold' },
      { honoree: 'm4', giver: 'm2', reason: 'for taking out the compost without being asked', count: 1, style: 'copper' },
      { honoree: 'm1', giver: 'm2', reason: 'for the morning pancakes — they were perfect', count: 3, style: 'rose' },
      { honoree: 'm3', giver: 'm4', reason: 'for sharing your last cookie', count: 1, style: 'pearl' },
      { honoree: 'm2', giver: 'm1', reason: 'for fixing the back gate on a Saturday', count: 2, style: 'jade' },
      { honoree: 'm4', giver: 'm3', reason: 'for not getting mad when I broke your fort', count: 2, style: 'amethyst' },
      { honoree: 'm1', giver: 'm3', reason: 'for the way you sing while making dinner', count: 1, style: 'aurora' },
      { honoree: 'm3', giver: 'm2', reason: 'for finishing your math without complaining', count: 2, style: 'frost' },
      { honoree: 'm2', giver: 'm4', reason: 'for letting me help with the lawn', count: 3, style: 'comet' },
      { honoree: 'm4', giver: 'm1', reason: 'for being patient when I was running late', count: 1, style: 'ruby' },
      { honoree: 'm1', giver: 'm4', reason: 'for the bedtime story voices', count: 5, style: 'rainbow' },
      { honoree: 'm3', giver: 'm2', reason: 'for helping put away groceries', count: 1, style: 'gold' },
      { honoree: 'm2', giver: 'm3', reason: 'for the daddy-daughter walk', count: 2, style: 'aurora' },
      { honoree: 'm4', giver: 'm2', reason: 'for soccer practice grit', count: 3, style: 'dragon' },
      { honoree: 'm1', giver: 'm2', reason: 'for choosing patience this morning', count: 2, style: 'pearl' },
    ],
  },
  couple: {
    label: 'Couple',
    groupName: 'M & J',
    members: [
      { id: 'm1', name: 'Mira',  color: '#e8a8c0', avatar: '🌙' },
      { id: 'm2', name: 'Jules', color: '#a8c8e8', avatar: '🌊' },
    ],
    activeChart: { name: 'Slow Saturdays', goal: 40, reward: 'A weekend in Mendocino' },
    completedChart: { name: 'A Year Apart, A Year Together', goal: 24, reward: 'Tattoos — matching, tiny, ours' },
    sampleReasons: [
      { honoree: 'm1', giver: 'm2', reason: 'for the way you laugh at my dumb jokes', count: 2, style: 'rose' },
      { honoree: 'm2', giver: 'm1', reason: 'for making coffee before I asked', count: 1, style: 'gold' },
      { honoree: 'm1', giver: 'm2', reason: 'for sitting with me through the call', count: 5, style: 'pearl' },
      { honoree: 'm2', giver: 'm1', reason: 'for picking up the prescription', count: 1, style: 'copper' },
      { honoree: 'm1', giver: 'm2', reason: 'for the song you put on the playlist', count: 2, style: 'aurora' },
      { honoree: 'm2', giver: 'm1', reason: 'for the long hug after work', count: 3, style: 'amethyst' },
      { honoree: 'm1', giver: 'm2', reason: 'for cooking when I was tired', count: 2, style: 'jade' },
      { honoree: 'm2', giver: 'm1', reason: 'for not being on your phone at dinner', count: 1, style: 'frost' },
      { honoree: 'm1', giver: 'm2', reason: 'for noticing my hair', count: 1, style: 'ruby' },
      { honoree: 'm2', giver: 'm1', reason: 'for the hand on my back in the kitchen', count: 3, style: 'rose' },
      { honoree: 'm1', giver: 'm2', reason: 'for the small, perfect Tuesday', count: 5, style: 'rainbow' },
      { honoree: 'm2', giver: 'm1', reason: 'for the way you said good morning', count: 1, style: 'gold' },
    ],
  },
  friends: {
    label: 'Friends',
    groupName: 'The Sunday Lot',
    members: [
      { id: 'm1', name: 'Dani',  color: '#f0a878', avatar: '🍊' },
      { id: 'm2', name: 'Ren',   color: '#a8d8b0', avatar: '🌿' },
      { id: 'm3', name: 'Sasha', color: '#c8a8e8', avatar: '🍇' },
      { id: 'm4', name: 'Pete',  color: '#88c8e0', avatar: '🐳' },
      { id: 'm5', name: 'Imani', color: '#f0d878', avatar: '🌞' },
    ],
    activeChart: { name: 'The Big Trip Fund', goal: 60, reward: 'Lisbon — five days, one apartment' },
    completedChart: { name: 'Sunday Suppers', goal: 20, reward: 'Tasting menu at Otto\'s' },
    sampleReasons: [
      { honoree: 'm2', giver: 'm1', reason: 'for hosting last Sunday — risotto for eight', count: 3, style: 'gold' },
      { honoree: 'm4', giver: 'm3', reason: 'for the airport pickup at 6am', count: 5, style: 'comet' },
      { honoree: 'm1', giver: 'm5', reason: 'for the breakup playlist', count: 2, style: 'amethyst' },
      { honoree: 'm5', giver: 'm2', reason: 'for showing up at the hospital', count: 5, style: 'pearl' },
      { honoree: 'm3', giver: 'm4', reason: 'for the surprise birthday card', count: 2, style: 'rose' },
      { honoree: 'm2', giver: 'm5', reason: 'for the introduction to her cousin', count: 1, style: 'aurora' },
      { honoree: 'm4', giver: 'm1', reason: 'for never being late, ever', count: 1, style: 'frost' },
      { honoree: 'm1', giver: 'm3', reason: 'for the phone call on a hard day', count: 3, style: 'jade' },
      { honoree: 'm5', giver: 'm4', reason: 'for the meme at exactly the right moment', count: 1, style: 'rainbow' },
      { honoree: 'm3', giver: 'm2', reason: 'for editing my cover letter', count: 2, style: 'copper' },
      { honoree: 'm2', giver: 'm3', reason: 'for driving everyone home', count: 2, style: 'ruby' },
      { honoree: 'm1', giver: 'm4', reason: 'for the long voice memo', count: 3, style: 'dragon' },
      { honoree: 'm4', giver: 'm5', reason: 'for the apology that meant it', count: 5, style: 'rose' },
    ],
  },
};

window.SC_TOKENS = { TYPE_PAIRINGS, SKY_PALETTES, PERSONAS };

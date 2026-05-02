# Starcharts — Design Brief

You are designing a collaborative, real-time web app called **Starcharts**: a quest-tracker themed as celestial starcharts, where households, couples, and friend groups recognize each other for meaningful acts by giving each other beautiful stars in a shared night sky, working together toward goals tied to real-world rewards.

This brief is the source of truth for the design. Everything below is decided; the open questions are visual execution and interaction polish.

---

## Concept (one sentence)

A group of people (family, couple, friends) creates **charts**, each a goal-reward pact ("50 stars → movie night"). Members give each other stars in recognition of meaningful acts. Stars accumulate in the chart's shared sky over time. When the goal is reached, the reward unlocks and the chart becomes a constellation memory.

---

## Audience

A single design must serve all three of:

- **Families with children** (kids old enough to read or be read to — ~5+)
- **Couples** (intimate, low-key recognition between partners)
- **Friend groups** (casual, celebratory, warm)

A 7-year-old should find it magical; an adult should find it tasteful. Avoid feeling like a chore-chart-for-kids-only.

---

## Aesthetic direction

**Cosmic-elegant base, warm storybook accents.**

- **Background**: deep navy / midnight gradients with real depth — never flat black. Subtle nebulae, faint dust, distant background stars.
- **Foreground**: gilded, hand-designed stars are the centerpiece. Gold, ruby, amethyst, jade, copper, pearl, aurora, dragonfire — each preset feels intentional and distinctive.
- **Typography**: a refined serif for chart names, reward text, and headings (e.g., *Cormorant*, *Fraunces*, *EB Garamond*). A friendly humanist sans for body and prompts (e.g., *Inter*, *DM Sans*).
- **Mood**: gentle, hopeful, magical. Not cold, not infantile, not gamified-chore-chart. The sky should feel like a place you want to spend time.
- **Both dark mode (night sky, default) and light mode (dawn sky — pale rose-gold, soft pink horizon, warm-tinted stars).** Light mode is a "daytime sky," not a recolored night sky.
- **Animation**: alive but never jittery. Subtle drift, slow twinkle, gentle parallax. New stars *land* into the sky with a satisfying micro-animation; they do not pop in.

---

## Functional model

The data has settled. Use these names and shapes:

- **Group** — a household / couple / friend group. People join via magic-link (email).
- **Chart** — a goal-reward pact created by the group. Has `name`, `goal_count` (target star count), `reward` (text), `created_at`, `completed_at?`. Has its own sky.
- **Gift** — the unit of giving. A gift has:
  - `giver` (one user)
  - `honorees` (one or more users in the group)
  - `reason` (free text — the act being recognized)
  - `count` (how many stars this gift contributes — typically 1, 2, 3, 5, or 10)
  - `style` (either a preset name OR `"custom"`)
  - `custom_image_url` (only present when `style == "custom"`)
  - `created_at`

  A gift renders as a *cluster* of `count` stars in the chart's sky. All stars in a cluster share the same artwork (preset SVG/CSS or generated image) and the same metadata. Cluster variety comes from spatial arrangement, not from per-star variance.
- **Sky behavior within a chart** — *forever-with-recency*: every gift ever added is preserved. Newer stars sparkle bright in the foreground; older stars drift to softer constellations behind, creating natural depth as the chart fills.
- **Goal reach** — when total star count (sum of all gift `count` values) hits `goal_count`, a celebratory moment plays, the chart enters a "completed" state, and it remains on the dashboard as a constellation memory. Past completed charts can always be revisited.

---

## Star style system

**Two modes** for picking a star's appearance.

### 1. Preset mode (the default path)

A curated gallery of ~16–24 magical star families. Each preset is fully art-directed — color palette, glow, sparkle, point structure, animation. Every preset must be visually distinctive enough to be recognizable at a glance, even at small sizes.

Sample preset names (the actual list is for the designer to define and refine):

`gold sparkle` · `ruby twinkle` · `amethyst nebula` · `silver crescent` · `rainbow burst` · `comet trail` · `emerald glint` · `pearl shimmer` · `aurora ribbon` · `supernova bloom` · `copper ember` · `frost crystal` · `cosmic rose` · `dragon fire` · `moon pearl` · `nebula bloom` · …

Within a preset, all stars look identical (no per-star generative seed). The cluster's variety comes from random positions in space, not per-star variance.

### 2. Custom mode (a special, magical alternative)

The user picks "Summon a custom star," types a single short text prompt (e.g., *"a star made of fireflies and starlight"*), and the app calls an image-generation API to create unique star artwork. The generated image is used for the entire cluster of N stars from that gift.

Custom mode is **special** — both because it costs real money per generation and because the act of summoning a star deserves to feel incantatory:

- A slight ceremony before submitting (not three taps).
- A "forming" animation while the API responds — cosmic dust gathering and coalescing.
- The arrival when ready feels earned.
- A gentle re-summon path on failure ("the stars didn't align — try again") with the prompt preserved.

Image-gen provider is pluggable; default assumption is **Azure OpenAI DALL-E 3** (the project owner already has Azure OpenAI credentials wired up). The image API call must run server-side via a small serverless function (Cloudflare Worker or Vercel Function) — never from the browser, to protect the API key.

---

## Key UX moments

These are the scenes the design must nail. For each: get the *feeling* right.

### 1. Sign-in / first-time

- Magic-link sign-in.
- Beautiful empty state on first visit (a single softly-drifting star, a prompt to create or join a group).
- Joining a group: invite-code or invite-link from an existing member.

### 2. Dashboard

- Lists all of the group's charts (active + completed).
- Each chart card is a small *sky*: a glimpse of its constellation, the chart name in serif, the reward, and progress (e.g., "37 of 50").
- Active charts feel alive (subtle twinkle); completed charts feel commemorative (a small wreath, banner, or sigil — not a check mark).
- Prominent "+ New chart" tile.

### 3. Creating a chart

- Three fields, clean and ceremonious: chart **name**, **goal** (number of stars), **reward** (text).
- A small illustrated moment as the empty sky is "created" / "opened."

### 4. Inside a chart (the main experience)

- Full-screen night sky fills the viewport. The sky *is* the page.
- Stars layered by recency: bright in front, softer behind. Cluster relationships are visible — stars from the same gift sit close together in space.
- Subtle progress indicator somewhere — "37 of 50" — but it is not the focus. The sky tells the truth.
- Tap any star → its gift card slides in: who gave it, who it honors (with avatars), the reason, the date. The card feels like reading a note, not a modal.
- Persistent, beautifully-placed "+" to add a gift.
- Real-time: when another member is in the same chart, you sense their presence (subtle ambient indicator). When they add stars, you watch them arrive in real time with a landing animation.

### 5. Giving a gift

A focused, joyful flow:

1. **Honoree(s)** — pick one or more members from the group. Avatar grid, multi-select.
2. **Star style** — gallery of preset families (each previewed live), OR a "Summon custom" entry.
3. **How many stars** — 1 / 2 / 3 / 5 / 10 stepper or chips.
4. **Reason** — single text field. Placeholder encourages specificity (e.g., *"for taking out the compost"*).
5. **Confirm** — preview the cluster, then send. Stars animate into the chart's sky.

### 6. Custom-star summoning sub-flow

- Text prompt field with a hint like *"a star made of …"*.
- A "Summon" button with a slight sense of ritual.
- Forming animation (cosmic dust gathering) while the API resolves.
- On success: preview the result; allow Keep or Re-summon. Then the cluster lands in the sky.
- On failure: a gentle "the stars didn't align — try again" with the prompt preserved.

### 7. Goal reached

- The final star lands and the count hits the goal.
- A celebratory moment plays: coordinated sky burst, the reward text rises in serif, optional gentle musical chime.
- The chart transitions to "completed" — it stays on the dashboard as a constellation memory.

### 8. Browsing constellation memories

- Tap a completed chart → revisit its sky, browse the gifts.
- The constellation memory should feel cherished, not archived-and-forgotten.

---

## Tech context

- **Single-page app**, mobile-first, fully responsive up to desktop. Most users will be on phones.
- **Frontend stack**: **React**, scaffolded from the official [InstantDB React starter](https://www.instantdb.com/docs/start-react). All UI components (including each preset star) are React components.
- **InstantDB** for data, real-time sync, and magic-link auth. No traditional backend.
- **Hosting**: **GitHub Pages** for the static SPA. Use **Cloudflare Workers** only for the parts GitHub Pages cannot serve (currently: the image-generation proxy).
- **One Cloudflare Worker** for the image-generation proxy (server-side so the API key isn't exposed to the browser).
- **Image generation**: **Azure AI Foundry — gpt-image-1.5** (native transparent-PNG support, ~$0.04/image at standard quality). Endpoint, deployment, and key live in the Bitwarden item *"Azure AI Foundry - GPT Image 1.5"*.
- **InstantDB schema**:
  - `users` { id, email, display_name, avatar_seed }
  - `groups` { id, name, created_at }
  - `group_members` (link table: group ↔ user)
  - `charts` { id, group_id, name, goal_count, reward, created_at, completed_at? }
  - `gifts` { id, chart_id, giver_id, reason, count, style, custom_image_url?, created_at }
  - `gift_honorees` (link table: gift ↔ user)

### Project conventions (must follow)

- Implement **both dark + light mode** using `prefers-color-scheme`. Use CSS custom properties for theming.
- Include an **SVG favicon** matching the aesthetic.
- Add a **`/api/version`** endpoint (or `version.json` for static hosting) using [`realm-sigil`](https://github.com/jphein/realm-sigil) — library lives at `~/Projects/realm-sigil/`. Use realm word `stellar`.
- Suggested production hostname: `stars.realm.watch`.

---

## Quality bar

- The sky must feel **alive** — subtle drift, slow twinkle, parallax depth. Never jittery, never stiff.
- New stars **arrive**; they don't pop in. The landing animation is the small joyful moment that makes the app addictive.
- Star clusters from a single gift should look *related* (close in space, identical artwork) without looking *mechanical* (positions feel hand-placed, not gridded).
- Real-time presence is a feature, not a side-effect — when another household member is in the same chart, you can feel them there.
- Empty states are beautiful — a fresh sky should feel hopeful, not bare.
- Tap targets are generous (kids' fingers).
- Microcopy is gentle and warm, never sterile.
- Both light and dark modes are intentional designs, not auto-derived recolors.
- The whole experience feels handcrafted, never template-y.

---

## Out of scope (for v1)

- Push / email notifications when someone gives you a star (leave hooks for later).
- Photo or sticker attachments on stars (text reasons only for v1).
- Reactions from honorees (e.g., a heart back) — later.
- Multiple groups per user (schema supports it; UX is single-group for v1).
- Star editing or deletion after creation (immutable for v1).
- Public / shareable charts — group-private only.

---

## Deliverable

A polished, working prototype of the Starcharts SPA covering:

1. Sign-in and group join.
2. Dashboard with at least 2 example charts (one active, one completed).
3. Chart creation flow.
4. The in-chart sky experience, with at least 30 sample gifts demonstrating recency layering, cluster placement, and tap-to-reveal.
5. The gift-giving flow, both preset and custom modes (custom can be mocked at the image-gen step if no API key is wired in).
6. The goal-reached celebratory moment.
7. Both dark mode and light mode, complete and intentional.
8. At least 6–8 fully-designed preset star families, distinctive at a glance.

Design at fidelity sufficient to evaluate the aesthetic direction — real preset star artwork, real animation, real responsive behavior, both color modes.

```
                              .          ✦
                  ·       .            .       ·
              ✦          .       ·         .
                   .          ✦         .       ✦
              ·         .           ·          .
                  .         ·           ✦         .
                                  S T A R C H A R T S
                  .          ✦         .          ✦
              ·       .          ·            .
                  .       ·          .       ·
                                                    ✦
```

> *A shared night sky for the people you love — a quest tracker that doesn't*
> *feel like one. Give each other stars for meaningful acts. When the sky*
> *fills, the reward unlocks, and the chart becomes a constellation memory.*

---

**Live:** [stars.realm.watch](https://stars.realm.watch) ·
**Operator's runbook:** [`RUNBOOK.md`](./RUNBOOK.md) ·
**Design brief:** [`docs/2026-05-02-starcharts-design-brief.md`](./docs/2026-05-02-starcharts-design-brief.md)

---

## ✦ The idea

A small group — a household, a couple, a friend cluster — opens a **chart**.
A chart is a goal-reward pact:

> *50 stars → movie night.*
> *20 stars → a quiet weekend away.*
> *3 stars → ice cream.*

Members give each other **stars** when they notice each other doing something
worth noticing. Each gift is a small constellation — same artwork, scattered
softly through the chart's sky. New stars *land*; they never pop in. Older
stars drift to softer constellations behind. The sky tells the truth of the
chart at a glance.

When the goal is met, the sky bursts, the reward rises in serif, and the chart
becomes a **memory** — not archived, just hung gently on the wall.

A 7-year-old should find it magical. An adult should find it tasteful. The
whole thing should feel handcrafted, never template-y.

---

## ✦ Two ways to summon a star

**Preset stars** — a curated gallery of art-directed star families: gold
sparkle, ruby twinkle, amethyst nebula, copper ember, dragon fire, moon pearl,
aurora ribbon. Distinctive at a glance, even at thumbnail size. Free to give,
abundant by design.

**Custom stars** — type a single line of poetry like *"a star made of fireflies
and starlight"*, press **Summon**, and the app calls Azure AI Foundry's
`gpt-image-1.5` to mint a one-of-a-kind transparent PNG just for that gift.
Cosmic dust gathers while it forms. The arrival feels earned. (Custom mode
costs real money per generation, so it's framed as a small ceremony, not a
casual tap.)

---

## ✦ What's in this repo

```
starcharts/
├── app/                ← React + Vite SPA (the sky, the gifts, the memories)
│   ├── src/
│   │   ├── screens/    ← SignIn, Dashboard, ChartSky, GiftFlow, SummonFlow,
│   │   │                 GoalReached, ConstellationMemory, …
│   │   ├── components/ ← Sky, Star, GiftCard, PresetGallery, PresencePanel, …
│   │   ├── design/     ← tokens, theme, globals.css (light + dark)
│   │   ├── db/         ← InstantDB client + schema bindings
│   │   └── hooks/      ← useChart, useGiftsForChart, presence, …
│   └── scripts/        ← version.mjs (writes /version.json at build)
│
├── worker/             ← Cloudflare Worker `starcharts-summon`
│   └── src/index.ts    ← POST /api/summon → Azure → R2 → { url }
│
├── assets/stars/       ← preset star artwork (PNG/SVG)
├── design_handoff/     ← fidelity references from the design brief
├── docs/               ← design brief, port plan, preset previews
├── scripts/            ← generate-stars.py (Python tooling for preset assets)
├── .github/workflows/  ← deploy.yml — GH Pages on push to main
└── RUNBOOK.md          ← operations: deploy, smoke, rotate, troubleshoot
```

---

## ✦ Architecture, in one breath

```
                      ┌──────────────────────────┐
                      │   stars.realm.watch      │  GitHub Pages
                      │   (React/Vite SPA)       │  static, HashRouter
                      └────────────┬─────────────┘
                                   │
          real-time sync ◄─────────┼─────────► magic-link auth
                                   │
                          ┌────────▼────────┐
                          │    InstantDB    │   users · groups · charts · gifts
                          └─────────────────┘
                                   │
        custom-star summon ────────┼──────► POST /api/summon
                                   ▼
                  ┌───────────────────────────────┐
                  │ summon.stars.realm.watch      │  Cloudflare Worker
                  │ (starcharts-summon)           │
                  └───────┬──────────────┬────────┘
                          │              │
                          ▼              ▼
              Azure AI Foundry        Cloudflare R2
              gpt-image-1.5           starcharts-customs
              (transparent PNG)       (durable storage)
```

- **Frontend:** React 19, Vite 8, React Router 7 (HashRouter), Framer Motion,
  React Spring, Lottie, InstantDB React client.
- **State + sync + auth:** InstantDB (single-tenant, app id baked in
  `app/src/db/client.ts`).
- **Image gen proxy:** one Cloudflare Worker. Validates the prompt, calls
  Azure, stores the PNG in R2, returns a public URL. Never exposes the API
  key to the browser.
- **Versioning:** `app/scripts/version.mjs` writes `/version.json` at build
  using [`realm-sigil`](https://github.com/jphein/realm-sigil) (realm word:
  `stellar`).

---

## ✦ Quickstart

You'll need Node 20+, npm, and — for the custom-star path — an Azure AI
Foundry deployment of `gpt-image-1.5`.

### 1. Run the SPA locally

```sh
cd app
npm install
npm run dev          # → http://localhost:5173
```

The app talks to a real InstantDB project out of the box, so sign-in works
locally on the first run. Magic-link emails arrive at whatever address you
type.

### 2. Run the summoning Worker locally (optional)

Custom stars work in production by default. To exercise the path locally:

```sh
cd worker
npm install
cp .dev.vars.example .dev.vars   # then fill in real Azure secrets
npm run dev                       # → http://localhost:8787
```

Then point the SPA at it:

```sh
# app/.env.local
VITE_SUMMON_ENDPOINT=http://localhost:8787/api/summon
```

The dev server hot-reloads. Hit **Summon** in `/give` and watch
`worker/src/index.ts` log the round-trip.

---

## ✦ The seven scenes

These are the moments the design must nail. Each lives in its own file —
follow the trail if you want to see how a feeling got built.

| Scene | What it feels like | Where it lives |
|---|---|---|
| **Sign-in** | a single drifting star, a soft welcome | `app/src/screens/SignIn.tsx` |
| **Profile setup** | choose your name in the sky | `app/src/screens/ProfileSetup.tsx` |
| **Group setup** | open a group or step into one with an invite code | `app/src/screens/GroupSetup.tsx` |
| **Dashboard** | each chart is a tiny living sky | `app/src/screens/Dashboard.tsx` |
| **Create chart** | three fields, ceremonious, then a sky opens | `app/src/screens/CreateChart.tsx` |
| **Inside a chart** | the sky *is* the page; presence is felt, not announced | `app/src/screens/ChartSky.tsx` |
| **Give a gift** | honoree → reason → preset (or summon) → count → send | `app/src/screens/GiftFlow.tsx` |
| **Summon a custom star** | type, breathe, dust gathers, a star arrives | `app/src/screens/SummonFlow.tsx` |
| **Goal reached** | coordinated burst, reward rises in serif | `app/src/screens/GoalReached.tsx` |
| **Constellation memory** | the chart, kept | `app/src/screens/ConstellationMemory.tsx` |

---

## ✦ Data shape

Six tables, no traditional backend:

```
users          { id, email, displayName, avatarSeed }
groups         { id, name, createdAt }
groupMembers   ─── link table ─── group ↔ user
charts         { id, groupId, name, goalCount, reward,
                 createdAt, completedAt? }
gifts          { id, chartId, giverId, reason, count, style,
                 customImageUrl?, createdAt }
giftHonorees   ─── link table ─── gift ↔ user
```

A **gift** of `count: N` renders as a *cluster* of `N` stars: same artwork,
hand-feeling positions. Cluster variety comes from spatial arrangement, never
from per-star variance.

A chart's `completedAt` flips when the sum of its gifts' `count` values
crosses `goalCount`. From that moment, every member's client routes to
`/celebrate`, and afterwards to `/memory`. Past charts are never deleted —
they keep their shape forever.

---

## ✦ Deploy

A push to `main` triggers `.github/workflows/deploy.yml`, which builds the
SPA and publishes it to GitHub Pages at `stars.realm.watch`. The Worker is
deployed independently:

```sh
cd worker
npm run deploy        # wrangler deploy → starcharts-summon
npm run tail          # stream live logs
```

Full operational detail — first-time DNS, R2 setup, secret rotation, smoke
procedure, every known failure mode and its signature — lives in
[`RUNBOOK.md`](./RUNBOOK.md).

---

## ✦ Quality bar

The non-negotiables, copied forward from the design brief:

- The sky is **alive** — subtle drift, slow twinkle, parallax depth. Never
  jittery, never stiff.
- New stars **arrive**. They do not pop in. The landing animation is the
  small joyful moment that makes the app addictive.
- Cluster stars look *related* (close in space, identical artwork) without
  looking *mechanical* (positions feel hand-placed, never gridded).
- Real-time presence is a feature, not a side-effect — when another member
  is in the same chart, you can *feel* them there.
- Empty states are beautiful. A fresh sky should feel hopeful, not bare.
- Tap targets are generous (kids' fingers).
- Microcopy is gentle and warm, never sterile.
- Both light and dark are intentional designs, not auto-derived recolors.
- `prefers-reduced-motion` is honored — animations resolve to instant
  arrivals.

---

## ✦ Known limits (v1)

A handful of intentional shortcuts are listed in
[`RUNBOOK.md` → Known limitations](./RUNBOOK.md#known-limitations-v1):
unindexed `createdAt`, no per-IP Worker rate limit, single-tenant InstantDB
app id, HashRouter (so OG-image scrapers see only the index `<head>`),
best-effort presence, immutable gifts, unbranded magic-link mail. Each one
has a documented migration path for when scale or polish demands it.

---

## ✦ License

Private project. Ask JP (`jp@jphein.com`) before mirroring or redistributing.

---

```
                       ✦ travel under a generous sky ✦
```

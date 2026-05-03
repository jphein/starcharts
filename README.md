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

**Preset stars** — a curated gallery of fourteen art-directed star families:
gold sparkle, ruby twinkle, amethyst nebula, silver crescent, aurora ribbon,
pearl shimmer, comet trail, supernova bloom, emerald glint, copper ember,
frost crystal, cosmic rose, rainbow burst, dragon fire. Distinctive at a
glance, even at thumbnail size. Free to give, abundant by design. (See
`app/src/lib/presets.ts` for the canonical order; assets live under
`assets/stars/` and ship as `app/public/stars/<slug>.png`.)

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
  with git metadata (hash, branch, dirty, built). Realm word is `stellar`,
  per the project-wide [`realm-sigil`](https://github.com/jphein/realm-sigil)
  convention; the script bakes the fields itself rather than importing the
  library, so there's no runtime dependency to add.

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

The dev server hot-reloads. Open a chart, hit **Summon** in
`/charts/:id/give`, and watch `worker/src/index.ts` log the round-trip.

---

## ✦ The ten scenes

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

Four entities, five named links — relationships are modeled as InstantDB
links rather than foreign-key columns, so queries traverse them with dotted
paths like `where: { "group.id": groupId }`. See `app/src/db/schema.ts` for
the source of truth.

```
$users         { id, email, displayName, avatarSeed }
groups         { id, name, inviteCode, createdAt }
charts         { id, name, goalCount, reward,
                 createdAt, completedAt? }
gifts          { id, reason, count, style,
                 starImageUrl, x, y, createdAt }

groupMembers   ─── link ─── groups.members  ↔ $users.groups
chartGroup     ─── link ─── charts.group    ↔ groups.charts
giftChart      ─── link ─── gifts.chart     ↔ charts.gifts
giftGiver      ─── link ─── gifts.giver     ↔ $users.given
giftHonorees   ─── link ─── gifts.honorees  ↔ $users.received
```

A **gift** of `count: N` renders as a *cluster* of `N` stars: same artwork,
hand-feeling positions. The `(x, y)` on a gift is the cluster's anchor
point in normalized 0–1 sky coordinates; the per-star offsets are derived
from a stable seed at render time. `starImageUrl` is the resolved sprite
source — a `/stars/<slug>.png` for preset gifts, or an R2 URL minted by
the Worker for custom-style gifts (`style === "custom"`). Cluster variety
comes from spatial arrangement, never from per-star variance.

A chart's `completedAt` flips when the sum of its gifts' `count` values
crosses `goalCount`. From that moment, every member's client routes to
`/charts/:id/celebrate`, and afterwards to `/charts/:id/memory`. Past
charts are never deleted — they keep their shape forever.

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
unindexed `createdAt`, single-tenant InstantDB app id, best-effort
presence, immutable gifts, magic-link mail still via InstantDB's
locked template (only the app name + sender display-name are
brandable from their dashboard). Each one has a documented
migration path for when scale or polish demands it.

Custom-star summons are rate-limited at the Cloudflare Worker —
**10/group/day, 30/IP/hour** — to keep Azure spend bounded. See
[RUNBOOK → Summon rate-limits](./RUNBOOK.md#summon-rate-limits)
for the constants and how to bump them.

---

## ✦ License

Private project. Ask JP (`jp@jphein.com`) before mirroring or redistributing.

---

```
                       ✦ travel under a generous sky ✦
```

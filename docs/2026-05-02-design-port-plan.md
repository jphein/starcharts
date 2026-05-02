# Design-Port Plan — Starcharts

**Date:** 2026-05-02
**Source:** `design_handoff/design_handoff_starcharts/` (12 JSX files + tokens + README)
**Target:** `app/` (Vite + React 19 + TypeScript + InstantDB)

This plan turns the design-pass output into a real, shippable React app. It is concrete enough to start tomorrow without further brainstorming, and small enough to revise as we learn.

---

## 1. Goal

Recreate the 8 scenes specified in `design_handoff/.../README.md` as a real-time multi-user web app, backed by InstantDB, deployed to GitHub Pages (with one Cloudflare Worker for the image-gen proxy). Pixel fidelity to the design tokens; behavioral fidelity to the realtime arrival magic.

The design handoff hints at React Native + Skia. We are **deliberately diverging**: the app is web-first (one codebase, no native wrappers) and DOM/SVG-rendered. This is faster to ship and good enough for v1; we'll only escalate to Canvas if measured perf demands it.

---

## 2. Inventory

### What's in `design_handoff/design_handoff_starcharts/`

| File | What | Port action |
|---|---|---|
| `README.md` | Authoritative spec | Keep as reference; do not port. |
| `tokens.jsx` | Type pairings, sky palettes (4×dark+light), persona sample data | **Port to `app/src/design/tokens.ts`** as typed constants. |
| `sky.jsx` | Gradient backdrop, nebulae, dust, parallax stars | **Port to `app/src/components/Sky.tsx`**. DOM/SVG for v1. |
| `stars.jsx` | 12 placeholder SVG star renderers | **Replace** with `<img src="/stars/{style}.png">` against `assets/stars/`. |
| `preset-preview.jsx` | Preset gallery for gift flow | **Port to `app/src/components/PresetGallery.tsx`**. |
| `screens-a.jsx` | SignIn, Dashboard, CreateChart | **Port to** `app/src/screens/{SignIn,Dashboard,CreateChart}.tsx`. |
| `screens-b.jsx` | ChartSky, GiftCard, GiftFlow | **Port to** `app/src/screens/{ChartSky,GiftFlow}.tsx` + `components/GiftCard.tsx`. |
| `screens-c.jsx` | SummonFlow, GoalReached | **Port to** `app/src/screens/{SummonFlow,GoalReached}.tsx`. |
| `app.jsx` | Root + scene router + chrome (theme toggle, tweaks btn, chip bar) | **Distill into** `app/src/App.tsx` (router) + `app/src/components/TopChrome.tsx`. **Drop the chip-bar reviewer nav.** |
| `ios-frame.jsx` | Reviewer-only iPhone bezel | **Do not port** — reviewer artifact. |
| `design-canvas.jsx` | Reviewer-only side-by-side artboard | **Do not port** — reviewer artifact. |
| `tweaks-panel.jsx` | Reviewer tweak panel (theme, palette, font, animation level, persona) | **Mostly drop**, but extract its tweakable settings into a real user-preferences screen later. For v1: just hard-code the defaults (Cormorant + Midnight + drifty). |
| `Starcharts.html` | Mounting harness for the design canvas | **Do not port**. |

### What's in `app/`

Fresh Vite/React/TS scaffold. Default `App.tsx` displays the Vite welcome screen; will be wholesale replaced.

```
app/
├── index.html                  ← title, fonts <link>, favicon
├── src/
│   ├── main.tsx                ← React mount, InstantDB init
│   ├── App.tsx                 ← scene router
│   ├── index.css               ← reset, font-family vars
│   └── …                       ← (everything below is to be created)
├── public/
│   └── stars/                  ← copy of ../assets/stars/*.png at build time
├── package.json                ← React 19, Vite 8, TS 6, @instantdb/react 1.0.22
└── …
```

---

## 3. Stack & Conventions (decided)

| Concern | Choice | Why |
|---|---|---|
| Routing | `react-router-dom` (or wouter) | Real URLs for shareable chart links. Hash-based for GH Pages. |
| State (shared) | InstantDB | Already locked. Realtime + auth + queries. |
| State (local UI) | `useState` / `useReducer` | No store library. App is thin; the data layer is InstantDB. |
| Styling | **CSS Modules** + design-token CSS vars | No CSS-in-JS runtime cost. Pixel fidelity matters; CSS Modules give scoped class names without losing inspector clarity. |
| Animation | **Framer Motion** | Declarative, plays well with React 19, handles `prefers-reduced-motion` via `useReducedMotion`. |
| Sky rendering | **DOM/SVG** for v1 | Fastest to ship; the design handoff's Skia recommendation is the v2 escalation if profiler says so. |
| Image format | Transparent PNG (already have 14 presets) | As decided. |
| Auth | InstantDB magic-link | Built-in, zero-backend. |
| Custom-star image-gen | Cloudflare Worker proxy → Azure AI Foundry `gpt-image-1.5` | Keeps API key server-side. Worker comes later, after preset path works. |
| Hosting | GitHub Pages for static SPA + Cloudflare Worker for `/api/summon` | As decided. |

### File-naming convention

- Components: PascalCase, one component per file: `Sky.tsx`, `GiftCard.tsx`.
- Screens: same, in `screens/`.
- Hooks: camelCase prefixed `use`: `useChart.ts`, `useChartGifts.ts`.
- Types: co-located with the thing they describe; shared types in `src/types.ts`.
- Tokens: `src/design/tokens.ts` (single source).
- DB: `src/db/{client,schema,queries}.ts`.

---

## 4. Target file layout

```
app/src/
├── main.tsx                       # mount + InstantDB init
├── App.tsx                        # router
├── routes.ts                      # route table
├── design/
│   ├── tokens.ts                  # type pairings, sky palettes, type scale
│   ├── theme.tsx                  # ThemeProvider — applies CSS vars
│   └── globals.css                # font imports, reset, --sc-* CSS vars
├── components/
│   ├── Sky.tsx                    # backdrop + nebulae + dust + parallax stars
│   ├── Star.tsx                   # one star sprite (img + glow + drift)
│   ├── PresetGallery.tsx          # 12-tile preset picker
│   ├── GiftCard.tsx               # bottom-sheet card
│   ├── TopChrome.tsx              # theme toggle + tweaks btn (chip bar dropped)
│   ├── ProgressPill.tsx           # "X of Y" pill
│   ├── MemberDots.tsx             # presence dots
│   └── …
├── screens/
│   ├── SignIn.tsx
│   ├── Dashboard.tsx
│   ├── CreateChart.tsx
│   ├── ChartSky.tsx               # the hero
│   ├── GiftFlow.tsx               # 4-step sheet
│   ├── SummonFlow.tsx             # custom-star summoning
│   ├── GoalReached.tsx            # celebration scene
│   └── ConstellationMemory.tsx    # = ChartSky with read-only flag
├── db/
│   ├── client.ts                  # InstantDB init + appId
│   ├── schema.ts                  # entity + link declarations
│   └── queries.ts                 # named query helpers
├── hooks/
│   ├── useGroup.ts
│   ├── useChart.ts
│   ├── useGifts.ts
│   ├── usePresence.ts
│   └── useReducedMotion.ts        # re-export for convenience
├── lib/
│   ├── starPositioning.ts         # algorithm to assign (x,y) to a new gift
│   └── inviteCode.ts              # generate / parse group invite codes
└── types.ts                       # shared types (Chart, Gift, Member)
```

---

## 5. InstantDB schema (first cut)

```ts
// app/src/db/schema.ts
import { i } from "@instantdb/react";

export const schema = i.schema({
  entities: {
    $users: i.entity({
      email:        i.string().indexed(),
      displayName:  i.string(),
      avatarSeed:   i.string(),         // for color-tinted initial avatars
    }),
    groups: i.entity({
      name:         i.string(),
      inviteCode:   i.string().unique().indexed(),
      createdAt:    i.date(),
    }),
    charts: i.entity({
      name:         i.string(),
      goalCount:    i.number(),
      reward:       i.string(),
      createdAt:    i.date(),
      completedAt:  i.date().optional(),
    }),
    gifts: i.entity({
      reason:        i.string(),
      count:         i.number(),         // 1, 2, 3, or 5
      style:         i.string(),         // preset slug OR "custom"
      starImageUrl:  i.string(),         // /stars/{slug}.png OR generated URL
      x:             i.number(),         // 0..1 normalized
      y:             i.number(),         // 0..1 normalized
      createdAt:     i.date(),
    }),
  },
  links: {
    groupMembers:  { forward: { on: "groups", has: "many", label: "members" },
                     reverse: { on: "$users", has: "many", label: "groups"  } },
    chartGroup:    { forward: { on: "charts", has: "one",  label: "group"   },
                     reverse: { on: "groups", has: "many", label: "charts"  } },
    giftChart:     { forward: { on: "gifts",  has: "one",  label: "chart"   },
                     reverse: { on: "charts", has: "many", label: "gifts"   } },
    giftGiver:     { forward: { on: "gifts",  has: "one",  label: "giver"   },
                     reverse: { on: "$users", has: "many", label: "given"   } },
    giftHonorees:  { forward: { on: "gifts",  has: "many", label: "honorees"},
                     reverse: { on: "$users", has: "many", label: "received"} },
  },
});

export type Schema = typeof schema;
```

Star position is stored normalized `(0..1, 0..1)` so the same gift renders correctly on phones and desktops; the renderer scales to viewport.

---

## 6. Component mapping (one-line per file)

| Source | → Target | Notes |
|---|---|---|
| `tokens.jsx` `TYPE_PAIRINGS`, `SKY_PALETTES`, `PERSONAS` | `design/tokens.ts` | Type each one. Drop persona sample data; replace with InstantDB query. |
| `sky.jsx` `<Sky>` | `components/Sky.tsx` | Same component shape. CSS vars from theme; `<motion.div>` for nebula drift; SVG `<circle>` for dust. |
| `stars.jsx` 12 SVG star fns | **delete** | Replaced by `<img src="/stars/{slug}.png">` rendered through `Star.tsx`. |
| `stars.jsx` parallax/twinkle math | `components/Star.tsx` | Keep the math; render against PNG sprite. |
| `preset-preview.jsx` | `components/PresetGallery.tsx` | 4×3 grid of preset thumbs. Tap → emits `style` slug. |
| `screens-a.jsx` `<SignIn>` | `screens/SignIn.tsx` | Wire to `db.auth.sendMagicCode` + `signInWithMagicCode`. |
| `screens-a.jsx` `<Dashboard>` | `screens/Dashboard.tsx` | InstantDB query: charts for current group. |
| `screens-a.jsx` `<CreateChart>` | `screens/CreateChart.tsx` | `db.transact` to create a chart. |
| `screens-b.jsx` `<ChartSky>` | `screens/ChartSky.tsx` | Subscribes to gifts + presence. |
| `screens-b.jsx` `<GiftCard>` | `components/GiftCard.tsx` | Bottom-sheet card, animates in via Framer Motion `AnimatePresence`. |
| `screens-b.jsx` `<GiftFlow>` | `screens/GiftFlow.tsx` | 4-step state machine. |
| `screens-c.jsx` `<SummonFlow>` | `screens/SummonFlow.tsx` | Calls `/api/summon` (Cloudflare Worker). |
| `screens-c.jsx` `<GoalReached>` | `screens/GoalReached.tsx` | Plays once when goal hit; persists via `chart.completedAt`. |
| `app.jsx` scene router | `App.tsx` + `routes.ts` | React Router. |
| `app.jsx` chrome (theme toggle + tweaks btn) | `components/TopChrome.tsx` | **Drop the chip bar** (reviewer nav). Keep the theme toggle as a real user pref. |
| `ios-frame.jsx` | — | Drop. |
| `design-canvas.jsx` | — | Drop. |
| `tweaks-panel.jsx` | — | Drop the panel; lock defaults (Cormorant + Midnight + drifty animation). User-prefs screen is post-v1. |

---

## 7. Build order (5 milestones)

Each milestone produces something we can demo. Each ends with a commit and a check-in.

### M0 — Foundation (estimate: ~half a day)
- Replace Vite welcome screen with a placeholder app shell.
- Port `tokens.ts` (typed) and add CSS vars to `:root` via `<ThemeProvider>`.
- Add `index.css` with font imports + reset.
- Set up React Router with empty routes for all 8 screens.
- Wire InstantDB client (without schema yet — placeholder).
- Add favicon to `public/` (matching the Cormorant + gold aesthetic).

**Demo:** App boots, shows the right fonts/colors on a blank styled page.

### M1 — Sky (estimate: ~full day)
- Port `<Sky>` (gradient + 3 nebula blobs + dust particles + parallax star-field with random PNGs from `assets/stars/` baked in as decorative dust).
- Port `<Star>` rendering — `<img>` sprite + Framer Motion drift + soft additive glow via `mix-blend-mode: screen` and `filter: drop-shadow`.
- Test on mobile + desktop.
- Honor `prefers-reduced-motion`.

**Demo:** A standalone sky at `/sky-test` with 30 random stars drifting and twinkling. Looks like the design handoff's hero scene.

### M2 — Auth + group + dashboard (estimate: ~full day)
- Define InstantDB schema (entities + links, no migrations needed — InstantDB applies automatically).
- Port `<SignIn>`: magic-link flow (request code → enter code → group name OR invite code).
- On first sign-in: create group OR join via invite code.
- Port `<Dashboard>`: live query of charts in the current group.
- Port `<CreateChart>`: `db.transact` to create.

**Demo:** Two browsers signed into the same group both see charts in real time.

### M3 — Chart Sky + gift flow, preset path only (estimate: ~1.5 days)
- Port `<ChartSky>` with live `gifts` query and `<Sky>` rendering each gift as a positioned `<Star>`.
- Port `<GiftCard>` bottom-sheet on star tap.
- Port `<GiftFlow>` (steps 1–3, no custom): pick honoree(s) → reason → preset gallery → confirm.
- On confirm: assign `(x, y)` via `lib/starPositioning.ts`, `db.transact` to insert. Both browsers see arrival animation.
- Port `<GoalReached>` triggered when sum-of-counts hits goal.
- Port `<ConstellationMemory>` as `<ChartSky readOnly>`.

**Demo:** Two browsers can earn toward a chart together; reaching 50 stars triggers the celebration; afterwards the chart reads as a memory.

### M4 — Custom stars (estimate: ~1 day)
- Build Cloudflare Worker at `worker/summon.ts` that proxies to Azure AI Foundry `gpt-image-1.5` (key from worker env, never browser).
- Worker stores the resulting PNG (R2 or KV blob) and returns a stable URL.
- Port `<SummonFlow>`: prompt → loading animation → result preview → confirm/re-summon.
- Insert as a normal gift with `style: "custom"` and `starImageUrl: <worker URL>`.

**Demo:** A custom prompt produces a unique star that lands in the same sky and persists.

### M5 — Polish + ship (estimate: ~1 day)
- Group invite link flow, invite code generator/parser.
- Presence dots in `<ChartSky>` via `db.room.getPresence`.
- `realm-sigil` `/api/version` endpoint (per JP's CLAUDE.md convention) — for the SPA, ship a `version.json` at build time using realm word `stellar`.
- GH Pages deploy via Actions workflow.
- Custom domain: `stars.realm.watch`.
- Status entry in `~/Projects/status.realm.watch/checks.json` per CLAUDE.md.

**Demo:** Live at `stars.realm.watch`. Real families can use it.

---

## 8. Open questions / decisions

These deserve a quick conversation before M1; none should block M0.

1. **Star position generation.** Random within the viewport with collision avoidance? Or simpler poisson-disc / grid-jitter? `lib/starPositioning.ts` will need an algorithm. Recommendation: poisson-disc against existing stars in the same chart, normalized 0..1.
2. **Group membership / invite flow.** Does the first user create the group with a chosen name? Are invite codes 4-letter (Jackbox-style) or full UUID URLs? Recommendation: 4-letter codes, generated on group creation, regeneratable.
3. **Chart goal-count and reward edits.** Editable after creation, or immutable? Recommendation: immutable for v1 (avoids "moved goalposts" social dynamics).
4. **Multiple groups per user.** Schema supports it (link table is many-to-many). UI for v1 picks one as "current group" via local-storage; group-switcher is post-v1.
5. **Custom-star caching.** R2 vs KV for the generated PNG? R2 is cheaper at scale; KV is simpler. Recommendation: R2 with a UUID filename, lifecycle rule to keep forever (these are user memories).
6. **Image gen budget controls.** Per-group rate limit on custom stars (e.g., 10/day)? Recommendation: yes — implement in the Worker. Cost was $1 for 14 presets; an unbounded custom path could spiral.
7. **Reduced-motion fallback level.** "Still" mode = no drift, no twinkle, no parallax, instant arrival. Confirm.

---

## 9. First milestone (M0) — concrete next step

When approved, the work for M0 is:

1. Delete `app/src/App.tsx` boilerplate, replace with a router shell.
2. Create `app/src/design/tokens.ts` (port from `design_handoff/.../tokens.jsx`, typed).
3. Create `app/src/design/globals.css` with `@import` for Cormorant + Inter, CSS reset, and `--sc-*` CSS variables seeded from the active palette.
4. Create `app/src/design/theme.tsx` — `<ThemeProvider>` that reads palette+typePairing from local-storage and writes CSS vars to `:root`.
5. Add `react-router-dom` and define routes for: `/`, `/sign-in`, `/dashboard`, `/charts/new`, `/charts/:id`, `/charts/:id/give`, `/charts/:id/summon`, `/charts/:id/celebrate`, `/charts/:id/memory`.
6. Each screen is a `<Placeholder name="ScreenName">` component for now.
7. Initialize InstantDB client at `app/src/db/client.ts` — app ID will need to be created on the InstantDB dashboard.
8. Replace Vite favicon with a small gold-star SVG.
9. Boot, verify everything renders without errors at all routes.
10. Commit: `feat(app): M0 foundation — tokens, theme, router, db client, placeholder routes`.

**Decision needed before M0 starts:** create the InstantDB app via the dashboard (or `instant-cli`), then drop the app ID into `app/src/db/client.ts`. Without an app ID, the client init will fail at runtime.

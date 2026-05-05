# Starcharts SPA

The React + Vite frontend for [Starcharts](../README.md). Talks to
InstantDB for sync/auth and to the [`starcharts-summon`](../worker/)
Cloudflare Worker for custom-star generation.

## Stack

- **React 19** + **Vite 8** + **TypeScript**
- **HashRouter** (GitHub Pages compatible) — every route is `/#/foo`
- **InstantDB** (`@instantdb/react`) for realtime sync + magic-link auth
- **Framer Motion** + **React Spring** for animations
- **Lottie** for the goal-reached burst

## Run locally

```sh
cd app
npm install
npm run dev          # → http://localhost:5173
```

The dev server hot-reloads. Magic-link emails go through real InstantDB
out of the box, so any address you type will receive a real code.

`predev` runs `scripts/version.mjs` so `/version.json` is present in
dev too — needed by the `<Sigil />` badge in the corner.

## Build

```sh
npm run build        # tsc -b && vite build
npm run preview      # serve dist/ at :4173
```

`prebuild` writes `public/version.json` with the current git hash,
branch, dirty flag, build timestamp, and the realm-sigil "magic name"
(`<Adjective> <Noun> · <hash>`). The hash is forced to 7 chars so the
algorithm stays stable regardless of `core.abbrev`.

## Custom-star Worker

For most local SPA work you don't need to run the Worker — the SPA
defaults to the deployed `summon.stars.realm.watch`. To exercise the
custom-star path against a local Worker, see
[`../worker/README.md`](../worker/README.md), then point the SPA at
it via `app/.env.local`:

```
VITE_SUMMON_ENDPOINT=http://localhost:8787/api/summon
```

## InstantDB permissions

The source-of-truth mirror lives in `src/instant.perms.ts`. To deploy
local edits to production:

```sh
cd app
npx instant-cli push perms -a <APP_ID>
```

(See [`../RUNBOOK.md`](../RUNBOOK.md#instantdb-permissions) for the app
id and the pull-from-prod command.)

## Layout

```
app/
├── src/
│   ├── screens/      ← SignIn, ProfileSetup, GroupSetup, Dashboard,
│   │                   CreateChart, ChartSky, GiftFlow, SummonFlow,
│   │                   GoalReached, ConstellationMemory
│   ├── components/   ← Sky, Star, GiftCard, PresencePanel,
│   │                   ChartCard, LoadingSky, Sigil, …
│   ├── design/       ← tokens, theme, globals.css (light + dark)
│   ├── db/           ← InstantDB client + schema
│   ├── hooks/        ← useChart, useGiftsForChart, useCurrentUser, …
│   ├── lib/          ← presets, summon, join, starPositioning,
│   │                   inviteCode, …
│   └── instant.perms.ts  ← perm rules mirror (push to prod via CLI)
├── public/           ← favicon.svg, og.png, CNAME, version.json
└── scripts/          ← version.mjs (predev + prebuild hook)
```

## Quality bar

Copied forward from the design brief and enforced project-wide:

- Sky is alive — subtle drift, slow twinkle, parallax depth
- New stars **arrive** (never pop in)
- Light + dark are intentional designs, not auto-derived recolors
- `prefers-reduced-motion` is honored — animations resolve to instant
  arrivals
- Tap targets are generous (kids' fingers)
- Microcopy is gentle and warm

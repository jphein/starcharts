# Starcharts — Runbook

Operational guide for **starcharts**, a collaborative starchart for families
and friends. Pairs the React/Vite frontend with a Cloudflare Worker
(`starcharts-summon`) that mints custom stars via Azure AI Foundry.

## Deploy status (last updated 2026-05-03)

Live now:

- ✅ GH Actions workflow runs on push and deploys the SPA.
- ✅ DNS `stars.realm.watch` → `jphein.github.io` (CNAME, in Cloudflare zone `realm.watch`).
- ✅ GH Pages custom domain set to `stars.realm.watch`. HTTPS enforced.
- ✅ R2 bucket `starcharts-customs` created.
- ✅ Worker `starcharts-summon` deployed with all four Azure secrets set.
- ✅ Worker custom domain `summon.stars.realm.watch` configured automatically by wrangler.
- ✅ InstantDB magic-link email branded — custom subject (`Step into Starcharts — {code}`), From name (`Starcharts`), and HTML body (dark sky + gold ceremony) all set on the InstantDB dashboard.
- ✅ Static OG/Twitter card (`app/public/og.png`) ships with the SPA; meta tags in `app/index.html`.
- ✅ Visible `<Sigil />` version badge mounted at app shell, reading `/version.json`.
- ⏳ **Cloudflare KV namespace for Worker rate-limits** — provisioning is the only remaining manual step. The Worker boots without it (rate-limits skipped, `wrangler tail` warns); enabling enforcement is a one-time `wrangler kv namespace create starcharts-rate-limits` + paste-id-in-wrangler.toml + redeploy. See [Summon rate-limits](#summon-rate-limits).

**LAN testing note:** JP's gatekeeper firewall intercepts `*.realm.watch` queries and routes to 10.0.6.11 (the realm-portal box). To test the live deployment from inside the LAN, hit the workers.dev URL directly or override locally via `/etc/hosts`. From outside the LAN, public DNS resolves correctly via Cloudflare.

---

> Maintainer: JP (`jp@jphein.com`). Repo:
> [github.com/jphein/starcharts](https://github.com/jphein/starcharts).
>
> Production hostname: **`stars.realm.watch`** (web app),
> **`summon.stars.realm.watch`** (Worker). The default GH Pages URL
> `https://jphein.github.io/starcharts/` is a fallback.

---

## What's deployed where

| Component | Where it lives | URL | How it's deployed |
|---|---|---|---|
| **Web app** | GitHub Pages (`jphein/starcharts`) | `https://stars.realm.watch` (custom) — falls back to `https://jphein.github.io/starcharts/` | GH Actions on push to `main` (`.github/workflows/deploy.yml`) |
| **Summon Worker** | Cloudflare Workers (`starcharts-summon`) | `https://summon.stars.realm.watch/api/summon` (or the `*.workers.dev` route until DNS) | `cd worker && npx wrangler deploy` |
| **Custom star storage** | Cloudflare R2 bucket `starcharts-customs` | served via Worker at `/r2/<key>` (or `PUBLIC_BUCKET_URL/<key>` once R2 public access is wired) | Worker writes on each successful summon |
| **Database / auth** | InstantDB (`e526d9cf-e783-4a99-b3b3-a69730ecdd7e`) | client-side via `@instantdb/react` | Schema editing via [InstantDB dashboard](https://instantdb.com/dash) |
| **Magic-link mail** | InstantDB managed (custom subject + From + HTML body set) | n/a | InstantDB sends. Template lives on the dashboard, not in this repo — see [Magic-link email branding](#magic-link-email-branding) |
| **Rate-limit counters** | Cloudflare KV namespace (binding `RATE_LIMIT_KV`) | n/a | Worker writes via TTL keys; ⏳ provisioning still pending — see [Summon rate-limits](#summon-rate-limits) |
| **Version endpoint** | shipped inside `dist/` | `https://stars.realm.watch/version.json` | written by `app/scripts/version.mjs` (`predev` + `prebuild` hooks) |
| **Sigil badge** | mounted at app shell | bottom-left of every screen | reads `/version.json` at runtime; click → GitHub commit |

The web app is a HashRouter SPA, so deep links work without server-side
rewrites. `app/public/404.html` is included as belt-and-braces for any
future move to BrowserRouter.

---

## First-time setup (one-time, JP only)

These steps must happen once before the first deploy works end-to-end.
Order doesn't matter, but **all** are required for the custom-star path.

### 1. DNS for the web app

Add a `CNAME` record:

| Name | Target | TTL |
|---|---|---|
| `stars.realm.watch` | `jphein.github.io` | 300 |

If JP's homelab DNS handles `realm.watch` directly, add the record there.
If Cloudflare proxies the apex, add it as a proxied CNAME (proxy off
for the initial cert provisioning, then turn it back on if desired),
then in the GitHub repo go to **Settings → Pages → Custom domain** and
enter `stars.realm.watch`. GitHub will provision a Pages cert (a few
minutes to ~1 hour). `app/public/CNAME` is already committed
(contents: `stars.realm.watch`), so the workflow will keep telling
Pages this domain on every deploy.

> If DNS isn't ready yet, the site is still reachable at
> `https://jphein.github.io/starcharts/`. Set `base: "/starcharts/"` in
> `app/vite.config.ts` for that mode and rebuild — see "Day 2 ops".

### 2. Cloudflare R2 bucket for custom stars

```sh
cd /home/jp/Projects/starcharts/worker
npx wrangler login                        # one-time, opens browser
npx wrangler r2 bucket create starcharts-customs
```

Optional: enable public access on the bucket and bind a custom domain
(e.g. `customs.stars.realm.watch`). When configured, set the
`PUBLIC_BUCKET_URL` Worker secret (next step) so the Worker returns
direct R2 URLs instead of routing image bytes through itself at
`/r2/<key>`.

### 3. Worker secrets (Azure AI Foundry creds)

Pull the gpt-image-1.5 password from Bitwarden first
(`bw get password "<vault item name>"`), then push secrets to the
Worker:

```sh
cd /home/jp/Projects/starcharts/worker

npx wrangler secret put AZURE_OPENAI_ENDPOINT
# value: https://claud-assistant-resource.cognitiveservices.azure.com

npx wrangler secret put AZURE_OPENAI_API_KEY
# value: <from Bitwarden>

npx wrangler secret put AZURE_OPENAI_DEPLOYMENT
# value: gpt-image-1.5

npx wrangler secret put AZURE_OPENAI_API_VERSION
# value: 2025-04-01-preview

# Optional, only if you wired R2 public access in step 2:
npx wrangler secret put PUBLIC_BUCKET_URL
# value: https://customs.stars.realm.watch
```

`worker/.dev.vars.example` mirrors this list for local dev. Copy to
`worker/.dev.vars` (gitignored) and fill in real values for
`npm run dev` against the Worker.

### 4. Deploy the Worker

```sh
cd /home/jp/Projects/starcharts/worker
npm install
npm run deploy            # runs `wrangler deploy`
npm run tail              # optional: stream live logs
```

The first deploy will print the Worker's `*.workers.dev` URL. Hit
`https://<that>/api/summon` with a tiny `{"prompt":"smoke"}` POST to
confirm it responds (will probably 502 on a missing R2 binding or
secret, which is the diagnostic you want).

### 5. DNS for the Worker

The Worker route is already configured in `worker/wrangler.toml`:

```
[[routes]]
pattern = "summon.stars.realm.watch"
custom_domain = true
```

When you `wrangler deploy`, Wrangler asks Cloudflare to bind the
custom domain. If `realm.watch` is on Cloudflare DNS, it provisions
the CNAME automatically. If `realm.watch` is hosted elsewhere, add a
manual CNAME for `summon.stars.realm.watch` pointing at the Worker's
`*.workers.dev` hostname.

Test:

```sh
curl -sS -X POST https://summon.stars.realm.watch/api/summon \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"a star made of fireflies"}'
# → { "url": "https://.../uuid.png" }
```

### 6. (Optional) GitHub Pages custom domain settings

The deploy workflow runs `actions/configure-pages` which auto-fills
the Pages settings on first run. If GitHub asks for the custom domain,
enter `stars.realm.watch` in **Repo → Settings → Pages**. After it
verifies, tick **Enforce HTTPS**. The committed `app/public/CNAME`
will keep this sticky across deploys.

---

## Manual smoke procedure

Goal: prove every key user path works on the deployed app, end-to-end,
including custom stars. Two browsers, two emails, ~12 minutes.

### Prerequisites

- Dev server running locally (`cd /home/jp/Projects/starcharts/app && npm run dev`),
  *or* the live site at `https://starcharts.jphe.in/`. Pick one.
- For the custom-star step: the Worker is deployed and Azure secrets
  are set, OR set `VITE_SUMMON_ENDPOINT` to a working Worker URL
  before `npm run dev`.
- Two real email accounts to receive InstantDB magic codes. Call them
  **A** and **B**.
- Two browser surfaces, e.g. Chrome window for A and Incognito (or
  Firefox) for B, side by side.

> InstantDB persists to localStorage. For a fully clean run, clear
> site data for the host first.

### Step 0 — Open both surfaces

Both surfaces visit the chosen host. Each should land on `#/sign-in`
("Welcome to your sky.").

### Step 1 — A signs in, creates a group, creates a chart

1. **Sign in.** A enters their email, clicks **Continue**, retrieves
   the 6-digit magic code from email, submits.
2. **Profile setup.** Manually navigate to `#/profile-setup`, type a
   display name (e.g. `Aria`), submit. Routes back to `#/group-setup`.
   *Note:* the auto-redirect from sign-in to `/profile-setup` for
   empty-`displayName` users is not yet wired into the auth gates;
   manual navigation is required for v1. Tracked in the post-launch
   list below.
3. **Create group.** Under "Create a group", type a group name
   (e.g. `Smoke Test Crew`) and click **Create group**. A lands on
   `#/dashboard`.
4. **Note the invite code** (6 chars, e.g. `ABC234`).
5. **Create a chart.** Click the create-chart CTA. Fill in:
   - Name: `Test goal`
   - Goal: `3`
   - Reward: `ice cream`
6. Submit → A lands on the empty `#/charts/<chartId>`. Confirm:
   - [ ] Top bar shows `Test goal` and `0 / 3` progress.
   - [ ] Sky is empty.
   - [ ] Floating `+` CTA is visible bottom-right.
   - [ ] Presence dot for A is visible in the top bar.

Copy the chart URL from A.

### Step 2 — B signs in, joins via invite code

1. B opens the host, lands on `#/sign-in`.
2. B enters their email, gets the magic code, signs in.
3. B manually navigates to `#/profile-setup`, picks a display name
   (e.g. `Brennan`), submits.
4. **Group setup.** Under "Join a group", paste A's invite code.
   Click **Join**. B lands on `#/dashboard` and sees the `Test goal`
   tile.
   - [ ] Two member dots on the chart card.
5. B clicks the chart. Lands on `#/charts/<chartId>`.
   - [ ] **A's screen now shows two presence dots** in the top bar
     (Brennan joined Aria).
   - [ ] B's screen also shows two dots.

### Step 3 — A gives 1 preset star to B

1. **A:** clicks `+` → `#/charts/<chartId>/give`.
2. Step 1 (honoree): tap B. Continue.
3. Step 2 (reason): type `test`. Continue.
4. Step 3 (preset + count): pick a preset (e.g. gold-sparkle),
   count = **1**. Continue.
5. Step 4 (confirm): **Send**.
6. A is routed to `#/charts/<chartId>` with the new star blooming in.
   - [ ] Progress is `1 / 3`.
   - [ ] One star sprite at a deterministic position.

Real-time check on B (still on chart sky):
- [ ] Within ~2s, the same star appears for B.
- [ ] B's progress also reads `1 / 3`.

Tap-to-card check (B):
1. B taps the star.
2. [ ] `<GiftCard>` slides up from the bottom.
3. [ ] Shows the preset sprite, "for B", reason `test`, "from A · 1",
   and a date.
4. B closes the card.

### Step 4 — B summons a custom star and gives it to A (crosses goal)

This is the new path. B will mint a one-of-a-kind star via the Worker
and send it as a 2-star gift, crossing the `3` goal.

1. **B:** taps the floating `+`. Lands on `#/charts/<chartId>/give`.
2. Step 1 (honoree): pick A. Continue.
3. Step 2 (reason): `back at you`. Continue.
4. Step 3 (preset): instead of picking a preset, click
   **✦ or summon a custom star**. Routes to
   `#/charts/<chartId>/summon`.
5. Type a prompt, e.g.
   `a star made of fireflies and starlight`. Click **Summon**.
   - [ ] A placeholder star pulses while it generates and the copy
     reads "the stars are aligning…" (typically 5–25s depending on
     Azure load).
6. On success, the generated star previews. Click **Keep this star**
   to bring it back into the gift draft (it stashes the URL in
   `sessionStorage`). On error, you'll see "the stars didn't align —
   try again" with the prompt preserved; click **summon another** as
   needed.
7. Back in `/give` Step 3, the preset gallery is hidden and the custom
   star preview is shown. Set count = **2**. Continue.
8. Step 4 (confirm): **Send**.

This brings total stars to `1 + 2 = 3 = goal`.

**B (giver who crossed the goal):**
- [ ] Auto-routes to `#/charts/<chartId>/celebrate`.
- [ ] Goal-reached scene plays once. The custom star is included in
  the staggered bloom alongside A's preset star.
- [ ] Gold serif `ice cream` reward text rises.
- [ ] **Mark complete** CTA visible.

**A (the other client):**
- A was on `#/charts/<chartId>`. The cluster of 2 arrives over the
  wire and `chart.completedAt` flips from `null` to a timestamp.
- [ ] Within ~2s of B sending, A also lands on `/celebrate`.
- [ ] A also sees the goal-reached scene play (once).

If A doesn't auto-route within ~3s, this is a regression in
`<ChartSky>`'s `chart.completedAt` subscription.

### Step 5 — Mark complete → memory

1. **A or B:** tap **Mark complete**.
2. Routes to `#/charts/<chartId>/memory`.
   - [ ] Header reads `Memory · <date>` in serif.
   - [ ] All 3 stars (1 preset + 2 custom) are visible in their
     cluster positions.
   - [ ] No floating `+` CTA (read-only).
   - [ ] Tapping a star still opens `<GiftCard>`.
   - [ ] Presence dots are still visible in the top bar.

### Step 6 — Revisit guards

With `chart.completedAt` set:

1. From either browser, manually navigate to `#/charts/<chartId>`.
   - [ ] Auto-redirects to `#/charts/<chartId>/memory`.
2. Manually navigate to `#/charts/<chartId>/give`.
   - [ ] Auto-redirects to memory.
3. Manually navigate to `#/charts/<chartId>/celebrate`.
   - [ ] Auto-redirects to memory.

### Step 7 — Robustness probes

1. Visit `#/charts/sample-id` (or any non-UUID chart id).
   - [ ] No crash. Auto-redirects to `#/dashboard` (or `#/sign-in` if
     unauthenticated).
2. Visit `#/charts/00000000-0000-0000-0000-000000000000` (valid UUID,
   but no such chart).
   - [ ] No crash. Auto-redirects to `#/dashboard`.
3. Hit `/version.json` from the URL bar.
   - [ ] Returns JSON with `name`, `version`, `hash`, `branch`,
     `dirty`, `built`, `realm`, `repo`. `realm` is `"stellar"`.

### Step 8 — Reduced motion (optional)

In Chrome DevTools → **Rendering** → **Emulate CSS media feature
prefers-reduced-motion: reduce**.

1. Reload the chart sky.
   - [ ] Stars render at full opacity instantly. No bloom, no twinkle.
2. Send another gift.
   - [ ] The arrival is instant — no delay/bloom.

### What constitutes PASS

- All check-boxes in Steps 1–7 tick.
- No console errors during the happy path (open DevTools in both
  browsers; ignore InstantDB heartbeat/reconnect chatter).
- Real-time arrival is consistently <2s on a healthy LAN.
- Goal-reached fires once per client and never replays after Mark
  complete.

### What to capture if something fails

- Screenshot of both browsers at the failure moment.
- Console output from both DevTools windows.
- Network tab snapshot showing the failing InstantDB websocket frame
  or Worker call, if applicable.
- The chart `id` (from URL) and the user emails.
- Worker logs: `cd worker && npm run tail`.
- Component pointers (responsible files):
  - Chart sky → `app/src/screens/ChartSky.tsx`
  - Goal-reached → `app/src/screens/GoalReached.tsx`
  - Memory → `app/src/screens/ConstellationMemory.tsx`
  - Gift flow → `app/src/screens/GiftFlow.tsx`
  - Summon flow → `app/src/screens/SummonFlow.tsx`
  - Worker → `worker/src/index.ts`
  - UUID guards → `app/src/hooks/useChart.ts`,
    `app/src/hooks/useGiftsForChart.ts`
  - Profile setup → `app/src/screens/ProfileSetup.tsx`
  - Presence → `app/src/components/PresencePanel.tsx`

---

## Day 2 ops

### Bump the version

`/version.json` is built from `app/package.json` + `git`. To ship a
visibly-new version:

```sh
cd /home/jp/Projects/starcharts/app
# manual edit (preferred for v1):
${EDITOR:-nano} package.json     # bump "version"
cd ..
git add app/package.json
git commit -m "chore(app): bump to vX.Y.Z"
git push origin main
```

GH Actions will rebuild and redeploy automatically. Verify by curling
`/version.json` after a couple of minutes.

The `prebuild` script picks up the current `git rev-parse --short HEAD`
and dirty flag, so even an unbumped commit produces a fresh `hash` and
`built` timestamp on each deploy.

### Switch hosting URL (custom domain ↔ default)

If the custom domain is broken or you need to fall back to GH's URL:

1. Edit `app/vite.config.ts`: set `base: "/starcharts/"` instead of
   `"/"`.
2. Optional: delete or rename `app/public/CNAME` so GH Pages stops
   asserting the custom domain.
3. Commit + push. The site will be at
   `https://jphein.github.io/starcharts/`.

To switch back, restore `base: "/"` and the CNAME file.

### Invalidate someone's session

Any user can sign out via the app. To force-revoke from the admin
side, delete the user from the InstantDB dashboard:

1. Log in to [instantdb.com/dash](https://instantdb.com/dash).
2. Open the `starcharts` app
   (`e526d9cf-e783-4a99-b3b3-a69730ecdd7e`).
3. **Explorer** → `$users` → find the row by email → delete.

The next page load on that browser will fail to refresh the session
and route them to `#/sign-in`. (Local InstantDB cache may persist for
a moment; clearing localStorage forces it.)

### Rotate Worker secrets

Re-run `wrangler secret put` for the changed value:

```sh
cd /home/jp/Projects/starcharts/worker
npx wrangler secret put AZURE_OPENAI_API_KEY    # paste new key
```

Wrangler immediately provisions the new secret to running Workers
(no redeploy needed). To rotate the Azure deployment name:

```sh
npx wrangler secret put AZURE_OPENAI_DEPLOYMENT
```

To list current secrets (names only — values are write-only):

```sh
npx wrangler secret list
```

Update Bitwarden with the new key value at the same time so future
runs of the runbook find the current credential.

### Re-deploy the Worker

```sh
cd /home/jp/Projects/starcharts/worker
npm run deploy     # publishes dist of src/index.ts
npm run tail       # tail live logs
```

If the route hostname changes, edit `worker/wrangler.toml`'s
`[[routes]]` block and re-deploy.

### Troubleshoot a failed summon

1. `cd worker && npm run tail` — watch live logs while a user repros.
2. Common failures and their signatures:
   - `502 image generation failed` → Azure side. Check rate limits and
     deployment quota in the Foundry dashboard.
   - `502 failed to store image` → R2 side. Check the bucket exists
     and the binding name matches `wrangler.toml` (`BUCKET`).
   - `400 prompt must be ...` → client-side validation; the user
     hit a length bound. UI should be guarding this.
   - 5xx with no body → CORS preflight failure. Confirm the request
     `Origin` is in the `ALLOWED_ORIGINS` list in
     `worker/src/index.ts`.

### Local-dev the Worker

```sh
cd /home/jp/Projects/starcharts/worker
cp .dev.vars.example .dev.vars        # fill in real secrets
npm run dev                            # serves on http://localhost:8787
```

Then in `app/.env.local` (create if needed):

```
VITE_SUMMON_ENDPOINT=http://localhost:8787/api/summon
```

`npm run dev` in `app/` will pick that up automatically.

---

## Known limitations (v1)

These are intentional shortcuts to ship; revisit at scale.

- **InstantDB `createdAt` is not indexed.** Sorts on
  `gifts.createdAt` happen client-side in
  `app/src/hooks/useGiftsForChart.ts`. Fine for the kind of charts
  v1 makes (typically dozens of gifts each), but at hundreds-to-low-
  thousands per chart this gets noticeable. Migration: add
  `.indexed()` in the InstantDB schema, switch the hook to a sorted
  query.
- **Magic-link emails go through InstantDB unbranded.** Subject is
  `{code} is your verification code for {appName}`, sender is
  `verify@auth-pm.instantdb.com` — both locked. Closest we get to
  "branded" without leaving InstantDB is the dashboard knobs:
  - App name (drives subject + body): set to `Starcharts`
    (capitalized) in [InstantDB dashboard](https://instantdb.com/dash) →
    *Apps → starcharts → Settings → Display name*.
  - Sender display name (the friendly name on `From:`): same dashboard,
    *Auth → Magic link → From name* if available on the current plan.
  Anything beyond that needs a custom magic-link flow + own SMTP.
- **R2 served via the Worker by default.** Each image fetch goes
  through your Worker invocation budget if `PUBLIC_BUCKET_URL` isn't
  set. Configure R2 public access for free public delivery.
- **HashRouter.** Deep links use `#/foo` rather than `/foo`. Social
  scrapers see only the index `<head>`, which is fine because we
  populate static `og:*` / `twitter:*` tags there
  (see `app/index.html` + `app/public/og.png`). If we ever want
  per-chart previews, switch to BrowserRouter and lean on the
  existing `app/public/404.html` SPA fallback.
- **Presence is best-effort.** InstantDB presence shows who's
  *connected* to the chart room; it does not survive page reloads or
  app backgrounding cleanly on mobile. Reasonable for a "who's
  looking right now" affordance, not for "who has read this chart".
- **No undo on gift send.** Gifts are immutable once written. If
  someone fat-fingers a send, the only path is to delete the row from
  the InstantDB dashboard. Add an "undo within N seconds" timer if
  this becomes a frequent ask.
- **Single-tenant InstantDB app.** The InstantDB app id is hardcoded
  in `app/src/db/client.ts`. Fine for one production deploy. For
  staging/preview environments, factor it to an env var.
---

## Summon rate-limits

The Worker rejects calls with HTTP 429 once either bucket is full.
Both counters live in the `RATE_LIMIT_KV` namespace declared in
`worker/wrangler.toml`; entries carry TTLs so the namespace is
self-cleaning.

| Bucket | Cap | Window | KV key shape |
|---|---|---|---|
| Per group | `GROUP_DAILY_CAP = 10` | calendar day (UTC) | `g:<groupId>:<YYYYMMDD>` |
| Per IP | `IP_HOURLY_CAP = 30` | calendar hour (UTC) | `ip:<ip>:<YYYYMMDDHH>` |

To bump a cap: change the constant in `worker/src/index.ts`,
`npm run deploy`. The cap takes effect immediately for new
counter buckets; existing ones retain whatever count they had.

To **provision** the KV namespace on a fresh deploy:

```sh
cd worker
wrangler kv namespace create starcharts-rate-limits
# paste the returned `id` into wrangler.toml's [[kv_namespaces]] block
npm run deploy
```

The frontend treats a 429 as a soft outcome: `SummonFlow` switches
to a "your sky is full for today" panel with a *Pick a preset
instead* affordance. No console error, no toast.

Content moderation is intentionally **not** done in the Worker —
Azure's content filter is the source of truth for what's allowed
through the model. The Worker only validates length and charset.

---

## InstantDB permissions

Source of truth: [`app/src/instant.perms.ts`](./app/src/instant.perms.ts).
The actual rules are stored on InstantDB's servers; the file is a
mirror that the CLI deploys.

**Push local changes to production:**

```sh
cd app
npx instant-cli push perms -a e526d9cf-e783-4a99-b3b3-a69730ecdd7e -y
```

**Pull current production rules into the repo:**

```sh
cd app
npx instant-cli pull perms -a e526d9cf-e783-4a99-b3b3-a69730ecdd7e -y
```

Watch for diffs after pulling — anyone with admin access can edit
rules via the InstantDB dashboard, so the file can drift.

The current rule set only constrains `$users` (group-mates can see
each other's display name + avatar; everyone else is hidden;
updates locked to self). `groups`, `charts`, and `gifts` are
permissive by default — fine for the v1 single-tenant model, but
lock them down before any second tenant. Each entity needs `view`,
`create`, `update`, `delete`, and link/unlink rules; see
[InstantDB's permissions docs](https://www.instantdb.com/docs/permissions).

---

## Magic-link email branding

The InstantDB magic-code email is fully customized, but the **template
lives on the InstantDB dashboard, not in this repo**. This is by
design — InstantDB sends the email, and there's no code path in
the repo that constructs it.

Current settings (set via *Auth → Custom Magic Code Email* on the
[InstantDB dashboard](https://instantdb.com/dash)):

| Field | Value |
|---|---|
| **Subject** | `Step into Starcharts — {code}` |
| **From** | `Starcharts` (sender display name) |
| **Body** | Custom HTML — dark sky background, gold ✦ eyebrow, Cormorant headline, big tabular code card, footer with `stars.realm.watch`. Uses inline styles only (email clients don't load web fonts; Cormorant falls back to Georgia). |

Variables supported: `{code}`, `{app_title}`, `{user_email}`. The
sender domain stays `verify@auth-pm.instantdb.com` (locked by
InstantDB's free plan; a custom From-address requires a verified
sender domain on a paid tier).

To **edit** the template: log in to the InstantDB dashboard, open
the `starcharts` app, *Auth → Custom Magic Code Email*. Submit
saves it; the next code email uses the new template immediately.

If the template gets deleted or reset by accident, the source-of-
truth mirror lives at [`docs/email/magic-code.html`](./docs/email/magic-code.html)
in this repo — re-paste the body block (everything below the
`<!doctype html>` line) into the dashboard to recover.

---

## Pointers

| Topic | File / location |
|---|---|
| Frontend root | `app/src/App.tsx` |
| Routes | `app/src/App.tsx` |
| InstantDB client | `app/src/db/client.ts` |
| Worker source | `worker/src/index.ts` |
| Worker config | `worker/wrangler.toml` |
| Worker dev secrets template | `worker/.dev.vars.example` |
| GH Pages workflow | `.github/workflows/deploy.yml` |
| Version writer | `app/scripts/version.mjs` |
| Vite build config | `app/vite.config.ts` |
| Custom domain | `app/public/CNAME` |
| SPA fallback | `app/public/404.html` |
| Manual smoke (M3 reference) | `~/.claude/projects/-home-jp/scratch/starcharts-m3/manual-smoke.md` |

✦ Travel under a generous sky.

# starcharts-summon

Cloudflare Worker that backs the Starcharts SPA with two server-side
capabilities: minting custom stars via Azure AI Foundry, and resolving
invite codes against InstantDB without exposing the `groups` table to
the public app.

## Endpoints

| Method | Path | Body | Returns | What it does |
|---|---|---|---|---|
| `POST` | `/api/summon` | `{ "prompt": "...", "groupId": "..." }` | `{ "url": "..." }` | Proxies the prompt to Azure AI Foundry's `gpt-image-1.5`, stores the resulting transparent PNG in R2, returns its URL. Rate-limited per-group/day and per-IP/hour via KV. |
| `POST` | `/api/join-group` | `{ "inviteCode": "ABC234" }` | `{ "groupId": "...", "name": "..." }` | Looks up an invite code in InstantDB using the admin token. Lets the SPA join a group without `groups.view` being open to all authed users. Per-IP rate-limited so brute-force enumeration of the 32⁶ ≈ 1B keyspace is impractical. |
| `GET` | `/r2/<key>` | — | image bytes | Fallback delivery path when `PUBLIC_BUCKET_URL` isn't set. |

Content moderation is intentionally **not** done here — Azure's content
filter is the single source of truth for what's allowed through the
model.

## Secrets

Set via `wrangler secret put` (live immediately, no redeploy needed):

| Name | Required for | Notes |
|---|---|---|
| `AZURE_OPENAI_ENDPOINT` | `/api/summon` | e.g. `https://claud-assistant-resource.cognitiveservices.azure.com` |
| `AZURE_OPENAI_API_KEY` | `/api/summon` | Pull from Bitwarden, never paste in code |
| `AZURE_OPENAI_DEPLOYMENT` | `/api/summon` | e.g. `gpt-image-1.5` |
| `AZURE_OPENAI_API_VERSION` | `/api/summon` | e.g. `2025-04-01-preview` |
| `INSTANT_ADMIN_TOKEN` | `/api/join-group` | InstantDB admin token. Without it, `/api/join-group` returns 503. |
| `PUBLIC_BUCKET_URL` | optional | Public R2 URL prefix. If unset, image responses go through `/r2/<key>` instead. |

## Bindings

| Binding | Type | Notes |
|---|---|---|
| `BUCKET` | R2 | Bucket `starcharts-customs` (created via `wrangler r2 bucket create`). |
| `RATE_LIMIT_KV` | KV | Namespace for rate-limit counters. Worker boots without it (rate-limits skipped, `wrangler tail` warns); enabling enforcement is `wrangler kv namespace create starcharts-rate-limits` + paste id in `wrangler.toml` + redeploy. |

## One-time setup

```sh
cd worker
npm install
npx wrangler login
npx wrangler r2 bucket create starcharts-customs
npx wrangler kv namespace create starcharts-rate-limits   # paste id into wrangler.toml
npx wrangler secret put AZURE_OPENAI_ENDPOINT
npx wrangler secret put AZURE_OPENAI_API_KEY
npx wrangler secret put AZURE_OPENAI_DEPLOYMENT
npx wrangler secret put AZURE_OPENAI_API_VERSION
npx wrangler secret put INSTANT_ADMIN_TOKEN
# optional, only if R2 public access is wired:
# npx wrangler secret put PUBLIC_BUCKET_URL
```

## Local dev

```sh
cp .dev.vars.example .dev.vars   # then fill in real secrets
npm run dev                       # starts wrangler dev on :8787
```

In `app/.env.local` (optional, only when running against local Worker):

```
VITE_SUMMON_ENDPOINT=http://localhost:8787/api/summon
```

The SPA defaults to the deployed Worker, so most local SPA work doesn't
need a local Worker at all.

## Deploy

```sh
npm run deploy   # publishes to Cloudflare via wrangler
npm run tail     # streams live logs
```

The custom domain `summon.stars.realm.watch` is bound automatically by
`wrangler deploy` via the `[[routes]]` block in `wrangler.toml` (assuming
the `realm.watch` zone is in the same Cloudflare account, which it is).

## Production hostnames

- **Custom domain:** `https://summon.stars.realm.watch` — preferred.
- **workers.dev fallback:** `https://starcharts-summon.jp5.workers.dev`
  — kept alive (`workers_dev = true` in `wrangler.toml`) for LAN smoke
  tests and as a fallback when the custom domain's TLS is misbehaving.

> ⚠️ **Cert state caveat (issue #18):** the custom domain has had a
> stuck Universal SSL provisioning at times. If `curl
> https://summon.stars.realm.watch` returns `alert handshake failure
> (552)`, the SPA's `app/src/lib/summon.ts` and `app/src/lib/join.ts`
> can be temporarily flipped to the workers.dev URL while Cloudflare
> reprovisions the cert.

## Rate limits

| Bucket | Cap | Window | KV key shape |
|---|---|---|---|
| Summon per group | 10 | calendar day (UTC) | `g:<groupId>:<YYYYMMDD>` |
| Summon per IP | 30 | calendar hour (UTC) | `ip:<ip>:<YYYYMMDDHH>` |
| Join-group per IP | 10 | calendar hour (UTC) | `ipjoin:<ip>:<YYYYMMDDHH>` |

KV is non-atomic, so concurrent bursts can exceed the cap by some
multiple before the next bucket. Caps are sized with that slack in
mind. A genuinely atomic counter would need a Durable Object —
tracked as a follow-up.

See `worker/src/index.ts` for the canonical bucket definitions and the
brute-force math behind the join-group cap.

## Pointers

- Source: `worker/src/index.ts`
- Config: `worker/wrangler.toml`
- Local dev secrets template: `worker/.dev.vars.example`
- Operational guide (deploy, smoke, troubleshoot): [`../RUNBOOK.md`](../RUNBOOK.md)

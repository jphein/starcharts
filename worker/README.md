# starcharts-summon

Cloudflare Worker that proxies the Starcharts app to Azure AI Foundry's
`gpt-image-1.5` deployment and stores generated stars in R2.

## Endpoints

- `POST /api/summon` — body `{ "prompt": "..." }` → `{ "url": "..." }`
- `GET /r2/<key>` — fallback delivery path when no public R2 domain is wired up

## One-time setup

```sh
cd worker
npm install
npx wrangler login
npx wrangler r2 bucket create starcharts-customs
npx wrangler secret put AZURE_OPENAI_ENDPOINT
npx wrangler secret put AZURE_OPENAI_API_KEY
npx wrangler secret put AZURE_OPENAI_DEPLOYMENT
npx wrangler secret put AZURE_OPENAI_API_VERSION
# optional, only if you wire R2 public access:
# npx wrangler secret put PUBLIC_BUCKET_URL
```

## Local dev

```sh
cp .dev.vars.example .dev.vars   # then fill in real secrets
npm run dev                       # starts wrangler dev on :8787
```

## Deploy

```sh
npm run deploy   # publishes to Cloudflare
npm run tail     # streams live logs
```

After deploy, point DNS for `summon.starcharts.jphe.in` at the Worker (or
uncomment the `[[routes]]` block in `wrangler.toml`).

The frontend reads `VITE_SUMMON_ENDPOINT`, defaulting to
`https://summon.starcharts.jphe.in/api/summon`.

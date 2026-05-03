// Starcharts Worker.
//
// POST /api/summon       { prompt, groupId }   → { url }
// POST /api/join-group   { inviteCode }        → { groupId, name }
// GET  /r2/<key>                               → image bytes
//
// Endpoints:
//   - /api/summon: proxies a user prompt to Azure AI Foundry
//     gpt-image-1.5, stores the resulting PNG in R2, returns a URL.
//     Rate-limited per-group/day and per-IP/hour via KV.
//   - /api/join-group: looks up an invite code in InstantDB using
//     the admin token, returns just the group id + name. Lets the
//     SPA join a group without needing `groups.view` to be
//     globally readable. Rate-limited per-IP/hour with a separate
//     bucket so brute-force inviteCode guessing is impractical.
//   - /r2: fallback delivery for R2 PNGs when PUBLIC_BUCKET_URL
//     isn't set.
//
// Content moderation is intentionally not done here — Azure's
// content filter is the single source of truth for what's allowed
// through the model.
//
// Secrets / bindings:
//   - BUCKET                   R2 bucket binding (wrangler.toml)
//   - RATE_LIMIT_KV            KV namespace for counters
//   - AZURE_OPENAI_ENDPOINT
//   - AZURE_OPENAI_API_KEY
//   - AZURE_OPENAI_DEPLOYMENT  e.g. gpt-image-1.5
//   - AZURE_OPENAI_API_VERSION e.g. 2025-04-01-preview
//   - INSTANT_ADMIN_TOKEN      InstantDB admin token (for /api/join-group)
//   - PUBLIC_BUCKET_URL        optional public R2 prefix

export interface Env {
  BUCKET: R2Bucket;
  // Optional — Worker boots without it and skips rate-limiting until
  // the namespace is provisioned (see wrangler.toml comment).
  RATE_LIMIT_KV?: KVNamespace;
  AZURE_OPENAI_ENDPOINT: string;
  AZURE_OPENAI_API_KEY: string;
  AZURE_OPENAI_DEPLOYMENT: string;
  AZURE_OPENAI_API_VERSION: string;
  // Optional — /api/join-group returns 503 without it.
  INSTANT_ADMIN_TOKEN?: string;
  PUBLIC_BUCKET_URL?: string;
}

// Public InstantDB app id — same value baked into the SPA at
// app/src/db/client.ts. Kept as a constant since it's not a secret;
// rotating the app id is a multi-step migration anyway.
const INSTANT_APP_ID = "e526d9cf-e783-4a99-b3b3-a69730ecdd7e";

// InstantDB invite codes are 6 chars from A–Z and 2–9 (skipping
// confusable I/O/0/1). Mirror of `app/src/lib/inviteCode.ts`.
const INVITE_CODE_RE = /^[A-Z2-9]{6}$/;

// Per-IP cap on join-group lookups, sized for "small enough that
// even concurrent-burst racing doesn't dent the keyspace."
//
// Cloudflare KV is non-atomic and eventually-consistent. Two
// concrete races bite this counter:
//   1. Stale reads — concurrent requests can all observe the same
//      pre-bump `current` and pass the cap check together.
//   2. Lost updates — concurrent `put(current+1)` writes from the
//      same `current` collapse to one increment, so the counter
//      undercounts the actual request volume.
// Net effect: a bursting attacker can punch through the cap by
// some multiple before the next bucket. We accept this for v1
// because (a) the cap is small enough that even a 100× burst is
// only 1,000 lookups/hour, and (b) Cloudflare's edge DDoS clamps
// concurrent connections per IP at roughly that range anyway.
//
// Brute-force math: 32^6 ≈ 1.07B invite-code keyspace. At a
// realistic ceiling of 100/hour per IP (10× the configured cap),
// full enumeration takes ~1,200 years per IP. Adequate.
//
// A genuinely atomic counter would need a Durable Object —
// tracked as a follow-up.
const IP_JOIN_HOURLY_CAP = 10;

const ALLOWED_ORIGINS = new Set([
  "https://stars.realm.watch",
  "https://jphein.github.io",
  "http://localhost:5173",
  "http://localhost:8787",
]);

const PROMPT_MIN = 1;
const PROMPT_MAX = 200;

// Rate-limit caps. Adjust here, redeploy. KV counter TTLs are sized
// to the bucket window plus a small buffer so they self-clean.
const GROUP_DAILY_CAP = 10;
const IP_HOURLY_CAP = 30;
const SECONDS_IN_DAY = 86_400;
const SECONDS_IN_HOUR = 3_600;

const SYSTEM_PREFIX =
  "A single magical star object on a fully transparent background.";
const SYSTEM_SUFFIX =
  "Painterly fantasy illustration, jewel-like, ornate, with a subtle aura and small sparkle accents. No big halo. Centered on a transparent canvas.";

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");

    if (request.method === "OPTIONS") {
      return preflight(origin);
    }

    if (request.method === "POST" && url.pathname === "/api/summon") {
      return withCors(await handleSummon(request, env), origin);
    }

    if (request.method === "POST" && url.pathname === "/api/join-group") {
      return withCors(await handleJoinGroup(request, env), origin);
    }

    if (request.method === "GET" && url.pathname.startsWith("/r2/")) {
      // Fallback delivery path for setups without a public R2 domain.
      return withCors(await handleR2(url.pathname.slice("/r2/".length), env), origin);
    }

    return withCors(json({ error: "not found" }, 404), origin);
  },
} satisfies ExportedHandler<Env>;

async function handleSummon(request: Request, env: Env): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid JSON body" }, 400);
  }

  const obj = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const rawPrompt = obj.prompt;
  const rawGroupId = obj.groupId;

  if (typeof rawPrompt !== "string") {
    return json({ error: "prompt must be a string" }, 400);
  }
  const prompt = rawPrompt.trim();
  if (prompt.length < PROMPT_MIN) {
    return json({ error: "prompt must not be empty" }, 400);
  }
  if (prompt.length > PROMPT_MAX) {
    return json({ error: `prompt must be ${PROMPT_MAX} chars or fewer` }, 400);
  }
  if (typeof rawGroupId !== "string" || !/^[a-zA-Z0-9-]{6,64}$/.test(rawGroupId)) {
    return json({ error: "groupId is required" }, 400);
  }
  const groupId = rawGroupId;

  // Rate-limits run before we touch Azure or R2 — refuse fast and cheap.
  //
  // Trust model: `groupId` arrives from the (unauthenticated) browser, so
  // the per-group cap is *advisory* — it helps honest users budget their
  // summons across the day. The per-IP cap (30/hour) is the real abuse
  // defense, since it keys off CF-Connecting-IP which the client can't
  // forge. If a serious abuser shows up, tightening the IP cap or putting
  // an auth-token check in front of this is the next move.
  const ip = resolveClientIp(request);
  const limit = await checkAndBumpRateLimits(env, groupId, ip);
  if (limit.blocked) {
    const headers = new Headers({ "Content-Type": "application/json; charset=utf-8" });
    headers.set("Retry-After", String(limit.retryAfterSeconds));
    return new Response(
      JSON.stringify({
        error: limit.message,
        scope: limit.scope,
        retryAfterSeconds: limit.retryAfterSeconds,
      }),
      { status: 429, headers },
    );
  }

  const wrapped = `${SYSTEM_PREFIX} ${prompt}. ${SYSTEM_SUFFIX}`;

  const azureUrl =
    `${trimTrailingSlash(env.AZURE_OPENAI_ENDPOINT)}/openai/deployments/` +
    `${encodeURIComponent(env.AZURE_OPENAI_DEPLOYMENT)}/images/generations` +
    `?api-version=${encodeURIComponent(env.AZURE_OPENAI_API_VERSION)}`;

  let upstream: Response;
  try {
    upstream = await fetch(azureUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": env.AZURE_OPENAI_API_KEY,
      },
      body: JSON.stringify({
        prompt: wrapped,
        n: 1,
        size: "1024x1024",
        quality: "medium",
        background: "transparent",
        output_format: "png",
      }),
    });
  } catch (err) {
    return json(
      { error: "the stars are out of reach right now", detail: String(err) },
      502,
    );
  }

  if (!upstream.ok) {
    const detail = await safeText(upstream);
    return json(
      { error: "image generation failed", status: upstream.status, detail },
      502,
    );
  }

  let payload: unknown;
  try {
    payload = await upstream.json();
  } catch {
    return json({ error: "image generation returned non-JSON" }, 502);
  }

  const b64 = extractB64(payload);
  if (!b64) {
    return json({ error: "image generation returned no image" }, 502);
  }

  const bytes = base64ToBytes(b64);
  const key = `${crypto.randomUUID()}.png`;

  try {
    await env.BUCKET.put(key, bytes, {
      httpMetadata: {
        contentType: "image/png",
        cacheControl: "public, max-age=31536000, immutable",
      },
    });
  } catch (err) {
    return json({ error: "failed to store image", detail: String(err) }, 502);
  }

  const publicBase = env.PUBLIC_BUCKET_URL
    ? trimTrailingSlash(env.PUBLIC_BUCKET_URL)
    : null;
  const imageUrl = publicBase
    ? `${publicBase}/${key}`
    : new URL(`/r2/${key}`, request.url).toString();

  return json({ url: imageUrl }, 200);
}

interface RateLimitDecision {
  blocked: boolean;
  scope?: "group" | "ip";
  retryAfterSeconds: number;
  message: string;
}

interface BucketSpec {
  scope: "group" | "ip";
  key: string;
  cap: number;
  ttlSeconds: number;
  retryAfterSeconds: number;
  blockedMessage: string;
}

// Resolve the client IP for the per-IP bucket. Cloudflare always sets
// `CF-Connecting-IP` for traffic that actually reached the edge, but
// `wrangler dev` and some test/proxy setups don't, so we fall through
// to the conventional proxy headers and finally return null. Callers
// that get null skip the IP bucket entirely instead of mass-keying
// unidentifiable requests under a single "unknown" string.
//
// Each candidate gets a shape check before we return it — we'd rather
// drop a malformed header into the no-IP path than write garbage into
// a KV key (which sets a per-prefix bucket and inflates cardinality).

// IPv4 dotted quad, IPv6 hex+colons (with optional :: + bracketed form,
// and an optional zone-id like %eth0). Not a strict validator — we
// don't need it to be — just enough to reject obvious garbage like
// hostnames, control chars, and HTML payloads. Length-capped at 64
// to keep KV keys bounded.
const IP_SHAPE = /^[\[\]a-fA-F0-9:.%]{1,64}$/;

function isIpish(value: string): boolean {
  return IP_SHAPE.test(value);
}

function resolveClientIp(request: Request): string | null {
  const cfip = request.headers.get("CF-Connecting-IP");
  if (cfip && isIpish(cfip)) return cfip;

  const xff = request.headers.get("X-Forwarded-For");
  if (xff) {
    // X-Forwarded-For is a comma-separated chain; the first entry is
    // the closest-to-origin client. Trim and shape-check it before
    // accepting.
    const first = xff.split(",")[0]?.trim();
    if (first && isIpish(first)) return first;
  }

  const xreal = request.headers.get("X-Real-IP");
  if (xreal && isIpish(xreal)) return xreal;

  return null;
}

function rateLimitBuckets(
  groupId: string,
  ip: string | null,
  now: Date,
): BucketSpec[] {
  const day = `${now.getUTCFullYear()}${pad2(now.getUTCMonth() + 1)}${pad2(now.getUTCDate())}`;
  const hour = `${day}${pad2(now.getUTCHours())}`;
  const buckets: BucketSpec[] = [
    {
      scope: "group",
      key: `g:${groupId}:${day}`,
      cap: GROUP_DAILY_CAP,
      ttlSeconds: SECONDS_IN_DAY + SECONDS_IN_HOUR,
      retryAfterSeconds: secondsUntilNextUtcDay(now),
      blockedMessage: `the group has reached today's custom-star limit (${GROUP_DAILY_CAP}).`,
    },
  ];
  // Only include the IP bucket when we actually know the client's IP.
  // Otherwise unidentifiable requests would all share a single bucket
  // and cap each other out — see PR #4 review.
  if (ip) {
    buckets.push({
      scope: "ip",
      key: `ip:${ip}:${hour}`,
      cap: IP_HOURLY_CAP,
      ttlSeconds: SECONDS_IN_HOUR + 300,
      retryAfterSeconds: secondsUntilNextUtcHour(now),
      blockedMessage: `this device has summoned ${IP_HOURLY_CAP} stars in the last hour.`,
    });
  }
  return buckets;
}

// Combined check + bump: read each bucket, refuse on cap, otherwise
// increment and store. Bumping *before* the Azure call (instead of
// after success) tightens the cap on Azure spend in a burst — a
// failed generation still uses a quota slot, but the only thing
// that grows is the counter, not the bill.
//
// Defensive: if the KV binding isn't provisioned (placeholder id in
// wrangler.toml, or a fresh deploy where `wrangler kv namespace
// create` hasn't run yet), skip rate-limiting entirely with a loud
// console warning. The Worker stays useful and `wrangler tail`
// shows the missing binding.
//
// Atomicity: KV doesn't have atomic counters. A concurrent burst of
// N requests near the cap can all see the same pre-bump count and
// pass through — we accept a small overshoot rather than spending a
// Durable Object on this. Caps are sized with that slack in mind.
async function checkAndBumpRateLimits(
  env: Env,
  groupId: string,
  ip: string | null,
): Promise<RateLimitDecision> {
  const kv = env.RATE_LIMIT_KV;
  if (!kv || typeof kv.get !== "function") {
    console.warn(
      "RATE_LIMIT_KV binding missing — rate-limiting disabled. " +
        "Run `wrangler kv namespace create starcharts-rate-limits` " +
        "and update wrangler.toml.",
    );
    return { blocked: false, retryAfterSeconds: 0, message: "" };
  }

  const buckets = rateLimitBuckets(groupId, ip, new Date());

  // Single pass: read each bucket once (in parallel), refuse on cap,
  // otherwise bump every bucket using the count we already have. This
  // halves the KV reads vs. a separate check-then-bump and skips a
  // duplicate read+write when blocked.
  //
  // Atomicity: KV doesn't have atomic counters, so a concurrent burst
  // of N requests near the cap can all see the same pre-bump count
  // and pass through — we accept a small overshoot rather than spending
  // a Durable Object on this. Caps are sized with that slack in mind.
  const counts = await Promise.all(
    buckets.map((b) => readCount(kv, b.key)),
  );

  for (let i = 0; i < buckets.length; i++) {
    if (counts[i] >= buckets[i].cap) {
      return {
        blocked: true,
        scope: buckets[i].scope,
        retryAfterSeconds: buckets[i].retryAfterSeconds,
        message: buckets[i].blockedMessage,
      };
    }
  }

  await Promise.all(
    buckets.map((b, i) =>
      kv.put(b.key, String(counts[i] + 1), { expirationTtl: b.ttlSeconds }),
    ),
  );

  return { blocked: false, retryAfterSeconds: 0, message: "" };
}

async function readCount(kv: KVNamespace, key: string): Promise<number> {
  const raw = await kv.get(key);
  if (!raw) return 0;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

function secondsUntilNextUtcDay(now: Date): number {
  const next = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
  );
  return Math.max(60, Math.ceil((next.getTime() - now.getTime()) / 1000));
}

function secondsUntilNextUtcHour(now: Date): number {
  const next = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      now.getUTCHours() + 1,
    ),
  );
  return Math.max(30, Math.ceil((next.getTime() - now.getTime()) / 1000));
}

// POST /api/join-group { inviteCode } → { groupId, name }
//
// Looks up an invite code in InstantDB using the admin token, so
// the SPA can resolve a code to a group id without needing
// `groups.view` to be open to all authed users. With this endpoint
// in place, `groups.view` can be locked to members and the only
// way to discover a group's id from outside is via the admin path
// here, which is rate-limited per IP to make brute-force guessing
// of the 6-char invite code (32⁶ ≈ 1B) impractical.
//
// The endpoint is intentionally narrow: it returns *only* the
// group id and name. The inviteCode itself is not echoed back. The
// SPA uses the returned id to perform `groups[id].link({members:
// authUserId})` from the user's own auth context — which still
// passes the InstantDB perm rule for membership joining.
async function handleJoinGroup(
  request: Request,
  env: Env,
): Promise<Response> {
  if (!env.INSTANT_ADMIN_TOKEN) {
    console.warn(
      "INSTANT_ADMIN_TOKEN not configured — /api/join-group disabled. " +
        "Set the secret with `wrangler secret put INSTANT_ADMIN_TOKEN`.",
    );
    return json({ error: "join-group endpoint not configured" }, 503);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid JSON body" }, 400);
  }

  const raw =
    body && typeof body === "object" && "inviteCode" in body
      ? (body as { inviteCode: unknown }).inviteCode
      : undefined;
  if (typeof raw !== "string") {
    return json({ error: "inviteCode is required" }, 400);
  }
  const inviteCode = raw.trim().toUpperCase();
  if (!INVITE_CODE_RE.test(inviteCode)) {
    return json({ error: "inviteCode must be 6 characters from A–Z, 2–9" }, 400);
  }

  // Per-IP rate limit on lookup attempts. Skipped silently if KV
  // isn't provisioned (matches the rest of the Worker's defensive
  // style).
  //
  // We check first, write second — and *don't* write when over cap.
  // Writing on every request (including blocked ones) would let an
  // attacker amplify our KV write volume after they've already hit
  // the cap, which costs more than it buys. The cost is the
  // stale-read race documented at IP_JOIN_HOURLY_CAP: a concurrent
  // burst can slip through together. The brute-force math up there
  // already accounts for that worst case.
  const ip = resolveClientIp(request);
  if (env.RATE_LIMIT_KV && ip) {
    const now = new Date();
    const hour = `${now.getUTCFullYear()}${pad2(now.getUTCMonth() + 1)}${pad2(
      now.getUTCDate(),
    )}${pad2(now.getUTCHours())}`;
    const key = `ipjoin:${ip}:${hour}`;
    const current = await readCount(env.RATE_LIMIT_KV, key);
    if (current >= IP_JOIN_HOURLY_CAP) {
      const headers = new Headers({
        "Content-Type": "application/json; charset=utf-8",
      });
      headers.set("Retry-After", String(secondsUntilNextUtcHour(now)));
      return new Response(
        JSON.stringify({
          error: "too many join attempts from this device — try again shortly.",
          retryAfterSeconds: secondsUntilNextUtcHour(now),
        }),
        { status: 429, headers },
      );
    }
    // Bump only when the request is going through. Failed lookups
    // (404s after this point) still count against the cap because
    // they got past this gate — a probe loop pays for every attempt
    // that doesn't hit the cap.
    await env.RATE_LIMIT_KV.put(key, String(current + 1), {
      expirationTtl: SECONDS_IN_HOUR + 300,
    });
  }

  // Admin query against InstantDB. The endpoint accepts InstaQL
  // and bypasses perm rules using the admin token — so we get a
  // result even when the caller has no auth context yet. We pull
  // just `name` (along with the implicit `id`) to keep the
  // response minimal.
  let upstream: Response;
  try {
    upstream = await fetch(
      `https://api.instantdb.com/admin/query?app_id=${INSTANT_APP_ID}`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "app-id": INSTANT_APP_ID,
          authorization: `Bearer ${env.INSTANT_ADMIN_TOKEN}`,
        },
        body: JSON.stringify({
          query: {
            groups: {
              $: { where: { inviteCode }, fields: ["name"] },
            },
          },
        }),
      },
    );
  } catch (err) {
    // Log internally; the public response stays generic so we
    // don't leak admin-API error shape to anonymous callers
    // probing the endpoint.
    console.error("join-group: admin fetch threw", err);
    return json({ error: "couldn't reach the directory" }, 502);
  }

  if (!upstream.ok) {
    const detail = await safeText(upstream);
    console.error(
      `join-group: admin returned ${upstream.status}`,
      detail.slice(0, 500),
    );
    return json({ error: "directory lookup failed" }, 502);
  }

  let payload: unknown;
  try {
    payload = await upstream.json();
  } catch (err) {
    console.error("join-group: admin returned non-JSON", err);
    return json({ error: "directory returned non-JSON" }, 502);
  }

  // Expected shape: { groups: [{ id, name }] } or { groups: [] }.
  const groups =
    payload && typeof payload === "object" && "groups" in payload
      ? (payload as { groups: unknown }).groups
      : null;
  if (!Array.isArray(groups) || groups.length === 0) {
    return json({ error: "no group with that invite code" }, 404);
  }

  const first = groups[0] as { id?: unknown; name?: unknown };
  if (typeof first.id !== "string") {
    return json({ error: "directory returned a malformed row" }, 502);
  }
  const name = typeof first.name === "string" ? first.name : "";
  return json({ groupId: first.id, name }, 200);
}

async function handleR2(key: string, env: Env): Promise<Response> {
  if (!key || key.includes("/") || key.includes("..")) {
    return json({ error: "bad key" }, 400);
  }
  const obj = await env.BUCKET.get(key);
  if (!obj) {
    return json({ error: "not found" }, 404);
  }
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  return new Response(obj.body, { headers });
}

function extractB64(payload: unknown): string | null {
  if (
    payload &&
    typeof payload === "object" &&
    "data" in payload &&
    Array.isArray((payload as { data: unknown }).data)
  ) {
    const first = (payload as { data: unknown[] }).data[0];
    if (first && typeof first === "object" && "b64_json" in first) {
      const v = (first as { b64_json: unknown }).b64_json;
      if (typeof v === "string" && v.length > 0) return v;
    }
  }
  return null;
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function trimTrailingSlash(s: string): string {
  return s.endsWith("/") ? s.slice(0, -1) : s;
}

async function safeText(r: Response): Promise<string> {
  try {
    return (await r.text()).slice(0, 500);
  } catch {
    return "";
  }
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function preflight(origin: string | null): Response {
  const headers = corsHeaders(origin);
  headers.set("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type");
  headers.set("Access-Control-Max-Age", "86400");
  return new Response(null, { status: 204, headers });
}

function withCors(response: Response, origin: string | null): Response {
  const headers = new Headers(response.headers);
  for (const [k, v] of corsHeaders(origin)) headers.set(k, v);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function corsHeaders(origin: string | null): Headers {
  const headers = new Headers();
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Vary", "Origin");
  }
  return headers;
}

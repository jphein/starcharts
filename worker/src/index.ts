// Starcharts summon Worker.
//
// POST /api/summon  { prompt: string, groupId: string }  → { url: string }
//
// Proxies a user prompt through to Azure AI Foundry's gpt-image-1.5
// deployment, decodes the returned base64 PNG, stores it in R2, and
// returns a URL the browser can drop into an <img>.
//
// GET /r2/<key>  → bytes  (fallback when PUBLIC_BUCKET_URL isn't set)
//
// Rate-limits (per-group day, per-IP hour) live in KV. Content
// moderation is intentionally not done here — Azure's content filter
// is the single source of truth for what's allowed through the model.
//
// Secrets / bindings:
//   - BUCKET                   R2 bucket binding (wrangler.toml)
//   - RATE_LIMIT_KV            KV namespace for counters
//   - AZURE_OPENAI_ENDPOINT    e.g. https://...cognitiveservices.azure.com
//   - AZURE_OPENAI_API_KEY
//   - AZURE_OPENAI_DEPLOYMENT  e.g. gpt-image-1.5
//   - AZURE_OPENAI_API_VERSION e.g. 2025-04-01-preview
//   - PUBLIC_BUCKET_URL        optional public R2 prefix

export interface Env {
  BUCKET: R2Bucket;
  RATE_LIMIT_KV: KVNamespace;
  AZURE_OPENAI_ENDPOINT: string;
  AZURE_OPENAI_API_KEY: string;
  AZURE_OPENAI_DEPLOYMENT: string;
  AZURE_OPENAI_API_VERSION: string;
  PUBLIC_BUCKET_URL?: string;
}

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
  const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
  const limit = await checkRateLimits(env, groupId, ip);
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

  // Bump counters only after a successful generation — failed Azure
  // calls don't burn the user's daily quota. Errors here are logged
  // but don't fail the response; the user already got their star.
  await bumpRateLimits(env, groupId, ip).catch((err) => {
    console.error("rate-limit bump failed", err);
  });

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

function rateLimitBuckets(groupId: string, ip: string, now: Date): BucketSpec[] {
  const day = `${now.getUTCFullYear()}${pad2(now.getUTCMonth() + 1)}${pad2(now.getUTCDate())}`;
  const hour = `${day}${pad2(now.getUTCHours())}`;
  return [
    {
      scope: "group",
      key: `g:${groupId}:${day}`,
      cap: GROUP_DAILY_CAP,
      ttlSeconds: SECONDS_IN_DAY + SECONDS_IN_HOUR,
      retryAfterSeconds: secondsUntilNextUtcDay(now),
      blockedMessage: `your group's sky is full for today (${GROUP_DAILY_CAP} custom stars). more space tomorrow.`,
    },
    {
      scope: "ip",
      key: `ip:${ip}:${hour}`,
      cap: IP_HOURLY_CAP,
      ttlSeconds: SECONDS_IN_HOUR + 300,
      retryAfterSeconds: secondsUntilNextUtcHour(now),
      blockedMessage: "too many summons in the last hour from this device — try again shortly.",
    },
  ];
}

async function checkRateLimits(
  env: Env,
  groupId: string,
  ip: string,
): Promise<RateLimitDecision> {
  const buckets = rateLimitBuckets(groupId, ip, new Date());
  for (const b of buckets) {
    const current = await readCount(env.RATE_LIMIT_KV, b.key);
    if (current >= b.cap) {
      return {
        blocked: true,
        scope: b.scope,
        retryAfterSeconds: b.retryAfterSeconds,
        message: b.blockedMessage,
      };
    }
  }
  return { blocked: false, retryAfterSeconds: 0, message: "" };
}

async function bumpRateLimits(env: Env, groupId: string, ip: string): Promise<void> {
  const buckets = rateLimitBuckets(groupId, ip, new Date());
  // KV doesn't have atomic counters; read-modify-write is fine at this
  // scale — worst case a burst of N concurrent requests overshoots by
  // a few. Run in parallel since both writes are independent.
  await Promise.all(
    buckets.map(async (b) => {
      const current = await readCount(env.RATE_LIMIT_KV, b.key);
      await env.RATE_LIMIT_KV.put(b.key, String(current + 1), {
        expirationTtl: b.ttlSeconds,
      });
    }),
  );
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

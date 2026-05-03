// Frontend client for the summon Worker.
//
// The Worker accepts `{ prompt, groupId }`, calls Azure AI Foundry,
// stores the resulting PNG in R2, and returns `{ url }`. This module
// is the only place in the app that knows that contract — screens
// import `summonStar` and treat any failure as a `SummonError`.
// On a 429 the Worker returns `{ scope, retryAfterSeconds }`; we
// surface that as a `RateLimitError` so SummonFlow can render a
// calmer "the sky is full" message instead of the generic failure path.

const DEFAULT_ENDPOINT = "https://summon.stars.realm.watch/api/summon";

export const SUMMON_ENDPOINT =
  (import.meta.env.VITE_SUMMON_ENDPOINT as string | undefined) ?? DEFAULT_ENDPOINT;

const PROMPT_MIN = 1;
const PROMPT_MAX = 200;
const REQUEST_TIMEOUT_MS = 60_000;

export class SummonError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SummonError";
  }
}

export class RateLimitError extends SummonError {
  scope: "group" | "ip";
  retryAfterSeconds: number;

  constructor(message: string, scope: "group" | "ip", retryAfterSeconds: number) {
    super(message);
    this.name = "RateLimitError";
    this.scope = scope;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export interface SummonResult {
  url: string;
}

export interface SummonArgs {
  prompt: string;
  groupId: string;
}

export async function summonStar(args: SummonArgs): Promise<SummonResult> {
  const trimmed = args.prompt.trim();
  if (trimmed.length < PROMPT_MIN) {
    throw new SummonError("Tell us a little about the star you imagine.");
  }
  if (trimmed.length > PROMPT_MAX) {
    throw new SummonError(`Keep it under ${PROMPT_MAX} characters.`);
  }
  if (!args.groupId) {
    throw new SummonError("Couldn't tell which group you're in — try refreshing.");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(SUMMON_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: trimmed, groupId: args.groupId }),
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new SummonError("The summoning took too long. Try once more.");
    }
    throw new SummonError("The stars didn't align — try again in a moment.");
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 429) {
    const data = await readErrorPayload(response);
    const scope = data?.scope === "ip" ? "ip" : "group";
    const retry =
      typeof data?.retryAfterSeconds === "number" && data.retryAfterSeconds > 0
        ? data.retryAfterSeconds
        : 3600;
    const message =
      typeof data?.error === "string" && data.error.length > 0
        ? data.error
        : "the sky is full for now — try again later.";
    throw new RateLimitError(message, scope, retry);
  }

  if (!response.ok) {
    const data = await readErrorPayload(response);
    const detail = typeof data?.error === "string" ? data.error : null;
    if (response.status >= 400 && response.status < 500) {
      throw new SummonError(detail ?? "That prompt didn't take. Try rephrasing.");
    }
    throw new SummonError(detail ?? "The stars didn't align — try again in a moment.");
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new SummonError("The stars came back garbled. Try again.");
  }

  if (
    !payload ||
    typeof payload !== "object" ||
    !("url" in payload) ||
    typeof (payload as { url: unknown }).url !== "string"
  ) {
    throw new SummonError("The stars came back garbled. Try again.");
  }

  return { url: (payload as { url: string }).url };
}

interface ErrorPayload {
  error?: unknown;
  scope?: unknown;
  retryAfterSeconds?: unknown;
}

async function readErrorPayload(response: Response): Promise<ErrorPayload | null> {
  try {
    return (await response.json()) as ErrorPayload;
  } catch {
    return null;
  }
}

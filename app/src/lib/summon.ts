// Frontend client for the summon Worker.
//
// The Worker accepts `{ prompt }`, calls Azure AI Foundry, stores the
// resulting PNG in R2, and returns `{ url }`. This module is the only
// place in the app that knows that contract — screens import
// `summonStar` and treat any failure as a `SummonError`.

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

export interface SummonResult {
  url: string;
}

export async function summonStar(prompt: string): Promise<SummonResult> {
  const trimmed = prompt.trim();
  if (trimmed.length < PROMPT_MIN) {
    throw new SummonError("Tell us a little about the star you imagine.");
  }
  if (trimmed.length > PROMPT_MAX) {
    throw new SummonError(`Keep it under ${PROMPT_MAX} characters.`);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(SUMMON_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: trimmed }),
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

  if (!response.ok) {
    const detail = await readErrorMessage(response);
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

async function readErrorMessage(response: Response): Promise<string | null> {
  try {
    const data = (await response.json()) as { error?: unknown };
    if (typeof data.error === "string" && data.error.length > 0) {
      return data.error;
    }
  } catch {
    // fall through
  }
  return null;
}

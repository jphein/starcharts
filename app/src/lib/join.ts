// Frontend client for the Worker's /api/join-group endpoint.
//
// The Worker accepts `{ inviteCode, refreshToken }`. It verifies
// the refresh token (so it can identify the caller without trusting
// a userId from the SPA), looks up the group with the admin token,
// and links the verified user to the group via admin transact —
// then returns `{ groupId, name }`.
//
// Owning the link op server-side is what lets `groups.update` stay
// rename-only: no client-side path can touch the members link.
//
// On a 404 (no group with that code), the Worker returns a
// distinct error message; we surface that as the same kind of
// JoinError as everything else so the UI can render a single
// failure path. 401 (invalid auth token) is also surfaced as a
// JoinError — the UI prompts the user to re-sign-in.

const DEFAULT_ENDPOINT =
  "https://starcharts-summon.jp5.workers.dev/api/join-group";

export const JOIN_ENDPOINT =
  (import.meta.env.VITE_JOIN_ENDPOINT as string | undefined) ?? DEFAULT_ENDPOINT;

const REQUEST_TIMEOUT_MS = 10_000;

export class JoinError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JoinError";
  }
}

export interface JoinResult {
  groupId: string;
  name: string;
}

export async function joinGroupByCode(
  inviteCode: string,
  refreshToken: string,
): Promise<JoinResult> {
  const trimmed = inviteCode.trim().toUpperCase();
  if (!trimmed) {
    throw new JoinError("Enter an invite code.");
  }
  if (!refreshToken) {
    throw new JoinError("You need to be signed in to join a group.");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(JOIN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inviteCode: trimmed, refreshToken }),
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new JoinError("That took too long. Try once more.");
    }
    throw new JoinError("Couldn't reach the directory — try again in a moment.");
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 401) {
    throw new JoinError("Your session has expired — sign in again to join.");
  }
  if (response.status === 404) {
    throw new JoinError("No group found with that code.");
  }
  if (response.status === 429) {
    throw new JoinError("Too many tries from this device — wait a bit.");
  }
  if (!response.ok) {
    const detail = await readErrorMessage(response);
    throw new JoinError(detail ?? "Couldn't look up that group right now.");
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new JoinError("Directory came back garbled. Try again.");
  }

  if (
    !payload ||
    typeof payload !== "object" ||
    typeof (payload as { groupId?: unknown }).groupId !== "string"
  ) {
    throw new JoinError("Directory came back garbled. Try again.");
  }

  const data = payload as { groupId: string; name?: string };
  return { groupId: data.groupId, name: data.name ?? "" };
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

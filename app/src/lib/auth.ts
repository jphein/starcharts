// Thin wrapper over InstantDB's auth + profile mutations.
//
// Screens import these helpers instead of touching `db.auth` / `db.transact`
// directly so the auth shape stays in one place.

import { db } from "../db/client";

export async function requestMagicCode(email: string): Promise<void> {
  await db.auth.sendMagicCode({ email });
}

export async function signInWithCode(email: string, code: string): Promise<void> {
  await db.auth.signInWithMagicCode({ email, code });
}

export async function signOut(): Promise<void> {
  await db.auth.signOut();
}

// Cheap deterministic 32-bit hash → 8-char hex. Used to derive an
// avatarSeed when the caller doesn't supply one. Same input → same
// output, so a user's seeded avatar is stable across re-runs.
function hashToSeed(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

export async function completeProfile(
  displayName: string,
  avatarSeed?: string,
): Promise<void> {
  const user = await db.getAuth();
  if (!user) {
    throw new Error("completeProfile called without a signed-in user");
  }
  const seed = avatarSeed ?? hashToSeed(displayName);
  await db.transact(
    db.tx.$users[user.id].update({
      displayName,
      avatarSeed: seed,
    }),
  );
}

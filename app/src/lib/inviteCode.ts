// Invite codes for joining a group.
//
// 6-char codes from a 32-char Crockford-flavored alphabet that drops
// 1, I, 0, O so codes stay legible when read aloud or copied by hand.
// Per docs/2026-05-02-design-port-plan.md §6.

export const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const CODE_LENGTH = 6;

export function generateInviteCode(): string {
  let out = "";
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const buf = new Uint32Array(CODE_LENGTH);
    crypto.getRandomValues(buf);
    for (let i = 0; i < CODE_LENGTH; i++) {
      out += ALPHABET[buf[i] % ALPHABET.length];
    }
    return out;
  }
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}

export function normalizeInviteCode(s: string): string {
  return s.toUpperCase().replace(/\s+/g, "");
}

export function isValidInviteCode(s: string): boolean {
  const normalized = normalizeInviteCode(s);
  if (normalized.length !== CODE_LENGTH) return false;
  for (const ch of normalized) {
    if (!ALPHABET.includes(ch)) return false;
  }
  return true;
}

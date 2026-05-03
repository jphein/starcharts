// Build-time version writer. Produces app/public/version.json — read
// at runtime by <Sigil /> and consumed by humans at /version.json.
//
// Output shape conforms to the realm-sigil contract
// (https://github.com/jphein/realm-sigil), with a few extras that the
// app uses (commitUrl, magicName, realmHash). The `version` field is
// the canonical realm-sigil string: "<adjective> <noun> · <hash>".
//
// Until realm-sigil is published to npm, the algorithm + the stellar
// wordlist are vendored inline below. Replace this block with
// `import { generateName } from "realm-sigil"` once jphein/realm-sigil
// ships v1.1.0+ to the registry.

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// ── Vendored realm-sigil (TODO: drop in favor of npm pkg) ───────────

const STELLAR = {
  adjectives: [
    "Ascending", "Binary", "Cosmic", "Distant", "Expanding",
    "Flaring", "Graviton", "Helical", "Ionized", "Jovian",
    "Kepler", "Lunar", "Magnetic", "Nebular", "Orbital",
    "Pulsating", "Quantum", "Radiant", "Solar", "Tidal",
  ],
  nouns: [
    "Aurora", "Bolide", "Corona", "Dwarf", "Eclipse",
    "Firmament", "Galaxy", "Halo", "Ion", "Jet",
    "Kuiper", "Luminance", "Meteor", "Nova", "Orbit",
    "Pulsar", "Quasar", "Remnant", "Supernova", "Zenith",
  ],
};

function generateName(hashHex, realm) {
  // realm-sigil's algorithm (mirrored across Go/Python/JS): treat the
  // hash as base-16, modulo into the adjective and noun lists. Same
  // hash + realm always produces the same name across implementations.
  const seed = Number.parseInt(hashHex, 16);
  if (!Number.isFinite(seed) || seed < 0) {
    return `Unknown Sigil · ${hashHex}`;
  }
  const adj = realm.adjectives[seed % realm.adjectives.length];
  const noun = realm.nouns[(seed >>> 8) % realm.nouns.length];
  return `${adj} ${noun} · ${hashHex}`;
}

// ────────────────────────────────────────────────────────────────────

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(here, "..");
const repoRoot = resolve(appRoot, "..");

function git(args) {
  try {
    return execFileSync("git", ["-C", repoRoot, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

const hash = git(["rev-parse", "--short", "HEAD"]) || "unknown";
const branch =
  process.env.GITHUB_REF_NAME ||
  git(["rev-parse", "--abbrev-ref", "HEAD"]) ||
  "main";
const dirty = git(["status", "--porcelain"]) !== "";

const pkg = JSON.parse(readFileSync(resolve(appRoot, "package.json"), "utf8"));
const semver = pkg.version ?? "0.0.0";
const repo = "https://github.com/jphein/starcharts";
const realm = "stellar";

const magicName =
  hash === "unknown"
    ? `Unknown Sigil · ${hash}`
    : generateName(hash, STELLAR);

const out = {
  name: "starcharts",
  description: "Collaborative starchart for families and friends",
  // Per realm-sigil contract, `version` is the algorithmic name+hash,
  // not semver. Semver lives in `semver` so anyone hitting this file
  // for either reason gets what they expect.
  version: magicName,
  semver,
  hash,
  branch,
  dirty,
  built: new Date().toISOString(),
  realm,
  repo,
  commit_url: hash !== "unknown" ? `${repo}/commit/${hash}` : "",
};

const publicDir = resolve(appRoot, "public");
mkdirSync(publicDir, { recursive: true });
writeFileSync(
  resolve(publicDir, "version.json"),
  JSON.stringify(out, null, 2) + "\n",
);
console.log("[version] wrote public/version.json:", out);

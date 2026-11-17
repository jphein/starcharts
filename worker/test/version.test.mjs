// node --test test/version.test.mjs: the Worker's realm-sigil /api/version (2026-11-17, CHECK sigil-coverage).
import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = mkdtempSync(path.join(tmpdir(), "summon-sigil-"));
const out = path.join(dir, "index.mjs");
await build({ entryPoints: [path.join(here, "..", "src", "index.ts")], bundle: true, format: "esm", platform: "neutral",
  mainFields: ["module", "main"], outfile: out, logLevel: "silent", external: ["cloudflare:*", "node:*"] });
const { versionResponse } = await import(out);
rmSync(dir, { recursive: true, force: true });

test("a stamped deploy serves '<Name> · <hash>' for that commit", async () => {
  const r = versionResponse({ SIGIL_HASH: "4ce2afc", SIGIL_BRANCH: "main", SIGIL_DIRTY: "false", SIGIL_BUILT: "2026-11-17T14:00:00Z" });
  const v = await r.json();
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("cache-control"), "no-store");
  assert.match(v.version, /^.+ · 4ce2afc$/);
  assert.equal(v.hash, "4ce2afc");
  assert.equal(v.dirty, false);
  assert.equal(v.repo, "https://github.com/jphein/starcharts");
});

test("no stamp, or junk, says dev (and dirty) instead of inventing a hash", async () => {
  for (const env of [{}, { SIGIL_HASH: "$(rm -rf)" }, { SIGIL_HASH: "ABCDEF1" }]) {
    const v = await versionResponse(env).json();
    assert.equal(v.hash, "dev");
    assert.equal(v.dirty, true);
  }
});

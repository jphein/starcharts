import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

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
const version = pkg.version ?? "0.0.0";

const out = {
  name: "starcharts",
  description: "Collaborative starchart for families and friends",
  version,
  hash,
  branch,
  dirty,
  built: new Date().toISOString(),
  realm: "stellar",
  repo: "https://github.com/jphein/starcharts",
};

const publicDir = resolve(appRoot, "public");
mkdirSync(publicDir, { recursive: true });
writeFileSync(
  resolve(publicDir, "version.json"),
  JSON.stringify(out, null, 2) + "\n",
);
console.log("[version] wrote public/version.json:", out);

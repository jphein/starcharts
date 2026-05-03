// Realm sigil — visible, magical version badge.
//
// Idle state: a tiny gold ✦ + the realm-sigil two-word magic name +
// the short hash, fixed in the corner. Always rendered, so JP can
// glance at any screen and know which build is in front of him —
// "Distant Kuiper · 9a7c2b7" tells you both *which* commit and gives
// the deploy a name worth remembering.
//
// Hover/tap: the badge expands to reveal realm, branch, build time,
// and a link to the GitHub commit. The ✦ pulses gently as a "live"
// cue; the pulse is suppressed under prefers-reduced-motion (CSS
// module handles that — no JS gating needed). The closed panel uses
// `inert` so its link doesn't catch keyboard tab focus while collapsed.
//
// Reads `/version.json` once on mount. The file is written by
// `app/scripts/version.mjs` and conforms to the realm-sigil contract
// (`version` is the algorithmic name+hash). `predev` and `prebuild`
// both run the writer so the file is present in dev too. If it's
// still missing for any reason (mid-rebuild, broken deploy), we
// render a defensive "dev" sigil so the absence is loud, not silent.

import { useEffect, useState } from "react";
import styles from "./Sigil.module.css";

interface VersionInfo {
  name: string;
  // Per realm-sigil contract: "<adjective> <noun> · <hash>".
  version: string;
  hash: string;
  branch: string;
  dirty: boolean;
  built: string;
  realm: string;
  repo: string;
  commit_url?: string;
  // Optional — present when version.mjs writes it.
  semver?: string;
}

const FALLBACK: VersionInfo = {
  name: "starcharts",
  version: "Local Sigil · dev",
  hash: "dev",
  branch: "?",
  dirty: true,
  built: new Date().toISOString(),
  realm: "stellar",
  repo: "https://github.com/jphein/starcharts",
};

// Split "Adjective Noun · hash" into its parts. Defensively handles
// older/legacy `version.json` files where `version` is just a semver
// (no " · " separator) by treating the entire string as the name.
function splitMagicName(version: string): { name: string; hash: string | null } {
  const idx = version.lastIndexOf(" · ");
  if (idx < 0) return { name: version, hash: null };
  return {
    name: version.slice(0, idx),
    hash: version.slice(idx + 3),
  };
}

export function Sigil() {
  const [info, setInfo] = useState<VersionInfo | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    const url = `${import.meta.env.BASE_URL}version.json`;
    fetch(url, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((v: VersionInfo | null) => {
        if (!alive) return;
        setInfo(v ?? FALLBACK);
      })
      .catch(() => {
        if (alive) setInfo(FALLBACK);
      });
    return () => {
      alive = false;
    };
  }, []);

  if (!info) return null;

  const built = formatBuiltDate(info.built);
  const commitUrl =
    info.commit_url ||
    (info.repo
      ? `${info.repo.replace(/\/+$/, "")}/commit/${info.hash}`
      : null);
  const { name: magicName } = splitMagicName(info.version);
  const dirtyLabel = info.dirty ? "·" : "";

  return (
    <aside
      className={`${styles.sigil} ${open ? styles.open : ""}`}
      aria-label={`Build sigil — ${info.version}${info.dirty ? " (dirty)" : ""}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <button
        type="button"
        className={styles.handle}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className={styles.glyph} aria-hidden="true">✦</span>
        <span className={styles.magicName}>{magicName}</span>
        <span className={styles.divider} aria-hidden="true">·</span>
        <span className={styles.hash}>
          {info.hash}
          {dirtyLabel && (
            <span className={styles.dirty} title="working tree was dirty at build time">
              {dirtyLabel}
            </span>
          )}
        </span>
      </button>

      <div
        className={styles.panel}
        role="group"
        aria-hidden={!open}
        // `inert` removes the panel's children (notably the GitHub
        // link) from the tab order and accessibility tree while
        // collapsed — matches the visual hidden state. Universally
        // supported in evergreen browsers since 2023.
        inert={!open}
      >
        <p className={styles.line}>
          <span className={styles.label}>name</span>
          <span className={styles.value}>{magicName}</span>
        </p>
        <p className={styles.line}>
          <span className={styles.label}>realm</span>
          <span className={styles.value}>{info.realm}</span>
        </p>
        <p className={styles.line}>
          <span className={styles.label}>commit</span>
          <span className={styles.valueMono}>
            {info.hash}
            {info.dirty ? " · dirty" : ""}
          </span>
        </p>
        <p className={styles.line}>
          <span className={styles.label}>branch</span>
          <span className={styles.value}>{info.branch}</span>
        </p>
        <p className={styles.line}>
          <span className={styles.label}>built</span>
          <span className={styles.value}>{built}</span>
        </p>
        {commitUrl && (
          <a
            href={commitUrl}
            className={styles.link}
            target="_blank"
            rel="noopener noreferrer"
          >
            view on github ↗
          </a>
        )}
      </div>
    </aside>
  );
}

function formatBuiltDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const date = d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
    const time = d.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
    return `${date}, ${time}`;
  } catch {
    return iso;
  }
}

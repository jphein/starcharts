// Realm sigil — visible, magical version badge.
//
// Idle state: a tiny gold ✦ + the realm word + the short hash, fixed
// in the corner. Always rendered, so JP can glance at any screen and
// know which build is in front of him.
//
// Hover/tap: the badge expands to reveal branch, build time, and a
// link to the GitHub commit. The ✦ pulses gently as a "live" cue;
// the pulse is suppressed under prefers-reduced-motion (CSS module
// handles that — no JS gating needed).
//
// Reads `/version.json` once on mount. The file is written by
// `app/scripts/version.mjs` during prebuild and is the realm-sigil
// source of truth for what's deployed.

import { useEffect, useState } from "react";
import styles from "./Sigil.module.css";

interface VersionInfo {
  name: string;
  version: string;
  hash: string;
  branch: string;
  dirty: boolean;
  built: string;
  realm: string;
  repo: string;
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
        if (alive && v) setInfo(v);
      })
      .catch(() => {
        // Silent — sigil just stays hidden if the file is unreachable.
      });
    return () => {
      alive = false;
    };
  }, []);

  if (!info) return null;

  const built = formatBuiltDate(info.built);
  const commitUrl = info.repo
    ? `${info.repo.replace(/\/+$/, "")}/commit/${info.hash}`
    : null;
  const dirtyLabel = info.dirty ? "·" : "";

  return (
    <aside
      className={`${styles.sigil} ${open ? styles.open : ""}`}
      aria-label={`Build sigil — ${info.realm}, ${info.hash}${info.dirty ? ", dirty" : ""}`}
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
        <span className={styles.realm}>{info.realm}</span>
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

      <div className={styles.panel} role="group" aria-hidden={!open}>
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

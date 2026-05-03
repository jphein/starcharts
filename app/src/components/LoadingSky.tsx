// Loading-state wrapper around <Sky />. The bare starfield reads as a
// blank page when a query takes longer than a frame to resolve, so we
// fade in a small italic hint after a short delay — fast loads stay
// silent, slow loads explain themselves.
//
// Animation lives in the colocated CSS module so the keyframes are
// bundled once (not re-injected per mount) and scoped by hash.
// `prefers-reduced-motion` is honored via the media query in the module.

import { Sky } from "./Sky";
import styles from "./LoadingSky.module.css";

interface LoadingSkyProps {
  hint?: string;
}

export function LoadingSky({ hint = "loading the sky…" }: LoadingSkyProps) {
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      <Sky>
        <div className={styles.hint}>
          <p className={styles.text}>{hint}</p>
        </div>
      </Sky>
    </div>
  );
}

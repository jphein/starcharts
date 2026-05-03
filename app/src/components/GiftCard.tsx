// Bottom-sheet that opens when a star is tapped on the chart sky.
//
// Shows the gift's hero star, the honorees the giver was thinking of,
// the reason text in serif, and a quiet footer with giver, count, and
// formatted date. Backdrop or Escape closes it. Reduced motion skips
// the slide and renders the sheet in place.

import { useEffect } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { GiftWithLinks } from "../hooks/useGiftsForChart";

interface GiftCardProps {
  gift: GiftWithLinks;
  onClose: () => void;
}

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  month: "long",
  day: "numeric",
  year: "numeric",
});

export function GiftCard({ gift, onClose }: GiftCardProps) {
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const honoreeNames = gift.honorees.map((h) => h.displayName).filter(Boolean);
  const honoreeLabel =
    honoreeNames.length > 0 ? honoreeNames.join(", ") : "someone";
  const giverName = gift.giver?.displayName ?? "someone";
  const dateLabel = dateFormatter.format(new Date(gift.createdAt));
  const countLabel = `${gift.count} ${gift.count === 1 ? "star" : "stars"}`;

  const sheetInitial = prefersReducedMotion ? { y: 0, opacity: 0 } : { y: "100%" };
  const sheetAnimate = prefersReducedMotion ? { y: 0, opacity: 1 } : { y: 0 };
  const sheetExit = prefersReducedMotion ? { y: 0, opacity: 0 } : { y: "100%" };

  return (
    <AnimatePresence>
      <motion.div
        key="gift-card-overlay"
        style={overlayStyle}
        role="dialog"
        aria-modal="true"
        aria-label="Gift details"
      >
        <motion.div
          key="backdrop"
          style={backdropStyle}
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.5 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
        />
        <motion.div
          key="sheet"
          style={sheetStyle}
          initial={sheetInitial}
          animate={sheetAnimate}
          exit={sheetExit}
          transition={
            prefersReducedMotion
              ? { duration: 0.15 }
              : { type: "spring", damping: 32, stiffness: 320 }
          }
        >
          <div style={handleBarStyle} aria-hidden />

          <div style={heroWrapStyle}>
            <img
              src={gift.starImageUrl}
              alt=""
              draggable={false}
              style={heroImgStyle}
            />
          </div>

          <div style={eyebrowStyle}>for</div>
          <div style={honoreeStyle}>{honoreeLabel}</div>

          <p style={reasonStyle}>“{gift.reason}”</p>

          <div style={footerStyle}>
            from {giverName} · {countLabel} · {dateLabel}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "center",
  zIndex: 50,
  pointerEvents: "auto",
};

const backdropStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  background: "#000",
};

const sheetStyle: React.CSSProperties = {
  position: "relative",
  width: "100%",
  maxWidth: 480,
  margin: "0 auto",
  background: "var(--sc-surface)",
  border: "1px solid var(--sc-stroke)",
  borderBottom: "none",
  borderRadius: "var(--sc-radius-tile, 18px) var(--sc-radius-tile, 18px) 0 0",
  padding: "18px 24px 32px",
  boxShadow: "var(--sc-shadow-tile, 0 -12px 40px rgba(0,0,0,0.45))",
  backdropFilter: "blur(10px)",
  WebkitBackdropFilter: "blur(10px)",
  color: "var(--sc-fg)",
  textAlign: "center",
};

const handleBarStyle: React.CSSProperties = {
  width: 36,
  height: 4,
  borderRadius: 2,
  background: "var(--sc-stroke)",
  margin: "0 auto 14px",
};

const heroWrapStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "center",
  marginBottom: 16,
};

const heroImgStyle: React.CSSProperties = {
  width: 96,
  height: 96,
  objectFit: "contain",
  filter: "drop-shadow(0 0 18px rgba(255,235,180,0.5))",
};

const eyebrowStyle: React.CSSProperties = {
  fontFamily: "var(--sc-sans)",
  fontSize: 10,
  letterSpacing: "0.22em",
  textTransform: "uppercase",
  color: "var(--sc-fg-muted)",
  marginBottom: 4,
};

const honoreeStyle: React.CSSProperties = {
  fontFamily: "var(--sc-serif)",
  fontWeight: 500,
  fontSize: 18,
  color: "var(--sc-fg)",
  marginBottom: 14,
};

const reasonStyle: React.CSSProperties = {
  fontFamily: "var(--sc-serif)",
  fontStyle: "italic",
  fontSize: 16,
  lineHeight: 1.4,
  color: "var(--sc-fg-muted)",
  margin: "0 0 22px",
  padding: "0 4px",
};

const footerStyle: React.CSSProperties = {
  fontFamily: "var(--sc-sans)",
  fontSize: 11,
  letterSpacing: "0.06em",
  color: "var(--sc-fg-faint)",
  paddingTop: 14,
  borderTop: "1px solid var(--sc-stroke)",
};

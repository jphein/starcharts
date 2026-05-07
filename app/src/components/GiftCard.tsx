// Modal dialog that opens when a star is tapped on the chart sky.
//
// Shows the gift's hero star, the honorees the giver was thinking of,
// the reason text in serif, and a quiet footer with giver, count, and
// formatted date. Backdrop or Escape closes it. Scrolls internally if
// content is taller than the viewport.

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { GiftWithLinks } from "../hooks/useGiftsForChart";
import { db } from "../db/client";

interface GiftCardProps {
  gift: GiftWithLinks;
  onClose: () => void;
  currentUserId?: string;
}

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  month: "long",
  day: "numeric",
  year: "numeric",
});

export function GiftCard({ gift, onClose, currentUserId }: GiftCardProps) {
  const prefersReducedMotion = useReducedMotion();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isGiver = currentUserId != null && gift.giver?.id === currentUserId;

  async function handleDelete() {
    setDeleting(true);
    try {
      await db.transact(db.tx.gifts[gift.id].delete());
      onClose();
    } catch {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // Merge $users honorees with ad-hoc roster honorees — both surfaces
  // are displayed identically (same chip pattern), distinguished only
  // by where they came from in the picker. Either may be empty.
  const honoreeNames = [
    ...gift.honorees.map((h) => h.displayName),
    ...gift.rosterHonorees.map((r) => r.displayName),
  ].filter(Boolean);
  const honoreeLabel =
    honoreeNames.length > 0 ? honoreeNames.join(", ") : "someone";
  const giverName = gift.giver?.displayName ?? "someone";
  const dateLabel = dateFormatter.format(new Date(gift.createdAt));
  const countLabel = `${gift.count} ${gift.count === 1 ? "star" : "stars"}`;

  const modalInitial = prefersReducedMotion
    ? { opacity: 0 }
    : { opacity: 0, scale: 0.94, y: 12 };
  const modalAnimate = prefersReducedMotion
    ? { opacity: 1 }
    : { opacity: 1, scale: 1, y: 0 };
  const modalExit = prefersReducedMotion
    ? { opacity: 0 }
    : { opacity: 0, scale: 0.94, y: 12 };

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
          animate={{ opacity: 0.6 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
        />
        <motion.div
          key="modal"
          style={modalStyle}
          initial={modalInitial}
          animate={modalAnimate}
          exit={modalExit}
          transition={
            prefersReducedMotion
              ? { duration: 0.15 }
              : { type: "spring", damping: 28, stiffness: 340 }
          }
        >
          <button onClick={onClose} aria-label="Close" style={closeBtnStyle}>
            ✕
          </button>

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

          <p style={reasonStyle}>"{gift.reason}"</p>

          <div style={footerStyle}>
            from {giverName} · {countLabel} · {dateLabel}
          </div>

          {isGiver && (
            <div style={deleteWrapStyle}>
              {confirmDelete ? (
                <div style={confirmRowStyle}>
                  <span style={confirmTextStyle}>Remove this gift?</span>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    style={confirmBtnStyle}
                  >
                    {deleting ? "Removing…" : "Yes, remove"}
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    style={cancelBtnStyle}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button onClick={() => setConfirmDelete(true)} style={deleteBtnStyle}>
                  Remove gift
                </button>
              )}
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 50,
  padding: "16px",
  pointerEvents: "auto",
};

const backdropStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  background: "#000",
};

const modalStyle: React.CSSProperties = {
  position: "relative",
  width: "100%",
  maxWidth: 400,
  maxHeight: "calc(100vh - 32px)",
  overflowY: "auto",
  background: "var(--sc-surface)",
  border: "1px solid var(--sc-stroke)",
  borderRadius: "var(--sc-radius-tile, 18px)",
  padding: "28px 24px 28px",
  boxShadow: "0 24px 60px rgba(0,0,0,0.55)",
  backdropFilter: "blur(10px)",
  WebkitBackdropFilter: "blur(10px)",
  color: "var(--sc-fg)",
  textAlign: "center",
};

const closeBtnStyle: React.CSSProperties = {
  position: "absolute",
  top: 14,
  right: 14,
  width: 28,
  height: 28,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "transparent",
  border: "none",
  cursor: "pointer",
  color: "var(--sc-fg-muted)",
  fontSize: 14,
  lineHeight: 1,
  borderRadius: "50%",
  padding: 0,
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

const deleteWrapStyle: React.CSSProperties = {
  marginTop: 20,
  paddingTop: 16,
  borderTop: "1px solid var(--sc-stroke)",
};

const deleteBtnStyle: React.CSSProperties = {
  background: "transparent",
  border: "none",
  cursor: "pointer",
  fontFamily: "var(--sc-sans)",
  fontSize: 11,
  letterSpacing: "0.06em",
  color: "var(--sc-fg-faint)",
  padding: 0,
  textDecoration: "underline",
  textUnderlineOffset: 3,
};

const confirmRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
  flexWrap: "wrap",
};

const confirmTextStyle: React.CSSProperties = {
  fontFamily: "var(--sc-sans)",
  fontSize: 11,
  color: "var(--sc-fg-muted)",
};

const confirmBtnStyle: React.CSSProperties = {
  background: "transparent",
  border: "1px solid var(--sc-stroke)",
  borderRadius: 999,
  cursor: "pointer",
  fontFamily: "var(--sc-sans)",
  fontSize: 11,
  color: "var(--sc-fg)",
  padding: "4px 12px",
};

const cancelBtnStyle: React.CSSProperties = {
  background: "transparent",
  border: "none",
  cursor: "pointer",
  fontFamily: "var(--sc-sans)",
  fontSize: 11,
  color: "var(--sc-fg-faint)",
  padding: "4px 8px",
};

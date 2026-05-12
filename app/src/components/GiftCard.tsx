// Modal dialog that opens when a star is tapped on the chart sky.
//
// Shows the gift's hero star, the honorees the giver was thinking of,
// the reason text in serif, and a quiet footer with giver, count, and
// formatted date. Backdrop or Escape closes it. Scrolls internally if
// content is taller than the viewport.
//
// The footer right side has a heart toggle. Tapping ♡ creates a reaction
// row linked to the gift and current user; tapping ♥ deletes it. The
// colored dots next to the heart show who has reacted; tapping them opens
// a small name-list popover (same portal pattern as MemberDots).

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { id } from "@instantdb/react";
import type { GiftWithLinks } from "../hooks/useGiftsForChart";
import { db } from "../db/client";

interface GiftCardProps {
  gift: GiftWithLinks;
  onClose: () => void;
  currentUserId?: string;
  currentUserSeed?: string;
}

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  month: "long",
  day: "numeric",
  year: "numeric",
});

function hashString(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function colorForSeed(seed: string): string {
  const h = hashString(seed || "anon");
  const hue = h % 360;
  const sat = 55 + ((h >>> 8) % 20);
  const light = 70 + ((h >>> 16) % 10);
  return `hsl(${hue} ${sat}% ${light}%)`;
}

type Reactor = { id: string; displayName: string; avatarSeed: string };

function ReactorsChip({ reactors }: { reactors: Reactor[] }) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<{ top: number; left: number } | null>(null);
  const anchorRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (anchorRef.current && !anchorRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function handleToggle() {
    if (!open && anchorRef.current) {
      const r = anchorRef.current.getBoundingClientRect();
      setRect({ top: r.top - 8, left: r.left });
    }
    setOpen((o) => !o);
  }

  const MAX_DOTS = 3;
  const visible = reactors.slice(0, MAX_DOTS);
  const overflow = reactors.length - MAX_DOTS;

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        onClick={handleToggle}
        aria-label="See who hearted"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 3,
          background: "none",
          border: "none",
          padding: "2px 4px",
          borderRadius: 999,
          cursor: "pointer",
          ...(open ? { background: "rgba(255,255,255,0.07)" } : {}),
        }}
      >
        {visible.map((r) => (
          <span
            key={r.id}
            title={r.displayName}
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              display: "inline-block",
              flexShrink: 0,
              background: colorForSeed(r.avatarSeed || r.id),
              boxShadow: "0 0 0 1px rgba(255,255,255,0.18)",
            }}
          />
        ))}
        {overflow > 0 && (
          <span style={{ fontFamily: "var(--sc-sans)", fontSize: 10, color: "var(--sc-fg-faint)" }}>
            +{overflow}
          </span>
        )}
      </button>

      {open && rect && createPortal(
        <div
          style={{
            position: "fixed",
            top: rect.top,
            left: rect.left,
            transform: "translateY(-100%)",
            minWidth: 160,
            background: "var(--sc-bg, #0d0a14)",
            border: "1px solid var(--sc-stroke)",
            borderRadius: 12,
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            zIndex: 9999,
            overflow: "hidden",
          }}
        >
          <span
            style={{
              display: "block",
              padding: "8px 14px 6px",
              fontFamily: "var(--sc-sans)",
              fontSize: 10,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "var(--sc-fg-faint)",
            }}
          >
            Hearted by
          </span>
          <div style={{ height: 1, background: "var(--sc-stroke)", margin: "0 0 4px" }} />
          {reactors.map((r) => (
            <div
              key={r.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 14px",
                fontFamily: "var(--sc-sans)",
                fontSize: 13,
                color: "var(--sc-fg)",
              }}
            >
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: colorForSeed(r.avatarSeed || r.id),
                  flexShrink: 0,
                  boxShadow: "0 0 0 1px rgba(255,255,255,0.18)",
                }}
              />
              {r.displayName || "Someone"}
            </div>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}

export function GiftCard({ gift, onClose, currentUserId, currentUserSeed }: GiftCardProps) {
  const prefersReducedMotion = useReducedMotion();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isGiver = currentUserId != null && gift.giver?.id === currentUserId;

  // Live reactions for this gift.
  const reactionsResult = db.useQuery({
    reactions: {
      $: { where: { "gift.id": gift.id } },
      user: {},
    },
  });

  const reactions = useMemo(() => {
    const rows = reactionsResult.data?.reactions ?? [];
    return rows.map((r) => {
      const raw = (r as unknown as { user?: unknown }).user;
      let user: Reactor | null = null;
      if (Array.isArray(raw) && raw.length > 0) {
        const u = raw[0] as { id: string; displayName?: string; avatarSeed?: string };
        user = { id: u.id, displayName: u.displayName ?? "", avatarSeed: u.avatarSeed ?? u.id };
      } else if (raw && typeof raw === "object") {
        const u = raw as { id: string; displayName?: string; avatarSeed?: string };
        user = { id: u.id, displayName: u.displayName ?? "", avatarSeed: u.avatarSeed ?? u.id };
      }
      return { id: r.id, user };
    });
  }, [reactionsResult.data]);

  const myReaction = reactions.find((r) => r.user?.id === currentUserId);
  const hasReacted = myReaction != null;
  const reactors = reactions.flatMap((r) => (r.user ? [r.user] : []));

  async function handleHeartToggle() {
    if (!currentUserId) return;
    if (hasReacted && myReaction) {
      await db.transact(db.tx.reactions[myReaction.id].delete());
    } else {
      const newId = id();
      await db.transact(
        db.tx.reactions[newId]
          .update({ emoji: "heart", createdAt: Date.now() })
          .link({ gift: gift.id, user: currentUserId }),
      );
    }
  }

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
            <span>from {giverName} · {countLabel} · {dateLabel}</span>
            <div style={heartAreaStyle}>
              <button
                type="button"
                onClick={() => void handleHeartToggle()}
                disabled={!currentUserId}
                aria-label={hasReacted ? "Remove heart" : "Heart this gift"}
                style={heartBtnStyle(hasReacted, currentUserSeed)}
              >
                {hasReacted ? "♥" : "♡"}
              </button>
              {reactors.length > 0 && <ReactorsChip reactors={reactors} />}
            </div>
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
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  fontFamily: "var(--sc-sans)",
  fontSize: 11,
  letterSpacing: "0.06em",
  color: "var(--sc-fg-faint)",
  paddingTop: 14,
  borderTop: "1px solid var(--sc-stroke)",
};

const heartAreaStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 2,
  flexShrink: 0,
};

function heartBtnStyle(hasReacted: boolean, userSeed?: string): React.CSSProperties {
  return {
    background: "transparent",
    border: "none",
    cursor: "pointer",
    fontSize: 16,
    lineHeight: 1,
    padding: "2px 3px",
    color: hasReacted && userSeed ? colorForSeed(userSeed) : "var(--sc-fg-faint)",
    transition: "color 120ms ease",
  };
}

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

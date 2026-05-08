import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { Sky } from "../components/Sky";
import { LoadingSky } from "../components/LoadingSky";
import { ChartCard } from "../components/ChartCard";
import { MemberDots } from "../components/MemberDots";
import { ErrorScroll } from "../components/ErrorScroll";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { useCurrentGroup } from "../hooks/useCurrentGroup";
import { useChartsForGroup } from "../hooks/useChartsForGroup";
import { useUserGroups } from "../hooks/useUserGroups";
import { signOut } from "../lib/auth";
import { db } from "../db/client";

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 16,
  padding: "20px 24px",
  background: "var(--sc-surface)",
  backdropFilter: "blur(20px) saturate(160%)",
  WebkitBackdropFilter: "blur(20px) saturate(160%)",
  borderBottom: "1px solid var(--sc-stroke)",
  flexWrap: "wrap",
};

const eyebrowStyle: CSSProperties = {
  fontFamily: "var(--sc-sans)",
  fontSize: 11,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "var(--sc-fg-faint)",
};

const inviteCapsule: CSSProperties = {
  fontFamily: "var(--sc-sans)",
  fontSize: 11,
  letterSpacing: "0.08em",
  color: "var(--sc-fg-muted)",
  background: "var(--sc-surface)",
  border: "1px solid var(--sc-stroke)",
  padding: "6px 12px",
  borderRadius: 999,
  cursor: "pointer",
  transition: "color 150ms ease, border-color 150ms ease",
  userSelect: "none",
};

const signOutBtn: CSSProperties = {
  background: "transparent",
  border: "none",
  color: "var(--sc-fg-faint)",
  fontFamily: "var(--sc-sans)",
  fontSize: 11,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  cursor: "pointer",
  padding: "6px 8px",
  transition: "color 150ms ease",
};

const switcherChevronStyle: CSSProperties = {
  background: "none",
  border: "none",
  padding: "0 2px",
  color: "var(--sc-gold)",
  fontSize: 9,
  cursor: "pointer",
  lineHeight: 1,
};

const switcherDropdownStyle: CSSProperties = {
  minWidth: 220,
  background: "var(--sc-bg, #0d0a14)",
  border: "1px solid var(--sc-stroke)",
  borderRadius: 12,
  boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
};

const switcherRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "12px 16px",
  background: "none",
  border: "none",
  color: "var(--sc-fg)",
  fontFamily: "var(--sc-sans)",
  fontSize: 14,
  cursor: "pointer",
  width: "100%",
};

const switcherDividerStyle: CSSProperties = {
  height: 1,
  background: "var(--sc-stroke)",
  margin: "4px 0",
};

const switcherActionStyle: CSSProperties = {
  display: "block",
  padding: "10px 16px",
  background: "none",
  border: "none",
  color: "var(--sc-fg-muted)",
  fontFamily: "var(--sc-sans)",
  fontSize: 13,
  cursor: "pointer",
  textAlign: "left",
  width: "100%",
};

const createTileStyle: CSSProperties = {
  minHeight: 180,
  borderRadius: 18,
  border: "2px dashed var(--sc-fg-muted)",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
  cursor: "pointer",
  color: "var(--sc-fg)",
  background: "var(--sc-surface)",
  backdropFilter: "blur(10px)",
  WebkitBackdropFilter: "blur(10px)",
  transition: "border-color 200ms ease, color 200ms ease, transform 200ms ease",
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, isLoading: userLoading } = useCurrentUser();
  const { group, members, isLoading: groupLoading, setCurrentGroupId } = useCurrentGroup();
  const { charts, isLoading: chartsLoading } = useChartsForGroup(group?.id);
  const { groups: userGroups, isLoading: groupsLoading } = useUserGroups(user?.id);

  const [copied, setCopied] = useState(false);
  const [createHover, setCreateHover] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const nameInputRef = useRef<HTMLInputElement>(null);
  // Surfaced if the group-rename transact fails (perms, network).
  const [renameError, setRenameError] = useState<string | null>(null);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const switcherAnchorRef = useRef<HTMLDivElement>(null);
  const [switcherRect, setSwitcherRect] = useState<{ top: number; left: number } | null>(null);

  // Auth gate: not loading, no user → sign in.
  useEffect(() => {
    if (!userLoading && !user) {
      navigate("/sign-in", { replace: true });
    }
  }, [userLoading, user, navigate]);

  // Profile gate: signed in but no displayName yet → first-time profile setup.
  useEffect(() => {
    if (!userLoading && user && !user.displayName.trim()) {
      navigate("/profile-setup", { replace: true });
    }
  }, [userLoading, user, navigate]);

  // Group gate: signed in but no current group selected.
  // Auto-select the first available group on a fresh device; only send to
  // /group-setup when the user truly belongs to no groups.
  useEffect(() => {
    if (!userLoading && user && user.displayName.trim() && !groupLoading && !group && !groupsLoading) {
      if (userGroups.length > 0) {
        setCurrentGroupId(userGroups[0].id);
      } else {
        navigate("/group-setup", { replace: true });
      }
    }
  }, [userLoading, user, groupLoading, group, groupsLoading, userGroups, setCurrentGroupId, navigate]);

  // While redirecting or loading, render the empty sky with a soft hint
  // (delayed so a fast load is just a flash, not a flicker of text).
  if (userLoading || !user || groupLoading || !group) {
    return <LoadingSky hint="opening your sky…" />;
  }

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(group.inviteCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      // Clipboard can be denied (insecure context, permissions); silently
      // skip — the code is still visible in the capsule.
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/sign-in", { replace: true });
  };

  const startEditingName = () => {
    setNameInput(group.name);
    setEditingName(true);
    setTimeout(() => nameInputRef.current?.select(), 0);
  };

  const commitNameEdit = async () => {
    const trimmed = nameInput.trim();
    setEditingName(false);
    if (trimmed && trimmed !== group.name) {
      try {
        await db.transact(db.tx.groups[group.id].update({ name: trimmed }));
        setRenameError(null);
      } catch (err) {
        // Perms can reject this (only owner can rename per perms hardening
        // in commit 30014a8). Surface it instead of swallowing the rejection.
        const message =
          err instanceof Error && err.message
            ? err.message
            : "Couldn't rename your group — please try again.";
        setRenameError(message);
      }
    }
  };

  const cancelNameEdit = () => {
    setEditingName(false);
    setNameInput("");
  };

  return (
    <div style={{ position: "absolute", inset: 0, color: "var(--sc-fg)", overflow: "hidden" }}>
      <Sky />

      <div
        style={{
          // Overlay the content directly on the Sky background. Without
          // explicit positioning the content div was a normal-flow sibling
          // of <Sky/> (min-height: 100vh) and got pushed *below* the
          // viewport, then clipped by overflow:hidden — the page rendered
          // as a starfield with all UI offscreen.
          position: "absolute",
          inset: 0,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          zIndex: 1,
        }}
      >
        <header style={headerStyle}>
          <div ref={switcherAnchorRef} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ ...eyebrowStyle, color: "var(--sc-gold)" }}>your group</span>
              {userGroups.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    if (!switcherOpen && switcherAnchorRef.current) {
                      const r = switcherAnchorRef.current.getBoundingClientRect();
                      setSwitcherRect({ top: r.bottom + 8, left: r.left });
                    }
                    setSwitcherOpen((o) => !o);
                  }}
                  style={switcherChevronStyle}
                  aria-label="Switch group"
                >
                  {switcherOpen ? "▲" : "▼"}
                </button>
              )}
            </div>
            {editingName ? (
              <input
                ref={nameInputRef}
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onBlur={commitNameEdit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitNameEdit();
                  if (e.key === "Escape") cancelNameEdit();
                }}
                style={{
                  margin: 0,
                  fontFamily: "var(--sc-serif)",
                  fontWeight: "var(--sc-serif-weight, 500)" as CSSProperties["fontWeight"],
                  fontSize: 26,
                  lineHeight: 1.1,
                  letterSpacing: "-0.005em",
                  background: "transparent",
                  border: "none",
                  borderBottom: "2px solid var(--sc-gold)",
                  color: "var(--sc-fg)",
                  outline: "none",
                  padding: "0 2px",
                  width: `${Math.max(nameInput.length, 4)}ch`,
                  minWidth: 120,
                  maxWidth: 400,
                }}
              />
            ) : (
              <h1
                onClick={startEditingName}
                title="Click to rename"
                style={{
                  margin: 0,
                  fontFamily: "var(--sc-serif)",
                  fontWeight: "var(--sc-serif-weight, 500)" as CSSProperties["fontWeight"],
                  fontSize: 26,
                  lineHeight: 1.1,
                  letterSpacing: "-0.005em",
                  cursor: "text",
                }}
              >
                {group.name}
              </h1>
            )}

          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <MemberDots members={members} showCount />
            <button
              type="button"
              onClick={copyInvite}
              style={inviteCapsule}
              title="Click to copy invite code"
            >
              {copied ? "copied!" : `Invite: ${group.inviteCode}`}
            </button>
            <button type="button" onClick={handleSignOut} style={signOutBtn}>
              Sign out
            </button>
          </div>
        </header>

        <main
          style={{
            flex: 1,
            padding: "24px 24px 40px",
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <ErrorScroll
            show={!!renameError}
            message={renameError ?? ""}
            tone="warning"
            onDismiss={() => setRenameError(null)}
            align="left"
          />
          {!chartsLoading && charts.length === 0 ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 24,
                padding: "48px 16px",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontFamily: "var(--sc-serif)",
                  fontWeight: "var(--sc-serif-weight, 500)" as CSSProperties["fontWeight"],
                  fontSize: 24,
                  lineHeight: 1.2,
                  maxWidth: 420,
                }}
              >
                Your sky is fresh. Begin a chart.
              </div>
              <div style={{ width: "100%", maxWidth: 360 }}>
                <CreateTile
                  onClick={() => navigate("/charts/new")}
                  hover={createHover}
                  setHover={setCreateHover}
                />
              </div>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
                gap: 16,
              }}
            >
              <CreateTile
                onClick={() => navigate("/charts/new")}
                hover={createHover}
                setHover={setCreateHover}
              />
              {charts.map((chart) => (
                <ChartCard key={chart.id} chart={chart} />
              ))}
            </div>
          )}
        </main>
      </div>

      {switcherOpen && switcherRect && createPortal(
        <>
          <div
            style={{ position: "fixed", inset: 0, zIndex: 999 }}
            onClick={() => setSwitcherOpen(false)}
          />
          <div style={{ ...switcherDropdownStyle, position: "fixed", top: switcherRect.top, left: switcherRect.left, zIndex: 1000 }}>
            {userGroups.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => { setCurrentGroupId(g.id); setSwitcherOpen(false); }}
                style={{ ...switcherRowStyle, fontWeight: g.id === group.id ? 600 : 400 }}
              >
                <span style={{ flex: 1, textAlign: "left" }}>{g.name}</span>
                {g.id === group.id && <span style={{ color: "var(--sc-gold)", fontSize: 12 }}>✓</span>}
              </button>
            ))}
            <div style={switcherDividerStyle} />
            <button
              type="button"
              onClick={() => { setSwitcherOpen(false); navigate("/group-setup?tab=join"); }}
              style={switcherActionStyle}
            >
              + Join another group
            </button>
            <button
              type="button"
              onClick={() => { setSwitcherOpen(false); navigate("/group-setup?tab=create"); }}
              style={switcherActionStyle}
            >
              + Create new group
            </button>
          </div>
        </>,
        document.body,
      )}
    </div>
  );
}

interface CreateTileProps {
  onClick: () => void;
  hover: boolean;
  setHover: (v: boolean) => void;
}

function CreateTile({ onClick, hover, setHover }: CreateTileProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        ...createTileStyle,
        borderColor: hover ? "var(--sc-gold)" : "var(--sc-fg-muted)",
        color: hover ? "var(--sc-gold)" : "var(--sc-fg)",
      }}
    >
      <span style={{ fontSize: 28, color: "var(--sc-gold)" }} aria-hidden="true">✦</span>
      <span
        style={{
          fontFamily: "var(--sc-serif)",
          fontWeight: "var(--sc-serif-weight, 500)" as CSSProperties["fontWeight"],
          fontSize: 18,
        }}
      >
        Create a new chart
      </span>
    </div>
  );
}

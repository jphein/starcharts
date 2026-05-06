// Group setup — first stop after sign-in for users without a group.
//
// Two side-by-side panels: create a new group OR join one with an
// invite code. The chosen group becomes the user's "current group"
// (localStorage) and the user is linked to it via the groupMembers
// link, then we navigate to the dashboard.

import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { id } from "@instantdb/react";
import { Sky } from "../components/Sky";
import { db } from "../db/client";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { useCurrentGroup } from "../hooks/useCurrentGroup";
import {
  generateInviteCode,
  isValidInviteCode,
  normalizeInviteCode,
} from "../lib/inviteCode";
import { joinGroupByCode, JoinError } from "../lib/join";

type CreateState = { status: "idle" | "submitting" } | { status: "error"; message: string };
type JoinState = { status: "idle" | "submitting" } | { status: "error"; message: string };

export default function GroupSetup() {
  const navigate = useNavigate();
  const { user, isLoading } = useCurrentUser();
  const { setCurrentGroupId } = useCurrentGroup();

  const [groupName, setGroupName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [createState, setCreateState] = useState<CreateState>({ status: "idle" });
  const [joinState, setJoinState] = useState<JoinState>({ status: "idle" });

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (createState.status === "submitting") return;
    const trimmedName = groupName.trim();
    if (!trimmedName) {
      setCreateState({ status: "error", message: "Give your group a name." });
      return;
    }
    if (!user) {
      setCreateState({ status: "error", message: "You need to be signed in." });
      return;
    }

    setCreateState({ status: "submitting" });
    try {
      // Try once; if the unique-index check trips, retry once with a fresh code.
      // ~1-in-10^9 odds for a single conflict, so a retry is plenty.
      const tryCreate = async (): Promise<string> => {
        const newId = id();
        const code = generateInviteCode();
        await db.transact([
          db.tx.groups[newId].update({
            name: trimmedName,
            inviteCode: code,
            createdAt: Date.now(),
          }),
          db.tx.groups[newId].link({ members: user.id }),
        ]);
        return newId;
      };

      let newId: string;
      try {
        newId = await tryCreate();
      } catch {
        newId = await tryCreate();
      }
      setCurrentGroupId(newId);
      navigate("/dashboard");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Couldn't create the group.";
      setCreateState({ status: "error", message });
    }
  }

  async function handleJoin(e: FormEvent) {
    e.preventDefault();
    if (joinState.status === "submitting") return;
    const normalized = normalizeInviteCode(inviteCode);
    if (!isValidInviteCode(normalized)) {
      setJoinState({ status: "error", message: "Codes are six characters from A–Z and 2–9." });
      return;
    }
    if (!user) {
      setJoinState({ status: "error", message: "You need to be signed in." });
      return;
    }

    setJoinState({ status: "submitting" });
    try {
      // The Worker owns the entire join flow: it verifies our
      // refresh token, looks up the invite code with the admin
      // token, and links us to the group server-side via admin
      // transact. The link is no longer done from the client —
      // `groups.update` is rename-only now, so a SPA-side write
      // would be denied. Pulling the token via `db.getAuth()`
      // (rather than threading it through state) keeps it out of
      // any rendered surfaces.
      const auth = await db.getAuth();
      const refreshToken = auth?.refresh_token ?? "";
      const { groupId } = await joinGroupByCode(normalized, refreshToken);
      setCurrentGroupId(groupId);
      navigate("/dashboard");
    } catch (err) {
      const message =
        err instanceof JoinError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Couldn't join that group.";
      setJoinState({ status: "error", message });
    }
  }

  const submitting =
    createState.status === "submitting" || joinState.status === "submitting";

  return (
    <Sky>
      <main style={mainStyle}>
        <section style={panelStyle}>
          <p style={eyebrowStyle}>Starcharts</p>
          <h1 style={headlineStyle}>Find your group</h1>
          <p style={subStyle}>
            Create a new group, or join one with an invite code.
          </p>

          <div style={splitStyle}>
            <form style={subPanelStyle} onSubmit={handleCreate}>
              <h2 style={subHeadingStyle}>Create a group</h2>
              <label style={labelStyle} htmlFor="group-name">
                Group name
              </label>
              <input
                id="group-name"
                type="text"
                placeholder="The Hein Family"
                autoComplete="off"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                disabled={isLoading || createState.status === "submitting"}
                style={inputStyle}
                maxLength={60}
              />
              {createState.status === "error" && (
                <p style={errorStyle}>{createState.message}</p>
              )}
              <button
                type="submit"
                disabled={isLoading || submitting}
                style={primaryButtonStyle(submitting)}
              >
                {createState.status === "submitting" ? "Creating…" : "Create group"}
              </button>
            </form>

            <div style={dividerStyle} aria-hidden="true">
              <span style={dividerLineStyle} />
              <span style={dividerChipStyle}>or</span>
              <span style={dividerLineStyle} />
            </div>

            <form style={subPanelStyle} onSubmit={handleJoin}>
              <h2 style={subHeadingStyle}>Join a group</h2>
              <label style={labelStyle} htmlFor="invite-code">
                Invite code
              </label>
              <input
                id="invite-code"
                type="text"
                placeholder="ABC234"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                value={inviteCode}
                onChange={(e) =>
                  setInviteCode(e.target.value.toUpperCase().replace(/\s+/g, ""))
                }
                disabled={isLoading || joinState.status === "submitting"}
                maxLength={6}
                style={{ ...inputStyle, letterSpacing: "0.3em", textAlign: "center" }}
              />
              {joinState.status === "error" && (
                <p style={errorStyle}>{joinState.message}</p>
              )}
              <button
                type="submit"
                disabled={isLoading || submitting}
                style={primaryButtonStyle(submitting)}
              >
                {joinState.status === "submitting" ? "Joining…" : "Join"}
              </button>
            </form>
          </div>
        </section>
      </main>

      <style>{`
        @media (max-width: 640px) {
          .sc-group-split { grid-template-columns: 1fr !important; grid-template-rows: auto auto auto !important; }
          .sc-group-divider { flex-direction: row !important; padding: 0.4rem 0 !important; }
          .sc-group-divider-line { width: auto !important; height: 1px !important; flex: 1; }
        }
      `}</style>
    </Sky>
  );
}

const mainStyle: React.CSSProperties = {
  minHeight: "100vh",
  display: "grid",
  placeItems: "center",
  padding: "2rem 1.25rem",
};

const panelStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 520,
  background: "var(--sc-surface)",
  border: "1px solid var(--sc-stroke)",
  borderRadius: "var(--sc-radius-tile, 18px)",
  padding: "2.4rem 2rem 2rem",
  boxShadow: "var(--sc-shadow-tile, 0 12px 40px rgba(0,0,0,0.35))",
  backdropFilter: "blur(14px)",
  WebkitBackdropFilter: "blur(14px)",
  textAlign: "center",
  color: "var(--sc-fg)",
};

const eyebrowStyle: React.CSSProperties = {
  fontSize: "0.72rem",
  letterSpacing: "0.32em",
  textTransform: "uppercase",
  color: "var(--sc-gold)",
  fontWeight: 500,
  margin: 0,
  marginBottom: 14,
};

const headlineStyle: React.CSSProperties = {
  fontFamily: "var(--sc-serif)",
  fontSize: "clamp(1.9rem, 4.4vw, 2.6rem)",
  fontWeight: "var(--sc-serif-weight)" as never,
  margin: 0,
  lineHeight: 1.05,
  color: "var(--sc-fg)",
};

const subStyle: React.CSSProperties = {
  fontFamily: "var(--sc-serif)",
  fontStyle: "italic",
  color: "var(--sc-fg-muted)",
  margin: "10px 0 1.7rem",
};

const splitStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr auto 1fr",
  gap: "0.4rem",
  alignItems: "stretch",
  textAlign: "left",
};

// Marker class so the responsive style block above can find this row.
Object.assign(splitStyle, { className: "sc-group-split" });

const subPanelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.7rem",
  padding: "0.4rem 0.2rem",
};

const subHeadingStyle: React.CSSProperties = {
  fontFamily: "var(--sc-serif)",
  fontSize: "1.1rem",
  fontWeight: "var(--sc-serif-weight)" as never,
  margin: 0,
  marginBottom: 4,
  color: "var(--sc-fg)",
};

const labelStyle: React.CSSProperties = {
  fontSize: "0.7rem",
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "var(--sc-fg-muted)",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  background: "var(--sc-surface-solid)",
  border: "1px solid var(--sc-stroke)",
  borderRadius: "var(--sc-radius-inline, 10px)",
  padding: "0.7rem 0.9rem",
  color: "var(--sc-fg)",
  fontFamily: "var(--sc-sans)",
  fontSize: "1rem",
  outline: "none",
};

function primaryButtonStyle(submitting: boolean): React.CSSProperties {
  return {
    marginTop: "0.4rem",
    background: "var(--sc-gold)",
    color: "#1a1106",
    border: "none",
    borderRadius: "var(--sc-radius-pill, 999px)",
    padding: "0.7rem 1.1rem",
    fontFamily: "var(--sc-sans)",
    fontWeight: 600,
    fontSize: "0.95rem",
    letterSpacing: "0.04em",
    cursor: submitting ? "wait" : "pointer",
    opacity: submitting ? 0.75 : 1,
    transition: "opacity 120ms ease",
  };
}

const errorStyle: React.CSSProperties = {
  margin: 0,
  marginTop: "-0.2rem",
  fontFamily: "var(--sc-serif)",
  fontStyle: "italic",
  color: "var(--sc-fg-muted)",
  fontSize: "0.85rem",
};

const dividerStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "0.5rem",
  padding: "0 0.4rem",
};

Object.assign(dividerStyle, { className: "sc-group-divider" });

const dividerLineStyle: React.CSSProperties = {
  width: 1,
  flex: 1,
  background: "var(--sc-stroke)",
};

Object.assign(dividerLineStyle, { className: "sc-group-divider-line" });

const dividerChipStyle: React.CSSProperties = {
  fontFamily: "var(--sc-serif)",
  fontStyle: "italic",
  color: "var(--sc-fg-faint)",
  fontSize: "0.85rem",
  background: "var(--sc-surface-solid)",
  border: "1px solid var(--sc-stroke)",
  borderRadius: 999,
  padding: "0.15rem 0.55rem",
};

// First-time profile screen — names the avatar before the user reaches
// the dashboard. Auth-gated; if the user already has a displayName we
// bounce them to /dashboard (or /group-setup if they haven't joined
// a group yet) so this only appears once.

import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Sky } from "../components/Sky";
import { LoadingSky } from "../components/LoadingSky";
import { ErrorScroll } from "../components/ErrorScroll";
import { db } from "../db/client";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { useCurrentGroup } from "../hooks/useCurrentGroup";

const MAX_NAME_LEN = 30;

type Status = "idle" | "submitting";

export default function ProfileSetup() {
  const navigate = useNavigate();
  const { user, isLoading: userLoading } = useCurrentUser();
  const { group, isLoading: groupLoading } = useCurrentGroup();

  const [name, setName] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Auth gate.
  useEffect(() => {
    if (!userLoading && !user) {
      navigate("/sign-in", { replace: true });
    }
  }, [userLoading, user, navigate]);

  // Already onboarded — skip ahead to wherever they belong.
  useEffect(() => {
    if (userLoading || groupLoading) return;
    if (user && user.displayName.trim()) {
      navigate(group ? "/dashboard" : "/group-setup", { replace: true });
    }
  }, [userLoading, groupLoading, user, group, navigate]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (status === "submitting" || !user) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setErrorMessage("Pick a name to continue.");
      return;
    }
    setStatus("submitting");
    setErrorMessage(null);
    try {
      await db.transact(
        db.tx.$users[user.id].update({
          displayName: trimmed,
          avatarSeed: trimmed.toLowerCase(),
        }),
      );
      navigate(group ? "/dashboard" : "/group-setup", { replace: true });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Couldn't save your name — try again.";
      setErrorMessage(message);
      setStatus("idle");
    }
  }

  if (userLoading || !user) {
    return <LoadingSky hint="opening your sky…" />;
  }

  const submitting = status === "submitting";

  return (
    <Sky>
      <main style={mainStyle}>
        <section style={panelStyle}>
          <p style={eyebrowStyle}>Starcharts</p>
          <h1 style={headlineStyle}>What should we call you?</h1>
          <p style={subStyle}>This is how others in your group see you.</p>

          <form style={formStyle} onSubmit={handleSubmit} noValidate>
            <label style={labelStyle} htmlFor="profile-name">
              Display name
            </label>
            <input
              id="profile-name"
              type="text"
              autoComplete="name"
              autoCapitalize="words"
              autoCorrect="off"
              spellCheck={false}
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={submitting}
              maxLength={MAX_NAME_LEN}
              placeholder="Your name"
              style={inputStyle}
            />
            <ErrorScroll
              show={!!errorMessage}
              message={errorMessage ?? ""}
              tone="warning"
              style={{ marginTop: 4 }}
            />
            <button
              type="submit"
              disabled={submitting}
              style={primaryButtonStyle(submitting)}
            >
              {submitting ? "Saving…" : "Continue"}
            </button>
          </form>
        </section>
      </main>
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
  maxWidth: 400,
  background: "var(--sc-surface)",
  border: "1px solid var(--sc-stroke)",
  borderRadius: "var(--sc-radius-tile, 18px)",
  padding: "2.6rem 2rem 2.2rem",
  boxShadow: "var(--sc-shadow-tile, 0 12px 40px rgba(0,0,0,0.35))",
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
  textAlign: "center",
  color: "var(--sc-fg)",
};

const eyebrowStyle: React.CSSProperties = {
  fontSize: "0.72rem",
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "var(--sc-gold)",
  fontWeight: 500,
  margin: 0,
  marginBottom: 14,
};

const headlineStyle: React.CSSProperties = {
  fontFamily: "var(--sc-serif)",
  fontSize: "clamp(1.75rem, 4.5vw, 2.4rem)",
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
  fontSize: "0.95rem",
};

const formStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.7rem",
  textAlign: "left",
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
  background: "transparent",
  border: "1px solid var(--sc-stroke)",
  borderRadius: "var(--sc-radius-inline, 8px)",
  padding: "12px 14px",
  color: "var(--sc-fg)",
  fontFamily: "var(--sc-sans)",
  fontSize: "1rem",
  outline: "none",
};

function primaryButtonStyle(submitting: boolean): React.CSSProperties {
  return {
    marginTop: "0.4rem",
    background: "var(--sc-gold)",
    color: "#0d1130",
    border: "none",
    borderRadius: "var(--sc-radius-pill, 999px)",
    padding: "12px 24px",
    fontFamily: "var(--sc-serif)",
    fontWeight: 500,
    fontSize: "1rem",
    letterSpacing: "0.04em",
    cursor: submitting ? "wait" : "pointer",
    opacity: submitting ? 0.65 : 1,
    transition: "opacity 120ms ease",
  };
}

// Per-screen errorStyle removed — see app/src/components/ErrorScroll.tsx.

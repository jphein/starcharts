// Create a chart — name, goal stars, and reward.
//
// After successful creation we navigate straight to the new chart's
// hero route. Chart fields are immutable per the v1 spec, so this is
// the only entry point for the trio of values.

import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { id } from "@instantdb/react";
import { Sky } from "../components/Sky";
import { LoadingSky } from "../components/LoadingSky";
import { db } from "../db/client";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { generateInviteCode } from "../lib/inviteCode";

type SubmitState =
  | { status: "idle" | "submitting" }
  | { status: "error"; message: string };

export default function CreateChart() {
  const navigate = useNavigate();
  const { user, isLoading: userLoading } = useCurrentUser();

  const [name, setName] = useState("");
  const [goal, setGoal] = useState("50");
  const [reward, setReward] = useState("");
  const [submitState, setSubmitState] = useState<SubmitState>({ status: "idle" });

  // Auth gate: not loading, no user → sign in.
  useEffect(() => {
    if (!userLoading && !user) {
      navigate("/sign-in", { replace: true });
    }
  }, [userLoading, user, navigate]);

  if (userLoading || !user) {
    return <LoadingSky />;
  }

  const trimmedName = name.trim();
  const trimmedReward = reward.trim();
  const parsedGoal = Number.parseInt(goal, 10);
  const goalValid = Number.isFinite(parsedGoal) && parsedGoal >= 1;
  const formValid = trimmedName.length > 0 && trimmedReward.length > 0 && goalValid;
  const submitting = submitState.status === "submitting";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    if (!formValid) {
      setSubmitState({ status: "error", message: "Fill in every field to begin." });
      return;
    }

    setSubmitState({ status: "submitting" });
    try {
      const newId = id();
      const inviteCode = generateInviteCode();
      await db.transact(
        db.tx.charts[newId]
          .update({
            name: trimmedName,
            goalCount: parsedGoal,
            reward: trimmedReward,
            inviteCode,
            ownerId: user.id,
            createdAt: Date.now(),
          })
          .link({ members: user.id }),
      );
      navigate(`/charts/${newId}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Couldn't open the sky.";
      setSubmitState({ status: "error", message });
    }
  }

  return (
    <Sky>
      <main style={mainStyle}>
        <section style={panelStyle}>
          <p style={eyebrowStyle}>Starcharts</p>
          <h1 style={headlineStyle}>Begin a new sky.</h1>
          <p style={subStyle}>
            Three things — a name, a goal, and the reward you'll celebrate.
          </p>

          <form style={formStyle} onSubmit={handleSubmit}>
            <div style={fieldStyle}>
              <label style={labelStyle} htmlFor="chart-name">
                Chart name
              </label>
              <input
                id="chart-name"
                type="text"
                placeholder="Summer of kindness"
                autoComplete="off"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={submitting}
                style={inputStyle}
                maxLength={80}
                required
              />
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle} htmlFor="chart-goal">
                Goal stars
              </label>
              <input
                id="chart-goal"
                type="number"
                inputMode="numeric"
                min={1}
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                disabled={submitting}
                style={{ ...inputStyle, fontFamily: "var(--sc-serif)" }}
                required
              />
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle} htmlFor="chart-reward">
                Reward
              </label>
              <textarea
                id="chart-reward"
                placeholder="A weekend in the woods"
                autoComplete="off"
                rows={2}
                value={reward}
                onChange={(e) => setReward(e.target.value)}
                disabled={submitting}
                style={{
                  ...inputStyle,
                  resize: "vertical",
                  minHeight: "3.4rem",
                  fontFamily: "var(--sc-serif)",
                  fontStyle: "italic",
                }}
                maxLength={240}
                required
              />
            </div>

            {submitState.status === "error" && (
              <p style={errorStyle}>{submitState.message}</p>
            )}

            <button
              type="submit"
              disabled={!formValid || submitting}
              style={primaryButtonStyle(submitting, !formValid)}
            >
              {submitting ? "Opening…" : "Begin"}
            </button>
          </form>

          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            disabled={submitting}
            style={backLinkStyle}
          >
            back to dashboard
          </button>
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
  maxWidth: 480,
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
  fontFamily: "var(--sc-sans)",
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
  fontFamily: "var(--sc-sans)",
  color: "var(--sc-fg-muted)",
  margin: "10px 0 1.7rem",
  fontSize: "0.95rem",
  lineHeight: 1.5,
};

const formStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "1rem",
  textAlign: "left",
};

const fieldStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.45rem",
};

const labelStyle: React.CSSProperties = {
  fontFamily: "var(--sc-sans)",
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

function primaryButtonStyle(submitting: boolean, disabled: boolean): React.CSSProperties {
  return {
    marginTop: "0.6rem",
    background: "var(--sc-gold)",
    color: "#1a1106",
    border: "none",
    borderRadius: "var(--sc-radius-pill, 999px)",
    padding: "0.8rem 1.2rem",
    fontFamily: "var(--sc-sans)",
    fontWeight: 600,
    fontSize: "0.95rem",
    letterSpacing: "0.04em",
    cursor: submitting ? "wait" : disabled ? "not-allowed" : "pointer",
    opacity: disabled || submitting ? 0.55 : 1,
    transition: "opacity 120ms ease",
  };
}

const backLinkStyle: React.CSSProperties = {
  marginTop: "1.2rem",
  background: "transparent",
  border: "none",
  color: "var(--sc-fg-faint)",
  fontFamily: "var(--sc-sans)",
  fontSize: "0.78rem",
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  cursor: "pointer",
  padding: "0.3rem 0.5rem",
};

const errorStyle: React.CSSProperties = {
  margin: 0,
  fontFamily: "var(--sc-serif)",
  fontStyle: "italic",
  color: "var(--sc-fg-muted)",
  fontSize: "0.85rem",
};

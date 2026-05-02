// Sign-in screen — two-step magic-link flow (email → 6-digit code).
//
// Step 1 sends the magic code via Aurora's `requestMagicCode`. Step 2
// verifies it via `signInWithCode`. Once auth lands, the user is routed
// to /group-setup (no group yet) or /dashboard (already in a group).

import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Sky } from "../components/Sky";
import { requestMagicCode, signInWithCode } from "../lib/auth";
import { useCurrentGroup } from "../hooks/useCurrentGroup";

type Step = "email" | "code";
type Status = "idle" | "submitting";

export default function SignIn() {
  const navigate = useNavigate();
  const { group } = useCurrentGroup();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleEmailSubmit(e: FormEvent) {
    e.preventDefault();
    if (status === "submitting") return;
    const trimmed = email.trim();
    if (!trimmed) {
      setErrorMessage("Enter your email to continue.");
      return;
    }
    setStatus("submitting");
    setErrorMessage(null);
    try {
      await requestMagicCode(trimmed);
      setEmail(trimmed);
      setStep("code");
      setCode("");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Couldn't send a code right now.";
      setErrorMessage(message);
    } finally {
      setStatus("idle");
    }
  }

  async function handleCodeSubmit(e: FormEvent) {
    e.preventDefault();
    if (status === "submitting") return;
    const trimmed = code.trim();
    if (!trimmed) {
      setErrorMessage("Enter the code we just sent.");
      return;
    }
    setStatus("submitting");
    setErrorMessage(null);
    try {
      await signInWithCode(email, trimmed);
      navigate(group ? "/dashboard" : "/group-setup", { replace: true });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "That code didn't work — try again.";
      setErrorMessage(message);
      setStatus("idle");
    }
  }

  function backToEmail() {
    if (status === "submitting") return;
    setStep("email");
    setCode("");
    setErrorMessage(null);
  }

  const submitting = status === "submitting";

  return (
    <Sky>
      <main style={mainStyle}>
        <section style={panelStyle}>
          <p style={eyebrowStyle}>starcharts</p>
          <h1 style={headlineStyle}>
            {step === "email" ? "Welcome to your sky." : "Check your email."}
          </h1>
          <p style={subStyle}>
            {step === "email"
              ? "Sign in with the email you'll use with your group."
              : `We sent a code to ${email}.`}
          </p>

          {step === "email" ? (
            <form style={formStyle} onSubmit={handleEmailSubmit} noValidate>
              <label style={labelStyle} htmlFor="signin-email">
                Email
              </label>
              <input
                id="signin-email"
                type="email"
                autoComplete="email"
                inputMode="email"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={submitting}
                placeholder="you@somewhere.sky"
                style={inputStyle}
              />
              {errorMessage && <p style={errorStyle}>{errorMessage}</p>}
              <button
                type="submit"
                disabled={submitting}
                style={primaryButtonStyle(submitting)}
              >
                {submitting ? "Sending…" : "Continue"}
              </button>
            </form>
          ) : (
            <form style={formStyle} onSubmit={handleCodeSubmit} noValidate>
              <label style={labelStyle} htmlFor="signin-code">
                Code
              </label>
              <input
                id="signin-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoCorrect="off"
                spellCheck={false}
                required
                autoFocus
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.replace(/\s+/g, ""))
                }
                disabled={submitting}
                placeholder="••••••"
                maxLength={12}
                style={{
                  ...inputStyle,
                  letterSpacing: "0.4em",
                  textAlign: "center",
                  fontSize: "1.1rem",
                }}
              />
              {errorMessage && <p style={errorStyle}>{errorMessage}</p>}
              <button
                type="submit"
                disabled={submitting}
                style={primaryButtonStyle(submitting)}
              >
                {submitting ? "Signing in…" : "Sign in"}
              </button>
              <button
                type="button"
                onClick={backToEmail}
                disabled={submitting}
                style={linkButtonStyle}
              >
                Use a different email
              </button>
            </form>
          )}
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
  fontSize: "clamp(2rem, 5vw, 2.75rem)",
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

const linkButtonStyle: React.CSSProperties = {
  marginTop: "0.2rem",
  background: "transparent",
  border: "none",
  color: "var(--sc-fg-muted)",
  fontFamily: "var(--sc-serif)",
  fontStyle: "italic",
  fontSize: "0.85rem",
  cursor: "pointer",
  padding: "0.3rem",
  textAlign: "center",
};

const errorStyle: React.CSSProperties = {
  margin: 0,
  marginTop: "-0.2rem",
  fontFamily: "var(--sc-serif)",
  fontStyle: "italic",
  color: "var(--sc-fg-muted)",
  fontSize: "0.85rem",
};

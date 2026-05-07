// Sign-in screen — two-step magic-link flow (email → 6-digit code).
//
// Step 1 sends the magic code via Aurora's `requestMagicCode`. Step 2
// verifies it via `signInWithCode`. Once auth lands, we always navigate
// to /dashboard and let its gates route onward to /profile-setup or
// /group-setup as needed — checking `useCurrentGroup` here loses the
// race because InstantDB persists the session in IndexedDB but our
// localStorage groupId is set later.
//
// If the user is already signed in (IndexedDB session survives reload),
// we skip the form entirely and bounce to /dashboard.

import {
  useEffect,
  useState,
  type ClipboardEvent,
  type FormEvent,
} from "react";
import { useNavigate } from "react-router-dom";
import { Sky } from "../components/Sky";
import { LoadingSky } from "../components/LoadingSky";
import { ErrorScroll } from "../components/ErrorScroll";
import { requestMagicCode, signInWithCode } from "../lib/auth";
import { useCurrentUser } from "../hooks/useCurrentUser";

type Step = "email" | "code";
type Status = "idle" | "submitting";

const CODE_LENGTH = 6;

// Strip everything that isn't a digit, then cap to the code length.
// Handles people pasting "  4 3 5 - 0 4 5 " out of the email.
function normalizeCode(raw: string): string {
  return raw.replace(/\D+/g, "").slice(0, CODE_LENGTH);
}

export default function SignIn() {
  const navigate = useNavigate();
  const { user, isLoading: userLoading } = useCurrentUser();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Already authenticated? Bypass the form. Dashboard's gates handle the
  // rest of the routing (profile setup, group setup, or main view).
  useEffect(() => {
    if (userLoading || status === "submitting") return;
    if (user) navigate("/dashboard", { replace: true });
  }, [userLoading, user, status, navigate]);

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

  async function submitCode(value: string) {
    if (status === "submitting") return;
    if (value.length !== CODE_LENGTH) {
      setErrorMessage(`Codes are ${CODE_LENGTH} digits — paste or type the one we sent.`);
      return;
    }
    setStatus("submitting");
    setErrorMessage(null);
    try {
      await signInWithCode(email, value);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "That code didn't work — try again.";
      setErrorMessage(
        message.toLowerCase().includes("expire")
          ? "That code expired. Send a fresh one."
          : message,
      );
      setStatus("idle");
    }
  }

  function handleCodeSubmit(e: FormEvent) {
    e.preventDefault();
    void submitCode(code);
  }

  // Paste support: people grab "  4 3 5 0 4 5 " out of the email; we
  // strip everything non-digit and then auto-submit if the result is
  // a clean 6-digit code. Without this, the user has to also press
  // Sign in after pasting, which feels clunky.
  function handleCodePaste(e: ClipboardEvent<HTMLInputElement>) {
    const pasted = normalizeCode(e.clipboardData.getData("text"));
    if (pasted.length === 0) return;
    e.preventDefault();
    setCode(pasted);
    setErrorMessage(null);
    if (pasted.length === CODE_LENGTH) {
      void submitCode(pasted);
    }
  }

  // Typed input (one digit at a time): trigger the same auto-submit
  // when the user reaches the full length, so they don't need to also
  // hit the button.
  function handleCodeChange(value: string) {
    const cleaned = normalizeCode(value);
    setCode(cleaned);
    if (cleaned.length === CODE_LENGTH && status === "idle") {
      void submitCode(cleaned);
    }
  }

  function backToEmail() {
    if (status === "submitting") return;
    setStep("email");
    setCode("");
    setErrorMessage(null);
  }

  const submitting = status === "submitting";

  // While auth resolves on cold load — or while the bounce-to-dashboard
  // effect above is mid-flight — show the loading sky instead of flashing
  // the form to a user who's already signed in.
  if (userLoading || (user && !submitting)) {
    return <LoadingSky hint="opening your sky…" />;
  }

  return (
    <Sky>
      <main style={mainStyle}>
        <section style={panelStyle}>
          <p style={eyebrowStyle}>Starcharts</p>
          <h1 style={headlineStyle}>
            {step === "email" ? "Welcome to your sky." : "Check your email."}
          </h1>
          <p style={subStyle}>
            {step === "email"
              ? "Sign in with the email you'll use with your group."
              : (
                <>
                  We sent a 6-digit code to <strong style={emphasisStyle}>{email}</strong>.
                  <br />
                  It expires in a few minutes — paste it here.
                </>
              )}
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
                pattern="[0-9]*"
                autoComplete="one-time-code"
                autoCorrect="off"
                spellCheck={false}
                required
                autoFocus
                value={code}
                onChange={(e) => handleCodeChange(e.target.value)}
                onPaste={handleCodePaste}
                disabled={submitting}
                placeholder="••••••"
                maxLength={CODE_LENGTH}
                style={{
                  ...inputStyle,
                  letterSpacing: "0.5em",
                  textAlign: "center",
                  fontSize: "1.4rem",
                  fontVariantNumeric: "tabular-nums",
                }}
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

const emphasisStyle: React.CSSProperties = {
  fontStyle: "normal",
  color: "var(--sc-fg)",
  fontWeight: 500,
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

// Per-screen errorStyle removed — see app/src/components/ErrorScroll.tsx.

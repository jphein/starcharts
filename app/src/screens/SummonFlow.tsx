// Custom-star summoning flow — /charts/:id/summon.
//
// User types a one-line prompt (e.g. "a star made of fireflies and starlight"),
// hits Summon, watches the stars align (a placeholder image scale-pulses while
// the Cloudflare Worker proxies a gpt-image-1.5 request), then either keeps
// the result and continues into GiftFlow with `{url, prompt}` stashed in
// sessionStorage, re-summons the same prompt, or starts over with a new one.
//
// Auth/group/chart gates mirror GiftFlow exactly. The chart gate also bounces
// completed charts to /memory since you can't gift into a sealed sky.

import { useEffect, useState, type CSSProperties } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { Sky } from "../components/Sky";
import { LoadingSky } from "../components/LoadingSky";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { useCurrentGroup } from "../hooks/useCurrentGroup";
import { useChart } from "../hooks/useChart";
import { summonStar, RateLimitError } from "../lib/summon";

type Phase = "input" | "forming" | "preview" | "error" | "rate-limited";

interface RateLimitState {
  scope: "group" | "ip";
  retryAfterSeconds: number;
  message: string;
}

// Round retry-after into a humane "in about 27 minutes" / "tomorrow"
// rather than a clinical countdown.
function describeWait(seconds: number): string {
  if (seconds < 60) return "in less than a minute";
  if (seconds < 3600) {
    const m = Math.round(seconds / 60);
    return m === 1 ? "in about a minute" : `in about ${m} minutes`;
  }
  if (seconds < 7200) return "in about an hour";
  if (seconds < 86_400) {
    const h = Math.round(seconds / 3600);
    return `in about ${h} hours`;
  }
  return "tomorrow";
}

const PROMPT_MAX = 200;

export function summonStashKey(chartId: string): string {
  return `sc_summon_${chartId}`;
}

export default function SummonFlow() {
  const { id: chartId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion();

  const { user, isLoading: userLoading } = useCurrentUser();
  const { group, isLoading: groupLoading } = useCurrentGroup();
  const { chart, isLoading: chartLoading } = useChart(chartId);

  const [phase, setPhase] = useState<Phase>("input");
  const [prompt, setPrompt] = useState("");
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [rateLimit, setRateLimit] = useState<RateLimitState | null>(null);

  // Auth gate.
  useEffect(() => {
    if (!userLoading && !user) {
      navigate("/sign-in", { replace: true });
    }
  }, [userLoading, user, navigate]);

  // Group gate.
  useEffect(() => {
    if (!userLoading && user && !groupLoading && !group) {
      navigate("/group-setup", { replace: true });
    }
  }, [userLoading, user, groupLoading, group, navigate]);

  // Missing chart → dashboard.
  useEffect(() => {
    if (!chartLoading && chartId && !chart) {
      navigate("/dashboard", { replace: true });
    }
  }, [chartLoading, chartId, chart, navigate]);

  // Completed chart is read-only — bounce to memory.
  useEffect(() => {
    if (chart?.completedAt && chartId) {
      navigate(`/charts/${chartId}/memory`, { replace: true });
    }
  }, [chart, chartId, navigate]);

  if (
    userLoading ||
    !user ||
    groupLoading ||
    !group ||
    chartLoading ||
    !chart
  ) {
    return <LoadingSky />;
  }

  const trimmedPrompt = prompt.trim();

  async function runSummon(p: string) {
    if (!group) return; // gate above guarantees this, but TS narrowing wants it
    setPhase("forming");
    setErrorMessage(null);
    setRateLimit(null);
    try {
      const { url } = await summonStar({ prompt: p, groupId: group.id });
      setResultUrl(url);
      setPhase("preview");
    } catch (err) {
      if (err instanceof RateLimitError) {
        setRateLimit({
          scope: err.scope,
          retryAfterSeconds: err.retryAfterSeconds,
          message: err.message,
        });
        setPhase("rate-limited");
        return;
      }
      const message = err instanceof Error ? err.message : "Unknown error.";
      setErrorMessage(message);
      setPhase("error");
    }
  }

  function handleSummon() {
    if (!trimmedPrompt) return;
    void runSummon(trimmedPrompt);
  }

  function handleResummon() {
    if (!trimmedPrompt) return;
    void runSummon(trimmedPrompt);
  }

  function handleKeep() {
    if (!resultUrl || !chartId) return;
    try {
      window.sessionStorage.setItem(
        summonStashKey(chartId),
        JSON.stringify({ url: resultUrl, prompt: trimmedPrompt }),
      );
    } catch {
      // sessionStorage may be unavailable in private browsing — fall through.
    }
    navigate(`/charts/${chartId}/give`);
  }

  function handleDifferentPrompt() {
    setPrompt("");
    setResultUrl(null);
    setErrorMessage(null);
    setPhase("input");
  }

  function handleTryAgain() {
    setErrorMessage(null);
    setPhase("input");
  }

  return (
    <Sky>
      <main style={mainStyle}>
        <section style={panelStyle}>
          <p style={eyebrowStyle}>Starcharts</p>
          <h1 style={headlineStyle}>Summon a custom star.</h1>
          <p style={subStyle}>
            One-of-a-kind. Describe it in a few words and let it form.
          </p>

          {phase === "input" && (
            <div style={fieldStyle}>
              <input
                type="text"
                autoFocus
                maxLength={PROMPT_MAX}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="a star made of fireflies and starlight"
                style={inputStyle}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && trimmedPrompt) {
                    e.preventDefault();
                    handleSummon();
                  }
                }}
              />
              <p style={counterStyle}>
                {prompt.length}/{PROMPT_MAX}
              </p>

              <button
                type="button"
                onClick={handleSummon}
                disabled={!trimmedPrompt}
                style={primaryButtonStyle(false, !trimmedPrompt)}
              >
                Summon
              </button>

              <button
                type="button"
                onClick={() =>
                  navigate(`/charts/${chartId}/give`)
                }
                style={backLinkStyle}
              >
                back
              </button>
            </div>
          )}

          {phase === "forming" && (
            <div style={formingWrapStyle}>
              <p style={promptEchoStyle}>“{trimmedPrompt}”</p>
              <motion.div
                style={placeholderStarStyle}
                animate={
                  prefersReducedMotion
                    ? undefined
                    : {
                        scale: [0.9, 1.1, 0.9],
                        rotate: [0, 8, -8, 0],
                      }
                }
                transition={
                  prefersReducedMotion
                    ? undefined
                    : {
                        duration: 3,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }
                }
                aria-hidden="true"
              />
              <p style={formingCopyStyle}>the stars are aligning…</p>
            </div>
          )}

          {phase === "preview" && resultUrl && (
            <div style={previewWrapStyle}>
              <img
                src={resultUrl}
                alt="A summoned star"
                draggable={false}
                style={previewImgStyle}
              />
              <p style={promptEchoStyle}>“{trimmedPrompt}”</p>

              <button
                type="button"
                onClick={handleKeep}
                style={primaryButtonStyle(false, false)}
              >
                Keep this star
              </button>
              <button
                type="button"
                onClick={handleResummon}
                style={ghostButtonStyle}
              >
                Re-summon
              </button>
              <button
                type="button"
                onClick={handleDifferentPrompt}
                style={backLinkStyle}
              >
                different prompt
              </button>
            </div>
          )}

          {phase === "error" && (
            <div style={errorWrapStyle}>
              <p style={errorHeadlineStyle}>
                the stars didn't align — try again
              </p>
              {errorMessage && (
                <p style={errorDetailStyle}>{errorMessage}</p>
              )}
              <button
                type="button"
                onClick={handleTryAgain}
                style={primaryButtonStyle(false, false)}
              >
                Try again
              </button>
            </div>
          )}

          {phase === "rate-limited" && rateLimit && (
            <div style={errorWrapStyle}>
              <p style={errorHeadlineStyle}>
                {rateLimit.scope === "group"
                  ? "your sky is full for today"
                  : "easy on the summons"}
              </p>
              <p style={errorDetailStyle}>
                {rateLimit.scope === "group"
                  ? `the group has reached today's custom-star limit. more space ${describeWait(rateLimit.retryAfterSeconds)}.`
                  : `try again ${describeWait(rateLimit.retryAfterSeconds)}.`}
              </p>
              <button
                type="button"
                onClick={() =>
                  navigate(`/charts/${chartId}/give`)
                }
                style={primaryButtonStyle(false, false)}
              >
                Pick a preset instead
              </button>
              <button
                type="button"
                onClick={handleDifferentPrompt}
                style={backLinkStyle}
              >
                back
              </button>
            </div>
          )}
        </section>
      </main>
    </Sky>
  );
}

const mainStyle: CSSProperties = {
  minHeight: "100vh",
  display: "grid",
  placeItems: "center",
  padding: "2rem 1.25rem",
};

const panelStyle: CSSProperties = {
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

const eyebrowStyle: CSSProperties = {
  fontFamily: "var(--sc-sans)",
  fontSize: "0.72rem",
  letterSpacing: "0.32em",
  textTransform: "uppercase",
  color: "var(--sc-gold)",
  fontWeight: 500,
  margin: 0,
  marginBottom: 14,
};

const headlineStyle: CSSProperties = {
  fontFamily: "var(--sc-serif)",
  fontSize: "clamp(1.9rem, 4.4vw, 2.6rem)",
  fontWeight: 500,
  margin: 0,
  lineHeight: 1.05,
  color: "var(--sc-fg)",
};

const subStyle: CSSProperties = {
  fontFamily: "var(--sc-serif)",
  fontStyle: "italic",
  color: "var(--sc-fg-muted)",
  margin: "10px 0 1.7rem",
  fontSize: "0.95rem",
  lineHeight: 1.5,
};

const fieldStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
  textAlign: "left",
};

const inputStyle: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  background: "var(--sc-surface-solid)",
  border: "1px solid var(--sc-stroke)",
  borderRadius: "var(--sc-radius-inline, 12px)",
  padding: "1rem 1.1rem",
  color: "var(--sc-fg)",
  fontFamily: "var(--sc-serif)",
  fontStyle: "italic",
  fontSize: "1.05rem",
  lineHeight: 1.45,
  outline: "none",
};

const counterStyle: CSSProperties = {
  margin: 0,
  alignSelf: "flex-end",
  fontFamily: "var(--sc-sans)",
  fontSize: 11,
  letterSpacing: "0.1em",
  color: "var(--sc-fg-faint)",
};

function primaryButtonStyle(
  submitting: boolean,
  disabled: boolean,
): CSSProperties {
  return {
    marginTop: "0.6rem",
    background: "var(--sc-gold)",
    color: "#1a1106",
    border: "none",
    borderRadius: "var(--sc-radius-pill, 999px)",
    padding: "0.85rem 1.4rem",
    fontFamily: "var(--sc-sans)",
    fontWeight: 600,
    fontSize: "0.95rem",
    letterSpacing: "0.04em",
    cursor: submitting ? "wait" : disabled ? "not-allowed" : "pointer",
    opacity: disabled || submitting ? 0.55 : 1,
    transition: "opacity 120ms ease",
  };
}

const ghostButtonStyle: CSSProperties = {
  marginTop: "0.4rem",
  background: "transparent",
  color: "var(--sc-fg)",
  border: "1px solid var(--sc-stroke)",
  borderRadius: "var(--sc-radius-pill, 999px)",
  padding: "0.7rem 1.2rem",
  fontFamily: "var(--sc-sans)",
  fontSize: "0.85rem",
  letterSpacing: "0.06em",
  cursor: "pointer",
  transition: "background 120ms ease",
};

const backLinkStyle: CSSProperties = {
  marginTop: "0.8rem",
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

const formingWrapStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 24,
  padding: "1rem 0 0.5rem",
};

const promptEchoStyle: CSSProperties = {
  margin: 0,
  fontFamily: "var(--sc-serif)",
  fontStyle: "italic",
  color: "var(--sc-fg-muted)",
  fontSize: "1rem",
  lineHeight: 1.45,
  maxWidth: 360,
  textAlign: "center",
};

const placeholderStarStyle: CSSProperties = {
  width: 120,
  height: 120,
  borderRadius: "50%",
  background:
    "radial-gradient(circle at 50% 45%, rgba(255,250,220,0.95), rgba(255,210,140,0.7) 35%, rgba(245,196,107,0.35) 65%, rgba(245,196,107,0) 80%)",
  boxShadow:
    "0 0 60px rgba(255,220,150,0.55), 0 0 24px rgba(255,255,255,0.45)",
};

const formingCopyStyle: CSSProperties = {
  margin: 0,
  fontFamily: "var(--sc-serif)",
  fontStyle: "italic",
  fontSize: "1rem",
  color: "var(--sc-fg-muted)",
};

const previewWrapStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 12,
};

const previewImgStyle: CSSProperties = {
  width: 120,
  height: 120,
  objectFit: "contain",
  filter: "drop-shadow(0 0 24px rgba(255,235,180,0.55))",
  pointerEvents: "none",
  userSelect: "none",
};

const errorWrapStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "stretch",
  gap: 10,
  textAlign: "center",
};

const errorHeadlineStyle: CSSProperties = {
  margin: 0,
  fontFamily: "var(--sc-serif)",
  fontStyle: "italic",
  fontSize: "1.05rem",
  color: "var(--sc-fg)",
};

const errorDetailStyle: CSSProperties = {
  margin: 0,
  fontFamily: "var(--sc-sans)",
  fontSize: "0.78rem",
  color: "var(--sc-fg-faint)",
  letterSpacing: "0.04em",
};

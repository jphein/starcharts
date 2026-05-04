// Four-step gift flow — pick honoree(s), write the reason, choose the
// star preset + count, confirm, send. On submit we compute a Poisson-disc
// anchor for the new gift and write a single `gifts` row linked to the
// chart, the giver, and every honoree. If this gift makes the running
// total cross the chart's goal we ALSO stamp `chart.completedAt` in the
// same transact and route to the celebrate scene; otherwise back to the
// chart sky. Per the M3 v1 spec one gift = one row with `count: N`, the
// per-star positions are computed deterministically at render time.
//
// This screen is the only entry point that creates gifts; other places
// (e.g. ChartSky's + button) just navigate here.

import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import { id } from "@instantdb/react";
import { Sky } from "../components/Sky";
import { LoadingSky } from "../components/LoadingSky";
import { PresetGallery } from "../components/PresetGallery";
import { db } from "../db/client";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { useCurrentGroup } from "../hooks/useCurrentGroup";
import { useChart } from "../hooks/useChart";
import { useGiftsForChart } from "../hooks/useGiftsForChart";
import { pickGiftAnchor } from "../lib/starPositioning";
import { presetUrl } from "../lib/presets";
import { summonStashKey } from "./SummonFlow";
import type { User } from "../types";

type Step = "honorees" | "reason" | "preset" | "confirm";

const CUSTOM_STYLE = "custom";

// sessionStorage key for the in-flight gift draft (honorees,
// reason, count). Stashed when the user navigates to /summon so
// that we can restore their work when they come back — the
// summon route unmounts GiftFlow and React state is lost otherwise.
function giftDraftKey(chartId: string): string {
  return `sc_gift_draft_${chartId}`;
}

type SubmitState =
  | { status: "idle" | "submitting" }
  | { status: "error"; message: string };

const COUNT_OPTIONS = [1, 2, 3, 5] as const;
const REASON_MAX = 240;

// Deterministic-ish hash for the cluster preview so the same gift draft
// produces the same arrangement during a single mount.
function hashSeed(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function avatarColor(seed: string): string {
  const h = hashSeed(seed || "anon");
  const hue = h % 360;
  const sat = 55 + ((h >>> 8) % 20);
  const light = 70 + ((h >>> 16) % 10);
  return `hsl(${hue} ${sat}% ${light}%)`;
}

export default function GiftFlow() {
  const { id: chartId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { user, isLoading: userLoading } = useCurrentUser();
  const { group, members, isLoading: groupLoading } = useCurrentGroup();
  const { chart, isLoading: chartLoading } = useChart(chartId);
  const { gifts: existingGifts, isLoading: giftsLoading } =
    useGiftsForChart(chartId);

  const [step, setStep] = useState<Step>("honorees");
  const [honoreeIds, setHonoreeIds] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [style, setStyle] = useState<string | null>(null);
  const [customImageUrl, setCustomImageUrl] = useState<string | null>(null);
  const [count, setCount] = useState<number>(1);
  const [submitState, setSubmitState] = useState<SubmitState>({
    status: "idle",
  });

  // Hydrate the in-flight gift draft + any summoned custom star if
  // we came back from /summon. Without this, the user's honoree
  // pick + reason text would be lost during the summon detour
  // because React Router unmounts GiftFlow when navigating away.
  // Both stashes are consumed so a hard refresh later doesn't
  // re-apply them.
  useEffect(() => {
    if (!chartId) return;

    // 1. Restore the gift draft (honorees, reason, count) we
    //    stashed when the user pressed Summon.
    let draftRaw: string | null = null;
    try {
      draftRaw = window.sessionStorage.getItem(giftDraftKey(chartId));
    } catch {
      // sessionStorage may be unavailable; fall through without
      // restoring — user can re-enter their picks.
    }
    if (draftRaw) {
      try {
        const draft = JSON.parse(draftRaw) as {
          honoreeIds?: string[];
          reason?: string;
          count?: number;
        };
        if (Array.isArray(draft.honoreeIds)) {
          setHonoreeIds(draft.honoreeIds.filter((s) => typeof s === "string"));
        }
        if (typeof draft.reason === "string") setReason(draft.reason);
        if (typeof draft.count === "number" && draft.count >= 1) {
          setCount(draft.count);
        }
      } catch {
        // Malformed — ignore.
      }
      try {
        window.sessionStorage.removeItem(giftDraftKey(chartId));
      } catch {
        // best-effort.
      }
    }

    // 2. Restore the summon result and jump to the preset step
    //    where the user left off.
    let summonRaw: string | null = null;
    try {
      summonRaw = window.sessionStorage.getItem(summonStashKey(chartId));
    } catch {
      return;
    }
    if (!summonRaw) return;
    try {
      const parsed = JSON.parse(summonRaw) as { url?: string };
      if (parsed?.url) {
        setStyle(CUSTOM_STYLE);
        setCustomImageUrl(parsed.url);
        setStep("preset");
      }
    } catch {
      // Malformed — ignore.
    }
    try {
      window.sessionStorage.removeItem(summonStashKey(chartId));
    } catch {
      // best-effort.
    }
  }, [chartId]);

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

  // Missing chart → back to dashboard.
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

  const otherMembers: User[] = useMemo(() => {
    if (!user) return [];
    return members.filter((m) => m.id !== user.id);
  }, [members, user]);

  const honoreeSet = useMemo(() => new Set(honoreeIds), [honoreeIds]);
  const trimmedReason = reason.trim();

  if (
    userLoading ||
    !user ||
    groupLoading ||
    !group ||
    chartLoading ||
    !chart ||
    giftsLoading
  ) {
    return <LoadingSky />;
  }

  function toggleHonoree(memberId: string) {
    setHonoreeIds((prev) =>
      prev.includes(memberId)
        ? prev.filter((p) => p !== memberId)
        : [...prev, memberId],
    );
  }

  async function handleSubmit() {
    if (submitState.status === "submitting") return;
    if (!chartId || !chart || !user) return;
    if (honoreeIds.length === 0 || !trimmedReason || !style || count < 1) {
      setSubmitState({
        status: "error",
        message: "Something's missing — go back a step and check.",
      });
      return;
    }

    setSubmitState({ status: "submitting" });
    try {
      const existingTotal = existingGifts.reduce(
        (sum, g) => sum + (g.count ?? 0),
        0,
      );
      const wouldHitGoal =
        chart.completedAt == null && existingTotal + count >= chart.goalCount;
      const anchor = pickGiftAnchor(
        existingGifts.map((g) => ({ x: g.x, y: g.y })),
      );
      const newId = id();

      const starImageUrl =
        style === CUSTOM_STYLE && customImageUrl
          ? customImageUrl
          : presetUrl(style);

      const giftOp = db.tx.gifts[newId]
        .update({
          reason: trimmedReason,
          count,
          style,
          starImageUrl,
          x: anchor.x,
          y: anchor.y,
          createdAt: Date.now(),
        })
        .link({ chart: chartId, giver: user.id, honorees: honoreeIds });

      if (wouldHitGoal) {
        await db.transact([
          giftOp,
          db.tx.charts[chartId].update({ completedAt: Date.now() }),
        ]);
      } else {
        await db.transact([giftOp]);
      }

      navigate(
        wouldHitGoal
          ? `/charts/${chartId}/celebrate`
          : `/charts/${chartId}`,
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Couldn't send the stars.";
      setSubmitState({ status: "error", message });
    }
  }

  const submitting = submitState.status === "submitting";

  const headline =
    step === "honorees"
      ? "Who is this star for?"
      : step === "reason"
        ? "Tell them why."
        : step === "preset"
          ? "Choose its shape."
          : "Send it up.";

  const sub =
    step === "honorees"
      ? "Pick one or more — the people this star belongs to."
      : step === "reason"
        ? "Be specific. Small kindnesses make the brightest light."
        : step === "preset"
          ? "Pick a shape and how many stars you'd like to send."
          : "One last look before they rise into the sky.";

  function goBack() {
    setSubmitState({ status: "idle" });
    if (step === "reason") setStep("honorees");
    else if (step === "preset") setStep("reason");
    else if (step === "confirm") setStep("preset");
  }

  function goNext() {
    setSubmitState({ status: "idle" });
    if (step === "honorees" && honoreeIds.length > 0) setStep("reason");
    else if (step === "reason" && trimmedReason.length > 0) setStep("preset");
    else if (step === "preset" && style) setStep("confirm");
  }

  return (
    <Sky>
      <main style={mainStyle}>
        <section style={panelStyle}>
          <p style={eyebrowStyle}>Starcharts</p>
          <h1 style={headlineStyle}>{headline}</h1>
          <p style={subStyle}>{sub}</p>

          <p style={stepperStyle}>
            <span style={stepDotStyle(step === "honorees")} />
            <span style={stepDotStyle(step === "reason")} />
            <span style={stepDotStyle(step === "preset")} />
            <span style={stepDotStyle(step === "confirm")} />
          </p>

          {step === "honorees" && (
            <HonoreesGrid
              members={otherMembers}
              selected={honoreeSet}
              onToggle={toggleHonoree}
            />
          )}

          {step === "reason" && (
            <ReasonInput
              value={reason}
              onChange={setReason}
              max={REASON_MAX}
            />
          )}

          {step === "preset" && (
            <PresetStep
              selected={style}
              onSelect={(slug) => {
                setStyle(slug);
                if (slug !== CUSTOM_STYLE) {
                  setCustomImageUrl(null);
                }
              }}
              customImageUrl={customImageUrl}
              onClearCustom={() => {
                setStyle(null);
                setCustomImageUrl(null);
              }}
              onSummon={() => {
                if (!chartId) return;
                // Persist the in-flight draft so coming back from
                // the summon route keeps the user's picks intact
                // — see the hydration effect at the top of this
                // component.
                try {
                  window.sessionStorage.setItem(
                    giftDraftKey(chartId),
                    JSON.stringify({ honoreeIds, reason, count }),
                  );
                } catch {
                  // sessionStorage unavailable — proceed anyway;
                  // the user just loses their state on return.
                }
                navigate(`/charts/${chartId}/summon`);
              }}
              count={count}
              onCountChange={setCount}
            />
          )}

          {step === "confirm" && (
            <ConfirmStep
              honorees={otherMembers.filter((m) => honoreeSet.has(m.id))}
              reason={trimmedReason}
              style={style!}
              customImageUrl={customImageUrl}
              count={count}
            />
          )}

          {submitState.status === "error" && (
            <p style={errorStyle}>{submitState.message}</p>
          )}

          <div style={buttonRowStyle}>
            <button
              type="button"
              style={secondaryButtonStyle(submitting)}
              onClick={
                step === "honorees" ? () => navigate(-1) : goBack
              }
              disabled={submitting}
            >
              {step === "honorees" ? "Cancel" : "Back"}
            </button>

            {step === "confirm" ? (
              <button
                type="button"
                style={primaryButtonStyle(submitting, false)}
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? "Rising…" : "Send it up"}
              </button>
            ) : (
              <button
                type="button"
                style={primaryButtonStyle(false, !canAdvance(step, {
                  honoreeIds,
                  reason: trimmedReason,
                  style,
                }))}
                onClick={goNext}
                disabled={
                  !canAdvance(step, {
                    honoreeIds,
                    reason: trimmedReason,
                    style,
                  })
                }
              >
                Continue
              </button>
            )}
          </div>
        </section>
      </main>
    </Sky>
  );
}

function canAdvance(
  step: Step,
  draft: { honoreeIds: string[]; reason: string; style: string | null },
): boolean {
  if (step === "honorees") return draft.honoreeIds.length > 0;
  if (step === "reason") return draft.reason.length > 0;
  if (step === "preset") return draft.style != null;
  return true;
}

function HonoreesGrid({
  members,
  selected,
  onToggle,
}: {
  members: User[];
  selected: Set<string>;
  onToggle: (id: string) => void;
}) {
  if (members.length === 0) {
    return (
      <p style={emptyStateStyle}>
        Your group has no other members yet — invite someone from the dashboard
        first.
      </p>
    );
  }
  return (
    <div style={honoreesGridStyle}>
      {members.map((m) => {
        const isOn = selected.has(m.id);
        const seed = m.avatarSeed || m.id;
        return (
          <button
            key={m.id}
            type="button"
            role="checkbox"
            aria-checked={isOn}
            onClick={() => onToggle(m.id)}
            style={honoreeCardStyle(isOn)}
          >
            <span
              style={{
                ...avatarDotStyle,
                background: avatarColor(seed),
              }}
            />
            <span style={honoreeNameStyle}>
              {m.displayName || m.email || "someone"}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function ReasonInput({
  value,
  onChange,
  max,
}: {
  value: string;
  onChange: (v: string) => void;
  max: number;
}) {
  return (
    <div style={fieldStyle}>
      <textarea
        autoFocus
        rows={3}
        maxLength={max}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="for the way you laugh at my dumb jokes"
        style={textareaStyle}
      />
      <p style={counterStyle}>
        {value.length}/{max}
      </p>
    </div>
  );
}

function PresetStep({
  selected,
  onSelect,
  customImageUrl,
  onClearCustom,
  onSummon,
  count,
  onCountChange,
}: {
  selected: string | null;
  onSelect: (slug: string) => void;
  customImageUrl: string | null;
  onClearCustom: () => void;
  onSummon: () => void;
  count: number;
  onCountChange: (n: number) => void;
}) {
  const showingCustom = selected === CUSTOM_STYLE && customImageUrl;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {showingCustom ? (
        <div style={customPreviewWrapStyle}>
          <img
            src={customImageUrl}
            alt="Your summoned star"
            draggable={false}
            style={customPreviewImgStyle}
          />
          <p style={customPreviewLabelStyle}>your summoned star</p>
          <div style={customPreviewLinksStyle}>
            <button
              type="button"
              onClick={onClearCustom}
              style={inlineLinkStyle}
            >
              use a different star
            </button>
            <span style={inlineDotStyle}>·</span>
            <button
              type="button"
              onClick={onSummon}
              style={inlineLinkStyle}
            >
              summon another
            </button>
          </div>
        </div>
      ) : (
        <>
          <PresetGallery selected={selected} onSelect={onSelect} />
          <button
            type="button"
            onClick={onSummon}
            style={summonLinkStyle}
          >
            ✦ or summon a custom star
          </button>
        </>
      )}

      <div style={countRowStyle}>
        <span style={countLabelStyle}>How many?</span>
        <span style={countChipsStyle}>
          {COUNT_OPTIONS.map((n) => {
            const isOn = count === n;
            return (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={isOn}
                onClick={() => onCountChange(n)}
                style={countChipStyle(isOn)}
              >
                {n}
              </button>
            );
          })}
        </span>
      </div>
    </div>
  );
}

function ConfirmStep({
  honorees,
  reason,
  style,
  customImageUrl,
  count,
}: {
  honorees: User[];
  reason: string;
  style: string;
  customImageUrl: string | null;
  count: number;
}) {
  // Cheap visual cluster — purely cosmetic, doesn't drive the real layout.
  const previewPositions = useMemo(() => {
    const out: { x: number; y: number; size: number }[] = [];
    if (count === 1) {
      out.push({ x: 0, y: 0, size: 64 });
      return out;
    }
    const radius = count <= 3 ? 22 : 30;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
      out.push({
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
        size: 48,
      });
    }
    return out;
  }, [count]);

  const url =
    style === CUSTOM_STYLE && customImageUrl
      ? customImageUrl
      : presetUrl(style);

  return (
    <div style={confirmWrapStyle}>
      <div style={previewBoxStyle}>
        {previewPositions.map((p, i) => (
          <img
            key={i}
            src={url}
            alt=""
            draggable={false}
            style={{
              position: "absolute",
              left: `calc(50% + ${p.x}px - ${p.size / 2}px)`,
              top: `calc(50% + ${p.y}px - ${p.size / 2}px)`,
              width: p.size,
              height: p.size,
              objectFit: "contain",
              filter: "drop-shadow(0 0 12px rgba(255,235,180,0.45))",
              pointerEvents: "none",
            }}
          />
        ))}
      </div>

      <div style={confirmRowStyle}>
        <span style={confirmKeyStyle}>for</span>
        <span style={confirmValueStyle}>
          {honorees.length === 0
            ? "no one yet"
            : honorees
                .map((h) => h.displayName || h.email || "someone")
                .join(" & ")}
        </span>
      </div>

      <p style={confirmReasonStyle}>“{reason}”</p>

      <div style={confirmRowStyle}>
        <span style={confirmKeyStyle}>
          {count} {count === 1 ? "star" : "stars"} ·{" "}
          {style === CUSTOM_STYLE ? "summoned" : style.replace(/-/g, " ")}
        </span>
      </div>
    </div>
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
  maxWidth: 520,
  background: "var(--sc-surface)",
  border: "1px solid var(--sc-stroke)",
  borderRadius: "var(--sc-radius-tile, 18px)",
  padding: "2.4rem 2.2rem 2rem",
  boxShadow: "var(--sc-shadow-tile, 0 12px 40px rgba(0,0,0,0.35))",
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
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
  fontSize: "clamp(1.8rem, 4vw, 2.4rem)",
  fontWeight: "var(--sc-serif-weight)" as never,
  margin: 0,
  lineHeight: 1.1,
  color: "var(--sc-fg)",
};

const subStyle: CSSProperties = {
  fontFamily: "var(--sc-sans)",
  color: "var(--sc-fg-muted)",
  margin: "10px 0 1.2rem",
  fontSize: "0.95rem",
  lineHeight: 1.5,
};

const stepperStyle: CSSProperties = {
  display: "inline-flex",
  gap: 8,
  margin: "0 auto 1.5rem",
  padding: 0,
  listStyle: "none",
};

function stepDotStyle(active: boolean): CSSProperties {
  return {
    width: active ? 22 : 8,
    height: 4,
    borderRadius: 2,
    background: active ? "var(--sc-gold)" : "var(--sc-stroke)",
    transition: "width 160ms ease, background 160ms ease",
    display: "inline-block",
  };
}

const honoreesGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
  gap: 10,
  textAlign: "left",
};

function honoreeCardStyle(selected: boolean): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "12px 14px",
    background: "var(--sc-surface-solid)",
    border: "1px solid var(--sc-stroke)",
    borderRadius: "var(--sc-radius-inline, 12px)",
    outline: selected ? "2px solid var(--sc-gold)" : "none",
    outlineOffset: 2,
    color: "var(--sc-fg)",
    fontFamily: "var(--sc-serif)",
    fontSize: "1rem",
    cursor: "pointer",
    minHeight: 52,
    transition: "outline-color 120ms ease, filter 120ms ease",
    filter: selected ? "brightness(1.1)" : undefined,
  };
}

const avatarDotStyle: CSSProperties = {
  width: 12,
  height: 12,
  borderRadius: "50%",
  flexShrink: 0,
  boxShadow:
    "0 0 0 1px rgba(255,255,255,0.18), 0 0 6px rgba(255,255,255,0.12)",
};

const honoreeNameStyle: CSSProperties = {
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const fieldStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  textAlign: "left",
};

const textareaStyle: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  background: "var(--sc-surface-solid)",
  border: "1px solid var(--sc-stroke)",
  borderRadius: "var(--sc-radius-inline, 10px)",
  padding: "1rem 1.1rem",
  color: "var(--sc-fg)",
  fontFamily: "var(--sc-serif)",
  fontStyle: "italic",
  fontSize: "1.05rem",
  lineHeight: 1.45,
  resize: "vertical",
  minHeight: "5.5rem",
  outline: "none",
};

const counterStyle: CSSProperties = {
  margin: 0,
  alignSelf: "flex-end",
  fontFamily: "var(--sc-sans)",
  fontSize: "0.72rem",
  letterSpacing: "0.1em",
  color: "var(--sc-fg-faint)",
};

const countRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
};

const countLabelStyle: CSSProperties = {
  fontFamily: "var(--sc-sans)",
  fontSize: "0.72rem",
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "var(--sc-fg-muted)",
};

const countChipsStyle: CSSProperties = {
  display: "inline-flex",
  gap: 8,
};

function countChipStyle(active: boolean): CSSProperties {
  return {
    minWidth: 44,
    padding: "0.5rem 0.85rem",
    border: "1px solid var(--sc-stroke)",
    borderRadius: "var(--sc-radius-pill, 999px)",
    background: active ? "var(--sc-gold)" : "var(--sc-surface-solid)",
    color: active ? "#1a1106" : "var(--sc-fg)",
    fontFamily: "var(--sc-sans)",
    fontWeight: active ? 600 : 500,
    fontSize: "0.95rem",
    cursor: "pointer",
    transition: "background 120ms ease, color 120ms ease",
  };
}

const buttonRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  marginTop: "1.6rem",
};

function primaryButtonStyle(
  submitting: boolean,
  disabled: boolean,
): CSSProperties {
  return {
    flex: "1 1 auto",
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

function secondaryButtonStyle(disabled: boolean): CSSProperties {
  return {
    flex: "0 0 auto",
    background: "transparent",
    color: "var(--sc-fg-faint)",
    border: "1px solid var(--sc-stroke)",
    borderRadius: "var(--sc-radius-pill, 999px)",
    padding: "0.8rem 1.1rem",
    fontFamily: "var(--sc-sans)",
    fontSize: "0.78rem",
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.45 : 1,
    transition: "opacity 120ms ease",
  };
}

const errorStyle: CSSProperties = {
  margin: "1rem 0 0",
  fontFamily: "var(--sc-serif)",
  fontStyle: "italic",
  color: "var(--sc-fg-muted)",
  fontSize: "0.88rem",
};

const emptyStateStyle: CSSProperties = {
  margin: 0,
  fontFamily: "var(--sc-serif)",
  fontStyle: "italic",
  color: "var(--sc-fg-muted)",
  fontSize: "0.95rem",
  lineHeight: 1.5,
};

const confirmWrapStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 16,
};

const previewBoxStyle: CSSProperties = {
  position: "relative",
  width: 200,
  height: 200,
  borderRadius: "50%",
  background:
    "radial-gradient(circle at 50% 50%, rgba(255,235,180,0.08), rgba(0,0,0,0.35))",
  border: "1px solid var(--sc-stroke)",
  overflow: "hidden",
};

const confirmRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  fontFamily: "var(--sc-sans)",
  fontSize: "0.78rem",
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "var(--sc-fg-muted)",
};

const confirmKeyStyle: CSSProperties = {
  color: "var(--sc-fg-faint)",
};

const confirmValueStyle: CSSProperties = {
  color: "var(--sc-fg)",
  fontFamily: "var(--sc-serif)",
  fontStyle: "italic",
  fontSize: "1rem",
  letterSpacing: "0.02em",
  textTransform: "none",
};

const confirmReasonStyle: CSSProperties = {
  margin: 0,
  fontFamily: "var(--sc-serif)",
  fontStyle: "italic",
  fontSize: "1.1rem",
  lineHeight: 1.45,
  color: "var(--sc-fg)",
  maxWidth: 360,
  textAlign: "center",
};

const summonLinkStyle: CSSProperties = {
  alignSelf: "center",
  background: "transparent",
  border: "none",
  color: "var(--sc-gold)",
  fontFamily: "var(--sc-serif)",
  fontStyle: "italic",
  fontSize: "0.95rem",
  letterSpacing: "0.02em",
  cursor: "pointer",
  padding: "0.2rem 0.4rem",
  textDecoration: "underline",
  textUnderlineOffset: 4,
  textDecorationThickness: 1,
  textDecorationColor: "rgba(245,196,107,0.45)",
};

const customPreviewWrapStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 8,
  padding: "10px 0 4px",
};

const customPreviewImgStyle: CSSProperties = {
  width: 120,
  height: 120,
  objectFit: "contain",
  filter: "drop-shadow(0 0 24px rgba(255,235,180,0.55))",
  pointerEvents: "none",
  userSelect: "none",
};

const customPreviewLabelStyle: CSSProperties = {
  margin: 0,
  fontFamily: "var(--sc-sans)",
  fontSize: "0.7rem",
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "var(--sc-fg-muted)",
};

const customPreviewLinksStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  marginTop: 2,
};

const inlineLinkStyle: CSSProperties = {
  background: "transparent",
  border: "none",
  color: "var(--sc-fg-faint)",
  fontFamily: "var(--sc-sans)",
  fontSize: "0.74rem",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  cursor: "pointer",
  padding: "0.25rem 0.4rem",
  textDecoration: "underline",
  textUnderlineOffset: 3,
  textDecorationColor: "var(--sc-stroke)",
};

const inlineDotStyle: CSSProperties = {
  color: "var(--sc-fg-faint)",
  opacity: 0.6,
};

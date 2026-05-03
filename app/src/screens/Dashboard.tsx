import { useEffect, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { Sky } from "../components/Sky";
import { LoadingSky } from "../components/LoadingSky";
import { ChartCard } from "../components/ChartCard";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { useMyCharts } from "../hooks/useMyCharts";
import { signOut } from "../lib/auth";
import { db } from "../db/client";
import { isValidInviteCode, normalizeInviteCode } from "../lib/inviteCode";

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

type JoinState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "error"; message: string };

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, isLoading: userLoading } = useCurrentUser();
  const { charts, isLoading: chartsLoading } = useMyCharts(user?.id);

  const [createHover, setCreateHover] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joinState, setJoinState] = useState<JoinState>({ status: "idle" });

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

  if (userLoading || !user) {
    return <LoadingSky hint="opening your sky…" />;
  }

  const handleSignOut = async () => {
    await signOut();
    navigate("/sign-in", { replace: true });
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (joinState.status === "submitting" || !user) return;
    const normalized = normalizeInviteCode(joinCode);
    if (!isValidInviteCode(normalized)) {
      setJoinState({ status: "error", message: "Enter a valid 6-character invite code." });
      return;
    }
    setJoinState({ status: "submitting" });
    try {
      const result = await db.queryOnce({
        charts: { $: { where: { inviteCode: normalized } } },
      });
      const match = result.data.charts?.[0];
      if (!match) {
        setJoinState({ status: "error", message: "No chart found with that code." });
        return;
      }
      const alreadyMember = charts.some((c) => c.id === match.id);
      if (alreadyMember) {
        setJoinState({ status: "idle" });
        setJoinCode("");
        navigate(`/charts/${match.id}`);
        return;
      }
      await db.transact(db.tx.charts[match.id].link({ members: user.id }));
      setJoinState({ status: "idle" });
      setJoinCode("");
      navigate(`/charts/${match.id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Couldn't join — try again.";
      setJoinState({ status: "error", message });
    }
  };

  const submittingJoin = joinState.status === "submitting";

  return (
    <div style={{ position: "absolute", inset: 0, color: "var(--sc-fg)", overflow: "hidden" }}>
      <Sky />

      <div
        style={{
          position: "absolute",
          inset: 0,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          zIndex: 1,
        }}
      >
        <header style={headerStyle}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ ...eyebrowStyle, color: "var(--sc-gold)" }}>your sky</span>
            <h1
              style={{
                margin: 0,
                fontFamily: "var(--sc-serif)",
                fontWeight: "var(--sc-serif-weight, 500)" as CSSProperties["fontWeight"],
                fontSize: 26,
                lineHeight: 1.1,
                letterSpacing: "-0.005em",
              }}
            >
              {user.displayName}
            </h1>
          </div>

          <button type="button" onClick={handleSignOut} style={signOutBtn}>
            Sign out
          </button>
        </header>

        <main
          style={{
            flex: 1,
            padding: "24px 24px 40px",
            display: "flex",
            flexDirection: "column",
            gap: 24,
          }}
        >
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

          <div
            style={{
              maxWidth: 420,
              background: "var(--sc-surface)",
              border: "1px solid var(--sc-stroke)",
              borderRadius: 14,
              padding: "18px 20px",
              backdropFilter: "blur(14px)",
              WebkitBackdropFilter: "blur(14px)",
            }}
          >
            <p
              style={{
                margin: "0 0 12px",
                fontFamily: "var(--sc-sans)",
                fontSize: 11,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "var(--sc-fg-muted)",
              }}
            >
              Join a chart
            </p>
            <form onSubmit={handleJoin} style={{ display: "flex", gap: 8 }}>
              <input
                type="text"
                placeholder="Invite code"
                value={joinCode}
                onChange={(e) => {
                  setJoinCode(e.target.value);
                  if (joinState.status === "error") setJoinState({ status: "idle" });
                }}
                disabled={submittingJoin}
                maxLength={8}
                autoComplete="off"
                autoCapitalize="characters"
                style={{
                  flex: 1,
                  background: "var(--sc-surface-solid)",
                  border: "1px solid var(--sc-stroke)",
                  borderRadius: 10,
                  padding: "8px 12px",
                  color: "var(--sc-fg)",
                  fontFamily: "var(--sc-sans)",
                  fontSize: 14,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  outline: "none",
                }}
              />
              <button
                type="submit"
                disabled={submittingJoin || joinCode.trim().length === 0}
                style={{
                  background: "var(--sc-gold)",
                  color: "#1a1106",
                  border: "none",
                  borderRadius: 10,
                  padding: "8px 16px",
                  fontFamily: "var(--sc-sans)",
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: submittingJoin ? "wait" : "pointer",
                  opacity: submittingJoin || joinCode.trim().length === 0 ? 0.55 : 1,
                  transition: "opacity 120ms ease",
                  whiteSpace: "nowrap",
                }}
              >
                {submittingJoin ? "Joining…" : "Join"}
              </button>
            </form>
            {joinState.status === "error" && (
              <p
                style={{
                  margin: "8px 0 0",
                  fontFamily: "var(--sc-serif)",
                  fontStyle: "italic",
                  fontSize: 13,
                  color: "var(--sc-fg-muted)",
                }}
              >
                {joinState.message}
              </p>
            )}
          </div>
        </main>
      </div>
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

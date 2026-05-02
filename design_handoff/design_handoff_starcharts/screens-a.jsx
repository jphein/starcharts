// screens.jsx — All UI screens for Starcharts.
// Exports a single Screens object to window with each screen as a sub-component.
// Each screen receives the app state + actions from app.jsx.

const { useState: scState, useEffect: scEffect, useRef: scRef, useMemo: scMemo } = React;

// ─────────────────────────────────────────────────────────────
// Shared bits: glass surface, button, avatar, progress
// ─────────────────────────────────────────────────────────────
// Tiny color dot — used in lieu of avatars for member identity.
function MemberDot({ member, size = 8 }) {
  if (!member) return null;
  return (
    <span style={{
      width: size, height: size, borderRadius: '50%',
      background: member.color,
      display: 'inline-block', flexShrink: 0,
      boxShadow: `0 0 0 1px rgba(255,255,255,0.2), 0 0 6px ${member.color}55`,
    }} />
  );
}

// Compatibility shim — Avatar now renders just the member name with a dot.
function Avatar({ member, size = 36, ring = false }) {
  if (!member) return null;
  const dotSize = Math.max(6, Math.round(size * 0.22));
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: Math.max(4, size * 0.16),
      fontFamily: 'var(--sc-serif)', fontSize: Math.max(12, size * 0.42),
      color: 'inherit', whiteSpace: 'nowrap',
    }}>
      <MemberDot member={member} size={dotSize} />
      <span style={{ fontWeight: ring ? 600 : 500 }}>{member.name}</span>
    </span>
  );
}

function shadeColor(hex, amt) {
  const c = hex.replace('#', '');
  const r = Math.max(0, Math.min(255, parseInt(c.substr(0, 2), 16) + amt));
  const g = Math.max(0, Math.min(255, parseInt(c.substr(2, 2), 16) + amt));
  const b = Math.max(0, Math.min(255, parseInt(c.substr(4, 2), 16) + amt));
  return `#${[r, g, b].map(x => x.toString(16).padStart(2, '0')).join('')}`;
}

function Btn({ children, onClick, variant = 'primary', style = {}, full = false, disabled = false }) {
  const base = {
    fontFamily: 'var(--sc-sans)', fontSize: 15, fontWeight: 500,
    padding: '12px 20px', borderRadius: 999, border: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    width: full ? '100%' : 'auto',
    transition: 'transform .15s, opacity .15s',
    opacity: disabled ? 0.5 : 1,
    minHeight: 48,
    letterSpacing: '0.005em',
  };
  const variants = {
    primary: {
      background: 'var(--sc-gold)', color: '#1a0f00',
      boxShadow: '0 1px 0 rgba(255,255,255,0.4) inset, 0 6px 20px rgba(0,0,0,0.25)',
    },
    ghost: {
      background: 'transparent', color: 'var(--sc-fg)',
      border: '1px solid var(--sc-stroke)',
    },
    glass: {
      background: 'var(--sc-surface)', color: 'var(--sc-fg)',
      backdropFilter: 'blur(20px) saturate(160%)',
      WebkitBackdropFilter: 'blur(20px) saturate(160%)',
      border: '1px solid var(--sc-stroke)',
    },
  };
  return (
    <button
      style={{ ...base, ...variants[variant], ...style }}
      onClick={disabled ? null : onClick}
      onMouseDown={(e) => !disabled && (e.currentTarget.style.transform = 'scale(0.97)')}
      onMouseUp={(e) => (e.currentTarget.style.transform = '')}
      onMouseLeave={(e) => (e.currentTarget.style.transform = '')}
    >
      {children}
    </button>
  );
}

// Tiny serif "wreath" for completed charts
function Wreath({ size = 32, color = 'var(--sc-gold)' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <path d="M16 6 C 9 6, 6 12, 6 16 C 6 22, 11 26, 16 26 C 21 26, 26 22, 26 16 C 26 12, 23 6, 16 6"
            stroke={color} strokeWidth="1" fill="none" opacity="0.5" />
      <path d="M16 4 L 17 7 L 18 4 M 4 16 L 7 17 L 4 18 M 28 16 L 25 17 L 28 18 M 16 28 L 17 25 L 18 28"
            stroke={color} strokeWidth="1.2" />
      <circle cx="16" cy="16" r="2" fill={color} />
    </svg>
  );
}

// Mini progress: subtle, serif numerals
function Progress({ have, goal }) {
  return (
    <span style={{ fontFamily: 'var(--sc-serif)', fontSize: 14, color: 'var(--sc-fg-muted)', letterSpacing: '0.04em' }}>
      <span style={{ color: 'var(--sc-fg)' }}>{have}</span>
      <span style={{ margin: '0 0.4em', opacity: 0.5 }}>of</span>
      <span>{goal}</span>
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
// SCREEN: Sign-in / first-time
// ─────────────────────────────────────────────────────────────
function SignIn({ onSubmit, paletteKey, theme }) {
  const [email, setEmail] = scState('');
  const [sent, setSent] = scState(false);
  const Sky = window.SC_SKY.Sky;
  return (
    <div style={{ position: 'absolute', inset: 0, color: 'var(--sc-fg)', overflow: 'hidden' }}>
      <Sky theme={theme} paletteKey={paletteKey} gifts={[
        { id: 'welcome', count: 1, style: 'gold', created_at: 0 },
      ]} interactive={false} animation="drifty" />
      <div style={{
        position: 'relative', height: '100%',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: 32, textAlign: 'center', gap: 22,
      }}>
        <div style={{ fontFamily: 'var(--sc-serif)', fontWeight: 500, fontSize: 'clamp(38px, 9vw, 64px)', lineHeight: 1.05, letterSpacing: '-0.01em', maxWidth: 460 }}>
          Starcharts
        </div>
        <div style={{ fontFamily: 'var(--sc-sans)', fontSize: 16, color: 'var(--sc-fg-muted)', maxWidth: 360, lineHeight: 1.5 }}>
          A shared sky for the people you love. Give each other stars for the small, real things.
        </div>
        {!sent ? (
          <form
            onSubmit={(e) => { e.preventDefault(); if (email) { setSent(true); setTimeout(() => onSubmit(), 1400); } }}
            style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 320, marginTop: 16 }}
          >
            <input
              type="email" placeholder="you@household.com"
              value={email} onChange={(e) => setEmail(e.target.value)}
              style={{
                padding: '14px 18px', borderRadius: 999, border: '1px solid var(--sc-stroke)',
                background: 'var(--sc-surface)', backdropFilter: 'blur(20px)',
                color: 'var(--sc-fg)', fontFamily: 'var(--sc-sans)', fontSize: 15,
                outline: 'none', textAlign: 'center',
              }}
              autoFocus
            />
            <Btn variant="primary" full>Send a magic link</Btn>
          </form>
        ) : (
          <div style={{
            fontFamily: 'var(--sc-sans)', fontSize: 14, color: 'var(--sc-fg-muted)',
            display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center', marginTop: 16,
          }}>
            <div style={{ fontFamily: 'var(--sc-serif)', fontSize: 22, color: 'var(--sc-fg)' }}>Check your inbox</div>
            <div>A link is on its way to <em style={{ color: 'var(--sc-fg)' }}>{email}</em></div>
          </div>
        )}
        <div style={{ marginTop: 28, fontSize: 12, color: 'var(--sc-fg-faint)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          New here? <span onClick={() => onSubmit()} style={{ color: 'var(--sc-fg-muted)', textDecoration: 'underline', cursor: 'pointer' }}>Use an invite code</span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SCREEN: Dashboard
// ─────────────────────────────────────────────────────────────
function Dashboard({ group, charts, gifts, paletteKey, theme, onOpenChart, onCreateChart }) {
  const Sky = window.SC_SKY.Sky;
  return (
    <div style={{ position: 'absolute', inset: 0, color: 'var(--sc-fg)', overflow: 'hidden' }}>
      <Sky theme={theme} paletteKey={paletteKey} gifts={[]} interactive={false} animation="drifty" />
      <div style={{
        position: 'relative', height: '100%', overflowY: 'auto', padding: '24px 20px 40px',
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 18 }}>
          <div>
            <div style={{ fontFamily: 'var(--sc-sans)', fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--sc-fg-faint)' }}>
              your group
            </div>
            <div style={{ fontFamily: 'var(--sc-serif)', fontSize: 28, fontWeight: 500, lineHeight: 1.1, marginTop: 4 }}>
              {group.name}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {group.members.slice(0, 5).map((m) => (
              <span key={m.id} title={m.name} style={{
                width: 8, height: 8, borderRadius: '50%', background: m.color,
                boxShadow: `0 0 6px ${m.color}66`,
              }} />
            ))}
            <span style={{ marginLeft: 4, fontSize: 11, color: 'var(--sc-fg-muted)', letterSpacing: '0.04em' }}>
              {group.members.length}
            </span>
          </div>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: 16,
        }}>
          <div
            onClick={onCreateChart}
            style={{
              minHeight: 180, borderRadius: 18,
              border: '2px dashed var(--sc-fg-muted)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10,
              cursor: 'pointer', color: 'var(--sc-fg)',
              fontFamily: 'var(--sc-sans)', fontSize: 14,
              background: 'var(--sc-surface)', backdropFilter: 'blur(10px)',
              transition: 'all .15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--sc-gold)'; e.currentTarget.style.color = 'var(--sc-gold)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--sc-fg-muted)'; e.currentTarget.style.color = 'var(--sc-fg)'; }}
          >
            <span style={{ fontSize: 28, color: 'var(--sc-gold)' }}>✦</span>
            <span style={{ fontFamily: 'var(--sc-serif)', fontSize: 18 }}>Create a new chart</span>
          </div>
          {charts.map((c) => {
            const chartGifts = gifts.filter((g) => g.chart_id === c.id);
            const have = chartGifts.reduce((s, g) => s + g.count, 0);
            const isComplete = c.completed_at != null;
            return (
              <div
                key={c.id}
                onClick={() => onOpenChart(c.id)}
                style={{
                  position: 'relative', borderRadius: 18, overflow: 'hidden',
                  height: 180, cursor: 'pointer',
                  border: '1px solid var(--sc-stroke)',
                  boxShadow: '0 8px 28px rgba(0,0,0,0.18)',
                  transition: 'transform .15s',
                }}
                onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.99)'}
                onMouseUp={(e) => e.currentTarget.style.transform = ''}
                onMouseLeave={(e) => e.currentTarget.style.transform = ''}
              >
                <Sky
                  theme={theme} paletteKey={paletteKey}
                  gifts={chartGifts} interactive={false}
                  animation={isComplete ? 'still' : 'drifty'}
                  density="regular" small
                />
                <div style={{
                  position: 'absolute', inset: 0, padding: '14px',
                  display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                  pointerEvents: 'none',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{
                      fontFamily: 'var(--sc-serif)', fontSize: 18, fontWeight: 500,
                      color: '#fff', lineHeight: 1.15,
                      maxWidth: '70%',
                      background: 'rgba(8,10,20,0.55)', backdropFilter: 'blur(8px)',
                      padding: '6px 10px', borderRadius: 8,
                      border: '0.5px solid rgba(255,255,255,0.08)',
                    }}>{c.name}</div>
                    {isComplete && (
                      <div style={{
                        background: 'rgba(8,10,20,0.55)', backdropFilter: 'blur(8px)',
                        padding: 6, borderRadius: 999,
                        border: '0.5px solid rgba(255,255,255,0.08)',
                        display: 'flex',
                      }}>
                        <Wreath size={20} color="#f5d684" />
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 8 }}>
                    <div style={{
                      fontFamily: 'var(--sc-sans)', fontSize: 11, color: 'rgba(255,255,255,0.92)',
                      maxWidth: '60%', lineHeight: 1.35,
                      background: 'rgba(8,10,20,0.55)', backdropFilter: 'blur(8px)',
                      padding: '5px 9px', borderRadius: 8,
                      border: '0.5px solid rgba(255,255,255,0.08)',
                    }}>{c.reward}</div>
                    <div style={{
                      fontFamily: 'var(--sc-serif)', fontSize: 14, color: '#fff',
                      background: 'rgba(8,10,20,0.55)', backdropFilter: 'blur(8px)',
                      padding: '5px 10px', borderRadius: 999,
                      border: '0.5px solid rgba(255,255,255,0.08)',
                      whiteSpace: 'nowrap',
                    }}>
                      {isComplete ? <em style={{ fontStyle: 'italic', opacity: 0.85 }}>complete</em> : `${have} of ${c.goal_count}`}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SCREEN: Create Chart (3 steps in one ceremonious form)
// ─────────────────────────────────────────────────────────────
function CreateChart({ onCancel, onCreate, paletteKey, theme }) {
  const [name, setName] = scState('');
  const [goal, setGoal] = scState(50);
  const [reward, setReward] = scState('');
  const Sky = window.SC_SKY.Sky;
  const valid = name.trim() && reward.trim() && goal > 0;
  return (
    <div style={{ position: 'absolute', inset: 0, color: 'var(--sc-fg)', overflow: 'hidden' }}>
      <Sky theme={theme} paletteKey={paletteKey} gifts={[]} interactive={false} animation="drifty" />
      <div style={{
        position: 'relative', height: '100%', display: 'flex', flexDirection: 'column',
        padding: '24px 20px 24px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', color: 'var(--sc-fg-muted)', fontSize: 14, cursor: 'pointer', fontFamily: 'var(--sc-sans)' }}>← Back</button>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 28, maxWidth: 420, margin: '0 auto', width: '100%' }}>
          <div style={{ textAlign: 'center', marginBottom: 8 }}>
            <div style={{ fontFamily: 'var(--sc-sans)', fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--sc-fg-faint)', marginBottom: 8 }}>
              open a sky
            </div>
            <div style={{ fontFamily: 'var(--sc-serif)', fontSize: 32, fontWeight: 500, lineHeight: 1.15 }}>
              What are you working toward?
            </div>
          </div>

          <Field label="Name your chart">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Summer of kindness"
                   style={inputStyle} />
          </Field>

          <Field label="Stars to reach the goal">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[20, 30, 50, 75, 100].map((n) => (
                <button key={n} onClick={() => setGoal(n)} style={{
                  ...chipStyle, background: goal === n ? 'var(--sc-fg)' : 'var(--sc-surface)',
                  color: goal === n ? 'var(--sc-bg)' : 'var(--sc-fg)',
                  border: goal === n ? '1px solid var(--sc-fg)' : '1px solid var(--sc-stroke)',
                }}>{n}</button>
              ))}
              <input
                type="number" value={goal} min={1}
                onChange={(e) => setGoal(parseInt(e.target.value) || 1)}
                style={{ ...inputStyle, width: 88, textAlign: 'center', fontFamily: 'var(--sc-serif)' }}
              />
            </div>
          </Field>

          <Field label="The reward when you reach it">
            <textarea value={reward} onChange={(e) => setReward(e.target.value)} placeholder="A weekend in the woods"
                      rows={2} style={{ ...inputStyle, resize: 'none', fontFamily: 'var(--sc-serif)', fontStyle: 'italic' }} />
          </Field>

          <Btn variant="primary" full disabled={!valid} onClick={() => onCreate({ name, goal_count: goal, reward })}>
            ✦ Open the sky
          </Btn>
        </div>
      </div>
    </div>
  );
}

const inputStyle = {
  width: '100%', padding: '12px 14px', borderRadius: 12,
  background: 'var(--sc-surface)',
  border: '1px solid var(--sc-stroke)',
  color: 'var(--sc-fg)', fontFamily: 'var(--sc-sans)', fontSize: 15,
  outline: 'none', boxSizing: 'border-box',
  backdropFilter: 'blur(12px)',
};

const chipStyle = {
  padding: '10px 16px', borderRadius: 999, fontFamily: 'var(--sc-serif)', fontSize: 16,
  cursor: 'pointer', minWidth: 56,
};

function Field({ label, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span style={{ fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--sc-fg-muted)' }}>
        {label}
      </span>
      {children}
    </label>
  );
}

window.SC_SCREENS_A = { SignIn, Dashboard, CreateChart, Avatar, MemberDot, Btn, Wreath, Progress, Field, inputStyle, chipStyle, shadeColor };

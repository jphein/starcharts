// screens-b.jsx — In-chart sky + gift card + gift-giving flow.

const { useState: scbState, useEffect: scbEffect, useRef: scbRef } = React;
const { Avatar, Btn, Wreath, Progress, Field, inputStyle, chipStyle, shadeColor } = window.SC_SCREENS_A;
const { PresetPreview } = window.SC_PRESET_PREVIEW;

// ─────────────────────────────────────────────────────────────
// SCREEN: In-chart sky (the hero)
// ─────────────────────────────────────────────────────────────
function ChartSky({
  chart, gifts, group, members, paletteKey, theme, animation, density,
  arrivingGiftId, presence, onBack, onAddGift, onTapGift,
}) {
  const Sky = window.SC_SKY.Sky;
  const have = gifts.reduce((s, g) => s + g.count, 0);
  const isComplete = chart.completed_at != null;
  return (
    <div style={{ position: 'absolute', inset: 0, color: '#fff', overflow: 'hidden' }}>
      <Sky
        theme={theme} paletteKey={paletteKey} gifts={gifts}
        density={density} animation={animation}
        interactive onTapGift={onTapGift} arrivingGiftId={arrivingGiftId}
        presence={presence}
      />

      {/* Top bar: back, chart name, presence indicators, progress */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, padding: '20px 18px 18px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0) 100%)',
        pointerEvents: 'none',
      }}>
        <button onClick={onBack} style={{
          background: 'rgba(0,0,0,0.32)', backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,0.14)', color: '#fff',
          width: 40, height: 40, borderRadius: 999, cursor: 'pointer', pointerEvents: 'auto',
          fontSize: 18,
        }}>←</button>
        <div style={{ textAlign: 'center', flex: 1, padding: '0 12px' }}>
          <div style={{ fontFamily: 'var(--sc-serif)', fontSize: 19, fontWeight: 500, textShadow: '0 1px 12px rgba(0,0,0,0.6)' }}>
            {chart.name}
          </div>
          <div style={{
            fontFamily: 'var(--sc-sans)', fontSize: 12,
            color: 'rgba(255,255,255,0.78)', marginTop: 2,
            textShadow: '0 1px 6px rgba(0,0,0,0.5)',
          }}>
            <span style={{ color: '#fff' }}>{have}</span>
            <span style={{ margin: '0 0.4em', opacity: 0.6 }}>of</span>
            <span>{chart.goal_count}</span>
            {isComplete && <em style={{ marginLeft: 10, fontStyle: 'italic', opacity: 0.85 }}> · complete</em>}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, pointerEvents: 'auto' }}>
          {presence && presence.length > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 10px', borderRadius: 999,
              background: 'rgba(0,0,0,0.32)', backdropFilter: 'blur(16px)',
              border: '1px solid rgba(255,255,255,0.14)',
              fontSize: 11, color: 'rgba(255,255,255,0.85)',
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: '50%', background: '#7ee0a0',
                boxShadow: '0 0 8px #7ee0a0',
              }} />
              {presence.length === 1 ? presence[0].name : `${presence.length} here`}
            </div>
          )}
        </div>
      </div>

      {/* Reward whisper at bottom */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 100, padding: '0 32px',
        textAlign: 'center', pointerEvents: 'none',
      }}>
        <div style={{
          fontFamily: 'var(--sc-serif)', fontStyle: 'italic',
          fontSize: 14, color: 'rgba(255,255,255,0.62)', textShadow: '0 1px 8px rgba(0,0,0,0.6)',
        }}>
          {isComplete ? '✦' : '↧'} {chart.reward}
        </div>
      </div>

      {/* Add-gift FAB */}
      {!isComplete && (
        <button onClick={onAddGift} style={{
          position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--sc-gold)', color: '#1a0f00', border: 'none',
          padding: '14px 26px', borderRadius: 999,
          fontFamily: 'var(--sc-sans)', fontSize: 15, fontWeight: 500,
          cursor: 'pointer',
          boxShadow: '0 1px 0 rgba(255,255,255,0.4) inset, 0 8px 32px rgba(0,0,0,0.45), 0 0 28px rgba(245,196,107,0.35)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ fontSize: 18 }}>✦</span>
          Give a star
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Gift card overlay — slides up from below when a star is tapped
// ─────────────────────────────────────────────────────────────
function GiftCard({ gift, members, onClose }) {
  if (!gift) return null;
  const giver = members.find((m) => m.id === gift.giver);
  const honorees = (gift.honorees || []).map((id) => members.find((m) => m.id === id)).filter(Boolean);
  const date = new Date(gift.created_at).toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
  return (
    <div onClick={onClose} style={{
      position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)',
      backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'flex-end',
      animation: 'sc-fade .25s ease-out',
      zIndex: 50,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: '100%', maxWidth: 460, margin: '0 auto',
        background: 'var(--sc-surface-solid)', color: 'var(--sc-fg)',
        borderRadius: '24px 24px 0 0',
        padding: '24px 24px 32px',
        boxShadow: '0 -10px 40px rgba(0,0,0,0.5)',
        animation: 'sc-slide-up .35s cubic-bezier(0.2, 0.8, 0.2, 1)',
        position: 'relative',
      }}>
        <div style={{
          width: 36, height: 4, borderRadius: 2, background: 'var(--sc-stroke)',
          margin: '0 auto 18px',
        }} />

        {/* Star preview */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
          {gift.style === 'custom' && gift.custom_image_url ? (
            <img src={gift.custom_image_url} style={{ width: 72, height: 72, borderRadius: '50%' }} />
          ) : (
            <PresetPreview presetId={gift.style} size={72} />
          )}
        </div>

        {/* Recipients */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, marginBottom: 16 }}>
          <div style={{ fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--sc-fg-muted)' }}>
            for
          </div>
          <div style={{ fontFamily: 'var(--sc-serif)', fontSize: 18, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
            {honorees.map((m, i) => (
              <React.Fragment key={m.id}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: m.color, boxShadow: `0 0 6px ${m.color}66` }} />
                  {m.name}
                </span>
                {i < honorees.length - 1 && <span style={{ opacity: 0.4 }}>·</span>}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Reason — the heart of it */}
        <div style={{
          fontFamily: 'var(--sc-serif)', fontSize: 22, fontWeight: 500,
          textAlign: 'center', lineHeight: 1.35, padding: '8px 0',
          textWrap: 'pretty',
        }}>
          “{gift.reason}”
        </div>

        {/* Footer: from & when */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--sc-stroke)',
          fontSize: 13, color: 'var(--sc-fg-muted)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: giver?.color || '#888' }} />
            <span>from {giver?.name}</span>
          </div>
          <div style={{ fontFamily: 'var(--sc-serif)', fontStyle: 'italic' }}>{date}</div>
          <div style={{ fontFamily: 'var(--sc-serif)', fontSize: 16 }}>
            ✦ <span style={{ color: 'var(--sc-fg)' }}>{gift.count}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Gift-giving flow — multi-step, sheet-style
// Steps: 1 honorees → 2 style (preset gallery or custom) → 3 count → 4 reason → 5 confirm
// ─────────────────────────────────────────────────────────────
function GiftFlow({
  group, members, currentUserId, paletteKey, theme,
  onCancel, onSend, onOpenSummon, customResult,
}) {
  const [step, setStep] = scbState(0); // 0..4
  const [honorees, setHonorees] = scbState([]);
  const [style, setStyle] = scbState('gold');
  const [count, setCount] = scbState(1);
  const [reason, setReason] = scbState('');
  const [customUrl, setCustomUrl] = scbState(null);

  // If we just got back from summon flow with a result, jump to step 2 (count)
  scbEffect(() => {
    if (customResult) {
      setStyle('custom');
      setCustomUrl(customResult);
      setStep(2);
    }
  }, [customResult]);

  const headerLabel = ['who', 'how it looks', 'how many stars', 'the reason', 'confirm'][step];
  const canNext = [
    honorees.length > 0,
    style && (style !== 'custom' || customUrl),
    count > 0,
    reason.trim().length > 0,
    true,
  ][step];

  const stepNext = () => step < 4 ? setStep(step + 1) : onSend({
    honorees, style, count, reason: reason.trim(), custom_image_url: customUrl,
  });

  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: 'var(--sc-surface-solid)', color: 'var(--sc-fg)',
      display: 'flex', flexDirection: 'column',
      animation: 'sc-slide-up .35s cubic-bezier(0.2, 0.8, 0.2, 1)',
    }}>
      {/* Header */}
      <div style={{
        padding: '20px 18px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid var(--sc-stroke)',
      }}>
        <button onClick={step === 0 ? onCancel : () => setStep(step - 1)} style={{
          background: 'none', border: 'none', color: 'var(--sc-fg-muted)', fontSize: 14, cursor: 'pointer', fontFamily: 'var(--sc-sans)',
        }}>{step === 0 ? 'Cancel' : '← Back'}</button>
        <div style={{ fontFamily: 'var(--sc-sans)', fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--sc-fg-muted)' }}>
          {headerLabel}
        </div>
        <div style={{ width: 50, fontSize: 12, color: 'var(--sc-fg-faint)', textAlign: 'right' }}>
          {step + 1}/5
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '22px 22px 100px' }}>
        {step === 0 && (
          <HonoreeStep members={members.filter(m => m.id !== currentUserId)} honorees={honorees} setHonorees={setHonorees} />
        )}
        {step === 1 && (
          <StyleStep style={style} setStyle={setStyle} customUrl={customUrl} onOpenSummon={onOpenSummon} paletteKey={paletteKey} theme={theme} />
        )}
        {step === 2 && (
          <CountStep count={count} setCount={setCount} style={style} customUrl={customUrl} paletteKey={paletteKey} theme={theme} />
        )}
        {step === 3 && (
          <ReasonStep reason={reason} setReason={setReason} honorees={honorees} members={members} />
        )}
        {step === 4 && (
          <ConfirmStep
            honorees={honorees} members={members}
            style={style} count={count} reason={reason} customUrl={customUrl}
            paletteKey={paletteKey} theme={theme}
          />
        )}
      </div>

      {/* Footer */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: '14px 22px 22px',
        background: 'linear-gradient(180deg, transparent, var(--sc-surface-solid) 30%)',
      }}>
        <Btn variant="primary" full disabled={!canNext} onClick={stepNext}>
          {step === 4 ? '✦ Send the stars' : 'Continue'}
        </Btn>
      </div>
    </div>
  );
}

function HonoreeStep({ members, honorees, setHonorees }) {
  const toggle = (id) => setHonorees(honorees.includes(id) ? honorees.filter(h => h !== id) : [...honorees, id]);
  return (
    <div>
      <H1>Who is this for?</H1>
      <Sub>Pick one or more.</Sub>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))',
        gap: 14, marginTop: 18,
      }}>
        {members.map((m) => {
          const on = honorees.includes(m.id);
          return (
            <button key={m.id} onClick={() => toggle(m.id)} style={{
              padding: '14px 16px', borderRadius: 14, background: on ? 'var(--sc-fg)' : 'var(--sc-surface)',
              border: on ? '1px solid var(--sc-fg)' : '1px solid var(--sc-stroke)',
              color: on ? 'var(--sc-bg)' : 'var(--sc-fg)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              fontFamily: 'var(--sc-serif)', fontSize: 18, fontWeight: 500,
              transition: 'all .15s', minHeight: 56,
            }}>
              <span style={{
                width: 10, height: 10, borderRadius: '50%', background: m.color,
                boxShadow: `0 0 8px ${m.color}88`,
              }} />
              {m.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StyleStep({ style, setStyle, customUrl, onOpenSummon, paletteKey, theme }) {
  const PRESET_LIST = window.SC_STARS.PRESET_LIST;
  const PRESETS = window.SC_STARS.PRESETS;
  return (
    <div>
      <H1>Pick a star</H1>
      <Sub>Or summon a one-of-a-kind one.</Sub>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))',
        gap: 12, marginTop: 18,
      }}>
        {PRESET_LIST.map((id) => {
          const on = style === id;
          return (
            <div key={id} onClick={() => setStyle(id)} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
              padding: 6, borderRadius: 14,
              border: on ? '1px solid var(--sc-fg)' : '1px solid transparent',
              background: on ? 'var(--sc-surface)' : 'transparent',
              cursor: 'pointer', transition: 'all .15s',
            }}>
              <PresetPreview presetId={id} size={56} paletteKey={paletteKey} theme={theme} />
              <div style={{ fontFamily: 'var(--sc-sans)', fontSize: 10, color: on ? 'var(--sc-fg)' : 'var(--sc-fg-muted)', textAlign: 'center', lineHeight: 1.2 }}>
                {PRESETS[id].label.split(' ')[0]}
              </div>
            </div>
          );
        })}
        <div onClick={onOpenSummon} style={{
          gridColumn: 'span 2', padding: 14, borderRadius: 14,
          border: '1px dashed var(--sc-gold)',
          background: 'linear-gradient(135deg, rgba(245,196,107,0.08), rgba(245,196,107,0.18))',
          color: 'var(--sc-gold)', fontFamily: 'var(--sc-serif)', fontSize: 15, fontStyle: 'italic',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          cursor: 'pointer', minHeight: 76,
        }}>
          ✧ Summon a custom star
        </div>
      </div>
    </div>
  );
}

function CountStep({ count, setCount, style, customUrl, paletteKey, theme }) {
  return (
    <div>
      <H1>How many stars?</H1>
      <Sub>Bigger acts deserve bigger clusters.</Sub>
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 18, marginBottom: 18 }}>
        {style === 'custom' && customUrl ? (
          <img src={customUrl} style={{ width: 84, height: 84, borderRadius: '50%' }} />
        ) : (
          <PresetPreview presetId={style} size={84} paletteKey={paletteKey} theme={theme} />
        )}
      </div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
        {[1, 2, 3, 5, 10].map((n) => {
          const on = count === n;
          return (
            <button key={n} onClick={() => setCount(n)} style={{
              ...chipStyle, minWidth: 60, fontSize: 18,
              background: on ? 'var(--sc-fg)' : 'var(--sc-surface)',
              color: on ? 'var(--sc-bg)' : 'var(--sc-fg)',
              border: on ? '1px solid var(--sc-fg)' : '1px solid var(--sc-stroke)',
            }}>{n}</button>
          );
        })}
      </div>
      <div style={{ textAlign: 'center', marginTop: 14, fontFamily: 'var(--sc-serif)', fontStyle: 'italic', color: 'var(--sc-fg-muted)', fontSize: 13 }}>
        {count === 1 && 'a single star'}
        {count === 2 && 'a small pair'}
        {count === 3 && 'a little cluster'}
        {count === 5 && 'a generous handful'}
        {count === 10 && 'an extraordinary night'}
      </div>
    </div>
  );
}

function ReasonStep({ reason, setReason, honorees, members }) {
  const names = honorees.map(id => members.find(m => m.id === id)?.name).filter(Boolean).join(' & ');
  return (
    <div>
      <H1>What did they do?</H1>
      <Sub>Be specific. Small things matter most.</Sub>
      <div style={{ marginTop: 18, fontSize: 12, color: 'var(--sc-fg-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
        for {names}
      </div>
      <textarea
        value={reason} onChange={(e) => setReason(e.target.value)}
        placeholder="for taking out the compost without being asked..."
        rows={4}
        style={{ ...inputStyle, resize: 'none', fontFamily: 'var(--sc-serif)', fontSize: 18, lineHeight: 1.4, padding: 16, fontStyle: 'italic' }}
        autoFocus
      />
    </div>
  );
}

function ConfirmStep({ honorees, members, style, count, reason, customUrl, paletteKey, theme }) {
  const honoreesM = honorees.map(id => members.find(m => m.id === id)).filter(Boolean);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, paddingTop: 12 }}>
      <H1 center>One last look.</H1>
      <div style={{ position: 'relative', width: 200, height: 200 }}>
        {/* Mini cluster preview */}
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          background: 'radial-gradient(circle at 50% 50%, var(--sc-bg) 0%, rgba(0,0,0,0.5) 100%)',
          overflow: 'hidden',
        }}>
          {Array.from({ length: count }).map((_, i) => {
            const angle = (i / Math.max(1, count)) * Math.PI * 2 + 0.6;
            const r = count === 1 ? 0 : 36 + (i % 3) * 8;
            const x = 100 + Math.cos(angle) * r - 22;
            const y = 100 + Math.sin(angle) * r - 22;
            return (
              <div key={i} style={{ position: 'absolute', left: x, top: y }}>
                {style === 'custom' && customUrl ? (
                  <img src={customUrl} style={{ width: 44, height: 44, borderRadius: '50%' }} />
                ) : (
                  <PresetPreview presetId={style} size={44} paletteKey={paletteKey} theme={theme} interactive={false} />
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div style={{ fontFamily: 'var(--sc-serif)', fontSize: 16, color: 'var(--sc-fg-muted)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
        <span style={{ fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase' }}>for</span>
        {honoreesM.map((m, i) => (
          <React.Fragment key={m.id}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--sc-fg)' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: m.color, boxShadow: `0 0 6px ${m.color}66` }} />
              {m.name}
            </span>
            {i < honoreesM.length - 1 && <span style={{ opacity: 0.4 }}>·</span>}
          </React.Fragment>
        ))}
      </div>
      <div style={{
        fontFamily: 'var(--sc-serif)', fontSize: 20, fontStyle: 'italic',
        textAlign: 'center', maxWidth: 320, lineHeight: 1.4, color: 'var(--sc-fg)', textWrap: 'pretty',
      }}>
        “{reason}”
      </div>
      <div style={{ fontFamily: 'var(--sc-sans)', fontSize: 12, color: 'var(--sc-fg-muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
        {count} {count === 1 ? 'star' : 'stars'}
      </div>
    </div>
  );
}

function H1({ children, center }) {
  return <div style={{ fontFamily: 'var(--sc-serif)', fontSize: 26, fontWeight: 500, lineHeight: 1.2, textAlign: center ? 'center' : 'left' }}>{children}</div>;
}
function Sub({ children }) {
  return <div style={{ fontFamily: 'var(--sc-sans)', fontSize: 14, color: 'var(--sc-fg-muted)', marginTop: 4 }}>{children}</div>;
}

window.SC_SCREENS_B = { ChartSky, GiftCard, GiftFlow };

// screens-c.jsx — Custom-star summoning + Goal-reached celebration.

const { useState: sccState, useEffect: sccEffect, useRef: sccRef } = React;
const { Btn } = window.SC_SCREENS_A;

// ─────────────────────────────────────────────────────────────
// Custom-star summoning sub-flow
// Phases: idle (prompt) → forming (animation) → revealed (preview) → kept | failed
// ─────────────────────────────────────────────────────────────
const PREBAKED_RESULTS = [
  // SVG-as-data-uri "generated" stars
  makePrebakedStar('fireflies', '#fff7c0', '#ffe070', '#a8e0c0'),
  makePrebakedStar('inkwell',   '#1a1838', '#5a4ae0', '#a8b0ff'),
  makePrebakedStar('sea',       '#0a3a5a', '#3aa0c4', '#a8e0e8'),
  makePrebakedStar('ember',     '#3a0808', '#e84838', '#ffd070'),
  makePrebakedStar('garden',    '#1a3a14', '#7ac060', '#fff0a8'),
];

function makePrebakedStar(name, c1, c2, c3) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
    <defs>
      <radialGradient id="g1" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="${c3}"/>
        <stop offset="40%" stop-color="${c2}"/>
        <stop offset="100%" stop-color="${c1}"/>
      </radialGradient>
      <radialGradient id="g2" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="white"/>
        <stop offset="60%" stop-color="${c3}" stop-opacity="0.5"/>
        <stop offset="100%" stop-color="${c1}" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <circle cx="100" cy="100" r="95" fill="url(#g1)"/>
    <circle cx="100" cy="100" r="50" fill="url(#g2)" opacity="0.9"/>
    <g fill="${c3}" opacity="0.8">
      <circle cx="60" cy="70" r="2"/>
      <circle cx="140" cy="80" r="1.5"/>
      <circle cx="80" cy="130" r="2"/>
      <circle cx="135" cy="135" r="2.5"/>
      <circle cx="100" cy="50" r="1.5"/>
    </g>
    <path d="M 100 30 L 105 95 L 170 100 L 105 105 L 100 170 L 95 105 L 30 100 L 95 95 Z"
          fill="white" opacity="0.4"/>
  </svg>`;
  return 'data:image/svg+xml;base64,' + btoa(svg);
}

function SummonFlow({ paletteKey, theme, onCancel, onComplete }) {
  const [prompt, setPrompt] = sccState('');
  const [phase, setPhase] = sccState('idle'); // idle | forming | revealed | failed
  const [result, setResult] = sccState(null);
  const Sky = window.SC_SKY.Sky;
  const dustCanvasRef = sccRef(null);

  // Forming animation: cosmic dust gathering
  sccEffect(() => {
    if (phase !== 'forming') return;
    const canvas = dustCanvasRef.current;
    if (!canvas) return;
    const W = canvas.offsetWidth;
    const H = canvas.offsetHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr; canvas.height = H * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    const cx = W / 2, cy = H / 2;
    const particles = Array.from({ length: 200 }).map((_, i) => ({
      ang: Math.random() * Math.PI * 2,
      r: 60 + Math.random() * 200,
      speed: 0.6 + Math.random() * 0.8,
      hue: 30 + Math.random() * 60,
      size: 0.6 + Math.random() * 1.4,
    }));
    let raf, start = performance.now();
    const tick = () => {
      const t = (performance.now() - start) / 1000;
      ctx.clearRect(0, 0, W, H);
      // Glow center growing
      const coreR = Math.min(40, t * 18);
      const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR + 60);
      grd.addColorStop(0, 'rgba(255,240,180,0.85)');
      grd.addColorStop(0.5, 'rgba(255,200,120,0.35)');
      grd.addColorStop(1, 'rgba(255,200,120,0)');
      ctx.fillStyle = grd;
      ctx.beginPath(); ctx.arc(cx, cy, coreR + 60, 0, 6.28); ctx.fill();
      particles.forEach((p) => {
        p.r = Math.max(coreR + 4, p.r - p.speed);
        p.ang += 0.02;
        const x = cx + Math.cos(p.ang) * p.r;
        const y = cy + Math.sin(p.ang) * p.r;
        ctx.fillStyle = `hsla(${p.hue}, 90%, 75%, ${0.5 + 0.4 * Math.sin(t * 4 + p.r * 0.05)})`;
        ctx.beginPath(); ctx.arc(x, y, p.size, 0, 6.28); ctx.fill();
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    // Resolve after ~3.2s
    const timer = setTimeout(() => {
      const fail = false; // never fail in default flow; could be made probabilistic
      if (fail) setPhase('failed');
      else {
        setResult(PREBAKED_RESULTS[Math.floor(Math.random() * PREBAKED_RESULTS.length)]);
        setPhase('revealed');
      }
    }, 3200);
    return () => { cancelAnimationFrame(raf); clearTimeout(timer); };
  }, [phase]);

  return (
    <div style={{ position: 'absolute', inset: 0, color: '#fff', overflow: 'hidden' }}>
      <Sky theme={theme} paletteKey={paletteKey} gifts={[]} interactive={false} animation="drifty" />
      <div style={{ position: 'absolute', inset: 0, padding: '24px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <button onClick={onCancel} disabled={phase === 'forming'} style={{
            background: 'rgba(0,0,0,0.32)', backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.14)', color: '#fff',
            padding: '8px 14px', borderRadius: 999, cursor: phase === 'forming' ? 'not-allowed' : 'pointer',
            opacity: phase === 'forming' ? 0.5 : 1, fontFamily: 'var(--sc-sans)', fontSize: 13,
          }}>← Back</button>
          <div style={{ fontFamily: 'var(--sc-sans)', fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', opacity: 0.7 }}>
            summoning
          </div>
          <div style={{ width: 60 }} />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 22, maxWidth: 440, margin: '0 auto', width: '100%' }}>
          {phase === 'idle' && (
            <>
              <div style={{ fontFamily: 'var(--sc-serif)', fontSize: 34, fontWeight: 500, lineHeight: 1.15, fontStyle: 'italic', textShadow: '0 1px 12px rgba(0,0,0,0.5)' }}>
                Summon a star.
              </div>
              <div style={{ fontFamily: 'var(--sc-sans)', fontSize: 14, color: 'rgba(255,255,255,0.78)', maxWidth: 340, lineHeight: 1.5 }}>
                Describe it in one breath. The sky will do the rest.
              </div>
              <div style={{ position: 'relative', width: '100%' }}>
                <span style={{
                  position: 'absolute', left: 16, top: 14, color: 'rgba(255,255,255,0.45)',
                  fontFamily: 'var(--sc-serif)', fontStyle: 'italic', fontSize: 15, pointerEvents: 'none',
                  opacity: prompt ? 0 : 1, transition: 'opacity .15s',
                }}>
                  a star made of …
                </span>
                <textarea
                  value={prompt} onChange={(e) => setPrompt(e.target.value)}
                  rows={3} autoFocus
                  style={{
                    width: '100%', padding: '14px 16px', borderRadius: 16,
                    background: 'rgba(0,0,0,0.32)', backdropFilter: 'blur(20px)',
                    border: '1px solid rgba(255,255,255,0.18)',
                    color: '#fff', fontFamily: 'var(--sc-serif)', fontSize: 17, lineHeight: 1.5,
                    fontStyle: 'italic', textAlign: 'center', resize: 'none', outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              <Btn variant="primary" disabled={!prompt.trim()} onClick={() => setPhase('forming')}>
                ✧ Summon
              </Btn>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 4, fontStyle: 'italic' }}>
                each summoning costs a small amount
              </div>
            </>
          )}
          {phase === 'forming' && (
            <>
              <div style={{ position: 'relative', width: '100%', flex: 1, maxHeight: 380 }}>
                <canvas ref={dustCanvasRef} style={{ width: '100%', height: '100%' }} />
              </div>
              <div style={{ fontFamily: 'var(--sc-serif)', fontSize: 22, fontStyle: 'italic', textShadow: '0 1px 12px rgba(0,0,0,0.5)' }}>
                gathering the dust…
              </div>
              <div style={{ fontFamily: 'var(--sc-sans)', fontSize: 13, color: 'rgba(255,255,255,0.65)', maxWidth: 280, fontStyle: 'italic' }}>
                "{prompt}"
              </div>
            </>
          )}
          {phase === 'revealed' && (
            <>
              <div style={{
                fontFamily: 'var(--sc-serif)', fontSize: 28, fontStyle: 'italic',
                textShadow: '0 1px 12px rgba(0,0,0,0.5)',
              }}>
                It is yours.
              </div>
              <img src={result} style={{
                width: 200, height: 200, borderRadius: '50%',
                boxShadow: '0 0 80px rgba(255,220,150,0.5), 0 0 28px rgba(255,255,255,0.5)',
                animation: 'sc-bloom 1.2s cubic-bezier(0.2, 0.8, 0.2, 1)',
              }} />
              <div style={{ fontFamily: 'var(--sc-serif)', fontStyle: 'italic', color: 'rgba(255,255,255,0.78)', fontSize: 14, maxWidth: 300 }}>
                "{prompt}"
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
                <Btn variant="ghost" onClick={() => setPhase('forming')}>↺ Re-summon</Btn>
                <Btn variant="primary" onClick={() => onComplete(result)}>Keep this star</Btn>
              </div>
            </>
          )}
          {phase === 'failed' && (
            <>
              <div style={{ fontFamily: 'var(--sc-serif)', fontSize: 26, fontStyle: 'italic', textShadow: '0 1px 12px rgba(0,0,0,0.5)' }}>
                The stars didn't align.
              </div>
              <div style={{ fontFamily: 'var(--sc-sans)', fontSize: 14, color: 'rgba(255,255,255,0.7)' }}>
                "{prompt}"
              </div>
              <Btn variant="primary" onClick={() => setPhase('forming')}>Try again</Btn>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Goal Reached celebration
// ─────────────────────────────────────────────────────────────
function GoalReached({ chart, gifts, paletteKey, theme, onContinue }) {
  const Sky = window.SC_SKY.Sky;
  const burstRef = sccRef(null);
  sccEffect(() => {
    const canvas = burstRef.current;
    if (!canvas) return;
    const W = canvas.offsetWidth, H = canvas.offsetHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr; canvas.height = H * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    const particles = Array.from({ length: 80 }).map(() => {
      const ang = Math.random() * Math.PI * 2;
      return {
        x: W / 2, y: H * 0.45,
        vx: Math.cos(ang) * (3 + Math.random() * 7),
        vy: Math.sin(ang) * (3 + Math.random() * 7),
        life: 1.0, size: 1 + Math.random() * 2.5,
        hue: 30 + Math.random() * 30,
      };
    });
    let raf, start = performance.now();
    const tick = () => {
      const t = (performance.now() - start) / 1000;
      ctx.clearRect(0, 0, W, H);
      particles.forEach((p) => {
        p.x += p.vx; p.y += p.vy;
        p.vy += 0.04; p.vx *= 0.99;
        p.life *= 0.985;
        ctx.globalAlpha = p.life;
        const grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 4);
        grd.addColorStop(0, `hsla(${p.hue}, 90%, 80%, 1)`);
        grd.addColorStop(1, `hsla(${p.hue}, 90%, 80%, 0)`);
        ctx.fillStyle = grd;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * 4, 0, 6.28); ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, 6.28); ctx.fill();
      });
      ctx.globalAlpha = 1;
      if (t < 5) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div style={{ position: 'absolute', inset: 0, color: '#fff', overflow: 'hidden' }}>
      <Sky theme={theme} paletteKey={paletteKey} gifts={gifts} interactive={false} animation="lively" />
      <canvas ref={burstRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 32,
        background: 'radial-gradient(circle at 50% 50%, rgba(0,0,0,0.0), rgba(0,0,0,0.45) 100%)',
      }}>
        <div style={{
          fontFamily: 'var(--sc-sans)', fontSize: 11, letterSpacing: '0.3em', textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.7)', marginBottom: 20,
          animation: 'sc-fade 1s ease-out',
        }}>
          the goal is reached
        </div>
        <div style={{
          fontFamily: 'var(--sc-serif)', fontSize: 'clamp(36px, 9vw, 72px)', fontWeight: 500,
          lineHeight: 1.05, marginBottom: 18, letterSpacing: '-0.01em',
          textShadow: '0 4px 28px rgba(0,0,0,0.5), 0 0 40px rgba(255,220,150,0.3)',
          animation: 'sc-rise 1.2s cubic-bezier(0.2, 0.8, 0.2, 1)',
          maxWidth: 540, textWrap: 'balance',
        }}>
          {chart.reward}
        </div>
        <div style={{
          fontFamily: 'var(--sc-serif)', fontSize: 17, fontStyle: 'italic',
          color: 'rgba(255,255,255,0.75)', maxWidth: 360, lineHeight: 1.5,
          animation: 'sc-rise 1.4s cubic-bezier(0.2, 0.8, 0.2, 1)',
        }}>
          {chart.goal_count} stars given. {chart.name} is now a constellation.
        </div>
        <div style={{ marginTop: 36, animation: 'sc-fade 1.6s ease-out' }}>
          <Btn variant="primary" onClick={onContinue}>Visit the constellation</Btn>
        </div>
      </div>
    </div>
  );
}

window.SC_SCREENS_C = { SummonFlow, GoalReached };

// app.jsx — Main app: state, routing, Tweaks integration, theme application.

const { useState: appState, useEffect: appEffect, useMemo: appMemo, useRef: appRef } = React;

const { SignIn, Dashboard, CreateChart } = window.SC_SCREENS_A;
const { ChartSky, GiftCard, GiftFlow } = window.SC_SCREENS_B;
const { SummonFlow, GoalReached } = window.SC_SCREENS_C;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "dark",
  "palette": "midnight",
  "type": "cormorant",
  "density": "regular",
  "animation": "drifty",
  "persona": "family",
  "demoStyle": "gold"
}/*EDITMODE-END*/;

// Helper: build a gifts dataset from persona sample data, spaced out in time
function buildGifts(persona, chartId, count) {
  const reasons = persona.sampleReasons.slice(0, count);
  const now = Date.now();
  return reasons.map((r, i) => ({
    id: `${chartId}-g${i}`,
    chart_id: chartId,
    giver: r.giver,
    honorees: [r.honoree],
    reason: r.reason,
    count: r.count,
    style: r.style,
    created_at: now - (count - i) * (1000 * 60 * 60 * 18) - i * 1234,
  }));
}

function App({ deviceMode = 'mobile', t, setTweak }) {
  const persona = window.SC_TOKENS.PERSONAS[t.persona] || window.SC_TOKENS.PERSONAS.family;
  const typePair = window.SC_TOKENS.TYPE_PAIRINGS[t.type] || window.SC_TOKENS.TYPE_PAIRINGS.cormorant;

  // Sample data
  const initialState = appMemo(() => {
    const activeChartId = 'c-active';
    const completedChartId = 'c-complete';
    const charts = [
      { id: activeChartId, name: persona.activeChart.name, goal_count: persona.activeChart.goal, reward: persona.activeChart.reward, created_at: Date.now() - 1000 * 60 * 60 * 24 * 30, completed_at: null },
      { id: completedChartId, name: persona.completedChart.name, goal_count: persona.completedChart.goal, reward: persona.completedChart.reward, created_at: Date.now() - 1000 * 60 * 60 * 24 * 90, completed_at: Date.now() - 1000 * 60 * 60 * 24 * 14 },
    ];
    // Active: ~36 of 50 (or scaled). Completed: full 30 worth.
    const active = buildGifts(persona, activeChartId, Math.min(persona.sampleReasons.length, 12));
    const completedCount = persona.completedChart.goal;
    const completedReasons = [];
    let remaining = completedCount;
    let i = 0;
    while (remaining > 0 && i < persona.sampleReasons.length * 2) {
      const r = persona.sampleReasons[i % persona.sampleReasons.length];
      const c = Math.min(r.count, remaining);
      completedReasons.push({ ...r, count: c });
      remaining -= c;
      i++;
    }
    const completed = completedReasons.map((r, i) => ({
      id: `${completedChartId}-g${i}`,
      chart_id: completedChartId,
      giver: r.giver, honorees: [r.honoree],
      reason: r.reason, count: r.count, style: r.style,
      created_at: Date.now() - 1000 * 60 * 60 * 24 * (60 - i * 1.5),
    }));
    return { charts, gifts: [...active, ...completed] };
  }, [t.persona]);

  const [route, setRoute] = appState({ name: 'signin' }); // signin | dashboard | chart | create | summon | goal | gift
  const [charts, setCharts] = appState(initialState.charts);
  const [gifts, setGifts] = appState(initialState.gifts);
  const [arrivingGiftId, setArrivingGiftId] = appState(null);
  const [selectedGift, setSelectedGift] = appState(null);
  const [giftFlowOpen, setGiftFlowOpen] = appState(false);
  const [summonOpen, setSummonOpen] = appState(false);
  const [customResult, setCustomResult] = appState(null);
  const currentUserId = persona.members[0].id;
  const presence = appMemo(() => {
    if (route.name !== 'chart') return [];
    // Simulate one other member viewing the active chart
    const other = persona.members.find(m => m.id !== currentUserId);
    return other ? [{ name: other.name, color: other.color }] : [];
  }, [route, persona]);

  // Reset data when persona changes
  appEffect(() => {
    setCharts(initialState.charts);
    setGifts(initialState.gifts);
    setRoute({ name: 'signin' });
  }, [t.persona]);

  // Apply theme + type as CSS vars on the host element
  const hostRef = appRef(null);
  appEffect(() => {
    const palette = window.SC_TOKENS.SKY_PALETTES[t.palette][t.theme];
    const root = hostRef.current;
    if (!root) return;
    root.style.setProperty('--sc-fg', palette.fg);
    root.style.setProperty('--sc-fg-muted', palette.fgMuted);
    root.style.setProperty('--sc-fg-faint', palette.fgFaint);
    root.style.setProperty('--sc-bg', palette.gradient[0]);
    root.style.setProperty('--sc-surface', palette.surface);
    root.style.setProperty('--sc-surface-solid', palette.surfaceSolid);
    root.style.setProperty('--sc-stroke', palette.stroke);
    root.style.setProperty('--sc-gold', palette.gold);
    root.style.setProperty('--sc-serif', typePair.serif);
    root.style.setProperty('--sc-sans', typePair.sans);
    root.style.setProperty('color-scheme', t.theme);
  }, [t.theme, t.palette, t.type]);

  // ── Actions ────────────────────────────────────────────────
  const openChart = (chartId) => {
    const chart = charts.find(c => c.id === chartId);
    if (chart && chart.completed_at) setRoute({ name: 'memory', chartId });
    else setRoute({ name: 'chart', chartId });
  };

  const sendGift = (g) => {
    const chartId = route.chartId;
    if (!chartId) return;
    const chart = charts.find(c => c.id === chartId);
    const newId = `${chartId}-g-${Date.now()}`;
    const newGift = {
      id: newId,
      chart_id: chartId,
      giver: currentUserId,
      honorees: g.honorees,
      reason: g.reason,
      count: g.count,
      style: g.style,
      custom_image_url: g.custom_image_url || null,
      created_at: Date.now(),
      _arrivedAt: performance.now(),
    };
    setGifts(prev => [...prev, newGift]);
    setArrivingGiftId(newId);
    setGiftFlowOpen(false);
    setCustomResult(null);
    setTimeout(() => setArrivingGiftId(null), 2000);

    // Check goal
    const newTotal = gifts.filter(x => x.chart_id === chartId).reduce((s, x) => s + x.count, 0) + g.count;
    if (newTotal >= chart.goal_count && !chart.completed_at) {
      setTimeout(() => {
        setCharts(prev => prev.map(c => c.id === chartId ? { ...c, completed_at: Date.now() } : c));
        setRoute({ name: 'goal', chartId });
      }, 1800);
    }
  };

  const createChart = ({ name, goal_count, reward }) => {
    const id = `c-${Date.now()}`;
    setCharts(prev => [{ id, name, goal_count, reward, created_at: Date.now(), completed_at: null }, ...prev]);
    setRoute({ name: 'chart', chartId: id });
  };

  // ── Render router ──────────────────────────────────────────
  const currentChart = (route.chartId) ? charts.find(c => c.id === route.chartId) : null;
  const currentChartGifts = currentChart ? gifts.filter(g => g.chart_id === currentChart.id) : [];

  return (
    <div ref={hostRef} style={{
      position: 'absolute', inset: 0, overflow: 'hidden',
      fontFamily: 'var(--sc-sans)',
      background: 'var(--sc-bg)',
    }}>
      {/* Global keyframes + CSS */}
      <style>{`
        @keyframes sc-slide-up { from { transform: translateY(8%); opacity: 0; } to { transform: none; opacity: 1; } }
        @keyframes sc-fade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes sc-rise { from { transform: translateY(20px); opacity: 0; } to { transform: none; opacity: 1; } }
        @keyframes sc-bloom { 0% { transform: scale(0.2); opacity: 0; } 60% { transform: scale(1.08); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
        ::-webkit-scrollbar { width: 0; height: 0; }
      `}</style>

      {route.name === 'signin' && (
        <SignIn paletteKey={t.palette} theme={t.theme} onSubmit={() => setRoute({ name: 'dashboard' })} />
      )}
      {route.name === 'dashboard' && (
        <Dashboard
          group={{ name: persona.groupName, members: persona.members }}
          charts={charts} gifts={gifts}
          paletteKey={t.palette} theme={t.theme}
          onOpenChart={openChart}
          onCreateChart={() => setRoute({ name: 'create' })}
        />
      )}
      {route.name === 'create' && (
        <CreateChart
          paletteKey={t.palette} theme={t.theme}
          onCancel={() => setRoute({ name: 'dashboard' })}
          onCreate={createChart}
        />
      )}
      {route.name === 'chart' && currentChart && (
        <ChartSky
          chart={currentChart} gifts={currentChartGifts}
          group={{ name: persona.groupName, members: persona.members }}
          members={persona.members}
          paletteKey={t.palette} theme={t.theme}
          density={t.density} animation={t.animation}
          arrivingGiftId={arrivingGiftId}
          presence={presence}
          onBack={() => setRoute({ name: 'dashboard' })}
          onAddGift={() => setGiftFlowOpen(true)}
          onTapGift={(g) => setSelectedGift(g)}
        />
      )}
      {route.name === 'memory' && currentChart && (
        <ChartSky
          chart={currentChart} gifts={currentChartGifts}
          group={{ name: persona.groupName, members: persona.members }}
          members={persona.members}
          paletteKey={t.palette} theme={t.theme}
          density={t.density} animation="still"
          onBack={() => setRoute({ name: 'dashboard' })}
          onAddGift={() => null}
          onTapGift={(g) => setSelectedGift(g)}
        />
      )}
      {route.name === 'goal' && currentChart && (
        <GoalReached
          chart={currentChart} gifts={currentChartGifts}
          paletteKey={t.palette} theme={t.theme}
          onContinue={() => setRoute({ name: 'memory', chartId: currentChart.id })}
        />
      )}

      {selectedGift && (
        <GiftCard gift={selectedGift} members={persona.members} onClose={() => setSelectedGift(null)} />
      )}

      {giftFlowOpen && currentChart && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 60 }}>
          <GiftFlow
            group={{ name: persona.groupName, members: persona.members }}
            members={persona.members}
            currentUserId={currentUserId}
            paletteKey={t.palette} theme={t.theme}
            customResult={customResult}
            onCancel={() => { setGiftFlowOpen(false); setCustomResult(null); }}
            onOpenSummon={() => { setGiftFlowOpen(false); setSummonOpen(true); }}
            onSend={sendGift}
          />
        </div>
      )}

      {summonOpen && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 70 }}>
          <SummonFlow
            paletteKey={t.palette} theme={t.theme}
            onCancel={() => { setSummonOpen(false); setGiftFlowOpen(true); }}
            onComplete={(url) => { setCustomResult(url); setSummonOpen(false); setGiftFlowOpen(true); }}
          />
        </div>
      )}

      {/* Mini scene navigator (for prototype reviewers) */}
      <SceneNav route={route} setRoute={setRoute} charts={charts} theme={t.theme} setTweak={setTweak} />
    </div>
  );
}

function TweaksHost() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  return (
    <TweaksPanel>
      <TweakSection label="Theme" />
      <TweakRadio label="Mode" value={t.theme} options={['dark', 'light']} onChange={(v) => setTweak('theme', v)} />
      <TweakSelect label="Sky palette" value={t.palette}
        options={Object.entries(window.SC_TOKENS.SKY_PALETTES).map(([k, v]) => ({ value: k, label: v.label }))}
        onChange={(v) => setTweak('palette', v)} />
      <TweakSelect label="Typography" value={t.type}
        options={Object.entries(window.SC_TOKENS.TYPE_PAIRINGS).map(([k, v]) => ({ value: k, label: v.label }))}
        onChange={(v) => setTweak('type', v)} />
      <TweakSection label="Sky behavior" />
      <TweakRadio label="Density" value={t.density} options={['sparse', 'regular', 'dense']} onChange={(v) => setTweak('density', v)} />
      <TweakRadio label="Animation" value={t.animation} options={['still', 'drifty', 'lively']} onChange={(v) => setTweak('animation', v)} />
      <TweakSection label="Sample data" />
      <TweakRadio label="Persona" value={t.persona} options={['family', 'couple', 'friends']} onChange={(v) => setTweak('persona', v)} />
    </TweaksPanel>
  );
}

// Shared tweaks state across multiple App instances on a canvas.
function useSharedTweaks() {
  const [t, setT] = React.useState(TWEAK_DEFAULTS);
  React.useEffect(() => {
    const handler = (e) => {
      if (e.data && e.data.type === '__sc_tweaks_update') setT(e.data.tweaks);
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);
  return t;
}

// ─────────────────────────────────────────────────────────────
// Scene navigator — tiny floating chip-bar for jumping between scenes
// ─────────────────────────────────────────────────────────────
function SceneNav({ route, setRoute, charts, theme, setTweak }) {
  const items = [
    { id: 'signin', label: 'Sign in', go: () => setRoute({ name: 'signin' }) },
    { id: 'dashboard', label: 'Dashboard', go: () => setRoute({ name: 'dashboard' }) },
    { id: 'create', label: 'Create', go: () => setRoute({ name: 'create' }) },
  ];
  const isDark = theme === 'dark';
  return (
    <div style={{
      position: 'absolute', top: 8, right: 8, zIndex: 100,
      display: 'flex', gap: 6, alignItems: 'center',
      pointerEvents: 'none',
    }}>
      <div style={{
        display: 'flex', gap: 2, padding: 3, borderRadius: 999,
        background: 'rgba(0,0,0,0.42)', backdropFilter: 'blur(20px)',
        border: '0.5px solid rgba(255,255,255,0.18)',
        pointerEvents: 'auto',
      }}>
        <button
          onClick={() => setTweak('theme', 'light')}
          title="Light"
          style={{
            width: 26, height: 26, borderRadius: 999,
            background: !isDark ? 'rgba(255,255,255,0.92)' : 'transparent',
            color: !isDark ? '#0e1224' : '#fff',
            border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 0, transition: 'background .15s, color .15s',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
          </svg>
        </button>
        <button
          onClick={() => setTweak('theme', 'dark')}
          title="Dark"
          style={{
            width: 26, height: 26, borderRadius: 999,
            background: isDark ? 'rgba(255,255,255,0.18)' : 'transparent',
            color: '#fff',
            border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 0, transition: 'background .15s',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        </button>
      </div>
      <button
        onClick={() => window.postMessage({ type: '__activate_edit_mode' }, '*')}
        title="Open tweaks"
        style={{
          height: 30, padding: '0 12px', borderRadius: 999,
          background: 'rgba(0,0,0,0.42)', backdropFilter: 'blur(20px)',
          border: '0.5px solid rgba(255,255,255,0.18)',
          color: '#fff', cursor: 'pointer', pointerEvents: 'auto',
          display: 'flex', alignItems: 'center', gap: 6,
          fontFamily: 'var(--sc-sans)', fontSize: 11, fontWeight: 500,
          letterSpacing: '0.04em',
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="4" y1="6" x2="14" y2="6" />
          <circle cx="17" cy="6" r="2" />
          <line x1="4" y1="12" x2="9" y2="12" />
          <circle cx="12" cy="12" r="2" />
          <line x1="4" y1="18" x2="16" y2="18" />
          <circle cx="19" cy="18" r="2" />
        </svg>
        Tweaks
      </button>
      <div style={{
        display: 'flex', gap: 4, padding: '5px 6px', borderRadius: 999,
        background: 'rgba(0,0,0,0.42)', backdropFilter: 'blur(20px)',
        border: '0.5px solid rgba(255,255,255,0.18)',
        pointerEvents: 'auto',
      }}>
        {items.map((it) => {
          const on = route.name === it.id;
          return (
            <button key={it.id} onClick={it.go} style={{
              background: on ? 'rgba(255,255,255,0.18)' : 'transparent',
              color: '#fff', border: 'none', cursor: 'pointer',
              fontFamily: 'var(--sc-sans)', fontSize: 10, fontWeight: 500,
              padding: '5px 9px', borderRadius: 999, letterSpacing: '0.04em',
            }}>{it.label}</button>
          );
        })}
      </div>
    </div>
  );
}

window.SC_APP = { App, TweaksHost, TWEAK_DEFAULTS };

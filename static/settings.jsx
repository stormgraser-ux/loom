// Loom — Settings modal (tabbed)

const SETTINGS_TABS = [
  { id: 'model',    label: 'Model',    icon: 'cpu' },
  { id: 'sampler',  label: 'Sampler',  icon: 'sliders' },
  { id: 'system',   label: 'System prompt', icon: 'file' },
  { id: 'status',   label: 'Status bar', icon: 'dot' },
  { id: 'weave',    label: 'Weave mode', icon: 'thread' },
  { id: 'appearance', label: 'Appearance', icon: 'palette' },
  { id: 'tools',    label: 'Tools',    icon: 'globe' },
  { id: 'data',     label: 'Data',     icon: 'save' },
];

function SettingsModal({ onClose, statusVisible, setStatusVisible, weaveMode, setWeaveMode, tweaks, setTweaks, config, onSaveConfig, onRefreshModels }) {
  const [tab, setTab] = useState('sampler');

  const [modelCfg, setModelCfg] = useState({
    base_url: config?.base_url || 'http://127.0.0.1:11434/v1',
    model: config?.model || '',
    thinking: config?.thinking ?? false,
    max_recent_messages: config?.max_recent_messages || 40,
    timeout: config?.timeout || 120,
  });
  const [samp, setSamp] = useState({
    temperature: config?.temperature ?? 0.7,
    top_p: config?.top_p ?? 0.9,
    min_p: config?.min_p ?? 0.05,
    rep_penalty: config?.rep_penalty ?? 1.1,
    max_tokens: config?.max_tokens ?? 2048,
  });
  const [toolsCfg, setToolsCfg] = useState({
    max_tool_rounds: config?.max_tool_rounds ?? 5,
    allowed_read_dirs: (config?.allowed_read_dirs || []).join('\n'),
    web_search_result_count: config?.web_search_result_count ?? 5,
  });
  const [systemPrompt, setSystemPrompt] = useState('');
  const [systemPromptDirty, setSystemPromptDirty] = useState(false);

  const initialRef = useRef(null);
  if (!initialRef.current) {
    initialRef.current = { modelCfg: { ...modelCfg }, samp: { ...samp }, toolsCfg: { ...toolsCfg } };
  }

  function handleClose() {
    const patch = {};
    const init = initialRef.current;
    for (const [k, v] of Object.entries(modelCfg)) {
      if (v !== init.modelCfg[k]) patch[k] = v;
    }
    for (const [k, v] of Object.entries(samp)) {
      if (v !== init.samp[k]) patch[k] = v;
    }
    if (toolsCfg.max_tool_rounds !== init.toolsCfg.max_tool_rounds) {
      patch.max_tool_rounds = toolsCfg.max_tool_rounds;
    }
    if (toolsCfg.web_search_result_count !== init.toolsCfg.web_search_result_count) {
      patch.web_search_result_count = toolsCfg.web_search_result_count;
    }
    if (toolsCfg.allowed_read_dirs !== init.toolsCfg.allowed_read_dirs) {
      patch.allowed_read_dirs = toolsCfg.allowed_read_dirs.split('\n').map(s => s.trim()).filter(Boolean);
    }
    if (Object.keys(patch).length) {
      onSaveConfig(patch);
    }
    onClose();
  }

  return (
    <div className="modal-backdrop" onClick={handleClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <LoomMark size={22} style={{ color: 'var(--candle)' }} />
            <div className="title">Settings</div>
          </div>
          <button className="iconbtn" onClick={handleClose}><Icon name="close" /></button>
        </div>
        <div className="modal-body">
          <div className="settings-tabs">
            {SETTINGS_TABS.map(t => (
              <button key={t.id} className={'settings-tab ' + (tab === t.id ? 'active' : '')} onClick={() => setTab(t.id)}>
                <Icon name={t.icon} size={14} />
                <span>{t.label}</span>
              </button>
            ))}
          </div>
          <div className="settings-panel">
            {tab === 'model' && <ModelPanel cfg={modelCfg} setCfg={setModelCfg} onRefreshModels={onRefreshModels} />}
            {tab === 'sampler' && <SamplerPanel samp={samp} setSamp={setSamp} />}
            {tab === 'system' && <SystemPromptPanel prompt={systemPrompt} setPrompt={setSystemPrompt} dirty={systemPromptDirty} setDirty={setSystemPromptDirty} />}
            {tab === 'status' && <StatusBuilderPanel visible={statusVisible} setVisible={setStatusVisible} />}
            {tab === 'weave' && <WeaveModePanel mode={weaveMode} setMode={setWeaveMode} />}
            {tab === 'appearance' && <AppearancePanel tweaks={tweaks} setTweaks={setTweaks} />}
            {tab === 'tools' && <ToolsPanel cfg={toolsCfg} setCfg={setToolsCfg} />}
            {tab === 'data' && <DataPanel />}
          </div>
        </div>
      </div>
    </div>
  );
}

function OllamaProgress({ status }) {
  if (!status) return null;

  const isDownloading = status.total && status.completed != null;
  const pct = isDownloading ? Math.round((status.completed / status.total) * 100) : null;

  const fmtBytes = (n) => {
    if (n >= 1e9) return `${(n / 1e9).toFixed(1)} GB`;
    if (n >= 1e6) return `${(n / 1e6).toFixed(0)} MB`;
    return `${n} B`;
  };

  let label = status.status || '';
  if (label.startsWith('downloading')) label = 'downloading\u2026';
  if (label === 'success') label = 'Done \u2014 model ready';
  if (label === 'error') label = status.error || 'Failed';

  const color = status.status === 'error' ? 'var(--ember)'
    : status.status === 'success' ? 'var(--candle)'
    : 'var(--fg-ghost)';

  return (
    <div style={{ marginTop: 8 }}>
      {pct !== null && (
        <div style={{ height: 4, borderRadius: 2, background: 'var(--ink-3)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: 'var(--candle)', borderRadius: 2, transition: 'width 0.3s' }} />
        </div>
      )}
      <div className="mono" style={{ fontSize: 10.5, color, marginTop: 4, display: 'flex', justifyContent: 'space-between' }}>
        <span>{label}</span>
        {pct !== null && <span>{pct}% {'\u00b7'} {fmtBytes(status.completed)} / {fmtBytes(status.total)}</span>}
      </div>
    </div>
  );
}

function ModelPanel({ cfg, setCfg, onRefreshModels }) {
  const set = (k, v) => setCfg({ ...cfg, [k]: v });
  const [models, setModels] = useState(null);
  const [loading, setLoading] = useState(false);
  const [pullName, setPullName] = useState('');
  const [pulling, setPulling] = useState(false);
  const [pullProgress, setPullProgress] = useState(null);
  const [importName, setImportName] = useState('');
  const [importPath, setImportPath] = useState('');
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(null);
  const [catalog, setCatalog] = useState(null);
  const [hardware, setHardware] = useState(null);
  const [selectedTier, setSelectedTier] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('general');
  const [quantOverrides, setQuantOverrides] = useState({});
  const [abliterated, setAbliterated] = useState(false);

  useEffect(() => {
    refreshModels();
    Promise.all([API.getCatalog(), API.getHardware()])
      .then(([cat, hw]) => {
        setCatalog(cat);
        setHardware(hw);
        if (hw.vram_gb) {
          const best = cat.tiers.reduce((prev, curr) =>
            curr <= hw.vram_gb && curr > prev ? curr : prev, cat.tiers[0]);
          setSelectedTier(best);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => { setQuantOverrides({}); }, [selectedTier, selectedCategory, abliterated]);

  function refreshModels() {
    setLoading(true);
    API.listModels()
      .then(setModels)
      .catch(() => setModels([]))
      .finally(() => setLoading(false));
  }

  function doPull(name) {
    if (!name || pulling) return;
    setPullName(name);
    setPulling(true);
    setPullProgress({ status: 'starting\u2026' });
    API.pullModel(name, (evt) => {
      if (evt.status === 'success') {
        setPulling(false);
        setPullProgress({ status: 'success' });
        setPullName('');
        refreshModels();
        onRefreshModels?.();
      } else if (evt.status === 'error') {
        setPulling(false);
        setPullProgress({ status: 'error', error: evt.error || 'Unknown error' });
      } else {
        setPullProgress(evt);
      }
    });
  }

  function handlePull() {
    doPull(pullName.trim());
  }

  function handleImport() {
    if (!importName.trim() || !importPath.trim() || importing) return;
    setImporting(true);
    setImportProgress({ status: 'starting\u2026' });
    API.importModel(importName.trim(), importPath.trim(), (evt) => {
      if (evt.status === 'success') {
        setImporting(false);
        setImportProgress({ status: 'success' });
        setImportName('');
        setImportPath('');
        refreshModels();
        onRefreshModels?.();
      } else if (evt.status === 'error') {
        setImporting(false);
        setImportProgress({ status: 'error', error: evt.error || 'Unknown error' });
      } else {
        setImportProgress(evt);
      }
    });
  }

  const active = cfg.model;
  const installedIds = (models || []).map(m => m.id);
  const isTagInstalled = (tag) => {
    const base = tag.split('-q')[0];
    return installedIds.some(id => id === tag || id.startsWith(base + '-') || id === base);
  };
  const recsSource = abliterated ? catalog?.abliterated : catalog?.models;
  const recs = recsSource?.[selectedTier]?.[selectedCategory];

  function getQuant(rec, i) {
    const def = catalog.defs[rec.ref];
    const qi = quantOverrides[i] ?? rec.rec;
    return { def, qi, q: def.quants[qi] };
  }

  function adjustQuant(i, delta) {
    const rec = recs[i];
    const def = catalog.defs[rec.ref];
    const current = quantOverrides[i] ?? rec.rec;
    const next = Math.max(0, Math.min(def.quants.length - 1, current + delta));
    setQuantOverrides({ ...quantOverrides, [i]: next });
  }

  return (
    <>
      <h3>Model</h3>
      <div className="desc">Loom connects to any OpenAI-compatible endpoint. Models are discovered from Ollama automatically.</div>
      <div className="setting-row">
        <div className="setting-label">Endpoint<span className="hint">OpenAI-compatible base URL</span></div>
        <div className="setting-ctrl">
          <input className="text-input" value={cfg.base_url} onChange={e => set('base_url', e.target.value)} />
        </div>
      </div>
      <div className="setting-row">
        <div className="setting-label">Active model<span className="hint">{loading ? 'Scanning endpoint\u2026' : models ? `${models.length} model${models.length !== 1 ? 's' : ''} found` : 'Could not reach endpoint'}</span></div>
        <div className="setting-ctrl">
          {models && models.length > 0 ? (
            <div style={{ display: 'grid', gap: 6 }}>
              {models.map(m => {
                const selected = m.id === active;
                const detail = [m.params, m.quant, m.size].filter(Boolean).join(' \u00b7 ');
                return (
                  <label key={m.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 12px', borderRadius: 6, cursor: 'pointer',
                    background: selected ? 'color-mix(in oklch, var(--candle) 10%, var(--ink-3))' : 'var(--ink-3)',
                    border: '1px solid ' + (selected ? 'color-mix(in oklch, var(--candle) 45%, transparent)' : 'var(--border-soft)'),
                  }}>
                    <input type="radio" checked={selected} onChange={() => set('model', m.id)} style={{ accentColor: 'var(--candle)' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="mono" style={{ fontSize: 13.5, color: 'var(--fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</div>
                      <div className="mono" style={{ fontSize: 10.5, color: 'var(--fg-ghost)', marginTop: 2 }}>
                        {detail}
                        {m.thinks && <span style={{ marginLeft: 6, color: 'var(--candle-dim)', fontSize: 9.5 }}>{'\u2022'} thinks</span>}
                      </div>
                    </div>
                    {selected && <span style={{ fontSize: 10, color: 'var(--candle)', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>active</span>}
                  </label>
                );
              })}
            </div>
          ) : (
            <input className="text-input" value={cfg.model} onChange={e => set('model', e.target.value)} placeholder="Model name" />
          )}
        </div>
      </div>

      {catalog && (
        <>
          <div style={{ borderTop: '1px solid var(--border-soft)', margin: '16px 0 8px' }} />
          <div className="setting-row">
            <div className="setting-label">
              Find a model
              <span className="hint">{hardware?.gpu ? `${hardware.gpu} \u00b7 ${hardware.vram_gb} GB VRAM` : 'Pick your VRAM tier for recommendations'}</span>
            </div>
            <div className="setting-ctrl">
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                {catalog.tiers.map(t => (
                  <button key={t} className={'sb-chip ' + (selectedTier === t ? 'on' : '')} onClick={() => setSelectedTier(t)}>
                    <span>{t} GB</span>
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {catalog.categories.map(c => (
                  <button key={c.id} className={'sb-chip ' + (selectedCategory === c.id ? 'on' : '')} onClick={() => setSelectedCategory(c.id)}>
                    <span>{c.label}</span>
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                <div className={'switch ' + (abliterated ? 'on' : '')} onClick={() => setAbliterated(!abliterated)} style={{ cursor: 'pointer', flexShrink: 0 }} />
                <span className="mono" style={{ fontSize: 11.5, color: abliterated ? 'var(--candle)' : 'var(--fg-ghost)' }}>Abliterated</span>
              </div>
            </div>
          </div>
          {selectedTier && recs && (
            <div className="setting-row">
              <div className="setting-label">
                Recommended
                <span className="hint">Top picks for {selectedTier} GB {'\u00b7'} {selectedCategory}{abliterated ? ' · abliterated' : ''}</span>
              </div>
              <div className="setting-ctrl">
                <div style={{ display: 'grid', gap: 6 }}>
                  {recs.map((rec, i) => {
                    const { def, qi, q } = getQuant(rec, i);
                    const installed = isTagInstalled(q.tag);
                    const sizeNum = parseFloat(q.size);
                    const overBudget = sizeNum > selectedTier;
                    return (
                      <div key={rec.ref + '-' + i} style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '10px 12px', borderRadius: 6,
                        background: i === 0 ? 'color-mix(in oklch, var(--candle) 8%, var(--ink-3))' : 'var(--ink-3)',
                        border: '1px solid ' + (i === 0 ? 'color-mix(in oklch, var(--candle) 30%, transparent)' : 'var(--border-soft)'),
                      }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="mono" style={{ fontSize: 13, color: 'var(--fg)' }}>{rec.ref}</div>
                          <div style={{ fontSize: 11, color: 'var(--fg-dim)', marginTop: 2 }}>{rec.why}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                            <button className="quant-btn" onClick={() => adjustQuant(i, -1)} disabled={qi === 0} style={{
                              width: 20, height: 20, borderRadius: 4, border: '1px solid var(--border-soft)',
                              background: qi === 0 ? 'transparent' : 'var(--ink-3)', color: qi === 0 ? 'var(--fg-ghost)' : 'var(--fg)',
                              cursor: qi === 0 ? 'default' : 'pointer', fontSize: 13, lineHeight: '18px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                            }}>{'\u2212'}</button>
                            <span className="mono" style={{ fontSize: 10.5, color: overBudget ? 'var(--ember)' : 'var(--fg-ghost)', minWidth: 140, textAlign: 'center' }}>
                              {q.level} {'\u00b7'} {q.size}{overBudget ? ' \u2014 over' : ''}
                            </span>
                            <button className="quant-btn" onClick={() => adjustQuant(i, 1)} disabled={qi === def.quants.length - 1} style={{
                              width: 20, height: 20, borderRadius: 4, border: '1px solid var(--border-soft)',
                              background: qi === def.quants.length - 1 ? 'transparent' : 'var(--ink-3)', color: qi === def.quants.length - 1 ? 'var(--fg-ghost)' : 'var(--fg)',
                              cursor: qi === def.quants.length - 1 ? 'default' : 'pointer', fontSize: 13, lineHeight: '18px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                            }}>+</button>
                          </div>
                        </div>
                        {installed ? (
                          <span className="mono" style={{ fontSize: 10, color: 'var(--candle)', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>installed</span>
                        ) : (
                          <button className="send-btn" style={{
                            background: pulling ? 'var(--ink-3)' : 'var(--candle)',
                            color: pulling ? 'var(--fg-faint)' : 'var(--ink)',
                            border: 'none', whiteSpace: 'nowrap', fontSize: 11,
                          }} onClick={() => doPull(q.tag)} disabled={pulling}>
                            Pull
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
                <OllamaProgress status={pullProgress} />
                <div className="mono" style={{ fontSize: 9.5, color: 'var(--fg-ghost)', marginTop: 8 }}>catalog updated {catalog.updated}</div>
              </div>
            </div>
          )}
          {selectedTier && abliterated && !recs && (
            <div className="setting-row">
              <div className="setting-label">Recommended<span className="hint">Abliterated {'·'} {selectedCategory} {'·'} {selectedTier} GB</span></div>
              <div className="setting-ctrl">
                <div style={{ fontSize: 11.5, color: 'var(--fg-ghost)', padding: '12px 0' }}>
                  No curated abliterated models for this combination yet. Use the pull field below to grab any model by name.
                </div>
              </div>
            </div>
          )}
        </>
      )}

      <div className="setting-row">
        <div className="setting-label">Pull model<span className="hint">Download from Ollama registry</span></div>
        <div className="setting-ctrl">
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="text-input" style={{ flex: 1 }} value={pullName} onChange={e => setPullName(e.target.value)} placeholder="e.g. mistral-nemo" onKeyDown={e => e.key === 'Enter' && handlePull()} disabled={pulling} />
            <button className="send-btn" style={{ background: pulling ? 'var(--ink-3)' : 'var(--candle)', color: pulling ? 'var(--fg-faint)' : 'var(--ink)', border: 'none', whiteSpace: 'nowrap' }} onClick={handlePull} disabled={pulling}>
              {pulling ? 'Pulling\u2026' : 'Pull'}
            </button>
          </div>
          <OllamaProgress status={pullProgress} />
        </div>
      </div>
      <div className="setting-row">
        <div className="setting-label">Import GGUF<span className="hint">Register a local file with Ollama</span></div>
        <div className="setting-ctrl">
          <div style={{ display: 'grid', gap: 6 }}>
            <input className="text-input" value={importName} onChange={e => setImportName(e.target.value)} placeholder="Model name, e.g. my-model" disabled={importing} />
            <input className="text-input" value={importPath} onChange={e => setImportPath(e.target.value)} placeholder="/path/to/model.gguf" onKeyDown={e => e.key === 'Enter' && handleImport()} disabled={importing} />
          </div>
          <button className="send-btn" style={{ marginTop: 8, background: importing ? 'var(--ink-3)' : 'var(--candle)', color: importing ? 'var(--fg-faint)' : 'var(--ink)', border: 'none' }} onClick={handleImport} disabled={importing}>
            {importing ? 'Importing\u2026' : 'Import'}
          </button>
          <OllamaProgress status={importProgress} />
        </div>
      </div>
      <div className="setting-row">
        <div className="setting-label">Thinking<span className="hint">Let the model reason before responding. Uses more tokens but improves quality on hard questions.</span></div>
        <div className="setting-ctrl" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className={'switch ' + (cfg.thinking ? 'on' : '')} onClick={() => set('thinking', !cfg.thinking)} style={{ cursor: 'pointer' }} />
          <span className="mono" style={{ fontSize: 11.5, color: cfg.thinking ? 'var(--candle)' : 'var(--fg-faint)' }}>{cfg.thinking ? 'on by default' : 'off'}</span>
        </div>
      </div>
      <SliderRow label="Sliding window" hint="How many messages back to include from the trunk" min={4} max={120} step={2} value={cfg.max_recent_messages} onChange={v => set('max_recent_messages', v)} fmt={v => String(v)} />
      <SliderRow label="Timeout" hint="Seconds before aborting a stalled response" min={10} max={600} step={10} value={cfg.timeout} onChange={v => set('timeout', v)} fmt={v => `${v}s`} />
    </>
  );
}

const SAMPLER_DEFAULTS = { temperature: 0.7, top_p: 0.9, min_p: 0.05, rep_penalty: 1.1, max_tokens: 2048 };

const SAMPLER_PRESETS = [
  { id: 'balanced',  label: 'Balanced',  values: { temperature: 0.7, top_p: 0.9,  min_p: 0.05,  rep_penalty: 1.1,  max_tokens: 2048 } },
  { id: 'creative',  label: 'Creative',  values: { temperature: 1.0, top_p: 0.95, min_p: 0.03,  rep_penalty: 1.05, max_tokens: 4096 } },
  { id: 'precise',   label: 'Precise',   values: { temperature: 0.3, top_p: 0.85, min_p: 0.1,   rep_penalty: 1.15, max_tokens: 2048 } },
  { id: 'qwen',      label: 'Qwen',      values: { temperature: 0.7, top_p: 0.92, min_p: 0.05,  rep_penalty: 1.12, max_tokens: 2048 } },
  { id: 'llama',     label: 'Llama',     values: { temperature: 0.6, top_p: 0.9,  min_p: 0.05,  rep_penalty: 1.1,  max_tokens: 2048 } },
  { id: 'gemma',     label: 'Gemma',     values: { temperature: 0.7, top_p: 0.95, min_p: 0.02,  rep_penalty: 1.0,  max_tokens: 2048 } },
];

function detectPreset(s) {
  for (const p of SAMPLER_PRESETS) {
    if (Object.keys(p.values).every(k => s[k] === p.values[k])) return p.id;
  }
  return 'custom';
}

function SamplerPanel({ samp, setSamp }) {
  const s = samp;
  const set = (k, v) => setSamp({ ...s, [k]: v });
  const activePreset = detectPreset(s);
  return (
    <>
      <h3>Sampler</h3>
      <div className="desc">The knobs that shape each generation. Pick a preset to start, then fine-tune. Changes take effect on the next message.</div>
      <div className="setting-row">
        <div className="setting-label">Preset<span className="hint">Starting points for different models and styles</span></div>
        <div className="setting-ctrl" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <select className="text-input" value={activePreset} onChange={e => {
            const p = SAMPLER_PRESETS.find(x => x.id === e.target.value);
            if (p) setSamp({ ...s, ...p.values });
          }} style={{ flex: 1 }}>
            {activePreset === 'custom' && <option value="custom">Custom</option>}
            {SAMPLER_PRESETS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
          <button className="iconbtn" onClick={() => setSamp({ ...s, ...SAMPLER_DEFAULTS })} title="Reset to defaults" style={{ flexShrink: 0 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
          </button>
        </div>
      </div>
      <SliderRow label="Temperature" hint="Higher = more variety, lower = more deterministic" min={0} max={2} step={0.01} value={s.temperature} onChange={v => set('temperature', v)} fmt={v => v.toFixed(2)} />
      <SliderRow label="Top-p" hint="Nucleus sampling cutoff" min={0} max={1} step={0.01} value={s.top_p} onChange={v => set('top_p', v)} fmt={v => v.toFixed(2)} />
      <SliderRow label="Min-p" hint="Floor for token probability, relative to the top choice" min={0} max={0.5} step={0.005} value={s.min_p} onChange={v => set('min_p', v)} fmt={v => v.toFixed(3)} />
      <SliderRow label="Repetition penalty" hint="1.0 = off" min={0.8} max={1.6} step={0.01} value={s.rep_penalty} onChange={v => set('rep_penalty', v)} fmt={v => v.toFixed(2)} />
      <SliderRow label="Max response tokens" hint="Hard cap on a single reply" min={64} max={16384} step={64} value={s.max_tokens} onChange={v => set('max_tokens', v)} fmt={v => v.toLocaleString()} />
    </>
  );
}

function SliderRow({ label, hint, min, max, step, value, onChange, fmt }) {
  return (
    <div className="setting-row">
      <div className="setting-label">{label}<span className="hint">{hint}</span></div>
      <div className="setting-ctrl slider-row">
        <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(parseFloat(e.target.value))} />
        <div className="slider-val">{fmt(value)}</div>
      </div>
    </div>
  );
}

function SystemPromptPanel({ prompt, setPrompt, dirty, setDirty }) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [source, setSource] = useState('');
  const [presets, setPresets] = useState([]);
  const [activePresetId, setActivePresetId] = useState('');
  const [showSaveAs, setShowSaveAs] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [savingPreset, setSavingPreset] = useState(false);

  useEffect(() => {
    Promise.all([API.getSystemPrompt(), API.listPresets()])
      .then(([data, presetList]) => {
        setPrompt(data.content || '');
        setSource(data.source || '');
        setActivePresetId(data.active_preset_id || '');
        setPresets(presetList);
        setDirty(false);
      })
      .catch(() => {});
  }, []);

  function handleChange(e) {
    setPrompt(e.target.value);
    setDirty(true);
    setSaved(false);
  }

  function handleSave() {
    if (!dirty || saving) return;
    setSaving(true);
    API.saveSystemPrompt(prompt).then(() => {
      setDirty(false);
      setSaved(true);
      setSaving(false);
      if (activePresetId) {
        setPresets(prev => prev.map(p =>
          p.id === activePresetId ? { ...p, content: prompt } : p
        ));
      }
    }).catch(() => setSaving(false));
  }

  function handlePresetChange(e) {
    const id = e.target.value;
    if (id === activePresetId) return;
    API.activatePreset(id || null).then(data => {
      setActivePresetId(id);
      if (data.content != null) {
        setPrompt(data.content);
        setDirty(false);
        setSaved(false);
      }
    }).catch(() => {});
  }

  function handleSaveAs() {
    const name = newPresetName.trim();
    if (!name || savingPreset) return;
    setSavingPreset(true);
    API.createPreset(name, prompt).then(preset => {
      setPresets(prev => [...prev, preset].sort((a, b) => a.name.localeCompare(b.name)));
      setActivePresetId(preset.id);
      setShowSaveAs(false);
      setNewPresetName('');
      setSavingPreset(false);
      setDirty(false);
    }).catch(() => setSavingPreset(false));
  }

  function handleDeletePreset() {
    if (!activePresetId) return;
    const name = presets.find(p => p.id === activePresetId)?.name || 'this preset';
    if (!confirm('Delete "' + name + '"?')) return;
    API.deletePreset(activePresetId).then(() => {
      setPresets(prev => prev.filter(p => p.id !== activePresetId));
      setActivePresetId('');
    }).catch(() => {});
  }

  return (
    <>
      <h3>System prompt</h3>
      <div className="desc">The instruction prepended to every conversation. Save multiple versions as presets and switch between them {'—'} independent of which model is active.</div>
      <div className="setting-row">
        <div className="setting-label">Presets<span className="hint">Save and switch between system prompts</span></div>
        <div className="setting-ctrl">
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select className="text-input" value={activePresetId} onChange={handlePresetChange} style={{ flex: 1 }}>
              <option value="">{'—'} none {'—'}</option>
              {presets.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            {activePresetId && (
              <button className="iconbtn" onClick={handleDeletePreset} title="Delete preset" style={{ color: 'var(--ember)', flexShrink: 0 }}>
                <Icon name="trash" size={14} />
              </button>
            )}
          </div>
          {showSaveAs ? (
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <input className="text-input" style={{ flex: 1 }} value={newPresetName} onChange={e => setNewPresetName(e.target.value)} placeholder="Preset name…" onKeyDown={e => e.key === 'Enter' && handleSaveAs()} autoFocus />
              <button className="send-btn" onClick={handleSaveAs} disabled={!newPresetName.trim() || savingPreset} style={{
                background: newPresetName.trim() ? 'var(--candle)' : 'var(--ink-3)',
                color: newPresetName.trim() ? 'var(--ink)' : 'var(--fg-faint)',
                border: 'none', whiteSpace: 'nowrap',
              }}>
                {savingPreset ? 'Saving…' : 'Save'}
              </button>
              <button className="iconbtn" onClick={() => { setShowSaveAs(false); setNewPresetName(''); }}>
                <Icon name="close" size={14} />
              </button>
            </div>
          ) : (
            <button className="send-btn" onClick={() => setShowSaveAs(true)} style={{
              marginTop: 8, background: 'var(--ink-3)', color: 'var(--fg)',
              border: '1px solid var(--border-soft)', fontSize: 11.5,
            }}>
              Save current as preset
            </button>
          )}
        </div>
      </div>
      <div className="setting-row">
        <div className="setting-label">Prompt<span className="hint">Markdown. Saved to <span className="mono">{source || 'persona/default.md'}</span></span></div>
        <div className="setting-ctrl">
          <textarea className="text-input" value={prompt} onChange={handleChange} rows={12} style={{ minHeight: 200, resize: 'vertical', fontFamily: 'var(--mono)', fontSize: 12.5, lineHeight: 1.55 }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
            <div className="mono" style={{ fontSize: 10.5, color: 'var(--fg-ghost)' }}>
              {prompt.length} chars {'·'} est {Math.round(prompt.length / 4)} tokens
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {saved && !dirty && <span className="mono" style={{ fontSize: 10.5, color: 'var(--candle)' }}>saved</span>}
              <button className="send-btn" onClick={handleSave} disabled={!dirty || saving} style={{
                background: dirty ? 'var(--candle)' : 'var(--ink-3)',
                color: dirty ? 'var(--ink)' : 'var(--fg-faint)',
                border: 'none', fontSize: 12,
              }}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function StatusBuilderPanel({ visible, setVisible }) {
  const toggle = (k) => {
    setVisible(visible.includes(k) ? visible.filter(x => x !== k) : [...visible, k]);
  };
  const all = Object.entries(STAT_DEFS);
  return (
    <>
      <h3>Status bar</h3>
      <div className="desc">Customize what appears in the slim bar at the bottom of Loom. Drag the order, toggle what you care about. The bar stays out of the way but gives you a glance at what the model is doing.</div>
      <div className="setting-row">
        <div className="setting-label">Visible stats<span className="hint">Click to toggle</span></div>
        <div className="setting-ctrl">
          <div className="statusbar-builder">
            {all.map(([k, def]) => {
              const on = visible.includes(k);
              const label = def.label || (def.health ? 'health dot' : k);
              return (
                <div key={k} className={'sb-chip ' + (on ? 'on' : '')} onClick={() => toggle(k)}>
                  <div className="check">{on && <Icon name="plus" size={10} style={{ transform: 'rotate(45deg)' }} />}</div>
                  <span>{label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="setting-row">
        <div className="setting-label">Preview</div>
        <div className="setting-ctrl">
          <div style={{ border: '1px solid var(--border-soft)', borderRadius: 7, padding: '8px 14px', background: 'var(--ink)', minHeight: 30, fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--fg-faint)' }}>
            <StatusBar visible={visible} weaveTitle="(preview)" />
          </div>
        </div>
      </div>
    </>
  );
}

function WeaveModePanel({ mode, setMode }) {
  const opts = [
    { id: 'branching', label: 'Branching (default)', desc: 'Messages with siblings reveal alternate threads inline. Tree visible in the right pane. The full loom experience.' },
    { id: 'linear',    label: 'Linear',              desc: 'Classic chat. One thread at a time. Branching still works under the hood \u2014 sibling alternates become available via the \u201cthreads\u201d menu on each message.' },
  ];
  return (
    <>
      <h3>Weave mode</h3>
      <div className="desc">Loom stores every conversation as a tree, so branching is always available. This just changes the default view.</div>
      <div className="setting-row">
        <div className="setting-label">Default for new weaves</div>
        <div className="setting-ctrl" style={{ display: 'grid', gap: 8 }}>
          {opts.map(o => (
            <label key={o.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: 12, borderRadius: 7, background: mode === o.id ? 'color-mix(in oklch, var(--candle) 8%, var(--ink-3))' : 'var(--ink-3)', border: '1px solid ' + (mode === o.id ? 'color-mix(in oklch, var(--candle) 40%, transparent)' : 'var(--border-soft)'), cursor: 'pointer' }}>
              <input type="radio" checked={mode === o.id} onChange={() => setMode(o.id)} style={{ accentColor: 'var(--candle)', marginTop: 3 }} />
              <div>
                <div className="serif" style={{ fontSize: 16, color: 'var(--fg)' }}>{o.label}</div>
                <div style={{ fontSize: 12.5, color: 'var(--fg-dim)', marginTop: 3 }}>{o.desc}</div>
              </div>
            </label>
          ))}
        </div>
      </div>
    </>
  );
}

function AppearancePanel({ tweaks, setTweaks }) {
  const [theme, setThemeState] = useState(getTheme);

  function handleTheme(next) {
    setTheme(next);
    setThemeState(next);
  }

  return (
    <>
      <h3>Appearance</h3>
      <div className="desc">Two themes {'\u2014'} Moonlight Dusk (dark) and Dawn Loom (light). The accent and arcane knobs work on both.</div>
      <div className="setting-row">
        <div className="setting-label">Theme<span className="hint">Switch between dark and light</span></div>
        <div className="setting-ctrl">
          <div className="seg">
            <button className={theme !== 'parchment' ? 'active' : ''} onClick={() => handleTheme('dusk')}>Moonlight Dusk</button>
            <button className={theme === 'parchment' ? 'active' : ''} onClick={() => handleTheme('parchment')}>Dawn Loom</button>
          </div>
        </div>
      </div>
      <div className="setting-row">
        <div className="setting-label">Accent color<span className="hint">Primary thread color, used throughout</span></div>
        <div className="setting-ctrl">
          <div className="swatch-row">
            {Object.entries(ACCENTS).map(([k, a]) => (
              <div key={k} className={'swatch ' + (tweaks.accent === k ? 'on' : '')}
                   style={{ background: a.color, boxShadow: `inset 0 0 0 1.5px var(--ink), 0 0 0 2px ${tweaks.accent === k ? a.color : 'transparent'}` }}
                   title={a.label}
                   onClick={() => setTweaks({ ...tweaks, accent: k })} />
            ))}
          </div>
        </div>
      </div>
      <div className="setting-row">
        <div className="setting-label">Arcane intensity<span className="hint">Dial the mystical decoration up or down {'\u2014'} glow, grain, drop caps, sigils.</span></div>
        <div className="setting-ctrl slider-row">
          <input type="range" min={0} max={1} step={0.05} value={tweaks.arcane} onChange={e => setTweaks({ ...tweaks, arcane: parseFloat(e.target.value) })} />
          <div className="slider-val">{Math.round(tweaks.arcane * 100)}%</div>
        </div>
      </div>
    </>
  );
}

function ToolsPanel({ cfg, setCfg }) {
  const set = (k, v) => setCfg({ ...cfg, [k]: v });
  const tools = [
    { id: 'web_search', name: 'DuckDuckGo search', desc: 'Free-form web search. Regex-triggered by [search:query].', enabled: true },
    { id: 'file_read',  name: 'Scoped file read',  desc: 'Read files under a configured root. Triggered by [read:/path].', enabled: true },
  ];
  return (
    <>
      <h3>Tools</h3>
      <div className="desc">The tool loop runs up to {cfg.max_tool_rounds} rounds per turn. Model calls a tool via <span className="mono" style={{ color: 'var(--candle)' }}>[tool:argument]</span>; result is fed back and generation continues.</div>
      {tools.map(t => (
        <div className="setting-row" key={t.id}>
          <div className="setting-label">{t.name}<span className="hint">{t.desc}</span></div>
          <div className="setting-ctrl" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className={'switch ' + (t.enabled ? 'on' : '')} />
            <span className="mono" style={{ fontSize: 11.5, color: 'var(--fg-faint)' }}>{t.enabled ? 'enabled' : 'disabled'}</span>
          </div>
        </div>
      ))}
      <div className="setting-row">
        <div className="setting-label">File read root<span className="hint">Directories the model can see. One per line.</span></div>
        <div className="setting-ctrl">
          <textarea className="text-input" value={cfg.allowed_read_dirs} onChange={e => set('allowed_read_dirs', e.target.value)} />
        </div>
      </div>
      <SliderRow label="Max tool rounds" hint="Safety cap on consecutive tool calls within one turn" min={0} max={10} step={1} value={cfg.max_tool_rounds} onChange={v => set('max_tool_rounds', v)} fmt={v => String(v)} />
    </>
  );
}

function DataPanel() {
  return (
    <>
      <h3>Data</h3>
      <div className="desc">Everything Loom knows lives in a local SQLite file. You own it. Export any time; wipe when you want to start fresh.</div>
      <div className="setting-row">
        <div className="setting-label">Database<span className="hint">Path on disk</span></div>
        <div className="setting-ctrl">
          <input className="text-input" defaultValue="~/.loom/loom.db" />
          <div className="mono" style={{ fontSize: 10.5, color: 'var(--fg-ghost)', marginTop: 6 }}>48.2 MB · 9 weaves · 32 messages · 7 memories</div>
        </div>
      </div>
      <div className="setting-row">
        <div className="setting-label">Export weaves<span className="hint">Download every weave as JSON or markdown</span></div>
        <div className="setting-ctrl" style={{ display: 'flex', gap: 8 }}>
          <button className="send-btn" style={{ background: 'var(--ink-3)', color: 'var(--fg)', border: '1px solid var(--border)' }}><Icon name="save" size={12} /> <span>export · json</span></button>
          <button className="send-btn" style={{ background: 'var(--ink-3)', color: 'var(--fg)', border: '1px solid var(--border)' }}><Icon name="save" size={12} /> <span>export · markdown</span></button>
        </div>
      </div>
      <div className="setting-row">
        <div className="setting-label" style={{ color: 'var(--ember)' }}>Reset memories<span className="hint" style={{ color: 'var(--fg-faint)' }}>Clears the memory store. Weaves are untouched.</span></div>
        <div className="setting-ctrl">
          <button className="send-btn" style={{ background: 'transparent', color: 'var(--ember)', border: '1px solid var(--ember)' }}><Icon name="trash" size={12} /> <span>forget all memories</span></button>
        </div>
      </div>
    </>
  );
}

Object.assign(window, { SettingsModal });

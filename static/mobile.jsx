// Loom — Mobile layout & components
(function() {
  const { useState, useEffect, useMemo, useRef, useCallback } = React;

  // =========================================================
  // MOBILE TOP BAR
  // =========================================================
  function MobileTopBar({ mode, weave, modelChip, onMenuTap, onModelTap, onBranchTap, onSettingsTap, onBack, onClose }) {
    if (mode === 'settings') {
      return (
        <div className="m-topbar">
          <button className="m-iconbtn" onClick={onBack}><Icon name="chevronL" /></button>
          <div className="m-title-block">
            <div className="serif" style={{ fontSize: 19, fontWeight: 500 }}>Settings</div>
          </div>
          <button className="m-iconbtn" onClick={onClose}><Icon name="close" /></button>
        </div>
      );
    }

    return (
      <div className="m-topbar">
        <button className="m-iconbtn" onClick={onMenuTap}><Icon name="menu" /></button>
        {mode === 'brand' ? (
          <div className="m-title-block" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <LoomMark size={22} style={{ color: 'var(--candle)', filter: 'drop-shadow(0 0 6px color-mix(in oklch, var(--candle) 35%, transparent))' }} />
            <div className="m-brand-name flicker">Loom</div>
          </div>
        ) : (
          <div className="m-title-block">
            <div className="m-weave-title">{weave?.title || 'New Weave'}</div>
            <div className="m-weave-meta">
              <span>{weave?.threads || 0} threads</span>
              <span className="m-dot" />
              <span>{weave?.when || 'now'}</span>
            </div>
          </div>
        )}
        {modelChip && (
          <button className="m-model-chip" onClick={onModelTap}>
            <Icon name="cpu" />
            <b>{modelChip}</b>
            <Icon name="chevronDown" />
          </button>
        )}
        {mode === 'weave' && onBranchTap && (
          <button className="m-iconbtn" onClick={onBranchTap}><Icon name="branch" /></button>
        )}
        <button className="m-iconbtn" onClick={onSettingsTap}><Icon name="settings" /></button>
      </div>
    );
  }

  // =========================================================
  // MOBILE EMPTY STATE
  // =========================================================
  function MobileEmptyState({ onSuggestion, weaves }) {
    const suggestions = useMemo(() => {
      const defaults = [
        'Draft a short paragraph about noise',
        'Ask about today’s memories',
      ];
      if (weaves?.length > 0) {
        return ['Pick up ' + weaves[0].title, ...defaults];
      }
      return ['Start a new thread of thought', ...defaults];
    }, [weaves]);

    return (
      <div className="m-empty-weave">
        <LoomMark size={52} className="mark" style={{ color: 'var(--candle)' }} />
        <div className="m-empty-title serif">Begin a weave</div>
        <div className="m-empty-subtitle">a local chat for branching thought</div>
        <div className="m-empty-divider" />
        <div className="m-suggestion">
          {suggestions.map((s, i) => (
            <button key={i} onClick={() => onSuggestion && onSuggestion(s)}>
              <span className="glyph">{'⟡'}</span>
              <span>{s}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // =========================================================
  // MOBILE MESSAGE ROW
  // =========================================================
  function MobileMessageRow({ node, isFirst, onFork, onPickSibling, siblingIds, nodes, onRegenerate, onOpenBranch }) {
    const [copied, setCopied] = useState(false);

    function handleCopy() {
      const text = typeof node.content === 'string'
        ? node.content
        : node.content.map(p => p.p).join('\n\n');
      navigator.clipboard.writeText(text).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      });
    }

    const who = node.role === 'assistant' ? 'Loom' : (node.role === 'user' ? 'You' : 'System');
    const sigil = node.role === 'assistant' ? '⟡' : (node.role === 'user' ? 'E' : '☌');
    const hasSiblings = siblingIds && siblingIds.length > 1;
    const myIdx = siblingIds ? siblingIds.indexOf(node.id) : 0;

    return (
      <div className={'m-msg-row ' + node.role + (isFirst ? ' first' : '') + ' glow-in'}>
        <div className="m-msg-head">
          <div className={'m-sigil ' + node.role}>{sigil}</div>
          <span className="m-who">{who}</span>
          {node.model && <span className="m-model-tag">{node.model}</span>}
          <span className="m-meta">
            {node.ts}
            {node.tokens ? ' · ' + node.tokens + ' tok' : ''}
            {node.tokps ? ' · ' + (node.tokps.toFixed ? node.tokps.toFixed(1) : node.tokps) + ' tok/s' : ''}
          </span>
        </div>
        <div className="m-msg-content">
          {typeof node.content === 'string'
            ? <p>{node.content}</p>
            : node.content.map((p, i) => <p key={i}>{renderMarkdown(p.p)}</p>)
          }
          {node.streaming && <span className="m-cursor" />}
        </div>

        {(node.chipsMemory?.length > 0 || node.chipsTool?.length > 0) && (
          <div className="m-chip-row">
            {node.chipsMemory?.map((c, i) => (
              <span key={'m'+i} className="m-chip memory">
                <Icon name="memory" />
                <span>{c}</span>
              </span>
            ))}
            {node.chipsTool?.map((c, i) => {
              const parts = c.split(' · ');
              const kind = parts[0];
              const arg = parts[1];
              return (
                <span key={'t'+i} className="m-chip tool">
                  <Icon name={kind.includes('search') ? 'globe' : 'file'} />
                  <span>{kind.replace('_', ' ')}{arg ? ': ' + arg : ''}</span>
                </span>
              );
            })}
          </div>
        )}

        {hasSiblings && (
          <button className="m-siblings" onClick={onOpenBranch}>
            <Icon name="branch" />
            <span>thread <b>{myIdx + 1}</b> / {siblingIds.length}</span>
          </button>
        )}

        {node.role !== 'system' && (
          <div className="m-msg-actions">
            {node.role === 'assistant' && (
              <>
                <button onClick={onRegenerate}><Icon name="retry" size={11} /> <span>regenerate</span></button>
                <button className="primary" onClick={onFork}><Icon name="branch" size={11} /> <span>fork</span></button>
              </>
            )}
            <button onClick={handleCopy}><Icon name="copy" size={11} /> <span>{copied ? 'copied!' : 'copy'}</span></button>
          </div>
        )}
      </div>
    );
  }

  // =========================================================
  // MOBILE COMPOSER
  // =========================================================
  function MobileComposer({ onSend, streaming, thinkingDefault, onToggleThinking, config, healthy, streamTokens, streamStart, tree }) {
    const [value, setValue] = useState('');
    const ref = useRef(null);
    const wrapRef = useRef(null);

    function doSend() {
      if (!value.trim() || streaming || healthy === false) return;
      onSend(value);
      setValue('');
      if (ref.current) { ref.current.style.height = 'auto'; ref.current.focus(); }
    }

    function handleInput(e) {
      setValue(e.target.value);
      const el = e.target;
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 160) + 'px';
    }

    useEffect(() => {
      if (!window.visualViewport) return;
      const vv = window.visualViewport;
      const wrap = wrapRef.current;
      if (!wrap) return;
      function onResize() {
        const offset = window.innerHeight - vv.height;
        wrap.style.transform = offset > 0 ? 'translateY(-' + offset + 'px)' : '';
      }
      vv.addEventListener('resize', onResize);
      vv.addEventListener('scroll', onResize);
      return () => {
        vv.removeEventListener('resize', onResize);
        vv.removeEventListener('scroll', onResize);
      };
    }, []);

    const elapsed = streaming && streamStart ? (Date.now() - streamStart) / 1000 : 0;
    const tokps = streaming && streamTokens > 0 && elapsed > 0.5
      ? (streamTokens / elapsed).toFixed(1) : null;

    const msgCount = tree?.currentPath?.length || 0;
    const maxCtx = config?.max_recent_messages || 40;
    const ctxPct = Math.min((msgCount / maxCtx) * 100, 100);
    const modelName = config?.model || '—';

    return (
      <div className="m-composer-wrap" ref={wrapRef}>
        <div className="m-status-strip">
          <span className={'m-status-dot' + (healthy === false ? ' offline' : '')} />
          <span className="m-sv">{modelName}</span>
          <span className="m-sep">{'·'}</span>
          <span className="m-ctx-mini">
            <span className="m-sv">ctx</span>
            <span className="m-ctx-bar"><i style={{ width: ctxPct + '%' }} /></span>
            <span>{msgCount} / {maxCtx} msg</span>
          </span>
          {streaming && tokps && (<>
            <span className="m-sep">{'·'}</span>
            <span className="m-sv flicker">{tokps} tok/s</span>
          </>)}
        </div>
        <div className="m-composer">
          <textarea
            ref={ref}
            placeholder="Begin a thread…"
            value={value}
            onChange={handleInput}
            onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); doSend(); } }}
            rows={1}
            disabled={streaming}
          />
          <div className="m-composer-bar">
            <div className="m-composer-tools">
              <button title="Attach"><Icon name="attach" /></button>
              <button title="Reference memory"><Icon name="at" /></button>
              <button title="Persona"><Icon name="persona" /></button>
            </div>
            <button className={'m-think-toggle ' + (thinkingDefault ? 'on' : '')} onClick={onToggleThinking}>
              <Icon name="thinking" />
              <span>think</span>
            </button>
            <button className={'m-send-btn' + (!value.trim() || streaming || healthy === false ? ' disabled' : '')} onClick={doSend}>
              <Icon name="send" />
              <span>{streaming ? 'Weaving…' : 'Weave'}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================
  // MOBILE DRAWER (weaves list)
  // =========================================================
  function MobileDrawer({ weaves, activeId, onPick, onNewWeave, onClose }) {
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState(null);
    const debounceRef = useRef(null);

    function handleSearch(q) {
      setSearchQuery(q);
      clearTimeout(debounceRef.current);
      if (!q.trim()) { setSearchResults(null); return; }
      debounceRef.current = setTimeout(async () => {
        try {
          const results = await API.searchConversations(q);
          setSearchResults(results.map(API.convToWeave));
        } catch (_) { setSearchResults([]); }
      }, 300);
    }

    const displayWeaves = searchResults !== null ? searchResults : weaves;
    const groups = useMemo(() => {
      const g = {};
      displayWeaves.forEach(w => { (g[w.group] = g[w.group] || []).push(w); });
      return g;
    }, [displayWeaves]);

    return (
      <>
        <div className="m-scrim" onClick={onClose} />
        <div className="m-drawer">
          <div className="m-drawer-head">
            <div className="caps">Weaves</div>
            <button className="m-iconbtn" onClick={onClose}><Icon name="close" /></button>
          </div>
          <button className="m-new-weave" onClick={() => { onNewWeave(); onClose(); }}>
            <Icon name="plus" />
            <span>New weave</span>
          </button>
          <div className="m-drawer-search">
            <Icon name="search" />
            <input placeholder="Search weaves, memories…" value={searchQuery} onChange={e => handleSearch(e.target.value)} />
          </div>
          <div className="m-weave-list">
            {Object.entries(groups).map(([label, items]) => (
              <div className="m-weave-group" key={label}>
                <div className="m-weave-group-label">{label}</div>
                {items.map(w => (
                  <div
                    key={w.id}
                    className={'m-weave-item ' + (w.id === activeId ? 'active ' : '') + (w.threads > 1 ? 'branched' : '')}
                    onClick={() => { onPick(w.id); onClose(); }}
                  >
                    <span className="m-glyph">{w.threads > 1 ? '⟢' : '⟡'}</span>
                    <div className="m-weave-item-body">
                      <div className="m-weave-item-title">{w.title}</div>
                      <div className="m-weave-item-sub">
                        <span>{w.when}</span>
                        {w.threads > 1 && (<>
                          <span>{'·'}</span>
                          <span>{w.threads} threads</span>
                          <span className="m-threads">
                            {Array.from({ length: Math.min(w.threads, 4) }).map((_, i) => (
                              <i key={i} style={{ background: ['var(--thread-1)','var(--thread-2)','var(--thread-3)','var(--thread-4)'][i] }} />
                            ))}
                          </span>
                        </>)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))}
            {searchResults !== null && displayWeaves.length === 0 && (
              <div style={{ padding: '12px 16px', color: 'var(--fg-ghost)', fontSize: 12 }}>No matching weaves</div>
            )}
          </div>
        </div>
      </>
    );
  }

  // =========================================================
  // MOBILE BRANCH SHEET
  // =========================================================
  function MobileBranchSheet({ nodeId, tree, onPickSibling, onClose }) {
    const node = tree.nodes[nodeId];
    if (!node) return null;

    const parentNode = node.parent ? tree.nodes[node.parent] : null;
    const siblingIds = parentNode ? parentNode.children : [nodeId];
    const myIdx = siblingIds.indexOf(nodeId);

    return (
      <>
        <div className="m-sheet-scrim" onClick={onClose} />
        <div className="m-sheet">
          <div className="m-sheet-grabber" />
          <div className="m-sheet-head">
            <div className="m-sheet-title">{'⟢'} Alternate threads</div>
            <div className="m-sheet-sub">{myIdx + 1} OF {siblingIds.length}</div>
          </div>
          <div className="m-sheet-body">
            <div className="m-branch-nav">
              <button onClick={() => { if (myIdx > 0) onPickSibling(nodeId, siblingIds[myIdx - 1]); }}><Icon name="chevronL" /></button>
              <div className="m-branch-pos"><b>thread {myIdx + 1}</b> of {siblingIds.length}</div>
              <button onClick={() => { if (myIdx < siblingIds.length - 1) onPickSibling(nodeId, siblingIds[myIdx + 1]); }}><Icon name="chevronR" /></button>
            </div>
            {siblingIds.map((sid, idx) => {
              const s = tree.nodes[sid];
              if (!s) return null;
              const preview = typeof s.content === 'string'
                ? s.content
                : s.content.map(p => p.p.replace(/\*\*?(.+?)\*\*?/g, '$1').replace(/`(.+?)`/g, '$1')).join(' ');
              const threadColor = ['var(--thread-1)','var(--thread-2)','var(--thread-3)','var(--thread-4)','var(--thread-5)'][idx % 5];
              return (
                <div
                  key={sid}
                  className={'m-branch-alt ' + (sid === nodeId ? 'active' : '')}
                  onClick={() => { onPickSibling(nodeId, sid); onClose(); }}
                >
                  <div className="m-thread-line" style={{ background: threadColor, boxShadow: '0 0 10px ' + threadColor }} />
                  <div className="m-branch-head">
                    <b>THREAD {idx + 1}{sid === nodeId ? ' · current' : ''}</b>
                    <span className="m-branch-meta">{s.tokens || '—'} tok</span>
                  </div>
                  <div className="m-branch-preview">{preview}</div>
                </div>
              );
            })}
          </div>
        </div>
      </>
    );
  }

  // =========================================================
  // MOBILE MODEL SHEET
  // =========================================================
  function MobileModelSheet({ models, activeModel, onSwap, onNewWeaveWithModel, onClose }) {
    return (
      <>
        <div className="m-sheet-scrim" onClick={onClose} />
        <div className="m-sheet">
          <div className="m-sheet-grabber" />
          <div className="m-sheet-head">
            <div className="m-sheet-title">Swap model</div>
            <div className="m-sheet-sub">{models.length} LOADED</div>
          </div>
          <div className="m-sheet-body">
            {models.map(m => {
              const name = m.name || m.model;
              return (
                <div
                  key={name}
                  className={'m-model-row ' + (name === activeModel ? 'on' : '')}
                  onClick={() => { onSwap(name); onClose(); }}
                >
                  <div className="m-radio" />
                  <div className="m-model-body">
                    <div className="m-model-name">{name}</div>
                    <div className="m-model-facts">
                      {m.parameter_size && <><span><b>{m.parameter_size}</b> params</span><span className="m-dot" /></>}
                      {m.details?.quantization_level && <><span>{m.details.quantization_level}</span><span className="m-dot" /></>}
                      <span>{m.details?.family || ''}</span>
                    </div>
                  </div>
                </div>
              );
            })}
            <button className="m-new-weave" style={{ margin: '14px 0 0' }} onClick={() => { if (onNewWeaveWithModel) onNewWeaveWithModel(activeModel); onClose(); }}>
              <Icon name="plus" />
              <span>New weave with this model</span>
            </button>
            <div className="m-sheet-note">
              Model manager, pulls, and GPU tuning live on the desktop app.
            </div>
          </div>
        </div>
      </>
    );
  }

  // =========================================================
  // MOBILE SETTINGS
  // =========================================================
  function MobileSettings({ config, onSaveConfig, statusVisible, setStatusVisible, tweaks, setTweaks, memories, thinking, onToggleThinking }) {
    const [temp, setTemp] = useState(config?.temperature ?? 0.7);
    const [topP, setTopP] = useState(config?.top_p ?? 0.92);
    const [ctxWindow, setCtxWindow] = useState(config?.max_recent_messages ?? 40);
    const saveTimer = useRef(null);

    function debounceSave(patch) {
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => onSaveConfig(patch), 500);
    }

    const accents = ['candle', 'ember', 'lapis', 'moss', 'amethyst', 'verdigris'];
    const accentColors = {
      candle: 'oklch(0.78 0.12 75)',
      ember: 'oklch(0.67 0.16 30)',
      lapis: 'oklch(0.68 0.14 250)',
      moss: 'oklch(0.72 0.11 150)',
      amethyst: 'oklch(0.68 0.14 310)',
      verdigris: 'oklch(0.72 0.10 180)',
    };

    const statKeys = ['model', 'ctx', 'tokps', 'health', 'latency', 'memories'];

    function toggleStat(k) {
      setStatusVisible(prev =>
        prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k]
      );
    }

    return (
      <div className="m-settings-scroll">
        <div className="m-settings-section">
          <span className="caps">Chat</span>
          <div className="m-settings-card">
            <div className="m-srow">
              <div className="m-slabel">Model<span className="m-shint">currently loaded</span></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="m-sval">{config?.model || '—'}</span>
                <span className="m-schev"><Icon name="chevronR" /></span>
              </div>
            </div>
            <div className="m-srow">
              <div className="m-slabel">Persona<span className="m-shint">the voice the assistant speaks in</span></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="m-sval">default</span>
                <span className="m-schev"><Icon name="chevronR" /></span>
              </div>
            </div>
            <div className="m-srow">
              <div className="m-slabel">Thinking by default<span className="m-shint">assistant reasons before replying</span></div>
              <div className={'m-switch ' + (thinking ? 'on' : '')} onClick={onToggleThinking} />
            </div>
          </div>
        </div>

        <div className="m-settings-section">
          <span className="caps">Sampler</span>
          <div className="m-settings-card">
            <div className="m-srow col">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <div className="m-slabel">Temperature</div>
                <div className="m-sval">{temp.toFixed(2)}</div>
              </div>
              <div className="m-slider-row">
                <input type="range" min="0" max="2" step="0.01" value={temp}
                  onChange={e => { var v = +e.target.value; setTemp(v); debounceSave({ temperature: v }); }} />
                <div className="m-slider-v">{temp.toFixed(2)}</div>
              </div>
            </div>
            <div className="m-srow col">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <div className="m-slabel">top_p</div>
                <div className="m-sval">{topP.toFixed(2)}</div>
              </div>
              <div className="m-slider-row">
                <input type="range" min="0" max="1" step="0.01" value={topP}
                  onChange={e => { var v = +e.target.value; setTopP(v); debounceSave({ top_p: v }); }} />
                <div className="m-slider-v">{topP.toFixed(2)}</div>
              </div>
            </div>
            <div className="m-srow col">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <div className="m-slabel">Context window<span className="m-shint">hard-cap sliding messages</span></div>
                <div className="m-sval">{ctxWindow} msg</div>
              </div>
              <div className="m-slider-row">
                <input type="range" min="8" max="128" step="1" value={ctxWindow}
                  onChange={e => { var v = +e.target.value; setCtxWindow(v); debounceSave({ max_recent_messages: v }); }} />
                <div className="m-slider-v">{ctxWindow}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="m-settings-section">
          <span className="caps">Status line</span>
          <div className="m-settings-card">
            <div style={{ padding: '4px 0 6px' }}>
              {statKeys.map(k => (
                <span key={k} className={'m-sb-chip ' + (statusVisible.includes(k) ? 'on' : '')} onClick={() => toggleStat(k)}>
                  <span className="m-check">{statusVisible.includes(k) && <Icon name="send" />}</span>
                  <span>{k === 'tokps' ? 'tok/s' : k === 'ctx' ? 'context' : k}</span>
                </span>
              ))}
            </div>
            <div style={{ padding: '8px 0 2px', color: 'var(--fg-faint)', fontSize: 12, fontFamily: 'var(--serif)', fontStyle: 'italic' }}>
              vram and backend diagnostics are desktop-only.
            </div>
          </div>
        </div>

        <div className="m-settings-section">
          <span className="caps">Appearance</span>
          <div className="m-settings-card">
            <div className="m-srow col">
              <div className="m-slabel">Accent</div>
              <div className="m-swatch-row">
                {accents.map(a => (
                  <div
                    key={a}
                    className={'m-swatch ' + (tweaks.accent === a ? 'on' : '')}
                    style={{ background: accentColors[a] }}
                    onClick={() => setTweaks(prev => ({ ...prev, accent: a }))}
                  />
                ))}
              </div>
            </div>
            <div className="m-srow col">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <div className="m-slabel">Arcane intensity<span className="m-shint">glows, noise, flicker</span></div>
                <div className="m-sval">{(tweaks.arcane ?? 1).toFixed(2)}</div>
              </div>
              <div className="m-slider-row">
                <input type="range" min="0" max="1" step="0.01" value={tweaks.arcane ?? 1}
                  onChange={e => setTweaks(prev => ({ ...prev, arcane: +e.target.value }))} />
                <div className="m-slider-v">{(tweaks.arcane ?? 1).toFixed(2)}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="m-settings-section">
          <span className="caps">Memories</span>
          <div className="m-settings-card">
            <div className="m-srow">
              <div className="m-slabel">Total memories<span className="m-shint">used to seed context by keyword</span></div>
              <div className="m-sval quiet">{memories?.length || 0}</div>
            </div>
            <div className="m-srow">
              <div className="m-slabel">Browse & edit</div>
              <span className="m-schev"><Icon name="chevronR" /></span>
            </div>
          </div>
        </div>

        <div className="m-settings-section">
          <span className="caps">About</span>
          <div className="m-settings-card">
            <div className="m-srow">
              <div className="m-slabel">Version</div>
              <div className="m-sval quiet">loom v0.1.0</div>
            </div>
            <div className="m-srow">
              <div className="m-slabel">Endpoint</div>
              <div className="m-sval quiet">ollama {'·'} local</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================
  // MOBILE APP — root layout & state management
  // =========================================================
  function MobileApp(props) {
    var p = props;
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [modelSheetOpen, setModelSheetOpen] = useState(false);
    const [branchSheetNode, setBranchSheetNode] = useState(null);
    const [settingsOpen, setSettingsOpen] = useState(false);

    const scrollRef = useRef(null);
    const prevPathLen = useRef(0);

    useEffect(() => {
      if (!scrollRef.current) return;
      var el = scrollRef.current;
      var pathLen = p.tree?.currentPath?.length || 0;
      var nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
      if (nearBottom || pathLen > prevPathLen.current) {
        el.scrollTop = el.scrollHeight;
      }
      prevPathLen.current = pathLen;
    }, [p.tree]);

    useEffect(() => {
      var startX = null, startY = null;
      function onStart(e) {
        var t = e.touches[0];
        if (t.clientX < 30) { startX = t.clientX; startY = t.clientY; }
      }
      function onEnd(e) {
        if (startX === null) return;
        var dx = e.changedTouches[0].clientX - startX;
        var dy = Math.abs(e.changedTouches[0].clientY - startY);
        if (dx > 60 && dy < 80) setDrawerOpen(true);
        startX = null; startY = null;
      }
      document.addEventListener('touchstart', onStart, { passive: true });
      document.addEventListener('touchend', onEnd, { passive: true });
      return () => {
        document.removeEventListener('touchstart', onStart);
        document.removeEventListener('touchend', onEnd);
      };
    }, []);

    var path = p.tree.currentPath || [];
    var displayed = path.filter(function(id) { return p.tree.nodes[id]?.role !== 'system'; });
    var hasWeave = !!p.tree.root;

    var siblingMap = useMemo(function() {
      var m = {};
      path.forEach(function(id) {
        var node = p.tree.nodes[id];
        if (!node) return;
        if (node.parent && p.tree.nodes[node.parent]) m[id] = p.tree.nodes[node.parent].children;
        else m[id] = [id];
      });
      return m;
    }, [p.tree, path]);

    var msgCount = Object.keys(p.tree.nodes || {}).length;

    var lastBranchable = useMemo(function() {
      for (var i = displayed.length - 1; i >= 0; i--) {
        var sids = siblingMap[displayed[i]];
        if (sids && sids.length > 1) return displayed[i];
      }
      return null;
    }, [displayed, siblingMap]);

    if (settingsOpen) {
      return (
        <div className="m-app">
          <MobileTopBar mode="settings" onBack={() => setSettingsOpen(false)} onClose={() => setSettingsOpen(false)} />
          <MobileSettings
            config={p.loomConfig}
            onSaveConfig={p.onSaveConfig}
            statusVisible={p.statusVisible}
            setStatusVisible={p.setStatusVisible}
            tweaks={p.tweaks}
            setTweaks={p.setTweaks}
            memories={p.memories}
            thinking={p.thinking}
            onToggleThinking={p.onToggleThinking}
          />
        </div>
      );
    }

    return (
      <div className="m-app">
        <MobileTopBar
          mode={hasWeave ? 'weave' : 'brand'}
          weave={p.activeWeave}
          modelChip={p.loomConfig?.model || '—'}
          onMenuTap={() => setDrawerOpen(true)}
          onModelTap={() => setModelSheetOpen(true)}
          onBranchTap={lastBranchable ? () => setBranchSheetNode(lastBranchable) : null}
          onSettingsTap={() => setSettingsOpen(true)}
        />
        <div className="m-weave-area">
          <div className="m-weave-scroll" ref={scrollRef}>
            {hasWeave ? (
              <>
                <div className="m-weave-header">
                  <div className="m-wh-title">{p.activeWeave?.title || 'New Weave'}</div>
                  <div className="m-wh-subtitle">
                    {p.activeWeave?.when && <span>{p.activeWeave.when}</span>}
                    {p.activeWeave?.threads > 0 && (<>
                      <span className="m-dot" />
                      <span>{p.activeWeave.threads} threads {'·'} {msgCount} msgs</span>
                    </>)}
                  </div>
                </div>
                {displayed.map(function(id, idx) {
                  return (
                    <MobileMessageRow
                      key={id}
                      node={p.tree.nodes[id]}
                      isFirst={idx === 1}
                      onFork={() => p.onFork(id)}
                      onPickSibling={(sid) => p.onPickSibling(id, sid)}
                      siblingIds={siblingMap[id]}
                      nodes={p.tree.nodes}
                      onRegenerate={() => p.onRegenerate(id)}
                      onOpenBranch={() => setBranchSheetNode(id)}
                    />
                  );
                })}
              </>
            ) : (
              <MobileEmptyState weaves={p.weaves} onSuggestion={p.onSend} />
            )}
          </div>
          <MobileComposer
            onSend={p.onSend}
            streaming={p.streaming}
            thinkingDefault={p.thinking}
            onToggleThinking={p.onToggleThinking}
            config={p.loomConfig}
            healthy={p.healthy}
            streamTokens={p.streamTokens}
            streamStart={p.streamStart}
            tree={p.tree}
          />
        </div>

        {drawerOpen && (
          <MobileDrawer
            weaves={p.weaves}
            activeId={p.activeWeaveId}
            onPick={p.onLoadConversation}
            onNewWeave={p.onNewWeave}
            onClose={() => setDrawerOpen(false)}
          />
        )}
        {modelSheetOpen && (
          <MobileModelSheet
            models={p.models}
            activeModel={p.loomConfig?.model}
            onSwap={p.onSwapModel}
            onNewWeaveWithModel={function(m) { p.onSwapModel(m); p.onNewWeave(); }}
            onClose={() => setModelSheetOpen(false)}
          />
        )}
        {branchSheetNode && (
          <MobileBranchSheet
            nodeId={branchSheetNode}
            tree={p.tree}
            onPickSibling={p.onPickSibling}
            onClose={() => setBranchSheetNode(null)}
          />
        )}
      </div>
    );
  }

  Object.assign(window, { MobileApp });
})();

// Loom — Main App components

const { useState, useEffect, useMemo, useRef, useCallback } = React;

// ---------- Tweak defaults ----------
const TWEAK_DEFAULTS = {
  accent: "candle",
  arcane: 1
};

const ACCENTS = {
  candle:    { label: 'Candle',    color: 'oklch(0.78 0.12 75)',  bright: 'oklch(0.86 0.13 80)',  dim: 'oklch(0.58 0.09 70)' },
  ember:     { label: 'Ember',     color: 'oklch(0.67 0.16 30)',  bright: 'oklch(0.76 0.17 30)',  dim: 'oklch(0.50 0.12 30)' },
  lapis:     { label: 'Lapis',     color: 'oklch(0.68 0.14 250)', bright: 'oklch(0.78 0.14 250)', dim: 'oklch(0.52 0.11 250)' },
  moss:      { label: 'Moss',      color: 'oklch(0.72 0.11 150)', bright: 'oklch(0.80 0.12 150)', dim: 'oklch(0.55 0.09 150)' },
  amethyst:  { label: 'Amethyst',  color: 'oklch(0.68 0.14 310)', bright: 'oklch(0.78 0.14 310)', dim: 'oklch(0.52 0.11 310)' },
  verdigris: { label: 'Verdigris', color: 'oklch(0.72 0.10 180)', bright: 'oklch(0.80 0.11 180)', dim: 'oklch(0.55 0.08 180)' },
};

function applyTweaks(t) {
  const root = document.documentElement;
  const a = ACCENTS[t.accent] || ACCENTS.candle;
  root.style.setProperty('--candle', a.color);
  root.style.setProperty('--candle-bright', a.bright);
  root.style.setProperty('--candle-dim', a.dim);
  root.style.setProperty('--arcane', String(t.arcane));
}

function setTheme(next) {
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('loom.theme', next);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', next === 'parchment' ? '#ece3d2' : '#1f1d24');
}

function getTheme() {
  return document.documentElement.getAttribute('data-theme') || 'dusk';
}

function renderMarkdown(text) {
  const segments = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
  return segments.map((seg, i) => {
    if (seg.startsWith('**') && seg.endsWith('**')) {
      return <strong key={i}>{seg.slice(2, -2)}</strong>;
    }
    if (seg.startsWith('*') && seg.endsWith('*')) {
      return <em key={i}>{seg.slice(1, -1)}</em>;
    }
    if (seg.startsWith('`') && seg.endsWith('`')) {
      return <code key={i}>{seg.slice(1, -1)}</code>;
    }
    return seg;
  });
}

// ---------- Top bar ----------
function TopBar({ weave, onToggleLeft, rightOpen, setRightOpen, onOpenSettings, leftCollapsed, onRename }) {
  const titleRef = useRef(null);
  return (
    <div className="topbar">
      <button className="iconbtn" onClick={onToggleLeft} title={leftCollapsed ? 'Show weaves' : 'Hide weaves'}>
        <Icon name="sidebar" />
      </button>
      <div className="brand">
        <LoomMark style={{ color: 'var(--candle)' }} />
        <div>
          <div className="brand-name flicker">Loom</div>
        </div>
      </div>
      <div className="topbar-center">
        <div className="weave-title" title="Rename weave" contentEditable suppressContentEditableWarning
          ref={titleRef}
          onBlur={(e) => {
            const t = e.target.textContent.trim();
            if (t && t !== weave.title && onRename) onRename(t);
          }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); } }}
        >
          {weave.title}
        </div>
        <div className="weave-meta">
          <span className="mono">{weave.threads || 0} threads</span>
          {weave.when && <><span className="dot" /><span>{weave.when}</span></>}
        </div>
      </div>
      <div className="topbar-actions">
        <button className="iconbtn" title="Fork weave"><Icon name="branch" /></button>
        <button className="iconbtn" title="Search"><Icon name="search" /></button>
        <button className="iconbtn" onClick={onOpenSettings} title="Settings"><Icon name="settings" /></button>
        <button className={'iconbtn ' + (rightOpen ? 'active' : '')} onClick={() => setRightOpen(!rightOpen)} title="Inspector">
          <Icon name="inspector" />
        </button>
      </div>
    </div>
  );
}

// ---------- Left rail ----------
function LeftRail({ collapsed, weaves, activeId, onPick, onNewWeave }) {
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
    <div className="left">
      <div className="left-head">
        <div className="caps">Weaves</div>
        <button className="iconbtn" title="Collapse"><Icon name="chevronL" size={14}/></button>
      </div>
      <button className="new-weave" onClick={onNewWeave}>
        <Icon name="plus" />
        <span>New weave</span>
      </button>
      <div className="search">
        <Icon name="search" />
        <input placeholder="Search weaves, memories…" value={searchQuery} onChange={e => handleSearch(e.target.value)} />
      </div>
      <div className="weave-list">
        {Object.entries(groups).map(([label, items]) => (
          <div className="weave-group" key={label}>
            <div className="weave-group-label">{label}</div>
            {items.map(w => (
              <div
                key={w.id}
                className={'weave-item ' + (w.id === activeId ? 'active ' : '') + (w.threads > 1 ? 'branched' : '')}
                onClick={() => onPick(w.id)}
              >
                <span className="glyph">{w.threads > 1 ? '\u27E2' : '\u27E1'}</span>
                <div className="weave-item-body">
                  <div className="weave-item-title">{w.title}</div>
                  <div className="weave-item-sub">
                    <span className="mono">{w.when}</span>
                    {w.threads > 1 && (
                      <>
                        <span className="dot" style={{width: 2, height: 2, background: 'var(--fg-ghost)', borderRadius: '50%'}} />
                        <span className="threads">
                          {Array.from({length: Math.min(w.threads, 4)}).map((_, i) => (
                            <i key={i} style={{ background: ['var(--thread-1)','var(--thread-2)','var(--thread-3)','var(--thread-4)'][i] }} />
                          ))}
                        </span>
                      </>
                    )}
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
  );
}

// ---------- A single chat message ----------
function MessageRow({ node, isFirst, onFork, onPickSibling, siblingIds, nodes, branchOpen, toggleBranch, onRegenerate, weaveMode }) {
  const [openChip, setOpenChip] = useState(null);
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
  const sigil = node.role === 'assistant' ? '\u27E1' : (node.role === 'user' ? 'E' : '\u260C');

  const hasSiblings = siblingIds && siblingIds.length > 1;
  const myIdx = siblingIds ? siblingIds.indexOf(node.id) : 0;

  return (
    <div className={`msg-row ${node.role} ${isFirst ? 'first' : ''} glow-in`}>
      <div className="msg-avatar">
        <div className="sigil">{sigil}</div>
      </div>
      <div className="msg-body">
        <div className="msg-meta">
          <span className="who">{who}</span>
          {node.model && <span className="model">{node.model}</span>}
          {node.ts && <span>{node.ts}</span>}
          {node.tokens && <span>· {node.tokens} tok · {node.tokps?.toFixed(1) || '—'} tok/s</span>}
          {hasSiblings && (
            weaveMode === 'linear' ? (
              <span className="siblings linear-nav" style={{ marginLeft: 'auto' }}>
                <button className="sib-arrow" disabled={myIdx === 0} onClick={() => onPickSibling(siblingIds[myIdx - 1])}>
                  <Icon name="chevronL" size={10} />
                </button>
                <span>{myIdx + 1} / {siblingIds.length}</span>
                <button className="sib-arrow" disabled={myIdx >= siblingIds.length - 1} onClick={() => onPickSibling(siblingIds[myIdx + 1])}>
                  <Icon name="chevronR" size={10} />
                </button>
              </span>
            ) : (
              <span className="siblings" onClick={toggleBranch} style={{ marginLeft: 'auto', cursor: 'pointer' }}>
                <Icon name="branch" size={11} />
                <span>thread</span>
                <b>{myIdx + 1}</b> / {siblingIds.length}
              </span>
            )
          )}
        </div>

        <div className="msg-content">
          {typeof node.content === 'string'
            ? <p>{node.content}</p>
            : node.content.map((p, i) => (
                <p key={i}>{renderMarkdown(p.p)}</p>
              ))}
          {node.streaming && <span className="cursor" />}
        </div>

        {(node.chipsMemory?.length || node.chipsTool?.length) ? (
          <>
            <div className="chip-row">
              {node.chipsMemory?.map((m, i) => (
                <span key={'m'+i} className={'chip memory ' + (openChip === 'm'+i ? 'expanded' : '')} onClick={() => setOpenChip(openChip === 'm'+i ? null : 'm'+i)}>
                  <Icon name="memory" size={11} />
                  <span>{m}</span>
                </span>
              ))}
              {node.chipsTool?.map((t, i) => {
                const [kind, arg] = t.split(' · ');
                const iconName = kind.includes('search') ? 'globe' : 'file';
                return (
                  <span key={'t'+i} className={'chip tool ' + (openChip === 't'+i ? 'expanded' : '')} onClick={() => setOpenChip(openChip === 't'+i ? null : 't'+i)}>
                    <Icon name={iconName} size={11} />
                    <span>{kind.replace('_', ' ')}{arg ? ': ' + arg : ''}</span>
                  </span>
                );
              })}
            </div>
            {openChip?.startsWith('m') && (
              <div className="chip-detail">
                <div><span className="k">memory</span> → {node.chipsMemory[+openChip.slice(1)]}</div>
                <div style={{ marginTop: 4, color: 'var(--fg-faint)' }}>Matched on keywords: <span style={{ color: 'var(--candle)' }}>workshop, walnut, desk</span> · injected into system prompt at position 2.</div>
              </div>
            )}
            {openChip?.startsWith('t') && (
              <div className="chip-detail">
                <div><span className="k">tool</span> → <span style={{ color: 'var(--candle)' }}>{node.chipsTool[+openChip.slice(1)]}</span></div>
                <div style={{ marginTop: 4 }}>Read 412 bytes · walnut-desk/build-log.md · filtered to last 3 entries</div>
                <div style={{ marginTop: 4, color: 'var(--fg-ghost)' }}>completed 340ms after call</div>
              </div>
            )}
          </>
        ) : null}

        {node.role !== 'system' && (
          <div className="msg-actions">
            {node.role === 'assistant' && (
              <>
                <button className="msg-action" onClick={onRegenerate}><Icon name="retry" size={11} /> <span>regenerate</span></button>
                <button className="msg-action primary" onClick={onFork}><Icon name="branch" size={11} /> <span>fork thread</span></button>
              </>
            )}
            <button className="msg-action" onClick={handleCopy}><Icon name="copy" size={11} /> <span>{copied ? 'copied!' : 'copy'}</span></button>
          </div>
        )}

        {hasSiblings && branchOpen && weaveMode !== 'linear' && (
          <div className="branch-alts glow-in">
            <div className="branch-alts-head">
              <div className="caps">⟢ Alternate threads from this branch</div>
              <div className="branch-alts-nav">
                <button><Icon name="chevronL" size={12} /></button>
                <div className="pos"><b>{myIdx + 1}</b> of {siblingIds.length}</div>
                <button><Icon name="chevronR" size={12} /></button>
              </div>
            </div>
            <div className="branch-alts-body" style={{ gridTemplateColumns: siblingIds.length === 2 ? '1fr 1fr' : '1fr 1fr 1fr' }}>
              {siblingIds.map((sid, idx) => {
                const s = nodes[sid];
                const preview = typeof s.content === 'string' ? s.content : s.content.map(p => p.p.replace(/\*\*?(.+?)\*\*?/g, '$1').replace(/`(.+?)`/g, '$1')).join(' ');
                const threadColor = ['var(--thread-1)','var(--thread-2)','var(--thread-3)','var(--thread-4)','var(--thread-5)'][idx % 5];
                return (
                  <div
                    key={sid}
                    className={'branch-alt ' + (sid === node.id ? 'active' : '')}
                    onClick={() => onPickSibling(sid)}
                  >
                    <div className="thread-line" style={{ background: threadColor, boxShadow: `0 0 10px ${threadColor}` }} />
                    <div className="preview">{preview}</div>
                    <div className="foot">
                      <b>thread {idx + 1}</b>
                      <span>{s.tokens || '—'} tok · {s.tokps?.toFixed(1) || '—'} tok/s</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Model Picker ----------
function ModelPicker({ models, activeModel, onModelChange, loadedModels }) {
  const [open, setOpen] = useState(false);
  const [vramInfo, setVramInfo] = useState(null);
  const [unloading, setUnloading] = useState(null);
  const [dropPos, setDropPos] = useState(null);
  const wrapRef = useRef(null);
  const chipRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        const dropdown = document.querySelector('.model-picker-dropdown');
        if (dropdown && dropdown.contains(e.target)) return;
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  function toggleOpen() {
    if (!open && chipRef.current) {
      const rect = chipRef.current.getBoundingClientRect();
      setDropPos({ bottom: window.innerHeight - rect.top + 8, left: rect.left });
    }
    setOpen(!open);
  }

  function handlePick(name) {
    onModelChange(name);
    setOpen(false);
    setVramInfo(null);
    if (!loadedModels.includes(name)) {
      API.checkVram(name).then(info => { if (!info.fits) setVramInfo(info); }).catch(() => {});
    }
  }

  function handleUnload(name, e) {
    e.stopPropagation();
    setUnloading(name);
    API.unloadModel(name).then(() => {
      setUnloading(null);
      setVramInfo(null);
      if (activeModel) {
        API.checkVram(activeModel).then(info => { if (!info.fits) setVramInfo(info); else setVramInfo(null); }).catch(() => {});
      }
    }).catch(() => setUnloading(null));
  }

  const shortName = activeModel ? activeModel.replace(/:latest$/, '') : '—';

  return (
    <div className="model-picker-wrap" ref={wrapRef}>
      <button ref={chipRef} className="model-picker-chip" onClick={toggleOpen} title="Select model for this message">
        <span className={'model-picker-dot' + (loadedModels.includes(activeModel) ? ' loaded' : '')} />
        <span className="model-picker-name">{shortName}</span>
        <Icon name="chevronDown" size={10} />
      </button>
      {open && dropPos && ReactDOM.createPortal(
        <div className="model-picker-dropdown glow-in" style={{ position: 'fixed', bottom: dropPos.bottom, left: dropPos.left }}>
          <div className="model-picker-head">
            <span className="caps">Model for next message</span>
          </div>
          {models.map(m => {
            const isLoaded = loadedModels.includes(m.name);
            const isActive = m.name === activeModel;
            return (
              <div key={m.name} className={'model-picker-item' + (isActive ? ' active' : '')} onClick={() => handlePick(m.name)}>
                <span className={'model-picker-dot' + (isLoaded ? ' loaded' : '')} />
                <div className="model-picker-info">
                  <span className="model-picker-item-name">{m.name.replace(/:latest$/, '')}</span>
                  <span className="model-picker-item-meta">{m.params}{m.quant ? ' · ' + m.quant : ''}</span>
                </div>
                {isActive && <span className="model-picker-check"><Icon name="send" size={10} /></span>}
              </div>
            );
          })}
        </div>,
        document.body
      )}
      {vramInfo && !vramInfo.fits && ReactDOM.createPortal(
        <div className="model-vram-warning glow-in" style={{ position: 'fixed', bottom: dropPos?.bottom || 60, left: dropPos?.left || 0 }}>
          <span className="model-vram-label">Won't fit — need {vramInfo.needed_gb} GB, have {((vramInfo.total_gb || 0) - (vramInfo.used_gb || 0)).toFixed(1)} GB free</span>
          {vramInfo.loaded_models?.map(lm => (
            <button key={lm.name} className="model-vram-unload" onClick={(e) => handleUnload(lm.name, e)} disabled={unloading === lm.name}>
              {unloading === lm.name ? 'unloading…' : `unload ${lm.name.replace(/:latest$/, '')}`}
            </button>
          ))}
          <button className="model-vram-dismiss" onClick={() => setVramInfo(null)}>dismiss</button>
        </div>,
        document.body
      )}
    </div>
  );
}

// ---------- Composer ----------
function Composer({ onSend, streaming, thinkingDefault, onToggleThinking, models, composerModel, onComposerModelChange, loadedModels }) {
  const [value, setValue] = useState('');
  const ref = useRef(null);

  function doSend() {
    if (!value.trim() || streaming) return;
    onSend(value);
    setValue('');
    if (ref.current) ref.current.focus();
  }

  function handleKeyDown(e) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); doSend(); }
  }

  return (
    <div className="composer-wrap">
      <div className="composer">
        <textarea
          ref={ref}
          placeholder="Begin a thread…"
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={2}
          disabled={streaming}
        />
        <div className="composer-bar">
          <div className="composer-tools">
            <button title="Attach file"><Icon name="attach" /></button>
            <button title="Reference a memory"><Icon name="at" /></button>
            <button title="Insert persona instruction"><Icon name="persona" /></button>
            <button title="Sampler override for this turn"><Icon name="sliders" /></button>
          </div>
          <div className="composer-right">
            {models && models.length > 0 && (
              <ModelPicker
                models={models}
                activeModel={composerModel}
                onModelChange={onComposerModelChange}
                loadedModels={loadedModels || []}
              />
            )}
            <button
              className={'think-toggle ' + (thinkingDefault ? 'on' : '')}
              onClick={onToggleThinking}
              title={thinkingDefault ? 'Thinking enabled \u2014 click to disable' : 'Thinking disabled \u2014 click to enable'}
            >
              <Icon name="thinking" size={13} />
              <span>{thinkingDefault ? 'think' : 'think'}</span>
            </button>
            <span className="composer-hint">
              <kbd>{'\u2318'}</kbd> + <kbd>{'\u21b5'}</kbd> send {'\u00a0\u00b7\u00a0'} <kbd>{'\u21e7'}</kbd> + <kbd>{'\u21b5'}</kbd> newline
            </span>
            <button className="send-btn" onClick={doSend} disabled={streaming || !value.trim()}>
              <Icon name="send" />
              <span>{streaming ? 'Weaving\u2026' : 'Weave'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- Main weave (middle pane) ----------
function WeaveView({ tree, activeWeave, onFork, onPickSibling, branchOpen, toggleBranch, onSend, streaming, onRegenerate, thinkingDefault, onToggleThinking, weaveMode, models, composerModel, onComposerModelChange, loadedModels }) {
  const viewportRef = useRef(null);

  const path = tree.currentPath || [];
  const siblingMap = useMemo(() => {
    const m = {};
    path.forEach((id) => {
      const node = tree.nodes[id];
      if (!node) return;
      if (node.parent && tree.nodes[node.parent]) m[id] = tree.nodes[node.parent].children;
      else m[id] = [id];
    });
    return m;
  }, [tree, path]);

  useEffect(() => {
    if (viewportRef.current) {
      viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
    }
  }, [tree]);

  const displayed = path.filter(id => tree.nodes[id]?.role !== 'system');
  const msgCount = Object.keys(tree.nodes || {}).length;

  return (
    <div className="main">
      <div className="weave-viewport" ref={viewportRef}>
        <div className="weave-canvas">
          {tree.root ? (
            <>
              <div className="weave-header">
                <div className="title-block">
                  <div className="title">{activeWeave?.title || 'New Weave'}</div>
                  <div className="subtitle">
                    {activeWeave?.when && <span>{activeWeave.when}</span>}
                    {activeWeave?.threads > 0 && (
                      <>
                        <span className="dot" />
                        <span>{activeWeave.threads} threads · {msgCount} messages</span>
                      </>
                    )}
                  </div>
                </div>
                <button className="msg-action" title="Fork from current"
                  onClick={() => onFork(path[path.length - 1])}>
                  <Icon name="branch" size={11} /> <span>fork from here</span>
                </button>
              </div>
              {displayed.map((id, idx) => (
                <MessageRow
                  key={id}
                  node={tree.nodes[id]}
                  isFirst={idx === 1}
                  onFork={() => onFork(id)}
                  onPickSibling={(sid) => onPickSibling(id, sid)}
                  siblingIds={siblingMap[id]}
                  nodes={tree.nodes}
                  branchOpen={branchOpen === id}
                  toggleBranch={() => toggleBranch(id)}
                  onRegenerate={() => onRegenerate(id)}
                  weaveMode={weaveMode}
                />
              ))}
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60%', gap: 12, opacity: 0.5 }}>
              <LoomMark style={{ color: 'var(--candle-dim)', width: 48, height: 48 }} />
              <div className="serif" style={{ fontSize: 18, color: 'var(--fg-dim)' }}>Begin a new weave</div>
            </div>
          )}
        </div>
      </div>
      <Composer onSend={onSend} streaming={streaming} thinkingDefault={thinkingDefault} onToggleThinking={onToggleThinking} models={models} composerModel={composerModel} onComposerModelChange={onComposerModelChange} loadedModels={loadedModels} />
    </div>
  );
}

// ---------- Right pane ----------
function RightPane({ tab, setTab, memories, onOpenSettings, tree, onAddMemory, onEditMemory, onDeleteMemory }) {
  return (
    <div className="right">
      <div className="right-tabs">
        <button className={'right-tab ' + (tab === 'memory' ? 'active' : '')} onClick={() => setTab('memory')}>Memories</button>
        <button className={'right-tab ' + (tab === 'threads' ? 'active' : '')} onClick={() => setTab('threads')}>Threads</button>
        <button className={'right-tab ' + (tab === 'context' ? 'active' : '')} onClick={() => setTab('context')}>Context</button>
      </div>
      <div className="right-body">
        {tab === 'memory' && <MemoriesPanel memories={memories} onAdd={onAddMemory} onEdit={onEditMemory} onDelete={onDeleteMemory} />}
        {tab === 'threads' && <ThreadsPanel tree={tree} />}
        {tab === 'context' && <ContextPanel onOpenSettings={onOpenSettings} />}
      </div>
    </div>
  );
}

function MemoriesPanel({ memories, onAdd, onEdit, onDelete }) {
  const [adding, setAdding] = useState(false);
  const [newContent, setNewContent] = useState('');
  const [memSearch, setMemSearch] = useState('');

  function handleAdd() {
    if (!newContent.trim()) return;
    onAdd(newContent.trim());
    setNewContent('');
    setAdding(false);
  }

  const firing = memories.filter(m => m.firing);
  const other = memories.filter(m => !m.firing);
  const filteredOther = memSearch.trim()
    ? other.filter(m =>
        m.title.toLowerCase().includes(memSearch.toLowerCase()) ||
        m.body.toLowerCase().includes(memSearch.toLowerCase()) ||
        m.keywords.some(k => k.toLowerCase().includes(memSearch.toLowerCase()))
      )
    : other;

  return (
    <>
      <div className="right-head">
        <div className="caps">Firing now</div>
        <div className="count mono">{firing.length} / {memories.length}</div>
      </div>
      {firing.map(m => <MemoryCard key={m.id} m={m} matchedKeywords={m.matchedKeywords || []} onEdit={onEdit} onDelete={onDelete} />)}

      <div className="right-head" style={{ marginTop: 18 }}>
        <div className="caps">Archive</div>
        <div className="count mono">{filteredOther.length}</div>
      </div>
      <div className="memory-search">
        <Icon name="search" />
        <input placeholder="Search memories…" value={memSearch} onChange={e => setMemSearch(e.target.value)} />
      </div>
      {filteredOther.map(m => <MemoryCard key={m.id} m={m} matchedKeywords={[]} onEdit={onEdit} onDelete={onDelete} />)}

      {adding ? (
        <div style={{ padding: '10px 12px', borderRadius: 7, background: 'var(--ink-2)', border: '1px solid var(--candle-dim)', marginTop: 8 }}>
          <textarea
            className="text-input"
            placeholder="Memory content… (first line becomes title)"
            value={newContent}
            onChange={e => setNewContent(e.target.value)}
            rows={3}
            autoFocus
            style={{ width: '100%', marginBottom: 8 }}
          />
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            <button className="msg-action" onClick={() => { setAdding(false); setNewContent(''); }}>cancel</button>
            <button className="send-btn" onClick={handleAdd} disabled={!newContent.trim()} style={{ padding: '4px 12px', fontSize: 11 }}>
              <Icon name="save" size={11} /> <span>save</span>
            </button>
          </div>
        </div>
      ) : (
        <button className="add-btn" onClick={() => setAdding(true)}><Icon name="plus" /> <span>add memory</span></button>
      )}
    </>
  );
}

function MemoryCard({ m, matchedKeywords, onEdit, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState('');

  function startEdit() {
    setEditContent(m.content || m.body);
    setEditing(true);
  }

  function handleSave() {
    if (!editContent.trim()) return;
    onEdit(m.id, editContent.trim());
    setEditing(false);
  }

  if (editing) {
    return (
      <div className={'memory-card ' + (m.firing ? 'firing' : '')} style={{ padding: '10px 12px' }}>
        <textarea
          className="text-input"
          value={editContent}
          onChange={e => setEditContent(e.target.value)}
          rows={4}
          autoFocus
          style={{ width: '100%', marginBottom: 8 }}
        />
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
          <button className="msg-action" onClick={() => setEditing(false)}>cancel</button>
          <button className="send-btn" onClick={handleSave} disabled={!editContent.trim()} style={{ padding: '4px 12px', fontSize: 11 }}>
            <Icon name="save" size={11} /> <span>save</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={'memory-card ' + (m.firing ? 'firing' : '')}>
      <div className="title">{m.title}</div>
      <div className="body">{m.body}</div>
      <div className="keywords">
        {m.keywords.map(k => (
          <span key={k} className={'keyword ' + (matchedKeywords.includes(k) ? 'matched' : '')}>{k}</span>
        ))}
      </div>
      <div className="meta">
        <span>used {m.lastUsed}</span>
        <span style={{ display: 'flex', gap: 6 }}>
          <button onClick={startEdit} style={{ color: 'inherit', opacity: 0.7 }}><Icon name="edit" size={10} /></button>
          <button onClick={() => { if (window.confirm('Delete this memory?')) onDelete(m.id); }} style={{ color: 'inherit', opacity: 0.7 }}><Icon name="trash" size={10} /></button>
        </span>
      </div>
    </div>
  );
}

function ThreadsPanel({ tree }) {
  const render = (id, depth) => {
    const n = tree.nodes[id];
    if (!n) return null;
    const isOnPath = tree.currentPath.includes(id);
    const children = n.children;
    const label = typeof n.content === 'string'
      ? n.content
      : n.content.map(p => p.p).join(' ');
    const trimmed = label.replace(/\*\*?(.+?)\*\*?/g, '$1').replace(/`(.+?)`/g, '$1').slice(0, 140);

    if (n.role === 'system') {
      return children.map(c => render(c, depth));
    }

    return (
      <React.Fragment key={id}>
        <div className={'thread-node ' + (isOnPath ? 'active' : '')}>
          <span className="bullet">{n.role === 'user' ? '▸' : '⟡'}</span>
          <div className="txt">{trimmed}</div>
        </div>
        {children.length > 0 && (
          <div className="thread-indent">
            {children.map(c => render(c, depth + 1))}
          </div>
        )}
      </React.Fragment>
    );
  };

  return (
    <>
      <div className="right-head">
        <div className="caps">Weave Tree</div>
        <div className="count mono">3 threads · 8 nodes</div>
      </div>
      <div className="thread-tree">
        {render(tree.root, 0)}
      </div>

      <div className="right-head" style={{ marginTop: 18 }}>
        <div className="caps">Legend</div>
      </div>
      <div className="mono" style={{ fontSize: 11, color: 'var(--fg-faint)', lineHeight: 1.8 }}>
        <div><span style={{ color: 'var(--candle)' }}>⟡</span> on current path</div>
        <div><span style={{ color: 'var(--fg-ghost)' }}>▸</span> you</div>
        <div><span style={{ color: 'var(--fg-ghost)' }}>⟡</span> assistant</div>
      </div>
    </>
  );
}

function ContextPanel({ onOpenSettings }) {
  return (
    <>
      <div className="right-head">
        <div className="caps">Context window</div>
        <div className="count mono">4,216 / 32,768</div>
      </div>

      <div style={{ display: 'grid', gap: 8, marginBottom: 16 }}>
        <ContextBar label="persona" value={480} color="var(--candle)" />
        <ContextBar label="memories (2)" value={320} color="var(--moss)" />
        <ContextBar label="trunk history" value={2640} color="var(--lapis)" />
        <ContextBar label="tool output" value={776} color="var(--amethyst)" />
      </div>

      <div className="right-head" style={{ marginTop: 18 }}>
        <div className="caps">Persona</div>
      </div>
      <div style={{ padding: '10px 12px', borderRadius: 7, background: 'var(--ink-2)', border: '1px solid var(--border-soft)', fontSize: 12, color: 'var(--fg-dim)', marginBottom: 14 }}>
        <div className="serif" style={{ fontSize: 15, color: 'var(--fg)', marginBottom: 4 }}>The Archivist</div>
        <div className="mono" style={{ fontSize: 10.5, color: 'var(--fg-ghost)', marginBottom: 6 }}>persona/archivist.local.md · 1.2k chars</div>
        <div>A patient, typographically-aware voice. Prefers concision over certainty. Draws from a reading shelf when it helps.</div>
      </div>

      <div className="right-head" style={{ marginTop: 18 }}>
        <div className="caps">Sampler</div>
      </div>
      <div className="mono" style={{ fontSize: 11.5, color: 'var(--fg-dim)', lineHeight: 1.9 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--fg-ghost)' }}>temperature</span><span style={{ color: 'var(--candle)' }}>0.72</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--fg-ghost)' }}>top_p</span><span style={{ color: 'var(--candle)' }}>0.92</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--fg-ghost)' }}>min_p</span><span style={{ color: 'var(--candle)' }}>0.05</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--fg-ghost)' }}>rep_penalty</span><span style={{ color: 'var(--candle)' }}>1.12</span></div>
      </div>

      <button className="add-btn" style={{ marginTop: 14 }} onClick={onOpenSettings}>
        <Icon name="settings" size={12} /> <span>open settings</span>
      </button>
    </>
  );
}

function ContextBar({ label, value, color }) {
  const pct = (value / 4216) * 100;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 11 }}>
        <span style={{ color: 'var(--fg-dim)' }}>{label}</span>
        <span className="mono" style={{ color: 'var(--fg-faint)' }}>{value.toLocaleString()} tok</span>
      </div>
      <div style={{ height: 4, background: 'var(--ink-3)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: pct + '%', height: '100%', background: color, boxShadow: `0 0 8px ${color}` }} />
      </div>
    </div>
  );
}

// ---------- Status bar ----------
const STAT_DEFS = {
  tokps:    { label: 'tok/s',    icon: 'cpu' },
  ctx:      { label: 'ctx',      icon: null, bar: true },
  model:    { label: 'model',    icon: null },
  health:   { label: '',         icon: null, health: true },
  persona:  { label: 'persona',  icon: 'persona' },
  memories: { label: 'memories', icon: 'memory' },
  vram:     { label: 'vram',     icon: null },
  latency:  { label: 'latency',  icon: 'clock' },
};

function StatusBar({ visible, weaveTitle, config, healthy, streaming, streamTokens, streamStart, streamTTFT, vramGb, memories, tree }) {
  const elapsed = streaming && streamStart ? (Date.now() - streamStart) / 1000 : 0;
  const tokps = streaming && streamTokens > 0 && elapsed > 0.5
    ? (streamTokens / elapsed).toFixed(1) : '\u2014';

  const msgCount = tree?.currentPath?.length || 0;
  const maxCtx = config?.max_recent_messages || 40;
  const firingCount = memories?.filter(m => m.firing).length || 0;
  const totalMem = memories?.length || 0;

  const latencyStr = streamTTFT != null
    ? (streamTTFT >= 1000 ? `${(streamTTFT / 1000).toFixed(1)}s` : `${streamTTFT}ms`)
    : '\u2014';

  const vals = {
    tokps,
    ctx:      `${msgCount} / ${maxCtx} msg`,
    model:    config?.model || '\u2014',
    health:   healthy === null ? 'checking\u2026' : healthy ? 'connected' : 'offline',
    persona:  'default',
    memories: totalMem > 0 ? `${firingCount} firing` : '\u2014',
    vram:     vramGb != null ? `${vramGb} GB` : '\u2014',
    latency:  latencyStr,
  };

  return (
    <div className="statusbar">
      {visible.map(k => {
        const def = STAT_DEFS[k];
        if (!def) return null;
        if (def.health) return (
          <div key={k} className={'stat health' + (healthy === false ? ' offline' : '')}>
            <span className="dot" />
            <span className="v">ollama · {vals[k]}</span>
          </div>
        );
        if (def.bar) {
          const pct = Math.min((msgCount / maxCtx) * 100, 100);
          return (
            <div key={k} className="stat">
              <span className="k">{def.label}</span>
              <div className="ctx-bar"><i style={{ width: pct + '%' }} /></div>
              <span className="v">{vals[k]}</span>
            </div>
          );
        }
        return (
          <div key={k} className="stat">
            {def.icon && <Icon name={def.icon} size={11} />}
            {def.label && <span className="k">{def.label}</span>}
            <span className="v">{vals[k]}</span>
          </div>
        );
      })}
      <span className="spacer" />
      <div className="stat" style={{ color: 'var(--fg-ghost)' }}>
        <span>loom · v0.1.0</span>
      </div>
    </div>
  );
}

Object.assign(window, {
  applyTweaks, TWEAK_DEFAULTS, ACCENTS, STAT_DEFS, setTheme, getTheme,
  TopBar, LeftRail, WeaveView, RightPane, StatusBar, MessageRow, Composer, ModelPicker,
  ContextBar, MemoriesPanel, ThreadsPanel, ContextPanel, MemoryCard, renderMarkdown,
});

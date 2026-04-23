// Loom — main React app
const { useState: useS, useEffect: useE, useMemo: useM, useRef: useR, useCallback: useC } = React;

function App() {
  const [leftCollapsed, setLeftCollapsed] = useS(false);
  const [rightOpen, setRightOpen] = useS(() => typeof window !== 'undefined' && window.innerWidth >= 1100);
  const [rightTab, setRightTab] = useS('memory');
  const [settingsOpen, setSettingsOpen] = useS(false);
  const [statusVisible, setStatusVisible] = useS(() => {
    try { return JSON.parse(localStorage.getItem('loom:statusVisible')) || ['tokps', 'ctx', 'model', 'health', 'memories']; } catch { return ['tokps', 'ctx', 'model', 'health', 'memories']; }
  });
  const [weaveMode, setWeaveMode] = useS(() => localStorage.getItem('loom:weaveMode') || 'branching');
  const [tweaks, setTweaks] = useS(() => {
    try { return { ...TWEAK_DEFAULTS, ...JSON.parse(localStorage.getItem('loom:tweaks')) }; } catch { return TWEAK_DEFAULTS; }
  });
  const [branchOpen, setBranchOpen] = useS(null);
  const [isMobile, setIsMobile] = useS(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches);
  const [models, setModels] = useS([]);

  const [weaves, setWeaves] = useS([]);
  const [activeWeaveId, setActiveWeaveId] = useS(null);
  const [activeWeave, setActiveWeave] = useS({ id: null, title: 'Loom', threads: 0, when: '' });
  const [tree, setTree] = useS({ nodes: {}, root: null, currentPath: [] });
  const [memories, setMemories] = useS([]);
  const [streaming, setStreaming] = useS(false);
  const [streamTokens, setStreamTokens] = useS(0);
  const [streamStart, setStreamStart] = useS(0);
  const [streamTTFT, setStreamTTFT] = useS(null);
  const [loomConfig, setLoomConfig] = useS(null);
  const [healthy, setHealthy] = useS(null);
  const [thinking, setThinking] = useS(false);
  const [vramGb, setVramGb] = useS(null);
  const [composerModel, setComposerModel] = useS(null);
  const [loadedModels, setLoadedModels] = useS([]);

  const streamRef = useR(null);
  const activeWeaveIdRef = useR(null);
  activeWeaveIdRef.current = activeWeaveId;

  useE(() => {
    const saved = localStorage.getItem('loom.theme');
    if (saved === 'parchment' || saved === 'dusk') {
      document.documentElement.setAttribute('data-theme', saved);
    } else {
      const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
      document.documentElement.setAttribute('data-theme', prefersLight ? 'parchment' : 'dusk');
    }
  }, []);

  useE(() => { applyTweaks(tweaks); localStorage.setItem('loom:tweaks', JSON.stringify(tweaks)); }, [tweaks]);
  useE(() => { localStorage.setItem('loom:statusVisible', JSON.stringify(statusVisible)); }, [statusVisible]);
  useE(() => { localStorage.setItem('loom:weaveMode', weaveMode); }, [weaveMode]);

  useE(() => {
    const onResize = () => {
      const w = window.innerWidth;
      if (w < 980) { setLeftCollapsed(true); setRightOpen(false); }
      else if (w < 1100) { setLeftCollapsed(false); setRightOpen(false); }
    };
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useE(() => {
    const mql = window.matchMedia('(max-width: 768px)');
    const handler = (e) => setIsMobile(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  function refreshVram() {
    API.getPs().then(ps => {
      if (ps.vram_gb != null) setVramGb(ps.vram_gb);
      if (ps.models) setLoadedModels(ps.models.map(m => m.name));
    }).catch(() => {});
  }

  useE(() => {
    if (!streaming) return;
    refreshVram();
    const id = setInterval(refreshVram, 3000);
    return () => clearInterval(id);
  }, [streaming]);

  // Load initial data
  useE(() => {
    refreshWeaves();
    refreshMemories();
    refreshVram();
    Promise.all([API.getConfig(), API.listModels().catch(() => [])]).then(([c, m]) => {
      setLoomConfig(c);
      setThinking(!!c.thinking);
      const available = m || [];
      setModels(available);
      const ids = available.map(x => x.name || x.id);
      const fallback = ids.includes(c.model) ? c.model : (ids[0] || c.model);
      setComposerModel(prev => prev || fallback);
    }).catch(() => {});
  }, []);

  async function refreshModels() {
    try { const m = await API.listModels(); setModels(m || []); } catch (_) {}
  }

  async function refreshWeaves() {
    try {
      const data = await API.listConversations();
      setWeaves(data.map(API.convToWeave));
      setHealthy(true);
    } catch (_) {
      setHealthy(false);
    }
  }

  async function refreshMemories() {
    try {
      const data = await API.listMemories();
      setMemories(data.map(API.memoryToFrontend));
    } catch (_) {}
  }

  const loadConversation = useC(async (id) => {
    if (streamRef.current) { streamRef.current.abort(); setStreaming(false); }
    try {
      const data = await API.getConversation(id);
      setTree(API.chatToTree(data.chat));
      setActiveWeaveId(id);
      setActiveWeave(API.convDetailToWeave(data));
      setBranchOpen(null);
    } catch (_) {}
  }, []);

  function handleNewWeave() {
    if (streamRef.current) { streamRef.current.abort(); setStreaming(false); }
    setActiveWeaveId(null);
    setActiveWeave({ id: null, title: 'New Weave', threads: 0, when: '' });
    setTree({ nodes: {}, root: null, currentPath: [] });
    setBranchOpen(null);
  }

  function handleSend(message) {
    if (!message.trim() || streaming) return;

    const sendModel = composerModel || loomConfig?.model;
    const now = Math.floor(Date.now() / 1000);
    const tmpUser = '_u' + now;
    const tmpAsst = '_a' + now;

    setTree(prev => {
      const nodes = { ...prev.nodes };
      const parentId = prev.currentPath.length ? prev.currentPath[prev.currentPath.length - 1] : null;

      if (parentId && nodes[parentId]) {
        nodes[parentId] = { ...nodes[parentId], children: [...nodes[parentId].children, tmpUser] };
      }
      nodes[tmpUser] = {
        id: tmpUser, parent: parentId, children: [tmpAsst],
        role: 'user', content: message, ts: API.formatTime(now),
      };
      nodes[tmpAsst] = {
        id: tmpAsst, parent: tmpUser, children: [],
        role: 'assistant', content: [], streaming: true, ts: '',
        model: sendModel,
      };

      return {
        nodes,
        root: prev.root || tmpUser,
        currentPath: [...prev.currentPath, tmpUser, tmpAsst],
      };
    });

    setStreaming(true);
    setStreamTokens(0);
    setStreamStart(Date.now());
    setStreamTTFT(null);

    let convId = activeWeaveIdRef.current;
    let tokenCount = 0;
    let ttftRecorded = false;
    const sendTime = Date.now();

    const ctrl = API.sendMessage(message, convId, (ev) => {
      switch (ev.type) {
        case 'start':
          convId = ev.conversation_id;
          if (!activeWeaveIdRef.current) setActiveWeaveId(convId);
          break;

        case 'token':
          if (!ttftRecorded) { ttftRecorded = true; setStreamTTFT(Date.now() - sendTime); }
          tokenCount++;
          setStreamTokens(tokenCount);
          setTree(prev => {
            const node = prev.nodes[tmpAsst];
            if (!node) return prev;
            const soFar = (node.content || []).map(p => p.p).join('\n\n') + ev.content;
            const paras = soFar.split('\n\n').filter(Boolean).map(p => ({ p }));
            return {
              ...prev,
              nodes: {
                ...prev.nodes,
                [tmpAsst]: { ...node, content: paras.length ? paras : [{ p: soFar }] },
              },
            };
          });
          break;

        case 'tool_start':
          setTree(prev => {
            const node = prev.nodes[tmpAsst];
            if (!node) return prev;
            const chips = ev.calls.map(c => `${c.name} \u00b7 ${c.argument}`);
            return {
              ...prev,
              nodes: {
                ...prev.nodes,
                [tmpAsst]: { ...node, chipsTool: [...(node.chipsTool || []), ...chips] },
              },
            };
          });
          break;

        case 'done':
          setStreaming(false);
          streamRef.current = null;
          refreshVram();
          if (convId) {
            loadConversation(convId);
            refreshWeaves();
          }
          break;

        case 'error':
          setStreaming(false);
          streamRef.current = null;
          setTree(prev => {
            const node = prev.nodes[tmpAsst];
            if (!node) return prev;
            return {
              ...prev,
              nodes: {
                ...prev.nodes,
                [tmpAsst]: { ...node, streaming: false, content: [{ p: `**Error:** ${ev.message}` }] },
              },
            };
          });
          break;
      }
    }, sendModel);

    streamRef.current = ctrl;
  }

  function handleRegenerate(messageId) {
    if (!activeWeaveId || streaming) return;
    const node = tree.nodes[messageId];
    if (!node || node.role !== 'assistant') return;

    const regenModel = composerModel || loomConfig?.model;
    const parentId = node.parent;
    const now = Math.floor(Date.now() / 1000);
    const tmpAsst = '_r' + now;

    setTree(prev => {
      const nodes = { ...prev.nodes };
      if (parentId && nodes[parentId]) {
        nodes[parentId] = { ...nodes[parentId], children: [...nodes[parentId].children, tmpAsst] };
      }
      nodes[tmpAsst] = {
        id: tmpAsst, parent: parentId, children: [],
        role: 'assistant', content: [], streaming: true, ts: '',
        model: regenModel,
      };
      const path = [...prev.currentPath];
      const idx = path.indexOf(messageId);
      const newPath = idx !== -1 ? [...path.slice(0, idx), tmpAsst] : [...path, tmpAsst];
      return { nodes, root: prev.root, currentPath: newPath };
    });

    setStreaming(true);
    setStreamTokens(0);
    setStreamStart(Date.now());
    setStreamTTFT(null);

    let tokenCount = 0;
    let ttftRecorded2 = false;
    const regenTime = Date.now();
    const ctrl = API.regenerateMessage(activeWeaveId, messageId, (ev) => {
      switch (ev.type) {
        case 'start': break;
        case 'token':
          if (!ttftRecorded2) { ttftRecorded2 = true; setStreamTTFT(Date.now() - regenTime); }
          tokenCount++;
          setStreamTokens(tokenCount);
          setTree(prev => {
            const n = prev.nodes[tmpAsst];
            if (!n) return prev;
            const soFar = (n.content || []).map(p => p.p).join('\n\n') + ev.content;
            const paras = soFar.split('\n\n').filter(Boolean).map(p => ({ p }));
            return { ...prev, nodes: { ...prev.nodes, [tmpAsst]: { ...n, content: paras.length ? paras : [{ p: soFar }] } } };
          });
          break;
        case 'tool_start':
          setTree(prev => {
            const n = prev.nodes[tmpAsst];
            if (!n) return prev;
            const chips = ev.calls.map(c => `${c.name} \u00b7 ${c.argument}`);
            return { ...prev, nodes: { ...prev.nodes, [tmpAsst]: { ...n, chipsTool: [...(n.chipsTool || []), ...chips] } } };
          });
          break;
        case 'done':
          setStreaming(false);
          streamRef.current = null;
          refreshVram();
          if (activeWeaveIdRef.current) { loadConversation(activeWeaveIdRef.current); refreshWeaves(); }
          break;
        case 'error':
          setStreaming(false);
          streamRef.current = null;
          setTree(prev => {
            const n = prev.nodes[tmpAsst];
            if (!n) return prev;
            return { ...prev, nodes: { ...prev.nodes, [tmpAsst]: { ...n, streaming: false, content: [{ p: `**Error:** ${ev.message}` }] } } };
          });
          break;
      }
    }, regenModel);
    streamRef.current = ctrl;
  }

  const handlePickSibling = useC((origId, newId) => {
    setTree(prev => {
      const path = [...prev.currentPath];
      const idx = path.indexOf(origId);
      if (idx === -1) return prev;
      const newPath = [...path.slice(0, idx), newId];
      let cur = newId;
      while (prev.nodes[cur]?.children?.length) {
        cur = prev.nodes[cur].children[0];
        newPath.push(cur);
      }
      return { ...prev, currentPath: newPath };
    });
  }, []);

  function handleFork(messageId) {
    if (!activeWeaveId) return;
    setRightOpen(true);
    setRightTab('threads');
    API.forkConversation(activeWeaveId, messageId).then(fork => {
      refreshWeaves();
      loadConversation(fork.id);
    }).catch(() => {});
  }

  function handleRename(title) {
    if (!activeWeaveId || !title.trim()) return;
    API.updateConversation(activeWeaveId, { title: title.trim() }).then(() => {
      setActiveWeave(prev => ({ ...prev, title: title.trim() }));
      refreshWeaves();
    }).catch(() => {});
  }

  async function handleAddMemory(content) {
    await API.createMemory(content);
    refreshMemories();
  }

  async function handleEditMemory(id, content) {
    await API.updateMemory(id, { content });
    refreshMemories();
  }

  async function handleDeleteMemory(id) {
    await API.deleteMemory(id);
    refreshMemories();
  }

  async function handleSaveConfig(patch) {
    try {
      const updated = await API.updateConfig(patch);
      setLoomConfig(updated);
      if ('thinking' in patch) setThinking(!!patch.thinking);
    } catch (_) {}
  }

  function handleToggleThinking() {
    const next = !thinking;
    setThinking(next);
    handleSaveConfig({ thinking: next });
  }

  function handleSwapModel(modelName) {
    handleSaveConfig({ model: modelName });
    setComposerModel(modelName);
  }

  const displayMemories = useM(
    () => API.markFiring(memories, tree),
    [memories, tree]
  );

  if (isMobile) {
    return (
      <MobileApp
        weaves={weaves}
        activeWeaveId={activeWeaveId}
        activeWeave={activeWeave}
        tree={tree}
        memories={displayMemories}
        streaming={streaming}
        streamTokens={streamTokens}
        streamStart={streamStart}
        streamTTFT={streamTTFT}
        thinking={thinking}
        loomConfig={loomConfig}
        healthy={healthy}
        models={models}
        onLoadConversation={loadConversation}
        onNewWeave={handleNewWeave}
        onSend={handleSend}
        onRegenerate={handleRegenerate}
        onPickSibling={handlePickSibling}
        onFork={handleFork}
        onRename={handleRename}
        onToggleThinking={handleToggleThinking}
        onSaveConfig={handleSaveConfig}
        onSwapModel={handleSwapModel}
        composerModel={composerModel || loomConfig?.model}
        onComposerModelChange={setComposerModel}
        loadedModels={loadedModels}
        statusVisible={statusVisible}
        setStatusVisible={setStatusVisible}
        weaveMode={weaveMode}
        setWeaveMode={setWeaveMode}
        tweaks={tweaks}
        setTweaks={setTweaks}
        onAddMemory={handleAddMemory}
        onEditMemory={handleEditMemory}
        onDeleteMemory={handleDeleteMemory}
      />
    );
  }

  return (
    <div className="app"
         data-left={leftCollapsed ? 'collapsed' : 'open'}
         data-right={rightOpen ? 'open' : 'closed'}>
      <TopBar
        weave={activeWeave}
        leftCollapsed={leftCollapsed}
        onToggleLeft={() => setLeftCollapsed(!leftCollapsed)}
        rightOpen={rightOpen}
        setRightOpen={setRightOpen}
        onOpenSettings={() => setSettingsOpen(true)}
        onRename={handleRename}
      />
      <LeftRail
        collapsed={leftCollapsed}
        weaves={weaves}
        activeId={activeWeaveId}
        onPick={loadConversation}
        onNewWeave={handleNewWeave}
      />
      <WeaveView
        tree={tree}
        activeWeave={activeWeave}
        onFork={handleFork}
        onPickSibling={handlePickSibling}
        branchOpen={branchOpen}
        toggleBranch={(id) => setBranchOpen(branchOpen === id ? null : id)}
        onSend={handleSend}
        streaming={streaming}
        onRegenerate={handleRegenerate}
        thinkingDefault={thinking}
        onToggleThinking={handleToggleThinking}
        weaveMode={weaveMode}
        models={models}
        composerModel={composerModel || loomConfig?.model}
        onComposerModelChange={setComposerModel}
        loadedModels={loadedModels}
      />
      {rightOpen && (
        <RightPane
          tab={rightTab}
          setTab={setRightTab}
          memories={displayMemories}
          onOpenSettings={() => setSettingsOpen(true)}
          tree={tree}
          onAddMemory={handleAddMemory}
          onEditMemory={handleEditMemory}
          onDeleteMemory={handleDeleteMemory}
        />
      )}
      <StatusBar
        visible={statusVisible}
        weaveTitle={activeWeave.title}
        config={loomConfig}
        healthy={healthy}
        streaming={streaming}
        streamTokens={streamTokens}
        streamStart={streamStart}
        streamTTFT={streamTTFT}
        vramGb={vramGb}
        memories={displayMemories}
        tree={tree}
      />

      {settingsOpen && (
        <SettingsModal
          onClose={() => setSettingsOpen(false)}
          statusVisible={statusVisible}
          setStatusVisible={setStatusVisible}
          weaveMode={weaveMode}
          setWeaveMode={setWeaveMode}
          tweaks={tweaks}
          setTweaks={setTweaks}
          config={loomConfig}
          onSaveConfig={handleSaveConfig}
          onRefreshModels={refreshModels}
        />
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);

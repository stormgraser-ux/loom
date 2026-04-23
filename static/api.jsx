// Loom — API client & data adapters

const API = (() => {

  async function fetchJSON(path, opts = {}) {
    const res = await fetch(path, {
      headers: { 'Content-Type': 'application/json', ...opts.headers },
      ...opts,
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res.json();
  }

  // ---- Conversations ----

  function listConversations() {
    return fetchJSON('/api/conversations');
  }

  function getConversation(id) {
    return fetchJSON(`/api/conversations/${id}`);
  }

  function updateConversation(id, data) {
    return fetchJSON(`/api/conversations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  function deleteConversation(id) {
    return fetchJSON(`/api/conversations/${id}`, { method: 'DELETE' });
  }

  function forkConversation(id, messageId) {
    return fetchJSON(`/api/conversations/${id}/fork`, {
      method: 'POST',
      body: JSON.stringify({ message_id: messageId }),
    });
  }

  function searchConversations(q) {
    return fetchJSON(`/api/conversations/search?q=${encodeURIComponent(q)}`);
  }

  // ---- Chat (SSE streaming) ----

  function _streamSSE(url, body, onEvent) {
    const controller = new AbortController();
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    }).then(async (res) => {
      if (!res.ok) {
        onEvent({ type: 'error', message: `${res.status} ${res.statusText}` });
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try { onEvent(JSON.parse(line.slice(6))); } catch (_) {}
          }
        }
      }
      if (buffer.startsWith('data: ')) {
        try { onEvent(JSON.parse(buffer.slice(6))); } catch (_) {}
      }
    }).catch((err) => {
      if (err.name !== 'AbortError') {
        onEvent({ type: 'error', message: err.message });
      }
    });
    return controller;
  }

  function sendMessage(message, conversationId, onEvent) {
    const body = { message };
    if (conversationId) body.conversation_id = conversationId;
    return _streamSSE('/api/chat', body, onEvent);
  }

  function regenerateMessage(conversationId, messageId, onEvent) {
    return _streamSSE('/api/chat/regenerate', {
      conversation_id: conversationId,
      message_id: messageId,
    }, onEvent);
  }

  // ---- Memories ----

  function listMemories() {
    return fetchJSON('/api/memories');
  }

  function createMemory(content, keywords) {
    const body = { content };
    if (keywords) body.keywords = keywords;
    return fetchJSON('/api/memories', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  function updateMemory(id, data) {
    return fetchJSON(`/api/memories/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  function deleteMemory(id) {
    return fetchJSON(`/api/memories/${id}`, { method: 'DELETE' });
  }

  // ---- Config ----

  function getSystemPrompt() {
    return fetchJSON('/api/system-prompt');
  }

  function saveSystemPrompt(content) {
    return fetchJSON('/api/system-prompt', {
      method: 'PUT',
      body: JSON.stringify({ content }),
    });
  }

  function getConfig() {
    return fetchJSON('/api/config');
  }

  function updateConfig(data) {
    return fetchJSON('/api/config', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  function listModels() {
    return fetchJSON('/api/models');
  }

  function pullModel(name, onEvent) {
    return _streamSSE('/api/models/pull', { name }, onEvent);
  }

  function importModel(name, path, onEvent) {
    return _streamSSE('/api/models/create', { name, path }, onEvent);
  }

  function getCatalog() {
    return fetchJSON('/catalog.json');
  }

  function getHardware() {
    return fetchJSON('/api/hardware');
  }

  function getPs() {
    return fetchJSON('/api/ps');
  }

  // ---- Helpers ----

  function formatTime(ts) {
    if (!ts) return '';
    const d = new Date(ts * 1000);
    return `${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`;
  }

  function relativeTime(ts) {
    if (!ts) return '';
    const diff = Math.floor(Date.now() / 1000) - ts;
    if (diff < 120)   return 'now';
    if (diff < 3600)  return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    const days = Math.floor(diff / 86400);
    if (days === 1) return 'Yesterday';
    if (days < 7)   return new Date(ts * 1000).toLocaleDateString('en', { weekday: 'short' });
    if (days < 30)  return `${Math.floor(days / 7)}w`;
    return `${Math.floor(days / 30)}mo`;
  }

  function dateGroup(ts) {
    if (!ts) return 'Older';
    const d = new Date(ts * 1000);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    if (d >= today)   return 'Today';
    if (d >= weekAgo) return 'Earlier';
    return 'Older';
  }

  function countThreads(chatData) {
    const msgs = chatData?.messages || {};
    let extra = 0;
    for (const msg of Object.values(msgs)) {
      const kids = msg.childrenIds?.length || 0;
      if (kids > 1) extra += kids - 1;
    }
    return Math.max(1, extra + 1);
  }

  // ---- Data Adapters ----

  function convToWeave(c) {
    return {
      id: c.id,
      title: c.title || 'New Conversation',
      when: relativeTime(c.updated_at),
      threads: 1,
      pinned: !!c.pinned,
      group: dateGroup(c.updated_at),
    };
  }

  function convDetailToWeave(c) {
    return {
      id: c.id,
      title: c.title || 'New Conversation',
      when: relativeTime(c.updated_at),
      threads: countThreads(c.chat),
      pinned: !!c.pinned,
      group: dateGroup(c.updated_at),
      createdAt: c.created_at,
      updatedAt: c.updated_at,
    };
  }

  function chatToTree(chatData) {
    const messages = chatData?.messages || {};
    const currentId = chatData?.currentId;

    if (!Object.keys(messages).length) {
      return { nodes: {}, root: null, currentPath: [] };
    }

    const nodes = {};
    let root = null;

    for (const [id, msg] of Object.entries(messages)) {
      let content;
      if (msg.role === 'assistant' && msg.content) {
        const paras = msg.content.split('\n\n').filter(Boolean);
        content = paras.length ? paras.map(p => ({ p })) : [{ p: msg.content }];
      } else {
        content = msg.content || '';
      }

      nodes[id] = {
        id: msg.id,
        parent: msg.parentId || null,
        children: [...(msg.childrenIds || [])],
        role: msg.role,
        content,
        ts: formatTime(msg.timestamp),
      };

      if (!msg.parentId) root = id;
    }

    const currentPath = [];
    if (currentId && nodes[currentId]) {
      let cur = currentId;
      while (cur) {
        currentPath.unshift(cur);
        cur = nodes[cur]?.parent;
      }
    }

    return { nodes, root, currentPath };
  }

  function memoryToFrontend(mem) {
    const lines = (mem.content || '').split('\n');
    const title = lines[0]?.trim() || 'Untitled';
    const body = lines.length > 1 ? lines.slice(1).join('\n').trim() : title;
    return {
      id: mem.id,
      content: mem.content || '',
      title,
      body: body || title,
      keywords: mem.keywords || [],
      firing: false,
      lastUsed: relativeTime(mem.updated_at),
    };
  }

  function markFiring(memories, tree) {
    if (!tree?.currentPath?.length) return memories;
    const lastUser = [...tree.currentPath].reverse()
      .map(id => tree.nodes[id])
      .find(n => n?.role === 'user');
    if (!lastUser) return memories;
    const text = typeof lastUser.content === 'string' ? lastUser.content : '';
    const words = new Set(text.toLowerCase().split(/\W+/).filter(w => w.length >= 3));
    return memories.map(m => {
      const matched = m.keywords.filter(k => words.has(k.toLowerCase()));
      return { ...m, firing: matched.length > 0, matchedKeywords: matched };
    });
  }

  return {
    listConversations, getConversation, updateConversation,
    deleteConversation, forkConversation, searchConversations,
    sendMessage, regenerateMessage,
    listMemories, createMemory, updateMemory, deleteMemory,
    getSystemPrompt, saveSystemPrompt,
    getConfig, updateConfig, listModels, pullModel, importModel,
    getCatalog, getHardware, getPs,
    formatTime, relativeTime, dateGroup, countThreads,
    convToWeave, convDetailToWeave, chatToTree,
    memoryToFrontend, markFiring,
  };
})();

Object.assign(window, { API });

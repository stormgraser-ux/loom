// Loom — seed data for the prototype
// Tree-structured messages: each has id, parent, children[], role, content, model, ts, tokps, tokens, stop.

const SEED_MEMORIES = [
  {
    id: 'm1',
    title: 'Project: Loom',
    body: 'Loom is a local-only chat wrapper I\'m building for friends and family. Stack: FastAPI + SQLite + OpenAI-compatible endpoint pointed at Ollama/Qwen 3.6 35B. Tree-structured conversations.',
    keywords: ['loom', 'project', 'fastapi', 'sqlite', 'ollama', 'qwen'],
    firing: true,
    lastUsed: '2m ago',
  },
  {
    id: 'm2',
    title: 'Preferred phrasing',
    body: 'Prefer terse, typographically-aware responses. Avoid em-dashes when hyphens work. Don\'t open with "Certainly" or "Absolutely".',
    keywords: ['voice', 'style', 'writing', 'tone'],
    firing: true,
    lastUsed: '2m ago',
  },
  {
    id: 'm3',
    title: 'Home workshop',
    body: 'Basement workshop, oak bench, north-facing. Mostly hand tools. Working on a walnut writing desk for the study.',
    keywords: ['workshop', 'woodworking', 'desk', 'walnut'],
    firing: false,
    lastUsed: '4d ago',
  },
  {
    id: 'm4',
    title: 'Family',
    body: 'Partner: Elena. Daughter: Mira (6). Dog: Aster (border collie).',
    keywords: ['family', 'elena', 'mira', 'aster'],
    firing: false,
    lastUsed: '3w ago',
  },
  {
    id: 'm5',
    title: 'Reading list',
    body: 'Currently reading: "The Overstory" (Powers), "A Pattern Language" (Alexander), "Seeing Like a State" (Scott).',
    keywords: ['reading', 'books', 'powers', 'alexander'],
    firing: false,
    lastUsed: '1w ago',
  },
  {
    id: 'm6',
    title: 'Health',
    body: 'Runs 3x/week, usually 5k loop along the canal. Bad left knee since 2023 — avoid hill repeats.',
    keywords: ['running', 'exercise', 'knee', 'health'],
    firing: false,
    lastUsed: '6d ago',
  },
  {
    id: 'm7',
    title: 'Editor + tools',
    body: 'Neovim + Lazyvim. Tmux sessions named per project. Prefer ripgrep over grep, fd over find, eza over ls.',
    keywords: ['editor', 'neovim', 'tmux', 'cli', 'tools'],
    firing: false,
    lastUsed: '12h ago',
  },
];

const SEED_WEAVES = [
  {
    id: 'w1', title: 'Naming a writing desk joint', when: 'now', threads: 3, active: true,
    group: 'Today',
  },
  {
    id: 'w2', title: 'Debug FastAPI SSE disconnect', when: '2h', threads: 1, group: 'Today',
  },
  {
    id: 'w3', title: 'Poem about the first hard frost', when: '5h', threads: 2, group: 'Today',
  },
  {
    id: 'w4', title: 'Sourdough hydration ratios', when: 'Yesterday', threads: 1, group: 'Earlier',
  },
  {
    id: 'w5', title: 'Explain BGE-M3 embedding vs keyword retrieval', when: 'Tue', threads: 4, group: 'Earlier',
  },
  {
    id: 'w6', title: 'Review: letter to the council re: canal path', when: 'Mon', threads: 1, group: 'Earlier',
  },
  {
    id: 'w7', title: 'Mira\'s bedtime story — the lantern keeper', when: 'Sun', threads: 2, group: 'Earlier',
  },
  {
    id: 'w8', title: 'Pattern Language Ch. 12 — main entrance', when: '3w', threads: 1, group: 'Older',
  },
  {
    id: 'w9', title: 'Tmux popup for quick-capture notes', when: '1mo', threads: 1, group: 'Older',
  },
];

const SEED_TREE = (() => {
  const nodes = {};
  const add = (m) => { nodes[m.id] = { children: [], ...m }; if (m.parent) nodes[m.parent].children.push(m.id); return m.id; };

  add({
    id: 'n0', parent: null, role: 'system', model: 'persona \u00b7 qwen3-35b',
    content: 'Persona: "The Archivist" loaded. 7 memories indexed. Tools: web_search, file_read.',
  });

  add({
    id: 'n1', parent: 'n0', role: 'user',
    content: 'I\'m building a walnut writing desk for the study. For the apron-to-leg joint, I\'m torn between a through-mortise-and-tenon with a wedge, a drawbored M&T, and a sliding dovetail. The desk will see daily use but never move. What would you choose, and more importantly \u2014 does the joint deserve a name in the build log?',
    ts: '9:42',
  });

  add({
    id: 'n2', parent: 'n1', role: 'assistant', model: 'qwen3-35b \u00b7 q5_k_m', tokps: 38.2, tokens: 312, stop: 'eos',
    ts: '9:42',
    content: [
      { p: 'For a stationary piece in **walnut**, a **drawbored mortise-and-tenon** is the honest choice. It pulls tight forever without glue doing the heavy lifting, and the offset peg leaves a small visible mark on the inside face \u2014 a signature you\'ll catch every time you open the kneehole.' },
      { p: 'Sliding dovetails are beautiful on case sides, but on an apron-to-leg junction they can fight seasonal movement in a wide top. The wedged through-tenon is gorgeous but reads formal \u2014 better for a bench or a library table than a daily desk.' },
      { p: 'As for names: yes. A joint you drawbore deserves one \u2014 call it the **pinned shoulder**, after what you\'ll actually see when you kneel under the desk with a flashlight in ten years.' },
    ],
    chipsMemory: ['Home workshop'],
    chipsTool: [],
    first: true,
  });

  add({
    id: 'n2b', parent: 'n1', role: 'assistant', model: 'qwen3-35b \u00b7 q5_k_m', tokps: 36.8, tokens: 284, stop: 'eos',
    content: [
      { p: 'Take the **wedged through-tenon**. You say the desk never moves \u2014 lean into that. The wedge fans the tenon inside the mortise and locks it mechanically, and the end-grain rosette on the outside face of the leg becomes the piece\'s quiet boast.' },
      { p: 'Yes, name it \u2014 builders have always named joints. *The lantern* for this one: the wedge splits the tenon like lamp-light through a shutter.' },
    ],
  });

  add({
    id: 'n2c', parent: 'n1', role: 'assistant', model: 'qwen3-35b \u00b7 q5_k_m', tokps: 40.1, tokens: 221, stop: 'eos',
    content: [
      { p: 'Sliding dovetail \u2014 but only the apron-to-leg run, not the top. Cut a tapered socket in the leg, slide the apron home from the top, wedge from underneath. It\'s quicker than a drawbore, reads modern, and the apron lifts free when you refinish.' },
      { p: 'Call it the **dovetail drawer**, since that\'s what it behaves like.' },
    ],
  });

  add({
    id: 'n3', parent: 'n2', role: 'user',
    content: 'Pinned shoulder. I like that. Write it up as a one-paragraph entry for the build log, dated today, first-person, plainspoken. No flourish.',
    ts: '9:45',
  });

  add({
    id: 'n4', parent: 'n3', role: 'assistant', model: 'qwen3-35b \u00b7 q5_k_m', tokps: 39.4, tokens: 178, stop: 'eos', streaming: true,
    ts: '9:46',
    content: [
      { p: '**22 April 2026.** Cut the apron tenons today \u2014 1\u215b\u201d thick, 2\u00bc\u201d wide, shouldered on both faces. Bored the mortises 3\u20443\u204416\u201d deeper than the tenon length, then drilled the peg hole 1\u204432\u201d offset toward the shoulder so the drawbore pulls the joint home.' },
      { p: 'Pinned with walnut pegs from the offcut pile. No glue on the shoulders, a smear of hide on the cheeks. Calling it the **pinned shoulder** going forward \u2014 easier to say than \u201cdrawbored through-tenon\u201d when I\'m three coffees in and narrating to' },
    ],
    chipsMemory: ['Home workshop'],
    chipsTool: ['file_read \u00b7 build-log.md'],
  });

  add({
    id: 'n4b', parent: 'n3', role: 'assistant', model: 'qwen3-35b \u00b7 q5_k_m', tokps: 42.0, tokens: 155, stop: 'eos',
    content: [
      { p: '**22 April 2026.** Decided on the pinned shoulder for the apron-to-leg joints. Through-tenon, drawbored with walnut pegs from the offcut pile, shoulders dry, cheeks with hide glue. The offset is a sixteenth. Pulls tight without clamps, visible on the inside of the leg \u2014 which feels right for a desk only I\'ll sit at.' },
    ],
  });

  const currentPath = ['n0', 'n1', 'n2', 'n3', 'n4'];
  return { nodes, root: 'n0', currentPath };
})();

Object.assign(window, { SEED_MEMORIES, SEED_WEAVES, SEED_TREE });

// Loom — icons (React, tiny, stroke-based, harmonized with the arcane theme)

const ICON_PATHS = {
  plus:       <><path d="M8 3v10M3 8h10"/></>,
  search:     <><circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5L13.5 13.5"/></>,
  menu:       <><path d="M3 4h10M3 8h10M3 12h10"/></>,
  sidebar:    <><rect x="2" y="3" width="12" height="10" rx="1.5"/><path d="M6 3v10"/></>,
  inspector:  <><rect x="2" y="3" width="12" height="10" rx="1.5"/><path d="M10 3v10"/></>,
  settings:   <><circle cx="8" cy="8" r="2"/><path d="M8 1.5v2M8 12.5v2M14.5 8h-2M3.5 8h-2M12.6 3.4l-1.4 1.4M4.8 11.2l-1.4 1.4M12.6 12.6l-1.4-1.4M4.8 4.8L3.4 3.4"/></>,
  close:      <><path d="M4 4l8 8M12 4l-8 8"/></>,
  send:       <><path d="M2 8l11-5-4 12-2-5-5-2z"/></>,
  sparkle:    <><path d="M8 2l1.2 3.8L13 7l-3.8 1.2L8 12l-1.2-3.8L3 7l3.8-1.2z"/></>,
  copy:       <><rect x="4.5" y="4.5" width="8" height="8" rx="1"/><path d="M2.5 10.5V3a.5.5 0 01.5-.5h7.5"/></>,
  retry:      <><path d="M13 8A5 5 0 1 1 8 3V1.5M8 1.5L6 3M8 1.5l2 1.5"/></>,
  branch:     <><path d="M4 2v5a3 3 0 003 3h5"/><circle cx="4" cy="2" r="1.3"/><circle cx="12" cy="10" r="1.3"/><path d="M4 10v4"/><circle cx="4" cy="14" r="1.3"/></>,
  edit:       <><path d="M3 11l7-7 2 2-7 7H3v-2z"/><path d="M9 5l2 2"/></>,
  chevronL:   <><path d="M10 3L5 8l5 5"/></>,
  chevronR:   <><path d="M6 3l5 5-5 5"/></>,
  chevronDown: <><path d="M3 6l5 5 5-5"/></>,
  chevronUp:  <><path d="M3 10l5-5 5 5"/></>,
  globe:      <><circle cx="8" cy="8" r="5.5"/><path d="M2.5 8h11M8 2.5c2 2 2 9 0 11M8 2.5c-2 2-2 9 0 11"/></>,
  file:       <><path d="M4 2h5l3 3v9H4z"/><path d="M9 2v3h3"/></>,
  memory:     <><path d="M4 3h8v10l-4-2-4 2z"/></>,
  thread:     <><circle cx="8" cy="3" r="1.3"/><path d="M8 4.3v3.5M8 8a3 3 0 013 3v2.7"/><circle cx="11" cy="13.7" r="1.3"/><path d="M8 8a3 3 0 00-3 3v2.7"/><circle cx="5" cy="13.7" r="1.3"/></>,
  attach:     <><path d="M11 4L5.5 9.5a2 2 0 002.8 2.8L13.8 7a3.5 3.5 0 00-5-5L3.3 7.6a5 5 0 007 7L15 10"/></>,
  at:         <><circle cx="8" cy="8" r="2.5"/><path d="M10.5 8v1.5a1.5 1.5 0 003 0V8a5.5 5.5 0 10-2.5 4.6"/></>,
  clock:      <><circle cx="8" cy="8" r="5.5"/><path d="M8 5v3l2 1.5"/></>,
  trash:      <><path d="M3 5h10M6 5V3h4v2M5 5l1 9h4l1-9"/></>,
  book:       <><path d="M3 3h4a2 2 0 012 2v8a2 2 0 00-2-2H3z"/><path d="M13 3H9a2 2 0 00-2 2v8a2 2 0 012-2h4z"/></>,
  sliders:    <><path d="M3 4h7M13 4h0M3 8h2M8 8h5M3 12h7M13 12h0"/><circle cx="11" cy="4" r="1.5"/><circle cx="6" cy="8" r="1.5"/><circle cx="11" cy="12" r="1.5"/></>,
  cpu:        <><rect x="4" y="4" width="8" height="8" rx="1"/><path d="M7 4V2M9 4V2M7 14v-2M9 14v-2M4 7H2M4 9H2M14 7h-2M14 9h-2"/></>,
  persona:    <><circle cx="8" cy="6" r="2.5"/><path d="M3 13.5c0-2.5 2.2-4 5-4s5 1.5 5 4"/></>,
  palette:    <><path d="M8 2a6 6 0 00-.2 12c1 0 1.4-.5 1.4-1.2 0-.5-.3-.8-.3-1.3 0-.5.4-.8.9-.8H11a3 3 0 003-3A5.9 5.9 0 008 2z"/><circle cx="5.5" cy="7" r=".8"/><circle cx="8" cy="5" r=".8"/><circle cx="10.5" cy="7" r=".8"/></>,
  save:       <><path d="M3 3h8l2 2v8H3z"/><path d="M5 3v4h6V3M6 10h4"/></>,
  link:       <><path d="M7 9a3 3 0 004 0l2-2a3 3 0 00-4-4L8 4M9 7a3 3 0 00-4 0L3 9a3 3 0 004 4l1-1"/></>,
  dot:        <><circle cx="8" cy="8" r="1.5"/></>,
  clipboard:  <><rect x="4" y="3.5" width="8" height="10" rx="1"/><path d="M6 3.5V3a2 2 0 014 0v.5"/></>,
  thinking:   <><circle cx="8" cy="8" r="5.5"/><path d="M6 6.5c0-1.1.9-2 2-2s2 .9 2 2c0 .8-.5 1.3-1 1.6s-1 .7-1 1.4"/><circle cx="8" cy="11.5" r=".6" fill="currentColor" stroke="none"/></>,
};

function Icon({ name, size = 16, stroke = 1.6, style, className }) {
  const content = ICON_PATHS[name];
  if (!content) return null;
  return (
    <svg
      className={className}
      style={style}
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {content}
    </svg>
  );
}

function LoomMark({ size = 22, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" style={style} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="16" cy="16" r="13" opacity="0.35"/>
      <path d="M16 4c5 4 5 20 0 24" />
      <path d="M16 4c-5 4 -5 20 0 24" />
      <path d="M4 16c4 -5 20 -5 24 0" />
      <path d="M4 16c4 5 20 5 24 0" />
      <circle cx="16" cy="16" r="2" fill="currentColor" opacity="0.9" stroke="none" />
    </svg>
  );
}

Object.assign(window, { Icon, LoomMark });

const drawings={
  tempo:'<path d="M7 21l3-18h4l3 18zM12 16l6-10M9 18h6"/><circle cx="12" cy="16" r="1"/>',
  gate:'<path d="M3 21V5h3V3h3v2h2v3h2V5h2V3h3v2h3v16M3 11h18M8 21v-5a4 4 0 0 1 8 0v5M10 15v6m4-6v6M2 21h20"/>',
  amp:'<rect x="2" y="6" width="20" height="14" rx="2"/><path d="M8 6V4h8v2M2 14h20M5 20v2m14-2v2M5 10h7"/><circle cx="15" cy="10" r="1"/><circle cx="19" cy="10" r="1"/><path d="M6 17h12"/>',
  cab:'<rect x="5" y="2" width="14" height="20" rx="2"/><circle cx="12" cy="15" r="4"/><circle cx="12" cy="15" r="1"/><path d="M9 5h6v3H9z"/>',
  eq:'<path d="M5 3v8m0 4v6M12 3v3m0 4v11M19 3v12m0 4v2"/><rect x="3" y="11" width="4" height="4" rx="1"/><rect x="10" y="6" width="4" height="4" rx="1"/><rect x="17" y="15" width="4" height="4" rx="1"/>',
  comp:'<path d="M3 4h18M3 20h18M4 12h3l2-5 3 10 3-10 2 5h3M9 2l3 2 3-2M9 22l3-2 3 2"/>',
  delay:'<rect x="2" y="3" width="20" height="18" rx="2"/><circle cx="7" cy="9" r="3"/><circle cx="17" cy="9" r="3"/><circle cx="7" cy="9" r=".5"/><circle cx="17" cy="9" r=".5"/><path d="M7 12h10M5 16h9v2H5zM18 16v2"/>',
  reverb:'<path d="M2 21V7l4-4h12l4 4v14M2 7l5 4m15-4-5 4M2 21l5-4m15 4-5-4M7 17V11a5 5 0 0 1 10 0v6M10 17v-4h4v4M7 17h10M3 21h18M5 19h14"/>'
};
export function effectIcon(id) {
  if(id==='mod')return '∿';
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${drawings[id]||''}</svg>`;
}

import { $, escape, presetInk } from './dom.js';
export function renderPresetsPanel(
  { presets, pedalState, selected, busy },
  { loadPreset },
) {
  const query = $('search').value.toLowerCase(),
    filtered = presets.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        String(p.id + 1).includes(query),
    );
  if (!presets.length)
    $('preset-list').innerHTML =
      '<div class="empty-list"><strong>Your library starts here.</strong>Connect your pedal to read its stored presets, or explore the demo.</div>';
  else if (!filtered.length)
    $('preset-list').innerHTML =
      '<div class="empty-list">No matching presets.</div>';
  else
    $('preset-list').innerHTML = filtered
      .map((p) => {
        const slots = (pedalState?.slots || []).flatMap((id, slot) =>
          id === p.id ? [slot] : [],
        );
        const assignment = slots.length
          ? ` · Assigned to ${slots.map((slot) => 'ABC'[slot]).join(', ')}`
          : '';
        const activeSlot = slots.includes(pedalState?.activeSlot)
          ? ` · Active slot ${'ABC'[pedalState.activeSlot]}`
          : '';
        const badges = slots
          .map(
            (slot) =>
              `<span class="preset-slot-badge ${slot === pedalState.activeSlot ? 'active' : ''}" data-preset-slot="${slot}" title="${slot === pedalState.activeSlot ? 'Active slot' : 'Assigned to slot'} ${'ABC'[slot]}">${'ABC'[slot]}</span>`,
          )
          .join('');
        const color = p.color || '#93a786';
        return `<button class="preset-row ${p.id === selected ? 'selected' : ''}" data-preset="${p.id}" aria-pressed="${p.id === selected}" aria-label="${escape(p.name + assignment + activeSlot)}" title="${escape(p.name)}" ${busy || !p.read ? 'disabled' : ''}><span class="preset-index">${String(p.id + 1).padStart(2, '0')}</span><i class="preset-dot" style="background:${color}"></i><span class="preset-list-name">${escape(p.name)}</span><span class="preset-slot-badges" style="--badge-color:${color};--badge-ink:${presetInk(color)}">${badges || '<span class="playing" aria-hidden="true">↗</span>'}</span></button>`;
      })
      .join('');
  document
    .querySelectorAll('[data-preset]')
    .forEach(
      (b) => (b.onclick = () => void loadPreset(Number(b.dataset.preset))),
    );
}

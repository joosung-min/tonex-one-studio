import { $, presetInk, presetName } from './dom.js';
export function renderPresetWorkspace({
  displayedPreset,
  pedalState,
  presets,
  selected,
  activePresetId,
  ready,
}) {
  const p = displayedPreset;
  $('preset-number').textContent = p
    ? `PRESET ${String(p.id + 1).padStart(2, '0')} / 20`
    : 'NO PRESET SELECTED';
  $('preset-name').textContent = p ? presetName(p) : 'Connect your pedal';
  $('preset-name').title = p ? presetName(p) : 'Connect your pedal';
  document
    .querySelector('.tone-card')
    .style.setProperty('--preset-color', p?.color || 'var(--border)');
  const isActive = !!p && (pedalState?.bypass || selected === activePresetId);
  $('preset-status').hidden = !isActive;
  $('preset-status').textContent = isActive
    ? pedalState?.bypass
      ? 'Bypassed'
      : 'Active'
    : '';
  document.querySelectorAll('[data-slot]').forEach((b) => {
    const current = Number(b.dataset.slot) === pedalState?.activeSlot;
    const slotPreset = presets[pedalState?.slots[Number(b.dataset.slot)]];
    const slot = Number(b.dataset.slot),
      name = slotPreset?.read ? presetName(slotPreset) : '—',
      letters = Array.from(name);
    b.querySelector('.slot-preset').textContent =
      letters.length > 10 ? letters.slice(0, 10).join('') + '…' : name;
    const description = `Slot ${'ABC'[slot]} · ${slot === 2 ? 'Stomp' : 'Dual'} · ${name}`;
    b.title = description;
    b.setAttribute('aria-label', description);
    const color = slotPreset?.color || '#93a786';
    b.style.setProperty('--slot-color', color);
    b.style.setProperty('--slot-ink', presetInk(color));
    b.classList.toggle('active', current);
    b.setAttribute('aria-pressed', String(current));
    b.disabled = !ready;
  });
}
export function renderNavigation({
  pedalState,
  ready,
  settingsReading,
  activationMethod,
  navigationSlot,
  previousPreset,
  nextPreset,
}) {
  const bypass = $('global-bypass-shortcut');
  bypass.disabled = !ready || settingsReading;
  bypass.classList.toggle('active', !!pedalState?.bypass);
  bypass.setAttribute('aria-pressed', String(!!pedalState?.bypass));
  bypass.title = `${activationMethod === 'single' ? 'Tap' : 'Double-tap'} to turn Global Bypass ${pedalState?.bypass ? 'Off' : 'On'}`;
  for (const [id, direction, title] of [
    ['previous-preset', -1, 'Previous'],
    ['next-preset', 1, 'Next'],
  ]) {
    const button = $(id),
      destination = direction === -1 ? previousPreset : nextPreset,
      color = destination?.color || '#93a786';
    button.disabled = !ready || !destination?.read;
    button.style.setProperty('--destination-color', color);
    button.style.setProperty('--destination-ink', presetInk(color));
    const name = destination ? presetName(destination) : '—',
      letters = Array.from(name);
    button.querySelector('small').textContent =
      letters.length > 12 ? letters.slice(0, 12).join('') + '…' : name;
    button.title = destination
      ? `Load ${name} into slot ${'ABC'[navigationSlot] || 'A'}`
      : `No ${title.toLowerCase()} preset`;
    button.setAttribute(
      'aria-label',
      destination
        ? `${title}: load ${name} into slot ${'ABC'[navigationSlot] || 'A'}`
        : `${title}: no preset`,
    );
  }
}

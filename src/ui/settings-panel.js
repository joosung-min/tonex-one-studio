import { $ } from './dom.js';
const globalFields = [
  {
    key: 'masterVolume',
    name: 'Master volume',
    min: 0,
    max: 10,
    step: 0.1,
    unit: '',
  },
  {
    key: 'inputTrim',
    name: 'Input trim',
    min: -15,
    max: 15,
    step: 0.1,
    unit: 'dB',
  },
  {
    key: 'tuningReference',
    name: 'Tuning reference',
    min: 415,
    max: 465,
    step: 1,
    unit: 'Hz',
  },
];
export function renderSettingsPanel(
  {
    ready,
    settingsReading,
    demo,
    connected,
    masterVolume,
    masterUnavailable,
    pedalState,
    activationMethod,
    bypassDescription,
  },
  { notify, applyGlobalSetting, changeActivation, renderSettings },
) {
  const enabled = ready && !settingsReading,
    disabled = enabled ? '' : 'disabled';
  $('refresh-settings').disabled = !enabled;
  $('settings-note').textContent = demo
    ? 'Demo controls are simulated.'
    : settingsReading
      ? 'Reading global settings…'
      : connected
        ? 'Changes apply to the whole pedal.'
        : 'Connect your pedal to read global settings, or explore the demo.';
  $('global-controls').innerHTML =
    globalFields
      .map((field) => {
        const value =
            field.key === 'masterVolume'
              ? masterVolume
              : pedalState?.[field.key],
          available = Number.isFinite(value),
          blocked = !enabled || !available;
        return `<div class="global-setting"><h2>${field.name}</h2><div class="control"><label class="value-field"><input id="global-${field.key}" aria-label="${field.name}" type="number" min="${field.min}" max="${field.max}" step="${field.step}" value="${available ? Number(value.toFixed(2)) : ''}" placeholder="—" ${blocked ? 'disabled' : ''}><small>${field.unit}</small></label><input id="global-range-${field.key}" aria-label="${field.name} slider" type="range" min="${field.min}" max="${field.max}" step="1" value="${available ? value : field.min}" ${blocked ? 'disabled' : ''}></div>${field.key === 'masterVolume' && masterUnavailable ? '<p class="settings-note">Master volume is unavailable: the pedal did not return a supported reply. Refresh to retry.</p>' : ''}</div>`;
      })
      .join('') +
    [
      { key: 'bypass', name: 'Global bypass', note: bypassDescription },
      {
        key: 'cabBypass',
        name: 'Global cabinet bypass',
        note: 'On disables cabinet simulation for every preset.',
      },
      {
        key: 'directMonitoring',
        name: 'Direct monitoring',
        note: 'Off disables direct guitar monitoring through the pedal’s outputs.',
      },
    ]
      .map(
        ({ key, name, note }) =>
          `<div class="global-setting"><h2>${name}</h2><button class="toggle global-toggle ${pedalState?.[key] ? '' : 'off'}" data-global-toggle="${key}" aria-pressed="${!!pedalState?.[key]}" ${disabled}>${pedalState ? (pedalState[key] ? '● On' : '○ Off') : '—'}</button><p class="settings-note">${note}</p></div>`,
      )
      .join('');
  for (const field of globalFields) {
    const input = $(`global-${field.key}`),
      slider = $(`global-range-${field.key}`);
    const commit = () => {
      if (input.value === '' || !input.checkValidity()) {
        notify(
          `Enter a valid ${field.name.toLowerCase()} between ${field.min} and ${field.max}${field.unit ? ' ' + field.unit : ''}.`,
        );
        renderSettings();
        return;
      }
      void applyGlobalSetting(field.key, Number(input.value));
    };
    input.onchange = commit;
    input.onkeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        input.blur();
      }
    };
    input.oninput = () => {
      if (input.value !== '' && input.checkValidity())
        slider.value = input.value;
    };
    slider.oninput = () => {
      input.value = slider.value;
    };
    slider.onchange = commit;
  }
  $('global-controls').insertAdjacentHTML(
    'beforeend',
    `<div class="global-setting"><h2>Activation method</h2><button id="activation-method" type="button" class="toggle global-toggle ${activationMethod === 'single' ? '' : 'off'}" aria-label="Single tap activation" aria-pressed="${activationMethod === 'single'}">${activationMethod === 'single' ? 'Single tap' : 'Double tap'}</button><p class="settings-note">Applies to effect cards and the Global Bypass shortcut. Saved in this browser.</p></div>`,
  );
  $('activation-method').onclick = changeActivation;
  document
    .querySelectorAll('[data-global-toggle]')
    .forEach(
      (button) =>
        (button.onclick = () =>
          void applyGlobalSetting(
            button.dataset.globalToggle,
            !pedalState[button.dataset.globalToggle],
          )),
    );
}

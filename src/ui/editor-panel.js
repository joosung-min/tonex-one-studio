import { $ } from './dom.js';
import {
  groups,
  modelNames,
  ampLabels,
  indicesFor,
  label,
  unit,
  step,
  format,
} from '../effect-metadata.js';
import { parameters } from '../parameters.js';
import { rhythmicDivisions, divisionButtons } from '../rhythmic-divisions.js';
export function renderEditorPanel(
  {
    effect,
    params,
    demo,
    selected,
    activePresetId,
    tapPreview,
    pedalState,
    ready,
    editable,
  },
  {
    applyParameter,
    applyDivision,
    updateControl,
    toggleEffect,
    applyManualTempo,
  },
) {
  const g = groups.find((g) => g.id === effect),
    enabled = editable,
    disabled = enabled ? '' : 'disabled';
  $('effect-name').textContent = ampLabels[effect];
  $('effect-actions').className = 'effect-actions';
  $('effect-actions').innerHTML =
    g.enable !== undefined
      ? `<button class="toggle ${params[g.enable] !== 1 ? 'off' : ''}" data-toggle="${g.enable}" aria-pressed="${params[g.enable] === 1}" ${disabled}>${params[g.enable] === 1 ? '● On' : '○ Off'}</button>`
      : '';
  if (g.id === 'cab')
    $('effect-actions').innerHTML +=
      `<button class="toggle ${params[24] === 2 ? 'off' : ''}" id="cab-toggle" aria-pressed="${params[24] !== 2}" ${disabled}>${params[24] === 2 ? '○ Off' : '● On'}</button>`;
  const indices = indicesFor(g, params),
    syncIndex = indices.find((index) => parameters[index].id.endsWith('_SYNC'));
  const position =
    g.position !== undefined
      ? `<button type="button" class="toggle routing-toggle ${params[g.position] !== 1 ? 'off' : ''}" data-routing="${g.position}" aria-label="Effect position" aria-pressed="${params[g.position] === 1}" title="Switch between pre amp and post amp" ${disabled}>${params[g.position] === 1 ? 'Post amp' : 'Pre amp'}</button>`
      : '';
  const model =
    g.model !== undefined
      ? `<select data-param="${g.model}" aria-label="Effect model" ${disabled}>${modelNames[g.model].map((name, i) => `<option value="${i}" ${params[g.model] === i ? 'selected' : ''}>${name}</option>`).join('')}</select>`
      : '';
  const sync =
    syncIndex !== undefined
      ? `<button class="toggle ${params[syncIndex] !== 1 ? 'off' : ''}" data-toggle="${syncIndex}" aria-label="Sync" aria-pressed="${params[syncIndex] === 1}" ${disabled}>Sync ${params[syncIndex] === 1 ? 'On' : 'Off'}</button>`
      : '';
  const settingsOrder =
    g.id === 'mod' || g.id === 'delay'
      ? position + sync + model
      : position + model + sync;
  const settings = settingsOrder
    ? `<div class="effect-parameter-row" role="group" aria-label="Effect settings">${settingsOrder}</div>`
    : '';
  $('parameter-controls').innerHTML =
    settings +
    indices
      .filter((index) => index !== syncIndex)
      .map((index) => {
        const p = parameters[index],
          v = params[index],
          title = label(p);
        const heading =
          g.id === 'amp' && index === 11
            ? `<div class="parameter-section-heading"><h3>EQ</h3><button type="button" class="toggle routing-toggle ${params[10] !== 1 ? 'off' : ''}" data-routing="10" aria-label="EQ position" aria-pressed="${params[10] === 1}" title="Switch between pre amp and post amp" ${disabled}>${params[10] === 1 ? 'Post amp' : 'Pre amp'}</button></div>`
            : '';
        if (p.type === 'switch')
          return `<div class="control"><span class="control-label">${title}</span><button class="toggle ${v !== 1 ? 'off' : ''}" data-toggle="${index}" aria-pressed="${v === 1}" ${disabled}>${p.id.endsWith('_MODE') ? (v === 1 ? 'Ping-pong' : 'Normal') : v === 1 ? 'On' : 'Off'}</button></div>`;
        if (p.type === 'select') {
          if (p.id.endsWith('_TS')) {
            const disabledDivision = !enabled;
            const listed = divisionButtons.some((option) => option.value === v);
            const current =
              rhythmicDivisions.find((option) => option.value === v)?.label ||
              '—';
            return `<div class="control rhythmic-division"><span id="division-label-${index}" class="control-label">Division</span><div class="division-buttons" role="group" aria-labelledby="division-label-${index}">${divisionButtons.map((option) => `<button type="button" data-division="${index}" data-value="${option.value}" aria-pressed="${v === option.value}" title="${rhythmicDivisions[option.value].label}" ${disabledDivision ? 'disabled' : ''}>${option.label}</button>`).join('')}</div>${!listed && Number.isFinite(v) ? `<span class="division-current">Current: ${current}</span>` : ''}</div>`;
          }
          const options = (
            modelNames[index] ||
            Array.from({ length: p.max - p.min + 1 }, (_, i) =>
              String(i + p.min),
            )
          ).map((label, i) => ({ label, value: i + p.min }));
          return `<label class="control"><span class="control-label">${title}</span><select aria-label="${title}" data-param="${index}" ${disabled}>${options.map((option) => `<option value="${option.value}" ${v === option.value ? 'selected' : ''}>${option.label}</option>`).join('')}</select></label>`;
        }
        const bandStart =
          g.id === 'amp' && [11, 12, 14].includes(index)
            ? `<div class="eq-band-row ${index === 14 ? 'eq-q-row' : ''}">`
            : '';
        const bandEnd =
          g.id === 'amp' && [16, 17, 14].includes(index) ? '</div>' : '';
        return `${heading}${bandStart}<div class="control"><label class="control-label" for="range-${index}">${title}</label><label class="value-field"><input id="value-${index}" aria-label="${title} numeric value" type="number" min="${p.min}" max="${p.max}" step="${step(p)}" data-param="${index}" value="${Number.isFinite(v) ? format(v, p) : ''}" placeholder="—" ${disabled}><small>${unit(p)}</small></label><input id="range-${index}" type="range" data-param="${index}" min="${Math.ceil(p.min)}" max="${Math.floor(p.max)}" step="1" value="${v ?? p.min}" ${disabled}></div>${bandEnd}`;
      })
      .join('');
  if (effect === 'tempo') {
    $('parameter-controls').innerHTML =
      `<div class="tempo-control"><div class="tempo-input"><input id="tempo-value" aria-label="Global BPM" type="number" min="40" max="240" step="0.1" value="${Number.isFinite(tapPreview ?? pedalState?.tempo) ? Number((tapPreview ?? pedalState.tempo).toFixed(1)) : ''}" placeholder="—" ${ready ? '' : 'disabled'}><div class="tempo-step-buttons"><button id="tempo-up" type="button" aria-label="Increase BPM by 1" title="Increase BPM by 1" ${ready ? '' : 'disabled'}>↑</button><button id="tempo-down" type="button" aria-label="Decrease BPM by 1" title="Decrease BPM by 1" ${ready ? '' : 'disabled'}>↓</button></div><span>BPM</span><button id="apply-tempo" class="secondary" ${ready ? '' : 'disabled'}>Apply</button></div><input id="tempo-slider" aria-label="Tempo slider" type="range" min="40" max="240" step="1" value="${Number.isFinite(tapPreview ?? pedalState?.tempo) ? (tapPreview ?? pedalState.tempo) : 120}" ${ready ? '' : 'disabled'}></div>`;
    $('apply-tempo').onclick = () => void applyManualTempo();
    $('tempo-value').onkeydown = (e) => {
      if (e.key === 'Enter') void applyManualTempo();
    };
    const updateTempoSteps = () => {
      const text = $('tempo-value').value,
        value = Number(text),
        valid =
          text !== '' && Number.isFinite(value) && value >= 40 && value <= 240;
      $('tempo-up').disabled = !ready || !valid || value >= 240;
      $('tempo-down').disabled = !ready || !valid || value <= 40;
    };
    $('tempo-slider').oninput = () => {
      $('tempo-value').value = $('tempo-slider').value;
      updateTempoSteps();
    };
    $('tempo-value').oninput = () => {
      const value = Number($('tempo-value').value);
      if (
        $('tempo-value').value !== '' &&
        Number.isFinite(value) &&
        value >= 40 &&
        value <= 240
      )
        $('tempo-slider').value = value;
      updateTempoSteps();
    };
    for (const [id, direction] of [
      ['tempo-up', 1],
      ['tempo-down', -1],
    ])
      $(id).onclick = () => {
        const text = $('tempo-value').value,
          value = Number(text);
        if (
          !ready ||
          text === '' ||
          !Number.isFinite(value) ||
          value < 40 ||
          value > 240
        )
          return;
        $('tempo-value').value = Number(
          Math.max(40, Math.min(240, value + direction)).toFixed(1),
        );
        $('tempo-value').dispatchEvent(new Event('input', { bubbles: true }));
      };
    updateTempoSteps();
    $('parameter-note').textContent = demo
      ? 'Demo tempo is simulated.'
      : 'Tap the Global BPM card to set tempo, or enter a value here. Effects follow tempo when their sync is enabled.';
    return;
  }
  if ($('cab-toggle')) $('cab-toggle').onclick = () => toggleEffect(g);
  document
    .querySelectorAll('[data-routing]')
    .forEach(
      (b) =>
        (b.onclick = () =>
          applyParameter(
            Number(b.dataset.routing),
            params[b.dataset.routing] === 1 ? 0 : 1,
            true,
          )),
    );
  document
    .querySelectorAll('[data-toggle]')
    .forEach(
      (b) =>
        (b.onclick = () =>
          applyParameter(
            Number(b.dataset.toggle),
            params[b.dataset.toggle] === 1 ? 0 : 1,
            true,
          )),
    );
  document
    .querySelectorAll('[data-division]')
    .forEach(
      (b) =>
        (b.onclick = () =>
          void applyDivision(
            Number(b.dataset.division),
            Number(b.dataset.value),
          )),
    );
  document
    .querySelectorAll('select[data-param]')
    .forEach(
      (b) =>
        (b.onchange = () =>
          applyParameter(Number(b.dataset.param), Number(b.value), true)),
    );
  document.querySelectorAll('input[data-param]').forEach((b) => {
    b.oninput = () => {
      if (b.value !== '' && Number.isFinite(Number(b.value)))
        applyParameter(Number(b.dataset.param), Number(b.value));
    };
    b.onchange = () => {
      if (b.value !== '' && Number.isFinite(Number(b.value)))
        applyParameter(Number(b.dataset.param), Number(b.value));
      else updateControl(Number(b.dataset.param));
    };
  });
  $('parameter-note').textContent = demo
    ? 'Demo controls are simulated.'
    : selected !== activePresetId && selected !== null
      ? 'Load this preset to edit it on your pedal.'
      : editable
        ? 'Permanent saving isn’t supported here. Use the official TONEX Editor app to save changes permanently.'
        : 'Read a supported preset to enable live controls.';
}

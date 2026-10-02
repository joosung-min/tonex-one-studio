import { $ } from './dom.js';
import {
  groups,
  chainOrder,
  quickToggle,
  modelNames,
} from '../effect-metadata.js';
import { effectIcon } from '../effect-icons.js';
import { bindEffectInteractions } from '../effect-interactions.js';
export function createSignalChain({
  getState,
  selectEffect,
  toggleEffect,
  tapGlobalTempo,
}) {
  return function renderChain() {
    const {
      activationMethod,
      params,
      pedalState,
      tapPreview,
      effect,
      editable,
    } = getState();
    document.querySelector('.chain-hint').textContent =
      `Select to edit · ${activationMethod === 'single' ? 'Tap' : 'Double-tap'} to toggle`;
    if (!$('chain').children.length) {
      $('chain').innerHTML = chainOrder
        .map((id) => {
          const g = groups.find((group) => group.id === id);
          return `<button class="effect-block" data-effect="${g.id}" aria-pressed="false"><span class="effect-symbol" aria-hidden="true">${effectIcon(g.id)}</span><span class="effect-label">${g.name}</span><span class="effect-state"></span><i class="effect-led" aria-hidden="true"></i></button>`;
        })
        .join('');
      document.querySelectorAll('[data-effect]').forEach((button) => {
        const g = groups.find((group) => group.id === button.dataset.effect);
        if (g.id === 'tempo') {
          button.addEventListener('click', () => tapGlobalTempo(button));
          return;
        }
        bindEffectInteractions(button, {
          select: () => selectEffect(g.id),
          activation: () => getState().activationMethod,
          toggle: () => toggleEffect(g),
        });
      });
    }
    document.querySelectorAll('[data-effect]').forEach((button) => {
      const g = groups.find((group) => group.id === button.dataset.effect);
      if (g.id === 'tempo') {
        button.classList.toggle('selected', effect === 'tempo');
        button.classList.remove('on');
        button.setAttribute('aria-pressed', String(effect === 'tempo'));
        button.querySelector('.effect-state').textContent = Number.isFinite(
          tapPreview ?? pedalState?.tempo,
        )
          ? `${Number((tapPreview ?? pedalState.tempo).toFixed(1))} BPM`
          : '— BPM';
        button.title = 'Tap repeatedly to set global tempo';
        return;
      }
      const known = params.length === 109;
      const cardName =
        known && ['mod', 'delay', 'reverb'].includes(g.id)
          ? modelNames[g.model]?.[params[g.model]] || g.name
          : g.name;
      const cardLabel = button.querySelector('.effect-label');
      cardLabel.textContent = cardName;
      cardLabel.classList.toggle('long-name', cardName.length > 7);
      const on =
        known &&
        (g.enable === undefined || params[g.enable] === 1) &&
        !(g.id === 'cab' && params[24] === 2);
      button.classList.toggle('selected', effect === g.id);
      button.classList.toggle('on', on);
      button.setAttribute('aria-pressed', String(effect === g.id));
      button.querySelector('.effect-state').textContent = !known
        ? '—'
        : on
          ? 'On'
          : 'Off';
      button.title = quickToggle.has(g.id)
        ? `${cardName}: select to edit; ${activationMethod === 'single' ? 'tap' : 'double-click or double-tap'} to toggle${!editable ? ' after loading the preset' : ''}`
        : `${cardName}: select to edit`;
    });
  };
}

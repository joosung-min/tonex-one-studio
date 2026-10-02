export const groups = [
  {
    id: 'gate',
    name: 'Gate',
    enable: 1,
    position: 0,
    indices: [2, 3, 4],
  },
  {
    id: 'comp',
    name: 'Comp',
    enable: 6,
    position: 5,
    indices: [7, 8, 9],
  },
  {
    id: 'amp',
    name: 'Amp',
    enable: 18,
    indices: [20, 21, 34, 35],
  },
  { id: 'tempo', name: 'Tempo', indices: [] },
  {
    id: 'cab',
    name: 'Cab',
    indices: [24, 25, 26, 27, 28, 29, 30, 31, 32, 33],
  },
  {
    id: 'mod',
    name: 'Mod',
    enable: 64,
    position: 63,
    model: 65,
  },
  {
    id: 'delay',
    name: 'Delay',
    enable: 95,
    position: 94,
    model: 96,
  },
  {
    id: 'reverb',
    name: 'Reverb',
    enable: 37,
    position: 36,
    model: 38,
  },
];
export const modelNames = {
  24: ['Tone Model', 'VIR', 'Off'],
  25: Array.from({ length: 11 }, (_, i) => `Cabinet ${i + 1}`),
  27: ['Mic 1', 'Mic 2', 'Mic 3'],
  30: ['Mic 1', 'Mic 2', 'Mic 3'],
  38: ['Spring 1', 'Spring 2', 'Spring 3', 'Spring 4', 'Room', 'Plate'],
  65: ['Chorus', 'Tremolo', 'Phaser', 'Flanger', 'Rotary'],
  96: ['Digital', 'Tape'],
};
const labels = {
  2: 'Threshold',
  3: 'Release',
  4: 'Depth',
  7: 'Threshold',
  8: 'Make-up gain',
  9: 'Attack',
  11: 'Bass',
  12: 'Bass freq.',
  13: 'Mid',
  14: 'Mid Q',
  15: 'Mid freq.',
  16: 'Treble',
  17: 'Treble freq.',
  20: 'Gain',
  21: 'Volume',
  22: 'Mix',
  24: 'Cabinet mode',
  25: 'VIR cabinet',
  26: 'Resonance',
  27: 'Microphone 1',
  28: 'Mic 1 · X',
  29: 'Mic 1 · Z',
  30: 'Microphone 2',
  31: 'Mic 2 · X',
  32: 'Mic 2 · Z',
  33: 'Mic blend',
  34: 'Presence',
  35: 'Depth',
};
export const ampLabels = {
  amp: 'Amplifier',
  tempo: 'Global tempo',
  gate: 'Noise gate',
  comp: 'Compressor',
  cab: 'Cabinet',
  mod: 'Modulation',
  delay: 'Delay',
  reverb: 'Reverb',
};
export const chainOrder = [
  'gate',
  'amp',
  'cab',
  'tempo',
  'comp',
  'mod',
  'delay',
  'reverb',
];
export const quickToggle = new Set([
  'gate',
  'amp',
  'cab',
  'comp',
  'mod',
  'delay',
  'reverb',
]);
export function indicesFor(g, params) {
  if (g.id === 'reverb') {
    const base = 39 + Math.round(params[38] ?? 0) * 4;
    return [base, base + 1, base + 3, base + 2];
  }
  if (g.id === 'delay') {
    const base = 97 + Math.round(params[96] ?? 0) * 6;
    return [base, base + 1, base + 2, base + 3, base + 5, base + 4];
  }
  if (g.id === 'mod') {
    const bases = [66, 71, 77, 82, 88],
      counts = [5, 6, 5, 6, 6],
      m = Math.round(params[65] ?? 0);
    return Array.from(
      { length: counts[m] || 5 },
      (_, i) => (bases[m] || 66) + i,
    );
  }
  if (g.id === 'cab') return params[24] === 1 ? g.indices : [24];
  if (g.id === 'amp') return [...g.indices, 11, 13, 16, 12, 15, 17, 14];
  return g.indices;
}
export function label(p) {
  if (p.id.endsWith('_TS')) return 'Division';
  return (
    labels[p.index] ||
    p.id
      .replace(
        /^(REVERB_(SPRING\d|ROOM|PLATE)_|MODULATION_(CHORUS|TREMOLO)_|PHASER_|FLANGER_|ROTARY_|DELAY_(DIGITAL|TAPE)_)/,
        '',
      )
      .toLowerCase()
      .replaceAll('_', ' ')
      .replace(/^\w/, (s) => s.toUpperCase())
  );
}
export function unit(p) {
  if (/THRESHOLD|MAKE_UP|NOISE_GATE_DEPTH/.test(p.id)) return 'dB';
  if (/FREQ/.test(p.id)) return 'Hz';
  if (/RELEASE|ATTACK|PREDELAY|DELAY_.*_TIME/.test(p.id)) return 'ms';
  if (/_RATE/.test(p.id)) return 'Hz';
  if (p.max === 100 || (p.min === -100 && p.max === 100)) return '%';
  return '';
}
export function step(p) {
  return p.type === 'range' ? (p.max - p.min > 100 ? 1 : 0.1) : 1;
}
export function format(value, p) {
  return Number.isFinite(value)
    ? Number(value.toFixed(step(p) === 1 ? 0 : 1)).toString()
    : '—';
}

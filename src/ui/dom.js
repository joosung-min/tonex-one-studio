export const $ = (id) => document.getElementById(id);
export const escape = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ],
  );
export function presetInk(color) {
  const hex = color.startsWith('#') ? color.slice(1) : null,
    rgb = color.match(/[\d.]+/g);
  const components =
    hex && hex.length === 6
      ? [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16))
      : rgb?.slice(0, 3).map(Number) || [147, 167, 134];
  const linear = components.map((v) => {
    v /= 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2] > 0.179
    ? '#111811'
    : '#fff';
}

export function presetName(preset) {
  return `${String(preset.id + 1).padStart(2, '0')} ${preset.name}`;
}

/*
 * Preset display palette adapted from Builty/TonexOneController,
 * source/main/tonex_params.c. Copyright (C) 2025 Greg Smith.
 * Licensed under Apache-2.0; see licenses/Apache-2.0.txt.
 * https://github.com/Builty/TonexOneController
 */
// Pedal LED intensities are palette codes, not literal screen colors.
const displayPalette=new Map([
  [0xff0000,0xff0619],
  [0xff3f00,0xe75116],
  [0x9fff00,0xffe12a],
  [0x00ff00,0x00f642],
  [0x0fff2f,0x00fbcd],
  [0x00ffff,0x009dfc],
  [0x0000ff,0x0044fb],
  [0x2f00ff,0x6c64fb],
  [0xff00ff,0x845083],
  [0xbfbfbf,0xff8bfc],
  [0x110000,0x871218],
  [0x111100,0x7a3616],
  [0x112200,0x85771c],
  [0x001100,0x05802d],
  [0x002206,0x00826e],
  [0x001919,0x005882],
  [0x000011,0x002e82],
  [0x050011,0x433e82],
  [0x0a000a,0x851a6b],
  [0x0b0b0b,0x845083],
  [0x000000,0x595959],
]);
export function presetDisplayColor(rgb) {
  if(!rgb||rgb.length!==3||!Array.from(rgb).every(v=>Number.isInteger(v)&&v>=0&&v<=255))return '#595959';
  const raw=(rgb[0]<<16)|(rgb[1]<<8)|rgb[2];
  return '#'+(displayPalette.get(raw)??raw).toString(16).padStart(6,'0');
}

// USB protocol adapted from acf1210/TUSB (MIT). See THIRD_PARTY_LICENSES.txt.
export const VID = 0x1963, PID = 0x00d1;
export const bytes = (...parts) => Uint8Array.from(parts.flatMap(p => typeof p === 'number' ? [p] : [...p]));
export const hex = data => [...data].map(v => v.toString(16).padStart(2, '0')).join(' ');
export function crc16(data) {
  let crc = 0xffff;
  for (const b of data) { crc ^= b; for (let i = 0; i < 8; i++) crc = crc & 1 ? (crc >>> 1) ^ 0x8408 : crc >>> 1; }
  return (crc ^ 0xffff) & 0xffff;
}
export function frame(payload) {
  const crc = crc16(payload), out = [0x7e];
  for (const b of [...payload, crc & 255, crc >>> 8]) {
    if (b === 0x7e || b === 0x7d) out.push(0x7d, b ^ 0x20); else out.push(b);
  }
  return bytes(out, 0x7e);
}
export class FrameDecoder {
  constructor(onFrame, onError = () => {}) { this.onFrame = onFrame; this.onError = onError; this.buffer = []; this.started = false; this.escape = false; }
  push(chunk) {
    for (const b of chunk) {
      if (b === 0x7e) {
        if (this.started && this.buffer.length) {
          const d = bytes(this.buffer), payload = d.slice(0, -2);
          if (!this.escape && d.length >= 3 && crc16(payload) === (d[d.length - 2] | d[d.length - 1] << 8)) this.onFrame(payload);
          else this.onError('Discarded an invalid USB frame (CRC or framing error).');
        }
        this.started = true; this.buffer = []; this.escape = false;
      } else if (this.started) {
        if (this.escape) { this.buffer.push(b ^ 0x20); this.escape = false; }
        else if (b === 0x7d) this.escape = true;
        else this.buffer.push(b);
        if (this.buffer.length > 65536) { this.started = false; this.buffer = []; this.onError('USB frame exceeded size limit.'); }
      }
    }
  }
}
export const wake = () => bytes([0xb9,3,0,0x82,4,0,0x80,0x0b,1,0xb9,2,2,0x0b]);
export const hello = () => bytes([0xb9,3,0x81,3,0]);
export const requestState = () => bytes([0xb9,3,0,0x82,6,0,0x80,0x0b,3,0xb9,2,0x81,6,3,0x0b]);
export const requestPreset = id => {
  if (!Number.isInteger(id) || id < 0 || id > 19) throw Error('Preset must be between 1 and 20.');
  return bytes([0xb9,3,0x81,0,3,0x82,6,0,0x80,0x0b,3,0xb9,4,0x0b,1,id,0]);
};
export function floatBytes(value) { const d = new DataView(new ArrayBuffer(4)); d.setFloat32(0, value, true); return new Uint8Array(d.buffer); }
export function setParameter(index, value) {
  if (!Number.isInteger(index) || index < 0 || index > 108 || !Number.isFinite(value)) throw Error('Invalid parameter.');
  return bytes([0xb9,3,0x81,9,3,0x82,10,0,0x80,0x0b,3,0xb9,4,2,0,index,0x88], floatBytes(value));
}
export const messageType = p => p[0] === 0xb9 && p[1] === 3 && p[2] === 0x81 ? p[3] | p[4] << 8 : p[2] === 2 ? 0x0b2b : -1;
function findSequence(p, sequence) { return p.findIndex((_, i) => sequence.every((v,j) => p[i+j] === v)); }
function readFloat(p, offset) { if (offset + 4 > p.length) throw Error('Truncated float.'); return new DataView(p.buffer, p.byteOffset + offset, 4).getFloat32(0,true); }
export function parseParameter(p) {
  const i = findSequence(p,[0xb9,4,2,0]);
  if (messageType(p) !== 0x0309 || i < 0 || p[i+5] !== 0x88 || i+10 > p.length) return null;
  const value = readFloat(p,i+6); return Number.isFinite(value) ? {index:p[i+4],value} : null;
}
export function parsePreset(p) {
  if (messageType(p) !== 0x0304) throw Error('Expected preset details.');
  let name = null;
  for (let i=5;i<p.length-2;i++) {
    if (p[i] !== 0xbc || p[i+1] < 1 || p[i+1] > 64 || i+2+p[i+1] > p.length) continue;
    const raw = p.slice(i+2,i+2+p[i+1]), end = raw.indexOf(0), text = end < 0 ? raw : raw.slice(0,end);
    if (text.length && [...text].every(b => b >= 32 && b <= 126)) { name = new TextDecoder().decode(text).trim(); break; }
  }
  const parameters = [], start = findSequence(p,[0xba,3,0xba,0x6d]);
  if (start >= 0) for (let i=start+4; i+5<=p.length && p[i]===0x88 && parameters.length<109; i+=5) parameters.push(readFloat(p,i+1));
  return {name,parameters,raw:p};
}
// Parse the observed FX-era state layout, preserving every unrecognized byte.
// Reject unfamiliar layouts instead of applying guessed offsets to state writes.
export function parseState(p) {
  if (messageType(p) !== 0x0306 || p.length < 40 || p[5] !== 0x80) throw Error('Unsupported state header. Export diagnostics for this firmware.');
  const bodyStart = 8; let i = 22;
  const need = n => { if (i+n > p.length) throw Error('Truncated pedal state.'); };
  need(5); if (p[i] !== 0x88) throw Error('Unsupported state layout. Controls remain disabled.');
  const inputTrim = readFloat(p,++i); i+=4;
  need(5); const modeOffset=i, cabOffset=i+1, stomp=p[i++] === 1, cabBypass=p[i++] === 1; i++;
  if (p[i++] !== 0xba || p[i++] !== 20) throw Error('Unexpected preset color table.');
  const colors=[];
  for (let n=0;n<20;n++) {
    need(2); if (p[i++]!==0xb9 || p[i++]!==3) throw Error('Unexpected color entry.');
    const color=[];
    for (let c=0;c<3;c++) { need(1); const b=p[i++]; if (b===0x80) { need(1); color.push(p[i++]); } else color.push(b); }
    colors.push(color);
  }
  need(8); if (p[i++]!==0xbc || p[i++]!==6) throw Error('Unexpected slot assignments.');
  const slotOffsets=[i,i+2,i+4], slots=slotOffsets.map(o=>p[o]|p[o+1]<<8); i+=6;
  const bypassOffset=i++, activeOffset=i++, activeSlot=p[activeOffset];
  if (activeSlot>2 || slots.some(s=>s>19) || ![0,1].includes(p[modeOffset]) || ![0,1].includes(p[bypassOffset])) throw Error('Unsupported slot values.');
  need(10); if (p[i++]!==0x81) throw Error('Unexpected tuning reference.'); i+=2;
  const monitorOffset=i++; i++; if (p[i++]!==0x88) throw Error('Unsupported tempo layout.'); const tempo=readFloat(p,i); i+=4;
  if (i !== p.length || !Number.isFinite(tempo) || !Number.isFinite(inputTrim)) throw Error('Unknown state extension. Export diagnostics for this firmware.');
  return {raw:p.slice(),bodyStart,modeOffset,cabOffset,slotOffsets,bypassOffset,activeOffset,monitorOffset,slots,activeSlot,stomp,cabBypass,bypass:p[bypassOffset]===1,colors,tempo,inputTrim};
}
export function mutateState(state, {preset,slot,bypass,cabBypass}={}) {
  const raw=state.raw.slice();
  if (slot!==undefined) {
    if (![0,1,2].includes(slot)) throw Error('Invalid slot.');
    raw[state.activeOffset]=slot; raw[state.modeOffset]=slot===2?1:0;
  }
  if (preset!==undefined) {
    if (!Number.isInteger(preset)||preset<0||preset>19||slot===undefined) throw Error('Invalid preset assignment.');
    raw[state.slotOffsets[slot]]=preset; raw[state.slotOffsets[slot]+1]=0; raw[state.bypassOffset]=0;
  }
  if (bypass!==undefined) raw[state.bypassOffset]=bypass?1:0;
  if (cabBypass!==undefined) raw[state.cabOffset]=cabBypass?1:0;
  // Match reference controller: USB editing needs direct monitoring to keep audio audible.
  raw[state.monitorOffset]=1;
  const body=raw.slice(state.bodyStart);
  return bytes(raw.slice(0,5),[0x82,body.length&255,body.length>>8,0x80,0x0b,3],body);
}

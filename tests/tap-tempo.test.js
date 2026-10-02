import test from 'node:test';
import assert from 'node:assert/strict';
import { TapTempo } from '../src/tap-tempo.js';
test('tap tempo averages recent intervals and follows a changed beat', () => {
  const taps = new TapTempo();
  assert.equal(taps.tap(0), null);
  assert.equal(taps.tap(500), 120);
  assert.equal(taps.tap(1100), 109.1);
  for (const time of [1500, 1900, 2300, 2700, 3100]) taps.tap(time);
  assert.equal(taps.tap(3500), 150);
});
test('tap tempo ignores duplicate and accidental fast taps, and resets after a pause', () => {
  const taps = new TapTempo();
  taps.tap(0);
  assert.equal(taps.tap(100), null);
  assert.equal(taps.tap(0), null);
  assert.equal(taps.tap(500), 120);
  assert.equal(taps.tap(3000), null);
  assert.equal(taps.tap(3750), 80);
  taps.reset();
  assert.equal(taps.tap(4250), null);
  assert.equal(taps.tap(4750), 120);
});
test('tap tempo accepts the 40 and 240 BPM boundaries and rejects invalid times', () => {
  const taps = new TapTempo();
  assert.equal(taps.tap(NaN), null);
  taps.tap(0);
  assert.equal(taps.tap(1500), 40);
  taps.reset();
  taps.tap(0);
  assert.equal(taps.tap(250), 240);
});

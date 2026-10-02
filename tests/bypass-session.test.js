import test from 'node:test';
import assert from 'node:assert/strict';
import { BypassSession } from '../src/bypass-session.js';
const preset = { id: 7, name: 'Original preset', color: '#86a872' };
test('bypass freezes displayed preset and navigation slot without changing actual state', () => {
  const session = new BypassSession(),
    dual = { activeSlot: 1, bypass: false },
    stomp = { activeSlot: 2, bypass: true };
  session.observe(dual, stomp, preset);
  preset.name = 'Changed after capture';
  assert.equal(session.displayPreset(stomp, { id: 2 }).name, 'Original preset');
  assert.equal(session.navigationSlot(stomp), 1);
  assert.equal(stomp.activeSlot, 2);
  assert.equal(session.displayPreset(dual, { id: 8 }).id, 8);
  session.observe(stomp, dual, preset);
  assert.equal(session.preset, null);
});
test('pending pre-read does not discard the captured bypass context', () => {
  const session = new BypassSession();
  session.capture({ id: 4, name: 'Kept' }, 0);
  session.observe({ bypass: false }, { bypass: false }, null, true);
  session.reconcile({ bypass: false }, true);
  assert.equal(session.preset.id, 4);
  session.reconcile({ bypass: false });
  assert.equal(session.preset, null);
});
test('demo bypass and manual slot selection match native slot restoration', () => {
  for (const slot of [0, 1, 2]) {
    const session = new BypassSession(),
      state = {
        activeSlot: slot,
        slots: [3, 7, 9],
        stomp: slot === 2,
        bypass: false,
      };
    session.applyDemo(state, true);
    assert.equal(state.activeSlot, 2);
    assert.equal(state.bypass, true);
    session.applyDemo(state, false);
    assert.equal(state.activeSlot, slot);
    assert.deepEqual(state.slots, [3, 7, 9]);
  }
  const session = new BypassSession(),
    state = { activeSlot: 0, bypass: false };
  session.applyDemo(state, true);
  session.selectDemoSlot(state, 1);
  assert.equal(state.bypass, false);
  assert.equal(session.demoReturnSlot, null);
  session.clear();
  assert.equal(session.preset, null);
});

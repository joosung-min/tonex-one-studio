import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bytes,
  parseState,
  mutateState,
  setMasterVolume,
  requestMasterVolume,
  parseMasterVolume,
  setParameter,
  hex,
} from '../src/protocol.js';
import { stateFixture } from './fixtures.js';
import { ToneXUSB } from '../src/usb.js';
import { Device } from './mock-device.js';
globalThis.isSecureContext = true;
const changedState = (state, change) =>
  parseState(
    bytes(
      state.raw.slice(0, state.bodyStart),
      mutateState(state, change).slice(11),
    ),
  );
test('global fields decode the real state fixture', () => {
  const s = parseState(stateFixture);
  assert.equal(s.inputTrim, 4);
  assert.equal(s.tuningReference, 440);
  assert.equal(s.directMonitoring, true);
  assert.equal(s.bypass, false);
});
test('global field writes preserve every unrelated state byte', () => {
  const s = changedState(parseState(stateFixture), { slot: 2 }),
    original = s.raw.slice();
  for (const [key, value, offset, size] of [
    ['inputTrim', -8.5, s.inputTrimOffset, 4],
    ['tuningReference', 432, s.tuningOffset, 2],
    ['directMonitoring', false, s.monitorOffset, 1],
    ['bypass', true, s.bypassOffset, 1],
  ]) {
    const result = changedState(s, { [key]: value });
    assert.equal(result[key], value);
    for (let i = 0; i < s.raw.length; i++)
      if (i < offset || i >= offset + size)
        assert.equal(result.raw[i], s.raw[i], `${key} changed byte ${i}`);
  }
  assert.deepEqual(s.raw, original);
});
test('preset, slot, and tempo changes preserve monitoring Off and bypass On', () => {
  const s = changedState(parseState(stateFixture), {
    slot: 2,
    directMonitoring: false,
    bypass: true,
    inputTrim: -3.5,
    tuningReference: 442,
  });
  for (const change of [
    { preset: 7, slot: 2 },
    { slot: 2 },
    { tempo: 137.5 },
  ]) {
    const result = changedState(s, change);
    assert.equal(result.directMonitoring, false);
    assert.equal(result.bypass, true);
    assert.equal(result.inputTrim, -3.5);
    assert.equal(result.tuningReference, 442);
  }
});
test('global writes reject invalid values and respect boundaries', () => {
  const s = changedState(parseState(stateFixture), { slot: 2 }),
    original = s.raw.slice();
  for (const [key, values] of Object.entries({
    inputTrim: [NaN, Infinity, -15.1, 15.1],
    tuningReference: [414, 466, 440.5, NaN],
    directMonitoring: [0, 1, 'false'],
    bypass: ['On', 2],
  }))
    for (const value of values)
      assert.throws(() => mutateState(s, { [key]: value }));
  for (const value of [-15, 15])
    assert.equal(changedState(s, { inputTrim: value }).inputTrim, value);
  for (const value of [415, 465])
    assert.equal(
      changedState(s, { tuningReference: value }).tuningReference,
      value,
    );
});
test('master volume matches upstream global command and stays distinct from preset volume', () => {
  assert.equal(
    hex(requestMasterVolume()),
    'b9 03 81 0d 03 82 05 00 80 0b 03 b9 03 03 00 00',
  );
  assert.equal(
    hex(setMasterVolume(6.5)),
    'b9 03 81 09 03 82 0a 00 80 0b 03 b9 04 03 00 00 88 00 00 d0 40',
  );
  assert.equal(parseMasterVolume(setMasterVolume(6.5)), 6.5);
  assert.equal(parseMasterVolume(setParameter(21, 6.5)), null);
  assert.equal(parseMasterVolume(setMasterVolume(6.5).slice(0, -1)), null);
  for (const value of [-0.1, 10.1, NaN, Infinity])
    assert.throws(() => setMasterVolume(value));
});
test('USB global changes confirm all fields and master volume without altering preset volume', async () => {
  const d = new Device(),
    usb = new ToneXUSB();
  await usb.open(d);
  try {
    const before = d.values[21];
    assert.equal(await usb.getMasterVolume(), 6.5);
    assert.equal(await usb.changeMasterVolume(7.2), Math.fround(7.2));
    assert.equal(d.values[21], before);
    const s = await usb.changeState({
      slot: 2,
      inputTrim: -4.5,
      tuningReference: 432,
      directMonitoring: false,
      bypass: true,
    });
    assert.equal(s.inputTrim, -4.5);
    assert.equal(s.tuningReference, 432);
    assert.equal(s.directMonitoring, false);
    assert.equal(s.bypass, true);
    const next = await usb.changeState({ preset: 7, slot: 2, tempo: 128 });
    assert.equal(next.directMonitoring, false);
    assert.equal(next.bypass, true);
  } finally {
    await usb.close();
  }
});
test('USB refuses an unconfirmed global write and retains actual pedal values', async () => {
  const d = new Device(),
    usb = new ToneXUSB();
  await usb.open(d);
  const send = usb.send.bind(usb);
  usb.send = (p) => (p[3] === 6 && p[4] === 3 ? Promise.resolve() : send(p));
  try {
    await assert.rejects(usb.changeState({ inputTrim: 8 }), /did not confirm/);
    assert.equal(usb.state.inputTrim, 4);
  } finally {
    await usb.close();
  }
});
test('master volume read ignores preset parameter notifications', async () => {
  const d = new Device(),
    usb = new ToneXUSB();
  await usb.open(d);
  const send = usb.send.bind(usb);
  usb.send = (p) => {
    if (p[3] === 13) usb.receive(setParameter(21, 9));
    return send(p);
  };
  try {
    assert.equal(await usb.getMasterVolume(), 6.5);
  } finally {
    await usb.close();
  }
});
test('master volume mismatch restores the confirmed value', async () => {
  const d = new Device(),
    usb = new ToneXUSB();
  await usb.open(d);
  const send = usb.send.bind(usb);
  usb.send = (p) => (p[3] === 9 && p[13] === 3 ? Promise.resolve() : send(p));
  try {
    await assert.rejects(usb.changeMasterVolume(8), /did not confirm/);
    assert.equal(usb.masterVolume, 6.5);
  } finally {
    await usb.close();
  }
});
test('unsupported master volume times out without breaking other global controls', async () => {
  const d = new Device(),
    usb = new ToneXUSB();
  await usb.open(d);
  const send = usb.send.bind(usb);
  usb.send = (p) => (p[3] === 13 ? Promise.resolve() : send(p));
  const exchange = usb.exchange.bind(usb);
  usb.exchange = (p, type, timeout, matches) =>
    exchange(p, type, p[3] === 13 ? 20 : timeout, matches);
  try {
    await assert.rejects(usb.getMasterVolume(), /No response/);
    assert.equal(usb.connected, true);
    assert.equal((await usb.changeState({ inputTrim: 2.5 })).inputTrim, 2.5);
  } finally {
    await usb.close();
  }
});

test('bypass requires Stomp mode and never switches slots implicitly', () => {
  const dual = parseState(stateFixture);
  assert.throws(() => mutateState(dual, { bypass: true }), /Stomp mode/);
  assert.deepEqual(dual.raw, stateFixture);
  const stomp = changedState(dual, { slot: 2 });
  assert.equal(changedState(stomp, { bypass: true }).bypass, true);
  assert.throws(
    () => mutateState(stomp, { slot: 0, bypass: true }),
    /Stomp mode/,
  );
});
test('attempted bypass in Dual mode sends no state write', async () => {
  const d = new Device(),
    usb = new ToneXUSB();
  await usb.open(d);
  try {
    const before = d.writes.filter((p) => p[3] === 6 && p[4] === 3).length;
    await assert.rejects(usb.changeState({ bypass: true }), /Stomp mode/);
    assert.equal(
      d.writes.filter((p) => p[3] === 6 && p[4] === 3).length,
      before,
    );
    assert.equal(usb.state.activeSlot, 0);
  } finally {
    await usb.close();
  }
});

for (const slot of [0, 1])
  test(`native bypass returns to Slot ${'AB'[slot]} and preserves all preset assignments`, async () => {
    const d = new Device(),
      usb = new ToneXUSB();
    await usb.open(d);
    try {
      await usb.changeState({
        slot,
        inputTrim: -3.5,
        tuningReference: 442,
        directMonitoring: false,
      });
      const slots = usb.state.slots.slice();
      const on = await usb.changeBypass(true);
      assert.equal(on.activeSlot, 2);
      assert.equal(on.stomp, true);
      assert.equal(on.bypass, true);
      assert.equal(usb.bypassReturnSlot, slot);
      assert.deepEqual(on.slots, slots);
      const off = await usb.changeBypass(false);
      assert.equal(off.activeSlot, slot);
      assert.equal(off.stomp, false);
      assert.equal(off.bypass, false);
      assert.equal(usb.bypassReturnSlot, null);
      assert.deepEqual(off.slots, slots);
      assert.equal(off.inputTrim, -3.5);
      assert.equal(off.tuningReference, 442);
      assert.equal(off.directMonitoring, false);
    } finally {
      await usb.close();
    }
  });
test('native bypass started in C stays in C when switched Off', async () => {
  const d = new Device(),
    usb = new ToneXUSB();
  await usb.open(d);
  try {
    await usb.changeState({ slot: 2 });
    await usb.changeBypass(true);
    assert.equal(usb.bypassReturnSlot, null);
    assert.equal((await usb.changeBypass(false)).activeSlot, 2);
  } finally {
    await usb.close();
  }
});
test('failed entry into bypass restores original A/B slot', async () => {
  const d = new Device(),
    usb = new ToneXUSB();
  await usb.open(d);
  const send = usb.send.bind(usb);
  usb.send = (p) => {
    if (p[3] === 6 && p[4] === 3) {
      p = p.slice();
      const s = parseState(bytes(stateFixture.slice(0, 8), p.slice(11)));
      p[s.bypassOffset + 3] = 0;
    }
    return send(p);
  };
  try {
    await assert.rejects(usb.changeBypass(true), /did not confirm/);
    assert.equal(usb.state.activeSlot, 0);
    assert.equal(usb.state.bypass, false);
    assert.equal(usb.bypassReturnSlot, null);
  } finally {
    await usb.close();
  }
});
test('failed return retains destination for another Off attempt', async () => {
  const d = new Device(),
    usb = new ToneXUSB();
  await usb.open(d);
  const send = usb.send.bind(usb);
  try {
    await usb.changeState({ slot: 1 });
    await usb.changeBypass(true);
    usb.send = (p) => (p[3] === 6 && p[4] === 3 ? Promise.resolve() : send(p));
    await assert.rejects(usb.changeBypass(false), /did not confirm/);
    assert.equal(usb.bypassReturnSlot, 1);
    usb.send = send;
    assert.equal((await usb.changeBypass(false)).activeSlot, 1);
  } finally {
    await usb.close();
  }
});
test('manual slot change and disconnect clear the bypass return destination', async () => {
  const d = new Device(),
    usb = new ToneXUSB();
  await usb.open(d);
  try {
    await usb.changeBypass(true);
    await usb.changeState({ slot: 1 });
    assert.equal(usb.state.bypass, false);
    assert.equal(usb.bypassReturnSlot, null);
    await usb.changeBypass(true);
    await usb.close();
    assert.equal(usb.bypassReturnSlot, null);
  } finally {
    await usb.close();
  }
});

test('partial return failure restores bypass so Off can retry the original slot', async () => {
  const d = new Device(),
    usb = new ToneXUSB();
  await usb.open(d);
  const send = usb.send.bind(usb);
  try {
    await usb.changeState({ slot: 1 });
    await usb.changeBypass(true);
    usb.send = (p) => {
      if (p[3] === 6 && p[4] === 3) {
        const s = parseState(bytes(stateFixture.slice(0, 8), p.slice(11)));
        if (s.activeSlot === 1)
          p = mutateState(usb.state, { slot: 2, bypass: false });
      }
      return send(p);
    };
    await assert.rejects(usb.changeBypass(false), /did not confirm/);
    assert.equal(usb.state.activeSlot, 2);
    assert.equal(usb.state.bypass, true);
    assert.equal(usb.bypassReturnSlot, 1);
    usb.send = send;
    assert.equal((await usb.changeBypass(false)).activeSlot, 1);
  } finally {
    await usb.close();
  }
});

test('global cabinet bypass preserves per-preset cabinet values and survives slot changes', async () => {
  const d = new Device(),
    usb = new ToneXUSB();
  await usb.open(d);
  try {
    await usb.changeState({ cabBypass: false });
    const values = d.values.slice(),
      original = usb.state.raw.slice(),
      offset = usb.state.cabOffset;
    const on = await usb.changeState({ cabBypass: true });
    assert.equal(on.cabBypass, true);
    assert.equal(on.activeSlot, 0);
    for (let i = 0; i < original.length; i++)
      if (i !== offset)
        assert.equal(
          on.raw[i],
          original[i],
          `Cabinet bypass changed byte ${i}`,
        );
    assert.equal(
      (await usb.changeState({ slot: 1, preset: 7 })).cabBypass,
      true,
    );
    assert.deepEqual(d.values, values);
    const off = await usb.changeState({ cabBypass: false });
    assert.equal(off.cabBypass, false);
    assert.equal(off.activeSlot, 1);
    assert.deepEqual(d.values, values);
    for (const value of ['On', 1, null])
      assert.throws(
        () => mutateState(off, { cabBypass: value }),
        /Cabinet bypass/,
      );
  } finally {
    await usb.close();
  }
});
test('global cabinet bypass rejects an unconfirmed write and retains the actual value', async () => {
  const d = new Device(),
    usb = new ToneXUSB();
  await usb.open(d);
  const send = usb.send.bind(usb);
  usb.send = (p) => (p[3] === 6 && p[4] === 3 ? Promise.resolve() : send(p));
  try {
    const before = usb.state.cabBypass;
    await assert.rejects(
      usb.changeState({ cabBypass: !before }),
      /did not confirm/,
    );
    assert.equal(usb.state.cabBypass, before);
  } finally {
    await usb.close();
  }
});

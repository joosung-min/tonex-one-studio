import test from 'node:test';
import assert from 'node:assert/strict';
import { ToneXUSB } from '../src/usb.js';
import { bytes } from '../src/protocol.js';
globalThis.isSecureContext = true;
import { Device } from './mock-device.js';
test('USB session sets up CDC, handshakes, reads presets and confirms a state change', async () => {
  const device = new Device(),
    usb = new ToneXUSB();
  let initialDisconnects = 0;
  usb.addEventListener('connection', (e) => {
    if (!e.detail.connected) initialDisconnects++;
  });
  await usb.open(device);
  assert.equal(initialDisconnects, 0);
  assert.equal(usb.connected, true);
  assert.equal(usb.firmware, '1.2.3');
  assert.equal(device.controlWrites[0].setup.request, 0x20);
  assert.deepEqual([...device.controlWrites[0].data], [0, 0xc2, 1, 0, 0, 0, 8]);
  assert.equal(device.controlWrites[1].setup.value, 3);
  const detail = await usb.getPreset(3);
  assert.equal(detail.name, 'Mock Clean');
  assert.equal(detail.parameters.length, 109);
  const state = await usb.changeState({ preset: 7, slot: 2 });
  assert.equal(state.activeSlot, 2);
  assert.equal(state.slots[2], 7);
  assert.equal(state.stomp, true);
  await usb.writeParameter(20, 7.5);
  assert.equal((await usb.getPreset(7)).parameters[20], 7.5);
  await usb.close();
  assert.equal(usb.connected, false);
  assert.equal(device.opened, false);
  assert.equal(initialDisconnects, 1);
});
test('request queue serializes operations and recovers after rejection', async () => {
  const usb = new ToneXUSB(),
    events = [];
  const a = usb.enqueue(async () => {
    events.push(1);
    await new Promise((r) => setTimeout(r, 5));
    events.push(2);
    throw Error('test failure');
  });
  const b = usb.enqueue(async () => events.push(3));
  await assert.rejects(a);
  await b;
  assert.deepEqual(events, [1, 2, 3]);
});
test('pending request is rejected and cleared on timeout', async () => {
  const usb = new ToneXUSB();
  usb.send = async () => {};
  await assert.rejects(usb.exchange(bytes(1), 0x0306, 10), /No response/);
  assert.equal(usb.pending, null);
});
test('closing rejects pending exchange and disables later parameter writes', async () => {
  const usb = new ToneXUSB();
  usb.send = async () => {};
  const pending = usb.exchange(bytes(1), 0x0306);
  await usb.close('Test disconnect');
  await assert.rejects(pending, /Test disconnect/);
  await assert.rejects(usb.writeParameter(20, 2), /not ready/);
});

test('tempo writes are read back and unconfirmed values are rejected', async () => {
  const device = new Device(),
    usb = new ToneXUSB();
  await usb.open(device);
  const initial = await usb.getState();
  const state = await usb.changeState({ tempo: 137.5 });
  assert.equal(state.tempo, 137.5);
  assert.deepEqual(state.slots, initial.slots);
  const send = usb.send.bind(usb);
  usb.send = (payload) =>
    payload[3] === 6 && payload[4] === 3 ? Promise.resolve() : send(payload);
  await assert.rejects(usb.changeState({ tempo: 160 }), /did not confirm/);
  assert.equal(usb.state.tempo, 137.5);
  await usb.close();
});

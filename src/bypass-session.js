// The UI retains the original preset while the transport temporarily uses C.
// Hardware slot restoration remains owned by the connection, which confirms it.
export class BypassSession {
  constructor() {
    this.clear();
  }
  clear() {
    this.preset = null;
    this.demoReturnSlot = null;
  }
  capture(preset, slot) {
    this.preset = preset
      ? { id: preset.id, name: preset.name, color: preset.color, slot }
      : null;
  }
  observe(previous, next, preset, pending = false) {
    if (next?.bypass && !previous?.bypass && !this.preset)
      this.capture(preset, previous?.activeSlot);
    if (!next?.bypass && !pending) this.preset = null;
  }
  reconcile(state, pending = false) {
    if (!state?.bypass && !pending) this.preset = null;
  }
  displayPreset(state, fallback) {
    return state?.bypass && this.preset ? this.preset : fallback;
  }
  navigationSlot(state) {
    return state?.bypass && this.preset ? this.preset.slot : state?.activeSlot;
  }
  applyDemo(state, enabled) {
    const origin = state.activeSlot;
    if (enabled) {
      this.demoReturnSlot = origin !== 2 ? origin : this.demoReturnSlot;
      state.activeSlot = 2;
      state.stomp = true;
    } else {
      state.activeSlot = this.demoReturnSlot ?? origin;
      state.stomp = state.activeSlot === 2;
      this.demoReturnSlot = null;
    }
    state.bypass = enabled;
  }
  selectDemoSlot(state, slot) {
    state.activeSlot = slot;
    state.stomp = slot === 2;
    if (slot !== 2) {
      state.bypass = false;
      this.demoReturnSlot = null;
    }
  }
}

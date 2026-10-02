// Remember each preset's enabled cabinet mode independently (0: model, 1: VIR).
export class CabinetModes {
  constructor() {
    this.modes = new Map();
  }
  remember(id, mode) {
    if (id !== null && id !== undefined && (mode === 0 || mode === 1))
      this.modes.set(id, mode);
  }
  toggled(id, mode) {
    this.remember(id, mode);
    return mode === 2 ? (this.modes.get(id) ?? 0) : 2;
  }
  clear() {
    this.modes.clear();
  }
}

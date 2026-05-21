export class Keyboard {
  constructor(preventCodes = []) {
    this._held = new Set();
    this._pressed = new Set();
    this._prevent = new Set(preventCodes);

    window.addEventListener('keydown', e => {
      if (this._prevent.has(e.code)) e.preventDefault();
      if (!this._held.has(e.code)) this._pressed.add(e.code);
      this._held.add(e.code);
    });

    window.addEventListener('keyup', e => {
      this._held.delete(e.code);
    });
  }

  setPrevent(codes) {
    this._prevent = new Set(codes);
  }

  isHeld(code) {
    return this._held.has(code);
  }

  // Returns true once per physical keypress, then resets until the key is released and pressed again.
  consume(code) {
    if (this._pressed.has(code)) {
      this._pressed.delete(code);
      return true;
    }
    return false;
  }

  // Discard buffered presses for the given key codes only (held state untouched).
  discardPresses(codes) {
    for (const code of codes) this._pressed.delete(code);
  }

  // Discard all buffered presses and held keys (call on pause/resume/restart).
  flush() {
    this._pressed.clear();
    this._held.clear();
  }
}

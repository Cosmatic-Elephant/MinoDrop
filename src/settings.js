export class GameSettings {
  static DEFAULTS = Object.freeze({
    COLS:               10, // game field width  (4–100); values outside this range are reset to 10
    ROWS:               20, // game field height (10–100); values outside this range are reset to 20
    SEED:                '', // RNG seed value (used when USE_RANDOM_SEED is false)
    USE_RANDOM_SEED:  true, // if true, a random seed is generated each game; if false, SEED is used
    GHOST_WHITE:   false,     // if true, ghost piece is rendered in white
    GHOST_STYLE:   'outline', // 'outline' | 'translucent' | 'opaque' | 'none'
    START_LEVEL:          1, // starting level (1–15)
    LEVEL_LOCK:       false, // if true, level does not increase during play
    SOFT_DROP:           50, // ms per step while soft-drop held (internal, not user-editable)
    FAST_SOFT_DROP:   false, // if true, soft drop is instant (like level 15 gravity)
    DAS_DELAY:          170, // ms before auto-repeat starts
    DAS_RATE:            50, // ms between auto-repeat steps
    DAS_CUT_DELAY:     true, // if true, newly spawned piece waits full DAS before auto-repeat; if false, ARR applies immediately
    CLEAR_DELAY:        500, // ms line-clear animation lasts
    LOCK_DELAY:        1000, // ms before a grounded piece locks
    INFINITY_LIMIT:      15, // max lock-delay resets per piece
    UNLIMITED_INFINITY: false, // if true, infinity rule resets are unlimited
    B2B_HIGHLIGHT:    true, // if true, render blinking border while B2B chain is active
    ALL_SPIN_B2B:    false, // if true, any spin line-clear qualifies for B2B (not just T-Spin)
    NEXT_COUNT:          5, // number of next pieces shown in the preview panel (0–5)
    HOLD_ENABLED:     true, // if false, hold is blocked and the hold UI shows "BLOCKED"
  });

  static DEFAULT_KEYBINDS = Object.freeze({
    MOVE_LEFT:  'ArrowLeft',
    MOVE_RIGHT: 'ArrowRight',
    SOFT_DROP:  'ArrowDown',
    ROTATE_CW:  'ArrowUp',
    ROTATE_CCW: 'ControlLeft',
    ROTATE_180: 'KeyA',
    HARD_DROP:  'Space',
    HOLD:       'ShiftLeft',
  });

  constructor() {
    this.reset();
  }

  reset() {
    Object.assign(this, GameSettings.DEFAULTS);
    // shallow-clone so each instance owns its own keybinds object
    this.KEYBINDS = { ...GameSettings.DEFAULT_KEYBINDS };
  }
}

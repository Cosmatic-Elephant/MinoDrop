import { Board } from './src/game/board.js';
import { Piece } from './src/game/piece.js';
import { GAME_FIELD, setGameField } from './src/game/config.js';
import { Renderer } from './src/render/renderer.js';
import { Keyboard } from './src/input/keyboard.js';
import { GameSettings } from './src/settings.js';
import { makeRng } from './src/rng.js';
import { getActivePack, getPacks, getActiveIndex, setActivePack } from './src/data/packStore.js';
import { refreshPack } from './src/data/pieces.js';

let settings = GameSettings.load();

const canvas      = document.getElementById('game');
const holdCanvas  = document.getElementById('hold');
const nextCanvas  = document.getElementById('next');
const overlay     = document.getElementById('overlay');
const overlayMain = document.getElementById('overlay-main');
const overlaySub  = document.getElementById('overlay-sub');
const scoreEl          = document.getElementById('score-display');
const spinEl           = document.getElementById('spin-text');
const linesEl          = document.getElementById('lines-text');
const b2bEl            = document.getElementById('b2b-text');
const comboEl          = document.getElementById('combo-text');
const settingsOverlay  = document.getElementById('settings-overlay');
const keybindOverlay   = document.getElementById('keybind-overlay');
const keybindBody      = document.getElementById('keybind-body');
const seedDisplayEl    = document.getElementById('seed-display');
const overlaySeedEl    = document.getElementById('overlay-seed');
const activePackInfoEl = document.getElementById('active-pack-info');
const activeKickInfoEl = document.getElementById('active-kick-info');
const packSelect       = document.getElementById('pack-select');
const kickSelect       = document.getElementById('kick-select');
const levelEl            = document.getElementById('level-text');
const inputCols          = document.getElementById('input-cols');
const inputRows          = document.getElementById('input-rows');
const inputSeed          = document.getElementById('input-seed');
const inputStartLevel    = document.getElementById('input-start-level');
const inputDasDelay      = document.getElementById('input-das-delay');
const inputDasRate       = document.getElementById('input-das-rate');
const inputClearDelay    = document.getElementById('input-clear-delay');
const inputLockDelay     = document.getElementById('input-lock-delay');
const inputInfinityLimit = document.getElementById('input-infinity-limit');
const board       = new Board();
const renderer    = new Renderer(canvas);
const kb          = new Keyboard(Object.values(settings.KEYBINDS));

const INPUT_RULES = [
  { el: inputCols,          min:  4, max:  100 },
  { el: inputRows,          min: 10, max:  100 },
  { el: inputStartLevel,    min:  1, max:   15 },
  { el: inputDasDelay,      min:  0, max:  500 },
  { el: inputDasRate,       min:  0, max:  500 },
  { el: inputClearDelay,    min:  0, max: 1000 },
  { el: inputLockDelay,     min:  0, max: 2000 },
  { el: inputInfinityLimit, min:  0, max:   50 },
];

function validateInput({ el, min, max }) {
  const v = Number(el.value);
  const ok = Number.isFinite(v) && v >= min && v <= max;
  el.classList.toggle('invalid', !ok);
  return ok;
}

function updatePackInfo() {
  const pack = getActivePack();
  activePackInfoEl.textContent = `미노 팩 - ${pack.name}`;
  activeKickInfoEl.textContent = `킥테이블 - ${kickSelect?.value ?? 'SRS'}`;
  const packSize = pack.minos?.length
    ? Math.max(...pack.minos.map(m => m.shape.length))
    : (pack.size ?? 0);
  const minoCount = pack.minos?.length ?? pack.minoCount ?? 0;
  const tooWide = packSize > settings.COLS;
  const btnStart = document.getElementById('btn-start');
  if (btnStart) {
    if (minoCount === 0) {
      btnStart.disabled = true;
      btnStart.dataset.disabledReason = 'noMinos';
    } else if (tooWide) {
      btnStart.disabled = true;
      btnStart.dataset.disabledReason = 'tooWide';
    } else {
      btnStart.disabled = false;
      delete btnStart.dataset.disabledReason;
    }
  }
}

function showOverlay(main, sub = '', mode = '') {
  overlayMain.textContent = main;
  overlaySub.textContent  = sub;
  overlay.classList.add('visible');
  overlay.classList.remove('start-mode', 'pause-mode', 'gameover-mode');
  if (mode) overlay.classList.add(mode + '-mode');
}
function hideOverlay() {
  overlay.classList.remove('visible', 'start-mode', 'pause-mode', 'gameover-mode');
}

let settingsOpen    = false;
let keybindOpen     = false;
let listeningAction = null;

function openSettings() {
  settingsOpen = true;

  packSelect.innerHTML = '';
  const packs = getPacks();
  if (packs.length === 0) {
    const opt = document.createElement('option');
    opt.value = '-1';
    opt.textContent = '없음';
    packSelect.appendChild(opt);
  } else {
    packs.forEach((pack, i) => {
      const opt = document.createElement('option');
      opt.value = String(i);
      opt.textContent = pack.name;
      packSelect.appendChild(opt);
    });
    packSelect.value = String(getActiveIndex());
  }

  inputCols.value = settings.COLS;
  inputRows.value = settings.ROWS;
  inputSeed.value = settings.SEED;
  toggleRandomSeed.classList.toggle('on', settings.USE_RANDOM_SEED);
  toggleRandomSeed.textContent = settings.USE_RANDOM_SEED ? 'ON' : 'OFF';
  inputSeed.disabled = settings.USE_RANDOM_SEED;
  toggleGhost.classList.toggle('on', settings.GHOST_WHITE);
  toggleGhost.textContent = settings.GHOST_WHITE ? 'ON' : 'OFF';
  renderer.ghostWhite = settings.GHOST_WHITE;
  ghostStyleSelect.value   = settings.GHOST_STYLE;
  nextCountSelect.value    = String(settings.NEXT_COUNT);
  toggleHoldEnabled.classList.toggle('on', settings.HOLD_ENABLED);
  toggleHoldEnabled.textContent = settings.HOLD_ENABLED ? 'ON' : 'OFF';
  inputStartLevel.value    = settings.START_LEVEL;
  toggleLevelLock.classList.toggle('on', settings.LEVEL_LOCK);
  toggleLevelLock.textContent = settings.LEVEL_LOCK ? 'ON' : 'OFF';
  toggleFastSoftDrop.classList.toggle('on', settings.FAST_SOFT_DROP);
  toggleFastSoftDrop.textContent = settings.FAST_SOFT_DROP ? 'ON' : 'OFF';
  inputDasDelay.value      = settings.DAS_DELAY;
  inputDasRate.value       = settings.DAS_RATE;
  toggleDasCutDelay.classList.toggle('on', settings.DAS_CUT_DELAY);
  toggleDasCutDelay.textContent = settings.DAS_CUT_DELAY ? 'ON' : 'OFF';
  inputClearDelay.value    = settings.CLEAR_DELAY;
  inputLockDelay.value     = settings.LOCK_DELAY;
  inputInfinityLimit.value = settings.INFINITY_LIMIT;
  toggleUnlimitedInfinity.classList.toggle('on', settings.UNLIMITED_INFINITY);
  toggleUnlimitedInfinity.textContent = settings.UNLIMITED_INFINITY ? 'ON' : 'OFF';
  inputInfinityLimit.disabled = settings.UNLIMITED_INFINITY;
  toggleB2bHighlight.classList.toggle('on', settings.B2B_HIGHLIGHT);
  toggleB2bHighlight.textContent = settings.B2B_HIGHLIGHT ? 'ON' : 'OFF';
  toggleAllSpinB2b.classList.toggle('on', settings.ALL_SPIN_B2B);
  toggleAllSpinB2b.textContent = settings.ALL_SPIN_B2B ? 'ON' : 'OFF';
  for (const rule of INPUT_RULES) rule.el.classList.remove('invalid');
  settingsOverlay.classList.add('visible');
}

function closeSettings() { settingsOpen = false; settingsOverlay.classList.remove('visible'); }

// ── Key binding UI ──────────────────────────────────────────────────────────

const BLOCKED_CODES = new Set([
  'Escape','Tab','CapsLock','MetaLeft','MetaRight',
  'ContextMenu','PrintScreen','ScrollLock','Pause',
  'F1','F2','F3','F4','F5','F6','F7','F8','F9','F10','F11','F12',
]);

const KEYBIND_ROWS = [
  ['MOVE_LEFT',  '왼쪽으로 이동'],
  ['MOVE_RIGHT', '오른쪽으로 이동'],
  ['SOFT_DROP',  '소프트 드롭'],
  ['ROTATE_CW',  '시계방향 회전'],
  ['ROTATE_CCW', '반시계방향 회전'],
  ['ROTATE_180', '180도 회전'],
  ['HARD_DROP',  '하드 드롭'],
  ['HOLD',       '홀드'],
];

function codeToLabel(code) {
  if (!code) return '---';
  const MAP = {
    ArrowLeft:'← Left', ArrowRight:'→ Right', ArrowUp:'↑ Up', ArrowDown:'↓ Down',
    Space:'Space', Enter:'Enter', Backspace:'Backspace', Delete:'Delete',
    Insert:'Insert', Home:'Home', End:'End', PageUp:'PgUp', PageDown:'PgDn',
    ShiftLeft:'L-Shift', ShiftRight:'R-Shift',
    ControlLeft:'L-Ctrl', ControlRight:'R-Ctrl',
    NumpadAdd:'Num+', NumpadSubtract:'Num-', NumpadMultiply:'Num*',
    NumpadDivide:'Num/', NumpadEnter:'NumEnter', NumpadDecimal:'Num.',
    BracketLeft:'[', BracketRight:']', Backslash:'\\',
    Semicolon:';', Quote:"'", Comma:',', Period:'.', Slash:'/',
    Minus:'-', Equal:'=', Backquote:'`',
  };
  if (MAP[code]) return MAP[code];
  if (code.startsWith('Key'))    return code.slice(3);
  if (code.startsWith('Digit'))  return code.slice(5);
  if (code.startsWith('Numpad')) return 'Num' + code.slice(6);
  return code;
}

function getKeybindBtn(action) {
  return keybindBody.querySelector(`[data-action="${action}"]`);
}

function buildKeybindRows() {
  keybindBody.innerHTML = '';
  for (const [action, label] of KEYBIND_ROWS) {
    const row  = document.createElement('div');
    row.className = 'settings-row';
    const span = document.createElement('span');
    span.className   = 'settings-label';
    span.textContent = label;
    const btn  = document.createElement('button');
    btn.className    = 'keybind-btn';
    btn.dataset.action = action;
    const code = settings.KEYBINDS[action];
    btn.textContent  = codeToLabel(code);
    if (!code) btn.classList.add('unbound');
    btn.addEventListener('click', () => startListening(action));
    row.appendChild(span);
    row.appendChild(btn);
    keybindBody.appendChild(row);
  }
}

function startListening(action) {
  stopListening(); // restore previous button's text before switching
  listeningAction = action;
  const btn = getKeybindBtn(action);
  btn.classList.remove('unbound');
  btn.classList.add('listening');
  btn.textContent = '키를 누르세요...';
}

function stopListening() {
  if (listeningAction === null) return;
  const btn = getKeybindBtn(listeningAction);
  if (btn) {
    btn.classList.remove('listening', 'unbound');
    const code = settings.KEYBINDS[listeningAction];
    btn.textContent = codeToLabel(code);
    if (!code) btn.classList.add('unbound');
  }
  listeningAction = null;
}

function assignKeybind(action, code) {
  // If another action holds this code, clear it
  for (const [act, c] of Object.entries(settings.KEYBINDS)) {
    if (c === code && act !== action) {
      settings.KEYBINDS[act] = '';
      const other = getKeybindBtn(act);
      if (other) { other.textContent = '---'; other.classList.add('unbound'); }
    }
  }
  settings.KEYBINDS[action] = code;
  kb.setPrevent(Object.values(settings.KEYBINDS).filter(Boolean));
}

function openKeybinds() {
  keybindOpen = true;
  buildKeybindRows();
  keybindOverlay.classList.add('visible');
}

function closeKeybinds() {
  keybindOpen = false;
  stopListening();
  keybindOverlay.classList.remove('visible');
  settings.save();
}

// Capture-phase listener: intercepts all keys while keybind overlay is open
window.addEventListener('keydown', e => {
  if (!keybindOpen) return;
  e.preventDefault();
  e.stopPropagation();

  if (listeningAction === null) {
    if (e.code === 'Escape') closeKeybinds();
    return;
  }

  // Reject Alt/Meta combos and blocked codes silently (except Escape cancels listening)
  if (e.altKey || e.metaKey) return;
  if (BLOCKED_CODES.has(e.code)) {
    if (e.code === 'Escape') stopListening();
    return;
  }

  assignKeybind(listeningAction, e.code);
  stopListening();
}, { capture: true });

function applySettings() {
  let firstInvalid = null;
  for (const rule of INPUT_RULES) {
    if (!validateInput(rule) && firstInvalid === null) firstInvalid = rule.el;
  }
  if (firstInvalid !== null) {
    firstInvalid.scrollIntoView({ block: 'nearest' });
    firstInvalid.focus();
    return;
  }

  const next = new GameSettings();
  next.COLS                = Number(inputCols.value);
  next.ROWS                = Number(inputRows.value);
  next.SEED                = inputSeed.value.trim() || String(GameSettings.DEFAULTS.SEED);
  next.USE_RANDOM_SEED     = toggleRandomSeed.classList.contains('on');
  next.GHOST_WHITE         = toggleGhost.classList.contains('on');
  next.GHOST_STYLE         = ghostStyleSelect.value;
  next.NEXT_COUNT          = Number(nextCountSelect.value);
  next.HOLD_ENABLED        = toggleHoldEnabled.classList.contains('on');
  next.START_LEVEL         = Number(inputStartLevel.value);
  next.LEVEL_LOCK          = toggleLevelLock.classList.contains('on');
  next.FAST_SOFT_DROP      = toggleFastSoftDrop.classList.contains('on');
  next.DAS_DELAY           = Number(inputDasDelay.value);
  next.DAS_RATE            = Number(inputDasRate.value);
  next.DAS_CUT_DELAY       = toggleDasCutDelay.classList.contains('on');
  next.CLEAR_DELAY         = Number(inputClearDelay.value);
  next.LOCK_DELAY          = Number(inputLockDelay.value);
  next.INFINITY_LIMIT      = Number(inputInfinityLimit.value);
  next.UNLIMITED_INFINITY  = toggleUnlimitedInfinity.classList.contains('on');
  next.B2B_HIGHLIGHT       = toggleB2bHighlight.classList.contains('on');
  next.ALL_SPIN_B2B        = toggleAllSpinB2b.classList.contains('on');
  settings = next;
  settings.save();
  const packIdx = parseInt(packSelect.value, 10);
  if (packIdx >= 0) { setActivePack(packIdx); refreshPack(); }
  kb.setPrevent(Object.values(settings.KEYBINDS));
  renderer.ghostWhite = settings.GHOST_WHITE;
  renderer.ghostStyle = settings.GHOST_STYLE;
  closeSettings();
  updatePackInfo();
  if (!gameStarted) {
    setGameField(settings.COLS, settings.ROWS);
    renderer.resize();
  }
}

document.getElementById('settings-close').addEventListener('click', closeSettings);
document.getElementById('settings-cancel').addEventListener('click', () => {
  settings = new GameSettings();
  kb.setPrevent(Object.values(settings.KEYBINDS));
  renderer.ghostStyle = settings.GHOST_STYLE;
  openSettings();
});
document.getElementById('settings-apply').addEventListener('click', applySettings);
const toggleRandomSeed        = document.getElementById('toggle-random-seed');
const toggleGhost            = document.getElementById('toggle-ghost');
const ghostStyleSelect       = document.getElementById('ghost-style');
const nextCountSelect        = document.getElementById('next-count-select');
const toggleHoldEnabled      = document.getElementById('toggle-hold-enabled');
const toggleLevelLock        = document.getElementById('toggle-level-lock');
const toggleFastSoftDrop     = document.getElementById('toggle-fast-soft-drop');
const toggleDasCutDelay       = document.getElementById('toggle-das-cut-delay');
const toggleUnlimitedInfinity = document.getElementById('toggle-unlimited-infinity');
const toggleB2bHighlight      = document.getElementById('toggle-b2b-highlight');
const toggleAllSpinB2b        = document.getElementById('toggle-all-spin-b2b');
toggleRandomSeed.addEventListener('click', () => {
  toggleRandomSeed.classList.toggle('on');
  const isOn = toggleRandomSeed.classList.contains('on');
  toggleRandomSeed.textContent = isOn ? 'ON' : 'OFF';
  inputSeed.disabled = isOn;
  if (isOn) inputSeed.classList.remove('invalid');
});
toggleGhost.addEventListener('click', () => {
  toggleGhost.classList.toggle('on');
  const isOn = toggleGhost.classList.contains('on');
  toggleGhost.textContent = isOn ? 'ON' : 'OFF';
  renderer.ghostWhite = isOn;
});
toggleHoldEnabled.addEventListener('click', () => {
  toggleHoldEnabled.classList.toggle('on');
  toggleHoldEnabled.textContent = toggleHoldEnabled.classList.contains('on') ? 'ON' : 'OFF';
});
toggleLevelLock.addEventListener('click', () => {
  toggleLevelLock.classList.toggle('on');
  toggleLevelLock.textContent = toggleLevelLock.classList.contains('on') ? 'ON' : 'OFF';
});
toggleFastSoftDrop.addEventListener('click', () => {
  toggleFastSoftDrop.classList.toggle('on');
  toggleFastSoftDrop.textContent = toggleFastSoftDrop.classList.contains('on') ? 'ON' : 'OFF';
});
toggleDasCutDelay.addEventListener('click', () => {
  toggleDasCutDelay.classList.toggle('on');
  toggleDasCutDelay.textContent = toggleDasCutDelay.classList.contains('on') ? 'ON' : 'OFF';
});
toggleUnlimitedInfinity.addEventListener('click', () => {
  toggleUnlimitedInfinity.classList.toggle('on');
  const isOn = toggleUnlimitedInfinity.classList.contains('on');
  toggleUnlimitedInfinity.textContent = isOn ? 'ON' : 'OFF';
  inputInfinityLimit.disabled = isOn;
  if (isOn) inputInfinityLimit.classList.remove('invalid');
});
toggleB2bHighlight.addEventListener('click', () => {
  toggleB2bHighlight.classList.toggle('on');
  toggleB2bHighlight.textContent = toggleB2bHighlight.classList.contains('on') ? 'ON' : 'OFF';
});
toggleAllSpinB2b.addEventListener('click', () => {
  toggleAllSpinB2b.classList.toggle('on');
  toggleAllSpinB2b.textContent = toggleAllSpinB2b.classList.contains('on') ? 'ON' : 'OFF';
});
for (const rule of INPUT_RULES) {
  rule.el.addEventListener('blur', () => validateInput(rule));
}

function addScore(n) {
  if (score >= 1_000_000) return;
  score = Math.min(score + n, 9_999_999);
}

function formatScore(s) {
  return s >= 1_000_000 ? '9999999' : String(s).padStart(7, '0');
}

const GRAVITY_BY_LEVEL = [800, 700, 600, 500, 400, 300, 220, 150, 100, 70, 50, 35, 20, 15, 0];

let activeSeed = '';
let rng        = Math.random;

let level             = settings.START_LEVEL;
let totalLinesCleared = 0;
let score      = 0;
let nextQueue  = [];   // populated on game start
let piece      = null; // populated on game start
let holdPiece  = null;  // Piece instance stored in hold slot (spawn orientation)
let canHold    = true;  // false after using hold; resets on next natural spawn
let gravAccum      = 0;
let lockTimer      = null; // null = falling freely; > 0 = lock delay countdown (ms)
let lockResetCount = 0;    // infinity rule: resets used by current piece
let lowestLockY    = -1;   // deepest row this piece has been grounded at (-1 = none)
let dasLeft    = 0;
let dasRight   = 0;
let gameOver   = false;
let lastTime   = null;
let focusPaused  = false; // auto-paused: window blur or hidden tab
let manualPaused = true;  // user-paused: ESC key (starts true for intro screen)
let gameStarted  = false; // false until player dismisses the intro screen

let state      = 'playing'; // 'playing' | 'clearing'
let clearTimer = 0;
let fullRows   = [];
let pcTimer    = 0; // perfect clear display countdown (ms)

let lastKickWasOffset    = false; // non-(0,0) kick used in last successful rotation (non-T spin)
let lastActionWasRotation = false; // T-spin: true if last player action was a rotation
let pendingSpinLabel  = '';    // spin label captured at lock time, displayed after clear anim
let actionTimer       = 0;    // ms remaining for spin/lines text display
let b2b               = false; // back-to-back state: active after Quad or T-Spin clear
let b2bCount          = 0;    // consecutive B2B count (shown as B2B×N, resets on chain break)
let combo             = 0;    // consecutive line-clear counter

function spawn() {
  piece = nextQueue.shift();
  if (nextQueue.length < Math.max(1, settings.NEXT_COUNT)) nextQueue.push(...Piece.bag(rng));
  canHold = true;
  lockTimer = null;
  gravAccum = 0;
  lockResetCount = 0;
  lowestLockY = -1;
  lastKickWasOffset = false;
  lastActionWasRotation = false;
  if (!board.isValid(piece)) gameOver = true;

  // Reset DAS accumulators for the new piece.
  // Fixes stale -Infinity from ARR=0 wall-snap, and applies DCD rule.
  const binds = settings.KEYBINDS;
  const dasReset = settings.DAS_CUT_DELAY ? -settings.DAS_DELAY : 0;
  dasLeft  = kb.isHeld(binds.MOVE_LEFT)  ? dasReset : 0;
  dasRight = kb.isHeld(binds.MOVE_RIGHT) ? dasReset : 0;
}

function tryMove(dx) {
  piece.x += dx;
  if (!board.isValid(piece)) {
    piece.x -= dx;
  } else {
    lastActionWasRotation = false;
  }
}

function tryRotate(clockwise) {
  const fromState  = piece.rotState;
  const savedShape = piece.shape.map(row => [...row]);
  const savedX     = piece.x;
  const savedY     = piece.y;

  if (clockwise) piece.rotate();
  else piece.rotateLeft();

  for (const [dx, dy] of piece.getKicks(fromState, piece.rotState)) {
    piece.x = savedX + dx;
    piece.y = savedY + dy;
    if (board.isValid(piece)) {
      lastKickWasOffset = (dx !== 0 || dy !== 0);
      lastActionWasRotation = true;
      return; // kick accepted
    }
  }

  // All kicks failed — restore
  piece.shape    = savedShape;
  piece.x        = savedX;
  piece.y        = savedY;
  piece.rotState = fromState;
}

function tryRotate180() {
  const fromState  = piece.rotState;
  const savedShape = piece.shape.map(row => [...row]);
  const savedX     = piece.x;
  const savedY     = piece.y;

  piece.rotate180();

  for (const [dx, dy] of piece.getKicks(fromState, piece.rotState)) {
    piece.x = savedX + dx;
    piece.y = savedY + dy;
    if (board.isValid(piece)) {
      lastKickWasOffset = (dx !== 0 || dy !== 0);
      lastActionWasRotation = true;
      return; // kick accepted
    }
  }

  // All kicks failed — restore
  piece.shape    = savedShape;
  piece.x        = savedX;
  piece.y        = savedY;
  piece.rotState = fromState;
}

function stepDown() {
  piece.y++;
  if (!board.isValid(piece)) {
    piece.y--;
    return false;
  }
  return true;
}

// Returns the spin label (e.g. "T-Spin", "Z-Spin") or '' if no spin.
// Must be called before board.lock() so the piece's own cells aren't in the grid yet.
function checkSpin() {
  if (piece.type === 'T') {
    if (!lastActionWasRotation) return '';
    const cx = piece.x + 1; // center of the 3×3 T bounding box
    const cy = piece.y + 1;
    let blocked = 0;
    for (const [ox, oy] of [[-1,-1],[1,-1],[-1,1],[1,1]]) {
      const x = cx + ox, y = cy + oy;
      if (x < 0 || x >= GAME_FIELD.COLS || y < 0 || y >= GAME_FIELD.ROWS || board.grid[y][x] !== null) blocked++;
    }
    return blocked >= 3 ? 'T-Spin' : '';
  }
  return lastKickWasOffset ? `${piece.type}-Spin` : '';
}

function lockAndClear() {
  const spinLabel = checkSpin(); // capture before board.lock() clears piece state
  board.lock(piece);
  piece = null;
  lockTimer = null;
  gravAccum = 0;
  lockResetCount = 0;
  lowestLockY = -1;
  fullRows = board.findFullLines();
  if (fullRows.length > 0) {
    pendingSpinLabel = spinLabel;
    if (settings.CLEAR_DELAY >= 125) {
      state = 'clearing';
      clearTimer = settings.CLEAR_DELAY;
    } else {
      finishLineClear();
    }
  } else {
    combo = 0;
    comboEl.textContent = '';
    spawn();
  }
}

// Returns true if the piece was immediately locked (infinity limit reached).
function startLockDelay() {
  if (lowestLockY === -1 || piece.y > lowestLockY) {
    lockResetCount = 0;
    lowestLockY = piece.y;
  }
  if (!settings.UNLIMITED_INFINITY && lockResetCount >= settings.INFINITY_LIMIT) {
    lockAndClear();
    return true;
  }
  lockResetCount++;
  lockTimer = settings.LOCK_DELAY;
  return false;
}

function hardDrop() {
  while (stepDown()) { addScore(2); }
  lockAndClear();
}

function doHold() {
  if (!canHold) return;

  if (holdPiece === null) {
    holdPiece = new Piece(piece.type);
    spawn(); // canHold set to true inside spawn — overridden below
  } else {
    const incoming = new Piece(holdPiece.type);
    holdPiece = new Piece(piece.type);
    piece = incoming;
    gravAccum = 0;
    lockTimer = null;
    lockResetCount = 0;
    lowestLockY = -1;
    lastKickWasOffset = false;
    lastActionWasRotation = false;
  }
  canHold = false; // lock hold until next natural piece spawn
}

function update(dt) {
  if (gameOver) return;
  if (pcTimer > 0) pcTimer = Math.max(0, pcTimer - dt);
  if (actionTimer > 0) {
    actionTimer -= dt;
    if (actionTimer <= 0) { actionTimer = 0; spinEl.textContent = ''; linesEl.textContent = ''; }
  }

  if (state === 'clearing') {
    kb.discardPresses(Object.values(settings.KEYBINDS));
    clearTimer -= dt;
    if (clearTimer <= 0) {
      finishLineClear();
    }
    return;
  }

  const binds = settings.KEYBINDS;

  // Hold
  if (kb.consume(binds.HOLD)) {
    if (settings.HOLD_ENABLED) doHold();
    if (gameOver) return;
  }

  // Rotation
  if (kb.consume(binds.ROTATE_CW))  tryRotate(true);
  if (kb.consume(binds.ROTATE_CCW)) tryRotate(false);
  if (kb.consume(binds.ROTATE_180)) tryRotate180();

  // Hard drop (bypasses lock delay)
  if (kb.consume(binds.HARD_DROP)) { hardDrop(); return; }

  // Horizontal movement with DAS
  // When both directions are held simultaneously, suppress movement but keep DAS accumulating.
  // A key pressed into conflict starts its DAS at 0 so it fires ARR immediately on resolve.
  const leftJust  = kb.consume(binds.MOVE_LEFT);
  const rightJust = kb.consume(binds.MOVE_RIGHT);
  const leftActive  = leftJust  || kb.isHeld(binds.MOVE_LEFT);
  const rightActive = rightJust || kb.isHeld(binds.MOVE_RIGHT);
  const conflict = leftActive && rightActive;

  if (!leftActive) {
    dasLeft = 0;
  } else if (conflict) {
    if (leftJust) dasLeft = 0; // pressed into conflict: ready for immediate ARR on resolve
    else dasLeft = Math.min(dasLeft + dt, 0); // DAS counts; ARR pauses at 0
  } else if (leftJust) {
    tryMove(-1);
    dasLeft = -settings.DAS_DELAY;
  } else {
    dasLeft += dt;
    if (dasLeft >= 0) {
      if (settings.DAS_RATE === 0) {
        let x; do { x = piece.x; tryMove(-1); } while (piece.x !== x);
        dasLeft = -Infinity;
      } else { tryMove(-1); dasLeft -= settings.DAS_RATE; }
    }
  }

  if (!rightActive) {
    dasRight = 0;
  } else if (conflict) {
    if (rightJust) dasRight = 0;
    else dasRight = Math.min(dasRight + dt, 0); // DAS counts; ARR pauses at 0
  } else if (rightJust) {
    tryMove(1);
    dasRight = -settings.DAS_DELAY;
  } else {
    dasRight += dt;
    if (dasRight >= 0) {
      if (settings.DAS_RATE === 0) {
        let x; do { x = piece.x; tryMove(1); } while (piece.x !== x);
        dasRight = -Infinity;
      } else { tryMove(1); dasRight -= settings.DAS_RATE; }
    }
  }

  // Soft drop first press: step once, enter lock delay if now grounded
  if (kb.consume(binds.SOFT_DROP)) {
    gravAccum = 0;
    if (stepDown()) {
      addScore(1);
      lastActionWasRotation = false;
    } else {
      if (startLockDelay()) return;
    }
  }

  // After all input: if in lock delay but piece can now fall, cancel it
  if (lockTimer !== null) {
    piece.y++;
    const free = board.isValid(piece);
    piece.y--;
    if (free) {
      lockTimer = null;
      gravAccum = 0;
    }
  }

  // Lock delay countdown
  if (lockTimer !== null) {
    lockTimer -= dt;
    if (lockTimer <= 0) { lockAndClear(); return; }
    return;
  }

  // Gravity (normal or continuous soft-drop while held)
  const gravInterval = GRAVITY_BY_LEVEL[level - 1];
  const softDropInterval = settings.FAST_SOFT_DROP ? 0 : settings.SOFT_DROP;
  const interval = kb.isHeld(binds.SOFT_DROP) ? softDropInterval : gravInterval;
  if (interval === 0) {
    // Level 15: instant drop to bottom
    while (stepDown()) {}
    startLockDelay();
    gravAccum = 0;
  } else {
    gravAccum += dt;
    while (gravAccum >= interval) {
      gravAccum -= interval;
      if (!stepDown()) {
        startLockDelay();
        gravAccum = 0;
        break;
      }
      addScore(1);
    }
  }
}

function finishLineClear() {
  const nLines = fullRows.length;
  board.removeLines(fullRows);
  fullRows = [];
  state = 'playing';
  totalLinesCleared += nLines;
  if (!settings.LEVEL_LOCK)
    level = Math.min(settings.START_LEVEL + Math.floor(totalLinesCleared / 10), 15);

  const LINE_NAMES = ['', 'SINGLE', 'DOUBLE', 'TRIPLE', 'QUAD', 'PENTA', 'HEXA', 'HEPTA', 'OCTA', 'NONA', 'DECA'];
  const lineName = LINE_NAMES[Math.min(nLines, 10)];
  const isTSpin = pendingSpinLabel === 'T-Spin';
  const hasSpin = pendingSpinLabel !== '';
  const isB2bQualifying = nLines === 4 || isTSpin || (settings.ALL_SPIN_B2B && hasSpin);
  const hadB2b = isB2bQualifying && b2b;
  b2b = isB2bQualifying;

  spinEl.textContent  = pendingSpinLabel ? pendingSpinLabel.toUpperCase() : '';
  linesEl.textContent = lineName;

  if (hadB2b) {
    b2bCount++;
    b2bEl.textContent = `B2B×${b2bCount}`;
  } else if (!isB2bQualifying) {
    b2bCount = 0;
    b2bEl.textContent = '';
  }

  actionTimer = 1000;
  pendingSpinLabel = '';

  combo++;
  if (combo > 1) comboEl.textContent = `${combo} Combo!`;

  const BASE_SCORES = [0, 100, 300, 600, 1000];
  const base      = BASE_SCORES[Math.min(nLines, 4)];
  const spinMult  = hasSpin ? 2 : 1;
  const b2bMult   = hadB2b ? 1.5 : 1;
  const comboBonus = combo * 50;
  const isPc = board.isEmpty();
  const pcBonus = isPc ? 2000 : 0;
  addScore(Math.round(base * spinMult * b2bMult) + comboBonus + pcBonus);
  if (isPc) pcTimer = 1000;
  spawn();
}

function resumeFocus() {
  focusPaused = false;
  if (!manualPaused) { kb.flush(); lastTime = null; }
}

function restartGame() {
  setGameField(settings.COLS, settings.ROWS);
  renderer.resize();

  if (settings.USE_RANDOM_SEED || !settings.SEED) {
    activeSeed = String(Math.floor(Math.random() * 9_000_000_000) + 1_000_000_000);
  } else {
    activeSeed = settings.SEED;
  }
  rng = makeRng(activeSeed);
  seedDisplayEl.textContent = `seed: ${activeSeed}`;

  board.reset();
  score        = 0;
  nextQueue    = [...Piece.bag(rng), ...Piece.bag(rng)];
  piece        = nextQueue.shift();
  holdPiece    = null;
  canHold      = true;
  gravAccum    = 0;
  lockTimer    = null;
  dasLeft      = 0;
  dasRight     = 0;
  gameOver       = false;
  state          = 'playing';
  clearTimer     = 0;
  fullRows       = [];
  lockResetCount    = 0;
  lowestLockY       = -1;
  pcTimer           = 0;
  lastKickWasOffset     = false;
  lastActionWasRotation = false;
  pendingSpinLabel      = '';
  actionTimer           = 0;
  b2b                   = false;
  b2bCount              = 0;
  combo                 = 0;
  level                 = settings.START_LEVEL;
  totalLinesCleared     = 0;
  spinEl.textContent    = '';
  linesEl.textContent   = '';
  b2bEl.textContent     = '';
  comboEl.textContent   = '';
  manualPaused   = false;
  lastTime       = null;
  kb.flush();
}

window.addEventListener('blur', () => { focusPaused = true; });
window.addEventListener('focus', () => { if (document.visibilityState === 'visible') resumeFocus(); });
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') focusPaused = true;
  else if (document.hasFocus()) resumeFocus();
});
window.addEventListener('keydown', e => {
  if (e.code !== 'Escape') return;
  if (settingsOpen) { closeSettings(); return; }
  if (gameOver) { restartGame(); return; }
  if (!gameStarted) {
    if (document.getElementById('btn-start')?.disabled) return;
    restartGame();
    gameStarted = true;
    return;
  }
  if (!manualPaused) {
    manualPaused = true;
    kb.flush();
  }
});

const startBtns    = Array.from(document.querySelectorAll('#start-buttons .pause-btn'));
const pauseBtns    = Array.from(document.querySelectorAll('#pause-buttons .pause-btn'));
const gameoverBtns = Array.from(document.querySelectorAll('#gameover-buttons .pause-btn'));
const allBtnGroups = { start: startBtns, pause: pauseBtns, gameover: gameoverBtns };
let currentBtnGroup = [];
let focusedBtnIndex = 0;
let currentMenuMode = '';

function setMenuMode(mode) {
  if (currentMenuMode === mode) return;
  currentMenuMode = mode;
  currentBtnGroup = allBtnGroups[mode] || [];
  focusedBtnIndex = 0;
  updateMenuFocus();
}

function updateMenuFocus() {
  [...startBtns, ...pauseBtns, ...gameoverBtns].forEach(btn => btn.classList.remove('focused'));
  if (currentBtnGroup[focusedBtnIndex]) currentBtnGroup[focusedBtnIndex].classList.add('focused');
}

function resumeFromPause() {
  manualPaused = false;
  lastTime = null;
  kb.flush();
}

function goToMain() {
  activeSeed = '';
  rng = Math.random;
  seedDisplayEl.textContent = '';

  board.reset();
  piece        = null;
  nextQueue    = [];
  holdPiece    = null;
  gameOver     = false;
  state        = 'playing';
  clearTimer   = 0;
  fullRows     = [];
  dasLeft      = 0;
  dasRight     = 0;
  b2b          = false;
  b2bCount     = 0;
  spinEl.textContent  = '';
  linesEl.textContent = '';
  b2bEl.textContent   = '';
  comboEl.textContent = '';
  gameStarted  = false;
  manualPaused = true;
  lastTime     = null;
  kb.flush();
}

startBtns[0].addEventListener('click', () => {
  if (!gameStarted && !startBtns[0].disabled) { restartGame(); gameStarted = true; }
});
startBtns[1].addEventListener('click', openSettings);
startBtns[2].addEventListener('click', openKeybinds);

pauseBtns[0].addEventListener('click', () => {
  if (manualPaused && gameStarted && !gameOver) resumeFromPause();
});
pauseBtns[1].addEventListener('click', () => {
  if (manualPaused && gameStarted && !gameOver) restartGame();
});
pauseBtns[2].addEventListener('click', () => {
  if (manualPaused && gameStarted && !gameOver) goToMain();
});
pauseBtns[3].addEventListener('click', () => {
  if (activeSeed) navigator.clipboard.writeText(activeSeed).then(() => alert('시드가 복사되었습니다.'));
});

gameoverBtns[0].addEventListener('click', () => {
  if (gameOver) restartGame();
});
gameoverBtns[1].addEventListener('click', () => {
  if (gameOver) goToMain();
});
gameoverBtns[2].addEventListener('click', () => {
  if (activeSeed) navigator.clipboard.writeText(activeSeed).then(() => alert('시드가 복사되었습니다.'));
});

document.getElementById('keybind-close').addEventListener('click', closeKeybinds);
document.getElementById('keybind-done').addEventListener('click', closeKeybinds);
document.getElementById('keybind-reset').addEventListener('click', () => {
  settings.KEYBINDS = { ...GameSettings.DEFAULT_KEYBINDS };
  kb.setPrevent(Object.values(settings.KEYBINDS));
  buildKeybindRows();
});

[...startBtns, ...pauseBtns, ...gameoverBtns].forEach(btn => {
  btn.addEventListener('mousemove', () => {
    const idx = currentBtnGroup.indexOf(btn);
    if (idx !== -1 && focusedBtnIndex !== idx) { focusedBtnIndex = idx; updateMenuFocus(); }
  });
});

window.addEventListener('keydown', e => {
  if (settingsOpen || keybindOpen || currentBtnGroup.length === 0) return;
  if (e.code === 'ArrowUp') {
    e.preventDefault();
    if (focusedBtnIndex > 0) { focusedBtnIndex--; updateMenuFocus(); }
  } else if (e.code === 'ArrowDown') {
    e.preventDefault();
    if (focusedBtnIndex < currentBtnGroup.length - 1) { focusedBtnIndex++; updateMenuFocus(); }
  } else if (e.code === 'Enter') {
    e.preventDefault();
    currentBtnGroup[focusedBtnIndex]?.click();
  }
});

function loop(ts) {
  if (lastTime === null) lastTime = ts;
  const dt = ts - lastTime;
  lastTime = ts;

  if (!focusPaused && !manualPaused) update(dt);

  const topOccupiedRow = !gameOver ? board.grid.findIndex(row => row.some(cell => cell !== null)) : -1;
  const spawnCells = [];
  if (topOccupiedRow !== -1 && topOccupiedRow <= Math.floor(GAME_FIELD.ROWS * 0.25) && nextQueue.length > 0) {
    const nextPiece = nextQueue[0];
    const spawnX = Math.floor((GAME_FIELD.COLS - nextPiece.shape[0].length) / 2);
    for (let r = 0; r < nextPiece.shape.length; r++) {
      for (let c = 0; c < nextPiece.shape[r].length; c++) {
        if (nextPiece.shape[r][c]) spawnCells.push([spawnX + c, r]);
      }
    }
  }
  renderer.render(board, piece, gameOver, fullRows, settings.CLEAR_DELAY - clearTimer, pcTimer, spawnCells);
  if (settings.B2B_HIGHLIGHT) renderer.renderB2bStatus(b2b, ts);
  renderer.renderHold(holdCanvas, holdPiece, canHold, settings.HOLD_ENABLED);
  renderer.renderNext(nextCanvas, nextQueue, settings.NEXT_COUNT);

  scoreEl.textContent = formatScore(score);
  levelEl.textContent = `${level} LEVEL`;

  if (gameOver) {
    const plainScore = score >= 1_000_000 ? '9999999' : String(score);
    showOverlay('GAME OVER', `Score: ${plainScore}`, 'gameover');
    setMenuMode('gameover');
  } else if (!gameStarted) {
    showOverlay('MIDROP', '', 'start');
    setMenuMode('start');
  } else if (manualPaused) {
    showOverlay('GAME PAUSED', '', 'pause');
    setMenuMode('pause');
  } else if (focusPaused) {
    showOverlay('OUT OF FOCUS');
    setMenuMode('');
  } else {
    hideOverlay();
    setMenuMode('');
  }

  overlaySeedEl.textContent =
    (gameOver || (manualPaused && gameStarted)) && activeSeed
      ? `seed: ${activeSeed}`
      : '';

  requestAnimationFrame(loop);
}

updatePackInfo();
requestAnimationFrame(loop);

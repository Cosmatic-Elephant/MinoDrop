import { getPacks, savePacks, encodePack } from './src/data/packStore.js';

/* ── 저장 ── */
let saving = false;
let pendingOverwrite = null;

function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('visible');
  setTimeout(() => toast.classList.remove('visible'), 1500);
}

function showOverwriteDialog() {
  document.getElementById('overwrite-overlay').classList.add('visible');
}

function hideOverwriteDialog() {
  document.getElementById('overwrite-overlay').classList.remove('visible');
  pendingOverwrite = null;
}

function collectSaveData() {
  const cellCount = gridState.flat().filter(v => v === 1).length;
  if (cellCount === 0) { showToast('캔버스가 비어있습니다.'); return null; }
  if (cellCount === 1)  { showToast('미노가 너무 작습니다.'); return null; }

  const rawName = document.getElementById('mino-name-input').value.trim();
  if (!rawName) { showToast('이름을 입력해주세요.'); return null; }

  const packs = getPacks();
  const code = sessionStorage.getItem('midrop_editing_pack');
  const pack = packs.find(p => p.code === code) ?? packs[0];
  if (!pack) return null;

  const minoName = rawName.replace(/[a-z]/g, c => c.toUpperCase());
  const newShape = cropMino(gridState);
  const newKey = canonicalKey(newShape);
  const [r, g, b] = hsvToRgb(hue, pickerX, 1 - pickerY);
  const color = rgbToHex(r, g, b);

  return { pack, packs, minoName, newShape, newKey, color };
}

function doSaveNew(pack, packs, minoName, newShape, newKey, color) {
  if (pack.minos.some(m => canonicalKey(m.shape) === newKey)) {
    showToast('같은 모양의 미노가 이미 있습니다.');
    return;
  }
  pack.minos.push({ name: minoName, color, shape: newShape });
  pack.minoCount = pack.minos.length;
  pack.size = Math.max(...pack.minos.map(m => m.shape.length));
  pack.code = encodePack(pack);
  sessionStorage.setItem('midrop_editing_pack', pack.code);
  savePacks(packs);
  saving = true;
  location.href = 'pack.html';
}

function doOverwrite(pack, packs, existingIdx, minoName, newShape, newKey, color) {
  const shapeConflict = pack.minos.some((m, i) => i !== existingIdx && canonicalKey(m.shape) === newKey);
  if (shapeConflict) {
    showToast('같은 모양의 미노가 이미 있습니다.');
    return;
  }
  pack.minos[existingIdx] = { name: minoName, color, shape: newShape };
  pack.minoCount = pack.minos.length;
  pack.size = Math.max(...pack.minos.map(m => m.shape.length));
  pack.code = encodePack(pack);
  sessionStorage.setItem('midrop_editing_pack', pack.code);
  savePacks(packs);
  saving = true;
  location.href = 'pack.html';
}

window.addEventListener('beforeunload', e => {
  if (saving) return;
  e.preventDefault();
  e.returnValue = '';
});

document.querySelector('.save-btn').addEventListener('click', () => {
  const data = collectSaveData();
  if (!data) return;
  const { pack, packs, minoName, newShape, newKey, color } = data;

  const existingIdx = pack.minos.findIndex(m => m.name === minoName);
  if (existingIdx !== -1) {
    pendingOverwrite = { pack, packs, existingIdx, minoName, newShape, newKey, color };
    showOverwriteDialog();
    return;
  }

  doSaveNew(pack, packs, minoName, newShape, newKey, color);
});

document.getElementById('btn-overwrite-cancel').addEventListener('click', hideOverwriteDialog);
document.getElementById('btn-overwrite-confirm').addEventListener('click', () => {
  if (!pendingOverwrite) return;
  const { pack, packs, existingIdx, minoName, newShape, newKey, color } = pendingOverwrite;
  hideOverwriteDialog();
  doOverwrite(pack, packs, existingIdx, minoName, newShape, newKey, color);
});
document.getElementById('overwrite-overlay').addEventListener('click', e => {
  if (e.target === e.currentTarget) hideOverwriteDialog();
});

/* ── 격자 ── */
const CELL = 30;
const gridCanvas = document.getElementById('grid-canvas');
const gridCtx = gridCanvas.getContext('2d');
const sel = document.getElementById('grid-size-select');

let gridN = 4;
let gridState = [];

const undoStack = [];
const redoStack = [];
let snapshotBefore = null;

function cloneState() {
  return gridState.map(row => [...row]);
}

function statesEqual(a, b) {
  return a.every((row, r) => row.every((val, c) => val === b[r][c]));
}

function normalizeCoords(coords) {
  const minR = Math.min(...coords.map(([r]) => r));
  const minC = Math.min(...coords.map(([, c]) => c));
  return coords.map(([r, c]) => [r - minR, c - minC]);
}

function rotate90CW(coords) {
  const H = Math.max(...coords.map(([r]) => r)) + 1;
  return coords.map(([r, c]) => [c, H - 1 - r]);
}

function canonicalKey(shape) {
  const coords = [];
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      if (shape[r][c]) coords.push([r, c]);

  let cur = normalizeCoords(coords);
  const keys = [];
  for (let i = 0; i < 4; i++) {
    keys.push(cur.map(([r, c]) => `${r},${c}`).sort().join('|'));
    cur = normalizeCoords(rotate90CW(cur));
  }
  return keys.sort()[0];
}

function cropMino(shape) {
  let minR = shape.length, maxR = -1;
  let minC = shape[0].length, maxC = -1;
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (shape[r][c]) {
        if (r < minR) minR = r;
        if (r > maxR) maxR = r;
        if (c < minC) minC = c;
        if (c > maxC) maxC = c;
      }
    }
  }
  if (maxR < 0) return [];

  const cropped = shape.slice(minR, maxR + 1).map(row => row.slice(minC, maxC + 1));
  const rows = cropped.length;
  const cols = cropped[0].length;
  if (rows === cols) return cropped;

  if (rows < cols) {
    const diff = cols - rows;
    const front = Math.floor(diff / 2);
    const back = diff - front;
    const emptyRow = () => new Array(cols).fill(0);
    return [
      ...Array.from({ length: front }, emptyRow),
      ...cropped,
      ...Array.from({ length: back }, emptyRow),
    ];
  } else {
    const diff = rows - cols;
    const front = Math.floor(diff / 2);
    const back = diff - front;
    return cropped.map(row => [
      ...new Array(front).fill(0),
      ...row,
      ...new Array(back).fill(0),
    ]);
  }
}

function initGrid(n) {
  gridN = n;
  gridState = Array.from({ length: n }, () => new Array(n).fill(0));
  undoStack.length = 0;
  redoStack.length = 0;
  updateHistoryUI();
}

function drawMino(px, py, color) {
  const x = px + 1, y = py + 1, s = CELL - 2;
  const hi = Math.max(3, Math.round(CELL * 0.13));
  const sh = Math.max(2, Math.round(CELL * 0.10));
  gridCtx.fillStyle = color;
  gridCtx.fillRect(x, y, s, s);
  gridCtx.fillStyle = 'rgba(255,255,255,0.18)';
  gridCtx.fillRect(x, y, s, hi);
  gridCtx.fillRect(x, y, hi, s);
  gridCtx.fillStyle = 'rgba(0,0,0,0.3)';
  gridCtx.fillRect(x, y + s - sh, s, sh);
  gridCtx.fillRect(x + s - sh, y, sh, s);
}

function drawGrid() {
  const n = gridN;
  gridCanvas.width  = n * CELL;
  gridCanvas.height = n * CELL;
  gridCtx.fillStyle = '#111';
  gridCtx.fillRect(0, 0, gridCanvas.width, gridCanvas.height);
  gridCtx.strokeStyle = '#1c1c1c';
  gridCtx.lineWidth = 1;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      gridCtx.strokeRect(c * CELL, r * CELL, CELL, CELL);
    }
  }
  const color = getCurrentColor();
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (gridState[r][c]) drawMino(c * CELL, r * CELL, color);
    }
  }
}

for (let n = 2; n <= 10; n++) {
  const opt = document.createElement('option');
  opt.value = n;
  opt.textContent = n + '칸';
  if (n === 4) opt.selected = true;
  sel.appendChild(opt);
}

sel.addEventListener('change', () => {
  initGrid(Number(sel.value));
  drawGrid();
});

/* ── 도구 선택 ── */
let currentTool = 'pencil';
const toolIcons = document.querySelectorAll('#tools-panel [id^="tool-"]');
toolIcons.forEach(img => {
  img.addEventListener('click', () => {
    toolIcons.forEach(i => i.classList.remove('selected'));
    img.classList.add('selected');
    currentTool = img.id.replace('tool-', '');
  });
});

/* ── 격자 그리기/지우기 ── */
let gridDrawing = false;

function paintCell(e) {
  const rect = gridCanvas.getBoundingClientRect();
  const col = Math.floor((e.clientX - rect.left) / CELL);
  const row = Math.floor((e.clientY - rect.top)  / CELL);
  if (row >= 0 && row < gridN && col >= 0 && col < gridN) {
    gridState[row][col] = currentTool === 'eraser' ? 0 : 1;
    drawGrid();
  }
}

function floodFill(e) {
  const rect = gridCanvas.getBoundingClientRect();
  const col = Math.floor((e.clientX - rect.left) / CELL);
  const row = Math.floor((e.clientY - rect.top)  / CELL);
  if (row < 0 || row >= gridN || col < 0 || col >= gridN) return;
  const targetVal = currentTool === 'paint-all' ? 1 : 0;
  const origVal   = gridState[row][col];
  if (origVal === targetVal) return;
  const queue = [[row, col]];
  gridState[row][col] = targetVal;
  while (queue.length > 0) {
    const [r, c] = queue.shift();
    for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr < gridN && nc >= 0 && nc < gridN && gridState[nr][nc] === origVal) {
        gridState[nr][nc] = targetVal;
        queue.push([nr, nc]);
      }
    }
  }
  drawGrid();
}

const isBrush = () => currentTool === 'pencil' || currentTool === 'eraser';

function updateHistoryUI() {
  document.getElementById('action-undo').classList.toggle('available', undoStack.length > 0);
  document.getElementById('action-redo').classList.toggle('available', redoStack.length > 0);
}

function undo() {
  if (undoStack.length === 0) return;
  redoStack.push(cloneState());
  gridState = undoStack.pop();
  drawGrid();
  updateHistoryUI();
}

function redo() {
  if (redoStack.length === 0) return;
  undoStack.push(cloneState());
  gridState = redoStack.pop();
  drawGrid();
  updateHistoryUI();
}

document.getElementById('action-undo').addEventListener('click', undo);
document.getElementById('action-redo').addEventListener('click', redo);

gridCanvas.addEventListener('mousedown', e => {
  snapshotBefore = cloneState();
  gridDrawing = true;
  if (isBrush()) paintCell(e);
});
window.addEventListener('mousemove', e => { if (gridDrawing && isBrush()) paintCell(e); });
window.addEventListener('mouseup',   e => {
  if (gridDrawing) {
    if (!isBrush()) floodFill(e);
    if (!statesEqual(snapshotBefore, gridState)) {
      undoStack.push(snapshotBefore);
      redoStack.length = 0;
      updateHistoryUI();
    }
    snapshotBefore = null;
  }
  gridDrawing = false;
});

initGrid(4);

/* ── 컬러피커 ── */
const pickerCanvas = document.getElementById('picker-canvas');
const pickerCtx = pickerCanvas.getContext('2d');
const hueCanvas = document.getElementById('hue-canvas');
const hueCtx = hueCanvas.getContext('2d');
const hexInput = document.getElementById('hex-input');

const PW = pickerCanvas.width;
const PH = pickerCanvas.height;
const HW = hueCanvas.width;
const HH = hueCanvas.height;

let hue = 0;       // 0–360
let pickerX = 1.0; // saturation 0–1
let pickerY = 0.0; // 1 - value (0=top=bright, 1=bottom=dark)

function rgbToHex(r, g, b) {
  return [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();
}

function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  const s = max === 0 ? 0 : d / max;
  const v = max;
  if (d !== 0) {
    if      (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
    else if (max === g) h = ((b - r) / d + 2) * 60;
    else                h = ((r - g) / d + 4) * 60;
  }
  return [h, s, v];
}

function hsvToRgb(h, s, v) {
  const c = v * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = v - c;
  let r, g, b;
  if      (h < 60)  { r=c; g=x; b=0; }
  else if (h < 120) { r=x; g=c; b=0; }
  else if (h < 180) { r=0; g=c; b=x; }
  else if (h < 240) { r=0; g=x; b=c; }
  else if (h < 300) { r=x; g=0; b=c; }
  else              { r=c; g=0; b=x; }
  return [Math.round((r+m)*255), Math.round((g+m)*255), Math.round((b+m)*255)];
}

function hueColor(h) {
  const [r,g,b] = hsvToRgb(h, 1, 1);
  return `rgb(${r},${g},${b})`;
}

function getCurrentColor() {
  const [r,g,b] = hsvToRgb(hue, pickerX, 1 - pickerY);
  return `rgb(${r},${g},${b})`;
}

function drawPicker() {
  // 가로: 흰색(좌) → 현재 hue 색(우)
  const gradH = pickerCtx.createLinearGradient(0, 0, PW, 0);
  gradH.addColorStop(0, '#fff');
  gradH.addColorStop(1, hueColor(hue));
  pickerCtx.fillStyle = gradH;
  pickerCtx.fillRect(0, 0, PW, PH);

  // 세로: 투명(상) → 검정(하) 오버레이
  const gradV = pickerCtx.createLinearGradient(0, 0, 0, PH);
  gradV.addColorStop(0, 'rgba(0,0,0,0)');
  gradV.addColorStop(1, 'rgba(0,0,0,1)');
  pickerCtx.fillStyle = gradV;
  pickerCtx.fillRect(0, 0, PW, PH);

  // 선택 지점 원형 핸들
  const cx = pickerX * PW;
  const cy = pickerY * PH;
  pickerCtx.beginPath();
  pickerCtx.arc(cx, cy, 7, 0, Math.PI * 2);
  pickerCtx.strokeStyle = '#fff';
  pickerCtx.lineWidth = 2;
  pickerCtx.stroke();
  pickerCtx.beginPath();
  pickerCtx.arc(cx, cy, 5, 0, Math.PI * 2);
  pickerCtx.strokeStyle = 'rgba(0,0,0,0.5)';
  pickerCtx.lineWidth = 1;
  pickerCtx.stroke();
}

function drawHueSlider() {
  // 무지개 그라디언트: R→G→B→R
  const grad = hueCtx.createLinearGradient(0, 0, HW, 0);
  grad.addColorStop(0,     '#f00');
  grad.addColorStop(1/6,   '#ff0');
  grad.addColorStop(2/6,   '#0f0');
  grad.addColorStop(3/6,   '#0ff');
  grad.addColorStop(4/6,   '#00f');
  grad.addColorStop(5/6,   '#f0f');
  grad.addColorStop(1,     '#f00');
  hueCtx.fillStyle = grad;
  hueCtx.fillRect(0, 0, HW, HH);

  // 슬라이더 핸들
  const cx = (hue / 360) * HW;
  const cy = HH / 2;
  hueCtx.beginPath();
  hueCtx.arc(cx, cy, HH / 2 - 1, 0, Math.PI * 2);
  hueCtx.fillStyle = hueColor(hue);
  hueCtx.fill();
  hueCtx.strokeStyle = '#fff';
  hueCtx.lineWidth = 2;
  hueCtx.stroke();
}

function syncHexInput() {
  if (document.activeElement === hexInput) return;
  const [r, g, b] = hsvToRgb(hue, pickerX, 1 - pickerY);
  hexInput.value = rgbToHex(r, g, b);
  hexInput.classList.remove('invalid');
}

function redraw() {
  drawPicker();
  drawHueSlider();
  syncHexInput();
  drawGrid();
}

function clamp01(v) { return Math.max(0, Math.min(1, v)); }

// picker 마우스 이벤트
let pickerDragging = false;
function onPickerPointer(e) {
  const rect = pickerCanvas.getBoundingClientRect();
  pickerX = clamp01((e.clientX - rect.left) / PW);
  pickerY = clamp01((e.clientY - rect.top)  / PH);
  redraw();
}
pickerCanvas.addEventListener('mousedown', e => { pickerDragging = true; onPickerPointer(e); });
window.addEventListener('mousemove',  e => { if (pickerDragging) onPickerPointer(e); });
window.addEventListener('mouseup',    () => { pickerDragging = false; });

// hue 슬라이더 마우스 이벤트
let hueDragging = false;
function onHuePointer(e) {
  const rect = hueCanvas.getBoundingClientRect();
  const t = clamp01((e.clientX - rect.left) / HW);
  hue = t * 360;
  redraw();
}
hueCanvas.addEventListener('mousedown', e => { hueDragging = true; onHuePointer(e); });
window.addEventListener('mousemove',  e => { if (hueDragging) onHuePointer(e); });
window.addEventListener('mouseup',    () => { hueDragging = false; });

// hex 입력 이벤트
hexInput.addEventListener('input', () => {
  const val = hexInput.value.trim();
  if (!/^[0-9a-fA-F]{6}$/.test(val)) {
    hexInput.classList.toggle('invalid', val.length > 0);
    return;
  }
  hexInput.classList.remove('invalid');
  const r = parseInt(val.slice(0, 2), 16);
  const g = parseInt(val.slice(2, 4), 16);
  const b = parseInt(val.slice(4, 6), 16);
  [hue, pickerX, pickerY] = rgbToHsv(r, g, b);
  pickerY = 1 - pickerY; // value → pickerY 방향 변환
  drawPicker();
  drawHueSlider();
  drawGrid();
});

// 포커스 벗어날 때 유효하지 않은 값이면 현재 색상으로 복원
hexInput.addEventListener('blur', () => {
  const val = hexInput.value.trim();
  if (!/^[0-9a-fA-F]{6}$/.test(val)) {
    const [r, g, b] = hsvToRgb(hue, pickerX, 1 - pickerY);
    hexInput.value = rgbToHex(r, g, b);
    hexInput.classList.remove('invalid');
  }
});

// 편집 모드: pack 페이지에서 넘어온 미노 데이터 복원
const editingMinoRaw = sessionStorage.getItem('midrop_editing_mino');
if (editingMinoRaw) {
  sessionStorage.removeItem('midrop_editing_mino');
  const mino = JSON.parse(editingMinoRaw);
  const n = mino.shape.length;

  sel.value = n;
  initGrid(n);
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++)
      gridState[r][c] = mino.shape[r][c];

  document.getElementById('mino-name-input').value = mino.name;

  const hex = mino.color;
  const cr = parseInt(hex.slice(0, 2), 16);
  const cg = parseInt(hex.slice(2, 4), 16);
  const cb = parseInt(hex.slice(4, 6), 16);
  [hue, pickerX, pickerY] = rgbToHsv(cr, cg, cb);
  pickerY = 1 - pickerY;
}

redraw();

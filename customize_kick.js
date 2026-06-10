import { getPacks } from './src/data/packStore.js';
import { getKickSets, saveKickSets, encodeKick } from './src/data/kickStore.js';

/* ── 이탈 방지 ── */
let saving = false;

/* ── 이름 변경 ── */
function showRenameDialog() {
  const input = document.getElementById('rename-input');
  input.value = draftKickSet.name;
  input.classList.remove('invalid');
  document.getElementById('rename-overlay').classList.add('visible');
  input.focus();
  input.select();
}

function hideRenameDialog() {
  document.getElementById('rename-overlay').classList.remove('visible');
  document.getElementById('rename-input').classList.remove('invalid');
}

function saveKickName() {
  const input = document.getElementById('rename-input');
  const newName = input.value.trim();
  if (!newName) {
    input.classList.add('invalid');
    input.focus();
    return;
  }
  if (newName === draftKickSet.name) {
    hideRenameDialog();
    return;
  }
  draftKickSet.name = newName;
  document.querySelector('.page-title').textContent = newName;
  hideRenameDialog();
  showToast('이름을 변경했습니다.');
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('visible');
  setTimeout(() => toast.classList.remove('visible'), 1000);
}

window.addEventListener('beforeunload', e => {
  if (saving) return;
  e.preventDefault();
  e.returnValue = '';
});

/* ── 격자 ── */
const canvas = document.getElementById('kick-grid');
const ctx = canvas.getContext('2d');
const CELL = 30, N = 9;
canvas.width  = N * CELL;
canvas.height = N * CELL;

let kickGridState = Array.from({ length: N }, () => new Array(N).fill(0));
const kickUndoStack = [];
const kickRedoStack = [];
let kickSnapshotBefore = null;
let selectedMino = null;
let ghostMino = null; // { shape, offsetX, offsetY }
let displayFromState = 0;

// 렌더링 우선순위: index 0이 최우선. 같은 칸에 겹치면 낮은 우선순위는 무시됨.
let renderPriority = ['ghost', 'mino', 'gray'];

const ghostTargetSelect = document.getElementById('ghost-target-select');
const ghostStyleSelect  = document.getElementById('ghost-style-select');
const kickStatusText    = document.getElementById('kick-status-text');

const STATUS_IDLE    = 'ℹ️ 표에 마우스를 올려 오프셋 미리보기 가능';
const STATUS_OK      = 'ℹ️ 해당 오프셋으로 회전 가능';
const STATUS_BLOCKED = '⚠️ 해당 오프셋으로 회전할 수 없음';

let isHoveringTable = false;
kickStatusText.textContent = STATUS_IDLE;

function cloneKickState() {
  return kickGridState.map(row => [...row]);
}

function kickStatesEqual(a, b) {
  return a.every((row, r) => row.every((val, c) => val === b[r][c]));
}

function drawKickCell(col, row) {
  const x = col * CELL + 1, y = row * CELL + 1, s = CELL - 2;
  const hi = Math.max(3, Math.round(CELL * 0.13));
  const sh = Math.max(2, Math.round(CELL * 0.10));
  ctx.fillStyle = '#cccccc';
  ctx.fillRect(x, y, s, s);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(x, y, s, hi);
  ctx.fillRect(x, y, hi, s);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(x, y + s - sh, s, sh);
  ctx.fillRect(x + s - sh, y, sh, s);
}

function rotateShapeCW(shape) {
  const rows = shape.length;
  const cols = shape[0]?.length ?? 0;
  const next = Array.from({ length: cols }, () => Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      next[c][rows - 1 - r] = shape[r][c];
  return next;
}

function getRotatedShape(baseShape, toState) {
  let shape = baseShape.map(row => [...row]);
  for (let i = 0; i < (toState % 4); i++) shape = rotateShapeCW(shape);
  return shape;
}


function drawGhostCell(col, row) {
  const style = ghostStyleSelect.value;
  if (style === 'translucent') {
    ctx.save();
    ctx.globalAlpha = 0.25;
    drawMinoCell(col, row, selectedMino ? selectedMino.color : '#ffffff');
    ctx.restore();
  } else {
    const x = col * CELL + 2, y = row * CELL + 2, s = CELL - 4;
    ctx.save();
    ctx.strokeStyle = selectedMino ? selectedMino.color : '#ffffff';
    ctx.globalAlpha = 0.53;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, s, s);
    ctx.restore();
  }
}

function drawXCell(col, row) {
  ctx.save();
  ctx.fillStyle = '#ff0000';
  ctx.font = `bold ${CELL}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('×', col * CELL + CELL / 2, row * CELL + CELL / 2);
  ctx.restore();
}

function drawMinoCell(col, row, color) {
  const x = col * CELL + 1, y = row * CELL + 1, s = CELL - 2;
  const hi = Math.max(3, Math.round(CELL * 0.13));
  const sh = Math.max(2, Math.round(CELL * 0.10));
  ctx.fillStyle = color;
  ctx.fillRect(x, y, s, s);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(x, y, s, hi);
  ctx.fillRect(x, y, hi, s);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(x, y + s - sh, s, sh);
  ctx.fillRect(x + s - sh, y, sh, s);
}

function buildOccupancySets() {
  const ghost = new Set();
  const mino = new Set();

  if (ghostMino && selectedMino) {
    const { shape: gShape, offsetX, offsetY } = ghostMino;
    const gRows = gShape.length;
    const gCols = gShape[0]?.length ?? 0;
    const gStartR = Math.floor((N - gRows) / 2) + offsetY;
    const gStartC = Math.floor((N - gCols) / 2) + offsetX;
    for (let r = 0; r < gRows; r++)
      for (let c = 0; c < gCols; c++) {
        if (!gShape[r][c]) continue;
        const gr = gStartR + r, gc = gStartC + c;
        if (gr >= 0 && gr < N && gc >= 0 && gc < N) ghost.add(gr * N + gc);
      }
  }

  if (selectedMino) {
    const shape = getRotatedShape(selectedMino.shape, displayFromState);
    const rows = shape.length;
    if (rows > 0) {
      const cols = shape[0].length;
      const startR = Math.floor((N - rows) / 2);
      const startC = Math.floor((N - cols) / 2);
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++)
          if (shape[r][c]) mino.add((startR + r) * N + (startC + c));
    }
  }

  return { ghost, mino };
}

function drawKickGrid() {
  ctx.fillStyle = '#111';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#1c1c1c';
  ctx.lineWidth = 1;

  const { ghost, mino } = buildOccupancySets();
  const isBefore = ghostTargetSelect.value === 'before';
  const drawMino  = isBefore ? ghost : mino;
  const drawGhost = isBefore ? mino  : ghost;
  const priority  = isBefore ? ['mino', 'ghost', 'gray'] : renderPriority;

  let hasX = false;
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      ctx.strokeRect(c * CELL, r * CELL, CELL, CELL);
      const key = r * N + c;
      const isGray = kickGridState[r][c] === 1;
      const xCondition = !mino.has(key) && ghost.has(key) && isGray;
      if (xCondition) { hasX = true; drawXCell(c, r); continue; }
      const occupied = {
        ghost: drawGhost.has(key),
        mino:  drawMino.has(key),
        gray:  isGray,
      };
      for (const layer of priority) {
        if (!occupied[layer]) continue;
        if (layer === 'ghost') drawGhostCell(c, r);
        else if (layer === 'mino') drawMinoCell(c, r, selectedMino.color);
        else if (layer === 'gray') drawKickCell(c, r);
        break;
      }
    }
  }

  if (isHoveringTable) {
    kickStatusText.textContent = hasX ? STATUS_BLOCKED : STATUS_OK;
  }
}

function findTableForMino(minoName) {
  // 드래프트: 현재 필드 UI 상태 확인
  const inputs = [...fieldsCol.querySelectorAll('.kick-input')];
  for (const input of inputs) {
    if (input.value.trim() !== minoName) continue;
    const tableName = input.closest('.field-row').querySelector('.table-select').value;
    if (tableName && tableName !== '없음') return tableName;
  }
  // 원본 데이터 폴백
  const raw = sessionStorage.getItem('midrop_editing_kick_idx');
  const idx = raw !== null ? parseInt(raw, 10) : -1;
  if (idx < 0) return null;
  let sets;
  try { sets = getKickSets(); } catch { return null; }
  const found = sets[idx]?.minoMappings?.find(m => m.minoName === minoName)?.tableName ?? null;
  return (found && found !== '없음') ? found : null;
}

function activateTabByName(tableName) {
  const tabs = [...kickTabBar.querySelectorAll('.tab')];
  const target = tabs.find(t => t.firstChild.textContent.trim() === tableName);
  if (!target || target.classList.contains('active')) return;
  flushCurrentTabToDraft();
  tabs.forEach(t => t.classList.remove('active'));
  target.classList.add('active');
  loadTabTable();
}

function updateKickHistoryUI() {
  document.getElementById('kick-action-undo').classList.toggle('available', kickUndoStack.length > 0);
  document.getElementById('kick-action-redo').classList.toggle('available', kickRedoStack.length > 0);
}

drawKickGrid();

/* ── 행 추가/삭제 ── */
const fieldsCol = document.getElementById('fields-col');
const addRowBtn = document.getElementById('add-row-btn');
function rowCount() {
  return fieldsCol.querySelectorAll('.field-row').length;
}

function syncAddBtn() {
  addRowBtn.style.display = '';
}

function makeRow() {
  const row = document.createElement('div');
  row.className = 'field-row';
  row.innerHTML =
    '<input class="kick-input" type="text">' +
    '<select class="table-select combo-select"></select>' +
    '<img class="action-icon" src="img/delete.png" alt="delete">';
  return row;
}

fieldsCol.addEventListener('click', e => {
  const icon = e.target.closest('.action-icon');
  if (!icon) return;
  if (rowCount() <= 1) {
    icon.closest('.field-row').querySelector('.kick-input').value = '';
    return;
  }
  icon.closest('.field-row').remove();
  syncAddBtn();
});

addRowBtn.addEventListener('click', () => {
  fieldsCol.insertBefore(makeRow(), addRowBtn);
  syncAddBtn();
  syncTableSelects();
});

syncAddBtn();

/* ── 콤보박스 ── */
const packSelect = document.getElementById('pack-select');
const minoSelect = document.getElementById('mino-select');

const addMinoBtn = document.getElementById('add-mino-btn');

function syncMinoSelect() {
  minoSelect.innerHTML = '';
  if (packSelect.value === '') {
    minoSelect.disabled = true;
    addMinoBtn.disabled = true;
    return;
  }
  let packs = [];
  try { packs = getPacks(); } catch {}
  const pack = packs[parseInt(packSelect.value, 10)];
  if (!pack || pack.minos.length === 0) {
    minoSelect.disabled = true;
    addMinoBtn.disabled = true;
    return;
  }
  pack.minos.forEach((mino, i) => minoSelect.add(new Option(mino.name, String(i))));
  minoSelect.disabled = false;
  addMinoBtn.disabled = false;
}

function updateSelectedMino() {
  if (packSelect.value === '' || minoSelect.value === '') {
    selectedMino = null;
    return;
  }
  let packs = [];
  try { packs = getPacks(); } catch {}
  const pack = packs[parseInt(packSelect.value, 10)];
  if (!pack) { selectedMino = null; return; }
  const mino = pack.minos[parseInt(minoSelect.value, 10)];
  if (!mino || !mino.shape || mino.shape.length === 0) { selectedMino = null; return; }
  const color = mino.color.startsWith('#') ? mino.color : '#' + mino.color;
  selectedMino = { shape: mino.shape, color };
}

function loadPackSelect() {
  packSelect.innerHTML = '';
  let packs = [];
  try { packs = getPacks(); } catch {}
  if (packs.length === 0) {
    packSelect.add(new Option('없음', ''));
  } else {
    packs.forEach((pack, i) => packSelect.add(new Option(pack.name, String(i))));
  }
  syncMinoSelect();
}

packSelect.addEventListener('change', () => {
  syncMinoSelect();
  kickGridState = Array.from({ length: N }, () => new Array(N).fill(0));
  kickUndoStack.length = 0;
  kickRedoStack.length = 0;
  ghostMino = null;
  displayFromState = 0;
  updateKickHistoryUI();
  updateSelectedMino();
  drawKickGrid();
});

minoSelect.addEventListener('change', () => {
  kickGridState = Array.from({ length: N }, () => new Array(N).fill(0));
  kickUndoStack.length = 0;
  kickRedoStack.length = 0;
  ghostMino = null;
  displayFromState = 0;
  updateKickHistoryUI();
  updateSelectedMino();
  const minoName = minoSelect.options[minoSelect.selectedIndex]?.text ?? '';
  if (minoName) {
    const tableName = findTableForMino(minoName);
    if (tableName) activateTabByName(tableName);
  }
  drawKickGrid();
});

ghostTargetSelect.addEventListener('change', () => drawKickGrid());
ghostStyleSelect.addEventListener('change',  () => drawKickGrid());

loadPackSelect();
updateSelectedMino();
drawKickGrid();

/* ── 킥 테이블 ── */
const kickTable  = document.getElementById('kick-table');
const addColBtn  = document.getElementById('add-col-btn');
const MAX_COLS   = 13; // 라벨 열 포함 최대 열 수 (offset 0~11)

function tableColCount() {
  return kickTable.querySelector('thead tr').cells.length;
}

function fillDefaultCells() {
  kickTable.querySelectorAll('tbody td:not(:first-child)').forEach(td => {
    if (td.textContent.trim() === '') td.textContent = '(0, 0)';
  });
}

function syncAddColBtn() {
  addColBtn.disabled = tableColCount() >= MAX_COLS;
}

addColBtn.addEventListener('click', () => {
  if (tableColCount() >= MAX_COLS) return;
  const offsetIndex = tableColCount() - 1;
  const th = document.createElement('th');
  th.textContent = `offset ${offsetIndex}`;
  kickTable.querySelector('thead tr').appendChild(th);
  kickTable.querySelectorAll('tbody tr').forEach(tr => {
    const td = document.createElement('td');
    td.textContent = '(0, 0)';
    tr.appendChild(td);
  });
  const cell = document.createElement('div');
  cell.className = 'col-del-cell';
  cell.innerHTML = '<button class="col-del-btn" title="열 삭제">×</button>';
  document.getElementById('col-delete-bar').appendChild(cell);
  syncAddColBtn();
});

/* ── 열 삭제 ── */
const colDeleteBar = document.getElementById('col-delete-bar');

function reindexOffsetHeaders() {
  const cells = kickTable.querySelector('thead tr').cells;
  for (let i = 1; i < cells.length; i++)
    cells[i].textContent = `offset ${i - 1}`;
}

colDeleteBar.addEventListener('click', e => {
  const btn = e.target.closest('.col-del-btn');
  if (!btn) return;
  if (colDeleteBar.children.length <= 2) return; // 최소 1개 데이터 열 유지
  const cell = btn.closest('.col-del-cell');
  const colIndex = Array.from(colDeleteBar.children).indexOf(cell);
  kickTable.querySelectorAll('tr').forEach(tr => {
    if (tr.cells[colIndex]) tr.cells[colIndex].remove();
  });
  cell.remove();
  reindexOffsetHeaders();
  syncAddColBtn();
});

fillDefaultCells();
syncAddColBtn();

/* ── 셀 인라인 편집 ── */
function parseCoord(raw) {
  const s = raw.trim();
  const m = s.match(/^\(?\s*(-?\d+)\s*,\s*(-?\d+)\s*\)?$/);
  if (!m) return null;
  const hasParen = s.startsWith('(');
  if (hasParen !== s.endsWith(')')) return null;
  return `(${m[1]}, ${m[2]})`;
}

kickTable.addEventListener('click', e => {
  const td = e.target.closest('td');
  if (!td || !td.closest('tbody') || td.cellIndex === 0) return;
  if (td.querySelector('.cell-input')) return;

  const original = td.textContent;
  td.textContent = '';

  const input = document.createElement('input');
  input.className = 'cell-input';
  input.type = 'text';
  input.value = original;
  td.appendChild(input);
  input.focus();
  input.select();

  let done = false;
  function finish(value) {
    if (done) return;
    done = true;
    td.textContent = value;
  }

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const parsed = parseCoord(input.value);
      if (!parsed) { input.classList.add('invalid'); return; }
      finish(parsed);
    } else if (e.key === 'Escape') {
      finish(original);
    }
  });

  input.addEventListener('input', () => input.classList.remove('invalid'));
  input.addEventListener('blur', () => finish(original));
});

/* ── 크로스 하이라이트 ── */
let lastHighlightedCell = null;

function clearCrossHighlights() {
  kickTable.querySelectorAll('.cell-highlight').forEach(el => el.classList.remove('cell-highlight'));
}

function updateGhostFromCell(rowIndex, td) {
  if (!selectedMino || rowIndex < 0 || rowIndex >= ROW_KEYS.length) {
    ghostMino = null; displayFromState = 0; drawKickGrid(); return;
  }
  if (td.querySelector('.cell-input')) {
    ghostMino = null; displayFromState = 0; drawKickGrid(); return;
  }
  const rowKey = ROW_KEYS[rowIndex];
  const arrowIdx = rowKey.indexOf('->');
  if (arrowIdx === -1) { ghostMino = null; displayFromState = 0; drawKickGrid(); return; }
  const fromState = parseInt(rowKey.slice(0, arrowIdx), 10);
  const toState = parseInt(rowKey.slice(arrowIdx + 2), 10);

  const cellText = td.textContent.trim();
  const m = cellText.match(/^\(\s*(-?\d+)\s*,\s*(-?\d+)\s*\)$/);
  if (!m) { ghostMino = null; displayFromState = 0; drawKickGrid(); return; }

  displayFromState = fromState;
  ghostMino = {
    shape: getRotatedShape(selectedMino.shape, toState),
    offsetX: parseInt(m[1], 10),
    offsetY: parseInt(m[2], 10),
  };
  drawKickGrid();
}

function computeHasXForCell(rowIndex, td) {
  if (!selectedMino || rowIndex < 0 || rowIndex >= ROW_KEYS.length) return true;
  if (td.querySelector('.cell-input')) return true;
  const rowKey = ROW_KEYS[rowIndex];
  const arrowIdx = rowKey.indexOf('->');
  if (arrowIdx === -1) return true;
  const fromState = parseInt(rowKey.slice(0, arrowIdx), 10);
  const toState   = parseInt(rowKey.slice(arrowIdx + 2), 10);
  const m = td.textContent.trim().match(/^\(\s*(-?\d+)\s*,\s*(-?\d+)\s*\)$/);
  if (!m) return true;

  const savedGhost = ghostMino;
  const savedFrom  = displayFromState;
  displayFromState = fromState;
  ghostMino = {
    shape: getRotatedShape(selectedMino.shape, toState),
    offsetX: parseInt(m[1], 10),
    offsetY: parseInt(m[2], 10),
  };

  const { ghost, mino } = buildOccupancySets();
  const isBefore = ghostTargetSelect.value === 'before';
  let hasX = false;
  outer: for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const key = r * N + c;
      const isGray = kickGridState[r][c] === 1;
      if (!mino.has(key) && ghost.has(key) && isGray) { hasX = true; break outer; }
    }
  }

  ghostMino = savedGhost;
  displayFromState = savedFrom;
  return hasX;
}

function handleHeaderCellHover(tr) {
  const tbody = kickTable.querySelector('tbody');
  const rowIndex = [...tbody.rows].indexOf(tr);
  tr.cells[0].classList.add('cell-highlight');

  const cells = [...tr.cells].slice(1);
  for (const td of cells) {
    if (computeHasXForCell(rowIndex, td)) continue;
    kickTable.querySelector('thead tr').cells[td.cellIndex]?.classList.add('cell-highlight');
    td.classList.add('cell-highlight');
    updateGhostFromCell(rowIndex, td);
    return;
  }

  ghostMino = null;
  displayFromState = 0;
  drawKickGrid();
  kickStatusText.textContent = '⚠️ 해당 지형에서 회전 불가능';
}

kickTable.addEventListener('mouseover', e => {
  const td = e.target.closest('tbody td');
  if (td === lastHighlightedCell) return;
  isHoveringTable = true;
  clearCrossHighlights();
  lastHighlightedCell = td;
  if (!td) {
    ghostMino = null;
    displayFromState = 0;
    drawKickGrid();
    return;
  }
  if (td.cellIndex === 0) {
    handleHeaderCellHover(td.closest('tr'));
    return;
  }
  kickTable.querySelector('thead tr').cells[td.cellIndex]?.classList.add('cell-highlight');
  td.closest('tr').cells[0].classList.add('cell-highlight');
  const rowIndex = [...kickTable.querySelector('tbody').rows].indexOf(td.closest('tr'));
  updateGhostFromCell(rowIndex, td);
});

kickTable.addEventListener('mouseleave', () => {
  clearCrossHighlights();
  lastHighlightedCell = null;
  ghostMino = null;
  displayFromState = 0;
  isHoveringTable = false;
  kickStatusText.textContent = STATUS_IDLE;
  drawKickGrid();
});

/* ── 탭 바 ── */
const kickTabBar = document.getElementById('kick-tab-bar');
const addTabBtn  = document.getElementById('add-tab-btn');
const MAX_TABS   = 10;
let tabCount = 1;

function syncAddTabBtn() {
  addTabBtn.style.display =
    kickTabBar.querySelectorAll('.tab').length >= MAX_TABS ? 'none' : '';
}

function syncTableSelects() {
  const labels = [...kickTabBar.querySelectorAll('.tab')].map(tab =>
    tab.firstChild.textContent.trim()
  );
  document.querySelectorAll('.field-row .table-select').forEach(sel => {
    const current = sel.value;
    sel.innerHTML = '';
    labels.forEach(label => sel.add(new Option(label, label)));
    sel.add(new Option('없음', '없음'));
    if ([...sel.options].some(o => o.value === current)) sel.value = current;
    else sel.value = '없음';
  });
}

function startTabRename(tab) {
  if (tab.querySelector('.tab-name-input')) return;

  const textNode = tab.firstChild;
  const original = textNode.textContent.trim();

  const input = document.createElement('input');
  input.className = 'tab-name-input';
  input.type = 'text';
  input.value = original;
  textNode.replaceWith(input);
  input.focus();
  input.select();

  let done = false;
  function finish(newName) {
    if (done) return;
    done = true;
    if (newName !== original) {
      const tableData = draftKickSet.tables.find(t => t.name === original);
      if (tableData) tableData.name = newName;
    }
    input.replaceWith(document.createTextNode(newName));
    if (newName !== original) syncTableSelects();
  }

  input.addEventListener('keydown', ev => {
    if (ev.key === 'Enter') {
      const trimmed = input.value.trim();
      if (!trimmed) { input.classList.add('invalid'); return; }
      const isDup = [...kickTabBar.querySelectorAll('.tab')]
        .filter(t => t !== tab)
        .some(t => t.firstChild.textContent.trim() === trimmed);
      if (isDup) { input.classList.add('invalid'); return; }
      finish(trimmed);
    } else if (ev.key === 'Escape') {
      finish(original);
    }
  });

  input.addEventListener('input', () => input.classList.remove('invalid'));
  input.addEventListener('blur', () => finish(original));
}

kickTabBar.addEventListener('click', e => {
  const closeBtn = e.target.closest('.tab-close-btn');
  if (closeBtn) {
    if (kickTabBar.querySelectorAll('.tab').length <= 1) return;
    const tab = closeBtn.closest('.tab');
    const wasActive = tab.classList.contains('active');
    const tabName = tab.firstChild.textContent.trim();
    const draftIdx = draftKickSet.tables.findIndex(t => t.name === tabName);
    if (draftIdx !== -1) draftKickSet.tables.splice(draftIdx, 1);
    const allTabs = [...kickTabBar.querySelectorAll('.tab')];
    const idx = allTabs.indexOf(tab);
    tab.remove();
    if (wasActive) {
      const remaining = [...kickTabBar.querySelectorAll('.tab')];
      if (remaining.length > 0) {
        remaining[Math.min(idx, remaining.length - 1)].classList.add('active');
        loadTabTable();
      }
    }
    syncAddTabBtn();
    syncTableSelects();
    return;
  }
  const tab = e.target.closest('.tab');
  if (!tab) return;
  if (tab.classList.contains('active')) {
    startTabRename(tab);
    return;
  }
  flushCurrentTabToDraft();
  kickTabBar.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  tab.classList.add('active');
  loadTabTable();
});

addTabBtn.addEventListener('click', e => {
  e.stopPropagation();
  flushCurrentTabToDraft();
  tabCount++;
  const newName = `테이블 ${tabCount}`;
  draftKickSet.tables.push({ name: newName, offsets: {} });
  const tab = document.createElement('button');
  tab.className = 'tab';
  tab.innerHTML = `${newName}<span class="tab-close-btn">×</span>`;
  kickTabBar.insertBefore(tab, addTabBtn);
  kickTabBar.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  tab.classList.add('active');
  syncAddTabBtn();
  syncTableSelects();
  loadTabTable();
});

syncTableSelects();

/* ── 추가하기 버튼 ── */
addMinoBtn.addEventListener('click', () => {
  const name = minoSelect.options[minoSelect.selectedIndex].text;
  const activeTabName = kickTabBar.querySelector('.tab.active')?.firstChild.textContent.trim() ?? '';

  const inputs = [...fieldsCol.querySelectorAll('.kick-input')];

  // 동일 미노명이 이미 존재하면 테이블 선택만 덮어쓰기
  const existingInput = inputs.find(inp => inp.value.trim() === name);
  if (existingInput) {
    existingInput.closest('.field-row').querySelector('.table-select').value = activeTabName;
    return;
  }

  const emptyInput = inputs.find(inp => inp.value.trim() === '');
  if (emptyInput) {
    emptyInput.value = name;
    emptyInput.closest('.field-row').querySelector('.table-select').value = activeTabName;
  } else {
    const row = makeRow();
    fieldsCol.insertBefore(row, addRowBtn);
    row.querySelector('.kick-input').value = name;
    syncTableSelects();
    row.querySelector('.table-select').value = activeTabName;
  }
});

/* ── 킥 데이터 로드 ── */

const ROW_KEYS = [
  '0->1', '1->2', '2->3', '3->0',
  '0->3', '3->2', '2->1', '1->0',
  '0->2', '1->3', '2->0', '3->1',
];

const _initTabName = kickTabBar.querySelector('.tab.active')?.firstChild?.textContent?.trim() ?? '테이블 1';
let draftKickSet = {
  formatVersion: 1,
  name: '',
  tables: [{ name: _initTabName, offsets: {} }],
  minoMappings: []
};

// 현재 활성 탭 DOM 내용을 draftKickSet에 반영
function flushCurrentTabToDraft() {
  const activeTab = kickTabBar.querySelector('.tab.active');
  if (!activeTab) return;
  const activeTabName = activeTab.firstChild.textContent.trim();
  const tableData = draftKickSet.tables.find(t => t.name === activeTabName);
  if (!tableData) return;
  const newOffsets = {};
  kickTable.querySelectorAll('tbody tr').forEach((tr, rowIdx) => {
    const rowKey = ROW_KEYS[rowIdx];
    const values = [];
    for (let colIdx = 1; colIdx < tr.cells.length; colIdx++) {
      const text = tr.cells[colIdx].textContent.trim();
      const m = text.match(/^\(\s*(-?\d+)\s*,\s*(-?\d+)\s*\)$/);
      values.push(m ? [parseInt(m[1], 10), parseInt(m[2], 10)] : [0, 0]);
    }
    if (values.length > 0) newOffsets[rowKey] = values;
  });
  tableData.offsets = newOffsets;
}

// 현재 UI의 minoMappings을 draftKickSet에 반영
function flushMappingsToDraft() {
  const mappings = [];
  fieldsCol.querySelectorAll('.field-row').forEach(row => {
    const name = row.querySelector('.kick-input').value.trim();
    const tableName = row.querySelector('.table-select').value;
    if (name) mappings.push({ minoName: name, tableName });
  });
  draftKickSet.minoMappings = mappings;
}

// 행 배열에서 최초 (0,0) 이후의 (0,0) 제거
function washRow(arr) {
  const firstZeroIdx = arr.findIndex(([x, y]) => x === 0 && y === 0);
  if (firstZeroIdx === -1) return arr;
  return arr.filter((v, i) => i <= firstZeroIdx || !(v[0] === 0 && v[1] === 0));
}

// 저장 전 워싱: 행별 후행 (0,0) 제거 + 미사용 전체-(0,0) 테이블 제거
function washKickSet(kickSet) {
  const result = JSON.parse(JSON.stringify(kickSet));
  result.tables.forEach(table => {
    Object.keys(table.offsets).forEach(key => {
      table.offsets[key] = washRow(table.offsets[key]);
    });
  });
  const mappedNames = new Set(result.minoMappings.map(m => m.tableName));
  result.tables = result.tables.filter(table => {
    if (mappedNames.has(table.name)) return true;
    const allZero = Object.values(table.offsets).every(arr =>
      arr.every(([x, y]) => x === 0 && y === 0)
    );
    return !allZero;
  });
  return result;
}

function populateTable(tableData) {
  const offsets = tableData.offsets ?? {};
  const maxLen = Object.values(offsets).reduce((m, arr) => Math.max(m, arr.length), 1);
  const targetCols = maxLen + 1;
  let currentCols = tableColCount();
  while (currentCols < targetCols) {
    const th = document.createElement('th');
    kickTable.querySelector('thead tr').appendChild(th);
    kickTable.querySelectorAll('tbody tr').forEach(tr => tr.appendChild(document.createElement('td')));
    const cell = document.createElement('div');
    cell.className = 'col-del-cell';
    cell.innerHTML = '<button class="col-del-btn" title="열 삭제">×</button>';
    colDeleteBar.appendChild(cell);
    currentCols++;
  }
  while (currentCols > targetCols) {
    const headerRow = kickTable.querySelector('thead tr');
    headerRow.deleteCell(headerRow.cells.length - 1);
    kickTable.querySelectorAll('tbody tr').forEach(tr => tr.deleteCell(tr.cells.length - 1));
    colDeleteBar.lastElementChild.remove();
    currentCols--;
  }
  reindexOffsetHeaders();
  syncAddColBtn();
  kickTable.querySelectorAll('tbody tr').forEach((tr, rowIdx) => {
    const rowOffsets = offsets[ROW_KEYS[rowIdx]] ?? [];
    for (let colIdx = 1; colIdx < tr.cells.length; colIdx++) {
      const off = rowOffsets[colIdx - 1];
      tr.cells[colIdx].textContent = off ? `(${off[0]}, ${off[1]})` : '(0, 0)';
    }
  });
}

// draftKickSet에서 활성 탭 데이터를 읽어 테이블을 갱신
function loadTabTable() {
  const activeTabName = kickTabBar.querySelector('.tab.active')?.firstChild.textContent.trim();
  if (!activeTabName) return;
  const tableData = draftKickSet.tables.find(t => t.name === activeTabName);
  populateTable(tableData ?? { name: activeTabName, offsets: {} });
}

(function loadFromSession() {
  const raw = sessionStorage.getItem('midrop_editing_kick_idx');
  if (raw === null) return;
  const idx = parseInt(raw, 10);
  if (!Number.isInteger(idx) || idx < 0) return;
  let sets;
  try { sets = getKickSets(); } catch { return; }
  const kickSet = sets[idx];
  if (!kickSet || !Array.isArray(kickSet.tables) || kickSet.tables.length === 0) return;
  if (!kickSet.tables.every(t => typeof t.name === 'string' && t.offsets != null)) return;

  draftKickSet = JSON.parse(JSON.stringify(kickSet));

  if (kickSet.name) {
    document.querySelector('.page-title').textContent = kickSet.name;
  }

  kickTabBar.querySelectorAll('.tab').forEach(t => t.remove());
  kickSet.tables.forEach((table, i) => {
    const tab = document.createElement('button');
    tab.className = 'tab' + (i === 0 ? ' active' : '');
    tab.textContent = table.name;
    const closeSpan = document.createElement('span');
    closeSpan.className = 'tab-close-btn';
    closeSpan.textContent = '×';
    tab.appendChild(closeSpan);
    kickTabBar.insertBefore(tab, addTabBtn);
  });
  tabCount = kickSet.tables.length;
  syncAddTabBtn();

  fieldsCol.querySelectorAll('.field-row').forEach(r => r.remove());
  const mappings = Array.isArray(kickSet.minoMappings) ? kickSet.minoMappings : [];
  const rowsToCreate = mappings.length > 0 ? mappings.length : 1;
  for (let i = 0; i < rowsToCreate; i++) fieldsCol.insertBefore(makeRow(), addRowBtn);
  syncAddBtn();
  syncTableSelects();
  fieldsCol.querySelectorAll('.field-row').forEach((row, i) => {
    const m = mappings[i];
    if (!m) return;
    row.querySelector('.kick-input').value = m.minoName;
    row.querySelector('.table-select').value = m.tableName;
  });

  loadTabTable();
})();

// 초기 로드 시 선택된 미노의 매칭 테이블 활성화
{
  const initMinoName = minoSelect.options[minoSelect.selectedIndex]?.text ?? '';
  if (initMinoName) {
    const initTableName = findTableForMino(initMinoName);
    if (initTableName) activateTabByName(initTableName);
  }
}

/* ── 저장 ── */
document.querySelector('.save-btn').addEventListener('click', () => {
  const raw = sessionStorage.getItem('midrop_editing_kick_idx');
  const idx = raw !== null ? parseInt(raw, 10) : -1;
  let sets;
  try { sets = getKickSets(); } catch { sets = []; }
  if (idx >= 0 && idx < sets.length) {
    flushCurrentTabToDraft();
    flushMappingsToDraft();
    sets[idx] = washKickSet(draftKickSet);
    sets[idx].code = encodeKick(sets[idx]);
    saveKickSets(sets);
  }
  saving = true;
  location.href = 'library_kick.html';
});

/* ── 미러 버튼 행 하이라이트 & 미리보기 ── */
let mirrorPreviewOriginals = null;

function highlightRows(rowIndices) {
  clearCrossHighlights();
  lastHighlightedCell = null;
  const rows = [...kickTable.querySelectorAll('tbody tr')];
  rowIndices.forEach(i => {
    const row = rows[i];
    if (!row) return;
    [...row.cells].forEach(cell => cell.classList.add('cell-highlight'));
  });
}

function clearMirrorPreview() {
  if (!mirrorPreviewOriginals) return;
  mirrorPreviewOriginals.forEach(({ cell, original }) => {
    cell.textContent = original;
    cell.classList.remove('cell-preview');
  });
  mirrorPreviewOriginals = null;
}

function commitMirrorPreview() {
  if (!mirrorPreviewOriginals) return;
  mirrorPreviewOriginals.forEach(({ cell }) => cell.classList.remove('cell-preview'));
  mirrorPreviewOriginals = null;
}

function computeLRValue(srcText) {
  const m = srcText.trim().match(/^\(\s*(-?\d+)\s*,\s*(-?\d+)\s*\)$/);
  return m ? `(${-parseInt(m[1], 10)}, ${m[2]})` : srcText;
}

const LR_PAIRS = [[0, 4], [1, 5], [6, 2], [7, 3]];

function showPreviewLR() {
  const rows = [...kickTable.querySelectorAll('tbody tr')];
  mirrorPreviewOriginals = [];
  LR_PAIRS.forEach(([src, dst]) => {
    const srcRow = rows[src];
    const dstRow = rows[dst];
    if (!srcRow || !dstRow) return;
    for (let col = 1; col < srcRow.cells.length; col++) {
      const dstCell = dstRow.cells[col];
      mirrorPreviewOriginals.push({ cell: dstCell, original: dstCell.textContent });
      dstCell.textContent = computeLRValue(srcRow.cells[col].textContent);
      dstCell.classList.add('cell-preview');
    }
  });
}

document.getElementById('btn-lr-mirror').addEventListener('mouseenter', () => {
  highlightRows([4, 5, 2, 3]);
  showPreviewLR();
});

const mirrorOverlay = document.getElementById('mirror-overlay');

function hideMirrorDialog() {
  mirrorOverlay.classList.remove('visible');
  clearMirrorPreview();
  clearCrossHighlights();
  lastHighlightedCell = null;
}

document.getElementById('mirror-row').addEventListener('mouseleave', () => {
  if (mirrorOverlay.classList.contains('visible')) return;
  clearMirrorPreview();
  clearCrossHighlights();
  lastHighlightedCell = null;
});

document.getElementById('btn-lr-mirror').addEventListener('click', () => {
  mirrorOverlay.classList.add('visible');
});

document.getElementById('btn-mirror-cancel').addEventListener('click', hideMirrorDialog);
mirrorOverlay.addEventListener('click', e => {
  if (e.target === mirrorOverlay) hideMirrorDialog();
});

document.getElementById('btn-mirror-confirm').addEventListener('click', () => {
  commitMirrorPreview();
  const rows = [...kickTable.querySelectorAll('tbody tr')];
  LR_PAIRS.forEach(([src, dst]) => {
    const srcRow = rows[src];
    const dstRow = rows[dst];
    if (!srcRow || !dstRow) return;
    for (let col = 1; col < srcRow.cells.length; col++)
      dstRow.cells[col].textContent = computeLRValue(srcRow.cells[col].textContent);
  });
  mirrorOverlay.classList.remove('visible');
  clearCrossHighlights();
  lastHighlightedCell = null;
});

/* ── 킥 테스트 도구 선택 ── */
let currentKickTool = 'pencil';
const kickToolIcons = document.querySelectorAll('#kick-tool-pencil, #kick-tool-eraser');
kickToolIcons.forEach(img => {
  img.addEventListener('click', () => {
    kickToolIcons.forEach(i => i.classList.remove('selected'));
    img.classList.add('selected');
    currentKickTool = img.id.replace('kick-tool-', '');
  });
});

/* ── 킥 테스트 드로잉 ── */
let kickDrawing = false;

function paintKickCell(e) {
  const rect = canvas.getBoundingClientRect();
  const col = Math.floor((e.clientX - rect.left) / CELL);
  const row = Math.floor((e.clientY - rect.top)  / CELL);
  if (row >= 0 && row < N && col >= 0 && col < N) {
    kickGridState[row][col] = currentKickTool === 'eraser' ? 0 : 1;
    drawKickGrid();
  }
}

canvas.addEventListener('mousedown', e => {
  kickSnapshotBefore = cloneKickState();
  kickDrawing = true;
  paintKickCell(e);
});
window.addEventListener('mousemove', e => { if (kickDrawing) paintKickCell(e); });
window.addEventListener('mouseup', () => {
  if (kickDrawing) {
    if (!kickStatesEqual(kickSnapshotBefore, kickGridState)) {
      kickUndoStack.push(kickSnapshotBefore);
      kickRedoStack.length = 0;
      updateKickHistoryUI();
    }
    kickSnapshotBefore = null;
  }
  kickDrawing = false;
});

document.getElementById('kick-action-undo').addEventListener('click', () => {
  if (kickUndoStack.length === 0) return;
  kickRedoStack.push(cloneKickState());
  kickGridState = kickUndoStack.pop();
  drawKickGrid();
  updateKickHistoryUI();
});

document.getElementById('kick-action-redo').addEventListener('click', () => {
  if (kickRedoStack.length === 0) return;
  kickUndoStack.push(cloneKickState());
  kickGridState = kickRedoStack.pop();
  drawKickGrid();
  updateKickHistoryUI();
});

document.getElementById('kick-rename-btn').addEventListener('click', showRenameDialog);
document.getElementById('btn-rename-cancel').addEventListener('click', hideRenameDialog);
document.getElementById('btn-rename-save').addEventListener('click', saveKickName);
document.getElementById('rename-overlay').addEventListener('click', e => {
  if (e.target === e.currentTarget) hideRenameDialog();
});
const renameInput = document.getElementById('rename-input');
renameInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') saveKickName();
  if (e.key === 'Escape') hideRenameDialog();
});
renameInput.addEventListener('input', () => renameInput.classList.remove('invalid'));

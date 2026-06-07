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

ctx.fillStyle = '#111';
ctx.fillRect(0, 0, canvas.width, canvas.height);

ctx.strokeStyle = '#1c1c1c';
ctx.lineWidth = 1;
for (let r = 0; r < N; r++)
  for (let c = 0; c < N; c++)
    ctx.strokeRect(c * CELL, r * CELL, CELL, CELL);

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

packSelect.addEventListener('change', syncMinoSelect);

loadPackSelect();

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

kickTable.addEventListener('mouseover', e => {
  const td = e.target.closest('tbody td');
  if (td === lastHighlightedCell) return;
  clearCrossHighlights();
  lastHighlightedCell = td;
  if (!td || td.cellIndex === 0) return;
  kickTable.querySelector('thead tr').cells[td.cellIndex]?.classList.add('cell-highlight');
  td.closest('tr').cells[0].classList.add('cell-highlight');
});

kickTable.addEventListener('mouseleave', () => {
  clearCrossHighlights();
  lastHighlightedCell = null;
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

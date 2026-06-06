import { getPacks } from './src/data/packStore.js';

/* ── 이탈 방지 ── */
let saving = false;

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
const MAX_ROWS  = 10;

function rowCount() {
  return fieldsCol.querySelectorAll('.field-row').length;
}

function syncAddBtn() {
  addRowBtn.style.display = rowCount() >= MAX_ROWS ? 'none' : '';
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
  if (rowCount() >= MAX_ROWS) return;
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
    if ([...sel.options].some(o => o.value === current)) sel.value = current;
  });
}

kickTabBar.addEventListener('click', e => {
  const closeBtn = e.target.closest('.tab-close-btn');
  if (closeBtn) {
    if (kickTabBar.querySelectorAll('.tab').length <= 1) return;
    const tab = closeBtn.closest('.tab');
    const wasActive = tab.classList.contains('active');
    const allTabs = [...kickTabBar.querySelectorAll('.tab')];
    const idx = allTabs.indexOf(tab);
    tab.remove();
    if (wasActive) {
      const remaining = [...kickTabBar.querySelectorAll('.tab')];
      if (remaining.length > 0)
        remaining[Math.min(idx, remaining.length - 1)].classList.add('active');
    }
    syncAddTabBtn();
    syncTableSelects();
    return;
  }
  const tab = e.target.closest('.tab');
  if (!tab) return;
  kickTabBar.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  tab.classList.add('active');
});

addTabBtn.addEventListener('click', e => {
  e.stopPropagation();
  tabCount++;
  const tab = document.createElement('button');
  tab.className = 'tab';
  tab.innerHTML = `테이블 ${tabCount}<span class="tab-close-btn">×</span>`;
  kickTabBar.insertBefore(tab, addTabBtn);
  kickTabBar.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  tab.classList.add('active');
  syncAddTabBtn();
  syncTableSelects();
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
    if (rowCount() >= MAX_ROWS) return;
    const row = makeRow();
    fieldsCol.insertBefore(row, addRowBtn);
    row.querySelector('.kick-input').value = name;
    syncAddBtn();
    syncTableSelects();
    row.querySelector('.table-select').value = activeTabName;
  }
});

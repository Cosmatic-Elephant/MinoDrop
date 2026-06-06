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
const MAX_COLS   = 11; // 라벨 열 포함 최대 열 수

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

/* ── 추가하기 버튼 ── */
addMinoBtn.addEventListener('click', () => {
  const name = minoSelect.options[minoSelect.selectedIndex].text;

  const inputs = [...fieldsCol.querySelectorAll('.kick-input')];
  if (inputs.some(inp => inp.value.trim() === name)) return;

  const emptyInput = inputs.find(inp => inp.value.trim() === '');
  if (emptyInput) {
    emptyInput.value = name;
  } else {
    if (rowCount() >= MAX_ROWS) return;
    const row = makeRow();
    fieldsCol.insertBefore(row, addRowBtn);
    row.querySelector('.kick-input').value = name;
    syncAddBtn();
  }
});

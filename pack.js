import { getPacks, savePacks, encodePack } from './src/data/packStore.js';

const BASE_CELL = 30;
let code = sessionStorage.getItem('midrop_editing_pack');
let pendingDelete = null;
let originalPackName = '';

function showConfirm(onConfirm) {
  pendingDelete = onConfirm;
  document.getElementById('confirm-overlay').classList.add('visible');
}

function hideConfirm() {
  pendingDelete = null;
  document.getElementById('confirm-overlay').classList.remove('visible');
}

function showRenameDialog() {
  const input = document.getElementById('rename-input');
  input.value = originalPackName;
  document.getElementById('rename-overlay').classList.add('visible');
  input.focus();
  input.select();
}

function hideRenameDialog() {
  document.getElementById('rename-overlay').classList.remove('visible');
  document.getElementById('rename-input').classList.remove('invalid');
}

function savePackName() {
  const input = document.getElementById('rename-input');
  const newName = input.value.trim();
  if (!newName) {
    input.classList.add('invalid');
    input.focus();
    return;
  }
  if (newName === originalPackName) {
    hideRenameDialog();
    return;
  }
  const packs = getPacks();
  const pack = packs.find(p => p.code === code) ?? packs[0];
  if (!pack) return;
  pack.name = newName;
  pack.code = encodePack(pack);
  code = pack.code;
  sessionStorage.setItem('midrop_editing_pack', code);
  savePacks(packs);
  originalPackName = newName;
  document.querySelector('.page-title').textContent = newName;
  hideRenameDialog();
  showToast('팩 이름을 변경했습니다.');
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('visible');
  setTimeout(() => toast.classList.remove('visible'), 1000);
}

function trimShape(shape) {
  let minR = shape.length, maxR = -1, minC = shape[0].length, maxC = -1;
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (shape[r][c]) {
        minR = Math.min(minR, r); maxR = Math.max(maxR, r);
        minC = Math.min(minC, c); maxC = Math.max(maxC, c);
      }
    }
  }
  if (maxR < 0) return [];
  return shape.slice(minR, maxR + 1).map(row => row.slice(minC, maxC + 1));
}

function cellPx(ctx, px, py, color, cellSize) {
  const x = px + 1, y = py + 1, s = cellSize - 2;
  const hi = Math.max(3, Math.round(cellSize * 0.13));
  const sh = Math.max(2, Math.round(cellSize * 0.10));
  ctx.fillStyle = color;
  ctx.fillRect(x, y, s, s);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(x, y, s, hi);
  ctx.fillRect(x, y, hi, s);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(x, y + s - sh, s, sh);
  ctx.fillRect(x + s - sh, y, sh, s);
}

function renderThumbnail(canvas, mino) {
  const W = canvas.width, H = canvas.height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#111827';
  ctx.fillRect(0, 0, W, H);

  const trimmed = trimShape(mino.shape);
  if (!trimmed.length) return;

  const tRows = trimmed.length, tCols = trimmed[0].length;
  const cell = Math.min(BASE_CELL, Math.floor(W / tCols), Math.floor(H / tRows));
  const startX = Math.round((W - tCols * cell) / 2);
  const startY = Math.round((H - tRows * cell) / 2);

  for (let r = 0; r < tRows; r++) {
    for (let c = 0; c < tCols; c++) {
      if (trimmed[r][c]) {
        cellPx(ctx, startX + c * cell, startY + r * cell, '#' + mino.color, cell);
      }
    }
  }
}

function createMinoCard(mino) {
  const card = document.createElement('div');
  card.className = 'mino-card';
  const size = mino.shape[0].length;

  card.innerHTML = `
    <div class="mino-thumbnail">
      <canvas width="118" height="118"></canvas>
    </div>
    <div class="mino-info">
      <span class="mino-name">${mino.name}</span>
      <span class="mino-size">사이즈: ${size}×${size}</span>
    </div>
    <div class="mino-actions">
      <img class="mino-action-icon" src="img/pencil.png" alt="edit"   title="편집">
      <img class="mino-action-icon" src="img/delete.png" alt="delete" title="삭제">
    </div>
  `;

  renderThumbnail(card.querySelector('canvas'), mino);
  return card;
}

function renderGrid() {
  const packs = getPacks();
  const pack = packs.find(p => p.code === code) ?? packs[0];
  if (!pack) return;

  originalPackName = pack.name;
  document.querySelector('.page-title').textContent = pack.name;

  const grid = document.getElementById('mino-grid');
  grid.innerHTML = '';

  const thumbIdx = Math.min(pack.thumbnail ?? 0, pack.minos.length - 1);
  const cards = [];

  pack.minos.forEach((mino, minoIdx) => {
    const card = createMinoCard(mino);
    cards.push(card);
    grid.appendChild(card);

    card.addEventListener('click', () => {
      cards.forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      const packs = getPacks();
      const p = packs.find(q => q.code === code) ?? packs[0];
      if (!p) return;
      p.thumbnail = minoIdx;
      savePacks(packs);
    });
    card.querySelector('.mino-actions').addEventListener('click', e => e.stopPropagation());

    card.querySelector('.mino-action-icon[title="편집"]').addEventListener('click', () => {
      sessionStorage.setItem('midrop_editing_mino', JSON.stringify(mino));
      location.href = 'customize_mino.html';
    });

    card.querySelector('.mino-action-icon[title="삭제"]').addEventListener('click', () => {
      showConfirm(() => {
        const packs = getPacks();
        const pack = packs.find(p => p.code === code) ?? packs[0];
        if (!pack) return;
        if (minoIdx < pack.thumbnail) {
          pack.thumbnail = pack.thumbnail - 1;
        } else if (minoIdx === pack.thumbnail) {
          pack.thumbnail = Math.max(0, pack.thumbnail - 1);
        }
        pack.minos.splice(minoIdx, 1);
        pack.minoCount = pack.minos.length;
        pack.size = pack.minos.length ? Math.max(...pack.minos.map(m => m.shape.length)) : 0;
        pack.code = encodePack(pack);
        code = pack.code;
        sessionStorage.setItem('midrop_editing_pack', code);
        savePacks(packs);
        renderGrid();
      });
    });
  });

  if (cards[thumbIdx]) cards[thumbIdx].classList.add('active');
}

function init() {
  document.getElementById('btn-cancel').addEventListener('click', hideConfirm);
  document.getElementById('btn-delete').addEventListener('click', () => {
    const cb = pendingDelete;
    hideConfirm();
    if (cb) cb();
    showToast('미노를 삭제했습니다.');
  });
  document.getElementById('confirm-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) hideConfirm();
  });

  document.getElementById('pack-rename-btn').addEventListener('click', showRenameDialog);
  document.getElementById('btn-rename-cancel').addEventListener('click', hideRenameDialog);
  document.getElementById('btn-rename-save').addEventListener('click', savePackName);
  document.getElementById('rename-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) hideRenameDialog();
  });
  const renameInput = document.getElementById('rename-input');
  renameInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') savePackName();
    if (e.key === 'Escape') hideRenameDialog();
  });
  renameInput.addEventListener('input', () => {
    renameInput.classList.remove('invalid');
  });

  renderGrid();
}

init();

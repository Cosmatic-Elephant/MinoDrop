import { getPacks, getActiveIndex, setActivePack, savePacks, encodePack, decodePack } from './src/data/packStore.js';
import { DEFAULT_PACK } from './src/data/defaultPack.js';

const BASE_CELL = 30;
let pendingDelete = null;

function resolveCodeConflict(pack, packs) {
  if (!packs.some(p => p.code === pack.code)) return;
  const baseName = pack.name;
  let n = 1;
  do {
    pack.name = `${baseName}(${n++})`;
    pack.code = encodePack(pack);
  } while (packs.some(p => p.code === pack.code));
}

function showImportDialog() {
  const input = document.getElementById('import-input');
  input.value = '';
  input.classList.remove('invalid');
  document.getElementById('allow-dup-checkbox').checked = false;
  document.getElementById('import-overlay').classList.add('visible');
  input.focus();
}

function hideImportDialog() {
  document.getElementById('import-overlay').classList.remove('visible');
  document.getElementById('import-input').classList.remove('invalid');
}

function importPack() {
  const input = document.getElementById('import-input');
  const codeStr = input.value.trim();
  if (!codeStr) {
    input.classList.add('invalid');
    return;
  }

  let pack;
  if (codeStr === DEFAULT_PACK.code) {
    pack = structuredClone(DEFAULT_PACK);
  } else {
    try {
      pack = decodePack(codeStr);
    } catch (e) {
      input.classList.add('invalid');
      showToast(e.message);
      return;
    }
  }

  const packs = getPacks();
  const isDuplicate = packs.some(p => p.code === codeStr);
  const allowDup = document.getElementById('allow-dup-checkbox').checked;

  if (isDuplicate && !allowDup) {
    input.classList.add('invalid');
    showToast('이미 추가된 팩입니다.');
    return;
  }

  if (isDuplicate && allowDup) {
    resolveCodeConflict(pack, packs);
  }

  packs.push(pack);
  savePacks(packs);
  renderList();
  hideImportDialog();
  showToast(`'${pack.name}'을(를) 불러왔습니다.`);
}

function showConfirm(onConfirm) {
  pendingDelete = onConfirm;
  document.getElementById('confirm-overlay').classList.add('visible');
}

function hideConfirm() {
  pendingDelete = null;
  document.getElementById('confirm-overlay').classList.remove('visible');
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
  ctx.fillStyle = '#222';
  ctx.fillRect(0, 0, W, H);

  if (!mino) return;

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

function createCard(pack, isActive) {
  const card = document.createElement('div');
  card.className = 'card' + (isActive ? ' active' : '');

  const maxSize = pack.minos.length > 0
    ? Math.max(...pack.minos.map(m => m.shape.length))
    : 0;
  const sizeLabel = maxSize > 0 ? `${maxSize}×${maxSize}` : '없음';

  card.innerHTML = `
    <div class="card-header">
      <div class="card-header-left">
        <span class="status-badge">사용중</span>
        <span class="card-name">${pack.name}</span>
      </div>
      <div class="card-actions">
        <img class="action-icon" src="img/copy.png"   alt="copy"   title="복사">
        <img class="action-icon" src="img/pencil.png" alt="edit"   title="편집">
        <img class="action-icon" src="img/delete.png" alt="delete" title="삭제">
      </div>
    </div>
    <div class="card-body">
      <div class="card-thumbnail">
        <canvas width="134" height="134"></canvas>
      </div>
      <div class="card-info">
        <div class="info-row"><span class="info-label">사이즈:</span> ${sizeLabel}</div>
        <div class="info-row"><span class="info-label">미노 개수:</span> ${pack.minoCount}개</div>
        <div class="info-row"><span class="info-label">고유 코드:</span> ${pack.code.length > 10 ? pack.code.slice(0, 10) + '...' : pack.code}</div>
      </div>
    </div>
  `;

  const thumbnailMino = pack.minos[pack.thumbnail ?? 0];
  renderThumbnail(card.querySelector('canvas'), thumbnailMino);

  return card;
}

function renderList() {
  const packs = getPacks();
  const activeIdx = getActiveIndex();
  const list = document.getElementById('pack-list');
  list.innerHTML = '';

  packs.forEach((pack, i) => {
    const card = createCard(pack, i === activeIdx);
    list.appendChild(card);

    card.querySelector('.action-icon[title="복사"]').addEventListener('click', () => {
      navigator.clipboard.writeText(pack.code).then(() => {
        showToast(`${pack.name}팩의 코드를 복사했습니다.`);
      });
    });

    card.querySelector('.action-icon[title="편집"]').addEventListener('click', () => {
      sessionStorage.setItem('midrop_editing_pack', pack.code);
      location.href = 'pack.html';
    });

    card.querySelector('.action-icon[title="삭제"]').addEventListener('click', () => {
      showConfirm(() => {
        const packs = getPacks();
        const idx = packs.findIndex(p => p.code === pack.code);
        if (idx === -1) return;
        packs.splice(idx, 1);
        if (getActiveIndex() >= packs.length) setActivePack(0);
        savePacks(packs);
        renderList();
      });
    });
  });

  const cards = list.querySelectorAll('.card');
  cards.forEach((card, idx) => {
    card.addEventListener('click', () => {
      cards.forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      setActivePack(idx);
    });
    card.querySelector('.card-actions').addEventListener('click', e => e.stopPropagation());
  });
}

function init() {
  document.getElementById('btn-cancel').addEventListener('click', hideConfirm);
  document.getElementById('btn-delete').addEventListener('click', () => {
    const cb = pendingDelete;
    hideConfirm();
    if (cb) cb();
    showToast('미노 팩을 삭제했습니다.');
  });
  document.getElementById('confirm-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) hideConfirm();
  });

  renderList();

  document.getElementById('import-btn').addEventListener('click', showImportDialog);
  document.getElementById('btn-import-cancel').addEventListener('click', hideImportDialog);
  document.getElementById('btn-import-confirm').addEventListener('click', importPack);
  document.getElementById('import-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) hideImportDialog();
  });
  const importInput = document.getElementById('import-input');
  importInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') importPack();
    if (e.key === 'Escape') hideImportDialog();
  });
  importInput.addEventListener('input', () => importInput.classList.remove('invalid'));

  document.getElementById('new-pack-btn').addEventListener('click', () => {
    const newPack = {
      formatVersion: 1,
      name: '새 미노 팩',
      thumbnail: 0,
      size: 0,
      minoCount: 0,
      minos: []
    };
    newPack.code = encodePack(newPack);
    const packs = getPacks();
    resolveCodeConflict(newPack, packs);
    packs.push(newPack);
    savePacks(packs);
    renderList();
    showToast('새 미노 팩을 추가했습니다.');
  });
}

init();

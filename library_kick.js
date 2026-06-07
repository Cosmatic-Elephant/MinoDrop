import { getKickSets, getActiveKickIndex, setActiveKickSet, saveKickSets, encodeKick, decodeKick } from './src/data/kickStore.js';
import { DEFAULT_KICK } from './src/data/defaultKick.js';

let pendingDelete = null;

function resolveCodeConflict(kickSet, sets) {
  if (!sets.some(s => s.code === kickSet.code)) return;
  const baseName = kickSet.name;
  let n = 1;
  do {
    kickSet.name = `${baseName}(${n++})`;
    kickSet.code = encodeKick(kickSet);
  } while (sets.some(s => s.code === kickSet.code));
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

function importKick() {
  const input = document.getElementById('import-input');
  const codeStr = input.value.trim();
  if (!codeStr) {
    input.classList.add('invalid');
    return;
  }

  let kickSet;
  if (codeStr === DEFAULT_KICK.code) {
    kickSet = structuredClone(DEFAULT_KICK);
  } else {
    try {
      kickSet = decodeKick(codeStr);
    } catch (e) {
      input.classList.add('invalid');
      showToast(e.message);
      return;
    }
  }

  const sets = getKickSets();
  const isDuplicate = sets.some(s => s.code === codeStr);
  const allowDup = document.getElementById('allow-dup-checkbox').checked;

  if (isDuplicate && !allowDup) {
    input.classList.add('invalid');
    showToast('이미 추가된 킥 테이블입니다.');
    return;
  }

  if (isDuplicate && allowDup) {
    resolveCodeConflict(kickSet, sets);
  }

  sets.push(kickSet);
  saveKickSets(sets);
  renderList();
  hideImportDialog();
  showToast(`'${kickSet.name}'을(를) 불러왔습니다.`);
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

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderList() {
  const sets = getKickSets();
  const activeIdx = getActiveKickIndex();
  const kickList = document.getElementById('kick-list');
  kickList.innerHTML = '';

  sets.forEach((set, i) => {
    const card = document.createElement('div');
    card.className = 'card' + (i === activeIdx ? ' active' : '');
    const code = set.code ?? '-';
    const codeDisplay = code.length > 10 ? code.slice(0, 10) + '...' : code;

    card.innerHTML = `
      <div class="card-header">
        <div class="card-header-left">
          <span class="status-badge">사용중</span>
          <span class="card-name">${escapeHtml(set.name)}</span>
        </div>
        <div class="card-actions">
          <img class="action-icon" src="img/copy.png"   alt="copy"   title="복사">
          <img class="action-icon" src="img/pencil.png" alt="edit"   title="편집">
          <img class="action-icon" src="img/delete.png" alt="delete" title="삭제">
        </div>
      </div>
      <div class="card-body">
        <div class="card-info">
          <div class="info-row"><span class="info-label">고유 코드:</span> ${escapeHtml(codeDisplay)}</div>
        </div>
      </div>
    `;

    card.addEventListener('click', e => {
      if (e.target.closest('.card-actions')) return;
      setActiveKickSet(i);
      renderList();
    });

    card.querySelector('[title="복사"]').addEventListener('click', e => {
      e.stopPropagation();
      const currentCode = getKickSets()[i].code;
      if (currentCode && currentCode !== '-') {
        navigator.clipboard.writeText(currentCode).then(() => {
          showToast(`${set.name}의 코드를 복사했습니다.`);
        });
      } else {
        showToast('복사할 코드가 없습니다.');
      }
    });

    card.querySelector('[title="편집"]').addEventListener('click', e => {
      e.stopPropagation();
      sessionStorage.setItem('midrop_editing_kick_idx', String(i));
      location.href = 'customize_kick.html';
    });

    card.querySelector('[title="삭제"]').addEventListener('click', e => {
      e.stopPropagation();
      if (getKickSets().length <= 1) {
        showToast('마지막 킥 테이블은 삭제할 수 없습니다.');
        return;
      }
      showConfirm(() => {
        const sets = getKickSets();
        const ai = getActiveKickIndex();
        sets.splice(i, 1);
        if (ai >= sets.length) setActiveKickSet(sets.length - 1);
        else if (ai > i) setActiveKickSet(ai - 1);
        saveKickSets(sets);
        renderList();
        showToast('킥 테이블을 삭제했습니다.');
      });
    });

    kickList.appendChild(card);
  });
}

function init() {
  document.getElementById('btn-cancel').addEventListener('click', hideConfirm);
  document.getElementById('btn-delete').addEventListener('click', () => {
    const cb = pendingDelete;
    hideConfirm();
    if (cb) cb();
  });
  document.getElementById('confirm-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) hideConfirm();
  });

  document.getElementById('import-btn').addEventListener('click', showImportDialog);
  document.getElementById('btn-import-cancel').addEventListener('click', hideImportDialog);
  document.getElementById('btn-import-confirm').addEventListener('click', importKick);
  document.getElementById('import-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) hideImportDialog();
  });
  const importInput = document.getElementById('import-input');
  importInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') importKick();
    if (e.key === 'Escape') hideImportDialog();
  });
  importInput.addEventListener('input', () => importInput.classList.remove('invalid'));

  document.getElementById('new-kick-btn').addEventListener('click', () => {
    const sets = getKickSets();
    const newSet = {
      formatVersion: 1,
      name: `킥 테이블 ${sets.length + 1}`,
      tables: [{ name: '테이블 1', offsets: {} }],
      minoMappings: []
    };
    newSet.code = encodeKick(newSet);
    sets.push(newSet);
    saveKickSets(sets);
    renderList();
    showToast('새 킥 테이블을 추가했습니다.');
  });

  renderList();
}

init();

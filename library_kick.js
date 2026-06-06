import { getKickSets, getActiveKickIndex, setActiveKickSet, saveKickSets } from './src/data/kickStore.js';

const kickList = document.getElementById('kick-list');

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderList() {
  const sets      = getKickSets();
  const activeIdx = getActiveKickIndex();
  kickList.innerHTML = '';

  sets.forEach((set, i) => {
    const card = document.createElement('div');
    card.className = 'card' + (i === activeIdx ? ' active' : '');
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
          <span class="info-row"><span class="info-label">고유 코드: </span>-</span>
        </div>
      </div>
    `;

    card.addEventListener('click', e => {
      if (e.target.closest('.action-icon')) return;
      setActiveKickSet(i);
      renderList();
    });

    card.querySelector('[title="복사"]').addEventListener('click', e => {
      e.stopPropagation();
      const sets = getKickSets();
      const copy = JSON.parse(JSON.stringify(sets[i]));
      copy.name += ' 복사본';
      sets.splice(i + 1, 0, copy);
      saveKickSets(sets);
      renderList();
    });

    card.querySelector('[title="편집"]').addEventListener('click', e => {
      e.stopPropagation();
      sessionStorage.setItem('midrop_editing_kick_idx', String(i));
      location.href = 'customize_kick.html';
    });

    card.querySelector('[title="삭제"]').addEventListener('click', e => {
      e.stopPropagation();
      const sets = getKickSets();
      if (sets.length <= 1) return;
      sets.splice(i, 1);
      const ai = getActiveKickIndex();
      if (ai >= sets.length) setActiveKickSet(sets.length - 1);
      else if (ai > i)       setActiveKickSet(ai - 1);
      saveKickSets(sets);
      renderList();
    });

    kickList.appendChild(card);
  });
}

document.getElementById('new-kick-btn').addEventListener('click', () => {
  const sets = getKickSets();
  const newSet = {
    formatVersion: 1,
    name: `킥 테이블 ${sets.length + 1}`,
    tables: [{ name: '테이블 1', offsets: {} }],
    minoMappings: []
  };
  sets.push(newSet);
  saveKickSets(sets);
  renderList();
});

document.getElementById('import-btn').addEventListener('click', () => {
  // TODO: 불러오기
});

renderList();

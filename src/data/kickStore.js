import { DEFAULT_KICK } from './defaultKick.js';

const KICKS_KEY  = 'midrop_kicks';
const ACTIVE_KEY = 'midrop_active_kick';

const _stored = localStorage.getItem(KICKS_KEY);
if (!_stored || JSON.parse(_stored).length === 0) {
  localStorage.setItem(KICKS_KEY, JSON.stringify([DEFAULT_KICK]));
  localStorage.setItem(ACTIVE_KEY, '0');
}

export function getKickSets() {
  return JSON.parse(localStorage.getItem(KICKS_KEY));
}

export function getActiveKickSet() {
  const sets = getKickSets();
  const idx = parseInt(localStorage.getItem(ACTIVE_KEY) ?? '0', 10);
  return sets[idx] ?? sets[0];
}

export function getActiveKickIndex() {
  return parseInt(localStorage.getItem(ACTIVE_KEY) ?? '0', 10);
}

export function setActiveKickSet(index) {
  localStorage.setItem(ACTIVE_KEY, String(index));
}

export function saveKickSets(sets) {
  localStorage.setItem(KICKS_KEY, JSON.stringify(sets));
}

export function encodeKick(kickSet) {
  const tables = kickSet.tables.map(t => {
    const safeName = t.name.replace(/[~|@]/g, '_');
    const transitions = Object.entries(t.offsets).map(([key, pairs]) => {
      const compactKey = key.replace('->', '');
      const pairsStr = pairs.map(([x, y]) => `${x},${y}`).join(';');
      return `${compactKey}:${pairsStr}`;
    }).join('@');
    return transitions ? `${safeName}@${transitions}` : safeName;
  }).join('|');

  const mappings = kickSet.minoMappings.map(m => {
    const idx = kickSet.tables.findIndex(t => t.name === m.tableName);
    const safeMino = m.minoName.replace(/[~|,:]/g, '_');
    return `${safeMino}:${idx === -1 ? '-' : idx}`;
  }).join(',');

  const safeName = kickSet.name.replace(/~/g, '_');
  return `v2k~${safeName}~${tables}~${mappings}`;
}

export function decodeKick(code) {
  if (!code.startsWith('v2k~')) throw new Error('유효하지 않은 코드 형식입니다.');

  const afterPrefix = code.slice(4);
  const tilde1 = afterPrefix.indexOf('~');
  if (tilde1 === -1) throw new Error('코드 구조가 올바르지 않습니다.');
  const tilde2 = afterPrefix.indexOf('~', tilde1 + 1);
  if (tilde2 === -1) throw new Error('코드 구조가 올바르지 않습니다.');

  const name = afterPrefix.slice(0, tilde1);
  const tablesStr = afterPrefix.slice(tilde1 + 1, tilde2);
  const mappingsStr = afterPrefix.slice(tilde2 + 1);
  if (!name) throw new Error('코드 구조가 올바르지 않습니다.');

  const tables = tablesStr ? tablesStr.split('|').map(s => {
    const atIdx = s.indexOf('@');
    const tableName = atIdx === -1 ? s : s.slice(0, atIdx);
    const transitionsStr = atIdx === -1 ? '' : s.slice(atIdx + 1);
    const offsets = {};
    if (transitionsStr) {
      transitionsStr.split('@').forEach(t => {
        const colonIdx = t.indexOf(':');
        if (colonIdx === -1) return;
        const compactKey = t.slice(0, colonIdx);
        const fullKey = `${compactKey[0]}->${compactKey[1]}`;
        offsets[fullKey] = t.slice(colonIdx + 1).split(';').map(p => {
          const [x, y] = p.split(',').map(Number);
          return [x, y];
        });
      });
    }
    return { name: tableName, offsets };
  }) : [];

  const minoMappings = mappingsStr ? mappingsStr.split(',').map(s => {
    const colonIdx = s.indexOf(':');
    if (colonIdx === -1) throw new Error('코드 구조가 올바르지 않습니다.');
    const minoName = s.slice(0, colonIdx);
    const idxStr = s.slice(colonIdx + 1);
    const tableName = idxStr === '-' ? '없음' : (tables[parseInt(idxStr, 10)]?.name ?? '없음');
    return { minoName, tableName };
  }) : [];

  return { formatVersion: 2, name, tables, minoMappings, code };
}

// '없음' 선택 또는 매핑 없음 → [[0,0]] (회전은 가능, 킥 없음)
export function resolveKicks(minoName, fromState, toState) {
  const set = getActiveKickSet();
  const mapping = set.minoMappings.find(m => m.minoName === minoName);
  if (!mapping || mapping.tableName === '없음') return [[0, 0]];
  const table = set.tables.find(t => t.name === mapping.tableName);
  if (!table) return [[0, 0]];
  return table.offsets[`${fromState}->${toState}`] ?? [[0, 0]];
}

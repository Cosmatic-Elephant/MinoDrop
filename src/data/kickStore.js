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

// '없음' 선택 또는 매핑 없음 → [[0,0]] (회전은 가능, 킥 없음)
export function resolveKicks(minoName, fromState, toState) {
  const set = getActiveKickSet();
  const mapping = set.minoMappings.find(m => m.minoName === minoName);
  if (!mapping || mapping.tableName === '없음') return [[0, 0]];
  const table = set.tables.find(t => t.name === mapping.tableName);
  if (!table) return [[0, 0]];
  return table.offsets[`${fromState}->${toState}`] ?? [[0, 0]];
}

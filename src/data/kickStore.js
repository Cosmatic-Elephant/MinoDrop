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
  const payload = {
    formatVersion: kickSet.formatVersion,
    name: kickSet.name,
    tables: kickSet.tables,
    minoMappings: kickSet.minoMappings
  };
  const json = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(json);
  const binary = Array.from(bytes, b => String.fromCharCode(b)).join('');
  const b64 = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  return `v${payload.formatVersion}_${b64}`;
}

export function decodeKick(code) {
  const match = code.match(/^v(\d+)_([A-Za-z0-9\-_]+)$/);
  if (!match) throw new Error('유효하지 않은 코드 형식입니다.');

  const version = parseInt(match[1], 10);
  if (version !== 1) throw new Error(`지원하지 않는 버전입니다: v${version}`);

  let json;
  try {
    const b64 = match[2].replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(b64);
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
    json = new TextDecoder().decode(bytes);
  } catch {
    throw new Error('코드 디코딩에 실패했습니다.');
  }

  let payload;
  try {
    payload = JSON.parse(json);
  } catch {
    throw new Error('코드 파싱에 실패했습니다.');
  }

  const { formatVersion, name, tables, minoMappings } = payload;
  if (typeof formatVersion !== 'number' || typeof name !== 'string' || !Array.isArray(tables) || !Array.isArray(minoMappings)) {
    throw new Error('코드 구조가 올바르지 않습니다.');
  }

  return { formatVersion, name, code, tables, minoMappings };
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

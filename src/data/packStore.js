import { DEFAULT_PACK } from './defaultPack.js';

const PACKS_KEY = 'midrop_packs';
const ACTIVE_KEY = 'midrop_active_pack';

const _stored = localStorage.getItem(PACKS_KEY);
if (!_stored || JSON.parse(_stored).length === 0) {
  localStorage.setItem(PACKS_KEY, JSON.stringify([DEFAULT_PACK]));
  localStorage.setItem(ACTIVE_KEY, '0');
}

export function getPacks() {
  return JSON.parse(localStorage.getItem(PACKS_KEY));
}

export function getActivePack() {
  const packs = getPacks();
  const idx = parseInt(localStorage.getItem(ACTIVE_KEY) ?? '0', 10);
  return packs[idx] ?? packs[0];
}

export function getActiveIndex() {
  return parseInt(localStorage.getItem(ACTIVE_KEY) ?? '0', 10);
}

export function setActivePack(index) {
  localStorage.setItem(ACTIVE_KEY, String(index));
}

export function savePacks(packs) {
  localStorage.setItem(PACKS_KEY, JSON.stringify(packs));
}

export function encodePack(pack) {
  const minos = pack.minos.map(m => {
    const cols = m.shape[0]?.length ?? 0;
    const rowHex = m.shape.map(row =>
      row.reduce((acc, v, i) => acc | (v << (cols - 1 - i)), 0).toString(16)
    ).join('.');
    const safeName = m.name.replace(/[~|,]/g, '_');
    return `${safeName},${m.color},${m.shape.length}x${cols},${rowHex}`;
  }).join('|');
  const safeName = pack.name.replace(/~/g, '_');
  return `v2p~${safeName}~${minos}`;
}

export function decodePack(code) {
  if (!code.startsWith('v2p~')) throw new Error('유효하지 않은 코드 형식입니다.');

  const afterPrefix = code.slice(4);
  const tildeIdx = afterPrefix.indexOf('~');
  if (tildeIdx === -1) throw new Error('코드 구조가 올바르지 않습니다.');

  const name = afterPrefix.slice(0, tildeIdx);
  const minosStr = afterPrefix.slice(tildeIdx + 1);
  if (!name) throw new Error('코드 구조가 올바르지 않습니다.');

  const minos = minosStr ? minosStr.split('|').map(s => {
    const first = s.indexOf(',');
    const second = s.indexOf(',', first + 1);
    const third = s.indexOf(',', second + 1);
    if (first === -1 || second === -1 || third === -1) throw new Error('코드 구조가 올바르지 않습니다.');

    const minoName = s.slice(0, first);
    const color = s.slice(first + 1, second);
    const dims = s.slice(second + 1, third);
    const rowsStr = s.slice(third + 1);

    const xIdx = dims.indexOf('x');
    if (xIdx === -1) throw new Error('코드 구조가 올바르지 않습니다.');
    const rows = parseInt(dims.slice(0, xIdx), 10);
    const cols = parseInt(dims.slice(xIdx + 1), 10);

    const shape = rows === 0 ? [] : rowsStr.split('.').map(hex => {
      const n = parseInt(hex, 16);
      return Array.from({ length: cols }, (_, i) => (n >> (cols - 1 - i)) & 1);
    });
    return { name: minoName, color, shape };
  }) : [];

  return {
    formatVersion: 2,
    name,
    code,
    thumbnail: 0,
    size: minos.length > 0 ? Math.max(...minos.map(m => m.shape.length)) : 0,
    minoCount: minos.length,
    minos
  };
}

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
  const payload = {
    formatVersion: pack.formatVersion,
    name: pack.name,
    minos: pack.minos.map(({ name, color, shape }) => ({ name, color, shape }))
  };
  const json = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(json);
  const binary = Array.from(bytes, b => String.fromCharCode(b)).join('');
  const b64 = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  return `v${payload.formatVersion}_${b64}`;
}

export function decodePack(code) {
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

  const { formatVersion, name, minos } = payload;
  if (typeof formatVersion !== 'number' || typeof name !== 'string' || !Array.isArray(minos)) {
    throw new Error('코드 구조가 올바르지 않습니다.');
  }

  return {
    formatVersion,
    name,
    code,
    thumbnail: 0,
    size: Math.max(...minos.map(m => m.shape.length)),
    minoCount: minos.length,
    minos
  };
}

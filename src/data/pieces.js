import { getActivePack } from './packStore.js';

function buildFromPack(pack) {
  return {
    SHAPES: Object.fromEntries(pack.minos.map(m => [m.name, m.shape])),
    COLORS: Object.fromEntries(pack.minos.map(m => [m.name, '#' + m.color])),
    TYPES:  pack.minos.map(m => m.name),
  };
}

let data = buildFromPack(getActivePack());

export let SHAPES = data.SHAPES;
export let COLORS = data.COLORS;
export let TYPES  = data.TYPES;

export function refreshPack() {
  const d = buildFromPack(getActivePack());
  SHAPES = d.SHAPES;
  COLORS = d.COLORS;
  TYPES  = d.TYPES;
}

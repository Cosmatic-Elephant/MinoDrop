import { getActivePack } from './packStore.js';

const pack = getActivePack();

export const SHAPES = Object.fromEntries(
  pack.minos.map(m => [m.name, m.shape])
);

export const COLORS = Object.fromEntries(
  pack.minos.map(m => [m.name, '#' + m.color])
);

export const TYPES = pack.minos.map(m => m.name);

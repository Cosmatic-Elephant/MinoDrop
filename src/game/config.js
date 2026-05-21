function clampDim(val, min, max, fallback) {
  const n = Number(val);
  return Number.isInteger(n) && n >= min && n <= max ? n : fallback;
}

export const GAME_FIELD = { COLS: 10, ROWS: 20 };

export function setGameField(cols, rows) {
  GAME_FIELD.COLS = clampDim(cols,  4, 100, 10);
  GAME_FIELD.ROWS = clampDim(rows, 10, 100, 20);
}

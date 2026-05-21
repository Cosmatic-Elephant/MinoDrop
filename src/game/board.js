import { GAME_FIELD } from './config.js';

export class Board {
  constructor() {
    this.grid = this._emptyGrid();
  }

  _emptyGrid() {
    return Array.from({ length: GAME_FIELD.ROWS }, () => Array(GAME_FIELD.COLS).fill(null));
  }

  isValid(piece) {
    for (let r = 0; r < piece.shape.length; r++) {
      for (let c = 0; c < piece.shape[r].length; c++) {
        if (!piece.shape[r][c]) continue;
        const x = piece.x + c;
        const y = piece.y + r;
        if (x < 0 || x >= GAME_FIELD.COLS || y >= GAME_FIELD.ROWS) return false;
        if (y >= 0 && this.grid[y][x] !== null) return false;
      }
    }
    return true;
  }

  lock(piece) {
    for (let r = 0; r < piece.shape.length; r++) {
      for (let c = 0; c < piece.shape[r].length; c++) {
        if (!piece.shape[r][c]) continue;
        const x = piece.x + c;
        const y = piece.y + r;
        if (y >= 0) this.grid[y][x] = piece.color;
      }
    }
  }

  findFullLines() {
    const rows = [];
    for (let r = 0; r < GAME_FIELD.ROWS; r++) {
      if (this.grid[r].every(cell => cell !== null)) rows.push(r);
    }
    return rows;
  }

  removeLines(rows) {
    // Splice all full rows first (descending so indices stay valid),
    // then prepend empty rows — unshift inside the loop would shift indices mid-iteration.
    const sorted = [...rows].sort((a, b) => b - a);
    for (const r of sorted) this.grid.splice(r, 1);
    for (let i = 0; i < rows.length; i++) this.grid.unshift(Array(GAME_FIELD.COLS).fill(null));
  }

  clearLines() {
    const rows = this.findFullLines();
    this.removeLines(rows);
    return rows.length;
  }

  isEmpty() {
    return this.grid.every(row => row.every(cell => cell === null));
  }

  reset() {
    this.grid = this._emptyGrid();
  }
}

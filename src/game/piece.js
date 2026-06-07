import { SHAPES, COLORS, TYPES } from '../data/pieces.js';
import { resolveKicks } from '../data/kickStore.js';
import { GAME_FIELD } from './config.js';

export class Piece {
  constructor(type) {
    this.type = type;
    this.shape = SHAPES[type].map(row => [...row]);
    this.color = COLORS[type];
    this.x = Math.floor((GAME_FIELD.COLS - this.shape[0].length) / 2);
    this.y = 0;
    this.rotState = 0; // 0=spawn, 1=CW, 2=180, 3=CCW
  }

  static random() {
    return new Piece(TYPES[Math.floor(Math.random() * TYPES.length)]);
  }

  // Returns one shuffled bag: all 7 types in random order as Piece instances.
  static bag(rand = Math.random) {
    const types = [...TYPES];
    for (let i = types.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [types[i], types[j]] = [types[j], types[i]];
    }
    return types.map(t => new Piece(t));
  }

  rotate() {
    const n = this.shape.length;
    const next = Array.from({ length: n }, () => Array(n).fill(0));
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n; c++)
        next[c][n - 1 - r] = this.shape[r][c];
    this.shape = next;
    this.rotState = (this.rotState + 1) % 4;
  }

  rotateLeft() {
    const n = this.shape.length;
    const next = Array.from({ length: n }, () => Array(n).fill(0));
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n; c++)
        next[n - 1 - c][r] = this.shape[r][c];
    this.shape = next;
    this.rotState = (this.rotState + 3) % 4;
  }

  rotate180() {
    const n = this.shape.length;
    const next = Array.from({ length: n }, () => Array(n).fill(0));
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n; c++)
        next[n - 1 - r][n - 1 - c] = this.shape[r][c];
    this.shape = next;
    this.rotState = (this.rotState + 2) % 4;
  }

  getKicks(fromState, toState) {
    return resolveKicks(this.type, fromState, toState);
  }

  clone() {
    const p = new Piece(this.type);
    p.shape = this.shape.map(row => [...row]);
    p.x = this.x;
    p.y = this.y;
    p.rotState = this.rotState;
    return p;
  }
}

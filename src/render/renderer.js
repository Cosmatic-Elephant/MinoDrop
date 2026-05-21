import { GAME_FIELD } from '../game/config.js';

const BASE_CELL = 30;

function calcCellSize(n) {
  if (n <= 25) return BASE_CELL;
  const t = (n - 25) / 75;
  const e = 1 - Math.pow(1 - t, 3);
  return Math.max(8, Math.round(BASE_CELL + e * (8 - BASE_CELL)));
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ghostWhite = false;
    this.ghostStyle = 'outline'; // 'outline' | 'translucent' | 'opaque' | 'none'
    this.gameCell = BASE_CELL;
    this.resize();
  }

  resize() {
    this.gameCell = Math.min(calcCellSize(GAME_FIELD.COLS), calcCellSize(GAME_FIELD.ROWS));
    this.canvas.width  = GAME_FIELD.COLS * this.gameCell;
    this.canvas.height = GAME_FIELD.ROWS * this.gameCell;
  }

  // flashRows: row indices currently being cleared
  // clearElapsed: ms elapsed since the clear animation started
  render(board, piece, _gameOver, flashRows = [], clearElapsed = 0, pcTimer = 0, spawnCells = []) {
    const { ctx } = this;
    const gc = this.gameCell;
    const W = this.canvas.width;
    const H = this.canvas.height;

    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = '#1c1c1c';
    ctx.lineWidth = 1;
    for (let r = 0; r < GAME_FIELD.ROWS; r++) {
      for (let c = 0; c < GAME_FIELD.COLS; c++) {
        ctx.strokeRect(c * gc, r * gc, gc, gc);
      }
    }

    for (let r = 0; r < GAME_FIELD.ROWS; r++) {
      for (let c = 0; c < GAME_FIELD.COLS; c++) {
        if (board.grid[r][c]) this._cell(c, r, board.grid[r][c]);
      }
    }

    // Ghost piece — only shown when a piece is active and no clear animation is running
    if (piece && flashRows.length === 0 && this.ghostStyle !== 'none') {
      const ghost = piece.clone();
      while (true) {
        ghost.y++;
        if (!board.isValid(ghost)) { ghost.y--; break; }
      }
      if (ghost.y > piece.y) {
        if (this.ghostStyle === 'outline') {
          const ghostColor = this.ghostWhite ? '#ffffff' : piece.color;
          for (let r = 0; r < ghost.shape.length; r++) {
            for (let c = 0; c < ghost.shape[r].length; c++) {
              if (ghost.shape[r][c]) this._ghostCell(ghost.x + c, ghost.y + r, ghostColor);
            }
          }
        } else {
          ctx.globalAlpha = this.ghostStyle === 'translucent' ? 0.25 : 0.65;
          const ghostColor = this.ghostWhite ? '#ffffff' : piece.color;
          for (let r = 0; r < ghost.shape.length; r++) {
            for (let c = 0; c < ghost.shape[r].length; c++) {
              if (ghost.shape[r][c]) this._cell(ghost.x + c, ghost.y + r, ghostColor);
            }
          }
          ctx.globalAlpha = 1;
        }
      }
    }

    // Active piece
    if (piece) {
      for (let r = 0; r < piece.shape.length; r++) {
        for (let c = 0; c < piece.shape[r].length; c++) {
          if (piece.shape[r][c]) this._cell(piece.x + c, piece.y + r, piece.color);
        }
      }
    }

    // Line-clear flash: blink full rows every 125 ms
    if (flashRows.length > 0) {
      const on = Math.floor(clearElapsed / 125) % 2 === 0;
      if (on) {
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        for (const r of flashRows) {
          ctx.fillRect(0, r * gc, W, gc);
        }
      }
    }

    // Perfect Clear message
    if (pcTimer > 0) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(0, H / 2 - gc * 1.1, W, gc * 2.2);
      ctx.fillStyle = '#ffe066';
      ctx.font = `bold ${gc}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('PERFECT CLEAR!', W / 2, H / 2);
    }

    // Spawn preview markers — rendered on top of everything
    if (spawnCells.length > 0) {
      ctx.fillStyle = '#ff0000';
      ctx.font = `bold ${gc}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const [col, row] of spawnCells) {
        ctx.fillText('×', col * gc + gc / 2, row * gc + gc / 2);
      }
    }
  }

  _cell(col, row, color) {
    this._cellPx(this.ctx, col * this.gameCell, row * this.gameCell, color, this.gameCell);
  }

  _cellPx(ctx, px, py, color, cellSize = this.gameCell) {
    const x = px + 1;
    const y = py + 1;
    const s = cellSize - 2;
    const hi = Math.max(3, Math.round(cellSize * 0.13)); // highlight thickness (~4px at 30)
    const sh = Math.max(2, Math.round(cellSize * 0.10)); // shadow thickness (~3px at 30)
    ctx.fillStyle = color;
    ctx.fillRect(x, y, s, s);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(x, y, s, hi);
    ctx.fillRect(x, y, hi, s);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(x, y + s - sh, s, sh);
    ctx.fillRect(x + s - sh, y, sh, s);
  }

  renderB2bStatus(b2b, timestamp) {
    if (!b2b) return;
    const { ctx } = this;
    const W = this.canvas.width;
    const H = this.canvas.height;
    const phase = Math.floor(timestamp / 500) % 2;
    ctx.strokeStyle = phase === 0 ? '#ffb3ba' : '#fff3b0'; // pastel red / pastel yellow
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, W - 4, H - 4);
  }

  _ghostCell(col, row, color) {
    const { ctx } = this;
    const gc = this.gameCell;
    const x = col * gc + 2;
    const y = row * gc + 2;
    const s = gc - 4;
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.53;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, s, s);
    ctx.globalAlpha = 1;
  }

  // Returns a copy of `shape` with leading/trailing empty rows and columns removed.
  _trimShape(shape) {
    let minR = shape.length, maxR = -1, minC = shape[0].length, maxC = -1;
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (shape[r][c]) {
          minR = Math.min(minR, r); maxR = Math.max(maxR, r);
          minC = Math.min(minC, c); maxC = Math.max(maxC, c);
        }
      }
    }
    if (maxR < 0) return [];
    return shape.slice(minR, maxR + 1).map(row => row.slice(minC, maxC + 1));
  }

  renderNext(canvas, nextQueue, count = 5) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const LABEL_H = BASE_CELL;
    const SLOT_H = 3 * BASE_CELL + 10; // 100px — 4×3 cell space per slot
    const neededH = LABEL_H + Math.max(1, count) * SLOT_H;
    if (canvas.height !== neededH) canvas.height = neededH;
    const H = canvas.height;

    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, W - 1, H - 1);

    ctx.fillStyle = '#666';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('NEXT', W / 2, LABEL_H / 2);

    if (count === 0) {
      ctx.fillStyle = '#555';
      ctx.font = 'bold 14px monospace';
      ctx.fillText('BLIND', W / 2, LABEL_H + SLOT_H / 2);
      return;
    }

    const visible = nextQueue.slice(0, count);
    for (let i = 0; i < visible.length; i++) {
      const p = visible[i];
      const trimmed = this._trimShape(p.shape);
      if (!trimmed.length) continue;
      const tRows = trimmed.length;
      const tCols = trimmed[0].length;
      // Scale down to fit the fixed slot when the piece exceeds standard size
      const previewCell = Math.min(
        BASE_CELL,
        Math.floor(W / tCols),
        Math.floor(SLOT_H / tRows)
      );
      const slotY = LABEL_H + i * SLOT_H;
      const startX = Math.round((W - tCols * previewCell) / 2);
      const startY = slotY + Math.round((SLOT_H - tRows * previewCell) / 2);
      for (let r = 0; r < tRows; r++) {
        for (let c = 0; c < tCols; c++) {
          if (trimmed[r][c]) {
            this._cellPx(ctx, startX + c * previewCell, startY + r * previewCell, p.color, previewCell);
          }
        }
      }
    }
  }

  renderHold(canvas, holdPiece, canHold, holdEnabled = true) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width;   // 150
    const H = canvas.height;  // 120
    const LABEL_H = BASE_CELL; // label row height fixed at BASE_CELL

    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, W - 1, H - 1);

    ctx.fillStyle = '#666';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('HOLD', W / 2, LABEL_H / 2);

    if (!holdEnabled) {
      ctx.fillStyle = '#555';
      ctx.font = 'bold 14px monospace';
      ctx.fillText('BLOCKED', W / 2, LABEL_H + (H - LABEL_H) / 2);
      return;
    }

    if (!holdPiece) return;

    const trimmed = this._trimShape(holdPiece.shape);
    if (!trimmed.length) return;

    const tRows = trimmed.length;
    const tCols = trimmed[0].length;
    const availH = H - LABEL_H;
    // Scale down to fit the fixed hold area when the piece exceeds standard size
    const previewCell = Math.min(
      BASE_CELL,
      Math.floor(W / tCols),
      Math.floor(availH / tRows)
    );
    const startX = Math.round((W - tCols * previewCell) / 2);
    const startY = LABEL_H + Math.round((availH - tRows * previewCell) / 2);

    const holdColor = canHold ? holdPiece.color : '#999999';

    for (let r = 0; r < tRows; r++) {
      for (let c = 0; c < tCols; c++) {
        if (trimmed[r][c]) {
          this._cellPx(ctx, startX + c * previewCell, startY + r * previewCell, holdColor, previewCell);
        }
      }
    }
  }
}

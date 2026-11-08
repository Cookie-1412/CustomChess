import { Chess, type Square } from 'chess.js';

export type BombLevel = 1 | 2 | 3;

export const BOMB_LEVELS: Array<{ level: BombLevel; label: string; note: string }> = [
  { level: 1, label: 'Grenade', note: 'When captured, your queen explodes in a plus shape.' },
  { level: 2, label: 'Bomb', note: 'When captured, your queen explodes in a 3x3 area.' },
  { level: 3, label: 'Nuke', note: 'When captured, your queen explodes in a 5x5 area.' },
];

/** The squares a blast covers, centred on the capture and clipped to the board. */
export function blastSquares(center: Square, level: BombLevel): Square[] {
  const file = center.charCodeAt(0) - 97;
  const rank = Number(center[1]) - 1;
  const radius = level === 3 ? 2 : 1;
  const squares: Square[] = [];
  for (let df = -radius; df <= radius; df++) {
    for (let dr = -radius; dr <= radius; dr++) {
      const f = file + df;
      const r = rank + dr;
      if (f < 0 || f > 7 || r < 0 || r > 7) continue;
      if (level === 1 && df !== 0 && dr !== 0) continue;
      squares.push(`${'abcdefgh'[f]}${r + 1}` as Square);
    }
  }
  return squares;
}

export interface Blast {
  fen: string;
  squares: Square[];
  /** True if the side that just moved has its king open to capture, which ends the game. */
  kingExposed: boolean;
}

/**
 * Detonates at `center` in the position straight after the capture. Everything
 * in the area dies, including the capturing piece, except kings. It is then the
 * bomb owner's turn, so a blast that opens a line to the other king leaves it
 * capturable. That can't be played on as a legal position, so the caller ends
 * the game there.
 */
export function detonate(fen: string, center: Square, level: BombLevel): Blast {
  const chess = new Chess(fen);
  const squares = blastSquares(center, level);
  for (const square of squares) {
    const piece = chess.get(square);
    if (piece && piece.type !== 'k') chess.remove(square);
  }
  const [board, turn, castling, , , fullmove] = chess.fen().split(' ');
  const result = [board, turn, castling, '-', '0', fullmove].join(' ');
  const flipped = [board, turn === 'w' ? 'b' : 'w', castling, '-', '0', fullmove].join(' ');
  return { fen: result, squares, kingExposed: new Chess(flipped).inCheck() };
}

/** Move list text for a capture that set the queen off. */
export function blastSan(san: string, after: Chess): string {
  const suffix = after.isCheckmate() ? '#' : after.inCheck() ? '+' : '';
  return `${san.replace(/[+#]$/, '')} 💥${suffix}`;
}

import { Chess, type Square } from 'chess.js';

type Color = 'white' | 'black';

const ROOK_RAYS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const BISHOP_RAYS = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const KNIGHT_JUMPS = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];

export const ALL_SQUARES = Array.from({ length: 64 }, (_, i) => `${'abcdefgh'[i % 8]}${Math.floor(i / 8) + 1}` as Square);

const onBoard = (file: number, rank: number) => file >= 0 && file < 8 && rank >= 0 && rank < 8;
const name = (file: number, rank: number) => `${'abcdefgh'[file]}${rank + 1}` as Square;

/**
 * Squares the player can see: their own pieces, plus every square those pieces
 * could move to or attack. A pawn sees straight ahead only as far as it can
 * move, so whatever blocks it stays hidden, and it always sees its diagonals.
 * Pins are ignored, as a pinned piece still looks where it points. `scp` blocks
 * lines the same way a piece does. Takes a position without the hidden knight.
 */
export function visibleSquares(fen: string, playerColor: Color, scp: Square | null): Set<Square> {
  const chess = new Chess(fen);
  const side = playerColor[0];
  const visible = new Set<Square>();
  const blocked = (file: number, rank: number) => {
    const square = name(file, rank);
    return square === scp || !!chess.get(square);
  };

  for (const piece of chess.board().flat()) {
    if (!piece || piece.color !== side) continue;
    visible.add(piece.square);
    const file = piece.square.charCodeAt(0) - 97;
    const rank = Number(piece.square[1]) - 1;

    if (piece.type === 'p') {
      const forward = side === 'w' ? 1 : -1;
      const home = side === 'w' ? 1 : 6;
      for (const df of [-1, 1]) {
        if (onBoard(file + df, rank + forward)) visible.add(name(file + df, rank + forward));
      }
      if (!onBoard(file, rank + forward) || blocked(file, rank + forward)) continue;
      visible.add(name(file, rank + forward));
      if (rank === home && !blocked(file, rank + 2 * forward)) visible.add(name(file, rank + 2 * forward));
      continue;
    }

    if (piece.type === 'n' || piece.type === 'k') {
      const steps = piece.type === 'n' ? KNIGHT_JUMPS : [...ROOK_RAYS, ...BISHOP_RAYS];
      for (const [df, dr] of steps) {
        if (onBoard(file + df, rank + dr)) visible.add(name(file + df, rank + dr));
      }
      continue;
    }

    const rays = piece.type === 'r' ? ROOK_RAYS : piece.type === 'b' ? BISHOP_RAYS : [...ROOK_RAYS, ...BISHOP_RAYS];
    for (const [df, dr] of rays) {
      for (let f = file + df, r = rank + dr; onBoard(f, r); f += df, r += dr) {
        visible.add(name(f, r));
        if (blocked(f, r)) break;
      }
    }
  }
  return visible;
}

/** The position as the player may see it, with everything in the fog removed. */
export function fogFen(fen: string, visible: Set<Square>): string {
  const chess = new Chess(fen);
  for (const piece of chess.board().flat()) {
    if (piece && !visible.has(piece.square)) chess.remove(piece.square);
  }
  return chess.fen();
}

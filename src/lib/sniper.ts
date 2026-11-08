import { Chess, type Square } from 'chess.js';

export interface Shot {
  from: Square;
  to: Square;
}

const DIAGONALS = [[1, 1], [1, -1], [-1, 1], [-1, -1]];

const squareName = (file: number, rank: number) => (String.fromCharCode(97 + file) + (rank + 1)) as Square;

/** The position after `target` is shot: side to move flips, and it counts as a capture. */
export function fenAfterShot(fen: string, target: Square): string {
  const chess = new Chess(fen);
  chess.remove(target); // Also drops castling rights if a rook on its home square is hit.
  const [board, turn, castling, , , fullmove] = chess.fen().split(' ');
  const nextMove = turn === 'b' ? Number(fullmove) + 1 : Number(fullmove);
  return [board, turn === 'w' ? 'b' : 'w', castling, '-', '0', nextMove].join(' ');
}

/**
 * Every shot available to the side to move, at most one per target.
 * A bishop fires along clear diagonals, so it hits what it could capture. It
 * stays put, so pins do not matter, but a shot must leave its own king safe.
 */
export function findShots(fen: string): Shot[] {
  const chess = new Chess(fen);
  const side = chess.turn();
  const inCheck = chess.inCheck();
  const shots = new Map<Square, Shot>();

  for (const piece of chess.board().flat()) {
    if (!piece || piece.type !== 'b' || piece.color !== side) continue;
    const file = piece.square.charCodeAt(0) - 97;
    const rank = Number(piece.square[1]) - 1;

    for (const [df, dr] of DIAGONALS) {
      for (let f = file + df, r = rank + dr; f >= 0 && f < 8 && r >= 0 && r < 8; f += df, r += dr) {
        const square = squareName(f, r);
        const hit = chess.get(square);
        if (!hit) continue;
        if (hit.color !== side && hit.type !== 'k' && !shots.has(square)) {
          shots.set(square, { from: piece.square, to: square });
        }
        break;
      }
    }
  }

  const all = [...shots.values()];
  if (!inCheck) return all;
  return all.filter((shot) => {
    const test = new Chess(fen);
    test.remove(shot.to);
    return !test.inCheck();
  });
}

/** Move list text for a shot, with the usual check or mate suffix. */
export function shotLabel(shot: Shot, after: Chess): string {
  const suffix = after.isCheckmate() ? '#' : after.inCheck() ? '+' : '';
  return `B${shot.from}→${shot.to}${suffix}`;
}

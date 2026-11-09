import { Chess, type Square } from 'chess.js';
import { restoreEnPassant } from './fen';

type Color = 'white' | 'black';

const NEIGHBOURS = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];

function neighbours(square: Square): Square[] {
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]) - 1;
  return NEIGHBOURS.flatMap(([df, dr]) => {
    const f = file + df;
    const r = rank + dr;
    return f >= 0 && f < 8 && r >= 0 && r < 8 ? [`${'abcdefgh'[f]}${r + 1}` as Square] : [];
  });
}

/** All of `color`'s knights connected to `start` through the 8 surrounding squares. */
export function herd(chess: Chess, start: Square, color: Color): Square[] {
  const side = color[0];
  const isKnight = (square: Square) => {
    const piece = chess.get(square);
    return piece?.type === 'n' && piece.color === side;
  };
  if (!isKnight(start)) return [];
  const found = new Set<Square>([start]);
  const queue = [start];
  for (const square of queue) {
    for (const next of neighbours(square)) {
      if (!found.has(next) && isKnight(next)) {
        found.add(next);
        queue.push(next);
      }
    }
  }
  return [...found];
}

/**
 * Empty squares a foal could appear on after a knight moved to `moved`: next
 * to its herd, but only if the knight landed beside another of its knights.
 * A square is skipped if the foal would make a third check at once, which
 * Stockfish can't handle. Takes the position straight after the move.
 */
export function breedingSquares(fen: string, moved: Square, color: Color): Square[] {
  const chess = new Chess(fen);
  const group = herd(chess, moved, color);
  if (group.length < 2) return [];
  const side = color[0] as 'w' | 'b';
  const enemyKing = chess.board().flat().find((piece) => piece?.type === 'k' && piece.color !== side)!.square;

  const squares = [...new Set(group.flatMap(neighbours))].filter((square) => !chess.get(square));
  return squares.filter((square) => {
    chess.put({ type: 'n', color: side }, square);
    const checkers = chess.attackers(enemyKing, side).length;
    chess.remove(square);
    return checkers <= 2;
  });
}

/** The position with a new knight beside the herd, or null if the move didn't breed. */
export function breed(fen: string, moved: Square, color: Color, rng: () => number = Math.random): { fen: string; square: Square } | null {
  const squares = breedingSquares(fen, moved, color);
  if (squares.length === 0) return null;
  const square = squares[Math.floor(rng() * squares.length)];
  const chess = new Chess(fen);
  chess.put({ type: 'n', color: color[0] as 'w' | 'b' }, square);
  return { fen: restoreEnPassant(fen, chess.fen()), square };
}

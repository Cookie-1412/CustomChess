import { Chess, type Square } from 'chess.js';
import { restoreEnPassant } from './fen';

export interface Pull {
  from: Square;
  to: Square;
}

const ROOK_RAYS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const BISHOP_RAYS = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const KNIGHT_JUMPS = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];

const fileOf = (square: Square) => square.charCodeAt(0) - 97;
const rankOf = (square: Square) => Number(square[1]) - 1;
const onBoard = (file: number, rank: number) => file >= 0 && file < 8 && rank >= 0 && rank < 8;
const name = (file: number, rank: number) => `${'abcdefgh'[file]}${rank + 1}` as Square;

/** Enemy pieces a magnet would pull, and where each would land, before any are skipped. */
function candidates(chess: Chess, square: Square): Pull[] {
  const piece = chess.get(square);
  if (!piece || piece.type === 'p' || piece.type === 'k') return [];
  const file = fileOf(square);
  const rank = rankOf(square);
  const isEnemy = (target: Square) => {
    const hit = chess.get(target);
    return !!hit && hit.color !== piece.color && hit.type !== 'k';
  };

  if (piece.type === 'n') {
    return KNIGHT_JUMPS.flatMap(([df, dr]) => {
      if (!onBoard(file + df, rank + dr) || !isEnemy(name(file + df, rank + dr))) return [];
      // The diagonal neighbour on the target's side, as in the user's rule.
      return [{ from: name(file + df, rank + dr), to: name(file + Math.sign(df), rank + Math.sign(dr)) }];
    });
  }

  const rays = piece.type === 'r' ? ROOK_RAYS : piece.type === 'b' ? BISHOP_RAYS : [...ROOK_RAYS, ...BISHOP_RAYS];
  return rays.flatMap(([df, dr]) => {
    for (let f = file + df, r = rank + dr; onBoard(f, r); f += df, r += dr) {
      const target = name(f, r);
      if (!chess.get(target)) continue;
      const adjacent = f === file + df && r === rank + dr;
      return isEnemy(target) && !adjacent ? [{ from: target, to: name(file + df, rank + dr) }] : [];
    }
    return [];
  });
}

function shuffle<T>(list: T[], rng: () => number): T[] {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Pulls every enemy piece the piece on `square` attacks to the square beside
 * it, for the side to move. Sliders pull along their line; knights pull to
 * their diagonal neighbour on the target's side. Pulls are applied one at a
 * time, and one is skipped if its landing square is taken (so a second knight
 * target in the same quadrant stays put, in random order), if a pawn would land
 * on the first or last rank, if it would put the puller's own king in check,
 * or if it would leave the enemy king capturable on the puller's turn.
 * Returns null if nothing would move.
 */
export function magnetPull(fen: string, square: Square, rng: () => number = Math.random): { fen: string; pulls: Pull[] } | null {
  const chess = new Chess(fen);
  const piece = chess.get(square);
  if (!piece || piece.color !== chess.turn()) return null;
  const enemyKing = chess.board().flat().find((p) => p?.type === 'k' && p.color !== piece.color)!.square;

  const pulls: Pull[] = [];
  for (const pull of shuffle(candidates(chess, square), rng)) {
    const target = chess.get(pull.from)!;
    if (chess.get(pull.to)) continue;
    if (target.type === 'p' && (pull.to[1] === '1' || pull.to[1] === '8')) continue;
    const checkedBefore = chess.inCheck();
    chess.remove(pull.from);
    chess.put(target, pull.to);
    if ((chess.inCheck() && !checkedBefore) || chess.isAttacked(enemyKing, piece.color)) {
      chess.remove(pull.to);
      chess.put(target, pull.from);
      continue;
    }
    pulls.push(pull);
  }
  if (pulls.length === 0) return null;
  return { fen: restoreEnPassant(fen, chess.fen()), pulls };
}

/** For each of the side to move's pieces whose magnet would pull something, the pulls it would make. */
export function magnetPlan(fen: string): Record<string, Pull[]> {
  const plan: Record<string, Pull[]> = {};
  for (const square of magnetSources(fen)) plan[square] = magnetPull(fen, square, () => 0)!.pulls;
  return plan;
}

/** Squares of the side to move's pieces whose magnet would pull something right now. */
export function magnetSources(fen: string): Square[] {
  const chess = new Chess(fen);
  return chess
    .board()
    .flat()
    .filter((piece) => piece && piece.color === chess.turn() && piece.type !== 'p' && piece.type !== 'k')
    .filter((piece) => magnetPull(fen, piece!.square, () => 0) !== null)
    .map((piece) => piece!.square);
}

/** With no legal move, whether a pull would create one. */
export function magnetCanEscape(fen: string): boolean {
  return magnetSources(fen).some((square) => new Chess(magnetPull(fen, square, () => 0)!.fen).moves().length > 0);
}

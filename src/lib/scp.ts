import { Chess, type Square } from 'chess.js';
import { restoreEnPassant } from './fen';

/**
 * SCP-096 is neutral, blocks both sides and cannot be captured, which chess has
 * no piece for. While a game runs it is held on the board as a hidden knight of
 * the side to move: nobody can capture their own piece, and it blocks lines for
 * both sides. Its moves are filtered out by the caller. Saved positions and
 * anything sent to Stockfish use the "stripped" FEN, without the hidden knight.
 */

/** The two middle ranks of the board. */
const START_SQUARES = ['4', '5'].flatMap((rank) => [...'abcdefgh'].map((file) => `${file}${rank}` as Square));

export const randomScpStart = (rng: () => number = Math.random): Square => START_SQUARES[Math.floor(rng() * START_SQUARES.length)];

/** Removes the hidden knight. */
export function stripScp(fen: string, scp: Square): string {
  const chess = new Chess(fen);
  chess.remove(scp);
  return restoreEnPassant(fen, chess.fen());
}

/** Adds the hidden knight, coloured for the side to move. */
export function withScp(strippedFen: string, scp: Square): string {
  const chess = new Chess(strippedFen);
  chess.put({ type: 'n', color: chess.turn() }, scp);
  return restoreEnPassant(strippedFen, chess.fen());
}

/** Squares of every piece that could attack 096, from either side. */
export function findSeers(strippedFen: string, scp: Square): Square[] {
  const chess = new Chess(strippedFen);
  return [...chess.attackers(scp, 'w'), ...chess.attackers(scp, 'b')];
}

/** The position after 096 eats a non-king piece. Used after Black's move, so White is to move. */
export function afterStrike(strippedFen: string, target: Square): string {
  const chess = new Chess(strippedFen);
  chess.remove(target);
  const [board, turn, castling, enPassant, , fullmove] = restoreEnPassant(strippedFen, chess.fen()).split(' ');
  // The creature now stands on `target`, so a capture onto that square is off.
  return [board, turn, castling, enPassant === target ? '-' : enPassant, '0', fullmove].join(' ');
}

/** True if eating `target` would leave Black's king capturable by White, which is an illegal position. */
function exposesBlackKing(strippedFen: string, target: Square): boolean {
  const parts = withScp(afterStrike(strippedFen, target), target).split(' ');
  parts[1] = 'b';
  parts[3] = '-';
  const test = new Chess(parts.join(' '));
  // The hidden knight is White's in this FEN, so recolour it to block for Black.
  test.remove(target);
  test.put({ type: 'n', color: 'b' }, target);
  return test.inCheck();
}

/** The piece 096 eats this round: any seer, chosen at random. */
export function pickVictim(strippedFen: string, scp: Square, rng: () => number = Math.random): Square | null {
  const chess = new Chess(strippedFen);
  const options = findSeers(strippedFen, scp).filter((square) => {
    return chess.get(square)?.type === 'k' || !exposesBlackKing(strippedFen, square);
  });
  if (options.length === 0) return null;
  return options[Math.floor(rng() * options.length)];
}

const KNIGHT_JUMPS = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];

function knightMoves(square: Square): Square[] {
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]) - 1;
  return KNIGHT_JUMPS.flatMap(([df, dr]) => {
    const f = file + df;
    const r = rank + dr;
    return f >= 0 && f < 8 && r >= 0 && r < 8 ? [`${'abcdefgh'[f]}${r + 1}` as Square] : [];
  });
}

/** Knight moves from `from` to every square. Knights jump, so pieces in between don't matter. */
export function knightDistances(from: Square): Map<Square, number> {
  const distances = new Map<Square, number>([[from, 0]]);
  const queue = [from];
  for (const square of queue) {
    for (const next of knightMoves(square)) {
      if (distances.has(next)) continue;
      distances.set(next, distances.get(square)! + 1);
      queue.push(next);
    }
  }
  return distances;
}

/** Pieces holding SCP-173 still. Kings don't count, or it could never reach one. */
export function findWatchers(strippedFen: string, scp: Square): Square[] {
  const chess = new Chess(strippedFen);
  return findSeers(strippedFen, scp).filter((square) => chess.get(square)?.type !== 'k');
}

/**
 * Where SCP-173 jumps this round, or null if it is watched. It takes one knight
 * move along a shortest route to the king fewest knight moves away, with ties
 * at random, and kills whatever is on the square it lands on. Leaving its
 * square can't expose Black's king, as a White piece lined up through it would
 * be watching it.
 */
export function pickJump(strippedFen: string, scp: Square, rng: () => number = Math.random): Square | null {
  if (findWatchers(strippedFen, scp).length > 0) return null;

  const chess = new Chess(strippedFen);
  const kings = chess.board().flat().filter((piece) => piece?.type === 'k').map((piece) => knightDistances(piece!.square));
  const nearest = Math.min(...kings.map((distances) => distances.get(scp)!));
  const closest = kings.filter((distances) => distances.get(scp) === nearest);
  const route = closest[Math.floor(rng() * closest.length)];

  const steps = knightMoves(scp).filter((square) => route.get(square) === nearest - 1);
  return steps[Math.floor(rng() * steps.length)];
}

/** The board after 096 eats a king. The game ends here, so the FEN is only displayed. */
export function afterKingEaten(strippedFen: string, target: Square): string {
  const chess = new Chess(strippedFen);
  chess.remove(target);
  return chess.fen();
}

/**
 * Move text as a player would expect it. chess.js's own SAN counts the hidden
 * knight, which adds false disambiguation ("Nbc3") and false checks.
 * `after` is the position once the hidden piece has passed to the next side.
 */
export function scpSan(strippedBefore: string, input: { from: string; to: string; promotion?: string }, fallback: string, after: Chess, scp: Square): string {
  let san = fallback;
  try {
    san = new Chess(strippedBefore).move(input).san;
  } catch {
    // Without 096 the king may look to be in check, which can reject a legal move.
  }
  san = san.replace(/[+#]$/, '');
  if (!after.inCheck()) return san;
  return san + (after.moves({ verbose: true }).some((m) => m.from !== scp) ? '+' : '#');
}

/** Identifies a position for threefold repetition, which chess.js cannot track across reloads. */
export const positionKey = (strippedFen: string, scp: string) => `${strippedFen.split(' ').slice(0, 4).join(' ')} ${scp}`;

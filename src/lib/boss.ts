import { Chess, type Square } from 'chess.js';
import { restoreEnPassant } from './fen';

type Color = 'white' | 'black';

export type Power = 'snatch' | 'hole' | 'pawn';
export type PowersUsed = Record<Power, boolean>;

export const NO_POWERS_USED: PowersUsed = { snatch: false, hole: false, pawn: false };

/**
 * Holes block both sides and can't be landed on, which chess has no piece for.
 * As with SCP-096, each is held on the board as a hidden knight of the side to
 * move, whose moves the caller filters out. Knights already jump, so they pass
 * over holes without any special handling. Saved positions and anything sent
 * to Stockfish use the "stripped" FEN, without the hidden knights.
 */
export function stripHoles(fen: string, holes: Square[]): string {
  const chess = new Chess(fen);
  for (const hole of holes) chess.remove(hole);
  return restoreEnPassant(fen, chess.fen());
}

export function withHoles(strippedFen: string, holes: Square[]): string {
  const chess = new Chess(strippedFen);
  for (const hole of holes) chess.put({ type: 'n', color: chess.turn() }, hole);
  return restoreEnPassant(strippedFen, chess.fen());
}

const STAND_IN_TYPES = ['p', 'b', 'r', 'n', 'q'] as const;

/**
 * The position to send Stockfish, with each blocker (a hole or a gold piece)
 * filled by a stand-in piece, so it sees the square as blocked for both sides.
 * A piece of the side to move is best: Stockfish can't take or pass its own
 * piece. Once that side is at the API's limit of 16 pieces, as in Boss Fight's
 * full army, the other side gets the stand-in instead; Stockfish may then think
 * it can capture it, which the caller rejects like any other illegal reply.
 * Pawns are used where possible as they barely move. No stand-in may give
 * check, which Stockfish can't handle. A blocker with no room on either side
 * stays empty.
 */
export function engineBlockers(strippedFen: string, blockers: Square[]): string {
  const chess = new Chess(strippedFen);
  const toMove = chess.turn();
  const count = (color: 'w' | 'b') => {
    const own = chess.board().flat().filter((piece) => piece?.color === color && piece.type !== 'k');
    return { pieces: own.length, pawns: own.filter((piece) => piece!.type === 'p').length };
  };
  const king = (color: 'w' | 'b') => chess.board().flat().find((piece) => piece?.type === 'k' && piece.color === color)!.square;

  const place = (square: Square, color: 'w' | 'b') => {
    const { pieces, pawns } = count(color);
    if (pieces >= 15) return false;
    const target = king(color === 'w' ? 'b' : 'w');
    for (const type of STAND_IN_TYPES) {
      if (type === 'p' && (pawns >= 8 || square[1] === '1' || square[1] === '8')) continue;
      chess.put({ type, color }, square);
      if (!chess.isAttacked(target, color)) return true;
      chess.remove(square);
    }
    return false;
  };

  for (const square of blockers) {
    if (!place(square, toMove)) place(square, toMove === 'w' ? 'b' : 'w');
  }
  return restoreEnPassant(strippedFen, chess.fen());
}

/** True if the side to move has a move that isn't one of the hidden knights. */
export function hasBossMove(chess: Chess, holes: Square[]): boolean {
  return chess.moves({ verbose: true }).some((move) => !holes.includes(move.from));
}

/** The square a summon uses: the player's pawn row, for a click on either of their first two rows. */
export function pawnSquare(clicked: Square, playerColor: Color): Square | null {
  const [first, second] = playerColor === 'white' ? ['1', '2'] : ['8', '7'];
  if (clicked[1] !== first && clicked[1] !== second) return null;
  return `${clicked[0]}${second}` as Square;
}

/** Resets the 50-move count after a board edit, keeping en passant where it still applies. */
function afterEdit(before: string, chess: Chess): string {
  const parts = restoreEnPassant(before, chess.fen()).split(' ');
  parts[4] = '0';
  return parts.join(' ');
}

/** The position with a piece taken off. It stays the player's turn. */
export function afterSnatch(strippedFen: string, square: Square): string {
  const chess = new Chess(strippedFen);
  chess.remove(square);
  return afterEdit(strippedFen, chess);
}

/** The position with a new pawn on `square`. */
export function afterSummon(strippedFen: string, square: Square, playerColor: Color): string {
  const chess = new Chess(strippedFen);
  chess.put({ type: 'p', color: playerColor[0] as 'w' | 'b' }, square);
  return afterEdit(strippedFen, chess);
}

/** The position with a hole added. A hole on the en passant square cancels the capture. */
export function afterHole(strippedFen: string, square: Square): string {
  const parts = strippedFen.split(' ');
  if (parts[3] === square) parts[3] = '-';
  return parts.join(' ');
}

/** True if the enemy king would be open to capture on the player's own turn, which is an illegal position. */
function enemyKingExposed(strippedFen: string, holes: Square[]): boolean {
  const parts = strippedFen.split(' ');
  parts[1] = parts[1] === 'w' ? 'b' : 'w';
  parts[3] = '-';
  return new Chess(withHoles(parts.join(' '), holes)).inCheck();
}

/** Whether a piece can be taken: any enemy but the king, unless it alone shields that king. */
export function canSnatch(strippedFen: string, square: Square, holes: Square[], playerColor: Color): boolean {
  const piece = new Chess(strippedFen).get(square);
  if (!piece || piece.color === playerColor[0] || piece.type === 'k') return false;
  return !enemyKingExposed(afterSnatch(strippedFen, square), holes);
}

/** Whether a hole can go here: an empty square that isn't already a hole. */
export function canDig(strippedFen: string, square: Square, holes: Square[]): boolean {
  return !holes.includes(square) && !new Chess(strippedFen).get(square);
}

/** Whether a summon works on this square. */
export function canSummon(strippedFen: string, square: Square, holes: Square[]): boolean {
  return canDig(strippedFen, square, holes);
}

/**
 * With no legal move, whether one unused power would create one. It only looks
 * one power ahead, which covers practically every real rescue.
 */
export function powerCanEscape(strippedFen: string, holes: Square[], playerColor: Color, used: PowersUsed): boolean {
  const chess = new Chess(strippedFen);
  const works = (fen: string, nextHoles: Square[]) => hasBossMove(new Chess(withHoles(fen, nextHoles)), nextHoles);
  const squares = chess.board().flatMap((row, r) => row.map((_, f) => `${'abcdefgh'[f]}${8 - r}` as Square));

  for (const square of squares) {
    if (!used.snatch && canSnatch(strippedFen, square, holes, playerColor) && works(afterSnatch(strippedFen, square), holes)) return true;
    if (!used.hole && canDig(strippedFen, square, holes) && works(afterHole(strippedFen, square), [...holes, square])) return true;
    const pawn = pawnSquare(square, playerColor);
    if (!used.pawn && pawn === square && canSummon(strippedFen, pawn, holes) && works(afterSummon(strippedFen, pawn, playerColor), holes)) return true;
  }
  return false;
}

/**
 * Move text as a player would expect it. chess.js's own SAN counts the hidden
 * knights, which adds false disambiguation and false checks. `after` is the
 * position once the hidden pieces have passed to the next side.
 */
export function bossSan(strippedBefore: string, input: { from: string; to: string; promotion?: string }, fallback: string, after: Chess, holes: Square[]): string {
  let san = fallback;
  try {
    san = new Chess(strippedBefore).move(input).san;
  } catch {
    // Without the holes a king may look to be in check, which can reject a legal move.
  }
  san = san.replace(/[+#]$/, '');
  if (!after.inCheck()) return san;
  return san + (hasBossMove(after, holes) ? '+' : '#');
}

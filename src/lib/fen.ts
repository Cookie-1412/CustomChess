import { Chess, type Square } from 'chess.js';

/**
 * chess.js forgets the en passant square whenever a piece is put on or removed
 * from the board, even far away. This copies it from `before` onto `after`, for
 * edits that leave the side to move unchanged. It stays cleared if the capture
 * is no longer possible: the pawn that double-stepped is gone, or the square it
 * skipped has become occupied.
 */
export function restoreEnPassant(before: string, after: string): string {
  const enPassant = before.split(' ')[3];
  const parts = after.split(' ');
  if (enPassant === '-' || parts[1] !== before.split(' ')[1]) return after;

  const chess = new Chess(after);
  const pawnSquare = `${enPassant[0]}${enPassant[1] === '6' ? '5' : '4'}` as Square;
  const pawn = chess.get(pawnSquare);
  if (chess.get(enPassant as Square) || pawn?.type !== 'p' || pawn.color === parts[1]) return after;

  parts[3] = enPassant;
  return parts.join(' ');
}

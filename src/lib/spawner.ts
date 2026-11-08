import { Chess, type Square } from 'chess.js';
import { restoreEnPassant } from './fen';
import type { GameMode } from './modes';

type Color = 'white' | 'black';

export type SpawnRule = 'and' | 'or';
export type SpawnDifficulty = 'easy' | 'hard';
export type SpawnPiece = 'p' | 'q' | 'r' | 'b' | 'n';

const STANDARD_START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const SPAWNER_AS_WHITE = 'rnbqkbnr/pppppppp/8/8/8/8/4P3/4K3 w kq - 0 1';
const SPAWNER_AS_BLACK = '4k3/4p3/8/8/8/8/PPPPPPPP/RNBQKBNR w KQ - 0 1';

/** The API returns no move for a side with more than these, even if moves exist. */
const API_MAX_PAWNS = 8;
const API_MAX_NON_KING = 15;

export function startFenFor(mode: GameMode, playerColor: Color): string {
  if (mode !== 'spawner' && mode !== 'boss') return STANDARD_START;
  return playerColor === 'white' ? SPAWNER_AS_WHITE : SPAWNER_AS_BLACK;
}

/** A pawn cannot stand on these ranks, so a spawn there promotes at once. */
export const isBackRank = (square: string) => square[1] === '1' || square[1] === '8';

/**
 * Empty squares a pawn can appear on. Hard excludes the first and last ranks,
 * because a pawn there is an invalid position for chess.js and Stockfish.
 * Easy allows them, and the caller promotes the pawn as it lands.
 * When the spawning side is in check, the spawn has to block that check.
 */
export function findSpawns(fen: string, playerColor: Color, backRanks = false): Square[] {
  const chess = new Chess(fen);
  const side = playerColor[0] as 'w' | 'b';
  const squares: Square[] = [];
  for (let rank = backRanks ? 1 : 2; rank <= (backRanks ? 8 : 7); rank++) {
    for (const file of 'abcdefgh') {
      const square = `${file}${rank}` as Square;
      if (!chess.get(square)) squares.push(square);
    }
  }
  if (chess.turn() !== side || !chess.inCheck()) return squares;
  return squares.filter((square) => {
    const test = new Chess(fen);
    test.put({ type: 'n', color: side }, square); // Any piece blocks equally.
    return !test.inCheck();
  });
}

/**
 * The position after a spawn. `passTurn` is true for a spawn instead of a move.
 * It is false for a spawn after a move, where the turn has already passed.
 */
export function placePawn(fen: string, square: Square, playerColor: Color, passTurn: boolean, piece: SpawnPiece = 'p'): string {
  const chess = new Chess(fen);
  const side = playerColor[0] as 'w' | 'b';
  chess.put({ type: piece, color: side }, square);
  const [board, turn, castling, enPassant, , fullmove] = restoreEnPassant(fen, chess.fen()).split(' ');
  if (passTurn) {
    const nextMove = side === 'b' ? Number(fullmove) + 1 : Number(fullmove);
    return [board, side === 'w' ? 'b' : 'w', castling, '-', '0', nextMove].join(' ');
  }
  return [board, turn, castling, enPassant === square ? '-' : enPassant, '0', fullmove].join(' ');
}

/** Move list text for a spawn, with the usual check or mate suffix. */
export function spawnLabel(square: Square, after: Chess, piece: SpawnPiece = 'p'): string {
  const suffix = after.isCheckmate() ? '#' : after.inCheck() ? '+' : '';
  const promotion = piece === 'p' ? '' : `=${piece.toUpperCase()}`;
  return `P@${square}${promotion}${suffix}`;
}

/**
 * A stand-in position that fits the API's limits. Returns `fen` unchanged when
 * it already fits. Pawns nearest the opposing king stay as pawns. The rest
 * become bishops, which keep the square occupied and still cover the pawn's
 * diagonals, or are removed when there is no room or a bishop would give a
 * false check. Callers must confirm the reply is legal on the real board.
 */
export function engineFen(fen: string, playerColor: Color): string {
  const chess = new Chess(fen);
  const side = playerColor[0] as 'w' | 'b';
  const pieces = chess.board().flat().filter((p) => p !== null);
  const own = pieces.filter((p) => p.color === side && p.type !== 'k');
  const pawns = own.filter((p) => p.type === 'p');
  if (pawns.length <= API_MAX_PAWNS && own.length <= API_MAX_NON_KING) return fen;

  const king = pieces.find((p) => p.color !== side && p.type === 'k')!.square;
  const distance = (square: Square) =>
    Math.max(Math.abs(square.charCodeAt(0) - king.charCodeAt(0)), Math.abs(Number(square[1]) - Number(king[1])));
  const nearestFirst = [...pawns].sort((a, b) => distance(a.square) - distance(b.square));

  const others = own.length - pawns.length;
  const keep = Math.max(0, Math.min(API_MAX_PAWNS, API_MAX_NON_KING - others));
  let room = API_MAX_NON_KING - others - keep;

  for (const pawn of nearestFirst.slice(keep)) {
    chess.remove(pawn.square);
    if (room === 0) continue;
    chess.put({ type: 'b', color: side }, pawn.square);
    if (chess.isAttacked(king, side)) chess.remove(pawn.square);
    else room -= 1;
  }

  const parts = chess.fen().split(' ');
  parts[3] = '-'; // The pawn that allowed en passant may have been swapped.
  return parts.join(' ');
}

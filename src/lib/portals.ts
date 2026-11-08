import { Chess, type Square } from 'chess.js';
import { isBackRank } from './spawner';

export type PortalColor = 'blue' | 'orange';

export interface Portal {
  color: PortalColor;
  square: Square;
  /** Moves left before an old portal closes. Null for the newest portal of its colour. */
  ttl: number | null;
}

export interface PortalMove {
  from: string;
  to: string;
  promotion?: string;
}

/** On Hard, a replaced portal stays open for this many moves, counting both sides. */
const LINGER_MOVES = 2;

/** Adds a portal. The previous one of that colour closes now, or lingers on Hard. */
export function addPortal(portals: Portal[], color: PortalColor, square: Square, hard: boolean): Portal[] {
  const kept = portals.flatMap((portal) => {
    if (portal.color !== color || portal.ttl !== null) return [portal];
    return hard ? [{ ...portal, ttl: LINGER_MOVES }] : [];
  });
  return [...kept, { color, square, ttl: null }];
}

/** Counts one move against every lingering portal. */
export function tickPortals(portals: Portal[]): Portal[] {
  return portals.flatMap((portal) => {
    if (portal.ttl === null) return [portal];
    return portal.ttl > 1 ? [{ ...portal, ttl: portal.ttl - 1 }] : [];
  });
}

/** Where a piece landing on `square` comes out: the newest portal of the other colour. */
export function exitFor(portals: Portal[], square: string): Square | null {
  const entry = portals.find((portal) => portal.square === square);
  if (!entry) return null;
  const exit = portals.find((portal) => portal.color !== entry.color && portal.ttl === null);
  return exit?.square ?? null;
}

/**
 * The position after `move` goes through a portal, or null if it doesn't enter
 * one. A piece that can't enter simply stops on the square as a normal move:
 * its own side holds the exit, an enemy king does, the exit would leave its own
 * king in check, or it is castling. Portals only carry pieces, so nothing
 * attacks through them and every legal chess move stays legal.
 */
export function teleport(fen: string, move: PortalMove, portals: Portal[]): string | null {
  const exit = exitFor(portals, move.to);
  if (!exit) return null;

  const chess = new Chess(fen);
  const real = chess
    .moves({ verbose: true })
    .find((m) => m.from === move.from && m.to === move.to && (!m.promotion || m.promotion === (move.promotion ?? 'q')));
  if (!real || real.isKingsideCastle() || real.isQueensideCastle()) return null;
  chess.move(real);

  const side = real.color;
  const occupant = chess.get(exit);
  if (occupant && (occupant.color === side || occupant.type === 'k')) return null;

  const piece = chess.get(move.to as Square)!;
  chess.remove(move.to as Square);
  chess.remove(exit);
  const type = piece.type === 'p' && isBackRank(exit) ? ((move.promotion ?? 'q') as 'q' | 'r' | 'b' | 'n') : piece.type;
  chess.put({ type, color: side }, exit);

  const [board, turn, castling, , , fullmove] = chess.fen().split(' ');
  const safety = new Chess([board, side, castling, '-', '0', fullmove].join(' '));
  if (safety.inCheck()) return null;
  return [board, turn, castling, '-', '0', fullmove].join(' ');
}

/** Move list text for a teleport, like "Nf3→c6", or "Nf3→xc6" with a capture at the exit. */
export function portalSan(san: string, exit: Square, after: Chess, capturedAtExit = false): string {
  const suffix = after.isCheckmate() ? '#' : after.inCheck() ? '+' : '';
  return `${san.replace(/[+#]$/, '')}→${capturedAtExit ? 'x' : ''}${exit}${suffix}`;
}

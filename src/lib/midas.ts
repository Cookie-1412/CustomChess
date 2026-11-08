import { Chess, type Square } from 'chess.js';
import { afterSnatch, hasBossMove, withHoles } from './boss';

type Color = 'white' | 'black';

/** A piece turned to gold: what it was, for drawing the statue. */
export interface GoldPiece {
  square: Square;
  /** Like "bQ". */
  piece: string;
}

/**
 * Enemy pieces the player's pieces attack, which Midas Touch can turn to gold.
 * Gold blockers stop lines but attack nothing, so they are put back as enemy
 * knights here: they block, and never count as the player's attackers. Kings
 * can't be gilded.
 */
export function midasTargets(strippedFen: string, gold: Square[], playerColor: Color): Square[] {
  const chess = new Chess(strippedFen);
  const mine = playerColor[0] as 'w' | 'b';
  const theirs = mine === 'w' ? 'b' : 'w';
  for (const square of gold) chess.put({ type: 'n', color: theirs }, square);
  return chess
    .board()
    .flat()
    .filter((piece) => piece && piece.color === theirs && piece.type !== 'k' && !gold.includes(piece.square))
    .filter((piece) => chess.attackers(piece!.square, mine).length > 0)
    .map((piece) => piece!.square);
}

/**
 * The position after gilding: the piece leaves play, and a blocker the caller
 * adds to its list takes the square. It stays the player's turn.
 */
export const afterGild = afterSnatch;

/** With no legal move, whether gilding a piece would create one, such as one giving check. */
export function gildCanEscape(strippedFen: string, gold: Square[], playerColor: Color): boolean {
  return midasTargets(strippedFen, gold, playerColor).some((square) => {
    const next = [...gold, square];
    return hasBossMove(new Chess(withHoles(afterGild(strippedFen, square), next)), next);
  });
}

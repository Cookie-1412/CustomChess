import { defaultPieces, type PieceRenderObject } from 'react-chessboard';
import type { BombLevel } from '../lib/bomb';
import { BombPiece } from './BombPiece';
import { HorseKnight } from './HorseKnight';
import { MagnetPiece } from './MagnetPiece';
import { RifleBishop } from './RifleBishop';

/** Stable piece sets, so the board does not re-mount on every render. */
const bombSet = (level: BombLevel): Record<'w' | 'b', PieceRenderObject> => ({
  w: { ...defaultPieces, wQ: () => <BombPiece level={level} color="w" /> },
  b: { ...defaultPieces, bQ: () => <BombPiece level={level} color="b" /> },
});

export const BOMB_PIECES: Record<BombLevel, Record<'w' | 'b', PieceRenderObject>> = { 1: bombSet(1), 2: bombSet(2), 3: bombSet(3) };

const magnetSet = (color: 'w' | 'b'): PieceRenderObject => {
  const set: PieceRenderObject = { ...defaultPieces };
  for (const type of ['N', 'B', 'R', 'Q']) set[`${color}${type}`] = (props) => <MagnetPiece piece={`${color}${type}`} {...props} />;
  return set;
};

/** Knights, bishops, rooks and queens carry a magnet in Magnets; kings and pawns don't. */
export const MAGNET_PIECES: Record<'w' | 'b', PieceRenderObject> = { w: magnetSet('w'), b: magnetSet('b') };

/** The player's knights are brown horses in Horse Breeding. */
export const HORSE_PIECES: Record<'w' | 'b', PieceRenderObject> = {
  w: { ...defaultPieces, wN: (props) => <HorseKnight {...props} /> },
  b: { ...defaultPieces, bN: (props) => <HorseKnight {...props} /> },
};

export const RIFLE_PIECES: Record<'w' | 'b', PieceRenderObject> = {
  w: { ...defaultPieces, wB: (props) => <RifleBishop piece="wB" {...props} /> },
  b: { ...defaultPieces, bB: (props) => <RifleBishop piece="bB" {...props} /> },
};

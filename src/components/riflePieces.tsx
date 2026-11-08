import { defaultPieces, type PieceRenderObject } from 'react-chessboard';
import type { BombLevel } from '../lib/bomb';
import { BombPiece } from './BombPiece';
import { RifleBishop } from './RifleBishop';

/** Stable piece sets, so the board does not re-mount on every render. */
const bombSet = (level: BombLevel): Record<'w' | 'b', PieceRenderObject> => ({
  w: { ...defaultPieces, wQ: () => <BombPiece level={level} color="w" /> },
  b: { ...defaultPieces, bQ: () => <BombPiece level={level} color="b" /> },
});

export const BOMB_PIECES: Record<BombLevel, Record<'w' | 'b', PieceRenderObject>> = { 1: bombSet(1), 2: bombSet(2), 3: bombSet(3) };

export const RIFLE_PIECES: Record<'w' | 'b', PieceRenderObject> = {
  w: { ...defaultPieces, wB: (props) => <RifleBishop piece="wB" {...props} /> },
  b: { ...defaultPieces, bB: (props) => <RifleBishop piece="bB" {...props} /> },
};

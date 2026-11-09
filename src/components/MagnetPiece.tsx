import { defaultPieces } from 'react-chessboard';
import type { PieceRenderObject } from 'react-chessboard';

type PieceProps = Parameters<PieceRenderObject[string]>[0];

/** A red horseshoe magnet with silver tips. Original artwork for this app. */
export function MagnetIcon() {
  return (
    <g stroke="#2a0b0b" strokeWidth="1.3" strokeLinejoin="round">
      <path d="M0 0 h5.500 v9 a4.500 4.500 0 0 0 9 0 v-9 h5.500 v9 a10 10 0 0 1 -20 0 z" fill="#d93a3a" />
      <rect x="0" y="0" width="5.500" height="4" fill="#dfe3e8" />
      <rect x="14.500" y="0" width="5.500" height="4" fill="#dfe3e8" />
      <path d="M2.500 10 a7.500 7.500 0 0 0 3 6" fill="none" stroke="#f08a8a" strokeWidth="1.200" strokeLinecap="round" />
    </g>
  );
}

/** A piece carrying a magnet on its lower right, as in the user's reference. Purely cosmetic. */
export function MagnetPiece({ piece, ...props }: { piece: string } & NonNullable<PieceProps>) {
  const Piece = defaultPieces[piece];
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Piece {...props} />
      <svg viewBox="0 0 45 45" aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
        <g transform="translate(28 22) rotate(-58) scale(0.78)">
          <MagnetIcon />
        </g>
      </svg>
    </div>
  );
}

/** For the menu card: a rook holding its magnet out towards the square on its right, tilted slightly up. */
export function PullingRook() {
  const Rook = defaultPieces.wR;
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Rook />
      <svg viewBox="0 0 45 45" aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none' }}>
        {/* Tips point right and a little up, at the piece being pulled. */}
        <g transform="translate(38 22) rotate(72) scale(0.95) translate(-10 -10)">
          <MagnetIcon />
        </g>
      </svg>
    </div>
  );
}

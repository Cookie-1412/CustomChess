import { defaultPieces } from 'react-chessboard';

/** A gilded piece: the white version of the piece, tinted gold. */
export function GoldStatue({ piece }: { piece: string }) {
  const Piece = defaultPieces[`w${piece[1]}`];
  return (
    <div className="gold-statue" data-gold={piece}>
      <Piece />
    </div>
  );
}

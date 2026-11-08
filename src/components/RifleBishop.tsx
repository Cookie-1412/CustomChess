import { defaultPieces } from 'react-chessboard';
import type { PieceRenderObject } from 'react-chessboard';

type PieceProps = Parameters<PieceRenderObject[string]>[0];

/** A bishop holding a scoped rifle. Purely cosmetic. */
export function RifleBishop({ piece, ...props }: { piece: 'wB' | 'bB' } & NonNullable<PieceProps>) {
  const Piece = defaultPieces[piece];
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Piece {...props} />
      <svg viewBox="0 0 45 45" aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
        <g transform="rotate(-32 22.5 26)" stroke="#111" strokeWidth="0.8" strokeLinejoin="round">
          {/* Stock */}
          <path d="M1.5 24.5 L12 26 L12 30 L3 33 Z" fill="#9a6432" />
          {/* Body and grip */}
          <rect x="12" y="25" width="15" height="4" rx="0.8" fill="#4a4f57" />
          <path d="M15 29 L19 29 L17.5 33.5 L14 33 Z" fill="#7a4e26" />
          {/* Barrel and muzzle */}
          <rect x="27" y="26" width="15" height="1.8" fill="#2b2e33" />
          <rect x="41" y="25.2" width="3" height="3.4" rx="0.5" fill="#15171a" />
          {/* Scope */}
          <rect x="15" y="20.6" width="11" height="3" rx="1.2" fill="#23262a" />
          <path d="M18 23.6v1.6M23 23.6v1.6" fill="none" />
          <circle cx="26" cy="22.1" r="1.2" fill="#e5222b" stroke="none" />
        </g>
      </svg>
    </div>
  );
}

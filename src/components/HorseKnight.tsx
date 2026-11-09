import { defaultPieces } from 'react-chessboard';
import type { PieceRenderObject } from 'react-chessboard';

type PieceProps = Parameters<PieceRenderObject[string]>[0];

const COAT = '#a26a3a';
const MANE = '#4b2a14';

/** A knight drawn as a brown horse with a dark flowing mane. Purely cosmetic. */
export function HorseKnight(props: NonNullable<PieceProps>) {
  const Knight = defaultPieces.wN;
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Knight {...props} fill={COAT} />
      <svg viewBox="0 0 45 45" aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
        <g fill={MANE} stroke="#000" strokeWidth="1" strokeLinejoin="round">
          {/* Mane flowing down the back of the neck, in loose locks */}
          <path d="M21 8.500 C26 7.500 31.500 10.500 34 15 C36.500 19.500 37.500 25 37.200 30.500 C35.800 28.500 35 26.500 34.400 24.500 C34.600 27 34.200 29 33.400 30.500 C32.600 27.500 31.600 24.500 30.300 22.200 C30.400 24.300 29.900 26 29 27.200 C28.700 24 27.700 21 26.200 18.700 C26.100 20.400 25.600 21.700 24.700 22.600 C24.900 19 24 15.500 22.500 13 C22 11.500 21.600 10 21 8.500 Z" />
          {/* Forelock between the ears */}
          <path d="M17.200 9.800 C18.200 8.600 19.800 8.300 20.800 9.200 C19.600 9.800 19 11 18.900 12.300 C18.200 11.400 17.600 10.600 17.200 9.800 Z" />
        </g>
        {/* A lighter muzzle */}
        <path d="M6.200 26.200 C6.400 28.800 7.600 29.800 9.400 29.700 C10.600 29.200 11.200 28.300 11 27.400 C9.700 27.600 8 27.300 6.200 26.200 Z" fill="#d9b38c" stroke="none" />
      </svg>
    </div>
  );
}

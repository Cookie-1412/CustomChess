import { defaultPieces } from 'react-chessboard';

/** A little running astronaut. Original artwork for this app. */
export function ThiefSprite() {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" style={{ display: 'block', width: '100%', height: '100%' }}>
      <g stroke="#17151a" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round">
        {/* Running legs */}
        <path d="M46 70 L34 84 L24 80" fill="none" strokeWidth="11" stroke="#17151a" />
        <path d="M46 70 L34 84 L24 80" fill="none" strokeWidth="6" stroke="#2fa37c" />
        <path d="M58 70 L70 82 L66 94" fill="none" strokeWidth="11" stroke="#17151a" />
        <path d="M58 70 L70 82 L66 94" fill="none" strokeWidth="6" stroke="#2fa37c" />
        {/* Backpack, suit and reaching arm */}
        <rect x="66" y="40" width="15" height="28" rx="6" fill="#23785c" />
        <rect x="36" y="42" width="34" height="32" rx="12" fill="#2fa37c" />
        <path d="M40 54 L18 56" fill="none" strokeWidth="11" stroke="#17151a" />
        <path d="M40 54 L18 56" fill="none" strokeWidth="6" stroke="#2fa37c" />
        {/* Round helmet */}
        <circle cx="50" cy="28" r="20" fill="#f1eee8" />
        <circle cx="44" cy="28" r="13" fill="#2d3f55" />
        <path d="M37 23 Q41 18 47 19" fill="none" stroke="#bcd7ee" strokeWidth="3" />
      </g>
    </svg>
  );
}

/** Runs in from the right to `left` (a percentage of the board), takes the piece and runs back. */
export function Thief({ left, top, piece }: { left: number; top: number; piece: string }) {
  const Loot = defaultPieces[piece];
  return (
    <div className="thief" style={{ '--to': `${left}%`, top: `${top}%` } as React.CSSProperties}>
      <div className="thief-body"><ThiefSprite /></div>
      <div className="thief-loot"><Loot /></div>
    </div>
  );
}

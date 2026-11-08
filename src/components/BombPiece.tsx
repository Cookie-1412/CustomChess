import type { BombLevel } from '../lib/bomb';

interface Palette {
  fill: string;
  shade: string;
  line: string;
  /** Lines drawn on top of the fill, which need contrast on the dark set. */
  detail: string;
}

const PALETTES: Record<'w' | 'b', Palette> = {
  w: { fill: '#f6f6f4', shade: '#c8c8c6', line: '#1d1d20', detail: '#1d1d20' },
  b: { fill: '#2e2e32', shade: '#17171a', line: '#050506', detail: '#d6d6d3' },
};

function Grenade({ fill, shade, line, detail }: Palette) {
  return (
    <g transform="rotate(32 50 52)" stroke={line} strokeWidth="4.500" strokeLinejoin="round" strokeLinecap="round">
      {/* Pull ring and safety lever */}
      <circle cx="66" cy="17" r="9.500" fill="none" />
      <path d="M46 25 C50 13 64 9 76 16 C84 21 86 34 84 44 L78 42 C79 34 77 28 71 24 C63 20 56 23 54 29 Z" fill={fill} />
      <rect x="39" y="23" width="22" height="10" rx="2" fill={fill} />
      {/* Body */}
      <ellipse cx="50" cy="61" rx="25" ry="31" fill={fill} />
      <path d="M58 32 C78 44 78 78 58 90 C70 74 70 48 58 32 Z" fill={shade} stroke="none" />
      <ellipse cx="50" cy="61" rx="25" ry="31" fill="none" />
      {/* Pineapple grid */}
      <g fill="none" stroke={detail} strokeWidth="3.200">
        <path d="M27 49 Q50 56 73 49" />
        <path d="M25 63 Q50 70 75 63" />
        <path d="M29 77 Q50 84 71 77" />
        <path d="M41 32 Q33 61 41 90" />
        <path d="M59 32 Q67 61 59 90" />
      </g>
    </g>
  );
}

function Bomb({ fill, shade, line }: Palette) {
  return (
    <g stroke={line} strokeWidth="4.500" strokeLinejoin="round" strokeLinecap="round">
      {/* Fuse and spark */}
      <path d="M50 19 C52 9 62 6 73 13" fill="none" />
      <path d="M77 3 L79 10 L86 7 L82 13 L90 16 L82 18 L84 25 L78 20 L72 24 L74 17 L67 14 L74 12 Z" fill={fill} strokeWidth="2.600" />
      {/* Body and cap */}
      <circle cx="50" cy="52" r="29" fill={fill} />
      <path d="M58 25 C80 36 82 66 62 78 C72 62 72 40 58 25 Z" fill={shade} stroke="none" />
      <circle cx="50" cy="52" r="29" fill="none" />
      <rect x="40" y="17" width="20" height="11" rx="3" fill={fill} />
      {/* Stand */}
      <path d="M20 93 C20 82 30 76 50 76 C70 76 80 82 80 93 Z" fill={fill} />
    </g>
  );
}

function Nuke({ fill, shade, line, detail }: Palette) {
  return (
    <g transform="rotate(42 50 50)" stroke={line} strokeWidth="4.500" strokeLinejoin="round" strokeLinecap="round">
      {/* Tail fins and nozzle */}
      <path d="M38 66 L20 88 L20 97 L38 88 Z" fill={fill} />
      <path d="M62 66 L80 88 L80 97 L62 88 Z" fill={fill} />
      <rect x="44" y="86" width="12" height="10" fill={fill} />
      {/* Body and nose */}
      <path d="M36 88 L36 34 C36 18 44 6 50 3 C56 6 64 18 64 34 L64 88 Z" fill={fill} />
      <path d="M54 7 C60 14 64 24 64 34 L64 88 L54 88 Z" fill={shade} stroke="none" />
      <path d="M36 88 L36 34 C36 18 44 6 50 3 C56 6 64 18 64 34 L64 88 Z" fill="none" />
      {/* Band below the nose */}
      <path d="M36 32 L64 32 M36 40 L64 40" fill="none" stroke={detail} strokeWidth="3.200" />
    </g>
  );
}

const SHAPES = { 1: Grenade, 2: Bomb, 3: Nuke };

/** The player's queen in Queen Bomb: a grenade, bomb or nuke, depending on the level. */
export function BombPiece({ level, color }: { level: BombLevel; color: 'w' | 'b' }) {
  const Shape = SHAPES[level];
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" style={{ display: 'block', width: '100%', height: '100%' }}>
      <g transform="translate(5 5) scale(0.9)">
        <Shape {...PALETTES[color]} />
      </g>
    </svg>
  );
}

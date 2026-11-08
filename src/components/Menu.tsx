import { defaultPieces } from 'react-chessboard';
import { MODES, type GameMode } from '../lib/modes';
import { BombPiece } from './BombPiece';
import { RifleBishop } from './RifleBishop';
import { Scp096 } from './Scp096';
import { Scp173 } from './Scp173';
import { GoldStatue } from './GoldStatue';
import { ThiefSprite } from './Thief';

interface ScenePiece {
  piece: string;
  col: number;
  row: number;
}

/** A cropped board, 4 squares wide, used as a card thumbnail. */
function Scene({ theme, pieces, children }: { theme: 'green' | 'purple' | 'gold' | 'brown' | 'ember' | 'stone' | 'void'; pieces: ScenePiece[]; children?: React.ReactNode }) {
  const squares = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 4; col++) {
      squares.push(<i key={`${row}-${col}`} className={(row + col) % 2 ? 'dark' : 'light'} />);
    }
  }
  return (
    <div className={`scene ${theme}`}>
      <div className="scene-grid">{squares}</div>
      {pieces.map(({ piece, col, row }) => {
        const Piece = defaultPieces[piece];
        return <span key={piece + col + row} className="scene-piece" style={{ left: `${col * 25}%`, top: `${row * 44.44 - 22}%` }}><Piece /></span>;
      })}
      {children}
    </div>
  );
}

const CLASSIC = (
  <Scene
    theme="green"
    pieces={[
      { piece: 'bP', col: 0, row: 1 },
      { piece: 'bQ', col: 1, row: 1 },
      { piece: 'wN', col: 2, row: 2 },
      { piece: 'wP', col: 3, row: 2 },
      { piece: 'bK', col: 3, row: 1 },
    ]}
  />
);

const SNIPER = (
  <Scene
    theme="purple"
    pieces={[
      { piece: 'bQ', col: 2, row: 1 },
      { piece: 'bP', col: 3, row: 2 },
    ]}
  >
    <span className="scene-piece" style={{ left: 0, top: '66.9%' }}><RifleBishop piece="wB" /></span>
    <svg className="scene-shot" viewBox="0 0 400 225" aria-hidden="true">
      <line x1="84" y1="160" x2="250" y2="82" />
      <circle cx="250" cy="82" r="38" />
      <path d="M250 32v30M250 102v30M200 82h30M270 82h30" />
    </svg>
  </Scene>
);

const SPAWNER = (
  <Scene
    theme="gold"
    pieces={[
      { piece: 'wK', col: 0, row: 2 },
      { piece: 'wP', col: 1, row: 2 },
      { piece: 'wP', col: 2, row: 1 },
      { piece: 'wP', col: 3, row: 2 },
      { piece: 'bP', col: 0, row: 0 },
      { piece: 'bP', col: 3, row: 0 },
    ]}
  >
    <svg className="scene-plus" viewBox="0 0 400 225" aria-hidden="true">
      <path d="M278 60h34M295 43v34M78 95h26M91 82v26" />
    </svg>
  </Scene>
);

const PORTAL = (
  <Scene
    theme="green"
    pieces={[
      { piece: 'wN', col: 1, row: 1 },
      { piece: 'bP', col: 3, row: 2 },
    ]}
  >
    <svg className="scene-portal" viewBox="0 0 400 225" aria-hidden="true">
      <ellipse className="blue" cx="50" cy="100.5" rx="24" ry="40" />
      <ellipse className="orange" cx="350" cy="100.5" rx="24" ry="40" />
    </svg>
  </Scene>
);

const BOMB = (
  <Scene
    theme="ember"
    pieces={[
      { piece: 'bN', col: 0, row: 1 },
      { piece: 'bP', col: 3, row: 2 },
    ]}
  >
    <svg className="scene-blast" viewBox="0 0 400 225" aria-hidden="true">
      <path d="M200 8 l28 56 60 -22 -22 60 56 28 -56 28 22 60 -60 -22 -28 56 -28 -56 -60 22 22 -60 -56 -28 56 -28 -22 -60 60 22 z" />
    </svg>
    <span className="scene-piece" style={{ left: '37.5%', top: '31%' }}><BombPiece level={2} color="w" /></span>
  </Scene>
);

const SCP = (
  <Scene
    theme="brown"
    pieces={[
      { piece: 'wN', col: 0, row: 2 },
      { piece: 'bB', col: 3, row: 1 },
    ]}
  >
    <span className="scene-piece" style={{ left: '37.5%', top: '6%', width: '38%' }}><Scp096 /></span>
  </Scene>
);

const SCP173 = (
  <Scene
    theme="stone"
    pieces={[
      { piece: 'wK', col: 3, row: 1 },
      { piece: 'bP', col: 0, row: 2 },
    ]}
  >
    <span className="scene-piece" style={{ left: '20%', top: '6%', width: '38%' }}><Scp173 /></span>
  </Scene>
);

const MIDAS = (
  <Scene
    theme="green"
    pieces={[
      { piece: 'wB', col: 0, row: 2 },
      { piece: 'bP', col: 3, row: 2 },
    ]}
  >
    <span className="scene-piece scene-gold" style={{ left: '25%', top: '22.4%' }}><GoldStatue piece="bQ" /></span>
    <span className="scene-piece scene-gold" style={{ left: '50%', top: '-22%' }}><GoldStatue piece="bR" /></span>
  </Scene>
);

const BOSS = (
  <Scene
    theme="void"
    pieces={[
      { piece: 'bQ', col: 0, row: 1 },
      { piece: 'wK', col: 3, row: 2 },
    ]}
  >
    <span className="scene-hole" />
    <span className="scene-piece" style={{ left: '26%', top: '22%' }}><ThiefSprite /></span>
  </Scene>
);

const THUMBNAILS: Record<GameMode, React.ReactNode> = { classic: CLASSIC, sniper: SNIPER, spawner: SPAWNER, portal: PORTAL, bomb: BOMB, scp: SCP, scp173: SCP173, boss: BOSS, midas: MIDAS };

export function Menu({ onPick }: { onPick: (mode: GameMode) => void }) {
  const sections = [...new Set(MODES.map((mode) => mode.section))];
  return (
    <main className="menu">
      {sections.map((section) => (
        <section key={section}>
          <h2>{section}</h2>
          <div className="card-grid">
            {MODES.filter((mode) => mode.section === section).map((mode) => (
              <button key={mode.id} className="card" onClick={() => onPick(mode.id)}>
                {THUMBNAILS[mode.id]}
                <span className="card-title">{mode.title}</span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}

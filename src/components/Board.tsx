import { memo, useMemo, useState, type CSSProperties } from 'react';
import { Chessboard, defaultPieces } from 'react-chessboard';
import type { Move, Square } from 'chess.js';
import type { BombLevel } from '../lib/bomb';
import type { Portal } from '../lib/portals';
import type { Shot } from '../lib/sniper';
import type { Pull } from '../lib/magnet';
import { BOMB_PIECES, HORSE_PIECES, MAGNET_PIECES, RIFLE_PIECES } from './riflePieces';
import { Scp096 } from './Scp096';
import { GoldStatue } from './GoldStatue';
import { Thief } from './Thief';
import { Scp173 } from './Scp173';
import type { Color } from '../useGame';

const LAST_MOVE: CSSProperties = { backgroundColor: 'rgba(255, 255, 51, 0.42)' };
const SELECTED: CSSProperties = { backgroundColor: 'rgba(255, 255, 51, 0.55)' };
const CHECK: CSSProperties = {
  background: 'radial-gradient(circle, rgba(235, 40, 30, 0.95) 0%, rgba(235, 40, 30, 0.55) 45%, transparent 75%)',
};
const DOT = 'radial-gradient(circle, rgba(0, 0, 0, 0.16) 24%, transparent 26%)';
const RING = 'radial-gradient(circle, transparent 58%, rgba(0, 0, 0, 0.16) 60%, rgba(0, 0, 0, 0.16) 76%, transparent 78%)';

const CROSSHAIR: CSSProperties = {
  backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none" stroke="#e5222b" stroke-width="5"><circle cx="50" cy="50" r="33"/><path d="M50 5v24M50 71v24M5 50h24M71 50h24"/></svg>',
  )}")`,
  backgroundSize: '100% 100%',
};

function portalStyle({ color, ttl }: Portal): CSSProperties {
  const rgb = color === 'blue' ? '47, 140, 255' : '255, 140, 26';
  const alpha = ttl === null ? 1 : 0.5;
  return { boxShadow: `inset 0 0 0 5px rgba(${rgb}, ${alpha}), inset 0 0 20px 8px rgba(${rgb}, ${alpha * 0.8})` };
}

const FOG: CSSProperties = { backgroundColor: '#3f3d3a', backgroundImage: 'none', boxShadow: 'inset 0 0 0 1px rgba(0, 0, 0, 0.18)' };

const HOLE: CSSProperties = { backgroundColor: '#08080b', backgroundImage: 'none', boxShadow: 'inset 0 0 12px 6px #000, inset 0 0 0 2px #2a2a33' };

/** One of the player's pieces that would pull something: double-click it. */
const MAGNET_READY: CSSProperties = { boxShadow: 'inset 0 0 0 4px rgba(225, 45, 45, 0.95), inset 0 0 16px 4px rgba(225, 45, 45, 0.45)' };
/** An enemy piece some magnet would pull. */
const MAGNET_TARGET: CSSProperties = { boxShadow: 'inset 0 0 0 4px rgba(70, 135, 255, 0.95), inset 0 0 16px 4px rgba(70, 135, 255, 0.45)' };

const GILDABLE: CSSProperties = { boxShadow: 'inset 0 0 0 3px rgba(240, 190, 40, 0.95), inset 0 0 14px 3px rgba(255, 210, 60, 0.55)' };

const SEER: CSSProperties = { backgroundColor: 'rgba(229, 34, 43, 0.5)' };
/** SCP-173's watchers are what's keeping you safe, so they read as good news. */
const WATCHER: CSSProperties = { backgroundColor: 'rgba(70, 190, 110, 0.5)' };

const SPAWN_DOT = 'radial-gradient(circle, rgba(232, 176, 40, 0.55) 16%, transparent 18%)';

function ghostPawn(color: Color): CSSProperties {
  const fill = color === 'white' ? '#fff' : '#222';
  const stroke = color === 'white' ? '#222' : '#ddd';
  const pawn = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45"><path d="M22.5 9a4.5 4.5 0 0 0-3.6 7.2 7 7 0 0 0-1.4 11.3c-3 1.1-7 5-7 12h24c0-7-4-10.900-7-12a7 7 0 0 0-1.400-11.300A4.500 4.500 0 0 0 22.500 9z" fill="${fill}" stroke="${stroke}" stroke-width="1.500" opacity="0.6"/></svg>`;
  return { backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(pawn)}")`, backgroundSize: '100% 100%' };
}

/** Square centre in a 0-100 board coordinate space. */
function squareCentre(square: string, orientation: Color) {
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]) - 1;
  return orientation === 'white'
    ? { x: file * 12.5 + 6.25, y: (7 - rank) * 12.5 + 6.25 }
    : { x: (7 - file) * 12.5 + 6.25, y: rank * 12.5 + 6.25 };
}

interface BoardProps {
  fen: string;
  orientation: Color;
  playerColor: Color | null;
  canMove: boolean;
  lastMove: { from: string; to: string; spawn?: string; exit?: string } | null;
  selected: Square | null;
  legalTargets: Move[];
  checkSquare: Square | null;
  hint: { from: string; to: string } | null;
  promotion: { to: Square } | null;
  shots: Shot[];
  tracer: Shot | null;
  spawnSquares: string[];
  showSpawnDots: boolean;
  rifleColor: 'w' | 'b' | null;
  scpSquare: string | null;
  peanut: boolean;
  seers: string[];
  portalMode: boolean;
  portals: Portal[];
  fogSquares: string[];
  holes: string[];
  gold: { square: string; piece: string }[];
  gildable: string[];
  magnetPulls: Record<string, Pull[]>;
  magnetColor: 'w' | 'b' | null;
  thief: { square: string; piece: string } | null;
  bombColor: 'w' | 'b' | null;
  bombLevel: BombLevel;
  blastArea: string[];
  hearts: string | null;
  horseColor: 'w' | 'b' | null;
  /** True while a teleporting piece pops out, so it appears instead of sliding. */
  instant: boolean;
  onSquareRightClick: (square: Square) => void;
  onSelect: (square: Square | null) => void;
  onDrop: (from: Square, to: Square) => boolean;
  onSquareClick: (square: Square) => void;
  onPromote: (piece: string | null) => void;
}

function BoardInner(props: BoardProps) {
  const { fen, orientation, playerColor, canMove, lastMove, selected, legalTargets, checkSquare, hint, promotion, shots, tracer, spawnSquares, showSpawnDots, rifleColor, scpSquare, peanut, seers, portalMode, portals, instant, fogSquares, bombColor, bombLevel, blastArea, holes, thief, gold, gildable, magnetPulls, magnetColor, hearts, horseColor } = props;
  const magnetSourceSquares = useMemo(() => Object.keys(magnetPulls), [magnetPulls]);
  const magnetTargets = useMemo(() => [...new Set(Object.values(magnetPulls).flat().map((pull) => pull.from))], [magnetPulls]);
  const [hovered, setHovered] = useState<string | null>(null);

  const squareStyles = useMemo(() => {
    const styles: Record<string, CSSProperties> = {};
    if (lastMove) {
      styles[lastMove.from] = LAST_MOVE;
      styles[lastMove.to] = LAST_MOVE;
      if (lastMove.spawn) styles[lastMove.spawn] = LAST_MOVE;
      if (lastMove.exit) styles[lastMove.exit] = LAST_MOVE;
    }
    for (const square of seers) styles[square] = peanut ? WATCHER : SEER;
    if (checkSquare) styles[checkSquare] = CHECK;
    if (selected) styles[selected] = SELECTED;
    for (const move of legalTargets) {
      const image = move.captured ? RING : DOT;
      styles[move.to] = { ...styles[move.to], backgroundImage: image };
    }
    for (const shot of shots) styles[shot.to] = { ...styles[shot.to], ...CROSSHAIR };
    if (showSpawnDots) {
      for (const square of spawnSquares) styles[square] = { ...styles[square], backgroundImage: SPAWN_DOT };
    }
    if (hovered && !selected && playerColor && spawnSquares.includes(hovered)) {
      styles[hovered] = { ...styles[hovered], ...ghostPawn(playerColor) };
    }
    for (const portal of portals) styles[portal.square] = { ...styles[portal.square], ...portalStyle(portal) };
    for (const square of gildable) styles[square] = { ...styles[square], ...GILDABLE };
    for (const square of magnetTargets) styles[square] = { ...styles[square], ...MAGNET_TARGET };
    for (const square of magnetSourceSquares) styles[square] = { ...styles[square], ...MAGNET_READY };
    for (const square of holes) styles[square] = HOLE;
    for (const square of fogSquares) styles[square] = FOG;
    return styles;
  }, [lastMove, checkSquare, selected, legalTargets, shots, spawnSquares, showSpawnDots, hovered, playerColor, seers, portals, fogSquares, peanut, holes, gildable, magnetTargets, magnetSourceSquares]);

  // Hovering a magnet shows where each piece it would pull ends up.
  const arrows = useMemo(() => {
    const list = hint ? [{ startSquare: hint.from, endSquare: hint.to, color: 'rgba(120, 190, 60, 0.9)' }] : [];
    for (const pull of (hovered && magnetPulls[hovered]) || []) {
      list.push({ startSquare: pull.from, endSquare: pull.to, color: 'rgba(70, 135, 255, 0.85)' });
    }
    return list;
  }, [hint, hovered, magnetPulls]);

  return (
    <div className="board-frame" onContextMenu={portalMode ? (event) => event.preventDefault() : undefined}>
      <Chessboard
        options={{
          id: 'main-board',
          allowDrawingArrows: !portalMode,
          ...(rifleColor ? { pieces: RIFLE_PIECES[rifleColor] } : {}),
          ...(bombColor ? { pieces: BOMB_PIECES[bombLevel][bombColor] } : {}),
          ...(magnetColor ? { pieces: MAGNET_PIECES[magnetColor] } : {}),
          ...(horseColor ? { pieces: HORSE_PIECES[horseColor] } : {}),
          position: fen,
          boardOrientation: orientation,
          squareStyles,
          arrows,
          darkSquareStyle: { backgroundColor: '#769656' },
          lightSquareStyle: { backgroundColor: '#eeeed2' },
          darkSquareNotationStyle: { color: '#eeeed2', fontWeight: 600 },
          lightSquareNotationStyle: { color: '#769656', fontWeight: 600 },
          dropSquareStyle: { boxShadow: 'inset 0 0 0 3px rgba(255, 255, 255, 0.75)' },
          animationDurationInMs: 170,
          showAnimations: !instant,
          allowDragging: canMove,
          allowDragOffBoard: false,
          canDragPiece: ({ piece }) => canMove && !!playerColor && piece.pieceType[0] === playerColor[0],
          onPieceDrag: ({ square }) => props.onSelect(square as Square | null),
          onPieceDrop: ({ sourceSquare, targetSquare }) => {
            if (!targetSquare || targetSquare === sourceSquare) return false;
            return props.onDrop(sourceSquare as Square, targetSquare as Square);
          },
          onSquareClick: ({ square }) => props.onSquareClick(square as Square),
          onSquareRightClick: ({ square }) => props.onSquareRightClick(square as Square),
          onMouseOverSquare: ({ square }) => setHovered(square),
          onMouseOutSquare: () => setHovered(null),
        }}
      />
      {scpSquare && <ScpOverlay square={scpSquare} orientation={orientation} peanut={peanut} enraged={peanut ? seers.length === 0 : seers.length > 0} />}
      {magnetSourceSquares.map((square) => {
        const { x, y } = squareCentre(square, orientation);
        return <div key={square} className="magnet-tag" data-tag={square} style={{ left: `${x - 6.25}%`, top: `${y - 6.25}%` }}><span>2×</span></div>;
      })}
      {hearts && (() => {
        const { x, y } = squareCentre(hearts, orientation);
        return (
          <div className="hearts" data-hearts={hearts} style={{ left: `${x - 6.25}%`, top: `${y - 6.25}%` }}>
            <i>♥</i><i>♥</i><i>♥</i>
          </div>
        );
      })()}
      {blastArea.map((square) => {
        const { x, y } = squareCentre(square, orientation);
        return <div key={square} className="blast-cell" data-blast={square} style={{ left: `${x - 6.25}%`, top: `${y - 6.25}%` }} />;
      })}
      {gold.map(({ square, piece }) => {
        const { x, y } = squareCentre(square, orientation);
        return (
          <div key={square} className="gold-cell" style={{ left: `${x - 6.25}%`, top: `${y - 6.25}%` }}>
            <GoldStatue piece={piece} />
          </div>
        );
      })}
      {thief && (() => {
        const { x, y } = squareCentre(thief.square, orientation);
        return <Thief left={x - 6.25} top={y - 6.25} piece={thief.piece} />;
      })()}
      {tracer && <Tracer shot={tracer} orientation={orientation} />}
      {promotion && playerColor && <PromotionPicker to={promotion.to} color={playerColor} orientation={orientation} onPick={props.onPromote} />}
    </div>
  );
}

function ScpOverlay({ square, orientation, peanut, enraged }: { square: string; orientation: Color; peanut: boolean; enraged: boolean }) {
  const { x, y } = squareCentre(square, orientation);
  return (
    <div className={`scp ${enraged ? 'enraged' : ''}`} data-scp={square} style={{ left: `${x - 6.25}%`, top: `${y - 6.25}%` }}>
      {peanut ? <Scp173 /> : <Scp096 />}
    </div>
  );
}

function Tracer({ shot, orientation }: { shot: Shot; orientation: Color }) {
  const from = squareCentre(shot.from, orientation);
  const to = squareCentre(shot.to, orientation);
  return (
    <svg className="tracer" viewBox="0 0 100 100" aria-hidden="true">
      <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} />
      <circle cx={to.x} cy={to.y} r="5" />
    </svg>
  );
}

function PromotionPicker({ to, color, orientation, onPick }: { to: Square; color: Color; orientation: Color; onPick: (piece: string | null) => void }) {
  const file = to.charCodeAt(0) - 97;
  const column = orientation === 'white' ? file : 7 - file;
  const atTop = (to[1] === '8') === (orientation === 'white');
  const prefix = color === 'white' ? 'w' : 'b';
  return (
    <div className="promotion-backdrop" onClick={() => onPick(null)}>
      <div className="promotion" style={{ left: `${column * 12.5}%`, [atTop ? 'top' : 'bottom']: 0 }} role="menu" aria-label="Choose a promotion piece">
        {['q', 'n', 'r', 'b'].map((piece) => {
          const Piece = defaultPieces[prefix + piece.toUpperCase()];
          return (
            <button key={piece} role="menuitem" aria-label={`Promote to ${piece}`} onClick={(e) => { e.stopPropagation(); onPick(piece); }}>
              <Piece />
            </button>
          );
        })}
      </div>
    </div>
  );
}

export const Board = memo(BoardInner);

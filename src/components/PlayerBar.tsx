import { useEffect, useState, type RefObject } from 'react';
import { defaultPieces } from 'react-chessboard';
import { materialFromFen } from '../lib/material';
import type { ClockState, Color } from '../useGame';

function formatClock(ms: number) {
  const totalSeconds = Math.ceil(ms / 1000);
  if (ms < 20_000) return `0:${(ms / 1000).toFixed(1).padStart(4, '0')}`;
  const minutes = Math.floor(totalSeconds / 60);
  return `${minutes}:${String(totalSeconds % 60).padStart(2, '0')}`;
}

function Clock({ clockRef, color, active }: { clockRef: RefObject<ClockState>; color: Color; active: boolean }) {
  const [ms, setMs] = useState(0);
  useEffect(() => {
    const read = () => setMs(clockRef.current[color]);
    const timer = setInterval(read, 100);
    read();
    return () => clearInterval(timer);
  }, [clockRef, color]);
  return <div className={`clock ${color} ${active ? 'active' : ''} ${ms < 20_000 ? 'low' : ''}`}>{formatClock(ms)}</div>;
}

interface PlayerBarProps {
  name: string;
  detail?: string;
  isBot: boolean;
  color: Color;
  fen: string;
  startFen: string;
  thinking?: boolean;
  clockRef: RefObject<ClockState>;
  showClock: boolean;
  clockActive: boolean;
}

export function PlayerBar({ name, detail, isBot, color, fen, startFen, thinking, clockRef, showClock, clockActive }: PlayerBarProps) {
  const { captured, lead } = materialFromFen(fen, startFen);
  const prefix = color === 'white' ? 'b' : 'w';
  const myLead = color === 'white' ? lead : -lead;
  const Avatar = defaultPieces[isBot ? 'wN' : 'wP'];
  return (
    <div className="player-bar">
      <div className={`avatar ${isBot ? 'bot' : ''}`}><Avatar /></div>
      <div className="player-meta">
        <div className="player-name">
          {name} {detail && <span className="player-detail">{detail}</span>}
          {thinking && <span className="thinking" aria-label="Thinking"><i /><i /><i /></span>}
        </div>
        <div className="captured">
          {captured[color].map((type, i) => {
            const Piece = defaultPieces[prefix + type.toUpperCase()];
            return <span key={i} className={`cap ${captured[color][i + 1] !== type ? 'gap' : ''}`}><Piece /></span>;
          })}
          {myLead > 0 && <span className="lead">+{myLead}</span>}
        </div>
      </div>
      {showClock && <Clock clockRef={clockRef} color={color} active={clockActive} />}
    </div>
  );
}

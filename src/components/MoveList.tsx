import { useEffect, useRef } from 'react';
import type { PlyRecord } from '../useGame';

interface MoveListProps {
  history: PlyRecord[];
  displayedIndex: number;
  onSelect: (index: number | null) => void;
  onStep: (delta: number) => void;
}

export function MoveList({ history, displayedIndex, onSelect, onStep }: MoveListProps) {
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scroller.current?.querySelector('.current')?.scrollIntoView({ block: 'nearest' });
  }, [displayedIndex, history.length]);

  const rows = [];
  for (let i = 0; i < history.length; i += 2) rows.push(i);
  const last = history.length - 1;
  const cell = (index: number) =>
    history[index] && (
      <button className={`${index === displayedIndex ? 'current' : ''} ${history[index].shot ? 'shot' : ''}`} onClick={() => onSelect(index === last ? null : index)}>
        {history[index].san}
      </button>
    );

  return (
    <section className="moves">
      <div className="move-scroll" ref={scroller}>
        {rows.length === 0 && <p className="note">Moves will appear here.</p>}
        {rows.map((i) => (
          <div className="move-row" key={i}>
            <span className="move-no">{i / 2 + 1}.</span>
            {cell(i)}
            {cell(i + 1)}
          </div>
        ))}
      </div>
      <div className="move-nav">
        <button aria-label="First move" onClick={() => onStep(-history.length - 1)}>«</button>
        <button aria-label="Previous move" onClick={() => onStep(-1)}>‹</button>
        <button aria-label="Next move" onClick={() => onStep(1)}>›</button>
        <button aria-label="Latest move" onClick={() => onSelect(null)}>»</button>
      </div>
    </section>
  );
}

import { ELO_STEP, MAX_ELO, MIN_ELO, levelName, strengthFor } from '../lib/strength';

const PRESETS = [400, 800, 1200, 1600, 2000, 2400, 2800];

export function EloControl({ elo, onChange, inGame }: { elo: number; onChange: (elo: number) => void; inGame: boolean }) {
  const { depth, weakRate } = strengthFor(elo);
  return (
    <section className="elo">
      <div className="elo-head">
        <span className="section-label">Bot strength</span>
        <span className="elo-value"><strong>{elo}</strong> {levelName(elo)}</span>
      </div>
      <input
        type="range"
        aria-label="Bot Elo"
        min={MIN_ELO}
        max={MAX_ELO}
        step={ELO_STEP}
        value={elo}
        style={{ '--fill': `${((elo - MIN_ELO) / (MAX_ELO - MIN_ELO)) * 100}%` } as React.CSSProperties}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <div className="elo-presets">
        {PRESETS.map((preset) => (
          <button key={preset} className={preset === elo ? 'on' : ''} onClick={() => onChange(preset)}>{preset}</button>
        ))}
      </div>
      <p className="note">
        Stockfish depth {depth}, {weakRate === 0 ? 'no deliberate errors' : `about ${Math.round(weakRate * 100)}% weakened moves`}.
        {inGame && ' Applies from the bot\'s next move.'}
      </p>
    </section>
  );
}

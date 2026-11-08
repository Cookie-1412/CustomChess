import type { Analysis } from '../lib/stockfishApi';
import type { Color, GameResult } from '../useGame';

/** Share of the bar for White, 0 to 100. */
function whiteShare(evaluation: Analysis | null, result: GameResult | null): number {
  if (result) return result.winner === null ? 50 : result.winner === 'white' ? 100 : 0;
  if (!evaluation) return 50;
  if (evaluation.mate !== null) return evaluation.mate >= 0 ? 100 : 0;
  const pawns = evaluation.evaluation ?? 0;
  return 100 / (1 + Math.exp(-0.45 * pawns));
}

function label(evaluation: Analysis | null, result: GameResult | null): string {
  if (result) return result.winner === null ? '½' : result.winner === 'white' ? '1-0' : '0-1';
  if (!evaluation) return '0.0';
  if (evaluation.mate !== null) return `M${Math.abs(evaluation.mate)}`;
  return Math.abs(evaluation.evaluation ?? 0).toFixed(1);
}

export function EvalBar({ evaluation, result, orientation }: { evaluation: Analysis | null; result: GameResult | null; orientation: Color }) {
  const share = whiteShare(evaluation, result);
  const whiteAhead = share >= 50;
  const labelAtBottom = whiteAhead === (orientation === 'white');
  return (
    <div className="eval-bar" role="img" aria-label={`Evaluation ${label(evaluation, result)}`}>
      <div className="eval-white" style={{ height: `${share}%`, [orientation === 'white' ? 'bottom' : 'top']: 0 }} />
      <span className={`eval-label ${labelAtBottom ? 'bottom' : 'top'} ${whiteAhead ? 'on-white' : 'on-black'}`}>{label(evaluation, result)}</span>
    </div>
  );
}

import { Chess } from 'chess.js';

const VALUES: Record<string, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };

/** Kept low enough that heavy noise can make a beginner bot overlook a mate. */
const MATE_SCORE = 1500;

/** Material plus a small centre bonus, from White's point of view. */
function evaluate(chess: Chess): number {
  let score = 0;
  chess.board().forEach((row, r) => {
    row.forEach((sq, c) => {
      if (!sq) return;
      const centre = sq.type === 'k' ? 0 : 7 - (Math.abs(r - 3.5) + Math.abs(c - 3.5));
      const value = VALUES[sq.type] + centre * 3;
      score += sq.color === 'w' ? value : -value;
    });
  });
  return score;
}

/** Score for `side` after its move, assuming the opponent's most forcing reply. */
function scoreAfterMove(chess: Chess, side: 'w' | 'b'): number {
  const sign = side === 'w' ? 1 : -1;
  if (chess.isCheckmate()) return MATE_SCORE;
  if (chess.isDraw()) return 0;

  let worst = sign * evaluate(chess);
  for (const reply of chess.moves().filter((san) => /[x+#]/.test(san))) {
    chess.move(reply);
    const score = chess.isCheckmate() ? -MATE_SCORE : sign * evaluate(chess);
    chess.undo();
    if (score < worst) worst = score;
  }
  return worst;
}

/** Standard normal sample (Box-Muller). */
function gaussian(rng: () => number): number {
  const u = Math.max(rng(), Number.EPSILON);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
}

/**
 * Picks a plausible but imperfect move with a shallow search plus noise.
 * More noise means more blunders. Returns UCI, or null if there are no moves.
 * A piece on a `frozen` square is never moved.
 */
export function pickWeakMove(fen: string, noiseCp: number, rng: () => number = Math.random, frozen?: string | string[] | null): string | null {
  const chess = new Chess(fen);
  const side = chess.turn();
  let best: string | null = null;
  let bestScore = -Infinity;

  for (const move of chess.moves({ verbose: true })) {
    if (Array.isArray(frozen) ? frozen.includes(move.from) : move.from === frozen) continue;
    // Noise would otherwise pick pointless underpromotions.
    if (move.promotion && move.promotion !== 'q') continue;
    chess.move(move);
    const score = scoreAfterMove(chess, side) + gaussian(rng) * noiseCp;
    chess.undo();
    if (score > bestScore) {
      bestScore = score;
      best = move.from + move.to + (move.promotion ?? '');
    }
  }
  return best;
}

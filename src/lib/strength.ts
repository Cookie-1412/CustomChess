/**
 * Maps a target Elo to bot behaviour.
 *
 * The free Stockfish API has no Elo or skill option, and it rejects depths
 * below 5, which is already far too strong for a beginner. Strength is
 * therefore emulated in two ways: the search depth sent to Stockfish, and how
 * often the bot plays an imperfect local move in place of Stockfish's choice.
 *
 * These anchors are hand-tuned estimates. They have not been calibrated
 * against rated play, so treat the Elo as a difficulty scale.
 */
export const MIN_ELO = 400;
export const MAX_ELO = 2800;
export const ELO_STEP = 50;

export interface Strength {
  /** Stockfish search depth, 5 to 15 (the API's accepted range). */
  depth: number;
  /** Chance per move of playing a local imperfect move, 0 to 1. */
  weakRate: number;
  /** Random noise (centipawns) added to the local picker's scores. */
  noiseCp: number;
}

const ANCHORS: Array<[elo: number, depth: number, weakRate: number, noiseCp: number]> = [
  [400, 5, 0.75, 400],
  [800, 5, 0.5, 250],
  [1200, 5, 0.3, 150],
  [1600, 6, 0.15, 80],
  [2000, 8, 0.06, 40],
  [2400, 11, 0.015, 20],
  [2800, 15, 0, 0],
];

export function strengthFor(elo: number): Strength {
  const e = Math.min(MAX_ELO, Math.max(MIN_ELO, elo));
  const upper = Math.max(1, ANCHORS.findIndex(([a]) => a >= e));
  const [e0, d0, w0, n0] = ANCHORS[upper - 1];
  const [e1, d1, w1, n1] = ANCHORS[upper];
  const t = (e - e0) / (e1 - e0);
  const mix = (a: number, b: number) => a + (b - a) * t;
  return { depth: Math.round(mix(d0, d1)), weakRate: mix(w0, w1), noiseCp: mix(n0, n1) };
}

export function levelName(elo: number): string {
  if (elo < 800) return 'Beginner';
  if (elo < 1200) return 'Casual';
  if (elo < 1600) return 'Club player';
  if (elo < 2000) return 'Advanced';
  if (elo < 2400) return 'Expert';
  return 'Master';
}

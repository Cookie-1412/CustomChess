import type { BombLevel } from './bomb';
import type { SpawnDifficulty, SpawnRule } from './spawner';

export type SideChoice = 'white' | 'black' | 'random';

export interface TimeControl {
  id: string;
  label: string;
  /** Minutes per side, or 0 for no clock. */
  minutes: number;
  incrementSec: number;
}

export const TIME_CONTROLS: TimeControl[] = [
  { id: 'none', label: 'No clock', minutes: 0, incrementSec: 0 },
  { id: '3+2', label: '3 | 2', minutes: 3, incrementSec: 2 },
  { id: '5+0', label: '5 min', minutes: 5, incrementSec: 0 },
  { id: '10+0', label: '10 min', minutes: 10, incrementSec: 0 },
  { id: '15+10', label: '15 | 10', minutes: 15, incrementSec: 10 },
];

export interface Settings {
  elo: number;
  side: SideChoice;
  timeControlId: string;
  sound: boolean;
  showEval: boolean;
  spawnRule: SpawnRule;
  spawnDifficulty: SpawnDifficulty;
  portalDifficulty: 'easy' | 'hard';
  scpDifficulty: 'easy' | 'hard';
  scp173Difficulty: 'easy' | 'hard';
  bombLevel: BombLevel;
}

const KEY = 'chess-game-settings';
const DEFAULTS: Settings = { elo: 1200, side: 'white', timeControlId: 'none', sound: true, showEval: false, spawnRule: 'and', spawnDifficulty: 'hard', portalDifficulty: 'easy', scpDifficulty: 'easy', scp173Difficulty: 'easy', bombLevel: 1 };

export function loadSettings(): Settings {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    return DEFAULTS;
  }
}

export function saveSettings(settings: Settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Storage can be unavailable (private mode). Settings then last for the session.
  }
}

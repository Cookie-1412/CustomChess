export type GameMode = 'classic' | 'sniper' | 'spawner' | 'scp' | 'scp173' | 'portal' | 'bomb' | 'boss' | 'midas' | 'magnet' | 'horses';

export interface ModeInfo {
  id: GameMode;
  title: string;
  section: string;
}

/** Everything shown on the main menu. Add new modes here. */
export const MODES: ModeInfo[] = [
  { id: 'classic', title: 'Normal Chess', section: 'Classic' },
  { id: 'sniper', title: 'Sniper Bishops', section: 'Powerups' },
  { id: 'spawner', title: 'Pawn Spawner', section: 'Powerups' },
  { id: 'portal', title: 'Portals', section: 'Powerups' },
  { id: 'bomb', title: 'Queen Bomb', section: 'Powerups' },
  { id: 'midas', title: 'Midas Touch', section: 'Powerups' },
  { id: 'magnet', title: 'Magnets', section: 'Powerups' },
  { id: 'horses', title: 'Horse Breeding', section: 'Powerups' },
  { id: 'scp', title: 'Stockfish vs SCP-096', section: 'Challenges' },
  { id: 'scp173', title: 'Stockfish vs SCP-173', section: 'Challenges' },
  { id: 'boss', title: 'Boss Fight', section: 'Challenges' },
];

/** Modes with a neutral creature on the board, sharing its hidden piece, spawn and fog. */
export const isScpMode = (mode: GameMode | null | undefined) => mode === 'scp' || mode === 'scp173';

export const modeInfo = (id: GameMode) => MODES.find((mode) => mode.id === id)!;

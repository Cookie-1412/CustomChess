import { useState } from 'react';
import { Board } from './components/Board';
import { EloControl } from './components/EloControl';
import { EvalBar } from './components/EvalBar';
import { Menu } from './components/Menu';
import { MoveList } from './components/MoveList';
import { PlayerBar } from './components/PlayerBar';
import { BOMB_LEVELS } from './lib/bomb';
import type { Power } from './lib/boss';
import { modeInfo } from './lib/modes';
import { TIME_CONTROLS, type SideChoice } from './lib/settings';
import type { SpawnDifficulty } from './lib/spawner';
import { levelName } from './lib/strength';
import { useGame, type Color, type GameResult, type MoveSource } from './useGame';

const SIDES: Array<{ id: SideChoice; label: string }> = [
  { id: 'white', label: 'White' },
  { id: 'random', label: 'Random' },
  { id: 'black', label: 'Black' },
];

const NO_SEERS: string[] = [];

const POWERS: Array<{ id: Power; name: string; how: string }> = [
  { id: 'snatch', name: 'Snatch', how: 'Double left-click an enemy piece' },
  { id: 'hole', name: 'Hole', how: 'Double left-click an empty square' },
  { id: 'pawn', name: 'Summon', how: 'Double right-click your first row' },
];

const PORTAL_DIFFICULTIES: Array<{ id: 'easy' | 'hard'; label: string; note: string }> = [
  { id: 'easy', label: 'Easy', note: 'Placing a portal closes the previous one of that colour straight away.' },
  { id: 'hard', label: 'Hard', note: 'The previous portal stays open for the next 2 moves, for both sides.' },
];

const SCP_DIFFICULTIES: Array<{ id: 'easy' | 'hard'; label: string; note: string }> = [
  { id: 'easy', label: 'Easy', note: 'You can see the whole board.' },
  { id: 'hard', label: 'Hard', note: 'Fog of war: you only see the squares your pieces can move to or attack. Stockfish sees everything.' },
];

const DIFFICULTIES: Array<{ id: SpawnDifficulty; label: string; note: string }> = [
  { id: 'easy', label: 'Easy', note: 'Spawn on any empty square. On a back rank the pawn promotes immediately.' },
  { id: 'hard', label: 'Hard', note: 'Spawn anywhere except the first and last ranks.' },
];

function describeSource(source: MoveSource | null): string {
  if (!source) return 'Waiting for the bot\'s first move.';
  if (source.kind === 'stockfish' && source.standIn) {
    return `Bot's last move: Stockfish at depth ${source.depth}, on a simplified board (too many pawns for the API).`;
  }
  if (source.kind === 'stockfish') return `Bot's last move: Stockfish at depth ${source.depth}.`;
  if (source.kind === 'weakened') return 'Bot\'s last move: a deliberate weakened move.';
  return 'Bot\'s last move: local backup, not Stockfish.';
}

function headline(result: GameResult, playerColor: Color): string {
  if (result.winner === null) return 'Draw';
  return result.winner === playerColor ? 'You won' : 'You lost';
}

function GameOverDialog({ result, playerColor, onRematch, onSetup, onClose }: {
  result: GameResult; playerColor: Color; onRematch: () => void; onSetup: () => void; onClose: () => void;
}) {
  return (
    <div className="dialog-backdrop">
      <div className="dialog" role="dialog" aria-modal="true" aria-label="Game over">
        <h2>{headline(result, playerColor)}</h2>
        <p>by {result.reason}</p>
        <button className="primary" onClick={onRematch}>Rematch</button>
        <button onClick={onSetup}>New game settings</button>
        <button className="plain" onClick={onClose}>Review the board</button>
      </div>
    </div>
  );
}

export default function App() {
  const g = useGame();
  const { game, result, settings } = g;
  const [dismissedResult, setDismissedResult] = useState<GameResult | null>(null);

  const playerColor: Color = game?.playerColor ?? 'white';
  const botColor: Color = playerColor === 'white' ? 'black' : 'white';
  // Before a game starts, cosmetic pieces follow the side picked in setup.
  const scpLevel = g.mode === 'scp173' ? settings.scp173Difficulty : settings.scpDifficulty;
  const pieceSide: 'w' | 'b' = game ? (playerColor === 'white' ? 'w' : 'b') : settings.side === 'black' ? 'b' : 'w';
  const orientation: Color = g.flipped ? botColor : playerColor;
  const topColor: Color = orientation === 'white' ? 'black' : 'white';
  const bottomColor: Color = orientation;
  const hasClock = !!game && game.timeControl.minutes > 0;
  const sideToMove: Color = g.spawnPending ? playerColor : (g.history.length % 2 === 0) ? 'white' : 'black';
  const clockRunning = !!game && !result && g.history.length > 0;

  if (!g.mode) return <Menu onPick={g.openMode} />;

  const bar = (color: Color) => {
    const isBot = color === botColor;
    return (
      <PlayerBar
        name={isBot ? 'Stockfish' : 'You'}
        detail={isBot ? `~${settings.elo} ${levelName(settings.elo)}` : undefined}
        isBot={isBot}
        color={color}
        fen={g.fog ? g.startFen : g.displayedFen}
        startFen={g.startFen}
        thinking={isBot && g.thinking}
        clockRef={g.clockRef}
        showClock={hasClock}
        clockActive={clockRunning && sideToMove === color}
      />
    );
  };

  return (
    <div className="app">
      <main className="play-area">
        {settings.showEval && game && !g.fog && <EvalBar evaluation={g.evaluation} result={result} orientation={orientation} />}
        <div className="board-column">
          {bar(topColor)}
          <Board
            fen={g.boardFen}
            orientation={orientation}
            playerColor={game ? playerColor : null}
            canMove={g.canMove}
            lastMove={g.lastMove}
            selected={g.selected}
            legalTargets={g.legalTargets}
            checkSquare={g.inCheckSquare}
            hint={g.hint}
            promotion={g.promotion}
            shots={g.shots}
            tracer={g.tracer}
            spawnSquares={g.spawnSquares}
            showSpawnDots={g.spawnPending}
            rifleColor={g.mode === 'sniper' ? pieceSide : null}
            scpSquare={g.displayedScp}
            peanut={g.mode === 'scp173'}
            portalMode={g.mode === 'portal' || g.mode === 'boss'}
            holes={g.mode === 'midas' ? NO_SEERS : g.displayedHoles}
            gold={g.displayedGold}
            gildable={g.gildable}
            magnetPulls={g.magnetPulls}
            magnetColor={g.mode === 'magnet' ? pieceSide : null}
            thief={g.thief}
            portals={g.displayedPortals}
            instant={g.popping}
            fogSquares={g.fogSquares}
            bombColor={g.mode === 'bomb' ? pieceSide : null}
            bombLevel={game?.bombLevel ?? settings.bombLevel}
            blastArea={g.blastArea}
            hearts={g.hearts}
            horseColor={g.mode === 'horses' ? pieceSide : null}
            onSquareRightClick={g.rightClickSquare}
            seers={g.isLive ? g.seers : NO_SEERS}
            onSelect={g.setSelected}
            onDrop={g.tryMove}
            onSquareClick={g.clickSquare}
            onPromote={g.choosePromotion}
          />
          {bar(bottomColor)}
        </div>
      </main>

      <aside className="panel">
        <header className="panel-title">
          {(!game || result) && <button className="back" onClick={g.backToMenu} aria-label="Back to menu">‹ Menu</button>}
          <h1>{modeInfo(g.mode).title}</h1>
        </header>

        <div className="panel-body">
          {g.mode === 'sniper' && (
            <p className="rules">Double-click any piece your bishops attack diagonally to shoot it without moving. Firing uses your turn.</p>
          )}
          {g.mode === 'bomb' && (
            <p className="rules bomb-rules">
              {game ? `Level ${game.bombLevel}, ${BOMB_LEVELS[game.bombLevel - 1].label}. ` : ''}Your queen moves normally. If she's captured she explodes, killing every piece in the area from both sides, except the kings.
            </p>
          )}
          {g.mode === 'portal' && (
            <div className="rules portal-rules">
              <p>Double left-click an empty square for a blue portal, double right-click for orange. It's free, then make your move. Either side's pieces can go through.</p>
              {game && (
                <p className="portal-legend">
                  {g.displayedPortals.length === 0 && `No portals yet (${game.portalHard ? 'Hard' : 'Easy'} game).`}
                  {g.displayedPortals.map((p) => (
                    <span key={p.square} className={`portal-chip ${p.color}`}>{p.color} {p.square}{p.ttl !== null && ` (closes in ${p.ttl})`}</span>
                  ))}
                </p>
              )}
            </div>
          )}
          {g.mode === 'horses' && (
            <p className="rules horse-rules">
              Move one of your knights next to another of your knights (any of the 8 surrounding squares) and a new knight appears on a random empty square beside that herd. One foal per move.
            </p>
          )}
          {g.mode === 'magnet' && (
            <div className="rules magnet-rules">
              <p>Double-click one of your knights, bishops, rooks or queens to pull every enemy piece it attacks right beside it. Knights pull to their diagonal square, if it's empty. It's free, once per turn.</p>
              {game && <p className="magnet-status" data-used={g.powersUsed.magnet}>{g.powersUsed.magnet ? 'Magnet used. It recharges when you move.' : 'Magnet ready.'}</p>}
              {game && !g.powersUsed.magnet && (
                <p className="magnet-legend">
                  <span className="swatch source" /> 2× your piece to double-click
                  <span className="swatch target" /> enemy it would pull
                  <br />Hover a red piece to see where each pull lands.
                </p>
              )}
            </div>
          )}
          {g.mode === 'midas' && (
            <p className="rules midas-rules">
              Double-click any enemy piece your pieces attack to turn it into a permanent gold blocker. It's free and doesn't use your turn. Pieces you can gild glow gold.
            </p>
          )}
          {g.mode === 'boss' && (
            <section className="powers">
              <span className="section-label">Powers, once each before you move</span>
              {POWERS.map((power) => (
                <div key={power.id} className={`power ${g.powersUsed[power.id] ? 'used' : ''}`} data-power={power.id}>
                  <strong>{power.name}</strong>
                  <span>{power.how}</span>
                  <em>{g.powersUsed[power.id] ? 'Used' : 'Ready'}</em>
                </div>
              ))}
            </section>
          )}
          {g.mode === 'scp173' && (
            <p className="rules scp-rules">
              {g.seers.length > 0
                ? `SCP-173 is frozen, watched by ${g.seers.join(', ')}.`
                : `After Black moves, if no piece can attack SCP-173, it makes a knight jump towards the king fewest jumps away. If it reaches a king, that side loses.${g.fog ? ' Fog of war is on.' : ''}`}
            </p>
          )}
          {g.mode === 'scp' && (
            <p className="rules scp-rules">
              {g.seers.length > 0
                ? `SCP-096 has been seen by ${g.seers.join(', ')}. It strikes after Black moves.`
                : `After Black moves, SCP-096 eats a piece that can attack it, from either side. It can't be captured, and a king eaten loses the game.${g.fog ? ' Fog of war is on.' : ''}`}
            </p>
          )}
          {g.mode === 'spawner' && (
            <section>
              <span className="section-label">Turn rule{game && ` (${game.spawnEasy ? 'Easy' : 'Hard'} game)`}</span>
              <div className="segmented rule-toggle">
                {(['and', 'or'] as const).map((rule) => (
                  <button key={rule} className={settings.spawnRule === rule ? 'on' : ''} disabled={g.spawnPending} onClick={() => g.updateSettings({ spawnRule: rule })}>{rule.toUpperCase()}</button>
                ))}
              </div>
              <p className="rules spawn-status">
                {g.spawnPending
                  ? 'Now click an empty square to spawn your pawn.'
                  : settings.spawnRule === 'and'
                    ? 'Move a piece, then spawn a pawn.'
                    : 'Move a piece, or click an empty square to spawn a pawn.'}
              </p>
            </section>
          )}
          <EloControl elo={settings.elo} onChange={(elo) => g.updateSettings({ elo })} inGame={!!game && !result} />

          {!game && (
            <>
              {g.mode === 'bomb' && (
                <section>
                  <span className="section-label">Level</span>
                  <div className="segmented">
                    {BOMB_LEVELS.map(({ level, label }) => (
                      <button key={level} className={settings.bombLevel === level ? 'on' : ''} onClick={() => g.updateSettings({ bombLevel: level })}>{level}. {label}</button>
                    ))}
                  </div>
                  <p className="note difficulty-note">{BOMB_LEVELS.find(({ level }) => level === settings.bombLevel)!.note}</p>
                </section>
              )}
              {(g.mode === 'scp' || g.mode === 'scp173') && (
                <section>
                  <span className="section-label">Difficulty</span>
                  <div className="segmented">
                    {SCP_DIFFICULTIES.map((level) => (
                      <button key={level.id} className={scpLevel === level.id ? 'on' : ''} onClick={() => g.updateSettings(g.mode === 'scp173' ? { scp173Difficulty: level.id } : { scpDifficulty: level.id })}>{level.label}</button>
                    ))}
                  </div>
                  <p className="note difficulty-note">{SCP_DIFFICULTIES.find((level) => level.id === scpLevel)!.note}</p>
                </section>
              )}
              {g.mode === 'portal' && (
                <section>
                  <span className="section-label">Difficulty</span>
                  <div className="segmented">
                    {PORTAL_DIFFICULTIES.map((level) => (
                      <button key={level.id} className={settings.portalDifficulty === level.id ? 'on' : ''} onClick={() => g.updateSettings({ portalDifficulty: level.id })}>{level.label}</button>
                    ))}
                  </div>
                  <p className="note difficulty-note">{PORTAL_DIFFICULTIES.find((level) => level.id === settings.portalDifficulty)!.note}</p>
                </section>
              )}
              {g.mode === 'spawner' && (
                <section>
                  <span className="section-label">Difficulty</span>
                  <div className="segmented">
                    {DIFFICULTIES.map((level) => (
                      <button key={level.id} className={settings.spawnDifficulty === level.id ? 'on' : ''} onClick={() => g.updateSettings({ spawnDifficulty: level.id })}>{level.label}</button>
                    ))}
                  </div>
                  <p className="note difficulty-note">{DIFFICULTIES.find((level) => level.id === settings.spawnDifficulty)!.note}</p>
                </section>
              )}
              <section>
                <span className="section-label">Play as</span>
                <div className="segmented">
                  {SIDES.map((side) => (
                    <button key={side.id} className={settings.side === side.id ? 'on' : ''} onClick={() => g.updateSettings({ side: side.id })}>{side.label}</button>
                  ))}
                </div>
              </section>
              <section>
                <span className="section-label">Time control</span>
                <div className="segmented wrap">
                  {TIME_CONTROLS.map((tc) => (
                    <button key={tc.id} className={settings.timeControlId === tc.id ? 'on' : ''} onClick={() => g.updateSettings({ timeControlId: tc.id })}>{tc.label}</button>
                  ))}
                </div>
              </section>
              <button className="primary big" onClick={g.startGame}>Play</button>
            </>
          )}

          {game && (
            <>
              {g.retryWaitMs !== null && (
                <div className="banner" role="status">
                  Stockfish API is busy. Retrying in {Math.round(g.retryWaitMs / 1000)}s. The bot's clock is paused.
                </div>
              )}
              {g.engineError && (
                <div className="banner error" role="alert">
                  <p>{g.engineError}. The bot's clock is paused.</p>
                  <div className="banner-actions">
                    <button onClick={g.retryBot}>Retry Stockfish</button>
                    <button onClick={g.playBackupMove}>Play a backup move</button>
                  </div>
                </div>
              )}
              <MoveList history={g.moveList} displayedIndex={g.displayedIndex} onSelect={g.setViewIndex} onStep={g.stepView} />
              <p className="note source">{describeSource(g.lastSource)}</p>
              {!g.isLive && <p className="note">Viewing an earlier position. Press » to return.</p>}

              <div className="actions">
                <button onClick={g.requestHint} disabled={!g.canMove || g.hintLoading || g.fog}>{g.hintLoading ? 'Thinking…' : 'Hint'}</button>
                <button onClick={g.takeBack} disabled={!g.canTakeBack}>Takeback</button>
                <button onClick={() => g.setFlipped((f) => !f)}>Flip</button>
                <button onClick={g.copyPgn} disabled={g.fog}>Copy PGN</button>
              </div>
              {result ? (
                <div className="actions two">
                  <button className="primary" onClick={g.startGame}>Rematch</button>
                  <button onClick={g.backToSetup}>New game</button>
                </div>
              ) : (
                <div className="actions two">
                  <button className="danger" onClick={g.resign}>Resign</button>
                  <button onClick={g.backToSetup}>Abandon</button>
                </div>
              )}
            </>
          )}
        </div>

        <footer className="toggles">
          <label><input type="checkbox" checked={settings.sound} onChange={(e) => g.updateSettings({ sound: e.target.checked })} /> Sound</label>
          <label><input type="checkbox" checked={settings.showEval} onChange={(e) => g.updateSettings({ showEval: e.target.checked })} /> Eval bar</label>
        </footer>
      </aside>

      {g.toast && <div className="toast" role="status">{g.toast}</div>}
      {result && result !== dismissedResult && game && (
        <GameOverDialog
          result={result}
          playerColor={playerColor}
          onRematch={g.startGame}
          onSetup={g.backToSetup}
          onClose={() => setDismissedResult(result)}
        />
      )}
    </div>
  );
}

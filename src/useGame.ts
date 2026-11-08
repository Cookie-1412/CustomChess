import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Chess, type Square } from 'chess.js';
import { EngineError, stockfish, type Analysis } from './lib/stockfishApi';
import { strengthFor } from './lib/strength';
import { pickWeakMove } from './lib/weakMove';
import { playSound } from './lib/sound';
import { buildPgn } from './lib/pgn';
import { fenAfterShot, findShots, shotLabel, type Shot } from './lib/sniper';
import { blastSan, detonate, type BombLevel } from './lib/bomb';
import {
  NO_POWERS_USED, afterHole, afterSnatch, afterSummon, bossSan, canDig, engineBlockers, canSnatch, canSummon, hasBossMove, pawnSquare, powerCanEscape, stripHoles, withHoles,
  type Power, type PowersUsed,
} from './lib/boss';
import { afterGild, gildCanEscape, midasTargets, type GoldPiece } from './lib/midas';
import { ALL_SQUARES, fogFen, visibleSquares } from './lib/fog';
import { isScpMode, modeInfo, type GameMode } from './lib/modes';
import { addPortal, exitFor, portalSan, teleport, tickPortals, type Portal, type PortalColor } from './lib/portals';
import { engineFen, findSpawns, isBackRank, placePawn, spawnLabel, startFenFor, type SpawnPiece } from './lib/spawner';
import { afterKingEaten, afterStrike, findSeers, findWatchers, pickJump, pickVictim, positionKey, randomScpStart, scpSan, stripScp, withScp } from './lib/scp';
import { TIME_CONTROLS, loadSettings, saveSettings, type Settings, type TimeControl } from './lib/settings';

export type Color = 'white' | 'black';

export interface ActiveGame {
  mode: GameMode;
  playerColor: Color;
  startFen: string;
  scpStart: Square | null;
  /** Pawn Spawner on easy, fixed for the game: spawns may use the back ranks. */
  spawnEasy: boolean;
  /** Portals on Hard, fixed for the game: replaced portals linger for 2 moves. */
  portalHard: boolean;
  /** Queen Bomb's blast size, fixed for the game. */
  bombLevel: BombLevel;
  /** SCP-096 on Hard, fixed for the game: fog of war until it ends. */
  scpHard: boolean;
  timeControl: TimeControl;
}

/** One ply of the game: a normal move, or a sniper shot. */
export interface PlyRecord {
  san: string;
  from: string;
  to: string;
  color: 'w' | 'b';
  after: string;
  shot?: boolean;
  /** Square of a pawn spawned this turn. */
  spawn?: string;
  /** Where SCP-096 stands after this ply. */
  scp?: Square;
  /** Open portals after this ply. */
  portals?: Portal[];
  /** True if this move went through a portal. */
  teleported?: boolean;
  /** Where a teleporting piece came out. */
  exit?: string;
  /** True if this capture set off the queen. */
  blast?: boolean;
  /** Holes on the board after this ply. */
  holes?: Square[];
  /** Gold blockers after this ply. */
  gold?: GoldPiece[];
}

export interface GameResult {
  winner: Color | null;
  reason: string;
}

/** Where the bot's last move came from, shown so the Elo mechanism is visible. */
export type MoveSource = { kind: 'stockfish'; depth: number; standIn: boolean } | { kind: 'weakened' } | { kind: 'backup' };

export interface ClockState {
  white: number;
  black: number;
}

const EVAL_DEPTH = 10;
const HINT_DEPTH = 12;
const TICK_MS = 100;
const DOUBLE_CLICK_MS = 320;
const TRACER_MS = 480;
const STRIKE_DELAY_MS = 550;
const TELEPORT_PAUSE_MS = 400;
const BLAST_DELAY_MS = 300;
const BLAST_SHOW_MS = 650;
const THIEF_ARRIVE_MS = 430;
const THIEF_EXIT_MS = 470;

const NO_SQUARES: Square[] = [];
const NO_GOLD: GoldPiece[] = [];

const colorOf = (turn: 'w' | 'b'): Color => (turn === 'w' ? 'white' : 'black');
const other = (color: Color): Color => (color === 'white' ? 'black' : 'white');
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function detectResult(chess: Chess, game: ActiveGame): GameResult | null {
  const spawner = game.mode === 'spawner';
  // A spawner with no moves can still block a check or spawn out of stalemate.
  if (spawner && colorOf(chess.turn()) === game.playerColor && (chess.isCheckmate() || chess.isStalemate())) {
    if (findSpawns(chess.fen(), game.playerColor, game.spawnEasy).length > 0) return null;
  }
  if (chess.isCheckmate()) return { winner: other(colorOf(chess.turn())), reason: 'checkmate' };
  if (chess.isStalemate()) return { winner: null, reason: 'stalemate' };
  if (!spawner && chess.isInsufficientMaterial()) return { winner: null, reason: 'insufficient material' };
  if (chess.isThreefoldRepetition()) return { winner: null, reason: 'threefold repetition' };
  if (chess.isDrawByFiftyMoves()) return { winner: null, reason: 'the 50-move rule' };
  return null;
}

/** Game end for SCP-096 mode, where chess.js would count the hidden piece's moves. */
function detectScpResult(chess: Chess, scp: Square, positions: string[]): GameResult | null {
  const hasMove = chess.moves({ verbose: true }).some((m) => m.from !== scp);
  if (!hasMove) {
    return chess.inCheck() ? { winner: other(colorOf(chess.turn())), reason: 'checkmate' } : { winner: null, reason: 'stalemate' };
  }
  if (new Chess(stripScp(chess.fen(), scp)).isInsufficientMaterial()) return { winner: null, reason: 'insufficient material' };
  const latest = positions[positions.length - 1];
  if (positions.filter((key) => key === latest).length >= 3) return { winner: null, reason: 'threefold repetition' };
  if (chess.isDrawByFiftyMoves()) return { winner: null, reason: 'the 50-move rule' };
  return null;
}

/** Game end for Boss Fight and Midas Touch, where a player with no moves may still have a power to use. */
function detectBossResult(chess: Chess, game: ActiveGame, holes: Square[], positions: string[], used: PowersUsed): GameResult | null {
  if (!hasBossMove(chess, holes)) {
    const playerToMove = colorOf(chess.turn()) === game.playerColor;
    const stripped = stripHoles(chess.fen(), holes);
    const escape = game.mode === 'midas' ? gildCanEscape(stripped, holes, game.playerColor) : powerCanEscape(stripped, holes, game.playerColor, used);
    if (playerToMove && escape) return null;
    return chess.inCheck() ? { winner: other(colorOf(chess.turn())), reason: 'checkmate' } : { winner: null, reason: 'stalemate' };
  }
  const latest = positions[positions.length - 1];
  if (latest && positions.filter((key) => key === latest).length >= 3) return { winner: null, reason: 'threefold repetition' };
  if (chess.isDrawByFiftyMoves()) return { winner: null, reason: 'the 50-move rule' };
  return null;
}

/** A flag is a draw when the side left on the clock has no mating material. */
function canMate(chess: Chess, color: Color): boolean {
  const pieces = chess.board().flat().filter((sq) => sq && sq.color === color[0] && sq.type !== 'k');
  if (pieces.length === 0) return false;
  return !(pieces.length === 1 && (pieces[0]!.type === 'n' || pieces[0]!.type === 'b'));
}

export function useGame() {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [mode, setMode] = useState<GameMode | null>(null);
  const [game, setGame] = useState<ActiveGame | null>(null);
  const [records, setRecords] = useState<PlyRecord[]>([]);
  const [tracer, setTracer] = useState<Shot | null>(null);
  const [spawnPending, setSpawnPending] = useState(false);
  const [scp, setScp] = useState<Square | null>(null);
  const [scpBusy, setScpBusy] = useState(false);
  const [portals, setPortals] = useState<Portal[]>([]);
  // A teleporting piece is shown reaching the entrance first, then pops out at the exit.
  const [transitFen, setTransitFen] = useState<string | null>(null);
  const [popping, setPopping] = useState(false);
  const [blastArea, setBlastArea] = useState<Square[]>(NO_SQUARES);
  const [holes, setHoles] = useState<Square[]>(NO_SQUARES);
  const [gold, setGold] = useState<GoldPiece[]>(NO_GOLD);
  const [powersUsed, setPowersUsed] = useState<PowersUsed>(NO_POWERS_USED);
  // Powers change the board between moves, so the latest position isn't in `records` yet.
  const [powerFen, setPowerFen] = useState<string | null>(null);
  const [thief, setThief] = useState<{ square: Square; piece: string } | null>(null);
  const [result, setResult] = useState<GameResult | null>(null);
  const [version, bumpVersion] = useReducer((v: number) => v + 1, 0);
  const [selected, setSelected] = useState<Square | null>(null);
  const [promotion, setPromotion] = useState<{ from: Square; to: Square; spawn?: boolean } | null>(null);
  const [viewIndex, setViewIndex] = useState<number | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [retryWaitMs, setRetryWaitMs] = useState<number | null>(null);
  const [engineError, setEngineError] = useState<string | null>(null);
  const [retryNonce, retryBot] = useReducer((n: number) => n + 1, 0);
  const [lastSource, setLastSource] = useState<MoveSource | null>(null);
  const [evaluation, setEvaluation] = useState<Analysis | null>(null);
  const [hint, setHint] = useState<{ from: string; to: string } | null>(null);
  const [hintLoading, setHintLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // One mutable instance keeps the repetition history; `version` drives re-renders.
  const [chess] = useState(() => new Chess());
  const clockRef = useRef<ClockState>({ white: 0, black: 0 });
  const modeRef = useRef<GameMode>('classic');
  const scpRef = useRef<Square | null>(null);
  const positionsRef = useRef<string[]>([]);
  const portalsRef = useRef<Portal[]>([]);
  const holesRef = useRef<Square[]>(NO_SQUARES);
  const goldRef = useRef<GoldPiece[]>(NO_GOLD);
  const powersRef = useRef<PowersUsed>(NO_POWERS_USED);
  const powerNotesRef = useRef<string[]>([]);
  const transitTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lastRightClickRef = useRef({ square: '', time: 0 });
  const strikeTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const hintAbortRef = useRef<AbortController | null>(null);
  const lastClickRef = useRef({ square: '', time: 0 });
  const pendingCaptureRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Read at decision time, so an Elo change mid-game applies to the very next bot move.
  const settingsRef = useRef(settings);
  const enginePausedRef = useRef(false);
  const gameStartedRef = useRef(false);
  const spawnPendingRef = useRef(false);
  useEffect(() => {
    spawnPendingRef.current = spawnPending;
    settingsRef.current = settings;
    gameStartedRef.current = records.length > 0;
    enginePausedRef.current = retryWaitMs !== null || engineError !== null;
  });

  useEffect(() => stockfish.setRetryListener(setRetryWaitMs), []);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((current) => {
      const next = { ...current, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);

  const showToast = useCallback((message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3500);
  }, []);

  const finish = useCallback((outcome: GameResult) => {
    setResult(outcome);
    setSpawnPending(false);
    setScpBusy(false);
    setPromotion(null);
    setSelected(null);
    if (settingsRef.current.sound) playSound('end');
  }, []);

  /** SCP-096 eats, or SCP-173 jumps to, `target`, as part of the Black move that ended the round. */
  const strike = useCallback(
    (target: Square) => {
      const from = scpRef.current!;
      const stripped = stripScp(chess.fen(), from);
      const peanut = modeRef.current === 'scp173';
      const name = peanut ? '173' : '096';
      const victim = new Chess(stripped).get(target);
      const ateKing = victim?.type === 'k';
      const after = ateKing ? afterKingEaten(stripped, target) : afterStrike(stripped, target);
      setRecords((list) => {
        const last = list[list.length - 1];
        return [...list.slice(0, -1), { ...last, san: `${last.san} ${name}${victim ? 'x' : '→'}${target}`, after, scp: target }];
      });
      scpRef.current = target;
      setScp(target);
      setScpBusy(false);
      setSelected(null);
      setHint(null);
      if (settingsRef.current.sound) playSound(peanut ? 'snap' : 'scream');
      if (victim && ateKing) {
        finish({ winner: other(colorOf(victim.color)), reason: peanut ? 'SCP-173 reaching the king' : 'SCP-096 eating the king' });
        return;
      }
      chess.load(withScp(after, target));
      positionsRef.current.push(positionKey(after, target));
      bumpVersion();
      const outcome = detectScpResult(chess, target, positionsRef.current);
      if (outcome) finish(outcome);
    },
    [chess, finish],
  );

  const applyMove = useCallback(
    (input: { from: string; to: string; promotion?: string }, active: ActiveGame) => {
      const { timeControl } = active;
      const scpSquare = isScpMode(active.mode) ? scpRef.current : null;
      const before = scpSquare ? stripScp(chess.fen(), scpSquare) : '';
      // Boss Fight's holes and Midas Touch's gold work the same way on the board.
      const bossGame = active.mode === 'boss' || active.mode === 'midas';
      const bossBefore = bossGame ? stripHoles(chess.fen(), holesRef.current) : '';
      const portalGame = active.mode === 'portal';
      const portalsBefore = portalsRef.current;
      const teleported = portalGame ? teleport(chess.fen(), input, portalsBefore) : null;
      // A pawn promoting at the portal's exit is not a promotion move to chess.js.
      const realPromotion = chess.moves({ verbose: true }).some((m) => m.from === input.from && m.to === input.to && m.promotion);
      const move = chess.move(realPromotion ? input : { from: input.from, to: input.to });
      let after = move.after;
      let san = move.san;
      let exitCapture = false;
      let exitSquare: Square | null = null;
      if (portalGame) {
        const nextPortals = tickPortals(portalsBefore);
        if (teleported) {
          const exit = exitFor(portalsBefore, input.to)!;
          exitSquare = exit;
          exitCapture = !!chess.get(exit);
          chess.load(teleported);
          after = teleported;
          san = portalSan(move.san, exit, chess, exitCapture);
          setTransitFen(move.after);
          clearTimeout(transitTimerRef.current);
          transitTimerRef.current = setTimeout(() => {
            setPopping(true);
            setTransitFen(null);
            transitTimerRef.current = setTimeout(() => setPopping(false), 90);
          }, TELEPORT_PAUSE_MS);
        }
        portalsRef.current = nextPortals;
        setPortals(nextPortals);
      }
      if (scpSquare) {
        // The mover's hidden piece can make chess.js drop a legal en passant square, so force it and let
        // a board without the hidden piece decide.
        after = new Chess(stripScp(chess.fen({ forceEnpassantSquare: true }), scpSquare)).fen();
        chess.load(withScp(after, scpSquare)); // Hands the hidden piece to the next side.
        positionsRef.current.push(positionKey(after, scpSquare));
        san = scpSan(before, input, move.san, chess, scpSquare);
      }
      if (bossGame) {
        const open = holesRef.current;
        after = new Chess(stripHoles(chess.fen({ forceEnpassantSquare: true }), open)).fen();
        chess.load(withHoles(after, open)); // Hands the hidden pieces to the next side.
        positionsRef.current.push(positionKey(after, open.join()));
        san = bossSan(bossBefore, input, move.san, chess, open);
        if (colorOf(move.color) === active.playerColor) {
          san = [...powerNotesRef.current, san].join(' ');
          powerNotesRef.current = [];
          powersRef.current = NO_POWERS_USED;
          setPowersUsed(NO_POWERS_USED);
        }
        setPowerFen(null);
      }
      // Only the player's queens are bombs, and they go off when the bot takes one.
      const blast =
        active.mode === 'bomb' && move.captured === 'q' && colorOf(move.color) !== active.playerColor
          ? detonate(chess.fen(), move.to, active.bombLevel)
          : null;
      if (blast) {
        chess.load(blast.fen);
        after = blast.fen;
        san = blastSan(move.san, chess);
      }
      const extras = { ...(bossGame ? { holes: holesRef.current, gold: goldRef.current } : {}), ...(blast ? { blast: true } : {}), ...(scpSquare ? { scp: scpSquare } : {}), ...(portalGame ? { portals: portalsRef.current, teleported: !!teleported, ...(exitSquare ? { exit: exitSquare } : {}) } : {}) };
      setRecords((list) => [...list, { san, from: move.from, to: move.to, color: move.color, after, ...extras }]);
      if (timeControl.incrementSec > 0) clockRef.current[colorOf(move.color)] += timeControl.incrementSec * 1000;
      setSelected(null);
      setHint(null);
      setViewIndex(null);
      bumpVersion();
      if (blast) {
        // The capture lands first, then the blast, then any result.
        setScpBusy(true);
        setTransitFen(move.after);
        clearTimeout(transitTimerRef.current);
        transitTimerRef.current = setTimeout(() => {
          setPopping(true);
          setTransitFen(null);
          setBlastArea(blast.squares);
          if (settingsRef.current.sound) playSound('boom');
          transitTimerRef.current = setTimeout(() => {
            setPopping(false);
            setBlastArea(NO_SQUARES);
            setScpBusy(false);
            const outcome = blast.kingExposed ? { winner: active.playerColor, reason: 'the blast exposing the king' } : detectResult(chess, active);
            if (outcome) finish(outcome);
          }, BLAST_SHOW_MS);
        }, BLAST_DELAY_MS);
        return;
      }
      const owesSpawn =
        active.mode === 'spawner' &&
        settingsRef.current.spawnRule === 'and' &&
        colorOf(move.color) === active.playerColor &&
        !chess.isCheckmate() &&
        findSpawns(chess.fen(), active.playerColor, active.spawnEasy).length > 0;
      if (owesSpawn) setSpawnPending(true);
      const outcome = scpSquare
        ? detectScpResult(chess, scpSquare, positionsRef.current)
        : bossGame
          ? detectBossResult(chess, active, holesRef.current, positionsRef.current, powersRef.current)
          : owesSpawn
            ? null
            : detectResult(chess, active);
      if (outcome) {
        finish(outcome);
        return;
      }
      if (settingsRef.current.sound) playSound(chess.inCheck() ? 'check' : teleported ? 'portal' : move.captured || exitCapture ? 'capture' : 'move');
      // Both sides have now moved, so the creature takes its turn.
      if (scpSquare && move.color === 'b') {
        const victim = active.mode === 'scp173' ? pickJump(after, scpSquare) : pickVictim(after, scpSquare);
        if (victim) {
          setScpBusy(true);
          strikeTimerRef.current = setTimeout(() => strike(victim), STRIKE_DELAY_MS);
        }
      }
    },
    [chess, finish, strike],
  );

  const applyUci = useCallback(
    (uci: string, active: ActiveGame) =>
      applyMove({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }, active),
    [applyMove],
  );

  /** Stockfish cannot see 096, and a side at 16 pieces could not fit its hidden piece anyway. */
  const toApiFen = useCallback((fen: string, active: ActiveGame) => {
    if (scpRef.current) return stripScp(fen, scpRef.current);
    if (active.mode !== 'boss' && active.mode !== 'midas') return engineFen(fen, active.playerColor);
    // Holes and gold block lines, so Stockfish gets a stand-in piece on each rather than an empty square.
    const holes = holesRef.current;
    return engineFen(engineBlockers(stripHoles(fen, holes), holes), active.playerColor);
  }, []);

  // Bot turn.
  useEffect(() => {
    if (!game || result || spawnPending || scpBusy || colorOf(chess.turn()) === game.playerColor) return;
    const controller = new AbortController();
    const { signal } = controller;

    const play = async () => {
      setThinking(true);
      setEngineError(null);
      const fen = chess.fen();
      const strength = strengthFor(settingsRef.current.elo);
      const startedAt = Date.now();
      let uci: string | null;
      let source: MoveSource;

      if (Math.random() < strength.weakRate) {
        uci = pickWeakMove(fen, strength.noiseCp, Math.random, scpRef.current ?? holesRef.current);
        source = { kind: 'weakened' };
      } else {
        try {
          const sentFen = toApiFen(fen, game);
          const analysis = await stockfish.analyze(sentFen, strength.depth, { signal });
          uci = analysis.bestMove;
          source = { kind: 'stockfish', depth: strength.depth, standIn: game.mode === 'spawner' && sentFen !== fen };
          if (!signal.aborted && analysis.bestMove) setEvaluation(analysis);
        } catch (error) {
          if (signal.aborted) return;
          setThinking(false);
          setEngineError(error instanceof EngineError ? error.message : 'Stockfish request failed');
          return;
        }
      }

      // A short pause so a locally chosen move does not snap back instantly.
      const minThinkMs = 450 + Math.random() * 500;
      await wait(Math.max(0, minThinkMs - (Date.now() - startedAt)));
      if (signal.aborted) return;

      const isLegal = (move: string | null) =>
        move !== null && chess.moves({ verbose: true }).some((m) => m.from !== scpRef.current && !holesRef.current.includes(m.from) && move.startsWith(m.from + m.to));
      // Stockfish saw a simplified board in these modes, so its reply may not fit the real one.
      if (!isLegal(uci) && game.mode !== 'classic' && game.mode !== 'sniper') {
        uci = pickWeakMove(fen, 0, Math.random, scpRef.current ?? holesRef.current);
        source = { kind: 'backup' };
      }
      const legal = isLegal(uci);
      setThinking(false);
      if (!legal) {
        setEngineError(`Stockfish returned an unusable move (${uci ?? 'none'})`);
        return;
      }
      setLastSource(source);
      applyUci(uci!, game);
    };

    void play();
    return () => {
      controller.abort();
      setThinking(false);
    };
  }, [game, result, version, retryNonce, chess, applyUci, spawnPending, scpBusy, toApiFen]);

  /** Keeps the game moving during an API outage. Labelled as such in the UI. */
  const playBackupMove = useCallback(() => {
    if (!game || result) return;
    const uci = pickWeakMove(chess.fen(), strengthFor(settingsRef.current.elo).noiseCp, Math.random, scpRef.current ?? holesRef.current);
    if (!uci) return;
    setEngineError(null);
    setLastSource({ kind: 'backup' });
    applyUci(uci, game);
  }, [game, result, chess, applyUci]);

  // Evaluation for the player's turn. Bot turns get one from the move request itself.
  useEffect(() => {
    if (!settings.showEval || !game || result || colorOf(chess.turn()) !== game.playerColor) return;
    if (isScpMode(game.mode) && game.scpHard) return; // The bar is hidden by the fog.
    const controller = new AbortController();
    stockfish
      .analyze(toApiFen(chess.fen(), game), EVAL_DEPTH, { background: true, signal: controller.signal })
      .then((analysis) => {
        if (!controller.signal.aborted && analysis.bestMove) setEvaluation(analysis);
      })
      .catch(() => {
        // The bar is optional: it keeps its last value and refreshes on the next move.
      });
    return () => controller.abort();
  }, [settings.showEval, game, result, version, chess, toApiFen]);

  // Clock.
  useEffect(() => {
    if (!game || result || game.timeControl.minutes === 0) return;
    let last = Date.now();
    const timer = setInterval(() => {
      const now = Date.now();
      const elapsed = now - last;
      last = now;
      if (!gameStartedRef.current) return;
      const side = spawnPendingRef.current ? game.playerColor : colorOf(chess.turn());
      // The bot should not lose on time because the API is down.
      if (side !== game.playerColor && enginePausedRef.current) return;
      clockRef.current[side] = Math.max(0, clockRef.current[side] - elapsed);
      if (clockRef.current[side] === 0) {
        const winner = other(side);
        const spawnerWins = (game.mode === 'spawner' || game.mode === 'boss') && winner === game.playerColor;
        finish(spawnerWins || canMate(chess, winner) ? { winner, reason: 'timeout' } : { winner: null, reason: 'timeout vs insufficient material' });
      }
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [game, result, chess, finish]);

  const resetBoard = useCallback(() => {
    hintAbortRef.current?.abort();
    clearTimeout(pendingCaptureRef.current);
    clearTimeout(strikeTimerRef.current);
    chess.reset();
    scpRef.current = null;
    positionsRef.current = [];
    portalsRef.current = [];
    setPortals([]);
    clearTimeout(transitTimerRef.current);
    setTransitFen(null);
    setPopping(false);
    setBlastArea(NO_SQUARES);
    holesRef.current = NO_SQUARES;
    goldRef.current = NO_GOLD;
    setGold(NO_GOLD);
    powersRef.current = NO_POWERS_USED;
    powerNotesRef.current = [];
    setHoles(NO_SQUARES);
    setPowersUsed(NO_POWERS_USED);
    setPowerFen(null);
    setThief(null);
    setScp(null);
    setScpBusy(false);
    setRecords([]);
    setTracer(null);
    setSpawnPending(false);
    setResult(null);
    setSelected(null);
    setPromotion(null);
    setViewIndex(null);
    setFlipped(false);
    setHint(null);
    setHintLoading(false);
    setEngineError(null);
    setLastSource(null);
    setEvaluation(null);
    bumpVersion();
  }, [chess]);

  const startGame = useCallback(() => {
    resetBoard();
    const { side, timeControlId } = settingsRef.current;
    const playerColor: Color = side === 'random' ? (Math.random() < 0.5 ? 'white' : 'black') : side;
    const timeControl = TIME_CONTROLS.find((t) => t.id === timeControlId) ?? TIME_CONTROLS[0];
    const ms = timeControl.minutes * 60_000;
    clockRef.current = { white: ms, black: ms };
    const startFen = startFenFor(modeRef.current, playerColor);
    const scpStart = isScpMode(modeRef.current) ? randomScpStart() : null;
    chess.load(scpStart ? withScp(startFen, scpStart) : startFen);
    scpRef.current = scpStart;
    setScp(scpStart);
    const spawnEasy = settingsRef.current.spawnDifficulty === 'easy';
    const portalHard = settingsRef.current.portalDifficulty === 'hard';
    const scpHard = (modeRef.current === 'scp173' ? settingsRef.current.scp173Difficulty : settingsRef.current.scpDifficulty) === 'hard';
    const { bombLevel } = settingsRef.current;
    setGame({ mode: modeRef.current, playerColor, timeControl, startFen, scpStart, spawnEasy, portalHard, scpHard, bombLevel });
  }, [resetBoard, chess]);

  const backToSetup = useCallback(() => {
    resetBoard();
    setGame(null);
  }, [resetBoard]);

  const openMode = useCallback((next: GameMode) => {
    modeRef.current = next;
    setMode(next);
  }, []);

  const backToMenu = useCallback(() => {
    backToSetup();
    setMode(null);
  }, [backToSetup]);

  const history = records;

  const isLive = viewIndex === null;
  const displayedIndex = viewIndex ?? history.length - 1;
  const startFen = game?.startFen ?? startFenFor(mode ?? 'classic', settings.side === 'black' ? 'black' : 'white');
  const displayedPortals = isLive ? portals : displayedIndex >= 0 ? (history[displayedIndex].portals ?? []) : [];
  const displayedFen = isLive && (transitFen || powerFen) ? (transitFen ?? powerFen!) : displayedIndex >= 0 ? history[displayedIndex].after : startFen;
  const displayedGold = isLive ? gold : displayedIndex >= 0 ? (history[displayedIndex].gold ?? NO_GOLD) : NO_GOLD;
  const displayedHoles = isLive ? holes : displayedIndex >= 0 ? (history[displayedIndex].holes ?? NO_SQUARES) : NO_SQUARES;
  const realScp = !game ? null : displayedIndex >= 0 ? (history[displayedIndex].scp ?? null) : game.scpStart;

  // Fog of war hides whatever the player's pieces can't see, until the game ends.
  const fog = !!game && isScpMode(game.mode) && game.scpHard && !result;
  const visible = useMemo(
    () => (fog ? visibleSquares(displayedFen, game.playerColor, realScp) : null),
    [fog, displayedFen, game, realScp],
  );
  const boardFen = useMemo(() => (visible ? fogFen(displayedFen, visible) : displayedFen), [visible, displayedFen]);
  const fogSquares = useMemo(() => (visible ? ALL_SQUARES.filter((square) => !visible.has(square)) : NO_SQUARES), [visible]);
  const displayedScp = visible && realScp && !visible.has(realScp) ? null : realScp;

  // The bot's moves and 096's meals would give away what the fog is hiding.
  const moveList = useMemo(() => {
    if (!fog) return history;
    const mine = game.playerColor[0];
    return history.map((record) => ({ ...record, san: record.color === mine ? record.san.replace(/ (096|173)[x→]\w+/, '') : '???' }));
  }, [fog, history, game]);
  const lastMove = displayedIndex >= 0 ? history[displayedIndex] : null;
  const playerTurn = !!game && !result && !scpBusy && (spawnPending || colorOf(chess.turn()) === game.playerColor);
  const canMove = playerTurn && isLive && !spawnPending && !transitFen;

  // Pieces that can currently see the creature.
  const seers = useMemo(() => {
    if (!scp || result) return NO_SQUARES;
    const stripped = stripScp(chess.fen(), scp);
    const all = game?.mode === 'scp173' ? findWatchers(stripped, scp) : findSeers(stripped, scp);
    return fog ? all.filter((square) => chess.get(square)?.color === game.playerColor[0]) : all;
  }, [scp, result, chess, version, fog, game]); // eslint-disable-line react-hooks/exhaustive-deps

  const spawnSquares = useMemo(() => {
    if (game?.mode !== 'spawner' || !playerTurn || !isLive) return [];
    const mustMoveFirst = !spawnPending && settings.spawnRule === 'and' && chess.moves().length > 0;
    return mustMoveFirst ? [] : findSpawns(chess.fen(), game.playerColor, game.spawnEasy);
  }, [game, playerTurn, isLive, spawnPending, settings.spawnRule, chess, version]); // eslint-disable-line react-hooks/exhaustive-deps

  const placeSpawn = useCallback(
    (square: Square, piece: SpawnPiece = 'p') => {
      if (!game) return;
      const after = placePawn(chess.fen(), square, game.playerColor, !spawnPending, piece);
      chess.load(after);
      const label = spawnLabel(square, chess, piece);
      const color = game.playerColor[0] as 'w' | 'b';
      setRecords((list) => {
        if (!spawnPending) return [...list, { san: label, from: square, to: square, color, after, spawn: square }];
        const last = list[list.length - 1];
        const merged = { ...last, san: `${last.san.replace(/[+#]$/, '')} ${label}`, after, spawn: square };
        return [...list.slice(0, -1), merged];
      });
      if (!spawnPending) clockRef.current[game.playerColor] += game.timeControl.incrementSec * 1000;
      setSpawnPending(false);
      setSelected(null);
      setHint(null);
      bumpVersion();
      const outcome = detectResult(chess, game);
      if (outcome) finish(outcome);
      else if (settingsRef.current.sound) playSound(chess.inCheck() ? 'check' : 'spawn');
    },
    [game, chess, spawnPending, finish],
  );

  // Fixed for the whole game: only the human's bishops are snipers.
  const shots = useMemo(
    () => (game?.mode === 'sniper' && canMove ? findShots(chess.fen()) : []),
    [game, canMove, chess, version], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const fire = useCallback(
    (shot: Shot) => {
      if (!game || !canMove) return;
      const color = chess.turn();
      const after = fenAfterShot(chess.fen(), shot.to);
      // A shot removes a piece, so earlier positions can never repeat and
      // losing chess.js's move history here does not affect draw detection.
      chess.load(after);
      setRecords((list) => [...list, { san: shotLabel(shot, chess), from: shot.from, to: shot.to, color, after, shot: true }]);
      clockRef.current[colorOf(color)] += game.timeControl.incrementSec * 1000;
      setTracer(shot);
      setTimeout(() => setTracer(null), TRACER_MS);
      setSelected(null);
      setHint(null);
      bumpVersion();
      const outcome = detectResult(chess, game);
      if (outcome) finish(outcome);
      else if (settingsRef.current.sound) playSound('shot');
    },
    [game, canMove, chess, finish],
  );

  const legalTargets = useMemo(
    () => (selected && canMove ? chess.moves({ square: selected, verbose: true }) : []),
    [selected, canMove, chess, version], // eslint-disable-line react-hooks/exhaustive-deps
  );

  /** Applies a power to the board. Powers are free: it stays the player's turn. */
  const commitPower = useCallback(
    (power: Power | null, active: ActiveGame, nextFen: string, note: string) => {
      const used = power ? { ...powersRef.current, [power]: true } : powersRef.current;
      powersRef.current = used;
      setPowersUsed(used);
      powerNotesRef.current = [...powerNotesRef.current, note];
      chess.load(withHoles(nextFen, holesRef.current));
      setPowerFen(nextFen);
      setSelected(null);
      setHint(null);
      bumpVersion();
      const outcome = detectBossResult(chess, active, holesRef.current, [], used);
      if (outcome) finish(outcome);
    },
    [chess, finish],
  );

  const spentAlready = useCallback(
    (power: Power) => {
      if (powersRef.current[power]) showToast('That power recharges when you move');
      return powersRef.current[power];
    },
    [showToast],
  );

  const snatch = useCallback(
    (square: Square, active: ActiveGame) => {
      if (spentAlready('snatch')) return;
      const stripped = stripHoles(chess.fen(), holesRef.current);
      if (!canSnatch(stripped, square, holesRef.current, active.playerColor)) {
        showToast(chess.get(square)?.type === 'k' ? "The king can't be snatched" : "That piece is shielding the king, so it can't be snatched");
        return;
      }
      const target = chess.get(square)!;
      const piece = `${target.color}${target.type.toUpperCase()}`;
      setScpBusy(true);
      setThief({ square, piece });
      strikeTimerRef.current = setTimeout(() => {
        if (settingsRef.current.sound) playSound('snatch');
        commitPower('snatch', active, afterSnatch(stripped, square), `x${target.type === 'p' ? 'P' : target.type.toUpperCase()}${square}`);
        strikeTimerRef.current = setTimeout(() => {
          setThief(null);
          setScpBusy(false);
        }, THIEF_EXIT_MS);
      }, THIEF_ARRIVE_MS);
    },
    [chess, commitPower, showToast, spentAlready],
  );

  const dig = useCallback(
    (square: Square, active: ActiveGame) => {
      if (spentAlready('hole')) return;
      const stripped = stripHoles(chess.fen(), holesRef.current);
      if (!canDig(stripped, square, holesRef.current)) return;
      const next = [...holesRef.current, square];
      holesRef.current = next;
      setHoles(next);
      if (settingsRef.current.sound) playSound('dig');
      commitPower('hole', active, afterHole(stripped, square), `O${square}`);
    },
    [chess, commitPower, spentAlready],
  );

  const summon = useCallback(
    (clicked: Square, active: ActiveGame) => {
      const square = pawnSquare(clicked, active.playerColor);
      if (!square || spentAlready('pawn')) return;
      const stripped = stripHoles(chess.fen(), holesRef.current);
      if (!canSummon(stripped, square, holesRef.current)) {
        showToast('That square is taken');
        return;
      }
      if (settingsRef.current.sound) playSound('spawn');
      commitPower('pawn', active, afterSummon(stripped, square, active.playerColor), `+${square}`);
    },
    [chess, commitPower, showToast, spentAlready],
  );

  // Pieces Midas Touch can turn to gold right now.
  const gildable = useMemo(
    () => (game?.mode === 'midas' && canMove ? midasTargets(stripHoles(chess.fen(), holes), holes, game.playerColor) : NO_SQUARES),
    [game, canMove, holes, chess, version], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const gild = useCallback(
    (square: Square, active: ActiveGame) => {
      const stripped = stripHoles(chess.fen(), holesRef.current);
      if (!midasTargets(stripped, holesRef.current, active.playerColor).includes(square)) {
        showToast(chess.get(square)?.type === 'k' ? "The king can't be turned to gold" : 'Midas Touch only works on pieces your pieces attack');
        return;
      }
      const target = chess.get(square)!;
      const nextGold = [...goldRef.current, { square, piece: `${target.color}${target.type.toUpperCase()}` }];
      goldRef.current = nextGold;
      setGold(nextGold);
      const nextHoles = [...holesRef.current, square];
      holesRef.current = nextHoles;
      setHoles(nextHoles);
      if (settingsRef.current.sound) playSound('gold');
      commitPower(null, active, afterGild(stripped, square), `Au${target.type === 'p' ? '' : target.type.toUpperCase()}${square}`);
    },
    [chess, commitPower, showToast],
  );

  const placePortal = useCallback(
    (color: PortalColor, square: Square) => {
      if (!game || !canMove || chess.get(square) || portalsRef.current.some((p) => p.square === square)) return;
      const next = addPortal(portalsRef.current, color, square, game.portalHard);
      portalsRef.current = next;
      setPortals(next);
      setSelected(null);
      setHint(null);
      if (settingsRef.current.sound) playSound('portal');
    },
    [game, canMove, chess],
  );

  const rightClickSquare = useCallback(
    (square: Square) => {
      if (game?.mode !== 'portal' && game?.mode !== 'boss') return;
      const now = Date.now();
      const last = lastRightClickRef.current;
      lastRightClickRef.current = { square, time: now };
      if (last.square !== square || now - last.time >= DOUBLE_CLICK_MS) return;
      if (game.mode === 'portal') placePortal('orange', square);
      else if (canMove) summon(square, game);
    },
    [game, placePortal, canMove, summon],
  );

  /** Returns true if the move was played. Promotions wait for the picker. */
  const tryMove = useCallback(
    (from: Square, to: Square): boolean => {
      if (!game || !canMove) return false;
      const matches = chess.moves({ square: from, verbose: true }).filter((m) => m.to === to);
      if (matches.length === 0) return false;
      const exit = game.mode === 'portal' ? exitFor(portalsRef.current, to) : null;
      const pawnPromotesAtExit = matches[0].piece === 'p' && !!exit && isBackRank(exit) && !!teleport(chess.fen(), { from, to }, portalsRef.current);
      if (matches.some((m) => m.promotion) || pawnPromotesAtExit) {
        setPromotion({ from, to });
        return false;
      }
      applyMove({ from, to }, game);
      return true;
    },
    [game, canMove, chess, applyMove],
  );

  const choosePromotion = useCallback(
    (piece: string | null) => {
      if (promotion?.spawn && piece) placeSpawn(promotion.to, piece as SpawnPiece);
      else if (promotion && piece && game) applyMove({ from: promotion.from, to: promotion.to, promotion: piece }, game);
      setPromotion(null);
      setSelected(null);
    },
    [promotion, game, applyMove, placeSpawn],
  );

  const clickSquare = useCallback(
    (square: Square) => {
      if (!selected && spawnSquares.includes(square)) {
        if (isBackRank(square)) setPromotion({ from: square, to: square, spawn: true });
        else placeSpawn(square);
        return;
      }
      if (!canMove || !game || square === scp) return;

      if (game.mode === 'boss' || game.mode === 'midas') {
        if (holesRef.current.includes(square)) return;
        const now = Date.now();
        const last = lastClickRef.current;
        lastClickRef.current = { square, time: now };
        const piece = chess.get(square);
        const mine = piece?.color === game.playerColor[0];
        if (!selected && !mine && last.square === square && now - last.time < DOUBLE_CLICK_MS) {
          if (game.mode === 'midas') {
            if (piece) gild(square, game);
          } else if (piece) snatch(square, game);
          else dig(square, game);
          return;
        }
      }

      if (game.mode === 'portal') {
        const now = Date.now();
        const last = lastClickRef.current;
        lastClickRef.current = { square, time: now };
        if (last.square === square && now - last.time < DOUBLE_CLICK_MS && !chess.get(square)) {
          placePortal('blue', square);
          return;
        }
      }

      const shot = shots.find((s) => s.to === square);
      if (shot) {
        const now = Date.now();
        const last = lastClickRef.current;
        const isDouble = last.square === square && now - last.time < DOUBLE_CLICK_MS;
        lastClickRef.current = { square, time: now };
        if (isDouble) {
          clearTimeout(pendingCaptureRef.current);
          fire(shots.find((s) => s.to === square && s.from === selected) ?? shot);
          return;
        }
        // Could be the first half of a double-click, so hold any capture briefly.
        if (selected) {
          const from = selected;
          pendingCaptureRef.current = setTimeout(() => {
            if (!tryMove(from, square)) setSelected(null);
          }, DOUBLE_CLICK_MS);
        }
        return;
      }

      if (selected && selected !== square && tryMove(selected, square)) return;
      const piece = chess.get(square);
      setSelected(piece && piece.color === game.playerColor[0] && selected !== square ? square : null);
    },
    [canMove, game, selected, tryMove, chess, shots, fire, spawnSquares, placeSpawn, scp, placePortal, snatch, dig, gild],
  );

  const resign = useCallback(() => {
    if (game && !result) finish({ winner: other(game.playerColor), reason: 'resignation' });
  }, [game, result, finish]);

  /** Undoes back through the player's last move, cancelling any bot move in progress. */
  const takeBack = useCallback(() => {
    if (!game || result) return;
    const mine = game.playerColor[0];
    const lastMine = records.findLastIndex((r) => r.color === mine);
    if (lastMine < 0) return;
    const kept = records.slice(0, lastMine);
    // Replayed rather than undone, because shots are not in chess.js's history.
    clearTimeout(pendingCaptureRef.current);
    clearTimeout(strikeTimerRef.current);
    setScpBusy(false);
    if (isScpMode(game.mode)) {
      const last = kept[kept.length - 1];
      const square = last?.scp ?? game.scpStart!;
      chess.load(withScp(last?.after ?? game.startFen, square));
      scpRef.current = square;
      setScp(square);
      positionsRef.current = kept.map((r) => positionKey(r.after, r.scp!));
    } else if (game.mode === 'boss' || game.mode === 'midas') {
      const last = kept[kept.length - 1];
      const restored = last?.holes ?? NO_SQUARES;
      const restoredGold = last?.gold ?? NO_GOLD;
      goldRef.current = restoredGold;
      setGold(restoredGold);
      holesRef.current = restored;
      setHoles(restored);
      chess.load(withHoles(last?.after ?? game.startFen, restored));
      positionsRef.current = kept.map((r) => positionKey(r.after, (r.holes ?? []).join()));
      powersRef.current = NO_POWERS_USED;
      powerNotesRef.current = [];
      setPowersUsed(NO_POWERS_USED);
      setPowerFen(null);
      setThief(null);
    } else {
      chess.load(game.startFen);
      for (const record of kept) {
        if (record.shot || record.spawn || record.teleported || record.blast) chess.load(record.after);
        else chess.move(record.san);
      }
      clearTimeout(transitTimerRef.current);
      setTransitFen(null);
      setPopping(false);
      setBlastArea(NO_SQUARES);
      if (game.mode === 'portal') {
        const restored = kept[kept.length - 1]?.portals ?? [];
        portalsRef.current = restored;
        setPortals(restored);
      }
    }
    setRecords(kept);
    setSpawnPending(false);
    setSelected(null);
    setHint(null);
    setPromotion(null);
    setViewIndex(null);
    setEngineError(null);
    bumpVersion();
  }, [game, result, chess, records]);

  const requestHint = useCallback(async () => {
    if (!canMove || hintLoading || !game) return;
    const controller = new AbortController();
    hintAbortRef.current = controller;
    const fen = chess.fen();
    setHintLoading(true);
    try {
      const { bestMove } = await stockfish.analyze(toApiFen(fen, game), HINT_DEPTH, { signal: controller.signal });
      const usable = bestMove && chess.moves({ verbose: true }).some((m) => m.from !== scpRef.current && !holesRef.current.includes(m.from) && bestMove.startsWith(m.from + m.to));
      if (chess.fen() !== fen) return;
      if (usable) setHint({ from: bestMove.slice(0, 2), to: bestMove.slice(2, 4) });
      else showToast('No hint for this position');
    } catch (error) {
      if (!controller.signal.aborted) showToast(error instanceof Error ? error.message : 'Hint failed');
    } finally {
      setHintLoading(false);
    }
  }, [canMove, hintLoading, game, chess, showToast, toApiFen]);

  const copyPgn = useCallback(async () => {
    if (!game) return;
    const bot = `Stockfish (~${settingsRef.current.elo})`;
    const pgn = buildPgn(
      {
        Event: modeInfo(game.mode).title,
        White: game.playerColor === 'white' ? 'You' : bot,
        Black: game.playerColor === 'black' ? 'You' : bot,
        Result: !result ? '*' : result.winner === null ? '1/2-1/2' : result.winner === 'white' ? '1-0' : '0-1',
      },
      records.map((r) => r.san),
    );
    try {
      await navigator.clipboard.writeText(pgn);
      showToast('PGN copied');
    } catch {
      showToast('Could not access the clipboard');
    }
  }, [game, result, records, showToast]);

  const stepView = useCallback(
    (delta: number) => {
      const target = Math.min(history.length - 1, Math.max(-1, displayedIndex + delta));
      setViewIndex(target === history.length - 1 ? null : target);
      setSelected(null);
    },
    [history.length, displayedIndex],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement) return;
      if (event.key === 'ArrowLeft') stepView(-1);
      if (event.key === 'ArrowRight') stepView(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [stepView]);

  return {
    settings, updateSettings,
    mode, openMode, backToMenu, shots, tracer, startFen, spawnSquares, spawnPending,
    displayedScp, seers, scpBusy, displayedPortals, rightClickSquare, popping,
    fog, boardFen, fogSquares, moveList, blastArea, displayedHoles, powersUsed, thief, displayedGold, gildable,
    game, result, history, version,
    displayedFen, displayedIndex, lastMove, isLive, canMove, playerTurn,
    inCheckSquare: isLive && chess.inCheck() ? findKing(chess) : null,
    selected, setSelected, legalTargets, promotion, choosePromotion,
    flipped, setFlipped, tryMove, clickSquare,
    thinking, retryWaitMs, engineError, retryBot, playBackupMove, lastSource,
    evaluation, hint, hintLoading, requestHint, toast,
    clockRef, startGame, backToSetup, resign, takeBack, copyPgn,
    setViewIndex, stepView,
    canTakeBack: !!game && !result && history.some((m) => m.color === game.playerColor[0]),
  };
}

function findKing(chess: Chess): Square | null {
  const turn = chess.turn();
  for (const sq of chess.board().flat()) {
    if (sq && sq.type === 'k' && sq.color === turn) return sq.square;
  }
  return null;
}

import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { engineFen, findSpawns, isBackRank, placePawn, spawnLabel, startFenFor } from './spawner';

const count = (fen: string, ch: string) => fen.split(' ')[0].split(ch).length - 1;
const whitePieces = (fen: string) => fen.split(' ')[0].replace(/[^A-Z]/g, '').length;
const occupied = (fen: string) => new Chess(fen).board().flat().filter((p) => p).map((p) => p!.square).sort();

describe('startFenFor', () => {
  it('gives the player only a king and one pawn, on either side', () => {
    const white = new Chess(startFenFor('spawner', 'white'));
    expect(white.board().flat().filter((p) => p?.color === 'w').map((p) => p!.type).sort()).toEqual(['k', 'p']);
    expect(white.board().flat().filter((p) => p?.color === 'b')).toHaveLength(16);
    const black = new Chess(startFenFor('spawner', 'black'));
    expect(black.board().flat().filter((p) => p?.color === 'b').map((p) => p!.type).sort()).toEqual(['k', 'p']);
    expect(black.turn()).toBe('w');
  });
  it('leaves other modes on the normal start', () => {
    expect(startFenFor('sniper', 'black')).toBe(new Chess().fen());
  });
});

describe('findSpawns', () => {
  const fen = startFenFor('spawner', 'white');
  it('offers empty squares on ranks 2 to 7 only', () => {
    const squares = findSpawns(fen, 'white');
    expect(squares).toContain('d4');
    expect(squares).toContain('a2');
    expect(squares).not.toContain('e2'); // Occupied.
    expect(squares).not.toContain('a7'); // Occupied.
    expect(squares.some((s) => s.endsWith('1') || s.endsWith('8'))).toBe(false);
  });
  it('in check, only offers squares that block it', () => {
    expect(findSpawns('4r2k/8/8/8/8/8/8/4K3 w - - 0 1', 'white').sort()).toEqual(['e2', 'e3', 'e4', 'e5', 'e6', 'e7']);
  });
  it('offers nothing against a check that cannot be blocked', () => {
    expect(findSpawns('7k/8/8/8/8/3n4/8/4K3 w - - 0 1', 'white')).toEqual([]);
    expect(findSpawns('7k/8/8/8/8/8/3q4/4K3 w - - 0 1', 'white')).toEqual([]);
  });
  it('is not limited to blocks after a move, when the turn has passed', () => {
    // Black is in check, but it is White spawning after a move.
    expect(findSpawns('4r2k/8/8/8/8/8/8/4K2R b - - 0 1', 'white').length).toBeGreaterThan(20);
  });
});

describe('findSpawns on easy', () => {
  const fen = startFenFor('spawner', 'white');
  it('adds the empty squares on both back ranks', () => {
    const squares = findSpawns(fen, 'white', true);
    expect(squares).toContain('a1');
    expect(squares).toContain('h1');
    expect(squares.filter((s) => s.endsWith('8'))).toEqual([]); // Black's back rank is full.
    expect(findSpawns('4k3/8/8/8/8/8/8/4K3 w - - 0 1', 'white', true)).toContain('a8');
  });
  it('never offers an occupied square', () => {
    const squares = findSpawns(fen, 'white', true);
    expect(squares).not.toContain('e1');
    expect(squares).not.toContain('e2');
  });
  it('can block a check along a back rank, which hard cannot', () => {
    const fen = '7k/8/8/8/8/8/8/K5r1 w - - 0 1';
    expect(findSpawns(fen, 'white')).toEqual([]);
    expect(findSpawns(fen, 'white', true).sort()).toEqual(['b1', 'c1', 'd1', 'e1', 'f1']);
  });
});

describe('promoting spawns', () => {
  it('recognises both back ranks', () => {
    expect(isBackRank('a1')).toBe(true);
    expect(isBackRank('h8')).toBe(true);
    expect(isBackRank('d4')).toBe(false);
  });
  it('places the chosen piece in a position the library accepts', () => {
    const fen = placePawn('4k3/8/8/8/8/8/8/4K3 w - - 0 1', 'a8', 'white', true, 'n');
    expect(new Chess(fen).get('a8')).toMatchObject({ type: 'n', color: 'w' });
  });
  it('works on the player\'s own back rank too', () => {
    const fen = placePawn('4k3/8/8/8/8/8/8/4K3 w - - 0 1', 'a1', 'white', true, 'r');
    expect(new Chess(fen).get('a1')).toMatchObject({ type: 'r', color: 'w' });
    expect(fen.split(' ')[2]).toBe('-'); // A spawned rook earns no castling rights.
  });
  it('can give check', () => {
    expect(new Chess(placePawn('4k3/8/8/8/8/8/8/4K3 w - - 0 1', 'a8', 'white', true, 'q')).inCheck()).toBe(true);
  });
  it('labels the promotion', () => {
    const chess = new Chess(placePawn('4k3/8/8/8/8/8/8/4K3 w - - 0 1', 'a8', 'white', true, 'q'));
    expect(spawnLabel('a8', chess, 'q')).toBe('P@a8=Q+');
  });
});

describe('placePawn', () => {
  it('passes the turn for a spawn instead of a move', () => {
    expect(placePawn('4k3/8/8/8/8/8/4P3/4K3 w - - 9 5', 'd4', 'white', true)).toBe('4k3/8/8/8/3P4/8/4P3/4K3 b - - 0 5');
  });
  it('increments the move number when Black spawns', () => {
    expect(placePawn('4k3/8/8/8/8/8/4P3/4K3 b - - 9 5', 'd4', 'black', true)).toBe('4k3/8/8/8/3p4/8/4P3/4K3 w - - 0 6');
  });
  it('keeps the turn after a move, because it already passed', () => {
    expect(placePawn('4k3/8/8/8/8/8/8/3K4 b - - 3 5', 'd4', 'white', false)).toBe('4k3/8/8/8/3P4/8/8/3K4 b - - 0 5');
  });
  it('keeps en passant for the bot after a double step and a spawn', () => {
    const fen = '4k3/8/8/8/3pP3/8/8/4K3 b - e3 0 5';
    expect(placePawn(fen, 'a5', 'white', false).split(' ')[3]).toBe('e3');
    expect(new Chess(placePawn(fen, 'a5', 'white', false)).moves()).toContain('dxe3');
  });
  it('cancels it when the spawn lands on that square', () => {
    expect(placePawn('4k3/8/8/8/3pP3/8/8/4K3 b - e3 0 5', 'e3', 'white', false).split(' ')[3]).toBe('-');
  });
  it('does not touch the opposing castling rights', () => {
    expect(placePawn(startFenFor('spawner', 'white'), 'a3', 'white', true).split(' ')[2]).toBe('kq');
  });
  it('can deliver checkmate', () => {
    // A pawn on g7, guarded by f6, mates the h8 king boxed in by its own bishop and pawn.
    const fen = placePawn('6bk/7p/5P2/8/8/8/8/4K3 w - - 0 1', 'g7', 'white', true);
    expect(new Chess(fen).isCheckmate()).toBe(true);
  });
  it('produces positions the library accepts', () => {
    expect(() => new Chess(placePawn(startFenFor('spawner', 'black'), 'e4', 'black', true))).not.toThrow();
  });
});

describe('engineFen', () => {
  const top = 'rnbqkbnr/pppppppp/8';
  it('leaves positions inside the limits untouched', () => {
    const fen = `${top}/PPPPPPPP/8/8/8/4K3 b kq - 0 10`;
    expect(engineFen(fen, 'white')).toBe(fen);
  });
  it('turns extra pawns into bishops, keeping every square occupied', () => {
    const fen = `${top}/PPPPPPPP/PP6/8/8/4K3 b kq - 0 10`;
    const out = engineFen(fen, 'white');
    expect(count(out, 'P')).toBe(8);
    expect(count(out, 'B')).toBe(2);
    expect(occupied(out)).toEqual(occupied(fen));
  });
  it('fits 16 pieces and 8 pawns however many pawns there are', () => {
    const out = engineFen(`${top}/PPPPPPPP/PPPPPPPP/PPPPPPPP/PPPPPPP1/4K3 b kq - 0 20`, 'white');
    expect(count(out, 'P')).toBeLessThanOrEqual(8);
    expect(whitePieces(out)).toBeLessThanOrEqual(16);
  });
  it('keeps the pawns nearest the opposing king as pawns', () => {
    const out = engineFen(`${top}/PPPPPPPP/8/8/P7/4K3 b kq - 0 10`, 'white');
    expect(new Chess(out).get('a2')?.type).toBe('b');
    expect(new Chess(out).get('e5')?.type).toBe('p');
  });
  it('never gives a false check', () => {
    // A bishop on a4 would see the open a4-e8 diagonal.
    const out = engineFen('4k3/8/8/PPPPPPPP/P7/8/8/4K3 b - - 0 10', 'white');
    expect(new Chess(out).inCheck()).toBe(false);
  });
  it('works for a Black player', () => {
    const out = engineFen('4k3/pppppppp/pp6/8/8/8/PPPPPPPP/RNBQKBNR w KQ - 0 10', 'black');
    expect(count(out, 'p')).toBe(8);
    expect(count(out, 'b')).toBe(2);
  });
  it('clears en passant in a stand-in', () => {
    const out = engineFen(`${top}/PPPPPPPP/P7/8/8/4K3 b kq - 0 10`, 'white');
    expect(out.split(' ')[3]).toBe('-');
  });
});

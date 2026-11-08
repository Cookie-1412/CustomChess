import { describe, expect, it } from 'vitest';
import { Chess, type Square } from 'chess.js';
import { addPortal, exitFor, portalSan, teleport, tickPortals, type Portal } from './portals';

const pair = (blue: Square, orange: Square): Portal[] => [
  { color: 'blue', square: blue, ttl: null },
  { color: 'orange', square: orange, ttl: null },
];
const at = (fen: string, square: Square) => new Chess(fen).get(square);

describe('addPortal', () => {
  it('on Easy, closes the previous portal of that colour at once', () => {
    const portals = addPortal(pair('e4', 'd5'), 'blue', 'a3', false);
    expect(portals.filter((p) => p.color === 'blue')).toEqual([{ color: 'blue', square: 'a3', ttl: null }]);
  });
  it('on Hard, keeps the previous portal for 2 moves', () => {
    const portals = addPortal(pair('e4', 'd5'), 'blue', 'a3', true);
    expect(portals.filter((p) => p.color === 'blue')).toEqual([
      { color: 'blue', square: 'e4', ttl: 2 },
      { color: 'blue', square: 'a3', ttl: null },
    ]);
  });
  it('leaves the other colour alone', () => {
    expect(addPortal(pair('e4', 'd5'), 'blue', 'a3', true).find((p) => p.color === 'orange')).toEqual({ color: 'orange', square: 'd5', ttl: null });
  });
});

describe('tickPortals', () => {
  it('closes a lingering portal after 2 moves, and never a current one', () => {
    const start = addPortal(pair('e4', 'd5'), 'blue', 'a3', true);
    const one = tickPortals(start);
    expect(one.some((p) => p.square === 'e4')).toBe(true);
    const two = tickPortals(one);
    expect(two.some((p) => p.square === 'e4')).toBe(false);
    expect(two.map((p) => p.square).sort()).toEqual(['a3', 'd5']);
  });
});

describe('exitFor', () => {
  it('goes both ways', () => {
    expect(exitFor(pair('e4', 'd5'), 'e4')).toBe('d5');
    expect(exitFor(pair('e4', 'd5'), 'd5')).toBe('e4');
  });
  it('does nothing with only one colour placed', () => {
    expect(exitFor([{ color: 'blue', square: 'e4', ttl: null }], 'e4')).toBeNull();
  });
  it('ignores squares without a portal', () => {
    expect(exitFor(pair('e4', 'd5'), 'a1')).toBeNull();
  });
  it('on Hard, both blues lead to orange, and orange leads to the newest blue', () => {
    const portals = addPortal(pair('e4', 'd5'), 'blue', 'a3', true);
    expect(exitFor(portals, 'e4')).toBe('d5');
    expect(exitFor(portals, 'a3')).toBe('d5');
    expect(exitFor(portals, 'd5')).toBe('a3');
  });
});

describe('teleport', () => {
  const start = new Chess().fen();
  it('does nothing when no portal is involved', () => {
    expect(teleport(start, { from: 'e2', to: 'e4' }, pair('a3', 'a6'))).toBeNull();
  });
  it('moves the piece to the exit and passes the turn', () => {
    const fen = teleport(start, { from: 'b1', to: 'c3' }, pair('c3', 'e5'))!;
    expect(at(fen, 'e5')).toMatchObject({ type: 'n', color: 'w' });
    expect(at(fen, 'c3')).toBeFalsy();
    expect(at(fen, 'b1')).toBeFalsy();
    expect(new Chess(fen).turn()).toBe('b');
  });
  it('works for Black too', () => {
    const black = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
    const fen = teleport(black, { from: 'g8', to: 'f6' }, pair('f6', 'd4'))!;
    expect(at(fen, 'd4')).toMatchObject({ type: 'n', color: 'b' });
    expect(new Chess(fen).turn()).toBe('w');
  });
  it('captures an enemy on the exit', () => {
    const fen = teleport('4k3/8/8/3n4/8/8/8/R3K3 w - - 0 1', { from: 'a1', to: 'a3' }, pair('a3', 'd5'))!;
    expect(at(fen, 'd5')).toMatchObject({ type: 'r', color: 'w' });
  });
  it('does not enter when an own piece holds the exit, but the move stays legal', () => {
    const fen = '4k3/8/8/3N4/8/8/8/R3K3 w - - 0 1';
    expect(teleport(fen, { from: 'a1', to: 'a3' }, pair('a3', 'd5'))).toBeNull();
    expect(new Chess(fen).moves()).toContain('Ra3');
  });
  it('never captures a king, so it does not enter', () => {
    expect(teleport('8/8/8/3k4/8/8/8/R3K3 w - - 0 1', { from: 'a1', to: 'a3' }, pair('a3', 'd5'))).toBeNull();
  });
  it('does not enter when the exit would leave the mover in check', () => {
    // The e8 rook covers e4, so the king stays on d2.
    expect(teleport('4r2k/8/8/8/8/8/8/3K4 w - - 0 1', { from: 'd1', to: 'd2' }, pair('d2', 'e4'))).toBeNull();
  });
  it('lets a king escape check through a portal', () => {
    const fen = teleport('3r3k/8/8/8/8/8/8/3K4 w - - 0 1', { from: 'd1', to: 'c2' }, pair('c2', 'h4'))!;
    expect(at(fen, 'h4')).toMatchObject({ type: 'k', color: 'w' });
  });
  it('promotes a pawn that exits on a back rank, on either end', () => {
    const fen = teleport('4k3/8/8/8/8/8/P7/4K3 w - - 0 1', { from: 'a2', to: 'a3', promotion: 'n' }, pair('a3', 'h8'))!;
    expect(at(fen, 'h8')).toMatchObject({ type: 'n', color: 'w' });
    const own = teleport('4k3/8/8/8/8/8/P7/4K3 w - - 0 1', { from: 'a2', to: 'a3' }, pair('a3', 'h1'))!;
    expect(at(own, 'h1')).toMatchObject({ type: 'q', color: 'w' });
  });
  it('keeps a real promotion through the portal', () => {
    const fen = teleport('4k3/P7/8/8/8/8/8/4K3 w - - 0 1', { from: 'a7', to: 'a8', promotion: 'r' }, pair('a8', 'h4'))!;
    expect(at(fen, 'h4')).toMatchObject({ type: 'r', color: 'w' });
  });
  it('castling onto a portal is a normal castle', () => {
    expect(teleport('4k3/8/8/8/8/8/8/4K2R w K - 0 1', { from: 'e1', to: 'g1' }, pair('g1', 'a5'))).toBeNull();
  });
  it('drops castling rights when a home rook is captured on the exit', () => {
    const fen = teleport('r3k3/8/8/8/8/8/8/R3K3 b Qq - 0 1'.replace('r3k3', 'r3k2b'), { from: 'h8', to: 'd4' }, pair('d4', 'a1'))!;
    expect(fen.split(' ')[2]).toBe('q');
  });
  it('clears en passant and resets the 50-move count', () => {
    const fen = teleport('4k3/8/8/8/8/8/8/R3K3 w - - 20 40', { from: 'a1', to: 'a3' }, pair('a3', 'h5'))!;
    expect(fen.split(' ').slice(3)).toEqual(['-', '0', '40']);
  });
});

describe('portalSan', () => {
  it('shows the exit and a real check', () => {
    const quiet = new Chess('4k3/8/8/8/7R/8/8/4K3 b - - 0 1');
    expect(portalSan('Rh3', 'h4', quiet)).toBe('Rh3→h4');
    const check = new Chess('4k3/8/8/8/4R3/8/8/4K3 b - - 0 1');
    expect(portalSan('Rh3+', 'e4', check)).toBe('Rh3→e4+');
  });
  it('marks a capture at the exit', () => {
    const quiet = new Chess('4k3/8/8/8/7R/8/8/4K3 b - - 0 1');
    expect(portalSan('Rh3', 'h4', quiet, true)).toBe('Rh3→xh4');
  });
  it('marks a mate', () => {
    const mate = new Chess('R5k1/5ppp/8/8/8/8/8/4K3 b - - 0 1');
    expect(portalSan('Ra3', 'a8', mate)).toBe('Ra3→a8#');
  });
});

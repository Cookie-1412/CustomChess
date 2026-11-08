import { describe, expect, it } from 'vitest';
import { Chess, type Square } from 'chess.js';
import { withHoles } from './boss';
import { afterGild, gildCanEscape, midasTargets } from './midas';

const START = new Chess().fen();
const sorted = (list: string[]) => [...list].sort();
const legal = (fen: string, gold: Square[]) => new Chess(withHoles(fen, gold)).moves({ verbose: true }).filter((m) => !gold.includes(m.from));

describe('midasTargets', () => {
  it('finds nothing from the start', () => {
    expect(midasTargets(START, [], 'white')).toEqual([]);
  });
  it('lists every enemy piece one of mine attacks', () => {
    // The c4 bishop hits f7, the e5 knight hits d7 and f7, and the a1 rook hits a7.
    const fen = 'rnbqkbnr/pppppppp/8/4N3/2B5/8/8/R3K3 w - - 0 1';
    expect(sorted(midasTargets(fen, [], 'white'))).toEqual(['a7', 'd7', 'f7']);
  });
  it('never offers the king', () => {
    expect(midasTargets('4k3/8/8/8/8/8/8/4RK2 w - - 0 1', [], 'white')).toEqual([]);
  });
  it('counts a pinned attacker', () => {
    // The c3 knight is pinned to the e1 king, but still attacks d5.
    expect(midasTargets('4k3/8/8/3p4/1b6/2N5/8/4K3 w - - 0 1', [], 'white')).toContain('d5');
  });
  it('is blocked by gold, which itself never attacks', () => {
    // A gold blocker on a4 stops the a1 rook seeing a7.
    expect(midasTargets('4k3/p7/8/8/8/8/8/R3K3 w - - 0 1', ['a4'], 'white')).toEqual([]);
    expect(midasTargets('4k3/p7/8/8/8/8/8/R3K3 w - - 0 1', [], 'white')).toEqual(['a7']);
  });
  it('works for Black', () => {
    expect(midasTargets('4k3/8/8/8/2n5/8/1P6/4K3 b - - 0 1', [], 'black')).toEqual(['b2']);
  });
});

describe('gilding', () => {
  it('takes the piece out of play and keeps the turn', () => {
    const fen = afterGild('rnbqkbnr/pppppppp/8/8/2B5/8/8/4K3 w kq - 4 3', 'f7');
    expect(new Chess(fen).get('f7')).toBeFalsy();
    expect(fen.split(' ')[1]).toBe('w');
  });
  it('leaves a blocker nobody can take or pass', () => {
    const fen = afterGild('4k3/8/8/8/8/8/8/R3K3 w - - 0 1'.replace('8/8/8/8', '8/8/8/p7'), 'a4');
    const moves = legal(fen.replace(' w ', ' b '), ['a4']);
    expect(moves.some((m) => m.to === 'a4')).toBe(false);
    expect(legal(fen, ['a4']).some((m) => m.to === 'a4' || m.to === 'a5')).toBe(false);
  });
  it('lets knights jump past it', () => {
    expect(legal('4k3/8/8/8/8/8/8/1N2K3 w - - 0 1', ['b2', 'b3']).some((m) => m.to === 'c3' || m.to === 'a3')).toBe(true);
  });
  it('keeps en passant', () => {
    expect(afterGild('4k3/7p/8/3pP3/8/8/8/R3K3 w - d6 0 3', 'h7').split(' ')[3]).toBe('d6');
  });
});

describe('gildCanEscape', () => {
  it('finds a gild that ends a mate', () => {
    // The f1 rook mates the g1 king. The king attacks it but can't take it, as the b5 bishop defends it.
    const fen = '4k3/8/8/1b6/8/8/5PPP/5rK1 w - - 0 1';
    expect(midasTargets(fen, [], 'white')).toEqual(['f1']);
    expect(new Chess(fen).isCheckmate()).toBe(true);
    expect(gildCanEscape(fen, [], 'white')).toBe(true);
  });
  it('gives up when nothing of mine sees the attacker', () => {
    expect(gildCanEscape('4k3/8/8/8/8/8/5PPP/r5K1 w - - 0 1', [], 'white')).toBe(false);
  });
});

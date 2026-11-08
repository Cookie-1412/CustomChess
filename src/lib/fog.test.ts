import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { fogFen, visibleSquares } from './fog';

const START = new Chess().fen();
const sees = (fen: string, square: string, color: 'white' | 'black' = 'white', scp: 'c4' | 'd4' | 'a4' | null = null) =>
  visibleSquares(fen, color, scp).has(square as never);

describe('pawns', () => {
  it('see one and two squares ahead from home', () => {
    expect(sees(START, 'e3')).toBe(true);
    expect(sees(START, 'e4')).toBe(true);
    expect(sees(START, 'e5')).toBe(false);
  });
  it('see only one square ahead once they have moved', () => {
    const fen = '4k3/8/8/8/8/4P3/8/4K3 w - - 0 1';
    expect(sees(fen, 'e4')).toBe(true);
    expect(sees(fen, 'e5')).toBe(false);
  });
  it('see an enemy on the diagonal', () => {
    expect(sees('4k3/8/8/8/3n4/4P3/8/4K3 w - - 0 1', 'd4')).toBe(true);
  });
  it('cannot see an enemy directly in front', () => {
    expect(sees('4k3/8/8/8/4n3/4P3/8/8 w - - 0 1'.replace('/8 w', '/K7 w'), 'e4')).toBe(false);
  });
  it('cannot see two ahead when the square in front is blocked', () => {
    // A knight on e3 blocks the e2 pawn, so e3 and e4 both stay hidden.
    const fen = '4k3/8/8/8/4n3/4n3/4P3/K7 w - - 0 1';
    expect(sees(fen, 'e3')).toBe(false);
    expect(sees(fen, 'e4')).toBe(false);
  });
  it('cannot see an enemy two ahead from home', () => {
    expect(sees('4k3/8/8/8/4n3/8/4P3/K7 w - - 0 1', 'e4')).toBe(false);
    expect(sees('4k3/8/8/8/4n3/8/4P3/K7 w - - 0 1', 'e3')).toBe(true);
  });
  it('look the other way for Black', () => {
    const fen = '4k3/4p3/8/8/8/8/8/4K3 b - - 0 1';
    expect(sees(fen, 'e6', 'black')).toBe(true);
    expect(sees(fen, 'e5', 'black')).toBe(true);
    expect(sees(fen, 'd6', 'black')).toBe(true);
    expect(sees(fen, 'e4', 'black')).toBe(false);
  });
});

describe('other pieces', () => {
  it('sliders see up to and including the first piece', () => {
    const fen = 'k7/8/8/R3n2r/8/8/8/K7 w - - 0 1';
    expect(sees(fen, 'd5')).toBe(true);
    expect(sees(fen, 'e5')).toBe(true);
    expect(sees(fen, 'f5')).toBe(false);
    expect(sees(fen, 'h5')).toBe(false);
  });
  it('sliders stop at their own pieces', () => {
    const fen = 'k7/8/8/R1P4r/8/8/8/K7 w - - 0 1';
    expect(sees(fen, 'c5')).toBe(true);
    expect(sees(fen, 'h5')).toBe(false);
  });
  it('knights see only where they jump', () => {
    const fen = '7k/8/8/8/3N4/8/8/7K w - - 0 1';
    expect(sees(fen, 'e6')).toBe(true);
    expect(sees(fen, 'd5')).toBe(false);
  });
  it('kings see the squares around them', () => {
    const fen = '7k/8/8/8/8/8/8/4K3 w - - 0 1';
    expect(sees(fen, 'd2')).toBe(true);
    expect(sees(fen, 'e3')).toBe(false);
  });
  it('a pinned piece still sees', () => {
    const fen = '4r2k/8/8/8/8/4B3/8/4K3 w - - 0 1';
    expect(sees(fen, 'h6')).toBe(true);
  });
  it('shows nothing of the enemy from the start', () => {
    const visible = visibleSquares(START, 'white', null);
    expect([...visible].some((s) => /[5-8]$/.test(s))).toBe(false);
  });
});

describe('SCP-096', () => {
  it('stops sliders, and is seen by them', () => {
    const fen = 'k7/8/8/8/R6r/8/8/K7 w - - 0 1';
    expect(sees(fen, 'c4', 'white', 'c4')).toBe(true);
    expect(sees(fen, 'd4', 'white', 'c4')).toBe(false);
  });
  it('blocks a pawn, which then cannot see it', () => {
    const fen = 'k7/8/8/8/8/2P5/8/K7 w - - 0 1';
    expect(sees(fen, 'c4', 'white', null)).toBe(true);
    expect(sees(fen, 'c4', 'white', 'c4')).toBe(false);
  });
  it('is seen by a pawn on the diagonal', () => {
    expect(sees('k7/8/8/8/8/3P4/8/K7 w - - 0 1', 'c4', 'white', 'c4')).toBe(true);
  });
});

describe('fogFen', () => {
  it('removes hidden pieces and keeps the rest', () => {
    const fen = fogFen(START, visibleSquares(START, 'white', null));
    expect(fen.split(' ')[0]).toBe('8/8/8/8/8/8/PPPPPPPP/RNBQKBNR');
  });
  it('keeps an enemy that is seen', () => {
    const fen = '4k3/8/8/8/3n4/4P3/8/4K3 w - - 0 1';
    expect(fogFen(fen, visibleSquares(fen, 'white', null)).split(' ')[0]).toBe('8/8/8/8/3n4/4P3/8/4K3');
  });
});

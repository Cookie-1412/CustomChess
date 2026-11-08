import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { blastSan, blastSquares, detonate } from './bomb';

const sorted = (list: string[]) => [...list].sort();

describe('blastSquares', () => {
  it('level 1 is a plus', () => {
    expect(sorted(blastSquares('d4', 1))).toEqual(['c4', 'd3', 'd4', 'd5', 'e4']);
  });
  it('level 2 is 3x3', () => {
    expect(sorted(blastSquares('d4', 2))).toEqual(['c3', 'c4', 'c5', 'd3', 'd4', 'd5', 'e3', 'e4', 'e5']);
  });
  it('level 3 is 5x5', () => {
    const squares = blastSquares('d4', 3);
    expect(squares).toHaveLength(25);
    expect(squares).toContain('b2');
    expect(squares).toContain('f6');
    expect(squares).not.toContain('g4');
  });
  it('is clipped at the edge of the board', () => {
    expect(sorted(blastSquares('a1', 1))).toEqual(['a1', 'a2', 'b1']);
    expect(blastSquares('a1', 2)).toHaveLength(4);
    expect(blastSquares('a1', 3)).toHaveLength(9);
    expect(blastSquares('h8', 3)).toHaveLength(9);
  });
});

describe('detonate', () => {
  // A black knight has just taken the queen on d4, with White to move.
  const fen = '4k3/8/8/2ppp3/2Pnp3/2PPP3/8/4K3 w - - 0 2';
  const at = (out: string, square: 'c4' | 'c5' | 'c3' | 'd3' | 'd4' | 'd5' | 'e3' | 'e4' | 'e5') => new Chess(out).get(square);

  it('level 1 kills the capturer and the plus, from both sides, and nothing else', () => {
    const out = detonate(fen, 'd4', 1).fen;
    for (const square of ['d4', 'c4', 'e4', 'd3', 'd5'] as const) expect(at(out, square)).toBeFalsy();
    for (const square of ['c3', 'e3', 'c5', 'e5'] as const) expect(at(out, square)).toBeTruthy();
  });
  it('level 2 also kills the corners', () => {
    const out = detonate(fen, 'd4', 2).fen;
    for (const square of ['c3', 'e3', 'c5', 'e5'] as const) expect(at(out, square)).toBeFalsy();
  });
  it('never kills a king, on any level', () => {
    const next = '8/8/8/3k4/3nK3/8/8/8 w - - 0 2';
    for (const level of [1, 2, 3] as const) {
      const out = new Chess(detonate(next, 'd4', level).fen);
      expect(out.get('d5')).toMatchObject({ type: 'k' });
      expect(out.get('e4')).toMatchObject({ type: 'k' });
      expect(out.get('d4')).toBeFalsy();
    }
  });
  it('a capturing king survives at the centre', () => {
    const out = new Chess(detonate('8/8/8/3p4/3k4/8/8/4K3 w - - 0 2', 'd4', 1).fen);
    expect(out.get('d4')).toMatchObject({ type: 'k' });
    expect(out.get('d5')).toBeFalsy();
  });
  it('resets the 50-move count, clears en passant and keeps the turn', () => {
    const parts = detonate('4k3/8/8/3pP3/3n4/8/8/4K3 w - d6 7 12', 'd4', 1).fen.split(' ');
    expect(parts.slice(1)).toEqual(['w', '-', '-', '0', '12']);
  });
  it('drops castling rights for a rook in the blast', () => {
    expect(detonate('r3k2r/8/8/8/8/8/8/n3K2R w Kkq - 0 2', 'a1', 3).fen.split(' ')[2]).toBe('Kkq');
    expect(detonate('r3k2r/8/8/8/8/8/n7/R3K3 w Qkq - 0 2', 'a2', 1).fen.split(' ')[2]).toBe('kq');
  });
  it('flags a blast that leaves the capturer\'s king open to capture', () => {
    // The e4 knight shields e8 from the e1 rook, with White to move.
    expect(detonate('4k3/8/8/8/4n3/8/8/4R1K1 w - - 0 2', 'e4', 1).kingExposed).toBe(true);
  });
  it('does not flag an ordinary blast', () => {
    expect(detonate('4k3/4p3/8/8/3n4/8/8/4R1K1 w - - 0 2', 'd4', 1).kingExposed).toBe(false);
  });
  it('can leave the bomb owner in check, which is legal', () => {
    // The e4 knight also shielded e1 from the e8 rook.
    const blast = detonate('4r2k/8/8/8/4n3/8/8/4K3 w - - 0 2', 'e4', 1);
    expect(blast.kingExposed).toBe(false);
    expect(new Chess(blast.fen).inCheck()).toBe(true);
  });
});

describe('blastSan', () => {
  it('marks the blast and a real check', () => {
    expect(blastSan('Nxd4', new Chess('4k3/8/8/8/8/8/8/4K3 w - - 0 1'))).toBe('Nxd4 💥');
    expect(blastSan('Nxd4+', new Chess('4r2k/8/8/8/8/8/8/4K3 w - - 0 1'))).toBe('Nxd4 💥+');
  });
});

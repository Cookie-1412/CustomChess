import { describe, expect, it } from 'vitest';
import { Chess, type Square } from 'chess.js';
import { magnetCanEscape, magnetPlan, magnetPull, magnetSources } from './magnet';

const at = (fen: string, square: Square) => new Chess(fen).get(square);
const pulled = (fen: string, square: Square, rng?: () => number) => magnetPull(fen, square, rng);

describe('sliders', () => {
  it('a rook pulls an enemy along its line to the square beside it', () => {
    const out = pulled('4k3/r7/8/8/8/8/8/R3K3 w - - 0 1', 'a1')!;
    expect(out.pulls).toEqual([{ from: 'a7', to: 'a2' }]);
    expect(at(out.fen, 'a2')).toMatchObject({ type: 'r', color: 'b' });
    expect(at(out.fen, 'a7')).toBeFalsy();
  });
  it('a bishop pulls diagonally', () => {
    const out = pulled('4k3/8/8/8/4n3/8/8/1B5K w - - 0 1', 'b1')!;
    expect(out.pulls).toEqual([{ from: 'e4', to: 'c2' }]);
  });
  it('a queen pulls every piece it forks', () => {
    // From d4 the queen hits a7 and h4.
    const out = pulled('4k3/n7/8/8/3Q3r/8/8/7K w - - 0 1', 'd4')!;
    expect(out.pulls.map((p) => p.to).sort()).toEqual(['c5', 'e4']);
    expect(at(out.fen, 'c5')).toMatchObject({ type: 'n' });
    expect(at(out.fen, 'e4')).toMatchObject({ type: 'r' });
  });
  it('only pulls the first piece on each line, and never through its own', () => {
    expect(pulled('4k3/r7/n7/8/8/8/8/R3K3 w - - 0 1', 'a1')!.pulls).toEqual([{ from: 'a6', to: 'a2' }]);
    expect(pulled('4k3/r7/8/8/P7/8/8/R3K3 w - - 0 1', 'a1')).toBeNull();
  });
  it('leaves an enemy already beside it alone', () => {
    expect(pulled('4k3/8/8/8/8/8/r7/R3K3 w - - 0 1', 'a1')).toBeNull();
  });
  it('keeps the turn with the puller', () => {
    expect(pulled('4k3/r7/8/8/8/8/8/R3K3 w - - 0 1', 'a1')!.fen.split(' ')[1]).toBe('w');
  });
});

describe('knights', () => {
  it("pull to the diagonal on the target's side", () => {
    // A knight on d4 hits e6; its diagonal on that side is e5.
    const out = pulled('4k3/8/4r3/8/3N4/8/8/4K3 w - - 0 1', 'd4')!;
    expect(out.pulls).toEqual([{ from: 'e6', to: 'e5' }]);
  });
  it('do nothing if that diagonal is taken', () => {
    expect(pulled('4k3/8/4r3/4P3/3N4/8/8/4K3 w - - 0 1', 'd4')).toBeNull();
  });
  it('fill a shared diagonal once, at random', () => {
    // e6 and f5 are both on the e5 side of a d4 knight.
    const fen = '4k3/8/4r3/5b2/3N4/8/8/4K3 w - - 0 1';
    const first = pulled(fen, 'd4', () => 0)!;
    const second = pulled(fen, 'd4', () => 0.99)!;
    expect(first.pulls).toHaveLength(1);
    expect(second.pulls).toHaveLength(1);
    expect(first.pulls[0].from).not.toBe(second.pulls[0].from);
  });
});

describe('skipped pulls', () => {
  it('never pulls a king', () => {
    expect(pulled('4k3/8/8/8/8/8/8/R3K3 w - - 0 1'.replace('4k3', 'k7'), 'a1')).toBeNull();
  });
  it('pawns and kings have no magnet', () => {
    expect(pulled('4k3/r7/8/8/8/8/P7/4K3 w - - 0 1', 'a2')).toBeNull();
    expect(pulled('4k3/8/8/8/8/8/8/r3K3 w - - 0 1', 'e1')).toBeNull();
  });
  it('skips a pull that puts its own king in check', () => {
    // The c3 bishop would pull the g7 queen to d4, where she checks the d2 king down the d-file.
    expect(pulled('4k3/6q1/8/8/8/2B5/3K4/8 w - - 0 1', 'c3')).toBeNull();
    // With the king off the d-file, the same pull goes ahead.
    expect(pulled('4k3/6q1/8/8/8/2B5/8/K7 w - - 0 1', 'c3')!.pulls).toEqual([{ from: 'g7', to: 'd4' }]);
  });
  it('skips a pull that would expose the enemy king', () => {
    // The d5 knight shields the d8 king from the d1 rook. The a5 rook would pull it off the file.
    const fen = '3k4/8/8/R2n4/8/8/8/3RK3 w - - 0 1';
    expect(pulled(fen, 'a5')).toBeNull();
  });
  it('keeps en passant when the pawn that stepped stays put', () => {
    expect(pulled('4k3/r7/8/3pP3/8/8/8/R3K3 w - d6 0 2', 'a1')!.fen.split(' ')[3]).toBe('d6');
  });
});

describe('sources and escapes', () => {
  it('lists only pieces whose magnet would pull something', () => {
    expect(magnetSources('4k3/r7/8/8/8/8/8/R3K1N1 w - - 0 1')).toEqual(['a1']);
    expect(magnetSources(new Chess().fen())).toEqual([]);
  });
  it('plans every pull for every puller', () => {
    // The a1 rook pulls a7 to a2, and the d4 queen hits both a7 and h4.
    const plan = magnetPlan('4k3/n7/8/8/3Q3r/8/8/R6K w - - 0 1');
    expect(Object.keys(plan).sort()).toEqual(['a1', 'd4']);
    expect(plan.a1).toEqual([{ from: 'a7', to: 'a2' }]);
    expect(plan.d4.map((p) => p.from).sort()).toEqual(['a7', 'h4']);
  });
  it('finds no escape when nothing can be pulled', () => {
    const fen = '4k3/8/8/8/8/8/5PPP/r5K1 w - - 0 1';
    expect(new Chess(fen).isCheckmate()).toBe(true);
    expect(magnetCanEscape(fen)).toBe(false);
  });
});

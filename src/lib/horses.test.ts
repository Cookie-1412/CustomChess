import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { breed, breedingSquares, herd } from './horses';
import { engineFen } from './spawner';

const sorted = (list: string[]) => [...list].sort();

describe('herd', () => {
  it('joins knights through all 8 surrounding squares', () => {
    // d4 touches e5 diagonally, e5 touches f5 sideways; h8 is on its own.
    const chess = new Chess('4k2N/8/8/4NN2/3N4/8/8/4K3 b - - 0 1');
    expect(sorted(herd(chess, 'd4', 'white'))).toEqual(['d4', 'e5', 'f5']);
    expect(herd(chess, 'h8', 'white')).toEqual(['h8']);
  });
  it("ignores the other side's knights", () => {
    expect(herd(new Chess('4k3/8/8/4n3/3N4/8/8/4K3 b - - 0 1'), 'd4', 'white')).toEqual(['d4']);
  });
});

describe('breedingSquares', () => {
  it('needs another knight beside the one that moved', () => {
    expect(breedingSquares('4k3/8/8/8/3N4/8/8/4K2N b - - 0 1', 'd4', 'white')).toEqual([]);
  });
  it('lists every empty square around the whole herd', () => {
    const squares = breedingSquares('4k3/8/8/8/3NN3/8/8/4K3 b - - 0 1', 'd4', 'white');
    expect(squares).toHaveLength(10);
    expect(squares).toContain('c3');
    expect(squares).toContain('f5');
    expect(squares).not.toContain('d4');
  });
  it('reaches knights joined further along the herd', () => {
    // The d4 knight joins e5, which joins f6: g7 is next to the herd only through f6.
    expect(breedingSquares('7k/8/5N2/4N3/3N4/8/8/4K3 b - - 0 1', 'd4', 'white')).toContain('g7');
  });
  it('never offers an occupied square', () => {
    expect(breedingSquares('4k3/8/8/3p4/3NN3/8/8/4K3 b - - 0 1', 'd4', 'white')).not.toContain('d5');
  });
  it('never makes a third check', () => {
    // The c7 and g7 knights already check the e8 king. The d7 knight joins c7's herd; a foal
    // on d6 would check e8 a third time, so it's left out, while c6 is fine.
    const fen = '4k3/2NN2N1/8/8/8/8/8/4K3 b - - 0 1';
    expect(new Chess(fen).attackers('e8', 'w').length).toBe(2);
    const squares = breedingSquares(fen, 'd7', 'white');
    expect(squares).toContain('c6');
    expect(squares).not.toContain('d6');
  });
  it('drops excess non-pawn pieces when a big herd outgrows the API', () => {
    // White has 8 pawns and 11 knights plus the rest: well past 16.
    const fen = 'rnbqkbnr/pppppppp/8/NNNN4/NNNN4/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1';
    const board = engineFen(fen, 'white').split(' ')[0];
    expect(board.replace(/[^A-Z]/g, '').length).toBeLessThanOrEqual(16);
    expect(board.replace(/[^P]/g, '').length).toBeLessThanOrEqual(8);
  });
  it('works for Black', () => {
    expect(breedingSquares('4k3/8/8/3nn3/8/8/8/4K3 w - - 0 1', 'd5', 'black').length).toBeGreaterThan(0);
  });
});

describe('breed', () => {
  it('puts a new knight of the mover on one of the squares', () => {
    const fen = '4k3/8/8/8/3NN3/8/8/4K3 b - - 0 1';
    const out = breed(fen, 'd4', 'white', () => 0)!;
    expect(breedingSquares(fen, 'd4', 'white')).toContain(out.square);
    expect(new Chess(out.fen).get(out.square)).toMatchObject({ type: 'n', color: 'w' });
    expect(out.fen.split(' ')[1]).toBe('b');
  });
  it('picks different squares at random', () => {
    const fen = '4k3/8/8/8/3NN3/8/8/4K3 b - - 0 1';
    expect(breed(fen, 'd4', 'white', () => 0)!.square).not.toBe(breed(fen, 'd4', 'white', () => 0.99)!.square);
  });
  it('returns null without a neighbour', () => {
    expect(breed('4k3/8/8/8/3N4/8/8/4K3 b - - 0 1', 'd4', 'white')).toBeNull();
  });
});

describe('engineFen with a big herd', () => {
  it('fits 16 pieces by dropping the furthest extras', () => {
    // White has 15 pieces plus 3 extra knights: 19 in all.
    const fen = 'rnbqkbnr/pppppppp/8/8/NNN5/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1';
    const out = engineFen(fen, 'white');
    expect(out.split(' ')[0].replace(/[^A-Z]/g, '').length).toBeLessThanOrEqual(16);
  });
  it("never leaves the player's own king open to capture", () => {
    const out = new Chess(engineFen('rnbqkbnr/pppppppp/8/8/NNN5/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1', 'white'));
    const flipped = out.fen().split(' ');
    flipped[1] = 'w';
    expect(new Chess(flipped.join(' ')).inCheck()).toBe(false);
  });
});

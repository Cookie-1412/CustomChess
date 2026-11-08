import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { fenAfterShot, findShots } from './sniper';

const targets = (fen: string) => findShots(fen).map((s) => s.to).sort();

describe('findShots', () => {
  it('hits the first enemy piece on a diagonal and nothing behind it', () => {
    expect(targets('4k3/8/6r1/5n2/8/3B4/8/4K3 w - - 0 1')).toEqual(['f5']);
  });
  it('is blocked by friendly pieces', () => {
    expect(targets('4k3/8/6r1/8/4P3/3B4/8/4K3 w - - 0 1')).toEqual([]);
  });
  it('ignores pieces that are not on a diagonal', () => {
    expect(targets('4k3/8/8/3r4/8/3B4/8/4K3 w - - 0 1')).toEqual([]);
  });
  it('needs a bishop of the side to move', () => {
    expect(targets('4k3/8/8/1b6/8/3N4/8/4K3 w - - 0 1')).toEqual([]);
  });
  it('never targets the king', () => {
    expect(targets('8/8/8/8/6k1/8/8/K2B4 w - - 0 1')).toEqual([]);
  });
  it('lists a target once when two bishops see it', () => {
    expect(targets('4k3/8/8/4n3/8/2B3B1/8/4K3 w - - 0 1')).toEqual(['e5']);
  });
  it('lets a pinned bishop fire, because it does not move', () => {
    // The e3 bishop is pinned by the e8 rook, so it has no legal moves off the e-file.
    const fen = '4r2k/8/8/6n1/8/4B3/8/4K3 w - - 0 1';
    expect(new Chess(fen).moves({ square: 'e3' })).toEqual([]);
    expect(targets(fen)).toEqual(['g5']);
  });
  it('in check, only allows shooting the checking piece', () => {
    // The bishop sees both the a6 knight and the checking e8 rook.
    expect(targets('4r2k/8/n7/1B6/8/8/8/4K3 w - - 0 1')).toEqual(['e8']);
  });
  it('in check, allows no shot that leaves the king attacked', () => {
    expect(targets('4r2k/3p4/n7/1B6/8/8/8/4K3 w - - 0 1')).toEqual([]);
  });
  it('in double check, one shot is never enough', () => {
    expect(targets('4r2k/8/3B4/8/1b6/8/8/4K3 w - - 0 1')).toEqual([]);
  });
});

describe('fenAfterShot', () => {
  it('removes the piece, passes the turn and resets the 50-move count', () => {
    expect(fenAfterShot('4k3/8/8/5n2/8/3B4/8/4K3 w - - 12 30', 'f5')).toBe('4k3/8/8/8/8/3B4/8/4K3 b - - 0 30');
  });
  it('increments the move number when Black fires', () => {
    expect(fenAfterShot('4k3/8/3b4/8/5N2/8/8/4K3 b - - 3 30', 'f4')).toBe('4k3/8/3b4/8/8/8/8/4K3 w - - 0 31');
  });
  it('clears the castling right of a rook shot on its home square', () => {
    const fen = fenAfterShot('r3k2r/8/8/8/8/5B2/8/R3K2R w KQkq - 0 1', 'a8');
    expect(fen.split(' ')[2]).toBe('KQk');
    expect(new Chess(fen).moves().includes('O-O-O')).toBe(false);
  });
  it('clears en passant', () => {
    const fen = 'rnbqkbnr/ppp1pppp/8/8/3pP3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 3';
    expect(fenAfterShot(fen, 'e4').split(' ')[3]).toBe('-');
  });
  it('can discover a check, which the bot must then answer', () => {
    // The d5 knight is the only thing between the d1 rook and the d8 king.
    const after = new Chess(fenAfterShot('3k4/8/8/3n4/8/1B6/8/3RK3 w - - 0 1', 'd5'));
    expect(after.turn()).toBe('b');
    expect(after.inCheck()).toBe(true);
  });
  it('can deliver checkmate', () => {
    // Shooting the c8 knight opens the back rank for the a8 rook.
    const fen = 'R1n3k1/5ppp/8/5B2/8/8/8/4K3 w - - 0 1';
    expect(targets(fen)).toContain('c8');
    expect(new Chess(fenAfterShot(fen, 'c8')).isCheckmate()).toBe(true);
  });
  it('can stalemate', () => {
    // Black's king on a8 has no squares (a7, b7, b8 are all covered) and the shot removes its last mobile piece.
    const after = new Chess(fenAfterShot('k7/2Q5/1K6/8/4n3/8/8/1B6 w - - 0 1', 'e4'));
    expect(after.isStalemate()).toBe(true);
  });
});

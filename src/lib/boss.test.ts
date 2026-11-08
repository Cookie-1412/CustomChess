import { describe, expect, it } from 'vitest';
import { Chess, type Square } from 'chess.js';
import { afterHole, afterSnatch, afterSummon, bossSan, canDig, engineBlockers, canSnatch, canSummon, hasBossMove, NO_POWERS_USED, pawnSquare, powerCanEscape, stripHoles, withHoles } from './boss';
import { pickWeakMove } from './weakMove';

const START = new Chess().fen();
const legal = (fen: string, holes: Square[]) => new Chess(withHoles(fen, holes)).moves({ verbose: true }).filter((m) => !holes.includes(m.from));

describe('holes', () => {
  it('round trip to the same position', () => {
    expect(stripHoles(withHoles(START, ['d4', 'e5']), ['d4', 'e5'])).toBe(START);
  });
  it('cannot be landed on, by either side', () => {
    expect(legal('r3k3/8/8/8/8/8/8/R3K3 w - - 0 1', ['a4']).some((m) => m.to === 'a4')).toBe(false);
    expect(legal('r3k3/8/8/8/8/8/8/R3K3 b - - 0 1', ['a4']).some((m) => m.to === 'a4')).toBe(false);
  });
  it('stop sliders, for both sides', () => {
    expect(legal('4k3/8/8/8/8/8/8/R3K3 w - - 0 1', ['a4']).some((m) => m.to === 'a5')).toBe(false);
    expect(legal('r3k3/8/8/8/8/8/8/4K3 b - - 0 1', ['a4']).some((m) => m.to === 'a3')).toBe(false);
  });
  it('let knights jump over but not land', () => {
    const moves = legal('4k3/8/8/8/8/8/8/1N2K3 w - - 0 1', ['b2', 'a3']);
    expect(moves.some((m) => m.san.startsWith('N') && m.to === 'c3')).toBe(true);
    expect(moves.some((m) => m.to === 'a3')).toBe(false);
  });
  it('stop a pawn stepping through', () => {
    expect(legal('4k3/8/8/8/8/8/P7/4K3 w - - 0 1', ['a3']).some((m) => m.from === 'a2')).toBe(false);
  });
  it('block a check through them', () => {
    const fen = 'r3k3/8/8/8/8/8/8/K7 w - - 0 1';
    expect(new Chess(fen).inCheck()).toBe(true);
    expect(new Chess(withHoles(fen, ['a4'])).inCheck()).toBe(false);
  });
  it('are never moved by the local move picker', () => {
    const holes: Square[] = ['d4', 'e5', 'c5'];
    const fen = withHoles(START, holes);
    for (let i = 0; i < 30; i++) expect(holes.some((h) => pickWeakMove(fen, 300, Math.random, holes)?.startsWith(h))).toBe(false);
  });
});

describe('pawnSquare', () => {
  it('uses the pawn row for clicks on the first two rows', () => {
    expect(pawnSquare('c1', 'white')).toBe('c2');
    expect(pawnSquare('c2', 'white')).toBe('c2');
    expect(pawnSquare('c8', 'black')).toBe('c7');
    expect(pawnSquare('c7', 'black')).toBe('c7');
  });
  it('refuses anywhere else', () => {
    expect(pawnSquare('c3', 'white')).toBeNull();
    expect(pawnSquare('c8', 'white')).toBeNull();
  });
});

describe('powers', () => {
  it('snatch removes the piece and keeps the turn', () => {
    const fen = afterSnatch('rnbqkbnr/pppppppp/8/8/8/8/4P3/4K3 w kq - 5 3', 'd8');
    expect(new Chess(fen).get('d8')).toBeFalsy();
    expect(fen.split(' ').slice(1)).toEqual(['w', 'kq', '-', '0', '3']);
  });
  it('snatch drops castling rights with a rook', () => {
    expect(afterSnatch('r3k2r/8/8/8/8/8/4P3/4K3 w kq - 0 3', 'a8').split(' ')[2]).toBe('k');
  });
  it('cannot snatch a king, an own piece or an empty square', () => {
    const fen = 'rnbqkbnr/pppppppp/8/8/8/8/4P3/4K3 w kq - 0 1';
    expect(canSnatch(fen, 'e8', [], 'white')).toBe(false);
    expect(canSnatch(fen, 'e2', [], 'white')).toBe(false);
    expect(canSnatch(fen, 'e4', [], 'white')).toBe(false);
    expect(canSnatch(fen, 'd8', [], 'white')).toBe(true);
  });
  it('cannot snatch the only piece shielding the enemy king', () => {
    // The e7 pawn blocks the e1 rook from the e8 king on White's own turn.
    expect(canSnatch('4k3/4p3/8/8/8/8/8/K3R3 w - - 0 1', 'e7', [], 'white')).toBe(false);
  });
  it('can snatch a shield when a hole also blocks the line', () => {
    expect(canSnatch('4k3/4p3/8/8/8/8/8/K3R3 w - - 0 1', 'e7', ['e4'], 'white')).toBe(true);
  });
  it('can snatch the piece giving check', () => {
    expect(canSnatch('4k3/8/8/8/8/8/3r4/4K3 w - - 0 1', 'd2', [], 'white')).toBe(true);
  });
  it('holes and summons need an empty square', () => {
    const fen = 'rnbqkbnr/pppppppp/8/8/8/8/4P3/4K3 w kq - 0 1';
    expect(canDig(fen, 'd4', [])).toBe(true);
    expect(canDig(fen, 'd4', ['d4'])).toBe(false);
    expect(canDig(fen, 'e2', [])).toBe(false);
    expect(canSummon(fen, 'a2', [])).toBe(true);
    expect(canSummon(fen, 'e2', [])).toBe(false);
    expect(canSummon(fen, 'a2', ['a2'])).toBe(false);
  });
  it('a summoned pawn plays like a normal pawn', () => {
    const fen = afterSummon('rnbqkbnr/pppppppp/8/8/8/8/4P3/4K3 w kq - 0 1', 'a2', 'white');
    expect(new Chess(fen).moves({ square: 'a2' }).sort()).toEqual(['a3', 'a4']);
  });
  it('a hole on the en passant square cancels the capture', () => {
    expect(afterHole('4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 2', 'd6').split(' ')[3]).toBe('-');
    expect(afterHole('4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 2', 'a3').split(' ')[3]).toBe('d6');
  });
});

describe('engineBlockers', () => {
  const at = (fen: string, square: Square) => new Chess(fen).get(square);
  it('fills each blocker with a pawn of the side to move', () => {
    const fen = engineBlockers('4k3/8/8/8/8/8/8/R3K3 b - - 0 1', ['a4', 'd5']);
    expect(at(fen, 'a4')).toMatchObject({ type: 'p', color: 'b' });
    expect(at(fen, 'd5')).toMatchObject({ type: 'p', color: 'b' });
  });
  it('blocks the other side\'s line, as gold does', () => {
    // Without a stand-in, the a1 rook seems to attack the a8 queen through the a4 gold.
    const empty = '1q2k3/8/8/8/8/8/8/R3K3 b - - 0 1'.replace('1q2k3', 'q3k3');
    expect(new Chess(empty).isAttacked('a8', 'w')).toBe(true);
    expect(new Chess(engineBlockers(empty, ['a4'])).isAttacked('a8', 'w')).toBe(false);
  });
  it('stops the side to move landing on or passing the square', () => {
    const fen = engineBlockers('r3k3/8/8/8/8/8/8/4K3 b - - 0 1', ['a4']);
    const moves = new Chess(fen).moves({ verbose: true }).filter((m) => m.from === 'a8');
    expect(moves.some((m) => m.to === 'a4' || m.to === 'a3')).toBe(false);
  });
  it('uses another piece on a back rank, where a pawn is illegal', () => {
    expect(at(engineBlockers('4k3/8/8/8/8/8/8/R3K3 b - - 0 1', ['c1']), 'c1')?.type).not.toBe('p');
  });
  it('never puts the other king in check', () => {
    // A black pawn on d2 would check the e1 king, so something else stands in.
    const fen = engineBlockers('4k3/8/8/8/8/8/8/4K3 b - - 0 1', ['d2']);
    expect(at(fen, 'd2')).toBeTruthy();
    const check = fen.split(' ');
    check[1] = 'w';
    expect(new Chess(check.join(' ')).inCheck()).toBe(false);
  });
  it('uses the other side when the side to move is full', () => {
    // Black still has all 16 pieces, as in Boss Fight's opening.
    const fen = engineBlockers('rnbqkbnr/pppppppp/8/8/8/4P3/8/4K3 b kq - 0 1', ['e5']);
    expect(at(fen, 'e5')).toMatchObject({ color: 'w' });
    const check = fen.split(' ');
    check[1] = 'b';
    expect(new Chess(fen).inCheck()).toBe(false);
  });
  it('stays within 8 pawns and 16 pieces', () => {
    const blockers = ['a4', 'b4', 'c4', 'd4', 'e4', 'f4', 'g4', 'h4', 'a5', 'b5', 'c5', 'd5', 'e5', 'f5', 'g5', 'h5'] as Square[];
    const board = engineBlockers('rnbqkbnr/pppppppp/8/8/8/8/8/4K3 b kq - 0 1', blockers).split(' ')[0];
    expect(board.replace(/[^p]/g, '').length).toBeLessThanOrEqual(8);
    expect(board.replace(/[^a-z]/g, '').length).toBeLessThanOrEqual(16);
  });
  it('keeps en passant', () => {
    expect(engineBlockers('rnbqkbnr/ppp1pppp/8/3pP3/8/8/8/4K3 w kq d6 0 3', ['a4']).split(' ')[3]).toBe('d6');
  });
});

describe('en passant', () => {
  const fen = 'rnbqkbnr/ppp1pppp/8/3pP3/8/8/8/4K3 w kq d6 0 3';
  it('survives holes', () => {
    expect(withHoles(fen, ['a4', 'h4']).split(' ')[3]).toBe('d6');
    expect(stripHoles(withHoles(fen, ['a4']), ['a4'])).toBe(fen);
    expect(new Chess(withHoles(fen, ['a4'])).moves()).toContain('exd6');
  });
  it('survives a snatch and a summon', () => {
    expect(afterSnatch(fen, 'a8').split(' ')[3]).toBe('d6');
    expect(afterSummon(fen, 'a2', 'white').split(' ')[3]).toBe('d6');
  });
  it('is cancelled by snatching the pawn that stepped', () => {
    expect(afterSnatch(fen, 'd5').split(' ')[3]).toBe('-');
  });
  it('is cancelled by a hole on that square', () => {
    expect(afterHole(fen, 'd6').split(' ')[3]).toBe('-');
  });
});

describe('powerCanEscape', () => {
  // Every test here uses a back-rank mate on the g1 king.
  it('finds a snatch that ends a mate', () => {
    expect(new Chess('4k3/8/8/8/8/8/5PPP/r5K1 w - - 0 1').isCheckmate()).toBe(true);
    expect(powerCanEscape('4k3/8/8/8/8/8/5PPP/r5K1 w - - 0 1', [], 'white', NO_POWERS_USED)).toBe(true);
  });
  it('finds a hole that blocks the check', () => {
    const used = { ...NO_POWERS_USED, snatch: true };
    expect(powerCanEscape('4k3/8/8/8/8/8/5PPP/r5K1 w - - 0 1', [], 'white', used)).toBe(true);
  });
  it('gives up when no power helps', () => {
    const allUsed = { snatch: true, hole: true, pawn: true };
    expect(powerCanEscape('4k3/8/8/8/8/8/5PPP/r5K1 w - - 0 1', [], 'white', allUsed)).toBe(false);
  });
  it('sees a real mate through a used-up turn', () => {
    expect(hasBossMove(new Chess('4k3/8/8/8/8/8/5PPP/r5K1 w - - 0 1'), [])).toBe(false);
  });
});

describe('bossSan', () => {
  const play = (stripped: string, holes: Square[], input: { from: string; to: string }) => {
    const chess = new Chess(withHoles(stripped, holes));
    const raw = chess.move(input).san;
    const after = new Chess(withHoles(stripHoles(chess.fen(), holes), holes));
    return { raw, san: bossSan(stripped, input, raw, after, holes) };
  };
  it('drops disambiguation caused by a hidden knight', () => {
    const { raw, san } = play(START, ['a4'], { from: 'b1', to: 'c3' });
    expect(raw).toBe('Nbc3');
    expect(san).toBe('Nc3');
  });
  it('keeps a real check', () => {
    expect(play('4k3/8/8/8/8/8/8/R3K3 w - - 0 1', ['h4'], { from: 'a1', to: 'a8' }).san).toBe('Ra8+');
  });
  it('marks a real mate', () => {
    expect(play('6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1', ['h4'], { from: 'a1', to: 'a8' }).san).toBe('Ra8#');
  });
});

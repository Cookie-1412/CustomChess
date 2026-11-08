import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { pickWeakMove } from './weakMove';
import { afterKingEaten, afterStrike, findSeers, findWatchers, knightDistances, pickJump, pickVictim, positionKey, randomScpStart, scpSan, stripScp, withScp } from './scp';

const START = new Chess().fen();
const legalFrom = (fen: string, scp: string) => new Chess(fen).moves({ verbose: true }).filter((m) => m.from !== scp);

describe('randomScpStart', () => {
  it('uses every square of the two middle ranks, and nothing else', () => {
    const seen = new Set(Array.from({ length: 3000 }, () => randomScpStart()));
    expect(seen.size).toBe(16);
    for (const square of seen) expect(square).toMatch(/^[a-h][45]$/);
  });
  it('covers both ends of the range', () => {
    expect(randomScpStart(() => 0)).toBe('a4');
    expect(randomScpStart(() => 0.999)).toBe('h5');
  });
});

describe('hidden piece', () => {
  it('round trips to the same position', () => {
    expect(stripScp(withScp(START, 'a4'), 'a4')).toBe(START);
  });
  it('belongs to the side to move', () => {
    expect(new Chess(withScp(START, 'a4')).get('a4')).toMatchObject({ color: 'w' });
    const black = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
    expect(new Chess(withScp(black, 'a4')).get('a4')).toMatchObject({ color: 'b' });
  });
  it('cannot be landed on, by either side', () => {
    const white = '4k3/8/8/8/8/8/8/R3K3 w - - 0 1';
    expect(legalFrom(withScp(white, 'a4'), 'a4').some((m) => m.to === 'a4')).toBe(false);
    const black = 'r3k3/8/8/8/8/8/8/4K3 b - - 0 1';
    expect(legalFrom(withScp(black, 'a4'), 'a4').some((m) => m.to === 'a4')).toBe(false);
  });
  it('blocks sliders for both sides', () => {
    const white = '4k3/8/8/8/8/8/8/R3K3 w - - 0 1';
    expect(legalFrom(withScp(white, 'a4'), 'a4').some((m) => m.to === 'a5')).toBe(false);
    const black = 'r3k3/8/8/8/8/8/8/4K3 b - - 0 1';
    expect(legalFrom(withScp(black, 'a4'), 'a4').some((m) => m.to === 'a3')).toBe(false);
  });
  it('blocks a check through it', () => {
    // The a8 rook would check the a1 king if 096 were not on a4.
    const fen = 'r3k3/8/8/8/8/8/8/K7 w - - 0 1';
    expect(new Chess(fen).inCheck()).toBe(true);
    expect(new Chess(withScp(fen, 'a4')).inCheck()).toBe(false);
  });
  it('blocks a pawn from double-stepping through it', () => {
    const fen = '4k3/8/8/8/8/8/P7/4K3 w - - 0 1';
    expect(legalFrom(withScp(fen, 'a3'), 'a3').some((m) => m.from === 'a2')).toBe(false);
  });
  it('is never moved by the local move picker', () => {
    const fen = withScp(START, 'a4');
    for (let i = 0; i < 30; i++) expect(pickWeakMove(fen, 300, Math.random, 'a4')?.startsWith('a4')).toBe(false);
  });
});

describe('en passant with the hidden piece', () => {
  const fen = 'rnbqkbnr/ppp1pppp/8/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 3';
  it('survives adding and removing it', () => {
    expect(withScp(fen, 'a4').split(' ')[3]).toBe('d6');
    expect(stripScp(withScp(fen, 'a4'), 'a4')).toBe(fen);
  });
  it('is a legal move with it on the board', () => {
    expect(new Chess(withScp(fen, 'a4')).moves()).toContain('exd6');
  });
  it('is not broken by a pick that tests for an exposed king', () => {
    expect(pickVictim('r3k3/8/8/3pP3/8/2N5/8/4K3 w - d6 0 1', 'a4')).not.toBeNull();
  });
});

describe('findSeers', () => {
  it('sees nothing from the start position', () => {
    expect(findSeers(START, 'a4')).toEqual([]);
    expect(findSeers(START, 'h4')).toEqual([]);
  });
  it('counts both colours', () => {
    expect(findSeers('r3k3/8/8/8/8/2N5/8/4K3 w - - 0 1', 'a4').sort()).toEqual(['a8', 'c3']);
  });
  it('uses each piece\'s real attack pattern', () => {
    expect(findSeers('4k3/8/8/8/8/1P6/8/4K3 w - - 0 1', 'a4')).toEqual(['b3']); // Pawn, diagonally.
    expect(findSeers('4k3/8/8/8/8/P7/8/4K3 w - - 0 1', 'a4')).toEqual([]); // Pawn, straight ahead.
    expect(findSeers('4k3/8/8/8/8/1K6/8/8 w - - 0 1', 'a4')).toEqual(['b3']); // King, adjacent.
  });
  it('is blocked by other pieces', () => {
    expect(findSeers('r3k3/8/n7/8/8/8/8/4K3 w - - 0 1', 'a4')).toEqual([]);
  });
  it('counts a pinned piece', () => {
    // The c3 knight is pinned to the e1 king, but still sees a4.
    expect(findSeers('4k3/8/8/8/1b6/2N5/8/4K3 w - - 0 1', 'a4')).toContain('c3');
  });
});

describe('pickVictim', () => {
  it('returns null when nothing sees it', () => {
    expect(pickVictim(START, 'a4')).toBeNull();
  });
  it('takes the only seer', () => {
    expect(pickVictim('4k3/8/8/8/8/2N5/8/4K3 w - - 0 1', 'a4')).toBe('c3');
  });
  it('picks at random between seers, regardless of distance', () => {
    // The c3 knight is two squares away, the a8 rook four.
    const fen = 'r3k3/8/8/8/8/2N5/8/4K3 w - - 0 1';
    expect(pickVictim(fen, 'a4', () => 0)).toBe('c3');
    expect(pickVictim(fen, 'a4', () => 0.99)).toBe('a8');
  });
  it('gives every seer a roughly equal chance', () => {
    const fen = 'r3k3/8/8/1p6/8/1PN5/8/4K3 w - - 0 1';
    const counts: Record<string, number> = {};
    for (let i = 0; i < 2000; i++) {
      const pick = pickVictim(fen, 'a4')!;
      counts[pick] = (counts[pick] ?? 0) + 1;
    }
    expect(Object.keys(counts).sort()).toEqual(['a8', 'b3', 'b5', 'c3']);
    for (const count of Object.values(counts)) expect(count).toBeGreaterThan(380); // About 500 each.
  });
  it('can take a king', () => {
    expect(pickVictim('4k3/8/8/8/8/1K6/8/8 w - - 0 1', 'a4')).toBe('b3');
  });
  it('skips a meal that would expose the Black king to capture', () => {
    // 096 on e4 shields e8 from the e1 rook. Eating the f6 knight would step off the
    // e-file with White to move, so the rook, which stays on the file, is the only choice.
    const fen = '4k3/8/5n2/8/8/8/8/4R1K1 w - - 0 1';
    expect(findSeers(fen, 'e4').sort()).toEqual(['e1', 'f6']);
    for (let i = 0; i < 25; i++) expect(pickVictim(fen, 'e4')).toBe('e1');
  });
});

describe('afterStrike', () => {
  it('removes the piece and resets the 50-move count', () => {
    expect(afterStrike('4k3/8/8/8/1N6/8/8/4K3 w - - 12 30', 'b4')).toBe('4k3/8/8/8/8/8/8/4K3 w - - 0 30');
  });
  it('keeps en passant after a strike elsewhere', () => {
    expect(afterStrike('4k3/8/8/3pP3/1N6/8/8/4K3 w - d6 12 30', 'b4').split(' ')[3]).toBe('d6');
  });
  it('cancels en passant when the pawn that stepped is eaten', () => {
    expect(afterStrike('4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 30', 'd5').split(' ')[3]).toBe('-');
  });
  it('cancels en passant when the creature lands on that square', () => {
    expect(afterStrike('4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 30', 'd6').split(' ')[3]).toBe('-');
  });
  it('clears castling rights when a rook is eaten', () => {
    expect(afterStrike('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1', 'h1').split(' ')[2]).toBe('Qkq');
  });
  it('can leave White in check, which is a legal position', () => {
    // 096 on e4 shields the e1 king from the e8 rook, then leaves to eat the f2 knight.
    const fen = '4r1k1/8/8/8/8/8/5N2/4K3 w - - 0 1';
    expect(findSeers(fen, 'e4')).toContain('f2');
    expect(new Chess(withScp(afterStrike(fen, 'f2'), 'f2')).inCheck()).toBe(true);
  });
});

describe('afterKingEaten', () => {
  it('produces a displayable board without the king', () => {
    expect(afterKingEaten('4k3/8/8/8/8/1K6/8/8 w - - 0 1', 'b3').split(' ')[0]).toBe('4k3/8/8/8/8/8/8/8');
  });
});

describe('scpSan', () => {
  const play = (stripped: string, scp: 'a4' | 'h4' | 'e4' | 'c5', input: { from: string; to: string }) => {
    const chess = new Chess(withScp(stripped, scp));
    const raw = chess.move(input).san;
    const next = stripScp(chess.fen(), scp);
    const after = new Chess(withScp(next, scp));
    return { raw, san: scpSan(stripped, input, raw, after, scp) };
  };
  it('drops disambiguation caused by the hidden knight', () => {
    const { raw, san } = play(START, 'a4', { from: 'b1', to: 'c3' });
    expect(raw).toBe('Nbc3');
    expect(san).toBe('Nc3');
  });
  it('drops a check that only the hidden knight gives', () => {
    // A knight on c5 attacks the b7 king, but 096 gives no check.
    const { raw, san } = play('8/1k6/8/8/8/8/4P3/4K3 w - - 0 1', 'c5', { from: 'e2', to: 'e3' });
    expect(raw).toBe('e3+');
    expect(san).toBe('e3');
  });
  it('keeps a real check', () => {
    expect(play('4k3/8/8/8/8/8/8/R3K3 w - - 0 1', 'h4', { from: 'a1', to: 'a8' }).san).toBe('Ra8+');
  });
  it('marks a real mate', () => {
    expect(play('6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1', 'h4', { from: 'a1', to: 'a8' }).san).toBe('Ra8#');
  });
});

describe('knightDistances', () => {
  it('counts knight moves, not squares', () => {
    const distances = knightDistances('e4');
    expect(distances.get('e4')).toBe(0);
    expect(distances.get('f6')).toBe(1);
    expect(distances.get('e5')).toBe(3); // Right beside it, but three jumps.
    expect(distances.get('f5')).toBe(2); // Diagonal neighbour.
  });
  it('reaches every square', () => {
    expect(knightDistances('a1').size).toBe(64);
    expect(knightDistances('a1').get('b2')).toBe(4); // The famous corner case.
  });
});

describe('pickJump', () => {
  it('freezes while a piece sees it, from either side', () => {
    expect(pickJump('4k3/8/8/8/8/2N5/8/4K3 w - - 0 1', 'a4')).toBeNull();
    expect(pickJump('r3k3/8/8/8/8/8/8/4K3 w - - 0 1', 'a4')).toBeNull();
  });
  it('moves when nothing sees it', () => {
    expect(pickJump(START, 'a4')).not.toBeNull();
  });
  it('is not frozen by a king beside it', () => {
    const fen = '7k/8/8/3K4/8/8/8/8 w - - 0 1';
    expect(findSeers(fen, 'e5')).toEqual(['d5']);
    expect(findWatchers(fen, 'e5')).toEqual([]);
    expect(pickJump(fen, 'e5')).not.toBeNull();
  });
  it('always makes a knight move that gets one jump closer', () => {
    const fen = '7k/8/8/8/8/8/8/K7 w - - 0 1';
    const before = Math.min(knightDistances('h8').get('e4')!, knightDistances('a1').get('e4')!);
    for (let i = 0; i < 40; i++) {
      const to = pickJump(fen, 'e4')!;
      expect(knightDistances('e4').get(to)).toBe(1);
      expect(Math.min(knightDistances('h8').get(to)!, knightDistances('a1').get(to)!)).toBe(before - 1);
    }
  });
  it('chases the king nearest in knight moves, not the one beside it', () => {
    // The d5 king is beside e5 but 3 jumps away. The h6 king is only 2 jumps away.
    const fen = '8/8/7k/3K4/8/8/8/8 w - - 0 1';
    expect(knightDistances('d5').get('e5')).toBe(3);
    expect(knightDistances('h6').get('e5')).toBe(2);
    for (let i = 0; i < 25; i++) expect(knightDistances('h6').get(pickJump(fen, 'e5')!)).toBe(1);
  });
  it('lands on the king when one jump away', () => {
    expect(pickJump('4k3/8/8/8/8/8/8/K7 w - - 0 1', 'f6')).toBe('e8');
  });
  it('picks a king at random on a tie', () => {
    // Both kings are one jump from d3.
    const fen = '8/8/8/8/8/8/1k6/4K3 w - - 0 1';
    const picks = new Set(Array.from({ length: 60 }, () => pickJump(fen, 'd3')));
    expect(picks).toEqual(new Set(['b2', 'e1']));
  });
  it('does not avoid pieces on its route', () => {
    // From e4, d6 and f6 are both one jump from e8, and a pawn stands on d6.
    const fen = '4k3/8/3p4/8/8/8/8/K7 w - - 0 1';
    const picks = new Set(Array.from({ length: 60 }, () => pickJump(fen, 'e4')));
    expect(picks).toEqual(new Set(['d6', 'f6']));
  });
  it('kills what it lands on', () => {
    const fen = afterStrike('4k3/8/3p4/8/8/8/8/K7 w - - 0 1', 'd6');
    expect(new Chess(fen).get('d6')).toBeFalsy();
  });
});

describe('positionKey', () => {
  it('ignores the move counters but not 096', () => {
    expect(positionKey('4k3/8/8/8/8/8/8/4K3 w - - 3 9', 'a4')).toBe(positionKey('4k3/8/8/8/8/8/8/4K3 w - - 7 20', 'a4'));
    expect(positionKey('4k3/8/8/8/8/8/8/4K3 w - - 3 9', 'a4')).not.toBe(positionKey('4k3/8/8/8/8/8/8/4K3 w - - 3 9', 'h4'));
  });
});

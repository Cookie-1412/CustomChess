import { describe, expect, it, vi } from 'vitest';
import { Chess } from 'chess.js';
import { EngineError, StockfishClient, parseResponse } from './stockfishApi';
import { MAX_ELO, MIN_ELO, strengthFor } from './strength';
import { pickWeakMove } from './weakMove';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const ok = (bestmove = 'bestmove e2e4 ponder e7e5') =>
  new Response(JSON.stringify({ success: true, evaluation: 0.3, mate: null, bestmove }));

describe('parseResponse (shapes captured from the live API)', () => {
  it('reads a normal response', () => {
    expect(parseResponse({ success: true, evaluation: 0.52, mate: null, bestmove: 'bestmove e7e5 ponder g1f3' }))
      .toEqual({ bestMove: 'e7e5', evaluation: 0.52, mate: null });
  });
  it('handles mate as a string, and as a number', () => {
    expect(parseResponse({ success: true, evaluation: null, mate: '1', bestmove: 'bestmove d1d8' }).mate).toBe(1);
    expect(parseResponse({ success: true, evaluation: null, mate: -1, bestmove: 'bestmove d8d1' }).mate).toBe(-1);
  });
  it('treats "(none)" as no move', () => {
    expect(parseResponse({ success: true, evaluation: null, mate: 0, bestmove: 'bestmove (none)' }).bestMove).toBeNull();
  });
  it('keeps the promotion suffix', () => {
    expect(parseResponse({ success: true, evaluation: 9, mate: null, bestmove: 'bestmove a7a8q' }).bestMove).toBe('a7a8q');
  });
  it('throws on API errors', () => {
    expect(() => parseResponse({ success: false, error: 'Depth must be greater than 5' })).toThrow(EngineError);
  });
});

describe('strengthFor', () => {
  it('always stays inside the depth range the API accepts', () => {
    for (let elo = MIN_ELO - 100; elo <= MAX_ELO + 100; elo += 50) {
      const { depth } = strengthFor(elo);
      expect(depth).toBeGreaterThanOrEqual(5);
      expect(depth).toBeLessThanOrEqual(15);
    }
  });
  it('gets strictly harder as Elo rises', () => {
    for (let elo = MIN_ELO; elo < MAX_ELO; elo += 50) {
      expect(strengthFor(elo + 50).weakRate).toBeLessThan(strengthFor(elo).weakRate);
    }
  });
  it('plays pure Stockfish at the top of the scale', () => {
    expect(strengthFor(MAX_ELO)).toEqual({ depth: 15, weakRate: 0, noiseCp: 0 });
  });
});

describe('pickWeakMove', () => {
  it('always returns a legal move', () => {
    for (const noise of [0, 150, 400]) {
      const game = new Chess();
      for (let ply = 0; ply < 60 && !game.isGameOver(); ply++) {
        const uci = pickWeakMove(game.fen(), noise);
        expect(uci).not.toBeNull();
        game.move({ from: uci!.slice(0, 2), to: uci!.slice(2, 4), promotion: uci![4] });
      }
    }
  });
  it('takes a hanging queen and finds mate in one when noise is off', () => {
    expect(pickWeakMove('4k3/8/8/3q4/4P3/8/8/4K3 w - - 0 1', 0)).toBe('e4d5');
    expect(pickWeakMove('6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1', 0)).toBe('d1d8');
  });
  it('does not hang its queen with low noise', () => {
    // Moving the queen to d5 would lose it to the e6 pawn.
    for (let i = 0; i < 25; i++) {
      expect(pickWeakMove('4k3/8/4p3/8/8/3Q4/8/4K3 w - - 0 1', 20)).not.toBe('d3d5');
    }
  });
  it('blunders more often with more noise', () => {
    const fen = '4k3/8/8/3q4/4P3/8/8/4K3 w - - 0 1';
    const hits = (noise: number) => Array.from({ length: 60 }, () => pickWeakMove(fen, noise)).filter((m) => m === 'e4d5').length;
    expect(hits(400)).toBeLessThan(hits(20));
  });
  it('never underpromotes, however noisy', () => {
    for (let i = 0; i < 40; i++) {
      const uci = pickWeakMove('8/P6k/8/8/8/8/8/K7 w - - 0 1', 400);
      if (uci?.startsWith('a7a8')) expect(uci).toBe('a7a8q');
    }
  });
  it('returns null with no legal moves', () => {
    expect(pickWeakMove('rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3', 0)).toBeNull();
  });
  it('is fast enough for the UI thread in a busy position', () => {
    const fen = 'r1bq1rk1/pp2bppp/2n1pn2/2pp4/3P1B2/2PBPN2/PP1N1PPP/R2QK2R w KQ - 0 8';
    const start = performance.now();
    pickWeakMove(fen, 100);
    expect(performance.now() - start).toBeLessThan(250);
  });
});

describe('StockfishClient', () => {
  it('spaces requests out by the minimum gap', async () => {
    const times: number[] = [];
    const fetcher = vi.fn(async () => { times.push(Date.now()); return ok(); });
    const client = new StockfishClient(fetcher as unknown as typeof fetch, 60, [10]);
    await Promise.all([client.analyze(START, 5), client.analyze(START, 5), client.analyze(START, 5)]);
    expect(times).toHaveLength(3);
    expect(times[1] - times[0]).toBeGreaterThanOrEqual(55);
    expect(times[2] - times[1]).toBeGreaterThanOrEqual(55);
  });
  it('retries a 429 and then succeeds, reporting the wait', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response('error code: 1015', { status: 429 }))
      .mockResolvedValueOnce(ok());
    const client = new StockfishClient(fetcher as unknown as typeof fetch, 1, [10]);
    const waits: Array<number | null> = [];
    client.setRetryListener((w) => waits.push(w));
    await expect(client.analyze(START, 5)).resolves.toMatchObject({ bestMove: 'e2e4' });
    expect(waits).toEqual([10, null]);
  });
  it('retries a CORS-style network failure the same way', async () => {
    const fetcher = vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce(ok());
    const client = new StockfishClient(fetcher as unknown as typeof fetch, 1, [10]);
    await expect(client.analyze(START, 5)).resolves.toMatchObject({ bestMove: 'e2e4' });
  });
  it('gives up with an EngineError once retries run out', async () => {
    const fetcher = vi.fn(async () => new Response('', { status: 429 }));
    const client = new StockfishClient(fetcher as unknown as typeof fetch, 1, [5, 5]);
    await expect(client.analyze(START, 5)).rejects.toBeInstanceOf(EngineError);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
  it('does not retry an error reported by the API itself', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ success: false, error: 'bad fen' })));
    const client = new StockfishClient(fetcher as unknown as typeof fetch, 1, [5]);
    await expect(client.analyze(START, 5)).rejects.toThrow('bad fen');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('never sends a request cancelled in the same tick', async () => {
    const fetcher = vi.fn(async () => ok());
    const client = new StockfishClient(fetcher as unknown as typeof fetch, 1, [5]);
    const controller = new AbortController();
    const pending = client.analyze(START, 5, { signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('runs urgent work first and lets newer background requests replace older ones', async () => {
    const seen: string[] = [];
    const fetcher = vi.fn(async (url: string) => { seen.push(new URL(url).searchParams.get('depth')!); return ok(); });
    const client = new StockfishClient(fetcher as unknown as typeof fetch, 1, [5]);
    const stale = client.analyze(START, 7, { background: true });
    const fresh = client.analyze(START, 8, { background: true });
    const urgent = client.analyze(START, 9);
    await expect(stale).rejects.toMatchObject({ name: 'AbortError' });
    await Promise.all([fresh, urgent]);
    expect(seen).toEqual(['9', '8']);
  });
});

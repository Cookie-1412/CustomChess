/**
 * Client for the free stockfish.online REST API.
 *
 * Measured behaviour this client is built around:
 *  - About 6 back-to-back requests trigger a Cloudflare 429 (error 1015).
 *    That response may lack CORS headers, in which case the browser reports a
 *    plain network failure, so both cases are retried the same way.
 *  - Depth must be between 5 and 15.
 *  - `mate` can be a string or a number; `evaluation` is null when it is set.
 *  - Scores are from White's point of view.
 */
const ENDPOINT = 'https://stockfish.online/api/s/v2.php';

export const MIN_GAP_MS = 3000;
const REQUEST_TIMEOUT_MS = 15000;
const RETRY_DELAYS_MS = [4000, 8000, 16000];

export interface Analysis {
  /** UCI move, or null if the position has no legal moves. */
  bestMove: string | null;
  /** White's advantage in pawns, or null when a forced mate was found. */
  evaluation: number | null;
  /** Moves to mate: positive means White mates. Null if there is no mate. */
  mate: number | null;
}

export class EngineError extends Error {}

/** Parses a response body. Throws EngineError if the API reports a failure. */
export function parseResponse(body: unknown): Analysis {
  const data = body as { success?: boolean; error?: string; bestmove?: string; evaluation?: unknown; mate?: unknown };
  if (!data || data.success !== true) {
    throw new EngineError(data?.error ?? 'Stockfish returned an unreadable response');
  }
  const token = data.bestmove?.split(' ')[1];
  const number = (value: unknown) => (value === null || value === undefined || value === '' ? null : Number(value));
  return {
    bestMove: token && /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(token) ? token : null,
    evaluation: number(data.evaluation),
    mate: number(data.mate),
  };
}

interface Job {
  fen: string;
  depth: number;
  signal?: AbortSignal;
  attempt: number;
  resolve: (analysis: Analysis) => void;
  reject: (reason: unknown) => void;
}

export interface AnalyzeOptions {
  signal?: AbortSignal;
  /** Background work: runs only when nothing else is queued, and a newer request replaces it. */
  background?: boolean;
}

type RetryListener = (waitMs: number | null) => void;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const abortError = () => new DOMException('Aborted', 'AbortError');

/** Sends every request through one queue so the app stays under the rate limit. */
export class StockfishClient {
  private urgent: Job[] = [];
  private background: Job | null = null;
  private pumping = false;
  private nextSlot = 0;
  private onRetry: RetryListener = () => {};

  private readonly fetcher: typeof fetch;
  private readonly gapMs: number;
  private readonly retryDelays: number[];

  constructor(fetcher: typeof fetch = (...args) => fetch(...args), gapMs = MIN_GAP_MS, retryDelays = RETRY_DELAYS_MS) {
    this.fetcher = fetcher;
    this.gapMs = gapMs;
    this.retryDelays = retryDelays;
  }

  /** The listener gets the wait in ms when a retry is pending, then null once the retry settles. */
  setRetryListener(listener: RetryListener) {
    this.onRetry = listener;
  }

  analyze(fen: string, depth: number, options: AnalyzeOptions = {}): Promise<Analysis> {
    return new Promise((resolve, reject) => {
      const job: Job = { fen, depth, signal: options.signal, attempt: 0, resolve, reject };
      if (options.background) {
        this.background?.reject(abortError());
        this.background = job;
      } else {
        this.urgent.push(job);
      }
      // Deferred so a request cancelled in the same tick never hits the network.
      setTimeout(() => void this.pump(), 0);
    });
  }

  private takeNext(): Job | null {
    const job = this.urgent.shift() ?? this.background;
    if (job === this.background) this.background = null;
    return job ?? null;
  }

  private async pump() {
    if (this.pumping) return;
    this.pumping = true;
    try {
      for (;;) {
        const wait = this.nextSlot - Date.now();
        if (wait > 0) await sleep(wait);
        const job = this.takeNext();
        if (!job) return;
        if (job.signal?.aborted) {
          if (job.attempt > 0) this.onRetry(null);
          job.reject(abortError());
          continue;
        }
        await this.run(job);
      }
    } finally {
      this.pumping = false;
    }
  }

  private async run(job: Job) {
    this.nextSlot = Date.now() + this.gapMs;
    try {
      const analysis = await this.request(job);
      if (job.attempt > 0) this.onRetry(null);
      job.resolve(analysis);
    } catch (error) {
      if (job.signal?.aborted) {
        if (job.attempt > 0) this.onRetry(null);
        job.reject(abortError());
      } else if (error instanceof EngineError) {
        if (job.attempt > 0) this.onRetry(null);
        job.reject(error);
      } else if (job.attempt < this.retryDelays.length) {
        const delay = this.retryDelays[job.attempt];
        job.attempt += 1;
        this.nextSlot = Date.now() + delay;
        this.onRetry(delay);
        this.urgent.unshift(job);
      } else {
        this.onRetry(null);
        job.reject(new EngineError('The Stockfish API is not responding or is rate limiting this connection'));
      }
    }
  }

  private async request(job: Job): Promise<Analysis> {
    const url = `${ENDPOINT}?fen=${encodeURIComponent(job.fen)}&depth=${job.depth}`;
    const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
    const signal = job.signal ? AbortSignal.any([job.signal, timeout]) : timeout;
    const response = await this.fetcher(url, { signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return parseResponse(await response.json());
  }
}

export const stockfish = new StockfishClient();

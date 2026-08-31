/**
 * Bounded-concurrency mapping with retry.
 *
 * Firing every panel at once tripped the image model's per-project rate limit:
 * three concurrent requests, one 429, one panel silently missing from the board.
 * Image generation is far more rate-limited than text, so it needs a narrower
 * pipe and the patience to wait out a refusal rather than dropping the work.
 */

export interface ThrottleOptions {
  limit?: number;
  retries?: number;
  baseDelayMs?: number;
  /** Injected so tests do not actually sleep. */
  sleep?: (ms: number) => Promise<void>;
  isRetryable?: (err: unknown) => boolean;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** A 429 is the model asking us to slow down, not a failure of the request. */
export function isRateLimit(err: unknown): boolean {
  const text =
    typeof err === 'string' ? err : err instanceof Error ? err.message : JSON.stringify(err ?? '');
  return /429|RESOURCE_EXHAUSTED|rate limit|quota/i.test(text);
}

export async function mapWithLimit<T, R>(
  items: T[],
  fn: (item: T, index: number) => Promise<R>,
  options: ThrottleOptions = {},
): Promise<PromiseSettledResult<R>[]> {
  const {
    limit = 2,
    retries = 3,
    baseDelayMs = 1000,
    sleep = defaultSleep,
    isRetryable = isRateLimit,
  } = options;

  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let cursor = 0;

  const runOne = async (item: T, index: number): Promise<void> => {
    for (let attempt = 0; ; attempt++) {
      try {
        results[index] = { status: 'fulfilled', value: await fn(item, index) };
        return;
      } catch (err) {
        if (attempt >= retries || !isRetryable(err)) {
          results[index] = { status: 'rejected', reason: err };
          return;
        }
        // Back off further each time; a busy model needs more than a moment.
        await sleep(baseDelayMs * 2 ** attempt);
      }
    }
  };

  const worker = async (): Promise<void> => {
    while (cursor < items.length) {
      const index = cursor++;
      await runOne(items[index], index);
    }
  };

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

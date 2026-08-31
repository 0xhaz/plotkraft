import { describe, it, expect } from 'vitest';
import { mapWithLimit, isRateLimit } from './throttle';

const noSleep = async () => {};

describe('isRateLimit', () => {
  it('recognises the shapes a rate limit actually arrives in', () => {
    expect(isRateLimit(new Error('429 Too Many Requests'))).toBe(true);
    expect(isRateLimit(new Error('RESOURCE_EXHAUSTED'))).toBe(true);
    expect(isRateLimit('quota exceeded')).toBe(true);
  });

  it('does not retry a real failure', () => {
    expect(isRateLimit(new Error('invalid prompt'))).toBe(false);
    expect(isRateLimit(new Error('404 not found'))).toBe(false);
  });
});

describe('mapWithLimit', () => {
  it('returns results in input order', async () => {
    const out = await mapWithLimit([1, 2, 3], async (n) => n * 2, { sleep: noSleep });
    expect(out.map((r) => (r.status === 'fulfilled' ? r.value : null))).toEqual([2, 4, 6]);
  });

  it('never runs more than the limit at once', async () => {
    let running = 0;
    let peak = 0;
    await mapWithLimit(
      Array.from({ length: 10 }, (_, i) => i),
      async () => {
        running++;
        peak = Math.max(peak, running);
        await new Promise((r) => setTimeout(r, 5));
        running--;
      },
      { limit: 2, sleep: noSleep },
    );
    expect(peak).toBeLessThanOrEqual(2);
  });

  it('retries a rate limit and succeeds', async () => {
    // The exact failure: one panel refused, then fine on a second attempt.
    let attempts = 0;
    const out = await mapWithLimit(
      ['panel'],
      async () => {
        attempts++;
        if (attempts < 2) throw new Error('429 RESOURCE_EXHAUSTED');
        return 'drawn';
      },
      { sleep: noSleep },
    );
    expect(out[0]).toEqual({ status: 'fulfilled', value: 'drawn' });
    expect(attempts).toBe(2);
  });

  it('gives up after the retry budget', async () => {
    let attempts = 0;
    const out = await mapWithLimit(
      ['panel'],
      async () => {
        attempts++;
        throw new Error('429');
      },
      { retries: 2, sleep: noSleep },
    );
    expect(out[0].status).toBe('rejected');
    expect(attempts).toBe(3);
  });

  it('does not retry an error that will never succeed', async () => {
    let attempts = 0;
    const out = await mapWithLimit(
      ['panel'],
      async () => {
        attempts++;
        throw new Error('invalid prompt');
      },
      { sleep: noSleep },
    );
    expect(out[0].status).toBe('rejected');
    expect(attempts).toBe(1);
  });

  it('lets one failure through without losing the rest', async () => {
    const out = await mapWithLimit(
      [1, 2, 3],
      async (n) => {
        if (n === 2) throw new Error('invalid prompt');
        return n;
      },
      { sleep: noSleep },
    );
    expect(out.map((r) => r.status)).toEqual(['fulfilled', 'rejected', 'fulfilled']);
  });

  it('backs off further on each retry', async () => {
    const waits: number[] = [];
    await mapWithLimit(
      ['x'],
      async () => {
        throw new Error('429');
      },
      { retries: 3, baseDelayMs: 100, sleep: async (ms) => { waits.push(ms); } },
    );
    expect(waits).toEqual([100, 200, 400]);
  });

  it('handles an empty list', async () => {
    expect(await mapWithLimit([], async () => 1, { sleep: noSleep })).toEqual([]);
  });
});

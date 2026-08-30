import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import Parallel from 'parallel-web';
import { createHash } from 'node:crypto';

export interface SearchResult {
  url: string;
  title: string;
  excerpts: string[];
}

/**
 * Parallel Search — the Researcher agent's window onto the real world.
 *
 * Two cost controls matter here (techstacks.md §5): credits are finite and dev
 * burns them fastest, so every response is cached by claim hash and interactive
 * calls use 'basic' mode. 'advanced' is reserved for deliberate deep passes.
 */
@Injectable()
export class ParallelService {
  private readonly log = new Logger(ParallelService.name);
  private client?: Parallel;

  /** Process-local cache. Survives repeated demo runs; resets on deploy. */
  private readonly cache = new Map<string, SearchResult[]>();

  get configured(): boolean {
    return Boolean(process.env.PARALLEL_API_KEY);
  }

  private get api(): Parallel {
    if (!this.client) {
      const apiKey = process.env.PARALLEL_API_KEY;
      if (!apiKey) {
        throw new InternalServerErrorException(
          'PARALLEL_API_KEY is not set — the Researcher agent cannot run.',
        );
      }
      this.client = new Parallel({ apiKey });
    }
    return this.client;
  }

  private key(objective: string, queries: string[]): string {
    return createHash('sha256').update(`${objective}::${queries.join('|')}`).digest('hex');
  }

  /**
   * @param deep  Use 'advanced' mode. Reserved for background passes — interactive
   *              flag-checks stay on 'basic' for latency and credit reasons.
   */
  async search(objective: string, queries: string[], deep = false): Promise<SearchResult[]> {
    const cacheKey = this.key(objective, queries);
    const hit = this.cache.get(cacheKey);
    if (hit) {
      this.log.log(`parallel: cache hit (${queries[0] ?? objective.slice(0, 40)})`);
      return hit;
    }

    const res = await this.api.search({
      objective,
      search_queries: queries.slice(0, 3),
      mode: deep ? 'advanced' : 'basic',
      // Tell Parallel which model consumes this, so results are formatted for it.
      client_model: 'gemini-2.5-flash',
      advanced_settings: { max_results: 5 },
    });

    const results: SearchResult[] = (res.results ?? []).map((r) => ({
      url: r.url,
      title: r.title ?? r.url,
      excerpts: (r.excerpts ?? []).slice(0, 3),
    }));

    this.cache.set(cacheKey, results);
    this.log.log(`parallel: ${results.length} results for "${queries[0] ?? ''}" (${deep ? 'advanced' : 'basic'})`);
    return results;
  }
}

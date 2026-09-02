import { describe, it, expect } from 'vitest';
import { stalePanels, hasChangedSinceBoarded, countStale, type StaleEdge } from './staleness';

const scene = (id: string, version: number, boardVersion?: number, boarded = true) => ({
  id,
  version,
  boardVersion,
  boardPath: boarded ? `p/${id}.png` : undefined,
});

const edge = (from: string, to: string, type: StaleEdge['type'] = 'therefore'): StaleEdge => ({
  fromSceneId: from,
  toSceneId: to,
  type,
});

describe('hasChangedSinceBoarded', () => {
  it('is true once the scene moves past its panel', () => {
    expect(hasChangedSinceBoarded(scene('a', 2, 1))).toBe(true);
  });

  it('is false while they agree', () => {
    expect(hasChangedSinceBoarded(scene('a', 1, 1))).toBe(false);
  });

  it('is false for a scene that was never boarded', () => {
    expect(hasChangedSinceBoarded(scene('a', 5, undefined, false))).toBe(false);
  });
});

describe('stalePanels', () => {
  it('marks an edited scene directly stale', () => {
    const out = stalePanels([scene('a', 2, 1)], []);
    expect(out.get('a')).toBe('direct');
  });

  it('marks causally downstream panels as upstream-stale, not direct', () => {
    // The distinction that matters: b and c are still accurate pictures.
    const out = stalePanels(
      [scene('a', 2, 1), scene('b', 1, 1), scene('c', 1, 1)],
      [edge('a', 'b'), edge('b', 'c')],
    );
    expect(out.get('a')).toBe('direct');
    expect(out.get('b')).toBe('upstream');
    expect(out.get('c')).toBe('upstream');
  });

  it('does not carry consequence past an and-then joint', () => {
    // "and then" is the claim that nothing downstream depended on it.
    const out = stalePanels(
      [scene('a', 2, 1), scene('b', 1, 1), scene('c', 1, 1)],
      [edge('a', 'b', 'and_then'), edge('b', 'c')],
    );
    expect(out.get('a')).toBe('direct');
    expect(out.has('b')).toBe(false);
    expect(out.has('c')).toBe(false);
  });

  it('keeps the stronger claim when a scene is both', () => {
    const out = stalePanels([scene('a', 2, 1), scene('b', 3, 1)], [edge('a', 'b')]);
    expect(out.get('b')).toBe('direct');
  });

  it('says nothing when nothing has changed', () => {
    const out = stalePanels([scene('a', 1, 1), scene('b', 1, 1)], [edge('a', 'b')]);
    expect(out.size).toBe(0);
  });

  it('ignores downstream scenes that were never boarded', () => {
    const out = stalePanels(
      [scene('a', 2, 1), scene('b', 1, undefined, false)],
      [edge('a', 'b')],
    );
    expect(out.has('b')).toBe(false);
  });

  it('terminates on a cycle', () => {
    const out = stalePanels(
      [scene('a', 2, 1), scene('b', 1, 1)],
      [edge('a', 'b'), edge('b', 'a')],
    );
    expect(out.get('a')).toBe('direct');
  });

  it('does nothing on a board with no panels', () => {
    expect(stalePanels([scene('a', 2, 1, false)], []).size).toBe(0);
  });
});

describe('countStale', () => {
  it('separates the two claims for the toolbar', () => {
    const out = stalePanels(
      [scene('a', 2, 1), scene('b', 1, 1), scene('c', 1, 1)],
      [edge('a', 'b'), edge('b', 'c')],
    );
    expect(countStale(out)).toEqual({ direct: 1, upstream: 2 });
  });
});

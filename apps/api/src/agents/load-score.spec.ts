import { describe, it, expect } from 'vitest';
import { computeLoadScores, cutCandidates, type GraphEdge } from './load-score';

const ids = ['a', 'b', 'c', 'd'];

describe('computeLoadScores', () => {
  it('scores a causal chain by how much hangs downstream', () => {
    const edges: GraphEdge[] = [
      { from: 'a', to: 'b', type: 'therefore' },
      { from: 'b', to: 'c', type: 'but' },
      { from: 'c', to: 'd', type: 'therefore' },
    ];
    const s = computeLoadScores(ids, edges);
    // a reaches b,c,d (3) → 1.0; b reaches 2 → .667; c reaches 1 → .333; d reaches 0.
    expect(s.get('a')).toBe(1);
    expect(s.get('b')).toBeCloseTo(0.667, 2);
    expect(s.get('c')).toBeCloseTo(0.333, 2);
    expect(s.get('d')).toBe(0);
  });

  it('ignores and_then edges — a weak joint carries no structural load', () => {
    const s = computeLoadScores(['a', 'b'], [{ from: 'a', to: 'b', type: 'and_then' }]);
    expect(s.get('a')).toBe(0);
    expect(s.get('b')).toBe(0);
  });

  it('flags scenes with nothing downstream as cut candidates', () => {
    const edges: GraphEdge[] = [
      { from: 'a', to: 'b', type: 'therefore' },
      { from: 'c', to: 'd', type: 'and_then' },
    ];
    const s = computeLoadScores(ids, edges);
    expect(cutCandidates(s).sort()).toEqual(['b', 'c', 'd']);
  });

  it('counts a diamond payoff once, not twice', () => {
    const edges: GraphEdge[] = [
      { from: 'a', to: 'b', type: 'therefore' },
      { from: 'a', to: 'c', type: 'therefore' },
      { from: 'b', to: 'd', type: 'therefore' },
      { from: 'c', to: 'd', type: 'therefore' },
    ];
    const s = computeLoadScores(ids, edges);
    expect(s.get('a')).toBe(1); // reaches b, c, d — three distinct scenes
    expect(s.get('b')).toBeCloseTo(0.333, 2);
  });

  it('terminates on a cycle instead of recursing forever', () => {
    const edges: GraphEdge[] = [
      { from: 'a', to: 'b', type: 'therefore' },
      { from: 'b', to: 'a', type: 'therefore' },
    ];
    const s = computeLoadScores(['a', 'b'], edges);
    expect(s.get('a')).toBeGreaterThan(0);
    expect(s.get('b')).toBeGreaterThan(0);
  });

  it('returns all-zero for a graph with no edges', () => {
    const s = computeLoadScores(ids, []);
    expect([...s.values()]).toEqual([0, 0, 0, 0]);
  });
});

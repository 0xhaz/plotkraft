import { describe, it, expect } from 'vitest';
import {
  analyzeCircle,
  estimatePageWeight,
  isChaos,
  type CircleStep,
  type SceneAssignment,
} from './story-circle';

/** Build assignments from a list of steps, one unit of weight each. */
const from = (steps: CircleStep[], weights?: number[]): SceneAssignment[] =>
  steps.map((step, index) => ({
    sceneId: `s${index}`,
    index,
    step,
    weight: weights?.[index] ?? 1,
  }));

/** A well-proportioned 20-scene script hitting every step. */
const healthy = from([
  1, 1, 2, 2, 3, 4, 4, 4, 4, 4, 5, 5, 5, 6, 6, 6, 7, 7, 8, 8,
] as CircleStep[]);

describe('analyzeCircle — shares', () => {
  it('computes share of screen time per step', () => {
    const a = analyzeCircle(from([1, 1, 2, 2] as CircleStep[]));
    expect(a.shares[1]).toBeCloseTo(0.5, 3);
    expect(a.shares[2]).toBeCloseTo(0.5, 3);
    expect(a.shares[4]).toBe(0);
  });

  it('weights scenes by screen time, not scene count', () => {
    // One long step-1 scene outweighs three short step-2 scenes.
    const a = analyzeCircle(from([1, 2, 2, 2] as CircleStep[], [9, 1, 1, 1]));
    expect(a.shares[1]).toBeCloseTo(0.75, 3);
    expect(a.shares[2]).toBeCloseTo(0.25, 3);
  });

  it('returns an empty analysis for no scenes', () => {
    const a = analyzeCircle([]);
    expect(a.diagnostics).toEqual([]);
    expect(a.goThreshold).toBeNull();
  });

  it('ignores negative weights rather than corrupting the totals', () => {
    const a = analyzeCircle(from([1, 2] as CircleStep[], [-5, 1]));
    expect(a.shares[2]).toBeCloseTo(1, 3);
  });
});

describe('analyzeCircle — missing steps', () => {
  it('calls a missing Take critical and says what it means', () => {
    const a = analyzeCircle(from([1, 2, 3, 4, 5, 7, 8] as CircleStep[]));
    const d = a.diagnostics.find((x) => x.kind === 'missing_step' && x.step === 6);
    expect(d?.severity).toBe('critical');
    expect(d?.message).toContain('for free');
  });

  it('calls a missing Change critical', () => {
    const a = analyzeCircle(from([1, 2, 3, 4, 5, 6, 7] as CircleStep[]));
    const d = a.diagnostics.find((x) => x.kind === 'missing_step' && x.step === 8);
    expect(d?.severity).toBe('critical');
  });

  it('reports no missing steps when all eight are present', () => {
    expect(analyzeCircle(healthy).diagnostics.filter((d) => d.kind === 'missing_step')).toEqual([]);
  });
});

describe('analyzeCircle — proportions', () => {
  it('flags a bloated Search as the sagging-act note', () => {
    const steps = [1, 2, 3, ...Array(12).fill(4), 5, 6, 7, 8] as CircleStep[];
    const d = analyzeCircle(from(steps)).diagnostics.find(
      (x) => x.kind === 'disproportionate' && x.step === 4,
    );
    expect(d).toBeTruthy();
    expect(d?.message).toMatch(/Search occupies \d+% of the script/);
  });

  it('stays quiet about proportions on a script too short to judge', () => {
    const a = analyzeCircle(from([1, 4, 4, 4] as CircleStep[]));
    expect(a.diagnostics.filter((d) => d.kind === 'disproportionate')).toEqual([]);
  });

  it('leaves a well-proportioned script without proportion warnings', () => {
    const warned = analyzeCircle(healthy).diagnostics.filter(
      (d) => d.kind === 'disproportionate' && d.severity === 'warn',
    );
    expect(warned).toEqual([]);
  });
});

describe('analyzeCircle — thresholds', () => {
  it('flags a late crossing into chaos', () => {
    // Ten scenes of setup before Go: 50% in.
    const steps = [1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 3, 4, 5, 6, 7, 8] as CircleStep[];
    const a = analyzeCircle(from(steps));
    expect(a.goThreshold).toBeCloseTo(0.625, 2);
    const d = a.diagnostics.find((x) => x.kind === 'late_threshold');
    expect(d?.message).toContain('slow-start');
  });

  it('does not flag a conventional crossing', () => {
    expect(analyzeCircle(healthy).diagnostics.filter((d) => d.kind === 'late_threshold')).toEqual([]);
  });

  it('flags a rushed ending', () => {
    const steps = [
      1, 1, 2, 2, 3, 4, 4, 4, 4, 4, 4, 4, 5, 5, 5, 6, 6, 6, 6, 6, 7, 8,
    ] as CircleStep[];
    const weights = steps.map((s) => (s === 7 || s === 8 ? 0.2 : 1));
    const d = analyzeCircle(from(steps, weights)).diagnostics.find(
      (x) => x.kind === 'compressed_return',
    );
    expect(d?.message).toContain('asserted rather than dramatised');
  });
});

describe('analyzeCircle — non-linearity', () => {
  it('says nothing about a broadly linear script', () => {
    // Interleaving Search and Find is normal screenwriting, not an error.
    const a = analyzeCircle(from([1, 2, 3, 4, 5, 4, 5, 6, 7, 8] as CircleStep[]));
    expect(a.diagnostics.filter((d) => d.kind === 'non_linear')).toEqual([]);
    expect(a.nonLinearity).toBeLessThan(0.15);
  });

  it('reports a heavily intercut script once, not per scene', () => {
    // A feature cutting between two threads: this used to emit one warning per
    // cut and bury every real finding.
    const steps = [1, 5, 1, 5, 1, 6, 2, 6, 2, 7, 3, 7, 4, 8] as CircleStep[];
    const a = analyzeCircle(from(steps));
    const flagged = a.diagnostics.filter((d) => d.kind === 'non_linear');
    expect(flagged).toHaveLength(1);
    expect(flagged[0].severity).toBe('info');
    expect(flagged[0].message).toMatch(/intercut/i);
  });

  it('keeps the total finding count small even on a badly intercut script', () => {
    const steps = Array.from({ length: 200 }, (_, i) => ((i % 8) + 1) as CircleStep);
    const a = analyzeCircle(from(steps));
    // The old per-scene rule produced well over a hundred here.
    expect(a.diagnostics.length).toBeLessThan(12);
  });

  it('measures the backtrack rate rather than merely flagging it', () => {
    const a = analyzeCircle(from([1, 8, 1, 8, 1, 8] as CircleStep[]));
    expect(a.nonLinearity).toBeGreaterThan(0.15);
  });
});

describe('helpers', () => {
  it('places steps 3-6 in chaos and the rest in order', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8].map((s) => isChaos(s as CircleStep))).toEqual([
      false, false, true, true, true, true, false, false,
    ]);
  });

  it('estimates page weight from text length with a floor', () => {
    expect(estimatePageWeight('x'.repeat(800))).toBeCloseTo(1, 2);
    expect(estimatePageWeight('')).toBe(0.1);
  });
});

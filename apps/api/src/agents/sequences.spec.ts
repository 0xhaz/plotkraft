import { describe, it, expect } from 'vitest';
import { normalizeSequences, assignActs, sequenceLength, type Sequence } from './sequences';

const seq = (startIndex: number, endIndex: number, name = 'Seq') => ({
  startIndex,
  endIndex,
  name,
});

/** Every scene appears in exactly one sequence, in order. */
function coversExactly(sequences: Sequence[], sceneCount: number): boolean {
  const seen = new Set<number>();
  let cursor = 0;
  for (const s of sequences) {
    if (s.startIndex !== cursor) return false;
    for (let i = s.startIndex; i <= s.endIndex; i++) {
      if (seen.has(i)) return false;
      seen.add(i);
    }
    cursor = s.endIndex + 1;
  }
  return seen.size === sceneCount;
}

describe('normalizeSequences', () => {
  it('leaves a clean segmentation alone', () => {
    const r = normalizeSequences([seq(0, 4, 'A'), seq(5, 9, 'B')], 10);
    expect(r.map((s) => s.name)).toEqual(['A', 'B']);
    expect(coversExactly(r, 10)).toBe(true);
  });

  it('fills a gap rather than losing the scenes in it', () => {
    // Scenes 5-7 would otherwise disappear from the board entirely.
    const r = normalizeSequences([seq(0, 4, 'A'), seq(8, 9, 'B')], 10);
    expect(coversExactly(r, 10)).toBe(true);
    expect(r.some((s) => s.startIndex === 5 && s.endIndex === 7)).toBe(true);
  });

  it('trims an overlap in favour of the earlier sequence', () => {
    const r = normalizeSequences([seq(0, 6, 'A'), seq(4, 9, 'B')], 10);
    expect(coversExactly(r, 10)).toBe(true);
    expect(r[1].startIndex).toBe(7);
  });

  it('covers the tail when the model stops early', () => {
    const r = normalizeSequences([seq(0, 4, 'A')], 10);
    expect(coversExactly(r, 10)).toBe(true);
  });

  it('covers everything when the model returns nothing', () => {
    const r = normalizeSequences([], 10);
    expect(coversExactly(r, 10)).toBe(true);
    expect(r).toHaveLength(1);
  });

  it('sorts sequences arriving out of order', () => {
    const r = normalizeSequences([seq(5, 9, 'B'), seq(0, 4, 'A')], 10);
    expect(r.map((s) => s.name)).toEqual(['A', 'B']);
  });

  it('clamps indexes past the end of the script', () => {
    const r = normalizeSequences([seq(0, 99, 'A')], 10);
    expect(r[0].endIndex).toBe(9);
    expect(coversExactly(r, 10)).toBe(true);
  });

  it('discards a reversed range', () => {
    const r = normalizeSequences([seq(6, 2, 'bad'), seq(0, 9, 'good')], 10);
    expect(r.every((s) => s.endIndex >= s.startIndex)).toBe(true);
    expect(coversExactly(r, 10)).toBe(true);
  });

  it('drops a sequence entirely swallowed by an earlier one', () => {
    const r = normalizeSequences([seq(0, 9, 'A'), seq(3, 5, 'B')], 10);
    expect(r).toHaveLength(1);
    expect(coversExactly(r, 10)).toBe(true);
  });

  it('names an unnamed sequence rather than leaving it blank', () => {
    const r = normalizeSequences([{ startIndex: 0, endIndex: 9, name: '   ' }], 10);
    expect(r[0].name).toBe('Unnamed sequence');
  });

  it('returns nothing for an empty script', () => {
    expect(normalizeSequences([seq(0, 4)], 0)).toEqual([]);
  });
});

describe('assignActs', () => {
  const mk = (ranges: [number, number][]) =>
    ranges.map(([a, b], i) => ({ ...seq(a, b, `S${i}`), purpose: '' }));

  /** Acts must never go backwards across the script. */
  function isContiguous(result: Sequence[]): boolean {
    let last = 0;
    for (const s of result) {
      if ((s.act ?? 0) < last) return false;
      last = s.act ?? 0;
    }
    return true;
  }

  it('follows clean per-scene placement', () => {
    const clean = (i: number) => (i < 10 ? 1 : i < 30 ? 2 : 3);
    const r = assignActs(mk([[0, 9], [10, 29], [30, 39]]), clean);
    expect(r.map((s) => s.act)).toEqual([1, 2, 3]);
  });

  it('never lets an act come back after it has passed', () => {
    // The real failure: independent votes produced an Act One containing
    // sequences 1,2,3,4,6,10 — a story does not return to its first act.
    const zigzag = (i: number) => {
      const bucket = Math.floor(i / 10);
      return [1, 2, 1, 3, 2, 1][bucket % 6];
    };
    const r = assignActs(mk([[0, 9], [10, 19], [20, 29], [30, 39], [40, 49], [50, 59]]), zigzag);
    expect(isContiguous(r)).toBe(true);
  });

  it('stays contiguous when placement wobbles scene to scene', () => {
    const wobbly = (i: number) => (i % 2 === 0 ? 1 : 3);
    const r = assignActs(mk([[0, 19], [20, 39], [40, 59]]), wobbly);
    expect(isContiguous(r)).toBe(true);
  });

  it('does not fragment a sequence that straddles a boundary', () => {
    const clean = (i: number) => (i <= 3 ? 1 : 2);
    const r = assignActs(mk([[0, 7]]), clean);
    expect(r).toHaveLength(1);
    expect(r[0].startIndex).toBe(0);
    expect(r[0].endIndex).toBe(7);
  });

  it('leaves an act empty rather than inventing one', () => {
    // A script with no third act is a finding, not something to paper over.
    const twoActs = (i: number) => (i < 20 ? 1 : 2);
    const r = assignActs(mk([[0, 19], [20, 39]]), twoActs);
    expect(r.map((s) => s.act)).toEqual([1, 2]);
  });

  it('keeps full coverage', () => {
    const clean = (i: number) => (i <= 3 ? 1 : 2);
    const r = assignActs(mk([[0, 5], [6, 7]]), clean);
    expect(coversExactly(r, 8)).toBe(true);
  });

  it('handles an empty script', () => {
    expect(assignActs([], () => 1)).toEqual([]);
  });
});

describe('sequenceLength', () => {
  it('counts an inclusive range', () => {
    expect(sequenceLength({ ...seq(3, 7), purpose: '' })).toBe(5);
    expect(sequenceLength({ ...seq(3, 3), purpose: '' })).toBe(1);
  });
});

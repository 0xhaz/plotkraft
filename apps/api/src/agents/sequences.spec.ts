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
  // Scenes 0-3 in act 1, 4-7 in act 2.
  const clean = (i: number) => (i <= 3 ? 1 : 2);

  it('gives a sequence the act most of its scenes are in', () => {
    const r = assignActs([{ ...seq(0, 5, 'Mostly one'), purpose: '' }], clean);
    expect(r[0].act).toBe(1);
  });

  it('does not fragment a sequence that straddles a boundary', () => {
    const r = assignActs([{ ...seq(0, 7, 'Straddler'), purpose: '' }], clean);
    expect(r).toHaveLength(1);
    expect(r[0].startIndex).toBe(0);
    expect(r[0].endIndex).toBe(7);
  });

  it('survives act assignment that wobbles scene to scene', () => {
    // The failure that mattered: on an intercut feature the per-scene act
    // alternates, and splitting on every change turned 16 sequences into 55.
    const wobbly = (i: number) => (i % 2 === 0 ? 1 : 2);
    const r = assignActs(
      [
        { ...seq(0, 19, 'One'), purpose: '' },
        { ...seq(20, 39, 'Two'), purpose: '' },
      ],
      wobbly,
    );
    expect(r).toHaveLength(2);
  });

  it('keeps an entirely unplaced sequence unplaced', () => {
    const r = assignActs([{ ...seq(0, 3, 'Nowhere'), purpose: '' }], () => 0);
    expect(r[0].act).toBe(0);
  });

  it('takes the act its placed scenes agree on when some are unplaced', () => {
    const patchy = (i: number) => (i < 2 ? 0 : 3);
    const r = assignActs([{ ...seq(0, 3, 'Patchy'), purpose: '' }], patchy);
    expect(r[0].act).toBe(3);
  });

  it('leaves the ranges untouched', () => {
    const input = [
      { ...seq(0, 5, 'One'), purpose: '' },
      { ...seq(6, 7, 'Two'), purpose: '' },
    ];
    const r = assignActs(input, clean);
    expect(coversExactly(r, 8)).toBe(true);
  });
});

describe('sequenceLength', () => {
  it('counts an inclusive range', () => {
    expect(sequenceLength({ ...seq(3, 7), purpose: '' })).toBe(5);
    expect(sequenceLength({ ...seq(3, 3), purpose: '' })).toBe(1);
  });
});

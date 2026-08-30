import { describe, it, expect } from 'vitest';
import { serpentinePosition, serpentineLayout, CARD_W, GAP_X, COLUMNS } from './layout';

describe('serpentineLayout', () => {
  it('runs the first row left to right', () => {
    const [a, b] = [serpentinePosition(0), serpentinePosition(1)];
    expect(b.x).toBeGreaterThan(a.x);
    expect(b.y).toBe(a.y);
  });

  it('runs the second row right to left', () => {
    const first = serpentinePosition(COLUMNS);
    const second = serpentinePosition(COLUMNS + 1);
    expect(second.x).toBeLessThan(first.x);
  });

  it('places the wrap directly below its predecessor', () => {
    // The whole point: the last card of a row and the first of the next share a
    // column, so the joining edge is a short hop rather than a long diagonal.
    const last = serpentinePosition(COLUMNS - 1);
    const next = serpentinePosition(COLUMNS);
    expect(next.x).toBe(last.x);
    expect(next.y).toBeGreaterThan(last.y);
  });

  it('keeps every card inside the column band', () => {
    const positions = serpentineLayout(13);
    const maxX = (COLUMNS - 1) * (CARD_W + GAP_X);
    for (const p of positions) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(maxX);
    }
  });

  it('never overlaps two cards', () => {
    const seen = new Set(serpentineLayout(20).map((p) => `${p.x},${p.y}`));
    expect(seen.size).toBe(20);
  });
});

import { actOfStep, actLayout } from './layout';

describe('actOfStep', () => {
  it('ends Act One at the threshold crossing', () => {
    expect([1, 2, 3].map(actOfStep)).toEqual([1, 1, 1]);
  });

  it('puts the chaos half in Act Two', () => {
    expect([4, 5, 6].map(actOfStep)).toEqual([2, 2, 2]);
  });

  it('begins Act Three at the return', () => {
    expect([7, 8].map(actOfStep)).toEqual([3, 3]);
  });

  it('does not silently file an unplaced scene under Act One', () => {
    expect(actOfStep(undefined)).toBe(0);
    expect(actOfStep(0)).toBe(0);
    expect(actOfStep(99)).toBe(0);
  });
});

describe('actLayout', () => {
  const scenes = [
    { id: 'a', index: 0, circleStep: 1 },
    { id: 'b', index: 1, circleStep: 4 },
    { id: 'c', index: 2, circleStep: 8 },
    { id: 'd', index: 3 },
  ];

  it('stacks the acts in story order, unplaced last', () => {
    const { bands } = actLayout(scenes);
    expect(bands.map((b) => b.act)).toEqual([1, 2, 3, 0]);
    for (let i = 1; i < bands.length; i++) {
      expect(bands[i].y).toBeGreaterThan(bands[i - 1].y);
    }
  });

  it('omits a band for an act with no scenes', () => {
    const { bands } = actLayout([{ id: 'a', index: 0, circleStep: 1 }]);
    expect(bands.map((b) => b.act)).toEqual([1]);
  });

  it('positions every scene inside its own band', () => {
    const { positions, bands } = actLayout(scenes);
    for (const band of bands) {
      for (const id of band.sceneIds) {
        const p = positions.get(id)!;
        expect(p.y).toBeGreaterThanOrEqual(band.y);
        expect(p.y).toBeLessThan(band.y + band.height);
      }
    }
  });

  it('keeps script order within an act', () => {
    const many = [
      { id: 'x', index: 5, circleStep: 4 },
      { id: 'y', index: 1, circleStep: 4 },
    ];
    const { positions } = actLayout(many);
    // index 1 is laid out first, so it sits to the left of index 5.
    expect(positions.get('y')!.x).toBeLessThan(positions.get('x')!.x);
  });
});

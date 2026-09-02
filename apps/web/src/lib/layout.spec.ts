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

describe('actLayout — collapsing', () => {
  const many = [
    ...Array.from({ length: 5 }, (_, i) => ({ id: `a${i}`, index: i, circleStep: 1 })),
    ...Array.from({ length: 40 }, (_, i) => ({ id: `b${i}`, index: 10 + i, circleStep: 5 })),
    ...Array.from({ length: 5 }, (_, i) => ({ id: `c${i}`, index: 100 + i, circleStep: 8 })),
  ];

  it('hides the scenes of a collapsed act', () => {
    const { hidden, positions } = actLayout(many, COLUMNS, new Set([2]));
    expect(hidden.size).toBe(40);
    expect(positions.has('b0')).toBe(false);
    expect(positions.has('a0')).toBe(true);
  });

  it('keeps a collapsed act visible as a landmark', () => {
    const { bands } = actLayout(many, COLUMNS, new Set([2]));
    const two = bands.find((b) => b.act === 2)!;
    expect(two.collapsed).toBe(true);
    expect(two.sceneIds).toHaveLength(40);
    expect(two.height).toBeLessThan(80);
  });

  it('pulls the later acts up when one is collapsed', () => {
    const open = actLayout(many).bands.find((b) => b.act === 3)!;
    const shut = actLayout(many, COLUMNS, new Set([2])).bands.find((b) => b.act === 3)!;
    expect(shut.y).toBeLessThan(open.y);
  });

  it('hides everything when all acts are collapsed', () => {
    const { hidden, bands } = actLayout(many, COLUMNS, new Set([1, 2, 3, 0]));
    expect(hidden.size).toBe(many.length);
    expect(bands).toHaveLength(3);
  });
});

import { outlineLayout, type SequenceMeta } from './layout';

describe('outlineLayout', () => {
  const scenes = Array.from({ length: 30 }, (_, i) => ({
    id: `s${i}`,
    index: i,
    circleStep: i < 10 ? 1 : i < 25 ? 5 : 8,
  }));

  const sequences: SequenceMeta[] = [
    { order: 0, name: 'Opening', purpose: 'establish', startIndex: 0, endIndex: 9, act: 1 },
    { order: 1, name: 'The middle', purpose: 'complicate', startIndex: 10, endIndex: 24, act: 2 },
    { order: 2, name: 'The end', purpose: 'resolve', startIndex: 25, endIndex: 29, act: 3 },
  ];

  it('nests sequences inside their acts', () => {
    const o = outlineLayout(scenes, sequences, new Set(), new Set());
    expect(o.actBands.map((b) => b.act)).toEqual([1, 2, 3]);
    expect(o.seqBands.map((b) => b.name)).toEqual(['Opening', 'The middle', 'The end']);
  });

  it('places every sequence row inside its own act band', () => {
    const o = outlineLayout(scenes, sequences, new Set(), new Set());
    for (const band of o.seqBands) {
      const act = o.actBands.find((a) => a.act === band.act)!;
      expect(band.y).toBeGreaterThanOrEqual(act.y);
      expect(band.y + band.height).toBeLessThanOrEqual(act.y + act.height);
    }
  });

  it('hides only the scenes of a collapsed sequence', () => {
    const o = outlineLayout(scenes, sequences, new Set([1]), new Set());
    expect(o.hidden.size).toBe(15);
    expect(o.hidden.has('s10')).toBe(true);
    expect(o.hidden.has('s0')).toBe(false);
  });

  it('collapsing an act hides its scenes but keeps its sequence rows', () => {
    const o = outlineLayout(scenes, sequences, new Set(), new Set([2]));
    expect(o.hidden.size).toBe(15);
    // The rows survive so the act still reads as an outline.
    expect(o.seqBands.filter((b) => b.act === 2)).toHaveLength(1);
  });

  it('shrinks the board when a sequence collapses', () => {
    const open = outlineLayout(scenes, sequences, new Set(), new Set());
    const shut = outlineLayout(scenes, sequences, new Set([1]), new Set());
    const lastOpen = open.actBands[open.actBands.length - 1];
    const lastShut = shut.actBands[shut.actBands.length - 1];
    expect(lastShut.y).toBeLessThan(lastOpen.y);
  });

  it('positions no scene it has hidden', () => {
    const o = outlineLayout(scenes, sequences, new Set([0, 1, 2]), new Set());
    expect(o.positions.size).toBe(0);
    expect(o.hidden.size).toBe(30);
  });

  it('ignores a sequence range with no matching scenes', () => {
    const o = outlineLayout(
      scenes,
      [{ order: 0, name: 'Ghost', purpose: '', startIndex: 900, endIndex: 910, act: 1 }],
      new Set(),
      new Set(),
    );
    expect(o.seqBands[0].sceneIds).toEqual([]);
  });
});

import { packRows, CARD_H_BOARDED, CARD_H, GAP_Y } from './layout';

describe('packRows', () => {
  const bare = (n: number) => Array.from({ length: n }, () => CARD_H);

  it('reads left to right on every row by default', () => {
    // A storyboard is read like a page. Snaking it makes shot order unfollowable.
    const { positions } = packRows(bare(8), 4);
    expect(positions[4].x).toBe(0);
    expect(positions[5].x).toBeGreaterThan(positions[4].x);
    expect(positions[7].x).toBeGreaterThan(positions[5].x);
  });

  it('can still snake when asked, for the graph view', () => {
    const { positions } = packRows(bare(8), 4, true);
    expect(positions[4].x).toBeGreaterThan(positions[5].x);
  });

  it('gives a row the height of its tallest card', () => {
    // The overlap bug: one boarded card in a row of bare ones.
    const heights = [CARD_H, CARD_H_BOARDED, CARD_H, CARD_H, CARD_H];
    const { positions } = packRows(heights, 4);
    expect(positions[4].y).toBeGreaterThanOrEqual(CARD_H_BOARDED + GAP_Y);
  });

  it('never lets a card overlap the row beneath it', () => {
    const heights = [CARD_H_BOARDED, CARD_H, CARD_H_BOARDED, CARD_H, CARD_H, CARD_H];
    const { positions } = packRows(heights, 3);
    for (let i = 0; i < 3; i++) {
      const bottom = positions[i].y + heights[i];
      expect(positions[i + 3].y).toBeGreaterThanOrEqual(bottom);
    }
  });

  it('keeps short rows compact when nothing is boarded', () => {
    const { height } = packRows(bare(4), 4);
    expect(height).toBe(CARD_H);
  });

  it('reports a total height that contains every card', () => {
    const heights = [CARD_H, CARD_H_BOARDED, CARD_H];
    const { positions, height } = packRows(heights, 2);
    for (let i = 0; i < heights.length; i++) {
      expect(positions[i].y + heights[i]).toBeLessThanOrEqual(height + 1);
    }
  });

  it('handles an empty board', () => {
    expect(packRows([], 4)).toEqual({ positions: [], height: 0 });
  });
});

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

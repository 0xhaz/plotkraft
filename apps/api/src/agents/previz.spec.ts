import { describe, it, expect } from 'vitest';
import { boardScore, selectForBoards, type BoardCandidate } from './previz';

const scene = (
  index: number,
  loadScore: number,
  circleStep?: number,
  action = 'A room. Someone enters and the argument that has been coming finally arrives.',
): BoardCandidate => ({
  sceneId: `s${index}`,
  index,
  heading: `INT. ROOM ${index} - DAY`,
  action,
  loadScore,
  circleStep,
});

describe('boardScore', () => {
  it('prefers the price paid over the long middle', () => {
    // Equal structural weight; Take is the stronger frame.
    expect(boardScore(scene(0, 0.5, 6))).toBeGreaterThan(boardScore(scene(1, 0.5, 4)));
  });

  it('still rewards structural weight within a step', () => {
    expect(boardScore(scene(0, 0.9, 4))).toBeGreaterThan(boardScore(scene(1, 0.1, 4)));
  });

  it('discounts a scene with nothing to draw', () => {
    const bare = scene(0, 1, 6, 'He nods.');
    const full = scene(1, 1, 6);
    expect(boardScore(bare)).toBeLessThan(boardScore(full));
  });

  it('gives an unplaced scene a modest weight rather than zero', () => {
    expect(boardScore(scene(0, 0.8, undefined))).toBeGreaterThan(0);
  });
});

describe('selectForBoards', () => {
  it('returns everything when the script is shorter than the panel count', () => {
    const few = [scene(0, 0.5), scene(1, 0.5)];
    expect(selectForBoards(few, 8)).toHaveLength(2);
  });

  it('returns the requested number of panels', () => {
    const many = Array.from({ length: 200 }, (_, i) => scene(i, (i % 10) / 10, (i % 8) + 1));
    expect(selectForBoards(many, 8)).toHaveLength(8);
  });

  it('spreads panels across the script rather than clustering', () => {
    // Every high scorer sits in the first twenty scenes. Ranking alone would
    // return eight images from one stretch and show nothing of the film's shape.
    const many = Array.from({ length: 200 }, (_, i) => scene(i, i < 20 ? 1 : 0.1, 6));
    const picked = selectForBoards(many, 8);
    expect(picked[picked.length - 1].index).toBeGreaterThan(100);
  });

  it('returns panels in script order', () => {
    const many = Array.from({ length: 100 }, (_, i) => scene(i, Math.random(), (i % 8) + 1));
    const picked = selectForBoards(many, 6);
    const indexes = picked.map((p) => p.index);
    expect([...indexes].sort((a, b) => a - b)).toEqual(indexes);
  });

  it('picks the strongest scene inside each window', () => {
    const many = Array.from({ length: 20 }, (_, i) => scene(i, i === 3 ? 1 : 0.01, 6));
    const picked = selectForBoards(many, 2);
    expect(picked[0].index).toBe(3);
  });

  it('never picks the same scene twice', () => {
    const many = Array.from({ length: 50 }, (_, i) => scene(i, 0.5, 6));
    const picked = selectForBoards(many, 8);
    expect(new Set(picked.map((p) => p.sceneId)).size).toBe(picked.length);
  });

  it('handles an empty script', () => {
    expect(selectForBoards([], 8)).toEqual([]);
  });
});

import { describe, it, expect } from 'vitest';
import { shotSlug, shotToComposition } from './shot';

describe('shotSlug', () => {
  it('reads the way a crew writes it', () => {
    expect(shotSlug({ size: 'medium close-up', angle: 'low angle', movement: 'dolly in' }))
      .toBe('medium close-up · low angle · dolly in');
  });

  it('omits a static camera, which is the default and adds nothing', () => {
    expect(shotSlug({ size: 'wide', angle: 'eye level', movement: 'static' }))
      .toBe('wide · eye level');
  });
});

describe('shotToComposition', () => {
  it('translates jargon into what an image model can draw', () => {
    // "MCU, low angle" means nothing to an image model; the framing does.
    const out = shotToComposition({
      size: 'close-up',
      angle: 'low angle',
      movement: 'static',
      staging: 'a figure alone against a window',
    });
    expect(out).toContain('head and shoulders filling the frame');
    expect(out).toContain('below eye line looking up');
    expect(out).toContain('a figure alone against a window');
  });

  it('marks camera movement on the panel, as a board does', () => {
    const out = shotToComposition({
      size: 'wide', angle: 'eye level', movement: 'tracking', staging: 'x',
    });
    expect(out).toContain('motion arrow');
  });

  it('says nothing about movement when the camera holds', () => {
    const out = shotToComposition({
      size: 'wide', angle: 'eye level', movement: 'static', staging: 'x',
    });
    expect(out).not.toContain('motion arrow');
  });

  it('passes an unknown size through rather than dropping it', () => {
    const out = shotToComposition({
      size: 'aerial', angle: 'eye level', movement: 'static', staging: 'x',
    });
    expect(out).toContain('aerial');
  });
});

import { describe, it, expect } from 'vitest';
import { parseFountain } from './fountain.parser';

const SCRIPT = `Title: The Long Way Down
Author: Test Writer

INT. DINER - NIGHT

MAYA sits alone. Rain streaks the window.

MAYA
(quietly)
You came.

NOAH
I always come.

EXT. PARKING LOT - CONTINUOUS

Noah walks to his car.

CUT TO:

.THE VOID

Nothing. Just black.
`;

describe('parseFountain', () => {
  it('reads the title page', () => {
    const r = parseFountain(SCRIPT);
    expect(r.title).toBe('The Long Way Down');
    expect(r.author).toBe('Test Writer');
  });

  it('splits scenes on sluglines and forced headings', () => {
    const r = parseFountain(SCRIPT);
    expect(r.scenes.map((s) => s.heading)).toEqual([
      'INT. DINER - NIGHT',
      'EXT. PARKING LOT - CONTINUOUS',
      'THE VOID',
    ]);
    expect(r.scenes.map((s) => s.index)).toEqual([0, 1, 2]);
  });

  it('captures dialogue with parentheticals and attributes characters', () => {
    const [diner] = parseFountain(SCRIPT).scenes;
    expect(diner.dialogue).toEqual([
      { character: 'MAYA', parenthetical: '(quietly)', text: 'You came.' },
      { character: 'NOAH', text: 'I always come.' },
    ]);
    expect(diner.characters).toEqual(['MAYA', 'NOAH']);
  });

  it('keeps action text and excludes transitions from it', () => {
    const r = parseFountain(SCRIPT);
    expect(r.scenes[0].action).toContain('Rain streaks the window.');
    expect(r.scenes[1].action).toBe('Noah walks to his car.');
    expect(r.scenes[1].action).not.toContain('CUT TO:');
  });

  it('strips boneyard comments and notes', () => {
    const r = parseFountain(
      'INT. ROOM - DAY\n\n/* cut this */Real action.[[and this]]\n',
    );
    expect(r.scenes[0].action).toBe('Real action.');
  });

  it('does not treat an uppercase action line as a character cue', () => {
    const r = parseFountain('INT. ROOM - DAY\n\nBANG! THE DOOR SLAMS.\n\nA beat.\n');
    expect(r.scenes[0].dialogue).toEqual([]);
  });

  it('returns no scenes for text with no sluglines', () => {
    expect(parseFountain('Just some prose.\n').scenes).toEqual([]);
  });
});

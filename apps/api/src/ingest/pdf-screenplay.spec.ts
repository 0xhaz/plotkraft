import { describe, it, expect } from 'vitest';
import {
  actionMargin,
  classify,
  parseScreenplayLines,
  type TextLine,
} from './pdf-screenplay';

/** Standard US screenplay margins in points (72 per inch). */
const ACTION = 108; // 1.5"
const DIALOGUE = 180; // 2.5"
const PAREN = 216; // 3.0"
const CHARACTER = 266; // 3.7"

let y = 0;
const line = (text: string, x = ACTION): TextLine => ({ text, x, y: (y += 12), page: 1 });

describe('actionMargin', () => {
  it('finds the margin the bulk of the document sits at', () => {
    const lines = [
      line('INT. DINER - NIGHT'),
      line('Rain on the window.'),
      line('She waits.'),
      line('MAYA', CHARACTER),
    ];
    expect(actionMargin(lines)).toBeCloseTo(ACTION, -1);
  });

  it('is not dragged left by a stray mark', () => {
    // A revision asterisk in the far margin must not become the baseline.
    const lines = [
      line('INT. DINER - NIGHT'),
      line('Rain on the window.'),
      line('She waits.'),
      line('*', 20),
    ];
    expect(actionMargin(lines)).toBeCloseTo(ACTION, -1);
  });
});

describe('classify', () => {
  it('reads sluglines wherever they sit', () => {
    expect(classify(line('INT. DINER - NIGHT'), ACTION)).toBe('heading');
    expect(classify(line('EXT. PARKING LOT - DAY'), ACTION)).toBe('heading');
  });

  it('separates a character cue from uppercase action by indent alone', () => {
    // The decisive case: identical shape, different position.
    expect(classify(line('MAYA', CHARACTER), ACTION)).toBe('character');
    expect(classify(line('MAYA SLAMS THE DOOR.', ACTION), ACTION)).toBe('action');
  });

  it('reads parentheticals by shape, since indents overlap', () => {
    expect(classify(line('(quietly)', PAREN), ACTION)).toBe('parenthetical');
  });

  it('reads dialogue by indent', () => {
    expect(classify(line('You came.', DIALOGUE), ACTION)).toBe('dialogue');
  });

  it('discards page furniture', () => {
    for (const junk of ['12.', '(MORE)', "(CONT'D)", 'CONTINUED:', 'OMITTED', '*']) {
      expect(classify(line(junk, 400), ACTION)).toBe('skip');
    }
  });

  it('discards transitions', () => {
    expect(classify(line('CUT TO:', 400), ACTION)).toBe('skip');
  });

  it('treats an indented cue that is not uppercase as dialogue', () => {
    expect(classify(line('and then she leaves', CHARACTER), ACTION)).toBe('dialogue');
  });
});

describe('parseScreenplayLines', () => {
  const script: TextLine[] = [
    line('1.', 480),
    line('INT. DINER - NIGHT'),
    line('Rain streaks the window. MAYA waits.'),
    line('MAYA', CHARACTER),
    line('(quietly)', PAREN),
    line('You came.', DIALOGUE),
    line('NOAH', CHARACTER),
    line('I always come.', DIALOGUE),
    line('CUT TO:', 400),
    line('EXT. PARKING LOT - NIGHT'),
    line('They cross to the car.'),
  ];

  it('splits scenes on sluglines', () => {
    const r = parseScreenplayLines(script);
    expect(r.scenes.map((s) => s.heading)).toEqual([
      'INT. DINER - NIGHT',
      'EXT. PARKING LOT - NIGHT',
    ]);
  });

  it('attaches dialogue to the right character with its parenthetical', () => {
    const [diner] = parseScreenplayLines(script).scenes;
    expect(diner.dialogue).toEqual([
      { character: 'MAYA', parenthetical: '(quietly)', text: 'You came.' },
      { character: 'NOAH', text: 'I always come.' },
    ]);
    expect(diner.characters).toEqual(['MAYA', 'NOAH']);
  });

  it('keeps action out of dialogue', () => {
    const [diner] = parseScreenplayLines(script).scenes;
    expect(diner.action).toBe('Rain streaks the window. MAYA waits.');
  });

  it('joins dialogue wrapped across several lines', () => {
    const wrapped: TextLine[] = [
      line('INT. ROOM - DAY'),
      line('MAYA', CHARACTER),
      line('This is a long speech that', DIALOGUE),
      line('runs onto a second line.', DIALOGUE),
    ];
    expect(parseScreenplayLines(wrapped).scenes[0].dialogue[0].text).toBe(
      'This is a long speech that runs onto a second line.',
    );
  });

  it("strips (CONT'D) from a character name", () => {
    const cont: TextLine[] = [
      line('INT. ROOM - DAY'),
      line("MAYA (CONT'D)", CHARACTER),
      line('Still me.', DIALOGUE),
    ];
    expect(parseScreenplayLines(cont).scenes[0].dialogue[0].character).toBe('MAYA');
  });

  it('ignores everything before the first slugline', () => {
    const withTitle: TextLine[] = [
      line('SUPERMAN', 250),
      line('Written by', 250),
      line('INT. ROOM - DAY'),
      line('A room.'),
    ];
    const r = parseScreenplayLines(withTitle);
    expect(r.scenes).toHaveLength(1);
    expect(r.scenes[0].action).toBe('A room.');
  });

  it('returns no scenes for a document with no sluglines', () => {
    expect(parseScreenplayLines([line('Just prose.')]).scenes).toEqual([]);
  });
});

describe('actionMargin — slugline anchoring', () => {
  it('uses sluglines rather than the overall mode', () => {
    // Dialogue outnumbers action here. The mode would return the dialogue
    // margin and push every character cue down into dialogue.
    const lines = [
      line('INT. ROOM - DAY', ACTION),
      line('MAYA', CHARACTER),
      line('One line of speech.', DIALOGUE),
      line('And another line.', DIALOGUE),
      line('And a third line.', DIALOGUE),
    ];
    expect(actionMargin(lines)).toBeCloseTo(ACTION, -1);
    expect(classify(line('MAYA', CHARACTER), actionMargin(lines))).toBe('character');
  });

  it('falls back to the overall mode when there are no sluglines', () => {
    const lines = [line('Some prose.', ACTION), line('More prose.', ACTION)];
    expect(actionMargin(lines)).toBeCloseTo(ACTION, -1);
  });
});

import { describe, it, expect } from 'vitest';
import {
  normalizeSubject,
  groupBySubject,
  contradictionCandidates,
  subjectSummary,
  type Fact,
} from './continuity';

const fact = (
  sceneIndex: number,
  subject: string,
  claim: string,
  kind: Fact['kind'] = 'character',
): Fact => ({ sceneIndex, subject, claim, kind });

describe('normalizeSubject', () => {
  it('folds casing and continuation marks', () => {
    expect(normalizeSubject('MAYA')).toBe('MAYA');
    expect(normalizeSubject('Maya')).toBe('MAYA');
    expect(normalizeSubject("MAYA (CONT'D)")).toBe('MAYA');
  });

  it('drops a leading article so the same object agrees with itself', () => {
    expect(normalizeSubject('the hard drive')).toBe('HARD DRIVE');
    expect(normalizeSubject('hard drive')).toBe('HARD DRIVE');
  });

  it('collapses punctuation and spacing', () => {
    expect(normalizeSubject("  Reeves'  office ")).toBe('REEVES OFFICE');
  });

  it('returns empty for a subject with nothing in it', () => {
    expect(normalizeSubject('   ')).toBe('');
    expect(normalizeSubject('!!!')).toBe('');
  });
});

describe('groupBySubject', () => {
  it('gathers the ways a script names one person', () => {
    const g = groupBySubject([
      fact(0, 'MAYA', 'is a reporter'),
      fact(5, 'Maya', 'was fired'),
      fact(9, "MAYA (CONT'D)", 'owns a car'),
    ]);
    expect(g.size).toBe(1);
    expect(g.get('MAYA')).toHaveLength(3);
  });

  it('keeps each subject in script order', () => {
    const g = groupBySubject([fact(9, 'MAYA', 'c'), fact(1, 'MAYA', 'a'), fact(5, 'MAYA', 'b')]);
    expect(g.get('MAYA')!.map((f) => f.sceneIndex)).toEqual([1, 5, 9]);
  });

  it('drops a fact with no usable subject', () => {
    expect(groupBySubject([fact(0, '   ', 'x')]).size).toBe(0);
  });
});

describe('contradictionCandidates', () => {
  it('pairs a later fact with an earlier one about the same subject', () => {
    const pairs = contradictionCandidates([
      fact(0, 'MAYA', 'has never met Noah'),
      fact(20, 'MAYA', 'has known Noah for years'),
    ]);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].earlier.sceneIndex).toBe(0);
    expect(pairs[0].later.sceneIndex).toBe(20);
  });

  it('never pairs facts about different subjects', () => {
    const pairs = contradictionCandidates([
      fact(0, 'MAYA', 'is a reporter'),
      fact(10, 'NOAH', 'is a lawyer'),
    ]);
    expect(pairs).toEqual([]);
  });

  it('never pairs facts of different kinds', () => {
    const pairs = contradictionCandidates([
      fact(0, 'DINER', 'is on Fifth', 'location'),
      fact(10, 'DINER', 'is crowded', 'prop'),
    ]);
    expect(pairs).toEqual([]);
  });

  it('skips a restatement, which cannot contradict', () => {
    const pairs = contradictionCandidates([
      fact(0, 'MAYA', 'is a reporter'),
      fact(30, 'MAYA', 'Is a Reporter.'),
    ]);
    expect(pairs).toEqual([]);
  });

  it('never pairs two facts from the same scene', () => {
    const pairs = contradictionCandidates([
      fact(4, 'MAYA', 'is calm'),
      fact(4, 'MAYA', 'is furious'),
    ]);
    expect(pairs).toEqual([]);
  });

  it('bounds the fan-out on a long script', () => {
    // 200 facts about one subject would be ~20,000 naive pairs.
    const many = Array.from({ length: 200 }, (_, i) => fact(i, 'MAYA', `claim ${i}`));
    const pairs = contradictionCandidates(many);
    expect(pairs.length).toBeLessThanOrEqual(40);
  });

  it('keeps the widest separations when it has to choose', () => {
    // A contradiction 100 scenes apart is the one a writer has not spotted.
    const facts = [
      fact(0, 'MAYA', 'a'),
      fact(1, 'MAYA', 'b'),
      fact(2, 'MAYA', 'c'),
      fact(150, 'MAYA', 'd'),
    ];
    const pairs = contradictionCandidates(facts, 1);
    expect(pairs[0].later.sceneIndex).toBe(150);
    expect(pairs[0].earlier.sceneIndex).toBe(0);
  });

  it('returns nothing for a single fact', () => {
    expect(contradictionCandidates([fact(0, 'MAYA', 'exists')])).toEqual([]);
  });
});

describe('subjectSummary', () => {
  it('ranks subjects by how much the script establishes', () => {
    const s = subjectSummary([
      fact(0, 'MAYA', 'a'),
      fact(1, 'MAYA', 'b'),
      fact(2, 'NOAH', 'c'),
    ]);
    expect(s[0]).toMatchObject({ subject: 'MAYA', count: 2 });
    expect(s[1]).toMatchObject({ subject: 'NOAH', count: 1 });
  });
});

import { dedupeContradictions, type Contradiction } from './continuity';

describe('dedupeContradictions', () => {
  const c = (earlierScene: number, laterScene: number, explanation: string): Contradiction => ({
    earlierScene,
    laterScene,
    subject: 'x',
    claim: 'y',
    explanation,
  });

  it('says one break once', () => {
    // A forged document trips "the file", "the signature" and "the document"
    // separately; three flags would read as three problems.
    const out = dedupeContradictions([
      c(2, 11, 'the file cannot be both'),
      c(2, 11, 'the signature cannot be both'),
      c(2, 11, 'the document cannot both be genuine and forged as established'),
    ]);
    expect(out).toHaveLength(1);
  });

  it('keeps the fullest explanation', () => {
    const out = dedupeContradictions([c(2, 11, 'short'), c(2, 11, 'a much longer explanation')]);
    expect(out[0].explanation).toBe('a much longer explanation');
  });

  it('keeps genuinely different breaks apart', () => {
    const out = dedupeContradictions([c(2, 11, 'a'), c(4, 30, 'b')]);
    expect(out).toHaveLength(2);
  });

  it('orders by where the writer will meet them', () => {
    const out = dedupeContradictions([c(1, 40, 'late'), c(1, 5, 'early')]);
    expect(out.map((x) => x.laterScene)).toEqual([5, 40]);
  });

  it('handles nothing found', () => {
    expect(dedupeContradictions([])).toEqual([]);
  });
});

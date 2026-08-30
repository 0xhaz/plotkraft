import { describe, it, expect } from 'vitest';
import {
  candidatePairs,
  groupBySceneId,
  dedupeConflicts,
  conflictWeight,
  conflictSeverity,
  type MappedNote,
  type Conflict,
} from './notes';

const note = (
  id: string,
  sceneIds: string[],
  source: MappedNote['source'] = 'peer',
  scope: MappedNote['scope'] = 'scene',
): MappedNote => ({
  id,
  source,
  author: id,
  body: `body of ${id}`,
  sceneIds,
  scope,
});

const scriptNote = (id: string, source: MappedNote['source'] = 'peer'): MappedNote =>
  note(id, [], source, 'script');

describe('candidatePairs', () => {
  it('pairs only notes that share a scene', () => {
    const pairs = candidatePairs([note('a', ['s1']), note('b', ['s1']), note('c', ['s2'])]);
    expect(pairs).toHaveLength(1);
    expect([pairs[0].a.id, pairs[0].b.id].sort()).toEqual(['a', 'b']);
  });

  it('never pairs a note with itself and never repeats a pair', () => {
    const pairs = candidatePairs([note('a', ['s1']), note('b', ['s1'])]);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].a.id).not.toBe(pairs[0].b.id);
  });

  it('reports the shared scenes, not the union', () => {
    const pairs = candidatePairs([note('a', ['s1', 's2']), note('b', ['s2', 's3'])]);
    expect(pairs[0].sharedSceneIds).toEqual(['s2']);
  });

  it('ranks heavier overlaps first', () => {
    const pairs = candidatePairs([
      note('a', ['s1', 's2', 's3']),
      note('b', ['s1', 's2', 's3']),
      note('c', ['s3']),
    ]);
    expect(pairs[0].sharedSceneIds).toHaveLength(3);
  });

  it('returns nothing when two scene notes do not overlap', () => {
    expect(candidatePairs([note('a', ['s1']), note('b', ['s2'])])).toEqual([]);
  });

  it('compares a script-wide note against a scene note that shares no scene', () => {
    // "cut the diner scene" vs "we need more of her personal life" — the conflict
    // a writer only discovers after rewriting twice.
    const pairs = candidatePairs([note('cut', ['s7'], 'producer'), scriptNote('more', 'executive')]);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].sharedSceneIds).toEqual([]);
  });

  it('compares two script-wide notes with each other', () => {
    expect(candidatePairs([scriptNote('a', 'producer'), scriptNote('b', 'executive')])).toHaveLength(1);
  });

  it('ranks scene overlap above authority, and authority above nothing', () => {
    const pairs = candidatePairs([
      note('x', ['s1'], 'peer'),
      note('y', ['s1'], 'peer'),
      scriptNote('boss', 'executive'),
      scriptNote('prod', 'producer'),
    ]);
    // The overlapping pair leads; the two decision-makers rank above peer/script pairs.
    expect(pairs[0].sharedSceneIds).toEqual(['s1']);
    const ids = pairs.slice(1).map((p) => [p.a.id, p.b.id].sort().join('+'));
    expect(ids[0]).toBe('boss+prod');
  });

  it('handles duplicate scene ids within one note', () => {
    const pairs = candidatePairs([note('a', ['s1', 's1']), note('b', ['s1'])]);
    expect(pairs[0].sharedSceneIds).toEqual(['s1']);
  });

  it('returns nothing for fewer than two notes', () => {
    expect(candidatePairs([note('a', ['s1'])])).toEqual([]);
    expect(candidatePairs([])).toEqual([]);
  });
});

describe('groupBySceneId', () => {
  it('lists every note touching each scene', () => {
    const g = groupBySceneId([note('a', ['s1', 's2']), note('b', ['s2'])]);
    expect(g.get('s1')?.map((n) => n.id)).toEqual(['a']);
    expect(g.get('s2')?.map((n) => n.id)).toEqual(['a', 'b']);
  });

  it('does not list a note twice for a repeated scene id', () => {
    const g = groupBySceneId([note('a', ['s1', 's1'])]);
    expect(g.get('s1')).toHaveLength(1);
  });
});

describe('dedupeConflicts', () => {
  const c = (a: string, b: string, scenes: string[], text: string): Conflict => ({
    noteIdA: a,
    noteIdB: b,
    sceneIds: scenes,
    explanation: text,
  });

  it('collapses the same pair reported in either order', () => {
    const out = dedupeConflicts([c('a', 'b', ['s1'], 'short'), c('b', 'a', ['s1'], 'short')]);
    expect(out).toHaveLength(1);
  });

  it('keeps the richer explanation and unions the scenes', () => {
    const out = dedupeConflicts([
      c('a', 'b', ['s1'], 'brief'),
      c('b', 'a', ['s2'], 'a considerably longer explanation'),
    ]);
    expect(out[0].explanation).toBe('a considerably longer explanation');
    expect(out[0].sceneIds.sort()).toEqual(['s1', 's2']);
  });

  it('leaves distinct pairs alone', () => {
    expect(dedupeConflicts([c('a', 'b', ['s1'], 'x'), c('a', 'c', ['s1'], 'y')])).toHaveLength(2);
  });
});

describe('conflictWeight', () => {
  it('ranks an exec/producer clash above a peer disagreement', () => {
    expect(conflictWeight('executive', 'producer')).toBeGreaterThan(conflictWeight('peer', 'peer'));
  });
});

describe('conflictSeverity', () => {
  it('calls two decision-makers critical', () => {
    expect(conflictSeverity('executive', 'producer')).toBe('critical');
  });

  it('calls one decision-maker against a reader a warning', () => {
    expect(conflictSeverity('executive', 'coverage')).toBe('warn');
    expect(conflictSeverity('producer', 'peer')).toBe('warn');
  });

  it('calls two non-decision-makers informational', () => {
    expect(conflictSeverity('peer', 'peer')).toBe('info');
    expect(conflictSeverity('peer', 'other')).toBe('info');
  });
});

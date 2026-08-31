/**
 * The script bible, and what it is for.
 *
 * A breakdown in production software tags elements so a producer can budget
 * them. The same tagging serves a different purpose in development: once you
 * know what each scene establishes, you can tell when a later scene contradicts
 * an earlier one. That is the show-bible burden writers carry in their heads,
 * and it is where rewrites quietly break a draft.
 *
 * The model extracts facts and judges contradictions. This file decides which
 * comparisons are worth making at all — on a 244-scene feature the naive answer
 * is tens of thousands of pairs, which is neither affordable nor useful.
 */

export type FactKind = 'character' | 'prop' | 'location' | 'timeline' | 'world';

export interface Fact {
  sceneIndex: number;
  /** Who or what the fact is about, as written. */
  subject: string;
  kind: FactKind;
  /** What the scene establishes, as a short assertion. */
  claim: string;
}

export interface FactPair {
  earlier: Fact;
  later: Fact;
}

/** At most this many earlier facts are compared against any one later fact. */
const LOOKBACK = 6;

/**
 * Fold the ways a script refers to the same thing.
 *
 * "MAYA", "Maya", "Maya Ortega" and "MAYA (CONT'D)" are one subject; treating
 * them as four means every fact about her is compared against nothing. Leading
 * articles go too, so "the hard drive" and "hard drive" agree.
 */
export function normalizeSubject(subject: string): string {
  return subject
    .toUpperCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/^\s*(THE|A|AN)\s+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Facts grouped by the thing they describe, each list in script order. */
export function groupBySubject(facts: Fact[]): Map<string, Fact[]> {
  const out = new Map<string, Fact[]>();
  for (const fact of facts) {
    const key = normalizeSubject(fact.subject);
    if (!key) continue;
    if (!out.has(key)) out.set(key, []);
    out.get(key)!.push(fact);
  }
  for (const list of out.values()) list.sort((a, b) => a.sceneIndex - b.sceneIndex);
  return out;
}

/** Two claims that say the same thing cannot contradict each other. */
function sameClaim(a: string, b: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
  return norm(a) === norm(b);
}

/**
 * Pairs worth asking the model about.
 *
 * Only facts about the same subject can contradict, only a later scene can
 * contradict an earlier one, and a fact restating an earlier one is not a
 * contradiction. Each later fact looks back a bounded distance, so cost grows
 * with the script rather than with its square.
 */
export function contradictionCandidates(facts: Fact[], maxPairs = 40): FactPair[] {
  const pairs: FactPair[] = [];

  for (const list of groupBySubject(facts).values()) {
    for (let i = 1; i < list.length; i++) {
      const later = list[i];
      const from = Math.max(0, i - LOOKBACK);

      for (let j = from; j < i; j++) {
        const earlier = list[j];
        if (earlier.sceneIndex === later.sceneIndex) continue;
        if (earlier.kind !== later.kind) continue;
        if (sameClaim(earlier.claim, later.claim)) continue;
        pairs.push({ earlier, later });
      }
    }
  }

  // A contradiction far apart in the script is the one a writer is least likely
  // to have noticed, so distance decides what survives the cap.
  return pairs
    .sort((a, b) => distance(b) - distance(a))
    .slice(0, maxPairs);
}

function distance(pair: FactPair): number {
  return pair.later.sceneIndex - pair.earlier.sceneIndex;
}

export interface Contradiction {
  earlierScene: number;
  laterScene: number;
  subject: string;
  claim: string;
  explanation: string;
}

/**
 * Collapse contradictions that describe the same break.
 *
 * One inconsistency usually surfaces through several facts at once — a forged
 * document trips "the file", "the signature" and "the document" separately — and
 * three flags for one problem reads as three problems. Keeping the fullest
 * explanation per pair of scenes says it once.
 */
export function dedupeContradictions(found: Contradiction[]): Contradiction[] {
  const best = new Map<string, Contradiction>();

  for (const c of found) {
    const key = `${c.earlierScene}->${c.laterScene}`;
    const existing = best.get(key);
    if (!existing || c.explanation.length > existing.explanation.length) {
      best.set(key, c);
    }
  }

  return [...best.values()].sort(
    (a, b) => a.laterScene - b.laterScene || a.earlierScene - b.earlierScene,
  );
}

/** Subjects the script establishes most about — the spine of the bible. */
export function subjectSummary(facts: Fact[]): { subject: string; count: number; kind: FactKind }[] {
  const groups = groupBySubject(facts);
  return [...groups.entries()]
    .map(([subject, list]) => ({ subject, count: list.length, kind: list[0].kind }))
    .sort((a, b) => b.count - a.count || a.subject.localeCompare(b.subject));
}

/**
 * Sequences — the missing rung between act and scene.
 *
 * A feature is eight to twelve sequences of ten to fifteen pages, each a small
 * story with its own shape. It is the unit writers name out loud ("the Fortress
 * sequence"), and it is what makes a 244-scene board navigable: five named rows
 * instead of sixty-one cards.
 *
 * The model proposes boundaries; this file guarantees them. A segmentation with
 * a gap, an overlap or a scene left out would silently hide part of the script
 * from the writer, so the returned segments are always contiguous, sorted, and
 * cover every scene exactly once.
 */

export interface RawSequence {
  startIndex: number;
  endIndex: number;
  name: string;
  purpose?: string;
}

export interface Sequence {
  startIndex: number;
  endIndex: number;
  name: string;
  purpose: string;
  /** Filled in later from the scenes it contains. */
  act?: number;
}

const UNNAMED = 'Unnamed sequence';

/**
 * Repair a proposed segmentation into one that provably covers the script.
 *
 * Trims overlaps in favour of the earlier segment, fills gaps with an unnamed
 * one rather than dropping scenes, and clamps everything into range.
 */
export function normalizeSequences(raw: RawSequence[], sceneCount: number): Sequence[] {
  if (sceneCount <= 0) return [];

  const clamped = raw
    .map((r) => ({
      startIndex: Math.max(0, Math.min(sceneCount - 1, Math.floor(r.startIndex))),
      endIndex: Math.max(0, Math.min(sceneCount - 1, Math.floor(r.endIndex))),
      name: (r.name ?? '').trim() || UNNAMED,
      purpose: (r.purpose ?? '').trim(),
    }))
    .filter((r) => r.endIndex >= r.startIndex)
    .sort((a, b) => a.startIndex - b.startIndex || a.endIndex - b.endIndex);

  const out: Sequence[] = [];
  let cursor = 0;

  for (const seg of clamped) {
    // Anything the model skipped still has to appear somewhere.
    if (seg.startIndex > cursor) {
      out.push({
        startIndex: cursor,
        endIndex: seg.startIndex - 1,
        name: UNNAMED,
        purpose: '',
      });
      cursor = seg.startIndex;
    }

    // An overlap is resolved in favour of whatever came first.
    const start = Math.max(seg.startIndex, cursor);
    if (seg.endIndex < start) continue;

    out.push({ ...seg, startIndex: start });
    cursor = seg.endIndex + 1;
  }

  if (cursor < sceneCount) {
    out.push({ startIndex: cursor, endIndex: sceneCount - 1, name: UNNAMED, purpose: '' });
  }

  return out;
}

/**
 * Assign acts to sequences as two boundaries, not as independent votes.
 *
 * A per-sequence majority vote was the obvious approach and it is wrong: acts
 * are contiguous by definition, and voting independently let them zig-zag. A
 * real script produced an Act One containing sequences 1, 2, 3, 4, 6 and 10 —
 * an outline that cannot be true, because a story does not return to its first
 * act after leaving it.
 *
 * So the act structure is one choice with two degrees of freedom: where Act One
 * ends and where Act Three begins. Every split is scored against the per-scene
 * placements the circle produced, and the best-fitting pair wins. With a dozen
 * sequences the search is trivial, and the result is contiguous by construction
 * rather than by hope.
 */
export function assignActs(
  sequences: Sequence[],
  actOfScene: (index: number) => number,
): Sequence[] {
  if (sequences.length === 0) return [];

  // votes[k][a] = how many scenes of sequence k the circle placed in act a.
  const votes = sequences.map((seq) => {
    const counts = [0, 0, 0, 0];
    for (let i = seq.startIndex; i <= seq.endIndex; i++) {
      const act = actOfScene(i);
      if (act >= 0 && act <= 3) counts[act] += 1;
    }
    return counts;
  });

  const n = sequences.length;
  let bestI = 1;
  let bestJ = n;
  let bestScore = -1;

  // Sequences [0,i) are Act One, [i,j) Act Two, [j,n) Act Three. Empty acts are
  // allowed: a script may genuinely lack a third act, and inventing one would
  // hide exactly the finding worth reporting.
  for (let i = 0; i <= n; i++) {
    for (let j = i; j <= n; j++) {
      let score = 0;
      for (let k = 0; k < n; k++) {
        const act = k < i ? 1 : k < j ? 2 : 3;
        score += votes[k][act];
      }
      if (score > bestScore) {
        bestScore = score;
        bestI = i;
        bestJ = j;
      }
    }
  }

  return sequences.map((seq, k) => ({
    ...seq,
    act: k < bestI ? 1 : k < bestJ ? 2 : 3,
  }));
}

export function sequenceLength(seq: Sequence): number {
  return seq.endIndex - seq.startIndex + 1;
}

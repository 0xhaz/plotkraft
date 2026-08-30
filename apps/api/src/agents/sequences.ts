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
 * Give each sequence the act most of its scenes belong to.
 *
 * The first version split a sequence wherever the per-scene act changed. That
 * assumed acts arrive in clean contiguous runs, which they do not: step
 * placement on an intercut feature wobbles scene to scene, and a real 244-scene
 * script turned 16 sequences into 55 fragments — worse than the flat board it
 * was meant to replace.
 *
 * So the hierarchy runs the other way. The sequence is the contiguous unit,
 * because it is a run of consecutive scenes by construction; an act is simply
 * the run of sequences that mostly sit in it. A majority vote is stable against
 * the same wobble that shattered the splitting version.
 */
export function assignActs(
  sequences: Sequence[],
  actOfScene: (index: number) => number,
): Sequence[] {
  return sequences.map((seq) => {
    const votes = new Map<number, number>();
    for (let i = seq.startIndex; i <= seq.endIndex; i++) {
      const act = actOfScene(i);
      votes.set(act, (votes.get(act) ?? 0) + 1);
    }

    let act = 0;
    let best = -1;
    for (const [candidate, count] of votes) {
      // Ties go to the earlier act, so a sequence on a boundary reads as the
      // end of what came before rather than the start of what follows.
      if (count > best || (count === best && candidate !== 0 && candidate < act)) {
        act = candidate;
        best = count;
      }
    }

    // An entirely unplaced sequence stays unplaced; a mostly-placed one takes
    // the act its placed scenes agree on rather than being written off.
    if (act === 0 && votes.size > 1) {
      let bestPlaced = -1;
      for (const [candidate, count] of votes) {
        if (candidate !== 0 && count > bestPlaced) {
          act = candidate;
          bestPlaced = count;
        }
      }
    }

    return { ...seq, act };
  });
}

export function sequenceLength(seq: Sequence): number {
  return seq.endIndex - seq.startIndex + 1;
}

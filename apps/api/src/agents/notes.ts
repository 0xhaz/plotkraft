/**
 * Note reconciliation — pure logic.
 *
 * The expensive part of comparing notes is the model call, so the job of this
 * file is to decide which comparisons are worth making at all. Two notes can only
 * contradict each other if they are asking for changes to the same scene, which
 * turns a quadratic problem over the whole pile into a small number of pairs.
 */

export type NoteSource = 'producer' | 'executive' | 'peer' | 'coverage' | 'director' | 'other';

export interface MappedNote {
  id: string;
  source: NoteSource;
  author: string;
  body: string;
  /** Scenes this note asks the writer to change. Empty for a script-wide note. */
  sceneIds: string[];
  /** A "script" note is about the whole draft — pace, tone, a character across scenes. */
  scope: 'scene' | 'script';
}

/**
 * Sources whose disagreement actually costs the writer something.
 *
 * A peer disagreeing with a peer is a conversation; the executive and the producer
 * disagreeing is a problem the writer must resolve before they can rewrite. Used
 * to rank conflicts, never to hide any.
 */
const AUTHORITY: Record<NoteSource, number> = {
  executive: 4,
  producer: 4,
  director: 3,
  coverage: 2,
  peer: 1,
  other: 1,
};

export function conflictWeight(a: NoteSource, b: NoteSource): number {
  return AUTHORITY[a] + AUTHORITY[b];
}

/**
 * Severity is derived from who is disagreeing, not from the model's opinion.
 *
 * Whether two notes contradict is a judgement about language, which the model is
 * good at. How much that contradiction *costs the writer* is a fact about the
 * senders: two decision-makers pulling in opposite directions blocks the rewrite
 * until someone chooses, while two peers disagreeing is a conversation. Asked
 * directly, the model called almost everything critical, which drains the label
 * of meaning.
 */
export function conflictSeverity(a: NoteSource, b: NoteSource): 'info' | 'warn' | 'critical' {
  const weight = conflictWeight(a, b);
  if (weight >= 8) return 'critical'; // two decision-makers
  if (weight >= 5) return 'warn'; // one decision-maker against someone else
  return 'info';
}

export interface NotePair {
  a: MappedNote;
  b: MappedNote;
  /** Scenes both notes touch — the ground on which they could conflict. */
  sharedSceneIds: string[];
}

/**
 * Every unordered pair of notes that could possibly be in conflict.
 *
 * Two notes are comparable if they touch a scene in common, OR if either is
 * script-wide. That second clause matters more than it looks: "cut the diner
 * scene" and "we need more of Maya's personal life" never share a scene id, and
 * they are precisely the kind of contradiction a writer discovers only after
 * rewriting twice. Restricting comparison to shared scenes silently hides the
 * most expensive disagreements in the pile.
 *
 * Ranked so the pairs most likely to matter are judged first, since the caller
 * caps how many reach the model: scene overlap first, then how much authority
 * sits behind the two notes.
 */
export function candidatePairs(notes: MappedNote[]): NotePair[] {
  const pairs: NotePair[] = [];

  for (let i = 0; i < notes.length; i++) {
    for (let j = i + 1; j < notes.length; j++) {
      const a = notes[i];
      const b = notes[j];
      const bScenes = new Set(b.sceneIds);
      const shared = [...new Set(a.sceneIds)].filter((id) => bScenes.has(id));

      const comparable = shared.length > 0 || a.scope === 'script' || b.scope === 'script';
      if (!comparable) continue;

      pairs.push({ a, b, sharedSceneIds: shared });
    }
  }

  return pairs.sort((p, q) => {
    const overlap = q.sharedSceneIds.length - p.sharedSceneIds.length;
    if (overlap !== 0) return overlap;
    return (
      conflictWeight(q.a.source, q.b.source) - conflictWeight(p.a.source, p.b.source)
    );
  });
}

/** Notes affecting each scene, for pinning cards to the canvas. */
export function groupBySceneId(notes: MappedNote[]): Map<string, MappedNote[]> {
  const out = new Map<string, MappedNote[]>();
  for (const note of notes) {
    for (const sceneId of new Set(note.sceneIds)) {
      if (!out.has(sceneId)) out.set(sceneId, []);
      out.get(sceneId)!.push(note);
    }
  }
  return out;
}

export interface Conflict {
  noteIdA: string;
  noteIdB: string;
  sceneIds: string[];
  explanation: string;
}

/**
 * Collapse conflicts that name the same two notes, regardless of order.
 *
 * The model is asked about pairs independently, so the same disagreement can come
 * back twice; showing a writer the same conflict twice makes the whole dashboard
 * look unreliable.
 */
export function dedupeConflicts(conflicts: Conflict[]): Conflict[] {
  const seen = new Map<string, Conflict>();
  for (const c of conflicts) {
    const key = [c.noteIdA, c.noteIdB].sort().join('::');
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, c);
      continue;
    }
    // Keep the richer explanation and the union of affected scenes.
    seen.set(key, {
      ...existing,
      sceneIds: [...new Set([...existing.sceneIds, ...c.sceneIds])],
      explanation:
        c.explanation.length > existing.explanation.length ? c.explanation : existing.explanation,
    });
  }
  return [...seen.values()];
}

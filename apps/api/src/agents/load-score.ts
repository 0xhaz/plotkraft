export type TransitionType = 'therefore' | 'but' | 'and_then';

export interface GraphEdge {
  from: string;
  to: string;
  type: TransitionType;
}

/**
 * Structural load: how much of the story hangs off this scene.
 *
 * Measured as the number of scenes reachable downstream through *causal* edges,
 * normalized to 0..1. Only "therefore" and "but" carry load — an "and_then" joint
 * is precisely the claim that nothing depends on what came before, so counting it
 * would credit weak joints with structural weight they do not have.
 *
 * A scene scoring 0 has nothing downstream depending on it: the cut candidate.
 */
export function computeRawLoad(
  sceneIds: string[],
  edges: GraphEdge[],
): Map<string, number> {
  const causal = edges.filter((e) => e.type !== 'and_then');

  const adjacency = new Map<string, string[]>();
  for (const id of sceneIds) adjacency.set(id, []);
  for (const e of causal) {
    if (!adjacency.has(e.from)) adjacency.set(e.from, []);
    adjacency.get(e.from)!.push(e.to);
  }

  const memo = new Map<string, Set<string>>();

  /** Descendants of `id`, cycle-safe via an explicit visiting set. */
  const descendants = (id: string, visiting: Set<string>): Set<string> => {
    const cached = memo.get(id);
    if (cached) return cached;
    if (visiting.has(id)) return new Set();

    visiting.add(id);
    const out = new Set<string>();
    for (const next of adjacency.get(id) ?? []) {
      out.add(next);
      for (const d of descendants(next, visiting)) out.add(d);
    }
    visiting.delete(id);

    memo.set(id, out);
    return out;
  };

  const raw = new Map<string, number>();
  for (const id of sceneIds) raw.set(id, descendants(id, new Set()).size);
  return raw;
}

/**
 * Normalized 0..1 load scores.
 *
 * `denominator` exists for before/after comparison: when simulating a cut, both
 * sides must be scaled by the SAME value. Renormalizing the "after" graph on its
 * own makes surviving scenes appear to gain load simply because the maximum
 * shrank — which would tell the writer the opposite of the truth.
 */
export function computeLoadScores(
  sceneIds: string[],
  edges: GraphEdge[],
  denominator?: number,
): Map<string, number> {
  const raw = computeRawLoad(sceneIds, edges);
  const max = denominator ?? Math.max(0, ...raw.values());

  const scores = new Map<string, number>();
  for (const id of sceneIds) {
    scores.set(id, max <= 0 ? 0 : Number(((raw.get(id) ?? 0) / max).toFixed(3)));
  }
  return scores;
}

/** Scenes nothing depends on — surfaced in the UI as cut candidates. */
export function cutCandidates(scores: Map<string, number>): string[] {
  return [...scores.entries()].filter(([, s]) => s === 0).map(([id]) => id);
}

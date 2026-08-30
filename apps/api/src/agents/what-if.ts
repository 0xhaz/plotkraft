import type { GraphEdge, TransitionType } from './load-score';
import { computeLoadScores, computeRawLoad } from './load-score';

export interface SceneSummary {
  id: string;
  index: number;
  heading: string;
  characters: string[];
}

export interface WhatIfImpact {
  /** Scenes downstream of the cut that must be re-analyzed — the dirty subgraph. */
  dirtySceneIds: string[];
  /** Scenes that had causal setup and now have none: their payoff is orphaned. */
  orphanedPayoffs: { sceneId: string; lostSetupIds: string[] }[];
  /** Characters who now appear before anything establishes them. */
  unexplainedCharacters: { character: string; firstAppearanceSceneId: string }[];
  /** Edges destroyed by the cut. */
  brokenEdgeIds: string[];
  /** Load score movement, for scenes whose structural weight changed. */
  loadDeltas: { sceneId: string; before: number; after: number }[];
}

/**
 * Simulate cutting scenes, without touching stored state.
 *
 * This runs entirely on an in-memory copy of the graph (architecture.md §4): one
 * writer's what-if must never mutate the shared canvas that collaborators are
 * looking at. The caller passes the current graph in and gets a verdict back;
 * nothing here writes.
 *
 * The causality graph *is* the dependency map, which is why this is a cheap
 * traversal rather than a fresh full-script analysis.
 */
export function simulateCut(
  scenes: SceneSummary[],
  edges: GraphEdge[],
  removedSceneIds: string[],
): WhatIfImpact {
  const removed = new Set(removedSceneIds);
  const surviving = scenes.filter((s) => !removed.has(s.id));
  const survivingIds = surviving.map((s) => s.id);

  const isCausal = (t: TransitionType) => t !== 'and_then';

  // --- dirty subgraph: everything causally downstream of what was cut ---
  const downstream = new Map<string, string[]>();
  for (const e of edges) {
    if (!isCausal(e.type)) continue;
    if (!downstream.has(e.from)) downstream.set(e.from, []);
    downstream.get(e.from)!.push(e.to);
  }

  const dirty = new Set<string>();
  const queue = [...removedSceneIds];
  while (queue.length) {
    const id = queue.shift()!;
    for (const next of downstream.get(id) ?? []) {
      if (removed.has(next) || dirty.has(next)) continue;
      dirty.add(next);
      queue.push(next);
    }
  }

  // --- orphaned payoffs: had causal setup before, has none now ---
  const causalIncoming = new Map<string, string[]>();
  for (const e of edges) {
    if (!isCausal(e.type)) continue;
    if (!causalIncoming.has(e.to)) causalIncoming.set(e.to, []);
    causalIncoming.get(e.to)!.push(e.from);
  }

  const orphanedPayoffs: WhatIfImpact['orphanedPayoffs'] = [];
  for (const scene of surviving) {
    const before = causalIncoming.get(scene.id) ?? [];
    if (before.length === 0) continue;
    const stillThere = before.filter((from) => !removed.has(from));
    if (stillThere.length === 0) {
      orphanedPayoffs.push({ sceneId: scene.id, lostSetupIds: before.filter((f) => removed.has(f)) });
    }
  }

  // --- unexplained character knowledge ---
  // A character whose only prior appearance was in a cut scene now walks on with
  // history the audience never saw.
  const firstAppearance = new Map<string, SceneSummary>();
  for (const s of [...scenes].sort((a, b) => a.index - b.index)) {
    for (const c of s.characters) if (!firstAppearance.has(c)) firstAppearance.set(c, s);
  }

  const unexplainedCharacters: WhatIfImpact['unexplainedCharacters'] = [];
  for (const [character, introScene] of firstAppearance) {
    if (!removed.has(introScene.id)) continue;
    const nextAppearance = surviving
      .filter((s) => s.characters.includes(character))
      .sort((a, b) => a.index - b.index)[0];
    if (nextAppearance) {
      unexplainedCharacters.push({ character, firstAppearanceSceneId: nextAppearance.id });
    }
  }

  // --- broken edges ---
  const brokenEdgeIds = edges
    .filter((e) => removed.has(e.from) || removed.has(e.to))
    .map((e) => `${e.from}__${e.to}`);

  // --- load movement ---
  // Both sides are scaled by the pre-cut maximum. Renormalizing the post-cut
  // graph independently would make surviving scenes look like they gained load
  // when all that changed was the size of the denominator.
  const allIds = scenes.map((s) => s.id);
  const denominator = Math.max(0, ...computeRawLoad(allIds, edges).values());

  const before = computeLoadScores(allIds, edges, denominator);
  const after = computeLoadScores(
    survivingIds,
    edges.filter((e) => !removed.has(e.from) && !removed.has(e.to)),
    denominator,
  );

  const loadDeltas: WhatIfImpact['loadDeltas'] = [];
  for (const id of survivingIds) {
    const b = before.get(id) ?? 0;
    const a = after.get(id) ?? 0;
    if (b !== a) loadDeltas.push({ sceneId: id, before: b, after: a });
  }

  return {
    dirtySceneIds: [...dirty],
    orphanedPayoffs,
    unexplainedCharacters,
    brokenEdgeIds,
    loadDeltas,
  };
}

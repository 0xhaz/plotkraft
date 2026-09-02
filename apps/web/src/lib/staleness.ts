/**
 * Which panels the last rewrite invalidated.
 *
 * Every storyboard tool tells you to "re-board only the affected scenes" when the
 * script changes, and then leaves you to work out which those are. On a feature
 * after a structural pass that is guesswork.
 *
 * It is not guesswork here, because the causal graph already knows what depends
 * on what. Two different claims, deliberately kept apart:
 *
 *   direct   — this scene's own words changed after its panel was drawn. The
 *              picture is of something that no longer exists.
 *   upstream — the scene is unchanged, but something it causally depends on was
 *              rewritten. The panel is still accurate; its meaning may not be.
 *
 * Collapsing the two would be the easy mistake. A director re-drawing every
 * downstream panel because one line moved is exactly the waste this is meant to
 * prevent, so the weaker claim is shown as the weaker claim.
 */

export type Staleness = 'direct' | 'upstream';

export interface StaleScene {
  id: string;
  version: number;
  boardVersion?: number;
  boardPath?: string;
}

export interface StaleEdge {
  fromSceneId: string;
  toSceneId: string;
  type: 'therefore' | 'but' | 'and_then';
}

/** A scene whose words have moved on from its panel. */
export function hasChangedSinceBoarded(scene: StaleScene): boolean {
  if (!scene.boardPath || scene.boardVersion === undefined) return false;
  return scene.version > scene.boardVersion;
}

export function stalePanels(
  scenes: StaleScene[],
  edges: StaleEdge[],
): Map<string, Staleness> {
  const out = new Map<string, Staleness>();
  const boarded = new Set(scenes.filter((s) => s.boardPath).map((s) => s.id));
  if (boarded.size === 0) return out;

  const changed = scenes.filter(hasChangedSinceBoarded).map((s) => s.id);
  for (const id of changed) out.set(id, 'direct');
  if (changed.length === 0) return out;

  // Only causal edges carry consequence. An "and then" joint is the claim that
  // nothing downstream depends on what came before, so a rewrite upstream of one
  // does not reach past it.
  const downstream = new Map<string, string[]>();
  for (const edge of edges) {
    if (edge.type === 'and_then') continue;
    if (!downstream.has(edge.fromSceneId)) downstream.set(edge.fromSceneId, []);
    downstream.get(edge.fromSceneId)!.push(edge.toSceneId);
  }

  const queue = [...changed];
  const seen = new Set(changed);

  while (queue.length) {
    const id = queue.shift()!;
    for (const next of downstream.get(id) ?? []) {
      if (seen.has(next)) continue;
      seen.add(next);
      queue.push(next);
      // A scene already stale in its own right keeps the stronger claim.
      if (boarded.has(next) && !out.has(next)) out.set(next, 'upstream');
    }
  }

  return out;
}

export function countStale(stale: Map<string, Staleness>): { direct: number; upstream: number } {
  let direct = 0;
  let upstream = 0;
  for (const kind of stale.values()) {
    if (kind === 'direct') direct++;
    else upstream++;
  }
  return { direct, upstream };
}

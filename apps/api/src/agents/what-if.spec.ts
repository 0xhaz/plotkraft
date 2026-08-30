import { describe, it, expect } from 'vitest';
import { simulateCut, type SceneSummary } from './what-if';
import type { GraphEdge } from './load-score';

const scene = (id: string, index: number, characters: string[] = []): SceneSummary => ({
  id,
  index,
  heading: `SCENE ${id.toUpperCase()}`,
  characters,
});

const scenes = [scene('a', 0), scene('b', 1), scene('c', 2), scene('d', 3)];

const chain: GraphEdge[] = [
  { from: 'a', to: 'b', type: 'therefore' },
  { from: 'b', to: 'c', type: 'therefore' },
  { from: 'c', to: 'd', type: 'therefore' },
];

describe('simulateCut — dirty subgraph', () => {
  it('marks everything causally downstream of the cut', () => {
    const r = simulateCut(scenes, chain, ['a']);
    expect(r.dirtySceneIds.sort()).toEqual(['b', 'c', 'd']);
  });

  it('stops at an and_then joint — nothing downstream depends on the cut', () => {
    const edges: GraphEdge[] = [
      { from: 'a', to: 'b', type: 'and_then' },
      { from: 'b', to: 'c', type: 'therefore' },
    ];
    const r = simulateCut(scenes, edges, ['a']);
    expect(r.dirtySceneIds).toEqual([]);
  });

  it('does not mark the cut scenes themselves as dirty', () => {
    const r = simulateCut(scenes, chain, ['a', 'b']);
    expect(r.dirtySceneIds).not.toContain('a');
    expect(r.dirtySceneIds).not.toContain('b');
    expect(r.dirtySceneIds.sort()).toEqual(['c', 'd']);
  });

  it('terminates on a cycle', () => {
    const edges: GraphEdge[] = [
      { from: 'a', to: 'b', type: 'therefore' },
      { from: 'b', to: 'a', type: 'therefore' },
    ];
    expect(() => simulateCut(scenes, edges, ['a'])).not.toThrow();
  });

  it('reports nothing dirty when a terminal scene is cut', () => {
    expect(simulateCut(scenes, chain, ['d']).dirtySceneIds).toEqual([]);
  });
});

describe('simulateCut — orphaned payoffs', () => {
  it('flags a scene whose only setup was cut', () => {
    const r = simulateCut(scenes, chain, ['a']);
    expect(r.orphanedPayoffs).toEqual([{ sceneId: 'b', lostSetupIds: ['a'] }]);
  });

  it('does not flag a scene that still has another setup', () => {
    const edges: GraphEdge[] = [
      { from: 'a', to: 'c', type: 'therefore' },
      { from: 'b', to: 'c', type: 'therefore' },
    ];
    const r = simulateCut(scenes, edges, ['a']);
    expect(r.orphanedPayoffs).toEqual([]);
  });

  it('never flags a scene that had no setup to begin with', () => {
    const r = simulateCut(scenes, chain, ['b']);
    expect(r.orphanedPayoffs.map((o) => o.sceneId)).not.toContain('a');
  });
});

describe('simulateCut — unexplained character knowledge', () => {
  it('flags a character introduced in the cut scene who reappears later', () => {
    const cast = [
      scene('a', 0, ['MAYA', 'NOAH']),
      scene('b', 1, ['MAYA']),
      scene('c', 2, ['NOAH']),
    ];
    const r = simulateCut(cast, chain, ['a']);
    expect(r.unexplainedCharacters).toEqual([
      { character: 'MAYA', firstAppearanceSceneId: 'b' },
      { character: 'NOAH', firstAppearanceSceneId: 'c' },
    ]);
  });

  it('says nothing about a character who never appears again', () => {
    const cast = [scene('a', 0, ['KESSLER']), scene('b', 1, ['MAYA'])];
    expect(simulateCut(cast, chain, ['a']).unexplainedCharacters).toEqual([]);
  });

  it('says nothing when the character was already established earlier', () => {
    const cast = [scene('a', 0, ['MAYA']), scene('b', 1, ['MAYA']), scene('c', 2, ['MAYA'])];
    expect(simulateCut(cast, chain, ['b']).unexplainedCharacters).toEqual([]);
  });
});

describe('simulateCut — edges and load', () => {
  it('reports every edge touching a cut scene as broken', () => {
    const r = simulateCut(scenes, chain, ['b']);
    expect(r.brokenEdgeIds.sort()).toEqual(['a__b', 'b__c']);
  });

  it('reports load movement for surviving scenes', () => {
    const r = simulateCut(scenes, chain, ['b']);
    const a = r.loadDeltas.find((d) => d.sceneId === 'a');
    // 'a' led the whole chain; with 'b' gone it leads nothing.
    expect(a?.before).toBe(1);
    expect(a?.after).toBe(0);
  });

  it('does not mutate the inputs', () => {
    const edgesCopy = structuredClone(chain);
    const scenesCopy = structuredClone(scenes);
    simulateCut(scenes, chain, ['a', 'b']);
    expect(chain).toEqual(edgesCopy);
    expect(scenes).toEqual(scenesCopy);
  });
});

describe('simulateCut — load deltas are comparable', () => {
  it('never reports a surviving scene as gaining load from a cut', () => {
    // Renormalizing the post-cut graph on its own would show phantom increases.
    const r = simulateCut(scenes, chain, ['b']);
    for (const d of r.loadDeltas) {
      expect(d.after).toBeLessThanOrEqual(d.before);
    }
  });

  it('scales both sides by the pre-cut maximum', () => {
    const r = simulateCut(scenes, chain, ['d']);
    const a = r.loadDeltas.find((x) => x.sceneId === 'a');
    // 'a' reached b,c,d (3 of 3) before; b,c (2 of the original 3) after.
    expect(a?.before).toBe(1);
    expect(a?.after).toBeCloseTo(0.667, 2);
  });
});

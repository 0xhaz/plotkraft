import { Injectable } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';
import { simulateCut, type SceneSummary, type WhatIfImpact } from './what-if';
import type { GraphEdge } from './load-score';

@Injectable()
export class WhatIfService {
  constructor(private readonly fb: FirebaseService) {}

  /**
   * Read the current graph, simulate the cut in memory, return the impact.
   *
   * Deliberately read-only: the writer is asking "what would happen if", and the
   * shared canvas must look identical to everyone else while they ask it.
   */
  async simulate(projectId: string, removedSceneIds: string[]): Promise<WhatIfImpact> {
    const projectRef = this.fb.db.collection('projects').doc(projectId);
    const [sceneSnap, edgeSnap] = await Promise.all([
      projectRef.collection('scenes').orderBy('index').get(),
      projectRef.collection('edges').get(),
    ]);

    const scenes: SceneSummary[] = sceneSnap.docs.map((d) => {
      const v = d.data();
      return {
        id: String(v.id),
        index: Number(v.index),
        heading: String(v.heading),
        characters: (v.characters as string[]) ?? [],
      };
    });

    const edges: GraphEdge[] = edgeSnap.docs.map((d) => {
      const v = d.data();
      return {
        from: String(v.fromSceneId),
        to: String(v.toSceneId),
        type: v.type as GraphEdge['type'],
      };
    });

    return simulateCut(scenes, edges, removedSceneIds);
  }
}

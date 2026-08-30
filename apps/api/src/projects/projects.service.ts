import { Injectable, NotFoundException } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';
import { parseFountain } from '../ingest/fountain.parser';

/**
 * Scene cards are laid out in a simple serpentine grid on first import; the
 * writer drags them wherever they like afterward, and position moves are
 * last-write-wins by design (architecture.md §4).
 */
const COLUMNS = 4;
const CARD_DX = 340;
const CARD_DY = 260;

@Injectable()
export class ProjectsService {
  constructor(private readonly fb: FirebaseService) {}

  /**
   * Ingest a Fountain script into a new project.
   *
   * Every scene is one document with a stable ID and `version: 1`. Both are
   * week-one prerequisites: the stable IDs anchor the stored edge list, and the
   * version field is what makes stale edits visible instead of silent.
   */
  async importFountain(params: { title?: string; source: string; ownerUid: string }) {
    const parsed = parseFountain(params.source);
    const now = Date.now();
    const db = this.fb.db;

    const projectRef = db.collection('projects').doc();
    const batch = db.batch();

    batch.set(projectRef, {
      id: projectRef.id,
      title: params.title ?? parsed.title ?? 'Untitled Script',
      ownerUid: params.ownerUid,
      memberUids: [params.ownerUid],
      sourceFormat: 'fountain',
      createdAt: now,
      updatedAt: now,
    });

    for (const scene of parsed.scenes) {
      const sceneRef = projectRef.collection('scenes').doc();
      batch.set(sceneRef, {
        id: sceneRef.id,
        index: scene.index,
        heading: scene.heading,
        action: scene.action,
        dialogue: scene.dialogue,
        characters: scene.characters,
        position: {
          x: (scene.index % COLUMNS) * CARD_DX,
          y: Math.floor(scene.index / COLUMNS) * CARD_DY,
        },
        version: 1,
        updatedAt: now,
      });
    }

    await batch.commit();
    return { projectId: projectRef.id, sceneCount: parsed.scenes.length };
  }

  async getProject(projectId: string) {
    const doc = await this.fb.db.collection('projects').doc(projectId).get();
    if (!doc.exists) throw new NotFoundException(`No project ${projectId}`);

    const scenes = await this.fb.db
      .collection('projects')
      .doc(projectId)
      .collection('scenes')
      .orderBy('index')
      .get();

    return { project: doc.data(), scenes: scenes.docs.map((d) => d.data()) };
  }
}

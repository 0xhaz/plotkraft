import { Injectable, NotFoundException } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';
import { parseFountain, type ParsedScript } from '../ingest/fountain.parser';
import { PdfService } from '../ingest/pdf.service';

/**
 * Scene cards are laid out on import; the writer drags them wherever they like
 * afterwards, and position moves are last-write-wins by design (architecture.md §4).
 */
const COLUMNS = 4;
const CARD_DX = 356;
const CARD_DY = 170;

/**
 * Boustrophedon layout: alternate rows run right-to-left, so the scene after the
 * end of a row sits directly beneath it. A plain grid sends that wrapping edge
 * diagonally across the whole board, which is what makes a canvas look tangled.
 */
function serpentine(index: number): { x: number; y: number } {
  const row = Math.floor(index / COLUMNS);
  const col = index % COLUMNS;
  return {
    x: (row % 2 === 0 ? col : COLUMNS - 1 - col) * CARD_DX,
    y: row * CARD_DY,
  };
}

@Injectable()
export class ProjectsService {
  constructor(
    private readonly fb: FirebaseService,
    private readonly pdf: PdfService,
  ) {}

  /**
   * Ingest a Fountain script into a new project.
   *
   * Every scene is one document with a stable ID and `version: 1`. Both are
   * week-one prerequisites: the stable IDs anchor the stored edge list, and the
   * version field is what makes stale edits visible instead of silent.
   */
  async importFountain(params: { title?: string; source: string; ownerUid: string }) {
    return this.persist(parseFountain(params.source), params);
  }

  /** Import a screenplay PDF. `data` is base64 so it survives a JSON body. */
  async importPdf(params: { title?: string; data: string; ownerUid: string }) {
    const parsed = await this.pdf.parse(Buffer.from(params.data, 'base64'));
    return this.persist(parsed, { ...params, sourceFormat: 'pdf' });
  }

  private async persist(
    parsed: ParsedScript,
    params: { title?: string; ownerUid: string; sourceFormat?: 'fountain' | 'pdf' },
  ) {
    const now = Date.now();
    const db = this.fb.db;

    const projectRef = db.collection('projects').doc();
    const batch = db.batch();

    batch.set(projectRef, {
      id: projectRef.id,
      title: params.title ?? parsed.title ?? 'Untitled Script',
      ownerUid: params.ownerUid,
      memberUids: [params.ownerUid],
      sourceFormat: params.sourceFormat ?? 'fountain',
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
        position: serpentine(scene.index),
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

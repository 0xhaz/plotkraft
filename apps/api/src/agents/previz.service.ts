import { Injectable, Logger } from '@nestjs/common';
import { getStorage } from 'firebase-admin/storage';
import { FirebaseService } from '../firebase/firebase.service';
import { GeminiService } from './gemini.service';
import { selectForBoards, type BoardCandidate } from './previz';
import { mapWithLimit } from './throttle';

/** Gemini's native image model. Imagen is not available on this project. */
const IMAGE_MODEL = 'gemini-2.5-flash-image';

const ACTION_CHARS = 500;

/**
 * Storyboard panels for the scenes that carry the film.
 *
 * Boards are about staging, not likeness: a panel exists to answer where the
 * camera is and who is where, which is why they are drawn as rough monochrome
 * sketches rather than finished art. Describing composition instead of
 * characters also keeps the tool from rendering recognisable people out of a
 * script someone else wrote.
 */
@Injectable()
export class PrevizService {
  private readonly log = new Logger(PrevizService.name);

  constructor(
    private readonly fb: FirebaseService,
    private readonly gemini: GeminiService,
  ) {}

  async generate(
    projectId: string,
    panels = 8,
  ): Promise<{ requested: number; drawn: number; failed: number }> {
    const projectRef = this.fb.db.collection('projects').doc(projectId);
    const snap = await projectRef.collection('scenes').orderBy('index').get();

    const candidates: BoardCandidate[] = snap.docs.map((d) => {
      const v = d.data();
      return {
        sceneId: String(v.id),
        index: Number(v.index),
        heading: String(v.heading),
        action: String(v.action ?? ''),
        loadScore: Number(v.loadScore ?? 0),
        circleStep: v.circleStep ? Number(v.circleStep) : undefined,
      };
    });

    const chosen = selectForBoards(candidates, panels);
    if (chosen.length === 0) return { requested: 0, drawn: 0, failed: 0 };

    const bucket = getStorage().bucket(
      process.env.GCS_BUCKET ?? `${process.env.GCP_PROJECT_ID}.firebasestorage.app`,
    );
    const byId = new Map(snap.docs.map((d) => [String(d.data().id), d]));

    // Image generation is far more rate-limited than text: three concurrent
    // panels returned a 429, and short retries still lost one. Boards are
    // pre-generated and cached rather than drawn during a demo, so completeness
    // is worth far more than speed — one at a time, waiting long enough for a
    // per-minute quota to actually reset.
    const settled = await mapWithLimit(
      chosen,
      async (scene) => {
        const png = await this.draw(scene);
        const path = `projects/${projectId}/boards/${scene.sceneId}.png`;
        await bucket.file(path).save(png, { contentType: 'image/png' });
        return { scene, path };
      },
      { limit: 1, retries: 5, baseDelayMs: 4000 },
    );

    const batch = this.fb.db.batch();
    let drawn = 0;
    let failed = 0;

    for (const outcome of settled) {
      if (outcome.status === 'rejected') {
        failed++;
        this.log.warn(`previz: panel failed — ${outcome.reason}`);
        continue;
      }
      const { scene, path } = outcome.value;
      const doc = byId.get(scene.sceneId);
      if (!doc) continue;
      batch.update(doc.ref, { boardPath: path, boardAt: Date.now() });
      drawn++;
    }

    await batch.commit();
    this.log.log(`previz: ${drawn} panels drawn, ${failed} failed`);
    return { requested: chosen.length, drawn, failed };
  }

  private async draw(scene: BoardCandidate): Promise<Buffer> {
    const res = await this.gemini.ai.models.generateContent({
      model: IMAGE_MODEL,
      contents: buildPanelPrompt(scene),
      config: { responseModalities: ['IMAGE'] },
    });

    const parts = res.candidates?.[0]?.content?.parts ?? [];
    for (const part of parts) {
      if (part.inlineData?.data) return Buffer.from(part.inlineData.data, 'base64');
    }
    throw new Error(`no image returned for scene ${scene.index + 1}`);
  }
}

export function buildPanelPrompt(scene: BoardCandidate): string {
  const action = scene.action.replace(/\s+/g, ' ').slice(0, ACTION_CHARS);

  return [
    'Draw a single production storyboard panel: rough black-and-white graphite sketch,',
    'loose confident pencil lines, cinematic composition, no colour, no lettering,',
    'no captions, no frame numbers, no text of any kind in the image.',
    '',
    'Draw the STAGING only — where the camera sits, who stands where, what the space',
    'looks like. Render people as anonymous, generic figures: no recognisable faces,',
    'no logos, insignia, costumes or likenesses of any real or fictional person.',
    '',
    `SLUGLINE: ${scene.heading}`,
    `ACTION: ${action}`,
  ].join('\n');
}

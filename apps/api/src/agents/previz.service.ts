import { Injectable, Logger } from '@nestjs/common';
import { getStorage } from 'firebase-admin/storage';
import { FirebaseService } from '../firebase/firebase.service';
import { GeminiService, MODELS } from './gemini.service';
import { actOfStep } from './story-circle';
import { selectForBoards, type BoardCandidate } from './previz';
import { mapWithLimit } from './throttle';
import { SHOTS_SCHEMA, SHOTS_SYSTEM, buildShotsPrompt } from './shot.prompt';
import { shotToComposition, type Shot } from './shot';

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
    options: { panels?: number; sceneIds?: string[]; act?: number; fromIndex?: number; toIndex?: number } = {},
  ): Promise<{ requested: number; drawn: number; failed: number }> {
    const panels = options.panels ?? 8;
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

    // Scoping comes before selection, so "board Act Two" spreads its panels
    // across Act Two rather than across the whole film.
    let scoped = candidates;
    if (options.sceneIds?.length) {
      const wanted = new Set(options.sceneIds);
      scoped = candidates.filter((c) => wanted.has(c.sceneId));
    } else if (options.act) {
      scoped = candidates.filter((c) => actOfStep(c.circleStep) === options.act);
    } else if (options.fromIndex !== undefined || options.toIndex !== undefined) {
      const from = options.fromIndex ?? 0;
      const to = options.toIndex ?? Number.MAX_SAFE_INTEGER;
      scoped = candidates.filter((c) => c.index >= from && c.index <= to);
    }

    // An explicit list of scenes is a request, not a suggestion: board exactly
    // those, in order, rather than ranking them down to a panel budget.
    const chosen = options.sceneIds?.length
      ? scoped.sort((a, b) => a.index - b.index)
      : selectForBoards(scoped, panels);

    if (chosen.length === 0) return { requested: 0, drawn: 0, failed: 0 };

    // One batched call gives every chosen scene its camera before any drawing
    // starts; the shot then drives both the image and the label under it.
    const shots = await this.chooseShots(chosen);

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
        const shot = shots.get(scene.index);
        const png = await this.draw(scene, shot);
        const path = `projects/${projectId}/boards/${scene.sceneId}.png`;
        await bucket.file(path).save(png, { contentType: 'image/png' });
        return { scene, path, shot };
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
      const { scene, path, shot } = outcome.value;
      const doc = byId.get(scene.sceneId);
      if (!doc) continue;
      batch.update(doc.ref, {
        boardPath: path,
        boardAt: Date.now(),
        // Stamped so a later edit can tell this panel is out of date.
        boardVersion: Number(doc.data().version ?? 1),
        ...(shot ? { shot } : {}),
      });
      drawn++;
    }

    await batch.commit();
    this.log.log(`previz: ${drawn} panels drawn, ${failed} failed`);
    return { requested: chosen.length, drawn, failed };
  }

  /** One call for every chosen scene: cheap, and keeps the choices coherent. */
  private async chooseShots(chosen: BoardCandidate[]): Promise<Map<number, Shot>> {
    try {
      const res = await this.gemini.ai.models.generateContent({
        model: MODELS.fast,
        contents: buildShotsPrompt(
          chosen.map((c) => ({
            index: c.index,
            heading: c.heading,
            action: c.action.replace(/\s+/g, ' ').slice(0, ACTION_CHARS),
          })),
        ),
        config: {
          systemInstruction: SHOTS_SYSTEM,
          responseMimeType: 'application/json',
          responseSchema: SHOTS_SCHEMA,
          temperature: 0.3,
        },
      });
      const shots = (JSON.parse(res.text ?? '{}') as { shots?: Shot[] }).shots ?? [];
      return new Map(shots.map((s) => [s.sceneIndex, s]));
    } catch (err) {
      // A panel without a camera choice is still worth drawing.
      this.log.warn(`previz: shot pass failed, drawing without direction — ${err}`);
      return new Map();
    }
  }

  private async draw(scene: BoardCandidate, shot?: Shot): Promise<Buffer> {
    const res = await this.gemini.ai.models.generateContent({
      model: IMAGE_MODEL,
      contents: buildPanelPrompt(scene, shot),
      config: { responseModalities: ['IMAGE'] },
    });

    const parts = res.candidates?.[0]?.content?.parts ?? [];
    for (const part of parts) {
      if (part.inlineData?.data) return Buffer.from(part.inlineData.data, 'base64');
    }
    throw new Error(`no image returned for scene ${scene.index + 1}`);
  }
}

export function buildPanelPrompt(scene: BoardCandidate, shot?: Shot): string {
  const action = scene.action.replace(/\s+/g, ' ').slice(0, ACTION_CHARS);
  const composition = shot ? shotToComposition(shot) : '';

  return [
    'Draw a single production storyboard panel: rough black-and-white graphite sketch,',
    'loose confident pencil lines, cinematic composition, no colour, no lettering,',
    'no captions, no frame numbers, no text of any kind in the image.',
    '',
    'Draw the STAGING only — where the camera sits, who stands where, what the space',
    'looks like. Render people as anonymous, generic figures: no recognisable faces,',
    'no logos, insignia, costumes or likenesses of any real or fictional person.',
    '',
    ...(composition ? [composition, ''] : []),
    `SLUGLINE: ${scene.heading}`,
    `ACTION: ${action}`,
  ].join('\n');
}

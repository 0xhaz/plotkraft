import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';
import { GeminiService, MODELS } from './gemini.service';
import { CRAFT_SCHEMA, CRAFT_SYSTEM, buildCraftPrompt } from './craft.prompt';

const SYNOPSIS_CHARS = 400;

/** Scenes per model call. A feature runs to 150+ scenes and will not fit in one. */
const BATCH = 25;

interface RawLesson {
  sceneIndex: number;
  job: string;
  technique: string;
  transferable: string;
}

/**
 * The Craft agent: what a produced screenplay can teach.
 *
 * Every other agent in the crew diagnoses — it finds what is wrong. Applied to a
 * finished film that is useless, because the writer cannot and should not fix
 * it. This one runs the other way: it names the job each scene performs and the
 * device that performs it, so a writer can borrow the method rather than the
 * story.
 */
@Injectable()
export class CraftService {
  private readonly log = new Logger(CraftService.name);

  constructor(
    private readonly fb: FirebaseService,
    private readonly gemini: GeminiService,
  ) {}

  async analyze(projectId: string): Promise<{ scenes: number; lessons: number }> {
    const projectRef = this.fb.db.collection('projects').doc(projectId);
    const projectSnap = await projectRef.get();

    if (projectSnap.data()?.mode !== 'reference') {
      throw new BadRequestException(
        'Craft analysis is for reference screenplays. This project is your own work — the diagnostic agents apply instead.',
      );
    }

    const snap = await projectRef.collection('scenes').orderBy('index').get();
    const scenes = snap.docs.map((d) => d.data());
    if (!scenes.length) return { scenes: 0, lessons: 0 };

    const title = String(projectSnap.data()?.title ?? 'this screenplay');
    const beats = scenes.map((s) => ({
      index: Number(s.index),
      heading: String(s.heading),
      synopsis: String(s.action ?? '').slice(0, SYNOPSIS_CHARS),
      characters: (s.characters as string[]) ?? [],
    }));

    // Batches run concurrently; a feature is long enough that serial would crawl.
    const batches: (typeof beats)[] = [];
    for (let i = 0; i < beats.length; i += BATCH) batches.push(beats.slice(i, i + BATCH));

    const settled = await Promise.allSettled(batches.map((b) => this.classify(b, title)));

    const lessons: RawLesson[] = [];
    let failed = 0;
    for (const outcome of settled) {
      if (outcome.status === 'rejected') {
        failed++;
        this.log.warn(`craft: batch failed — ${outcome.reason}`);
        continue;
      }
      lessons.push(...outcome.value);
    }

    if (failed === batches.length) {
      throw new BadRequestException('Craft analysis failed on every batch — check Vertex access.');
    }

    const byIndex = new Map(lessons.map((l) => [l.sceneIndex, l]));
    const batch = this.fb.db.batch();
    let written = 0;

    for (const doc of snap.docs) {
      const lesson = byIndex.get(Number(doc.data().index));
      if (!lesson) continue;
      batch.update(doc.ref, {
        craft: {
          job: lesson.job,
          technique: lesson.technique,
          transferable: lesson.transferable,
        },
      });
      written++;
    }

    await batch.commit();
    this.log.log(`craft: ${written} scenes annotated (${failed} batches failed)`);
    return { scenes: scenes.length, lessons: written };
  }

  private async classify(
    beats: { index: number; heading: string; synopsis: string; characters: string[] }[],
    title: string,
  ): Promise<RawLesson[]> {
    const res = await this.gemini.ai.models.generateContent({
      model: MODELS.fast,
      contents: buildCraftPrompt(beats, title),
      config: {
        systemInstruction: CRAFT_SYSTEM,
        responseMimeType: 'application/json',
        responseSchema: CRAFT_SCHEMA,
        temperature: 0.3,
      },
    });

    const text = res.text;
    if (!text) throw new Error('Gemini returned no content for the craft pass');
    return (JSON.parse(text) as { lessons?: RawLesson[] }).lessons ?? [];
  }
}

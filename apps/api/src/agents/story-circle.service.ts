import { Injectable, Logger } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';
import { GeminiService, MODELS } from './gemini.service';
import { CIRCLE_SCHEMA, CIRCLE_SYSTEM, buildCirclePrompt } from './story-circle.prompt';
import {
  analyzeCircle,
  estimatePageWeight,
  STEP_NAMES,
  type CircleAnalysis,
  type CircleStep,
  type SceneAssignment,
} from './story-circle';

const SYNOPSIS_CHARS = 400;

/** Below this, the assignment is shown but not used to drive structural flags. */
const LOW_CONFIDENCE = 0.5;

interface RawAssignment {
  sceneIndex: number;
  step: number;
  confidence: number;
  reason: string;
}

@Injectable()
export class StoryCircleService {
  private readonly log = new Logger(StoryCircleService.name);

  constructor(
    private readonly fb: FirebaseService,
    private readonly gemini: GeminiService,
  ) {}

  /**
   * Classify every scene onto the circle, then derive structural diagnostics.
   *
   * A writer-assigned step is authoritative and is never overwritten, mirroring
   * writer-confirmed causal edges: the circle is a reading, not a verdict.
   */
  async analyze(projectId: string): Promise<CircleAnalysis & { assigned: number }> {
    const projectRef = this.fb.db.collection('projects').doc(projectId);
    const snap = await projectRef.collection('scenes').orderBy('index').get();
    const scenes = snap.docs.map((d) => d.data());

    if (!scenes.length) {
      return {
        shares: emptyShares(),
        goThreshold: null,
        returnThreshold: null,
        diagnostics: [],
        nonLinearity: 0,
        assigned: 0,
      };
    }

    const beats = scenes.map((s) => ({
      index: Number(s.index),
      heading: String(s.heading),
      synopsis: String(s.action ?? '').slice(0, SYNOPSIS_CHARS),
      characters: (s.characters as string[]) ?? [],
    }));

    const raw = await this.classify(beats);
    const byIndex = new Map(raw.map((a) => [a.sceneIndex, a]));

    const batch = this.fb.db.batch();
    const assignments: SceneAssignment[] = [];

    for (const doc of snap.docs) {
      const scene = doc.data();
      const index = Number(scene.index);

      // Respect a writer's own placement.
      if (scene.circleStepConfirmed) {
        assignments.push({
          sceneId: String(scene.id),
          index,
          step: Number(scene.circleStep) as CircleStep,
          weight: weightOf(scene),
        });
        continue;
      }

      const a = byIndex.get(index);
      if (!a || a.step < 1 || a.step > 8) continue;

      const step = a.step as CircleStep;
      batch.update(doc.ref, {
        circleStep: step,
        circleConfidence: a.confidence,
        circleReason: a.reason,
      });

      assignments.push({ sceneId: String(scene.id), index, step, weight: weightOf(scene) });
    }

    // Structural findings are derived from confident assignments only. A diagnosis
    // built on scenes the model itself was unsure about is not worth showing.
    const confident = assignments.filter((a) => {
      const r = byIndex.get(a.index);
      return !r || r.confidence >= LOW_CONFIDENCE;
    });

    const analysis = analyzeCircle(confident.length >= assignments.length / 2 ? confident : assignments);

    // Structural diagnostics live on the project, not a scene: they are claims
    // about the whole script.
    batch.set(
      projectRef,
      {
        circle: {
          shares: analysis.shares,
          goThreshold: analysis.goThreshold,
          returnThreshold: analysis.returnThreshold,
          diagnostics: analysis.diagnostics,
          analyzedAt: Date.now(),
          nonLinearity: analysis.nonLinearity,
          lowConfidenceCount: assignments.length - confident.length,
        },
      },
      { merge: true },
    );

    await batch.commit();
    this.log.log(
      `story circle: ${assignments.length} scenes placed, ${analysis.diagnostics.length} diagnostics`,
    );
    return { ...analysis, assigned: assignments.length };
  }

  private async classify(
    beats: { index: number; heading: string; synopsis: string; characters: string[] }[],
  ): Promise<RawAssignment[]> {
    const res = await this.gemini.ai.models.generateContent({
      model: MODELS.fast,
      contents: buildCirclePrompt(beats),
      config: {
        systemInstruction: CIRCLE_SYSTEM,
        responseMimeType: 'application/json',
        responseSchema: CIRCLE_SCHEMA,
        temperature: 0.2,
      },
    });

    const text = res.text;
    if (!text) throw new Error('Gemini returned no content for the story circle pass');

    const parsed = JSON.parse(text) as { assignments?: RawAssignment[] };
    return parsed.assignments ?? [];
  }
}

function weightOf(scene: Record<string, unknown>): number {
  const dialogue = ((scene.dialogue as { text?: string }[]) ?? [])
    .map((d) => d.text ?? '')
    .join(' ');
  return estimatePageWeight(`${String(scene.action ?? '')} ${dialogue}`);
}

function emptyShares(): Record<CircleStep, number> {
  return Object.fromEntries(
    (Object.keys(STEP_NAMES) as unknown as CircleStep[]).map((s) => [s, 0]),
  ) as Record<CircleStep, number>;
}

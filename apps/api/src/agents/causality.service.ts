import { Injectable, Logger } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';
import { GeminiService, MODELS } from './gemini.service';
import {
  CAUSALITY_SCHEMA,
  CAUSALITY_SYSTEM,
  buildCausalityPrompt,
  type BeatInput,
} from './causality.prompt';
import { computeLoadScores } from './load-score';

export type TransitionType = 'therefore' | 'but' | 'and_then';

export interface TransitionResult {
  fromIndex: number;
  toIndex: number;
  type: TransitionType;
  justification: string;
}

/** Action text is trimmed before it reaches the model — full scenes blow the budget. */
const SYNOPSIS_CHARS = 400;

@Injectable()
export class CausalityService {
  private readonly log = new Logger(CausalityService.name);

  constructor(
    private readonly fb: FirebaseService,
    private readonly gemini: GeminiService,
  ) {}

  /**
   * Classify every consecutive beat transition, store the edges, and recompute
   * load scores.
   *
   * Edges are written as first-class documents rather than derived on read: the
   * stored edge list is the dependency map the what-if walk depends on.
   */
  async analyze(projectId: string): Promise<{ edges: number; scenes: number }> {
    const scenesRef = this.fb.db.collection('projects').doc(projectId).collection('scenes');
    const snap = await scenesRef.orderBy('index').get();
    const scenes = snap.docs.map((d) => d.data() as Record<string, unknown>);

    if (scenes.length < 2) return { edges: 0, scenes: scenes.length };

    const beats: BeatInput[] = scenes.map((s) => ({
      sceneId: String(s.id),
      index: Number(s.index),
      heading: String(s.heading),
      synopsis: String(s.action ?? '').slice(0, SYNOPSIS_CHARS),
      characters: (s.characters as string[]) ?? [],
    }));

    const transitions = await this.classify(beats);
    const byIndex = new Map(beats.map((b) => [b.index, b.sceneId]));

    const projectRef = this.fb.db.collection('projects').doc(projectId);
    const edgesRef = projectRef.collection('edges');

    // Writer-confirmed edges are authoritative — an agent never re-labels one.
    const existing = await edgesRef.get();
    const confirmed = new Set(
      existing.docs.filter((d) => d.data().confirmedByWriter).map((d) => d.id),
    );

    const batch = this.fb.db.batch();
    for (const doc of existing.docs) {
      if (!confirmed.has(doc.id)) batch.delete(doc.ref);
    }

    const now = Date.now();
    let written = 0;
    for (const t of transitions) {
      const fromSceneId = byIndex.get(t.fromIndex);
      const toSceneId = byIndex.get(t.toIndex);
      if (!fromSceneId || !toSceneId) continue;

      // Deterministic edge id keeps re-runs idempotent.
      const edgeId = `${fromSceneId}__${toSceneId}`;
      if (confirmed.has(edgeId)) continue;

      batch.set(edgesRef.doc(edgeId), {
        id: edgeId,
        fromSceneId,
        toSceneId,
        type: t.type,
        justification: t.justification,
        confirmedByWriter: false,
        createdAt: now,
      });
      written++;
    }

    const scores = computeLoadScores(
      beats.map((b) => b.sceneId),
      transitions
        .map((t) => ({ from: byIndex.get(t.fromIndex), to: byIndex.get(t.toIndex), type: t.type }))
        .filter((e): e is { from: string; to: string; type: TransitionType } =>
          Boolean(e.from && e.to),
        ),
    );

    for (const doc of snap.docs) {
      const id = String(doc.data().id);
      batch.update(doc.ref, { loadScore: scores.get(id) ?? 0 });
    }

    await batch.commit();
    this.log.log(`causality: ${written} edges for project ${projectId}`);
    return { edges: written, scenes: scenes.length };
  }

  /** One batched Gemini call for the whole script — cheap enough to run on every save. */
  private async classify(beats: BeatInput[]): Promise<TransitionResult[]> {
    const res = await this.gemini.ai.models.generateContent({
      model: MODELS.fast,
      contents: buildCausalityPrompt(beats),
      config: {
        systemInstruction: CAUSALITY_SYSTEM,
        responseMimeType: 'application/json',
        responseSchema: CAUSALITY_SCHEMA,
        temperature: 0.2,
      },
    });

    const text = res.text;
    if (!text) throw new Error('Gemini returned no content for causality pass');

    const parsed = JSON.parse(text) as { transitions?: TransitionResult[] };
    return parsed.transitions ?? [];
  }
}

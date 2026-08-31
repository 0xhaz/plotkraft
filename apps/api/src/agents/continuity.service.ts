import { Injectable, Logger } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';
import { GeminiService, MODELS } from './gemini.service';
import {
  FACTS_SCHEMA,
  FACTS_SYSTEM,
  CONTRADICTION_SCHEMA,
  CONTRADICTION_SYSTEM,
  buildFactsPrompt,
  buildContradictionPrompt,
} from './continuity.prompt';
import {
  contradictionCandidates,
  dedupeContradictions,
  subjectSummary,
  type Contradiction,
  type Fact,
} from './continuity';

/** Scenes per extraction call. A feature runs to 250 and will not fit in one. */
const BATCH = 20;

/** Ceiling on contradiction judgements per run. */
const MAX_PAIRS = 40;

const SCENE_CHARS = 700;

@Injectable()
export class ContinuityService {
  private readonly log = new Logger(ContinuityService.name);

  constructor(
    private readonly fb: FirebaseService,
    private readonly gemini: GeminiService,
  ) {}

  /**
   * Build the bible, then check it against itself.
   *
   * Two passes with different shapes: extraction is embarrassingly parallel and
   * batched by scene, while contradiction checking is a bounded set of pairwise
   * judgements chosen in pure code. Neither grows with the square of the script.
   */
  async analyze(projectId: string): Promise<{
    facts: number;
    subjects: number;
    compared: number;
    contradictions: number;
  }> {
    const projectRef = this.fb.db.collection('projects').doc(projectId);
    const snap = await projectRef.collection('scenes').orderBy('index').get();
    const scenes = snap.docs.map((d) => d.data());
    if (!scenes.length) return { facts: 0, subjects: 0, compared: 0, contradictions: 0 };

    const beats = scenes.map((s) => {
      const dialogue = ((s.dialogue as { character?: string; text?: string }[]) ?? [])
        .map((d) => `${d.character ?? ''}: ${d.text ?? ''}`)
        .join('\n');
      return {
        index: Number(s.index),
        heading: String(s.heading),
        text: `${String(s.action ?? '')}\n${dialogue}`.trim().slice(0, SCENE_CHARS),
      };
    });

    // --- pass one: extract facts ---
    const batches: (typeof beats)[] = [];
    for (let i = 0; i < beats.length; i += BATCH) batches.push(beats.slice(i, i + BATCH));

    const extracted = await Promise.allSettled(batches.map((b) => this.extract(b)));

    const facts: Fact[] = [];
    let failedBatches = 0;
    for (const outcome of extracted) {
      if (outcome.status === 'rejected') {
        failedBatches++;
        this.log.warn(`continuity: extraction batch failed — ${outcome.reason}`);
        continue;
      }
      facts.push(...outcome.value);
    }

    // --- pass two: check the bible against itself ---
    const pairs = contradictionCandidates(facts, MAX_PAIRS);
    const judged = await Promise.allSettled(
      pairs.map(async (pair) => {
        const verdict = await this.judge(pair.earlier, pair.later);
        return verdict.contradicts ? { pair, explanation: verdict.explanation } : null;
      }),
    );

    const found: Contradiction[] = [];
    for (const outcome of judged) {
      if (outcome.status === 'rejected' || !outcome.value) continue;
      const { pair, explanation } = outcome.value;
      found.push({
        earlierScene: pair.earlier.sceneIndex,
        laterScene: pair.later.sceneIndex,
        subject: pair.earlier.subject,
        claim: `${pair.earlier.subject}: "${pair.earlier.claim}" (scene ${pair.earlier.sceneIndex + 1})`,
        explanation,
      });
    }

    // One inconsistency usually surfaces through several facts at once; the
    // writer should be told about it once.
    const unique = dedupeContradictions(found);

    const now = Date.now();
    const batch = this.fb.db.batch();
    const byIndex = new Map(snap.docs.map((d) => [Number(d.data().index), d]));

    let contradictions = 0;
    for (const c of unique) {
      // The flag belongs on the later scene: that is the one the writer is
      // looking at when the break happens.
      const doc = byIndex.get(c.laterScene);
      if (!doc) continue;

      const flagRef = doc.ref.collection('flags').doc();
      batch.set(flagRef, {
        id: flagRef.id,
        sceneId: String(doc.data().id),
        kind: 'continuity',
        // Shipped as something to review, never as a verdict: contradiction
        // detection carries a real false-positive rate and a writer who is
        // wrongly corrected stops reading the flags.
        severity: 'warn',
        message: c.explanation,
        agent: 'Continuity',
        claim: c.claim,
        analyzedVersion: Number(doc.data().version ?? 1),
        verdict: 'pending',
        createdAt: now,
      });
      contradictions++;
    }

    const subjects = subjectSummary(facts);
    batch.set(
      projectRef,
      {
        bible: {
          facts: facts.slice(0, 400),
          subjects: subjects.slice(0, 60),
          factCount: facts.length,
          extractedAt: now,
          failedBatches,
        },
      },
      { merge: true },
    );

    await batch.commit();
    this.log.log(
      `continuity: ${facts.length} facts, ${subjects.length} subjects, ${pairs.length} compared, ${contradictions} flagged`,
    );

    return {
      facts: facts.length,
      subjects: subjects.length,
      compared: pairs.length,
      contradictions,
    };
  }

  private async extract(
    beats: { index: number; heading: string; text: string }[],
  ): Promise<Fact[]> {
    const res = await this.gemini.ai.models.generateContent({
      model: MODELS.fast,
      contents: buildFactsPrompt(beats),
      config: {
        systemInstruction: FACTS_SYSTEM,
        responseMimeType: 'application/json',
        responseSchema: FACTS_SCHEMA,
        temperature: 0.1,
      },
    });
    const text = res.text;
    if (!text) throw new Error('Gemini returned no content for the bible pass');
    return (JSON.parse(text) as { facts?: Fact[] }).facts ?? [];
  }

  private async judge(earlier: Fact, later: Fact) {
    const res = await this.gemini.ai.models.generateContent({
      model: MODELS.fast,
      contents: buildContradictionPrompt(earlier, later),
      config: {
        systemInstruction: CONTRADICTION_SYSTEM,
        responseMimeType: 'application/json',
        responseSchema: CONTRADICTION_SCHEMA,
        temperature: 0.1,
      },
    });
    return JSON.parse(res.text ?? '{}') as { contradicts: boolean; explanation: string };
  }
}

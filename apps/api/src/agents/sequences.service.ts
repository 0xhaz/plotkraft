import { Injectable, Logger } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';
import { GeminiService, MODELS } from './gemini.service';
import { SEQUENCE_SCHEMA, SEQUENCE_SYSTEM, buildSequencePrompt } from './sequences.prompt';
import { normalizeSequences, assignActs, type RawSequence, type Sequence } from './sequences';
import { actOfStep } from './story-circle';

/** Enough of the action to tell scenes apart; the whole script must fit one call. */
const GIST_CHARS = 90;

@Injectable()
export class SequencesService {
  private readonly log = new Logger(SequencesService.name);

  constructor(
    private readonly fb: FirebaseService,
    private readonly gemini: GeminiService,
  ) {}

  /**
   * Segment the script into named sequences.
   *
   * Deliberately one call over the whole script rather than batched: a sequence
   * boundary is a judgement about where one small story ends, which cannot be
   * made from a 25-scene window. Keeping each scene to a heading and a short
   * gist is what makes a 250-scene feature fit.
   */
  async analyze(projectId: string): Promise<{ sequences: number; scenes: number }> {
    const projectRef = this.fb.db.collection('projects').doc(projectId);
    const snap = await projectRef.collection('scenes').orderBy('index').get();
    const scenes = snap.docs.map((d) => d.data());
    if (!scenes.length) return { sequences: 0, scenes: 0 };

    const beats = scenes.map((s) => ({
      index: Number(s.index),
      heading: String(s.heading),
      gist: String(s.action ?? '').replace(/\s+/g, ' ').slice(0, GIST_CHARS),
    }));

    const raw = await this.segment(beats);

    // The model proposes; this guarantees the result covers the script.
    const normalized = normalizeSequences(raw, scenes.length);

    const stepOf = new Map(scenes.map((s) => [Number(s.index), Number(s.circleStep ?? 0)]));
    const withActs = assignActs(normalized, (i) => actOfStep(stepOf.get(i) || undefined));

    await projectRef.set(
      {
        sequences: withActs.map((s, i) => ({ ...s, order: i })),
        sequencesAt: Date.now(),
      },
      { merge: true },
    );

    this.log.log(
      `sequences: ${raw.length} proposed, ${withActs.length} after repair`,
    );
    return { sequences: withActs.length, scenes: scenes.length };
  }

  private async segment(
    beats: { index: number; heading: string; gist: string }[],
  ): Promise<RawSequence[]> {
    const res = await this.gemini.ai.models.generateContent({
      model: MODELS.fast,
      contents: buildSequencePrompt(beats),
      config: {
        systemInstruction: SEQUENCE_SYSTEM,
        responseMimeType: 'application/json',
        responseSchema: SEQUENCE_SCHEMA,
        temperature: 0.2,
      },
    });

    const text = res.text;
    if (!text) throw new Error('Gemini returned no content for the sequence pass');
    return (JSON.parse(text) as { sequences?: RawSequence[] }).sequences ?? [];
  }
}

export type { Sequence };

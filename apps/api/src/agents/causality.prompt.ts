import { Type, type Schema } from '@google/genai';

export interface BeatInput {
  sceneId: string;
  index: number;
  heading: string;
  /** Trimmed action — full scene text would blow the context budget on a feature. */
  synopsis: string;
  characters: string[];
}

/**
 * Structured output beats free-text parsing: the model returns exactly one
 * verdict per transition, so a malformed response fails at the schema rather
 * than silently producing a half-built graph.
 */
export const CAUSALITY_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    transitions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          fromIndex: { type: Type.INTEGER },
          toIndex: { type: Type.INTEGER },
          type: { type: Type.STRING, enum: ['therefore', 'but', 'and_then'] },
          justification: { type: Type.STRING },
        },
        required: ['fromIndex', 'toIndex', 'type', 'justification'],
      },
    },
  },
  required: ['transitions'],
};

export const CAUSALITY_SYSTEM = `You are the Story Logic agent in a screenwriting analysis tool.

You apply the Parker/Stone "therefore / but" test to consecutive beats of a screenplay.
For each transition from one scene to the next, classify the joint:

- "therefore" — the second scene happens BECAUSE of the first. Causal.
- "but" — the second scene complicates, reverses, or opposes the first. Adversative.
- "and_then" — the second scene merely follows in time. No causal or adversative link.

Rules:
- Judge only the joint between the two scenes given, not the wider story.
- "and_then" is a diagnosis, not an insult. Breather scenes and deliberate juxtapositions
  are legitimately "and_then". Do not inflate them into "therefore" to be agreeable.
- The justification must be ONE sentence, under 18 words, and must name the concrete
  story reason — not restate the label.
- Return exactly one entry per consecutive pair, in order.`;

export function buildCausalityPrompt(beats: BeatInput[]): string {
  const rendered = beats
    .map(
      (b) =>
        `[${b.index}] ${b.heading}\n` +
        `    characters: ${b.characters.join(', ') || '(none)'}\n` +
        `    ${b.synopsis || '(no action text)'}`,
    )
    .join('\n\n');

  return `Classify each consecutive beat transition in this screenplay.\n\nThere are ${beats.length} scenes, so return exactly ${Math.max(0, beats.length - 1)} transitions.\n\n${rendered}`;
}

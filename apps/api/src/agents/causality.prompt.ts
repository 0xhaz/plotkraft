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

THE TEST
- "therefore" — the second scene happens BECAUSE of a DECISION, REVELATION, or
  CONSEQUENCE in the first. Remove the first scene and the second stops making sense.
- "but" — the second scene REVERSES, complicates, or frustrates the first. Something
  goes wrong, someone refuses, an obstacle lands.
- "and_then" — the second scene merely happens NEXT. Travel, arrival, continuation,
  a change of location, or the same conversation in a new room.

THE DECISIVE QUESTION
Ask: "Could I write 'and then' between these two scenes and lose nothing?"
If yes, the answer is "and_then" — no matter how eventful the scenes are.

CALIBRATION — these are all "and_then", not "therefore":
- Characters leave one place and arrive at another. (Travel is not causation.)
- A conversation continues in a new location.
- Time passes and the plot proceeds.
- The second scene merely SHOWS what the first scene said would happen.

These are "therefore":
- A character learns something and acts on it.
- A choice in scene A creates the problem in scene B.
- Scene A's consequence forces scene B's situation.

SELF-CHECK — apply before you answer
If your justification would naturally begin with "After...", "Then...", "Next...",
"They proceed to...", or "Having done X, they do Y", the honest label is "and_then".
A justification that only restates the sequence is evidence of "and_then".
A "therefore" justification must name the specific CAUSE — the decision, the
revelation, the consequence — not the chronology.

RULES
- Judge only the joint between the two scenes given, not the wider story.
- "and_then" is a diagnosis, not an insult. Breather scenes and deliberate
  juxtapositions are legitimately "and_then". Do NOT inflate them to "therefore"
  to seem agreeable. A script where every joint is "therefore" is a failed analysis:
  real screenplays are full of connective tissue.
- The justification must be ONE sentence, under 18 words.
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

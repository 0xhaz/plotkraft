import { Type, type Schema } from '@google/genai';

export const SEQUENCE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    sequences: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          startIndex: { type: Type.INTEGER },
          endIndex: { type: Type.INTEGER },
          name: { type: Type.STRING },
          purpose: { type: Type.STRING },
        },
        required: ['startIndex', 'endIndex', 'name', 'purpose'],
      },
    },
  },
  required: ['sequences'],
};

export const SEQUENCE_SYSTEM = `You divide a screenplay into SEQUENCES.

A sequence is a run of consecutive scenes that forms one small story: it has a
beginning, a middle and an end of its own, and it resolves something before the
next one starts. A feature usually holds eight to fifteen of them. It is the unit
a writer names out loud — "the escape", "the interrogation", "the night before".

RULES ON BOUNDARIES
- Sequences are CONSECUTIVE and cover every scene. Do not skip scenes, do not
  overlap, and do not reorder. Scene ranges are inclusive.
- A new sequence starts where the dramatic question changes, not merely where the
  location does. Intercutting between two places within one push is still ONE
  sequence.
- Most sequences run 8-20 scenes in a heavily intercut script. A sequence of one
  or two scenes is almost always a boundary drawn in the wrong place.

NAMING
- name: 3-6 words, the sequence as a person would refer to it. Concrete and
  particular: "The Fortress is breached", "Waiting for the source". Never generic
  labels like "Rising action", "Act two part one", or "Setup".
- Do not number them. The board numbers them.
- purpose: ONE clause, under 12 words, saying what the sequence accomplishes for
  the film. Not what happens in it — what it is FOR.

Return sequences in order, starting at scene 0 and ending at the final scene.`;

export function buildSequencePrompt(
  beats: { index: number; heading: string; gist: string }[],
): string {
  const rendered = beats.map((b) => `[${b.index}] ${b.heading} — ${b.gist}`).join('\n');
  const last = beats.length - 1;

  return `Divide this ${beats.length}-scene screenplay into sequences.\n\nCover every scene from 0 to ${last} with no gaps and no overlaps.\n\n${rendered}`;
}

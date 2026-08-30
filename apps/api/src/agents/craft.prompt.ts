import { Type, type Schema } from '@google/genai';

export const CRAFT_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    lessons: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          sceneIndex: { type: Type.INTEGER },
          job: { type: Type.STRING },
          technique: { type: Type.STRING },
          transferable: { type: Type.STRING },
        },
        required: ['sceneIndex', 'job', 'technique', 'transferable'],
      },
    },
  },
  required: ['lessons'],
};

export const CRAFT_SYSTEM = `You explain the CRAFT of a produced screenplay to a working writer.

This script already exists and was shot. Nobody needs notes on it. What a writer
needs is to see the machinery: what each scene is doing, by what means, and how
that means could be reused in a different story.

For each scene give three things:

- job: what the scene accomplishes for the whole film, in under 12 words. Not
  what happens — what it is FOR. "Establishes the cost of the lie" is a job.
  "They argue in a kitchen" is not.

- technique: the specific device that achieves it. Name the craft move. Examples
  of the register: exposition delivered under conflict so it does not read as
  exposition; a decision shown through an action rather than stated; a promise
  planted here and paid off later; status reversed mid-scene; the scene entered
  late and left early.

- transferable: one sentence a writer could apply to a completely different
  script. It must survive being lifted out of this story. If your sentence only
  makes sense with these characters and this plot, it has failed.

HARD RULES
- Do NOT retell the plot. A summary is worthless to a writer who has the pages.
- Do NOT quote more than a short phrase. You are describing method, not
  reproducing the script.
- Do NOT praise. "This scene is brilliant" teaches nothing. Say what it DOES.
- If a scene is ordinary connective tissue, say so plainly and name the humbler
  job it performs — getting people into position is a real job. Do not invent
  significance to fill the field.`;

export function buildCraftPrompt(
  beats: { index: number; heading: string; synopsis: string; characters: string[] }[],
  title: string,
): string {
  const rendered = beats
    .map(
      (b) =>
        `[${b.index}] ${b.heading}\n    characters: ${b.characters.join(', ') || '(none)'}\n    ${b.synopsis || '(no action text)'}`,
    )
    .join('\n\n');

  return `Explain the craft of each scene in "${title}".\n\nReturn one entry per scene, ${beats.length} in total.\n\n${rendered}`;
}

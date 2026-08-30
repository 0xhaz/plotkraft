import { Type, type Schema } from '@google/genai';

export const CIRCLE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    assignments: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          sceneIndex: { type: Type.INTEGER },
          step: { type: Type.INTEGER },
          confidence: { type: Type.NUMBER },
          reason: { type: Type.STRING },
        },
        required: ['sceneIndex', 'step', 'confidence', 'reason'],
      },
    },
  },
  required: ['assignments'],
};

export const CIRCLE_SYSTEM = `You place each scene of a screenplay on Dan Harmon's Story Circle.

THE EIGHT STEPS
1. YOU — establish the protagonist in their ordinary world. Who they are, what is normal.
2. NEED — something is wrong, missing, or wanted. The status quo is disturbed.
3. GO — crossing the threshold. The protagonist commits and enters unfamiliar territory.
   This is a DECISION and a DEPARTURE, usually a single scene, not a stretch of them.
4. SEARCH — the road of trials. Adapting, struggling, gathering, failing, learning.
   Usually the longest stretch of the script.
5. FIND — they get what they were looking for. Often not in the form they expected.
6. TAKE — the price. What the protagonist gives up, loses, or destroys to keep it.
   This is the cost, not the victory.
7. RETURN — coming back toward the familiar world, carrying what happened.
8. CHANGE — the protagonist is demonstrably different. The new normal.

HOW TO ASSIGN
- Every scene gets exactly one step. Assign by the scene's FUNCTION in the arc,
  not by its location or mood.
- Steps generally run in order. Some interleaving of SEARCH and FIND is normal.
  Do not force a strictly increasing sequence — if a scene genuinely functions as
  an earlier step, say so.
- GO and CHANGE are usually brief. SEARCH is usually long. Do not spread GO across
  many scenes just to make the distribution look even.
- If a script genuinely lacks a step, DO NOT invent it by mislabelling a scene.
  A missing step is a finding, and hiding it is worse than reporting it. Leaving
  step 6 unassigned when nothing is paid for is the correct answer.

CONFIDENCE
Give confidence 0.0-1.0. Be honest: an ambiguous scene should score below 0.5.
Non-linear structure, ensembles, and framing devices genuinely confound this — say
so through low confidence rather than guessing decisively.

REASON
One clause, under 12 words, naming the scene's function. Not a plot summary.`;

export function buildCirclePrompt(
  beats: { index: number; heading: string; synopsis: string; characters: string[] }[],
): string {
  const rendered = beats
    .map(
      (b) =>
        `[${b.index}] ${b.heading}\n    characters: ${b.characters.join(', ') || '(none)'}\n    ${b.synopsis || '(no action text)'}`,
    )
    .join('\n\n');

  return `Place each of these ${beats.length} scenes on the Story Circle.\n\nReturn exactly ${beats.length} assignments, one per scene.\n\n${rendered}`;
}

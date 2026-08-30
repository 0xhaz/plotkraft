import { Type, type Schema } from '@google/genai';

export const MAPPING_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    notes: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          body: { type: Type.STRING },
          ask: { type: Type.STRING },
          sceneIndexes: { type: Type.ARRAY, items: { type: Type.INTEGER } },
          scope: { type: Type.STRING, enum: ['scene', 'script'] },
        },
        required: ['body', 'ask', 'sceneIndexes', 'scope'],
      },
    },
  },
  required: ['notes'],
};

export const MAPPING_SYSTEM = `You process development notes on a screenplay.

A single pasted document usually contains SEVERAL distinct notes. Split them.

For each note:
- body: the note as written, lightly cleaned. Do not paraphrase away the sender's tone —
  a writer needs to recognise their producer's voice.
- ask: the concrete change being demanded, in under 15 words. If the note is praise or
  an observation with no requested change, the ask is an empty string.
- sceneIndexes: the scenes the note actually bears on. A note naming a character or a
  moment maps to the scenes containing it. A note about the whole script maps to no
  scenes and scope "script".
- scope: "scene" if it targets specific scenes, "script" if it is a global note about
  pace, tone, structure or marketability.

Rules:
- Do not invent scene mappings. If you cannot tell which scene a note refers to, return
  an empty sceneIndexes and scope "script". A wrong pin is worse than no pin: the writer
  will open the wrong scene and lose trust in every other pin.
- Keep notes separate even when they come from the same sender in one paragraph.
- Never merge two requests into one note. Two demands are two notes.`;

export const CONFLICT_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    contradicts: { type: Type.BOOLEAN },
    explanation: { type: Type.STRING },
  },
  // No severity: how much a conflict costs depends on who sent the notes, which
  // is computed from the sources rather than guessed at here.
  required: ['contradicts', 'explanation'],
};

export const CONFLICT_SYSTEM = `You decide whether two development notes on the same scene CONTRADICT each other.

Two notes contradict when the writer cannot satisfy both. Examples:
- One asks to cut a scene; the other asks to expand it.
- One asks to make a character warmer; the other asks to make them colder in the same beat.
- One asks to move a reveal earlier; the other asks to hold it longer.

Two notes DO NOT contradict merely because they are different, or because they address
different aspects of the same scene. "Tighten the dialogue" and "add a beat of silence"
can both be done. Say contradicts=false generously.

explanation: ONE sentence naming what each side wants and why they cannot both happen.
Address the writer, not the note-givers. Never take a side — deciding is not your job.`;

import { Type, type Schema } from '@google/genai';

/** The vocabulary a board is actually read in. */
export const SHOT_SIZES = [
  'extreme wide', 'wide', 'full', 'medium wide', 'medium', 'medium close-up',
  'close-up', 'extreme close-up', 'over-the-shoulder', 'two-shot', 'insert', 'POV',
] as const;

export const SHOT_ANGLES = [
  'eye level', 'low angle', 'high angle', 'overhead', 'dutch', 'ground level',
] as const;

export const SHOT_MOVES = [
  'static', 'pan', 'tilt', 'dolly in', 'dolly out', 'tracking', 'handheld', 'crane', 'zoom',
] as const;

export const SHOTS_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    shots: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          sceneIndex: { type: Type.INTEGER },
          size: { type: Type.STRING, enum: [...SHOT_SIZES] },
          angle: { type: Type.STRING, enum: [...SHOT_ANGLES] },
          movement: { type: Type.STRING, enum: [...SHOT_MOVES] },
          subject: { type: Type.STRING },
          staging: { type: Type.STRING },
          why: { type: Type.STRING },
        },
        required: ['sceneIndex', 'size', 'angle', 'movement', 'subject', 'staging', 'why'],
      },
    },
  },
  required: ['shots'],
};

export const SHOTS_SYSTEM = `You are a director choosing the single most important shot in each scene.

A storyboard panel is not an illustration of the scene. It is one frame that
answers: where is the camera, and what does that choice do to the audience.

For each scene give:

- size: how much of the world is in frame. Choose from the list.
- angle: where the camera sits vertically. Choose from the list.
- movement: what the camera does, or "static" if it holds. Most shots are static;
  do not invent a crane move to seem ambitious.
- subject: what the frame is ON, in under 8 words. A person, an object, a space.
- staging: where people and things sit in the frame, in one clause under 15 words.
  Blocking, not plot. "Two figures either side of a desk, door behind."
- why: what this choice does to the audience, in one clause under 12 words. Not a
  restatement of the size. "Isolates her against the room" is a reason. "Shows
  the room in a wide shot" is not.

RULES
- Pick the DECISIVE frame. If the scene turns on a refusal, board the refusal, not
  the establishing geography.
- Match the size to the dramatic distance. A confession is not a wide shot; a
  character losing a room is not a close-up.
- A low angle, a dutch or a crane must earn itself. Default to eye level.
- Never describe faces, likenesses, costume detail or insignia. You are choosing a
  camera position, not designing a character.`;

export function buildShotsPrompt(
  beats: { index: number; heading: string; action: string }[],
): string {
  const rendered = beats
    .map((b) => `[${b.index}] ${b.heading}\n${b.action || '(no action text)'}`)
    .join('\n\n');
  return `Choose the decisive shot for each of these ${beats.length} scenes.\n\n${rendered}`;
}

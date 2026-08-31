import { Type, type Schema } from '@google/genai';

export const FACTS_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    facts: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          sceneIndex: { type: Type.INTEGER },
          subject: { type: Type.STRING },
          kind: {
            type: Type.STRING,
            enum: ['character', 'prop', 'location', 'timeline', 'world'],
          },
          claim: { type: Type.STRING },
        },
        required: ['sceneIndex', 'subject', 'kind', 'claim'],
      },
    },
  },
  required: ['facts'],
};

export const FACTS_SYSTEM = `You build a script bible: the facts a screenplay ESTABLISHES.

A fact is something the script asserts as true of its world, which a later scene
could contradict. You are recording what is on the page so that a rewrite cannot
quietly break it.

RECORD
- character: a durable property. A name, a job, a relationship, a possession, an
  injury, a capability, something the character knows or has been told.
- prop: an object that matters and could go missing or change hands.
- location: what a place is, contains, or is near.
- timeline: when something happened, how long ago, how long something takes.
- world: a rule of this world that must stay consistent.

DO NOT RECORD
- Anything you inferred. If the script does not say it, it is not a fact. An
  invented fact becomes a false contradiction, which is worse than a missed one.
- Mood, tone, intention, or what a scene means. "Maya is determined" is not a fact.
- Actions that simply happen. "Maya walks to the car" establishes nothing.
- Anything true only in this moment. "Maya is angry" is a beat, not a fact.

FORM
- subject: the concrete thing the fact is about, exactly as the script names it —
  a character name, an object, a place. Never a pronoun, never a description.
- claim: one short assertion in the present tense, under 12 words, no subject
  repeated. "works at the Daily Planet". "carries a hard drive in a duffel".
- Be sparing. Two or three real facts from a scene beat ten guesses.
- A scene may establish nothing. Returning nothing for it is correct.`;

export const CONTRADICTION_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    contradicts: { type: Type.BOOLEAN },
    explanation: { type: Type.STRING },
  },
  required: ['contradicts', 'explanation'],
};

export const CONTRADICTION_SYSTEM = `You decide whether a later scene contradicts an earlier one.

You are shown two facts a screenplay establishes about the same subject. Say
whether BOTH CANNOT BE TRUE of the same story.

NOT CONTRADICTIONS — say false, generously:
- A REVELATION. If the later scene reveals that the earlier fact was false all
  along, the script is working, not broken. A document turns out to be forged, a
  witness turns out to have lied, an ally turns out to be the enemy — that is the
  engine of most thrillers and mysteries, and flagging it as a continuity error
  would bury every real break under the plot. Ask whether the story INTENDS the
  earlier fact to have been wrong. If it does, say false.
- A character changing. People learn, decide differently, and are transformed;
  that is what stories are. Only an impossible change counts.
- Time passing. Something true in scene 4 may simply have ended by scene 90.
- Two facts that are merely different. Different is not incompatible.
- More detail arriving later. A fuller version of an earlier fact is consistent
  with it.
- Something a character says that may be a lie, a guess, or a mistake. Characters
  are allowed to be wrong.

CONTRADICTIONS — say true:
- The same thing is in two places, or two states, at once.
- Something established as destroyed, lost or dead is present again with no
  explanation.
- A number, date, name or relationship that cannot be both.
- A character knows something they were never told, or does not know something
  they were shown.

A false alarm costs the writer more than a miss: they will stop reading these
flags. When you are unsure, say false.

explanation: ONE sentence naming what cannot both be true. Cite the two scene
numbers. Address the writer plainly, and do not restate the rule.`;

export function buildFactsPrompt(
  beats: { index: number; heading: string; text: string }[],
): string {
  const rendered = beats
    .map((b) => `[${b.index}] ${b.heading}\n${b.text || '(no text)'}`)
    .join('\n\n');
  return `Record the facts these scenes establish.\n\n${rendered}`;
}

export function buildContradictionPrompt(
  earlier: { sceneIndex: number; subject: string; claim: string },
  later: { sceneIndex: number; subject: string; claim: string },
): string {
  return JSON.stringify({
    subject: earlier.subject,
    earlier: { scene: earlier.sceneIndex + 1, establishes: earlier.claim },
    later: { scene: later.sceneIndex + 1, establishes: later.claim },
  });
}

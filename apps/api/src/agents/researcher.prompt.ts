import { Type, type Schema } from '@google/genai';

/** A real-world assertion in the script that can be checked against sources. */
export interface Claim {
  sceneId: string;
  text: string;
  /** What kind of accuracy is at stake — drives how the search is framed. */
  category: 'historical' | 'legal' | 'medical' | 'technical' | 'geographic' | 'brand';
  /** 3-6 word search queries, per Parallel's guidance. */
  queries: string[];
}

export const CLAIMS_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    claims: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          sceneIndex: { type: Type.INTEGER },
          text: { type: Type.STRING },
          category: {
            type: Type.STRING,
            enum: ['historical', 'legal', 'medical', 'technical', 'geographic', 'brand'],
          },
          queries: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ['sceneIndex', 'text', 'category', 'queries'],
      },
    },
  },
  required: ['claims'],
};

export const CLAIM_EXTRACTION_SYSTEM = `You find checkable real-world claims in a screenplay.

A checkable claim is a statement about the real world that a knowledgeable reader could
verify or refute: how a procedure actually works, what a law actually requires, whether a
place or institution is as described, what happened on a real date, how a technology behaves.

DO extract:
- Procedural or technical assertions ("a silent alarm alerts police in under a minute").
- Legal or regulatory assertions ("counsel must respond within thirty days").
- Medical, forensic, or scientific assertions.
- Claims about real places, organisations, or historical events.

DO NOT extract:
- Invented story facts about fictional characters. Whether Maya has a sister is
  not checkable; it is the writer's invention and none of your business.
- Emotional or aesthetic content, dialogue subtext, or character motivation.
- Anything whose truth depends only on the fiction itself.

Be conservative. An empty list is a perfectly good answer for a script that makes no
real-world claims. Do not manufacture claims to seem useful.

For each claim give 2-3 search queries of 3-6 words each — the terms a researcher
would actually type, not a restatement of the sentence.`;

export const VERDICT_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    verdict: { type: Type.STRING, enum: ['supported', 'contradicted', 'unclear'] },
    severity: { type: Type.STRING, enum: ['info', 'warn', 'critical'] },
    message: { type: Type.STRING },
    citedUrls: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ['verdict', 'severity', 'message', 'citedUrls'],
};

export const VERDICT_SYSTEM = `You are the Researcher agent in a screenwriting tool.

You are given a claim from a script and web search results. Decide whether the sources
SUPPORT the claim, CONTRADICT it, or leave it UNCLEAR.

Rules:
- Base the verdict only on the supplied sources. You are not a general knowledge oracle.
- If the sources do not actually address the claim, the verdict is "unclear". Say so
  plainly rather than reaching.
- citedUrls must contain only URLs that appear in the supplied sources, and only ones
  you actually relied on. Never invent a URL.
- severity: "critical" only when a contradicted fact would visibly break the story for an
  informed audience; "warn" for a real but survivable inaccuracy; "info" otherwise.
- The message is ONE or TWO sentences addressed to the screenwriter. Be specific about
  what is wrong and what the sources say instead. Never lecture about creative choices —
  a writer is allowed to bend facts on purpose.`;

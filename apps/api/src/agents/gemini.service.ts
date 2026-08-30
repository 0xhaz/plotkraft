import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { GoogleGenAI } from '@google/genai';

/**
 * Single entry point for Gemini. Model routing lives here (architecture.md §3):
 * Flash for high-volume classification (beat transitions, note mapping), Pro for
 * deep continuity reasoning over the full bible.
 */
/**
 * Concrete model IDs, not `-latest` aliases: Vertex rejects the aliases that the
 * AI Studio backend accepts. Verified available in us-central1 on this project.
 */
export const MODELS = {
  /** Cheap, high-volume: beat-transition classification, note mapping. */
  fast: 'gemini-2.5-flash',
  /** Deep reasoning over the whole bible: continuity contradictions. */
  deep: 'gemini-2.5-pro',
} as const;

@Injectable()
export class GeminiService {
  private client?: GoogleGenAI;

  /**
   * Vertex AI is the default backend: it bills to the project's own account
   * (where the hackathon credits land) and is the clearer "Google Cloud called at
   * runtime" story for submission. Setting GOOGLE_GENAI_API_KEY switches to the
   * AI Studio backend instead, which is handy for a machine without ADC.
   */
  private get useVertex(): boolean {
    return process.env.GENAI_BACKEND !== 'aistudio';
  }

  get ai(): GoogleGenAI {
    if (this.client) return this.client;

    if (this.useVertex) {
      const project = process.env.GCP_PROJECT_ID;
      if (!project) {
        throw new InternalServerErrorException(
          'GCP_PROJECT_ID is not set — cannot reach Vertex AI.',
        );
      }
      this.client = new GoogleGenAI({
        vertexai: true,
        project,
        location: process.env.GCP_LOCATION ?? 'us-central1',
      });
      return this.client;
    }

    const apiKey = process.env.GOOGLE_GENAI_API_KEY;
    if (!apiKey) {
      // Fail loudly rather than degrading to a canned response — a demo that
      // silently fakes agent output is worse than one that errors.
      throw new InternalServerErrorException(
        'GOOGLE_GENAI_API_KEY is not set — cannot run Gemini agents.',
      );
    }
    this.client = new GoogleGenAI({ apiKey });
    return this.client;
  }

  get configured(): boolean {
    return this.useVertex
      ? Boolean(process.env.GCP_PROJECT_ID)
      : Boolean(process.env.GOOGLE_GENAI_API_KEY);
  }

  get backend(): 'vertex' | 'aistudio' {
    return this.useVertex ? 'vertex' : 'aistudio';
  }
}

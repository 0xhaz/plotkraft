import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { GoogleGenAI } from '@google/genai';

/**
 * Single entry point for Gemini. Model routing lives here (architecture.md §3):
 * Flash for high-volume classification (beat transitions, note mapping), Pro for
 * deep continuity reasoning over the full bible.
 */
export const MODELS = {
  /** Cheap, high-volume: beat-transition classification, note mapping. */
  fast: 'gemini-flash-latest',
  /** Deep reasoning over the whole bible: continuity contradictions. */
  deep: 'gemini-pro-latest',
} as const;

@Injectable()
export class GeminiService {
  private client?: GoogleGenAI;

  /**
   * Fails loudly when unconfigured rather than degrading to a canned response —
   * a demo that silently fakes agent output is worse than one that errors.
   */
  get ai(): GoogleGenAI {
    if (!this.client) {
      const apiKey = process.env.GOOGLE_GENAI_API_KEY;
      if (!apiKey) {
        throw new InternalServerErrorException(
          'GOOGLE_GENAI_API_KEY is not set — cannot run Gemini agents.',
        );
      }
      this.client = new GoogleGenAI({ apiKey });
    }
    return this.client;
  }

  get configured(): boolean {
    return Boolean(process.env.GOOGLE_GENAI_API_KEY);
  }
}

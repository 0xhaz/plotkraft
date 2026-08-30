import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';
import { GeminiService, MODELS } from './gemini.service';
import { ParallelService } from './parallel.service';
import {
  CLAIMS_SCHEMA,
  CLAIM_EXTRACTION_SYSTEM,
  VERDICT_SCHEMA,
  VERDICT_SYSTEM,
} from './researcher.prompt';

interface ExtractedClaim {
  sceneIndex: number;
  text: string;
  category: string;
  queries: string[];
}

interface Verdict {
  verdict: 'supported' | 'contradicted' | 'unclear';
  severity: 'info' | 'warn' | 'critical';
  message: string;
  citedUrls: string[];
}

/** Cap the fan-out so one analysis run cannot drain the credit balance. */
const MAX_CLAIMS_PER_RUN = 6;

@Injectable()
export class ResearcherService {
  private readonly log = new Logger(ResearcherService.name);

  constructor(
    private readonly fb: FirebaseService,
    private readonly gemini: GeminiService,
    private readonly parallel: ParallelService,
  ) {}

  /**
   * Gemini finds checkable claims; Parallel searches the web; Gemini judges the
   * sources. Claims are researched concurrently — they are independent, so the
   * writer sees flags land progressively rather than waiting on a single spinner.
   */
  async analyze(projectId: string): Promise<{ claims: number; flags: number; failed: number }> {
    // Check configuration before spending a Gemini call on claim extraction, and
    // before allSettled can turn a missing key into a quiet "0 findings" — which
    // would read to the writer as "your script is clean".
    if (!this.parallel.configured) {
      throw new InternalServerErrorException(
        'PARALLEL_API_KEY is not set — the Researcher agent cannot run.',
      );
    }

    const projectRef = this.fb.db.collection('projects').doc(projectId);
    const sceneSnap = await projectRef.collection('scenes').orderBy('index').get();
    const scenes = sceneSnap.docs.map((d) => d.data());
    if (!scenes.length) return { claims: 0, flags: 0, failed: 0 };

    const claims = (await this.extractClaims(scenes)).slice(0, MAX_CLAIMS_PER_RUN);
    this.log.log(`researcher: ${claims.length} checkable claims`);
    if (!claims.length) return { claims: 0, flags: 0, failed: 0 };

    const byIndex = new Map(scenes.map((s) => [Number(s.index), s]));

    const settled = await Promise.allSettled(
      claims.map(async (claim) => {
        const scene = byIndex.get(claim.sceneIndex);
        if (!scene) return null;

        const sources = await this.parallel.search(
          `Verify this claim from a screenplay: ${claim.text}`,
          claim.queries,
        );
        if (!sources.length) return null;

        const verdict = await this.judge(claim, sources);
        return { claim, scene, verdict, sources };
      }),
    );

    const batch = this.fb.db.batch();
    let flags = 0;
    const now = Date.now();
    const perScene = new Map<string, number>();

    let failed = 0;
    for (const outcome of settled) {
      if (outcome.status === 'rejected') {
        failed++;
        this.log.warn(`researcher: claim failed — ${outcome.reason}`);
        continue;
      }
      const r = outcome.value;
      if (!r) continue;

      // Supported claims are recorded too, at info severity. A verified fact with
      // its sources is what makes the tool trustworthy — if only problems were
      // shown, a well-researched script would display nothing at all, and the
      // writer would have no way to see the Researcher had actually read it.

      const sceneRef = projectRef.collection('scenes').doc(String(r.scene.id));
      const flagRef = sceneRef.collection('flags').doc();

      const cited = r.sources.filter((s) => r.verdict.citedUrls.includes(s.url));

      batch.set(flagRef, {
        id: flagRef.id,
        sceneId: String(r.scene.id),
        kind: 'research',
        researchVerdict: r.verdict.verdict,
        // A supported claim is never louder than info, whatever the model says.
        severity: r.verdict.verdict === 'supported' ? 'info' : r.verdict.severity,
        message: r.verdict.message,
        agent: 'Researcher',
        claim: r.claim.text,
        category: r.claim.category,
        // Stamp the version analysed so a later edit renders the flag as stale
        // rather than silently presenting it as current.
        analyzedVersion: Number(r.scene.version ?? 1),
        verdict: 'pending',
        citations: (cited.length ? cited : r.sources).slice(0, 3).map((s) => ({
          url: s.url,
          title: s.title,
          excerpt: s.excerpts[0] ?? '',
        })),
        createdAt: now,
      });
      perScene.set(String(r.scene.id), (perScene.get(String(r.scene.id)) ?? 0) + 1);
      flags++;
    }

    // Badge counts live on the scene doc so the canvas can render them without a
    // fan-out of per-scene listeners.
    for (const [sceneId, count] of perScene) {
      batch.update(projectRef.collection('scenes').doc(sceneId), { flagCount: count });
    }

    // If every claim errored, the run did not happen — say so rather than
    // reporting a clean bill of health.
    if (failed === claims.length) {
      throw new InternalServerErrorException(
        `Researcher failed on all ${failed} claims — check Parallel credentials and credit balance.`,
      );
    }

    await batch.commit();
    this.log.log(`researcher: ${flags} flags written, ${failed} claims failed`);
    return { claims: claims.length, flags, failed };
  }

  private async extractClaims(scenes: Record<string, unknown>[]): Promise<ExtractedClaim[]> {
    const rendered = scenes
      .map(
        (s) =>
          `[${s.index}] ${s.heading}\n${String(s.action ?? '').slice(0, 500)}\n` +
          ((s.dialogue as { character: string; text: string }[]) ?? [])
            .map((d) => `${d.character}: ${d.text}`)
            .join('\n'),
      )
      .join('\n\n');

    const res = await this.gemini.ai.models.generateContent({
      model: MODELS.fast,
      contents: `Find checkable real-world claims in this screenplay.\n\n${rendered}`,
      config: {
        systemInstruction: CLAIM_EXTRACTION_SYSTEM,
        responseMimeType: 'application/json',
        responseSchema: CLAIMS_SCHEMA,
        temperature: 0.1,
      },
    });

    const parsed = JSON.parse(res.text ?? '{}') as { claims?: ExtractedClaim[] };
    return parsed.claims ?? [];
  }

  private async judge(
    claim: ExtractedClaim,
    sources: { url: string; title: string; excerpts: string[] }[],
  ): Promise<Verdict> {
    const res = await this.gemini.ai.models.generateContent({
      model: MODELS.fast,
      contents: JSON.stringify({ claim: claim.text, category: claim.category, sources }),
      config: {
        systemInstruction: VERDICT_SYSTEM,
        responseMimeType: 'application/json',
        responseSchema: VERDICT_SCHEMA,
        temperature: 0.1,
      },
    });

    return JSON.parse(res.text ?? '{}') as Verdict;
  }
}

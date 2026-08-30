import { Injectable, Logger } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';
import { GeminiService, MODELS } from './gemini.service';
import {
  MAPPING_SCHEMA,
  MAPPING_SYSTEM,
  CONFLICT_SCHEMA,
  CONFLICT_SYSTEM,
} from './notes.prompt';
import {
  candidatePairs,
  dedupeConflicts,
  conflictSeverity,
  type Conflict,
  type MappedNote,
  type NoteSource,
} from './notes';

const SYNOPSIS_CHARS = 300;

/** Ceiling on model calls per reconciliation run. */
const MAX_PAIRS = 24;

interface JudgedConflict {
  conflict: Conflict;
  severity: 'info' | 'warn' | 'critical';
  sources: NoteSource[];
  authors: string[];
}

interface RawMapped {
  body: string;
  ask: string;
  sceneIndexes: number[];
  scope: 'scene' | 'script';
}

@Injectable()
export class NotesService {
  private readonly log = new Logger(NotesService.name);

  constructor(
    private readonly fb: FirebaseService,
    private readonly gemini: GeminiService,
  ) {}

  /** Store a raw pasted note batch verbatim. Mapping happens in the agent pass. */
  async ingest(
    projectId: string,
    input: { source: NoteSource; author: string; body: string },
  ): Promise<{ noteBatchId: string }> {
    const ref = this.fb.db
      .collection('projects')
      .doc(projectId)
      .collection('noteBatches')
      .doc();

    await ref.set({
      id: ref.id,
      source: input.source,
      author: input.author,
      body: input.body,
      processed: false,
      createdAt: Date.now(),
    });

    return { noteBatchId: ref.id };
  }

  /**
   * Split raw note batches into individual notes, pin each to its scenes, then
   * look for contradictions between notes landing on the same scene.
   *
   * The contradiction pass is the point of the feature: producers, executives and
   * peers routinely ask for opposite things, and today nothing tells the writer
   * that before they have rewritten twice.
   */
  async reconcile(projectId: string): Promise<{
    notes: number;
    conflicts: number;
    unmapped: number;
  }> {
    const projectRef = this.fb.db.collection('projects').doc(projectId);

    const [sceneSnap, batchSnap] = await Promise.all([
      projectRef.collection('scenes').orderBy('index').get(),
      projectRef.collection('noteBatches').get(),
    ]);

    const scenes = sceneSnap.docs.map((d) => d.data());
    const batches = batchSnap.docs;
    if (!scenes.length || !batches.length) return { notes: 0, conflicts: 0, unmapped: 0 };

    const sceneList = scenes
      .map(
        (s) =>
          `[${s.index}] ${s.heading}: ${String(s.action ?? '').slice(0, SYNOPSIS_CHARS)}` +
          ` (characters: ${((s.characters as string[]) ?? []).join(', ') || 'none'})`,
      )
      .join('\n');

    const byIndex = new Map(scenes.map((s) => [Number(s.index), String(s.id)]));

    // --- split + map each batch, concurrently ---
    const mappedPerBatch = await Promise.all(
      batches.map(async (batchDoc) => {
        const batch = batchDoc.data();
        const raw = await this.mapNotes(String(batch.body), sceneList);
        return raw.map((r) => ({ raw: r, batch }));
      }),
    );

    const writeBatch = this.fb.db.batch();
    const notes: MappedNote[] = [];
    let unmapped = 0;
    const now = Date.now();

    for (const perBatch of mappedPerBatch) {
      for (const { raw, batch } of perBatch) {
        const sceneIds = raw.sceneIndexes
          .map((i) => byIndex.get(i))
          .filter((id): id is string => Boolean(id));

        if (raw.scope === 'script' || sceneIds.length === 0) unmapped++;

        const noteRef = projectRef.collection('notes').doc();
        const note = {
          id: noteRef.id,
          source: batch.source as NoteSource,
          author: String(batch.author),
          body: raw.body,
          ask: raw.ask,
          scope: raw.scope,
          sceneIds,
          batchId: String(batch.id),
          createdAt: now,
        };

        writeBatch.set(noteRef, note);
        notes.push({
          id: noteRef.id,
          source: note.source,
          author: note.author,
          body: note.body,
          sceneIds,
          scope: raw.scope,
        });
      }
    }

    for (const b of batches) writeBatch.update(b.ref, { processed: true });

    // Note counts on the scene doc so cards can carry a badge without a listener
    // per scene.
    const perScene = new Map<string, number>();
    for (const n of notes) {
      for (const id of new Set(n.sceneIds)) perScene.set(id, (perScene.get(id) ?? 0) + 1);
    }
    for (const [sceneId, count] of perScene) {
      writeBatch.update(projectRef.collection('scenes').doc(sceneId), { noteCount: count });
    }

    // --- contradiction pass over notes sharing a scene ---
    // candidatePairs already ranks by overlap then authority.
    const pairs = candidatePairs(notes).slice(0, MAX_PAIRS);

    this.log.log(`notes: ${notes.length} notes, ${pairs.length} candidate pairs`);

    const settled = await Promise.allSettled(
      pairs.map(async (pair): Promise<JudgedConflict | null> => {
        const judged = await this.judgePair(pair.a, pair.b);
        if (!judged.contradicts) return null;
        return {
          conflict: {
            noteIdA: pair.a.id,
            noteIdB: pair.b.id,
            sceneIds: pair.sharedSceneIds,
            explanation: judged.explanation,
          },
          severity: conflictSeverity(pair.a.source, pair.b.source),
          sources: [pair.a.source, pair.b.source],
          authors: [pair.a.author, pair.b.author],
        };
      }),
    );

    const found: JudgedConflict[] = [];
    for (const outcome of settled) {
      if (outcome.status === 'rejected') {
        this.log.warn(`notes: pair comparison failed — ${outcome.reason}`);
        continue;
      }
      if (outcome.value) found.push(outcome.value);
    }

    const conflicts = dedupeConflicts(found.map((f) => f.conflict));
    const metaByKey = new Map(
      found.map((f) => [[f.conflict.noteIdA, f.conflict.noteIdB].sort().join('::'), f]),
    );

    for (const c of conflicts) {
      const meta = metaByKey.get([c.noteIdA, c.noteIdB].sort().join('::'));
      const ref = projectRef.collection('noteConflicts').doc();
      writeBatch.set(ref, {
        id: ref.id,
        ...c,
        severity: meta?.severity ?? 'warn',
        sources: meta?.sources ?? [],
        authors: meta?.authors ?? [],
        resolved: false,
        createdAt: now,
      });
    }

    await writeBatch.commit();
    this.log.log(`notes: ${conflicts.length} conflicts written`);
    return { notes: notes.length, conflicts: conflicts.length, unmapped };
  }

  private async mapNotes(body: string, sceneList: string): Promise<RawMapped[]> {
    const res = await this.gemini.ai.models.generateContent({
      model: MODELS.fast,
      contents: `SCENES:\n${sceneList}\n\nNOTES DOCUMENT:\n${body}`,
      config: {
        systemInstruction: MAPPING_SYSTEM,
        responseMimeType: 'application/json',
        responseSchema: MAPPING_SCHEMA,
        temperature: 0.1,
      },
    });
    const parsed = JSON.parse(res.text ?? '{}') as { notes?: RawMapped[] };
    return parsed.notes ?? [];
  }

  private async judgePair(a: MappedNote, b: MappedNote) {
    const res = await this.gemini.ai.models.generateContent({
      model: MODELS.fast,
      contents: JSON.stringify({
        noteA: { from: `${a.author} (${a.source})`, text: a.body },
        noteB: { from: `${b.author} (${b.source})`, text: b.body },
      }),
      config: {
        systemInstruction: CONFLICT_SYSTEM,
        responseMimeType: 'application/json',
        responseSchema: CONFLICT_SCHEMA,
        temperature: 0.1,
      },
    });
    return JSON.parse(res.text ?? '{}') as {
      contradicts: boolean;
      explanation: string;
    };
  }
}

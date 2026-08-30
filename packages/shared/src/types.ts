/**
 * Plotkraft domain model.
 *
 * Mirrors the Firestore layout in architecture.md §4 / workplan.md §4. The two
 * structural commitments that everything else depends on:
 *
 *   - Scenes carry stable IDs and a monotonic `version`.
 *   - Edges are stored as first-class documents, not derived on read. The stored
 *     edge list *is* the dependency map that the what-if dirty-subgraph walk uses.
 */

/** Parker/Stone "therefore / but" test, applied to every beat transition. */
export type TransitionType =
  /** Causal: the previous beat *causes* this one. Healthy connective tissue. */
  | 'therefore'
  /** Adversative: this beat complicates or reverses the previous one. Also healthy. */
  | 'but'
  /** Merely sequential — the weak joint the Story Logic agent flags. */
  | 'and_then';

export type FlagKind =
  | 'continuity'
  | 'causality'
  | 'research'
  | 'note_conflict'
  | 'orphaned_payoff';

export type FlagSeverity = 'info' | 'warn' | 'critical';

/** The writer is the final judge — every agent flag is accept/dismiss/disagree. */
export type FlagVerdict = 'pending' | 'accepted' | 'dismissed' | 'disagreed';

export interface Project {
  id: string;
  title: string;
  ownerUid: string;
  memberUids: string[];
  createdAt: number;
  updatedAt: number;
  /** Source format of the ingested script. */
  sourceFormat: 'fountain' | 'pdf';
}

export interface Scene {
  id: string;
  /** 0-based order in the script as ingested. Reordering changes this. */
  index: number;
  /** Slugline, e.g. "INT. DINER - NIGHT". */
  heading: string;
  /** Scene action/description text, newline-joined. */
  action: string;
  dialogue: DialogueLine[];
  /** Characters appearing in this scene, derived at parse time. */
  characters: string[];
  /** Canvas position. Moves are last-write-wins — harmless by design. */
  position: { x: number; y: number };
  /**
   * Optimistic concurrency guard. Edits run in a transaction that checks and
   * increments this; a mismatch surfaces "updated by X — review & retry".
   */
  version: number;
  /** Graph centrality, 0..1. Drives card weight and which scenes get Veo previz. */
  loadScore?: number;
  updatedAt: number;
}

export interface DialogueLine {
  character: string;
  /** Parenthetical wryly, e.g. "(quietly)". */
  parenthetical?: string;
  text: string;
}

export interface Edge {
  id: string;
  fromSceneId: string;
  toSceneId: string;
  type: TransitionType;
  /** One-line rationale from the Story Logic agent, shown on hover. */
  justification: string;
  /**
   * Gemini's edge labels are imperfect on a real 100-page script, so the writer
   * can correct one in a click. A confirmed edge is never re-labeled by an agent.
   */
  confirmedByWriter: boolean;
  createdAt: number;
}

export interface Flag {
  id: string;
  sceneId: string;
  kind: FlagKind;
  severity: FlagSeverity;
  message: string;
  /** Which agent raised this. */
  agent: string;
  /**
   * The scene `version` this flag was computed against. If the scene has moved on,
   * the UI renders "possibly stale — re-run" instead of pretending it's current.
   */
  analyzedVersion: number;
  verdict: FlagVerdict;
  citations?: Citation[];
  createdAt: number;
}

export interface Citation {
  url: string;
  title: string;
  excerpt?: string;
}

export interface Annotation {
  id: string;
  sceneId: string;
  authorUid: string;
  authorName: string;
  body: string;
  createdAt: number;
}

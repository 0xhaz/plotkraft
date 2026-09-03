'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  ViewportPortal,
  type Node,
  type NodeChange,
  type Edge as FlowEdge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  collection, doc, onSnapshot, orderBy, query, updateDoc, writeBatch,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { stalePanels, countStale } from '@/lib/staleness';
import {
  serpentinePosition, cascadeLayout, CARD_W, GAP_X, COLUMNS, LARGE_SCRIPT,
  type Act, type CascadeBand, type SequenceMeta,
} from '@/lib/layout';
import { SceneNode, type SceneNodeData } from './SceneNode';
import { EDGE_STYLE, TransitionEdge } from './TransitionEdge';
import {
  simulateCut,
  runCausality,
  runResearch,
  runStoryCircle,
  reconcileNotes,
  runCraftAnalysis,
  findSequences,
  generateBoards,
  type WhatIfImpact,
  type CircleResult,
} from '@/lib/whatIf';
import { ScenePanel, type SceneDetail } from './ScenePanel';
import { StoryCircle } from './StoryCircle';
import { NotesPanel } from './NotesPanel';

interface SceneDoc extends SceneDetail {
  position: { x: number; y: number };
  flagCount?: number;
  noteCount?: number;
  boardPath?: string;
  boardVersion?: number;
  shot?: { size: string; angle: string; movement: string };
}

interface EdgeDoc {
  id: string;
  fromSceneId: string;
  toSceneId: string;
  type: 'therefore' | 'but' | 'and_then';
  justification: string;
  confirmedByWriter: boolean;
}

const nodeTypes = { scene: SceneNode };
const edgeTypes = { transition: TransitionEdge };

export function Canvas({ projectId }: { projectId: string }) {
  const [scenes, setScenes] = useState<SceneDoc[]>([]);
  const [edgeDocs, setEdgeDocs] = useState<EdgeDoc[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [impact, setImpact] = useState<WhatIfImpact | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [circle, setCircle] = useState<CircleResult | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [byAct, setByAct] = useState(false);
  const [mode, setMode] = useState<'original' | 'reference'>('original');
  const [collapsed, setCollapsed] = useState<ReadonlySet<Act>>(new Set());
  const [autoGrouped, setAutoGrouped] = useState(false);
  const [sequences, setSequences] = useState<SequenceMeta[]>([]);
  const [collapsedSeqs, setCollapsedSeqs] = useState<ReadonlySet<number>>(new Set());

  useEffect(() => {
    setAccessDenied(false);

    // A listener without an error handler throws on permission-denied, and an
    // uncaught throw inside a snapshot callback surfaces as a crash rather than
    // as the ordinary "you cannot see this project" that it actually is.
    const onError = (err: { code?: string }) => {
      if (err.code === 'permission-denied') setAccessDenied(true);
      else console.error('[canvas] snapshot listener failed', err);
    };

    const unsubScenes = onSnapshot(
      query(collection(db(), 'projects', projectId, 'scenes'), orderBy('index')),
      (snap) => setScenes(snap.docs.map((d) => d.data() as SceneDoc)),
      onError,
    );
    const unsubProject = onSnapshot(
      doc(db(), 'projects', projectId),
      (snap) => {
        const data = snap.data();
        setMode(data?.mode === 'reference' ? 'reference' : 'original');
        setSequences((data?.sequences ?? []) as SequenceMeta[]);
      },
      onError,
    );
    const unsubEdges = onSnapshot(
      collection(db(), 'projects', projectId, 'edges'),
      (snap) => setEdgeDocs(snap.docs.map((d) => d.data() as EdgeDoc)),
      onError,
    );
    return () => {
      unsubScenes();
      unsubEdges();
      unsubProject();
    };
  }, [projectId]);

  const toggleSelected = useCallback((id: string) => {
    setImpact(null);
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const runWhatIf = async () => {
    if (!selected.length) return;
    setBusy('what-if');
    setError(null);
    try {
      setImpact(await simulateCut(projectId, selected));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'what-if failed');
    } finally {
      setBusy(null);
    }
  };

  const runStoryLogic = async () => {
    setBusy('causality');
    setError(null);
    try {
      await runCausality(projectId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'causality failed');
    } finally {
      setBusy(null);
    }
  };

  const runResearcher = async () => {
    setBusy('research');
    setError(null);
    try {
      await runResearch(projectId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'research failed');
    } finally {
      setBusy(null);
    }
  };

  const runCircle = async () => {
    setBusy('circle');
    setError(null);
    try {
      setCircle(await runStoryCircle(projectId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'story circle failed');
    } finally {
      setBusy(null);
    }
  };

  const runSequences = async () => {
    setBusy('sequences');
    setError(null);
    try {
      await findSequences(projectId);
      setByAct(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'sequence pass failed');
    } finally {
      setBusy(null);
    }
  };

  /** Board a scope: the selected scenes if any, otherwise the whole script. */
  const runBoards = async () => {
    setBusy('boards');
    setError(null);
    try {
      const res = await generateBoards(
        projectId,
        selected.length > 0 ? { sceneIds: selected } : { panels: 8 },
      );
      if (res.failed > 0) {
        setError(`${res.drawn} of ${res.requested} panels drawn — the image model rate-limited the rest. Run again to fill the gaps.`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'boarding failed');
    } finally {
      setBusy(null);
    }
  };

  const runCraft = async () => {
    setBusy('craft');
    setError(null);
    try {
      await runCraftAnalysis(projectId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'craft analysis failed');
    } finally {
      setBusy(null);
    }
  };

  const runReconcile = async () => {
    setBusy('notes');
    setError(null);
    try {
      await reconcileNotes(projectId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'reconcile failed');
    } finally {
      setBusy(null);
    }
  };

  const clear = () => {
    setSelected([]);
    setImpact(null);
    setError(null);
  };

  /** Impact classification per scene — drives the card's colour during a simulation. */
  const impactFor = useMemo(() => {
    const m = new Map<string, 'cut' | 'orphaned' | 'dirty'>();
    if (!impact) return m;
    for (const id of impact.dirtySceneIds) m.set(id, 'dirty');
    for (const o of impact.orphanedPayoffs) m.set(o.sceneId, 'orphaned');
    for (const id of selected) m.set(id, 'cut');
    return m;
  }, [impact, selected]);

  const deltaFor = useMemo(
    () => new Map((impact?.loadDeltas ?? []).map((d) => [d.sceneId, d])),
    [impact],
  );

  /**
   * Act grouping is a view, not a stored layout: it overrides positions on screen
   * without writing to Firestore, so switching back restores the writer's own
   * arrangement of the board rather than destroying it.
   */
  /**
   * Acts as a descending staircase, each a single line of scenes.
   *
   * The grid put consecutive scenes on different rows, so the causal edge
   * between them wrapped across the board and the whole thing read as a tangle.
   * Here the script runs left to right within an act, every therefore and but
   * joins two neighbours, and the shape of the board is the shape of the film.
   */
  const cascade = useMemo(
    () =>
      byAct
        ? cascadeLayout(
            scenes.map((s) => ({
              id: s.id,
              index: s.index,
              circleStep: s.circleStep,
              boarded: Boolean(s.boardPath),
            })),
            collapsed,
          )
        : null,
    [byAct, scenes, collapsed],
  );

  const acts = cascade;

  // Sequences start closed. Ten shut rows is the point of having them; opening
  // all ten would put the writer back in front of 244 cards.
  useEffect(() => {
    if (sequences.length > 0) {
      setCollapsedSeqs(new Set(sequences.map((q) => q.order)));
    }
  }, [sequences]);

  const toggleSeq = useCallback((order: number) => {
    setCollapsedSeqs((prev) => {
      const next = new Set(prev);
      if (next.has(order)) next.delete(order);
      else next.add(order);
      return next;
    });
  }, []);

  /**
   * Open grouped as soon as the acts are known.
   *
   * The trigger used to be script length, which meant a short script landed on
   * the ungrouped board — scenes at their stored positions, consecutive beats on
   * different rows, every causal edge wrapping across the canvas. That tangle was
   * the first thing a writer saw, with the layout that fixes it behind a toggle.
   * The real precondition is not size, it is whether Story Circle has run: acts
   * are what there is to group by. Applied once, so a later choice sticks.
   */
  const actsKnown = useMemo(() => scenes.some((s) => s.circleStep), [scenes]);

  useEffect(() => {
    if (!autoGrouped && (actsKnown || scenes.length > LARGE_SCRIPT)) {
      setByAct(true);
      setAutoGrouped(true);
    }
  }, [actsKnown, scenes.length, autoGrouped]);

  const toggleAct = useCallback((act: Act) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(act)) next.delete(act);
      else next.add(act);
      return next;
    });
  }, []);

  /** Which panels the last rewrite invalidated — see lib/staleness.ts. */
  const stale = useMemo(
    () =>
      stalePanels(
        scenes.map((s) => ({
          id: s.id,
          version: s.version ?? 1,
          boardVersion: s.boardVersion,
          boardPath: s.boardPath,
        })),
        edgeDocs.map((e) => ({
          fromSceneId: e.fromSceneId,
          toSceneId: e.toSceneId,
          type: e.type,
        })),
      ),
    [scenes, edgeDocs],
  );

  const staleCount = useMemo(() => countStale(stale), [stale]);
  const boardedCount = useMemo(() => scenes.filter((s) => s.boardPath).length, [scenes]);

  const derivedNodes: Node<SceneNodeData>[] = useMemo(
    () =>
      scenes
        .filter((s) => !acts?.hidden.has(s.id))
        .map((s) => ({
        id: s.id,
        type: 'scene',
        // Bands are drawn in the same viewport layer and would otherwise paint
        // over the cards, veiling the text and swallowing selection.
        zIndex: 10,
        position: acts?.positions.get(s.id) ?? s.position ?? { x: 0, y: 0 },
        data: {
          heading: s.heading,
          characters: s.characters ?? [],
          loadScore: s.loadScore ?? 0,
          flagCount: s.flagCount ?? 0,
          noteCount: s.noteCount ?? 0,
          status: mode === 'original' ? (s.status ?? 'draft') : undefined,
          boardPath: s.boardPath,
          boardStale: stale.has(s.id),
          shotSlug: s.shot
            ? [s.shot.size, s.shot.angle, s.shot.movement !== 'static' ? s.shot.movement : null]
                .filter(Boolean)
                .join(' · ')
            : undefined,
          impact: impactFor.get(s.id) ?? null,
          selected: selected.includes(s.id),
          loadDelta: deltaFor.get(s.id),
        },
      })),
    [scenes, impactFor, selected, deltaFor, acts, mode, stale],
  );

  // React Flow needs to own node state for dragging to do anything. Firestore
  // remains the source of truth: it seeds this state and every drag is written
  // back, so a reload and a collaborator both see where the card ended up.
  const [nodes, setNodes, onNodesChangeInternal] = useNodesState<Node<SceneNodeData>>([]);

  useEffect(() => {
    setNodes((current) => {
      const dragging = new Set(current.filter((n) => n.dragging).map((n) => n.id));
      const byId = new Map(current.map((n) => [n.id, n]));
      return derivedNodes.map((n) =>
        // Never yank a card out from under the pointer mid-drag.
        dragging.has(n.id) ? { ...n, position: byId.get(n.id)!.position } : n,
      );
    });
  }, [derivedNodes, setNodes]);

  const onNodesChange = useCallback(
    (changes: NodeChange<Node<SceneNodeData>>[]) => onNodesChangeInternal(changes),
    [onNodesChangeInternal],
  );

  /** Card moves are last-write-wins by design, so this is a plain field update. */
  const persistPosition = useCallback(
    async (sceneId: string, position: { x: number; y: number }) => {
      try {
        await updateDoc(doc(db(), 'projects', projectId, 'scenes', sceneId), { position });
      } catch (e) {
        console.error('[canvas] could not save card position', e);
      }
    },
    [projectId],
  );

  /** Put the board back in reading order when it gets messy. */
  const tidy = useCallback(async () => {
    const batch = writeBatch(db());
    scenes.forEach((s, i) => {
      batch.update(doc(db(), 'projects', projectId, 'scenes', s.id), {
        position: serpentinePosition(i),
      });
    });
    try {
      await batch.commit();
    } catch (e) {
      console.error('[canvas] could not tidy layout', e);
    }
  }, [scenes, projectId]);

  // The detail panel shows a single scene; multi-select is for cut simulation.
  const detailScene = selected.length === 1 ? scenes.find((s) => s.id === selected[0]) : undefined;

  const brokenEdges = useMemo(() => new Set(impact?.brokenEdgeIds ?? []), [impact]);

  const edges: FlowEdge[] = useMemo(
    () =>
      edgeDocs.map((e) => {
        const broken = brokenEdges.has(e.id);
        return {
          id: e.id,
          source: e.fromSceneId,
          target: e.toSceneId,
          type: 'transition',
          label: e.type === 'and_then' ? 'and then' : e.type,
          data: { justification: e.justification, confirmed: e.confirmedByWriter, kind: e.type },
          style: broken
            ? { stroke: '#e05252', strokeWidth: 2, strokeDasharray: '3 3', opacity: 0.75 }
            : EDGE_STYLE[e.type],
        };
      }),
    [edgeDocs, brokenEdges],
  );

  if (accessDenied) {
    return (
      <div style={D.wrap}>
        <div style={D.title}>You don&apos;t have access to this project</div>
        <p style={D.body}>
          It may belong to another account, or it may no longer exist. Projects are visible
          only to their members.
        </p>
        <a href="/new" style={D.link}>Start a new project</a>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onNodeClick={(_, node) => toggleSelected(node.id)}
        onNodeDragStop={(_, node) => {
          if (!byAct) void persistPosition(node.id, node.position);
        }}
        nodesDraggable={!byAct}
        fitView
      >
        <Background color="#2a2f38" gap={20} />
        {acts && <Bands bands={acts.bands} onToggle={toggleAct} />}
        <Controls />
        <MiniMap
          pannable
          zoomable
          nodeColor={(n) => {
            const d = n.data as SceneNodeData;
            if (d?.impact === 'orphaned') return '#e05252';
            if (d?.impact === 'dirty') return '#c9902f';
            const score = d?.loadScore ?? 0;
            return score >= 0.66 ? '#e05252' : score >= 0.33 ? '#c9902f' : '#3d4450';
          }}
          style={{ background: '#12151a' }}
        />
      </ReactFlow>

      <Inspector
        sceneCount={scenes.length}
        edgeCount={edgeDocs.length}
        selected={selected}
        impact={impact}
        busy={busy}
        error={error}
        onWhatIf={runWhatIf}
        onCausality={runStoryLogic}
        onResearch={runResearcher}
        onCircle={runCircle}
        mode={mode}
        onCraft={runCraft}
        onSequences={runSequences}
        onBoards={runBoards}
        boardedCount={boardedCount}
        staleDirect={staleCount.direct}
        staleUpstream={staleCount.upstream}
        sequenceCount={sequences.length}
        onNotes={() => { setNotesOpen(true); setCircle(null); }}
        onTidy={tidy}
        byAct={byAct}
        onCollapseAll={() => setCollapsed(new Set<Act>([1, 2, 3, 0]))}
        onExpandAll={() => setCollapsed(new Set<Act>())}
        onToggleAct={() => setByAct((v) => !v)}
        onClear={clear}
      />

      {notesOpen && (
        <NotesPanel
          projectId={projectId}
          busy={busy === 'notes'}
          onReconcile={runReconcile}
          onClose={() => setNotesOpen(false)}
        />
      )}

      {circle && !notesOpen && (
        <StoryCircle
          shares={circle.shares}
          diagnostics={circle.diagnostics}
          goThreshold={circle.goThreshold}
          onClose={() => setCircle(null)}
        />
      )}

      {detailScene && !circle && !notesOpen && (
        <ScenePanel
          projectId={projectId}
          mode={mode}
          scene={{
            ...detailScene,
            action: detailScene.action ?? '',
            dialogue: detailScene.dialogue ?? [],
            characters: detailScene.characters ?? [],
            version: detailScene.version ?? 1,
          }}
          onClose={() => setSelected([])}
        />
      )}
    </div>
  );
}

/** Labelled lanes behind the cards, drawn in canvas coordinates. */
function Bands({ bands, onToggle }: { bands: CascadeBand[]; onToggle: (act: Act) => void }) {
  return (
    <ViewportPortal>
      {bands.map((b) => (
        <div
          key={`act-${b.act}`}
          style={{
            position: 'absolute',
            transform: `translate(${b.x - 20}px, ${b.y}px)`,
            width: b.width + 40,
            height: b.height,
            border: `1px solid ${b.act === 0 ? '#2a2f38' : '#243040'}`,
            borderRadius: 14,
            background: b.act === 0 ? '#14161a' : '#121821',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        >
          <button
            onClick={() => onToggle(b.act)}
            style={{
              // Only the header takes clicks; the lane must not swallow
              // interaction with the cards inside it.
              pointerEvents: 'all',
              display: 'flex', alignItems: 'center', gap: 10,
              background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
              padding: '13px 18px', fontSize: 12.5, fontWeight: 600, letterSpacing: 0.4,
              color: b.act === 0 ? '#6b7280' : '#7aa2e3', whiteSpace: 'nowrap',
              fontFamily: 'ui-sans-serif, system-ui, sans-serif',
            }}
          >
            <span style={{ fontSize: 10, opacity: 0.8 }}>{b.collapsed ? '▶' : '▼'}</span>
            {b.label}
            <span style={{ color: '#6b7280', fontWeight: 400 }}>
              {b.sceneIds.length} scene{b.sceneIds.length === 1 ? '' : 's'}
              {b.collapsed ? ' · hidden' : ''}
            </span>
          </button>
        </div>
      ))}
    </ViewportPortal>
  );
}

function Inspector(props: {
  sceneCount: number;
  edgeCount: number;
  selected: string[];
  impact: WhatIfImpact | null;
  busy: string | null;
  error: string | null;
  onWhatIf: () => void;
  onCausality: () => void;
  onResearch: () => void;
  onCircle: () => void;
  mode: 'original' | 'reference';
  onCraft: () => void;
  onSequences: () => void;
  sequenceCount: number;
  onBoards: () => void;
  boardedCount: number;
  staleDirect: number;
  staleUpstream: number;
  onNotes: () => void;
  onTidy: () => void;
  byAct: boolean;
  onToggleAct: () => void;
  onCollapseAll: () => void;
  onExpandAll: () => void;
  onClear: () => void;
}) {
  const { impact } = props;
  return (
    <aside style={P.panel}>
      <div style={P.stat}>
        {props.mode === 'reference' && (
          <span style={{ color: '#7fb98f' }}>reference · </span>
        )}
        {props.sceneCount} scenes · {props.edgeCount} transitions
      </div>

      <button onClick={props.onCausality} disabled={props.busy !== null} style={P.button}>
        {props.busy === 'causality' ? 'Analyzing…' : 'Run Story Logic'}
      </button>

      <button
        onClick={props.onBoards}
        disabled={props.busy !== null}
        style={{ ...P.button, background: '#7a4bbf' }}
      >
        {props.busy === 'boards'
          ? 'Drawing…'
          : props.selected.length > 0
            ? `Board ${props.selected.length} selected`
            : props.boardedCount > 0
              ? `Re-board (${props.boardedCount} drawn)`
              : 'Draw storyboard'}
      </button>

      {(props.staleDirect > 0 || props.staleUpstream > 0) && (
        <div style={P.stale}>
          {props.staleDirect > 0 && (
            <div><strong style={{ color: '#f08a8a' }}>{props.staleDirect}</strong> panel{props.staleDirect === 1 ? '' : 's'} out of date — the scene was rewritten</div>
          )}
          {props.staleUpstream > 0 && (
            <div style={{ marginTop: 3 }}><strong style={{ color: '#d08a3e' }}>{props.staleUpstream}</strong> still accurate, but the story upstream changed</div>
          )}
        </div>
      )}

      <button
        onClick={props.onSequences}
        disabled={props.busy !== null}
        style={{ ...P.button, background: '#4a5a8f' }}
      >
        {props.busy === 'sequences'
          ? 'Segmenting…'
          : props.sequenceCount > 0
            ? `Re-find sequences (${props.sequenceCount})`
            : 'Find sequences'}
      </button>

      <button
        onClick={props.onCircle}
        disabled={props.busy !== null}
        style={{ ...P.button, background: '#5a4bbf' }}
      >
        {props.busy === 'circle' ? 'Mapping…' : 'Run Story Circle'}
      </button>

      {props.mode === 'reference' && (
        <button
          onClick={props.onCraft}
          disabled={props.busy !== null}
          style={{ ...P.button, background: '#2f6f4e' }}
        >
          {props.busy === 'craft' ? 'Reading…' : 'What makes it work'}
        </button>
      )}

      <button
        onClick={props.onNotes}
        disabled={props.busy !== null}
        style={{ ...P.button, background: '#b06a2f' }}
      >
        Notes &amp; conflicts
      </button>

      <button
        onClick={props.onResearch}
        disabled={props.busy !== null}
        style={{ ...P.button, background: '#2f6f5e' }}
      >
        {props.busy === 'research' ? 'Fact-checking…' : 'Run Researcher'}
      </button>

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={props.onToggleAct}
          style={{ ...P.button, background: props.byAct ? '#3b6fd4' : '#2a2f38', flex: 1 }}
        >
          {props.byAct ? 'Grouped by act' : 'Group by act'}
        </button>
        <button
          onClick={props.onTidy}
          disabled={props.busy !== null || props.byAct}
          style={{ ...P.button, background: '#2a2f38', opacity: props.byAct ? 0.4 : 1 }}
        >
          Tidy
        </button>
      </div>

      {props.byAct && (
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={props.onCollapseAll} style={{ ...P.button, background: '#22272f', flex: 1, fontWeight: 400 }}>
            Collapse all
          </button>
          <button onClick={props.onExpandAll} style={{ ...P.button, background: '#22272f', flex: 1, fontWeight: 400 }}>
            Expand all
          </button>
        </div>
      )}

      <div style={P.hint}>
        {props.selected.length === 0
          ? 'Click scenes to select them, then simulate a cut.'
          : `${props.selected.length} scene${props.selected.length === 1 ? '' : 's'} selected`}
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={props.onWhatIf}
          disabled={!props.selected.length || props.busy !== null}
          style={{ ...P.button, background: '#8c3b3b', flex: 1 }}
        >
          {props.busy === 'what-if' ? 'Simulating…' : 'Simulate cut'}
        </button>
        {(props.selected.length > 0 || impact) && (
          <button onClick={props.onClear} style={{ ...P.button, background: '#2a2f38' }}>
            Reset
          </button>
        )}
      </div>

      {props.error && <div style={P.error}>{props.error}</div>}

      {impact && (
        <div style={P.results}>
          <Row label="Downstream to re-check" value={impact.dirtySceneIds.length} tone="#e0a252" />
          <Row label="Orphaned payoffs" value={impact.orphanedPayoffs.length} tone="#f08a8a" />
          <Row label="Broken transitions" value={impact.brokenEdgeIds.length} tone="#f08a8a" />
          {impact.unexplainedCharacters.length > 0 && (
            <div style={P.warnBlock}>
              Unexplained on screen:{' '}
              {impact.unexplainedCharacters.map((c) => c.character).join(', ')}
            </div>
          )}
          {impact.dirtySceneIds.length === 0 &&
            impact.orphanedPayoffs.length === 0 && (
              <div style={{ ...P.hint, color: '#7fb98f' }}>
                Nothing downstream depends on this. Safe to cut.
              </div>
            )}
        </div>
      )}
    </aside>
  );
}

function Row({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '3px 0' }}>
      <span style={{ color: '#9aa4b2' }}>{label}</span>
      <span style={{ color: value > 0 ? tone : '#6b7280', fontWeight: 600 }}>{value}</span>
    </div>
  );
}

const D: Record<string, React.CSSProperties> = {
  wrap: {
    height: '100%', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24,
    fontFamily: 'ui-sans-serif, system-ui, sans-serif', textAlign: 'center',
  },
  title: { color: '#e8eaed', fontSize: 16, fontWeight: 600 },
  body: { color: '#8b95a3', fontSize: 13, lineHeight: 1.6, maxWidth: 420, margin: 0 },
  link: { color: '#7aa2e3', fontSize: 13, marginTop: 4 },
};

const P: Record<string, React.CSSProperties> = {
  panel: {
    position: 'absolute', top: 12, right: 12, width: 260, zIndex: 5,
    background: '#12151aee', border: '1px solid #222831', borderRadius: 10,
    padding: 14, display: 'flex', flexDirection: 'column', gap: 10,
    fontFamily: 'ui-sans-serif, system-ui, sans-serif',
    backdropFilter: 'blur(6px)',
  },
  stat: { color: '#9aa4b2', fontSize: 11, letterSpacing: 0.3 },
  button: {
    background: '#3b6fd4', color: '#fff', border: 'none', borderRadius: 7,
    padding: '8px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
  },
  hint: { color: '#9aa4b2', fontSize: 11, lineHeight: 1.5 },
  stale: {
    background: '#1a1418', border: '1px solid #33222a', borderRadius: 7,
    padding: '8px 10px', fontSize: 11, lineHeight: 1.5, color: '#c7cdd6',
  },
  error: { color: '#e07070', fontSize: 11, lineHeight: 1.45 },
  results: { borderTop: '1px solid #222831', paddingTop: 8 },
  warnBlock: { color: '#f0b48a', fontSize: 11, marginTop: 6, lineHeight: 1.45 },
};

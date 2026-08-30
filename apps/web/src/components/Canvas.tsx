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
import { collection, doc, onSnapshot, orderBy, query, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { serpentinePosition, actLayout, CARD_W, GAP_X, COLUMNS, type ActBand } from '@/lib/layout';
import { SceneNode, type SceneNodeData } from './SceneNode';
import { EDGE_STYLE, TransitionEdge } from './TransitionEdge';
import {
  simulateCut,
  runCausality,
  runResearch,
  runStoryCircle,
  reconcileNotes,
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
    const unsubEdges = onSnapshot(
      collection(db(), 'projects', projectId, 'edges'),
      (snap) => setEdgeDocs(snap.docs.map((d) => d.data() as EdgeDoc)),
      onError,
    );
    return () => {
      unsubScenes();
      unsubEdges();
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
  const acts = useMemo(
    () => (byAct ? actLayout(scenes.map((s) => ({ id: s.id, index: s.index, circleStep: s.circleStep }))) : null),
    [byAct, scenes],
  );

  const derivedNodes: Node<SceneNodeData>[] = useMemo(
    () =>
      scenes.map((s) => ({
        id: s.id,
        type: 'scene',
        position: acts?.positions.get(s.id) ?? s.position ?? { x: 0, y: 0 },
        data: {
          heading: s.heading,
          characters: s.characters ?? [],
          loadScore: s.loadScore ?? 0,
          flagCount: s.flagCount ?? 0,
          noteCount: s.noteCount ?? 0,
          impact: impactFor.get(s.id) ?? null,
          selected: selected.includes(s.id),
          loadDelta: deltaFor.get(s.id),
        },
      })),
    [scenes, impactFor, selected, deltaFor, acts],
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
        {acts && <ActBands bands={acts.bands} />}
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
        onNotes={() => { setNotesOpen(true); setCircle(null); }}
        onTidy={tidy}
        byAct={byAct}
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

/** Labelled regions behind the cards, drawn in canvas coordinates. */
function ActBands({ bands }: { bands: ActBand[] }) {
  const width = COLUMNS * (CARD_W + GAP_X) - GAP_X + 48;
  return (
    <ViewportPortal>
      {bands.map((b) => (
        <div
          key={b.act}
          style={{
            position: 'absolute',
            transform: `translate(-24px, ${b.y}px)`,
            width,
            height: b.height,
            border: `1px solid ${b.act === 0 ? '#2a2f38' : '#243040'}`,
            borderRadius: 14,
            background: b.act === 0 ? '#14161acc' : '#121821cc',
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              padding: '13px 18px',
              fontSize: 12.5,
              fontWeight: 600,
              letterSpacing: 0.4,
              color: b.act === 0 ? '#6b7280' : '#7aa2e3',
              fontFamily: 'ui-sans-serif, system-ui, sans-serif',
            }}
          >
            {b.label}
            <span style={{ color: '#6b7280', fontWeight: 400 }}>
              {' '}· {b.sceneIds.length} scene{b.sceneIds.length === 1 ? '' : 's'}
            </span>
          </div>
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
  onNotes: () => void;
  onTidy: () => void;
  byAct: boolean;
  onToggleAct: () => void;
  onClear: () => void;
}) {
  const { impact } = props;
  return (
    <aside style={P.panel}>
      <div style={P.stat}>
        {props.sceneCount} scenes · {props.edgeCount} transitions
      </div>

      <button onClick={props.onCausality} disabled={props.busy !== null} style={P.button}>
        {props.busy === 'causality' ? 'Analyzing…' : 'Run Story Logic'}
      </button>

      <button
        onClick={props.onCircle}
        disabled={props.busy !== null}
        style={{ ...P.button, background: '#5a4bbf' }}
      >
        {props.busy === 'circle' ? 'Mapping…' : 'Run Story Circle'}
      </button>

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
  error: { color: '#e07070', fontSize: 11, lineHeight: 1.45 },
  results: { borderTop: '1px solid #222831', paddingTop: 8 },
  warnBlock: { color: '#f0b48a', fontSize: 11, marginTop: 6, lineHeight: 1.45 },
};

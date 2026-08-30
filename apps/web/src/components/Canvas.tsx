'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge as FlowEdge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { SceneNode, type SceneNodeData } from './SceneNode';
import { EDGE_STYLE, TransitionEdge } from './TransitionEdge';
import {
  simulateCut,
  runCausality,
  runResearch,
  runStoryCircle,
  type WhatIfImpact,
  type CircleResult,
} from '@/lib/whatIf';
import { ScenePanel } from './ScenePanel';
import { StoryCircle } from './StoryCircle';

interface SceneDoc {
  id: string;
  index: number;
  heading: string;
  characters: string[];
  position: { x: number; y: number };
  loadScore?: number;
  version: number;
  flagCount?: number;
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

  useEffect(() => {
    const unsubScenes = onSnapshot(
      query(collection(db(), 'projects', projectId, 'scenes'), orderBy('index')),
      (snap) => setScenes(snap.docs.map((d) => d.data() as SceneDoc)),
    );
    const unsubEdges = onSnapshot(collection(db(), 'projects', projectId, 'edges'), (snap) =>
      setEdgeDocs(snap.docs.map((d) => d.data() as EdgeDoc)),
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

  const nodes: Node<SceneNodeData>[] = useMemo(
    () =>
      scenes.map((s) => ({
        id: s.id,
        type: 'scene',
        position: s.position ?? { x: 0, y: 0 },
        data: {
          heading: s.heading,
          characters: s.characters ?? [],
          loadScore: s.loadScore ?? 0,
          flagCount: s.flagCount ?? 0,
          impact: impactFor.get(s.id) ?? null,
          selected: selected.includes(s.id),
          loadDelta: deltaFor.get(s.id),
        },
      })),
    [scenes, impactFor, selected, deltaFor],
  );

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

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={(_, node) => toggleSelected(node.id)}
        fitView
      >
        <Background color="#2a2f38" gap={20} />
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
        onClear={clear}
      />

      {circle && (
        <StoryCircle
          shares={circle.shares}
          diagnostics={circle.diagnostics}
          goThreshold={circle.goThreshold}
          onClose={() => setCircle(null)}
        />
      )}

      {detailScene && !circle && (
        <ScenePanel
          projectId={projectId}
          sceneId={detailScene.id}
          heading={detailScene.heading}
          characters={detailScene.characters ?? []}
          loadScore={detailScene.loadScore ?? 0}
          sceneVersion={detailScene.version ?? 1}
          onClose={() => setSelected([])}
        />
      )}
    </div>
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
        onClick={props.onResearch}
        disabled={props.busy !== null}
        style={{ ...P.button, background: '#2f6f5e' }}
      >
        {props.busy === 'research' ? 'Fact-checking…' : 'Run Researcher'}
      </button>

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

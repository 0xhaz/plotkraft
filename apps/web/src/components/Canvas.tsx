'use client';

import { useEffect, useMemo, useState } from 'react';
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

interface SceneDoc {
  id: string;
  index: number;
  heading: string;
  characters: string[];
  position: { x: number; y: number };
  loadScore?: number;
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

/**
 * The canvas subscribes to Firestore directly rather than polling the API.
 * Live listeners are what keep every collaborator's view seconds-fresh, which is
 * how most conflicts are avoided in the first place (architecture.md §4).
 */
export function Canvas({ projectId }: { projectId: string }) {
  const [scenes, setScenes] = useState<SceneDoc[]>([]);
  const [edgeDocs, setEdgeDocs] = useState<EdgeDoc[]>([]);

  useEffect(() => {
    const unsubScenes = onSnapshot(
      query(collection(db(), 'projects', projectId, 'scenes'), orderBy('index')),
      (snap) => setScenes(snap.docs.map((d) => d.data() as SceneDoc)),
    );
    const unsubEdges = onSnapshot(
      collection(db(), 'projects', projectId, 'edges'),
      (snap) => setEdgeDocs(snap.docs.map((d) => d.data() as EdgeDoc)),
    );
    return () => {
      unsubScenes();
      unsubEdges();
    };
  }, [projectId]);

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
          flagCount: 0,
        },
      })),
    [scenes],
  );

  const edges: FlowEdge[] = useMemo(
    () =>
      edgeDocs.map((e) => ({
        id: e.id,
        source: e.fromSceneId,
        target: e.toSceneId,
        type: 'transition',
        label: e.type === 'and_then' ? 'and then' : e.type,
        data: { justification: e.justification, confirmed: e.confirmedByWriter, kind: e.type },
        style: EDGE_STYLE[e.type],
      })),
    [edgeDocs],
  );

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        proOptions={{ hideAttribution: false }}
      >
        <Background color="#2a2f38" gap={20} />
        <Controls />
        <MiniMap
          pannable
          zoomable
          nodeColor={(n) => {
            const score = (n.data as SceneNodeData)?.loadScore ?? 0;
            return score >= 0.66 ? '#e05252' : score >= 0.33 ? '#c9902f' : '#3d4450';
          }}
          style={{ background: '#12151a' }}
        />
      </ReactFlow>
    </div>
  );
}

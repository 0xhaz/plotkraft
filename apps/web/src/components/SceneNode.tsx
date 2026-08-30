'use client';

import { Handle, Position, type NodeProps } from '@xyflow/react';

export interface SceneNodeData extends Record<string, unknown> {
  heading: string;
  characters: string[];
  /** 0..1 graph centrality — drives the card's visual weight. */
  loadScore: number;
  flagCount: number;
}

/**
 * Load-bearing scenes are visually heavier (design.md §3): the writer should be
 * able to see, without reading, which beats the story hangs on.
 */
function loadStyle(score: number) {
  if (score >= 0.66) return { border: '#e05252', bg: '#2a1618', label: 'load-bearing' };
  if (score >= 0.33) return { border: '#c9902f', bg: '#241d12', label: 'supporting' };
  return { border: '#3d4450', bg: '#171a1f', label: 'light' };
}

export function SceneNode({ data }: NodeProps) {
  const d = data as SceneNodeData;
  const s = loadStyle(d.loadScore ?? 0);

  return (
    <div
      style={{
        width: 260,
        border: `1px solid ${s.border}`,
        background: s.bg,
        borderRadius: 10,
        padding: '10px 12px',
        color: '#e8eaed',
        fontSize: 12,
        lineHeight: 1.45,
      }}
    >
      <Handle type="target" position={Position.Left} />
      <div style={{ fontWeight: 600, letterSpacing: 0.2, marginBottom: 6 }}>{d.heading}</div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: '#9aa4b2', fontSize: 11 }}>
        <span>{s.label}</span>
        {d.characters?.length > 0 && <span>· {d.characters.slice(0, 3).join(', ')}</span>}
        {d.flagCount > 0 && (
          <span style={{ marginLeft: 'auto', color: '#e0a252' }}>{d.flagCount} flag{d.flagCount === 1 ? '' : 's'}</span>
        )}
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

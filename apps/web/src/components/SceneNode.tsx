'use client';

import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useBoardUrl } from '@/lib/useBoardUrl';

export interface SceneNodeData extends Record<string, unknown> {
  heading: string;
  characters: string[];
  /** 0..1 graph centrality — drives the card's visual weight. */
  loadScore: number;
  flagCount: number;
  noteCount?: number;
  status?: 'draft' | 'developing' | 'confirmed';
  boardPath?: string;
  shotSlug?: string;
  boardStale?: boolean;
  /** What-if state: how this scene is affected by the simulated cut. */
  impact?: 'cut' | 'orphaned' | 'dirty' | null;
  selected?: boolean;
  loadDelta?: { before: number; after: number };
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

/** What-if overrides the load palette — during a simulation, impact is the story. */
const IMPACT_STYLE = {
  cut: { border: '#7a3030', bg: '#1a0f10', tag: 'cut', tagColor: '#c96a6a' },
  orphaned: { border: '#e05252', bg: '#2a1618', tag: 'payoff orphaned', tagColor: '#f08a8a' },
  dirty: { border: '#c9902f', bg: '#241d12', tag: 'needs re-check', tagColor: '#e0a252' },
} as const;

/** Draft state reads as a spine down the left edge of the card. */
const STATUS_COLOR = {
  draft: '#4a5260',
  developing: '#d08a3e',
  confirmed: '#4f9d69',
} as const;

export function SceneNode({ data }: NodeProps) {
  const d = data as SceneNodeData;
  const boardUrl = useBoardUrl(d.boardPath);
  const base = loadStyle(d.loadScore ?? 0);
  const impact = d.impact ? IMPACT_STYLE[d.impact] : null;
  const s = impact ?? base;

  return (
    <div
      style={{
        width: 260,
        border: `1px solid ${d.selected ? '#7aa2e3' : s.border}`,
        borderLeft: d.status
          ? `4px solid ${STATUS_COLOR[d.status]}`
          : `1px solid ${d.selected ? '#7aa2e3' : s.border}`,
        boxShadow: d.selected ? '0 0 0 2px rgba(122,162,227,.35)' : undefined,
        background: s.bg,
        borderRadius: 10,
        padding: '10px 12px',
        color: '#e8eaed',
        fontSize: 12,
        lineHeight: 1.45,
        opacity: d.impact === 'cut' ? 0.5 : 1,
        transition: 'border-color .18s, background .18s, opacity .18s',
      }}
    >
      <Handle type="target" position={Position.Left} />
      <div style={{ fontWeight: 600, letterSpacing: 0.2, marginBottom: 6 }}>{d.heading}</div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: '#9aa4b2', fontSize: 11 }}>
        <span style={impact ? { color: impact.tagColor, fontWeight: 600 } : undefined}>
          {impact ? impact.tag : base.label}
        </span>
        {d.characters?.length > 0 && <span>· {d.characters.slice(0, 3).join(', ')}</span>}
        {d.loadDelta && (
          <span style={{ marginLeft: 'auto', color: '#9aa4b2' }}>
            load {d.loadDelta.before} → {d.loadDelta.after}
          </span>
        )}
        {!d.loadDelta && (d.flagCount > 0 || (d.noteCount ?? 0) > 0) && (
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            {d.flagCount > 0 && (
              <span style={{ color: '#e0a252' }}>{d.flagCount} flag{d.flagCount === 1 ? '' : 's'}</span>
            )}
            {(d.noteCount ?? 0) > 0 && (
              <span style={{ color: '#c98a4a' }}>{d.noteCount} note{d.noteCount === 1 ? '' : 's'}</span>
            )}
          </span>
        )}
      </div>
      {boardUrl && (
        <div style={{ marginTop: 8, position: 'relative' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={boardUrl}
            alt=""
            style={{
              width: '100%', display: 'block', borderRadius: 5,
              // A stale panel is dimmed rather than hidden: it is still the
              // best picture of the scene, it just predates the rewrite.
              opacity: d.boardStale ? 0.4 : 1,
              filter: d.boardStale ? 'grayscale(1)' : undefined,
            }}
          />
          {d.boardStale && (
            <div style={{
              position: 'absolute', top: 5, left: 5, background: '#2a1618ee',
              color: '#f08a8a', fontSize: 8.5, padding: '2px 6px', borderRadius: 4,
              letterSpacing: 0.3,
            }}>
              story changed
            </div>
          )}
          {d.shotSlug && (
            <div style={{ marginTop: 4, color: '#8b95a3', fontSize: 9, letterSpacing: 0.3 }}>
              {d.shotSlug}
            </div>
          )}
        </div>
      )}

      <Handle type="source" position={Position.Right} />
    </div>
  );
}

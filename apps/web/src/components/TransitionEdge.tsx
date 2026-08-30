'use client';

import { useState } from 'react';
import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from '@xyflow/react';

export type TransitionKind = 'therefore' | 'but' | 'and_then';

/**
 * The Parker/Stone test, made visible.
 *
 * "therefore" and "but" are healthy connective tissue; "and then" is the weak
 * joint — a beat that merely follows its predecessor rather than being caused or
 * complicated by it. So "and then" is drawn dashed and muted: on a full canvas,
 * a sagging act reads as a run of dashed edges without needing to be explained.
 */
export const EDGE_STYLE: Record<TransitionKind, React.CSSProperties> = {
  therefore: { stroke: '#4f9d69', strokeWidth: 2 },
  but: { stroke: '#d08a3e', strokeWidth: 2 },
  and_then: { stroke: '#6b7280', strokeWidth: 1.5, strokeDasharray: '6 4' },
};

const LABEL_BG: Record<TransitionKind, string> = {
  therefore: '#15301f',
  but: '#33240f',
  and_then: '#1b1e24',
};

export function TransitionEdge(props: EdgeProps) {
  const { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, label } =
    props;
  const [hovered, setHovered] = useState(false);

  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const kind = (data?.kind as TransitionKind) ?? 'and_then';
  const justification = data?.justification as string | undefined;
  const confirmed = Boolean(data?.confirmed);

  return (
    <>
      <BaseEdge id={id} path={path} style={props.style} />
      <EdgeLabelRenderer>
        <div
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: 'all',
            background: LABEL_BG[kind],
            border: `1px solid ${(EDGE_STYLE[kind].stroke as string) ?? '#444'}`,
            borderRadius: 6,
            padding: '2px 7px',
            fontSize: 10,
            letterSpacing: 0.3,
            color: '#dfe3e8',
            maxWidth: hovered ? 260 : 120,
            cursor: 'default',
          }}
        >
          <span style={{ fontWeight: 600 }}>{label}</span>
          {/* A writer-confirmed edge is never re-labeled by an agent. */}
          {confirmed && <span style={{ marginLeft: 4, color: '#7fb98f' }}>✓</span>}
          {hovered && justification && (
            <div style={{ marginTop: 4, color: '#9aa4b2', fontWeight: 400, lineHeight: 1.4 }}>
              {justification}
            </div>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

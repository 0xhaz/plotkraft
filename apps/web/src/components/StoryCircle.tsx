'use client';

/**
 * The Story Circle, drawn as the writer already pictures it.
 *
 * Each of the eight segments is drawn at a radius proportional to that step's
 * actual share of the script, against a faint ring marking the conventional
 * share. A sagging second act is then visible as a bulge at Search, and a rushed
 * ending as a dent at Return — no numbers required to see it.
 */

export type CircleStep = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

const STEPS: { step: CircleStep; name: string; gloss: string; color: string }[] = [
  { step: 1, name: 'YOU', gloss: 'establish the protagonist', color: '#22c07a' },
  { step: 2, name: 'NEED', gloss: "something isn't right", color: '#9ad11f' },
  { step: 3, name: 'GO', gloss: 'crossing the threshold', color: '#e8e017' },
  { step: 4, name: 'SEARCH', gloss: 'the road of trials', color: '#f0951e' },
  { step: 5, name: 'FIND', gloss: 'meeting the goddess', color: '#ef3b2f' },
  { step: 6, name: 'TAKE', gloss: 'paying the price', color: '#e8318f' },
  { step: 7, name: 'RETURN', gloss: 'bringing it home', color: '#a03fd8' },
  { step: 8, name: 'CHANGE', gloss: 'master of both worlds', color: '#2f9fe0' },
];

const EXPECTED: Record<CircleStep, number> = {
  1: 0.1, 2: 0.1, 3: 0.05, 4: 0.25, 5: 0.15, 6: 0.15, 7: 0.1, 8: 0.1,
};

const SIZE = 300;
const CX = SIZE / 2;
const CY = SIZE / 2;
const INNER = 52;
const BASE = 82;
const MAX_EXTRA = 56;

/** Angle in degrees, measured clockwise from the top of the circle. */
function point(angleDeg: number, radius: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: CX + radius * Math.cos(rad), y: CY + radius * Math.sin(rad) };
}

function segmentPath(startDeg: number, endDeg: number, rInner: number, rOuter: number) {
  const a = point(startDeg, rOuter);
  const b = point(endDeg, rOuter);
  const c = point(endDeg, rInner);
  const d = point(startDeg, rInner);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return [
    `M ${a.x} ${a.y}`,
    `A ${rOuter} ${rOuter} 0 ${large} 1 ${b.x} ${b.y}`,
    `L ${c.x} ${c.y}`,
    `A ${rInner} ${rInner} 0 ${large} 0 ${d.x} ${d.y}`,
    'Z',
  ].join(' ');
}

export function StoryCircle({
  shares,
  diagnostics,
  goThreshold,
  onClose,
}: {
  shares: Record<string, number>;
  diagnostics: { kind: string; severity: string; step?: number; message: string }[];
  goThreshold: number | null;
  onClose: () => void;
}) {
  const flagged = new Set(diagnostics.filter((d) => d.step).map((d) => d.step));

  return (
    <aside style={S.panel}>
      <div style={S.header}>
        <div style={{ fontWeight: 600, fontSize: 13 }}>Story Circle</div>
        <button onClick={onClose} style={S.close} aria-label="Close">×</button>
      </div>

      <svg width={SIZE} height={SIZE} style={{ display: 'block', margin: '0 auto' }}>
        {/* Conventional-share reference ring */}
        <circle cx={CX} cy={CY} r={BASE} fill="none" stroke="#2a2f38" strokeWidth={1} strokeDasharray="2 3" />

        {STEPS.map(({ step, name, color }, i) => {
          const share = shares[String(step)] ?? 0;
          const ratio = EXPECTED[step] === 0 ? 0 : share / EXPECTED[step];
          // Radius grows with over-representation, shrinks with under-.
          const rOuter = BASE + Math.min(MAX_EXTRA, Math.max(-26, (ratio - 1) * 34));
          const start = i * 45 - 22.5;
          const end = start + 45;
          const mid = start + 22.5;
          const label = point(mid, rOuter + 22);
          const missing = share === 0;

          return (
            <g key={step}>
              <path
                d={segmentPath(start + 1, end - 1, INNER, Math.max(INNER + 6, rOuter))}
                fill={missing ? 'transparent' : color}
                fillOpacity={missing ? 0 : 0.28}
                stroke={color}
                strokeWidth={flagged.has(step) ? 2 : 1}
                strokeDasharray={missing ? '3 3' : undefined}
              />
              <text
                x={label.x}
                y={label.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={9.5}
                fontWeight={600}
                fill={missing ? '#6b7280' : color}
              >
                {name}
              </text>
              <text
                x={label.x}
                y={label.y + 11}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={8.5}
                fill="#9aa4b2"
              >
                {missing ? 'missing' : `${Math.round(share * 100)}%`}
              </text>
            </g>
          );
        })}

        {/* Order above the diameter, chaos below — the axis the circle turns on. */}
        <line x1={CX - INNER} y1={CY} x2={CX + INNER} y2={CY} stroke="#3d4450" strokeWidth={1} />
        <text x={CX} y={CY - 18} textAnchor="middle" fontSize={9} fill="#9aa4b2" letterSpacing={1}>
          ORDER
        </text>
        <text x={CX} y={CY + 24} textAnchor="middle" fontSize={9} fill="#9aa4b2" letterSpacing={1}>
          CHAOS
        </text>
      </svg>

      {goThreshold !== null && (
        <div style={S.threshold}>
          Crosses into chaos at <strong>{Math.round(goThreshold * 100)}%</strong>
          <span style={{ color: '#6b7280' }}> · convention ≈20%</span>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {diagnostics.length === 0 && (
          <div style={{ color: '#7fb98f', fontSize: 11 }}>
            All eight steps present and proportioned. No structural notes.
          </div>
        )}
        {diagnostics.map((d, i) => (
          <div key={i} style={{ ...S.diag, borderLeft: `2px solid ${sev(d.severity)}` }}>
            {d.message}
          </div>
        ))}
      </div>
    </aside>
  );
}

const sev = (s: string) => (s === 'critical' ? '#e05252' : s === 'warn' ? '#d08a3e' : '#7aa2e3');

const S: Record<string, React.CSSProperties> = {
  panel: {
    position: 'absolute', top: 12, left: 12, width: 340, maxHeight: 'calc(100% - 24px)',
    overflowY: 'auto', zIndex: 6, background: '#12151af2', border: '1px solid #222831',
    borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 10,
    fontFamily: 'ui-sans-serif, system-ui, sans-serif', color: '#e8eaed',
    backdropFilter: 'blur(6px)',
  },
  header: { display: 'flex', alignItems: 'center' },
  close: {
    marginLeft: 'auto', background: 'none', border: 'none', color: '#9aa4b2',
    fontSize: 20, lineHeight: 1, cursor: 'pointer', padding: 0,
  },
  threshold: {
    fontSize: 11, color: '#9aa4b2', textAlign: 'center',
    borderTop: '1px solid #222831', paddingTop: 8,
  },
  diag: { fontSize: 11, lineHeight: 1.5, color: '#dfe3e8', paddingLeft: 8 },
};

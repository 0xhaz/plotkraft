'use client';

/**
 * Diagrams for the landing page.
 *
 * Each one draws the actual mechanism the agent uses — the real edge colours, the
 * real vocabulary, the real failure it catches — rather than generic decoration.
 * A reader should be able to understand what the product does from the picture
 * alone, and recognise it when they later see the canvas.
 */

const C = {
  therefore: '#4f9d69',
  but: '#d08a3e',
  andThen: '#6b7280',
  danger: '#e05252',
  info: '#7aa2e3',
  card: '#171a1f',
  cardLine: '#2a2f38',
  text: '#dfe3e8',
  muted: '#8b95a3',
};

function Card({
  x, y, w = 92, h = 34, label, stroke = C.cardLine, fill = C.card, dim = false,
}: {
  x: number; y: number; w?: number; h?: number; label: string;
  stroke?: string; fill?: string; dim?: boolean;
}) {
  return (
    <g opacity={dim ? 0.4 : 1}>
      <rect x={x} y={y} width={w} height={h} rx={6} fill={fill} stroke={stroke} />
      <text x={x + w / 2} y={y + h / 2 + 3.5} textAnchor="middle" fontSize={9} fill={C.text}>
        {label}
      </text>
    </g>
  );
}

function Arrow({
  x1, y1, x2, y2, color, dashed = false, label,
}: {
  x1: number; y1: number; x2: number; y2: number;
  color: string; dashed?: boolean; label?: string;
}) {
  const id = `head-${color.slice(1)}-${dashed ? 'd' : 's'}`;
  return (
    <g>
      <defs>
        <marker id={id} markerWidth="7" markerHeight="7" refX="6" refY="2.5" orient="auto">
          <path d="M0,0 L6,2.5 L0,5 Z" fill={color} />
        </marker>
      </defs>
      <line
        x1={x1} y1={y1} x2={x2} y2={y2}
        stroke={color} strokeWidth={1.6}
        strokeDasharray={dashed ? '5 3' : undefined}
        markerEnd={`url(#${id})`}
      />
      {label && (
        <text
          x={(x1 + x2) / 2} y={y1 - 7}
          textAnchor="middle" fontSize={8} fill={color} fontWeight={600}
        >
          {label}
        </text>
      )}
    </g>
  );
}

/** Story Logic: the therefore / but / and-then vocabulary on real joints. */
export function CausalityDiagram() {
  return (
    <svg viewBox="0 0 360 90" width="100%" role="img" aria-label="Three scenes joined by therefore, but and and-then transitions">
      <Card x={2} y={30} label="DINER" />
      <Card x={134} y={30} label="GARAGE" />
      <Card x={266} y={30} label="APARTMENT" />
      <Arrow x1={96} y1={47} x2={132} y2={47} color={C.but} label="but" />
      <Arrow x1={228} y1={47} x2={264} y2={47} color={C.andThen} dashed label="and then" />
      <text x={180} y={84} textAnchor="middle" fontSize={8.5} fill={C.muted}>
        a dashed run is a second act that stopped causing itself
      </text>
    </svg>
  );
}

/** What-if: cut a scene, watch the downstream light up. */
export function WhatIfDiagram() {
  return (
    <svg viewBox="0 0 360 100" width="100%" role="img" aria-label="Cutting a scene orphans the scenes downstream of it">
      <Card x={2} y={34} w={76} label="SETUP" />
      <Card x={100} y={34} w={76} label="CUT" stroke="#7a3030" fill="#1a0f10" dim />
      <Card x={198} y={34} w={76} label="PAYOFF" stroke={C.danger} fill="#2a1618" />
      <Card x={288} y={34} w={70} label="ENDING" stroke={C.danger} fill="#2a1618" />
      <Arrow x1={80} y1={51} x2={98} y2={51} color={C.andThen} />
      <Arrow x1={178} y1={51} x2={196} y2={51} color={C.danger} />
      <Arrow x1={276} y1={51} x2={286} y2={51} color={C.danger} />
      <text x={236} y={26} textAnchor="middle" fontSize={8} fill={C.danger} fontWeight={600}>
        payoff orphaned
      </text>
      <text x={180} y={92} textAnchor="middle" fontSize={8.5} fill={C.muted}>
        the causal graph is the dependency map, so this is a walk, not a re-read
      </text>
    </svg>
  );
}

/** Story Circle: eight steps, with the bulge and the hole both visible. */
export function CircleDiagram() {
  const steps = [
    { n: 'YOU', c: '#22c07a', r: 30 },
    { n: 'NEED', c: '#9ad11f', r: 30 },
    { n: 'GO', c: '#e8e017', r: 28 },
    { n: 'SEARCH', c: '#f0951e', r: 42 },
    { n: 'FIND', c: '#ef3b2f', r: 30 },
    { n: 'TAKE', c: '#e8318f', r: 0 },
    { n: 'RETURN', c: '#a03fd8', r: 26 },
    { n: 'CHANGE', c: '#2f9fe0', r: 29 },
  ];
  const cx = 180;
  const cy = 92;
  const pt = (deg: number, rad: number) => ({
    x: cx + rad * Math.cos(((deg - 90) * Math.PI) / 180),
    y: cy + rad * Math.sin(((deg - 90) * Math.PI) / 180),
  });
  const seg = (i: number, r: number) => {
    const s = i * 45 - 21;
    const e = s + 42;
    const a = pt(s, 14), b = pt(s, r), c2 = pt(e, r), d = pt(e, 14);
    return `M${a.x} ${a.y} L${b.x} ${b.y} A${r} ${r} 0 0 1 ${c2.x} ${c2.y} L${d.x} ${d.y} Z`;
  };

  return (
    <svg viewBox="0 0 360 186" width="100%" role="img" aria-label="Story circle with a bloated Search step and a missing Take step">
      {steps.map((s, i) => {
        const missing = s.r === 0;
        const label = pt(i * 45, (missing ? 30 : s.r) + 13);
        return (
          <g key={s.n}>
            <path
              d={seg(i, missing ? 30 : s.r)}
              fill={missing ? 'none' : s.c}
              fillOpacity={0.26}
              stroke={missing ? C.danger : s.c}
              strokeWidth={missing ? 1.4 : 1}
              strokeDasharray={missing ? '3 3' : undefined}
            />
            <text
              x={label.x} y={label.y}
              textAnchor="middle" dominantBaseline="middle"
              fontSize={7.5} fontWeight={600}
              fill={missing ? C.danger : s.c}
            >
              {s.n}
            </text>
          </g>
        );
      })}
      <circle cx={cx} cy={cy} r={13} fill="#0f1216" stroke="#3d4450" />
      <text x={276} y={64} fontSize={8} fill="#f0951e" fontWeight={600}>46% of pages</text>
      <text x={54} y={140} fontSize={8} fill={C.danger} fontWeight={600} textAnchor="end">nothing is paid for</text>
      <text x={180} y={180} textAnchor="middle" fontSize={8.5} fill={C.muted}>
        proportions are computed, never guessed by a model
      </text>
    </svg>
  );
}

/** Researcher: a claim, checked against real sources. */
export function ResearcherDiagram() {
  return (
    <svg viewBox="0 0 360 116" width="100%" role="img" aria-label="A line of dialogue checked against three cited sources">
      <rect x={2} y={8} width={356} height={28} rx={6} fill={C.card} stroke={C.cardLine} />
      <text x={12} y={26} fontSize={9} fill={C.text} fontStyle="italic">
        “Federal FOIA is twenty. State is ten.”
      </text>
      <Arrow x1={180} y1={38} x2={180} y2={54} color={C.danger} />
      <rect x={2} y={56} width={356} height={30} rx={6} fill="#2a1618" stroke={C.danger} />
      <text x={12} y={69} fontSize={8.5} fill="#f08a8a" fontWeight={600}>contradicted</text>
      <text x={12} y={80} fontSize={8} fill={C.muted}>
        state response times vary widely; some have no mandated limit
      </text>
      {['ballotpedia.org', 'dmlp.org', 'dhs.gov'].map((h, i) => (
        <g key={h}>
          <rect x={2 + i * 96} y={92} width={90} height={17} rx={4} fill="#0f1216" stroke="#2a3a52" />
          <text x={47 + i * 96} y={104} textAnchor="middle" fontSize={7.5} fill={C.info}>{h}</text>
        </g>
      ))}
    </svg>
  );
}

/** Notes: two decision-makers, one scene, opposite instructions. */
export function NotesDiagram() {
  return (
    <svg viewBox="0 0 360 118" width="100%" role="img" aria-label="A producer and an executive asking for opposite changes to the same scene">
      <rect x={2} y={6} width={166} height={40} rx={6} fill={C.card} stroke={C.cardLine} />
      <text x={12} y={20} fontSize={7.5} fill={C.muted}>PRODUCER</text>
      <text x={12} y={34} fontSize={9} fill={C.text}>“The diner scene has to go.”</text>

      <rect x={192} y={6} width={166} height={40} rx={6} fill={C.card} stroke={C.cardLine} />
      <text x={202} y={20} fontSize={7.5} fill={C.muted}>EXECUTIVE</text>
      <text x={202} y={34} fontSize={9} fill={C.text}>“Build the sister out more.”</text>

      <Arrow x1={85} y1={48} x2={150} y2={68} color={C.danger} />
      <Arrow x1={275} y1={48} x2={210} y2={68} color={C.danger} />

      <rect x={100} y={70} width={160} height={30} rx={6} fill="#2a1618" stroke={C.danger} />
      <text x={180} y={83} textAnchor="middle" fontSize={8.5} fill="#f08a8a" fontWeight={600}>
        blocking conflict
      </text>
      <text x={180} y={94} textAnchor="middle" fontSize={8} fill={C.muted}>
        both are decision-makers
      </text>
      <text x={180} y={113} textAnchor="middle" fontSize={8.5} fill={C.muted}>
        found before you rewrite, not after
      </text>
    </svg>
  );
}

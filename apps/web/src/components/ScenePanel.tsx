'use client';

import { useEffect, useState } from 'react';
import { collection, doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface Citation {
  url: string;
  title: string;
  excerpt?: string;
}

interface Flag {
  id: string;
  kind: string;
  researchVerdict?: 'supported' | 'contradicted' | 'unclear';
  severity: 'info' | 'warn' | 'critical';
  message: string;
  agent: string;
  claim?: string;
  analyzedVersion: number;
  verdict: 'pending' | 'accepted' | 'dismissed' | 'disagreed';
  citations?: Citation[];
}

const SEVERITY_COLOR = { info: '#7aa2e3', warn: '#d08a3e', critical: '#e05252' } as const;

/**
 * A verified claim is shown as prominently as a contradicted one. If only problems
 * appeared, a well-researched script would render nothing and the writer would have
 * no evidence the Researcher had read it at all.
 */
const VERDICT_BADGE = {
  supported: { label: 'verified', color: '#4f9d69' },
  contradicted: { label: 'contradicted', color: '#e05252' },
  unclear: { label: 'sources unclear', color: '#9aa4b2' },
} as const;

/**
 * Scene detail: what the agents found, and the writer's verdict on each finding.
 *
 * Every flag is accept / dismiss / disagree. The tool diagnoses; the writer
 * decides. That is the whole WGA-aware position, made concrete in one row of
 * buttons rather than asserted in a README.
 */
export function ScenePanel({
  projectId,
  sceneId,
  heading,
  characters,
  loadScore,
  sceneVersion,
  onClose,
}: {
  projectId: string;
  sceneId: string;
  heading: string;
  characters: string[];
  loadScore: number;
  sceneVersion: number;
  onClose: () => void;
}) {
  const [flags, setFlags] = useState<Flag[]>([]);

  useEffect(() => {
    return onSnapshot(
      collection(db(), 'projects', projectId, 'scenes', sceneId, 'flags'),
      (snap) => setFlags(snap.docs.map((d) => d.data() as Flag)),
    );
  }, [projectId, sceneId]);

  const setVerdict = async (flagId: string, verdict: Flag['verdict']) => {
    await updateDoc(doc(db(), 'projects', projectId, 'scenes', sceneId, 'flags', flagId), {
      verdict,
      verdictAt: Date.now(),
    });
  };

  const open = flags.filter((f) => f.verdict === 'pending');
  const resolved = flags.filter((f) => f.verdict !== 'pending');

  return (
    <aside style={S.panel}>
      <div style={S.header}>
        <div style={{ fontWeight: 600, fontSize: 13, lineHeight: 1.35 }}>{heading}</div>
        <button onClick={onClose} style={S.close} aria-label="Close">
          ×
        </button>
      </div>

      <div style={S.meta}>
        load {loadScore.toFixed(2)}
        {characters.length > 0 && <> · {characters.join(', ')}</>}
      </div>

      {flags.length === 0 && (
        <div style={S.empty}>No agent findings on this scene yet.</div>
      )}

      {open.map((f) => (
        <FlagCard
          key={f.id}
          flag={f}
          stale={f.analyzedVersion !== sceneVersion}
          onVerdict={(v) => void setVerdict(f.id, v)}
        />
      ))}

      {resolved.length > 0 && (
        <div style={S.resolvedHead}>{resolved.length} resolved</div>
      )}
      {resolved.map((f) => (
        <div key={f.id} style={S.resolvedRow}>
          <span style={{ color: '#6b7280' }}>{f.verdict}</span> · {f.message.slice(0, 60)}…
        </div>
      ))}
    </aside>
  );
}

function FlagCard({
  flag,
  stale,
  onVerdict,
}: {
  flag: Flag;
  stale: boolean;
  onVerdict: (v: Flag['verdict']) => void;
}) {
  return (
    <div
      style={{
        ...S.card,
        borderLeft: `3px solid ${
          flag.researchVerdict
            ? VERDICT_BADGE[flag.researchVerdict].color
            : SEVERITY_COLOR[flag.severity]
        }`,
      }}
    >
      <div style={S.agentRow}>
        <span style={{ color: SEVERITY_COLOR[flag.severity], fontWeight: 600 }}>{flag.agent}</span>
        {flag.researchVerdict && (
          <span
            style={{
              color: VERDICT_BADGE[flag.researchVerdict].color,
              border: `1px solid ${VERDICT_BADGE[flag.researchVerdict].color}55`,
              borderRadius: 4, padding: '1px 5px', fontSize: 10, letterSpacing: 0.3,
            }}
          >
            {VERDICT_BADGE[flag.researchVerdict].label}
          </span>
        )}
        {/* A flag computed against an older draft says so, rather than posing as current. */}
        {stale && <span style={S.stale}>possibly stale — re-run</span>}
      </div>

      {flag.claim && <div style={S.claim}>“{flag.claim}”</div>}
      <div style={S.message}>{flag.message}</div>

      {flag.citations && flag.citations.length > 0 && (
        <div style={S.citations}>
          {flag.citations.map((c) => (
            <a key={c.url} href={c.url} target="_blank" rel="noopener noreferrer" style={S.cite}>
              {c.title || new URL(c.url).hostname}
            </a>
          ))}
        </div>
      )}

      <div style={S.verdictRow}>
        <button onClick={() => onVerdict('accepted')} style={{ ...S.verdictBtn, color: '#7fb98f' }}>
          Accept
        </button>
        <button onClick={() => onVerdict('dismissed')} style={S.verdictBtn}>
          Dismiss
        </button>
        <button onClick={() => onVerdict('disagreed')} style={{ ...S.verdictBtn, color: '#d08a3e' }}>
          Disagree
        </button>
      </div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  panel: {
    position: 'absolute', top: 12, left: 12, width: 320, maxHeight: 'calc(100% - 24px)',
    overflowY: 'auto', zIndex: 6, background: '#12151af2', border: '1px solid #222831',
    borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 10,
    fontFamily: 'ui-sans-serif, system-ui, sans-serif', color: '#e8eaed',
    backdropFilter: 'blur(6px)',
  },
  header: { display: 'flex', alignItems: 'flex-start', gap: 8 },
  close: {
    marginLeft: 'auto', background: 'none', border: 'none', color: '#9aa4b2',
    fontSize: 20, lineHeight: 1, cursor: 'pointer', padding: 0,
  },
  meta: { color: '#9aa4b2', fontSize: 11 },
  empty: { color: '#6b7280', fontSize: 12, padding: '8px 0' },
  card: {
    background: '#171a1f', borderRadius: 8, padding: '10px 12px',
    display: 'flex', flexDirection: 'column', gap: 7,
  },
  agentRow: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 },
  stale: { marginLeft: 'auto', color: '#9aa4b2', fontStyle: 'italic', fontSize: 10 },
  claim: { color: '#9aa4b2', fontSize: 11, fontStyle: 'italic', lineHeight: 1.4 },
  message: { fontSize: 12, lineHeight: 1.5 },
  citations: { display: 'flex', flexDirection: 'column', gap: 4 },
  cite: {
    color: '#7aa2e3', fontSize: 11, textDecoration: 'none',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  verdictRow: { display: 'flex', gap: 6, marginTop: 2 },
  verdictBtn: {
    flex: 1, background: '#22272f', border: '1px solid #2a2f38', borderRadius: 6,
    color: '#9aa4b2', fontSize: 11, padding: '5px 0', cursor: 'pointer',
  },
  resolvedHead: {
    color: '#6b7280', fontSize: 11, borderTop: '1px solid #222831',
    paddingTop: 8, marginTop: 2,
  },
  resolvedRow: { color: '#9aa4b2', fontSize: 11, lineHeight: 1.4 },
};

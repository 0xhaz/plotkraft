'use client';

import { useEffect, useState } from 'react';
import { collection, doc, onSnapshot, runTransaction, updateDoc } from 'firebase/firestore';
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

export interface DialogueLine {
  character: string;
  parenthetical?: string;
  text: string;
}

export interface SceneDetail {
  id: string;
  index: number;
  heading: string;
  action: string;
  dialogue: DialogueLine[];
  characters: string[];
  loadScore?: number;
  version: number;
  circleStep?: number;
  circleReason?: string;
}

const SEVERITY_COLOR = { info: '#7aa2e3', warn: '#d08a3e', critical: '#e05252' } as const;

const VERDICT_BADGE = {
  supported: { label: 'verified', color: '#4f9d69' },
  contradicted: { label: 'contradicted', color: '#e05252' },
  unclear: { label: 'sources unclear', color: '#9aa4b2' },
} as const;

const STEP_NAMES = ['', 'You', 'Need', 'Go', 'Search', 'Find', 'Take', 'Return', 'Change'];

/**
 * The scene itself, then what the agents made of it.
 *
 * The script leads. A note about a scene is unreadable next to a scene you
 * cannot see, and the writer needs to judge the finding against their own words.
 */
export function ScenePanel({
  projectId,
  scene,
  onClose,
}: {
  projectId: string;
  scene: SceneDetail;
  onClose: () => void;
}) {
  const [flags, setFlags] = useState<Flag[]>([]);
  const [tab, setTab] = useState<'scene' | 'findings'>('scene');
  const [editing, setEditing] = useState(false);
  const [draftHeading, setDraftHeading] = useState(scene.heading);
  const [draftAction, setDraftAction] = useState(scene.action);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    return onSnapshot(
      collection(db(), 'projects', projectId, 'scenes', scene.id, 'flags'),
      (snap) => setFlags(snap.docs.map((d) => d.data() as Flag)),
      (err) => console.error('[scene panel] flags listener failed', err),
    );
  }, [projectId, scene.id]);

  // Reset the draft whenever a different scene is opened.
  useEffect(() => {
    setEditing(false);
    setSaveError(null);
    setDraftHeading(scene.heading);
    setDraftAction(scene.action);
  }, [scene.id, scene.heading, scene.action]);

  const setVerdict = async (flagId: string, verdict: Flag['verdict']) => {
    await updateDoc(doc(db(), 'projects', projectId, 'scenes', scene.id, 'flags', flagId), {
      verdict,
      verdictAt: Date.now(),
    });
  };

  /**
   * Content edits run in a transaction that checks and advances `version`.
   * If someone else changed the scene while this panel was open, the write is
   * refused and the writer is told — never silently overwritten.
   */
  const save = async () => {
    setSaving(true);
    setSaveError(null);
    const ref = doc(db(), 'projects', projectId, 'scenes', scene.id);
    try {
      await runTransaction(db(), async (tx) => {
        const fresh = await tx.get(ref);
        const current = fresh.data();
        if (!current) throw new Error('This scene no longer exists.');
        if (Number(current.version) !== scene.version) {
          throw new Error(
            `Updated by someone else since you opened it (v${current.version}). Close and reopen to get their changes.`,
          );
        }
        tx.update(ref, {
          heading: draftHeading.trim().toUpperCase(),
          action: draftAction,
          version: scene.version + 1,
          updatedAt: Date.now(),
        });
      });
      setEditing(false);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  const open = flags.filter((f) => f.verdict === 'pending');
  const resolved = flags.filter((f) => f.verdict !== 'pending');

  return (
    <aside style={S.panel}>
      <div style={S.header}>
        <div>
          <div style={S.sceneNo}>
            Scene {scene.index + 1}
            {scene.circleStep ? ` · ${STEP_NAMES[scene.circleStep]}` : ''}
          </div>
          <div style={S.heading}>{scene.heading}</div>
        </div>
        <button onClick={onClose} style={S.close} aria-label="Close">×</button>
      </div>

      <div style={S.meta}>
        load {(scene.loadScore ?? 0).toFixed(2)} · v{scene.version}
        {scene.characters.length > 0 && <> · {scene.characters.join(', ')}</>}
      </div>

      <div style={S.tabs}>
        <button onClick={() => setTab('scene')} style={tab === 'scene' ? S.tabOn : S.tab}>
          Scene
        </button>
        <button onClick={() => setTab('findings')} style={tab === 'findings' ? S.tabOn : S.tab}>
          Findings{flags.length > 0 ? ` (${open.length})` : ''}
        </button>
      </div>

      {tab === 'scene' ? (
        editing ? (
          <>
            <label style={S.label}>Slugline</label>
            <input
              value={draftHeading}
              onChange={(e) => setDraftHeading(e.target.value)}
              style={S.input}
            />
            <label style={S.label}>Action</label>
            <textarea
              value={draftAction}
              onChange={(e) => setDraftAction(e.target.value)}
              rows={12}
              style={{ ...S.input, fontFamily: 'ui-monospace, monospace', fontSize: 12 }}
            />
            {saveError && <div style={S.error}>{saveError}</div>}
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button onClick={() => void save()} disabled={saving} style={S.primary}>
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button
                onClick={() => {
                  setEditing(false);
                  setDraftHeading(scene.heading);
                  setDraftAction(scene.action);
                  setSaveError(null);
                }}
                style={S.ghost}
              >
                Cancel
              </button>
            </div>
            <p style={S.hint}>
              Dialogue is not editable here yet — re-import the script to change it.
            </p>
          </>
        ) : (
          <>
            <div style={S.script}>
              {scene.action && <div style={S.action}>{scene.action}</div>}

              {scene.dialogue.map((line, i) => (
                <div key={i} style={S.dialogueBlock}>
                  <div style={S.character}>{line.character}</div>
                  {line.parenthetical && <div style={S.paren}>{line.parenthetical}</div>}
                  <div style={S.line}>{line.text}</div>
                </div>
              ))}

              {!scene.action && scene.dialogue.length === 0 && (
                <div style={S.empty}>This scene has no action or dialogue text.</div>
              )}
            </div>

            {scene.circleReason && (
              <div style={S.circleNote}>
                <strong>{STEP_NAMES[scene.circleStep ?? 0]}</strong> — {scene.circleReason}
              </div>
            )}

            <button onClick={() => setEditing(true)} style={S.ghost}>
              Edit scene
            </button>
          </>
        )
      ) : (
        <>
          {flags.length === 0 && <div style={S.empty}>No agent findings on this scene yet.</div>}

          {open.map((f) => (
            <FlagCard
              key={f.id}
              flag={f}
              stale={f.analyzedVersion !== scene.version}
              onVerdict={(v) => void setVerdict(f.id, v)}
            />
          ))}

          {resolved.length > 0 && <div style={S.resolvedHead}>{resolved.length} resolved</div>}
          {resolved.map((f) => (
            <div key={f.id} style={S.resolvedRow}>
              <span style={{ color: '#6b7280' }}>{f.verdict}</span> · {f.message.slice(0, 60)}…
            </div>
          ))}
        </>
      )}
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
    position: 'absolute', top: 12, left: 12, width: 400, maxHeight: 'calc(100% - 24px)',
    overflowY: 'auto', zIndex: 6, background: '#12151af2', border: '1px solid #222831',
    borderRadius: 10, padding: 16, display: 'flex', flexDirection: 'column', gap: 10,
    fontFamily: 'ui-sans-serif, system-ui, sans-serif', color: '#e8eaed',
    backdropFilter: 'blur(6px)',
  },
  header: { display: 'flex', alignItems: 'flex-start', gap: 8 },
  sceneNo: { color: '#7aa2e3', fontSize: 10.5, letterSpacing: 0.8, textTransform: 'uppercase' },
  heading: { fontWeight: 600, fontSize: 14, lineHeight: 1.35, marginTop: 3 },
  close: {
    marginLeft: 'auto', background: 'none', border: 'none', color: '#9aa4b2',
    fontSize: 20, lineHeight: 1, cursor: 'pointer', padding: 0,
  },
  meta: { color: '#8b95a3', fontSize: 11 },
  tabs: { display: 'flex', gap: 4, borderBottom: '1px solid #222831', paddingBottom: 8 },
  tab: {
    background: 'none', border: 'none', color: '#8b95a3', fontSize: 12,
    padding: '4px 10px', cursor: 'pointer', borderRadius: 6,
  },
  tabOn: {
    background: '#1d2634', border: 'none', color: '#e8eaed', fontSize: 12,
    padding: '4px 10px', cursor: 'pointer', borderRadius: 6, fontWeight: 600,
  },
  // Screenplay-ish rendering: monospace, action full width, dialogue indented.
  script: {
    background: '#0f1216', border: '1px solid #1e242c', borderRadius: 8,
    padding: '14px 16px', fontFamily: 'ui-monospace, monospace', fontSize: 12,
    lineHeight: 1.6, maxHeight: 360, overflowY: 'auto',
  },
  action: { color: '#c7cdd6', whiteSpace: 'pre-wrap', marginBottom: 12 },
  dialogueBlock: { marginBottom: 12 },
  character: { color: '#e8eaed', fontWeight: 600, paddingLeft: 72, letterSpacing: 0.5 },
  paren: { color: '#8b95a3', paddingLeft: 56 },
  line: { color: '#c7cdd6', paddingLeft: 36, paddingRight: 24 },
  circleNote: {
    color: '#9aa4b2', fontSize: 11.5, lineHeight: 1.5,
    borderLeft: '2px solid #2a3a52', paddingLeft: 10,
  },
  label: { fontSize: 11, color: '#8b95a3', marginTop: 8, marginBottom: 5 },
  input: {
    width: '100%', background: '#0f1216', border: '1px solid #2a2f38', borderRadius: 7,
    padding: '9px 11px', color: '#e8eaed', fontSize: 13, boxSizing: 'border-box',
  },
  primary: {
    background: '#3b6fd4', color: '#fff', border: 'none', borderRadius: 7,
    padding: '8px 16px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
  },
  ghost: {
    background: 'transparent', color: '#9aa4b2', border: '1px solid #2a2f38',
    borderRadius: 7, padding: '8px 14px', fontSize: 12.5, cursor: 'pointer',
  },
  hint: { color: '#6f7986', fontSize: 11, lineHeight: 1.5, margin: '10px 0 0' },
  error: { color: '#e07070', fontSize: 11.5, lineHeight: 1.5, marginTop: 8 },
  empty: { color: '#6b7280', fontSize: 12, padding: '8px 0' },
  card: {
    background: '#171a1f', borderRadius: 8, padding: '10px 12px',
    display: 'flex', flexDirection: 'column', gap: 7,
  },
  agentRow: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, flexWrap: 'wrap' },
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

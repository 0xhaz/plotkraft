'use client';

import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface Note {
  id: string;
  source: string;
  author: string;
  body: string;
  ask: string;
  scope: 'scene' | 'script';
  sceneIds: string[];
}

interface NoteConflict {
  id: string;
  noteIdA: string;
  noteIdB: string;
  sceneIds: string[];
  explanation: string;
  severity: 'info' | 'warn' | 'critical';
  authors: string[];
  sources: string[];
}

const SEV = {
  critical: { color: '#e05252', label: 'blocking' },
  warn: { color: '#d08a3e', label: 'tension' },
  info: { color: '#7aa2e3', label: 'minor' },
} as const;

/**
 * The note reconciliation dashboard.
 *
 * Conflicts lead, because a contradiction is the thing the writer cannot resolve
 * alone — it needs someone to choose. The tool never picks a side; it names the
 * disagreement and who it is between, which is the part nobody currently does.
 */
export function NotesPanel({
  projectId,
  onClose,
  onReconcile,
  busy,
}: {
  projectId: string;
  onClose: () => void;
  onReconcile: () => void;
  busy: boolean;
}) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [conflicts, setConflicts] = useState<NoteConflict[]>([]);

  useEffect(() => {
    const unsubNotes = onSnapshot(collection(db(), 'projects', projectId, 'notes'), (s) =>
      setNotes(s.docs.map((d) => d.data() as Note)),
    );
    const unsubConflicts = onSnapshot(
      collection(db(), 'projects', projectId, 'noteConflicts'),
      (s) => setConflicts(s.docs.map((d) => d.data() as NoteConflict)),
    );
    return () => {
      unsubNotes();
      unsubConflicts();
    };
  }, [projectId]);

  const byId = new Map(notes.map((n) => [n.id, n]));
  const rank = { critical: 0, warn: 1, info: 2 } as const;
  const sorted = [...conflicts].sort((a, b) => rank[a.severity] - rank[b.severity]);
  const bySource = new Map<string, Note[]>();
  for (const n of notes) {
    if (!bySource.has(n.source)) bySource.set(n.source, []);
    bySource.get(n.source)!.push(n);
  }

  return (
    <aside style={S.panel}>
      <div style={S.header}>
        <div style={{ fontWeight: 600, fontSize: 13 }}>Notes</div>
        <button onClick={onClose} style={S.close} aria-label="Close">×</button>
      </div>

      <div style={S.summary}>
        {notes.length} notes from {bySource.size} sources ·{' '}
        <span style={{ color: conflicts.length ? '#e05252' : '#7fb98f' }}>
          {conflicts.length} conflict{conflicts.length === 1 ? '' : 's'}
        </span>
      </div>

      <button onClick={onReconcile} disabled={busy} style={S.button}>
        {busy ? 'Reconciling…' : 'Reconcile notes'}
      </button>

      {sorted.length > 0 && <div style={S.sectionHead}>Contradictions</div>}
      {sorted.map((c) => {
        const a = byId.get(c.noteIdA);
        const b = byId.get(c.noteIdB);
        return (
          <div key={c.id} style={{ ...S.conflict, borderLeft: `3px solid ${SEV[c.severity].color}` }}>
            <div style={S.conflictHead}>
              <span style={{ color: SEV[c.severity].color, fontWeight: 600 }}>
                {SEV[c.severity].label}
              </span>
              <span style={{ color: '#9aa4b2' }}>{c.authors?.join(' vs ')}</span>
            </div>
            <div style={S.explanation}>{c.explanation}</div>
            <div style={S.sides}>
              {a && <Side note={a} />}
              {b && <Side note={b} />}
            </div>
          </div>
        );
      })}

      <div style={S.sectionHead}>All notes</div>
      {[...bySource.entries()].map(([source, list]) => (
        <div key={source} style={{ marginBottom: 6 }}>
          <div style={S.sourceHead}>
            {source} · {list[0]?.author}
          </div>
          {list.map((n) => (
            <div key={n.id} style={S.noteRow}>
              <span style={{ color: n.scope === 'script' ? '#6b7280' : '#7aa2e3' }}>
                {n.scope === 'script' ? 'whole script' : `${n.sceneIds.length} scene${n.sceneIds.length === 1 ? '' : 's'}`}
              </span>{' '}
              {n.ask || n.body.slice(0, 70)}
            </div>
          ))}
        </div>
      ))}
    </aside>
  );
}

function Side({ note }: { note: Note }) {
  return (
    <div style={S.side}>
      <div style={{ color: '#9aa4b2', fontSize: 10 }}>{note.author}</div>
      <div>{note.ask || note.body.slice(0, 90)}</div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  panel: {
    position: 'absolute', top: 12, left: 12, width: 360, maxHeight: 'calc(100% - 24px)',
    overflowY: 'auto', zIndex: 6, background: '#12151af2', border: '1px solid #222831',
    borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 9,
    fontFamily: 'ui-sans-serif, system-ui, sans-serif', color: '#e8eaed',
    backdropFilter: 'blur(6px)',
  },
  header: { display: 'flex', alignItems: 'center' },
  close: {
    marginLeft: 'auto', background: 'none', border: 'none', color: '#9aa4b2',
    fontSize: 20, lineHeight: 1, cursor: 'pointer', padding: 0,
  },
  summary: { color: '#9aa4b2', fontSize: 11 },
  button: {
    background: '#b06a2f', color: '#fff', border: 'none', borderRadius: 7,
    padding: '8px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
  },
  sectionHead: {
    color: '#6b7280', fontSize: 10, letterSpacing: 0.6, textTransform: 'uppercase',
    borderTop: '1px solid #222831', paddingTop: 8, marginTop: 2,
  },
  conflict: {
    background: '#171a1f', borderRadius: 8, padding: '9px 11px',
    display: 'flex', flexDirection: 'column', gap: 6,
  },
  conflictHead: { display: 'flex', gap: 8, fontSize: 10, alignItems: 'center' },
  explanation: { fontSize: 11.5, lineHeight: 1.5 },
  sides: { display: 'flex', gap: 6 },
  side: {
    flex: 1, background: '#0f1216', borderRadius: 6, padding: '6px 8px',
    fontSize: 10.5, lineHeight: 1.4, color: '#dfe3e8',
  },
  sourceHead: {
    color: '#9aa4b2', fontSize: 10.5, fontWeight: 600, marginTop: 4,
    textTransform: 'capitalize',
  },
  noteRow: { color: '#c7cdd6', fontSize: 11, lineHeight: 1.45, paddingLeft: 6 },
};

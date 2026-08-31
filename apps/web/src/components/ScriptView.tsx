'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { collection, doc, onSnapshot, orderBy, query, runTransaction } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { actOfStep, ACT_LABEL, type Act, type SequenceMeta } from '@/lib/layout';
import { STATUSES, type SceneStatus, type DialogueLine, type Craft } from './ScenePanel';

interface Scene {
  id: string;
  index: number;
  heading: string;
  action: string;
  dialogue: DialogueLine[];
  characters: string[];
  version: number;
  status?: SceneStatus;
  circleStep?: number;
  craft?: Craft;
}

/**
 * The reading and writing view.
 *
 * The board answers how the story holds together; it cannot answer "read me the
 * script". This is the linear counterpart: continuous pages in screenplay form,
 * with the outline as a spine so a 244-scene feature is still navigable.
 *
 * Formatting follows the page rather than a generic document: sluglines flush
 * left, character cues centred-ish above their lines, dialogue in a narrow
 * column. That shape is how a writer reads pace, so losing it would make the
 * view useless even with every word intact.
 */
export function ScriptView({ projectId }: { projectId: string }) {
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [sequences, setSequences] = useState<SequenceMeta[]>([]);
  const [mode, setMode] = useState<'original' | 'reference'>('original');
  const [denied, setDenied] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onError = (err: { code?: string }) => {
      if (err.code === 'permission-denied') setDenied(true);
      else console.error('[script] listener failed', err);
    };

    const unsubScenes = onSnapshot(
      query(collection(db(), 'projects', projectId, 'scenes'), orderBy('index')),
      (snap) => setScenes(snap.docs.map((d) => d.data() as Scene)),
      onError,
    );
    const unsubProject = onSnapshot(
      doc(db(), 'projects', projectId),
      (snap) => {
        const data = snap.data();
        setMode(data?.mode === 'reference' ? 'reference' : 'original');
        setSequences((data?.sequences ?? []) as SequenceMeta[]);
      },
      onError,
    );
    return () => {
      unsubScenes();
      unsubProject();
    };
  }, [projectId]);

  /** Outline rows: acts and sequences interleaved in reading order. */
  const outline = useMemo(() => {
    const rows: { kind: 'act' | 'seq'; label: string; count: number; sceneId?: string }[] = [];
    if (sequences.length === 0) return rows;

    const byIndex = new Map(scenes.map((s) => [s.index, s]));
    let lastAct: Act | null = null;

    for (const q of [...sequences].sort((a, b) => a.startIndex - b.startIndex)) {
      if (q.act !== lastAct) {
        const inAct = sequences.filter((x) => x.act === q.act);
        rows.push({
          kind: 'act',
          label: ACT_LABEL[q.act],
          count: inAct.reduce((n, x) => n + (x.endIndex - x.startIndex + 1), 0),
        });
        lastAct = q.act;
      }
      rows.push({
        kind: 'seq',
        label: q.name,
        count: q.endIndex - q.startIndex + 1,
        sceneId: byIndex.get(q.startIndex)?.id,
      });
    }
    return rows;
  }, [sequences, scenes]);

  const jumpTo = (sceneId?: string) => {
    if (!sceneId) return;
    document.getElementById(`scene-${sceneId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const pages = useMemo(
    () => Math.max(1, Math.round(scenes.reduce((n, s) => n + estimatePages(s), 0))),
    [scenes],
  );

  if (denied) {
    return (
      <div style={S.denied}>
        <div style={{ fontSize: 16, fontWeight: 600 }}>You don&apos;t have access to this project</div>
        <a href="/new" style={{ color: '#7aa2e3', fontSize: 13 }}>Start a new project</a>
      </div>
    );
  }

  return (
    <div style={S.wrap}>
      <nav style={S.outline}>
        <div style={S.outlineHead}>
          {scenes.length} scenes · ~{pages} pages
          {mode === 'reference' && <span style={{ color: '#7fb98f' }}> · reference</span>}
        </div>

        {outline.length === 0 && (
          <div style={S.outlineEmpty}>
            Run <strong>Find sequences</strong> on the board to get an outline here.
          </div>
        )}

        {outline.map((row, i) =>
          row.kind === 'act' ? (
            <div key={i} style={S.outlineAct}>
              {row.label}
              <span style={{ color: '#4a5260' }}> · {row.count}</span>
            </div>
          ) : (
            <button key={i} onClick={() => jumpTo(row.sceneId)} style={S.outlineSeq}>
              {row.label}
              <span style={{ marginLeft: 'auto', color: '#4a5260' }}>{row.count}</span>
            </button>
          ),
        )}
      </nav>

      <div ref={containerRef} style={S.page}>
        {scenes.map((scene) => (
          <SceneBlock
            key={scene.id}
            projectId={projectId}
            scene={scene}
            mode={mode}
            editing={editingId === scene.id}
            onEdit={() => setEditingId(scene.id)}
            onDone={() => setEditingId(null)}
          />
        ))}
        {scenes.length === 0 && <div style={S.outlineEmpty}>No scenes yet.</div>}
      </div>
    </div>
  );
}

/** Rough page count: a screenplay page holds ~800 characters of mixed content. */
function estimatePages(scene: Scene): number {
  const dialogue = (scene.dialogue ?? []).map((d) => d.text).join(' ');
  return (scene.heading.length + scene.action.length + dialogue.length) / 800;
}

function SceneBlock({
  projectId,
  scene,
  mode,
  editing,
  onEdit,
  onDone,
}: {
  projectId: string;
  scene: Scene;
  mode: 'original' | 'reference';
  editing: boolean;
  onEdit: () => void;
  onDone: () => void;
}) {
  const [heading, setHeading] = useState(scene.heading);
  const [action, setAction] = useState(scene.action);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setHeading(scene.heading);
    setAction(scene.action);
    setError(null);
  }, [scene.heading, scene.action]);

  const save = async () => {
    setSaving(true);
    setError(null);
    const ref = doc(db(), 'projects', projectId, 'scenes', scene.id);
    try {
      await runTransaction(db(), async (tx) => {
        const fresh = await tx.get(ref);
        const current = fresh.data();
        if (!current) throw new Error('This scene no longer exists.');
        if (Number(current.version) !== scene.version) {
          throw new Error(`Changed by someone else (v${current.version}). Reload to see theirs.`);
        }
        tx.update(ref, {
          heading: heading.trim().toUpperCase(),
          action,
          version: scene.version + 1,
          updatedAt: Date.now(),
        });
      });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  const status = STATUSES.find((s) => s.value === (scene.status ?? 'draft'));

  return (
    <section id={`scene-${scene.id}`} style={S.scene}>
      <div style={S.sceneMeta}>
        <span>{scene.index + 1}</span>
        {mode === 'original' && status && (
          <span style={{ color: status.color }}>● {status.label}</span>
        )}
        {mode === 'original' && !editing && (
          <button onClick={onEdit} style={S.editLink}>Edit</button>
        )}
      </div>

      {editing ? (
        <div style={S.editor}>
          <input value={heading} onChange={(e) => setHeading(e.target.value)} style={S.input} />
          <textarea
            value={action}
            onChange={(e) => setAction(e.target.value)}
            rows={Math.max(4, action.split('\n').length + 1)}
            style={{ ...S.input, fontFamily: 'inherit' }}
          />
          {error && <div style={S.error}>{error}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => void save()} disabled={saving} style={S.save}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button onClick={onDone} style={S.cancel}>Cancel</button>
          </div>
          <p style={S.hint}>Dialogue is not editable here yet.</p>
        </div>
      ) : (
        <>
          <h2 style={S.slug}>{scene.heading}</h2>
          {scene.action && <p style={S.action}>{scene.action}</p>}

          {(scene.dialogue ?? []).map((line, i) => (
            <div key={i} style={S.speech}>
              <div style={S.character}>{line.character}</div>
              {line.parenthetical && <div style={S.paren}>{line.parenthetical}</div>}
              <div style={S.line}>{line.text}</div>
            </div>
          ))}

          {scene.craft && (
            <aside style={S.craft}>
              <span style={S.craftKey}>Job</span> {scene.craft.job}
              {' · '}
              <span style={S.craftKey}>Steal this</span> {scene.craft.transferable}
            </aside>
          )}
        </>
      )}
    </section>
  );
}

const S: Record<string, React.CSSProperties> = {
  wrap: { display: 'flex', height: '100%', background: '#0f1216' },
  outline: {
    width: 300, flexShrink: 0, borderRight: '1px solid #1c2129', overflowY: 'auto',
    padding: '18px 14px', display: 'flex', flexDirection: 'column', gap: 2,
    fontFamily: 'ui-sans-serif, system-ui, sans-serif',
  },
  outlineHead: {
    color: '#8b95a3', fontSize: 11, marginBottom: 14, letterSpacing: 0.3,
  },
  outlineEmpty: { color: '#6b7280', fontSize: 12, lineHeight: 1.6, padding: '8px 4px' },
  outlineAct: {
    color: '#7aa2e3', fontSize: 10.5, fontWeight: 600, letterSpacing: 0.6,
    textTransform: 'uppercase', marginTop: 16, marginBottom: 6, padding: '0 6px',
  },
  outlineSeq: {
    display: 'flex', alignItems: 'center', gap: 8, width: '100%',
    background: 'none', border: 'none', borderRadius: 6, cursor: 'pointer',
    color: '#c7cdd6', fontSize: 12.5, textAlign: 'left', padding: '7px 8px',
    lineHeight: 1.4,
  },
  page: {
    flex: 1, overflowY: 'auto', padding: '40px 24px 120px',
    // The page itself: a fixed measure, monospaced, like the printed thing.
    fontFamily: 'ui-monospace, "Courier New", monospace',
    fontSize: 13.5, lineHeight: 1.65, color: '#dfe3e8',
  },
  scene: { maxWidth: 620, margin: '0 auto 40px', position: 'relative' },
  sceneMeta: {
    display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8,
    fontFamily: 'ui-sans-serif, system-ui, sans-serif', fontSize: 10.5, color: '#4a5260',
  },
  editLink: {
    marginLeft: 'auto', background: 'none', border: 'none', color: '#7aa2e3',
    fontSize: 11, cursor: 'pointer', padding: 0,
  },
  slug: {
    fontSize: 13.5, fontWeight: 700, letterSpacing: 0.5, margin: '0 0 14px',
    color: '#e8eaed', textTransform: 'uppercase',
  },
  action: { margin: '0 0 16px', whiteSpace: 'pre-wrap', color: '#c7cdd6' },
  speech: { margin: '0 0 14px' },
  character: { paddingLeft: '38%', color: '#e8eaed', letterSpacing: 0.5 },
  paren: { paddingLeft: '30%', color: '#8b95a3' },
  line: { paddingLeft: '22%', paddingRight: '12%', color: '#c7cdd6' },
  craft: {
    marginTop: 14, padding: '9px 12px', borderLeft: '2px solid #2f6f4e',
    background: '#131a16', borderRadius: 6,
    fontFamily: 'ui-sans-serif, system-ui, sans-serif', fontSize: 11.5,
    lineHeight: 1.55, color: '#a9bdb0',
  },
  craftKey: {
    color: '#6f8a78', fontSize: 9.5, textTransform: 'uppercase', letterSpacing: 0.6,
  },
  editor: { display: 'flex', flexDirection: 'column', gap: 10 },
  input: {
    width: '100%', background: '#0b0e12', border: '1px solid #2a2f38', borderRadius: 7,
    padding: '10px 12px', color: '#e8eaed', fontSize: 13.5, boxSizing: 'border-box',
    fontFamily: 'ui-monospace, monospace', lineHeight: 1.65,
  },
  save: {
    background: '#3b6fd4', color: '#fff', border: 'none', borderRadius: 7,
    padding: '8px 16px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
    fontFamily: 'ui-sans-serif, system-ui, sans-serif',
  },
  cancel: {
    background: 'transparent', color: '#9aa4b2', border: '1px solid #2a2f38',
    borderRadius: 7, padding: '8px 14px', fontSize: 12.5, cursor: 'pointer',
    fontFamily: 'ui-sans-serif, system-ui, sans-serif',
  },
  hint: {
    color: '#6f7986', fontSize: 11, margin: 0,
    fontFamily: 'ui-sans-serif, system-ui, sans-serif',
  },
  error: {
    color: '#e07070', fontSize: 11.5,
    fontFamily: 'ui-sans-serif, system-ui, sans-serif',
  },
  denied: {
    height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', gap: 10, color: '#e8eaed',
    fontFamily: 'ui-sans-serif, system-ui, sans-serif',
  },
};

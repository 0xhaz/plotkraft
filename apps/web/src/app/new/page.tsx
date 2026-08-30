'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { useAuth } from '@/lib/useAuth';
import { API_BASE } from '@/lib/firebase';

export default function NewProject() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [source, setSource] = useState('');
  const [pdf, setPdf] = useState<{ name: string; data: string } | null>(null);
  const [mode, setMode] = useState<'original' | 'reference'>('original');
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** One click to a populated canvas — also the fastest way to demo the tool. */
  async function loadSample() {
    const res = await fetch('/samples/the-quiet-part.fountain');
    setSource(await res.text());
    setTitle('The Quiet Part');
  }

  async function onFile(file: File) {
    const stem = file.name.replace(/\.(fountain|txt|pdf)$/i, '');
    if (!title) setTitle(stem);

    if (file.name.toLowerCase().endsWith('.pdf')) {
      // Base64 so the PDF survives a JSON body; the API decodes and parses it.
      const buf = new Uint8Array(await file.arrayBuffer());
      let binary = '';
      for (let i = 0; i < buf.length; i += 8192) {
        binary += String.fromCharCode(...buf.subarray(i, i + 8192));
      }
      setPdf({ name: file.name, data: btoa(binary) });
      setSource('');
      return;
    }

    setPdf(null);
    setSource(await file.text());
  }

  async function importScript() {
    if (!user || (!source.trim() && !pdf)) return;
    setBusy(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`${API_BASE}/projects/${pdf ? 'import-pdf' : 'import'}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}` },
        // Ownership comes from the verified token, never from this body.
        body: JSON.stringify(
          pdf
            ? { data: pdf.data, title: title || undefined, mode }
            : { source, title: title || undefined, mode },
        ),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? `Import failed (${res.status})`);
      }
      const { projectId } = await res.json();
      router.push(`/project/${projectId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Navbar />
      <main style={S.main}>
        <div style={S.shell}>
          <h1 style={S.h1}>New project</h1>
          <p style={S.sub}>
            Upload a Fountain screenplay, or paste one. Nothing is analysed until you ask —
            each agent runs on demand from the canvas.
          </p>

          {loading ? (
            <p style={S.muted}>Loading…</p>
          ) : !user ? (
            <div style={S.card}>
              <p style={S.muted}>Sign in from the menu above to start a project.</p>
            </div>
          ) : (
            <div style={S.card}>
              <div style={S.modeRow}>
                {(
                  [
                    ['original', 'My screenplay', 'Diagnosed: causality, structure, facts, notes. Editable, with draft states.'],
                    ['reference', 'Study a screenplay', "A produced script to learn from. Read-only, and the Craft agent explains what each scene is doing and why it works."],
                  ] as const
                ).map(([value, label, blurb]) => (
                  <button
                    key={value}
                    onClick={() => setMode(value)}
                    style={{
                      ...S.modeBtn,
                      borderColor: mode === value ? '#3b6fd4' : '#2a2f38',
                      background: mode === value ? '#16223a' : 'transparent',
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>{label}</div>
                    <div style={{ color: '#8b95a3', fontSize: 12, lineHeight: 1.5 }}>{blurb}</div>
                  </button>
                ))}
              </div>

              {mode === 'reference' && (
                <p style={S.refNote}>
                  Use a script you have obtained yourself. It stays in your project for
                  analysis — Plotkraft does not host or redistribute screenplays.
                </p>
              )}

              <button onClick={() => void loadSample()} style={S.sample}>
                Load the sample screenplay
              </button>
              <p style={S.sampleHint}>
                “The Quiet Part” — 13 scenes with a deliberately sagging second act, a
                planted factual error and a missing opening beat, so every agent has
                something real to find.
              </p>

              <label style={S.label}>Title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Untitled Script"
                style={S.input}
              />

              <label style={S.label}>Script file — Fountain or PDF</label>
              <input
                type="file"
                accept=".fountain,.txt,.pdf"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onFile(f);
                }}
                style={{ ...S.input, padding: 9 }}
              />
              {pdf && (
                <p style={S.pdfNote}>
                  <strong>{pdf.name}</strong> ready. Scenes are read from the page layout —
                  sluglines, character cues and dialogue are told apart by their indentation.
                  A scan with no text layer will not parse.
                </p>
              )}

              <label style={S.label}>{pdf ? 'Or paste Fountain instead' : 'Or paste it'}</label>
              <textarea
                value={source}
                onChange={(e) => {
                  setSource(e.target.value);
                  if (e.target.value) setPdf(null);
                }}
                placeholder={'INT. NEWSROOM - NIGHT\n\nEmpty desks. MAYA reads the same paragraph for the fourth time.'}
                rows={12}
                style={{ ...S.input, fontFamily: 'ui-monospace, monospace', fontSize: 12, lineHeight: 1.55 }}
              />

              {error && <p style={S.error}>{error}</p>}

              <button
                onClick={() => void importScript()}
                disabled={busy || (!source.trim() && !pdf)}
                style={{ ...S.primary, opacity: busy || (!source.trim() && !pdf) ? 0.5 : 1 }}
              >
                {busy ? 'Importing…' : pdf ? 'Import PDF' : 'Import script'}
              </button>
            </div>
          )}
        </div>
      </main>
    </>
  );
}

const S: Record<string, React.CSSProperties> = {
  main: {
    background: '#0f1216', color: '#e8eaed', minHeight: '100vh',
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif',
    padding: '64px 32px 90px',
  },
  shell: { maxWidth: 820, margin: '0 auto' },
  h1: { fontSize: 42, fontWeight: 700, margin: 0, letterSpacing: -1.2 },
  sub: { color: '#8b95a3', fontSize: 17, lineHeight: 1.65, marginTop: 14, marginBottom: 34 },
  card: {
    background: '#12151a', border: '1px solid #1e242c', borderRadius: 14, padding: 34,
    display: 'flex', flexDirection: 'column',
  },
  label: { fontSize: 14, color: '#8b95a3', marginTop: 22, marginBottom: 9 },
  input: {
    width: '100%', background: '#0f1216', border: '1px solid #2a2f38', borderRadius: 8,
    padding: '13px 15px', color: '#e8eaed', fontSize: 16, boxSizing: 'border-box',
  },
  sample: {
    background: 'transparent', color: '#7aa2e3', border: '1px dashed #2a3a52',
    borderRadius: 9, padding: '14px 18px', fontSize: 15, cursor: 'pointer',
  },
  modeRow: { display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' },
  modeBtn: {
    flex: '1 1 240px', textAlign: 'left', border: '1px solid', borderRadius: 10,
    padding: '14px 16px', cursor: 'pointer', color: '#e8eaed',
  },
  refNote: {
    color: '#9aa4b2', fontSize: 12.5, lineHeight: 1.6, margin: '0 0 16px',
    borderLeft: '2px solid #2a3a52', paddingLeft: 12,
  },
  pdfNote: {
    color: '#9aa4b2', fontSize: 12.5, lineHeight: 1.6, margin: '10px 0 0',
    borderLeft: '2px solid #2a3a52', paddingLeft: 12,
  },
  sampleHint: { color: '#6f7986', fontSize: 14, lineHeight: 1.6, margin: '12px 0 0' },
  primary: {
    marginTop: 20, background: '#3b6fd4', color: '#fff', border: 'none', borderRadius: 8,
    padding: '15px 22px', fontSize: 16, fontWeight: 600, cursor: 'pointer',
  },
  muted: { color: '#8b95a3', fontSize: 16 },
  error: { color: '#e07070', fontSize: 15, marginTop: 16, marginBottom: 0 },
};

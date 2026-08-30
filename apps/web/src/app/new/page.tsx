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
    setSource(await file.text());
    if (!title) setTitle(file.name.replace(/\.(fountain|txt)$/i, ''));
  }

  async function importScript() {
    if (!user || !source.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`${API_BASE}/projects/import`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}` },
        // Ownership comes from the verified token, never from this body.
        body: JSON.stringify({ source, title: title || undefined }),
      });
      if (!res.ok) throw new Error(`Import failed (${res.status})`);
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

              <label style={S.label}>Script file</label>
              <input
                type="file"
                accept=".fountain,.txt"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onFile(f);
                }}
                style={{ ...S.input, padding: 9 }}
              />

              <label style={S.label}>Or paste it</label>
              <textarea
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder={'INT. NEWSROOM - NIGHT\n\nEmpty desks. MAYA reads the same paragraph for the fourth time.'}
                rows={12}
                style={{ ...S.input, fontFamily: 'ui-monospace, monospace', fontSize: 12, lineHeight: 1.55 }}
              />

              {error && <p style={S.error}>{error}</p>}

              <button
                onClick={() => void importScript()}
                disabled={busy || !source.trim()}
                style={{ ...S.primary, opacity: busy || !source.trim() ? 0.5 : 1 }}
              >
                {busy ? 'Importing…' : 'Import script'}
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
    padding: '44px 22px 70px',
  },
  shell: { maxWidth: 660, margin: '0 auto' },
  h1: { fontSize: 30, fontWeight: 700, margin: 0, letterSpacing: -0.7 },
  sub: { color: '#8b95a3', fontSize: 13.5, lineHeight: 1.65, marginTop: 10, marginBottom: 24 },
  card: {
    background: '#12151a', border: '1px solid #1e242c', borderRadius: 12, padding: 22,
    display: 'flex', flexDirection: 'column',
  },
  label: { fontSize: 11.5, color: '#8b95a3', marginTop: 14, marginBottom: 6 },
  input: {
    width: '100%', background: '#0f1216', border: '1px solid #2a2f38', borderRadius: 8,
    padding: '10px 12px', color: '#e8eaed', fontSize: 14, boxSizing: 'border-box',
  },
  sample: {
    background: 'transparent', color: '#7aa2e3', border: '1px dashed #2a3a52',
    borderRadius: 8, padding: '10px 14px', fontSize: 13, cursor: 'pointer',
  },
  sampleHint: { color: '#6f7986', fontSize: 11.5, lineHeight: 1.55, margin: '8px 0 0' },
  primary: {
    marginTop: 20, background: '#3b6fd4', color: '#fff', border: 'none', borderRadius: 8,
    padding: '12px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
  },
  muted: { color: '#8b95a3', fontSize: 13 },
  error: { color: '#e07070', fontSize: 13, marginTop: 12, marginBottom: 0 },
};

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/useAuth';
import { API_BASE } from '@/lib/firebase';

export default function Home() {
  const { user, loading, signIn, signOutUser } = useAuth();
  const router = useRouter();
  const [source, setSource] = useState('');
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        headers: {
          'content-type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        // No ownerUid: the API takes ownership from the verified token.
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

  if (loading) return <main style={S.main}><p style={S.muted}>Loading…</p></main>;

  return (
    <main style={S.main}>
      <div style={{ width: '100%', maxWidth: 720 }}>
        <h1 style={S.h1}>Plotkraft</h1>
        <p style={S.tagline}>
          A writers&apos; room canvas where human notes and AI agents annotate the same beat sheet.
        </p>

        {!user ? (
          <button onClick={() => void signIn()} style={S.primary}>
            Sign in with Google
          </button>
        ) : (
          <>
            <div style={S.userRow}>
              <span style={S.muted}>{user.email ?? user.uid}</span>
              <button onClick={() => void signOutUser()} style={S.link}>Sign out</button>
            </div>

            <label style={S.label}>Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Untitled Script"
              style={S.input}
            />

            <label style={S.label}>Fountain script</label>
            <input
              type="file"
              accept=".fountain,.txt"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); }}
              style={{ ...S.input, padding: 8 }}
            />
            <textarea
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="…or paste your script here"
              rows={10}
              style={{ ...S.input, fontFamily: 'ui-monospace, monospace', fontSize: 12 }}
            />

            {error && <p style={{ color: '#e07070', fontSize: 13 }}>{error}</p>}

            <button onClick={() => void importScript()} disabled={busy || !source.trim()} style={S.primary}>
              {busy ? 'Importing…' : 'Import script'}
            </button>
          </>
        )}
      </div>
    </main>
  );
}

const S: Record<string, React.CSSProperties> = {
  main: {
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: '#0f1216', color: '#e8eaed', padding: 32,
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif',
  },
  h1: { fontSize: 34, fontWeight: 700, margin: 0, letterSpacing: -0.5 },
  tagline: { color: '#9aa4b2', marginTop: 8, marginBottom: 28, lineHeight: 1.5 },
  label: { display: 'block', fontSize: 12, color: '#9aa4b2', marginTop: 16, marginBottom: 6 },
  input: {
    width: '100%', background: '#171a1f', border: '1px solid #2a2f38', borderRadius: 8,
    padding: '10px 12px', color: '#e8eaed', fontSize: 14, boxSizing: 'border-box',
  },
  primary: {
    marginTop: 20, background: '#3b6fd4', color: '#fff', border: 'none', borderRadius: 8,
    padding: '11px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
  },
  link: { background: 'none', border: 'none', color: '#7aa2e3', cursor: 'pointer', fontSize: 13 },
  muted: { color: '#9aa4b2', fontSize: 13 },
  userRow: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 },
};

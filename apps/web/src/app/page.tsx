'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/useAuth';
import { API_BASE } from '@/lib/firebase';

const AGENTS = [
  ['Story Logic', 'Classifies every beat transition — therefore, but, or merely and-then.'],
  ['Story Circle', "Places each scene on Harmon's eight steps and finds the missing ones."],
  ['Researcher', 'Fact-checks real-world claims against cited sources.'],
  ['What-if', 'Simulates a cut and shows what breaks downstream.'],
  ['Notes', 'Reconciles notes from every source and flags where two contradict.'],
] as const;

export default function Home() {
  const { user, loading, signIn, devSignIn, signOutUser } = useAuth();
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
        headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}` },
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
    <main style={S.main}>
      <div style={S.shell}>
        <header style={S.hero}>
          <div style={S.eyebrow}>A writers&apos; room that has already read your pages</div>
          <h1 style={S.h1}>Plotkraft</h1>
          <p style={S.tagline}>
            Upload a screenplay. A crew of agents maps its causal structure, checks its facts
            against cited sources, reconciles your notes, and shows you what breaks when you
            cut a scene — <em style={S.em}>before</em> you rewrite it.
          </p>
          <p style={S.stance}>
            Plotkraft diagnoses. It never writes prose, and every finding is yours to accept
            or dismiss.
          </p>
        </header>

        <div style={S.agents}>
          {AGENTS.map(([name, what]) => (
            <div key={name} style={S.agent}>
              <div style={S.agentName}>{name}</div>
              <div style={S.agentWhat}>{what}</div>
            </div>
          ))}
        </div>

        <section style={S.card}>
          {loading ? (
            <p style={S.muted}>Loading…</p>
          ) : !user ? (
            <>
              <button onClick={() => void signIn()} style={S.primary}>
                Sign in with Google
              </button>
              {devSignIn && (
                <button onClick={() => void devSignIn()} style={S.secondary}>
                  Continue as local dev user
                </button>
              )}
              {devSignIn && (
                <p style={S.hint}>
                  Running against the Firebase emulators — the Google picker is faked and starts
                  empty, so the dev user is usually what you want here.
                </p>
              )}
            </>
          ) : (
            <>
              <div style={S.userRow}>
                <span style={S.muted}>Signed in as {user.email ?? user.uid}</span>
                <button onClick={() => void signOutUser()} style={S.link}>
                  Sign out
                </button>
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
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onFile(f);
                }}
                style={{ ...S.input, padding: 8 }}
              />
              <textarea
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder="…or paste your script here"
                rows={8}
                style={{ ...S.input, fontFamily: 'ui-monospace, monospace', fontSize: 12 }}
              />

              {error && <p style={S.error}>{error}</p>}

              <button
                onClick={() => void importScript()}
                disabled={busy || !source.trim()}
                style={{ ...S.primary, opacity: busy || !source.trim() ? 0.5 : 1 }}
              >
                {busy ? 'Importing…' : 'Import script'}
              </button>
            </>
          )}
        </section>
      </div>
    </main>
  );
}

const S: Record<string, React.CSSProperties> = {
  main: {
    minHeight: '100vh',
    background: 'radial-gradient(1100px 520px at 50% -8%, #1a2030 0%, #0f1216 62%)',
    color: '#e8eaed',
    padding: '56px 24px 72px',
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif',
  },
  shell: { maxWidth: 760, margin: '0 auto' },
  hero: { textAlign: 'center', marginBottom: 34 },
  eyebrow: {
    color: '#7aa2e3', fontSize: 11.5, letterSpacing: 1.4,
    textTransform: 'uppercase', marginBottom: 14,
  },
  h1: { fontSize: 52, fontWeight: 700, margin: 0, letterSpacing: -1.4, lineHeight: 1.05 },
  tagline: {
    color: '#b6bec9', marginTop: 16, marginBottom: 10, lineHeight: 1.65,
    fontSize: 15.5, maxWidth: 600, marginLeft: 'auto', marginRight: 'auto',
  },
  em: { color: '#e8eaed', fontStyle: 'italic' },
  stance: { color: '#78828f', fontSize: 12.5, lineHeight: 1.6, maxWidth: 480, margin: '0 auto' },
  agents: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
    gap: 10, marginBottom: 30,
  },
  agent: {
    background: '#141820', border: '1px solid #222831', borderRadius: 9,
    padding: '11px 13px',
  },
  agentName: { fontSize: 12.5, fontWeight: 600, marginBottom: 4 },
  agentWhat: { color: '#8b95a3', fontSize: 11.5, lineHeight: 1.5 },
  card: {
    background: '#12151a', border: '1px solid #222831', borderRadius: 12,
    padding: 22, display: 'flex', flexDirection: 'column',
  },
  label: { display: 'block', fontSize: 11.5, color: '#8b95a3', marginTop: 14, marginBottom: 6 },
  input: {
    width: '100%', background: '#0f1216', border: '1px solid #2a2f38', borderRadius: 8,
    padding: '10px 12px', color: '#e8eaed', fontSize: 14, boxSizing: 'border-box',
  },
  primary: {
    marginTop: 18, background: '#3b6fd4', color: '#fff', border: 'none', borderRadius: 8,
    padding: '11px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
  },
  secondary: {
    marginTop: 9, background: 'transparent', color: '#9aa4b2',
    border: '1px solid #2a2f38', borderRadius: 8,
    padding: '10px 18px', fontSize: 13, cursor: 'pointer',
  },
  link: { background: 'none', border: 'none', color: '#7aa2e3', cursor: 'pointer', fontSize: 13 },
  muted: { color: '#8b95a3', fontSize: 13 },
  hint: { color: '#6b7280', fontSize: 11, lineHeight: 1.55, marginTop: 12, marginBottom: 0 },
  error: { color: '#e07070', fontSize: 13, marginBottom: 0 },
  userRow: { display: 'flex', alignItems: 'center', gap: 12 },
};

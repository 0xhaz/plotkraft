'use client';

import { use } from 'react';
import Link from 'next/link';
import { Canvas } from '@/components/Canvas';
import { useAuth } from '@/lib/useAuth';

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, loading } = useAuth();

  if (loading) return <Shell><p style={{ color: '#9aa4b2' }}>Loading…</p></Shell>;
  if (!user) {
    return (
      <Shell>
        <p style={{ color: '#9aa4b2' }}>
          You need to <Link href="/" style={{ color: '#7aa2e3' }}>sign in</Link> to view this canvas.
        </p>
      </Shell>
    );
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#0f1216' }}>
      <header
        style={{
          display: 'flex', alignItems: 'center', gap: 14, padding: '10px 16px',
          borderBottom: '1px solid #222831', color: '#e8eaed',
          fontFamily: 'ui-sans-serif, system-ui, sans-serif', fontSize: 13,
        }}
      >
        <Link href="/" style={{ color: '#7aa2e3', textDecoration: 'none', fontWeight: 600 }}>
          Plotkraft
        </Link>
        <span style={{ color: '#4a5260' }}>/</span>
        <Link href="/new" style={{ color: '#9aa4b2', textDecoration: 'none' }}>new</Link>
        <span style={{ color: '#4a5260' }}>/</span>
        <span style={{ color: '#9aa4b2' }}>canvas</span>
        <Legend />
      </header>
      <div style={{ flex: 1, minHeight: 0 }}>
        <Canvas projectId={id} />
      </div>
    </div>
  );
}

/** Names the therefore/but/and-then vocabulary on screen, for writers and judges alike. */
function Legend() {
  const items: [string, string, boolean][] = [
    ['therefore', '#4f9d69', false],
    ['but', '#d08a3e', false],
    ['and then', '#6b7280', true],
  ];
  return (
    <div style={{ marginLeft: 'auto', display: 'flex', gap: 14, alignItems: 'center' }}>
      {items.map(([label, color, dashed]) => (
        <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#9aa4b2', fontSize: 11 }}>
          <span
            style={{
              width: 18, height: 0,
              borderTop: `2px ${dashed ? 'dashed' : 'solid'} ${color}`,
            }}
          />
          {label}
        </span>
      ))}
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main
      style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#0f1216', fontFamily: 'ui-sans-serif, system-ui, sans-serif',
      }}
    >
      {children}
    </main>
  );
}

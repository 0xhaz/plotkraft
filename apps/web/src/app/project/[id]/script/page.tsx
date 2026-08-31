'use client';

import { use } from 'react';
import Link from 'next/link';
import { ScriptView } from '@/components/ScriptView';
import { ProjectHeader } from '@/components/ProjectHeader';
import { useAuth } from '@/lib/useAuth';

export default function ScriptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, loading } = useAuth();

  if (loading || !user) {
    return (
      <main style={S.shell}>
        {loading ? (
          <p style={{ color: '#9aa4b2' }}>Loading…</p>
        ) : (
          <p style={{ color: '#9aa4b2' }}>
            You need to <Link href="/" style={{ color: '#7aa2e3' }}>sign in</Link> to read this
            script.
          </p>
        )}
      </main>
    );
  }

  return (
    <div style={S.page}>
      <ProjectHeader projectId={id} view="script" />
      <div style={{ flex: 1, minHeight: 0 }}>
        <ScriptView projectId={id} />
      </div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: { height: '100vh', display: 'flex', flexDirection: 'column', background: '#0f1216' },
  shell: {
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: '#0f1216', fontFamily: 'ui-sans-serif, system-ui, sans-serif',
  },
};

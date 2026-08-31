'use client';

import Link from 'next/link';

/**
 * Shared chrome for both project views.
 *
 * Board and Script are separate routes rather than a toggle so a writer can link
 * someone straight to the reading view — a director does not want the graph.
 */
export function ProjectHeader({
  projectId,
  view,
  children,
}: {
  projectId: string;
  view: 'board' | 'script';
  children?: React.ReactNode;
}) {
  const tab = (key: 'board' | 'script', label: string, href: string) => (
    <Link
      href={href}
      style={{
        ...S.tab,
        color: view === key ? '#e8eaed' : '#8b95a3',
        background: view === key ? '#1d2634' : 'transparent',
        fontWeight: view === key ? 600 : 400,
      }}
    >
      {label}
    </Link>
  );

  return (
    <header style={S.bar}>
      <Link href="/" style={S.brand}>Plotkraft</Link>
      <span style={{ color: '#4a5260' }}>/</span>
      <Link href="/new" style={S.link}>new</Link>

      <div style={S.tabs}>
        {tab('script', 'Script', `/project/${projectId}/script`)}
        {tab('board', 'Board', `/project/${projectId}`)}
      </div>

      {children}
    </header>
  );
}

const S: Record<string, React.CSSProperties> = {
  bar: {
    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px',
    borderBottom: '1px solid #222831', color: '#e8eaed',
    fontFamily: 'ui-sans-serif, system-ui, sans-serif', fontSize: 13,
    flexShrink: 0,
  },
  brand: { color: '#7aa2e3', textDecoration: 'none', fontWeight: 600 },
  link: { color: '#9aa4b2', textDecoration: 'none' },
  tabs: {
    display: 'flex', gap: 4, marginLeft: 14,
    background: '#12151a', border: '1px solid #222831', borderRadius: 8, padding: 3,
  },
  tab: { padding: '5px 14px', borderRadius: 6, textDecoration: 'none', fontSize: 12.5 },
};

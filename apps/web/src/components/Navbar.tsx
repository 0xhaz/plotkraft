'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/useAuth';

export function Navbar() {
  const { user, loading, signIn, devSignIn, signOutUser } = useAuth();

  return (
    <nav style={S.nav}>
      <div style={S.inner}>
        <Link href="/" style={S.brand}>
          <span style={S.mark} aria-hidden />
          Plotkraft
        </Link>

        <div style={S.links}>
          <a href="#how" style={S.link}>How it works</a>
          <a href="#agents" style={S.link}>Agents</a>
          <a href="#stance" style={S.link}>Our stance</a>
        </div>

        <div style={S.actions}>
          {loading ? (
            <span style={S.muted}>…</span>
          ) : user ? (
            <>
              <span style={S.muted}>{user.email ?? user.uid}</span>
              <Link href="/new" style={S.cta}>Open workspace</Link>
              <button onClick={() => void signOutUser()} style={S.ghost}>Sign out</button>
            </>
          ) : (
            <>
              {devSignIn && (
                <button onClick={() => void devSignIn()} style={S.ghost}>Dev sign-in</button>
              )}
              <button onClick={() => void signIn()} style={S.cta}>Sign in with Google</button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

const S: Record<string, React.CSSProperties> = {
  nav: {
    position: 'sticky', top: 0, zIndex: 20,
    background: '#0f1216e6', borderBottom: '1px solid #1c2129',
    backdropFilter: 'blur(10px)',
  },
  inner: {
    maxWidth: 1340, margin: '0 auto', padding: '0 32px',
    height: 70, display: 'flex', alignItems: 'center', gap: 18,
  },
  brand: {
    display: 'flex', alignItems: 'center', gap: 11,
    color: '#e8eaed', textDecoration: 'none', fontWeight: 700, fontSize: 18,
    letterSpacing: -0.2,
  },
  mark: {
    width: 19, height: 19, borderRadius: 5,
    background: 'linear-gradient(135deg, #4f9d69 0%, #3b6fd4 55%, #a03fd8 100%)',
    display: 'inline-block',
  },
  links: { display: 'flex', gap: 28, marginLeft: 26, flexWrap: 'wrap' },
  link: { color: '#8b95a3', textDecoration: 'none', fontSize: 15 },
  actions: { marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 13 },
  muted: { color: '#8b95a3', fontSize: 14 },
  cta: {
    background: '#3b6fd4', color: '#fff', border: 'none', borderRadius: 7,
    padding: '10px 18px', fontSize: 15, fontWeight: 600, cursor: 'pointer',
    textDecoration: 'none', whiteSpace: 'nowrap',
  },
  ghost: {
    background: 'transparent', color: '#9aa4b2', border: '1px solid #2a2f38',
    borderRadius: 8, padding: '9px 15px', fontSize: 14, cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
};

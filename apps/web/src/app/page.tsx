'use client';

import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { useAuth } from '@/lib/useAuth';
import {
  CausalityDiagram,
  WhatIfDiagram,
  CircleDiagram,
  ResearcherDiagram,
  NotesDiagram,
} from '@/components/marketing/Diagrams';

const FEATURES = [
  {
    id: 'story-logic',
    agent: 'Story Logic',
    color: '#4f9d69',
    title: 'Every joint in your script, classified',
    body: `The South Park test, run on all of it. Each transition between beats is either
      therefore (it was caused), but (it was complicated), or and then — which means nothing
      is holding those two scenes together. Weak joints are drawn dashed, so a second act
      that stopped causing itself is something you see rather than something you suspect.`,
    footnote: 'Gemini classifies; you can correct any edge, and a corrected edge is never re-labelled.',
    Diagram: CausalityDiagram,
  },
  {
    id: 'what-if',
    agent: 'What-if',
    color: '#e05252',
    title: 'Cut the scene before you cut the scene',
    body: `Pull a scene off the board and the damage lights up: payoffs whose setup just
      vanished, characters who now walk on carrying history the audience never saw, and every
      transition the cut destroyed. It runs on a private copy of the graph, so asking the
      question never disturbs what your collaborators are looking at.`,
    footnote: 'The causal graph doubles as the dependency map, so the check is a graph walk — not a re-read of the script.',
    Diagram: WhatIfDiagram,
  },
  {
    id: 'story-circle',
    agent: 'Story Circle',
    color: '#f0951e',
    title: 'The shape of the whole draft',
    body: `Joints can all be sound while the script still has no second act. Every scene is
      placed on Harmon's eight steps, so the diagnosis becomes specific and quantified: your
      Search runs 46% of the pages against a convention of 25%, you cross into chaos at 41%
      instead of 20%, and nothing in the script pays a price.`,
    footnote: 'The model places scenes; the percentages are arithmetic. A number in a note you might quote should never be generated.',
    Diagram: CircleDiagram,
  },
  {
    id: 'researcher',
    agent: 'Researcher',
    color: '#7aa2e3',
    title: 'The line an expert in the audience will catch',
    body: `Procedural, legal, medical and historical claims get pulled out of the dialogue and
      checked against live web sources through Parallel. Verified claims are shown with their
      sources too — a clean bill of health is worth as much as a correction, and it is how you
      know the pass actually ran.`,
    footnote: 'Verdicts are drawn only from retrieved sources, and every citation links to a page you can open.',
    Diagram: ResearcherDiagram,
  },
  {
    id: 'notes',
    agent: 'Notes',
    color: '#d08a3e',
    title: 'Your producer and your executive disagree',
    body: `Paste in notes from everyone — producer, executive, coverage, the writer friend who
      owed you a read. Each note is split out, pinned to the scenes it touches, and checked
      against the others. When two of them cannot both be satisfied, you learn it now instead
      of three drafts later.`,
    footnote: 'Severity comes from who is disagreeing: two decision-makers block the rewrite, two peers are a conversation.',
    Diagram: NotesDiagram,
  },
] as const;

const STEPS = [
  ['Upload', 'A Fountain screenplay becomes a board of scene cards with stable identity.'],
  ['Analyse', 'Independent agents run concurrently; findings stream onto the canvas as each lands.'],
  ['Interrogate', 'Cut a scene, re-run a pass, open a citation, resolve a note conflict.'],
  ['Decide', 'Accept, dismiss or disagree. The draft only changes when you change it.'],
] as const;

export default function Home() {
  const { user } = useAuth();

  return (
    <>
      <Navbar />
      <main style={S.main}>
        <section style={S.hero}>
          <div style={S.eyebrow}>A writers&apos; room that has already read your pages</div>
          <h1 style={S.h1}>
            Structural notes on your screenplay,
            <br />
            <span style={S.h1Accent}>in ninety seconds</span>
          </h1>
          <p style={S.sub}>
            Plotkraft reads a draft the way a good development executive does — for causality,
            structure, factual risk and contradictory notes — and shows the results on a canvas
            you can argue with.
          </p>
          <div style={S.heroCta}>
            <Link href={user ? '/new' : '#how'} style={S.primary}>
              {user ? 'Open workspace' : 'See how it works'}
            </Link>
            <a href="#agents" style={S.secondary}>Meet the agents</a>
          </div>
          <div style={S.compare}>
            A coverage service charges $60–$1,500 and takes two weeks. This runs on every draft.
          </div>
        </section>

        <section id="how" style={S.band}>
          <SectionHead kicker="How it works" title="Four steps, one canvas" />
          <div style={S.steps}>
            {STEPS.map(([name, what], i) => (
              <div key={name} style={S.step}>
                <div style={S.stepNum}>{i + 1}</div>
                <div style={S.stepName}>{name}</div>
                <div style={S.stepWhat}>{what}</div>
              </div>
            ))}
          </div>
        </section>

        <section id="agents" style={S.band}>
          <SectionHead
            kicker="The crew"
            title="Five agents, each answering a different question"
          />
          <div style={S.features}>
            {FEATURES.map((f, i) => (
              <article key={f.id} id={f.id} style={{ ...S.feature, flexDirection: i % 2 ? 'row-reverse' : 'row' }}>
                <div style={S.featureText}>
                  <div style={{ ...S.agentTag, color: f.color, borderColor: `${f.color}55` }}>
                    {f.agent}
                  </div>
                  <h3 style={S.featureTitle}>{f.title}</h3>
                  <p style={S.featureBody}>{f.body}</p>
                  <p style={S.footnote}>{f.footnote}</p>
                </div>
                <div style={S.figure}>
                  <f.Diagram />
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id="stance" style={S.band}>
          <div style={S.stance}>
            <SectionHead kicker="Our stance" title="An analyst, not a ghostwriter" />
            <p style={S.stanceBody}>
              Plotkraft does not generate prose, and it will not offer to. It reads what you
              wrote and tells you where the structure is load-bearing, where a fact will not
              survive contact with an audience, and where two people are asking you for
              opposite things. Every finding carries accept, dismiss and disagree, because the
              tool is not the author of anything.
            </p>
            <p style={S.stanceBody}>
              A dismissed note is treated as information: dismiss the same kind of flag twice
              and the agent stops raising it on this project. A note you keep ignoring is worse
              than no note at all.
            </p>
          </div>
        </section>

        <footer style={S.footer}>
          <span>Plotkraft</span>
          <span style={{ color: '#4a5260' }}>·</span>
          <span>Gemini on Vertex AI + Parallel Search</span>
        </footer>
      </main>
    </>
  );
}

function SectionHead({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div style={S.sectionHead}>
      <div style={S.kicker}>{kicker}</div>
      <h2 style={S.h2}>{title}</h2>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  main: {
    background: '#0f1216', color: '#e8eaed', minHeight: '100vh',
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif',
  },
  hero: {
    maxWidth: 1000, margin: '0 auto', padding: '108px 32px 92px', textAlign: 'center',
  },
  eyebrow: {
    color: '#7aa2e3', fontSize: 13, letterSpacing: 2,
    textTransform: 'uppercase', marginBottom: 26,
  },
  // clamp keeps the headline large on a wide monitor without breaking a laptop.
  h1: {
    fontSize: 'clamp(44px, 5.4vw, 76px)', fontWeight: 700, margin: 0,
    letterSpacing: -2, lineHeight: 1.08,
  },
  h1Accent: {
    background: 'linear-gradient(92deg, #4f9d69 0%, #7aa2e3 48%, #a03fd8 100%)',
    WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
  },
  sub: {
    color: '#b6bec9', fontSize: 'clamp(16px, 1.35vw, 21px)', lineHeight: 1.62,
    marginTop: 28, maxWidth: 780, marginLeft: 'auto', marginRight: 'auto',
  },
  heroCta: { display: 'flex', gap: 14, justifyContent: 'center', marginTop: 40, flexWrap: 'wrap' },
  primary: {
    background: '#3b6fd4', color: '#fff', borderRadius: 10, padding: '15px 30px',
    fontSize: 16, fontWeight: 600, textDecoration: 'none',
  },
  secondary: {
    color: '#9aa4b2', border: '1px solid #2a2f38', borderRadius: 10,
    padding: '15px 30px', fontSize: 16, textDecoration: 'none',
  },
  compare: {
    marginTop: 46, color: '#78828f', fontSize: 15, lineHeight: 1.6,
    borderTop: '1px solid #1c2129', paddingTop: 28,
    maxWidth: 700, marginLeft: 'auto', marginRight: 'auto',
  },
  band: { maxWidth: 1340, margin: '0 auto', padding: '76px 32px' },
  sectionHead: { marginBottom: 44 },
  kicker: {
    color: '#7aa2e3', fontSize: 13, letterSpacing: 1.9,
    textTransform: 'uppercase', marginBottom: 14,
  },
  h2: { fontSize: 'clamp(28px, 2.7vw, 42px)', fontWeight: 700, margin: 0, letterSpacing: -1 },
  steps: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20,
  },
  step: {
    background: '#141820', border: '1px solid #222831', borderRadius: 14, padding: '28px 28px 30px',
  },
  stepNum: {
    width: 32, height: 32, borderRadius: 9, background: '#1d2634',
    color: '#7aa2e3', fontSize: 15, fontWeight: 700,
    display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18,
  },
  stepName: { fontSize: 19, fontWeight: 600, marginBottom: 9 },
  stepWhat: { color: '#8b95a3', fontSize: 15, lineHeight: 1.62 },
  features: { display: 'flex', flexDirection: 'column', gap: 24 },
  feature: {
    display: 'flex', gap: 56, alignItems: 'center', flexWrap: 'wrap',
    background: '#12151a', border: '1px solid #1e242c', borderRadius: 16, padding: '44px 48px',
  },
  featureText: { flex: '1 1 420px', minWidth: 320 },
  agentTag: {
    display: 'inline-block', border: '1px solid', borderRadius: 6,
    padding: '4px 11px', fontSize: 12.5, fontWeight: 600,
    letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 20,
  },
  featureTitle: { fontSize: 'clamp(22px, 2vw, 30px)', fontWeight: 650, margin: '0 0 16px', letterSpacing: -0.6 },
  featureBody: { color: '#b6bec9', fontSize: 17, lineHeight: 1.68, margin: '0 0 20px' },
  footnote: {
    color: '#6f7986', fontSize: 14, lineHeight: 1.6, margin: 0,
    borderLeft: '2px solid #232a33', paddingLeft: 16,
  },
  figure: {
    flex: '1 1 460px', minWidth: 340,
    background: '#0f1216', border: '1px solid #1e242c', borderRadius: 14, padding: 34,
  },
  stance: {
    background: '#12151a', border: '1px solid #1e242c', borderRadius: 16, padding: '52px 54px 46px',
  },
  stanceBody: { color: '#b6bec9', fontSize: 18, lineHeight: 1.72, margin: '0 0 22px', maxWidth: 900 },
  footer: {
    borderTop: '1px solid #1c2129', marginTop: 48, padding: '38px 32px 60px',
    display: 'flex', gap: 12, justifyContent: 'center',
    color: '#6f7986', fontSize: 14, flexWrap: 'wrap',
  },
};

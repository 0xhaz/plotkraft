#!/usr/bin/env node
/**
 * Build a fully-analysed demo project, from nothing, in one command.
 *
 * Signs in the local dev user against the Auth emulator, imports the sample
 * screenplay through the real API (so it goes through the same auth and
 * membership checks a browser does), then runs every agent and prints the canvas
 * URL.
 *
 * Reproducible demo data matters for more than convenience: hand-built state
 * disappears the moment the emulator is cleared, and the demo recording needs a
 * canvas that looks the same every take.
 *
 *   node scripts/seed-demo.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const API = process.env.API_BASE ?? 'http://127.0.0.1:8088';
const AUTH = process.env.AUTH_EMULATOR ?? 'http://127.0.0.1:9099';
const PROJECT = process.env.GCP_PROJECT_ID ?? 'plotkraft-agentic';
const WEB = process.env.WEB_BASE ?? 'http://localhost:3001';

// Must match DEV_USER in apps/web/src/lib/useAuth.ts so the browser's
// "Dev sign-in" lands on the same account that owns this project.
const DEV_USER = { email: 'writer@plotkraft.local', password: 'plotkraft-dev' };

const NOTE_BATCHES = [
  ['producer', 'Dana Whitfield', 'samples/notes/producer.md'],
  ['executive', 'Marcus Reyes', 'samples/notes/executive.md'],
  ['peer', 'Tomas Lind', 'samples/notes/peer.md'],
  ['coverage', 'Reader #4471', 'samples/notes/coverage.md'],
];

const step = (msg) => process.stdout.write(`  ${msg}… `);
const done = (detail = 'ok') => console.log(detail);

async function idToken() {
  const url = (op) => `${AUTH}/identitytoolkit.googleapis.com/v1/accounts:${op}?key=demo-key`;
  const body = JSON.stringify({ ...DEV_USER, returnSecureToken: true });
  const headers = { 'content-type': 'application/json' };

  let res = await fetch(url('signInWithPassword'), { method: 'POST', headers, body });
  if (!res.ok) res = await fetch(url('signUp'), { method: 'POST', headers, body });

  const json = await res.json();
  if (!json.idToken) throw new Error(`Auth emulator refused: ${JSON.stringify(json)}`);
  return json.idToken;
}

async function main() {
  console.log(`\nSeeding demo data (project ${PROJECT})\n`);

  step('signing in dev user');
  const token = await idToken();
  const auth = { Authorization: `Bearer ${token}`, 'content-type': 'application/json' };
  done(DEV_USER.email);

  const post = async (path, payload) => {
    const res = await fetch(`${API}${path}`, {
      method: 'POST',
      headers: auth,
      ...(payload ? { body: JSON.stringify(payload) } : {}),
    });
    if (!res.ok) {
      throw new Error(`${path} -> ${res.status} ${(await res.text()).slice(0, 200)}`);
    }
    return res.json();
  };

  step('importing sample screenplay');
  const source = readFileSync(join(ROOT, 'samples/the-quiet-part.fountain'), 'utf8');
  const { projectId, sceneCount } = await post('/projects/import', {
    source,
    title: 'The Quiet Part',
    mode: 'original',
  });
  done(`${sceneCount} scenes`);

  step('Story Logic (causal graph)');
  const causality = await post(`/projects/${projectId}/agents/causality`);
  done(`${causality.edges} transitions`);

  step('Story Circle (structure)');
  const circle = await post(`/projects/${projectId}/agents/story-circle`);
  done(`${circle.assigned} scenes placed, ${circle.diagnostics.length} findings`);

  step('ingesting notes');
  for (const [src, author, file] of NOTE_BATCHES) {
    await post(`/projects/${projectId}/agents/notes`, {
      source: src,
      author,
      body: readFileSync(join(ROOT, file), 'utf8'),
    });
  }
  done(`${NOTE_BATCHES.length} sources`);

  step('reconciling notes');
  const notes = await post(`/projects/${projectId}/agents/notes/reconcile`);
  done(`${notes.notes} notes, ${notes.conflicts} conflicts`);

  step('Researcher (Parallel Search)');
  try {
    const research = await post(`/projects/${projectId}/agents/research`);
    done(`${research.claims} claims, ${research.flags} flags`);
  } catch (err) {
    // The rest of the demo is still usable without a Parallel key.
    done(`skipped (${String(err.message).slice(0, 80)})`);
  }

  step('sequences');
  const seq = await post(`/projects/${projectId}/agents/sequences`);
  done(`${seq.sequences} named sequences`);

  step('Continuity (bible + contradictions)');
  const cont = await post(`/projects/${projectId}/agents/continuity`);
  done(`${cont.facts} facts, ${cont.compared} compared, ${cont.contradictions} flagged`);

  // Rate-limited and pre-generated on purpose: never drawn during a demo.
  step('storyboard panels');
  try {
    const boards = await post(`/projects/${projectId}/agents/boards`, { panels: 6 });
    done(`${boards.drawn} of ${boards.requested} drawn`);
  } catch (err) {
    done(`skipped (${String(err.message).slice(0, 80)})`);
  }

  // A second project in reference mode, so the Craft agent has somewhere to run.
  // Same original screenplay: the demo must not put anyone else's work on screen.
  console.log('');
  step('reference copy for the Craft agent');
  const ref = await post('/projects/import', {
    source,
    title: 'The Quiet Part — reference',
    mode: 'reference',
  });
  done(`${ref.sceneCount} scenes`);

  step('Story Circle on the reference');
  await post(`/projects/${ref.projectId}/agents/story-circle`);
  done();

  step('Craft (what makes it work)');
  const craft = await post(`/projects/${ref.projectId}/agents/craft`);
  done(`${craft.lessons} scenes annotated`);

  console.log(`\n  Your draft   ${WEB}/project/${projectId}`);
  console.log(`  Script view  ${WEB}/project/${projectId}/script`);
  console.log(`  Reference    ${WEB}/project/${ref.projectId}`);
  console.log('\n  Sign in with "Dev sign-in" to open them.\n');
}

main().catch((err) => {
  console.error(`\nSeed failed: ${err.message}\n`);
  process.exit(1);
});

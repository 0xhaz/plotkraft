import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, addDoc } from 'firebase/firestore';

/**
 * Exercises firestore.rules against the emulator.
 *
 * These rules are the authorization model for everything the browser reads
 * directly, so "the app seems to work" is not evidence they are correct — a rule
 * that is too permissive looks identical from inside the app.
 *
 * Requires the Firestore emulator (pnpm emulators).
 */
const PROJECT_ID = 'plotkraft-rules-test';
const OWNER = 'writer-uid';
const MEMBER = 'collaborator-uid';
const STRANGER = 'stranger-uid';
const PID = 'project-1';
const SID = 'scene-1';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      host: '127.0.0.1',
      port: 8181,
      rules: readFileSync(join(__dirname, '../../../../firestore.rules'), 'utf8'),
    },
  });
});

afterAll(async () => env?.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'projects', PID), {
      id: PID,
      title: 'The Quiet Part',
      ownerUid: OWNER,
      memberUids: [OWNER, MEMBER],
    });
    await setDoc(doc(db, 'projects', PID, 'scenes', SID), {
      id: SID,
      index: 0,
      heading: 'INT. NEWSROOM - NIGHT',
      version: 1,
    });
    await setDoc(doc(db, 'projects', PID, 'scenes', SID, 'flags', 'flag-1'), {
      id: 'flag-1',
      agent: 'Researcher',
      message: 'check this',
      verdict: 'pending',
    });
    await setDoc(doc(db, 'projects', PID, 'scenes', SID, 'annotations', 'note-1'), {
      id: 'note-1',
      authorUid: MEMBER,
      body: 'this beat lands',
    });
  });
});

const asMember = () => env.authenticatedContext(MEMBER).firestore();
const asStranger = () => env.authenticatedContext(STRANGER).firestore();
const asAnon = () => env.unauthenticatedContext().firestore();

describe('project access', () => {
  it('lets a member read the project', async () => {
    await assertSucceeds(getDoc(doc(asMember(), 'projects', PID)));
  });

  it('denies a non-member', async () => {
    await assertFails(getDoc(doc(asStranger(), 'projects', PID)));
  });

  it('denies an anonymous reader', async () => {
    await assertFails(getDoc(doc(asAnon(), 'projects', PID)));
  });

  it('denies a non-member reading scenes', async () => {
    await assertFails(getDoc(doc(asStranger(), 'projects', PID, 'scenes', SID)));
  });
});

describe('scene version guard', () => {
  it('accepts an edit that advances version by exactly one', async () => {
    await assertSucceeds(
      updateDoc(doc(asMember(), 'projects', PID, 'scenes', SID), { heading: 'INT. NEWSROOM - DAY', version: 2 }),
    );
  });

  it('rejects a stale write that leaves version unchanged', async () => {
    await assertFails(
      updateDoc(doc(asMember(), 'projects', PID, 'scenes', SID), { heading: 'clobbered' }),
    );
  });

  it('rejects a write that skips versions', async () => {
    await assertFails(
      updateDoc(doc(asMember(), 'projects', PID, 'scenes', SID), { heading: 'x', version: 7 }),
    );
  });
});

describe('annotations are append-only', () => {
  it('lets a member add their own annotation', async () => {
    await assertSucceeds(
      addDoc(collection(asMember(), 'projects', PID, 'scenes', SID, 'annotations'), {
        authorUid: MEMBER,
        body: 'new comment',
      }),
    );
  });

  it('stops a member forging another author', async () => {
    await assertFails(
      addDoc(collection(asMember(), 'projects', PID, 'scenes', SID, 'annotations'), {
        authorUid: OWNER,
        body: 'not mine to write',
      }),
    );
  });

  it('stops anyone editing an existing comment', async () => {
    await assertFails(
      updateDoc(doc(asMember(), 'projects', PID, 'scenes', SID, 'annotations', 'note-1'), {
        body: 'rewritten history',
      }),
    );
  });

  it('stops anyone deleting a comment', async () => {
    await assertFails(
      deleteDoc(doc(asMember(), 'projects', PID, 'scenes', SID, 'annotations', 'note-1')),
    );
  });
});

describe('agents keep their own lane', () => {
  it('lets a member record a verdict on a flag', async () => {
    await assertSucceeds(
      updateDoc(doc(asMember(), 'projects', PID, 'scenes', SID, 'flags', 'flag-1'), {
        verdict: 'dismissed',
        verdictAt: Date.now(),
      }),
    );
  });

  it('stops a member rewriting what the agent said', async () => {
    await assertFails(
      updateDoc(doc(asMember(), 'projects', PID, 'scenes', SID, 'flags', 'flag-1'), {
        message: 'the agent never said this',
      }),
    );
  });

  it('stops a client fabricating an agent flag', async () => {
    await assertFails(
      addDoc(collection(asMember(), 'projects', PID, 'scenes', SID, 'flags'), {
        agent: 'Researcher',
        message: 'invented finding',
        verdict: 'pending',
      }),
    );
  });

  it('stops a non-member touching flags at all', async () => {
    await assertFails(
      updateDoc(doc(asStranger(), 'projects', PID, 'scenes', SID, 'flags', 'flag-1'), {
        verdict: 'accepted',
      }),
    );
  });
});

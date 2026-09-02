'use client';

import { API_BASE, auth } from './firebase';

/**
 * Every API call carries the caller's Firebase ID token. The API verifies it and
 * derives identity from it — the client never asserts who it is.
 */
async function authedFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const user = auth().currentUser;
  if (!user) throw new Error('Not signed in');
  const token = await user.getIdToken();

  return fetch(url, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${token}`,
    },
  });
}

export interface WhatIfImpact {
  dirtySceneIds: string[];
  orphanedPayoffs: { sceneId: string; lostSetupIds: string[] }[];
  unexplainedCharacters: { character: string; firstAppearanceSceneId: string }[];
  brokenEdgeIds: string[];
  loadDeltas: { sceneId: string; before: number; after: number }[];
}

export async function simulateCut(
  projectId: string,
  removedSceneIds: string[],
): Promise<WhatIfImpact> {
  const res = await authedFetch(`${API_BASE}/projects/${projectId}/agents/what-if`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ removedSceneIds }),
  });
  if (!res.ok) throw new Error(`what-if failed (${res.status})`);
  return res.json();
}

export async function runCausality(projectId: string): Promise<{ edges: number; scenes: number }> {
  const res = await authedFetch(`${API_BASE}/projects/${projectId}/agents/causality`, { method: 'POST' });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `causality failed (${res.status})`);
  }
  return res.json();
}

export async function agentStatus(projectId: string): Promise<{ gemini: boolean; parallel: boolean }> {
  const res = await authedFetch(`${API_BASE}/projects/${projectId}/agents/status`);
  return res.json();
}

export async function runResearch(projectId: string): Promise<{ claims: number; flags: number }> {
  const res = await authedFetch(`${API_BASE}/projects/${projectId}/agents/research`, { method: 'POST' });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `research failed (${res.status})`);
  }
  return res.json();
}

export interface CircleResult {
  assigned: number;
  shares: Record<string, number>;
  goThreshold: number | null;
  returnThreshold: number | null;
  diagnostics: { kind: string; severity: string; step?: number; message: string }[];
}

export async function runStoryCircle(projectId: string): Promise<CircleResult> {
  const res = await authedFetch(`${API_BASE}/projects/${projectId}/agents/story-circle`, {
    method: 'POST',
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `story circle failed (${res.status})`);
  }
  return res.json();
}

export async function reconcileNotes(
  projectId: string,
): Promise<{ notes: number; conflicts: number; unmapped: number }> {
  const res = await authedFetch(`${API_BASE}/projects/${projectId}/agents/notes/reconcile`, {
    method: 'POST',
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `reconcile failed (${res.status})`);
  }
  return res.json();
}

export async function runCraftAnalysis(
  projectId: string,
): Promise<{ scenes: number; lessons: number }> {
  const res = await authedFetch(`${API_BASE}/projects/${projectId}/agents/craft`, {
    method: 'POST',
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `craft analysis failed (${res.status})`);
  }
  return res.json();
}

export async function findSequences(
  projectId: string,
): Promise<{ sequences: number; scenes: number }> {
  const res = await authedFetch(`${API_BASE}/projects/${projectId}/agents/sequences`, {
    method: 'POST',
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `sequence pass failed (${res.status})`);
  }
  return res.json();
}

export async function generateBoards(
  projectId: string,
  scope: { panels?: number; sceneIds?: string[]; act?: number },
): Promise<{ requested: number; drawn: number; failed: number }> {
  const res = await authedFetch(`${API_BASE}/projects/${projectId}/agents/boards`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(scope),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `boarding failed (${res.status})`);
  }
  return res.json();
}

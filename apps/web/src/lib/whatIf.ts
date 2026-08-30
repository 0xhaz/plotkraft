'use client';

import { API_BASE } from './firebase';

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
  const res = await fetch(`${API_BASE}/projects/${projectId}/agents/what-if`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ removedSceneIds }),
  });
  if (!res.ok) throw new Error(`what-if failed (${res.status})`);
  return res.json();
}

export async function runCausality(projectId: string): Promise<{ edges: number; scenes: number }> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/agents/causality`, { method: 'POST' });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `causality failed (${res.status})`);
  }
  return res.json();
}

export async function agentStatus(projectId: string): Promise<{ gemini: boolean; parallel: boolean }> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/agents/status`);
  return res.json();
}

export async function runResearch(projectId: string): Promise<{ claims: number; flags: number }> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/agents/research`, { method: 'POST' });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `research failed (${res.status})`);
  }
  return res.json();
}

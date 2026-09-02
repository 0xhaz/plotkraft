'use client';

import { useEffect, useState } from 'react';
import { ref, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';

/**
 * Resolve a stored panel to a URL the browser can show.
 *
 * Panels live in Cloud Storage rather than Firestore — a PNG is well past the
 * 1MB document limit — so the path on the scene has to be exchanged for a signed
 * URL. Results are cached per path: the board view asks for the same panel from
 * both the card and the detail panel, and a feature's worth of duplicate
 * requests is a lot of round trips for one image.
 */
const cache = new Map<string, string>();

export function useBoardUrl(path?: string): string | null {
  const [url, setUrl] = useState<string | null>(path ? (cache.get(path) ?? null) : null);

  useEffect(() => {
    if (!path) {
      setUrl(null);
      return;
    }
    const hit = cache.get(path);
    if (hit) {
      setUrl(hit);
      return;
    }

    let cancelled = false;
    getDownloadURL(ref(storage(), path))
      .then((resolved) => {
        cache.set(path, resolved);
        if (!cancelled) setUrl(resolved);
      })
      .catch((err) => {
        // A missing panel is not worth breaking the board over.
        console.error('[board] could not resolve panel', path, err);
      });

    return () => {
      cancelled = true;
    };
  }, [path]);

  return url;
}

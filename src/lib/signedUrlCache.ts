/**
 * Session-scoped cache for Supabase signed image URLs.
 * Reusing the same URL string lets the browser HTTP-cache image bytes
 * across reloads and scroll-away / scroll-back.
 */

export type CachedSignedUrls = {
  full?: string;
  thumb?: string;
  /** Epoch ms — stop serving after this (skewed before real JWT expiry). */
  expiresAt: number;
};

const STORAGE_KEY = 'techlib.signedUrlCache.v1';
/** Drop cache entries this long before the signed TTL ends. */
const EXPIRY_SKEW_MS = 60 * 60 * 1000; // 1h

const memory = new Map<string, CachedSignedUrls>();
let hydrated = false;

function canUseSessionStorage(): boolean {
  try {
    return typeof sessionStorage !== 'undefined';
  } catch {
    return false;
  }
}

function hydrateFromSession() {
  if (hydrated) return;
  hydrated = true;
  if (!canUseSessionStorage()) return;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, CachedSignedUrls>;
    const now = Date.now();
    for (const [path, entry] of Object.entries(parsed)) {
      if (!entry || typeof entry.expiresAt !== 'number') continue;
      if (entry.expiresAt <= now) continue;
      memory.set(path, entry);
    }
  } catch {
    // ignore corrupt cache
  }
}

function persistToSession() {
  if (!canUseSessionStorage()) return;
  try {
    const now = Date.now();
    const out: Record<string, CachedSignedUrls> = {};
    for (const [path, entry] of memory) {
      if (entry.expiresAt <= now) {
        memory.delete(path);
        continue;
      }
      out[path] = entry;
    }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(out));
  } catch {
    // quota / private mode — memory cache still works
  }
}

export function getCachedSignedUrls(path: string): CachedSignedUrls | null {
  hydrateFromSession();
  const entry = memory.get(path);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    memory.delete(path);
    return null;
  }
  return entry;
}

export function putCachedSignedUrls(
  path: string,
  patch: { full?: string; thumb?: string },
  ttlSec: number,
): void {
  hydrateFromSession();
  const prev = memory.get(path);
  const expiresAt = Date.now() + Math.max(60, ttlSec) * 1000 - EXPIRY_SKEW_MS;
  memory.set(path, {
    full: patch.full ?? prev?.full,
    thumb: patch.thumb ?? prev?.thumb,
    expiresAt: Math.max(expiresAt, prev?.expiresAt ?? 0),
  });
  persistToSession();
}

export function forgetCachedSignedUrl(path: string): void {
  hydrateFromSession();
  memory.delete(path);
  persistToSession();
}

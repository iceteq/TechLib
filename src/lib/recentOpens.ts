const STORAGE_KEY = 'techlib.recentOpens';
const MAX_ENTRIES = 200;

export type RecentOpensMap = Record<string, number>;

export function loadRecentOpens(): RecentOpensMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as RecentOpensMap;
    if (!parsed || typeof parsed !== 'object') return {};
    const next: RecentOpensMap = {};
    for (const [id, ts] of Object.entries(parsed)) {
      if (typeof ts === 'number' && Number.isFinite(ts)) next[id] = ts;
    }
    return next;
  } catch {
    return {};
  }
}

function saveRecentOpens(map: RecentOpensMap) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore quota / private mode
  }
}

/** Record that a note was opened; returns the updated map. */
export function touchRecentOpen(
  noteId: string,
  map: RecentOpensMap = loadRecentOpens(),
  at = Date.now(),
): RecentOpensMap {
  const next: RecentOpensMap = { ...map, [noteId]: at };
  const entries = Object.entries(next).sort((a, b) => b[1] - a[1]);
  const trimmed =
    entries.length > MAX_ENTRIES
      ? Object.fromEntries(entries.slice(0, MAX_ENTRIES))
      : next;
  saveRecentOpens(trimmed);
  return trimmed;
}

export function usefulAt(
  noteId: string,
  updatedAt: number,
  openedAtById: RecentOpensMap,
): number {
  const opened = openedAtById[noteId] ?? 0;
  return Math.max(opened, updatedAt);
}

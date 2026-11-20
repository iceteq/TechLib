import type { NoteWithUrls } from './types';
import type { RecentOpensMap } from './recentOpens';
import { usefulAt } from './recentOpens';
import { noteActivityAt } from './noteActivity';
import type { WallSort } from './viewPrefs';

/** Pin-first comparator used by the wall and optimistic list reorders. */
export function compareWallNotes(a: NoteWithUrls, b: NoteWithUrls): number {
  if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
  const activityDiff = noteActivityAt(b) - noteActivityAt(a);
  if (activityDiff !== 0) return activityDiff;
  return b.createdAt - a.createdAt;
}

/** Pin-first wall ordering for browse (search relevance handled separately). */
export function sortWallNotes(
  notes: NoteWithUrls[],
  sort: WallSort,
  openedAtById: RecentOpensMap,
): NoteWithUrls[] {
  return [...notes].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    if (sort === 'recent') {
      const usefulDiff =
        usefulAt(b.id, noteActivityAt(b), openedAtById) -
        usefulAt(a.id, noteActivityAt(a), openedAtById);
      if (usefulDiff !== 0) return usefulDiff;
    }
    return compareWallNotes(a, b);
  });
}

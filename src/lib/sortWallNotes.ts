import type { NoteWithUrls } from './types';
import type { RecentOpensMap } from './recentOpens';
import { usefulAt } from './recentOpens';
import type { WallSort } from './viewPrefs';

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
        usefulAt(b.id, b.updatedAt, openedAtById) -
        usefulAt(a.id, a.updatedAt, openedAtById);
      if (usefulDiff !== 0) return usefulDiff;
    }
    const editedDiff = b.updatedAt - a.updatedAt;
    if (editedDiff !== 0) return editedDiff;
    return b.createdAt - a.createdAt;
  });
}

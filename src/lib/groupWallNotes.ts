import type { NoteType, NoteWithUrls, StockLocation } from './types';
import { noteTypePathLabel } from './noteTypes';
import type { WallGroupBy } from './viewPrefs';

export type WallGroup = {
  /** Stable key for React; null bucket uses `__none__`. */
  id: string;
  label: string;
  notes: NoteWithUrls[];
};

const NONE_KEY = '__none__';

function compareLabels(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: 'base' });
}

/**
 * Cluster an already-sorted note list into wall sections.
 * Preserves relative order within each group (caller sorts first).
 * Empty groups are omitted; the unset bucket is last.
 */
export function groupWallNotes(
  notes: NoteWithUrls[],
  groupBy: WallGroupBy,
  noteTypes: NoteType[],
  stockLocations: StockLocation[],
): WallGroup[] {
  if (groupBy === 'none' || notes.length === 0) {
    return [{ id: 'all', label: '', notes }];
  }

  const buckets = new Map<string, NoteWithUrls[]>();
  const labels = new Map<string, string>();

  for (const note of notes) {
    let key: string;
    let label: string;

    if (groupBy === 'type') {
      const categoryId = note.categoryId;
      if (!categoryId) {
        key = NONE_KEY;
        label = 'No type';
      } else {
        key = categoryId;
        label = noteTypePathLabel(noteTypes, categoryId) ?? 'Unknown type';
      }
    } else {
      const stockId = note.stockId;
      if (!stockId) {
        key = NONE_KEY;
        label = 'No stock';
      } else {
        key = stockId;
        const stock = stockLocations.find((s) => s.id === stockId);
        label = stock?.name ?? 'Unknown stock';
      }
    }

    const list = buckets.get(key);
    if (list) list.push(note);
    else buckets.set(key, [note]);
    labels.set(key, label);
  }

  const groups: WallGroup[] = [];
  let noneGroup: WallGroup | null = null;

  const keys = [...buckets.keys()].sort((a, b) => {
    if (a === NONE_KEY) return 1;
    if (b === NONE_KEY) return -1;
    return compareLabels(labels.get(a) ?? a, labels.get(b) ?? b);
  });

  for (const key of keys) {
    const groupNotes = buckets.get(key) ?? [];
    if (groupNotes.length === 0) continue;
    const group: WallGroup = {
      id: key,
      label: labels.get(key) ?? key,
      notes: groupNotes,
    };
    if (key === NONE_KEY) noneGroup = group;
    else groups.push(group);
  }

  if (noneGroup) groups.push(noneGroup);
  return groups;
}

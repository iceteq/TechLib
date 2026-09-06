import type {
  Label,
  NoteDisposition,
  NoteType,
  NoteWithUrls,
  NotesView,
  Reaction,
  StockLocation,
} from './types';
import { DISPOSITIONS, UNSET_STOCK_FILTER, UNSET_TYPE_FILTER } from './types';
import { noteTypeLabel } from './noteTypes';

export function matchesNoteSearch(
  note: NoteWithUrls,
  labels: Label[],
  stockLocations: StockLocation[],
  noteTypes: NoteType[],
  query: string,
): boolean {
  return noteSearchRank(note, labels, stockLocations, noteTypes, query) >= 0;
}

/** Higher is better; -1 means no match. Prefer part-number/title hits. */
export function noteSearchRank(
  note: NoteWithUrls,
  labels: Label[],
  stockLocations: StockLocation[],
  noteTypes: NoteType[],
  query: string,
): number {
  const q = query.trim().toLowerCase();
  if (!q) return 0;

  const title = note.title.toLowerCase();
  if (title === q) return 100;
  if (title.startsWith(q)) return 90;
  if (title.includes(q)) return 80;

  const description = note.description.toLowerCase();
  if (description.includes(q)) return 50;

  if ((note.specialCase ?? '').toLowerCase().includes(q)) return 40;

  const disposition = DISPOSITIONS.find(
    (d) => d.id === (note.disposition ?? 'none'),
  );
  if (disposition) {
    if (
      disposition.label.toLowerCase().includes(q) ||
      disposition.short.toLowerCase().includes(q) ||
      (disposition.id !== 'none' && disposition.id.includes(q))
    ) {
      return 35;
    }
  }

  const typeName = noteTypeLabel(noteTypes, note.categoryId);
  if (typeName && typeName.toLowerCase().includes(q)) return 30;

  const stock = stockLocations.find((s) => s.id === note.stockId);
  if (stock && stock.name.toLowerCase().includes(q)) return 30;

  const noteLabels = labels.filter((l) => note.labelIds.includes(l.id));
  if (
    noteLabels.some((l) => {
      const name = l.name.toLowerCase();
      return name.includes(q) || `#${name}`.includes(q);
    })
  ) {
    return 20;
  }

  return -1;
}

export function filterNotes(
  notes: NoteWithUrls[],
  labels: Label[],
  stockLocations: StockLocation[],
  noteTypes: NoteType[],
  options: {
    labelIds: string[];
    search: string;
    view: NotesView;
    disposition: NoteDisposition | null;
    /** Type id, UNSET_TYPE_FILTER for no type, or null for any. */
    categoryId: string | null;
    /** Stock id, UNSET_STOCK_FILTER for no stock, or null for any. */
    stockId: string | null;
    specialCasesOnly?: boolean;
  },
): NoteWithUrls[] {
  const filtered = notes.filter((note) => {
    if (options.view === 'cart') return false;
    if (options.view === 'archive' ? !note.archived : note.archived) {
      return false;
    }
    if (
      options.labelIds.length > 0 &&
      !options.labelIds.every((id) => note.labelIds.includes(id))
    ) {
      return false;
    }
    if (options.disposition && note.disposition !== options.disposition) {
      return false;
    }
    if (options.categoryId === UNSET_TYPE_FILTER) {
      if (note.categoryId) return false;
    } else if (options.categoryId && note.categoryId !== options.categoryId) {
      return false;
    }
    if (options.stockId === UNSET_STOCK_FILTER) {
      if (note.stockId) return false;
    } else if (options.stockId && note.stockId !== options.stockId) {
      return false;
    }
    if (options.specialCasesOnly && !(note.specialCase ?? '').trim()) {
      return false;
    }
    return matchesNoteSearch(
      note,
      labels,
      stockLocations,
      noteTypes,
      options.search,
    );
  });

  const q = options.search.trim();
  if (!q) {
    return [...filtered].sort((a, b) => b.updatedAt - a.updatedAt);
  }

  return [...filtered].sort((a, b) => {
    const rankA = noteSearchRank(a, labels, stockLocations, noteTypes, q);
    const rankB = noteSearchRank(b, labels, stockLocations, noteTypes, q);
    if (rankB !== rankA) return rankB - rankA;
    return b.updatedAt - a.updatedAt;
  });
}

export function reactionsForNote(
  reactions: Reaction[],
  noteId: string,
): Reaction[] {
  return reactions.filter((r) => r.noteId === noteId);
}

export function dispositionLabel(id: NoteDisposition | null): string | null {
  if (!id) return null;
  return DISPOSITIONS.find((d) => d.id === id)?.short || null;
}

export function categoryLabel(
  categoryId: string | null,
  noteTypes: NoteType[],
): string | null {
  if (!categoryId || categoryId === UNSET_TYPE_FILTER) {
    return categoryId === UNSET_TYPE_FILTER ? 'No type' : null;
  }
  return noteTypeLabel(noteTypes, categoryId);
}

export function stockLabel(
  stockId: string | null,
  stockLocations: StockLocation[],
): string | null {
  if (!stockId || stockId === UNSET_STOCK_FILTER) {
    return stockId === UNSET_STOCK_FILTER ? 'No stock' : null;
  }
  return stockLocations.find((s) => s.id === stockId)?.name ?? null;
}

/** Counts of active (non-archived, non-deleted) notes per type + unset. */
export function countNotesByType(notes: NoteWithUrls[]): {
  byTypeId: Record<string, number>;
  unset: number;
} {
  const byTypeId: Record<string, number> = {};
  let unset = 0;
  for (const note of notes) {
    if (note.archived || note.deletedAt != null) continue;
    if (!note.categoryId) {
      unset += 1;
      continue;
    }
    byTypeId[note.categoryId] = (byTypeId[note.categoryId] ?? 0) + 1;
  }
  return { byTypeId, unset };
}

/** Counts of active notes per label id. */
export function countNotesByLabel(
  notes: NoteWithUrls[],
): Record<string, number> {
  const byLabelId: Record<string, number> = {};
  for (const note of notes) {
    if (note.archived || note.deletedAt != null) continue;
    for (const labelId of note.labelIds) {
      byLabelId[labelId] = (byLabelId[labelId] ?? 0) + 1;
    }
  }
  return byLabelId;
}

/** Counts of active notes per stock location id + unset. */
export function countNotesByStock(notes: NoteWithUrls[]): {
  byStockId: Record<string, number>;
  unset: number;
} {
  const byStockId: Record<string, number> = {};
  let unset = 0;
  for (const note of notes) {
    if (note.archived || note.deletedAt != null) continue;
    if (!note.stockId) {
      unset += 1;
      continue;
    }
    byStockId[note.stockId] = (byStockId[note.stockId] ?? 0) + 1;
  }
  return { byStockId, unset };
}

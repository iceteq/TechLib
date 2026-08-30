import type {
  Label,
  NoteDisposition,
  NoteType,
  NoteWithUrls,
  NotesView,
  Reaction,
  StockLocation,
} from './types';
import { DISPOSITIONS, UNSET_TYPE_FILTER } from './types';
import { noteTypeLabel } from './noteTypes';

export function matchesNoteSearch(
  note: NoteWithUrls,
  labels: Label[],
  stockLocations: StockLocation[],
  noteTypes: NoteType[],
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  if (note.title.toLowerCase().includes(q)) return true;
  if (note.description.toLowerCase().includes(q)) return true;
  if (note.specialCase?.toLowerCase().includes(q)) return true;
  if (note.disposition !== 'none' && note.disposition.includes(q)) return true;

  const typeName = noteTypeLabel(noteTypes, note.categoryId);
  if (typeName && typeName.toLowerCase().includes(q)) return true;

  const stock = stockLocations.find((s) => s.id === note.stockId);
  if (stock && stock.name.toLowerCase().includes(q)) return true;

  const noteLabels = labels.filter((l) => note.labelIds.includes(l.id));
  return noteLabels.some((l) => {
    const name = l.name.toLowerCase();
    return name.includes(q) || `#${name}`.includes(q);
  });
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
    stockId: string | null;
    specialCasesOnly?: boolean;
  },
): NoteWithUrls[] {
  return notes.filter((note) => {
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
    if (options.stockId && note.stockId !== options.stockId) {
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
  if (!stockId) return null;
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
export function countNotesByLabel(notes: NoteWithUrls[]): Record<string, number> {
  const byLabelId: Record<string, number> = {};
  for (const note of notes) {
    if (note.archived || note.deletedAt != null) continue;
    for (const labelId of note.labelIds) {
      byLabelId[labelId] = (byLabelId[labelId] ?? 0) + 1;
    }
  }
  return byLabelId;
}

/** Counts of active notes per stock location id. */
export function countNotesByStock(notes: NoteWithUrls[]): Record<string, number> {
  const byStockId: Record<string, number> = {};
  for (const note of notes) {
    if (note.archived || note.deletedAt != null) continue;
    if (!note.stockId) continue;
    byStockId[note.stockId] = (byStockId[note.stockId] ?? 0) + 1;
  }
  return byStockId;
}

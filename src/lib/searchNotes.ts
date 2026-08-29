import type {
  Label,
  NoteCategory,
  NoteDisposition,
  NoteWithUrls,
  NotesView,
  Reaction,
  StockLocation,
} from './types';
import { CATEGORIES, DISPOSITIONS } from './types';

export function matchesNoteSearch(
  note: NoteWithUrls,
  labels: Label[],
  stockLocations: StockLocation[],
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  if (note.title.toLowerCase().includes(q)) return true;
  if (note.description.toLowerCase().includes(q)) return true;
  if (note.specialCase?.toLowerCase().includes(q)) return true;
  if (note.disposition !== 'none' && note.disposition.includes(q)) return true;

  const category = CATEGORIES.find((c) => c.id === (note.category ?? 'none'));
  if (
    category &&
    category.id !== 'none' &&
    category.label.toLowerCase().includes(q)
  ) {
    return true;
  }

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
  options: {
    labelIds: string[];
    search: string;
    view: NotesView;
    disposition: NoteDisposition | null;
    category: NoteCategory | null;
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
    if (options.category && (note.category ?? 'none') !== options.category) {
      return false;
    }
    if (options.stockId && note.stockId !== options.stockId) {
      return false;
    }
    if (options.specialCasesOnly && !(note.specialCase ?? '').trim()) {
      return false;
    }
    return matchesNoteSearch(note, labels, stockLocations, options.search);
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

export function categoryLabel(id: NoteCategory | null): string | null {
  if (!id || id === 'none') return null;
  return CATEGORIES.find((c) => c.id === id)?.label ?? null;
}

export function stockLabel(
  stockId: string | null,
  stockLocations: StockLocation[],
): string | null {
  if (!stockId) return null;
  return stockLocations.find((s) => s.id === stockId)?.name ?? null;
}

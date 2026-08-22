import type { Label, NoteDisposition, NoteWithUrls, NotesView, Reaction } from './types';

export function matchesNoteSearch(
  note: NoteWithUrls,
  labels: Label[],
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  if (note.title.toLowerCase().includes(q)) return true;
  if (note.description.toLowerCase().includes(q)) return true;
  if (note.disposition !== 'none' && note.disposition.includes(q)) return true;

  const noteLabels = labels.filter((l) => note.labelIds.includes(l.id));
  return noteLabels.some((l) => {
    const name = l.name.toLowerCase();
    return name.includes(q) || `#${name}`.includes(q);
  });
}

export function filterNotes(
  notes: NoteWithUrls[],
  labels: Label[],
  options: {
    labelId: string | null;
    search: string;
    view: NotesView;
    disposition: NoteDisposition | null;
  },
): NoteWithUrls[] {
  return notes.filter((note) => {
    if (options.view === 'archive' ? !note.archived : note.archived) {
      return false;
    }
    if (options.labelId && !note.labelIds.includes(options.labelId)) {
      return false;
    }
    if (options.disposition && note.disposition !== options.disposition) {
      return false;
    }
    return matchesNoteSearch(note, labels, options.search);
  });
}

export function reactionsForNote(
  reactions: Reaction[],
  noteId: string,
): Reaction[] {
  return reactions.filter((r) => r.noteId === noteId);
}

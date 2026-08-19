import type { Label, NoteWithUrls } from './types';

export function matchesNoteSearch(
  note: NoteWithUrls,
  labels: Label[],
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  if (note.title.toLowerCase().includes(q)) return true;
  if (note.description.toLowerCase().includes(q)) return true;

  const noteLabels = labels.filter((l) => note.labelIds.includes(l.id));
  return noteLabels.some((l) => {
    const name = l.name.toLowerCase();
    return name.includes(q) || `#${name}`.includes(q);
  });
}

export function filterNotes(
  notes: NoteWithUrls[],
  labels: Label[],
  options: { labelId: string | null; search: string },
): NoteWithUrls[] {
  return notes.filter((note) => {
    if (options.labelId && !note.labelIds.includes(options.labelId)) {
      return false;
    }
    return matchesNoteSearch(note, labels, options.search);
  });
}

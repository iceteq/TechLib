import type { NoteDisposition } from './types';

export const NOTE_DRAG_MIME = 'application/x-techlib-notes';

export type NoteAssignTarget =
  | { field: 'disposition'; value: NoteDisposition; label: string }
  | { field: 'categoryId'; value: string | null; label: string }
  | { field: 'stockId'; value: string; label: string };

interface NoteDragPayload {
  noteIds: string[];
}

export function setNoteDragData(
  dataTransfer: DataTransfer,
  noteIds: string[],
): void {
  const payload = JSON.stringify({ noteIds } satisfies NoteDragPayload);
  dataTransfer.setData(NOTE_DRAG_MIME, payload);
  dataTransfer.setData('text/plain', payload);
  dataTransfer.effectAllowed = 'copy';
}

export function isNoteDrag(dataTransfer: DataTransfer): boolean {
  return Array.from(dataTransfer.types).includes(NOTE_DRAG_MIME);
}

export function getNoteDragIds(dataTransfer: DataTransfer): string[] | null {
  const raw =
    dataTransfer.getData(NOTE_DRAG_MIME) ||
    dataTransfer.getData('text/plain');
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as NoteDragPayload;
    if (!Array.isArray(parsed.noteIds) || parsed.noteIds.length === 0) {
      return null;
    }
    return parsed.noteIds.filter((id) => typeof id === 'string' && id);
  } catch {
    return null;
  }
}

export function noteAssignPatch(target: NoteAssignTarget): {
  disposition?: NoteDisposition;
  categoryId?: string | null;
  stockId?: string | null;
} {
  if (target.field === 'disposition') {
    return { disposition: target.value };
  }
  if (target.field === 'categoryId') {
    return { categoryId: target.value };
  }
  return { stockId: target.value };
}

/** Short toast message after assigning notes via sidebar drop. */
export function describeNoteAssign(
  noteIds: string[],
  target: NoteAssignTarget,
): string {
  const count = noteIds.length;
  const noteWord = count === 1 ? 'note' : 'notes';
  const fieldLabel =
    target.field === 'disposition'
      ? 'Guideline'
      : target.field === 'categoryId'
        ? 'Type'
        : 'Stock';

  if (target.field === 'categoryId' && target.value === null) {
    return `Cleared Type on ${count} ${noteWord}`;
  }
  return `Set ${fieldLabel} to “${target.label}” on ${count} ${noteWord}`;
}

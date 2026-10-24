import type { NoteWithUrls } from './types';

/** Thrown when updateNote's expected version no longer matches the server. */
export class NoteUpdateConflictError extends Error {
  readonly noteId: string;
  readonly serverNote: NoteWithUrls | undefined;

  constructor(noteId: string, serverNote: NoteWithUrls | undefined) {
    super('Note was updated by someone else');
    this.name = 'NoteUpdateConflictError';
    this.noteId = noteId;
    this.serverNote = serverNote;
  }
}

export function isNoteUpdateConflictError(
  err: unknown,
): err is NoteUpdateConflictError {
  return err instanceof NoteUpdateConflictError;
}

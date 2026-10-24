import { getSupabase, isCloudConfigured } from './supabaseClient';

/** Client heartbeat interval — keep well under server TTL (45s). */
export const NOTE_EDIT_LOCK_HEARTBEAT_MS = 15_000;

export type NoteEditLockState = {
  held: boolean;
  mine: boolean;
  userId: string | null;
  userEmail: string;
  expiresAt: string | null;
};

function emptyLock(): NoteEditLockState {
  return {
    held: false,
    mine: false,
    userId: null,
    userEmail: '',
    expiresAt: null,
  };
}

type LockRow = {
  held: boolean;
  mine: boolean;
  user_id: string | null;
  user_email: string | null;
  expires_at: string | null;
};

function fromRow(row: LockRow | null | undefined): NoteEditLockState {
  if (!row) return emptyLock();
  return {
    held: Boolean(row.held),
    mine: Boolean(row.mine),
    userId: row.user_id ?? null,
    userEmail: (row.user_email ?? '').trim(),
    expiresAt: row.expires_at,
  };
}

function firstRow(data: unknown): LockRow | null {
  if (Array.isArray(data)) return (data[0] as LockRow | undefined) ?? null;
  if (data && typeof data === 'object') return data as LockRow;
  return null;
}

export async function claimNoteEditLock(
  noteId: string,
  takeOver = false,
): Promise<NoteEditLockState> {
  if (!isCloudConfigured()) return emptyLock();
  const { data, error } = await getSupabase().rpc('claim_note_edit_lock', {
    p_note_id: noteId,
    p_take_over: takeOver,
  });
  if (error) throw new Error(error.message);
  return fromRow(firstRow(data));
}

export async function heartbeatNoteEditLock(
  noteId: string,
): Promise<NoteEditLockState> {
  if (!isCloudConfigured()) return emptyLock();
  const { data, error } = await getSupabase().rpc('heartbeat_note_edit_lock', {
    p_note_id: noteId,
  });
  if (error) throw new Error(error.message);
  return fromRow(firstRow(data));
}

export async function releaseNoteEditLock(noteId: string): Promise<void> {
  if (!isCloudConfigured()) return;
  const { error } = await getSupabase().rpc('release_note_edit_lock', {
    p_note_id: noteId,
  });
  if (error) throw new Error(error.message);
}

export async function getNoteEditLock(
  noteId: string,
): Promise<NoteEditLockState> {
  if (!isCloudConfigured()) return emptyLock();
  const { data, error } = await getSupabase().rpc('get_note_edit_lock', {
    p_note_id: noteId,
  });
  if (error) throw new Error(error.message);
  return fromRow(firstRow(data));
}

/** Best-effort release that survives tab close when possible. */
export function releaseNoteEditLockBeacon(noteId: string): void {
  if (!isCloudConfigured()) return;
  try {
    const supabase = getSupabase();
    void supabase.rpc('release_note_edit_lock', { p_note_id: noteId });
  } catch {
    // ignore — closing / offline
  }
}

export function formatLockHolderLabel(lock: NoteEditLockState): string {
  const email = lock.userEmail.trim();
  if (email) {
    const at = email.indexOf('@');
    return at > 0 ? email.slice(0, at) : email;
  }
  if (lock.userId) return `user ${lock.userId.slice(0, 8)}`;
  return 'Someone';
}

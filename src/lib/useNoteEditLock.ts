import { useCallback, useEffect, useRef, useState } from 'react';
import { getSupabase, isCloudConfigured } from './supabaseClient';
import {
  NOTE_EDIT_LOCK_HEARTBEAT_MS,
  claimNoteEditLock,
  getNoteEditLock,
  heartbeatNoteEditLock,
  releaseNoteEditLock,
  releaseNoteEditLockBeacon,
  type NoteEditLockState,
} from './noteEditLock';

export type UseNoteEditLockResult = {
  /** Lock held by someone else (active, not expired). */
  blockedByOther: boolean;
  /** We successfully hold the lease. */
  holding: boolean;
  lock: NoteEditLockState | null;
  /** Claim still in flight for this note. */
  claiming: boolean;
  /** Claim/network failed — editing allowed (fail open). */
  claimFailed: boolean;
  takeOver: () => Promise<void>;
  refresh: () => Promise<void>;
};

const EMPTY: NoteEditLockState = {
  held: false,
  mine: false,
  userId: null,
  userEmail: '',
  expiresAt: null,
};

/**
 * Soft edit lease for the open note.
 * - `canClaim`: user may mutate this note (editor/admin authorship rules).
 * - Fail open on network errors so solo editing is never blocked.
 * - Fail closed when another member holds a live lease.
 */
export function useNoteEditLock(
  noteId: string | null,
  canClaim: boolean,
): UseNoteEditLockResult {
  const cloud = isCloudConfigured();
  const [lock, setLock] = useState<NoteEditLockState | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [claimFailed, setClaimFailed] = useState(false);
  const heldNoteRef = useRef<string | null>(null);
  const noteIdRef = useRef(noteId);
  noteIdRef.current = noteId;

  const apply = useCallback((next: NoteEditLockState) => {
    setLock(next);
    setClaimFailed(false);
  }, []);

  const refresh = useCallback(async () => {
    if (!cloud || !noteId) {
      setLock(null);
      return;
    }
    try {
      const next = await getNoteEditLock(noteId);
      if (noteIdRef.current === noteId) apply(next);
    } catch {
      // ignore refresh errors
    }
  }, [apply, cloud, noteId]);

  const takeOver = useCallback(async () => {
    if (!cloud || !noteId || !canClaim) return;
    setClaiming(true);
    try {
      const next = await claimNoteEditLock(noteId, true);
      if (noteIdRef.current !== noteId) return;
      apply(next);
      if (next.mine) heldNoteRef.current = noteId;
    } catch (err) {
      if (noteIdRef.current === noteId) {
        setClaimFailed(true);
        console.error('takeOver note edit lock failed', err);
      }
    } finally {
      if (noteIdRef.current === noteId) setClaiming(false);
    }
  }, [apply, canClaim, cloud, noteId]);

  // Claim / observe when the open note changes.
  useEffect(() => {
    if (!cloud || !noteId) {
      setLock(null);
      setClaiming(false);
      setClaimFailed(false);
      return;
    }

    let cancelled = false;
    setClaiming(true);
    setClaimFailed(false);
    setLock(null);

    void (async () => {
      try {
        if (canClaim) {
          const next = await claimNoteEditLock(noteId, false);
          if (cancelled || noteIdRef.current !== noteId) return;
          apply(next);
          if (next.mine) heldNoteRef.current = noteId;
        } else {
          const next = await getNoteEditLock(noteId);
          if (cancelled || noteIdRef.current !== noteId) return;
          apply(next);
        }
      } catch (err) {
        if (cancelled || noteIdRef.current !== noteId) return;
        // Fail open: allow editing if we cannot reach the lock service.
        setClaimFailed(true);
        setLock(EMPTY);
        console.error('claim note edit lock failed', err);
      } finally {
        if (!cancelled && noteIdRef.current === noteId) setClaiming(false);
      }
    })();

    return () => {
      cancelled = true;
      const held = heldNoteRef.current;
      if (held === noteId) {
        heldNoteRef.current = null;
        void releaseNoteEditLock(noteId).catch(() => {
          releaseNoteEditLockBeacon(noteId);
        });
      }
    };
  }, [apply, canClaim, cloud, noteId]);

  // If a foreign lease expires/releases while we still have the note open, claim it.
  useEffect(() => {
    if (!cloud || !noteId || !canClaim || claiming || claimFailed) return;
    if (!lock || lock.held || lock.mine) return;

    let cancelled = false;
    void (async () => {
      try {
        const next = await claimNoteEditLock(noteId, false);
        if (cancelled || noteIdRef.current !== noteId) return;
        apply(next);
        if (next.mine) heldNoteRef.current = noteId;
      } catch {
        // keep fail-open editing without a lease
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apply, canClaim, claimFailed, claiming, cloud, lock, noteId]);

  // Heartbeat while we hold the lease.
  useEffect(() => {
    if (!cloud || !noteId || !lock?.mine) return;

    const tick = () => {
      void heartbeatNoteEditLock(noteId)
        .then((next) => {
          if (noteIdRef.current !== noteId) return;
          apply(next);
          if (!next.mine) heldNoteRef.current = null;
        })
        .catch((err) => {
          console.error('heartbeat note edit lock failed', err);
        });
    };

    const id = window.setInterval(tick, NOTE_EDIT_LOCK_HEARTBEAT_MS);
    return () => window.clearInterval(id);
  }, [apply, cloud, lock?.mine, noteId]);

  // Best-effort release on unload. Brief tab switches keep the lease;
  // TTL + heartbeat cover crashes / abandoned editors.
  useEffect(() => {
    if (!cloud || !noteId) return;

    const onPageHide = () => {
      if (heldNoteRef.current === noteId) {
        releaseNoteEditLockBeacon(noteId);
      }
    };
    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      if (!canClaim || noteIdRef.current !== noteId) return;
      // Refresh / re-claim after returning to the tab.
      void (async () => {
        try {
          if (heldNoteRef.current === noteId) {
            const next = await heartbeatNoteEditLock(noteId);
            if (noteIdRef.current !== noteId) return;
            apply(next);
            if (!next.mine) {
              heldNoteRef.current = null;
              const claimed = await claimNoteEditLock(noteId, false);
              if (noteIdRef.current !== noteId) return;
              apply(claimed);
              if (claimed.mine) heldNoteRef.current = noteId;
            }
          } else {
            await refresh();
          }
        } catch {
          // ignore
        }
      })();
    };

    window.addEventListener('pagehide', onPageHide);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', onPageHide);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [apply, canClaim, cloud, noteId, refresh]);

  // Live updates when another client steals / releases the lock.
  useEffect(() => {
    if (!cloud || !noteId) return;

    const channel = getSupabase()
      .channel(`note-edit-lock:${noteId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'note_edit_locks',
          filter: `note_id=eq.${noteId}`,
        },
        () => {
          void refresh();
        },
      )
      .subscribe();

    return () => {
      void getSupabase().removeChannel(channel);
    };
  }, [cloud, noteId, refresh]);

  const blockedByOther = Boolean(
    lock?.held && !lock.mine && lock.userId && !claimFailed,
  );
  const holding = Boolean(lock?.mine);

  return {
    blockedByOther,
    holding,
    lock,
    claiming,
    claimFailed,
    takeOver,
    refresh,
  };
}

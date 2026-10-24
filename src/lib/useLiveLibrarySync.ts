import { useEffect, useRef } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabase, isCloudConfigured } from './supabaseClient';

const NOTE_FLUSH_MS = 180;
const META_FLUSH_MS = 320;

export type LiveLibrarySyncHandlers = {
  /** Note ids that changed (create/update/delete/images/labels). */
  onNotesTouched: (noteIds: string[]) => void;
  /** Labels / types / stock / links taxonomy changed. */
  onMetaTouched: () => void;
  /** Socket recovered or tab became visible — run incremental since-cursor sync. */
  onResync: () => void;
};

/**
 * Subscribe to shared-library postgres_changes and coalesce bursts.
 * No-op when cloud is not configured.
 */
export function useLiveLibrarySync(
  enabled: boolean,
  handlers: LiveLibrarySyncHandlers,
): void {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!enabled || !isCloudConfigured()) return;

    const pendingNoteIds = new Set<string>();
    let noteTimer: ReturnType<typeof setTimeout> | null = null;
    let metaTimer: ReturnType<typeof setTimeout> | null = null;
    let metaQueued = false;

    const flushNotes = () => {
      noteTimer = null;
      if (pendingNoteIds.size === 0) return;
      const ids = [...pendingNoteIds];
      pendingNoteIds.clear();
      handlersRef.current.onNotesTouched(ids);
    };

    const flushMeta = () => {
      metaTimer = null;
      if (!metaQueued) return;
      metaQueued = false;
      handlersRef.current.onMetaTouched();
    };

    const queueNote = (noteId: string | null | undefined) => {
      if (!noteId) return;
      pendingNoteIds.add(noteId);
      if (noteTimer) clearTimeout(noteTimer);
      noteTimer = setTimeout(flushNotes, NOTE_FLUSH_MS);
    };

    const queueMeta = () => {
      metaQueued = true;
      if (metaTimer) clearTimeout(metaTimer);
      metaTimer = setTimeout(flushMeta, META_FLUSH_MS);
    };

    const notePayloadId = (payload: {
      new?: Record<string, unknown> | null;
      old?: Record<string, unknown> | null;
    }): string | null => {
      const row = payload.new ?? payload.old;
      const id = row?.id;
      return typeof id === 'string' ? id : null;
    };

    const imageOrLabelNoteId = (payload: {
      new?: Record<string, unknown> | null;
      old?: Record<string, unknown> | null;
    }): string | null => {
      const row = payload.new ?? payload.old;
      const id = row?.note_id;
      return typeof id === 'string' ? id : null;
    };

    let channel: RealtimeChannel | null = null;
    let disposed = false;
    let sawFirstSubscribe = false;
    let resyncTimer: ReturnType<typeof setTimeout> | null = null;

    const scheduleResync = () => {
      if (resyncTimer) clearTimeout(resyncTimer);
      resyncTimer = setTimeout(() => {
        resyncTimer = null;
        if (!disposed) handlersRef.current.onResync();
      }, 200);
    };

    const supabase = getSupabase();
    channel = supabase
      .channel('library-live-wall')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notes' },
        (payload) => {
          queueNote(notePayloadId(payload));
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'note_images' },
        (payload) => {
          queueNote(imageOrLabelNoteId(payload));
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'note_labels' },
        (payload) => {
          queueNote(imageOrLabelNoteId(payload));
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'labels' },
        () => queueMeta(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'note_types' },
        () => queueMeta(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'stock_locations' },
        () => queueMeta(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'note_links' },
        () => queueMeta(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reactions' },
        () => queueMeta(),
      )
      .subscribe((status) => {
        if (disposed) return;
        if (status === 'SUBSCRIBED') {
          // Skip the first subscribe after mount (initial refresh already ran).
          if (!sawFirstSubscribe) {
            sawFirstSubscribe = true;
            return;
          }
          scheduleResync();
        }
      });

    const onVisibility = () => {
      if (document.visibilityState === 'visible') scheduleResync();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', onVisibility);
      if (noteTimer) clearTimeout(noteTimer);
      if (metaTimer) clearTimeout(metaTimer);
      if (resyncTimer) clearTimeout(resyncTimer);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [enabled]);
}

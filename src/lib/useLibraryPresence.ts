import { useEffect, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { shortEmailLabel } from './authorLabel';
import { SHOW_ONLINE_PRESENCE } from './config';
import { getSupabase, isCloudConfigured } from './supabaseClient';

export type OnlineMember = {
  userId: string;
  label: string;
  email: string;
  mine: boolean;
};

type PresenceMeta = {
  user_id?: string;
  email?: string;
  online_at?: string;
};

function membersFromPresenceState(
  state: Record<string, PresenceMeta[]>,
  currentUserId: string,
): OnlineMember[] {
  const byUser = new Map<string, OnlineMember>();

  for (const [key, metas] of Object.entries(state)) {
    const meta = metas[0] ?? {};
    const userId = (meta.user_id || key || '').trim();
    if (!userId) continue;
    const email = (meta.email ?? '').trim();
    const label =
      userId === currentUserId
        ? 'you'
        : shortEmailLabel(email) || `user ${userId.slice(0, 6)}`;
    byUser.set(userId, {
      userId,
      label,
      email,
      mine: userId === currentUserId,
    });
  }

  return [...byUser.values()].sort((a, b) => {
    if (a.mine !== b.mine) return a.mine ? -1 : 1;
    return a.label.localeCompare(b.label, undefined, { sensitivity: 'base' });
  });
}

/**
 * Library-wide Realtime Presence: who is signed in right now.
 * No DB table — ephemeral channel state only.
 */
export function useLibraryPresence(
  enabled: boolean,
  userId: string | null | undefined,
  email: string | null | undefined,
): OnlineMember[] {
  const [members, setMembers] = useState<OnlineMember[]>([]);

  useEffect(() => {
    if (
      !enabled ||
      !SHOW_ONLINE_PRESENCE ||
      !isCloudConfigured() ||
      !userId
    ) {
      setMembers([]);
      return;
    }

    let disposed = false;
    let channel: RealtimeChannel | null = null;
    const supabase = getSupabase();
    const selfEmail = (email ?? '').trim();

    const sync = () => {
      if (disposed || !channel) return;
      setMembers(membersFromPresenceState(channel.presenceState(), userId));
    };

    channel = supabase.channel('library-online', {
      config: { presence: { key: userId } },
    });

    channel
      .on('presence', { event: 'sync' }, sync)
      .on('presence', { event: 'join' }, sync)
      .on('presence', { event: 'leave' }, sync)
      .subscribe(async (status) => {
        if (disposed || status !== 'SUBSCRIBED' || !channel) return;
        try {
          await channel.track({
            user_id: userId,
            email: selfEmail,
            online_at: new Date().toISOString(),
          });
        } catch (err) {
          console.error('library presence track failed', err);
        }
      });

    return () => {
      disposed = true;
      setMembers([]);
      if (channel) {
        void channel.untrack().catch(() => {});
        void supabase.removeChannel(channel);
      }
    };
  }, [email, enabled, userId]);

  return members;
}

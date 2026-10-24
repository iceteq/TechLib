import type { Reaction, ReactionEmoji } from './types';

export type ReactionSourceRow = {
  id: string;
  note_id: string;
  emoji: string;
  count: number;
  owner_id?: string | null;
};

/**
 * Collapse per-user reaction rows into one entry per (note, emoji)
 * with a team `count` and `mine` for the current user.
 */
export function aggregateReactionRows(
  rows: ReactionSourceRow[],
  myUserId: string | null | undefined,
): Reaction[] {
  const map = new Map<string, Reaction>();

  for (const row of rows) {
    const emoji = row.emoji as ReactionEmoji;
    const key = `${row.note_id}\0${emoji}`;
    const mine = Boolean(myUserId && row.owner_id === myUserId);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        id: row.id,
        noteId: row.note_id,
        emoji,
        count: row.count,
        mine,
      });
      continue;
    }
    existing.count += row.count;
    if (mine) existing.mine = true;
  }

  return [...map.values()];
}

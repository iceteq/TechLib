import type { NoteLink } from './types';

/** Canonical undirected pair, or null if self-link. */
export function normalizeLinkPair(
  a: string,
  b: string,
): { noteIdA: string; noteIdB: string } | null {
  if (a === b) return null;
  return a < b
    ? { noteIdA: a, noteIdB: b }
    : { noteIdA: b, noteIdB: a };
}

export function linkKey(link: Pick<NoteLink, 'noteIdA' | 'noteIdB'>): string {
  return `${link.noteIdA}:${link.noteIdB}`;
}

/** All note ids linked to `noteId`. */
export function relatedIdsFromLinks(
  links: NoteLink[],
  noteId: string,
): string[] {
  const ids: string[] = [];
  for (const link of links) {
    if (link.noteIdA === noteId) ids.push(link.noteIdB);
    else if (link.noteIdB === noteId) ids.push(link.noteIdA);
  }
  return ids;
}

/** Merge manual link ids with auto same-part-number ids (deduped). */
export function mergeRelatedIds(
  linkIds: string[],
  partIds: string[],
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of [...linkIds, ...partIds]) {
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/** Every unique undirected pair among `noteIds` (full mesh). */
export function meshLinkPairs(noteIds: string[]): NoteLink[] {
  const unique = [...new Set(noteIds)];
  const pairs: NoteLink[] = [];
  for (let i = 0; i < unique.length; i++) {
    for (let j = i + 1; j < unique.length; j++) {
      const pair = normalizeLinkPair(unique[i], unique[j]);
      if (pair) pairs.push(pair);
    }
  }
  return pairs;
}

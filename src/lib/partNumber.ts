import type { NoteWithUrls } from './types';

/**
 * Canonical part-number key for auto-related notes.
 * Trim + collapse whitespace + case-fold. Empty → no family.
 */
export function normalizePartNumber(title: string | null | undefined): string {
  return (title ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Display label for a part-number family (preserves first note's casing when possible). */
export function partNumberLabel(title: string | null | undefined): string {
  return (title ?? '').trim().replace(/\s+/g, ' ');
}

/** Other non-deleted notes that share this part number (excludes `noteId`). */
export function relatedIdsByPartNumber(
  notes: NoteWithUrls[],
  noteId: string,
  title: string,
): string[] {
  const key = normalizePartNumber(title);
  if (!key) return [];
  return notes
    .filter(
      (n) =>
        n.id !== noteId &&
        n.deletedAt == null &&
        normalizePartNumber(n.title) === key,
    )
    .map((n) => n.id);
}

/** How many non-deleted notes share this part number (includes self when matched). */
export function partNumberFamilyCount(
  notes: NoteWithUrls[],
  title: string,
): number {
  const key = normalizePartNumber(title);
  if (!key) return 0;
  let count = 0;
  for (const n of notes) {
    if (n.deletedAt != null) continue;
    if (normalizePartNumber(n.title) === key) count += 1;
  }
  return count;
}

export function noteMatchesPartNumberKey(
  note: NoteWithUrls,
  partKey: string,
): boolean {
  const key = partKey.trim().toLowerCase();
  if (!key) return false;
  return normalizePartNumber(note.title) === key;
}

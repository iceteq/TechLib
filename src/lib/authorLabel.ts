/** Short wall label from an email (local-part before @). */
export function shortEmailLabel(email: string | null | undefined): string {
  const trimmed = (email ?? '').trim();
  if (!trimmed) return '';
  const at = trimmed.indexOf('@');
  return at > 0 ? trimmed.slice(0, at) : trimmed;
}

/**
 * Display label for a note's `createdBy` on the wall.
 * Current user → "you"; others → email local-part when known.
 */
export function authorLabelForUser(
  createdBy: string | null | undefined,
  emailByUserId: ReadonlyMap<string, string>,
  currentUserId: string | null | undefined,
): string | null {
  if (!createdBy || createdBy === 'local') return null;
  if (currentUserId && createdBy === currentUserId) return 'you';
  const fromMap = shortEmailLabel(emailByUserId.get(createdBy));
  if (fromMap) return fromMap;
  return null;
}

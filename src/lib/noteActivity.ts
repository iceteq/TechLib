import type { Note } from './types';

/** Fields that should move a note up on the wall when they change. */
export type WallActivityPatch = Partial<Pick<Note, 'title' | 'stockId'>>;

/** Wall-order timestamp; legacy rows without `activityAt` use `updatedAt`. */
export function noteActivityAt(
  note: Pick<Note, 'updatedAt'> & { activityAt?: number },
): number {
  return note.activityAt ?? note.updatedAt;
}

/** True when this patch should bump wall order (part number and/or stock). */
export function patchBumpsWallActivity(patch: WallActivityPatch): boolean {
  return patch.title !== undefined || 'stockId' in patch;
}

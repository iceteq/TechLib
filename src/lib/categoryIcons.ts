import type { LucideIcon } from 'lucide-react';
import { noteTypeIcon } from './noteTypes';
import type { NoteType, NoteTypeIcon } from './types';

/** @deprecated Prefer noteTypeIcon / TypeChip with NoteType. */
export function categoryIcon(
  iconOrType: NoteTypeIcon | NoteType | undefined | null,
): LucideIcon {
  if (!iconOrType) return noteTypeIcon('package');
  if (typeof iconOrType === 'string') return noteTypeIcon(iconOrType);
  return noteTypeIcon(iconOrType.icon);
}

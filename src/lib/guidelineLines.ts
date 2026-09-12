import type {
  GuidelineAction,
  GuidelineLine,
  NoteDisposition,
} from './types';
import { GUIDELINE_ACTIONS } from './types';

export const GUIDELINE_WHEN_PRESETS = [
  'Always',
  'Broken',
  'Uninstall',
  'Obsolete',
  'Returned',
] as const;

export function isGuidelineAction(value: string): value is GuidelineAction {
  return (GUIDELINE_ACTIONS as readonly string[]).includes(value);
}

export function newGuidelineLine(
  partial?: Partial<Pick<GuidelineLine, 'when' | 'action' | 'how'>>,
): GuidelineLine {
  return {
    id: crypto.randomUUID(),
    when: partial?.when?.trim() || 'Always',
    action: partial?.action ?? 'stock',
    how: partial?.how?.trim() ?? '',
  };
}

export function normalizeGuidelineLines(
  lines: GuidelineLine[] | null | undefined,
): GuidelineLine[] {
  if (!Array.isArray(lines)) return [];
  return lines
    .filter((line) => line && isGuidelineAction(line.action))
    .map((line) => ({
      id: line.id || crypto.randomUUID(),
      when: (line.when ?? '').trim() || 'Always',
      action: line.action,
      how: (line.how ?? '').trim(),
    }));
}

/** Convert legacy single disposition into decision lines. */
export function guidelineLinesFromDisposition(
  disposition: NoteDisposition | null | undefined,
): GuidelineLine[] {
  if (!disposition || disposition === 'none') return [];
  if (!isGuidelineAction(disposition)) return [];
  return [newGuidelineLine({ when: 'Always', action: disposition })];
}

/**
 * Resolve guideline lines for a note, migrating from legacy disposition
 * when the new field is missing.
 */
export function resolveGuidelineLines(note: {
  guidelineLines?: GuidelineLine[] | null;
  disposition?: NoteDisposition | null;
}): GuidelineLine[] {
  if (Array.isArray(note.guidelineLines)) {
    return normalizeGuidelineLines(note.guidelineLines);
  }
  return guidelineLinesFromDisposition(note.disposition);
}

/** Keep disposition in sync for filters / older UI. */
export function primaryDispositionFromLines(
  lines: GuidelineLine[],
): NoteDisposition {
  const normalized = normalizeGuidelineLines(lines);
  if (normalized.length === 0) return 'none';
  if (normalized.length === 1) return normalized[0].action;
  const always = normalized.find(
    (line) => line.when.toLowerCase() === 'always',
  );
  return always?.action ?? normalized[0].action;
}

export function alwaysGuidelineLines(
  action: NoteDisposition,
): GuidelineLine[] {
  if (!action || action === 'none') return [];
  if (!isGuidelineAction(action)) return [];
  return [newGuidelineLine({ when: 'Always', action })];
}

export function noteMatchesDispositionFilter(
  note: {
    guidelineLines?: GuidelineLine[] | null;
    disposition?: NoteDisposition | null;
  },
  disposition: NoteDisposition,
): boolean {
  const lines = resolveGuidelineLines(note);
  if (disposition === 'none') return lines.length === 0;
  return lines.some((line) => line.action === disposition);
}

export function guidelineLinesSearchText(lines: GuidelineLine[]): string {
  return normalizeGuidelineLines(lines)
    .map((line) => `${line.when} ${line.action} ${line.how}`)
    .join(' ');
}

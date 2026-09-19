import type { NoteAskItem } from './types';

export type { NoteAskItem };

export const MAX_NOTE_ASK_ITEMS = 3;
export const MAX_NOTE_ASK_QUESTION_LEN = 200;

export function normalizeAskItems(raw: unknown): NoteAskItem[] {
  if (!Array.isArray(raw)) return [];
  const items: NoteAskItem[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const row = entry as Record<string, unknown>;
    const id = typeof row.id === 'string' && row.id ? row.id : crypto.randomUUID();
    const question =
      typeof row.question === 'string'
        ? row.question.trim().slice(0, MAX_NOTE_ASK_QUESTION_LEN)
        : '';
    const answer = typeof row.answer === 'string' ? row.answer.trim() : '';
    const answeredAt =
      typeof row.answeredAt === 'number' && Number.isFinite(row.answeredAt)
        ? row.answeredAt
        : null;
    items.push({ id, question, answer, answeredAt });
    if (items.length >= MAX_NOTE_ASK_ITEMS) break;
  }
  return items;
}

export function createEmptyAskItem(): NoteAskItem {
  return {
    id: crypto.randomUUID(),
    question: '',
    answer: '',
    answeredAt: null,
  };
}

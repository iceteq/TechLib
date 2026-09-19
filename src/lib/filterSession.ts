import type { NoteDisposition, NotesView } from './types';
import { UNSET_STOCK_FILTER, UNSET_TYPE_FILTER } from './types';

export const FILTER_SESSION_KEY = 'techlib.filterSession';

export type FilterSession = {
  view: NotesView;
  search: string;
  labelIds: string[];
  disposition: NoteDisposition | null;
  categoryId: string | null;
  stockId: string | null;
};

export const DEFAULT_FILTER_SESSION: FilterSession = {
  view: 'notes',
  search: '',
  labelIds: [],
  disposition: null,
  categoryId: null,
  stockId: null,
};

const DISPOSITIONS = new Set<NoteDisposition>([
  'none',
  'stock',
  'repair',
  'config',
  'scrap',
]);

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

export function loadFilterSession(): FilterSession {
  try {
    const raw = localStorage.getItem(FILTER_SESSION_KEY);
    if (!raw) return { ...DEFAULT_FILTER_SESSION };
    const parsed = JSON.parse(raw) as Partial<FilterSession>;
    const rawView = parsed.view as string | undefined;
    const view: NotesView =
      rawView === 'archive' ||
      rawView === 'collection' ||
      rawView === 'notes'
        ? rawView
        : rawView === 'cart'
          ? 'collection'
          : 'notes';
    const disposition =
      typeof parsed.disposition === 'string' &&
      DISPOSITIONS.has(parsed.disposition as NoteDisposition)
        ? (parsed.disposition as NoteDisposition)
        : null;
    const categoryId =
      typeof parsed.categoryId === 'string' ? parsed.categoryId : null;
    const stockId = typeof parsed.stockId === 'string' ? parsed.stockId : null;

    return {
      view,
      search: typeof parsed.search === 'string' ? parsed.search : '',
      labelIds: asStringArray(parsed.labelIds),
      disposition,
      categoryId:
        categoryId === UNSET_TYPE_FILTER || categoryId ? categoryId : null,
      stockId:
        stockId === UNSET_STOCK_FILTER || stockId ? stockId : null,
    };
  } catch {
    return { ...DEFAULT_FILTER_SESSION };
  }
}

export function saveFilterSession(session: FilterSession) {
  try {
    localStorage.setItem(FILTER_SESSION_KEY, JSON.stringify(session));
  } catch {
    // ignore quota / private mode
  }
}

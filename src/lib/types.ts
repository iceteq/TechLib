export type NoteBackground =
  | 'default'
  | 'yellow'
  | 'green'
  | 'blue'
  | 'pink'
  | 'gray';

/** What to do with the product on this note. */
export type NoteDisposition = 'none' | 'stock' | 'repair' | 'scrap';

/** What kind of product this note is about. */
export type NoteCategory =
  | 'none'
  | 'monitor'
  | 'computer'
  | 'printer'
  | 'network'
  | 'scanner'
  | 'cables'
  | 'other';

export type ReactionEmoji = '👍' | '❤️' | '🔥' | '✅';

export interface NoteImage {
  id: string;
  position: number;
}

export interface NoteImageWithUrl extends NoteImage {
  url: string;
}

export interface Note {
  id: string;
  title: string;
  description: string;
  background: NoteBackground;
  disposition: NoteDisposition;
  category: NoteCategory;
  /** Single stock location (bay/shelf code), or null when unset. */
  stockId: string | null;
  /** Exception / special-case handling note under guideline. */
  specialCase: string;
  pinned: boolean;
  archived: boolean;
  /** Soft-delete timestamp; null when active. */
  deletedAt: number | null;
  createdAt: number;
  updatedAt: number;
  labelIds: string[];
  images: NoteImage[];
}

export interface NoteWithUrls extends Omit<Note, 'images'> {
  images: NoteImageWithUrl[];
}

export interface Label {
  id: string;
  name: string;
}

/** User-defined stock location (e.g. 3209, 3209b). */
export interface StockLocation {
  id: string;
  name: string;
}

export interface Reaction {
  id: string;
  noteId: string;
  emoji: ReactionEmoji;
  count: number;
}

export type NotesView = 'notes' | 'archive' | 'cart';

export interface CartItem {
  noteId: string;
  quantity: number;
}

export const REACTION_EMOJIS: ReactionEmoji[] = ['👍', '❤️', '🔥', '✅'];

export const DISPOSITIONS: {
  id: NoteDisposition;
  label: string;
  short: string;
}[] = [
  { id: 'none', label: 'No guideline', short: '' },
  { id: 'stock', label: 'Return to stock', short: 'Stock' },
  { id: 'repair', label: 'Go to repair', short: 'Repair' },
  { id: 'scrap', label: 'Throw away', short: 'Scrap' },
];

export const CATEGORIES: {
  id: NoteCategory;
  label: string;
}[] = [
  { id: 'none', label: 'No type' },
  { id: 'monitor', label: 'Monitor' },
  { id: 'computer', label: 'Computer' },
  { id: 'printer', label: 'Printer' },
  { id: 'network', label: 'Network' },
  { id: 'scanner', label: 'Scanner' },
  { id: 'cables', label: 'Cables' },
  { id: 'other', label: 'Other' },
];

/** Migrate older category ids stored before the type list changed. */
export function normalizeCategory(value: string | undefined): NoteCategory {
  if (value === 'accessories') return 'other';
  if (
    value === 'monitor' ||
    value === 'computer' ||
    value === 'printer' ||
    value === 'network' ||
    value === 'scanner' ||
    value === 'cables' ||
    value === 'other'
  ) {
    return value;
  }
  return 'none';
}

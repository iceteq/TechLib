export type NoteBackground =
  | 'default'
  | 'yellow'
  | 'green'
  | 'blue'
  | 'pink'
  | 'gray';

/** What to do with the product on this note. */
export type NoteDisposition = 'none' | 'stock' | 'repair' | 'scrap';

export type NoteTypeColor =
  | 'blue'
  | 'teal'
  | 'green'
  | 'amber'
  | 'orange'
  | 'rose'
  | 'violet'
  | 'slate';

export type NoteTypeIcon =
  | 'monitor'
  | 'computer'
  | 'printer'
  | 'network'
  | 'scanner'
  | 'cables'
  | 'other'
  | 'package';

/** Sentinel filter value: notes with no type set. */
export const UNSET_TYPE_FILTER = '__unset__';

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
  /** Warehouse part number (shown as “Part number” in the UI). */
  title: string;
  description: string;
  background: NoteBackground;
  disposition: NoteDisposition;
  /** User-defined product type id, or null when unset. */
  categoryId: string | null;
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

/** User-defined product type (Monitor, Printer, custom, …). */
export interface NoteType {
  id: string;
  name: string;
  color: NoteTypeColor;
  icon: NoteTypeIcon;
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

export const NOTE_TYPE_COLORS: NoteTypeColor[] = [
  'blue',
  'teal',
  'green',
  'amber',
  'orange',
  'rose',
  'violet',
  'slate',
];

/** Seeded types; ids match legacy category enum values for migration. */
export const DEFAULT_NOTE_TYPES: NoteType[] = [
  { id: 'monitor', name: 'Monitor', color: 'blue', icon: 'monitor' },
  { id: 'computer', name: 'Computer', color: 'violet', icon: 'computer' },
  { id: 'printer', name: 'Printer', color: 'amber', icon: 'printer' },
  { id: 'network', name: 'Network', color: 'teal', icon: 'network' },
  { id: 'scanner', name: 'Scanner', color: 'green', icon: 'scanner' },
  { id: 'cables', name: 'Cables', color: 'orange', icon: 'cables' },
  { id: 'other', name: 'Other', color: 'slate', icon: 'other' },
];

const LEGACY_CATEGORY_IDS = new Set(DEFAULT_NOTE_TYPES.map((t) => t.id));

/** Map legacy `category` string field → type id (or null). */
export function legacyCategoryToTypeId(
  value: string | undefined | null,
): string | null {
  if (!value || value === 'none') return null;
  if (value === 'accessories') return 'other';
  if (LEGACY_CATEGORY_IDS.has(value)) return value;
  return null;
}

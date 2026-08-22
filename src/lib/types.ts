export type NoteBackground =
  | 'default'
  | 'yellow'
  | 'green'
  | 'blue'
  | 'pink'
  | 'gray';

/** What to do with the product on this note. */
export type NoteDisposition = 'none' | 'stock' | 'repair' | 'scrap';

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
  pinned: boolean;
  archived: boolean;
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

export interface Reaction {
  id: string;
  noteId: string;
  emoji: ReactionEmoji;
  count: number;
}

export type NotesView = 'notes' | 'archive';

export const REACTION_EMOJIS: ReactionEmoji[] = ['👍', '❤️', '🔥', '✅'];

export const DISPOSITIONS: {
  id: NoteDisposition;
  label: string;
  short: string;
}[] = [
  { id: 'none', label: 'No status', short: '' },
  { id: 'stock', label: 'Return to stock', short: 'Stock' },
  { id: 'repair', label: 'Go to repair', short: 'Repair' },
  { id: 'scrap', label: 'Throw away', short: 'Scrap' },
];

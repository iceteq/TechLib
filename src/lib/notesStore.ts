import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type {
  Label,
  Note,
  NoteBackground,
  NoteWithUrls,
  Reaction,
  ReactionEmoji,
} from './types';
import { normalizeCategory } from './types';

interface TechLibDB extends DBSchema {
  notes: {
    key: string;
    value: Note;
    indexes: { 'by-updated': number };
  };
  labels: {
    key: string;
    value: Label;
    indexes: { 'by-name': string };
  };
  imageBlobs: {
    key: string;
    value: {
      id: string;
      noteId: string;
      blob: Blob;
      mimeType: string;
    };
  };
  reactions: {
    key: string;
    value: Reaction;
    indexes: { 'by-note': string };
  };
}

const DB_NAME = 'techlib';
const DB_VERSION = 2;

let dbPromise: Promise<IDBPDatabase<TechLibDB>> | null = null;
const urlCache = new Map<string, string>();

function uid(): string {
  return crypto.randomUUID();
}

function normalizeNote(note: Note): Note {
  return {
    ...note,
    pinned: Boolean(note.pinned),
    archived: Boolean(note.archived),
    disposition: note.disposition ?? 'none',
    category: normalizeCategory(note.category),
    specialCase: note.specialCase ?? '',
    labelIds: note.labelIds ?? [],
    images: note.images ?? [],
  };
}

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<TechLibDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          const notes = db.createObjectStore('notes', { keyPath: 'id' });
          notes.createIndex('by-updated', 'updatedAt');

          const labels = db.createObjectStore('labels', { keyPath: 'id' });
          labels.createIndex('by-name', 'name', { unique: true });

          db.createObjectStore('imageBlobs', { keyPath: 'id' });
        }

        if (oldVersion < 2) {
          if (!db.objectStoreNames.contains('reactions')) {
            const reactions = db.createObjectStore('reactions', {
              keyPath: 'id',
            });
            reactions.createIndex('by-note', 'noteId');
          }
        }
      },
    });
  }
  return dbPromise;
}

function getOrCreateUrl(imageId: string, blob: Blob): string {
  const existing = urlCache.get(imageId);
  if (existing) return existing;
  const url = URL.createObjectURL(blob);
  urlCache.set(imageId, url);
  return url;
}

function revokeUrl(imageId: string) {
  const url = urlCache.get(imageId);
  if (url) {
    URL.revokeObjectURL(url);
    urlCache.delete(imageId);
  }
}

async function hydrateNote(note: Note): Promise<NoteWithUrls> {
  const db = await getDb();
  const normalized = normalizeNote(note);
  const images = await Promise.all(
    [...normalized.images]
      .sort((a, b) => a.position - b.position)
      .map(async (img) => {
        const record = await db.get('imageBlobs', img.id);
        if (!record) {
          return { ...img, url: '' };
        }
        return { ...img, url: getOrCreateUrl(img.id, record.blob) };
      }),
  );

  return { ...normalized, images: images.filter((i) => i.url) };
}

function sortNotes(notes: NoteWithUrls[]): NoteWithUrls[] {
  return [...notes].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.updatedAt - a.updatedAt;
  });
}

export async function listNotes(): Promise<NoteWithUrls[]> {
  const db = await getDb();
  const notes = await db.getAll('notes');
  const hydrated = await Promise.all(notes.map(hydrateNote));
  return sortNotes(hydrated);
}

export async function getNote(id: string): Promise<NoteWithUrls | undefined> {
  const db = await getDb();
  const note = await db.get('notes', id);
  if (!note) return undefined;
  return hydrateNote(note);
}

export async function createNote(input?: {
  title?: string;
  description?: string;
  background?: NoteBackground;
}): Promise<NoteWithUrls> {
  const db = await getDb();
  const now = Date.now();
  const note: Note = {
    id: uid(),
    title: input?.title ?? '',
    description: input?.description ?? '',
    background: input?.background ?? 'default',
    disposition: 'none',
    category: 'none',
    specialCase: '',
    pinned: false,
    archived: false,
    createdAt: now,
    updatedAt: now,
    labelIds: [],
    images: [],
  };
  await db.put('notes', note);
  return hydrateNote(note);
}

export async function updateNote(
  id: string,
  patch: Partial<
    Pick<
      Note,
      | 'title'
      | 'description'
      | 'background'
      | 'labelIds'
      | 'pinned'
      | 'archived'
      | 'disposition'
      | 'category'
      | 'specialCase'
    >
  >,
): Promise<NoteWithUrls | undefined> {
  const db = await getDb();
  const existing = await db.get('notes', id);
  if (!existing) return undefined;

  const next: Note = {
    ...normalizeNote(existing),
    ...patch,
    updatedAt: Date.now(),
  };
  await db.put('notes', next);
  return hydrateNote(next);
}

export async function deleteNote(id: string): Promise<void> {
  const db = await getDb();
  const note = await db.get('notes', id);
  if (!note) return;

  for (const img of note.images) {
    revokeUrl(img.id);
    await db.delete('imageBlobs', img.id);
  }

  const reactions = await db.getAllFromIndex('reactions', 'by-note', id);
  for (const reaction of reactions) {
    await db.delete('reactions', reaction.id);
  }

  await db.delete('notes', id);
}

export async function addImage(
  noteId: string,
  file: File | Blob,
): Promise<NoteWithUrls | undefined> {
  const db = await getDb();
  const note = await db.get('notes', noteId);
  if (!note) return undefined;
  const normalized = normalizeNote(note);

  const imageId = uid();
  const position =
    normalized.images.length === 0
      ? 0
      : Math.max(...normalized.images.map((i) => i.position)) + 1;

  await db.put('imageBlobs', {
    id: imageId,
    noteId,
    blob: file,
    mimeType: file.type || 'image/jpeg',
  });

  const next: Note = {
    ...normalized,
    images: [...normalized.images, { id: imageId, position }],
    updatedAt: Date.now(),
  };
  await db.put('notes', next);
  return hydrateNote(next);
}

export async function removeImage(
  noteId: string,
  imageId: string,
): Promise<NoteWithUrls | undefined> {
  const db = await getDb();
  const note = await db.get('notes', noteId);
  if (!note) return undefined;
  const normalized = normalizeNote(note);

  revokeUrl(imageId);
  await db.delete('imageBlobs', imageId);

  const remaining = normalized.images
    .filter((i) => i.id !== imageId)
    .sort((a, b) => a.position - b.position)
    .map((img, index) => ({ ...img, position: index }));

  const next: Note = {
    ...normalized,
    images: remaining,
    updatedAt: Date.now(),
  };
  await db.put('notes', next);
  return hydrateNote(next);
}

export async function reorderImages(
  noteId: string,
  orderedImageIds: string[],
): Promise<NoteWithUrls | undefined> {
  const db = await getDb();
  const note = await db.get('notes', noteId);
  if (!note) return undefined;
  const normalized = normalizeNote(note);

  const byId = new Map(normalized.images.map((img) => [img.id, img]));
  const reordered = orderedImageIds
    .map((id, position) => {
      const img = byId.get(id);
      if (!img) return null;
      return { ...img, position };
    })
    .filter((img): img is NonNullable<typeof img> => img !== null);

  // Keep any images missing from the payload at the end.
  for (const img of normalized.images) {
    if (!orderedImageIds.includes(img.id)) {
      reordered.push({ ...img, position: reordered.length });
    }
  }

  const next: Note = {
    ...normalized,
    images: reordered,
    updatedAt: Date.now(),
  };
  await db.put('notes', next);
  return hydrateNote(next);
}

export async function listLabels(): Promise<Label[]> {
  const db = await getDb();
  const labels = await db.getAll('labels');
  return labels.sort((a, b) => a.name.localeCompare(b.name));
}

export async function createLabel(name: string): Promise<Label> {
  const db = await getDb();
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Label name is required');

  const existing = await db.getAllFromIndex('labels', 'by-name', trimmed);
  if (existing[0]) return existing[0];

  const label: Label = { id: uid(), name: trimmed };
  await db.put('labels', label);
  return label;
}

export async function deleteLabel(id: string): Promise<void> {
  const db = await getDb();
  await db.delete('labels', id);

  const notes = await db.getAll('notes');
  for (const note of notes) {
    const normalized = normalizeNote(note);
    if (!normalized.labelIds.includes(id)) continue;
    await db.put('notes', {
      ...normalized,
      labelIds: normalized.labelIds.filter((lid) => lid !== id),
      updatedAt: Date.now(),
    });
  }
}

export async function setNoteLabels(
  noteId: string,
  labelIds: string[],
): Promise<NoteWithUrls | undefined> {
  return updateNote(noteId, { labelIds: [...new Set(labelIds)] });
}

export async function listReactionsForNote(noteId: string): Promise<Reaction[]> {
  const db = await getDb();
  return db.getAllFromIndex('reactions', 'by-note', noteId);
}

export async function listAllReactions(): Promise<Reaction[]> {
  const db = await getDb();
  return db.getAll('reactions');
}

/** Single-user toggle: add reaction or remove it. */
export async function toggleReaction(
  noteId: string,
  emoji: ReactionEmoji,
): Promise<Reaction[]> {
  const db = await getDb();
  const existing = (await db.getAllFromIndex('reactions', 'by-note', noteId)).find(
    (r) => r.emoji === emoji,
  );

  if (existing) {
    await db.delete('reactions', existing.id);
  } else {
    await db.put('reactions', {
      id: uid(),
      noteId,
      emoji,
      count: 1,
    });
  }

  return listReactionsForNote(noteId);
}

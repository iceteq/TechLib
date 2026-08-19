import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Label, Note, NoteBackground, NoteWithUrls } from './types';

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
}

const DB_NAME = 'techlib';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<TechLibDB>> | null = null;
const urlCache = new Map<string, string>();

function uid(): string {
  return crypto.randomUUID();
}

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<TechLibDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const notes = db.createObjectStore('notes', { keyPath: 'id' });
        notes.createIndex('by-updated', 'updatedAt');

        const labels = db.createObjectStore('labels', { keyPath: 'id' });
        labels.createIndex('by-name', 'name', { unique: true });

        db.createObjectStore('imageBlobs', { keyPath: 'id' });
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
  const images = await Promise.all(
    [...note.images]
      .sort((a, b) => a.position - b.position)
      .map(async (img) => {
        const record = await db.get('imageBlobs', img.id);
        if (!record) {
          return { ...img, url: '' };
        }
        return { ...img, url: getOrCreateUrl(img.id, record.blob) };
      }),
  );

  return { ...note, images: images.filter((i) => i.url) };
}

export async function listNotes(): Promise<NoteWithUrls[]> {
  const db = await getDb();
  const notes = await db.getAllFromIndex('notes', 'by-updated');
  return Promise.all(notes.reverse().map(hydrateNote));
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
  patch: Partial<Pick<Note, 'title' | 'description' | 'background' | 'labelIds'>>,
): Promise<NoteWithUrls | undefined> {
  const db = await getDb();
  const existing = await db.get('notes', id);
  if (!existing) return undefined;

  const next: Note = {
    ...existing,
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
  await db.delete('notes', id);
}

export async function addImage(
  noteId: string,
  file: File | Blob,
): Promise<NoteWithUrls | undefined> {
  const db = await getDb();
  const note = await db.get('notes', noteId);
  if (!note) return undefined;

  const imageId = uid();
  const position =
    note.images.length === 0
      ? 0
      : Math.max(...note.images.map((i) => i.position)) + 1;

  await db.put('imageBlobs', {
    id: imageId,
    noteId,
    blob: file,
    mimeType: file.type || 'image/jpeg',
  });

  const next: Note = {
    ...note,
    images: [...note.images, { id: imageId, position }],
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

  revokeUrl(imageId);
  await db.delete('imageBlobs', imageId);

  const remaining = note.images
    .filter((i) => i.id !== imageId)
    .sort((a, b) => a.position - b.position)
    .map((img, index) => ({ ...img, position: index }));

  const next: Note = {
    ...note,
    images: remaining,
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
    if (!note.labelIds.includes(id)) continue;
    await db.put('notes', {
      ...note,
      labelIds: note.labelIds.filter((lid) => lid !== id),
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

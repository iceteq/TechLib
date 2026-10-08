import type {
  CartItem,
  GuidelineLine,
  Label,
  Note,
  NoteAskItem,
  NoteBackground,
  NoteDisposition,
  NoteLink,
  NoteType,
  NoteTypeColor,
  NoteTypeIcon,
  NoteWithUrls,
  Reaction,
  ReactionEmoji,
  StockLocation,
} from './types';
import { DEFAULT_NOTE_TYPES, legacyCategoryToTypeId } from './types';
import { guessIconFromName, nextNoteTypeColor } from './noteTypes';
import { getSupabase } from './supabaseClient';
import {
  alwaysGuidelineLines,
  primaryDispositionFromLines,
  resolveGuidelineLines,
} from './guidelineLines';
import { normalizeAskItems } from './noteAskItems';
import { fetchLibraryOwnerId } from './workspace';
import { linkKey, meshLinkPairs, normalizeLinkPair } from './noteLinks';
import { NOTE_PREVIEW_IMAGE_LIMIT } from './config';
import {
  getCachedSignedUrls,
  putCachedSignedUrls,
} from './signedUrlCache';

const BUCKET = 'note-images';

/** image id → storage path (needed to re-sign full URLs after wall hydrate). */
const storagePathByImageId = new Map<string, string>();

type NoteRow = {
  id: string;
  owner_id: string;
  title: string;
  description: string;
  background: string;
  disposition: string;
  guideline_lines?: GuidelineLine[] | null;
  /** Legacy text category; kept for migration / read fallback. */
  category: string;
  category_id: string | null;
  stock_id: string | null;
  special_case: string;
  pinned: boolean;
  archived: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  ask_items?: NoteAskItem[] | null;
};

type NoteTypeRow = {
  id: string;
  name: string;
  color: string;
  icon: string;
  parent_id: string | null;
};

type ImageRow = {
  id: string;
  note_id: string;
  storage_path: string;
  position: number;
};

type LabelRow = { id: string; name: string };
type NoteLabelRow = { note_id: string; label_id: string };
type CartRow = { note_id: string; quantity: number };
type ReactionRow = {
  id: string;
  note_id: string;
  emoji: string;
  count: number;
};

function ms(iso: string | null | undefined): number {
  return iso ? new Date(iso).getTime() : Date.now();
}

function iso(msValue: number | null | undefined): string | null {
  if (msValue == null) return null;
  return new Date(msValue).toISOString();
}

/** Build a NoteWithUrls from an insert/select row without a second fetch. */
function noteFromRow(
  row: NoteRow,
  labelIds: string[] = [],
  images: NoteWithUrls['images'] = [],
): NoteWithUrls {
  const guidelineLines = resolveGuidelineLines({
    guidelineLines: row.guideline_lines,
    disposition: (row.disposition as NoteDisposition) ?? 'none',
  });
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    background: row.background as NoteBackground,
    disposition: primaryDispositionFromLines(guidelineLines),
    guidelineLines,
    categoryId: row.category_id ?? legacyCategoryToTypeId(row.category),
    stockId: row.stock_id ?? null,
    specialCase: row.special_case ?? '',
    askItems: normalizeAskItems(row.ask_items),
    pinned: row.pinned,
    archived: row.archived,
    deletedAt: row.deleted_at ? ms(row.deleted_at) : null,
    createdAt: ms(row.created_at),
    updatedAt: ms(row.updated_at),
    labelIds,
    images,
  };
}

async function requireUserId(): Promise<string> {
  const { data, error } = await getSupabase().auth.getUser();
  if (error || !data.user) throw new Error('Not signed in');
  return data.user.id;
}

/** Shared library owner — all notes/labels/types/images use this id. */
async function requireLibraryOwnerId(): Promise<string> {
  await requireUserId();
  return fetchLibraryOwnerId();
}

async function canEditLibraryRpc(): Promise<boolean> {
  const { data, error } = await getSupabase().rpc('can_edit_library');
  if (error) throw new Error(error.message);
  return Boolean(data);
}

function throwIf(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

/** 12h — matches a long browsing session without re-signing constantly. */
const SIGNED_URL_TTL_SEC = 60 * 60 * 12;
/**
 * Wall cards top out ~260px wide in the grid; 360 covers ~1.5–2x DPR
 * without shipping near-full previews. `cover` matches object-fit on cards.
 */
const WALL_THUMB_WIDTH = 360;

type SignOptions = {
  /** Sign full-resolution URLs for these paths (batch). */
  fullPaths: string[];
  /** Sign ~480px transform URLs for these paths (per-object). */
  thumbPaths: string[];
};

async function signedUrlsForPaths(options: SignOptions): Promise<{
  fullByPath: Map<string, string>;
  thumbByPath: Map<string, string>;
}> {
  const fullWanted = [...new Set(options.fullPaths.filter(Boolean))];
  const thumbWanted = [...new Set(options.thumbPaths.filter(Boolean))];
  const fullByPath = new Map<string, string>();
  const thumbByPath = new Map<string, string>();

  const fullToSign: string[] = [];
  for (const path of fullWanted) {
    const cached = getCachedSignedUrls(path)?.full;
    if (cached) fullByPath.set(path, cached);
    else fullToSign.push(path);
  }

  const thumbToSign: string[] = [];
  for (const path of thumbWanted) {
    const cached = getCachedSignedUrls(path)?.thumb;
    if (cached) thumbByPath.set(path, cached);
    else thumbToSign.push(path);
  }

  const storage = getSupabase().storage.from(BUCKET);

  if (fullToSign.length > 0) {
    const { data: fullData, error: fullError } = await storage.createSignedUrls(
      fullToSign,
      SIGNED_URL_TTL_SEC,
    );
    throwIf(fullError);
    for (const item of fullData ?? []) {
      if (item.path && item.signedUrl) {
        fullByPath.set(item.path, item.signedUrl);
        putCachedSignedUrls(item.path, { full: item.signedUrl }, SIGNED_URL_TTL_SEC);
      }
    }
  }

  if (thumbToSign.length > 0) {
    await Promise.all(
      thumbToSign.map(async (path) => {
        const { data, error } = await storage.createSignedUrl(
          path,
          SIGNED_URL_TTL_SEC,
          {
            transform: {
              width: WALL_THUMB_WIDTH,
              resize: 'cover',
              quality: 55,
            },
          },
        );
        if (!error && data?.signedUrl) {
          thumbByPath.set(path, data.signedUrl);
          putCachedSignedUrls(path, { thumb: data.signedUrl }, SIGNED_URL_TTL_SEC);
          return;
        }
        // Transform unavailable — fall back to full (sign if needed).
        let full = fullByPath.get(path) ?? getCachedSignedUrls(path)?.full;
        if (!full) {
          const { data: fullData, error: fullError } =
            await storage.createSignedUrl(path, SIGNED_URL_TTL_SEC);
          if (!fullError && fullData?.signedUrl) {
            full = fullData.signedUrl;
            fullByPath.set(path, full);
            putCachedSignedUrls(path, { full }, SIGNED_URL_TTL_SEC);
          }
        }
        if (full) {
          thumbByPath.set(path, full);
          putCachedSignedUrls(path, { thumb: full }, SIGNED_URL_TTL_SEC);
        }
      }),
    );
  }

  return { fullByPath, thumbByPath };
}

/** Keep `.in(...)` filters under PostgREST URL size limits. */
const NOTE_ID_IN_CHUNK = 80;

async function labelIdsByNote(
  noteIds: string[],
): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (noteIds.length === 0) return map;
  for (let i = 0; i < noteIds.length; i += NOTE_ID_IN_CHUNK) {
    const chunk = noteIds.slice(i, i + NOTE_ID_IN_CHUNK);
    const { data, error } = await getSupabase()
      .from('note_labels')
      .select('note_id, label_id')
      .in('note_id', chunk);
    throwIf(error);
    for (const row of (data ?? []) as NoteLabelRow[]) {
      const list = map.get(row.note_id) ?? [];
      list.push(row.label_id);
      map.set(row.note_id, list);
    }
  }
  return map;
}

async function imagesByNote(
  noteIds: string[],
): Promise<Map<string, ImageRow[]>> {
  const map = new Map<string, ImageRow[]>();
  if (noteIds.length === 0) return map;
  for (let i = 0; i < noteIds.length; i += NOTE_ID_IN_CHUNK) {
    const chunk = noteIds.slice(i, i + NOTE_ID_IN_CHUNK);
    const { data, error } = await getSupabase()
      .from('note_images')
      .select('id, note_id, storage_path, position')
      .in('note_id', chunk)
      .order('position', { ascending: true });
    throwIf(error);
    for (const row of (data ?? []) as ImageRow[]) {
      storagePathByImageId.set(row.id, row.storage_path);
      const list = map.get(row.note_id) ?? [];
      list.push(row);
      map.set(row.note_id, list);
    }
  }
  // Keep positions stable after chunked fetches.
  for (const [, list] of map) {
    list.sort((a, b) => a.position - b.position);
  }
  return map;
}

type HydrateMode = 'wall' | 'full';

/** Apply session-cached **full** signed URLs onto note images (no network). */
function applyCachedImageUrls(notes: NoteWithUrls[]): NoteWithUrls[] {
  let any = false;
  const next = notes.map((note) => {
    let noteChanged = false;
    const images = note.images.map((img) => {
      const path = storagePathByImageId.get(img.id);
      if (!path) return img;
      const full = getCachedSignedUrls(path)?.full;
      if (!full) return img;
      // Wall preview = full signed URL (batch-signed). Ignore stale transform thumbs.
      if (full === img.url && full === img.thumbUrl) return img;
      noteChanged = true;
      return { ...img, url: full, thumbUrl: full };
    });
    if (!noteChanged) return note;
    any = true;
    return { ...note, images };
  });
  return any ? next : notes;
}

async function hydrateRows(
  rows: NoteRow[],
  mode: HydrateMode = 'full',
): Promise<NoteWithUrls[]> {
  const ids = rows.map((r) => r.id);
  const [labelsMap, imagesMap] = await Promise.all([
    labelIdsByNote(ids),
    imagesByNote(ids),
  ]);

  // Wall mode is cache-only here so the grid can paint immediately.
  // Missing thumbs are filled later by resolveWallThumbs (batched).
  const thumbPaths: string[] = [];
  const fullPaths: string[] = [];

  if (mode === 'full') {
    for (const id of ids) {
      for (const img of imagesMap.get(id) ?? []) {
        fullPaths.push(img.storage_path);
        thumbPaths.push(img.storage_path);
      }
    }
  }

  const { fullByPath, thumbByPath } =
    mode === 'full'
      ? await signedUrlsForPaths({ fullPaths, thumbPaths })
      : { fullByPath: new Map<string, string>(), thumbByPath: new Map<string, string>() };

  const notes = rows.map((row) => {
    const imageRows = imagesMap.get(row.id) ?? [];
    const images = imageRows.map((img, index) => {
      const path = img.storage_path;
      const cached = getCachedSignedUrls(path);
      const full =
        fullByPath.get(path) ?? cached?.full ?? '';
      const thumb =
        mode === 'wall'
          ? full // wall never uses transform thumbs (slow + were poisoning the cache)
          : (thumbByPath.get(path) ?? cached?.thumb ?? full);
      if (mode === 'wall') {
        // Keep slots even without URLs so cards reserve photo space + overflow.
        return {
          id: img.id,
          position: img.position,
          url: index < NOTE_PREVIEW_IMAGE_LIMIT ? full : full || '',
          thumbUrl: index < NOTE_PREVIEW_IMAGE_LIMIT ? full : '',
        };
      }
      if (!full && !thumb) {
        return {
          id: img.id,
          position: img.position,
          url: '',
          thumbUrl: '',
        };
      }
      return {
        id: img.id,
        position: img.position,
        url: full || thumb,
        thumbUrl: thumb || full,
      };
    });
    const guidelineLines = resolveGuidelineLines({
      guidelineLines: row.guideline_lines,
      disposition: (row.disposition as NoteDisposition) ?? 'none',
    });
    const note: NoteWithUrls = {
      id: row.id,
      title: row.title,
      description: row.description,
      background: row.background as NoteBackground,
      disposition: primaryDispositionFromLines(guidelineLines),
      guidelineLines,
      categoryId:
        row.category_id ?? legacyCategoryToTypeId(row.category),
      stockId: row.stock_id ?? null,
      specialCase: row.special_case ?? '',
      askItems: normalizeAskItems(row.ask_items),
      pinned: row.pinned,
      archived: row.archived,
      deletedAt: row.deleted_at ? ms(row.deleted_at) : null,
      createdAt: ms(row.created_at),
      updatedAt: ms(row.updated_at),
      labelIds: labelsMap.get(row.id) ?? [],
      images,
    };
    return note;
  });

  return notes.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.updatedAt - a.updatedAt;
  });
}

/**
 * Wall preview signing uses batch `createSignedUrls` (one round-trip).
 * Viewport / near-viewport paths are signed before the rest of the wall.
 */
const WALL_URL_SIGN_BATCH = 24;
/** First paint: roughly one screen of card previews (1–2 images each). */
const WALL_VIEWPORT_FIRST_PATHS = 24;

type WallSignState = {
  notes: NoteWithUrls[];
  onBatch?: (notes: NoteWithUrls[]) => void;
  /** Paths that should be signed before the backlog (viewport). */
  priority: string[];
  backlog: string[];
  running: boolean;
  generation: number;
};

let wallSign: WallSignState | null = null;
let wallSignGeneration = 0;

function collectMissingWallPaths(notes: NoteWithUrls[]): string[] {
  const missingPaths: string[] = [];
  const seen = new Set<string>();
  for (const note of notes) {
    for (const img of note.images.slice(0, NOTE_PREVIEW_IMAGE_LIMIT)) {
      const path = storagePathByImageId.get(img.id);
      if (!path || seen.has(path)) continue;
      seen.add(path);
      if (getCachedSignedUrls(path)?.full) continue;
      missingPaths.push(path);
    }
  }
  return missingPaths;
}

function takePaths(from: string[], limit: number): string[] {
  const batch: string[] = [];
  while (from.length > 0 && batch.length < limit) {
    const path = from.shift()!;
    if (getCachedSignedUrls(path)?.full) continue;
    if (batch.includes(path)) continue;
    batch.push(path);
  }
  return batch;
}

async function pumpWallSignQueue(): Promise<void> {
  const state = wallSign;
  if (!state || state.running) return;
  state.running = true;
  const gen = state.generation;
  try {
    while (wallSign === state && state.generation === gen) {
      // Always finish viewport priority before backlog.
      const batch =
        state.priority.length > 0
          ? takePaths(state.priority, WALL_URL_SIGN_BATCH)
          : takePaths(state.backlog, WALL_URL_SIGN_BATCH);
      if (batch.length === 0) {
        if (state.priority.length === 0 && state.backlog.length === 0) break;
        continue;
      }
      await signedUrlsForPaths({ fullPaths: batch, thumbPaths: [] });
      if (wallSign !== state || state.generation !== gen) return;
      state.notes = applyCachedImageUrls(state.notes);
      state.onBatch?.(state.notes);
    }
  } finally {
    if (wallSign === state) state.running = false;
  }
  // Work may have been prioritized while a batch was in flight.
  if (
    wallSign === state &&
    state.generation === gen &&
    (state.priority.length > 0 || state.backlog.length > 0)
  ) {
    void pumpWallSignQueue();
  }
}

/**
 * Prefer signing these note images next (cards entering the viewport).
 * No-op when URLs are already cached.
 */
export function prioritizeWallImages(imageIds: string[]): void {
  const state = wallSign;
  if (!state) return;
  let added = false;
  for (const id of imageIds) {
    const path = storagePathByImageId.get(id);
    if (!path || getCachedSignedUrls(path)?.full) continue;
    // Move to front of priority (dedupe).
    state.priority = state.priority.filter((p) => p !== path);
    state.backlog = state.backlog.filter((p) => p !== path);
    state.priority.unshift(path);
    added = true;
  }
  if (added) void pumpWallSignQueue();
}

/**
 * Sign missing wall preview URLs. Viewport-sized batch first, then the rest.
 * Cards can call `prioritizeWallImages` to jump the queue when they appear.
 */
export async function resolveWallThumbs(
  notes: NoteWithUrls[],
  onBatch?: (notes: NoteWithUrls[]) => void,
): Promise<NoteWithUrls[]> {
  let current = applyCachedImageUrls(notes);
  if (current !== notes) onBatch?.(current);

  const missingPaths = collectMissingWallPaths(current);
  if (missingPaths.length === 0) return current;

  const generation = ++wallSignGeneration;
  const priority = missingPaths.slice(0, WALL_VIEWPORT_FIRST_PATHS);
  const backlog = missingPaths.slice(WALL_VIEWPORT_FIRST_PATHS);
  wallSign = {
    notes: current,
    onBatch,
    priority: [...priority],
    backlog: [...backlog],
    running: false,
    generation,
  };

  await pumpWallSignQueue();

  if (wallSign?.generation === generation) {
    current = wallSign.notes;
    wallSign = null;
  }
  return applyCachedImageUrls(current);
}

/**
 * Upgrade wall-hydrated notes to full-resolution image URLs (editor / lightbox).
 * No-op when every image already has a distinct cached full URL.
 */
export async function ensureFullImageUrls(
  note: NoteWithUrls,
): Promise<NoteWithUrls | null> {
  if (note.images.length === 0) return null;

  const paths: string[] = [];
  for (const img of note.images) {
    const path = storagePathByImageId.get(img.id);
    if (path) paths.push(path);
  }

  // Paths unknown (e.g. after hot reload) — full re-hydrate that note.
  if (paths.length !== note.images.length) {
    const fresh = await getNote(note.id);
    return fresh ?? null;
  }

  const missingFull = paths.filter((path) => !getCachedSignedUrls(path)?.full);
  if (missingFull.length > 0) {
    await signedUrlsForPaths({
      fullPaths: missingFull,
      thumbPaths: [],
    });
  }

  let changed = false;
  const images = note.images.map((img) => {
    const path = storagePathByImageId.get(img.id)!;
    const cached = getCachedSignedUrls(path);
    const full = cached?.full;
    if (!full) return img;
    const thumb = cached?.thumb || img.thumbUrl || full;
    if (full === img.url && thumb === img.thumbUrl) return img;
    changed = true;
    return {
      ...img,
      url: full,
      thumbUrl: thumb,
    };
  });

  return changed ? { ...note, images } : null;
}

async function replaceNoteLabels(noteId: string, labelIds: string[]) {
  const supabase = getSupabase();
  const { error: delError } = await supabase
    .from('note_labels')
    .delete()
    .eq('note_id', noteId);
  throwIf(delError);
  const unique = [...new Set(labelIds)];
  if (unique.length === 0) return;
  const { error } = await supabase.from('note_labels').insert(
    unique.map((label_id) => ({ note_id: noteId, label_id })),
  );
  throwIf(error);
}

export async function listNotes(): Promise<NoteWithUrls[]> {
  // Seed defaults only when the caller can edit (viewers must not insert).
  if (await canEditLibraryRpc()) {
    await ensureDefaultNoteTypes();
  }
  const { data, error } = await getSupabase()
    .from('notes')
    .select('*')
    .is('deleted_at', null);
  throwIf(error);
  // Wall browse: metadata + cached URLs only (fast). Call resolveWallThumbs next.
  return hydrateRows((data ?? []) as NoteRow[], 'wall');
}

export async function getNote(id: string): Promise<NoteWithUrls | undefined> {
  await requireUserId();
  const { data, error } = await getSupabase()
    .from('notes')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  throwIf(error);
  if (!data) return undefined;
  const [note] = await hydrateRows([data as NoteRow]);
  return note;
}

export async function createNote(input?: {
  title?: string;
  description?: string;
  background?: NoteBackground;
  disposition?: NoteDisposition;
  guidelineLines?: GuidelineLine[];
  categoryId?: string | null;
  stockId?: string | null;
  specialCase?: string;
  labelIds?: string[];
}): Promise<NoteWithUrls> {
  const ownerId = await requireLibraryOwnerId();
  await ensureDefaultNoteTypes();
  const guidelineLines =
    input?.guidelineLines != null
      ? resolveGuidelineLines({ guidelineLines: input.guidelineLines })
      : alwaysGuidelineLines(input?.disposition ?? 'none');
  const disposition = primaryDispositionFromLines(guidelineLines);
  const { data, error } = await getSupabase()
    .from('notes')
    .insert({
      owner_id: ownerId,
      title: input?.title ?? '',
      description: input?.description ?? '',
      background: input?.background ?? 'default',
      disposition,
      guideline_lines: guidelineLines,
      category: 'none',
      category_id: input?.categoryId ?? null,
      stock_id: input?.stockId ?? null,
      special_case: input?.specialCase ?? '',
      ask_items: [],
    })
    .select('*')
    .single();
  throwIf(error);
  const row = data as NoteRow;
  const labelIds = input?.labelIds?.length ? [...input.labelIds] : [];
  if (labelIds.length) {
    await replaceNoteLabels(row.id, labelIds);
  }
  // Skip getNote round-trip — new notes have no images yet.
  return noteFromRow(row, labelIds);
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
      | 'guidelineLines'
      | 'categoryId'
      | 'stockId'
      | 'specialCase'
      | 'askItems'
    >
  >,
): Promise<NoteWithUrls | undefined> {
  await requireUserId();
  const {
    labelIds,
    specialCase,
    stockId,
    categoryId,
    guidelineLines,
    disposition,
    askItems,
    ...rest
  } = patch;
  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (rest.title !== undefined) update.title = rest.title;
  if (rest.description !== undefined) update.description = rest.description;
  if (rest.background !== undefined) update.background = rest.background;
  if (rest.pinned !== undefined) update.pinned = rest.pinned;
  if (rest.archived !== undefined) update.archived = rest.archived;
  if (categoryId !== undefined) update.category_id = categoryId;
  if (stockId !== undefined) update.stock_id = stockId;
  if (specialCase !== undefined) update.special_case = specialCase;
  if (askItems !== undefined) update.ask_items = normalizeAskItems(askItems);

  if (guidelineLines !== undefined) {
    const lines = resolveGuidelineLines({ guidelineLines });
    update.guideline_lines = lines;
    update.disposition = primaryDispositionFromLines(lines);
  } else if (disposition !== undefined) {
    const lines = alwaysGuidelineLines(disposition);
    update.guideline_lines = lines;
    update.disposition = primaryDispositionFromLines(lines);
  }

  const { error } = await getSupabase().from('notes').update(update).eq('id', id);
  throwIf(error);
  if (labelIds) await replaceNoteLabels(id, labelIds);
  return getNote(id);
}

export async function softDeleteNotes(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await requireUserId();
  const now = new Date().toISOString();
  const { error } = await getSupabase()
    .from('notes')
    .update({ deleted_at: now, updated_at: now })
    .in('id', ids)
    .is('deleted_at', null);
  throwIf(error);
}

export async function restoreNotes(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await requireUserId();
  const now = new Date().toISOString();
  const { error } = await getSupabase()
    .from('notes')
    .update({ deleted_at: null, updated_at: now })
    .in('id', ids);
  throwIf(error);
}

export async function purgeNotes(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const ownerId = await requireLibraryOwnerId();
  const supabase = getSupabase();

  const { data: images, error: imgError } = await supabase
    .from('note_images')
    .select('storage_path')
    .in('note_id', ids);
  throwIf(imgError);
  const paths = ((images ?? []) as { storage_path: string }[]).map(
    (i) => i.storage_path,
  );
  if (paths.length > 0) {
    await supabase.storage.from(BUCKET).remove(paths);
  }

  const { error } = await supabase
    .from('notes')
    .delete()
    .in('id', ids)
    .eq('owner_id', ownerId);
  throwIf(error);
}

export async function purgeSoftDeletedNotes(): Promise<void> {
  if (!(await canEditLibraryRpc())) return;
  await requireUserId();
  const { data, error } = await getSupabase()
    .from('notes')
    .select('id')
    .not('deleted_at', 'is', null);
  throwIf(error);
  const ids = ((data ?? []) as { id: string }[]).map((r) => r.id);
  await purgeNotes(ids);
}

export async function deleteNote(id: string): Promise<void> {
  await purgeNotes([id]);
}

export async function addImage(
  noteId: string,
  file: File | Blob,
): Promise<NoteWithUrls | undefined> {
  const ownerId = await requireLibraryOwnerId();
  const supabase = getSupabase();
  const imageId = crypto.randomUUID();
  const path = `${ownerId}/${noteId}/${imageId}`;

  const { data: existing, error: listError } = await supabase
    .from('note_images')
    .select('position')
    .eq('note_id', noteId)
    .order('position', { ascending: false })
    .limit(1);
  throwIf(listError);
  const nextPos =
    existing && existing.length > 0
      ? ((existing[0] as { position: number }).position ?? 0) + 1
      : 0;

  const contentType =
    file.type ||
    (file instanceof File ? file.type : '') ||
    'image/jpeg';
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType });
  throwIf(uploadError);

  const { error } = await supabase.from('note_images').insert({
    id: imageId,
    note_id: noteId,
    owner_id: ownerId,
    storage_path: path,
    position: nextPos,
  });
  throwIf(error);

  await supabase
    .from('notes')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', noteId);

  return getNote(noteId);
}

export async function removeImage(
  noteId: string,
  imageId: string,
): Promise<NoteWithUrls | undefined> {
  await requireUserId();
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('note_images')
    .select('storage_path')
    .eq('id', imageId)
    .eq('note_id', noteId)
    .maybeSingle();
  throwIf(error);
  if (data) {
    await supabase.storage
      .from(BUCKET)
      .remove([(data as { storage_path: string }).storage_path]);
  }
  const { error: delError } = await supabase
    .from('note_images')
    .delete()
    .eq('id', imageId);
  throwIf(delError);
  await supabase
    .from('notes')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', noteId);
  return getNote(noteId);
}

export async function reorderImages(
  noteId: string,
  orderedImageIds: string[],
): Promise<NoteWithUrls | undefined> {
  await requireUserId();
  const supabase = getSupabase();
  for (let i = 0; i < orderedImageIds.length; i++) {
    const { error } = await supabase
      .from('note_images')
      .update({ position: i })
      .eq('id', orderedImageIds[i])
      .eq('note_id', noteId);
    throwIf(error);
  }
  await supabase
    .from('notes')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', noteId);
  return getNote(noteId);
}

export async function listLabels(): Promise<Label[]> {
  await requireUserId();
  const { data, error } = await getSupabase()
    .from('labels')
    .select('id, name')
    .order('name');
  throwIf(error);
  return ((data ?? []) as LabelRow[]).map((l) => ({ id: l.id, name: l.name }));
}

export async function createLabel(name: string): Promise<Label> {
  const ownerId = await requireLibraryOwnerId();
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Label name required');
  const { data, error } = await getSupabase()
    .from('labels')
    .insert({ owner_id: ownerId, name: trimmed })
    .select('id, name')
    .single();
  throwIf(error);
  const row = data as LabelRow;
  return { id: row.id, name: row.name };
}

export async function deleteLabel(id: string): Promise<void> {
  await requireUserId();
  const { error } = await getSupabase().from('labels').delete().eq('id', id);
  throwIf(error);
}

async function ensureDefaultNoteTypes(): Promise<void> {
  const ownerId = await requireLibraryOwnerId();
  const supabase = getSupabase();
  const { count, error } = await supabase
    .from('note_types')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', ownerId);
  throwIf(error);
  // Only seed on a completely empty catalog so deleted defaults stay gone.
  if ((count ?? 0) > 0) return;
  const { error: insertError } = await supabase.from('note_types').insert(
    DEFAULT_NOTE_TYPES.map((type) => ({
      id: type.id,
      owner_id: ownerId,
      name: type.name,
      color: type.color,
      icon: type.icon,
      parent_id: null,
    })),
  );
  throwIf(insertError);
}

function mapNoteTypeRow(row: NoteTypeRow): NoteType {
  return {
    id: row.id,
    name: row.name,
    color: row.color as NoteTypeColor,
    icon: row.icon as NoteTypeIcon,
    parentId: row.parent_id ?? null,
  };
}

export async function listNoteTypes(): Promise<NoteType[]> {
  if (await canEditLibraryRpc()) {
    await ensureDefaultNoteTypes();
  }
  const { data, error } = await getSupabase()
    .from('note_types')
    .select('id, name, color, icon, parent_id')
    .order('name');
  throwIf(error);
  return ((data ?? []) as NoteTypeRow[])
    .map(mapNoteTypeRow)
    .sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
    );
}

export async function createNoteType(
  name: string,
  parentId?: string | null,
): Promise<NoteType> {
  const ownerId = await requireLibraryOwnerId();
  await ensureDefaultNoteTypes();
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Type name required');

  let resolvedParentId: string | null = parentId ?? null;
  const supabase = getSupabase();

  if (resolvedParentId) {
    const { data: parentRow, error: parentError } = await supabase
      .from('note_types')
      .select('id, name, color, icon, parent_id')
      .eq('owner_id', ownerId)
      .eq('id', resolvedParentId)
      .maybeSingle();
    throwIf(parentError);
    if (!parentRow) throw new Error('Parent type not found');
    const parent = mapNoteTypeRow(parentRow as NoteTypeRow);
    if (parent.parentId) {
      throw new Error('Subtypes can only be added under a top-level type');
    }
  }

  const { data: existing, error: existingError } = await supabase
    .from('note_types')
    .select('id, name, color, icon, parent_id')
    .eq('owner_id', ownerId)
    .eq('name', trimmed)
    .maybeSingle();
  throwIf(existingError);
  if (existing) return mapNoteTypeRow(existing as NoteTypeRow);

  const all = await listNoteTypes();
  const parent = resolvedParentId
    ? all.find((t) => t.id === resolvedParentId) ?? null
    : null;
  const noteType: NoteType = {
    id: crypto.randomUUID(),
    name: trimmed,
    color: parent?.color ?? nextNoteTypeColor(all),
    icon: parent?.icon ?? guessIconFromName(trimmed),
    parentId: resolvedParentId,
  };
  const { data, error } = await supabase
    .from('note_types')
    .insert({
      id: noteType.id,
      owner_id: ownerId,
      name: noteType.name,
      color: noteType.color,
      icon: noteType.icon,
      parent_id: noteType.parentId,
    })
    .select('id, name, color, icon, parent_id')
    .single();
  throwIf(error);
  return mapNoteTypeRow(data as NoteTypeRow);
}

export async function deleteNoteType(id: string): Promise<void> {
  await requireUserId();
  const supabase = getSupabase();
  const all = await listNoteTypes();
  const removeIds = [id, ...all.filter((t) => t.parentId === id).map((t) => t.id)];

  const { error: clearError } = await supabase
    .from('notes')
    .update({ category_id: null, updated_at: new Date().toISOString() })
    .in('category_id', removeIds);
  throwIf(clearError);

  // Delete children first, then parent (parent_id cascade also covers this).
  const childIds = removeIds.filter((removeId) => removeId !== id);
  if (childIds.length > 0) {
    const { error: childError } = await supabase
      .from('note_types')
      .delete()
      .in('id', childIds);
    throwIf(childError);
  }
  const { error } = await supabase.from('note_types').delete().eq('id', id);
  throwIf(error);
}

export async function listStockLocations(): Promise<StockLocation[]> {
  await requireUserId();
  const { data, error } = await getSupabase()
    .from('stock_locations')
    .select('id, name')
    .order('name');
  throwIf(error);
  return ((data ?? []) as LabelRow[]).map((l) => ({ id: l.id, name: l.name }));
}

export async function createStockLocation(name: string): Promise<StockLocation> {
  const ownerId = await requireLibraryOwnerId();
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Stock name required');
  const { data, error } = await getSupabase()
    .from('stock_locations')
    .insert({ owner_id: ownerId, name: trimmed })
    .select('id, name')
    .single();
  throwIf(error);
  const row = data as LabelRow;
  return { id: row.id, name: row.name };
}

export async function deleteStockLocation(id: string): Promise<void> {
  await requireUserId();
  const supabase = getSupabase();
  const { error: clearError } = await supabase
    .from('notes')
    .update({ stock_id: null, updated_at: new Date().toISOString() })
    .eq('stock_id', id);
  throwIf(clearError);
  const { error } = await supabase.from('stock_locations').delete().eq('id', id);
  throwIf(error);
}

export async function setNoteLabels(
  noteId: string,
  labelIds: string[],
): Promise<NoteWithUrls | undefined> {
  return updateNote(noteId, { labelIds: [...new Set(labelIds)] });
}

export async function listReactionsForNote(
  noteId: string,
): Promise<Reaction[]> {
  await requireUserId();
  const { data, error } = await getSupabase()
    .from('reactions')
    .select('id, note_id, emoji, count')
    .eq('note_id', noteId);
  throwIf(error);
  return ((data ?? []) as ReactionRow[]).map((r) => ({
    id: r.id,
    noteId: r.note_id,
    emoji: r.emoji as ReactionEmoji,
    count: r.count,
  }));
}

export async function listAllReactions(): Promise<Reaction[]> {
  await requireUserId();
  const { data, error } = await getSupabase()
    .from('reactions')
    .select('id, note_id, emoji, count');
  throwIf(error);
  return ((data ?? []) as ReactionRow[]).map((r) => ({
    id: r.id,
    noteId: r.note_id,
    emoji: r.emoji as ReactionEmoji,
    count: r.count,
  }));
}

export async function toggleReaction(
  noteId: string,
  emoji: ReactionEmoji,
): Promise<Reaction[]> {
  const ownerId = await requireUserId();
  const supabase = getSupabase();
  const { data: existing, error } = await supabase
    .from('reactions')
    .select('id, count')
    .eq('note_id', noteId)
    .eq('owner_id', ownerId)
    .eq('emoji', emoji)
    .maybeSingle();
  throwIf(error);

  if (existing) {
    const { error: delError } = await supabase
      .from('reactions')
      .delete()
      .eq('id', (existing as { id: string }).id);
    throwIf(delError);
  } else {
    const { error: insError } = await supabase.from('reactions').insert({
      note_id: noteId,
      owner_id: ownerId,
      emoji,
      count: 1,
    });
    throwIf(insError);
  }
  return listReactionsForNote(noteId);
}

export async function listCartItems(): Promise<CartItem[]> {
  await requireUserId();
  const { data, error } = await getSupabase()
    .from('cart_items')
    .select('note_id, quantity');
  throwIf(error);
  return ((data ?? []) as CartRow[])
    .filter((i) => i.quantity > 0)
    .map((i) => ({ noteId: i.note_id, quantity: i.quantity }))
    .sort((a, b) => a.noteId.localeCompare(b.noteId));
}

export async function addToCart(
  noteIds: string[],
  amount = 1,
): Promise<CartItem[]> {
  if (noteIds.length === 0 || amount <= 0) return listCartItems();
  const ownerId = await requireUserId();
  const supabase = getSupabase();
  for (const noteId of noteIds) {
    const { data: existing } = await supabase
      .from('cart_items')
      .select('quantity')
      .eq('owner_id', ownerId)
      .eq('note_id', noteId)
      .maybeSingle();
    const quantity =
      ((existing as { quantity?: number } | null)?.quantity ?? 0) + amount;
    const { error } = await supabase.from('cart_items').upsert({
      owner_id: ownerId,
      note_id: noteId,
      quantity,
    });
    throwIf(error);
  }
  return listCartItems();
}

export async function setCartQuantity(
  noteId: string,
  quantity: number,
): Promise<CartItem[]> {
  const ownerId = await requireUserId();
  const supabase = getSupabase();
  if (quantity <= 0) {
    const { error } = await supabase
      .from('cart_items')
      .delete()
      .eq('owner_id', ownerId)
      .eq('note_id', noteId);
    throwIf(error);
  } else {
    const { error } = await supabase.from('cart_items').upsert({
      owner_id: ownerId,
      note_id: noteId,
      quantity,
    });
    throwIf(error);
  }
  return listCartItems();
}

export async function removeFromCart(noteId: string): Promise<CartItem[]> {
  return setCartQuantity(noteId, 0);
}

export async function clearCart(): Promise<void> {
  const ownerId = await requireUserId();
  const { error } = await getSupabase()
    .from('cart_items')
    .delete()
    .eq('owner_id', ownerId);
  throwIf(error);
}

export function cartUnitCount(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.quantity, 0);
}

type NoteLinkRow = { note_id_a: string; note_id_b: string };

export async function listNoteLinks(): Promise<NoteLink[]> {
  await requireUserId();
  const { data, error } = await getSupabase()
    .from('note_links')
    .select('note_id_a, note_id_b');
  throwIf(error);
  return ((data ?? []) as NoteLinkRow[])
    .map((row) => ({ noteIdA: row.note_id_a, noteIdB: row.note_id_b }))
    .sort((a, b) => linkKey(a).localeCompare(linkKey(b)));
}

export async function linkNotes(
  noteIds: string[],
): Promise<{ links: NoteLink[]; created: NoteLink[] }> {
  const pairs = meshLinkPairs(noteIds);
  if (pairs.length === 0) {
    return { links: await listNoteLinks(), created: [] };
  }
  await requireUserId();
  const existing = await listNoteLinks();
  const existingKeys = new Set(existing.map(linkKey));
  const created = pairs.filter((p) => !existingKeys.has(linkKey(p)));
  if (created.length > 0) {
    const { error } = await getSupabase().from('note_links').upsert(
      created.map((p) => ({
        note_id_a: p.noteIdA,
        note_id_b: p.noteIdB,
      })),
      { onConflict: 'note_id_a,note_id_b', ignoreDuplicates: true },
    );
    throwIf(error);
  }
  return { links: await listNoteLinks(), created };
}

export async function unlinkNotes(
  noteIdA: string,
  noteIdB: string,
): Promise<NoteLink[]> {
  const pair = normalizeLinkPair(noteIdA, noteIdB);
  if (!pair) return listNoteLinks();
  await requireUserId();
  const { error } = await getSupabase()
    .from('note_links')
    .delete()
    .eq('note_id_a', pair.noteIdA)
    .eq('note_id_b', pair.noteIdB);
  throwIf(error);
  return listNoteLinks();
}

export async function restoreNoteLinks(
  pairs: NoteLink[],
): Promise<NoteLink[]> {
  if (pairs.length === 0) return listNoteLinks();
  await requireUserId();
  const normalized = pairs
    .map((p) => normalizeLinkPair(p.noteIdA, p.noteIdB))
    .filter((p): p is NoteLink => Boolean(p));
  if (normalized.length === 0) return listNoteLinks();
  const { error } = await getSupabase().from('note_links').upsert(
    normalized.map((p) => ({
      note_id_a: p.noteIdA,
      note_id_b: p.noteIdB,
    })),
    { onConflict: 'note_id_a,note_id_b', ignoreDuplicates: true },
  );
  throwIf(error);
  return listNoteLinks();
}

export async function removeNoteLinks(
  pairs: NoteLink[],
): Promise<NoteLink[]> {
  if (pairs.length === 0) return listNoteLinks();
  await requireUserId();
  for (const raw of pairs) {
    const pair = normalizeLinkPair(raw.noteIdA, raw.noteIdB);
    if (!pair) continue;
    const { error } = await getSupabase()
      .from('note_links')
      .delete()
      .eq('note_id_a', pair.noteIdA)
      .eq('note_id_b', pair.noteIdB);
    throwIf(error);
  }
  return listNoteLinks();
}

// silence unused iso helper if tree-shaken awkwardly
void iso;

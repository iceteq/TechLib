import type {
  CartItem,
  Label,
  Note,
  NoteBackground,
  NoteCategory,
  NoteDisposition,
  NoteWithUrls,
  Reaction,
  ReactionEmoji,
  StockLocation,
} from './types';
import { normalizeCategory } from './types';
import { getSupabase } from './supabaseClient';

const BUCKET = 'note-images';

type NoteRow = {
  id: string;
  owner_id: string;
  title: string;
  description: string;
  background: string;
  disposition: string;
  category: string;
  stock_id: string | null;
  special_case: string;
  pinned: boolean;
  archived: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
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

async function requireUserId(): Promise<string> {
  const { data, error } = await getSupabase().auth.getUser();
  if (error || !data.user) throw new Error('Not signed in');
  return data.user.id;
}

function throwIf(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

async function signedUrl(path: string): Promise<string> {
  const { data, error } = await getSupabase()
    .storage.from(BUCKET)
    .createSignedUrl(path, 60 * 60 * 12);
  throwIf(error);
  return data!.signedUrl;
}

async function labelIdsByNote(
  noteIds: string[],
): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (noteIds.length === 0) return map;
  const { data, error } = await getSupabase()
    .from('note_labels')
    .select('note_id, label_id')
    .in('note_id', noteIds);
  throwIf(error);
  for (const row of (data ?? []) as NoteLabelRow[]) {
    const list = map.get(row.note_id) ?? [];
    list.push(row.label_id);
    map.set(row.note_id, list);
  }
  return map;
}

async function imagesByNote(
  noteIds: string[],
): Promise<Map<string, ImageRow[]>> {
  const map = new Map<string, ImageRow[]>();
  if (noteIds.length === 0) return map;
  const { data, error } = await getSupabase()
    .from('note_images')
    .select('id, note_id, storage_path, position')
    .in('note_id', noteIds)
    .order('position', { ascending: true });
  throwIf(error);
  for (const row of (data ?? []) as ImageRow[]) {
    const list = map.get(row.note_id) ?? [];
    list.push(row);
    map.set(row.note_id, list);
  }
  return map;
}

async function hydrateRows(rows: NoteRow[]): Promise<NoteWithUrls[]> {
  const ids = rows.map((r) => r.id);
  const [labelsMap, imagesMap] = await Promise.all([
    labelIdsByNote(ids),
    imagesByNote(ids),
  ]);

  const notes = await Promise.all(
    rows.map(async (row) => {
      const imageRows = imagesMap.get(row.id) ?? [];
      const images = await Promise.all(
        imageRows.map(async (img) => ({
          id: img.id,
          position: img.position,
          url: await signedUrl(img.storage_path),
        })),
      );
      const note: NoteWithUrls = {
        id: row.id,
        title: row.title,
        description: row.description,
        background: row.background as NoteBackground,
        disposition: (row.disposition as NoteDisposition) ?? 'none',
        category: normalizeCategory(row.category),
        stockId: row.stock_id ?? null,
        specialCase: row.special_case ?? '',
        pinned: row.pinned,
        archived: row.archived,
        deletedAt: row.deleted_at ? ms(row.deleted_at) : null,
        createdAt: ms(row.created_at),
        updatedAt: ms(row.updated_at),
        labelIds: labelsMap.get(row.id) ?? [],
        images,
      };
      return note;
    }),
  );

  return notes.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.updatedAt - a.updatedAt;
  });
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
  await requireUserId();
  const { data, error } = await getSupabase()
    .from('notes')
    .select('*')
    .is('deleted_at', null);
  throwIf(error);
  return hydrateRows((data ?? []) as NoteRow[]);
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
  category?: NoteCategory;
  stockId?: string | null;
  specialCase?: string;
  labelIds?: string[];
}): Promise<NoteWithUrls> {
  const ownerId = await requireUserId();
  const { data, error } = await getSupabase()
    .from('notes')
    .insert({
      owner_id: ownerId,
      title: input?.title ?? '',
      description: input?.description ?? '',
      background: input?.background ?? 'default',
      disposition: input?.disposition ?? 'none',
      category: input?.category ?? 'none',
      stock_id: input?.stockId ?? null,
      special_case: input?.specialCase ?? '',
    })
    .select('*')
    .single();
  throwIf(error);
  const row = data as NoteRow;
  if (input?.labelIds?.length) {
    await replaceNoteLabels(row.id, input.labelIds);
  }
  const note = await getNote(row.id);
  if (!note) throw new Error('Failed to create note');
  return note;
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
      | 'stockId'
      | 'specialCase'
    >
  >,
): Promise<NoteWithUrls | undefined> {
  await requireUserId();
  const { labelIds, specialCase, stockId, ...rest } = patch;
  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (rest.title !== undefined) update.title = rest.title;
  if (rest.description !== undefined) update.description = rest.description;
  if (rest.background !== undefined) update.background = rest.background;
  if (rest.pinned !== undefined) update.pinned = rest.pinned;
  if (rest.archived !== undefined) update.archived = rest.archived;
  if (rest.disposition !== undefined) update.disposition = rest.disposition;
  if (rest.category !== undefined) update.category = rest.category;
  if (stockId !== undefined) update.stock_id = stockId;
  if (specialCase !== undefined) update.special_case = specialCase;

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
  const ownerId = await requireUserId();
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
  const ownerId = await requireUserId();
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
  const ownerId = await requireUserId();
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
  const ownerId = await requireUserId();
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

// silence unused iso helper if tree-shaken awkwardly
void iso;

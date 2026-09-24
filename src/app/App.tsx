import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { loadViewPrefs, saveViewPrefs } from '../lib/viewPrefs';
import {
  loadCreateDefaults,
  saveCreateDefaults,
  type CreateDefaults,
} from '../lib/createDefaults';
import {
  loadFilterSession,
  saveFilterSession,
} from '../lib/filterSession';
import { AppShell } from '../features/shell/AppShell';
import { Sidebar } from '../features/shell/Sidebar';
import { CollectionView } from '../features/notes/CollectionView';
import { NoteEditor } from '../features/notes/NoteEditor';
import { NoteGrid } from '../features/notes/NoteGrid';
import { PasteNotesDialog } from '../features/notes/PasteNotesDialog';
import { ImportBurst } from '../features/notes/ImportBurst';
import { UndoToast } from '../features/notes/UndoToast';
import type {
  CartItem,
  Label,
  NoteLink,
  Reaction,
  ReactionEmoji,
  StockLocation,
  NoteBackground,
  NoteDisposition,
  NoteType,
  NotesView,
  NoteWithUrls,
} from '../lib/types';
import {
  DISPOSITIONS,
} from '../lib/types';
import {
  categoryLabel,
  countNotesByLabel,
  countNotesByStock,
  countNotesByType,
  dispositionLabel,
  filterNotes,
  noteIsSorted,
  stockLabel,
} from '../lib/searchNotes';
import { noteTypeDeleteIds, noteTypePathLabel } from '../lib/noteTypes';
import { loadRecentOpens, touchRecentOpen } from '../lib/recentOpens';
import { sortWallNotes } from '../lib/sortWallNotes';
import { relatedIdsFromLinks, mergeRelatedIds } from '../lib/noteLinks';
import {
  normalizePartNumber,
  noteMatchesPartNumberKey,
  partNumberFamilyCount,
  partNumberLabel,
  relatedIdsByPartNumber,
} from '../lib/partNumber';
import type { RelatedNoteEntry } from '../features/notes/RelatedSection';

import type { PastedNoteDraft } from '../lib/parsePastedNotes';
import {
  describeNoteAssign,
  noteAssignPatch,
  type NoteAssignTarget,
} from '../lib/noteDrag';
import {
  normalizeGuidelineLines,
  resolveGuidelineLines,
  upsertGuidelineLineByWhen,
} from '../lib/guidelineLines';
import type { BulkGuidelineEdit } from '../features/notes/BulkGuidelineDialog';
import type { GuidelineLine } from '../lib/types';
import {
  clipboardHasPlainText,
  clipboardImageFiles,
} from '../lib/imageFiles';
import * as store from '../lib/notesStore';
import { isCloudConfigured } from '../lib/supabaseClient';
import { signOutCloud } from '../features/auth/AuthGate';
import { MembersDialog } from '../features/auth/MembersDialog';
import type { Session } from '@supabase/supabase-js';
import {
  canEditLibrary,
  ensureWorkspaceMembership,
  isLibraryAdmin,
  LOCAL_MEMBERSHIP,
  type WorkspaceMembership,
} from '../lib/workspace';

type NoteFieldPatch = {
  disposition?: NoteDisposition;
  guidelineLines?: import('../lib/types').GuidelineLine[];
  categoryId?: string | null;
  stockId?: string | null;
  labelIds?: string[];
  archived?: boolean;
};

type UndoAction =
  | { kind: 'import'; ids: string[] }
  | { kind: 'delete'; ids: string[] }
  | {
      kind: 'patch';
      message: string;
      before: Array<{ id: string; patch: NoteFieldPatch }>;
    }
  | { kind: 'cart-clear'; items: CartItem[] }
  | { kind: 'note-link'; pairs: NoteLink[] }
  | { kind: 'note-unlink'; pairs: NoteLink[] };

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  return Boolean(target.closest('[contenteditable="true"]'));
}

/** Create meta from sticky pins only — browse filters do not inherit. */
function createMetaFromDefaults(defaults: {
  categoryId: string | null;
  stockId: string | null;
}): {
  disposition: NoteDisposition;
  categoryId: string | null;
  stockId: string | null;
} {
  return {
    disposition: 'none',
    categoryId: defaults.categoryId,
    stockId: defaults.stockId,
  };
}

function snapshotNotePatch(
  note: NoteWithUrls,
  patch: NoteFieldPatch,
): NoteFieldPatch {
  const before: NoteFieldPatch = {};
  if (patch.disposition !== undefined) {
    before.disposition = note.disposition ?? 'none';
  }
  if (patch.guidelineLines !== undefined) {
    before.guidelineLines = note.guidelineLines ?? [];
  }
  if ('categoryId' in patch) {
    before.categoryId = note.categoryId;
  }
  if ('stockId' in patch) {
    before.stockId = note.stockId;
  }
  if (patch.labelIds !== undefined) {
    before.labelIds = [...note.labelIds];
  }
  if (patch.archived !== undefined) {
    before.archived = note.archived;
  }
  return before;
}

function describeBulkPatch(
  count: number,
  patch: NoteFieldPatch,
  noteTypes: NoteType[],
  stockLocations: StockLocation[],
): string {
  const noteWord = count === 1 ? 'note' : 'notes';
  if (patch.disposition !== undefined) {
    if (patch.disposition === 'none') {
      return `Cleared Guideline on ${count} ${noteWord}`;
    }
    const short =
      DISPOSITIONS.find((d) => d.id === patch.disposition)?.short ||
      patch.disposition;
    return `Set Guideline to “${short}” on ${count} ${noteWord}`;
  }
  if (patch.guidelineLines !== undefined) {
    const n = patch.guidelineLines.length;
    if (n === 0) {
      return `Cleared Guideline on ${count} ${noteWord}`;
    }
    return `Updated Guideline (${n} rule${n === 1 ? '' : 's'}) on ${count} ${noteWord}`;
  }
  if ('categoryId' in patch) {
    if (!patch.categoryId) {
      return `Cleared Type on ${count} ${noteWord}`;
    }
    const name =
      noteTypePathLabel(noteTypes, patch.categoryId) ?? 'Type';
    return `Set Type to “${name}” on ${count} ${noteWord}`;
  }
  if ('stockId' in patch) {
    if (!patch.stockId) {
      return `Cleared Stock on ${count} ${noteWord}`;
    }
    const name =
      stockLocations.find((s) => s.id === patch.stockId)?.name ?? 'Stock';
    return `Set Stock to “${name}” on ${count} ${noteWord}`;
  }
  if (patch.labelIds !== undefined) {
    if (patch.labelIds.length === 0) {
      return `Cleared labels on ${count} ${noteWord}`;
    }
    return `Set label on ${count} ${noteWord}`;
  }
  if (patch.archived !== undefined) {
    return patch.archived
      ? `Archived ${count} ${noteWord}`
      : `Unarchived ${count} ${noteWord}`;
  }
  return `Updated ${count} ${noteWord}`;
}

export default function App({ session }: { session: Session | null }) {
  const [membership, setMembership] = useState<WorkspaceMembership | null>(
    isCloudConfigured() ? null : LOCAL_MEMBERSHIP,
  );
  const [membersOpen, setMembersOpen] = useState(false);
  const canEdit = canEditLibrary(membership?.role);
  const isAdmin = isLibraryAdmin(membership?.role);

  const [notes, setNotes] = useState<NoteWithUrls[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [noteTypes, setNoteTypes] = useState<NoteType[]>([]);
  const [stockLocations, setStockLocations] = useState<StockLocation[]>([]);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [noteLinks, setNoteLinks] = useState<NoteLink[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const initialSession = useMemo(() => loadFilterSession(), []);
  const [view, setView] = useState<NotesView>(initialSession.view);
  const [filterLabelIds, setFilterLabelIds] = useState<string[]>(
    initialSession.labelIds,
  );
  const [filterDisposition, setFilterDisposition] =
    useState<NoteDisposition | null>(initialSession.disposition);
  const [filterCategoryId, setFilterCategoryId] = useState<string | null>(
    initialSession.categoryId,
  );
  const [filterStockId, setFilterStockId] = useState<string | null>(
    initialSession.stockId,
  );
  const [search, setSearch] = useState(initialSession.search);
  /** Wall filter: show only notes with this normalized part number. */
  const [relatedPartKey, setRelatedPartKey] = useState<string | null>(null);
  const [relatedPartLabel, setRelatedPartLabel] = useState<string | null>(null);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  /** Note ids waiting to pulse on the wall after a capture create. */
  const pendingWallPulseIds = useRef<Set<string>>(new Set());
  const [wallPulseNoteIds, setWallPulseNoteIds] = useState<string[]>([]);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [importBurst, setImportBurst] = useState<{ key: number; count: number } | null>(null);
  const [undoAction, setUndoAction] = useState<UndoAction | null>(null);
  const undoActionRef = useRef<UndoAction | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectionClearNonce, setSelectionClearNonce] = useState(0);
  const [imageBusyCount, setImageBusyCount] = useState(0);
  const [ready, setReady] = useState(false);
  const [viewPrefs, setViewPrefs] = useState(loadViewPrefs);
  const [createDefaults, setCreateDefaults] = useState(loadCreateDefaults);
  const [openedAtById, setOpenedAtById] = useState(loadRecentOpens);
  const [notice, setNotice] = useState<string | null>(null);

  function updateViewPrefs(next: typeof viewPrefs) {
    setViewPrefs(next);
    saveViewPrefs(next);
  }

  function updateCreateDefaults(next: CreateDefaults) {
    setCreateDefaults(next);
    saveCreateDefaults(next);
  }

  function openNote(noteId: string) {
    setOpenedAtById((prev) => touchRecentOpen(noteId, prev));
    setActiveNoteId(noteId);
  }


  const refresh = useCallback(async () => {
    const [
      nextNotes,
      nextLabels,
      nextTypes,
      nextStock,
      nextCart,
      nextLinks,
      nextReactions,
    ] = await Promise.all([
      store.listNotes(),
      store.listLabels(),
      store.listNoteTypes(),
      store.listStockLocations(),
      store.listCartItems(),
      store.listNoteLinks(),
      store.listAllReactions(),
    ]);
    setNotes(nextNotes);
    setLabels(nextLabels);
    setNoteTypes(nextTypes);
    setStockLocations(nextStock);
    setCartItems(nextCart);
    setNoteLinks(nextLinks);
    setReactions(nextReactions);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const nextMembership = isCloudConfigured()
          ? await ensureWorkspaceMembership()
          : LOCAL_MEMBERSHIP;
        setMembership(nextMembership);
        if (canEditLibrary(nextMembership.role)) {
          await store.purgeSoftDeletedNotes();
        }
        await refresh();
      } catch (err) {
        setNotice(
          err instanceof Error ? err.message : 'Failed to load library access',
        );
      } finally {
        setReady(true);
      }
    })();
  }, [refresh, session?.user?.id]);

  const visibleNotes = useMemo(() => {
    let filtered = filterNotes(notes, labels, stockLocations, noteTypes, {
      labelIds: view === 'notes' ? filterLabelIds : [],
      search,
      view: view === 'collection' ? 'notes' : view,
      disposition: view === 'notes' ? filterDisposition : null,
      categoryId: view === 'notes' ? filterCategoryId : null,
      stockId: view === 'notes' ? filterStockId : null,
    });
    if (relatedPartKey && view === 'notes') {
      filtered = filtered.filter((n) =>
        noteMatchesPartNumberKey(n, relatedPartKey),
      );
    }
    // Keep search relevance ordering; apply wall sort only when browsing.
    if (search.trim()) return filtered;
    return sortWallNotes(filtered, viewPrefs.sort, openedAtById);
  }, [
    notes,
    labels,
    stockLocations,
    noteTypes,
    filterLabelIds,
    filterDisposition,
    filterCategoryId,
    filterStockId,
    search,
    view,
    viewPrefs.sort,
    openedAtById,
    relatedPartKey,
  ]);

  useEffect(() => {
    saveFilterSession({
      view,
      search,
      labelIds: filterLabelIds,
      disposition: filterDisposition,
      categoryId: filterCategoryId,
      stockId: filterStockId,
    });
  }, [
    view,
    search,
    filterLabelIds,
    filterDisposition,
    filterCategoryId,
    filterStockId,
  ]);

  /** Faceted counts: apply all filters except the section being counted. */
  const typeCountNotes = useMemo(
    () =>
      filterNotes(notes, labels, stockLocations, noteTypes, {
        labelIds: view === 'notes' ? filterLabelIds : [],
        search: view === 'notes' ? search : '',
        view: 'notes',
        disposition: view === 'notes' ? filterDisposition : null,
        categoryId: null,
        stockId: view === 'notes' ? filterStockId : null,
      }),
    [
      notes,
      labels,
      stockLocations,
      noteTypes,
      filterLabelIds,
      filterDisposition,
      filterStockId,
      search,
      view,
    ],
  );
  const stockCountNotes = useMemo(
    () =>
      filterNotes(notes, labels, stockLocations, noteTypes, {
        labelIds: view === 'notes' ? filterLabelIds : [],
        search: view === 'notes' ? search : '',
        view: 'notes',
        disposition: view === 'notes' ? filterDisposition : null,
        categoryId: view === 'notes' ? filterCategoryId : null,
        stockId: null,
      }),
    [
      notes,
      labels,
      stockLocations,
      noteTypes,
      filterLabelIds,
      filterDisposition,
      filterCategoryId,
      search,
      view,
    ],
  );
  const labelCountNotes = useMemo(
    () =>
      filterNotes(notes, labels, stockLocations, noteTypes, {
        labelIds: [],
        search: view === 'notes' ? search : '',
        view: 'notes',
        disposition: view === 'notes' ? filterDisposition : null,
        categoryId: view === 'notes' ? filterCategoryId : null,
        stockId: view === 'notes' ? filterStockId : null,
      }),
    [
      notes,
      labels,
      stockLocations,
      noteTypes,
      filterDisposition,
      filterCategoryId,
      filterStockId,
      search,
      view,
    ],
  );

  const typeCounts = useMemo(
    () => countNotesByType(typeCountNotes),
    [typeCountNotes],
  );
  const labelCounts = useMemo(
    () => countNotesByLabel(labelCountNotes),
    [labelCountNotes],
  );
  const stockCounts = useMemo(
    () => countNotesByStock(stockCountNotes),
    [stockCountNotes],
  );

  const relatedCountByNoteId = useMemo(() => {
    const map: Record<string, number> = {};
    for (const note of notes) {
      if (note.deletedAt != null) continue;
      const count = partNumberFamilyCount(notes, note.title);
      if (count > 1) map[note.id] = count;
    }
    return map;
  }, [notes]);

  const activeNote = notes.find((n) => n.id === activeNoteId) ?? null;
  const activeRelatedNotes = useMemo((): RelatedNoteEntry[] => {
    if (!activeNoteId || !activeNote) return [];
    const linkIds = relatedIdsFromLinks(noteLinks, activeNoteId);
    const partIds = relatedIdsByPartNumber(
      notes,
      activeNoteId,
      activeNote.title,
    );
    const linkSet = new Set(linkIds);
    const merged = mergeRelatedIds(linkIds, partIds);
    const byId = new Map(notes.map((n) => [n.id, n]));
    return merged
      .map((id) => {
        const note = byId.get(id);
        if (!note || note.deletedAt) return null;
        return {
          note,
          auto: !linkSet.has(id),
        } satisfies RelatedNoteEntry;
      })
      .filter((entry): entry is RelatedNoteEntry => entry != null)
      .sort((a, b) => {
        if (a.auto !== b.auto) return a.auto ? -1 : 1;
        return (a.note.title || '').localeCompare(b.note.title || '', undefined, {
          sensitivity: 'base',
        });
      });
  }, [activeNoteId, activeNote, noteLinks, notes]);
  const activeNavIndex = activeNoteId
    ? visibleNotes.findIndex((n) => n.id === activeNoteId)
    : -1;
  const cartUnitCount = store.cartUnitCount(cartItems);
  const cartQuantities = useMemo(() => {
    const map: Record<string, number> = {};
    for (const item of cartItems) {
      map[item.noteId] = item.quantity;
    }
    return map;
  }, [cartItems]);
  const sortedNoteIds = useMemo(() => {
    const ids = new Set<string>();
    for (const note of notes) {
      if (noteIsSorted(reactions, note.id)) ids.add(note.id);
    }
    return ids;
  }, [notes, reactions]);
  const cartRows = useMemo(
    () =>
      cartItems.map((item) => ({
        item,
        note: notes.find((n) => n.id === item.noteId) ?? null,
      })),
    [cartItems, notes],
  );

  const pasteFilterSummary = useMemo(() => {
    const parts: string[] = [];
    const type = categoryLabel(createDefaults.categoryId, noteTypes);
    const stock = stockLabel(createDefaults.stockId, stockLocations);
    if (type) parts.push(type);
    if (stock) parts.push(stock);
    return parts.length > 0
      ? `New notes → ${parts.join(' · ')}`
      : 'No create defaults';
  }, [
    createDefaults.categoryId,
    createDefaults.stockId,
    noteTypes,
    stockLocations,
  ]);

  const createDefaultsSummary = useMemo(() => {
    const type = categoryLabel(createDefaults.categoryId, noteTypes);
    const stock = stockLabel(createDefaults.stockId, stockLocations);
    return { type, stock };
  }, [
    createDefaults.categoryId,
    createDefaults.stockId,
    noteTypes,
    stockLocations,
  ]);

  useEffect(() => {
    let next = createDefaults;
    let changed = false;
    if (
      next.categoryId &&
      noteTypes.length > 0 &&
      !noteTypes.some((t) => t.id === next.categoryId)
    ) {
      next = { ...next, categoryId: null };
      changed = true;
    }
    if (
      next.stockId &&
      stockLocations.length > 0 &&
      !stockLocations.some((s) => s.id === next.stockId)
    ) {
      next = { ...next, stockId: null };
      changed = true;
    }
    if (changed) updateCreateDefaults(next);
    // Only re-validate when catalogs change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteTypes, stockLocations]);

  useEffect(() => {
    const type = categoryLabel(filterCategoryId, noteTypes);
    const status = dispositionLabel(filterDisposition);
    const parts = [type, status].filter(Boolean);
    document.title = parts.length > 0 ? `TechLib · ${parts.join(' · ')}` : 'TechLib';
  }, [filterCategoryId, filterDisposition, noteTypes]);

  function clearAllFilters() {
    setFilterLabelIds([]);
    setFilterDisposition(null);
    setFilterCategoryId(null);
    setFilterStockId(null);
    setSearch('');
    setRelatedPartKey(null);
    setRelatedPartLabel(null);
  }

  function showRelatedForNote(noteId: string) {
    const note = notes.find((n) => n.id === noteId);
    if (!note) return;
    const key = normalizePartNumber(note.title);
    if (!key) return;
    setView('notes');
    setFilterLabelIds([]);
    setFilterDisposition(null);
    setFilterCategoryId(null);
    setFilterStockId(null);
    setSearch('');
    setRelatedPartKey(key);
    setRelatedPartLabel(partNumberLabel(note.title) || key);
    setActiveNoteId(null);
    setSidebarOpen(false);
  }

  function toggleFilterLabel(labelId: string) {
    setView('notes');
    setFilterLabelIds((current) =>
      current.includes(labelId)
        ? current.filter((id) => id !== labelId)
        : [...current, labelId],
    );
  }

  function isBlankNote(note: NoteWithUrls) {
    return (
      !note.title.trim() &&
      !note.description.trim() &&
      note.images.length === 0 &&
      note.labelIds.length === 0 &&
      !note.pinned &&
      !note.archived &&
      (note.disposition ?? 'none') === 'none' &&
      (note.guidelineLines?.length ?? 0) === 0 &&
      !note.categoryId &&
      !note.stockId &&
      !(note.specialCase ?? '').trim() &&
      (note.askItems?.length ?? 0) === 0
    );
  }

  async function commitPendingDelete(action: UndoAction | null) {
    if (action?.kind === 'delete' && action.ids.length > 0) {
      await store.purgeNotes(action.ids);
    }
  }

  async function replaceUndoAction(next: UndoAction | null) {
    const previous = undoActionRef.current;
    undoActionRef.current = next;
    setUndoAction(next);
    await commitPendingDelete(previous);
  }

  
  function queueWallPulse(noteId: string) {
    pendingWallPulseIds.current.add(noteId);
  }

  function flushWallPulses() {
    if (pendingWallPulseIds.current.size === 0) return;
    const ids = [...pendingWallPulseIds.current];
    pendingWallPulseIds.current.clear();
    setWallPulseNoteIds((prev) => [...new Set([...prev, ...ids])]);
  }

  function clearWallPulse(noteId: string) {
    setWallPulseNoteIds((prev) => prev.filter((id) => id !== noteId));
  }

  async function handleCloseEditor() {
    // Don't junk a brand-new photo note while images are still uploading.
    if (
      canEdit &&
      activeNote &&
      isBlankNote(activeNote) &&
      imageBusyCount === 0
    ) {
      pendingWallPulseIds.current.delete(activeNote.id);
      await store.deleteNote(activeNote.id);
      setActiveNoteId(null);
      await refresh();
      setNotice('Empty note removed');
      return;
    }
    setActiveNoteId(null);
    // Reveal capture pulse once the editor no longer covers the wall.
    flushWallPulses();
  }

  async function handleCreateNote() {
    if (!canEdit) return;
    const note = await store.createNote({
      ...createMetaFromDefaults(createDefaults),
      labelIds: [],
    });
    await refresh();
    setView('notes');
    openNote(note.id);
    setSidebarOpen(false);
  }

  async function handlePasteImport(drafts: PastedNoteDraft[]) {
    if (!canEdit) return;
    if (drafts.length === 0) return;
    const createdIds: string[] = [];
    const meta = createMetaFromDefaults(createDefaults);
    try {
      for (const draft of drafts) {
        const note = await store.createNote({
          title: draft.title,
          description: draft.description,
          specialCase: draft.specialCase,
          ...meta,
          labelIds: [],
        });
        createdIds.push(note.id);
      }
      await refresh();
      setView('notes');
      setSidebarOpen(false);
      setPasteOpen(false);
      if (createdIds.length > 0) {
        for (const id of createdIds) queueWallPulse(id);
        flushWallPulses();
        setImportBurst((prev) => ({
          key: (prev?.key ?? 0) + 1,
          count: createdIds.length,
        }));
        await replaceUndoAction({ kind: 'import', ids: createdIds });
      }
    } catch (err) {
      // Keep any notes that were created before the failure.
      if (createdIds.length > 0) {
        await refresh();
        for (const id of createdIds) queueWallPulse(id);
        flushWallPulses();
        setImportBurst((prev) => ({
          key: (prev?.key ?? 0) + 1,
          count: createdIds.length,
        }));
        await replaceUndoAction({ kind: 'import', ids: createdIds });
      }
      throw err instanceof Error
        ? err
        : new Error('Import failed. Please try again.');
    }
  }

  const dismissUndo = useCallback(() => {
    const previous = undoActionRef.current;
    undoActionRef.current = null;
    setUndoAction(null);
    void commitPendingDelete(previous);
  }, []);

  async function handleUndo() {
    const action = undoActionRef.current;
    if (!action) return;
    undoActionRef.current = null;
    setUndoAction(null);

    if (action.kind === 'import') {
      if (!action.ids.length) return;
      if (activeNoteId && action.ids.includes(activeNoteId)) {
        setActiveNoteId(null);
      }
      await store.purgeNotes(action.ids);
    } else if (action.kind === 'delete') {
      if (!action.ids.length) return;
      await store.restoreNotes(action.ids);
    } else if (action.kind === 'patch') {
      if (action.before.length === 0) return;
      for (const entry of action.before) {
        await store.updateNote(entry.id, entry.patch);
      }
    } else if (action.kind === 'cart-clear') {
      if (action.items.length === 0) return;
      for (const item of action.items) {
        await store.setCartQuantity(item.noteId, item.quantity);
      }
      setCartItems(await store.listCartItems());
      return;
    } else if (action.kind === 'note-link') {
      if (action.pairs.length === 0) return;
      setNoteLinks(await store.removeNoteLinks(action.pairs));
      return;
    } else if (action.kind === 'note-unlink') {
      if (action.pairs.length === 0) return;
      setNoteLinks(await store.restoreNoteLinks(action.pairs));
      return;
    }
    await refresh();
  }

  async function softDeleteWithUndo(noteIds: string[]) {
    const ids = [...new Set(noteIds)].filter(Boolean);
    if (ids.length === 0) return;

    if (activeNoteId && ids.includes(activeNoteId)) {
      const idx = visibleNotes.findIndex((n) => n.id === activeNoteId);
      let nextId: string | null = null;
      if (idx >= 0) {
        for (let i = idx + 1; i < visibleNotes.length; i += 1) {
          if (!ids.includes(visibleNotes[i].id)) {
            nextId = visibleNotes[i].id;
            break;
          }
        }
        if (!nextId) {
          for (let i = idx - 1; i >= 0; i -= 1) {
            if (!ids.includes(visibleNotes[i].id)) {
              nextId = visibleNotes[i].id;
              break;
            }
          }
        }
      }
      if (nextId) openNote(nextId); else setActiveNoteId(null);
    }

    await store.softDeleteNotes(ids);
    await replaceUndoAction({ kind: 'delete', ids });
    await refresh();
  }

  function handleNavigatePrev() {
    if (activeNavIndex <= 0) return;
    openNote(visibleNotes[activeNavIndex - 1].id);
  }

  function handleNavigateNext() {
    if (activeNavIndex < 0 || activeNavIndex >= visibleNotes.length - 1) return;
    openNote(visibleNotes[activeNavIndex + 1].id);
  }

  async function handleSaveMeta(patch: {
    title?: string;
    description?: string;
    background?: NoteBackground;
    labelIds?: string[];
    pinned?: boolean;
    archived?: boolean;
    disposition?: NoteDisposition;
    guidelineLines?: import('../lib/types').GuidelineLine[];
    categoryId?: string | null;
    stockId?: string | null;
    specialCase?: string;
    askItems?: import('../lib/types').NoteAskItem[];
  }) {
    if (patch.askItems !== undefined) {
      if (!isAdmin) return;
    } else if (!canEdit) {
      return;
    }
    if (!activeNoteId) return;
    const current = notes.find((n) => n.id === activeNoteId);
    const undoPatch: NoteFieldPatch = {};
    if (patch.archived !== undefined) undoPatch.archived = patch.archived;
    if (patch.labelIds !== undefined) undoPatch.labelIds = patch.labelIds;
    const before =
      current && Object.keys(undoPatch).length > 0
        ? [{ id: current.id, patch: snapshotNotePatch(current, undoPatch) }]
        : [];

    const optimisticMeta =
      current && ('categoryId' in patch || 'stockId' in patch);
    if (optimisticMeta) {
      setNotes((prev) => {
        const next = prev.map((n) =>
          n.id === activeNoteId
            ? {
                ...n,
                ...('categoryId' in patch
                  ? { categoryId: patch.categoryId ?? null }
                  : {}),
                ...('stockId' in patch
                  ? { stockId: patch.stockId ?? null }
                  : {}),
                updatedAt: Date.now(),
              }
            : n,
        );
        return [...next].sort((a, b) => {
          if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
          return b.updatedAt - a.updatedAt;
        });
      });
    }

    try {
      const updated = await store.updateNote(activeNoteId, patch);
      if (!updated) {
        if (optimisticMeta && current) {
          setNotes((prev) =>
            prev.map((n) => (n.id === current.id ? current : n)),
          );
          setNotice('Could not update type');
        }
        return;
      }
      setNotes((prev) => {
        const next = prev.map((n) => (n.id === updated.id ? updated : n));
        return [...next].sort((a, b) => {
          if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
          return b.updatedAt - a.updatedAt;
        });
      });
      if (patch.labelIds) {
        setLabels(await store.listLabels());
      }
      if (before.length > 0) {
        let message = 'Updated note';
        if (patch.archived !== undefined) {
          message = patch.archived ? 'Archived note' : 'Unarchived note';
        } else if (patch.labelIds !== undefined) {
          message = 'Updated labels';
        }
        await replaceUndoAction({ kind: 'patch', message, before });
      }
    } catch {
      if (optimisticMeta && current) {
        setNotes((prev) =>
          prev.map((n) => (n.id === current.id ? current : n)),
        );
        setNotice(
          'categoryId' in patch
            ? 'Could not update type'
            : 'Could not save changes',
        );
      }
    }
  }

  async function handleAddImages(files: FileList | File[]) {
    if (!canEdit) return;
    if (!activeNoteId) return;
    const list = Array.from(files);
    if (list.length === 0) return;
    setImageBusyCount(list.length);
    try {
      let updated: NoteWithUrls | undefined;
      for (const file of list) {
        updated = await store.addImage(activeNoteId, file);
      }
      if (updated) {
        setNotes((prev) =>
          prev.map((n) => (n.id === updated!.id ? updated! : n)),
        );
      }
    } finally {
      setImageBusyCount(0);
    }
  }

  async function createNoteFromImages(files: File[]) {
    if (!canEdit) return;
    if (files.length === 0) return;
    try {
      // Create + open first (no wall "Adding…" wait). Upload afterward.
      const note = await store.createNote({
        ...createMetaFromDefaults(createDefaults),
        labelIds: [],
      });
      setNotes((prev) =>
        prev.some((n) => n.id === note.id) ? prev : [note, ...prev],
      );
      queueWallPulse(note.id);
      openNote(note.id);
      setSidebarOpen(false);

      setImageBusyCount(files.length);
      for (const file of files) {
        const updated = await store.addImage(note.id, file);
        if (updated) {
          setNotes((prev) =>
            prev.map((n) => (n.id === updated.id ? updated : n)),
          );
        }
        setImageBusyCount((count) => Math.max(0, count - 1));
      }
      await refresh();
    } finally {
      setImageBusyCount(0);
    }
  }

  async function handleRemoveImage(imageId: string) {
    if (!canEdit) return;
    if (!activeNoteId) return;
    const updated = await store.removeImage(activeNoteId, imageId);
    if (updated) {
      setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
    }
  }

  async function handleReorderImages(orderedImageIds: string[]) {
    if (!canEdit) return;
    if (!activeNoteId) return;
    const updated = await store.reorderImages(activeNoteId, orderedImageIds);
    if (updated) {
      setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
    }
  }

  async function handleDelete() {
    if (!canEdit) return;
    if (!activeNoteId) return;
    await softDeleteWithUndo([activeNoteId]);
  }

  async function handleDeleteNotes(noteIds: string[]) {
    if (!canEdit) return;
    await softDeleteWithUndo(noteIds);
  }

  async function handleAddToCart(noteIds: string[]) {
    const ids = [...new Set(noteIds)].filter(Boolean);
    if (ids.length === 0) return;
    const nextItems = await store.addToCart(ids);
    setCartItems(nextItems);
    const noteWord = ids.length === 1 ? 'note' : 'notes';
    // Prefer the collection commit toast over any lingering undo banner.
    await replaceUndoAction(null);
    setNotice(
      ids.length === 1 ? 'Added to collection' : `Added ${ids.length} ${noteWord} to collection`,
    );
  }

  async function handleAddActiveToCart() {
    if (!activeNoteId) return;
    await handleAddToCart([activeNoteId]);
  }

  async function handleToggleSorted(noteId: string) {
    const emoji: ReactionEmoji = '✅';
    await store.toggleReaction(noteId, emoji);
    setReactions(await store.listAllReactions());
  }

  async function handleCartQuantity(noteId: string, quantity: number) {
    setCartItems(await store.setCartQuantity(noteId, quantity));
  }

  async function handleRemoveFromCart(noteId: string) {
    setCartItems(await store.removeFromCart(noteId));
  }

  async function handleClearCart() {
    if (cartItems.length === 0) return;
    const snapshot = cartItems.map((item) => ({ ...item }));
    await store.clearCart();
    setCartItems([]);
    await replaceUndoAction({ kind: 'cart-clear', items: snapshot });
  }

  async function handleLinkNotes(noteIds: string[]) {
    if (!canEdit) return;
    const ids = [...new Set(noteIds)].filter(Boolean);
    if (ids.length < 2) return;
    const { links, created } = await store.linkNotes(ids);
    setNoteLinks(links);
    if (created.length === 0) {
      setNotice('Already linked');
      return;
    }
    await replaceUndoAction({ kind: 'note-link', pairs: created });
  }

  async function handleRemoveRelated(otherNoteId: string) {
    if (!canEdit || !activeNoteId) return;
    const before = noteLinks.find(
      (l) =>
        (l.noteIdA === activeNoteId && l.noteIdB === otherNoteId) ||
        (l.noteIdB === activeNoteId && l.noteIdA === otherNoteId),
    );
    const links = await store.unlinkNotes(activeNoteId, otherNoteId);
    setNoteLinks(links);
    if (before) {
      await replaceUndoAction({ kind: 'note-unlink', pairs: [before] });
    }
  }

  async function handleUpdateNotes(
    noteIds: string[],
    patch: NoteFieldPatch,
    options?: { message?: string },
  ) {
    if (!canEdit) return;
    const ids = [...new Set(noteIds)].filter(Boolean);
    if (ids.length === 0) return;

    const before: Array<{ id: string; patch: NoteFieldPatch }> = [];
    const previousById = new Map<string, NoteWithUrls>();
    for (const id of ids) {
      const note = notes.find((n) => n.id === id);
      if (!note) continue;
      before.push({ id, patch: snapshotNotePatch(note, patch) });
      previousById.set(id, note);
    }
    if (before.length === 0) return;

    const optimisticTypeOrStock =
      'categoryId' in patch || 'stockId' in patch;
    if (optimisticTypeOrStock) {
      setNotes((prev) => {
        const next = prev.map((n) => {
          if (!previousById.has(n.id)) return n;
          return {
            ...n,
            ...('categoryId' in patch
              ? { categoryId: patch.categoryId ?? null }
              : {}),
            ...('stockId' in patch ? { stockId: patch.stockId ?? null } : {}),
            updatedAt: Date.now(),
          };
        });
        return [...next].sort((a, b) => {
          if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
          return b.updatedAt - a.updatedAt;
        });
      });
    }

    try {
      for (const id of ids) {
        const updated = await store.updateNote(id, patch);
        if (updated && optimisticTypeOrStock) {
          setNotes((prev) => {
            const next = prev.map((n) => (n.id === updated.id ? updated : n));
            return [...next].sort((a, b) => {
              if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
              return b.updatedAt - a.updatedAt;
            });
          });
        }
      }
      if (!optimisticTypeOrStock) {
        await refresh();
      }
      await replaceUndoAction({
        kind: 'patch',
        message:
          options?.message ??
          describeBulkPatch(before.length, patch, noteTypes, stockLocations),
        before,
      });
    } catch {
      if (optimisticTypeOrStock) {
        setNotes((prev) => {
          const next = prev.map((n) => previousById.get(n.id) ?? n);
          return [...next].sort((a, b) => {
            if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
            return b.updatedAt - a.updatedAt;
          });
        });
        setNotice(
          'categoryId' in patch
            ? 'Could not update type'
            : 'Could not save changes',
        );
        return;
      }
      await refresh();
      setNotice('Could not save changes');
    }
  }

  async function handleApplyGuidelineBulk(
    noteIds: string[],
    edit: BulkGuidelineEdit,
  ) {
    if (!canEdit) return;
    const ids = [...new Set(noteIds)].filter(Boolean);
    if (ids.length === 0) return;

    const before: Array<{ id: string; patch: NoteFieldPatch }> = [];
    const updates: Array<{ id: string; guidelineLines: GuidelineLine[] }> = [];

    for (const id of ids) {
      const note = notes.find((n) => n.id === id);
      if (!note) continue;
      const current = resolveGuidelineLines(note);
      const next =
        edit.mode === 'replaceAll'
          ? normalizeGuidelineLines(edit.lines)
          : upsertGuidelineLineByWhen(current, {
              when: edit.when,
              action: edit.action,
              how: edit.how,
            });
      before.push({ id, patch: { guidelineLines: current } });
      updates.push({ id, guidelineLines: next });
    }
    if (updates.length === 0) return;

    for (const entry of updates) {
      await store.updateNote(entry.id, { guidelineLines: entry.guidelineLines });
    }
    await refresh();

    const noteWord = updates.length === 1 ? 'note' : 'notes';
    const message =
      edit.mode === 'replaceAll'
        ? edit.lines.length === 0
          ? `Cleared guidelines on ${updates.length} ${noteWord}`
          : `Replaced guidelines on ${updates.length} ${noteWord}`
        : `Set “${edit.when} → ${
            DISPOSITIONS.find((d) => d.id === edit.action)?.short ?? edit.action
          }” on ${updates.length} ${noteWord}`;

    await replaceUndoAction({
      kind: 'patch',
      message,
      before,
    });
  }

  async function handleAddLabelToNotes(noteIds: string[], labelId: string) {
    if (!canEdit) return;
    const ids = [...new Set(noteIds)].filter(Boolean);
    if (ids.length === 0) return;

    const before: Array<{ id: string; patch: NoteFieldPatch }> = [];
    const updates: Array<{ id: string; labelIds: string[] }> = [];
    for (const id of ids) {
      const note = notes.find((n) => n.id === id);
      if (!note || note.labelIds.includes(labelId)) continue;
      before.push({ id, patch: { labelIds: [...note.labelIds] } });
      updates.push({ id, labelIds: [...note.labelIds, labelId] });
    }
    if (updates.length === 0) return;

    for (const entry of updates) {
      await store.updateNote(entry.id, { labelIds: entry.labelIds });
    }
    await refresh();
    const labelName = labels.find((l) => l.id === labelId)?.name ?? 'label';
    const noteWord = updates.length === 1 ? 'note' : 'notes';
    await replaceUndoAction({
      kind: 'patch',
      message: `Added #${labelName} to ${updates.length} ${noteWord}`,
      before,
    });
  }

  async function handleAssignNotes(
    noteIds: string[],
    target: NoteAssignTarget,
  ) {
    if (!canEdit) return;
    await handleUpdateNotes(noteIds, noteAssignPatch(target), {
      message: describeNoteAssign(noteIds, target),
    });
    setSelectionClearNonce((n) => n + 1);
  }


  async function handleCreateLabel(name: string) {
    if (!canEdit) throw new Error('View-only access');
    const label = await store.createLabel(name);
    setLabels(await store.listLabels());
    return label;
  }

  async function handleSidebarCreateLabel(name: string) {
    if (!canEdit) throw new Error('View-only access');
    const label = await handleCreateLabel(name);
    setView('notes');
    setFilterLabelIds((current) =>
      current.includes(label.id) ? current : [...current, label.id],
    );
    return label;
  }

  async function handleCreateNoteType(
    name: string,
    parentId?: string | null,
  ) {
    if (!canEdit) throw new Error('View-only access');
    const noteType = await store.createNoteType(name, parentId);
    setNoteTypes(await store.listNoteTypes());
    setView('notes');
    setFilterCategoryId(noteType.id);
    return noteType;
  }

  async function handleCreateStock(name: string) {
    if (!canEdit) throw new Error('View-only access');
    const location = await store.createStockLocation(name);
    setStockLocations(await store.listStockLocations());
    setView('notes');
    setFilterStockId(location.id);
    return location;
  }

  async function handleSidebarCreateStock(name: string) {
    if (!canEdit) throw new Error('View-only access');
    return handleCreateStock(name);
  }

  async function handleDeleteLabel(labelId: string) {
    if (!canEdit) return;
    await store.deleteLabel(labelId);
    setLabels(await store.listLabels());
    setFilterLabelIds((current) => current.filter((id) => id !== labelId));
    await refresh();
  }

  async function handleDeleteNoteType(typeId: string) {
    if (!canEdit) return;
    const removeIds = noteTypeDeleteIds(noteTypes, typeId);
    await store.deleteNoteType(typeId);
    setNoteTypes(await store.listNoteTypes());
    setFilterCategoryId((current) =>
      current && removeIds.has(current) ? null : current,
    );
    if (
      createDefaults.categoryId &&
      removeIds.has(createDefaults.categoryId)
    ) {
      updateCreateDefaults({ ...createDefaults, categoryId: null });
    }
    await refresh();
  }

  useEffect(() => {
    async function onPaste(e: ClipboardEvent) {
      if (!canEdit || pasteOpen || view !== 'notes') return;

      const images = clipboardImageFiles(e.clipboardData);
      if (images.length === 0) return;

      // Prefer normal text paste inside fields when clipboard has text.
      if (isEditableTarget(e.target) && clipboardHasPlainText(e.clipboardData)) {
        return;
      }

      e.preventDefault();
      if (activeNoteId) {
        await handleAddImages(images);
        return;
      }

      await createNoteFromImages(images);
    }

    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [
    activeNoteId,
    pasteOpen,
    view,
    filterLabelIds,
    refresh,
    canEdit,
  ]);

  // B toggles barcode visibility on cards / editor / collection (View options).
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.defaultPrevented) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key.toLowerCase() !== 'b') return;
      if (isEditableTarget(e.target)) return;

      e.preventDefault();
      setViewPrefs((prev) => {
        const next = { ...prev, barcodes: !prev.barcodes };
        saveViewPrefs(next);
        return next;
      });
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const undoMessage =
    undoAction == null
      ? ''
      : undoAction.kind === 'import'
        ? `Imported ${undoAction.ids.length} note${
            undoAction.ids.length === 1 ? '' : 's'
          } · on the wall`
        : undoAction.kind === 'delete'
          ? `Deleted ${undoAction.ids.length} note${
              undoAction.ids.length === 1 ? '' : 's'
            }`
          : undoAction.kind === 'cart-clear'
            ? 'Cleared collection'
            : undoAction.kind === 'note-link'
              ? undoAction.pairs.length === 1
                ? 'Linked notes'
                : `Linked ${undoAction.pairs.length} connections`
              : undoAction.kind === 'note-unlink'
                ? 'Unlinked notes'
                : undoAction.message;

  const undoToastVisible =
    undoAction != null &&
    (undoAction.kind === 'patch'
      ? undoAction.before.length > 0
      : undoAction.kind === 'cart-clear'
        ? undoAction.items.length > 0
        : undoAction.kind === 'note-link' || undoAction.kind === 'note-unlink'
          ? undoAction.pairs.length > 0
          : undoAction.ids.length > 0);

  return (
    <AppShell
      sidebarOpen={sidebarOpen}
      onToggleSidebar={() => setSidebarOpen((open) => !open)}
      search={search}
      onSearchChange={setSearch}
      viewPrefs={viewPrefs}
      onViewPrefsChange={updateViewPrefs}
      sidebar={
        <Sidebar
          canEdit={canEdit}
          isAdmin={isAdmin}
          onOpenMembers={isAdmin ? () => setMembersOpen(true) : undefined}
          labels={labels}
          noteTypes={noteTypes}
          stockLocations={stockLocations}
          typeCounts={typeCounts.byTypeId}
          unsetCount={typeCounts.unset}
          labelCounts={labelCounts}
          stockCounts={stockCounts.byStockId}
          unsetStockCount={stockCounts.unset}
          view={view}
          activeLabelIds={filterLabelIds}
          activeDisposition={filterDisposition}
          activeCategoryId={filterCategoryId}
          activeStockId={filterStockId}
          collectionCount={cartUnitCount}
          defaultCategoryId={createDefaults.categoryId}
          defaultStockId={createDefaults.stockId}
          onPinCategory={
            canEdit
              ? (categoryId) =>
                  updateCreateDefaults({ ...createDefaults, categoryId })
              : undefined
          }
          onPinStock={
            canEdit
              ? (stockId) =>
                  updateCreateDefaults({ ...createDefaults, stockId })
              : undefined
          }
          onSelectNotes={() => {
            setView('notes');
            clearAllFilters();
            setSidebarOpen(false);
          }}
          onSelectArchive={() => {
            setView('archive');
            clearAllFilters();
            setSidebarOpen(false);
          }}
          onSelectCollection={() => {
            setView('collection');
            clearAllFilters();
            setSidebarOpen(false);
          }}
          onSelectDisposition={(disposition) => {
            setView('notes');
            setRelatedPartKey(null);
            setRelatedPartLabel(null);
            setFilterDisposition((current) =>
              current === disposition ? null : disposition,
            );
            setSidebarOpen(false);
          }}
          onSelectCategoryId={(categoryId) => {
            setView('notes');
            setRelatedPartKey(null);
            setRelatedPartLabel(null);
            setFilterCategoryId((current) =>
              current === categoryId ? null : categoryId,
            );
            setSidebarOpen(false);
          }}
          onSelectStock={(stockId) => {
            setView('notes');
            setRelatedPartKey(null);
            setRelatedPartLabel(null);
            setFilterStockId((current) =>
              current === stockId ? null : stockId,
            );
            // keep sidebar open for multi-hop browsing of stock
          }}
          onToggleLabel={toggleFilterLabel}
          onCreateLabel={canEdit ? handleSidebarCreateLabel : undefined}
          onCreateType={canEdit ? handleCreateNoteType : undefined}
          onCreateStock={canEdit ? handleSidebarCreateStock : undefined}
          onDeleteLabel={canEdit ? (id) => handleDeleteLabel(id) : undefined}
          onDeleteType={canEdit ? (id) => handleDeleteNoteType(id) : undefined}
          onAssignNotes={canEdit ? handleAssignNotes : undefined}
          onSignOut={
            isCloudConfigured()
              ? () => {
                  void signOutCloud();
                }
              : undefined
          }
        />
      }
    >
      {!ready ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading notes…</p>
      ) : view === 'collection' ? (
        <CollectionView
          rows={cartRows}
          labels={labels}
          noteTypes={noteTypes}
          stockLocations={stockLocations}
          unitCount={cartUnitCount}
          showBarcodes={viewPrefs.barcodes}
          showPhotos={viewPrefs.photos}
          showDescription={viewPrefs.description}
          showSpecialCase={viewPrefs.specialCase}
          showLabels={viewPrefs.labels}
          showAge={viewPrefs.age}
          showTypeChip={viewPrefs.typeChip}
          onOpenNote={openNote}
          onChangeQuantity={(noteId, quantity) =>
            void handleCartQuantity(noteId, quantity)
          }
          onRemove={(noteId) => void handleRemoveFromCart(noteId)}
          onClear={() => void handleClearCart()}
          onBrowseNotes={() => {
            setView('notes');
            setSidebarOpen(false);
          }}
        />
      ) : (
        <NoteGrid
          canEdit={canEdit}
          notes={visibleNotes}
          labels={labels}
          noteTypes={noteTypes}
          view={view}
          filterLabelIds={filterLabelIds}
          filterDisposition={filterDisposition}
          filterCategoryId={filterCategoryId}
          filterStockId={filterStockId}
          search={search}
          stockLocations={stockLocations}
          cartQuantities={cartQuantities}
          createDefaultsSummary={
            canEdit && view === 'notes' ? createDefaultsSummary : undefined
          }
          onUnpinCreateType={
            canEdit
              ? () =>
                  updateCreateDefaults({
                    ...createDefaults,
                    categoryId: null,
                  })
              : undefined
          }
          onUnpinCreateStock={
            canEdit
              ? () =>
                  updateCreateDefaults({ ...createDefaults, stockId: null })
              : undefined
          }
          sortedNoteIds={sortedNoteIds}
          showBarcodes={viewPrefs.barcodes}
          showPhotos={viewPrefs.photos}
          showDescription={viewPrefs.description}
          showSpecialCase={viewPrefs.specialCase}
          showLabels={viewPrefs.labels}
          showAge={viewPrefs.age}
          showTypeChip={viewPrefs.typeChip}
          onOpenNote={openNote}
          onCreateNote={canEdit ? () => void handleCreateNote() : undefined}
          onPasteNotes={canEdit ? () => setPasteOpen(true) : undefined}
          onBrowseNotes={() => {
            setView('notes');
            clearAllFilters();
            setSidebarOpen(false);
          }}
          onDeleteNotes={handleDeleteNotes}
          onAddToCart={handleAddToCart}
          onLinkNotes={canEdit ? handleLinkNotes : undefined}
          onUpdateNotes={handleUpdateNotes}
          onApplyGuidelineBulk={handleApplyGuidelineBulk}
          onCreateLabel={canEdit ? handleCreateLabel : undefined}
          onAddLabel={handleAddLabelToNotes}
          onClearLabel={(labelId) =>
            setFilterLabelIds((current) => current.filter((id) => id !== labelId))
          }
          onClearDisposition={() => setFilterDisposition(null)}
          onClearCategory={() => setFilterCategoryId(null)}
          onClearStock={() => setFilterStockId(null)}
          onClearAllFilters={clearAllFilters}
          onClearSearch={() => setSearch('')}
          relatedPartKey={relatedPartKey}
          relatedPartLabel={relatedPartLabel}
          onClearRelatedPart={() => {
            setRelatedPartKey(null);
            setRelatedPartLabel(null);
          }}
          relatedCountByNoteId={relatedCountByNoteId}
          onShowRelated={showRelatedForNote}
          selectionClearNonce={selectionClearNonce}
          onNotesDragStart={() => {
            // Drawer sidebar on small screens covers the grid; only auto-open
            // when the sidebar is docked (desktop drag-to-assign).
            if (window.matchMedia('(min-width: 801px)').matches) {
              setSidebarOpen(true);
            }
          }}
          onDropImages={canEdit ? (files) => void createNoteFromImages(files) : undefined}
          imageBusyCount={imageBusyCount}
          pulseNoteIds={wallPulseNoteIds}
          onPulseEnd={clearWallPulse}
        />
      )}

      {pasteOpen && (
        <PasteNotesDialog
          filterSummary={pasteFilterSummary}
          onClose={() => setPasteOpen(false)}
          onImport={handlePasteImport}
        />
      )}

      {importBurst && (
        <ImportBurst
          key={importBurst.key}
          burstKey={importBurst.key}
          count={importBurst.count}
          onDone={() => setImportBurst(null)}
        />
      )}

      {undoToastVisible && (
        <UndoToast
          message={undoMessage}
          onUndo={() => void handleUndo()}
          onDismiss={dismissUndo}
          tone={undoAction?.kind === 'delete' ? 'default' : 'success'}
        />
      )}

      {notice && !undoToastVisible && (
        <UndoToast
          message={notice}
          onDismiss={() => setNotice(null)}
          durationMs={4000}
          tone="success"
        />
      )}

      {membersOpen && membership && (
        <MembersDialog
          currentUserId={membership.userId}
          onClose={() => setMembersOpen(false)}
          onRoleChanged={() => {
            void ensureWorkspaceMembership().then(setMembership);
          }}
        />
      )}

      {activeNote && (
        <NoteEditor
          readOnly={!canEdit}
          canManageAsk={isAdmin}
          note={activeNote}
          labels={labels}
          noteTypes={noteTypes}
          stockLocations={stockLocations}
          showBarcodes={viewPrefs.barcodes}
          navIndex={activeNavIndex}
          navTotal={visibleNotes.length}
          onNavigatePrev={handleNavigatePrev}
          onNavigateNext={handleNavigateNext}
          onClose={() => void handleCloseEditor()}
          onSaveMeta={handleSaveMeta}
          onAddImages={handleAddImages}
          onRemoveImage={handleRemoveImage}
          onReorderImages={handleReorderImages}
          onDelete={handleDelete}
          onCreateLabel={handleCreateLabel}
          onAddToCart={handleAddActiveToCart}
          cartQuantity={cartQuantities[activeNote.id] ?? 0}
          sorted={sortedNoteIds.has(activeNote.id)}
          onToggleSorted={() => void handleToggleSorted(activeNote.id)}
          imageBusyCount={imageBusyCount}
          relatedNotes={activeRelatedNotes}
          onOpenRelated={(noteId) => openNote(noteId)}
          onRemoveRelated={canEdit ? handleRemoveRelated : undefined}
          onShowAllRelated={
            activeNote &&
            partNumberFamilyCount(notes, activeNote.title) > 1
              ? () => showRelatedForNote(activeNote.id)
              : undefined
          }
        />
      )}
    </AppShell>
  );
}

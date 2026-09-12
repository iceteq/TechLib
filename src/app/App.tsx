import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { loadViewPrefs, saveViewPrefs } from '../lib/viewPrefs';
import {
  loadFilterSession,
  saveFilterSession,
} from '../lib/filterSession';
import { AppShell } from '../features/shell/AppShell';
import { Sidebar } from '../features/shell/Sidebar';
import { CartView } from '../features/notes/CartView';
import { NoteEditor } from '../features/notes/NoteEditor';
import { NoteGrid } from '../features/notes/NoteGrid';
import { PasteNotesDialog } from '../features/notes/PasteNotesDialog';
import { UndoToast } from '../features/notes/UndoToast';
import type {
  CartItem,
  Label,
  StockLocation,
  NoteBackground,
  NoteDisposition,
  NoteType,
  NotesView,
  NoteWithUrls,
} from '../lib/types';
import {
  DISPOSITIONS,
  UNSET_STOCK_FILTER,
  UNSET_TYPE_FILTER,
} from '../lib/types';
import {
  categoryLabel,
  countNotesByLabel,
  countNotesByStock,
  countNotesByType,
  dispositionLabel,
  filterNotes,
  stockLabel,
} from '../lib/searchNotes';
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

type NoteFieldPatch = {
  disposition?: NoteDisposition;
  guidelineLines?: import('../lib/types').GuidelineLine[];
  categoryId?: string | null;
  stockId?: string | null;
  labelIds?: string[];
};

type UndoAction =
  | { kind: 'import'; ids: string[] }
  | { kind: 'delete'; ids: string[] }
  | {
      kind: 'patch';
      message: string;
      before: Array<{ id: string; patch: NoteFieldPatch }>;
    };

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  return Boolean(target.closest('[contenteditable="true"]'));
}

/** Inherit active sidebar filters; otherwise preset No type / No guideline / No stock. */
function createMetaFromFilters(options: {
  disposition: NoteDisposition | null;
  categoryId: string | null;
  stockId: string | null;
}): {
  disposition: NoteDisposition;
  categoryId: string | null;
  stockId: string | null;
} {
  return {
    disposition: options.disposition ?? 'none',
    categoryId:
      !options.categoryId || options.categoryId === UNSET_TYPE_FILTER
        ? null
        : options.categoryId,
    stockId:
      !options.stockId || options.stockId === UNSET_STOCK_FILTER
        ? null
        : options.stockId,
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
      noteTypes.find((t) => t.id === patch.categoryId)?.name ?? 'Type';
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
  return `Updated ${count} ${noteWord}`;
}

export default function App() {
  const [notes, setNotes] = useState<NoteWithUrls[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [noteTypes, setNoteTypes] = useState<NoteType[]>([]);
  const [stockLocations, setStockLocations] = useState<StockLocation[]>([]);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
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
  const [specialCasesOnly, setSpecialCasesOnly] = useState(
    initialSession.specialCasesOnly,
  );
  const [search, setSearch] = useState(initialSession.search);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [undoAction, setUndoAction] = useState<UndoAction | null>(null);
  const undoActionRef = useRef<UndoAction | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectionClearNonce, setSelectionClearNonce] = useState(0);
  const [imageBusyCount, setImageBusyCount] = useState(0);
  const [ready, setReady] = useState(false);
  const [viewPrefs, setViewPrefs] = useState(loadViewPrefs);
  const [notice, setNotice] = useState<string | null>(null);

  function updateViewPrefs(next: typeof viewPrefs) {
    setViewPrefs(next);
    saveViewPrefs(next);
  }

  const refresh = useCallback(async () => {
    const [nextNotes, nextLabels, nextTypes, nextStock, nextCart] =
      await Promise.all([
        store.listNotes(),
        store.listLabels(),
        store.listNoteTypes(),
        store.listStockLocations(),
        store.listCartItems(),
      ]);
    setNotes(nextNotes);
    setLabels(nextLabels);
    setNoteTypes(nextTypes);
    setStockLocations(nextStock);
    setCartItems(nextCart);
  }, []);

  useEffect(() => {
    void (async () => {
      await store.purgeSoftDeletedNotes();
      await refresh();
      setReady(true);
    })();
  }, [refresh]);

  const visibleNotes = useMemo(
    () =>
      filterNotes(notes, labels, stockLocations, noteTypes, {
        labelIds: view === 'notes' ? filterLabelIds : [],
        search,
        view: view === 'cart' ? 'notes' : view,
        disposition: view === 'notes' ? filterDisposition : null,
        categoryId: view === 'notes' ? filterCategoryId : null,
        stockId: view === 'notes' ? filterStockId : null,
        specialCasesOnly: view === 'notes' ? specialCasesOnly : false,
      }),
    [
      notes,
      labels,
      stockLocations,
      noteTypes,
      filterLabelIds,
      filterDisposition,
      filterCategoryId,
      filterStockId,
      specialCasesOnly,
      search,
      view,
    ],
  );

  useEffect(() => {
    saveFilterSession({
      view,
      search,
      labelIds: filterLabelIds,
      disposition: filterDisposition,
      categoryId: filterCategoryId,
      stockId: filterStockId,
      specialCasesOnly,
    });
  }, [
    view,
    search,
    filterLabelIds,
    filterDisposition,
    filterCategoryId,
    filterStockId,
    specialCasesOnly,
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
        specialCasesOnly: view === 'notes' ? specialCasesOnly : false,
      }),
    [
      notes,
      labels,
      stockLocations,
      noteTypes,
      filterLabelIds,
      filterDisposition,
      filterStockId,
      specialCasesOnly,
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
        specialCasesOnly: view === 'notes' ? specialCasesOnly : false,
      }),
    [
      notes,
      labels,
      stockLocations,
      noteTypes,
      filterLabelIds,
      filterDisposition,
      filterCategoryId,
      specialCasesOnly,
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
        specialCasesOnly: view === 'notes' ? specialCasesOnly : false,
      }),
    [
      notes,
      labels,
      stockLocations,
      noteTypes,
      filterDisposition,
      filterCategoryId,
      filterStockId,
      specialCasesOnly,
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

  const activeNote = notes.find((n) => n.id === activeNoteId) ?? null;
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
    const status = dispositionLabel(filterDisposition);
    const type = categoryLabel(filterCategoryId, noteTypes);
    const stock = stockLabel(filterStockId, stockLocations);
    const labelNames = labels
      .filter((l) => filterLabelIds.includes(l.id))
      .sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
      )
      .map((l) => `#${l.name}`);
    if (status) parts.push(status);
    if (type) parts.push(type);
    if (stock) parts.push(stock);
    if (specialCasesOnly) parts.push('Special cases');
    parts.push(...labelNames);
    return parts.length > 0 ? parts.join(' · ') : 'No filters';
  }, [
    filterDisposition,
    filterCategoryId,
    filterStockId,
    filterLabelIds,
    specialCasesOnly,
    labels,
    noteTypes,
    stockLocations,
  ]);

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
    setSpecialCasesOnly(false);
    setSearch('');
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
      !(note.specialCase ?? '').trim()
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

  async function handleCloseEditor() {
    if (activeNote && isBlankNote(activeNote)) {
      await store.deleteNote(activeNote.id);
      setActiveNoteId(null);
      await refresh();
      setNotice('Empty note removed');
      return;
    }
    setActiveNoteId(null);
  }

  async function handleCreateNote() {
    const note = await store.createNote({
      ...createMetaFromFilters({
        disposition: filterDisposition,
        categoryId: filterCategoryId,
        stockId: filterStockId,
      }),
      labelIds: filterLabelIds,
    });
    await refresh();
    setView('notes');
    setActiveNoteId(note.id);
    setSidebarOpen(false);
  }

  async function handlePasteImport(drafts: PastedNoteDraft[]) {
    const createdIds: string[] = [];
    const meta = createMetaFromFilters({
      disposition: filterDisposition,
      categoryId: filterCategoryId,
      stockId: filterStockId,
    });
    for (const draft of drafts) {
      const note = await store.createNote({
        title: draft.title,
        description: draft.description,
        specialCase: draft.specialCase,
        ...meta,
        labelIds: filterLabelIds,
      });
      createdIds.push(note.id);
    }
    await refresh();
    setView('notes');
    setSidebarOpen(false);
    if (createdIds.length > 0) {
      await replaceUndoAction({ kind: 'import', ids: createdIds });
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
      setActiveNoteId(nextId);
    }

    await store.softDeleteNotes(ids);
    await replaceUndoAction({ kind: 'delete', ids });
    await refresh();
  }

  function handleNavigatePrev() {
    if (activeNavIndex <= 0) return;
    setActiveNoteId(visibleNotes[activeNavIndex - 1].id);
  }

  function handleNavigateNext() {
    if (activeNavIndex < 0 || activeNavIndex >= visibleNotes.length - 1) return;
    setActiveNoteId(visibleNotes[activeNavIndex + 1].id);
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
  }) {
    if (!activeNoteId) return;
    const updated = await store.updateNote(activeNoteId, patch);
    if (!updated) return;
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
  }

  async function handleAddImages(files: FileList | File[]) {
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
    if (files.length === 0) return;
    setImageBusyCount(files.length);
    try {
      const note = await store.createNote({
        ...createMetaFromFilters({
          disposition: filterDisposition,
          categoryId: filterCategoryId,
          stockId: filterStockId,
        }),
        labelIds: filterLabelIds,
      });
      for (const file of files) {
        await store.addImage(note.id, file);
      }
      await refresh();
      setActiveNoteId(note.id);
      setSidebarOpen(false);
    } finally {
      setImageBusyCount(0);
    }
  }

  async function handleRemoveImage(imageId: string) {
    if (!activeNoteId) return;
    const updated = await store.removeImage(activeNoteId, imageId);
    if (updated) {
      setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
    }
  }

  async function handleReorderImages(orderedImageIds: string[]) {
    if (!activeNoteId) return;
    const updated = await store.reorderImages(activeNoteId, orderedImageIds);
    if (updated) {
      setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
    }
  }

  async function handleDelete() {
    if (!activeNoteId) return;
    await softDeleteWithUndo([activeNoteId]);
  }

  async function handleDeleteNotes(noteIds: string[]) {
    await softDeleteWithUndo(noteIds);
  }

  async function handleAddToCart(noteIds: string[]) {
    const nextItems = await store.addToCart(noteIds);
    setCartItems(nextItems);
  }

  async function handleAddActiveToCart() {
    if (!activeNoteId) return;
    await handleAddToCart([activeNoteId]);
  }

  async function handleCartQuantity(noteId: string, quantity: number) {
    setCartItems(await store.setCartQuantity(noteId, quantity));
  }

  async function handleRemoveFromCart(noteId: string) {
    setCartItems(await store.removeFromCart(noteId));
  }

  async function handleClearCart() {
    await store.clearCart();
    setCartItems([]);
  }

  async function handleUpdateNotes(
    noteIds: string[],
    patch: NoteFieldPatch,
    options?: { message?: string },
  ) {
    const ids = [...new Set(noteIds)].filter(Boolean);
    if (ids.length === 0) return;

    const before: Array<{ id: string; patch: NoteFieldPatch }> = [];
    for (const id of ids) {
      const note = notes.find((n) => n.id === id);
      if (!note) continue;
      before.push({ id, patch: snapshotNotePatch(note, patch) });
    }
    if (before.length === 0) return;

    for (const id of ids) {
      await store.updateNote(id, patch);
    }
    await refresh();
    await replaceUndoAction({
      kind: 'patch',
      message:
        options?.message ??
        describeBulkPatch(before.length, patch, noteTypes, stockLocations),
      before,
    });
  }

  async function handleApplyGuidelineBulk(
    noteIds: string[],
    edit: BulkGuidelineEdit,
  ) {
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
    await handleUpdateNotes(noteIds, noteAssignPatch(target), {
      message: describeNoteAssign(noteIds, target),
    });
    setSelectionClearNonce((n) => n + 1);
  }


  async function handleCreateLabel(name: string) {
    const label = await store.createLabel(name);
    setLabels(await store.listLabels());
    return label;
  }

  async function handleSidebarCreateLabel(name: string) {
    const label = await handleCreateLabel(name);
    setView('notes');
    setFilterLabelIds((current) =>
      current.includes(label.id) ? current : [...current, label.id],
    );
    return label;
  }

  async function handleCreateNoteType(name: string) {
    const noteType = await store.createNoteType(name);
    setNoteTypes(await store.listNoteTypes());
    setView('notes');
    setFilterCategoryId(noteType.id);
    return noteType;
  }

  async function handleCreateStock(name: string) {
    const location = await store.createStockLocation(name);
    setStockLocations(await store.listStockLocations());
    setView('notes');
    setFilterStockId(location.id);
    return location;
  }

  async function handleSidebarCreateStock(name: string) {
    return handleCreateStock(name);
  }

  async function handleDeleteLabel(labelId: string) {
    await store.deleteLabel(labelId);
    setLabels(await store.listLabels());
    setFilterLabelIds((current) => current.filter((id) => id !== labelId));
    await refresh();
  }

  useEffect(() => {
    async function onPaste(e: ClipboardEvent) {
      if (pasteOpen || view !== 'notes') return;

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
  ]);

  const undoMessage =
    undoAction == null
      ? ''
      : undoAction.kind === 'import'
        ? `Imported ${undoAction.ids.length} note${
            undoAction.ids.length === 1 ? '' : 's'
          }`
        : undoAction.kind === 'delete'
          ? `Deleted ${undoAction.ids.length} note${
              undoAction.ids.length === 1 ? '' : 's'
            }`
          : undoAction.message;

  const undoToastVisible =
    undoAction != null &&
    (undoAction.kind === 'patch'
      ? undoAction.before.length > 0
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
          specialCasesOnly={specialCasesOnly}
          cartCount={cartUnitCount}
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
          onSelectCart={() => {
            setView('cart');
            clearAllFilters();
            setSidebarOpen(false);
          }}
          onSelectDisposition={(disposition) => {
            setView('notes');
            setFilterDisposition((current) =>
              current === disposition ? null : disposition,
            );
            setSidebarOpen(false);
          }}
          onSelectCategoryId={(categoryId) => {
            setView('notes');
            setFilterCategoryId((current) =>
              current === categoryId ? null : categoryId,
            );
            setSidebarOpen(false);
          }}
          onSelectStock={(stockId) => {
            setView('notes');
            setFilterStockId((current) =>
              current === stockId ? null : stockId,
            );
            // keep sidebar open for multi-hop browsing of stock
          }}
          onToggleSpecialCases={() => {
            setView('notes');
            setSpecialCasesOnly((value) => !value);
            setSidebarOpen(false);
          }}
          onToggleLabel={toggleFilterLabel}
          onCreateLabel={handleSidebarCreateLabel}
          onCreateType={handleCreateNoteType}
          onCreateStock={handleSidebarCreateStock}
          onDeleteLabel={(id) => handleDeleteLabel(id)}
          onAssignNotes={handleAssignNotes}
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
      ) : view === 'cart' ? (
        <CartView
          rows={cartRows}
          labels={labels}
          noteTypes={noteTypes}
          unitCount={cartUnitCount}
          showBarcodes={viewPrefs.barcodes}
          onOpenNote={(id) => setActiveNoteId(id)}
          onChangeQuantity={(noteId, quantity) =>
            void handleCartQuantity(noteId, quantity)
          }
          onRemove={(noteId) => void handleRemoveFromCart(noteId)}
          onClear={() => void handleClearCart()}
        />
      ) : (
        <NoteGrid
          notes={visibleNotes}
          labels={labels}
          noteTypes={noteTypes}
          view={view}
          filterLabelIds={filterLabelIds}
          filterDisposition={filterDisposition}
          filterCategoryId={filterCategoryId}
          filterStockId={filterStockId}
          specialCasesOnly={specialCasesOnly}
          search={search}
          stockLocations={stockLocations}
          cartQuantities={cartQuantities}
          showBarcodes={viewPrefs.barcodes}
          showPhotos={viewPrefs.photos}
          showDescription={viewPrefs.description}
          showSpecialCase={viewPrefs.specialCase}
          showLabels={viewPrefs.labels}
          showAge={viewPrefs.age}
          showTypeChip={viewPrefs.typeChip}
          onOpenNote={(id) => setActiveNoteId(id)}
          onCreateNote={() => void handleCreateNote()}
          onPasteNotes={() => setPasteOpen(true)}
          onDeleteNotes={handleDeleteNotes}
          onAddToCart={handleAddToCart}
          onUpdateNotes={handleUpdateNotes}
          onApplyGuidelineBulk={handleApplyGuidelineBulk}
          onCreateLabel={handleCreateLabel}
          onAddLabel={handleAddLabelToNotes}
          onClearLabel={(labelId) =>
            setFilterLabelIds((current) => current.filter((id) => id !== labelId))
          }
          onClearDisposition={() => setFilterDisposition(null)}
          onClearCategory={() => setFilterCategoryId(null)}
          onClearStock={() => setFilterStockId(null)}
          onClearSpecialCases={() => setSpecialCasesOnly(false)}
          onClearAllFilters={clearAllFilters}
          onClearSearch={() => setSearch('')}
          selectionClearNonce={selectionClearNonce}
          onNotesDragStart={() => {
            // Drawer sidebar on small screens covers the grid; only auto-open
            // when the sidebar is docked (desktop drag-to-assign).
            if (window.matchMedia('(min-width: 801px)').matches) {
              setSidebarOpen(true);
            }
          }}
          onDropImages={(files) => void createNoteFromImages(files)}
          imageBusyCount={imageBusyCount}
        />
      )}

      {pasteOpen && (
        <PasteNotesDialog
          filterSummary={pasteFilterSummary}
          onClose={() => setPasteOpen(false)}
          onImport={handlePasteImport}
        />
      )}

      {undoToastVisible && (
        <UndoToast
          message={undoMessage}
          onUndo={() => void handleUndo()}
          onDismiss={dismissUndo}
        />
      )}

      {notice && !undoToastVisible && (
        <UndoToast
          message={notice}
          onDismiss={() => setNotice(null)}
          durationMs={4000}
        />
      )}

      {activeNote && (
        <NoteEditor
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
          imageBusyCount={imageBusyCount}
        />
      )}
    </AppShell>
  );
}

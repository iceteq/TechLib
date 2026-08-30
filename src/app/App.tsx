import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { loadViewPrefs, saveViewPrefs } from '../lib/viewPrefs';
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
import { UNSET_TYPE_FILTER } from '../lib/types';
import {
  categoryLabel,
  countNotesByLabel,
  countNotesByStock,
  countNotesByType,
  dispositionLabel,
  filterNotes,
  stockLabel,
} from '../lib/searchNotes';
import { parsePastedNotes } from '../lib/parsePastedNotes';
import {
  confirmNoteAssign,
  noteAssignPatch,
  type NoteAssignTarget,
} from '../lib/noteDrag';
import * as store from '../lib/notesStore';
import { isCloudConfigured } from '../lib/supabaseClient';
import { signOutCloud } from '../features/auth/AuthGate';

type UndoAction =
  | { kind: 'import'; ids: string[] }
  | { kind: 'delete'; ids: string[] };

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  return Boolean(target.closest('[contenteditable="true"]'));
}

function clipboardImageFiles(clipboardData: DataTransfer | null): File[] {
  if (!clipboardData) return [];
  const fromItems = Array.from(clipboardData.items)
    .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
    .map((item) => item.getAsFile())
    .filter((file): file is File => Boolean(file));
  if (fromItems.length > 0) return fromItems;
  return Array.from(clipboardData.files).filter((file) =>
    file.type.startsWith('image/'),
  );
}

function inheritCategoryId(filterCategoryId: string | null): string | null {
  if (!filterCategoryId || filterCategoryId === UNSET_TYPE_FILTER) return null;
  return filterCategoryId;
}

export default function App() {
  const [notes, setNotes] = useState<NoteWithUrls[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [noteTypes, setNoteTypes] = useState<NoteType[]>([]);
  const [stockLocations, setStockLocations] = useState<StockLocation[]>([]);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [view, setView] = useState<NotesView>('notes');
  const [filterLabelIds, setFilterLabelIds] = useState<string[]>([]);
  const [filterDisposition, setFilterDisposition] =
    useState<NoteDisposition | null>(null);
  const [filterCategoryId, setFilterCategoryId] = useState<string | null>(null);
  const [filterStockId, setFilterStockId] = useState<string | null>(null);
  const [specialCasesOnly, setSpecialCasesOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [undoAction, setUndoAction] = useState<UndoAction | null>(null);
  const undoActionRef = useRef<UndoAction | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectionClearNonce, setSelectionClearNonce] = useState(0);
  const [ready, setReady] = useState(false);
  const [viewPrefs, setViewPrefs] = useState(loadViewPrefs);

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

  const typeCounts = useMemo(() => countNotesByType(notes), [notes]);
  const labelCounts = useMemo(() => countNotesByLabel(notes), [notes]);
  const stockCounts = useMemo(() => countNotesByStock(notes), [notes]);

  const activeNote = notes.find((n) => n.id === activeNoteId) ?? null;
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
      !note.categoryId &&
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
      return;
    }
    setActiveNoteId(null);
  }

  async function handleCreateNote() {
    const note = await store.createNote({
      disposition: filterDisposition ?? 'none',
      categoryId: inheritCategoryId(filterCategoryId),
      stockId: filterStockId,
      labelIds: filterLabelIds,
    });
    await refresh();
    setView('notes');
    setActiveNoteId(note.id);
    setSidebarOpen(false);
  }

  async function handlePasteImport(text: string) {
    const drafts = parsePastedNotes(text);
    const createdIds: string[] = [];
    for (const draft of drafts) {
      const note = await store.createNote({
        title: draft.title,
        description: draft.description,
        specialCase: draft.specialCase,
        disposition: filterDisposition ?? 'none',
        categoryId: inheritCategoryId(filterCategoryId),
        stockId: filterStockId,
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
    if (!action?.ids.length) return;
    undoActionRef.current = null;
    setUndoAction(null);

    if (action.kind === 'import') {
      if (activeNoteId && action.ids.includes(activeNoteId)) {
        setActiveNoteId(null);
      }
      await store.purgeNotes(action.ids);
    } else {
      await store.restoreNotes(action.ids);
    }
    await refresh();
  }

  async function softDeleteWithUndo(noteIds: string[]) {
    const ids = [...new Set(noteIds)].filter(Boolean);
    if (ids.length === 0) return;

    if (activeNoteId && ids.includes(activeNoteId)) {
      setActiveNoteId(null);
    }

    await store.softDeleteNotes(ids);
    await replaceUndoAction({ kind: 'delete', ids });
    await refresh();
  }

  async function handleSaveMeta(patch: {
    title?: string;
    description?: string;
    background?: NoteBackground;
    labelIds?: string[];
    pinned?: boolean;
    archived?: boolean;
    disposition?: NoteDisposition;
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
    let updated: NoteWithUrls | undefined;
    for (const file of Array.from(files)) {
      updated = await store.addImage(activeNoteId, file);
    }
    if (updated) {
      setNotes((prev) => prev.map((n) => (n.id === updated!.id ? updated! : n)));
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
    patch: {
      disposition?: NoteDisposition;
      categoryId?: string | null;
      stockId?: string | null;
      labelIds?: string[];
    },
  ) {
    for (const id of noteIds) {
      await store.updateNote(id, patch);
    }
    await refresh();
  }


  async function handleAssignNotes(
    noteIds: string[],
    target: NoteAssignTarget,
  ) {
    if (!confirmNoteAssign(noteIds, target)) return;
    await handleUpdateNotes(noteIds, noteAssignPatch(target));
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
      if (activeNoteId || pasteOpen || view !== 'notes') return;
      if (isEditableTarget(e.target)) return;

      const images = clipboardImageFiles(e.clipboardData);
      if (images.length === 0) return;

      e.preventDefault();
      const note = await store.createNote({
        disposition: filterDisposition ?? 'none',
        categoryId: inheritCategoryId(filterCategoryId),
        stockId: filterStockId,
        labelIds: filterLabelIds,
      });
      for (const file of images) {
        await store.addImage(note.id, file);
      }
      await refresh();
      setActiveNoteId(note.id);
      setSidebarOpen(false);
    }

    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [
    activeNoteId,
    pasteOpen,
    view,
    filterDisposition,
    filterCategoryId,
    filterStockId,
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
        : `Deleted ${undoAction.ids.length} note${
            undoAction.ids.length === 1 ? '' : 's'
          }`;

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
          stockCounts={stockCounts}
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
          onOpenNote={(id) => setActiveNoteId(id)}
          onCreateNote={() => void handleCreateNote()}
          onPasteNotes={() => setPasteOpen(true)}
          onDeleteNotes={handleDeleteNotes}
          onAddToCart={handleAddToCart}
          onUpdateNotes={handleUpdateNotes}
          onClearLabel={(labelId) =>
            setFilterLabelIds((current) => current.filter((id) => id !== labelId))
          }
          onClearDisposition={() => setFilterDisposition(null)}
          onClearCategory={() => setFilterCategoryId(null)}
          onClearStock={() => setFilterStockId(null)}
          onClearSpecialCases={() => setSpecialCasesOnly(false)}
          onClearAllFilters={clearAllFilters}
          selectionClearNonce={selectionClearNonce}
          onNotesDragStart={() => setSidebarOpen(true)}
        />
      )}

      {pasteOpen && (
        <PasteNotesDialog
          filterSummary={pasteFilterSummary}
          onClose={() => setPasteOpen(false)}
          onImport={handlePasteImport}
        />
      )}

      {undoAction && undoAction.ids.length > 0 && (
        <UndoToast
          message={undoMessage}
          onUndo={() => void handleUndo()}
          onDismiss={dismissUndo}
        />
      )}

      {activeNote && (
        <NoteEditor
          note={activeNote}
          labels={labels}
          noteTypes={noteTypes}
          stockLocations={stockLocations}
          showBarcodes={viewPrefs.barcodes}
          onClose={() => void handleCloseEditor()}
          onSaveMeta={handleSaveMeta}
          onAddImages={handleAddImages}
          onRemoveImage={handleRemoveImage}
          onReorderImages={handleReorderImages}
          onDelete={handleDelete}
          onCreateLabel={handleCreateLabel}
          onAddToCart={handleAddActiveToCart}
          cartQuantity={cartQuantities[activeNote.id] ?? 0}
        />
      )}
    </AppShell>
  );
}

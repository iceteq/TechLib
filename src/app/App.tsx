import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  NoteBackground,
  NoteCategory,
  NoteDisposition,
  NotesView,
  NoteWithUrls,
} from '../lib/types';
import {
  categoryLabel,
  dispositionLabel,
  filterNotes,
} from '../lib/searchNotes';
import { parsePastedNotes } from '../lib/parsePastedNotes';
import * as store from '../lib/notesStore';
import { isCloudConfigured } from '../lib/supabaseClient';
import { signOutCloud } from '../features/auth/AuthGate';

type UndoAction =
  | { kind: 'import'; ids: string[] }
  | { kind: 'delete'; ids: string[] };

export default function App() {
  const [notes, setNotes] = useState<NoteWithUrls[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [view, setView] = useState<NotesView>('notes');
  const [filterLabelId, setFilterLabelId] = useState<string | null>(null);
  const [filterDisposition, setFilterDisposition] =
    useState<NoteDisposition | null>(null);
  const [filterCategory, setFilterCategory] = useState<NoteCategory | null>(null);
  const [specialCasesOnly, setSpecialCasesOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [undoAction, setUndoAction] = useState<UndoAction | null>(null);
  const undoActionRef = useRef<UndoAction | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    const [nextNotes, nextLabels, nextCart] = await Promise.all([
      store.listNotes(),
      store.listLabels(),
      store.listCartItems(),
    ]);
    setNotes(nextNotes);
    setLabels(nextLabels);
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
      filterNotes(notes, labels, {
        labelId: view === 'notes' ? filterLabelId : null,
        search,
        view: view === 'cart' ? 'notes' : view,
        disposition: view === 'notes' ? filterDisposition : null,
        category: view === 'notes' ? filterCategory : null,
        specialCasesOnly: view === 'notes' ? specialCasesOnly : false,
      }),
    [
      notes,
      labels,
      filterLabelId,
      filterDisposition,
      filterCategory,
      specialCasesOnly,
      search,
      view,
    ],
  );

  const activeNote = notes.find((n) => n.id === activeNoteId) ?? null;
  const cartUnitCount = store.cartUnitCount(cartItems);
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
    const type = categoryLabel(filterCategory);
    const labelName = labels.find((l) => l.id === filterLabelId)?.name;
    if (status) parts.push(status);
    if (type) parts.push(type);
    if (labelName) parts.push(`#${labelName}`);
    return parts.length > 0 ? parts.join(' · ') : 'No filters';
  }, [filterDisposition, filterCategory, filterLabelId, labels]);

  function clearAllFilters() {
    setFilterLabelId(null);
    setFilterDisposition(null);
    setFilterCategory(null);
    setSpecialCasesOnly(false);
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
      (note.category ?? 'none') === 'none' &&
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
      category: filterCategory ?? 'none',
      labelIds: filterLabelId ? [filterLabelId] : [],
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
        category: filterCategory ?? 'none',
        labelIds: filterLabelId ? [filterLabelId] : [],
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
    category?: NoteCategory;
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
      category?: NoteCategory;
      labelIds?: string[];
    },
  ) {
    for (const id of noteIds) {
      await store.updateNote(id, patch);
    }
    await refresh();
  }

  async function handleCreateLabel(name: string) {
    const label = await store.createLabel(name);
    setLabels(await store.listLabels());
    return label;
  }

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
      sidebar={
        <Sidebar
          labels={labels}
          view={view}
          activeLabelId={filterLabelId}
          activeDisposition={filterDisposition}
          activeCategory={filterCategory}
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
          onSelectCategory={(category) => {
            setView('notes');
            setFilterCategory((current) =>
              current === category ? null : category,
            );
            setSidebarOpen(false);
          }}
          onToggleSpecialCases={() => {
            setView('notes');
            setSpecialCasesOnly((value) => !value);
            setSidebarOpen(false);
          }}
          onSelectLabel={(labelId) => {
            setView('notes');
            setFilterLabelId((current) => (current === labelId ? null : labelId));
            setSidebarOpen(false);
          }}
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
          unitCount={cartUnitCount}
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
          view={view}
          filterLabelId={filterLabelId}
          filterDisposition={filterDisposition}
          filterCategory={filterCategory}
          specialCasesOnly={specialCasesOnly}
          search={search}
          onOpenNote={(id) => setActiveNoteId(id)}
          onCreateNote={() => void handleCreateNote()}
          onPasteNotes={() => setPasteOpen(true)}
          onDeleteNotes={handleDeleteNotes}
          onAddToCart={handleAddToCart}
          onUpdateNotes={handleUpdateNotes}
          onClearLabel={() => setFilterLabelId(null)}
          onClearDisposition={() => setFilterDisposition(null)}
          onClearCategory={() => setFilterCategory(null)}
          onClearSpecialCases={() => setSpecialCasesOnly(false)}
          onClearAllFilters={clearAllFilters}
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
          onClose={() => void handleCloseEditor()}
          onSaveMeta={handleSaveMeta}
          onAddImages={handleAddImages}
          onRemoveImage={handleRemoveImage}
          onReorderImages={handleReorderImages}
          onDelete={handleDelete}
          onCreateLabel={handleCreateLabel}
          onAddToCart={handleAddActiveToCart}
        />
      )}
    </AppShell>
  );
}

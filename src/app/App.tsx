import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppShell } from '../features/shell/AppShell';
import { Sidebar } from '../features/shell/Sidebar';
import { NoteEditor } from '../features/notes/NoteEditor';
import { NoteGrid } from '../features/notes/NoteGrid';
import { PasteNotesDialog } from '../features/notes/PasteNotesDialog';
import { ImportUndoToast } from '../features/notes/ImportUndoToast';
import type {
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

export default function App() {
  const [notes, setNotes] = useState<NoteWithUrls[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [view, setView] = useState<NotesView>('notes');
  const [filterLabelId, setFilterLabelId] = useState<string | null>(null);
  const [filterDisposition, setFilterDisposition] =
    useState<NoteDisposition | null>(null);
  const [filterCategory, setFilterCategory] = useState<NoteCategory | null>(null);
  const [specialCasesOnly, setSpecialCasesOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [lastImportIds, setLastImportIds] = useState<string[] | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    const [nextNotes, nextLabels] = await Promise.all([
      store.listNotes(),
      store.listLabels(),
    ]);
    setNotes(nextNotes);
    setLabels(nextLabels);
  }, []);

  useEffect(() => {
    void (async () => {
      await refresh();
      setReady(true);
    })();
  }, [refresh]);

  const visibleNotes = useMemo(
    () =>
      filterNotes(notes, labels, {
        labelId: view === 'notes' ? filterLabelId : null,
        search,
        view,
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
    setLastImportIds(createdIds.length > 0 ? createdIds : null);
  }

  const dismissLastImport = useCallback(() => {
    setLastImportIds(null);
  }, []);

  async function handleUndoLastImport() {
    if (!lastImportIds?.length) return;
    const ids = lastImportIds;
    setLastImportIds(null);
    if (activeNoteId && ids.includes(activeNoteId)) {
      setActiveNoteId(null);
    }
    for (const id of ids) {
      await store.deleteNote(id);
    }
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
    await store.deleteNote(activeNoteId);
    setActiveNoteId(null);
    await refresh();
  }

  async function handleDeleteNotes(noteIds: string[]) {
    if (activeNoteId && noteIds.includes(activeNoteId)) {
      setActiveNoteId(null);
    }
    setLastImportIds((prev) =>
      prev ? prev.filter((id) => !noteIds.includes(id)) : null,
    );
    for (const id of noteIds) {
      await store.deleteNote(id);
    }
    await refresh();
  }

  async function handleCreateLabel(name: string) {
    const label = await store.createLabel(name);
    setLabels(await store.listLabels());
    return label;
  }

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
        />
      }
    >
      {!ready ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading notes…</p>
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

      {lastImportIds && lastImportIds.length > 0 && (
        <ImportUndoToast
          count={lastImportIds.length}
          onUndo={() => void handleUndoLastImport()}
          onDismiss={dismissLastImport}
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
        />
      )}
    </AppShell>
  );
}

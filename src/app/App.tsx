import { useCallback, useEffect, useState } from 'react';
import { AppShell } from '../features/shell/AppShell';
import { Sidebar } from '../features/shell/Sidebar';
import { NoteEditor } from '../features/notes/NoteEditor';
import { NoteGrid } from '../features/notes/NoteGrid';
import type { Label, NoteBackground, NoteWithUrls } from '../lib/types';
import * as store from '../lib/notesStore';

export default function App() {
  const [notes, setNotes] = useState<NoteWithUrls[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [filterLabelId, setFilterLabelId] = useState<string | null>(null);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
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

  const activeNote = notes.find((n) => n.id === activeNoteId) ?? null;

  function isBlankNote(note: NoteWithUrls) {
    return (
      !note.title.trim() &&
      !note.description.trim() &&
      note.images.length === 0 &&
      note.labelIds.length === 0
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
    const note = await store.createNote();
    await refresh();
    setActiveNoteId(note.id);
    setSidebarOpen(false);
  }

  async function handleSaveMeta(patch: {
    title?: string;
    description?: string;
    background?: NoteBackground;
    labelIds?: string[];
  }) {
    if (!activeNoteId) return;
    const updated = await store.updateNote(activeNoteId, patch);
    if (!updated) return;
    setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
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

  async function handleDelete() {
    if (!activeNoteId) return;
    await store.deleteNote(activeNoteId);
    setActiveNoteId(null);
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
      sidebar={
        <Sidebar
          labels={labels}
          activeFilter={filterLabelId}
          onSelectAll={() => {
            setFilterLabelId(null);
            setSidebarOpen(false);
          }}
          onSelectLabel={(labelId) => {
            setFilterLabelId(labelId);
            setSidebarOpen(false);
          }}
        />
      }
    >
      {!ready ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading notes…</p>
      ) : (
        <NoteGrid
          notes={notes}
          labels={labels}
          filterLabelId={filterLabelId}
          onOpenNote={(id) => setActiveNoteId(id)}
          onCreateNote={() => void handleCreateNote()}
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
          onDelete={handleDelete}
          onCreateLabel={handleCreateLabel}
        />
      )}
    </AppShell>
  );
}

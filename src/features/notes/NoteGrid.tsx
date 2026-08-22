import { useCallback, useEffect, useState } from 'react';
import { ClipboardPaste, Plus, Trash2, X } from 'lucide-react';
import type {
  Label,
  NoteCategory,
  NoteDisposition,
  NotesView,
  NoteWithUrls,
} from '../../lib/types';
import { categoryLabel, dispositionLabel } from '../../lib/searchNotes';
import { NoteCard } from './NoteCard';
import styles from './NoteGrid.module.css';

interface NoteGridProps {
  notes: NoteWithUrls[];
  labels: Label[];
  view: NotesView;
  filterLabelId: string | null;
  filterDisposition: NoteDisposition | null;
  filterCategory: NoteCategory | null;
  specialCasesOnly: boolean;
  search: string;
  onOpenNote: (noteId: string) => void;
  onCreateNote: () => void;
  onPasteNotes: () => void;
  onDeleteNotes: (noteIds: string[]) => Promise<void>;
  onClearLabel: () => void;
  onClearDisposition: () => void;
  onClearCategory: () => void;
  onClearSpecialCases: () => void;
  onClearAllFilters: () => void;
}

export function NoteGrid({
  notes,
  labels,
  view,
  filterLabelId,
  filterDisposition,
  filterCategory,
  specialCasesOnly,
  search,
  onOpenNote,
  onCreateNote,
  onPasteNotes,
  onDeleteNotes,
  onClearLabel,
  onClearDisposition,
  onClearCategory,
  onClearSpecialCases,
  onClearAllFilters,
}: NoteGridProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const selecting = selectedIds.size > 0;

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  useEffect(() => {
    clearSelection();
  }, [view, filterLabelId, filterDisposition, filterCategory, specialCasesOnly, search, clearSelection]);

  useEffect(() => {
    if (!selecting) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') clearSelection();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selecting, clearSelection]);

  // Drop selection for notes that disappeared from the current list.
  useEffect(() => {
    const visible = new Set(notes.map((n) => n.id));
    setSelectedIds((prev) => {
      if (prev.size === 0) return prev;
      const next = new Set([...prev].filter((id) => visible.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [notes]);

  function enterSelect(noteId: string) {
    setSelectedIds(new Set([noteId]));
  }

  function toggleSelect(noteId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(noteId)) next.delete(noteId);
      else next.add(noteId);
      return next;
    });
  }

  async function handleDelete() {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    const ok = window.confirm(
      `Delete ${ids.length} note${ids.length === 1 ? '' : 's'}? This cannot be undone.`,
    );
    if (!ok) return;
    setDeleting(true);
    try {
      await onDeleteNotes(ids);
      clearSelection();
    } finally {
      setDeleting(false);
    }
  }

  const filterName = labels.find((l) => l.id === filterLabelId)?.name;
  const hasSearch = search.trim().length > 0;
  const canCreate = view === 'notes' && !selecting;
  const statusText = dispositionLabel(filterDisposition);
  const typeText = categoryLabel(filterCategory);
  const hasFilters = Boolean(
    filterLabelId || filterDisposition || filterCategory || specialCasesOnly,
  );

  let heading = 'All notes';
  if (view === 'archive') heading = 'Archive';
  else if (hasFilters) heading = 'Filtered notes';

  let emptyTitle = 'Nothing here yet';
  let emptyText = 'Tap + to create a note.';

  if (view === 'archive') {
    emptyTitle = 'Archive is empty';
    emptyText = 'Archived notes will show up here.';
  } else if (hasSearch || hasFilters) {
    emptyTitle = 'No matching notes';
    emptyText = 'Try clearing a filter or adjusting search.';
  }

  return (
    <section className={styles.section}>
      <div className={styles.toolbar}>
        <div>
          <h2 className={styles.heading}>{heading}</h2>
          <p className={styles.subheading}>
            {notes.length === 0
              ? 'No results'
              : `${notes.length} note${notes.length === 1 ? '' : 's'}${
                  hasSearch || hasFilters ? ' found' : ''
                }`}
          </p>
        </div>
      </div>

      {view === 'notes' && hasFilters && (
        <div className={styles.chips} aria-label="Active filters">
          {filterName && (
            <button type="button" className={styles.chip} onClick={onClearLabel}>
              #{filterName}
              <X size={14} />
            </button>
          )}
          {statusText && (
            <button
              type="button"
              className={styles.chip}
              onClick={onClearDisposition}
            >
              {statusText}
              <X size={14} />
            </button>
          )}
          {typeText && (
            <button type="button" className={styles.chip} onClick={onClearCategory}>
              {typeText}
              <X size={14} />
            </button>
          )}
          {specialCasesOnly && (
            <button
              type="button"
              className={styles.chip}
              onClick={onClearSpecialCases}
            >
              Special cases
              <X size={14} />
            </button>
          )}
          <button
            type="button"
            className={styles.clearAll}
            onClick={onClearAllFilters}
          >
            Clear all
          </button>
        </div>
      )}

      {notes.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>{emptyTitle}</p>
          <p className={styles.emptyText}>{emptyText}</p>
        </div>
      ) : (
        <div className={styles.grid}>
          {notes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              labels={labels}
              selecting={selecting}
              selected={selectedIds.has(note.id)}
              onOpen={onOpenNote}
              onToggleSelect={toggleSelect}
              onEnterSelect={enterSelect}
            />
          ))}
        </div>
      )}

      {selecting && (
        <div className={styles.selectionBar} role="toolbar" aria-label="Selection">
          <p className={styles.selectionCount}>
            {selectedIds.size} selected
          </p>
          <button
            type="button"
            className={styles.selectionDelete}
            onClick={() => void handleDelete()}
            disabled={deleting}
          >
            <Trash2 size={16} />
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
          <button
            type="button"
            className={styles.selectionCancel}
            onClick={clearSelection}
            disabled={deleting}
          >
            Cancel
          </button>
        </div>
      )}

      {canCreate && (
        <div className={styles.fabStack}>
          <button
            type="button"
            className={styles.fabSecondary}
            onClick={onPasteNotes}
            aria-label="Paste notes"
            title="Paste notes"
          >
            <ClipboardPaste size={20} strokeWidth={2.25} />
          </button>
          <button
            type="button"
            className={styles.fab}
            onClick={onCreateNote}
            aria-label="New note"
            title="New note"
          >
            <Plus size={24} strokeWidth={2.25} />
          </button>
        </div>
      )}
    </section>
  );
}

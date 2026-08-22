import { Plus, X } from 'lucide-react';
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
  search: string;
  onOpenNote: (noteId: string) => void;
  onCreateNote: () => void;
  onClearLabel: () => void;
  onClearDisposition: () => void;
  onClearCategory: () => void;
  onClearAllFilters: () => void;
}

export function NoteGrid({
  notes,
  labels,
  view,
  filterLabelId,
  filterDisposition,
  filterCategory,
  search,
  onOpenNote,
  onCreateNote,
  onClearLabel,
  onClearDisposition,
  onClearCategory,
  onClearAllFilters,
}: NoteGridProps) {
  const filterName = labels.find((l) => l.id === filterLabelId)?.name;
  const hasSearch = search.trim().length > 0;
  const canCreate = view === 'notes';
  const statusText = dispositionLabel(filterDisposition);
  const typeText = categoryLabel(filterCategory);
  const hasFilters = Boolean(filterLabelId || filterDisposition || filterCategory);

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
              onOpen={onOpenNote}
            />
          ))}
        </div>
      )}

      {canCreate && (
        <button
          type="button"
          className={styles.fab}
          onClick={onCreateNote}
          aria-label="New note"
          title="New note"
        >
          <Plus size={24} strokeWidth={2.25} />
        </button>
      )}
    </section>
  );
}

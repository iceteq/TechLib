import { Plus } from 'lucide-react';
import type { Label, NoteDisposition, NotesView, NoteWithUrls } from '../../lib/types';
import { NoteCard } from './NoteCard';
import styles from './NoteGrid.module.css';

interface NoteGridProps {
  notes: NoteWithUrls[];
  labels: Label[];
  view: NotesView;
  filterLabelId: string | null;
  filterDisposition: NoteDisposition | null;
  search: string;
  onOpenNote: (noteId: string) => void;
  onCreateNote: () => void;
}

export function NoteGrid({
  notes,
  labels,
  view,
  filterLabelId,
  filterDisposition,
  search,
  onOpenNote,
  onCreateNote,
}: NoteGridProps) {
  const filterName = labels.find((l) => l.id === filterLabelId)?.name;
  const hasSearch = search.trim().length > 0;
  const canCreate = view === 'notes';

  let heading = 'All notes';
  if (view === 'archive') heading = 'Archive';
  else if (filterDisposition === 'stock') heading = 'Return to stock';
  else if (filterDisposition === 'repair') heading = 'Repair';
  else if (filterDisposition === 'scrap') heading = 'Throw away';
  else if (filterLabelId) heading = `#${filterName}`;

  let emptyTitle = 'Nothing here yet';
  let emptyText = 'Tap + to create a note.';

  if (view === 'archive') {
    emptyTitle = 'Archive is empty';
    emptyText = 'Archived notes will show up here.';
  } else if (hasSearch) {
    emptyTitle = 'No matching notes';
    emptyText = `No notes match “${search.trim()}”.`;
  } else if (filterDisposition) {
    emptyTitle = 'No notes with this status';
    emptyText = 'Open a note and set its status.';
  } else if (filterLabelId) {
    emptyTitle = 'No notes with this label';
    emptyText = 'Open a note and type # to add this label.';
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
                  hasSearch ? ' found' : ''
                }`}
          </p>
        </div>
      </div>

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

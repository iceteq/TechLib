import { Plus } from 'lucide-react';
import type { Label, NoteWithUrls } from '../../lib/types';
import { NoteCard } from './NoteCard';
import styles from './NoteGrid.module.css';

interface NoteGridProps {
  notes: NoteWithUrls[];
  labels: Label[];
  filterLabelId: string | null;
  search: string;
  onOpenNote: (noteId: string) => void;
  onCreateNote: () => void;
}

export function NoteGrid({
  notes,
  labels,
  filterLabelId,
  search,
  onOpenNote,
  onCreateNote,
}: NoteGridProps) {
  const filterName = labels.find((l) => l.id === filterLabelId)?.name;
  const hasSearch = search.trim().length > 0;

  let emptyTitle = 'Start your first note';
  let emptyText =
    'Add a title, a couple of images, labels, and a color — Keep-style, image-first.';

  if (hasSearch && filterLabelId) {
    emptyTitle = 'No matching notes';
    emptyText = `Nothing in #${filterName} matches “${search.trim()}”.`;
  } else if (hasSearch) {
    emptyTitle = 'No matching notes';
    emptyText = `No notes match “${search.trim()}”. Try another title, description, or label.`;
  } else if (filterLabelId) {
    emptyTitle = 'No notes with this label';
    emptyText = 'Open a note and add this label, or create a new one.';
  }

  return (
    <section className={styles.section}>
      <div className={styles.toolbar}>
        <div>
          <h2 className={styles.heading}>
            {filterLabelId ? `#${filterName}` : 'All notes'}
          </h2>
          <p className={styles.subheading}>
            {notes.length === 0
              ? hasSearch || filterLabelId
                ? 'No results'
                : 'Nothing here yet'
              : `${notes.length} note${notes.length === 1 ? '' : 's'}${
                  hasSearch ? ' found' : ''
                }`}
          </p>
        </div>
        <button type="button" className={styles.createBtn} onClick={onCreateNote}>
          <Plus size={18} />
          New note
        </button>
      </div>

      {notes.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>{emptyTitle}</p>
          <p className={styles.emptyText}>{emptyText}</p>
          {!hasSearch && (
            <button type="button" className={styles.createBtn} onClick={onCreateNote}>
              <Plus size={18} />
              Create note
            </button>
          )}
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
    </section>
  );
}

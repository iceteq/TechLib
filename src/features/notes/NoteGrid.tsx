import { Plus } from 'lucide-react';
import type { Label, NoteWithUrls } from '../../lib/types';
import { NoteCard } from './NoteCard';
import styles from './NoteGrid.module.css';

interface NoteGridProps {
  notes: NoteWithUrls[];
  labels: Label[];
  filterLabelId: string | null;
  onOpenNote: (noteId: string) => void;
  onCreateNote: () => void;
}

export function NoteGrid({
  notes,
  labels,
  filterLabelId,
  onOpenNote,
  onCreateNote,
}: NoteGridProps) {
  const filtered = filterLabelId
    ? notes.filter((n) => n.labelIds.includes(filterLabelId))
    : notes;

  const filterName = labels.find((l) => l.id === filterLabelId)?.name;

  return (
    <section className={styles.section}>
      <div className={styles.toolbar}>
        <div>
          <h2 className={styles.heading}>
            {filterLabelId ? `#${filterName}` : 'All notes'}
          </h2>
          <p className={styles.subheading}>
            {filtered.length === 0
              ? 'Nothing here yet'
              : `${filtered.length} note${filtered.length === 1 ? '' : 's'}`}
          </p>
        </div>
        <button type="button" className={styles.createBtn} onClick={onCreateNote}>
          <Plus size={18} />
          New note
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>
            {filterLabelId ? 'No notes with this label' : 'Start your first note'}
          </p>
          <p className={styles.emptyText}>
            {filterLabelId
              ? 'Open a note and add this label, or create a new one.'
              : 'Add a title, a couple of images, labels, and a color — Keep-style, image-first.'}
          </p>
          <button type="button" className={styles.createBtn} onClick={onCreateNote}>
            <Plus size={18} />
            Create note
          </button>
        </div>
      ) : (
        <div className={styles.grid}>
          {filtered.map((note) => (
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

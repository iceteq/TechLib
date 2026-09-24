import { X } from 'lucide-react';
import type { NoteType, NoteWithUrls } from '../../lib/types';
import { noteTypePathLabel } from '../../lib/noteTypes';
import styles from './RelatedSection.module.css';

export type RelatedNoteEntry = {
  note: NoteWithUrls;
  /** Same part number — not an explicit link; cannot unlink. */
  auto: boolean;
};

interface RelatedSectionProps {
  relatedNotes: RelatedNoteEntry[];
  noteTypes: NoteType[];
  readOnly?: boolean;
  onOpen: (noteId: string) => void;
  onRemove?: (noteId: string) => Promise<void>;
  onShowAllRelated?: () => void;
}

export function RelatedSection({
  relatedNotes,
  noteTypes,
  readOnly = false,
  onOpen,
  onRemove,
  onShowAllRelated,
}: RelatedSectionProps) {
  if (relatedNotes.length === 0) return null;

  const autoCount = relatedNotes.filter((r) => r.auto).length;

  return (
    <div className={styles.section}>
      <div className={styles.header}>
        <p className={styles.label}>Related</p>
        {onShowAllRelated && (
          <button
            type="button"
            className={styles.showAll}
            onClick={onShowAllRelated}
          >
            Show all on wall
          </button>
        )}
      </div>
      {autoCount > 0 && (
        <p className={styles.hint}>
          Same part number
          {autoCount < relatedNotes.length ? ' · plus linked notes' : ''}
        </p>
      )}
      <ul className={styles.list}>
        {relatedNotes.map(({ note, auto }) => {
          const typeLabel = noteTypePathLabel(noteTypes, note.categoryId);
          const thumb = note.images[0];
          const title = note.title.trim() || 'No part number';
          return (
            <li key={note.id} className={styles.item}>
              <button
                type="button"
                className={styles.open}
                onClick={() => onOpen(note.id)}
                title={title}
              >
                <span className={styles.thumb} aria-hidden>
                  {thumb ? (
                    <img
                      src={thumb.thumbUrl || thumb.url}
                      alt=""
                      draggable={false}
                    />
                  ) : null}
                </span>
                <span className={styles.meta}>
                  <span className={styles.title}>{title}</span>
                  {typeLabel ? (
                    <span className={styles.type}>
                      {typeLabel}
                      {auto ? ' · same part #' : ''}
                    </span>
                  ) : auto ? (
                    <span className={styles.type}>Same part #</span>
                  ) : null}
                </span>
              </button>
              {!readOnly && onRemove && !auto && (
                <button
                  type="button"
                  className={styles.unlink}
                  aria-label={`Unlink ${title}`}
                  onClick={() => void onRemove(note.id)}
                >
                  <X size={14} />
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

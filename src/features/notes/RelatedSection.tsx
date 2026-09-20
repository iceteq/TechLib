import { X } from 'lucide-react';
import type { NoteType, NoteWithUrls } from '../../lib/types';
import { noteTypePathLabel } from '../../lib/noteTypes';
import styles from './RelatedSection.module.css';

interface RelatedSectionProps {
  relatedNotes: NoteWithUrls[];
  noteTypes: NoteType[];
  readOnly?: boolean;
  onOpen: (noteId: string) => void;
  onRemove?: (noteId: string) => Promise<void>;
}

export function RelatedSection({
  relatedNotes,
  noteTypes,
  readOnly = false,
  onOpen,
  onRemove,
}: RelatedSectionProps) {
  if (relatedNotes.length === 0) return null;

  return (
    <div className={styles.section}>
      <p className={styles.label}>Related</p>
      <ul className={styles.list}>
        {relatedNotes.map((note) => {
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
                    <span className={styles.type}>{typeLabel}</span>
                  ) : null}
                </span>
              </button>
              {!readOnly && onRemove && (
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

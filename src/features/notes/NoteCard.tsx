import { NOTE_PREVIEW_IMAGE_LIMIT } from '../../lib/config';
import { getBackground } from '../../lib/backgrounds';
import { CATEGORIES, DISPOSITIONS } from '../../lib/types';
import type { Label, NoteWithUrls } from '../../lib/types';
import { Barcode } from '../barcodes/Barcode';
import { LabelChip } from '../labels/LabelChip';
import styles from './NoteCard.module.css';

interface NoteCardProps {
  note: NoteWithUrls;
  labels: Label[];
  onOpen: (noteId: string) => void;
}

export function NoteCard({ note, labels, onOpen }: NoteCardProps) {
  const bg = getBackground(note.background);
  const preview = note.images.slice(0, NOTE_PREVIEW_IMAGE_LIMIT);
  const overflow = Math.max(0, note.images.length - NOTE_PREVIEW_IMAGE_LIMIT);
  const noteLabels = labels.filter((l) => note.labelIds.includes(l.id));
  const title = note.title.trim() || 'Untitled';
  const disposition = DISPOSITIONS.find(
    (d) => d.id === (note.disposition ?? 'none'),
  );
  const category = CATEGORIES.find((c) => c.id === (note.category ?? 'none'));

  return (
    <article
      className={styles.card}
      style={{ background: bg.surface, borderColor: bg.border }}
      onClick={() => onOpen(note.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen(note.id);
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`Open note ${title}`}
    >
      <div className={styles.badges}>
        {note.pinned && (
          <span className={styles.pinDot} title="Pinned" aria-label="Pinned" />
        )}
        {category && category.id !== 'none' && (
          <span className={styles.category}>{category.label}</span>
        )}
        {disposition && disposition.id !== 'none' && (
          <span
            className={`${styles.disposition} ${styles[`disposition_${disposition.id}`]}`}
          >
            {disposition.short}
          </span>
        )}
      </div>

      {preview.length > 0 && (
        <div
          className={`${styles.images} ${
            preview.length === 1 ? styles.imagesSingle : styles.imagesSplit
          }`}
        >
          {preview.map((img, index) => (
            <div key={img.id} className={styles.imageWrap}>
              <img src={img.url} alt="" className={styles.image} />
              {overflow > 0 && index === preview.length - 1 && (
                <span className={styles.overflow}>+{overflow}</span>
              )}
            </div>
          ))}
        </div>
      )}

      <div className={styles.body}>
        <h3 className={styles.title}>{title}</h3>
        {note.title.trim() && (
          <div className={styles.barcode}>
            <Barcode title={note.title} compact />
          </div>
        )}
        {(note.specialCase ?? '').trim() && (
          <p className={styles.specialCase} title={note.specialCase}>
            <span className={styles.specialCaseMark} aria-hidden>
              !
            </span>
            {note.specialCase.trim()}
          </p>
        )}
        {noteLabels.length > 0 && (
          <div className={styles.labels}>
            {noteLabels.map((label) => (
              <LabelChip key={label.id} name={label.name} />
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

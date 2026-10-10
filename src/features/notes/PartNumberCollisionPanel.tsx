import { Loader2 } from 'lucide-react';
import { noteTypePathLabel } from '../../lib/noteTypes';
import { partNumberLabel } from '../../lib/partNumber';
import type { NoteType, NoteWithUrls } from '../../lib/types';
import styles from './PartNumberCollisionPanel.module.css';

export type CollisionPickMode = 'open' | 'merge';

interface PartNumberCollisionPanelProps {
  matches: NoteWithUrls[];
  noteTypes: NoteType[];
  /** Prefer merge when the draft already has photos. */
  hasPhotos: boolean;
  pickMode: CollisionPickMode | null;
  selectedId: string | null;
  busy?: boolean;
  onOpenExisting: () => void;
  onAddPhotos: () => void;
  onCreateAnother: () => void;
  onSelectMatch: (noteId: string) => void;
  onConfirmPick: () => void;
  onCancelPick: () => void;
}

export function PartNumberCollisionPanel({
  matches,
  noteTypes,
  hasPhotos,
  pickMode,
  selectedId,
  busy = false,
  onOpenExisting,
  onAddPhotos,
  onCreateAnother,
  onSelectMatch,
  onConfirmPick,
  onCancelPick,
}: PartNumberCollisionPanelProps) {
  if (matches.length === 0) return null;

  const label = partNumberLabel(matches[0]?.title) || 'this part number';
  const count = matches.length;
  const picking = pickMode != null;

  return (
    <div
      className={styles.panel}
      role="region"
      aria-label="Part number already exists"
    >
      <p className={styles.title}>This part number already exists</p>
      <p className={styles.sub}>
        {count === 1
          ? `1 note shares ${label}`
          : `${count} notes share ${label}`}
      </p>

      <ul className={styles.list}>
        {matches.map((note) => {
          const typeLabel = noteTypePathLabel(noteTypes, note.categoryId);
          const thumb = note.images[0];
          const selected = selectedId === note.id;
          const row = (
            <>
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
                <span className={styles.matchTitle}>
                  {note.title.trim() || 'No part number'}
                </span>
                <span className={styles.matchType}>
                  {typeLabel ? `${typeLabel} · same part #` : 'Same part #'}
                </span>
              </span>
            </>
          );

          return (
            <li key={note.id}>
              {picking ? (
                <button
                  type="button"
                  className={`${styles.match} ${selected ? styles.matchSelected : ''}`}
                  onClick={() => onSelectMatch(note.id)}
                  disabled={busy}
                  aria-pressed={selected}
                >
                  {row}
                </button>
              ) : (
                <div className={styles.match}>{row}</div>
              )}
            </li>
          );
        })}
      </ul>

      {picking ? (
        <div className={styles.actions}>
          <p className={styles.hint}>
            {pickMode === 'merge'
              ? 'Your new photos will be appended. This draft will be discarded.'
              : hasPhotos
                ? 'Open the selected note. Your photo draft stays on the wall.'
                : 'Open the selected note. This empty draft will be discarded.'}
          </p>
          <button
            type="button"
            className={styles.primary}
            disabled={busy || !selectedId}
            onClick={() => onConfirmPick()}
          >
            {busy ? (
              <>
                <Loader2 size={16} className={styles.spinner} aria-hidden />
                Working…
              </>
            ) : pickMode === 'merge' ? (
              'Add photos to this note'
            ) : (
              'Open this note'
            )}
          </button>
          <button
            type="button"
            className={styles.ghost}
            disabled={busy}
            onClick={() => onCancelPick()}
          >
            Cancel
          </button>
        </div>
      ) : (
        <div className={styles.actions}>
          {hasPhotos ? (
            <>
              <button
                type="button"
                className={styles.primary}
                disabled={busy}
                onClick={() => onAddPhotos()}
              >
                Add photos to existing
              </button>
              <button
                type="button"
                className={styles.secondary}
                disabled={busy}
                onClick={() => onOpenExisting()}
              >
                Open existing
              </button>
            </>
          ) : (
            <button
              type="button"
              className={styles.primary}
              disabled={busy}
              onClick={() => onOpenExisting()}
            >
              Open existing
            </button>
          )}
          <button
            type="button"
            className={styles.ghost}
            disabled={busy}
            onClick={() => onCreateAnother()}
          >
            Create another for a different model
          </button>
        </div>
      )}
    </div>
  );
}

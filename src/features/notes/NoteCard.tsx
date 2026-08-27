import { useEffect, useRef } from 'react';
import { Check } from 'lucide-react';
import { NOTE_PREVIEW_IMAGE_LIMIT } from '../../lib/config';
import { getBackground } from '../../lib/backgrounds';
import { formatNoteAge } from '../../lib/formatNoteAge';
import { CATEGORIES, DISPOSITIONS } from '../../lib/types';
import type { Label, NoteWithUrls } from '../../lib/types';
import { Barcode } from '../barcodes/Barcode';
import { LabelChip } from '../labels/LabelChip';
import styles from './NoteCard.module.css';

const LONG_PRESS_MS = 500;
const MOVE_CANCEL_PX = 12;
/** Ignore click/contextmenu after long-press (mobile fires several of these). */
const SUPPRESS_MS = 1200;

interface NoteCardProps {
  note: NoteWithUrls;
  labels: Label[];
  selecting: boolean;
  selected: boolean;
  showBarcodes: boolean;
  showPhotos: boolean;
  showDescription: boolean;
  showSpecialCase: boolean;
  showLabels: boolean;
  showAge: boolean;
  onOpen: (noteId: string) => void;
  onToggleSelect: (noteId: string) => void;
  onEnterSelect: (noteId: string) => void;
}

export function NoteCard({
  note,
  labels,
  selecting,
  selected,
  showBarcodes,
  showPhotos,
  showDescription,
  showSpecialCase,
  showLabels,
  showAge,
  onOpen,
  onToggleSelect,
  onEnterSelect,
}: NoteCardProps) {
  const bg = getBackground(note.background);
  const preview = note.images.slice(0, NOTE_PREVIEW_IMAGE_LIMIT);
  const overflow = Math.max(0, note.images.length - NOTE_PREVIEW_IMAGE_LIMIT);
  const noteLabels = labels.filter((l) => note.labelIds.includes(l.id));
  const title = note.title.trim() || 'Untitled';
  const disposition = DISPOSITIONS.find(
    (d) => d.id === (note.disposition ?? 'none'),
  );
  const category = CATEGORIES.find((c) => c.id === (note.category ?? 'none'));

  const cardRef = useRef<HTMLElement | null>(null);
  const longPressTimer = useRef<number | null>(null);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const longPressActivated = useRef(false);
  const suppressUntil = useRef(0);

  function armSuppress() {
    suppressUntil.current = Date.now() + SUPPRESS_MS;
  }

  function isSuppressed() {
    return Date.now() < suppressUntil.current;
  }

  function clearLongPressTimer() {
    if (longPressTimer.current != null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }


  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const onTouchEnd = (e: TouchEvent) => {
      if (!longPressActivated.current && !isSuppressed()) return;
      e.preventDefault();
      armSuppress();
    };
    el.addEventListener('touchend', onTouchEnd, { passive: false });
    return () => el.removeEventListener('touchend', onTouchEnd);
  }, []);

  function handlePointerDown(e: React.PointerEvent) {
    if (e.button !== 0) return;
    longPressActivated.current = false;
    if (selecting) return;
    pointerStart.current = { x: e.clientX, y: e.clientY };
    clearLongPressTimer();
    longPressTimer.current = window.setTimeout(() => {
      longPressTimer.current = null;
      longPressActivated.current = true;
      armSuppress();
      onEnterSelect(note.id);
    }, LONG_PRESS_MS);
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!pointerStart.current || longPressTimer.current == null) return;
    const dx = Math.abs(e.clientX - pointerStart.current.x);
    const dy = Math.abs(e.clientY - pointerStart.current.y);
    if (dx > MOVE_CANCEL_PX || dy > MOVE_CANCEL_PX) {
      clearLongPressTimer();
      pointerStart.current = null;
    }
  }

  function handlePointerUp(e: React.PointerEvent) {
    clearLongPressTimer();
    pointerStart.current = null;
    // Prevent the compatibility mouse click that follows a touch long-press.
    if (longPressActivated.current) {
      e.preventDefault();
      armSuppress();
    }
  }


  function handleClick(e: React.MouseEvent) {
    if (longPressActivated.current || isSuppressed()) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (selecting || e.ctrlKey || e.metaKey) {
      e.preventDefault();
      if (selecting) {
        onToggleSelect(note.id);
      } else {
        onEnterSelect(note.id);
      }
      return;
    }
    onOpen(note.id);
  }

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (longPressActivated.current || isSuppressed()) {
      return;
    }
    // Desktop right-click still enters/toggles selection.
    if (selecting) {
      onToggleSelect(note.id);
    } else {
      armSuppress();
      onEnterSelect(note.id);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (selecting) {
        onToggleSelect(note.id);
      } else {
        onOpen(note.id);
      }
    }
  }

  return (
    <article
      ref={cardRef}
      className={`${styles.card} ${selected ? styles.selected : ''}`}
      style={{ background: bg.surface, borderColor: bg.border }}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-pressed={selecting ? selected : undefined}
      aria-label={
        selecting
          ? `${selected ? 'Deselect' : 'Select'} note ${title}`
          : `Open note ${title}`
      }
    >
      {selecting && (
        <span
          className={`${styles.check} ${selected ? styles.checkOn : ''}`}
          aria-hidden
        >
          {selected && <Check size={14} strokeWidth={3} />}
        </span>
      )}

      {note.pinned && (
        <div className={styles.badges}>
          <span className={styles.pinDot} title="Pinned" aria-label="Pinned" />
        </div>
      )}

      {showPhotos && preview.length > 0 && (
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
        <div className={styles.titleRow}>
          <h3 className={styles.title}>{title}</h3>
          {showAge && (
            <time
              className={styles.age}
              dateTime={new Date(note.createdAt).toISOString()}
              title={`Created ${new Date(note.createdAt).toLocaleString()}`}
            >
              {formatNoteAge(note.createdAt)}
            </time>
          )}
        </div>
        {showBarcodes && note.title.trim() && (
          <div className={styles.barcode}>
            <Barcode title={note.title} compact />
          </div>
        )}
        {showDescription && note.description.trim() && (
          <p className={styles.description}>{note.description.trim()}</p>
        )}
        {showSpecialCase && (note.specialCase ?? '').trim() && (
          <p className={styles.specialCase} title={note.specialCase}>
            <span className={styles.specialCaseMark} aria-hidden>
              !
            </span>
            {note.specialCase.trim()}
          </p>
        )}
        {(
          (disposition && disposition.id !== 'none') ||
          (category && category.id !== 'none') ||
          (showLabels && noteLabels.length > 0)
        ) && (
          <div className={styles.labels}>
            {disposition && disposition.id !== 'none' && (
              <span
                className={`${styles.disposition} ${styles[`disposition_${disposition.id}`]}`}
              >
                {disposition.short}
              </span>
            )}
            {category && category.id !== 'none' && (
              <span className={styles.category}>{category.label}</span>
            )}
            {showLabels &&
              noteLabels.map((label) => (
                <LabelChip key={label.id} name={label.name} />
              ))}
          </div>
        )}
      </div>
    </article>
  );
}

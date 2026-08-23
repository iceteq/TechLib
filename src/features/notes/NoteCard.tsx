import { useRef } from 'react';
import { Check } from 'lucide-react';
import { NOTE_PREVIEW_IMAGE_LIMIT } from '../../lib/config';
import { getBackground } from '../../lib/backgrounds';
import { CATEGORIES, DISPOSITIONS } from '../../lib/types';
import type { Label, NoteWithUrls } from '../../lib/types';
import { Barcode } from '../barcodes/Barcode';
import { LabelChip } from '../labels/LabelChip';
import styles from './NoteCard.module.css';

const LONG_PRESS_MS = 450;
const MOVE_CANCEL_PX = 12;
/** Ignore click/contextmenu after long-press (mobile fires extras). */
const SUPPRESS_GESTURE_MS = 1000;

interface NoteCardProps {
  note: NoteWithUrls;
  labels: Label[];
  selecting: boolean;
  selected: boolean;
  onOpen: (noteId: string) => void;
  onToggleSelect: (noteId: string) => void;
  onEnterSelect: (noteId: string) => void;
}

export function NoteCard({
  note,
  labels,
  selecting,
  selected,
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

  const longPressTimer = useRef<number | null>(null);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const suppressUntil = useRef(0);
  const unblockTimers = useRef<number[]>([]);

  function clearLongPress() {
    if (longPressTimer.current != null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    pointerStart.current = null;
  }

  function shouldSuppressGesture(e: React.SyntheticEvent) {
    if (Date.now() >= suppressUntil.current) return false;
    e.preventDefault();
    e.stopPropagation();
    return true;
  }

  function armGestureSuppress() {
    suppressUntil.current = Date.now() + SUPPRESS_GESTURE_MS;

    // Capture-phase blockers beat React's bubble handlers (mobile ghost clicks).
    const block = (event: Event) => {
      if (Date.now() >= suppressUntil.current) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    };
    document.addEventListener('click', block, true);
    document.addEventListener('contextmenu', block, true);
    const timer = window.setTimeout(() => {
      document.removeEventListener('click', block, true);
      document.removeEventListener('contextmenu', block, true);
      unblockTimers.current = unblockTimers.current.filter((t) => t !== timer);
    }, SUPPRESS_GESTURE_MS);
    unblockTimers.current.push(timer);
  }

  function handlePointerDown(e: React.PointerEvent) {
    if (e.button !== 0) return;
    if (selecting) return;
    pointerStart.current = { x: e.clientX, y: e.clientY };
    longPressTimer.current = window.setTimeout(() => {
      longPressTimer.current = null;
      armGestureSuppress();
      onEnterSelect(note.id);
    }, LONG_PRESS_MS);
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!pointerStart.current || longPressTimer.current == null) return;
    const dx = Math.abs(e.clientX - pointerStart.current.x);
    const dy = Math.abs(e.clientY - pointerStart.current.y);
    if (dx > MOVE_CANCEL_PX || dy > MOVE_CANCEL_PX) {
      clearLongPress();
    }
  }

  function handlePointerUp() {
    clearLongPress();
  }

  function handleClick(e: React.MouseEvent) {
    if (shouldSuppressGesture(e)) return;
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
    if (shouldSuppressGesture(e)) return;
    // Never toggle-off via contextmenu — mobile long-press fires this and
    // was clearing the selection we just entered.
    if (!selecting) {
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
        {note.description.trim() && (
          <p className={styles.description}>{note.description.trim()}</p>
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

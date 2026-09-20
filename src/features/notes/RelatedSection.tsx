import { Link2, Plus, X } from 'lucide-react';
import { useMemo, useRef, useState, type CSSProperties } from 'react';
import type { Label, NoteType, NoteWithUrls, StockLocation } from '../../lib/types';
import { noteSearchRank } from '../../lib/searchNotes';
import { noteTypeById, noteTypePathLabel } from '../../lib/noteTypes';
import styles from './RelatedSection.module.css';

interface RelatedSectionProps {
  noteId: string;
  relatedNotes: NoteWithUrls[];
  /** All active notes available to link (excluding archived soft-state handled by caller). */
  candidateNotes: NoteWithUrls[];
  noteTypes: NoteType[];
  labels: Label[];
  stockLocations: StockLocation[];
  readOnly?: boolean;
  onOpen: (noteId: string) => void;
  onAdd: (noteId: string) => Promise<void>;
  onRemove: (noteId: string) => Promise<void>;
}

export function RelatedSection({
  noteId,
  relatedNotes,
  candidateNotes,
  noteTypes,
  labels,
  stockLocations,
  readOnly = false,
  onOpen,
  onAdd,
  onRemove,
}: RelatedSectionProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const relatedIds = useMemo(
    () => new Set(relatedNotes.map((n) => n.id)),
    [relatedNotes],
  );

  const suggestions = useMemo(() => {
    const available = candidateNotes.filter(
      (n) => n.id !== noteId && !relatedIds.has(n.id) && !n.archived,
    );
    const q = query.trim();
    if (!q) return available.slice(0, 8);
    return available
      .map((note) => ({
        note,
        rank: noteSearchRank(
          note,
          labels,
          stockLocations,
          noteTypes,
          q,
        ),
      }))
      .filter((row) => row.rank >= 0)
      .sort((a, b) => b.rank - a.rank || a.note.title.localeCompare(b.note.title))
      .slice(0, 8)
      .map((row) => row.note);
  }, [
    candidateNotes,
    labels,
    noteId,
    noteTypes,
    query,
    relatedIds,
    stockLocations,
  ]);

  const showMenu = open && !readOnly && (suggestions.length > 0 || query.trim().length > 0);

  async function addNote(targetId: string) {
    if (readOnly || busy) return;
    setBusy(true);
    try {
      await onAdd(targetId);
      setQuery('');
      setHighlight(0);
      inputRef.current?.focus();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.section}>
      <div className={styles.header}>
        <p className={styles.heading}>
          <Link2 size={15} strokeWidth={2} aria-hidden />
          Related
          {relatedNotes.length > 0 ? (
            <span className={styles.count}>{relatedNotes.length}</span>
          ) : null}
        </p>
      </div>

      {relatedNotes.length === 0 ? (
        <p className={styles.empty}>
          {readOnly
            ? 'No related notes'
            : 'Link parts that belong together — adapters, cables, hosts.'}
        </p>
      ) : (
        <ul className={styles.list}>
          {relatedNotes.map((note) => {
            const type = noteTypeById(noteTypes, note.categoryId);
            const typeLabel = noteTypePathLabel(noteTypes, note.categoryId);
            const thumb = note.images[0];
            const title = note.title.trim() || 'No part number';
            return (
              <li key={note.id} className={styles.card}>
                <button
                  type="button"
                  className={styles.cardOpen}
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
                    ) : (
                      <span className={styles.thumbEmpty} />
                    )}
                  </span>
                  <span className={styles.cardMeta}>
                    <span className={styles.cardTitle}>{title}</span>
                    {typeLabel && (
                      <span
                        className={styles.cardType}
                        style={
                          type
                            ? ({
                                '--type-color': `var(--type-${type.color}, var(--text-muted))`,
                              } as CSSProperties)
                            : undefined
                        }
                      >
                        {typeLabel}
                      </span>
                    )}
                  </span>
                </button>
                {!readOnly && (
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
      )}

      {!readOnly && (
        <div className={styles.addWrap}>
          <div
            className={`${styles.inputRow} ${open ? styles.inputRowFocus : ''}`}
          >
            <Plus size={15} className={styles.inputIcon} aria-hidden />
            <input
              ref={inputRef}
              className={styles.input}
              value={query}
              placeholder="Add related part…"
              aria-label="Add related note"
              aria-expanded={showMenu}
              aria-autocomplete="list"
              disabled={busy}
              onChange={(e) => {
                setQuery(e.target.value);
                setHighlight(0);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              onBlur={() => {
                // Allow click on suggestion before closing.
                window.setTimeout(() => setOpen(false), 150);
              }}
              onKeyDown={(e) => {
                if (!showMenu) return;
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setHighlight((h) =>
                    suggestions.length === 0
                      ? 0
                      : Math.min(h + 1, suggestions.length - 1),
                  );
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setHighlight((h) => Math.max(h - 1, 0));
                } else if (e.key === 'Enter') {
                  e.preventDefault();
                  const pick = suggestions[highlight];
                  if (pick) void addNote(pick.id);
                } else if (e.key === 'Escape') {
                  setOpen(false);
                }
              }}
            />
          </div>
          {showMenu && (
            <ul className={styles.menu} role="listbox">
              {suggestions.length === 0 ? (
                <li className={styles.menuEmpty}>No matching notes</li>
              ) : (
                suggestions.map((note, index) => {
                  const title = note.title.trim() || 'No part number';
                  const thumb = note.images[0];
                  return (
                    <li key={note.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={index === highlight}
                        className={`${styles.menuItem} ${
                          index === highlight ? styles.menuItemActive : ''
                        }`}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => void addNote(note.id)}
                      >
                        <span className={styles.menuThumb} aria-hidden>
                          {thumb ? (
                            <img
                              src={thumb.thumbUrl || thumb.url}
                              alt=""
                              draggable={false}
                            />
                          ) : (
                            <span className={styles.thumbEmpty} />
                          )}
                        </span>
                        <span className={styles.menuTitle}>{title}</span>
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

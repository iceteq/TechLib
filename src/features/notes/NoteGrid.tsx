import { useCallback, useEffect, useRef, useState } from 'react';
import { ClipboardPaste, Plus, Tag, Trash2, X } from 'lucide-react';
import type {
  Label,
  NoteCategory,
  NoteDisposition,
  NotesView,
  NoteWithUrls,
} from '../../lib/types';
import { CATEGORIES, DISPOSITIONS } from '../../lib/types';
import { categoryLabel, dispositionLabel } from '../../lib/searchNotes';
import { NoteCard } from './NoteCard';
import styles from './NoteGrid.module.css';

type BulkMenu = 'status' | 'type' | 'label' | null;

interface NoteGridProps {
  notes: NoteWithUrls[];
  labels: Label[];
  view: NotesView;
  filterLabelId: string | null;
  filterDisposition: NoteDisposition | null;
  filterCategory: NoteCategory | null;
  specialCasesOnly: boolean;
  search: string;
  onOpenNote: (noteId: string) => void;
  onCreateNote: () => void;
  onPasteNotes: () => void;
  onDeleteNotes: (noteIds: string[]) => Promise<void>;
  onUpdateNotes: (
    noteIds: string[],
    patch: {
      disposition?: NoteDisposition;
      category?: NoteCategory;
      labelIds?: string[];
    },
  ) => Promise<void>;
  onClearLabel: () => void;
  onClearDisposition: () => void;
  onClearCategory: () => void;
  onClearSpecialCases: () => void;
  onClearAllFilters: () => void;
}

export function NoteGrid({
  notes,
  labels,
  view,
  filterLabelId,
  filterDisposition,
  filterCategory,
  specialCasesOnly,
  search,
  onOpenNote,
  onCreateNote,
  onPasteNotes,
  onDeleteNotes,
  onUpdateNotes,
  onClearLabel,
  onClearDisposition,
  onClearCategory,
  onClearSpecialCases,
  onClearAllFilters,
}: NoteGridProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState<BulkMenu>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const selecting = selectedIds.size > 0;

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setMenu(null);
  }, []);

  useEffect(() => {
    clearSelection();
  }, [
    view,
    filterLabelId,
    filterDisposition,
    filterCategory,
    specialCasesOnly,
    search,
    clearSelection,
  ]);

  useEffect(() => {
    if (!selecting) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      if (menu) {
        setMenu(null);
        return;
      }
      clearSelection();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selecting, menu, clearSelection]);

  useEffect(() => {
    if (!menu) return;
    function onPointerDown(e: PointerEvent) {
      if (!barRef.current?.contains(e.target as Node)) {
        setMenu(null);
      }
    }
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [menu]);

  useEffect(() => {
    const visible = new Set(notes.map((n) => n.id));
    setSelectedIds((prev) => {
      if (prev.size === 0) return prev;
      const next = new Set([...prev].filter((id) => visible.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [notes]);

  function enterSelect(noteId: string) {
    setSelectedIds(new Set([noteId]));
    setMenu(null);
  }

  function toggleSelect(noteId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(noteId)) next.delete(noteId);
      else next.add(noteId);
      return next;
    });
  }

  async function runBulk(
    action: () => Promise<void>,
    options?: { clearAfter?: boolean },
  ) {
    setBusy(true);
    setMenu(null);
    try {
      await action();
      if (options?.clearAfter) clearSelection();
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    const ok = window.confirm(
      `Delete ${ids.length} note${ids.length === 1 ? '' : 's'}? This cannot be undone.`,
    );
    if (!ok) return;
    await runBulk(() => onDeleteNotes(ids), { clearAfter: true });
  }

  async function applyDisposition(disposition: NoteDisposition) {
    const ids = [...selectedIds];
    await runBulk(() => onUpdateNotes(ids, { disposition }));
  }

  async function applyCategory(category: NoteCategory) {
    const ids = [...selectedIds];
    await runBulk(() => onUpdateNotes(ids, { category }));
  }

  async function applyLabel(labelId: string | null) {
    const ids = [...selectedIds];
    await runBulk(() =>
      onUpdateNotes(ids, { labelIds: labelId ? [labelId] : [] }),
    );
  }

  function toggleMenu(next: BulkMenu) {
    setMenu((current) => (current === next ? null : next));
  }

  const filterName = labels.find((l) => l.id === filterLabelId)?.name;
  const hasSearch = search.trim().length > 0;
  const canCreate = view === 'notes' && !selecting;
  const statusText = dispositionLabel(filterDisposition);
  const typeText = categoryLabel(filterCategory);
  const hasFilters = Boolean(
    filterLabelId || filterDisposition || filterCategory || specialCasesOnly,
  );
  const sortedLabels = [...labels].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
  );

  let heading = 'All notes';
  if (view === 'archive') heading = 'Archive';
  else if (hasFilters) heading = 'Filtered notes';

  let emptyTitle = 'Nothing here yet';
  let emptyText = 'Tap + to create a note.';

  if (view === 'archive') {
    emptyTitle = 'Archive is empty';
    emptyText = 'Archived notes will show up here.';
  } else if (hasSearch || hasFilters) {
    emptyTitle = 'No matching notes';
    emptyText = 'Try clearing a filter or adjusting search.';
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
                  hasSearch || hasFilters ? ' found' : ''
                }`}
          </p>
        </div>
      </div>

      {view === 'notes' && hasFilters && (
        <div className={styles.chips} aria-label="Active filters">
          {filterName && (
            <button type="button" className={styles.chip} onClick={onClearLabel}>
              #{filterName}
              <X size={14} />
            </button>
          )}
          {statusText && (
            <button
              type="button"
              className={styles.chip}
              onClick={onClearDisposition}
            >
              {statusText}
              <X size={14} />
            </button>
          )}
          {typeText && (
            <button type="button" className={styles.chip} onClick={onClearCategory}>
              {typeText}
              <X size={14} />
            </button>
          )}
          {specialCasesOnly && (
            <button
              type="button"
              className={styles.chip}
              onClick={onClearSpecialCases}
            >
              Special cases
              <X size={14} />
            </button>
          )}
          <button
            type="button"
            className={styles.clearAll}
            onClick={onClearAllFilters}
          >
            Clear all
          </button>
        </div>
      )}

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
              selecting={selecting}
              selected={selectedIds.has(note.id)}
              onOpen={onOpenNote}
              onToggleSelect={toggleSelect}
              onEnterSelect={enterSelect}
            />
          ))}
        </div>
      )}

      {selecting && (
        <div
          ref={barRef}
          className={styles.selectionBar}
          role="toolbar"
          aria-label="Selection"
        >
          <p className={styles.selectionCount}>
            {selectedIds.size} selected
          </p>

          <div className={styles.selectionActions}>
            <div className={styles.menuWrap}>
              <button
                type="button"
                className={`${styles.selectionAction} ${
                  menu === 'status' ? styles.selectionActionOpen : ''
                }`}
                onClick={() => toggleMenu('status')}
                disabled={busy}
                aria-expanded={menu === 'status'}
              >
                Status
              </button>
              {menu === 'status' && (
                <div className={styles.menu} role="menu">
                  {DISPOSITIONS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      className={styles.menuItem}
                      role="menuitem"
                      disabled={busy}
                      onClick={() => void applyDisposition(option.id)}
                    >
                      {option.id === 'none' ? 'No status' : option.short}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className={styles.menuWrap}>
              <button
                type="button"
                className={`${styles.selectionAction} ${
                  menu === 'type' ? styles.selectionActionOpen : ''
                }`}
                onClick={() => toggleMenu('type')}
                disabled={busy}
                aria-expanded={menu === 'type'}
              >
                Type
              </button>
              {menu === 'type' && (
                <div className={styles.menu} role="menu">
                  {CATEGORIES.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      className={styles.menuItem}
                      role="menuitem"
                      disabled={busy}
                      onClick={() => void applyCategory(option.id)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className={styles.menuWrap}>
              <button
                type="button"
                className={`${styles.selectionAction} ${
                  menu === 'label' ? styles.selectionActionOpen : ''
                }`}
                onClick={() => toggleMenu('label')}
                disabled={busy}
                aria-expanded={menu === 'label'}
              >
                <Tag size={14} />
                Label
              </button>
              {menu === 'label' && (
                <div className={styles.menu} role="menu">
                  <button
                    type="button"
                    className={styles.menuItem}
                    role="menuitem"
                    disabled={busy}
                    onClick={() => void applyLabel(null)}
                  >
                    Clear labels
                  </button>
                  {sortedLabels.length === 0 ? (
                    <p className={styles.menuEmpty}>No labels yet</p>
                  ) : (
                    sortedLabels.map((label) => (
                      <button
                        key={label.id}
                        type="button"
                        className={styles.menuItem}
                        role="menuitem"
                        disabled={busy}
                        onClick={() => void applyLabel(label.id)}
                      >
                        #{label.name}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            <button
              type="button"
              className={styles.selectionDelete}
              onClick={() => void handleDelete()}
              disabled={busy}
            >
              <Trash2 size={16} />
              {busy ? 'Working…' : 'Delete'}
            </button>
          </div>

          <button
            type="button"
            className={styles.selectionCancel}
            onClick={clearSelection}
            disabled={busy}
          >
            Cancel
          </button>
        </div>
      )}

      {canCreate && (
        <div className={styles.fabStack}>
          <button
            type="button"
            className={styles.fabSecondary}
            onClick={onPasteNotes}
            aria-label="Paste notes"
            title="Paste notes"
          >
            <ClipboardPaste size={20} strokeWidth={2.25} />
          </button>
          <button
            type="button"
            className={styles.fab}
            onClick={onCreateNote}
            aria-label="New note"
            title="New note"
          >
            <Plus size={24} strokeWidth={2.25} />
          </button>
        </div>
      )}
    </section>
  );
}

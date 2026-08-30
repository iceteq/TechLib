import { useCallback, useEffect, useRef, useState } from 'react';
import { ClipboardPaste, Plus, ShoppingCart, Tag, Trash2, X } from 'lucide-react';
import type {
  Label,
  NoteDisposition,
  NoteType,
  NotesView,
  NoteWithUrls,
  StockLocation,
} from '../../lib/types';
import { DISPOSITIONS } from '../../lib/types';
import { categoryLabel, dispositionLabel, stockLabel } from '../../lib/searchNotes';
import { NoteCard } from './NoteCard';
import styles from './NoteGrid.module.css';

type BulkMenu = 'guideline' | 'type' | 'label' | null;

interface NoteGridProps {
  notes: NoteWithUrls[];
  labels: Label[];
  noteTypes: NoteType[];
  view: NotesView;
  filterLabelIds: string[];
  filterDisposition: NoteDisposition | null;
  filterCategoryId: string | null;
  filterStockId: string | null;
  specialCasesOnly: boolean;
  search: string;
  stockLocations: StockLocation[];
  /** noteId → quantity in cart */
  cartQuantities: Record<string, number>;
  showBarcodes: boolean;
  showPhotos: boolean;
  showDescription: boolean;
  showSpecialCase: boolean;
  showLabels: boolean;
  showAge: boolean;
  onOpenNote: (noteId: string) => void;
  onCreateNote: () => void;
  onPasteNotes: () => void;
  onDeleteNotes: (noteIds: string[]) => Promise<void>;
  onAddToCart: (noteIds: string[]) => Promise<void>;
  onUpdateNotes: (
    noteIds: string[],
    patch: {
      disposition?: NoteDisposition;
      categoryId?: string | null;
      stockId?: string | null;
      labelIds?: string[];
    },
  ) => Promise<void>;
  onClearLabel: (labelId: string) => void;
  onClearDisposition: () => void;
  onClearCategory: () => void;
  onClearStock: () => void;
  onClearSpecialCases: () => void;
  onClearAllFilters: () => void;
  /** Bump to clear selection after sidebar drop-assign. */
  selectionClearNonce?: number;
  onNotesDragStart?: () => void;
}

export function NoteGrid({
  notes,
  labels,
  noteTypes,
  view,
  filterLabelIds,
  filterDisposition,
  filterCategoryId,
  filterStockId,
  specialCasesOnly,
  search,
  stockLocations,
  cartQuantities,
  showBarcodes,
  showPhotos,
  showDescription,
  showSpecialCase,
  showLabels,
  showAge,
  onOpenNote,
  onCreateNote,
  onPasteNotes,
  onDeleteNotes,
  onAddToCart,
  onUpdateNotes,
  onClearLabel,
  onClearDisposition,
  onClearCategory,
  onClearStock,
  onClearSpecialCases,
  onClearAllFilters,
  selectionClearNonce = 0,
  onNotesDragStart,
}: NoteGridProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState<BulkMenu>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const ignoreToggleUntil = useRef(0);
  const selectionAnchorId = useRef<string | null>(null);
  const selecting = selectedIds.size > 0;

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    selectionAnchorId.current = null;
    setMenu(null);
  }, []);

  useEffect(() => {
    if (selectionClearNonce > 0) clearSelection();
  }, [selectionClearNonce, clearSelection]);

  useEffect(() => {
    clearSelection();
  }, [
    view,
    filterLabelIds,
    filterDisposition,
    filterCategoryId,
    filterStockId,
    specialCasesOnly,
    search,
    clearSelection,
  ]);

  useEffect(() => {
    function isTypingTarget(target: EventTarget | null) {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
      if (target.isContentEditable) return true;
      return Boolean(target.closest('[contenteditable="true"]'));
    }

    function onKeyDown(e: KeyboardEvent) {
      if (isTypingTarget(e.target)) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        if (notes.length === 0) return;
        e.preventDefault();
        setSelectedIds(new Set(notes.map((n) => n.id)));
        selectionAnchorId.current = notes[0]?.id ?? null;
        setMenu(null);
        return;
      }

      if (e.key !== 'Escape' || selectedIds.size === 0) return;
      if (menu) {
        setMenu(null);
        return;
      }
      clearSelection();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [notes, selectedIds.size, menu, clearSelection]);

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
    // Mobile long-press emits follow-up click/contextmenu that would toggle off.
    ignoreToggleUntil.current = Date.now() + 1200;
    selectionAnchorId.current = noteId;
    setSelectedIds(new Set([noteId]));
    setMenu(null);
  }

  function toggleSelect(noteId: string) {
    if (Date.now() < ignoreToggleUntil.current) return;
    selectionAnchorId.current = noteId;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(noteId)) next.delete(noteId);
      else next.add(noteId);
      return next;
    });
  }

  function rangeSelect(noteId: string) {
    if (Date.now() < ignoreToggleUntil.current) return;
    const anchorId = selectionAnchorId.current;
    const endIndex = notes.findIndex((n) => n.id === noteId);
    if (endIndex < 0) return;

    if (!anchorId) {
      selectionAnchorId.current = noteId;
      setSelectedIds(new Set([noteId]));
      setMenu(null);
      return;
    }

    const startIndex = notes.findIndex((n) => n.id === anchorId);
    if (startIndex < 0) {
      selectionAnchorId.current = noteId;
      setSelectedIds(new Set([noteId]));
      setMenu(null);
      return;
    }

    const from = Math.min(startIndex, endIndex);
    const to = Math.max(startIndex, endIndex);
    setSelectedIds(new Set(notes.slice(from, to + 1).map((n) => n.id)));
    setMenu(null);
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

  async function handleAddToCart() {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    await runBulk(() => onAddToCart(ids), { clearAfter: true });
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

  async function applyCategory(categoryId: string | null) {
    const ids = [...selectedIds];
    await runBulk(() => onUpdateNotes(ids, { categoryId }));
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

  const filterLabels = labels.filter((l) => filterLabelIds.includes(l.id));
  const hasSearch = search.trim().length > 0;
  const canCreate = view === 'notes' && !selecting;
  const statusText = dispositionLabel(filterDisposition);
  const typeText = categoryLabel(filterCategoryId, noteTypes);
  const stockText = stockLabel(filterStockId, stockLocations);
  const hasFilters = Boolean(
    filterLabelIds.length > 0 ||
      filterDisposition ||
      filterCategoryId ||
      filterStockId ||
      specialCasesOnly,
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
          {statusText && (
            <button
              type="button"
              className={`${styles.chip} ${styles.chipMeta}`}
              onClick={onClearDisposition}
            >
              {statusText}
              <X size={14} />
            </button>
          )}
          {typeText && (
            <button
              type="button"
              className={`${styles.chip} ${styles.chipMeta}`}
              onClick={onClearCategory}
            >
              {typeText}
              <X size={14} />
            </button>
          )}
          {stockText && (
            <button
              type="button"
              className={`${styles.chip} ${styles.chipMeta}`}
              onClick={onClearStock}
            >
              {stockText}
              <X size={14} />
            </button>
          )}
          {specialCasesOnly && (
            <button
              type="button"
              className={`${styles.chip} ${styles.chipMeta}`}
              onClick={onClearSpecialCases}
            >
              Special cases
              <X size={14} />
            </button>
          )}
          {filterLabels.length > 0 &&
            (statusText || typeText || stockText || specialCasesOnly) && (
              <span className={styles.chipDivider} aria-hidden />
            )}
          {[...filterLabels]
            .sort((a, b) =>
              a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
            )
            .map((label) => (
              <button
                key={label.id}
                type="button"
                className={`${styles.chip} ${styles.chipTag}`}
                onClick={() => onClearLabel(label.id)}
              >
                #{label.name}
                <X size={14} />
              </button>
            ))}
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
              noteTypes={noteTypes}
              stockLocations={stockLocations}
              selecting={selecting}
              selected={selectedIds.has(note.id)}
              cartQuantity={cartQuantities[note.id] ?? 0}
              showBarcodes={showBarcodes}
              showPhotos={showPhotos}
              showDescription={showDescription}
              showSpecialCase={showSpecialCase}
              showLabels={showLabels}
              showAge={showAge}
              onOpen={onOpenNote}
              onToggleSelect={toggleSelect}
              onEnterSelect={enterSelect}
              onRangeSelect={rangeSelect}
              onApplyType={(noteId, categoryId) =>
                void onUpdateNotes([noteId], { categoryId })
              }
              dragNoteIds={
                selectedIds.has(note.id) ? [...selectedIds] : undefined
              }
              onNotesDragStart={onNotesDragStart}
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
                  menu === 'guideline' ? styles.selectionActionOpen : ''
                }`}
                onClick={() => toggleMenu('guideline')}
                disabled={busy}
                aria-expanded={menu === 'guideline'}
              >
                Guideline
              </button>
              {menu === 'guideline' && (
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
                      {option.id === 'none' ? 'No guideline' : option.short}
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
                  <button
                    type="button"
                    className={styles.menuItem}
                    role="menuitem"
                    disabled={busy}
                    onClick={() => void applyCategory(null)}
                  >
                    No type
                  </button>
                  {noteTypes.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      className={styles.menuItem}
                      role="menuitem"
                      disabled={busy}
                      onClick={() => void applyCategory(option.id)}
                    >
                      {option.name}
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
              className={styles.selectionAction}
              onClick={() => void handleAddToCart()}
              disabled={busy}
            >
              <ShoppingCart size={14} />
              Add to cart
            </button>

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

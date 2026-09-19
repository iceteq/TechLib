import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Archive,
  ArchiveRestore,
  Camera,
  ChevronUp,
  ClipboardPaste,
  ImagePlus,
  Plus,
  Layers,
  Trash2,
  X,
} from 'lucide-react';
import type {
  Label,
  NoteDisposition,
  NoteType,
  NotesView,
  NoteWithUrls,
  StockLocation,
} from '../../lib/types';
import { categoryLabel, dispositionLabel, stockLabel } from '../../lib/searchNotes';
import { childNoteTypes, rootNoteTypes } from '../../lib/noteTypes';
import { dataTransferImageFiles } from '../../lib/imageFiles';
import { NoteCard } from './NoteCard';
import {
  BulkGuidelineDialog,
  type BulkGuidelineEdit,
} from './BulkGuidelineDialog';
import styles from './NoteGrid.module.css';
import { useJuiceBurst } from '../../lib/useJuiceBurst';
import {
  loadCreateFabAction,
  saveCreateFabAction,
  type CreateFabAction,
} from '../../lib/createFabAction';

type BulkMenu = 'assign' | null;

const CREATE_FAB_ACTIONS: CreateFabAction[] = [
  'note',
  'paste',
  'photos',
  'camera',
];

function createFabMeta(action: CreateFabAction): {
  Icon: typeof Plus;
  label: string;
  title: string;
} {
  switch (action) {
    case 'paste':
      return {
        Icon: ClipboardPaste,
        label: 'Paste notes',
        title: 'Paste notes',
      };
    case 'photos':
      return {
        Icon: ImagePlus,
        label: 'Add images',
        title: 'Add images — creates a note',
      };
    case 'camera':
      return {
        Icon: Camera,
        label: 'Take photo',
        title: 'Take photo — creates a note',
      };
    case 'note':
    default:
      return {
        Icon: Plus,
        label: 'New note',
        title: 'New note',
      };
  }
}

const EMPTY_SORTED = new Set<string>();

interface NoteGridProps {
  notes: NoteWithUrls[];
  labels: Label[];
  noteTypes: NoteType[];
  view: NotesView;
  filterLabelIds: string[];
  filterDisposition: NoteDisposition | null;
  filterCategoryId: string | null;
  filterStockId: string | null;
  search: string;
  stockLocations: StockLocation[];
  /** noteId → quantity in collection */
  cartQuantities: Record<string, number>;
  /** Note ids marked ✅ sorted. */
  sortedNoteIds?: Set<string>;
  showBarcodes: boolean;
  showPhotos: boolean;
  showDescription: boolean;
  showSpecialCase: boolean;
  showLabels: boolean;
  showAge: boolean;
  showTypeChip: boolean;
  onOpenNote: (noteId: string) => void;
  /** When false, hide create/select/assign flows (viewers). */
  canEdit?: boolean;
  onCreateNote?: () => void;
  onPasteNotes?: () => void;
  /** Leave archive / return to the notes wall. */
  onBrowseNotes?: () => void;
  onDeleteNotes: (noteIds: string[]) => Promise<void>;
  onAddToCart: (noteIds: string[]) => Promise<void>;
  onUpdateNotes: (
    noteIds: string[],
    patch: {
      disposition?: NoteDisposition;
      guidelineLines?: import('../../lib/types').GuidelineLine[];
      categoryId?: string | null;
      stockId?: string | null;
      labelIds?: string[];
      archived?: boolean;
    },
  ) => Promise<void>;
  onApplyGuidelineBulk: (
    noteIds: string[],
    edit: BulkGuidelineEdit,
  ) => Promise<void>;
  onCreateLabel?: (name: string) => Promise<Label>;
  /** Add a label to notes (merge), instead of replacing. */
  onAddLabel: (noteIds: string[], labelId: string) => Promise<void>;
  onClearLabel: (labelId: string) => void;
  onClearDisposition: () => void;
  onClearCategory: () => void;
  onClearStock: () => void;
  onClearSearch: () => void;
  onClearAllFilters: () => void;
  /** Bump to clear selection after sidebar drop-assign. */
  selectionClearNonce?: number;
  onNotesDragStart?: () => void;
  /** Drop image files onto the grid to create a note. */
  onDropImages?: (files: File[]) => void;
  /** > 0 while images are being saved (drop / paste create). */
  imageBusyCount?: number;
  /** Note ids that should play a capture highlight on the wall. */
  pulseNoteIds?: string[];
  onPulseEnd?: (noteId: string) => void;
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
  search,
  stockLocations,
  cartQuantities,
  sortedNoteIds,
  showBarcodes,
  showPhotos,
  showDescription,
  showSpecialCase,
  showLabels,
  showAge,
  showTypeChip,
  onOpenNote,
  canEdit = true,
  onCreateNote,
  onPasteNotes,
  onBrowseNotes,
  onDeleteNotes,
  onAddToCart,
  onUpdateNotes,
  onApplyGuidelineBulk,
  onCreateLabel,
  onAddLabel,
  onClearLabel,
  onClearDisposition,
  onClearCategory,
  onClearStock,
  onClearSearch,
  onClearAllFilters,
  selectionClearNonce = 0,
  onNotesDragStart,
  onDropImages,
  imageBusyCount = 0,
  pulseNoteIds = [],
  onPulseEnd,
}: NoteGridProps) {
  const cartJuice = useJuiceBurst();
  const assignJuice = useJuiceBurst();
  const archiveJuice = useJuiceBurst();
  const sortedSet = sortedNoteIds ?? EMPTY_SORTED;
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState<BulkMenu>(null);
  const [fabOpen, setFabOpen] = useState(false);
  const [primaryCreate, setPrimaryCreate] = useState<CreateFabAction>(
    loadCreateFabAction,
  );
  const [bulkGuidelineOpen, setBulkGuidelineOpen] = useState(false);
  const [imageDropActive, setImageDropActive] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const ignoreToggleUntil = useRef(0);
  const selectionAnchorId = useRef<string | null>(null);
  const imageDropDepth = useRef(0);
  const selecting = selectedIds.size > 0;
  const imageBusy = imageBusyCount > 0;

  useEffect(() => {
    if (selecting) setFabOpen(false);
  }, [selecting]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    selectionAnchorId.current = null;
    setMenu(null);
    setBulkGuidelineOpen(false);
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
        if (!canEdit || notes.length === 0) return;
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
  }, [notes, selectedIds.size, menu, clearSelection, canEdit]);

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
    options?: { clearAfter?: boolean; celebrate?: 'assign' | 'archive' },
  ) {
    setBusy(true);
    setMenu(null);
    try {
      await action();
      if (options?.celebrate === 'assign') assignJuice.trigger();
      if (options?.celebrate === 'archive') archiveJuice.trigger();
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

  async function handleArchiveSelected(archived: boolean) {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    await runBulk(() => onUpdateNotes(ids, { archived }), {
      clearAfter: true,
      celebrate: 'archive',
    });
  }

  async function handleDelete() {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    await runBulk(() => onDeleteNotes(ids), { clearAfter: true });
  }

  async function applyDisposition(disposition: NoteDisposition) {
    const ids = [...selectedIds];
    await runBulk(() => onUpdateNotes(ids, { disposition }), {
      celebrate: 'assign',
    });
  }

  async function applyGuidelineBulk(edit: BulkGuidelineEdit) {
    const ids = [...selectedIds];
    setBulkGuidelineOpen(false);
    setMenu(null);
    await runBulk(() => onApplyGuidelineBulk(ids, edit), {
      celebrate: 'assign',
    });
  }

  async function applyCategory(categoryId: string | null) {
    const ids = [...selectedIds];
    await runBulk(() => onUpdateNotes(ids, { categoryId }), {
      celebrate: 'assign',
    });
  }

  async function applyStock(stockId: string | null) {
    const ids = [...selectedIds];
    await runBulk(() => onUpdateNotes(ids, { stockId }), {
      celebrate: 'assign',
    });
  }

  async function applyLabel(labelId: string | null) {
    const ids = [...selectedIds];
    if (!labelId) {
      await runBulk(() => onUpdateNotes(ids, { labelIds: [] }), {
        celebrate: 'assign',
      });
      return;
    }
    await runBulk(() => onAddLabel(ids, labelId), { celebrate: 'assign' });
  }

  function toggleMenu(next: BulkMenu) {
    setMenu((current) => (current === next ? null : next));
  }

  function handleImageDragEnter(e: React.DragEvent) {
    if (!onDropImages) return;
    if (!Array.from(e.dataTransfer.types).includes('Files')) return;
    e.preventDefault();
    imageDropDepth.current += 1;
    setImageDropActive(true);
  }

  function handleImageDragLeave(e: React.DragEvent) {
    if (!imageDropActive) return;
    e.preventDefault();
    imageDropDepth.current = Math.max(0, imageDropDepth.current - 1);
    if (imageDropDepth.current === 0) setImageDropActive(false);
  }

  function handleImageDragOver(e: React.DragEvent) {
    if (!onDropImages) return;
    if (!Array.from(e.dataTransfer.types).includes('Files')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }

  function handleImageDrop(e: React.DragEvent) {
    if (!onDropImages) return;
    e.preventDefault();
    imageDropDepth.current = 0;
    setImageDropActive(false);
    const files = dataTransferImageFiles(e.dataTransfer);
    if (files.length > 0) onDropImages(files);
  }

  function handleCreateFromFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = '';
    if (files.length === 0 || !onDropImages) return;
    onDropImages(files);
  }

  function rememberCreate(action: CreateFabAction) {
    setPrimaryCreate(action);
    saveCreateFabAction(action);
  }

  function runCreate(action: CreateFabAction) {
    rememberCreate(action);
    setFabOpen(false);
    if (action === 'note') {
      onCreateNote?.();
      return;
    }
    if (action === 'paste') {
      onPasteNotes?.();
      return;
    }
    if (action === 'photos') {
      galleryRef.current?.click();
      return;
    }
    cameraRef.current?.click();
  }

  const filterLabels = labels.filter((l) => filterLabelIds.includes(l.id));
  const hasSearch = search.trim().length > 0;
  const canCreate = canEdit && view === 'notes' && !selecting && Boolean(onCreateNote);
  const primaryCreateMeta = createFabMeta(primaryCreate);
  const PrimaryCreateIcon = primaryCreateMeta.Icon;
  const overflowCreate = CREATE_FAB_ACTIONS.filter(
    (action) => action !== primaryCreate,
  );
  const statusText = dispositionLabel(filterDisposition);
  const typeText = categoryLabel(filterCategoryId, noteTypes);
  const stockText = stockLabel(filterStockId, stockLocations);
  const hasFilters = Boolean(
    filterLabelIds.length > 0 ||
      filterDisposition ||
      filterCategoryId ||
      filterStockId ||
      hasSearch,
  );
  const sortedLabels = [...labels].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
  );

  let heading = 'All notes';
  if (view === 'archive') heading = 'Archive';
  else if (hasFilters) heading = 'Filtered notes';

  let emptyTitle = 'Nothing here yet';
  let emptyText = 'Capture parts with photos to build your wall.';

  if (view === 'archive') {
    emptyTitle = 'Archive is empty';
    emptyText = 'Archived notes will show up here.';
  } else if (hasFilters) {
    emptyTitle = 'No matching part numbers';
    emptyText = 'Clear filters to see more notes, or adjust search.';
  }

  return (
    <section
      className={`${styles.section} ${
        imageDropActive ? styles.sectionDrop : ''
      }`}
      onDragEnter={handleImageDragEnter}
      onDragLeave={handleImageDragLeave}
      onDragOver={handleImageDragOver}
      onDrop={handleImageDrop}
    >
      {imageBusyCount > 0 && (
        <div className={styles.imageBusyBanner} role="status" aria-live="polite">
          Adding {imageBusyCount} image{imageBusyCount === 1 ? '' : 's'}…
        </div>
      )}
      {imageDropActive && (
        <div className={styles.dropBanner} aria-live="polite">
          Drop images to create a note
        </div>
      )}
      <div className={styles.toolbar}>
        <div>
          <h2 className={styles.heading}>{heading}</h2>
          <p className={styles.subheading}>
            {notes.length === 0
              ? 'No results'
              : `${notes.length} note${notes.length === 1 ? '' : 's'}${
                  hasSearch || hasFilters ? ' found' : ''
                }`}
            {canEdit && view === 'notes' && !selecting && notes.length > 0 && (
              <span className={styles.hint}> · Long-press a note to select</span>
            )}
          </p>
        </div>
      </div>

      {view === 'notes' && hasFilters && (
        <div className={styles.chips} aria-label="Active filters">
          {hasSearch && (
            <button
              type="button"
              className={`${styles.chip} ${styles.chipMeta}`}
              onClick={onClearSearch}
              title="Clear search"
            >
              Search: {search.trim()}
              <X size={14} />
            </button>
          )}
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
          {filterLabels.length > 0 &&
            (statusText ||
              typeText ||
              stockText ||
                      hasSearch) && (
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
          {view === 'notes' && hasFilters && (
            <button
              type="button"
              className={styles.emptyCta}
              onClick={onClearAllFilters}
            >
              Clear filters
            </button>
          )}
          {view === 'notes' && !hasFilters && canEdit && onCreateNote && (
            <button
              type="button"
              className={styles.emptyCta}
              onClick={onCreateNote}
            >
              Add photo notes
            </button>
          )}
          {view === 'archive' && onBrowseNotes && (
            <button
              type="button"
              className={styles.emptyCta}
              onClick={onBrowseNotes}
            >
              Browse notes
            </button>
          )}
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
              selecting={canEdit && selecting}
              selected={canEdit && selectedIds.has(note.id)}
              cartQuantity={cartQuantities[note.id] ?? 0}
              sorted={sortedSet.has(note.id)}
              showBarcodes={showBarcodes}
              showPhotos={showPhotos}
              showDescription={showDescription}
              showSpecialCase={showSpecialCase}
              showLabels={showLabels}
              showAge={showAge}
              showTypeChip={showTypeChip}
              onOpen={onOpenNote}
              onToggleSelect={canEdit ? toggleSelect : () => {}}
              onEnterSelect={canEdit ? enterSelect : () => {}}
              onRangeSelect={canEdit ? rangeSelect : () => {}}
              onApplyType={
                canEdit
                  ? (noteId, categoryId) =>
                      void onUpdateNotes([noteId], { categoryId })
                  : undefined
              }
              onAssignDisposition={
                canEdit
                  ? (noteId, value) =>
                      void onUpdateNotes([noteId], { disposition: value })
                  : undefined
              }
              onAssignGuidelineLines={
                canEdit
                  ? (noteId, lines) =>
                      void onUpdateNotes([noteId], { guidelineLines: lines })
                  : undefined
              }
              onAssignCategory={
                canEdit
                  ? (noteId, value) =>
                      void onUpdateNotes([noteId], { categoryId: value })
                  : undefined
              }
              onAssignStock={
                canEdit
                  ? (noteId, value) =>
                      void onUpdateNotes([noteId], { stockId: value })
                  : undefined
              }
              onAssignLabels={
                canEdit
                  ? (noteId, labelIds) =>
                      void onUpdateNotes([noteId], { labelIds })
                  : undefined
              }
              onCreateLabel={canEdit ? onCreateLabel : undefined}
              dragNoteIds={
                selectedIds.has(note.id) ? [...selectedIds] : undefined
              }
              onNotesDragStart={onNotesDragStart}
              pulse={pulseNoteIds.includes(note.id)}
              onPulseEnd={onPulseEnd}
              searchQuery={search}
            />
          ))}
        </div>
      )}

      {canEdit && selecting && (
        <div
          ref={barRef}
          className={styles.selectionBar}
          role="toolbar"
          aria-label="Selection"
        >
          <div className={styles.selectionMeta}>
            <p className={styles.selectionCount}>
              {selectedIds.size} selected
            </p>
            <p className={styles.selectionHint}>
              Assign below, or drag onto Type, Stock, or Guideline
            </p>
          </div>

          <div className={styles.selectionActions}>
            <div className={styles.menuWrap}>
              <button
                type="button"
                className={`${styles.selectionAction} ${
                  menu === 'assign' ? styles.selectionActionOpen : ''
                } ${assignJuice.bursting ? styles.selectionActionJuice : ''}`}
                onClick={() => toggleMenu('assign')}
                disabled={busy}
                aria-expanded={menu === 'assign'}
              >
                Assign
              </button>
              {menu === 'assign' && (
                <div className={styles.assignSheet} role="menu">
                  <p className={styles.assignSection}>Guideline</p>
                  <button
                    type="button"
                    className={styles.menuItem}
                    role="menuitem"
                    disabled={busy}
                    onClick={() => {
                      setMenu(null);
                      setBulkGuidelineOpen(true);
                    }}
                  >
                    Edit rules…
                  </button>
                  <button
                    type="button"
                    className={styles.menuItem}
                    role="menuitem"
                    disabled={busy}
                    onClick={() => void applyDisposition('none')}
                  >
                    Clear all guidelines
                  </button>
                  <p className={styles.assignSection}>Type</p>
                  <button
                    type="button"
                    className={styles.menuItem}
                    role="menuitem"
                    disabled={busy}
                    onClick={() => void applyCategory(null)}
                  >
                    No type
                  </button>
                  {rootNoteTypes(noteTypes).map((option) => {
                    const subtypes = childNoteTypes(noteTypes, option.id);
                    return (
                      <div key={option.id}>
                        <button
                          type="button"
                          className={styles.menuItem}
                          role="menuitem"
                          disabled={busy}
                          onClick={() => void applyCategory(option.id)}
                        >
                          {option.name}
                        </button>
                        {subtypes.map((subtype) => (
                          <button
                            key={subtype.id}
                            type="button"
                            className={`${styles.menuItem} ${styles.menuItemNested}`}
                            role="menuitem"
                            disabled={busy}
                            onClick={() => void applyCategory(subtype.id)}
                          >
                            {subtype.name}
                          </button>
                        ))}
                      </div>
                    );
                  })}
                  <p className={styles.assignSection}>Stock</p>
                  <button
                    type="button"
                    className={styles.menuItem}
                    role="menuitem"
                    disabled={busy}
                    onClick={() => void applyStock(null)}
                  >
                    No stock
                  </button>
                  {stockLocations.length === 0 ? (
                    <p className={styles.menuEmpty}>No stock yet</p>
                  ) : (
                    stockLocations.map((stock) => (
                      <button
                        key={stock.id}
                        type="button"
                        className={styles.menuItem}
                        role="menuitem"
                        disabled={busy}
                        onClick={() => void applyStock(stock.id)}
                      >
                        {stock.name}
                      </button>
                    ))
                  )}
                  <p className={styles.assignSection}>Label</p>
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
                        Add #{label.name}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            <button
              type="button"
              className={`${styles.selectionAction} ${
                cartJuice.bursting ? styles.selectionActionJuice : ''
              }`}
              onClick={() => {
                cartJuice.trigger();
                void handleAddToCart();
              }}
              disabled={busy}
            >
              <Layers size={14} />
              Add to collection
            </button>

            <button
              type="button"
              className={`${styles.selectionAction} ${
                archiveJuice.bursting ? styles.selectionActionJuice : ''
              }`}
              onClick={() => {
                void handleArchiveSelected(view !== 'archive');
              }}
              disabled={busy}
            >
              {view === 'archive' ? (
                <ArchiveRestore size={14} />
              ) : (
                <Archive size={14} />
              )}
              {view === 'archive' ? 'Unarchive' : 'Archive'}
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
          <input
            ref={galleryRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={handleCreateFromFiles}
          />
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={handleCreateFromFiles}
          />
          {fabOpen &&
            overflowCreate.map((action) => {
              const meta = createFabMeta(action);
              return (
                <button
                  key={action}
                  type="button"
                  className={styles.fabSecondary}
                  onClick={() => runCreate(action)}
                  aria-label={meta.label}
                  title={meta.title}
                  disabled={
                    imageBusy ||
                    ((action === 'photos' || action === 'camera') &&
                      !onDropImages)
                  }
                >
                  <meta.Icon size={20} strokeWidth={2.25} />
                </button>
              );
            })}
          <button
            type="button"
            className={styles.fabSecondary}
            onClick={() => setFabOpen((open) => !open)}
            aria-label={fabOpen ? 'Hide create options' : 'More create options'}
            aria-expanded={fabOpen}
            title={fabOpen ? 'Hide options' : 'More create options'}
            disabled={imageBusy}
          >
            <ChevronUp
              size={20}
              strokeWidth={2.25}
              style={{
                /* Closed: point up (options expand upward). Open: point down. */
                transform: fabOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 160ms ease',
              }}
            />
          </button>
          <button
            type="button"
            className={styles.fab}
            onClick={() => runCreate(primaryCreate)}
            aria-label={primaryCreateMeta.label}
            title={primaryCreateMeta.title}
            disabled={
              imageBusy ||
              ((primaryCreate === 'photos' || primaryCreate === 'camera') &&
                !onDropImages)
            }
          >
            <PrimaryCreateIcon size={24} strokeWidth={2.25} />
          </button>
        </div>
      )}

      {bulkGuidelineOpen && selectedIds.size > 0 && (
        <BulkGuidelineDialog
          notes={notes.filter((note) => selectedIds.has(note.id))}
          onApply={(edit) => void applyGuidelineBulk(edit)}
          onClose={() => setBulkGuidelineOpen(false)}
        />
      )}
    </section>
  );
}

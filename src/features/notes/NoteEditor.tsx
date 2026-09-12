import { useEffect, useRef, useState } from 'react';
import {
  Archive,
  ArchiveRestore,
  Camera,
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  Loader2,
  Palette,
  Pin,
  PinOff,
  ShoppingCart,
  Trash2,
  X,
} from 'lucide-react';
import { BACKGROUNDS, getBackground } from '../../lib/backgrounds';
import { dataTransferImageFiles } from '../../lib/imageFiles';
import { noteTypeById, suggestNoteType } from '../../lib/noteTypes';
import type {
  GuidelineLine,
  Label,
  NoteBackground,
  NoteDisposition,
  NoteType,
  NoteWithUrls,
  StockLocation,
} from '../../lib/types';
import { Barcode } from '../barcodes/Barcode';
import { ImageGallery } from '../images/ImageGallery';
import { DescriptionField } from '../labels/DescriptionField';
import { LabelPicker } from '../labels/LabelPicker';
import {
  MetaAssignPopover,
  type MetaAssignField,
} from './MetaAssignPopover';
import { GuidelineLinesEditor } from './GuidelineLinesEditor';
import { TypeChip } from './TypeChip';
import styles from './NoteEditor.module.css';

function isTextEntryTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return target.isContentEditable;
}

interface NoteEditorProps {
  note: NoteWithUrls;
  labels: Label[];
  noteTypes: NoteType[];
  stockLocations: StockLocation[];
  showBarcodes: boolean;
  /** 0-based index in the visible list; -1 when the note is not in that list. */
  navIndex?: number;
  navTotal?: number;
  onNavigatePrev?: () => void;
  onNavigateNext?: () => void;
  onClose: () => void;
  onSaveMeta: (patch: {
    title?: string;
    description?: string;
    background?: NoteBackground;
    labelIds?: string[];
    pinned?: boolean;
    archived?: boolean;
    disposition?: NoteDisposition;
    guidelineLines?: GuidelineLine[];
    categoryId?: string | null;
    stockId?: string | null;
    specialCase?: string;
  }) => Promise<void>;
  onAddImages: (files: FileList | File[]) => Promise<void>;
  onRemoveImage: (imageId: string) => Promise<void>;
  onReorderImages: (orderedImageIds: string[]) => Promise<void>;
  onDelete: () => Promise<void>;
  onAddToCart: () => Promise<void>;
  cartQuantity: number;
  onCreateLabel: (name: string) => Promise<Label>;
  /** > 0 while images are being saved. */
  imageBusyCount?: number;
}

export function NoteEditor({
  note,
  labels,
  noteTypes,
  stockLocations,
  showBarcodes,
  navIndex = -1,
  navTotal = 0,
  onNavigatePrev,
  onNavigateNext,
  onClose,
  onSaveMeta,
  onAddImages,
  onRemoveImage,
  onReorderImages,
  onDelete,
  onAddToCart,
  cartQuantity,
  onCreateLabel,
  imageBusyCount = 0,
}: NoteEditorProps) {
  const [title, setTitle] = useState(note.title);
  const [description, setDescription] = useState(note.description);
  const [specialCase, setSpecialCase] = useState(note.specialCase ?? '');
  const [specialCaseOpen, setSpecialCaseOpen] = useState(
    Boolean((note.specialCase ?? '').trim()),
  );
  const [colorOpen, setColorOpen] = useState(false);
  const [assignField, setAssignField] = useState<MetaAssignField | null>(null);
  const [dropActive, setDropActive] = useState(false);
  const [navBusy, setNavBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstOpenRef = useRef(true);
  const dropDepth = useRef(0);
  const bg = getBackground(note.background);
  const selectedType = noteTypeById(noteTypes, note.categoryId);
  const suggestedType =
    !note.categoryId
      ? suggestNoteType(noteTypes, title || note.title, description || note.description)
      : null;
  const stock = stockLocations.find((s) => s.id === note.stockId);
  const canNavigate = navIndex >= 0 && navTotal > 1;
  const canNavigatePrev = canNavigate && navIndex > 0 && Boolean(onNavigatePrev);
  const canNavigateNext =
    canNavigate && navIndex < navTotal - 1 && Boolean(onNavigateNext);
  const isBlank =
    !note.title.trim() &&
    !note.description.trim() &&
    note.images.length === 0 &&
    note.labelIds.length === 0 &&
    !note.pinned &&
    !note.archived &&
    (note.disposition ?? 'none') === 'none' &&
    (note.guidelineLines?.length ?? 0) === 0 &&
    !note.categoryId &&
    !note.stockId &&
    !(note.specialCase ?? '').trim();

  const imageBusy = imageBusyCount > 0;

  useEffect(() => {
    setTitle(note.title);
    setDescription(note.description);
    setSpecialCase(note.specialCase ?? '');
    setSpecialCaseOpen(Boolean((note.specialCase ?? '').trim()));
    setAssignField(null);
    setColorOpen(false);
    setNavBusy(false);
  }, [note.id, note.title, note.description, note.specialCase]);

  useEffect(() => {
    if (firstOpenRef.current) {
      firstOpenRef.current = false;
      titleRef.current?.focus();
      return;
    }
    dialogRef.current?.focus();
  }, [note.id]);

  function handleFileInput(
    e: React.ChangeEvent<HTMLInputElement>,
  ) {
    if (e.target.files?.length) {
      void onAddImages(e.target.files);
      e.target.value = '';
    }
  }

  function handleDialogDragEnter(e: React.DragEvent) {
    const files = dataTransferImageFiles(e.dataTransfer);
    if (files.length === 0 && !Array.from(e.dataTransfer.types).includes('Files')) {
      return;
    }
    if (
      Array.from(e.dataTransfer.types).includes('Files') ||
      files.length > 0
    ) {
      e.preventDefault();
      dropDepth.current += 1;
      setDropActive(true);
    }
  }

  function handleDialogDragLeave(e: React.DragEvent) {
    if (!dropActive) return;
    e.preventDefault();
    dropDepth.current = Math.max(0, dropDepth.current - 1);
    if (dropDepth.current === 0) setDropActive(false);
  }

  function handleDialogDragOver(e: React.DragEvent) {
    const files = dataTransferImageFiles(e.dataTransfer);
    if (files.length === 0 && !Array.from(e.dataTransfer.types).includes('Files')) {
      return;
    }
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }

  function handleDialogDrop(e: React.DragEvent) {
    e.preventDefault();
    dropDepth.current = 0;
    setDropActive(false);
    const files = dataTransferImageFiles(e.dataTransfer);
    if (files.length > 0) void onAddImages(files);
  }

  async function persistTitle(next = title) {
    if (next === note.title) return;
    await onSaveMeta({ title: next });
  }

  async function persistDescription(next = description) {
    if (next === note.description) return;
    await onSaveMeta({ description: next });
  }

  async function persistSpecialCase(next = specialCase) {
    if (next === (note.specialCase ?? '')) return;
    await onSaveMeta({ specialCase: next });
  }

  async function persistAll() {
    await Promise.all([
      persistTitle(),
      persistDescription(),
      persistSpecialCase(),
    ]);
  }

  async function finish() {
    await persistAll();
    onClose();
  }

  async function goPrev() {
    if (!canNavigatePrev || imageBusy || navBusy || assignField) return;
    setNavBusy(true);
    try {
      await persistAll();
      onNavigatePrev?.();
    } finally {
      setNavBusy(false);
    }
  }

  async function goNext() {
    if (!canNavigateNext || imageBusy || navBusy || assignField) return;
    setNavBusy(true);
    try {
      await persistAll();
      onNavigateNext?.();
    } finally {
      setNavBusy(false);
    }
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (imageBusy) return;
        if (assignField) return;
        if (colorOpen) {
          setColorOpen(false);
          return;
        }
        void finish();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        if (imageBusy || assignField) return;
        e.preventDefault();
        void finish();
        return;
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        if (imageBusy || navBusy || assignField || colorOpen) return;
        if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
        if (isTextEntryTarget(e.target)) return;
        if (e.key === 'ArrowLeft') {
          if (!canNavigatePrev) return;
          e.preventDefault();
          void goPrev();
        } else {
          if (!canNavigateNext) return;
          e.preventDefault();
          void goNext();
        }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  async function addLabel(label: Label) {
    if (note.labelIds.includes(label.id)) return;
    await onSaveMeta({ labelIds: [...note.labelIds, label.id] });
  }

  return (
    <div className={styles.overlay} role="presentation" onClick={() => void finish()}>
      <div
        ref={dialogRef}
        className={`${styles.dialog} ${dropActive ? styles.dialogDrop : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={isBlank ? 'Create note' : 'Edit note'}
        tabIndex={-1}
        style={{ background: bg.surface, borderColor: bg.border }}
        onClick={(e) => e.stopPropagation()}
        onDragEnter={handleDialogDragEnter}
        onDragLeave={handleDialogDragLeave}
        onDragOver={handleDialogDragOver}
        onDrop={handleDialogDrop}
      >
        <div className={styles.topActions}>
          <div className={styles.topLeft}>
            <button
              type="button"
              className={styles.iconBtn}
              onClick={() => void finish()}
              aria-label="Close"
            >
              <X size={18} />
            </button>

            {navTotal > 0 && navIndex >= 0 && (
              <div className={styles.nav} role="group" aria-label="Note navigation">
                <button
                  type="button"
                  className={styles.iconBtn}
                  onClick={() => void goPrev()}
                  disabled={!canNavigatePrev || imageBusy || navBusy}
                  aria-label="Previous note"
                  title="Previous note (←)"
                >
                  <ChevronLeft size={18} />
                </button>
                <span className={styles.navPosition} aria-live="polite">
                  {navIndex + 1}
                  <span className={styles.navSlash}>/</span>
                  {navTotal}
                </span>
                <button
                  type="button"
                  className={styles.iconBtn}
                  onClick={() => void goNext()}
                  disabled={!canNavigateNext || imageBusy || navBusy}
                  aria-label="Next note"
                  title="Next note (→)"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            )}
          </div>

          <div className={styles.topRight}>
            <button
              type="button"
              className={`${styles.iconBtn} ${note.pinned ? styles.iconActive : ''}`}
              onClick={() => void onSaveMeta({ pinned: !note.pinned })}
              aria-label={note.pinned ? 'Unpin note' : 'Pin note'}
              title={note.pinned ? 'Unpin' : 'Pin'}
            >
              {note.pinned ? <PinOff size={18} /> : <Pin size={18} />}
            </button>
            <button
              type="button"
              className={`${styles.iconBtn} ${note.archived ? styles.iconActive : ''}`}
              onClick={() => void onSaveMeta({ archived: !note.archived })}
              aria-label={note.archived ? 'Unarchive note' : 'Archive note'}
              title={note.archived ? 'Unarchive' : 'Archive'}
            >
              {note.archived ? <ArchiveRestore size={18} /> : <Archive size={18} />}
            </button>

            <div className={styles.colorWrap}>
              <button
                type="button"
                className={`${styles.iconBtn} ${colorOpen ? styles.iconActive : ''}`}
                onClick={() => setColorOpen((v) => !v)}
                aria-label="Note color"
                aria-expanded={colorOpen}
                title="Color"
              >
                <Palette size={18} />
              </button>
              {colorOpen && (
                <div className={styles.colorPopover} role="listbox" aria-label="Note background">
                  {BACKGROUNDS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      className={`${styles.swatch} ${
                        note.background === option.id ? styles.swatchActive : ''
                      }`}
                      style={{ background: option.surface, borderColor: option.border }}
                      onClick={() => {
                        void onSaveMeta({ background: option.id });
                        setColorOpen(false);
                      }}
                      aria-label={option.label}
                      title={option.label}
                    />
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              className={`${styles.iconBtn} ${
                cartQuantity > 0 ? styles.iconActive : ''
              }`}
              onClick={() => void onAddToCart()}
              aria-label={
                cartQuantity > 0
                  ? cartQuantity === 1
                    ? 'In cart — add another'
                    : `In cart ×${cartQuantity} — add another`
                  : 'Add to cart'
              }
              title={
                cartQuantity > 0
                  ? cartQuantity === 1
                    ? 'In cart — click to add another'
                    : `In cart ×${cartQuantity} — click to add another`
                  : 'Add to cart'
              }
            >
              <ShoppingCart size={18} />
              {cartQuantity > 0 && (
                <span className={styles.cartBadge}>{cartQuantity}</span>
              )}
            </button>

            <button
              type="button"
              className={`${styles.iconBtn} ${styles.danger}`}
              onClick={() => void onDelete()}
              aria-label="Delete note"
              title="Delete"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>

        <ImageGallery
          images={note.images}
          onRemove={(id) => void onRemoveImage(id)}
          onReorder={(ids) => void onReorderImages(ids)}
        />
        {imageBusy && (
          <div className={styles.imageBusy} role="status" aria-live="polite">
            <Loader2 size={16} className={styles.spinner} aria-hidden />
            <span>
              Adding {imageBusyCount} image
              {imageBusyCount === 1 ? '' : 's'}…
            </span>
          </div>
        )}

        <div className={styles.fields}>
          <input
            ref={titleRef}
            className={styles.title}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => void persistTitle()}
            placeholder="Part number"
            aria-label="Part number"
          />
          <DescriptionField
            value={description}
            labels={labels}
            selectedIds={note.labelIds}
            onChange={setDescription}
            onBlur={() => void persistDescription()}
            onAddLabel={(label) => void addLabel(label)}
            onCreateLabel={onCreateLabel}
          />
        </div>

        <div className={styles.section}>
          <LabelPicker
            labels={labels}
            selectedIds={note.labelIds}
            onChange={(labelIds) => void onSaveMeta({ labelIds })}
            onCreateLabel={onCreateLabel}
          />
        </div>

        <div className={styles.section}>
          <p className={styles.sectionLabel}>Guideline</p>
          <GuidelineLinesEditor
            lines={note.guidelineLines ?? []}
            onChange={(guidelineLines) =>
              void onSaveMeta({ guidelineLines })
            }
          />
          <div className={styles.metaRow} aria-label="Type and stock">
            {selectedType ? (
              <TypeChip
                type={selectedType}
                onClick={() => setAssignField('categoryId')}
              />
            ) : suggestedType ? (
              <TypeChip
                type={suggestedType}
                suggested
                onClick={() => void onSaveMeta({ categoryId: suggestedType.id })}
              />
            ) : (
              <button
                type="button"
                className={styles.metaMissing}
                onClick={() => setAssignField('categoryId')}
                aria-haspopup="dialog"
                aria-expanded={assignField === 'categoryId'}
              >
                No type
              </button>
            )}

            {!selectedType && suggestedType && (
              <button
                type="button"
                className={styles.metaMissing}
                onClick={() => setAssignField('categoryId')}
                aria-haspopup="dialog"
                aria-expanded={assignField === 'categoryId'}
              >
                Choose type
              </button>
            )}

            <button
              type="button"
              className={stock ? styles.metaStock : styles.metaMissing}
              onClick={() => setAssignField('stockId')}
              aria-haspopup="dialog"
              aria-expanded={assignField === 'stockId'}
            >
              {stock ? stock.name : 'No stock'}
            </button>
          </div>
          {specialCaseOpen ? (
            <>
              <label className={styles.specialCaseLabel} htmlFor="special-case">
                Definitions / notes
              </label>
              <textarea
                id="special-case"
                className={styles.specialCase}
                value={specialCase}
                onChange={(e) => setSpecialCase(e.target.value)}
                onBlur={() => {
                  void persistSpecialCase();
                  if (!specialCase.trim()) setSpecialCaseOpen(false);
                }}
                placeholder="What “obsolete” means, article numbers, customer bin details…"
                rows={2}
                aria-label="Guideline definitions and notes"
              />
            </>
          ) : (
            <button
              type="button"
              className={styles.addSpecialCase}
              onClick={() => setSpecialCaseOpen(true)}
            >
              Add definitions / notes
            </button>
          )}
        </div>

        {showBarcodes && (
          <div className={styles.section}>
            <p className={styles.sectionLabel}>Barcode</p>
            <Barcode title={title || note.title} />
          </div>
        )}

        {assignField && (
          <MetaAssignPopover
            field={assignField}
            noteTitle={title || note.title}
            noteTypes={noteTypes}
            stockLocations={stockLocations}
            labels={labels}
            currentDisposition={(note.disposition ?? 'none') as NoteDisposition}
            currentGuidelineLines={note.guidelineLines}
            currentCategoryId={note.categoryId}
            currentStockId={note.stockId}
            currentLabelIds={note.labelIds}
            onAssignDisposition={(value) =>
              void onSaveMeta({ disposition: value })
            }
            onAssignGuidelineLines={(guidelineLines) =>
              void onSaveMeta({ guidelineLines })
            }
            onAssignCategory={(value) =>
              void onSaveMeta({ categoryId: value })
            }
            onAssignStock={(value) => void onSaveMeta({ stockId: value })}
            onAssignLabels={(labelIds) => void onSaveMeta({ labelIds })}
            onCreateLabel={onCreateLabel}
            onClose={() => setAssignField(null)}
          />
        )}

        <div className={styles.footer}>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={handleFileInput}
          />
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={handleFileInput}
          />
          <button
            type="button"
            className={styles.iconBtn}
            onClick={() => cameraRef.current?.click()}
            aria-label="Take photo"
            title="Take photo"
            disabled={imageBusy}
          >
            <Camera size={18} />
          </button>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={() => fileRef.current?.click()}
            aria-label="Add images"
            title="Add images"
            disabled={imageBusy}
          >
            <ImagePlus size={18} />
          </button>
          {imageBusy ? (
            <span className={styles.imageBusyInline} role="status">
              <Loader2 size={15} className={styles.spinner} aria-hidden />
              Adding…
            </span>
          ) : (
            dropActive && (
              <span className={styles.dropHint}>Drop images to add</span>
            )
          )}
          <button
            type="button"
            className={styles.primaryBtn}
            onClick={() => void finish()}
            disabled={imageBusy}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

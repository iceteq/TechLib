import { useEffect, useRef, useState } from 'react';
import {
  Archive,
  ArchiveRestore,
  Camera,
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
import { DISPOSITIONS } from '../../lib/types';
import type {
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
import { LabelChip } from '../labels/LabelChip';
import { TypeChip } from './TypeChip';
import styles from './NoteEditor.module.css';

interface NoteEditorProps {
  note: NoteWithUrls;
  labels: Label[];
  noteTypes: NoteType[];
  stockLocations: StockLocation[];
  showBarcodes: boolean;
  onClose: () => void;
  onSaveMeta: (patch: {
    title?: string;
    description?: string;
    background?: NoteBackground;
    labelIds?: string[];
    pinned?: boolean;
    archived?: boolean;
    disposition?: NoteDisposition;
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
  const [dropActive, setDropActive] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const dropDepth = useRef(0);
  const bg = getBackground(note.background);
  const selectedLabels = labels.filter((l) => note.labelIds.includes(l.id));
  const selectedType = noteTypeById(noteTypes, note.categoryId);
  const suggestedType =
    !note.categoryId
      ? suggestNoteType(noteTypes, title || note.title, description || note.description)
      : null;
  const isBlank =
    !note.title.trim() &&
    !note.description.trim() &&
    note.images.length === 0 &&
    note.labelIds.length === 0 &&
    !note.pinned &&
    !note.archived &&
    (note.disposition ?? 'none') === 'none' &&
    !note.categoryId &&
    !note.stockId &&
    !(note.specialCase ?? '').trim();

  const imageBusy = imageBusyCount > 0;

  useEffect(() => {
    setTitle(note.title);
    setDescription(note.description);
    setSpecialCase(note.specialCase ?? '');
    setSpecialCaseOpen(Boolean((note.specialCase ?? '').trim()));
  }, [note.id, note.title, note.description, note.specialCase]);

  useEffect(() => {
    titleRef.current?.focus();
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

  async function finish() {
    await Promise.all([
      persistTitle(),
      persistDescription(),
      persistSpecialCase(),
    ]);
    onClose();
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (imageBusy) return;
        if (colorOpen) {
          setColorOpen(false);
          return;
        }
        void finish();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        if (imageBusy) return;
        e.preventDefault();
        void finish();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  function removeLabel(id: string) {
    void onSaveMeta({
      labelIds: note.labelIds.filter((lid) => lid !== id),
    });
  }

  async function addLabel(label: Label) {
    if (note.labelIds.includes(label.id)) return;
    await onSaveMeta({ labelIds: [...note.labelIds, label.id] });
  }

  return (
    <div className={styles.overlay} role="presentation" onClick={() => void finish()}>
      <div
        className={`${styles.dialog} ${dropActive ? styles.dialogDrop : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={isBlank ? 'Create note' : 'Edit note'}
        style={{ background: bg.surface, borderColor: bg.border }}
        onClick={(e) => e.stopPropagation()}
        onDragEnter={handleDialogDragEnter}
        onDragLeave={handleDialogDragLeave}
        onDragOver={handleDialogDragOver}
        onDrop={handleDialogDrop}
      >
        <div className={styles.topActions}>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={() => void finish()}
            aria-label="Close"
          >
            <X size={18} />
          </button>

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

        {selectedLabels.length > 0 && (
          <div className={styles.section}>
            <div className={styles.labelRow}>
              {selectedLabels.map((label) => (
                <LabelChip
                  key={label.id}
                  name={label.name}
                  onRemove={() => removeLabel(label.id)}
                />
              ))}
            </div>
          </div>
        )}

        <div className={styles.section}>
          <div className={styles.dispositionRow} role="group" aria-label="Product guideline">
            {DISPOSITIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`${styles.dispositionBtn} ${
                  (note.disposition ?? 'none') === option.id
                    ? styles.dispositionActive
                    : ''
                }`}
                onClick={() => void onSaveMeta({ disposition: option.id })}
              >
                {option.id === 'none' ? 'None' : option.short}
              </button>
            ))}
          </div>
          {specialCaseOpen ? (
            <>
              <label className={styles.specialCaseLabel} htmlFor="special-case">
                Special case
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
                placeholder="Only when it isn’t a normal stock / repair / scrap path…"
                rows={2}
                aria-label="Special case handling note"
              />
            </>
          ) : (
            <button
              type="button"
              className={styles.addSpecialCase}
              onClick={() => setSpecialCaseOpen(true)}
            >
              Add special note
            </button>
          )}
        </div>

        <div className={styles.section}>
          <div className={styles.dispositionRow} role="group" aria-label="Product type">
            <button
              type="button"
              className={`${styles.dispositionBtn} ${
                !note.categoryId ? styles.dispositionActive : ''
              }`}
              onClick={() => void onSaveMeta({ categoryId: null })}
            >
              None
            </button>
            {noteTypes.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`${styles.dispositionBtn} ${
                  note.categoryId === option.id ? styles.dispositionActive : ''
                }`}
                onClick={() => void onSaveMeta({ categoryId: option.id })}
              >
                {option.name}
              </button>
            ))}
          </div>
          {!selectedType && suggestedType && (
            <div className={styles.suggestRow}>
              <span className={styles.suggestLabel}>Suggested</span>
              <TypeChip
                type={suggestedType}
                suggested
                onClick={() => void onSaveMeta({ categoryId: suggestedType.id })}
              />
            </div>
          )}
        </div>

        <div className={styles.section}>
          <div className={styles.dispositionRow} role="group" aria-label="Stock location">
            <button
              type="button"
              className={`${styles.dispositionBtn} ${
                !note.stockId ? styles.dispositionActive : ''
              }`}
              onClick={() => void onSaveMeta({ stockId: null })}
            >
              None
            </button>
            {stockLocations.map((stock) => (
              <button
                key={stock.id}
                type="button"
                className={`${styles.dispositionBtn} ${
                  note.stockId === stock.id ? styles.dispositionActive : ''
                }`}
                onClick={() => void onSaveMeta({ stockId: stock.id })}
              >
                {stock.name}
              </button>
            ))}
          </div>
        </div>

        {showBarcodes && (
          <div className={styles.section}>
            <p className={styles.sectionLabel}>Barcode</p>
            <Barcode title={title || note.title} />
          </div>
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

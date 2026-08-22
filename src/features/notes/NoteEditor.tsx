import { useEffect, useRef, useState } from 'react';
import {
  Archive,
  ArchiveRestore,
  ImagePlus,
  Palette,
  Pin,
  PinOff,
  Trash2,
  X,
} from 'lucide-react';
import { BACKGROUNDS, getBackground } from '../../lib/backgrounds';
import { DISPOSITIONS } from '../../lib/types';
import type {
  Label,
  NoteBackground,
  NoteDisposition,
  NoteWithUrls,
} from '../../lib/types';
import { Barcode } from '../barcodes/Barcode';
import { ImageGallery } from '../images/ImageGallery';
import { DescriptionField } from '../labels/DescriptionField';
import { LabelChip } from '../labels/LabelChip';
import styles from './NoteEditor.module.css';

interface NoteEditorProps {
  note: NoteWithUrls;
  labels: Label[];
  onClose: () => void;
  onSaveMeta: (patch: {
    title?: string;
    description?: string;
    background?: NoteBackground;
    labelIds?: string[];
    pinned?: boolean;
    archived?: boolean;
    disposition?: NoteDisposition;
  }) => Promise<void>;
  onAddImages: (files: FileList | File[]) => Promise<void>;
  onRemoveImage: (imageId: string) => Promise<void>;
  onReorderImages: (orderedImageIds: string[]) => Promise<void>;
  onDelete: () => Promise<void>;
  onCreateLabel: (name: string) => Promise<Label>;
}

export function NoteEditor({
  note,
  labels,
  onClose,
  onSaveMeta,
  onAddImages,
  onRemoveImage,
  onReorderImages,
  onDelete,
  onCreateLabel,
}: NoteEditorProps) {
  const [title, setTitle] = useState(note.title);
  const [description, setDescription] = useState(note.description);
  const [colorOpen, setColorOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const bg = getBackground(note.background);
  const selectedLabels = labels.filter((l) => note.labelIds.includes(l.id));
  const isBlank =
    !note.title.trim() &&
    !note.description.trim() &&
    note.images.length === 0 &&
    note.labelIds.length === 0 &&
    !note.pinned &&
    !note.archived &&
    (note.disposition ?? 'none') === 'none';

  useEffect(() => {
    setTitle(note.title);
    setDescription(note.description);
  }, [note.id, note.title, note.description]);

  useEffect(() => {
    titleRef.current?.focus();
  }, [note.id]);

  async function persistTitle(next = title) {
    if (next === note.title) return;
    await onSaveMeta({ title: next });
  }

  async function persistDescription(next = description) {
    if (next === note.description) return;
    await onSaveMeta({ description: next });
  }

  async function finish() {
    await Promise.all([persistTitle(), persistDescription()]);
    onClose();
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (colorOpen) {
          setColorOpen(false);
          return;
        }
        void finish();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
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
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-label={isBlank ? 'Create note' : 'Edit note'}
        style={{ background: bg.surface, borderColor: bg.border }}
        onClick={(e) => e.stopPropagation()}
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

        <div className={styles.fields}>
          <input
            ref={titleRef}
            className={styles.title}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => void persistTitle()}
            placeholder="Title"
            aria-label="Note title"
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
          <p className={styles.sectionLabel}>Status</p>
          <div className={styles.dispositionRow} role="group" aria-label="Product status">
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
        </div>

        <div className={styles.section}>
          <p className={styles.sectionLabel}>Barcode</p>
          <Barcode title={title || note.title} />
        </div>

        <div className={styles.footer}>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              if (e.target.files?.length) {
                void onAddImages(e.target.files);
                e.target.value = '';
              }
            }}
          />
          <button
            type="button"
            className={styles.iconBtn}
            onClick={() => fileRef.current?.click()}
            aria-label="Add images"
            title="Add images"
          >
            <ImagePlus size={18} />
          </button>
          <button
            type="button"
            className={styles.primaryBtn}
            onClick={() => void finish()}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

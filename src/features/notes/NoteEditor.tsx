import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Trash2, X } from 'lucide-react';
import { BACKGROUNDS, getBackground } from '../../lib/backgrounds';
import type { Label, NoteBackground, NoteWithUrls } from '../../lib/types';
import { ImageGallery } from '../images/ImageGallery';
import { LabelPicker } from '../labels/LabelPicker';
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
  }) => Promise<void>;
  onAddImages: (files: FileList | File[]) => Promise<void>;
  onRemoveImage: (imageId: string) => Promise<void>;
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
  onDelete,
  onCreateLabel,
}: NoteEditorProps) {
  const [title, setTitle] = useState(note.title);
  const [description, setDescription] = useState(note.description);
  const fileRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const bg = getBackground(note.background);
  const isBlank =
    !note.title.trim() &&
    !note.description.trim() &&
    note.images.length === 0 &&
    note.labelIds.length === 0;

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
    // Intentionally rebind when draft text changes so finish persists latest values.
  });

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
          <button
            type="button"
            className={`${styles.iconBtn} ${styles.danger}`}
            onClick={() => void onDelete()}
            aria-label="Delete note"
          >
            <Trash2 size={18} />
          </button>
        </div>

        <ImageGallery images={note.images} onRemove={(id) => void onRemoveImage(id)} />

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
          <textarea
            className={styles.description}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={() => void persistDescription()}
            placeholder="Take a note…"
            rows={5}
            aria-label="Note description"
          />
        </div>

        <div className={styles.section}>
          <p className={styles.sectionLabel}>Labels</p>
          <LabelPicker
            labels={labels}
            selectedIds={note.labelIds}
            onChange={(labelIds) => void onSaveMeta({ labelIds })}
            onCreateLabel={onCreateLabel}
          />
        </div>

        <div className={styles.section}>
          <p className={styles.sectionLabel}>Background</p>
          <div className={styles.swatches} role="listbox" aria-label="Note background">
            {BACKGROUNDS.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`${styles.swatch} ${
                  note.background === option.id ? styles.swatchActive : ''
                }`}
                style={{ background: option.surface, borderColor: option.border }}
                onClick={() => void onSaveMeta({ background: option.id })}
                aria-label={option.label}
                title={option.label}
              />
            ))}
          </div>
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
            className={styles.secondaryBtn}
            onClick={() => fileRef.current?.click()}
          >
            <ImagePlus size={16} />
            Add images
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

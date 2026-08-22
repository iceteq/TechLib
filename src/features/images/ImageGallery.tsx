import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  type DragEndEvent,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChevronLeft, ChevronRight, GripVertical, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { NoteImageWithUrl } from '../../lib/types';
import styles from './ImageGallery.module.css';

interface ImageGalleryProps {
  images: NoteImageWithUrl[];
  onRemove: (imageId: string) => void;
  onReorder: (orderedImageIds: string[]) => void;
}

function SortableThumb({
  img,
  index,
  onOpen,
  onRemove,
}: {
  img: NoteImageWithUrl;
  index: number;
  onOpen: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: img.id });

  return (
    <div
      ref={setNodeRef}
      className={`${styles.thumb} ${isDragging ? styles.dragging : ''}`}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      <button
        type="button"
        className={styles.dragHandle}
        aria-label={`Drag to reorder image ${index + 1}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical size={14} />
      </button>
      <button
        type="button"
        className={styles.thumbOpen}
        onClick={onOpen}
        aria-label={`View image ${index + 1}`}
      >
        <img src={img.url} alt="" />
      </button>
      <button
        type="button"
        className={styles.remove}
        onClick={onRemove}
        aria-label="Remove image"
      >
        <Trash2 size={12} />
      </button>
    </div>
  );
}

export function ImageGallery({ images, onRemove, onReorder }: ImageGalleryProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  useEffect(() => {
    if (lightboxIndex === null) return;

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        setLightboxIndex(null);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setLightboxIndex((i) =>
          i === null ? i : (i + 1) % images.length,
        );
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setLightboxIndex((i) =>
          i === null ? i : (i - 1 + images.length) % images.length,
        );
      }
    }

    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [lightboxIndex, images.length]);

  if (images.length === 0) return null;

  const active = lightboxIndex !== null ? images[lightboxIndex] : null;

  function handleDragEnd(event: DragEndEvent) {
    const { active: dragActive, over } = event;
    if (!over || dragActive.id === over.id) return;

    const oldIndex = images.findIndex((img) => img.id === dragActive.id);
    const newIndex = images.findIndex((img) => img.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const next = arrayMove(images, oldIndex, newIndex).map((img) => img.id);
    onReorder(next);
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={images.map((img) => img.id)}
          strategy={rectSortingStrategy}
        >
          <div
            className={`${styles.grid} ${
              images.length === 1 ? styles.single : ''
            }`}
          >
            {images.map((img, index) => (
              <SortableThumb
                key={img.id}
                img={img}
                index={index}
                onOpen={() => setLightboxIndex(index)}
                onRemove={() => onRemove(img.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {images.length > 1 && (
        <p className={styles.hint}>Drag the handle to reorder images</p>
      )}

      {active && lightboxIndex !== null && (
        <div
          className={styles.lightbox}
          role="dialog"
          aria-modal="true"
          aria-label="Image preview"
          onClick={() => setLightboxIndex(null)}
        >
          <button
            type="button"
            className={styles.lightboxClose}
            onClick={() => setLightboxIndex(null)}
            aria-label="Close preview"
          >
            <X size={20} />
          </button>

          {images.length > 1 && (
            <>
              <button
                type="button"
                className={`${styles.nav} ${styles.navPrev}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIndex(
                    (lightboxIndex - 1 + images.length) % images.length,
                  );
                }}
                aria-label="Previous image"
              >
                <ChevronLeft size={24} />
              </button>
              <button
                type="button"
                className={`${styles.nav} ${styles.navNext}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIndex((lightboxIndex + 1) % images.length);
                }}
                aria-label="Next image"
              >
                <ChevronRight size={24} />
              </button>
            </>
          )}

          <img
            src={active.url}
            alt=""
            className={styles.lightboxImage}
            onClick={(e) => e.stopPropagation()}
          />
          <p className={styles.counter}>
            {lightboxIndex + 1} / {images.length}
          </p>
        </div>
      )}
    </>
  );
}

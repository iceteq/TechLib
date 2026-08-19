import type { NoteImageWithUrl } from '../../lib/types';
import { ChevronLeft, ChevronRight, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import styles from './ImageGallery.module.css';

interface ImageGalleryProps {
  images: NoteImageWithUrl[];
  onRemove: (imageId: string) => void;
}

export function ImageGallery({ images, onRemove }: ImageGalleryProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

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

  return (
    <>
      <div
        className={`${styles.grid} ${
          images.length === 1 ? styles.single : ''
        }`}
      >
        {images.map((img, index) => (
          <div key={img.id} className={styles.thumb}>
            <button
              type="button"
              className={styles.thumbOpen}
              onClick={() => setLightboxIndex(index)}
              aria-label={`View image ${index + 1}`}
            >
              <img src={img.url} alt="" />
            </button>
            <button
              type="button"
              className={styles.remove}
              onClick={() => onRemove(img.id)}
              aria-label="Remove image"
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>

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

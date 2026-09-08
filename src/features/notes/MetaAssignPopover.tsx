import { useEffect, useRef } from 'react';
import { DISPOSITIONS } from '../../lib/types';
import type { NoteDisposition, NoteType, StockLocation } from '../../lib/types';
import styles from './MetaAssignPopover.module.css';

export type MetaAssignField = 'disposition' | 'categoryId' | 'stockId';

interface MetaAssignPopoverProps {
  field: MetaAssignField;
  noteTypes: NoteType[];
  stockLocations: StockLocation[];
  onAssignDisposition: (value: NoteDisposition) => void;
  onAssignCategory: (value: string | null) => void;
  onAssignStock: (value: string | null) => void;
  onClose: () => void;
}

export function MetaAssignPopover({
  field,
  noteTypes,
  stockLocations,
  onAssignDisposition,
  onAssignCategory,
  onAssignStock,
  onClose,
}: MetaAssignPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (!ref.current?.contains(e.target as Node)) onClose();
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  const title =
    field === 'disposition'
      ? 'Guideline'
      : field === 'categoryId'
        ? 'Type'
        : 'Stock';

  return (
    <div
      ref={ref}
      className={styles.popover}
      role="menu"
      aria-label={`Set ${title}`}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <p className={styles.title}>{title}</p>
      {field === 'disposition' &&
        DISPOSITIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            className={styles.item}
            role="menuitem"
            onClick={() => {
              onAssignDisposition(option.id);
              onClose();
            }}
          >
            {option.id === 'none' ? 'No guideline' : option.short}
          </button>
        ))}
      {field === 'categoryId' && (
        <>
          <button
            type="button"
            className={styles.item}
            role="menuitem"
            onClick={() => {
              onAssignCategory(null);
              onClose();
            }}
          >
            No type
          </button>
          {noteTypes.map((option) => (
            <button
              key={option.id}
              type="button"
              className={styles.item}
              role="menuitem"
              onClick={() => {
                onAssignCategory(option.id);
                onClose();
              }}
            >
              {option.name}
            </button>
          ))}
        </>
      )}
      {field === 'stockId' && (
        <>
          <button
            type="button"
            className={styles.item}
            role="menuitem"
            onClick={() => {
              onAssignStock(null);
              onClose();
            }}
          >
            No stock
          </button>
          {stockLocations.length === 0 ? (
            <p className={styles.empty}>No stock yet</p>
          ) : (
            stockLocations.map((stock) => (
              <button
                key={stock.id}
                type="button"
                className={styles.item}
                role="menuitem"
                onClick={() => {
                  onAssignStock(stock.id);
                  onClose();
                }}
              >
                {stock.name}
              </button>
            ))
          )}
        </>
      )}
    </div>
  );
}

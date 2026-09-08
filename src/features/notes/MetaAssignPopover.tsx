import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { DISPOSITIONS } from '../../lib/types';
import type { NoteDisposition, NoteType, StockLocation } from '../../lib/types';
import styles from './MetaAssignPopover.module.css';

export type MetaAssignField = 'disposition' | 'categoryId' | 'stockId';

interface MetaAssignPopoverProps {
  field: MetaAssignField;
  noteTitle: string;
  noteTypes: NoteType[];
  stockLocations: StockLocation[];
  onAssignDisposition: (value: NoteDisposition) => void;
  onAssignCategory: (value: string | null) => void;
  onAssignStock: (value: string | null) => void;
  onClose: () => void;
}

export function MetaAssignPopover({
  field,
  noteTitle,
  noteTypes,
  stockLocations,
  onAssignDisposition,
  onAssignCategory,
  onAssignStock,
  onClose,
}: MetaAssignPopoverProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const partLabel = noteTitle.trim() || 'No part number';

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    }
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [onClose]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const fieldLabel =
    field === 'disposition'
      ? 'Guideline'
      : field === 'categoryId'
        ? 'Type'
        : 'Stock';

  const dialog = (
    <div
      className={styles.overlay}
      role="presentation"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div
        ref={dialogRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <div className={styles.headerText}>
            <p className={styles.fieldLabel}>Set {fieldLabel}</p>
            <h2 id={titleId} className={styles.noteTitle}>
              {partLabel}
            </h2>
          </div>
          <button
            type="button"
            className={styles.close}
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className={styles.options} role="listbox" aria-label={fieldLabel}>
          {field === 'disposition' &&
            DISPOSITIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                className={styles.item}
                role="option"
                onClick={() => {
                  onAssignDisposition(option.id);
                  onClose();
                }}
              >
                {option.id === 'none' ? 'No guideline' : option.label}
              </button>
            ))}
          {field === 'categoryId' && (
            <>
              <button
                type="button"
                className={styles.item}
                role="option"
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
                  role="option"
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
                role="option"
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
                    role="option"
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
      </div>
    </div>
  );

  return createPortal(dialog, document.body);
}

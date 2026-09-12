import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import type {
  GuidelineLine,
  Label,
  NoteDisposition,
  NoteType,
  StockLocation,
} from '../../lib/types';
import { resolveGuidelineLines } from '../../lib/guidelineLines';
import { LabelPicker } from '../labels/LabelPicker';
import { GuidelineLinesEditor } from './GuidelineLinesEditor';
import styles from './MetaAssignPopover.module.css';

export type MetaAssignField =
  | 'disposition'
  | 'categoryId'
  | 'stockId'
  | 'labels';

interface MetaAssignPopoverProps {
  field: MetaAssignField;
  noteTitle: string;
  noteTypes: NoteType[];
  stockLocations: StockLocation[];
  labels: Label[];
  currentDisposition: NoteDisposition;
  currentGuidelineLines?: GuidelineLine[] | null;
  currentCategoryId: string | null;
  currentStockId: string | null;
  currentLabelIds: string[];
  onAssignDisposition: (value: NoteDisposition) => void;
  onAssignGuidelineLines?: (lines: GuidelineLine[]) => void;
  onAssignCategory: (value: string | null) => void;
  onAssignStock: (value: string | null) => void;
  onAssignLabels: (labelIds: string[]) => void;
  onCreateLabel: (name: string) => Promise<Label>;
  onClose: () => void;
}

export function MetaAssignPopover({
  field,
  noteTitle,
  noteTypes,
  stockLocations,
  labels,
  currentDisposition,
  currentGuidelineLines,
  currentCategoryId,
  currentStockId,
  currentLabelIds,
  onAssignDisposition,
  onAssignGuidelineLines,
  onAssignCategory,
  onAssignStock,
  onAssignLabels,
  onCreateLabel,
  onClose,
}: MetaAssignPopoverProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const partLabel = noteTitle.trim() || 'No part number';
  const [draftLabelIds, setDraftLabelIds] = useState(currentLabelIds);
  const [draftLines, setDraftLines] = useState(() =>
    resolveGuidelineLines({
      guidelineLines: currentGuidelineLines,
      disposition: currentDisposition,
    }),
  );

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
    dialogRef.current?.querySelector<HTMLElement>('button, input')?.focus();
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  function commitLabelsAndClose() {
    onAssignLabels(draftLabelIds);
    onClose();
  }

  function commitGuidelinesAndClose() {
    if (onAssignGuidelineLines) {
      onAssignGuidelineLines(draftLines);
    } else if (draftLines.length === 0) {
      onAssignDisposition('none');
    } else {
      // Fallback for callers that only accept a single disposition.
      onAssignDisposition(draftLines[0].action);
    }
    onClose();
  }

  const fieldLabel =
    field === 'disposition'
      ? 'Guideline'
      : field === 'categoryId'
        ? 'Type'
        : field === 'stockId'
          ? 'Stock'
          : 'Labels';

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
        className={`${styles.dialog} ${
          field === 'disposition' ? styles.dialogWide : ''
        }`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <div className={styles.headerText}>
            <p className={styles.fieldLabel}>
              {field === 'labels'
                ? 'Manage'
                : field === 'disposition'
                  ? 'Edit'
                  : 'Set'}{' '}
              {fieldLabel}
            </p>
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

        {field === 'labels' ? (
          <div className={styles.labelBody}>
            <LabelPicker
              labels={labels}
              selectedIds={draftLabelIds}
              onChange={setDraftLabelIds}
              onCreateLabel={onCreateLabel}
            />
            <button
              type="button"
              className={styles.done}
              onClick={commitLabelsAndClose}
            >
              Done
            </button>
          </div>
        ) : field === 'disposition' ? (
          <div className={styles.labelBody}>
            <p className={styles.hint}>
              Add When → Then rules (e.g. Broken → Repair). Optional How for
              procedures like serial + special bin.
            </p>
            <GuidelineLinesEditor
              lines={draftLines}
              onChange={setDraftLines}
              compact
            />
            <button
              type="button"
              className={styles.done}
              onClick={commitGuidelinesAndClose}
            >
              Done
            </button>
          </div>
        ) : (
          <div className={styles.options} role="listbox" aria-label={fieldLabel}>
            {field === 'categoryId' && (
              <>
                <button
                  type="button"
                  className={`${styles.item} ${
                    !currentCategoryId ? styles.itemActive : ''
                  }`}
                  role="option"
                  aria-selected={!currentCategoryId}
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
                    className={`${styles.item} ${
                      currentCategoryId === option.id ? styles.itemActive : ''
                    }`}
                    role="option"
                    aria-selected={currentCategoryId === option.id}
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
                  className={`${styles.item} ${
                    !currentStockId ? styles.itemActive : ''
                  }`}
                  role="option"
                  aria-selected={!currentStockId}
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
                      className={`${styles.item} ${
                        currentStockId === stock.id ? styles.itemActive : ''
                      }`}
                      role="option"
                      aria-selected={currentStockId === stock.id}
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
        )}
      </div>
    </div>
  );

  return createPortal(dialog, document.body);
}

import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { X } from 'lucide-react';
import {
  applyPasteToGrid,
  draftsFromGrid,
  EMPTY_PASTE_ROW,
  PASTE_COL_COUNT,
  PASTE_NOTE_COLUMNS,
  type PasteGridRow,
  type PastedNoteDraft,
} from '../../lib/parsePastedNotes';
import { normalizePartNumber } from '../../lib/partNumber';
import styles from './PasteNotesDialog.module.css';

interface PasteNotesDialogProps {
  filterSummary: string;
  /** Normalized part numbers already present on non-deleted library notes. */
  existingPartKeys: ReadonlySet<string>;
  onClose: () => void;
  onImport: (drafts: PastedNoteDraft[]) => Promise<void>;
}

type GridRowModel = {
  id: string;
  cells: PasteGridRow;
};

const PREVIEW_STEP = 12;

function newRowId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function makeRow(cells: PasteGridRow = EMPTY_PASTE_ROW()): GridRowModel {
  return { id: newRowId(), cells };
}

function hasStructuredPaste(text: string): boolean {
  return /[\t\r\n]/.test(text);
}

function mergeRows(
  current: GridRowModel[],
  nextCells: PasteGridRow[],
): GridRowModel[] {
  return nextCells.map((cells, index) => {
    const existing = current[index];
    if (existing) return { ...existing, cells };
    return makeRow(cells);
  });
}

export function PasteNotesDialog({
  filterSummary,
  existingPartKeys,
  onClose,
  onImport,
}: PasteNotesDialogProps) {
  const titleId = useId();
  const [rows, setRows] = useState<GridRowModel[]>(() => [makeRow()]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visibleLimit, setVisibleLimit] = useState(PREVIEW_STEP);
  const [focusTarget, setFocusTarget] = useState<{
    row: number;
    col: number;
  } | null>({ row: 0, col: 0 });
  const overlayRef = useRef<HTMLDivElement>(null);
  const cellRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  const gridRows = useMemo(() => rows.map((row) => row.cells), [rows]);
  const drafts = useMemo(() => draftsFromGrid(gridRows), [gridRows]);
  const existingRowIndexes = useMemo(() => {
    const indexes = new Set<number>();
    rows.forEach((row, index) => {
      const key = normalizePartNumber(row.cells[0]);
      if (key && existingPartKeys.has(key)) indexes.add(index);
    });
    return indexes;
  }, [rows, existingPartKeys]);
  const existingCount = existingRowIndexes.size;
  const canImport = drafts.length > 0 && !busy;
  const hiddenCount = Math.max(0, rows.length - visibleLimit);
  const visibleRows = rows.slice(0, visibleLimit);

  function cellKey(rowId: string, col: number): string {
    return `${rowId}:${col}`;
  }

  function setCellRef(rowId: string, col: number, el: HTMLInputElement | null) {
    const key = cellKey(rowId, col);
    if (el) cellRefs.current.set(key, el);
    else cellRefs.current.delete(key);
  }

  function queueFocus(row: number, col: number) {
    setFocusTarget({ row, col });
  }

  useLayoutEffect(() => {
    if (!focusTarget) return;
    const list = rowsRef.current;
    const row = Math.max(0, Math.min(focusTarget.row, list.length - 1));
    const col = Math.max(0, Math.min(focusTarget.col, PASTE_COL_COUNT - 1));
    if (row >= visibleLimit) {
      setVisibleLimit((limit) =>
        Math.min(list.length, Math.max(limit + PREVIEW_STEP, row + 1)),
      );
      return;
    }
    const model = list[row];
    if (!model) return;
    const el = cellRefs.current.get(cellKey(model.id, col));
    if (!el) return;
    el.focus();
    const len = el.value.length;
    el.setSelectionRange(len, len);
    setFocusTarget(null);
  }, [focusTarget, rows, visibleLimit]);

  // Keep the sheet inside the visual viewport so Import stays above the keyboard.
  useEffect(() => {
    const overlay = overlayRef.current;
    const vv = window.visualViewport;
    if (!overlay || !vv) return;

    const sync = () => {
      overlay.style.setProperty('--vv-offset-top', `${vv.offsetTop}px`);
      overlay.style.setProperty('--vv-height', `${vv.height}px`);
    };

    sync();
    vv.addEventListener('resize', sync);
    vv.addEventListener('scroll', sync);
    return () => {
      vv.removeEventListener('resize', sync);
      vv.removeEventListener('scroll', sync);
      overlay.style.removeProperty('--vv-offset-top');
      overlay.style.removeProperty('--vv-height');
    };
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !busy) onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [busy, onClose]);

  function updateCell(rowIndex: number, col: number, value: string) {
    setRows((current) =>
      current.map((row, index) => {
        if (index !== rowIndex) return row;
        const cells: PasteGridRow = [row.cells[0], row.cells[1], row.cells[2]];
        cells[col] = value;
        return { ...row, cells };
      }),
    );
    setError(null);
  }

  function handlePaste(
    e: ClipboardEvent<HTMLInputElement>,
    rowIndex: number,
    col: number,
  ) {
    const text = e.clipboardData.getData('text/plain');
    if (!hasStructuredPaste(text)) return;

    e.preventDefault();
    const nextCells = applyPasteToGrid(gridRows, rowIndex, col, text);
    setRows((current) => mergeRows(current, nextCells));
    // Keep a capped window; overflow uses “+N more rows”. Import still uses all rows.
    setVisibleLimit((limit) =>
      Math.max(
        PREVIEW_STEP,
        Math.min(
          nextCells.length,
          Math.max(limit, Math.min(rowIndex + PREVIEW_STEP, nextCells.length)),
        ),
      ),
    );
    setError(null);
    queueFocus(rowIndex, col);
  }

  function removeRow(rowIndex: number) {
    setRows((current) => {
      const next = current.filter((_, index) => index !== rowIndex);
      return next.length > 0 ? next : [makeRow()];
    });
    setError(null);
    const nextFocusRow = Math.max(0, rowIndex > 0 ? rowIndex - 1 : 0);
    queueFocus(nextFocusRow, 0);
  }

  function removeExistingRows() {
    setRows((current) => {
      const next = current.filter((row) => {
        const key = normalizePartNumber(row.cells[0]);
        return !key || !existingPartKeys.has(key);
      });
      return next.length > 0 ? next : [makeRow()];
    });
    setError(null);
    queueFocus(0, 0);
  }

  function moveFocus(row: number, col: number) {
    if (col < 0 || col >= PASTE_COL_COUNT || row < 0) return;

    if (row >= rowsRef.current.length) {
      setRows((current) => [...current, makeRow()]);
      setVisibleLimit((limit) => Math.max(limit, rowsRef.current.length + 1));
      queueFocus(row, col);
      return;
    }

    if (row >= visibleLimit) {
      setVisibleLimit((limit) =>
        Math.min(
          rowsRef.current.length,
          Math.max(limit + PREVIEW_STEP, row + 1),
        ),
      );
    }
    queueFocus(row, col);
  }

  function handleCellKeyDown(
    e: ReactKeyboardEvent<HTMLInputElement>,
    rowIndex: number,
    col: number,
  ) {
    if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) {
        if (col > 0) moveFocus(rowIndex, col - 1);
        else if (rowIndex > 0) moveFocus(rowIndex - 1, PASTE_COL_COUNT - 1);
      } else if (col < PASTE_COL_COUNT - 1) {
        moveFocus(rowIndex, col + 1);
      } else {
        moveFocus(rowIndex + 1, 0);
      }
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (rowIndex > 0) moveFocus(rowIndex - 1, col);
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      moveFocus(rowIndex + 1, col);
      return;
    }

    if (e.key === 'ArrowLeft') {
      const input = e.currentTarget;
      if (input.selectionStart === 0 && input.selectionEnd === 0) {
        if (col > 0) {
          e.preventDefault();
          moveFocus(rowIndex, col - 1);
        } else if (rowIndex > 0) {
          e.preventDefault();
          moveFocus(rowIndex - 1, PASTE_COL_COUNT - 1);
        }
      }
      return;
    }

    if (e.key === 'ArrowRight') {
      const input = e.currentTarget;
      const atEnd =
        input.selectionStart === input.value.length &&
        input.selectionEnd === input.value.length;
      if (!atEnd) return;
      e.preventDefault();
      if (col < PASTE_COL_COUNT - 1) moveFocus(rowIndex, col + 1);
      else moveFocus(rowIndex + 1, 0);
    }
  }

  async function handleImport() {
    if (!canImport) return;
    (document.activeElement as HTMLElement | null)?.blur?.();
    setBusy(true);
    setError(null);
    try {
      await onImport(drafts);
      onClose();
    } catch (err) {
      const message =
        err instanceof Error && err.message.trim()
          ? err.message
          : 'Import failed. Please try again.';
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      ref={overlayRef}
      className={styles.overlay}
      role="presentation"
      onClick={() => {
        if (!busy) onClose();
      }}
    >
      <div
        className={styles.dialog}
        role="dialog"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <div>
            <h2 id={titleId} className={styles.title}>
              Paste notes
            </h2>
            <p className={styles.subtitle}>
              Paste from Excel into any cell. Tabs make columns, new lines make
              rows — spaces stay inside the cell. Edit or remove rows before
              importing.
            </p>
          </div>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className={styles.body}>
          <div
            className={styles.grid}
            role="grid"
            aria-label="Notes to import"
            aria-colcount={PASTE_COL_COUNT}
            aria-rowcount={rows.length}
          >
            <div className={styles.headerRow} role="row">
              {PASTE_NOTE_COLUMNS.map((column) => (
                <div
                  key={column.key}
                  className={styles.columnHeader}
                  role="columnheader"
                >
                  {column.label}
                </div>
              ))}
              <span className={styles.headerSpacer} aria-hidden />
            </div>

            {visibleRows.map((row, rowIndex) => {
              const existsInLibrary = existingRowIndexes.has(rowIndex);
              return (
                <div
                  key={row.id}
                  className={`${styles.row}${existsInLibrary ? ` ${styles.rowExisting}` : ''}`}
                  role="row"
                  aria-label={
                    existsInLibrary
                      ? `Row ${rowIndex + 1}, part number already in library`
                      : undefined
                  }
                >
                  {PASTE_NOTE_COLUMNS.map((column, col) => (
                    <input
                      key={column.key}
                      ref={(el) => setCellRef(row.id, col, el)}
                      className={styles.cell}
                      role="gridcell"
                      type="text"
                      value={row.cells[col]}
                      title={row.cells[col] || undefined}
                      placeholder={col === 0 ? 'Part number' : undefined}
                      disabled={busy}
                      spellCheck={false}
                      aria-label={`${column.label}, row ${rowIndex + 1}${
                        existsInLibrary ? ', already in library' : ''
                      }`}
                      onChange={(e) => updateCell(rowIndex, col, e.target.value)}
                      onPaste={(e) => handlePaste(e, rowIndex, col)}
                      onKeyDown={(e) => handleCellKeyDown(e, rowIndex, col)}
                    />
                  ))}
                  <button
                    type="button"
                    className={styles.removeBtn}
                    onClick={() => removeRow(rowIndex)}
                    disabled={
                      busy || (rows.length === 1 && !row.cells.some(Boolean))
                    }
                    aria-label={`Remove row ${rowIndex + 1}`}
                    title="Remove row"
                  >
                    <X size={14} />
                  </button>
                </div>
              );
            })}
          </div>

          {(hiddenCount > 0 || existingCount > 0) && (
            <div className={styles.gridActions}>
              {hiddenCount > 0 && (
                <button
                  type="button"
                  className={styles.moreBtn}
                  onClick={() =>
                    setVisibleLimit((limit) =>
                      Math.min(rows.length, limit + PREVIEW_STEP),
                    )
                  }
                  disabled={busy}
                >
                  +{Math.min(PREVIEW_STEP, hiddenCount)} more row
                  {Math.min(PREVIEW_STEP, hiddenCount) === 1 ? '' : 's'}
                </button>
              )}
              {existingCount > 0 && (
                <button
                  type="button"
                  className={styles.removeExistingBtn}
                  onClick={removeExistingRows}
                  disabled={busy}
                >
                  Remove {existingCount} existing
                </button>
              )}
            </div>
          )}
        </div>

        <div className={styles.footer}>
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
          <p className={styles.meta}>
            {drafts.length === 0
              ? 'No part numbers yet'
              : `${drafts.length} note${drafts.length === 1 ? '' : 's'} will be created`}
            {existingCount > 0 && (
              <>
                <span className={styles.dot}>·</span>
                {existingCount} already in library
              </>
            )}
            <span className={styles.dot}>·</span>
            {filterSummary}
          </p>

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.cancel}
              onClick={onClose}
              disabled={busy}
            >
              Cancel
            </button>
            <button
              type="button"
              className={styles.importBtn}
              onClick={() => void handleImport()}
              disabled={!canImport}
            >
              {busy
                ? 'Importing…'
                : drafts.length > 0
                  ? `Import ${drafts.length}`
                  : 'Import'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

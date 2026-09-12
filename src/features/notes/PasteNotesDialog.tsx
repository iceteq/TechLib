import { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import {
  applyColumnPaste,
  clipboardHasMultipleColumns,
  MAX_IMPORT_ROWS,
  type PasteColumn,
  type PastedNoteDraft,
  splitColumnLines,
  zipPasteColumns,
} from '../../lib/parsePastedNotes';
import styles from './PasteNotesDialog.module.css';

interface PasteNotesDialogProps {
  filterSummary: string;
  onClose: () => void;
  onImport: (drafts: PastedNoteDraft[]) => Promise<void>;
}

type ColumnState = {
  titles: string[];
  descriptions: string[];
  specialCases: string[];
};

function linesToText(lines: string[]): string {
  return lines.join('\n');
}

export function PasteNotesDialog({
  filterSummary,
  onClose,
  onImport,
}: PasteNotesDialogProps) {
  const [columns, setColumns] = useState<ColumnState>({
    titles: [],
    descriptions: [],
    specialCases: [],
  });
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const descRef = useRef<HTMLTextAreaElement>(null);
  const specialRef = useRef<HTMLTextAreaElement>(null);
  const syncingScroll = useRef(false);

  const zipped = useMemo(
    () =>
      zipPasteColumns(
        columns.titles,
        columns.descriptions,
        columns.specialCases,
      ),
    [columns],
  );

  const canImport = zipped.drafts.length > 0 && !busy;
  const overCap = zipped.titleCount > MAX_IMPORT_ROWS;

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !busy) onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [busy, onClose]);

  function setColumnText(target: PasteColumn, text: string) {
    const lines = splitColumnLines(text);
    setColumns((current) => ({
      titles: target === 'title' ? lines : current.titles,
      descriptions: target === 'description' ? lines : current.descriptions,
      specialCases: target === 'specialCase' ? lines : current.specialCases,
    }));
    setHint(null);
  }

  function confirmReplace(target: PasteColumn): boolean {
    const existing =
      target === 'title'
        ? columns.titles
        : target === 'description'
          ? columns.descriptions
          : columns.specialCases;
    if (existing.some(Boolean)) {
      return window.confirm('Replace the existing values in this column?');
    }
    return true;
  }

  function handlePaste(
    target: PasteColumn,
    e: React.ClipboardEvent<HTMLTextAreaElement>,
  ) {
    const clipboard = e.clipboardData.getData('text');
    if (!clipboard) return;

    e.preventDefault();

    if (!confirmReplace(target)) return;

    const next = applyColumnPaste(target, clipboard, columns);
    setColumns({
      titles: next.titles,
      descriptions: next.descriptions,
      specialCases: next.specialCases,
    });

    if (target === 'title' && clipboardHasMultipleColumns(clipboard)) {
      setHint('Split multi-column paste into part number, description, and guidelines.');
    } else if (next.multiColumnIgnored) {
      setHint(
        'Clipboard had multiple columns — only the first column was pasted here. Paste into Part number to split all three.',
      );
    } else {
      setHint(null);
    }
  }

  function clearColumn(target: PasteColumn) {
    setColumns((current) => ({
      titles: target === 'title' ? [] : current.titles,
      descriptions: target === 'description' ? [] : current.descriptions,
      specialCases: target === 'specialCase' ? [] : current.specialCases,
    }));
    setHint(null);
  }

  function clearAll() {
    setColumns({ titles: [], descriptions: [], specialCases: [] });
    setHint(null);
  }

  function syncScroll(source: HTMLTextAreaElement) {
    if (syncingScroll.current) return;
    syncingScroll.current = true;
    const top = source.scrollTop;
    for (const el of [titleRef.current, descRef.current, specialRef.current]) {
      if (el && el !== source) el.scrollTop = top;
    }
    syncingScroll.current = false;
  }

  async function handleImport() {
    if (!canImport) return;
    setBusy(true);
    try {
      await onImport(zipped.drafts);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  const previewRows = zipped.preview.slice(0, 8);
  const previewMore = Math.max(0, zipped.preview.length - previewRows.length);

  return (
    <div
      className={styles.overlay}
      role="presentation"
      onClick={() => {
        if (!busy) onClose();
      }}
    >
      <div
        className={styles.dialog}
        role="dialog"
        aria-labelledby="paste-notes-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <div>
            <h2 id="paste-notes-title" className={styles.title}>
              Paste notes
            </h2>
            <p className={styles.subtitle}>
              Paste each Excel column separately, or paste multiple columns into
              Part number to fill all three at once.
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

        <div className={styles.columns}>
          <ColumnField
            id="paste-col-title"
            label="Part number"
            hint="Required"
            value={linesToText(columns.titles)}
            textareaRef={titleRef}
            disabled={busy}
            onChange={(text) => setColumnText('title', text)}
            onPaste={(e) => handlePaste('title', e)}
            onScroll={(e) => syncScroll(e.currentTarget)}
            onClear={() => clearColumn('title')}
            placeholder={'ABC123\nDEF456\nGHI789'}
          />
          <ColumnField
            id="paste-col-description"
            label="Description"
            hint="Optional"
            value={linesToText(columns.descriptions)}
            textareaRef={descRef}
            disabled={busy}
            onChange={(text) => setColumnText('description', text)}
            onPaste={(e) => handlePaste('description', e)}
            onScroll={(e) => syncScroll(e.currentTarget)}
            onClear={() => clearColumn('description')}
            placeholder={'Needs cable\nCrack on bezel'}
          />
          <ColumnField
            id="paste-col-special"
            label="Guidelines"
            hint="Optional"
            value={linesToText(columns.specialCases)}
            textareaRef={specialRef}
            disabled={busy}
            onChange={(text) => setColumnText('specialCase', text)}
            onPaste={(e) => handlePaste('specialCase', e)}
            onScroll={(e) => syncScroll(e.currentTarget)}
            onClear={() => clearColumn('specialCase')}
            placeholder={'Hold for parts\nShip as-is'}
          />
        </div>

        {(hint ||
          zipped.orphanDescription > 0 ||
          zipped.orphanSpecialCase > 0 ||
          overCap) && (
          <ul className={styles.warnings} aria-live="polite">
            {hint && <li>{hint}</li>}
            {zipped.orphanDescription > 0 && (
              <li>
                {zipped.orphanDescription} description
                {zipped.orphanDescription === 1 ? '' : 's'} on rows without a
                part number will be skipped.
              </li>
            )}
            {zipped.orphanSpecialCase > 0 && (
              <li>
                {zipped.orphanSpecialCase} guideline
                {zipped.orphanSpecialCase === 1 ? '' : 's'} on rows without a
                part number will be skipped.
              </li>
            )}
            {overCap && (
              <li>
                Only the first {MAX_IMPORT_ROWS} notes with part numbers will be
                imported.
              </li>
            )}
          </ul>
        )}

        {previewRows.length > 0 && (
          <div className={styles.previewWrap}>
            <p className={styles.previewLabel}>Preview</p>
            <div className={styles.previewTableWrap}>
              <table className={styles.previewTable}>
                <thead>
                  <tr>
                    <th scope="col">#</th>
                    <th scope="col">Part number</th>
                    <th scope="col">Description</th>
                    <th scope="col">Guidelines</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, index) => (
                    <tr
                      key={`${index}-${row.title}`}
                      className={row.importable ? undefined : styles.skipped}
                    >
                      <td>{index + 1}</td>
                      <td>{row.title || '—'}</td>
                      <td>{row.description || '—'}</td>
                      <td>{row.specialCase || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {previewMore > 0 && (
              <p className={styles.previewMore}>
                and {previewMore} more row{previewMore === 1 ? '' : 's'}
              </p>
            )}
          </div>
        )}

        <p className={styles.meta}>
          {zipped.drafts.length === 0
            ? 'No part numbers yet'
            : `${zipped.drafts.length} note${
                zipped.drafts.length === 1 ? '' : 's'
              } will be created`}
          <span className={styles.dot}>·</span>
          {filterSummary}
          {(columns.titles.length > 0 ||
            columns.descriptions.length > 0 ||
            columns.specialCases.length > 0) && (
            <>
              <span className={styles.dot}>·</span>
              <button
                type="button"
                className={styles.clearAll}
                onClick={clearAll}
                disabled={busy}
              >
                Clear all
              </button>
            </>
          )}
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
              : zipped.drafts.length > 0
                ? `Import ${zipped.drafts.length}`
                : 'Import'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ColumnField({
  id,
  label,
  hint,
  value,
  textareaRef,
  disabled,
  placeholder,
  onChange,
  onPaste,
  onScroll,
  onClear,
}: {
  id: string;
  label: string;
  hint: string;
  value: string;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  disabled: boolean;
  placeholder: string;
  onChange: (text: string) => void;
  onPaste: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
  onScroll: (e: React.UIEvent<HTMLTextAreaElement>) => void;
  onClear: () => void;
}) {
  return (
    <div className={styles.column}>
      <div className={styles.columnHeader}>
        <label className={styles.label} htmlFor={id}>
          {label}
          <span className={styles.columnHint}>{hint}</span>
        </label>
        {value.length > 0 && (
          <button
            type="button"
            className={styles.clearCol}
            onClick={onClear}
            disabled={disabled}
          >
            Clear
          </button>
        )}
      </div>
      <textarea
        id={id}
        ref={textareaRef}
        className={styles.textarea}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onPaste={onPaste}
        onScroll={onScroll}
        placeholder={placeholder}
        rows={10}
        disabled={disabled}
        spellCheck={false}
      />
    </div>
  );
}

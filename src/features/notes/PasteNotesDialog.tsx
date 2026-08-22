import { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { parsePastedNotes } from '../../lib/parsePastedNotes';
import styles from './PasteNotesDialog.module.css';

interface PasteNotesDialogProps {
  filterSummary: string;
  onClose: () => void;
  onImport: (text: string) => Promise<void>;
}

export function PasteNotesDialog({
  filterSummary,
  onClose,
  onImport,
}: PasteNotesDialogProps) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const drafts = useMemo(() => parsePastedNotes(text), [text]);
  const canImport = drafts.length > 0 && !busy;

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !busy) onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [busy, onClose]);

  async function handleImport() {
    if (!canImport) return;
    setBusy(true);
    try {
      await onImport(text);
      onClose();
    } finally {
      setBusy(false);
    }
  }

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
              One note per line from Excel. Columns: barcode, description
              (optional), guidelines (optional).
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

        <label className={styles.label} htmlFor="paste-notes-input">
          Paste here
        </label>
        <textarea
          id="paste-notes-input"
          ref={textareaRef}
          className={styles.textarea}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={'ABC123\nDEF456\tNeeds new cable\nGHI789\tCrack on bezel\tHold for parts'}
          rows={10}
          disabled={busy}
          spellCheck={false}
        />

        <p className={styles.meta}>
          {drafts.length === 0
            ? 'No barcodes yet'
            : `${drafts.length} note${drafts.length === 1 ? '' : 's'} will be created`}
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
            {busy ? 'Importing…' : 'Import'}
          </button>
        </div>
      </div>
    </div>
  );
}

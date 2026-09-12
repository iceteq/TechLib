import { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import {
  parsePastedNotes,
  type PastedNoteDraft,
} from '../../lib/parsePastedNotes';
import styles from './PasteNotesDialog.module.css';

interface PasteNotesDialogProps {
  filterSummary: string;
  onClose: () => void;
  onImport: (drafts: PastedNoteDraft[]) => Promise<void>;
}

function secondaryLine(draft: PastedNoteDraft): string {
  return [draft.description, draft.specialCase].filter(Boolean).join(' · ');
}

export function PasteNotesDialog({
  filterSummary,
  onClose,
  onImport,
}: PasteNotesDialogProps) {
  const [text, setText] = useState('');
  const [removed, setRemoved] = useState<Set<number>>(() => new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const parsed = useMemo(() => parsePastedNotes(text), [text]);
  const drafts = useMemo(
    () => parsed.filter((_, index) => !removed.has(index)),
    [parsed, removed],
  );
  const canImport = drafts.length > 0 && !busy;

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

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

  function handleTextChange(next: string) {
    setText(next);
    setRemoved(new Set());
    setError(null);
  }

  function removeDraft(index: number) {
    setRemoved((current) => {
      const next = new Set(current);
      next.add(index);
      return next;
    });
    setError(null);
  }

  function restoreAll() {
    setRemoved(new Set());
    setError(null);
  }

  async function handleImport() {
    if (!canImport) return;
    // Dismiss the soft keyboard so the first tap isn't eaten on mobile.
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
        aria-labelledby="paste-notes-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <div>
            <h2 id="paste-notes-title" className={styles.title}>
              Paste notes
            </h2>
            <p className={styles.subtitle}>
              One note per line from Excel. Columns: part number, description
              (optional), guidelines (optional). Remove any row from the preview
              before importing.
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
          <label className={styles.label} htmlFor="paste-notes-input">
            Paste here
          </label>
          <textarea
            id="paste-notes-input"
            ref={textareaRef}
            className={styles.textarea}
            value={text}
            onChange={(e) => handleTextChange(e.target.value)}
            placeholder={
              'ABC123\nDEF456\tNeeds new cable\nGHI789\tCrack on bezel\tHold for parts'
            }
            rows={6}
            disabled={busy}
            spellCheck={false}
          />

          {parsed.length > 0 && (
            <div className={styles.previewWrap}>
              <div className={styles.previewHeader}>
                <p className={styles.previewLabel}>Preview</p>
                {removed.size > 0 && (
                  <button
                    type="button"
                    className={styles.restoreBtn}
                    onClick={restoreAll}
                    disabled={busy}
                  >
                    Restore all
                  </button>
                )}
              </div>
              <ul className={styles.previewList} aria-label="Notes to import">
                {parsed.map((draft, index) => {
                  if (removed.has(index)) return null;
                  const detail = secondaryLine(draft);
                  return (
                    <li
                      key={`${index}-${draft.title}`}
                      className={styles.previewItem}
                    >
                      <div className={styles.previewText}>
                        <span className={styles.previewTitle}>{draft.title}</span>
                        {detail ? (
                          <span className={styles.previewDetail}>{detail}</span>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        className={styles.removeBtn}
                        onClick={() => removeDraft(index)}
                        disabled={busy}
                        aria-label={`Remove ${draft.title}`}
                        title="Remove from import"
                      >
                        <X size={14} />
                      </button>
                    </li>
                  );
                })}
              </ul>
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
              ? parsed.length > 0
                ? 'All rows removed — nothing to import'
                : 'No part numbers yet'
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

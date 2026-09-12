import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { dispositionColorVars } from '../../lib/dispositions';
import {
  GUIDELINE_WHEN_PRESETS,
  normalizeGuidelineLines,
  previewGuidelineUpsert,
} from '../../lib/guidelineLines';
import { DISPOSITIONS } from '../../lib/types';
import type {
  GuidelineAction,
  GuidelineLine,
  NoteWithUrls,
} from '../../lib/types';
import { GuidelineLinesEditor } from './GuidelineLinesEditor';
import styles from './BulkGuidelineDialog.module.css';

const ACTIONS = DISPOSITIONS.filter(
  (d): d is { id: GuidelineAction; label: string; short: string } =>
    d.id !== 'none',
);

export type BulkGuidelineMode = 'upsertByWhen' | 'replaceAll';

export type BulkGuidelineEdit =
  | {
      mode: 'upsertByWhen';
      when: string;
      action: GuidelineAction;
      how: string;
    }
  | {
      mode: 'replaceAll';
      lines: GuidelineLine[];
    };

interface BulkGuidelineDialogProps {
  notes: NoteWithUrls[];
  onApply: (edit: BulkGuidelineEdit) => void;
  onClose: () => void;
}

export function BulkGuidelineDialog({
  notes,
  onApply,
  onClose,
}: BulkGuidelineDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const [mode, setMode] = useState<BulkGuidelineMode>('upsertByWhen');
  const [when, setWhen] = useState('Uninstall');
  const [action, setAction] = useState<GuidelineAction>('stock');
  const [how, setHow] = useState('');
  const [replaceLines, setReplaceLines] = useState<GuidelineLine[]>([]);

  const preview = useMemo(
    () => previewGuidelineUpsert(notes, when),
    [notes, when],
  );
  const actionColors = dispositionColorVars(action);
  const count = notes.length;
  const noteWord = count === 1 ? 'note' : 'notes';

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

  function apply() {
    if (mode === 'upsertByWhen') {
      if (!when.trim()) return;
      onApply({ mode: 'upsertByWhen', when: when.trim(), action, how });
      return;
    }
    onApply({
      mode: 'replaceAll',
      lines: normalizeGuidelineLines(replaceLines),
    });
  }

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
            <p className={styles.eyebrow}>Bulk guideline</p>
            <h2 id={titleId} className={styles.title}>
              {count} {noteWord}
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

        <div className={styles.body}>
          <div className={styles.modes} role="tablist" aria-label="Edit mode">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'upsertByWhen'}
              className={`${styles.mode} ${
                mode === 'upsertByWhen' ? styles.modeActive : ''
              }`}
              onClick={() => setMode('upsertByWhen')}
            >
              Update / add one When
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'replaceAll'}
              className={`${styles.mode} ${
                mode === 'replaceAll' ? styles.modeActive : ''
              }`}
              onClick={() => setMode('replaceAll')}
            >
              Replace all rules
            </button>
          </div>

          {mode === 'upsertByWhen' ? (
            <div className={styles.upsert}>
              <p className={styles.hint}>
                Change only the matching When line on each note. Other rules
                stay. If that When is missing, it is added.
              </p>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>When</span>
                <input
                  className={styles.input}
                  list="bulk-guideline-when-presets"
                  value={when}
                  onChange={(e) => setWhen(e.target.value)}
                  placeholder="Uninstall, Broken…"
                />
              </label>
              <datalist id="bulk-guideline-when-presets">
                {GUIDELINE_WHEN_PRESETS.map((preset) => (
                  <option key={preset} value={preset} />
                ))}
              </datalist>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Then</span>
                <select
                  className={styles.select}
                  value={action}
                  onChange={(e) =>
                    setAction(e.target.value as GuidelineAction)
                  }
                  style={
                    actionColors
                      ? {
                          color: actionColors.fg,
                          borderColor: actionColors.border,
                          background: actionColors.bg,
                        }
                      : undefined
                  }
                >
                  {ACTIONS.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.short}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>How (optional)</span>
                <input
                  className={styles.input}
                  value={how}
                  onChange={(e) => setHow(e.target.value)}
                  placeholder="e.g. log serial → customer bin"
                />
              </label>
              <p className={styles.preview} aria-live="polite">
                {when.trim()
                  ? `Will update “${when.trim()}” on ${preview.updated} ${
                      preview.updated === 1 ? 'note' : 'notes'
                    }, add it on ${preview.added}.`
                  : 'Enter a When condition to preview.'}
              </p>
            </div>
          ) : (
            <div className={styles.replace}>
              <p className={styles.hintWarn}>
                Replaces every guideline rule on the selected notes.
              </p>
              <GuidelineLinesEditor
                lines={replaceLines}
                onChange={setReplaceLines}
                compact
              />
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <button type="button" className={styles.cancel} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={styles.apply}
            onClick={apply}
            disabled={mode === 'upsertByWhen' && !when.trim()}
          >
            Apply to {count} {noteWord}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(dialog, document.body);
}

import { Plus, Trash2 } from 'lucide-react';
import { dispositionColorVars } from '../../lib/dispositions';
import {
  GUIDELINE_WHEN_PRESETS,
  newGuidelineLine,
  normalizeGuidelineLines,
} from '../../lib/guidelineLines';
import { DISPOSITIONS } from '../../lib/types';
import type { GuidelineAction, GuidelineLine } from '../../lib/types';
import styles from './GuidelineLinesEditor.module.css';

const ACTIONS = DISPOSITIONS.filter(
  (d): d is { id: GuidelineAction; label: string; short: string } =>
    d.id !== 'none',
);

interface GuidelineLinesEditorProps {
  lines: GuidelineLine[];
  onChange: (lines: GuidelineLine[]) => void;
  /** Compact layout for assign modal. */
  compact?: boolean;
}

export function GuidelineLinesEditor({
  lines,
  onChange,
  compact = false,
}: GuidelineLinesEditorProps) {
  const normalized = normalizeGuidelineLines(lines);

  function updateLine(id: string, patch: Partial<GuidelineLine>) {
    onChange(
      normalized.map((line) =>
        line.id === id ? { ...line, ...patch } : line,
      ),
    );
  }

  function removeLine(id: string) {
    onChange(normalized.filter((line) => line.id !== id));
  }

  function addLine() {
    onChange([...normalized, newGuidelineLine({ when: 'Broken' })]);
  }

  return (
    <div className={compact ? styles.compact : styles.wrap}>
      {normalized.length === 0 && (
        <p className={styles.empty}>No rules yet — add When → Then lines.</p>
      )}
      <ul className={styles.list}>
        {normalized.map((line) => {
          const colors = dispositionColorVars(line.action);
          return (
            <li key={line.id} className={styles.row}>
              <div className={styles.whenThen}>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>When</span>
                  <input
                    className={styles.input}
                    list="guideline-when-presets"
                    value={line.when}
                    onChange={(e) =>
                      updateLine(line.id, { when: e.target.value })
                    }
                    placeholder="Broken, Uninstall…"
                    aria-label="When"
                  />
                </label>
                <span className={styles.arrow} aria-hidden>
                  →
                </span>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Then</span>
                  <select
                    className={styles.select}
                    value={line.action}
                    onChange={(e) =>
                      updateLine(line.id, {
                        action: e.target.value as GuidelineAction,
                      })
                    }
                    style={
                      colors
                        ? {
                            color: colors.fg,
                            borderColor: colors.border,
                            background: colors.bg,
                          }
                        : undefined
                    }
                    aria-label="Then"
                  >
                    {ACTIONS.map((action) => (
                      <option key={action.id} value={action.id}>
                        {action.short}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className={styles.remove}
                  onClick={() => removeLine(line.id)}
                  aria-label="Remove rule"
                  title="Remove rule"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <label className={styles.howField}>
                <span className={styles.fieldLabel}>How (optional)</span>
                <input
                  className={styles.input}
                  value={line.how}
                  onChange={(e) => updateLine(line.id, { how: e.target.value })}
                  placeholder="e.g. log serial → customer bin"
                  aria-label="How"
                />
              </label>
            </li>
          );
        })}
      </ul>
      <datalist id="guideline-when-presets">
        {GUIDELINE_WHEN_PRESETS.map((preset) => (
          <option key={preset} value={preset} />
        ))}
      </datalist>
      <button type="button" className={styles.add} onClick={addLine}>
        <Plus size={14} aria-hidden />
        Add rule
      </button>
    </div>
  );
}

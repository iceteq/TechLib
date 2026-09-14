import { dispositionColorVars } from '../../lib/dispositions';
import { resolveGuidelineLines } from '../../lib/guidelineLines';
import { DISPOSITIONS } from '../../lib/types';
import type { GuidelineLine, NoteDisposition } from '../../lib/types';
import styles from './GuidelineLinesList.module.css';

interface GuidelineLinesListProps {
  lines?: GuidelineLine[] | null;
  disposition?: NoteDisposition | null;
  onClick?: () => void;
  disabled?: boolean;
  expanded?: boolean;
  /** Soften action pills so wall photos stay dominant. */
  quiet?: boolean;
}

export function GuidelineLinesList({
  lines,
  disposition,
  onClick,
  disabled = false,
  expanded = false,
  quiet = false,
}: GuidelineLinesListProps) {
  const resolved = resolveGuidelineLines({
    guidelineLines: lines,
    disposition,
  });

  if (resolved.length === 0) {
    if (!onClick) {
      return (
        <span className={`${styles.missing} ${quiet ? styles.quiet : ''}`}>
          No guideline
        </span>
      );
    }
    return (
      <button
        type="button"
        className={`${styles.missingBtn} ${quiet ? styles.quiet : ''}`}
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        aria-haspopup="dialog"
        aria-expanded={expanded}
      >
        No guideline
      </button>
    );
  }

  const content = (
    <ul className={`${styles.list} ${quiet ? styles.quiet : ''}`}>
      {resolved.map((line) => {
        const action = DISPOSITIONS.find((d) => d.id === line.action);
        const colors = quiet ? null : dispositionColorVars(line.action);
        return (
          <li key={line.id} className={styles.item}>
            <span className={styles.when}>{line.when}</span>
            <span className={styles.arrow} aria-hidden>
              →
            </span>
            <span
              className={styles.action}
              style={
                colors
                  ? {
                      background: colors.bg,
                      color: colors.fg,
                      borderColor: colors.border,
                    }
                  : undefined
              }
            >
              {action?.short ?? line.action}
            </span>
            {line.how.trim() ? (
              <span className={styles.how} title={line.how}>
                {line.how}
              </span>
            ) : null}
          </li>
        );
      })}
    </ul>
  );

  if (!onClick) return content;

  return (
    <button
      type="button"
      className={`${styles.button} ${quiet ? styles.quiet : ''}`}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-haspopup="dialog"
      aria-expanded={expanded}
      aria-label="Edit guideline"
    >
      {content}
    </button>
  );
}

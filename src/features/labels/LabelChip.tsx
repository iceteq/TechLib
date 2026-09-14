import { highlightMatches } from '../../lib/highlightMatch';
import styles from './LabelChip.module.css';

interface LabelChipProps {
  name: string;
  /** When set, matching characters are highlighted. */
  highlightQuery?: string;
  /** Quieter chip for image-first wall cards. */
  compact?: boolean;
  onRemove?: () => void;
}

export function LabelChip({
  name,
  highlightQuery,
  compact = false,
  onRemove,
}: LabelChipProps) {
  return (
    <span className={`${styles.chip} ${compact ? styles.compact : ''}`}>
      {highlightQuery ? highlightMatches(name, highlightQuery) : name}
      {onRemove && (
        <button
          type="button"
          className={styles.remove}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          aria-label={`Remove label ${name}`}
        >
          ×
        </button>
      )}
    </span>
  );
}

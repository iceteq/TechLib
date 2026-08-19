import styles from './LabelChip.module.css';

interface LabelChipProps {
  name: string;
  onRemove?: () => void;
}

export function LabelChip({ name, onRemove }: LabelChipProps) {
  return (
    <span className={styles.chip}>
      {name}
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

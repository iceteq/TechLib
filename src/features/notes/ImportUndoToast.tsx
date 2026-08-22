import { useEffect } from 'react';
import { X } from 'lucide-react';
import styles from './ImportUndoToast.module.css';

interface ImportUndoToastProps {
  count: number;
  onUndo: () => void;
  onDismiss: () => void;
  /** Auto-dismiss after this many ms. */
  durationMs?: number;
}

export function ImportUndoToast({
  count,
  onUndo,
  onDismiss,
  durationMs = 20000,
}: ImportUndoToastProps) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, durationMs);
    return () => window.clearTimeout(timer);
  }, [count, durationMs, onDismiss]);

  return (
    <div className={styles.toast} role="status" aria-live="polite">
      <p className={styles.message}>
        Imported {count} note{count === 1 ? '' : 's'}
      </p>
      <button type="button" className={styles.undo} onClick={onUndo}>
        Undo
      </button>
      <button
        type="button"
        className={styles.dismiss}
        onClick={onDismiss}
        aria-label="Dismiss"
      >
        <X size={16} />
      </button>
    </div>
  );
}

import { useEffect } from 'react';
import { X } from 'lucide-react';
import styles from './UndoToast.module.css';

interface UndoToastProps {
  message: string;
  onUndo: () => void;
  onDismiss: () => void;
  /** Auto-dismiss after this many ms. */
  durationMs?: number;
}

export function UndoToast({
  message,
  onUndo,
  onDismiss,
  durationMs = 20000,
}: UndoToastProps) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, durationMs);
    return () => window.clearTimeout(timer);
  }, [message, durationMs, onDismiss]);

  return (
    <div className={styles.toast} role="status" aria-live="polite">
      <p className={styles.message}>{message}</p>
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

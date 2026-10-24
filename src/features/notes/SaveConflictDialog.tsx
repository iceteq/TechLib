import { createPortal } from 'react-dom';
import styles from './SaveConflictDialog.module.css';

interface SaveConflictDialogProps {
  holderHint?: string | null;
  busy?: boolean;
  onReload: () => void;
  onKeepMine: () => void;
  onDismiss: () => void;
}

export function SaveConflictDialog({
  holderHint = null,
  busy = false,
  onReload,
  onKeepMine,
  onDismiss,
}: SaveConflictDialogProps) {
  return createPortal(
    <div
      className={styles.overlay}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onDismiss();
      }}
    >
      <div
        className={styles.dialog}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="save-conflict-title"
        aria-describedby="save-conflict-body"
      >
        <h2 id="save-conflict-title" className={styles.title}>
          Updated by someone else
        </h2>
        <p id="save-conflict-body" className={styles.body}>
          {holderHint
            ? `This note changed while you were editing (last seen: ${holderHint}). `
            : 'This note changed while you were editing. '}
          Reload their version, or keep yours and overwrite.
        </p>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.secondary}
            disabled={busy}
            onClick={onDismiss}
          >
            Cancel
          </button>
          <button
            type="button"
            className={styles.secondary}
            disabled={busy}
            onClick={onReload}
          >
            Reload
          </button>
          <button
            type="button"
            className={styles.primary}
            disabled={busy}
            onClick={onKeepMine}
          >
            {busy ? 'Saving…' : 'Keep mine'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

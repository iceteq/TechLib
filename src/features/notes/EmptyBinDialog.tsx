import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { EMPTY_BIN_PASSWORD } from '../../lib/config';
import styles from './EmptyBinDialog.module.css';

interface EmptyBinDialogProps {
  /** How many notes will be permanently removed. */
  count: number;
  busy?: boolean;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}

export function EmptyBinDialog({
  count,
  busy = false,
  onConfirm,
  onClose,
}: EmptyBinDialogProps) {
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (password !== EMPTY_BIN_PASSWORD) {
      setError('Incorrect password');
      return;
    }
    setError(null);
    await onConfirm();
  }

  const noteWord = count === 1 ? 'note' : 'notes';

  return (
    <div className={styles.backdrop} role="presentation" onClick={onClose}>
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <header className={styles.header}>
          <div>
            <h2 id={titleId} className={styles.title}>
              Delete forever
            </h2>
            <p className={styles.sub}>
              Permanently remove {count} {noteWord} from the bin. This cannot be
              undone.
            </p>
          </div>
          <button
            type="button"
            className={styles.close}
            onClick={onClose}
            aria-label="Close"
            disabled={busy}
          >
            <X size={18} />
          </button>
        </header>

        <form className={styles.form} onSubmit={(e) => void submit(e)}>
          <label className={styles.label} htmlFor="empty-bin-password">
            Admin password
          </label>
          <input
            ref={inputRef}
            id="empty-bin-password"
            type="password"
            className={styles.input}
            autoComplete="current-password"
            value={password}
            disabled={busy}
            onChange={(e) => {
              setPassword(e.target.value);
              if (error) setError(null);
            }}
          />
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.cancel}
              onClick={onClose}
              disabled={busy}
            >
              Cancel
            </button>
            <button type="submit" className={styles.danger} disabled={busy}>
              {busy ? 'Deleting…' : 'Delete forever'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

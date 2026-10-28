import { useState } from 'react';
import { X } from 'lucide-react';
import styles from '../auth/MembersDialog.module.css';

interface EmptyBinDialogProps {
  count: number;
  /** When false (local mode), skip the password field. */
  requirePassword: boolean;
  onConfirm: (password: string) => Promise<void>;
  onClose: () => void;
}

export function EmptyBinDialog({
  count,
  requirePassword,
  onConfirm,
  onClose,
}: EmptyBinDialogProps) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (requirePassword && !password) {
      setError('Enter your password to empty the bin');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onConfirm(password);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not empty the bin');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.backdrop} role="presentation" onClick={onClose}>
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="empty-bin-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <div>
            <h2 id="empty-bin-title" className={styles.title}>
              Empty bin?
            </h2>
            <p className={styles.sub}>
              Permanently delete {count} note{count === 1 ? '' : 's'}. This
              cannot be undone.
            </p>
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

        <form onSubmit={(e) => void submit(e)}>
          {requirePassword && (
            <label className={styles.sub} style={{ display: 'block' }}>
              Confirm with your account password
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={busy}
                style={{
                  display: 'block',
                  width: '100%',
                  marginTop: '0.45rem',
                  marginBottom: '0.85rem',
                  padding: '0.55rem 0.65rem',
                  borderRadius: 'calc(var(--radius) - 2px)',
                  border: '1px solid var(--border)',
                  background: 'var(--bg)',
                  color: 'var(--text)',
                  font: 'inherit',
                }}
              />
            </label>
          )}
          {error && (
            <p className={styles.sub} style={{ color: 'var(--danger, #b42318)' }}>
              {error}
            </p>
          )}
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <button
              type="button"
              className={styles.close}
              style={{ width: 'auto', padding: '0.45rem 0.75rem', borderRadius: '8px' }}
              onClick={onClose}
              disabled={busy}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy || (requirePassword && !password)}
              style={{
                padding: '0.45rem 0.85rem',
                borderRadius: '8px',
                border: 'none',
                background: '#b42318',
                color: '#fff',
                font: 'inherit',
                fontWeight: 600,
                cursor: busy ? 'wait' : 'pointer',
              }}
            >
              {busy ? 'Emptying…' : 'Empty bin'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

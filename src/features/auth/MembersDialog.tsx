import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import {
  listWorkspaceMembers,
  setMemberRole,
  type WorkspaceMember,
  type WorkspaceRole,
} from '../../lib/workspace';
import styles from './MembersDialog.module.css';

interface MembersDialogProps {
  currentUserId: string;
  onClose: () => void;
  onRoleChanged?: () => void;
}

const ROLES: WorkspaceRole[] = ['viewer', 'editor', 'admin'];

export function MembersDialog({
  currentUserId,
  onClose,
  onRoleChanged,
}: MembersDialogProps) {
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      setMembers(await listWorkspaceMembers());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load members');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function changeRole(userId: string, role: WorkspaceRole) {
    setBusyId(userId);
    setError(null);
    try {
      await setMemberRole(userId, role);
      await refresh();
      onRoleChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update role');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className={styles.backdrop} role="presentation" onClick={onClose}>
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal
        aria-labelledby="members-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className={styles.header}>
          <div>
            <h2 id="members-title" className={styles.title}>
              Members
            </h2>
            <p className={styles.sub}>
              New accounts join as viewers. Promote people to edit the library.
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
        </header>

        {loading ? (
          <p className={styles.muted}>Loading…</p>
        ) : (
          <ul className={styles.list}>
            {members.map((member) => (
              <li key={member.userId} className={styles.row}>
                <div className={styles.identity}>
                  <span className={styles.email}>
                    {member.email || member.userId}
                    {member.userId === currentUserId ? ' (you)' : ''}
                  </span>
                  <span className={styles.meta}>{member.role}</span>
                </div>
                <label className={styles.roleLabel}>
                  <span className={styles.srOnly}>Role</span>
                  <select
                    className={styles.select}
                    value={member.role}
                    disabled={busyId === member.userId}
                    onChange={(e) =>
                      void changeRole(
                        member.userId,
                        e.target.value as WorkspaceRole,
                      )
                    }
                  >
                    {ROLES.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </label>
              </li>
            ))}
          </ul>
        )}

        {error && <p className={styles.error}>{error}</p>}
      </div>
    </div>
  );
}

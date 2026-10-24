import type { OnlineMember } from '../../lib/useLibraryPresence';
import styles from './PresenceStrip.module.css';

interface PresenceStripProps {
  members: OnlineMember[];
}

/** Quiet “who’s here” line under the topbar. Hidden when alone / empty. */
export function PresenceStrip({ members }: PresenceStripProps) {
  if (members.length === 0) return null;

  const others = members.filter((m) => !m.mine);
  // Solo: no strip — presence only matters when someone else is around.
  if (others.length === 0) return null;

  const names = members.map((m) => m.label);
  const shown = names.slice(0, 6);
  const overflow = names.length - shown.length;
  const label =
    overflow > 0
      ? `${shown.join(' · ')} · +${overflow}`
      : shown.join(' · ');

  return (
    <div
      className={styles.strip}
      role="status"
      aria-live="polite"
      aria-label={`${members.length} online: ${names.join(', ')}`}
      title={names.join(', ')}
    >
      <span className={styles.dot} aria-hidden />
      <span className={styles.count}>
        {members.length} online
      </span>
      <span className={styles.sep} aria-hidden>
        ·
      </span>
      <span className={styles.names}>{label}</span>
    </div>
  );
}

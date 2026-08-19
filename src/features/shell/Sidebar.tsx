import { Lightbulb, Tag } from 'lucide-react';
import type { Label } from '../../lib/types';
import styles from './Sidebar.module.css';

interface SidebarProps {
  labels: Label[];
  activeFilter: string | null;
  onSelectAll: () => void;
  onSelectLabel: (labelId: string) => void;
}

export function Sidebar({
  labels,
  activeFilter,
  onSelectAll,
  onSelectLabel,
}: SidebarProps) {
  return (
    <nav className={styles.nav} aria-label="Notes navigation">
      <button
        type="button"
        className={`${styles.item} ${activeFilter === null ? styles.active : ''}`}
        onClick={onSelectAll}
      >
        <Lightbulb size={18} />
        <span>All notes</span>
      </button>

      <div className={styles.section}>
        <p className={styles.sectionTitle}>Labels</p>
        {labels.length === 0 ? (
          <p className={styles.empty}>Labels you add to notes show up here.</p>
        ) : (
          <ul className={styles.list}>
            {labels.map((label) => (
              <li key={label.id}>
                <button
                  type="button"
                  className={`${styles.item} ${
                    activeFilter === label.id ? styles.active : ''
                  }`}
                  onClick={() => onSelectLabel(label.id)}
                >
                  <Tag size={18} />
                  <span>{label.name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </nav>
  );
}

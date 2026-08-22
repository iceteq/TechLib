import { Archive, Lightbulb, Tag } from 'lucide-react';
import type { Label, NotesView } from '../../lib/types';
import styles from './Sidebar.module.css';

interface SidebarProps {
  labels: Label[];
  view: NotesView;
  activeLabelId: string | null;
  onSelectNotes: () => void;
  onSelectArchive: () => void;
  onSelectLabel: (labelId: string) => void;
}

export function Sidebar({
  labels,
  view,
  activeLabelId,
  onSelectNotes,
  onSelectArchive,
  onSelectLabel,
}: SidebarProps) {
  return (
    <nav className={styles.nav} aria-label="Notes navigation">
      <button
        type="button"
        className={`${styles.item} ${
          view === 'notes' && activeLabelId === null ? styles.active : ''
        }`}
        onClick={onSelectNotes}
      >
        <Lightbulb size={18} />
        <span>All notes</span>
      </button>

      <button
        type="button"
        className={`${styles.item} ${view === 'archive' ? styles.active : ''}`}
        onClick={onSelectArchive}
      >
        <Archive size={18} />
        <span>Archive</span>
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
                    view === 'notes' && activeLabelId === label.id
                      ? styles.active
                      : ''
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

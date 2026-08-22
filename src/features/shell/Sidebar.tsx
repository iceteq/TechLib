import { Archive, Lightbulb, Package, Tag, Trash2, Wrench } from 'lucide-react';
import type { Label, NoteDisposition, NotesView } from '../../lib/types';
import styles from './Sidebar.module.css';

interface SidebarProps {
  labels: Label[];
  view: NotesView;
  activeLabelId: string | null;
  activeDisposition: NoteDisposition | null;
  onSelectNotes: () => void;
  onSelectArchive: () => void;
  onSelectDisposition: (disposition: NoteDisposition) => void;
  onSelectLabel: (labelId: string) => void;
}

export function Sidebar({
  labels,
  view,
  activeLabelId,
  activeDisposition,
  onSelectNotes,
  onSelectArchive,
  onSelectDisposition,
  onSelectLabel,
}: SidebarProps) {
  return (
    <nav className={styles.nav} aria-label="Notes navigation">
      <button
        type="button"
        className={`${styles.item} ${
          view === 'notes' && activeLabelId === null && activeDisposition === null
            ? styles.active
            : ''
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
        <p className={styles.sectionTitle}>Status</p>
        <button
          type="button"
          className={`${styles.item} ${
            view === 'notes' && activeDisposition === 'stock' ? styles.active : ''
          }`}
          onClick={() => onSelectDisposition('stock')}
        >
          <Package size={18} />
          <span>Stock</span>
        </button>
        <button
          type="button"
          className={`${styles.item} ${
            view === 'notes' && activeDisposition === 'repair' ? styles.active : ''
          }`}
          onClick={() => onSelectDisposition('repair')}
        >
          <Wrench size={18} />
          <span>Repair</span>
        </button>
        <button
          type="button"
          className={`${styles.item} ${
            view === 'notes' && activeDisposition === 'scrap' ? styles.active : ''
          }`}
          onClick={() => onSelectDisposition('scrap')}
        >
          <Trash2 size={18} />
          <span>Throw away</span>
        </button>
      </div>

      <div className={styles.section}>
        <p className={styles.sectionTitle}>Labels</p>
        {labels.length === 0 ? (
          <p className={styles.empty}>Type # in a note to add labels.</p>
        ) : (
          <ul className={styles.list}>
            {labels.map((label) => (
              <li key={label.id}>
                <button
                  type="button"
                  className={`${styles.item} ${
                    view === 'notes' &&
                    activeLabelId === label.id &&
                    activeDisposition === null
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

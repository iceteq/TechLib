import {
  AlertCircle,
  Archive,
  Cable,
  Cpu,
  Lightbulb,
  LogOut,
  Monitor,
  Network,
  Package,
  Printer,
  ScanBarcode,
  ShoppingCart,
  Tag,
  Trash2,
  Wrench,
} from 'lucide-react';
import type {
  Label,
  NoteCategory,
  NoteDisposition,
  NotesView,
} from '../../lib/types';
import styles from './Sidebar.module.css';

interface SidebarProps {
  labels: Label[];
  view: NotesView;
  activeLabelId: string | null;
  activeDisposition: NoteDisposition | null;
  activeCategory: NoteCategory | null;
  specialCasesOnly: boolean;
  cartCount: number;
  onSelectNotes: () => void;
  onSelectArchive: () => void;
  onSelectCart: () => void;
  onSelectDisposition: (disposition: NoteDisposition) => void;
  onSelectCategory: (category: NoteCategory) => void;
  onToggleSpecialCases: () => void;
  onSelectLabel: (labelId: string) => void;
  onSignOut?: () => void;
}

export function Sidebar({
  labels,
  view,
  activeLabelId,
  activeDisposition,
  activeCategory,
  specialCasesOnly,
  cartCount,
  onSelectNotes,
  onSelectArchive,
  onSelectCart,
  onSelectDisposition,
  onSelectCategory,
  onToggleSpecialCases,
  onSelectLabel,
  onSignOut,
}: SidebarProps) {
  const allActive =
    view === 'notes' &&
    activeLabelId === null &&
    activeDisposition === null &&
    activeCategory === null &&
    !specialCasesOnly;

  return (
    <nav className={styles.nav} aria-label="Notes navigation">
      <button
        type="button"
        className={`${styles.item} ${allActive ? styles.active : ''}`}
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

      <button
        type="button"
        className={`${styles.item} ${view === 'cart' ? styles.active : ''}`}
        onClick={onSelectCart}
      >
        <ShoppingCart size={18} />
        <span>Cart{cartCount > 0 ? ` (${cartCount})` : ''}</span>
      </button>

      <button
        type="button"
        className={`${styles.item} ${
          view === 'notes' && specialCasesOnly ? styles.active : ''
        }`}
        onClick={onToggleSpecialCases}
      >
        <AlertCircle size={18} />
        <span>Special cases</span>
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
        <p className={styles.sectionTitle}>Type</p>
        <button
          type="button"
          className={`${styles.item} ${
            view === 'notes' && activeCategory === 'monitor' ? styles.active : ''
          }`}
          onClick={() => onSelectCategory('monitor')}
        >
          <Monitor size={18} />
          <span>Monitor</span>
        </button>
        <button
          type="button"
          className={`${styles.item} ${
            view === 'notes' && activeCategory === 'computer' ? styles.active : ''
          }`}
          onClick={() => onSelectCategory('computer')}
        >
          <Cpu size={18} />
          <span>Computer</span>
        </button>
        <button
          type="button"
          className={`${styles.item} ${
            view === 'notes' && activeCategory === 'printer' ? styles.active : ''
          }`}
          onClick={() => onSelectCategory('printer')}
        >
          <Printer size={18} />
          <span>Printer</span>
        </button>
        <button
          type="button"
          className={`${styles.item} ${
            view === 'notes' && activeCategory === 'network' ? styles.active : ''
          }`}
          onClick={() => onSelectCategory('network')}
        >
          <Network size={18} />
          <span>Network</span>
        </button>
        <button
          type="button"
          className={`${styles.item} ${
            view === 'notes' && activeCategory === 'scanner' ? styles.active : ''
          }`}
          onClick={() => onSelectCategory('scanner')}
        >
          <ScanBarcode size={18} />
          <span>Scanner</span>
        </button>
        <button
          type="button"
          className={`${styles.item} ${
            view === 'notes' && activeCategory === 'cables' ? styles.active : ''
          }`}
          onClick={() => onSelectCategory('cables')}
        >
          <Cable size={18} />
          <span>Cables</span>
        </button>
        <button
          type="button"
          className={`${styles.item} ${
            view === 'notes' && activeCategory === 'other' ? styles.active : ''
          }`}
          onClick={() => onSelectCategory('other')}
        >
          <Package size={18} />
          <span>Other</span>
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

      {onSignOut && (
        <div className={styles.section}>
          <button type="button" className={styles.item} onClick={onSignOut}>
            <LogOut size={18} />
            <span>Sign out</span>
          </button>
        </div>
      )}
    </nav>
  );
}

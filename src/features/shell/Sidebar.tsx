import { useState } from 'react';
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
  Plus,
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
  activeLabelIds: string[];
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
  onToggleLabel: (labelId: string) => void;
  onCreateLabel: (name: string) => Promise<Label>;
  onSignOut?: () => void;
}

export function Sidebar({
  labels,
  view,
  activeLabelIds,
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
  onToggleLabel,
  onCreateLabel,
  onSignOut,
}: SidebarProps) {
  const [creatingLabel, setCreatingLabel] = useState(false);
  const [newLabelName, setNewLabelName] = useState('');
  const [creatingBusy, setCreatingBusy] = useState(false);

  const allActive =
    view === 'notes' &&
    activeLabelIds.length === 0 &&
    activeDisposition === null &&
    activeCategory === null &&
    !specialCasesOnly;

  async function submitNewLabel(e: React.FormEvent) {
    e.preventDefault();
    const name = newLabelName.trim();
    if (!name || creatingBusy) return;
    setCreatingBusy(true);
    try {
      await onCreateLabel(name);
      setNewLabelName('');
      setCreatingLabel(false);
    } finally {
      setCreatingBusy(false);
    }
  }

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
        <p className={styles.sectionTitle}>Guideline</p>
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
        <div className={styles.sectionHeader}>
          <p className={styles.sectionTitle}>Labels</p>
          <button
            type="button"
            className={styles.addLabelBtn}
            onClick={() => setCreatingLabel((open) => !open)}
            aria-label="Create label"
            title="Create label"
            aria-expanded={creatingLabel}
          >
            <Plus size={16} strokeWidth={2.25} />
          </button>
        </div>
        {creatingLabel && (
          <form className={styles.createLabel} onSubmit={(e) => void submitNewLabel(e)}>
            <input
              className={styles.createLabelInput}
              value={newLabelName}
              onChange={(e) => setNewLabelName(e.target.value)}
              placeholder="Label name"
              aria-label="New label name"
              autoFocus
              disabled={creatingBusy}
            />
            <button
              type="submit"
              className={styles.createLabelSubmit}
              disabled={creatingBusy || !newLabelName.trim()}
            >
              Add
            </button>
          </form>
        )}
        {labels.length === 0 && !creatingLabel ? (
          <p className={styles.empty}>Type # in a note or tap + to add labels.</p>
        ) : (
          <ul className={styles.list}>
            {labels.map((label) => (
              <li key={label.id}>
                <button
                  type="button"
                  className={`${styles.item} ${
                    view === 'notes' && activeLabelIds.includes(label.id)
                      ? styles.active
                      : ''
                  }`}
                  onClick={() => onToggleLabel(label.id)}
                  aria-pressed={
                    view === 'notes' && activeLabelIds.includes(label.id)
                  }
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

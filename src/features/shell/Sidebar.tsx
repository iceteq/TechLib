import { useState, type ReactNode } from 'react';
import {
  AlertCircle,
  Archive,
  ChevronDown,
  CircleOff,
  Lightbulb,
  LogOut,
  Package,
  Plus,
  ShoppingCart,
  Tag,
  Trash2,
  Warehouse,
  Wrench,
} from 'lucide-react';
import type {
  Label,
  NoteDisposition,
  NoteType,
  NotesView,
  StockLocation,
} from '../../lib/types';
import { UNSET_TYPE_FILTER } from '../../lib/types';
import { noteTypeIcon, typeColorVars } from '../../lib/noteTypes';
import {
  loadSidebarSections,
  saveSidebarSections,
  type SidebarSectionId,
  type SidebarSectionState,
} from '../../lib/sidebarSections';
import styles from './Sidebar.module.css';

interface SidebarProps {
  labels: Label[];
  noteTypes: NoteType[];
  stockLocations: StockLocation[];
  typeCounts: Record<string, number>;
  unsetCount: number;
  view: NotesView;
  activeLabelIds: string[];
  activeDisposition: NoteDisposition | null;
  activeCategoryId: string | null;
  activeStockId: string | null;
  specialCasesOnly: boolean;
  cartCount: number;
  onSelectNotes: () => void;
  onSelectArchive: () => void;
  onSelectCart: () => void;
  onSelectDisposition: (disposition: NoteDisposition) => void;
  onSelectCategoryId: (categoryId: string) => void;
  onSelectStock: (stockId: string) => void;
  onToggleSpecialCases: () => void;
  onToggleLabel: (labelId: string) => void;
  onCreateLabel: (name: string) => Promise<Label>;
  onCreateType: (name: string) => Promise<NoteType>;
  onCreateStock: (name: string) => Promise<StockLocation>;
  onSignOut?: () => void;
}

export function Sidebar({
  labels,
  noteTypes,
  stockLocations,
  typeCounts,
  unsetCount,
  view,
  activeLabelIds,
  activeDisposition,
  activeCategoryId,
  activeStockId,
  specialCasesOnly,
  cartCount,
  onSelectNotes,
  onSelectArchive,
  onSelectCart,
  onSelectDisposition,
  onSelectCategoryId,
  onSelectStock,
  onToggleSpecialCases,
  onToggleLabel,
  onCreateLabel,
  onCreateType,
  onCreateStock,
  onSignOut,
}: SidebarProps) {
  const [sections, setSections] =
    useState<SidebarSectionState>(loadSidebarSections);
  const [creatingLabel, setCreatingLabel] = useState(false);
  const [newLabelName, setNewLabelName] = useState('');
  const [creatingType, setCreatingType] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const [creatingStock, setCreatingStock] = useState(false);
  const [newStockName, setNewStockName] = useState('');
  const [creatingBusy, setCreatingBusy] = useState(false);

  const allActive =
    view === 'notes' &&
    activeLabelIds.length === 0 &&
    activeDisposition === null &&
    activeCategoryId === null &&
    activeStockId === null &&
    !specialCasesOnly;

  function toggleSection(id: SidebarSectionId) {
    setSections((current) => {
      const next = { ...current, [id]: !current[id] };
      saveSidebarSections(next);
      return next;
    });
  }

  function openSection(id: SidebarSectionId) {
    setSections((current) => {
      if (current[id]) return current;
      const next = { ...current, [id]: true };
      saveSidebarSections(next);
      return next;
    });
  }

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

  async function submitNewType(e: React.FormEvent) {
    e.preventDefault();
    const name = newTypeName.trim();
    if (!name || creatingBusy) return;
    setCreatingBusy(true);
    try {
      await onCreateType(name);
      setNewTypeName('');
      setCreatingType(false);
    } finally {
      setCreatingBusy(false);
    }
  }

  async function submitNewStock(e: React.FormEvent) {
    e.preventDefault();
    const name = newStockName.trim();
    if (!name || creatingBusy) return;
    setCreatingBusy(true);
    try {
      await onCreateStock(name);
      setNewStockName('');
      setCreatingStock(false);
    } finally {
      setCreatingBusy(false);
    }
  }

  function sectionHasActive(id: SidebarSectionId): boolean {
    if (view !== 'notes') return false;
    if (id === 'guideline') return activeDisposition != null;
    if (id === 'type') return activeCategoryId != null;
    if (id === 'stock') return activeStockId != null;
    if (id === 'labels') return activeLabelIds.length > 0;
    return false;
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

      <CollapsibleSection
        id="guideline"
        title="Guideline"
        open={sections.guideline}
        hasActive={sectionHasActive('guideline')}
        onToggle={() => toggleSection('guideline')}
      >
        <button
          type="button"
          className={`${styles.item} ${
            view === 'notes' && activeDisposition === 'stock' ? styles.active : ''
          }`}
          onClick={() => onSelectDisposition('stock')}
        >
          <Package size={18} />
          <span>To stock</span>
        </button>
        <button
          type="button"
          className={`${styles.item} ${
            view === 'notes' && activeDisposition === 'repair'
              ? styles.active
              : ''
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
      </CollapsibleSection>

      <CollapsibleSection
        id="type"
        title="Type"
        open={sections.type}
        hasActive={sectionHasActive('type')}
        onToggle={() => toggleSection('type')}
        trailing={
          <button
            type="button"
            className={styles.addLabelBtn}
            onClick={(e) => {
              e.stopPropagation();
              setCreatingType((open) => !open);
              openSection('type');
            }}
            aria-label="Create type"
            title="Create type"
            aria-expanded={creatingType}
          >
            <Plus size={16} strokeWidth={2.25} />
          </button>
        }
      >
        {creatingType && (
          <form
            className={styles.createLabel}
            onSubmit={(e) => void submitNewType(e)}
          >
            <input
              className={styles.createLabelInput}
              value={newTypeName}
              onChange={(e) => setNewTypeName(e.target.value)}
              placeholder="e.g. Laptop"
              aria-label="New type name"
              autoFocus
              disabled={creatingBusy}
            />
            <button
              type="submit"
              className={styles.createLabelSubmit}
              disabled={creatingBusy || !newTypeName.trim()}
            >
              Add
            </button>
          </form>
        )}
        <ul className={styles.list}>
          <li>
            <button
              type="button"
              className={`${styles.item} ${
                view === 'notes' && activeCategoryId === UNSET_TYPE_FILTER
                  ? styles.active
                  : ''
              }`}
              onClick={() => onSelectCategoryId(UNSET_TYPE_FILTER)}
              aria-pressed={
                view === 'notes' && activeCategoryId === UNSET_TYPE_FILTER
              }
            >
              <CircleOff size={18} />
              <span className={styles.itemText}>No type</span>
              <span className={styles.itemCount}>{unsetCount}</span>
            </button>
          </li>
          {noteTypes.map((type) => {
            const Icon = noteTypeIcon(type.icon);
            const colors = typeColorVars(type.color);
            const active =
              view === 'notes' && activeCategoryId === type.id;
            return (
              <li key={type.id}>
                <button
                  type="button"
                  className={`${styles.item} ${active ? styles.active : ''}`}
                  onClick={() => onSelectCategoryId(type.id)}
                  aria-pressed={active}
                >
                  <Icon
                    size={18}
                    style={{ color: colors.fg, opacity: 0.9 }}
                  />
                  <span className={styles.itemText}>{type.name}</span>
                  <span className={styles.itemCount}>
                    {typeCounts[type.id] ?? 0}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {noteTypes.length === 0 && !creatingType && (
          <p className={styles.empty}>Tap + to add product types.</p>
        )}
      </CollapsibleSection>

      <CollapsibleSection
        id="stock"
        title="Stock"
        open={sections.stock}
        hasActive={sectionHasActive('stock')}
        onToggle={() => toggleSection('stock')}
        trailing={
          <button
            type="button"
            className={styles.addLabelBtn}
            onClick={(e) => {
              e.stopPropagation();
              setCreatingStock((open) => !open);
              openSection('stock');
            }}
            aria-label="Create stock location"
            title="Create stock location"
            aria-expanded={creatingStock}
          >
            <Plus size={16} strokeWidth={2.25} />
          </button>
        }
      >
        {creatingStock && (
          <form
            className={styles.createLabel}
            onSubmit={(e) => void submitNewStock(e)}
          >
            <input
              className={styles.createLabelInput}
              value={newStockName}
              onChange={(e) => setNewStockName(e.target.value)}
              placeholder="e.g. 3209"
              aria-label="New stock location"
              autoFocus
              disabled={creatingBusy}
            />
            <button
              type="submit"
              className={styles.createLabelSubmit}
              disabled={creatingBusy || !newStockName.trim()}
            >
              Add
            </button>
          </form>
        )}
        {stockLocations.length === 0 && !creatingStock ? (
          <p className={styles.empty}>Tap + to add stock locations.</p>
        ) : (
          <ul className={styles.list}>
            {stockLocations.map((stock) => (
              <li key={stock.id}>
                <button
                  type="button"
                  className={`${styles.item} ${
                    view === 'notes' && activeStockId === stock.id
                      ? styles.active
                      : ''
                  }`}
                  onClick={() => onSelectStock(stock.id)}
                  aria-pressed={view === 'notes' && activeStockId === stock.id}
                >
                  <Warehouse size={18} />
                  <span>{stock.name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </CollapsibleSection>

      <CollapsibleSection
        id="labels"
        title="Labels"
        open={sections.labels}
        hasActive={sectionHasActive('labels')}
        onToggle={() => toggleSection('labels')}
        trailing={
          <button
            type="button"
            className={styles.addLabelBtn}
            onClick={(e) => {
              e.stopPropagation();
              setCreatingLabel((open) => !open);
              openSection('labels');
            }}
            aria-label="Create label"
            title="Create label"
            aria-expanded={creatingLabel}
          >
            <Plus size={16} strokeWidth={2.25} />
          </button>
        }
      >
        {creatingLabel && (
          <form
            className={styles.createLabel}
            onSubmit={(e) => void submitNewLabel(e)}
          >
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
      </CollapsibleSection>

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

function CollapsibleSection({
  id,
  title,
  open,
  hasActive,
  onToggle,
  trailing,
  children,
}: {
  id: SidebarSectionId;
  title: string;
  open: boolean;
  hasActive: boolean;
  onToggle: () => void;
  trailing?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <button
          type="button"
          className={`${styles.sectionToggle} ${
            hasActive ? styles.sectionToggleActive : ''
          }`}
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={`sidebar-section-${id}`}
        >
          <ChevronDown
            size={16}
            className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}
            aria-hidden
          />
          <span className={styles.sectionTitle}>{title}</span>
          {hasActive && !open && (
            <span className={styles.activeDot} aria-label="Filter active" />
          )}
        </button>
        {trailing}
      </div>
      {open && (
        <div id={`sidebar-section-${id}`} className={styles.sectionBody}>
          {children}
        </div>
      )}
    </div>
  );
}

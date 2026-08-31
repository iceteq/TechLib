import { useState, type DragEvent, type ReactNode } from 'react';
import {
  AlertCircle,
  Archive,
  ChevronDown,
  CircleOff,
  Hash,
  Lightbulb,
  LogOut,
  Package,
  Minus,
  Plus,
  ShoppingCart,
  Tag,
  Trash2,
  Warehouse,
  Wrench,
  X,
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
import {
  loadSidebarCounts,
  saveSidebarCounts,
  type SidebarCountSectionId,
  type SidebarCountState,
} from '../../lib/sidebarCounts';
import {
  getNoteDragIds,
  isNoteDrag,
  type NoteAssignTarget,
} from '../../lib/noteDrag';
import styles from './Sidebar.module.css';

interface SidebarProps {
  labels: Label[];
  noteTypes: NoteType[];
  stockLocations: StockLocation[];
  typeCounts: Record<string, number>;
  unsetCount: number;
  labelCounts: Record<string, number>;
  stockCounts: Record<string, number>;
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
  onDeleteLabel: (labelId: string) => Promise<void>;
  onSignOut?: () => void;
  onAssignNotes?: (
    noteIds: string[],
    target: NoteAssignTarget,
  ) => void | Promise<void>;
}

function noteWord(count: number): string {
  return count === 1 ? 'note' : 'notes';
}

function confirmDelete(
  kind: 'label' | 'type' | 'stock location',
  name: string,
  noteCount: number,
): boolean {
  const effect =
    noteCount === 0
      ? 'No notes currently use it.'
      : kind === 'label'
        ? `It will be removed from ${noteCount} ${noteWord(noteCount)}.`
        : `It will be cleared from ${noteCount} ${noteWord(noteCount)}.`;
  return window.confirm(`Delete ${kind} "${name}"?\n\n${effect}`);
}

export function Sidebar({
  labels,
  noteTypes,
  stockLocations,
  typeCounts,
  unsetCount,
  labelCounts,
  stockCounts,
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
  onDeleteLabel,
  onSignOut,
  onAssignNotes,
}: SidebarProps) {
  const [sections, setSections] =
    useState<SidebarSectionState>(loadSidebarSections);
  const [showCounts, setShowCounts] =
    useState<SidebarCountState>(loadSidebarCounts);
  const [creatingLabel, setCreatingLabel] = useState(false);
  const [newLabelName, setNewLabelName] = useState('');
  const [creatingType, setCreatingType] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const [creatingStock, setCreatingStock] = useState(false);
  const [newStockName, setNewStockName] = useState('');
  const [creatingBusy, setCreatingBusy] = useState(false);

  const [dropKey, setDropKey] = useState<string | null>(null);

  function dropClass(key: string): string {
    return dropKey === key ? ` ${styles.dropOver}` : '';
  }

  function noteDropHandlers(key: string, target: NoteAssignTarget) {
    if (!onAssignNotes) {
      return {};
    }
    return {
      onDragOver: (e: DragEvent) => {
        if (!isNoteDrag(e.dataTransfer)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        setDropKey(key);
      },
      onDragLeave: (e: DragEvent) => {
        const related = e.relatedTarget;
        if (related instanceof Node && e.currentTarget.contains(related)) {
          return;
        }
        setDropKey((current) => (current === key ? null : current));
      },
      onDrop: (e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDropKey(null);
        const ids = getNoteDragIds(e.dataTransfer);
        if (!ids || ids.length === 0) return;
        void onAssignNotes(ids, target);
      },
    };
  }

  const [editingSection, setEditingSection] = useState<'labels' | null>(null);

  const allActive =
    view === 'notes' &&
    activeLabelIds.length === 0 &&
    activeDisposition === null &&
    activeCategoryId === null &&
    activeStockId === null &&
    !specialCasesOnly;

  function toggleSection(id: SidebarSectionId) {
    setSections((current) => {
      const opening = !current[id];
      const next: SidebarSectionState = {
        guideline: false,
        type: false,
        stock: false,
        labels: false,
      };
      if (opening) next[id] = true;
      saveSidebarSections(next);
      return next;
    });
    if (id !== 'labels') setEditingSection(null);
  }

  function openSection(id: SidebarSectionId) {
    setSections((current) => {
      if (current[id]) return current;
      const next: SidebarSectionState = {
        guideline: false,
        type: false,
        stock: false,
        labels: false,
        [id]: true,
      };
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
    if (id === 'guideline') {
      return activeDisposition != null || specialCasesOnly;
    }
    if (id === 'type') return activeCategoryId != null;
    if (id === 'stock') return activeStockId != null;
    if (id === 'labels') return activeLabelIds.length > 0;
    return false;
  }

  function toggleCreate(
    section: 'type' | 'stock' | 'labels',
    setCreating: (value: boolean | ((open: boolean) => boolean)) => void,
  ) {
    setEditingSection(null);
    setCreating((open) => !open);
    openSection(section);
  }

  function toggleEditing(section: 'labels') {
    setCreatingType(false);
    setCreatingStock(false);
    setCreatingLabel(false);
    setEditingSection((current) => (current === section ? null : section));
    openSection(section);
  }

  function toggleCounts(section: SidebarCountSectionId) {
    setShowCounts((current) => {
      const next = { ...current, [section]: !current[section] };
      saveSidebarCounts(next);
      return next;
    });
  }

  function sectionActions(
    section: SidebarCountSectionId,
    options: {
      canEdit?: boolean;
      creating: boolean;
      onToggleCreate: () => void;
      createLabel: string;
    },
  ) {
    const editing = editingSection === section;
    const countsOn = showCounts[section];
    const forceVisible = options.creating || editing;
    return (
      <div
        className={`${styles.sectionActions} ${
          forceVisible ? styles.sectionActionsVisible : ''
        }`}
      >
        <button
          type="button"
          className={`${styles.addLabelBtn} ${
            countsOn ? styles.addLabelBtnActive : ''
          }`}
          onClick={(e) => {
            e.stopPropagation();
            toggleCounts(section);
          }}
          aria-label={
            countsOn ? `Hide ${section} counts` : `Show ${section} counts`
          }
          title={countsOn ? 'Hide counts' : 'Show counts'}
          aria-pressed={countsOn}
        >
          <Hash size={15} strokeWidth={2.25} />
        </button>
        {options.canEdit && (
          <button
            type="button"
            className={`${styles.addLabelBtn} ${
              editing ? styles.addLabelBtnActive : ''
            }`}
            onClick={(e) => {
              e.stopPropagation();
              toggleEditing(section as 'labels');
            }}
            aria-label={
              editing ? `Done editing ${section}` : `Remove ${section}`
            }
            title={editing ? 'Done' : 'Remove'}
            aria-pressed={editing}
          >
            <Minus size={16} strokeWidth={2.25} />
          </button>
        )}
        <button
          type="button"
          className={`${styles.addLabelBtn} ${
            options.creating ? styles.addLabelBtnActive : ''
          }`}
          onClick={(e) => {
            e.stopPropagation();
            options.onToggleCreate();
          }}
          aria-label={options.createLabel}
          title={options.createLabel}
          aria-expanded={options.creating}
        >
          <Plus size={16} strokeWidth={2.25} />
        </button>
      </div>
    );
  }

  const showCart = cartCount > 0 || view === 'cart';

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

      {showCart && (
        <button
          type="button"
          className={`${styles.item} ${view === 'cart' ? styles.active : ''}`}
          onClick={onSelectCart}
        >
          <ShoppingCart size={18} />
          <span>Cart{cartCount > 0 ? ` (${cartCount})` : ''}</span>
        </button>
      )}

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
          }${dropClass('disposition:stock')}`}
          onClick={() => onSelectDisposition('stock')}
          {...noteDropHandlers('disposition:stock', {
            field: 'disposition',
            value: 'stock',
            label: 'To stock',
          })}
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
          }${dropClass('disposition:repair')}`}
          onClick={() => onSelectDisposition('repair')}
          {...noteDropHandlers('disposition:repair', {
            field: 'disposition',
            value: 'repair',
            label: 'Repair',
          })}
        >
          <Wrench size={18} />
          <span>Repair</span>
        </button>
        <button
          type="button"
          className={`${styles.item} ${
            view === 'notes' && activeDisposition === 'scrap' ? styles.active : ''
          }${dropClass('disposition:scrap')}`}
          onClick={() => onSelectDisposition('scrap')}
          {...noteDropHandlers('disposition:scrap', {
            field: 'disposition',
            value: 'scrap',
            label: 'Throw away',
          })}
        >
          <Trash2 size={18} />
          <span>Throw away</span>
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
      </CollapsibleSection>

      <CollapsibleSection
        id="type"
        title="Type"
        open={sections.type}
        hasActive={sectionHasActive('type')}
        onToggle={() => toggleSection('type')}
        trailing={
          sectionActions('type', {
            creating: creatingType,
            onToggleCreate: () => toggleCreate('type', setCreatingType),
            createLabel: 'Create type',
          })
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
              }${dropClass('category:unset')}`}
              onClick={() => onSelectCategoryId(UNSET_TYPE_FILTER)}
              aria-pressed={
                view === 'notes' && activeCategoryId === UNSET_TYPE_FILTER
              }
              {...noteDropHandlers('category:unset', {
                field: 'categoryId',
                value: null,
                label: 'No type',
              })}
            >
              <CircleOff size={18} />
              <span className={styles.itemText}>No type</span>
              {showCounts.type && (
              <span className={styles.itemCount}>{unsetCount}</span>
            )}
            </button>
          </li>
          {noteTypes.map((type) => {
            const Icon = noteTypeIcon(type.icon);
            const colors = typeColorVars(type.color);
            const active =
              view === 'notes' && activeCategoryId === type.id;
            return (
              <li key={type.id} className={`${styles.row} ${active ? styles.rowActive : ''}`}>
                <button
                  type="button"
                  className={`${styles.item} ${active ? styles.active : ''}${dropClass(`category:${type.id}`)}`}
                  onClick={() => onSelectCategoryId(type.id)}
                  aria-pressed={active}
                  {...noteDropHandlers(`category:${type.id}`, {
                    field: 'categoryId',
                    value: type.id,
                    label: type.name,
                  })}
                >
                  <Icon
                    size={18}
                    style={{ color: colors.fg, opacity: 0.9 }}
                  />
                  <span className={styles.itemText}>{type.name}</span>
                  {showCounts.type && (
                    <span className={styles.itemCount}>
                      {typeCounts[type.id] ?? 0}
                    </span>
                  )}
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
          sectionActions('stock', {
            creating: creatingStock,
            onToggleCreate: () => toggleCreate('stock', setCreatingStock),
            createLabel: 'Create stock location',
          })
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
            {stockLocations.map((stock) => {
              const active =
                view === 'notes' && activeStockId === stock.id;
              return (
                <li
                  key={stock.id}
                  className={`${styles.row} ${active ? styles.rowActive : ''}`}
                >
                  <button
                    type="button"
                    className={`${styles.item} ${active ? styles.active : ''}${dropClass(`stock:${stock.id}`)}`}
                    onClick={() => onSelectStock(stock.id)}
                    aria-pressed={active}
                    {...noteDropHandlers(`stock:${stock.id}`, {
                      field: 'stockId',
                      value: stock.id,
                      label: stock.name,
                    })}
                  >
                    <Warehouse size={18} />
                    <span className={styles.itemText}>{stock.name}</span>
                    {showCounts.stock && (
                      <span className={styles.itemCount}>
                        {stockCounts[stock.id] ?? 0}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
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
          sectionActions('labels', {
            canEdit: labels.length > 0,
            creating: creatingLabel,
            onToggleCreate: () => toggleCreate('labels', setCreatingLabel),
            createLabel: 'Create label',
          })
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
            {labels.map((label) => {
              const active =
                view === 'notes' && activeLabelIds.includes(label.id);
              return (
                <li
                  key={label.id}
                  className={`${styles.row} ${active ? styles.rowActive : ''}`}
                >
                  <button
                    type="button"
                    className={`${styles.item} ${active ? styles.active : ''}`}
                    onClick={() => onToggleLabel(label.id)}
                    aria-pressed={active}
                  >
                    <Tag size={18} />
                    <span className={styles.itemText}>{label.name}</span>
                    {showCounts.labels && (
                      <span className={styles.itemCount}>
                        {labelCounts[label.id] ?? 0}
                      </span>
                    )}
                  </button>
                  {editingSection === 'labels' && (
                  <button
                    type="button"
                    className={styles.deleteBtn}
                    aria-label={`Delete label ${label.name}`}
                    title="Delete label"
                    onClick={(e) => {
                      e.stopPropagation();
                      const count = labelCounts[label.id] ?? 0;
                      if (!confirmDelete('label', label.name, count)) return;
                      void onDeleteLabel(label.id);
                    }}
                  >
                    <X size={14} strokeWidth={2.25} />
                  </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CollapsibleSection>

      <div className={styles.footer}>
        <button
          type="button"
          className={`${styles.itemQuiet} ${
            view === 'archive' ? styles.itemQuietActive : ''
          }`}
          onClick={onSelectArchive}
        >
          <Archive size={16} />
          <span>Archive</span>
        </button>
        {onSignOut && (
          <button
            type="button"
            className={styles.itemQuiet}
            onClick={onSignOut}
          >
            <LogOut size={16} />
            <span>Sign out</span>
          </button>
        )}
      </div>
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
      <div
        className={`${styles.sectionHeader} ${
          open ? styles.sectionHeaderOpen : ''
        }`}
      >
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

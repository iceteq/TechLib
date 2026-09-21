import { useState, type DragEvent, type ReactNode } from 'react';
import {
  Archive,
  ChevronDown,
  CircleOff,
  Hash,
  Lightbulb,
  LogOut,
  Users,
  Pin,
  Package,
  Minus,
  Plus,
  Settings2,
  Layers,
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
import { UNSET_STOCK_FILTER, UNSET_TYPE_FILTER, DISPOSITIONS } from '../../lib/types';
import { noteTypeIcon, typeColorVars, noteTypePathLabel, rootNoteTypes, childNoteTypes, rolledTypeCount, noteTypeDeleteIds } from '../../lib/noteTypes';
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
  /** False for viewers — hide create/delete/assign. */
  canEdit?: boolean;
  isAdmin?: boolean;
  onOpenMembers?: () => void;
  labels: Label[];
  noteTypes: NoteType[];
  stockLocations: StockLocation[];
  typeCounts: Record<string, number>;
  unsetCount: number;
  labelCounts: Record<string, number>;
  stockCounts: Record<string, number>;
  unsetStockCount: number;
  view: NotesView;
  activeLabelIds: string[];
  activeDisposition: NoteDisposition | null;
  activeCategoryId: string | null;
  activeStockId: string | null;
  collectionCount: number;
  /** Create-default pins (independent of browse selection). */
  defaultCategoryId?: string | null;
  defaultStockId?: string | null;
  onPinCategory?: (categoryId: string | null) => void;
  onPinStock?: (stockId: string | null) => void;
  onSelectNotes: () => void;
  onSelectArchive: () => void;
  onSelectCollection: () => void;
  onSelectDisposition: (disposition: NoteDisposition) => void;
  onSelectCategoryId: (categoryId: string) => void;
  onSelectStock: (stockId: string) => void;
  onToggleLabel: (labelId: string) => void;
  onCreateLabel?: (name: string) => Promise<Label>;
  onCreateType?: (name: string, parentId?: string | null) => Promise<NoteType>;
  onCreateStock?: (name: string) => Promise<StockLocation>;
  onDeleteLabel?: (labelId: string) => Promise<void>;
  onDeleteType?: (typeId: string) => Promise<void>;
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

function CreateDefaultPin({
  pinned,
  label,
  onToggle,
}: {
  pinned: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className={`${styles.pinBtn} ${pinned ? styles.pinBtnPinned : ''}`}
      aria-label={
        pinned
          ? `Unpin ${label} as create default`
          : `Pin ${label} as create default for new notes`
      }
      aria-pressed={pinned}
      title={
        pinned
          ? `Create default · ${label} (click to unpin)`
          : `Use as create default for new notes`
      }
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
    >
      <Pin size={13} strokeWidth={2.25} fill={pinned ? 'currentColor' : 'none'} />
    </button>
  );
}

export function Sidebar({
  canEdit = true,
  isAdmin = false,
  onOpenMembers,
  labels,
  noteTypes,
  stockLocations,
  typeCounts,
  unsetCount,
  labelCounts,
  stockCounts,
  unsetStockCount,
  view,
  activeLabelIds,
  activeDisposition,
  activeCategoryId,
  activeStockId,
  collectionCount,
  defaultCategoryId = null,
  defaultStockId = null,
  onPinCategory,
  onPinStock,
  onSelectNotes,
  onSelectArchive,
  onSelectCollection,
  onSelectDisposition,
  onSelectCategoryId,
  onSelectStock,
  onToggleLabel,
  onCreateLabel,
  onCreateType,
  onCreateStock,
  onDeleteLabel,
  onDeleteType,
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
  const [creatingSubtypeParentId, setCreatingSubtypeParentId] = useState<
    string | null
  >(null);
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

  const [editingSection, setEditingSection] = useState<
    'labels' | 'type' | null
  >(null);

  const allActive =
    view === 'notes' &&
    activeLabelIds.length === 0 &&
    activeDisposition === null &&
    activeCategoryId === null &&
    activeStockId === null;

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
    if (editingSection && editingSection !== id) setEditingSection(null);
    if (id !== 'type') setCreatingSubtypeParentId(null);
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
      if (!onCreateLabel) return;
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
      if (!onCreateType) return;
      await onCreateType(name, creatingSubtypeParentId);
      setNewTypeName('');
      setCreatingType(false);
      setCreatingSubtypeParentId(null);
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
      if (!onCreateStock) return;
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
      return activeDisposition != null;
    }
    if (id === 'type') return activeCategoryId != null;
    if (id === 'stock') return activeStockId != null;
    if (id === 'labels') return activeLabelIds.length > 0;
    return false;
  }

  function guidelineSectionTitle(): string {
    if (view !== 'notes') return 'Any guideline';
    const parts: string[] = [];
    if (activeDisposition != null) {
      const disposition = DISPOSITIONS.find((d) => d.id === activeDisposition);
      parts.push(
        disposition
          ? disposition.id === 'none'
            ? 'No guideline'
            : disposition.short
          : activeDisposition,
      );
    }
    if (parts.length === 0) return 'Any guideline';
    return parts.join(' · ');
  }

  function typeSectionTitle(): string {
    if (view !== 'notes' || activeCategoryId == null) return 'Any type';
    if (activeCategoryId === UNSET_TYPE_FILTER) return 'No type';
    return noteTypePathLabel(noteTypes, activeCategoryId) ?? 'Any type';
  }

  function stockSectionTitle(): string {
    if (view !== 'notes' || activeStockId == null) return 'Any stock';
    if (activeStockId === UNSET_STOCK_FILTER) return 'No stock';
    return (
      stockLocations.find((s) => s.id === activeStockId)?.name ?? 'Any stock'
    );
  }

  function labelsSectionTitle(): string {
    if (view !== 'notes' || activeLabelIds.length === 0) return 'Any label';
    const named = activeLabelIds
      .map((id) => labels.find((l) => l.id === id)?.name)
      .filter((name): name is string => Boolean(name));
    if (named.length === 0) return 'Any label';
    if (named.length === 1) return `#${named[0]}`;
    return `#${named[0]} +${named.length - 1}`;
  }

  function toggleCreate(
    section: 'type' | 'stock' | 'labels',
    setCreating: (value: boolean | ((open: boolean) => boolean)) => void,
  ) {
    setEditingSection(null);
    setCreatingSubtypeParentId(null);
    setCreating((open) => !open);
    openSection(section);
  }

  function startCreateSubtype(parentId: string) {
    setEditingSection(null);
    setCreatingLabel(false);
    setCreatingStock(false);
    setCreatingType(false);
    setNewTypeName('');
    setCreatingSubtypeParentId((current) =>
      current === parentId ? null : parentId,
    );
    openSection('type');
  }

  function toggleEditing(section: 'labels' | 'type') {
    setCreatingType(false);
    setCreatingStock(false);
    setCreatingLabel(false);
    setCreatingSubtypeParentId(null);
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
              toggleEditing(section as 'labels' | 'type');
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
        {canEdit && (
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
        )}
      </div>
    );
  }

  const showCollection = collectionCount > 0 || view === 'collection';

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

      {showCollection && (
        <button
          type="button"
          className={`${styles.item} ${view === 'collection' ? styles.active : ''}`}
          onClick={onSelectCollection}
        >
          <Layers size={18} />
          <span>Collection{collectionCount > 0 ? ` (${collectionCount})` : ''}</span>
        </button>
      )}

      <CollapsibleSection
        id="guideline"
        title={guidelineSectionTitle()}
        open={sections.guideline}
        hasActive={sectionHasActive('guideline')}
        onToggle={() => toggleSection('guideline')}
      >
        <button
          type="button"
          className={`${styles.item} ${
            view === 'notes' && activeDisposition === 'none' ? styles.active : ''
          }${dropClass('disposition:none')}`}
          onClick={() => onSelectDisposition('none')}
          {...noteDropHandlers('disposition:none', {
            field: 'disposition',
            value: 'none',
            label: 'No guideline',
          })}
        >
          <CircleOff size={18} />
          <span>No guideline</span>
        </button>
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
            view === 'notes' && activeDisposition === 'config'
              ? styles.active
              : ''
          }${dropClass('disposition:config')}`}
          onClick={() => onSelectDisposition('config')}
          {...noteDropHandlers('disposition:config', {
            field: 'disposition',
            value: 'config',
            label: 'Config center',
          })}
        >
          <Settings2 size={18} />
          <span>Config center</span>
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
      </CollapsibleSection>

      <CollapsibleSection
        id="type"
        title={typeSectionTitle()}
        open={sections.type}
        hasActive={sectionHasActive('type')}
        onToggle={() => toggleSection('type')}
        trailing={
          sectionActions('type', {
            canEdit: canEdit && noteTypes.length > 0,
            creating: creatingType || creatingSubtypeParentId != null,
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
          {rootNoteTypes(noteTypes).map((type) => {
            const Icon = noteTypeIcon(type.icon);
            const colors = typeColorVars(type.color);
            const active =
              view === 'notes' && activeCategoryId === type.id;
            const pinned = defaultCategoryId === type.id;
            const subtypes = childNoteTypes(noteTypes, type.id);
            const count = rolledTypeCount(type.id, typeCounts, noteTypes);
            return (
              <li key={type.id} className={styles.typeGroup}>
                <div
                  className={`${styles.row} ${active ? styles.rowActive : ''}`}
                >
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
                      <span className={styles.itemCount}>{count}</span>
                    )}
                  </button>
                  {onPinCategory && (
                    <CreateDefaultPin
                      pinned={pinned}
                      label={type.name}
                      onToggle={() =>
                        onPinCategory(pinned ? null : type.id)
                      }
                    />
                  )}
                  {canEdit && !editingSection && (
                    <button
                      type="button"
                      className={styles.addSubtypeBtn}
                      aria-label={`Add subtype under ${type.name}`}
                      title="Add subtype"
                      onClick={(e) => {
                        e.stopPropagation();
                        startCreateSubtype(type.id);
                      }}
                    >
                      <Plus size={14} strokeWidth={2.25} />
                    </button>
                  )}
                  {editingSection === 'type' && (
                    <button
                      type="button"
                      className={styles.deleteBtn}
                      aria-label={`Delete type ${type.name}`}
                      title="Delete type"
                      onClick={(e) => {
                        e.stopPropagation();
                        const removeIds = noteTypeDeleteIds(noteTypes, type.id);
                        let affected = 0;
                        for (const removeId of removeIds) {
                          affected += typeCounts[removeId] ?? 0;
                        }
                        const subtypeCount = subtypes.length;
                        const extra =
                          subtypeCount > 0
                            ? `\n\nAlso deletes ${subtypeCount} subtype${subtypeCount === 1 ? '' : 's'}.`
                            : '';
                        if (
                          !window.confirm(
                            `Delete type "${type.name}"?\n\n${
                              affected === 0
                                ? 'No notes currently use it.'
                                : `It will be cleared from ${affected} ${noteWord(affected)}.`
                            }${extra}`,
                          )
                        ) {
                          return;
                        }
                        void onDeleteType?.(type.id);
                      }}
                    >
                      <X size={14} strokeWidth={2.25} />
                    </button>
                  )}
                </div>
                {creatingSubtypeParentId === type.id && (
                  <form
                    className={`${styles.createLabel} ${styles.createSubtype}`}
                    onSubmit={(e) => void submitNewType(e)}
                  >
                    <input
                      className={styles.createLabelInput}
                      value={newTypeName}
                      onChange={(e) => setNewTypeName(e.target.value)}
                      placeholder={`Subtype of ${type.name}`}
                      aria-label={`New subtype under ${type.name}`}
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
                {subtypes.length > 0 && (
                  <ul className={styles.subList}>
                    {subtypes.map((subtype) => {
                      const subActive =
                        view === 'notes' && activeCategoryId === subtype.id;
                      const subPinned = defaultCategoryId === subtype.id;
                      return (
                        <li
                          key={subtype.id}
                          className={`${styles.row} ${subActive ? styles.rowActive : ''}`}
                        >
                          <button
                            type="button"
                            className={`${styles.item} ${styles.subItem} ${subActive ? styles.active : ''}${dropClass(`category:${subtype.id}`)}`}
                            onClick={() => onSelectCategoryId(subtype.id)}
                            aria-pressed={subActive}
                            {...noteDropHandlers(`category:${subtype.id}`, {
                              field: 'categoryId',
                              value: subtype.id,
                              label: subtype.name,
                            })}
                          >
                            <span className={styles.subDot} aria-hidden />
                            <span className={styles.itemText}>
                              {subtype.name}
                            </span>
                            {showCounts.type && (
                              <span className={styles.itemCount}>
                                {typeCounts[subtype.id] ?? 0}
                              </span>
                            )}
                          </button>
                          {onPinCategory && (
                            <CreateDefaultPin
                              pinned={subPinned}
                              label={subtype.name}
                              onToggle={() =>
                                onPinCategory(subPinned ? null : subtype.id)
                              }
                            />
                          )}
                          {editingSection === 'type' && (
                            <button
                              type="button"
                              className={styles.deleteBtn}
                              aria-label={`Delete subtype ${subtype.name}`}
                              title="Delete subtype"
                              onClick={(e) => {
                                e.stopPropagation();
                                const count = typeCounts[subtype.id] ?? 0;
                                if (
                                  !confirmDelete('type', subtype.name, count)
                                ) {
                                  return;
                                }
                                void onDeleteType?.(subtype.id);
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
        title={stockSectionTitle()}
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
        <ul className={styles.list}>
          <li>
            <button
              type="button"
              className={`${styles.item} ${
                view === 'notes' && activeStockId === UNSET_STOCK_FILTER
                  ? styles.active
                  : ''
              }${dropClass('stock:unset')}`}
              onClick={() => onSelectStock(UNSET_STOCK_FILTER)}
              aria-pressed={
                view === 'notes' && activeStockId === UNSET_STOCK_FILTER
              }
              {...noteDropHandlers('stock:unset', {
                field: 'stockId',
                value: null,
                label: 'No stock',
              })}
            >
              <CircleOff size={18} />
              <span className={styles.itemText}>No stock</span>
              {showCounts.stock && (
                <span className={styles.itemCount}>{unsetStockCount}</span>
              )}
            </button>
          </li>
          {stockLocations.map((stock) => {
            const active = view === 'notes' && activeStockId === stock.id;
            const pinned = defaultStockId === stock.id;
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
                {onPinStock && (
                  <CreateDefaultPin
                    pinned={pinned}
                    label={stock.name}
                    onToggle={() => onPinStock(pinned ? null : stock.id)}
                  />
                )}
              </li>
            );
          })}
        </ul>
        {stockLocations.length === 0 && !creatingStock && (
          <p className={styles.empty}>Tap + to add stock locations.</p>
        )}
      </CollapsibleSection>

      <CollapsibleSection
        id="labels"
        title={labelsSectionTitle()}
        open={sections.labels}
        hasActive={sectionHasActive('labels')}
        onToggle={() => toggleSection('labels')}
        trailing={
          sectionActions('labels', {
            canEdit: canEdit && labels.length > 0,
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
                      void onDeleteLabel?.(label.id);
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
        {isAdmin && onOpenMembers && (
          <button
            type="button"
            className={styles.itemQuiet}
            onClick={onOpenMembers}
          >
            <Users size={16} />
            <span>Members</span>
          </button>
        )}
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
          <span
            className={`${styles.sectionTitle} ${
              hasActive ? styles.sectionTitleValue : ''
            }`}
          >
            {title}
          </span>
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

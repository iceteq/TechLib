import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type DragEvent,
  type ReactNode,
} from 'react';
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
  Search,
  Settings2,
  Layers,
  Tag,
  Trash2,
  Warehouse,
  Wrench,
  X,
  ImageDown,
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
import { SHOW_GUIDELINES } from '../../lib/config';
import styles from './Sidebar.module.css';

interface SidebarProps {
  /** False for viewers — hide create/assign. */
  canEdit?: boolean;
  /** Admins only — delete shared labels / types (stock delete is admin RLS too). */
  isAdmin?: boolean;
  onOpenMembers?: () => void;
  /** Admin: create missing `.wall.jpg` previews for the whole library. */
  onBackfillWallThumbs?: () => void;
  wallBackfillBusy?: boolean;
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
  /** Admins only — soft-deleted notes. */
  onSelectBin?: () => void;
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
  /** Open the mobile drawer so section search is visible. */
  onEnsureVisible?: () => void;
  onAssignNotes?: (
    noteIds: string[],
    target: NoteAssignTarget,
  ) => void | Promise<void>;
}

function noteWord(count: number): string {
  return count === 1 ? 'note' : 'notes';
}

/** Grey out type/stock filters that would show an empty wall (active stays clearable). */
function filterEmpty(count: number, active: boolean): boolean {
  return count === 0 && !active;
}

const FILTER_EMPTY_TITLE = 'No matching notes with current filters';

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  return Boolean(target.closest('[contenteditable="true"]'));
}

function matchesQuery(text: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return text.toLowerCase().includes(q);
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
  onBackfillWallThumbs,
  wallBackfillBusy = false,
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
  onSelectBin,
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
  onEnsureVisible,
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
  const [typeQuery, setTypeQuery] = useState('');
  const [stockQuery, setStockQuery] = useState('');

  const [dropKey, setDropKey] = useState<string | null>(null);
  const typeSearchRef = useRef<HTMLInputElement>(null);
  const stockSearchRef = useRef<HTMLInputElement>(null);
  const pendingSearchFocus = useRef<'type' | 'stock' | null>(null);
  const [searchFocusToken, setSearchFocusToken] = useState(0);

  const unsetTypeActive =
    view === 'notes' && activeCategoryId === UNSET_TYPE_FILTER;
  const unsetTypeEmpty = filterEmpty(unsetCount, unsetTypeActive);
  const unsetStockActive =
    view === 'notes' && activeStockId === UNSET_STOCK_FILTER;
  const unsetStockEmpty = filterEmpty(unsetStockCount, unsetStockActive);

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

  /** Collapse after applying a type/stock filter so the wall stays the focus. */
  function closeSection(id: SidebarSectionId) {
    setSections((current) => {
      if (!current[id]) return current;
      const next: SidebarSectionState = {
        guideline: false,
        type: false,
        stock: false,
        labels: false,
      };
      saveSidebarSections(next);
      return next;
    });
    if (editingSection === id) setEditingSection(null);
    if (id === 'type') setCreatingSubtypeParentId(null);
  }

  function pickCategory(categoryId: string) {
    onSelectCategoryId(categoryId);
    closeSection('type');
  }

  function pickStock(stockId: string) {
    onSelectStock(stockId);
    closeSection('stock');
  }

  function focusSectionSearch(id: 'type' | 'stock') {
    onEnsureVisible?.();
    pendingSearchFocus.current = id;
    openSection(id);
    setSearchFocusToken((token) => token + 1);
  }

  useLayoutEffect(() => {
    const pending = pendingSearchFocus.current;
    if (!pending) return;
    if (!sections[pending]) return;
    const input =
      pending === 'type' ? typeSearchRef.current : stockSearchRef.current;
    if (!input) return;
    input.focus();
    input.select();
    pendingSearchFocus.current = null;
  }, [searchFocusToken, sections]);

  useEffect(() => {
    if (!sections.type) setTypeQuery('');
  }, [sections.type]);

  useEffect(() => {
    if (!sections.stock) setStockQuery('');
  }, [sections.stock]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.defaultPrevented) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isEditableTarget(e.target)) return;
      const key = e.key.toLowerCase();
      if (key === 't') {
        e.preventDefault();
        focusSectionSearch('type');
        return;
      }
      if (key === 's') {
        e.preventDefault();
        focusSectionSearch('stock');
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // focusSectionSearch / openSection use functional state updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stable shortcut wiring
  }, [onEnsureVisible]);

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

  const typeQueryActive = typeQuery.trim().length > 0;
  const stockQueryActive = stockQuery.trim().length > 0;

  const filteredRootTypes = rootNoteTypes(noteTypes).flatMap((type) => {
    const subtypes = childNoteTypes(noteTypes, type.id);
    if (!typeQueryActive) {
      return [{ type, subtypes }];
    }
    const parentMatch = matchesQuery(type.name, typeQuery);
    const matchedSubtypes = subtypes.filter((subtype) =>
      matchesQuery(subtype.name, typeQuery),
    );
    if (!parentMatch && matchedSubtypes.length === 0) return [];
    return [
      {
        type,
        subtypes: parentMatch ? subtypes : matchedSubtypes,
      },
    ];
  });

  const filteredStockLocations = stockQueryActive
    ? stockLocations.filter((stock) => matchesQuery(stock.name, stockQuery))
    : stockLocations;

  /** First non-empty name match — Enter applies this; parents win over subtypes. */
  const typeEnterId = (() => {
    if (!typeQueryActive) return null;
    for (const { type, subtypes } of filteredRootTypes) {
      const parentMatch = matchesQuery(type.name, typeQuery);
      if (parentMatch) {
        const count = rolledTypeCount(type.id, typeCounts, noteTypes);
        const active = view === 'notes' && activeCategoryId === type.id;
        if (!filterEmpty(count, active)) return type.id;
      }
      const subtypeCandidates = parentMatch
        ? subtypes.filter((subtype) => matchesQuery(subtype.name, typeQuery))
        : subtypes;
      for (const subtype of subtypeCandidates) {
        const subCount = typeCounts[subtype.id] ?? 0;
        const subActive = view === 'notes' && activeCategoryId === subtype.id;
        if (!filterEmpty(subCount, subActive)) return subtype.id;
      }
    }
    return null;
  })();

  const stockEnterId = (() => {
    if (!stockQueryActive) return null;
    for (const stock of filteredStockLocations) {
      const active = view === 'notes' && activeStockId === stock.id;
      const count = stockCounts[stock.id] ?? 0;
      if (!filterEmpty(count, active)) return stock.id;
    }
    return null;
  })();

  function handleSectionSearchKeyDown(
    e: React.KeyboardEvent<HTMLInputElement>,
    section: 'type' | 'stock',
  ) {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      if (section === 'type') {
        if (typeEnterId) pickCategory(typeEnterId);
        return;
      }
      if (stockEnterId) pickStock(stockEnterId);
      return;
    }
    if (e.key !== 'Escape') return;
    e.preventDefault();
    e.stopPropagation();
    if (section === 'type') {
      if (typeQuery) {
        setTypeQuery('');
        return;
      }
      typeSearchRef.current?.blur();
      return;
    }
    if (stockQuery) {
      setStockQuery('');
      return;
    }
    stockSearchRef.current?.blur();
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

      {SHOW_GUIDELINES && (
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
              view === 'notes' && activeDisposition === 'none'
                ? styles.active
                : ''
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
              view === 'notes' && activeDisposition === 'stock'
                ? styles.active
                : ''
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
              view === 'notes' && activeDisposition === 'scrap'
                ? styles.active
                : ''
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
      )}

      <CollapsibleSection
        id="type"
        title={typeSectionTitle()}
        open={sections.type}
        hasActive={sectionHasActive('type')}
        onToggle={() => toggleSection('type')}
        trailing={
          sectionActions('type', {
            canEdit: isAdmin && noteTypes.length > 0,
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
        <label className={styles.sectionSearch}>
          <Search size={14} strokeWidth={2.25} aria-hidden />
          <input
            ref={typeSearchRef}
            className={styles.sectionSearchInput}
            value={typeQuery}
            onChange={(e) => setTypeQuery(e.target.value)}
            onKeyDown={(e) => handleSectionSearchKeyDown(e, 'type')}
            placeholder="Find type…"
            aria-label="Find type (press T)"
            aria-autocomplete="list"
            aria-activedescendant={
              typeEnterId ? `type-filter-${typeEnterId}` : undefined
            }
            autoComplete="off"
            spellCheck={false}
          />
          {typeQueryActive && (
            <button
              type="button"
              className={styles.sectionSearchClear}
              aria-label="Clear type search"
              onClick={() => {
                setTypeQuery('');
                typeSearchRef.current?.focus();
              }}
            >
              <X size={13} strokeWidth={2.25} />
            </button>
          )}
        </label>
        <ul className={styles.list}>
          {!typeQueryActive && (
            <li>
              <button
                type="button"
                className={`${styles.item} ${
                  unsetTypeActive ? styles.active : ''
                }${unsetTypeEmpty ? ` ${styles.itemEmpty}` : ''}${dropClass('category:unset')}`}
                onClick={() => {
                  if (unsetTypeEmpty) return;
                  pickCategory(UNSET_TYPE_FILTER);
                }}
                aria-pressed={unsetTypeActive}
                aria-disabled={unsetTypeEmpty || undefined}
                title={unsetTypeEmpty ? FILTER_EMPTY_TITLE : undefined}
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
          )}
          {filteredRootTypes.map(({ type, subtypes }) => {
            const Icon = noteTypeIcon(type.icon);
            const colors = typeColorVars(type.color);
            const active =
              view === 'notes' && activeCategoryId === type.id;
            const pinned = defaultCategoryId === type.id;
            const count = rolledTypeCount(type.id, typeCounts, noteTypes);
            const empty = filterEmpty(count, active);
            const searchHit = typeEnterId === type.id;
            return (
              <li key={type.id} className={styles.typeGroup}>
                <div
                  className={`${styles.row} ${active ? styles.rowActive : ''}${searchHit ? ` ${styles.rowSearchHit}` : ''}`}
                >
                  <button
                    type="button"
                    id={`type-filter-${type.id}`}
                    className={`${styles.item} ${active ? styles.active : ''}${empty ? ` ${styles.itemEmpty}` : ''}${searchHit ? ` ${styles.itemSearchHit}` : ''}${dropClass(`category:${type.id}`)}`}
                    onClick={() => {
                      if (empty) return;
                      pickCategory(type.id);
                    }}
                    aria-pressed={active}
                    aria-disabled={empty || undefined}
                    title={
                      empty
                        ? FILTER_EMPTY_TITLE
                        : searchHit
                          ? `Enter to filter by ${type.name}`
                          : undefined
                    }
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
                        const subtypeCount = childNoteTypes(
                          noteTypes,
                          type.id,
                        ).length;
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
                      const subCount = typeCounts[subtype.id] ?? 0;
                      const subEmpty = filterEmpty(subCount, subActive);
                      const subPinned = defaultCategoryId === subtype.id;
                      const subSearchHit = typeEnterId === subtype.id;
                      return (
                        <li
                          key={subtype.id}
                          className={`${styles.row} ${subActive ? styles.rowActive : ''}${subSearchHit ? ` ${styles.rowSearchHit}` : ''}`}
                        >
                          <button
                            type="button"
                            id={`type-filter-${subtype.id}`}
                            className={`${styles.item} ${styles.subItem} ${subActive ? styles.active : ''}${subEmpty ? ` ${styles.itemEmpty}` : ''}${subSearchHit ? ` ${styles.itemSearchHit}` : ''}${dropClass(`category:${subtype.id}`)}`}
                            onClick={() => {
                              if (subEmpty) return;
                              pickCategory(subtype.id);
                            }}
                            aria-pressed={subActive}
                            aria-disabled={subEmpty || undefined}
                            title={
                              subEmpty
                                ? FILTER_EMPTY_TITLE
                                : subSearchHit
                                  ? `Enter to filter by ${subtype.name}`
                                  : undefined
                            }
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
                                {subCount}
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
        {noteTypes.length > 0 &&
          typeQueryActive &&
          filteredRootTypes.length === 0 && (
            <p className={styles.empty}>No types match “{typeQuery.trim()}”.</p>
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
        <label className={styles.sectionSearch}>
          <Search size={14} strokeWidth={2.25} aria-hidden />
          <input
            ref={stockSearchRef}
            className={styles.sectionSearchInput}
            value={stockQuery}
            onChange={(e) => setStockQuery(e.target.value)}
            onKeyDown={(e) => handleSectionSearchKeyDown(e, 'stock')}
            placeholder="Find stock…"
            aria-label="Find stock (press S)"
            aria-autocomplete="list"
            aria-activedescendant={
              stockEnterId ? `stock-filter-${stockEnterId}` : undefined
            }
            autoComplete="off"
            spellCheck={false}
          />
          {stockQueryActive && (
            <button
              type="button"
              className={styles.sectionSearchClear}
              aria-label="Clear stock search"
              onClick={() => {
                setStockQuery('');
                stockSearchRef.current?.focus();
              }}
            >
              <X size={13} strokeWidth={2.25} />
            </button>
          )}
        </label>
        <ul className={styles.list}>
          {!stockQueryActive && (
            <li>
              <button
                type="button"
                className={`${styles.item} ${
                  unsetStockActive ? styles.active : ''
                }${unsetStockEmpty ? ` ${styles.itemEmpty}` : ''}${dropClass('stock:unset')}`}
                onClick={() => {
                  if (unsetStockEmpty) return;
                  pickStock(UNSET_STOCK_FILTER);
                }}
                aria-pressed={unsetStockActive}
                aria-disabled={unsetStockEmpty || undefined}
                title={unsetStockEmpty ? FILTER_EMPTY_TITLE : undefined}
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
          )}
          {filteredStockLocations.map((stock) => {
            const active = view === 'notes' && activeStockId === stock.id;
            const count = stockCounts[stock.id] ?? 0;
            const empty = filterEmpty(count, active);
            const pinned = defaultStockId === stock.id;
            const searchHit = stockEnterId === stock.id;
            return (
              <li
                key={stock.id}
                className={`${styles.row} ${active ? styles.rowActive : ''}${searchHit ? ` ${styles.rowSearchHit}` : ''}`}
              >
                <button
                  type="button"
                  id={`stock-filter-${stock.id}`}
                  className={`${styles.item} ${active ? styles.active : ''}${empty ? ` ${styles.itemEmpty}` : ''}${searchHit ? ` ${styles.itemSearchHit}` : ''}${dropClass(`stock:${stock.id}`)}`}
                  onClick={() => {
                    if (empty) return;
                    pickStock(stock.id);
                  }}
                  aria-pressed={active}
                  aria-disabled={empty || undefined}
                  title={
                    empty
                      ? FILTER_EMPTY_TITLE
                      : searchHit
                        ? `Enter to filter by ${stock.name}`
                        : undefined
                  }
                  {...noteDropHandlers(`stock:${stock.id}`, {
                    field: 'stockId',
                    value: stock.id,
                    label: stock.name,
                  })}
                >
                  <Warehouse size={18} />
                  <span className={styles.itemText}>{stock.name}</span>
                  {showCounts.stock && (
                    <span className={styles.itemCount}>{count}</span>
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
        {stockLocations.length > 0 &&
          stockQueryActive &&
          filteredStockLocations.length === 0 && (
            <p className={styles.empty}>
              No stock matches “{stockQuery.trim()}”.
            </p>
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
            canEdit: isAdmin && labels.length > 0,
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
        {isAdmin && onSelectBin && (
          <button
            type="button"
            className={`${styles.itemQuiet} ${
              view === 'bin' ? styles.itemQuietActive : ''
            }`}
            onClick={onSelectBin}
          >
            <Trash2 size={16} />
            <span>Bin</span>
          </button>
        )}
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
        {isAdmin && onBackfillWallThumbs && (
          <button
            type="button"
            className={styles.itemQuiet}
            onClick={onBackfillWallThumbs}
            disabled={wallBackfillBusy}
            title="Create small wall previews for older photos"
          >
            <ImageDown size={16} />
            <span>{wallBackfillBusy ? 'Optimizing…' : 'Optimize photos'}</span>
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

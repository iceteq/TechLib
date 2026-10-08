/** Wall card ordering in browse (search still ranks by relevance). */
export type WallSort = 'default' | 'recent';

/** How to cluster the wall when not searching. */
export type WallGroupBy = 'none' | 'type' | 'stock';

/**
 * Resolve the wall group mode.
 *
 * Explicit Type / Stock always win. `none` means Auto: when exactly one of
 * type or stock filter is active, group by the complementary axis. Search,
 * archive, both filters, or no filters → flat.
 */
export function resolveWallGroupBy(input: {
  groupBy: WallGroupBy;
  filterCategoryId: string | null;
  filterStockId: string | null;
  searchActive?: boolean;
  archive?: boolean;
}): WallGroupBy {
  if (input.searchActive || input.archive) return 'none';
  if (input.groupBy !== 'none') return input.groupBy;

  const hasType = Boolean(input.filterCategoryId);
  const hasStock = Boolean(input.filterStockId);
  if (hasType && hasStock) return 'none';
  if (hasStock) return 'type';
  if (hasType) return 'stock';
  return 'none';
}

export type ViewPrefs = {
  barcodes: boolean;
  photos: boolean;
  description: boolean;
  specialCase: boolean;
  labels: boolean;
  age: boolean;
  /** Show type chip on cards (muted style). */
  typeChip: boolean;
  /** Show stock location on cards. */
  stock: boolean;
  /**
   * default = recently edited (pin-first).
   * recent = recently useful (opened or edited).
   */
  sort: WallSort;
  /**
   * Cluster wall cards. `none` = Auto (complementary type↔stock when
   * exactly one of those filters is active). Ignored while searching.
   */
  groupBy: WallGroupBy;
};

export const DEFAULT_VIEW_PREFS: ViewPrefs = {
  barcodes: false,
  photos: true,
  description: false,
  specialCase: true,
  labels: true,
  age: false,
  typeChip: true,
  stock: true,
  sort: 'default',
  groupBy: 'none',
};

export const VIEW_PREFS_STORAGE_KEY = 'techlib.viewPrefs';

/** Legacy key from the earlier barcode-only toggle. */
const LEGACY_BARCODES_KEY = 'techlib.showBarcodes';

function parseGroupBy(value: unknown): WallGroupBy {
  if (value === 'type' || value === 'stock' || value === 'none') return value;
  return DEFAULT_VIEW_PREFS.groupBy;
}

export function loadViewPrefs(): ViewPrefs {
  try {
    const raw = localStorage.getItem(VIEW_PREFS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ViewPrefs>;
      const sort: WallSort =
        parsed.sort === 'recent' ? 'recent' : DEFAULT_VIEW_PREFS.sort;
      const groupBy = parseGroupBy(parsed.groupBy);
      return { ...DEFAULT_VIEW_PREFS, ...parsed, sort, groupBy };
    }

    const legacy = localStorage.getItem(LEGACY_BARCODES_KEY);
    if (legacy !== null) {
      return { ...DEFAULT_VIEW_PREFS, barcodes: legacy === 'true' };
    }
  } catch {
    // ignore quota / private mode / bad JSON
  }
  return { ...DEFAULT_VIEW_PREFS };
}

export function saveViewPrefs(prefs: ViewPrefs) {
  try {
    localStorage.setItem(VIEW_PREFS_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // ignore quota / private mode
  }
}

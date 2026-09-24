/** Wall card ordering in browse (search still ranks by relevance). */
export type WallSort = 'default' | 'recent';

/** How to cluster the wall when not searching. */
export type WallGroupBy = 'none' | 'type' | 'stock';

export type ViewPrefs = {
  barcodes: boolean;
  photos: boolean;
  description: boolean;
  specialCase: boolean;
  labels: boolean;
  age: boolean;
  /** Show type chip on cards (muted style). */
  typeChip: boolean;
  /**
   * default = recently edited (pin-first).
   * recent = recently useful (opened or edited).
   */
  sort: WallSort;
  /** Cluster wall cards; ignored while search is active. */
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

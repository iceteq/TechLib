export type ViewPrefs = {
  barcodes: boolean;
  photos: boolean;
  description: boolean;
  specialCase: boolean;
  labels: boolean;
  age: boolean;
  /** Show type chip on cards (muted style). */
  typeChip: boolean;
};

export const DEFAULT_VIEW_PREFS: ViewPrefs = {
  barcodes: true,
  photos: true,
  description: true,
  specialCase: true,
  labels: true,
  age: true,
  typeChip: true,
};

export const VIEW_PREFS_STORAGE_KEY = 'techlib.viewPrefs';

/** Legacy key from the earlier barcode-only toggle. */
const LEGACY_BARCODES_KEY = 'techlib.showBarcodes';

export function loadViewPrefs(): ViewPrefs {
  try {
    const raw = localStorage.getItem(VIEW_PREFS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ViewPrefs>;
      return { ...DEFAULT_VIEW_PREFS, ...parsed };
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

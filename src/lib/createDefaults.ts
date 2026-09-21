/** Sticky create defaults (pin) — independent of browse filters. */
export type CreateDefaults = {
  /** Pinned product type id, or null when unpinned. */
  categoryId: string | null;
  /** Pinned stock location id, or null when unpinned. */
  stockId: string | null;
};

export const DEFAULT_CREATE_DEFAULTS: CreateDefaults = {
  categoryId: null,
  stockId: null,
};

const STORAGE_KEY = 'techlib.createDefaults';

export function loadCreateDefaults(): CreateDefaults {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_CREATE_DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<CreateDefaults>;
    return {
      categoryId:
        typeof parsed.categoryId === 'string' ? parsed.categoryId : null,
      stockId: typeof parsed.stockId === 'string' ? parsed.stockId : null,
    };
  } catch {
    return { ...DEFAULT_CREATE_DEFAULTS };
  }
}

export function saveCreateDefaults(defaults: CreateDefaults) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults));
  } catch {
    // ignore quota / private mode
  }
}

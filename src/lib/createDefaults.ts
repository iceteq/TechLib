import { UNSET_STOCK_FILTER, UNSET_TYPE_FILTER } from './types';

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

/**
 * Browse scope wins over sticky pins so creating while “inside” a stock/type
 * lands notes in that place. Unset filters clear the field.
 */
export function resolveCreateMeta(
  defaults: CreateDefaults,
  filters: {
    categoryId?: string | null;
    stockId?: string | null;
  } = {},
): CreateDefaults {
  let categoryId = defaults.categoryId;
  let stockId = defaults.stockId;

  if (filters.categoryId === UNSET_TYPE_FILTER) categoryId = null;
  else if (filters.categoryId) categoryId = filters.categoryId;

  if (filters.stockId === UNSET_STOCK_FILTER) stockId = null;
  else if (filters.stockId) stockId = filters.stockId;

  return { categoryId, stockId };
}

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

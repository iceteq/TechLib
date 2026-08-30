const STORAGE_KEY = 'techlib.sidebarCounts';

export type SidebarCountSectionId = 'type' | 'stock' | 'labels';

export type SidebarCountState = Record<SidebarCountSectionId, boolean>;

/** Counts visible by default; user can hide per section. */
export const DEFAULT_SIDEBAR_COUNTS: SidebarCountState = {
  type: true,
  stock: true,
  labels: true,
};

export function loadSidebarCounts(): SidebarCountState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SIDEBAR_COUNTS };
    const parsed = JSON.parse(raw) as Partial<SidebarCountState>;
    return { ...DEFAULT_SIDEBAR_COUNTS, ...parsed };
  } catch {
    return { ...DEFAULT_SIDEBAR_COUNTS };
  }
}

export function saveSidebarCounts(state: SidebarCountState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore quota / private mode
  }
}

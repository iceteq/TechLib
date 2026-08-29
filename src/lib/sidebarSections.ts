const STORAGE_KEY = 'techlib.sidebarSections';

export type SidebarSectionId = 'guideline' | 'type' | 'stock' | 'labels';

export type SidebarSectionState = Record<SidebarSectionId, boolean>;

export const DEFAULT_SIDEBAR_SECTIONS: SidebarSectionState = {
  guideline: false,
  type: false,
  stock: false,
  labels: false,
};

export function loadSidebarSections(): SidebarSectionState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SIDEBAR_SECTIONS };
    const parsed = JSON.parse(raw) as Partial<SidebarSectionState>;
    return { ...DEFAULT_SIDEBAR_SECTIONS, ...parsed };
  } catch {
    return { ...DEFAULT_SIDEBAR_SECTIONS };
  }
}

export function saveSidebarSections(state: SidebarSectionState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore quota / private mode
  }
}

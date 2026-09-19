/** Primary create action remembered on the wall FAB. */
export type CreateFabAction = 'note' | 'paste' | 'photos' | 'camera';

export const DEFAULT_CREATE_FAB_ACTION: CreateFabAction = 'note';

const STORAGE_KEY = 'techlib.createFabAction';

const ACTIONS = new Set<CreateFabAction>([
  'note',
  'paste',
  'photos',
  'camera',
]);

export function loadCreateFabAction(): CreateFabAction {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw && ACTIONS.has(raw as CreateFabAction)) {
      return raw as CreateFabAction;
    }
  } catch {
    // ignore quota / private mode
  }
  return DEFAULT_CREATE_FAB_ACTION;
}

export function saveCreateFabAction(action: CreateFabAction) {
  try {
    localStorage.setItem(STORAGE_KEY, action);
  } catch {
    // ignore quota / private mode
  }
}

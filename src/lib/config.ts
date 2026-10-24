/** How many images peek on the wall card (2 enables the split collage). */
export const NOTE_PREVIEW_IMAGE_LIMIT = 2;

export const APP_NAME = 'TechLib';

/**
 * When false, guideline / disposition UI is hidden (sidebar, cards, editor,
 * bulk assign, collection column). Data + APIs stay; flip to true to restore.
 */
export const SHOW_GUIDELINES = false;

/**
 * When false, reaction UI and reaction fetch/live-sync are off.
 * Data + APIs + Phase 4 RLS stay; flip to true to restore.
 */
export const SHOW_REACTIONS = false;

/**
 * When false, the ✅ “sorted / handled” mark is hidden (wall badge, editor
 * toggle). Follows SHOW_REACTIONS for now.
 */
export const SHOW_SORTED = SHOW_REACTIONS;

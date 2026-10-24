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
 * When true, wall cards show a short author label from `createdBy`
 * (email local-part, or “you” for the current user).
 */
export const SHOW_NOTE_AUTHOR = true;

/**
 * When true, wall cards briefly highlight when live sync applies a
 * change from someone else (not your own save echo).
 */
export const SHOW_REMOTE_WALL_PULSE = true;

/** Max cards to pulse for one remote burst (avoids wall fireworks). */
export const REMOTE_WALL_PULSE_CAP = 15;

/**
 * When true, show a quiet “N online · names” strip when at least one
 * other library member is connected (Supabase Realtime Presence).
 */
export const SHOW_ONLINE_PRESENCE = true;

/**
 * When false, the ✅ “sorted / handled” mark is hidden (wall badge, editor
 * toggle). Follows SHOW_REACTIONS for now.
 */
export const SHOW_SORTED = SHOW_REACTIONS;

// =============================================================================
// Application constants for the Crossword Builder & Player.
// =============================================================================

/** Default grid size (NxN) for new puzzles. */
export const DEFAULT_GRID_SIZE = 15;

/** JSON format version number for import/export compatibility. */
export const CURRENT_VERSION = 1;

/** localStorage key for the builder's current puzzle state. */
export const BUILDER_STORAGE_KEY = "builder-current";

/** localStorage key prefix for player progress (appended with puzzle key). */
export const PLAYER_STORAGE_KEY_PREFIX = "player-";

/** Duration in milliseconds that a toast notification is visible. */
export const TOAST_DURATION_MS = 3000;

/** Debounce delay in milliseconds for auto-save to localStorage. */
export const AUTOSAVE_DELAY_MS = 500;
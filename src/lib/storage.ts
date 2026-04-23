// =============================================================================
// Storage module: localStorage persistence for builder state and player progress.
// =============================================================================

import type { BuilderInteraction, BuilderState, PlayerProgress, WordMetadata } from "./types";
import { BUILDER_STORAGE_KEY, PLAYER_STORAGE_KEY_PREFIX } from "./constants";

/**
 * Returns the localStorage key for player progress associated with a puzzle key.
 * Format: "player-<puzzleKey>"
 */
export function playerStorageKey(puzzleKey: string): string {
  return PLAYER_STORAGE_KEY_PREFIX + puzzleKey;
}

/**
 * Saves builder state to localStorage.
 * Handles Map serialization by converting to entries array for JSON compatibility.
 */
export function saveBuilderState(state: BuilderState): void {
  // Convert Map to entries array for JSON serialization
  const serializable = {
    ...state,
    wordMetadata: Array.from(state.wordMetadata.entries()),
  };
  localStorage.setItem(BUILDER_STORAGE_KEY, JSON.stringify(serializable));
}

/**
 * Returns the base mode (design/fill) from a saved state that may use
 * either the old flat format (mode/joinMode/reattachMode) or the new
 * BuilderInteraction format.
 */
function migrateInteraction(parsed: Record<string, unknown>): BuilderInteraction {
  // New format: interaction is stored directly
  if (parsed.interaction && typeof parsed.interaction === "object" && parsed.interaction !== null) {
    const kind = (parsed.interaction as Record<string, unknown>).kind;
    if (kind === "design") return { kind: "design" };
    if (kind === "fill") return { kind: "fill" };
    if (kind === "join" && typeof (parsed.interaction as Record<string, unknown>).sourceWordId === "string") {
      return { kind: "join", sourceWordId: (parsed.interaction as Record<string, unknown>).sourceWordId as string };
    }
    if (kind === "reattach" && typeof (parsed.interaction as Record<string, unknown>).clueIndex === "number") {
      return { kind: "reattach", clueIndex: (parsed.interaction as Record<string, unknown>).clueIndex as number };
    }
  }

  // Old format: separate mode/joinMode/reattachMode fields
  if (typeof parsed.mode === "string") {
    if (parsed.mode === "design") return { kind: "design" };
    // On load, always normalize to the base fill mode —
    // join/reattach sub-modes should not persist across sessions.
    return { kind: "fill" };
  }

  return { kind: "design" };
}

/**
 * Loads builder state from localStorage.
 * Returns null if no saved state exists or if the data is corrupt.
 * Reconstructs Map from entries array on load.
 * Handles migration from old format (mode/joinMode/reattachMode) to new format (interaction).
 */
export function loadBuilderState(): BuilderState | null {
  const raw = localStorage.getItem(BUILDER_STORAGE_KEY);
  if (raw === null) return null;

  try {
    const parsed = JSON.parse(raw);
    // Validate that parsed value is an object (not a primitive)
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return null;
    }

    // Reconstruct Map from entries array
    const wordMetadataEntries = parsed.wordMetadata as [string, WordMetadata][];
    const wordMetadata = new Map<string, WordMetadata>(
      Array.isArray(wordMetadataEntries) ? wordMetadataEntries : [],
    );

    const interaction = migrateInteraction(parsed);

    return {
      key: parsed.key ?? "",
      gridSize: parsed.gridSize ?? 5,
      grid: parsed.grid ?? [],
      wordMetadata,
      displacedClues: parsed.displacedClues ?? [],
      title: parsed.title ?? "",
      author: parsed.author ?? "",
      interaction,
      selectedCell: parsed.selectedCell ?? null,
      selectedDirection: parsed.selectedDirection ?? "across",
    } as BuilderState;
  } catch {
    return null;
  }
}

/**
 * Saves player progress to localStorage under the key "player-<key>".
 */
export function savePlayerProgress(key: string, progress: PlayerProgress): void {
  localStorage.setItem(playerStorageKey(key), JSON.stringify(progress));
}

/**
 * Loads player progress from localStorage for the given puzzle key.
 * Returns null if no progress exists or if the data is corrupt.
 */
export function loadPlayerProgress(key: string): PlayerProgress | null {
  const raw = localStorage.getItem(playerStorageKey(key));
  if (raw === null) return null;

  try {
    const parsed = JSON.parse(raw);
    // Validate that parsed value is an object (not a primitive)
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return null;
    }
    return parsed as PlayerProgress;
  } catch {
    return null;
  }
}

/**
 * Removes builder state from localStorage.
 */
export function clearBuilderState(): void {
  localStorage.removeItem(BUILDER_STORAGE_KEY);
}

/**
 * Removes player progress for the given puzzle key from localStorage.
 */
export function clearPlayerProgress(key: string): void {
  localStorage.removeItem(playerStorageKey(key));
}

/**
 * Generates a unique key using crypto.randomUUID().
 */
export function generateUniqueKey(): string {
  return crypto.randomUUID();
}
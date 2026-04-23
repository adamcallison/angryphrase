// =============================================================================
// Storage module: localStorage persistence for builder state and player progress.
// =============================================================================

import type { BuilderInteraction, BuilderState, CellData, PlayerProgress, WordMetadata } from "./types";
import { BUILDER_STORAGE_KEY, PLAYER_STORAGE_KEY_PREFIX } from "./constants";

/**
 * Migrates grid cells from the legacy `letter` field to `puzzleLetter`/`playerLetter`.
 * Old format: { black, letter, spaceRight, ... }
 * New format: { black, puzzleLetter, playerLetter, spaceRight, ... }
 */
function migrateGrid(grid: unknown): CellData[][] | null {
  if (!Array.isArray(grid)) return null;
  return grid.map((row: unknown) => {
    if (!Array.isArray(row)) return [];
    return row.map((cell: unknown) => {
      if (!cell || typeof cell !== "object") {
        return { black: true, puzzleLetter: null, playerLetter: null, spaceRight: false, spaceBottom: false, hyphenRight: false, hyphenBottom: false } as CellData;
      }
      const c = cell as Record<string, unknown>;
      // Read puzzleLetter if present, fall back to legacy `letter`
      const puzzleLetter = c.puzzleLetter !== undefined
        ? (c.puzzleLetter === null ? null : String(c.puzzleLetter))
        : (c.letter !== undefined
          ? (c.letter === null ? null : String(c.letter))
          : null);
      return {
        black: Boolean(c.black),
        puzzleLetter,
        playerLetter: null,
        spaceRight: c.spaceRight === undefined ? false : Boolean(c.spaceRight),
        spaceBottom: c.spaceBottom === undefined ? false : Boolean(c.spaceBottom),
        hyphenRight: c.hyphenRight === undefined ? false : Boolean(c.hyphenRight),
        hyphenBottom: c.hyphenBottom === undefined ? false : Boolean(c.hyphenBottom),
      } as CellData;
    });
  });
}

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
      grid: migrateGrid(parsed.grid) ?? [],
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
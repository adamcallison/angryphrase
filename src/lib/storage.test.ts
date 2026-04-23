import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  playerStorageKey,
  saveBuilderState,
  loadBuilderState,
  savePlayerProgress,
  loadPlayerProgress,
  clearBuilderState,
  clearPlayerProgress,
  generateUniqueKey,
} from "./storage";
import type { BuilderInteraction, BuilderState, PlayerProgress, CellData, WordMetadata } from "./types";
import { BUILDER_STORAGE_KEY, PLAYER_STORAGE_KEY_PREFIX } from "./constants";

// ---------------------------------------------------------------------------
// Mock localStorage
// ---------------------------------------------------------------------------

let store: Record<string, string>;

const localStorageMock = {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    store[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete store[key];
  }),
  clear: vi.fn(() => {
    store = {};
  }),
  get length() {
    return Object.keys(store).length;
  },
  key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
};

beforeEach(() => {
  store = {};
  localStorageMock.getItem.mockClear();
  localStorageMock.setItem.mockClear();
  localStorageMock.removeItem.mockClear();
  localStorageMock.clear.mockClear();
  localStorageMock.key.mockClear();
});

// Stub globalThis.localStorage before each test
beforeEach(() => {
  vi.stubGlobal("localStorage", localStorageMock);
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCell(letter: string | null = null, black = false): CellData {
  return {
    black,
    puzzleLetter: letter,
    playerLetter: null,
    spaceRight: false,
    spaceBottom: false,
    hyphenRight: false,
    hyphenBottom: false,
  };
}

function makeBuilderState(overrides: Partial<BuilderState> = {}): BuilderState {
  const gridSize = overrides.gridSize ?? 2;
  const grid: CellData[][] = overrides.grid ?? [
    [makeCell("A"), makeCell("B")],
    [makeCell("C"), makeCell(null)],
  ];
  const wordMetadata = overrides.wordMetadata ?? new Map<string, WordMetadata>();

  return {
    key: overrides.key ?? "test-key-123",
    gridSize,
    grid,
    wordMetadata,
    displacedClues: overrides.displacedClues ?? [],
    title: overrides.title ?? "Test Puzzle",
    author: overrides.author ?? "Test Author",
    interaction: overrides.interaction ?? { kind: "fill" },
    selectedCell: overrides.selectedCell !== undefined ? overrides.selectedCell : { row: 0, col: 0 },
    selectedDirection: overrides.selectedDirection ?? "across",
  };
}

function makePlayerProgress(overrides: Partial<PlayerProgress> = {}): PlayerProgress {
  return {
    key: overrides.key ?? "puzzle-abc",
    gridSize: overrides.gridSize ?? 2,
    letters:
      overrides.letters ?? [
        ["A", "B"],
        ["C", null],
      ],
  };
}

// ===========================================================================
// playerStorageKey
// ===========================================================================

describe("playerStorageKey", () => {
  it("prefixes the puzzle key with the player storage key prefix", () => {
    expect(playerStorageKey("abc123")).toBe("player-abc123");
  });

  it("prefixes an empty string key", () => {
    expect(playerStorageKey("")).toBe("player-");
  });

  it("prefixes a special-character key", () => {
    expect(playerStorageKey("my-puzzle")).toBe("player-my-puzzle");
  });
});

// ===========================================================================
// saveBuilderState / loadBuilderState
// ===========================================================================

describe("saveBuilderState and loadBuilderState", () => {
  it("saves and loads a BuilderState round-trip", () => {
    const state = makeBuilderState();
    saveBuilderState(state);

    const loaded = loadBuilderState();
    expect(loaded).not.toBeNull();
    expect(loaded!.key).toBe("test-key-123");
    expect(loaded!.gridSize).toBe(2);
    expect(loaded!.title).toBe("Test Puzzle");
    expect(loaded!.author).toBe("Test Author");
    expect(loaded!.interaction).toEqual({ kind: "fill" });
    expect(loaded!.selectedCell).toEqual({ row: 0, col: 0 });
    expect(loaded!.selectedDirection).toBe("across");
  });

  it("preserves grid data in round-trip", () => {
    const state = makeBuilderState({
      gridSize: 1,
      grid: [[makeCell("Z")]],
    });
    saveBuilderState(state);

    const loaded = loadBuilderState();
    expect(loaded).not.toBeNull();
    expect(loaded!.grid).toEqual([[{ black: false, puzzleLetter: "Z", playerLetter: null, spaceRight: false, spaceBottom: false, hyphenRight: false, hyphenBottom: false }]]);
  });

  it("preserves wordMetadata Map in round-trip", () => {
    const wordMeta: WordMetadata = { clue: "A test clue", nextWord: { startRow: 1, startCol: 0, direction: "down" } };
    const wordMetadata = new Map<string, WordMetadata>();
    wordMetadata.set("0-0-across", wordMeta);

    const state = makeBuilderState({ wordMetadata });
    saveBuilderState(state);

    const loaded = loadBuilderState();
    expect(loaded).not.toBeNull();
    expect(loaded!.wordMetadata).toBeInstanceOf(Map);
    expect(loaded!.wordMetadata.get("0-0-across")).toEqual(wordMeta);
  });

  it("preserves displacedClues in round-trip", () => {
    const state = makeBuilderState({
      displacedClues: [
        { id: "dc-1", clue: "Lost clue", direction: "across" as const },
      ],
    });
    saveBuilderState(state);

    const loaded = loadBuilderState();
    expect(loaded).not.toBeNull();
    expect(loaded!.displacedClues).toEqual([
      { id: "dc-1", clue: "Lost clue", direction: "across" },
    ]);
  });

  it("stores data under BUILDER_STORAGE_KEY", () => {
    const state = makeBuilderState();
    saveBuilderState(state);

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      BUILDER_STORAGE_KEY,
      expect.any(String),
    );
  });

  it("returns null when no builder state exists", () => {
    expect(loadBuilderState()).toBeNull();
  });

  it("returns null when stored value is not valid JSON", () => {
    store[BUILDER_STORAGE_KEY] = "not-valid-json{{{";
    expect(loadBuilderState()).toBeNull();
  });

  it("returns null when stored value is a non-object JSON value", () => {
    // Stored value is valid JSON but not an object, like a string or number
    store[BUILDER_STORAGE_KEY] = JSON.stringify("just a string");
    expect(loadBuilderState()).toBeNull();
  });

  it("overwrites previous builder state on save", () => {
    const state1 = makeBuilderState({ key: "first" });
    const state2 = makeBuilderState({ key: "second" });

    saveBuilderState(state1);
    saveBuilderState(state2);

    const loaded = loadBuilderState();
    expect(loaded).not.toBeNull();
    expect(loaded!.key).toBe("second");
  });

  it("handles empty wordMetadata Map", () => {
    const state = makeBuilderState({ wordMetadata: new Map() });
    saveBuilderState(state);

    const loaded = loadBuilderState();
    expect(loaded).not.toBeNull();
    expect(loaded!.wordMetadata).toBeInstanceOf(Map);
    expect(loaded!.wordMetadata.size).toBe(0);
  });

  it("handles null selectedCell", () => {
    const state = makeBuilderState({ selectedCell: null });
    saveBuilderState(state);

    const loaded = loadBuilderState();
    expect(loaded).not.toBeNull();
    expect(loaded!.selectedCell).toBeNull();
  });

  it("handles design mode", () => {
    const state = makeBuilderState({ interaction: { kind: "design" } });
    saveBuilderState(state);

    const loaded = loadBuilderState();
    expect(loaded).not.toBeNull();
    expect(loaded!.interaction).toEqual({ kind: "design" });
  });

  it("handles active reattach mode", () => {
    const state = makeBuilderState({
      interaction: { kind: "reattach", clueIndex: 2 },
    });
    saveBuilderState(state);

    const loaded = loadBuilderState();
    expect(loaded).not.toBeNull();
    expect(loaded!.interaction).toEqual({ kind: "reattach", clueIndex: 2 });
  });

  it("handles active join mode", () => {
    const state = makeBuilderState({
      interaction: { kind: "join", sourceWordId: "3-2-down" },
    });
    saveBuilderState(state);

    const loaded = loadBuilderState();
    expect(loaded).not.toBeNull();
    expect(loaded!.interaction).toEqual({ kind: "join", sourceWordId: "3-2-down" });
  });
});

// ===========================================================================
// savePlayerProgress / loadPlayerProgress
// ===========================================================================

describe("savePlayerProgress and loadPlayerProgress", () => {
  it("saves and loads PlayerProgress round-trip", () => {
    const progress = makePlayerProgress();
    savePlayerProgress("puzzle-abc", progress);

    const loaded = loadPlayerProgress("puzzle-abc");
    expect(loaded).not.toBeNull();
    expect(loaded!.key).toBe("puzzle-abc");
    expect(loaded!.gridSize).toBe(2);
    expect(loaded!.letters).toEqual([
      ["A", "B"],
      ["C", null],
    ]);
  });

  it("stores data under playerStorageKey(puzzleKey)", () => {
    const progress = makePlayerProgress({ key: "xyz" });
    savePlayerProgress("xyz", progress);

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      PLAYER_STORAGE_KEY_PREFIX + "xyz",
      expect.any(String),
    );
  });

  it("returns null when no player progress exists", () => {
    expect(loadPlayerProgress("nonexistent")).toBeNull();
  });

  it("returns null when stored value is not valid JSON", () => {
    store[PLAYER_STORAGE_KEY_PREFIX + "bad"] = "not-json{{{";
    expect(loadPlayerProgress("bad")).toBeNull();
  });

  it("returns null when stored value is a non-object JSON value", () => {
    store[PLAYER_STORAGE_KEY_PREFIX + "odd"] = JSON.stringify(42);
    expect(loadPlayerProgress("odd")).toBeNull();
  });

  it("overwrites previous progress on save", () => {
    const progress1 = makePlayerProgress({ key: "abc", letters: [["A"]] });
    const progress2 = makePlayerProgress({ key: "abc", letters: [["B"]] });

    savePlayerProgress("abc", progress1);
    savePlayerProgress("abc", progress2);

    const loaded = loadPlayerProgress("abc");
    expect(loaded).not.toBeNull();
    expect(loaded!.letters).toEqual([["B"]]);
  });

  it("preserves null values in letters array", () => {
    const progress: PlayerProgress = {
      key: "nulls",
      gridSize: 2,
      letters: [
        [null, null],
        [null, "X"],
      ],
    };
    savePlayerProgress("nulls", progress);

    const loaded = loadPlayerProgress("nulls");
    expect(loaded).not.toBeNull();
    expect(loaded!.letters).toEqual([
      [null, null],
      [null, "X"],
    ]);
  });

  it("handles different puzzle keys independently", () => {
    const progress1 = makePlayerProgress({ key: "p1", gridSize: 2 });
    const progress2 = makePlayerProgress({ key: "p2", gridSize: 3 });

    savePlayerProgress("p1", progress1);
    savePlayerProgress("p2", progress2);

    const loaded1 = loadPlayerProgress("p1");
    const loaded2 = loadPlayerProgress("p2");

    expect(loaded1!.gridSize).toBe(2);
    expect(loaded2!.gridSize).toBe(3);
  });
});

// ===========================================================================
// clearBuilderState
// ===========================================================================

describe("clearBuilderState", () => {
  it("removes builder state from localStorage", () => {
    const state = makeBuilderState();
    saveBuilderState(state);
    expect(loadBuilderState()).not.toBeNull();

    clearBuilderState();

    expect(localStorageMock.removeItem).toHaveBeenCalledWith(BUILDER_STORAGE_KEY);
    expect(loadBuilderState()).toBeNull();
  });

  it("does nothing when no builder state exists", () => {
    clearBuilderState(); // Should not throw
    expect(localStorageMock.removeItem).toHaveBeenCalledWith(BUILDER_STORAGE_KEY);
  });
});

// ===========================================================================
// clearPlayerProgress
// ===========================================================================

describe("clearPlayerProgress", () => {
  it("removes player progress from localStorage", () => {
    const progress = makePlayerProgress({ key: "abc" });
    savePlayerProgress("abc", progress);
    expect(loadPlayerProgress("abc")).not.toBeNull();

    clearPlayerProgress("abc");

    expect(localStorageMock.removeItem).toHaveBeenCalledWith(
      PLAYER_STORAGE_KEY_PREFIX + "abc",
    );
    expect(loadPlayerProgress("abc")).toBeNull();
  });

  it("does nothing when no player progress exists for the key", () => {
    clearPlayerProgress("nonexistent"); // Should not throw
    expect(localStorageMock.removeItem).toHaveBeenCalledWith(
      PLAYER_STORAGE_KEY_PREFIX + "nonexistent",
    );
  });

  it("does not affect other puzzle keys", () => {
    const progress1 = makePlayerProgress({ key: "p1" });
    const progress2 = makePlayerProgress({ key: "p2" });
    savePlayerProgress("p1", progress1);
    savePlayerProgress("p2", progress2);

    clearPlayerProgress("p1");

    expect(loadPlayerProgress("p1")).toBeNull();
    expect(loadPlayerProgress("p2")).not.toBeNull();
  });
});

// ===========================================================================
// generateUniqueKey
// ===========================================================================

describe("generateUniqueKey", () => {
  it("returns a non-empty string", () => {
    const key = generateUniqueKey();
    expect(typeof key).toBe("string");
    expect(key.length).toBeGreaterThan(0);
  });

  it("returns different strings on successive calls", () => {
    const key1 = generateUniqueKey();
    const key2 = generateUniqueKey();
    expect(key1).not.toBe(key2);
  });
});
<script lang="ts">
  import type { CellData, CellPosition, CheckResult, Direction, MoveDirection, PlayerInteraction, Word } from "$lib/types";
  import { DEFAULT_GRID_SIZE } from "$lib/constants";
  import { deriveWords, assignNumbers, getWordInDirection, getWordCells } from "$lib/grid-logic";
  import { toWordId, getWordLengthPattern } from "$lib/chain-logic";
  import { checkPuzzle, clearErrors } from "$lib/check-logic";
  import { parsePuzzleJSON } from "$lib/import-export";
  import { savePlayerProgress, loadPlayerProgress, clearPlayerProgress } from "$lib/storage";
  import { enterLetter, deleteLetter, moveCursor, computeSelectionChangeForCellClick } from "$lib/cursor-logic";
  import { transitionPlayerInteraction } from "$lib/interaction-machine";

  import CrosswordGrid from "../components/CrosswordGrid.svelte";
  import CluePanel from "../components/CluePanel.svelte";
  import ActiveClueDisplay from "../components/ActiveClueDisplay.svelte";
  import CheckResultDisplay from "../components/CheckResultDisplay.svelte";
  import PlayerActions from "../components/PlayerActions.svelte";
  import ImportScreen from "../components/ImportScreen.svelte";

  // === State ===

  let interaction = $state<PlayerInteraction>({ kind: "noPuzzle" });
  let puzzleKey = $state("");
  let gridSize = $state(DEFAULT_GRID_SIZE);
  let grid = $state<CellData[][]>([]);
  let words = $state<Word[]>([]);
  let title = $state("");
  let author = $state("");

  let selectedCell = $state<CellPosition | null>(null);
  let selectedDirection = $state<Direction>("across");
  let checkResult = $state<CheckResult | null>(null);

  // Clear check result whenever the grid changes (player types, deletes, resets, etc.)
  $effect(() => {
    const _ = grid;
    checkResult = null;
  });

  let importError = $state<string | null>(null);

  // === Derived state ===
  /** The currently selected word (based on selectedCell and selectedDirection). */
  let selectedWord = $derived.by(() => {
    if (!selectedCell) return null;
    return getWordInDirection(words, selectedCell.row, selectedCell.col, selectedDirection);
  });

  let selectedWordId = $derived.by(() => {
    if (!selectedWord) return null;
    return toWordId(selectedWord);
  });

  /** Cells of the currently selected word for highlighting. */
  let highlightedCells = $derived(selectedWord ? getWordCells(selectedWord) : []);

  /** Selected clue info for ActiveClueDisplay. */
  let clueNumber = $derived(selectedWord?.number ?? null);
  let clueDirection = $derived(selectedWord?.direction ?? null);
  let clueText = $derived(selectedWord?.clue ?? null);
  let wordLengthPattern = $derived(
    selectedWord ? getWordLengthPattern(grid, selectedWord, words) : null
  );

  // === Auto-save ===

  $effect(() => {
    if (interaction.kind !== "playing") return;
    const _ = grid;
    const _k = puzzleKey;
    const _g = gridSize;

    const timer = setTimeout(() => {
      const letters: (string | null)[][] = [];
      for (let r = 0; r < gridSize; r++) {
        const row: (string | null)[] = [];
        for (let c = 0; c < gridSize; c++) {
          if (grid[r] && grid[r][c] && !grid[r][c].black) {
            row.push(grid[r][c].playerLetter ?? null);
          } else {
            row.push(null);
          }
        }
        letters.push(row);
      }
      const progress = {
        key: puzzleKey,
        gridSize: gridSize,
        letters,
      };
      savePlayerProgress(puzzleKey, progress);
    }, 500);
    return () => clearTimeout(timer);
  });

  // === Handlers ===

  function handleImport(jsonString: string): void {
    importError = null;

    const result = parsePuzzleJSON(jsonString);

    if ("error" in result) {
      importError = result.error;
      return;
    }

    if (result.type === "incomplete") {
      importError = "This file is an incomplete puzzle. Only complete puzzles can be played.";
      return;
    }

    // result.type === "complete"
    const puzzle = result.data;
    puzzleKey = puzzle.key;
    gridSize = puzzle.gridSize;
    grid = puzzle.grid;

    // Assign numbers to imported words (they may have number: 0 from serialization)
    const importedDerived = deriveWords(grid);
    const importedNumbers = assignNumbers(importedDerived);
    words = puzzle.words.map((w) => ({
      ...w,
      number: importedNumbers.get(`${w.startRow}-${w.startCol}`) ?? w.number,
    }));

    title = puzzle.title;
    author = puzzle.author;

    // Check for saved progress
    const savedProgress = loadPlayerProgress(puzzleKey);
    if (savedProgress && savedProgress.gridSize === puzzle.gridSize) {
      // Overlay saved letters onto grid cells' playerLetter
      const newGrid = grid.map((row) => row.map((cell) => ({ ...cell })));
      for (let r = 0; r < savedProgress.gridSize; r++) {
        for (let c = 0; c < savedProgress.gridSize; c++) {
          if (savedProgress.letters[r] && savedProgress.letters[r][c] !== undefined && savedProgress.letters[r][c] !== null) {
            newGrid[r][c] = { ...newGrid[r][c], playerLetter: savedProgress.letters[r][c] };
          }
        }
      }
      grid = newGrid;
    } else {
      // Initialize playerLetter as null on all cells (already the default from parse)
      // No need to create a separate playerLetters array
    }

    selectedCell = null;
    selectedDirection = "across";
    const next = transitionPlayerInteraction(interaction, { kind: "importSuccess" });
    if (next) interaction = next;
  }

  function handleCellClick(cellPosition: CellPosition): void {
    const result = computeSelectionChangeForCellClick(grid, selectedCell, selectedDirection, words, cellPosition);
    selectedCell = result.selectedCell;
    selectedDirection = result.selectedDirection;
  }

  function handleKeyDown(event: KeyboardEvent): void {
    if (!selectedCell) return;

    const key = event.key;

    // Letter keys (A-Z)
    if (/^[a-zA-Z]$/.test(key)) {
      event.preventDefault();
      const result = enterLetter(grid, selectedCell, selectedDirection, key.toUpperCase(), "player");
      grid = result.grid;
      selectedCell = result.nextCell;
      selectedDirection = result.nextDirection;
      return;
    }

    // Backspace
    if (key === "Backspace") {
      event.preventDefault();
      const result = deleteLetter(grid, selectedCell, selectedDirection, "player");
      grid = result.grid;
      selectedCell = result.nextCell;
      selectedDirection = result.nextDirection;
      return;
    }

    // Arrow keys
    if (key.startsWith("Arrow")) {
      event.preventDefault();
      const keyToDirection: Record<string, MoveDirection> = {
        ArrowUp: "up",
        ArrowDown: "down",
        ArrowLeft: "left",
        ArrowRight: "right",
      };
      const direction = keyToDirection[key];
      if (direction) {
        const result = moveCursor(grid, selectedCell, direction);
        grid = result.grid;
        selectedCell = result.nextCell;
        selectedDirection = result.nextDirection;
      }
      return;
    }
  }

  function handleClueClick(wordId: string): void {
    // Find the word and select its first cell
    const word = words.find((w) => toWordId(w) === wordId);
    if (word) {
      selectedCell = { row: word.startRow, col: word.startCol };
      selectedDirection = word.direction;
    }
  }

  function handleCheck(): void {
    if (interaction.kind !== "playing") return;
    checkResult = checkPuzzle(grid);
  }

  function handleClearErrors(): void {
    if (!checkResult) return;
    grid = clearErrors(grid, checkResult);
  }

  function handleReset(): void {
    if (interaction.kind !== "playing") return;
    if (!window.confirm("Are you sure you want to reset all progress? This cannot be undone.")) {
      return;
    }
    // Reset playerLetter to null on all cells
    grid = grid.map((row) =>
      row.map((cell) => ({ ...cell, playerLetter: null }))
    );
    selectedCell = null;
    selectedDirection = "across";
    clearPlayerProgress(puzzleKey);
  }

  function handleImportNew(): void {
    const next = transitionPlayerInteraction(interaction, { kind: "goToImport" });
    if (next) interaction = next;
    importError = null;
    selectedCell = null;
  }
</script>

{#if interaction.kind === "noPuzzle"}
  <ImportScreen onImport={handleImport} error={importError} />
{:else}
  <div class="min-h-screen bg-slate-50">
    <!-- Header -->
    <div class="bg-white border-b border-gray-200 px-4 py-3">
      <div class="max-w-7xl mx-auto flex items-center justify-between">
        <div>
          <h1 class="text-xl font-bold text-gray-900">{title || 'Untitled Puzzle'}</h1>
          {#if author}
            <p class="text-sm text-gray-500">by {author}</p>
          {/if}
        </div>
      </div>
    </div>

    <!-- Main content -->
    <div class="max-w-7xl mx-auto px-4 py-4">
      <div class="flex flex-col lg:flex-row gap-6">
        <!-- Left: Grid area -->
        <div class="flex-shrink-0">
          <ActiveClueDisplay
            clueNumber={clueNumber}
            clueDirection={clueDirection}
            clueText={clueText}
            {wordLengthPattern}
          />
          <CrosswordGrid
            {grid}
            {words}
            letterSource="player"
            {selectedCell}
            {highlightedCells}
            onCellClick={handleCellClick}
            onKeyDown={handleKeyDown}
          />
          <ActiveClueDisplay
            clueNumber={clueNumber}
            clueDirection={clueDirection}
            clueText={clueText}
            {wordLengthPattern}
          />
        </div>

        <!-- Right: Clues and actions -->
        <div class="flex-1 min-w-0">
          <div class="mb-4">
            <CluePanel
              {words}
              {grid}
              selectedWordId={selectedWordId}
              onClueClick={handleClueClick}
            />
          </div>

          <div class="mb-4">
            <CheckResultDisplay
              {checkResult}
              onClearErrors={handleClearErrors}
            />
          </div>

          <PlayerActions
            onCheck={handleCheck}
            onReset={handleReset}
            onImportNew={handleImportNew}
            puzzleLoaded={interaction.kind === "playing"}
          />
        </div>
      </div>
    </div>
  </div>
{/if}
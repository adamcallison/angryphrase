<script lang="ts">
  import type { BuilderInteraction, BuilderState, CellData, CellPosition, Direction, DisplacedClue, MoveDirection, Word, WordId, WordMetadata } from "$lib/types";
  import { SvelteMap } from "svelte/reactivity";
  import { DEFAULT_GRID_SIZE } from "$lib/constants";
  import { createEmptyGrid, deriveWords, assignNumbers, getWordInDirection, getWordCells } from "$lib/grid-logic";
  import { toWordId, joinWords, unjoinWord } from "$lib/chain-logic";
  import { reconcileWordsOnGridChange, reattachClue } from "$lib/clue-logic";
  import { isGridBlank } from "$lib/grid-logic";
  import { canExportAsComplete } from "$lib/validation";
  import { serializeIncompletePuzzle, serializeCompletePuzzle, parsePuzzleJSON } from "$lib/import-export";
  import { saveBuilderState, loadBuilderState, clearBuilderState, generateUniqueKey } from "$lib/storage";
  import { transitionInteraction } from "$lib/interaction-machine";
  import { enterLetter, deleteLetter, moveCursor, computeSelectionChangeForCellClick } from "$lib/cursor-logic";

  import CrosswordGrid from "../components/CrosswordGrid.svelte";
  import EditableCluePanel from "../components/EditableCluePanel.svelte";
  import DisplacedCluesPanel from "../components/DisplacedCluesPanel.svelte";
  import ModeToggle from "../components/ModeToggle.svelte";
  import MarkerToolbar from "../components/MarkerToolbar.svelte";
  import PuzzleMetadataForm from "../components/PuzzleMetadataForm.svelte";
  import GridSizeSelector from "../components/GridSizeSelector.svelte";
  import BuilderActions from "../components/BuilderActions.svelte";
  import Toast from "../components/Toast.svelte";

  // === Core data state ===
  let key = $state(generateUniqueKey());
  let gridSize = $state(DEFAULT_GRID_SIZE);
  let grid = $state<CellData[][]>(createEmptyGrid(DEFAULT_GRID_SIZE));
  let wordMetadata = new SvelteMap<string, WordMetadata>();
  let displacedClues = $state<DisplacedClue[]>([]);
  let title = $state("");
  let author = $state("");

  // === UI state ===
  let interaction = $state<BuilderInteraction>({ kind: "design" });
  let selectedCell = $state<CellPosition | null>(null);
  let selectedDirection = $state<Direction>("across");

  // Toast
  let toastMessage = $state("");
  let toastTrigger = $state(0);

  $effect(() => {
    if (toastTrigger === 0) return;
    const timer = setTimeout(() => {
      toastTrigger = 0;
    }, 3000);
    return () => clearTimeout(timer);
  });

  function showToast(message: string): void {
    toastMessage = message;
    toastTrigger++;
  }

  // === Derived state ===

  /** Derive words from grid. */
  let derivedWords = $derived(deriveWords(grid));

  /** Number map for cell and word numbering. */
  let numberMap = $derived(assignNumbers(derivedWords));

  /** Merge derived words with stored metadata and assigned numbers. */
  let words = $derived.by(() => {
    const merged: Word[] = derivedWords.map((dw) => {
      const id = toWordId(dw);
      const meta = wordMetadata.get(id);
      return {
        ...dw,
        number: numberMap.get(`${dw.startRow}-${dw.startCol}`) ?? 0,
        clue: meta?.clue ?? "",
        nextWord: meta?.nextWord ?? null,
      };
    });
    return merged;
  });

  /** Currently selected word. */
  let selectedWord = $derived.by(() => {
    if (!selectedCell) return null;
    return getWordInDirection(words, selectedCell.row, selectedCell.col, selectedDirection);
  });

  let selectedWordId = $derived(selectedWord ? toWordId(selectedWord) : null);

  /** Cells of the currently selected word for highlighting. */
  let highlightedCells = $derived(selectedWord ? getWordCells(selectedWord) : []);

  /** Whether the grid is blank (for grid size changes). */
  let gridIsBlank = $derived(isGridBlank(grid, words, displacedClues));

  /** Whether any word has non-empty clue text (for mode switch confirmation). */
  let hasClueText = $derived(words.some((w) => w.clue.trim() !== ""));

  /** Export readiness. */
  let exportCheck = $derived(canExportAsComplete(grid, words));

  // === Derived mode helpers (for template bindings) ===

  /** Base mode for ModeToggle and conditional rendering. */
  let baseMode = $derived<"design" | "fill">(
    interaction.kind === "design" ? "design" : "fill"
  );

  // === Auto-save ===

  $effect(() => {
    // Depend on all state that should trigger auto-save
    const _ = [key, gridSize, grid, wordMetadata, displacedClues, title, author, interaction];
    const timer = setTimeout(() => {
      const state: BuilderState = {
        key,
        gridSize,
        grid,
        wordMetadata,
        displacedClues,
        title,
        author,
        interaction,
        selectedCell,
        selectedDirection,
      };
      saveBuilderState(state);
    }, 500);
    return () => clearTimeout(timer);
  });

  // === Load state on mount ===
  // Use $effect.tracking() to detect first run — a pattern for mount-only effects in Svelte 5
  let hasLoaded = $state(false);

  $effect(() => {
    if (hasLoaded) return;
    hasLoaded = true;
    const saved = loadBuilderState();
    if (saved) {
      key = saved.key;
      gridSize = saved.gridSize;
      grid = saved.grid;

      wordMetadata.clear()
      for (const [id, wm] of saved.wordMetadata.entries()) {
        wordMetadata.set(id, wm);
      }
      displacedClues = saved.displacedClues;
      title = saved.title;
      author = saved.author;
      // Always restore to the base mode — don't re-enter join/reattach sub-modes
      const restoredMode = saved.interaction.kind === "design" ? "design" as const : "fill" as const;
      const next = transitionInteraction(interaction, { kind: "switchMode", mode: restoredMode });
      if (next) interaction = next;
      selectedCell = saved.selectedCell;
      selectedDirection = saved.selectedDirection;
    }
  });

  // === Cancel join/reattach mode on Escape ===

  function handleGlobalKeyDown(e: KeyboardEvent): void {
    if (e.key === "Escape") {
      const next = transitionInteraction(interaction, { kind: "cancel" });
      if (next) interaction = next;
    }
  }

  // === Helper: update wordMetadata from a words array ===

  function syncMetadataFromWords(updatedWords: Word[]): void {
    wordMetadata.clear();
    for (const w of updatedWords) {
      const id = toWordId(w);
      wordMetadata.set(id, { clue: w.clue, nextWord: w.nextWord });
    }
  }

  // === Handlers ===

  function handleCellClick(cellPosition: CellPosition): void {
    switch (interaction.kind) {
      case "design":
        handleDesignModeClick(cellPosition);
        return;
      default:
        handleFillModeClick(cellPosition);
        return;
    }
  }

// --- Design mode: toggle cell black/white ---
  function handleDesignModeClick(cellPosition: CellPosition): void {
    const { row, col } = cellPosition;
    const newGrid = grid.map((r) => r.map((c) => ({ ...c })));
    const wasBlack = newGrid[row][col].black;

    if (wasBlack) {
      // Toggling black → white: make it white with default values
      newGrid[row][col] = {
        black: false,
        puzzleLetter: null,
        playerLetter: null,
        spaceRight: false,
        spaceBottom: false,
        hyphenRight: false,
        hyphenBottom: false,
      };
    } else {
      // Toggling white → black: clear all cell data
      newGrid[row][col] = {
        black: true,
        puzzleLetter: null,
        playerLetter: null,
        spaceRight: false,
        spaceBottom: false,
        hyphenRight: false,
        hyphenBottom: false,
      };
    }

    // Save old words for reconciliation
    const oldWords = [...words];

    // Update grid
    grid = newGrid;

    // Derive new words and reconcile
    const newDerived = deriveWords(grid);
    const result = reconcileWordsOnGridChange(oldWords, newDerived, displacedClues);

    // Update metadata
    syncMetadataFromWords(result.updatedWords);
    displacedClues = result.displacedClues;

    // Clear selection in design mode
    selectedCell = null;

    // Show toasts for shortened words
    for (const w of result.shortenedWords) {
      showToast(`Word ${w.number} ${w.direction === "across" ? "Across" : "Down"} was shortened.`);
    }
  }

  // --- Fill mode: select cell for typing ---
  function handleFillModeClick(cellPosition: CellPosition): void {
    const result = computeSelectionChangeForCellClick(grid, selectedCell, selectedDirection, words, cellPosition);
    selectedCell = result.selectedCell;
    selectedDirection = result.selectedDirection;
  }

  // --- Keyboard handler for Fill mode ---
  function handleKeyDown(event: KeyboardEvent): void {
    if (interaction.kind !== "fill" || !selectedCell) return;
    const key = event.key;

    // Letter keys (A-Z)
    if (/^[a-zA-Z]$/.test(key)) {
      event.preventDefault();
      const result = enterLetter(grid, selectedCell, selectedDirection, key.toUpperCase(), "puzzle");
      grid = result.grid;
      selectedCell = result.nextCell;
      selectedDirection = result.nextDirection;
      return;
    }

    // Backspace
    if (key === "Backspace") {
      event.preventDefault();
      const result = deleteLetter(grid, selectedCell, selectedDirection, "puzzle");
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

  // --- Mode switching ---
  function handleModeChange(newMode: "design" | "fill"): void {
    if (newMode === "design" && hasClueText) {
      if (!window.confirm("Switching to Design mode may affect clues. Continue?")) {
        return;
      }
    }
    const next = transitionInteraction(interaction, { kind: "switchMode", mode: newMode });
    if (next) interaction = next;

    // Clear selection in design mode
    if (newMode === "design") {
      selectedCell = null;
    }
  }

  // --- Clue editing ---
  function handleClueChange(wordId: WordId, newText: string): void {
    const existing = wordMetadata.get(wordId) ?? { clue: "", nextWord: null };
    wordMetadata.set(wordId, { ...existing, clue: newText });
  }

  // --- Join/Unjoin ---
  function handleJoinClick(wordId: WordId): void {
    const next = transitionInteraction(interaction, { kind: "startJoin", sourceWordId: wordId });
    if (next) interaction = next;
  }

  function handleUnjoinClick(wordId: WordId): void {
    const result = unjoinWord(words, wordId);
    if (result) {
      syncMetadataFromWords(result);
    }
  }

  // --- Clue click in clue panel ---
  function handleClueClick(wordId: WordId): void {
    switch (interaction.kind) {
      case "join":
        handleClueClickJoinMode(wordId, interaction.sourceWordId);
        return;
      case "reattach":
        handleClueClickReattachMode(wordId, interaction.clueIndex);
        return;
      case "design":
        handleClueClickDefault(wordId);
        return;
      case "fill":
        handleClueClickDefault(wordId);
        return;
    }
  }

  // --- Join mode: click target clue to complete chain ---
  function handleClueClickJoinMode(wordId: WordId, sourceWordId: WordId): void {
    // Clicking the source clue cancels join
    if (wordId === sourceWordId) {
      const next = transitionInteraction(interaction, { kind: "finishJoin" });
      if (next) interaction = next;
      return;
    }

    // Validate and complete the join
    const result = joinWords(words, sourceWordId, wordId);
    if (result === null) {
      showToast("Cannot join these words. Check that neither word is already in a chain.");
      return;
    }

    // If target had a non-empty clue, it needs to be displaced
    const targetWord = words.find(w => toWordId(w) === wordId);
    if (targetWord && targetWord.clue.trim() !== "") {
      displacedClues = [...displacedClues, {
        id: crypto.randomUUID(),
        clue: targetWord.clue,
        direction: targetWord.direction,
      }];
    }

    syncMetadataFromWords(result);
    const next = transitionInteraction(interaction, { kind: "finishJoin" });
    if (next) interaction = next;
  }

  // --- Reattach mode: navigating clues while selecting reattach target ---
  function handleClueClickReattachMode(wordId: WordId, clueIndex: number): void {

    const result = reattachClue(words, displacedClues, clueIndex, wordId);

    if (result === null) {
      showToast("This word already has a clue.");
      return;
    }

    // Update state from reattachClue result
    syncMetadataFromWords(result.words);
    displacedClues = result.displacedClues;
    const next = transitionInteraction(interaction, { kind: "finishReattach" });
    if (next) interaction = next;
  }


    //const word = words.find((w) => toWordId(w) === wordId);
    //if (word) {
    //  selectedCell = { row: word.startRow, col: word.startCol };
    //  selectedDirection = word.direction;
    //}
  //}

  // --- Default: navigate to the clicked clue ---
  function handleClueClickDefault(wordId: WordId): void {
    const word = words.find((w) => toWordId(w) === wordId);
    if (word) {
      selectedCell = { row: word.startRow, col: word.startCol };
      selectedDirection = word.direction;
    }
  }

  // --- Displaced clue panel ---
  function handleDisplacedClueClick(index: number): void {
    const next = transitionInteraction(interaction, { kind: "startReattach", clueIndex: index });
    if (next) interaction = next;
  }

  function handleDisplacedClueDelete(index: number): void {
    displacedClues = displacedClues.filter((_, i) => i !== index);

    // If in reattach mode, adjust or cancel accordingly
    if (interaction.kind === "reattach") {
      if (interaction.clueIndex === index) {
        const next = transitionInteraction(interaction, { kind: "activeClueDeleted" });
        if (next) interaction = next;
      } else if (interaction.clueIndex > index) {
        const next = transitionInteraction(interaction, {
          kind: "clueIndexChanged",
          newIndex: interaction.clueIndex - 1,
        });
        if (next) interaction = next;
      }
    }
  }

  // --- Grid size change ---
  function handleSizeChange(newSize: number): void {
    if (!gridIsBlank) return;
    if (newSize < 2) return;
    gridSize = newSize;
    grid = createEmptyGrid(newSize);
    wordMetadata.clear();
    displacedClues = [];
    selectedCell = null;
  }

  // --- Metadata ---
  function handleTitleChange(newTitle: string): void {
    title = newTitle;
  }

  function handleAuthorChange(newAuthor: string): void {
    author = newAuthor;
  }

  // --- Marker toolbar ---
  function handleToggleMarker(marker: "spaceRight" | "spaceBottom" | "hyphenRight" | "hyphenBottom"): void {
    if (!selectedCell || interaction.kind === "design") return;
    const { row, col } = selectedCell;
    if (grid[row][col].black) return;

    const newGrid = grid.map((r) => r.map((c) => ({ ...c })));
    const cell = { ...newGrid[row][col] };

    // Mutually exclusive: spaceRight vs hyphenRight, spaceBottom vs hyphenBottom
    if (marker === "spaceRight") {
      cell.spaceRight = !cell.spaceRight;
      if (cell.spaceRight) cell.hyphenRight = false;
    } else if (marker === "hyphenRight") {
      cell.hyphenRight = !cell.hyphenRight;
      if (cell.hyphenRight) cell.spaceRight = false;
    } else if (marker === "spaceBottom") {
      cell.spaceBottom = !cell.spaceBottom;
      if (cell.spaceBottom) cell.hyphenBottom = false;
    } else if (marker === "hyphenBottom") {
      cell.hyphenBottom = !cell.hyphenBottom;
      if (cell.hyphenBottom) cell.spaceBottom = false;
    }

    newGrid[row][col] = cell;
    grid = newGrid;
  }

  // Selected cell data for MarkerToolbar
  let selectedCellData = $derived.by(() => {
    if (!selectedCell) return null;
    const { row, col } = selectedCell;
    if (row < 0 || row >= gridSize || col < 0 || col >= gridSize) return null;
    return grid[row][col];
  });

  // --- Save/Export ---
  function handleSave(): void {
    const json = serializeIncompletePuzzle(grid, words, displacedClues, { title, author }, key);
    downloadJSON(json, `puzzle-${key.slice(0, 8)}-incomplete.json`);
  }

  function handleExportComplete(): void {
    if (!exportCheck.canExport) return;
    const result = serializeCompletePuzzle(grid, words, { title, author }, key);
    if ("error" in result) {
      showToast(result.error);
      return;
    }
    downloadJSON(result, `puzzle-${key.slice(0, 8)}-complete.json`);
  }

  function downloadJSON(data: object, filename: string): void {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // --- Import ---
  function handleImport(): void {
    // Check if current puzzle has content
    if (!gridIsBlank) {
      if (!window.confirm("Importing will replace your current puzzle. Continue?")) {
        return;
      }
    }

    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const content = reader.result as string;
        const result = parsePuzzleJSON(content);

        if ("error" in result) {
          showToast(`Import failed: ${result.error}`);
          return;
        }

        if (result.type === "complete") {
          const puzzle = result.data;
          // Convert complete puzzle to builder state
          key = puzzle.key;
          gridSize = puzzle.gridSize;
          grid = puzzle.grid;
          title = puzzle.title;
          author = puzzle.author;
          // Derive words from grid and merge with puzzle's word metadata
          const dw = deriveWords(grid);
          wordMetadata.clear()
          for (const w of puzzle.words) {
            const id = toWordId(w);
            wordMetadata.set(id, { clue: w.clue, nextWord: w.nextWord ?? null });
          }
          // Also check derived words not in puzzle
          for (const d of dw) {
            const id = toWordId(d);
            if (!wordMetadata.has(id)) {
              wordMetadata.set(id, { clue: "", nextWord: null });
            }
          }
          displacedClues = [];
        } else {
          // Incomplete format
          const puzzle = result.data;
          key = puzzle.key;
          gridSize = puzzle.gridSize;
          grid = puzzle.grid;
          title = puzzle.title;
          author = puzzle.author;
          wordMetadata.clear()
          for (const w of puzzle.words) {
            const id = toWordId(w);
            wordMetadata.set(id, { clue: w.clue, nextWord: w.nextWord ?? null });
          }
          displacedClues = puzzle.displacedClues;
        }

        selectedCell = null;
        selectedDirection = "across";
        const next = transitionInteraction(interaction, { kind: "switchMode", mode: "fill" });
        if (next) interaction = next;
      };
      reader.readAsText(file);
    };
    input.click();
  }

  // --- Reset ---
  function handleReset(): void {
    if (!window.confirm("Reset to initial state? This will clear all work and cannot be undone.")) {
      return;
    }
    key = generateUniqueKey();
    gridSize = DEFAULT_GRID_SIZE;
    grid = createEmptyGrid(DEFAULT_GRID_SIZE);
    wordMetadata.clear();
    displacedClues = [];
    title = "";
    author = "";
    const next = transitionInteraction(interaction, { kind: "switchMode", mode: "design" });
    if (next) interaction = next;
    selectedCell = null;
    selectedDirection = "across";
    clearBuilderState();
  }
</script>

<svelte:window onkeydown={handleGlobalKeyDown} />

<div class="min-h-screen bg-slate-50">
  <!-- Header -->
  <div class="bg-white border-b border-gray-200 px-4 py-3">
    <div class="max-w-7xl mx-auto flex items-center justify-between">
      <h1 class="text-xl font-bold text-gray-900">Crossword Builder</h1>
      <div class="flex items-center gap-4">
        <ModeToggle mode={baseMode} onModeChange={handleModeChange} />
      </div>
    </div>
  </div>

  <!-- Main content -->
  <div class="max-w-7xl mx-auto px-4 py-4">
    <div class="flex flex-col lg:flex-row gap-6">
      <!-- Left: Controls + Grid -->
      <div class="flex-shrink-0 flex flex-col gap-3">
        <!-- Metadata -->
        <PuzzleMetadataForm
          {title}
          {author}
          onTitleChange={handleTitleChange}
          onAuthorChange={handleAuthorChange}
        />

        <!-- Grid size -->
        <GridSizeSelector
          {gridSize}
          isBlank={gridIsBlank}
          onSizeChange={handleSizeChange}
        />

        <!-- Marker toolbar (Fill mode only) -->
        {#if baseMode === "fill"}
          <MarkerToolbar
            cell={selectedCellData}
            onToggleMarker={handleToggleMarker}
          />
        {/if}

        <!-- Mode indicator for reattach/join -->
        {#if interaction.kind === "join"}
          <div class="bg-blue-50 border border-blue-200 rounded px-3 py-2 text-sm text-blue-700">
            Click the next word in the clue list to link it. Press Escape to cancel.
          </div>
        {/if}
        {#if interaction.kind === "reattach"}
          <div class="bg-amber-50 border border-amber-200 rounded px-3 py-2 text-sm text-amber-700">
            Click a word in the grid to attach this clue. Press Escape to cancel.
          </div>
        {/if}

        <!-- Grid -->
        <CrosswordGrid
          {grid}
          {words}
          letterSource="puzzle"
          {selectedCell}
          {highlightedCells}
          onCellClick={handleCellClick}
          onKeyDown={handleKeyDown}
        />
      </div>

      <!-- Right: Clues + Actions -->
      <div class="flex-1 min-w-0 flex flex-col gap-4">
        <div class="flex-1 overflow-y-auto" style="max-height: 60vh;">
          <EditableCluePanel
            {words}
            {grid}
            {selectedWordId}
            onClueClick={handleClueClick}
            onClueChange={handleClueChange}
            onJoinClick={handleJoinClick}
            onUnjoinClick={handleUnjoinClick}
            interactionMode={
              interaction.kind === "join"
                ? { kind: "join", sourceWordId: interaction.sourceWordId }
                : { kind: "idle" }
            }
          />
        </div>

        {#if displacedClues.length > 0}
          <DisplacedCluesPanel
            {displacedClues}
            reattachMode={interaction.kind === "reattach"}
            selectedClueIndex={interaction.kind === "reattach" ? interaction.clueIndex : null}
            onReattachClick={handleDisplacedClueClick}
            onDelete={handleDisplacedClueDelete}
          />
        {/if}

        <BuilderActions
          canExportComplete={exportCheck.canExport}
          exportErrors={exportCheck.errors}
          onSave={handleSave}
          onExportComplete={handleExportComplete}
          onImport={handleImport}
          onReset={handleReset}
        />
      </div>
    </div>
  </div>

  <Toast message={toastMessage} visible={toastTrigger > 0} />
</div>
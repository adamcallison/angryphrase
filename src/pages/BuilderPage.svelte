<script lang="ts">
  import type { BuilderInteraction, CellData, CellMarker, CellPosition, Direction, DisplacedClue, MoveDirection, Word, WordId, WordMetadata } from "$lib/types";
  import { SvelteMap } from "svelte/reactivity";
  import { DEFAULT_GRID_SIZE, TOAST_DURATION_MS, AUTOSAVE_DELAY_MS } from "$lib/constants";
  import { createEmptyGrid, deriveWords, assignNumbers, getWordInDirection, getWordCells, toggleCellBlack, toggleMarker } from "$lib/grid-logic";
  import { toWordId, joinWordsAndDisplace, unjoinWord } from "$lib/chain-logic";
  import { reattachClue } from "$lib/clue-logic";
  import { isGridBlank } from "$lib/grid-logic";
  import { canExportAsComplete } from "$lib/validation";
  import { serializeIncompletePuzzle, serializeCompletePuzzle, parsePuzzleJSON } from "$lib/import-export";
  import { saveBuilderState, loadBuilderState, clearBuilderState, generateUniqueKey } from "$lib/storage";
  import { hydrateBuilderStateFromImport } from "$lib/builder-state";
  import { transitionBuilderInteraction } from "$lib/interaction-machine";
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
  let builderData = $state({
    key: generateUniqueKey(),
    gridSize: DEFAULT_GRID_SIZE,
    grid: createEmptyGrid(DEFAULT_GRID_SIZE) as CellData[][],
    wordMetadata: new SvelteMap<string, WordMetadata>(),
    displacedClues: [] as DisplacedClue[],
    title: "",
    author: "",
  });

  // === UI state ===
  let interaction = $state<BuilderInteraction>({ kind: "design" });
  let cursor = $state<{ cell: CellPosition | null; direction: Direction }>({ cell: null, direction: "across" });

  // Toast
  let toastMessage = $state("");
  let toastTrigger = $state(0);

  $effect(() => {
    if (toastTrigger === 0) return;
    const timer = setTimeout(() => {
      toastTrigger = 0;
    }, TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  });

  function showToast(message: string): void {
    toastMessage = message;
    toastTrigger++;
  }

  // === Derived state ===

  /** Derive words from grid. */
  let derivedWords = $derived(deriveWords(builderData.grid));

  /** Number map for cell and word numbering. */
  let numberMap = $derived(assignNumbers(derivedWords));

  /** Merge derived words with stored metadata and assigned numbers. */
  let words = $derived.by(() => {
    const merged: Word[] = derivedWords.map((dw) => {
      const id = toWordId(dw);
      const meta = builderData.wordMetadata.get(id);
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
    if (!cursor.cell) return null;
    return getWordInDirection(words, cursor.cell.row, cursor.cell.col, cursor.direction);
  });

  let selectedWordId = $derived(cursor.cell ? toWordId(selectedWord!) : null);

  /** Cells of the currently selected word for highlighting. */
  let highlightedCells = $derived(selectedWord ? getWordCells(selectedWord) : []);

  /** Whether the grid is blank (for grid size changes). */
  let gridIsBlank = $derived(isGridBlank(builderData.grid, words, builderData.displacedClues));

  /** Whether any word has non-empty clue text (for mode switch confirmation). */
  let hasClueText = $derived(words.some((w) => w.clue.trim() !== ""));

  /** Export readiness. */
  let exportCheck = $derived(canExportAsComplete(builderData.grid, words));

  // === Derived mode helpers (for template bindings) ===

  /** Base mode for ModeToggle and conditional rendering. */
  let baseMode = $derived<"design" | "fill">(
    interaction.kind === "design" ? "design" : "fill"
  );

  // === Auto-save ===

  let stateSnapshot = $derived.by(() => ({
    key: builderData.key,
    gridSize: builderData.gridSize,
    grid: builderData.grid,
    wordMetadata: builderData.wordMetadata,
    displacedClues: builderData.displacedClues,
    title: builderData.title,
    author: builderData.author,
    interaction,
    cursor: { cell: cursor.cell, direction: cursor.direction },
  }));

  $effect(() => {
    const _ = stateSnapshot;
    const timer = setTimeout(() => {
      saveBuilderState(_);
    }, AUTOSAVE_DELAY_MS);
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
      builderData.key = saved.key;
      builderData.gridSize = saved.gridSize;
      builderData.grid = saved.grid;

      builderData.wordMetadata.clear();
      for (const [id, wm] of saved.wordMetadata.entries()) {
        builderData.wordMetadata.set(id, wm);
      }
      builderData.displacedClues = saved.displacedClues;
      builderData.title = saved.title;
      builderData.author = saved.author;
      // Always restore to the base mode — don't re-enter join/reattach sub-modes
      const restoredMode = saved.interaction.kind === "design" ? "design" as const : "fill" as const;
      const next = transitionBuilderInteraction(interaction, { kind: "switchMode", mode: restoredMode });
      if (next) interaction = next;
      cursor.cell = saved.cursor.cell;
      cursor.direction = saved.cursor.direction;
    }
  });

  // === Cancel join/reattach mode on Escape ===

  function handleGlobalKeyDown(e: KeyboardEvent): void {
    if (e.key === "Escape") {
      const next = transitionBuilderInteraction(interaction, { kind: "cancel" });
      if (next) interaction = next;
    }
  }

  // === Helpers: wordMetadata population ===

  function syncMetadataFromWords(updatedWords: Word[]): void {
    builderData.wordMetadata.clear();
    for (const w of updatedWords) {
      const id = toWordId(w);
      builderData.wordMetadata.set(id, { clue: w.clue, nextWord: w.nextWord ?? null });
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
    const { grid: newGrid, result } = toggleCellBlack(builderData.grid, cellPosition, words, builderData.displacedClues);

    builderData.grid = newGrid;
    syncMetadataFromWords(result.updatedWords);
    builderData.displacedClues = result.displacedClues;
    cursor.cell = null;

    for (const w of result.shortenedWords) {
      showToast(`Word ${w.number} ${w.direction === "across" ? "Across" : "Down"} was shortened.`);
    }
  }

  // --- Fill mode: select cell for typing ---
  function handleFillModeClick(cellPosition: CellPosition): void {
    const result = computeSelectionChangeForCellClick(builderData.grid, cursor.cell, cursor.direction, words, cellPosition);
    cursor.cell = result.selectedCell;
    cursor.direction = result.selectedDirection;
  }

  // --- Keyboard handler for Fill mode ---
  function handleKeyDown(event: KeyboardEvent): void {
    if (interaction.kind !== "fill" || !cursor.cell) return;
    const key = event.key;

    // Letter keys (A-Z)
    if (/^[a-zA-Z]$/.test(key)) {
      event.preventDefault();
      const result = enterLetter(builderData.grid, cursor.cell, cursor.direction, key.toUpperCase(), "puzzle");
      builderData.grid = result.grid;
      cursor.cell = result.nextCell;
      cursor.direction = result.nextDirection;
      return;
    }

    // Backspace
    if (key === "Backspace") {
      event.preventDefault();
      const result = deleteLetter(builderData.grid, cursor.cell, cursor.direction, "puzzle");
      builderData.grid = result.grid;
      cursor.cell = result.nextCell;
      cursor.direction = result.nextDirection;
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
        const result = moveCursor(builderData.grid, cursor.cell, direction);
        builderData.grid = result.grid;
        cursor.cell = result.nextCell;
        cursor.direction = result.nextDirection;
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
    const next = transitionBuilderInteraction(interaction, { kind: "switchMode", mode: newMode });
    if (next) interaction = next;

    // Clear selection in design mode
    if (newMode === "design") {
      cursor.cell = null;
    }
  }

  // --- Clue editing ---
  function handleClueChange(wordId: WordId, newText: string): void {
    const existing = builderData.wordMetadata.get(wordId) ?? { clue: "", nextWord: null };
    builderData.wordMetadata.set(wordId, { ...existing, clue: newText });
  }

  // --- Join/Unjoin ---
  function handleJoinClick(wordId: WordId): void {
    const next = transitionBuilderInteraction(interaction, { kind: "startJoin", sourceWordId: wordId });
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
      const next = transitionBuilderInteraction(interaction, { kind: "finishJoin" });
      if (next) interaction = next;
      return;
    }

    // Validate and complete the join, displacing the target's clue if non-empty
    const result = joinWordsAndDisplace(words, sourceWordId, wordId, builderData.displacedClues);
    if (result === null) {
      showToast("Cannot join these words. Check that neither word is already in a chain.");
      return;
    }

    syncMetadataFromWords(result.words);
    builderData.displacedClues = result.displacedClues;
    const next = transitionBuilderInteraction(interaction, { kind: "finishJoin" });
    if (next) interaction = next;
  }

  // --- Reattach mode: navigating clues while selecting reattach target ---
  function handleClueClickReattachMode(wordId: WordId, clueIndex: number): void {

    const result = reattachClue(words, builderData.displacedClues, clueIndex, wordId);

    if (result === null) {
      showToast("This word already has a clue.");
      return;
    }

    // Update state from reattachClue result
    syncMetadataFromWords(result.words);
    builderData.displacedClues = result.displacedClues;
    const next = transitionBuilderInteraction(interaction, { kind: "finishReattach" });
    if (next) interaction = next;
  }

  // --- Default: navigate to the clicked clue ---
  function handleClueClickDefault(wordId: WordId): void {
    const word = words.find((w) => toWordId(w) === wordId);
    if (word) {
      cursor.cell = { row: word.startRow, col: word.startCol };
      cursor.direction = word.direction;
    }
  }

  // --- Displaced clue panel ---
  function handleDisplacedClueClick(index: number): void {
    const next = transitionBuilderInteraction(interaction, { kind: "startReattach", clueIndex: index });
    if (next) interaction = next;
  }

  function handleDisplacedClueDelete(index: number): void {
    builderData.displacedClues = builderData.displacedClues.filter((_, i) => i !== index);

    // If in reattach mode, adjust or cancel accordingly
    if (interaction.kind === "reattach") {
      if (interaction.clueIndex === index) {
        const next = transitionBuilderInteraction(interaction, { kind: "activeClueDeleted" });
        if (next) interaction = next;
      } else if (interaction.clueIndex > index) {
        const next = transitionBuilderInteraction(interaction, {
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
    builderData.gridSize = newSize;
    builderData.grid = createEmptyGrid(newSize);
    builderData.wordMetadata.clear();
    builderData.displacedClues = [];
    cursor.cell = null;
  }

  // --- Metadata ---
  function handleTitleChange(newTitle: string): void {
    builderData.title = newTitle;
  }

  function handleAuthorChange(newAuthor: string): void {
    builderData.author = newAuthor;
  }

// --- Marker toolbar ---
  function handleToggleMarker(marker: CellMarker): void {
    if (!cursor.cell || interaction.kind === "design") return;
    const result = toggleMarker(builderData.grid, cursor.cell, marker);
    if (result) builderData.grid = result;
  }

  // Selected cell data for MarkerToolbar
  let selectedCellData = $derived.by(() => {
    if (!cursor.cell) return null;
    const { row, col } = cursor.cell;
    if (row < 0 || row >= builderData.gridSize || col < 0 || col >= builderData.gridSize) return null;
    return builderData.grid[row][col];
  });

  // --- Save/Export ---
  function handleSave(): void {
    const json = serializeIncompletePuzzle(builderData.grid, words, builderData.displacedClues, { title: builderData.title, author: builderData.author }, builderData.key);
    downloadJSON(json, `puzzle-${builderData.key.slice(0, 8)}-incomplete.json`);
  }

  function handleExportComplete(): void {
    if (!exportCheck.canExport) return;
    const result = serializeCompletePuzzle(builderData.grid, words, { title: builderData.title, author: builderData.author }, builderData.key);
    if ("error" in result) {
      showToast(result.error);
      return;
    }
    downloadJSON(result, `puzzle-${builderData.key.slice(0, 8)}-complete.json`);
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
  function handleImport(jsonString: string): void {
    if (!gridIsBlank) {
      if (!window.confirm("Importing will replace your current puzzle. Continue?")) {
        return;
      }
    }

    const result = parsePuzzleJSON(jsonString);

    if ("error" in result) {
      showToast(`Import failed: ${result.error}`);
      return;
    }

    const snapshot = hydrateBuilderStateFromImport(result.data, result.type === "complete");
    builderData.key = snapshot.key;
    builderData.gridSize = snapshot.gridSize;
    builderData.grid = snapshot.grid;
    builderData.title = snapshot.title;
    builderData.author = snapshot.author;
    builderData.wordMetadata.clear();
    for (const [id, wm] of snapshot.wordMetadata.entries()) {
      builderData.wordMetadata.set(id, wm);
    }
    builderData.displacedClues = snapshot.displacedClues;

    cursor.cell = null;
    cursor.direction = "across";
    const next = transitionBuilderInteraction(interaction, { kind: "switchMode", mode: "fill" });
    if (next) interaction = next;
  }

  // --- Reset ---
  function handleReset(): void {
    if (!window.confirm("Reset to initial state? This will clear all work and cannot be undone.")) {
      return;
    }
    builderData.key = generateUniqueKey();
    builderData.gridSize = DEFAULT_GRID_SIZE;
    builderData.grid = createEmptyGrid(DEFAULT_GRID_SIZE);
    builderData.wordMetadata.clear();
    builderData.displacedClues = [];
    builderData.title = "";
    builderData.author = "";
    const next = transitionBuilderInteraction(interaction, { kind: "switchMode", mode: "design" });
    if (next) interaction = next;
    cursor.cell = null;
    cursor.direction = "across";
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
          title={builderData.title}
          author={builderData.author}
          onTitleChange={handleTitleChange}
          onAuthorChange={handleAuthorChange}
        />

        <!-- Grid size -->
        <GridSizeSelector
          gridSize={builderData.gridSize}
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
          grid={builderData.grid}
          {words}
          letterSource="puzzle"
          selectedCell={cursor.cell}
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
            grid={builderData.grid}
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

        {#if builderData.displacedClues.length > 0}
          <DisplacedCluesPanel
            displacedClues={builderData.displacedClues}
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
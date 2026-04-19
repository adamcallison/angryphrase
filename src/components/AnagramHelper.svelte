<script lang="ts">
  import type { CellData, Word } from "$lib/types";
  import { getWordCells, getSingleWordLengthPattern } from "$lib/grid-logic";
  import { computeAnagramState, deriveDisplayLetters, validateInput, shuffleNonFixedLetters } from "$lib/anagram-logic";
  import Cell from "./Cell.svelte";

  let {
    word,
    grid,
    onClose,
  }: {
    word: Word;
    grid: CellData[][];
    onClose: () => void;
  } = $props();

  // === Computed state from word + grid ===

  let anagramState = $derived(computeAnagramState(word, grid));
  
  let wordCells = $derived(getWordCells(word));
  let wordNumber = $derived(word.number);
  let wordLengthPattern = $derived(getSingleWordLengthPattern(grid, word));
  let directionLabel = $derived(word.direction === "across" ? "Across" : "Down");

  // === Internal state ===

  let inputText = $state<string>("");
  let shuffledDisplay: (string | null)[] | null = $state(null);

  // Whether the current input is valid (correct length + contains all fixed letters)
  let isValid = $derived(
    validateInput(inputText, anagramState.fixedLetters, anagramState.fixedMask)
  );

  // The display letters for the tile row.
  // If we have a shuffled display (from a scramble), use that.
  // Otherwise, derive from the input text.
  let displayLetters: (string | null)[] = $derived.by(() => {
    if (shuffledDisplay !== null) {
      return shuffledDisplay;
    }
    return deriveDisplayLetters(inputText, anagramState.fixedLetters, anagramState.fixedMask);
  });

  // Whether the scramble button should be enabled
  let canScramble = $derived(
    isValid && anagramState.emptyCount > 0
  );

  // === Re-initialize when word changes ===

  $effect(() => {
    // Re-compute state to track word changes
    const _ = computeAnagramState(word, grid);
    inputText = "";
    shuffledDisplay = null;
  });

  // === Handlers ===

  function handleInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    // Filter to A-Z only, uppercase
    const filtered = target.value.toUpperCase().replace(/[^A-Z]/g, "");
    // Clamp to word length
    const clamped = filtered.slice(0, anagramState.length);
    inputText = clamped;
    // Clear any previous shuffle when input changes
    shuffledDisplay = null;
  }

  function handleScramble(): void {
    if (!canScramble) return;
    shuffledDisplay = shuffleNonFixedLetters(displayLetters, anagramState.fixedMask);
  }

  function handleClose(): void {
    onClose();
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      onClose();
    }
  }

  function handleBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      onClose();
    }
  }
</script>

<svelte:document onkeydown={handleKeydown} />

<div
  class="fixed inset-0 bg-black/50 z-40 flex items-center justify-center"
  role="presentation"
  onclick={handleBackdropClick}
>
  <div
    class="bg-white rounded-lg shadow-xl z-50 w-full max-w-lg mx-4 p-6"
    role="dialog"
    aria-modal="true"
    aria-label="Anagram helper for {wordNumber} {directionLabel}"
  >
    <!-- Header -->
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-lg font-semibold text-gray-900">
        Anagram: {wordNumber} {directionLabel} ({wordLengthPattern})
      </h2>
      <button
        class="text-gray-400 hover:text-gray-600 text-xl leading-none p-1"
        onclick={handleClose}
        aria-label="Close anagram helper"
      >
        &times;
      </button>
    </div>

    <!-- Tile row -->
    <div class="flex items-center mb-6 overflow-x-auto py-2">
      {#each wordCells as cellPos, i (i)}
        {@const cellData = grid[cellPos.row][cellPos.col]}
        {@const isLast = i === wordCells.length - 1}
        {@const markerSpaceRight = !isLast && word.direction === "across" ? cellData.spaceRight : !isLast && word.direction === "down" ? cellData.spaceBottom : false}
        {@const markerHyphenRight = !isLast && word.direction === "across" ? cellData.hyphenRight : !isLast && word.direction === "down" ? cellData.hyphenBottom : false}
        <Cell
          isBlack={false}
          letter={displayLetters[i] ?? null}
          number={i === 0 ? wordNumber : null}
          isSelected={false}
          isHighlighted={false}
          spaceRight={markerSpaceRight}
          spaceBottom={false}
          hyphenRight={markerHyphenRight}
          hyphenBottom={false}
          onclick={() => {}}
        />
      {/each}
    </div>

    <!-- Letter input -->
    <div class="mb-4">
      <label for="anagram-input" class="block text-sm font-medium text-gray-700 mb-1">
        Type all letters for this word
      </label>
      <input
        id="anagram-input"
        type="text"
        maxlength={anagramState.length}
        value={inputText}
        oninput={handleInput}
        placeholder="Type all letters for this word"
        class="w-full px-3 py-2 border border-gray-300 rounded-md text-lg tracking-widest uppercase
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        autocomplete="off"
      />
      <div class="mt-1 text-sm text-gray-500">
        {inputText.length}/{anagramState.length} letters
        {#if inputText.length === anagramState.length && !isValid}
          <span class="text-red-500 ml-2">Must contain all letters already in the grid</span>
        {/if}
      </div>
    </div>

    <!-- Action buttons -->
    <div class="flex gap-2">
      <button
        class="px-4 py-2 text-sm font-medium rounded bg-blue-600 text-white
          hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500
          focus:ring-offset-1 disabled:opacity-40 disabled:cursor-not-allowed
          disabled:hover:bg-blue-600"
        onclick={handleScramble}
        disabled={!canScramble}
      >
        Scramble
      </button>
      <button
        class="px-4 py-2 text-sm font-medium rounded bg-gray-200 text-gray-700
          hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400
          focus:ring-offset-1"
        onclick={handleClose}
      >
        Close
      </button>
    </div>
  </div>
</div>
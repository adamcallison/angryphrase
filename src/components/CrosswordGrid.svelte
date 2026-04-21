<script lang="ts">
  import type { CellData, Word, CellPosition } from "../lib/types";
  import { assignNumbers } from "../lib/grid-logic";
  import Cell from "./Cell.svelte";

  let {
    grid,
    words,
    displayLetters,
    selectedCell,
    highlightedCells,
    joinMode,
    reattachMode,
    onCellClick,
    onKeyDown,
  }: {
    grid: CellData[][];
    words: Word[];
    displayLetters: (string | null)[][];
    selectedCell: CellPosition | null;
    highlightedCells: CellPosition[];
    joinMode: boolean;
    reattachMode: boolean;
    onCellClick: (row: number, col: number) => void;
    onKeyDown: (key: string) => void;
  } = $props();

  // Derive cell numbers from words
  let numberedCells = $derived(assignNumbers(words));

  // Create a Set of highlighted cell keys for efficient O(1) lookup
  let highlightedSet = $derived(
    new Set(highlightedCells.map((c) => `${c.row}-${c.col}`))
  );

  // Handle keyboard events — intercept letter keys, Backspace, and Arrow keys
  function handleKeyDown(event: KeyboardEvent) {
    const key = event.key;

    if (/^[a-zA-Z]$/.test(key)) {
      event.preventDefault();
      onKeyDown(key.toUpperCase());
    } else if (key === "Backspace") {
      event.preventDefault();
      onKeyDown("Backspace");
    } else if (
      key === "ArrowUp" ||
      key === "ArrowDown" ||
      key === "ArrowLeft" ||
      key === "ArrowRight"
    ) {
      event.preventDefault();
      onKeyDown(key);
    }
    // Ignore all other keys (they pass through normally)
  }

  // Handle cell click via event delegation on the grid container.
  // Each Cell renders data-row and data-col attributes on its root element.
  function handleClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    const cell = target.closest("[data-row]");
    if (cell) {
      const rowAttr = (cell as HTMLElement).getAttribute("data-row");
      const colAttr = (cell as HTMLElement).getAttribute("data-col");
      const row = Number(rowAttr);
      const col = Number(colAttr);
      if (!isNaN(row) && !isNaN(col)) {
        onCellClick(row, col);
      }
    }
  }
</script>

<div
  class="grid focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 {joinMode ? 'grid--join' : reattachMode ? 'grid--reattach' : ''}"
  style="grid-template-columns: repeat({grid.length}, var(--cell-size))"
  tabindex="0"
  role="grid"
  aria-label="Crossword grid"
  onkeydown={handleKeyDown}
  onclick={handleClick}
>
  {#each grid as rowData, row (row)}
    {#each rowData as cellData, col (col)}
      {@const cellNumber = numberedCells.get(`${row}-${col}`) ?? null}
      {@const isSelected =
        selectedCell !== null &&
        selectedCell.row === row &&
        selectedCell.col === col}
      {@const isHighlighted = highlightedSet.has(`${row}-${col}`)}
      <Cell
        isBlack={cellData.black}
        letter={displayLetters[row][col]}
        number={cellNumber}
        isSelected={isSelected}
        isHighlighted={isHighlighted}
        spaceRight={cellData.spaceRight}
        spaceBottom={cellData.spaceBottom}
        hyphenRight={cellData.hyphenRight}
        hyphenBottom={cellData.hyphenBottom}
        row={row}
        col={col}
      />
    {/each}
  {/each}
</div>

<style>
  .grid {
    display: inline-grid;
    outline: none;
  }

  .grid--join {
    cursor: pointer;
  }

  .grid--reattach {
    cursor: crosshair;
  }
</style>
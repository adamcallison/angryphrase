<script lang="ts">
  import type { CellData, Word, CellPosition } from "../lib/types";
  import { assignNumbers, deriveDisplayLetters } from "../lib/grid-logic";
  import Cell from "./Cell.svelte";

  let {
    grid,
    words,
    letterSource,
    selectedCell,
    highlightedCells,
    onCellClick,
  }: {
    grid: CellData[][];
    words: Word[];
    letterSource: "puzzle" | "player";
    selectedCell: CellPosition | null;
    highlightedCells: CellPosition[];
    onCellClick: (cellPosition: CellPosition) => void;
  } = $props();

  // Derive cell numbers from words
  let numberedCells = $derived(assignNumbers(words));

  // Derive display letters from grid based on letterSource
  let displayLetters = $derived(deriveDisplayLetters(grid, letterSource));

  // Create a Set of highlighted cell keys for efficient O(1) lookup
  let highlightedSet = $derived(
    new Set(highlightedCells.map((c) => `${c.row}-${c.col}`))
  );
</script>

<div
  class="grid"
  style="grid-template-columns: repeat({grid.length}, var(--cell-size))"
  tabindex="0"
  role="grid"
  aria-label="Crossword grid"
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
        onclick={() => onCellClick({ row, col })}
      />
    {/each}
  {/each}
</div>

<style>
  .grid {
    display: inline-grid;
    outline: none;
  }
</style>
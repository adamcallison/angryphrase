<script lang="ts">
  import type { GridVM, CellHilite } from '../bindings/viewmodels/gridVM';

  let {
    vm,
    onCellClick,
    allCellsClickable = false,
  }: {
    vm: GridVM;
    onCellClick: (row: number, col: number) => void;
    allCellsClickable?: boolean;
  } = $props();

  function cellColor(hilite: CellHilite): string {
    switch (hilite) {
      case 'selected': return 'bg-hilite-selected';
      case 'in-word': return 'bg-hilite-word';
      case 'none':
      default: return 'bg-white';
    }
  }
</script>

<div
  role="grid"
  aria-label="Crossword grid"
  class="inline-grid @container aspect-square w-[min(100%,calc(var(--grid-size)*2.5rem))] grid-cols-[repeat(var(--grid-size),minmax(0,2.5rem))] grid-rows-[repeat(var(--grid-size),minmax(0,2.5rem))] border-t border-l border-gray-300"
  style="--grid-size: {vm.size}">
  {#each vm.cells as row}
    <div role="row" class="contents">
      {#each row as cell}
        <div
          role="gridcell"
          aria-label={cell.label}
          class="relative border-b border-r border-gray-300 {cell.black ? 'bg-black' : cellColor(cell.hilite)}">
          {#if cell.number !== null}
            <span class="absolute left-0 top-0 px-0.5 text-[calc(30cqi/var(--grid-size))] leading-none text-gray-700">{cell.number}</span>
          {/if}
          {#if !cell.black && cell.letter !== null}
            <span class="absolute inset-0 flex items-center justify-center text-[calc(52cqi/var(--grid-size))] font-bold text-gray-800">{cell.letter}</span>
          {/if}
          {#if cell.separatorRight === 'space'}
            <div class="absolute right-0 top-0 h-full w-0.5 bg-gray-800"></div>
          {:else if cell.separatorRight === 'hyphen'}
            <div class="absolute right-0 top-0 z-grid-decor h-full w-5 translate-x-1/2 translate-y-[-3px] flex items-center justify-center text-5xl leading-none text-gray-800">-</div>
          {/if}
          {#if cell.separatorBottom === 'space'}
            <div class="absolute bottom-0 left-0 h-0.5 w-full bg-gray-800"></div>
          {:else if cell.separatorBottom === 'hyphen'}
            <div class="absolute bottom-0 left-0 z-grid-decor h-5 w-full translate-y-1/2 translate-x-[3px] flex items-center justify-center rotate-90 text-5xl leading-none text-gray-800">-</div>
          {/if}
          {#if !cell.black || allCellsClickable}
            <button
              type="button"
              tabindex="-1"
              aria-label={cell.label}
              class="absolute inset-0 z-grid-decor {allCellsClickable || cell.selectable ? 'cursor-pointer' : ''}"
              onclick={() => (allCellsClickable || cell.selectable) && onCellClick(cell.row, cell.col)}></button>
          {/if}
        </div>
      {/each}
    </div>
  {/each}
</div>

<div class="sr-only" role="status">{vm.cursorAnnouncement}</div>

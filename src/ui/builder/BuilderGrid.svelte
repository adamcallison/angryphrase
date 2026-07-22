<script lang="ts">
  import type { GridVM, CellHilite } from '../bindings/viewmodels/gridVM';

  let {
    vm,
    mode,
    onCellClick,
  }: {
    vm: GridVM;
    mode: 'design' | 'fill';
    onCellClick: (row: number, col: number) => void;
  } = $props();

  function cellColor(hilite: CellHilite): string {
    switch (hilite) {
      case 'selected':
        return 'bg-yellow-400';
      case 'in-word':
        return 'bg-yellow-100';
      case 'none':
      default:
        return 'bg-white';
    }
  }
</script>

<div
  class="select-none inline-grid aspect-square w-[min(100%,calc(var(--grid-size)*2.5rem))] grid-cols-[repeat(var(--grid-size),minmax(0,2.5rem))] grid-rows-[repeat(var(--grid-size),minmax(0,2.5rem))] border-t border-l border-gray-300"
  style="--grid-size: {vm.cells.length}">
  {#each vm.cells as row}
    {#each row as cell}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="relative border-b border-r border-gray-300 {cell.black
          ? 'bg-black'
          : cellColor(cell.hilite)} {mode === 'design' || cell.selectable ? 'cursor-pointer' : ''}"
        onclick={() =>
          (mode === 'design' || cell.selectable) &&
          onCellClick(Number(cell.row), Number(cell.col))}
      >
        {#if cell.number !== null}
          <span class="absolute left-0 top-0 px-0.5 text-[0.6rem] leading-none text-gray-700">
            {Number(cell.number)}
          </span>
        {/if}
        {#if !cell.black && cell.letter !== null}
          <span
            class="absolute inset-0 flex items-center justify-center text-lg font-bold text-gray-800"
          >
            {cell.letter}
          </span>
        {/if}
        {#if cell.separatorRight === 'space'}
          <div class="absolute right-0 top-0 h-full w-0.5 bg-gray-800"></div>
        {:else if cell.separatorRight === 'hyphen'}
          <div class="absolute right-0 top-0 z-10 h-full w-5 translate-x-1/2 translate-y-[-3px] flex items-center justify-center text-5xl leading-none text-gray-800">-</div>
        {/if}
        {#if cell.separatorBottom === 'space'}
          <div class="absolute bottom-0 left-0 h-0.5 w-full bg-gray-800"></div>
        {:else if cell.separatorBottom === 'hyphen'}
          <div class="absolute bottom-0 left-0 z-10 h-5 w-full translate-y-1/2 translate-x-[3px] flex items-center justify-center rotate-90 text-5xl leading-none text-gray-800">-</div>
        {/if}
      </div>
    {/each}
  {/each}
</div>

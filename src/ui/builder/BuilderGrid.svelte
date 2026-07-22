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
      case 'correct':
        return 'bg-green-200';
      case 'incorrect':
        return 'bg-red-200';
      case 'none':
      default:
        return 'bg-white';
    }
  }
</script>

<div class="inline-block select-none">
  <table class="border-collapse">
    <tbody>
      {#each vm.cells as row}
        <tr>
          {#each row as cell}
            <td
              class="relative h-10 w-10 border border-gray-300 {cell.black
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
              {#if cell.separatorRight !== 'none'}
                <div
                  class="absolute right-0 top-1/2 -translate-y-1/2 text-center text-xs text-gray-800 {cell.separatorRight ===
                  'space'
                    ? 'h-6 w-1 bg-gray-800'
                    : 'h-6 w-3 bg-transparent'}"
                >
                  {cell.separatorRight === 'hyphen' ? '-' : ''}
                </div>
              {/if}
              {#if cell.separatorBottom !== 'none'}
                <div
                  class="absolute bottom-0 left-1/2 -translate-x-1/2 text-center text-xs text-gray-800 {cell.separatorBottom ===
                  'space'
                    ? 'h-1 w-6 bg-gray-800'
                    : 'h-3 w-6 bg-transparent'}"
                >
                  {cell.separatorBottom === 'hyphen' ? '-' : ''}
                </div>
              {/if}
            </td>
          {/each}
        </tr>
      {/each}
    </tbody>
  </table>
</div>

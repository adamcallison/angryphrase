<script lang="ts">
  import type { CellProps } from "../lib/types";

  let {
    isBlack,
    letter,
    number,
    isSelected,
    isHighlighted,
    spaceRight,
    spaceBottom,
    hyphenRight,
    hyphenBottom,
    row,
    col,
  }: CellProps = $props();
</script>

{#if isBlack}
  <div
    class="w-[40px] h-[40px] bg-black border border-gray-700 box-border"
    data-row={row}
    data-col={col}
  ></div>
{:else}
  <div
    class="relative w-[40px] h-[40px] border border-gray-300 box-border flex items-center justify-center select-none
      {isSelected ? 'bg-yellow-300' : isHighlighted ? 'bg-yellow-100' : 'bg-white'}"
    data-row={row}
    data-col={col}
  >
    {#if number !== null}
      <span
        class="absolute top-px left-0.5 text-[10px] leading-none text-gray-600 select-none pointer-events-none"
      >
        {number}
      </span>
    {/if}
    {#if letter !== null}
      <span class="text-lg font-bold select-none pointer-events-none">{letter}</span>
    {/if}
    {#if spaceRight}
      <div
        class="absolute top-0 bottom-0 right-0 w-[2px] bg-gray-700 pointer-events-none"
      ></div>
    {/if}
    {#if spaceBottom}
      <div
        class="absolute left-0 right-0 bottom-0 h-[2px] bg-gray-700 pointer-events-none"
      ></div>
    {/if}
    {#if hyphenRight}
      <span
        class="absolute top-1/2 right-px -translate-y-1/2 text-[10px] leading-none text-gray-600 font-bold select-none pointer-events-none"
      >-</span>
    {/if}
    {#if hyphenBottom}
      <span
        class="absolute left-1/2 bottom-px -translate-x-1/2 text-[10px] leading-none text-gray-600 font-bold select-none pointer-events-none"
      >-</span>
    {/if}
  </div>
{/if}
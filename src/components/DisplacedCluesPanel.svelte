<script lang="ts">
  import type { DisplacedClue } from "../lib/types";

  let {
    displacedClues,
    reattachMode,
    selectedClueIndex,
    onReattachClick,
    onDelete,
  }: {
    displacedClues: DisplacedClue[];
    reattachMode: boolean;
    selectedClueIndex: number | null;
    onReattachClick: (clueIndex: number) => void;
    onDelete: (clueIndex: number) => void;
  } = $props();
</script>

<div class="flex flex-col gap-2">
  <h3 class="text-sm font-semibold text-gray-700">Displaced Clues</h3>

  {#if displacedClues.length === 0}
    <p class="text-xs text-gray-400 italic">No displaced clues</p>
  {:else}
    <ul class="flex flex-col gap-1.5">
      {#each displacedClues as clue, index (clue.id)}
        <li
          class="flex items-start gap-2 px-2 py-1.5 rounded border text-sm
            {reattachMode && selectedClueIndex === index
              ? 'border-amber-400 bg-amber-50'
              : 'border-gray-200 bg-gray-50'}"
        >
          <button
            type="button"
            class="flex-1 text-left hover:underline cursor-pointer
              {reattachMode && selectedClueIndex === index
              ? 'text-amber-800 font-medium'
              : 'text-gray-700'}"
            onclick={() => onReattachClick(index)}
          >
            <span class="capitalize">{clue.direction}</span>: {clue.clue}
          </button>
          <button
            type="button"
            class="text-gray-400 hover:text-red-600 text-base leading-none shrink-0 mt-0.5"
            title="Delete displaced clue"
            onclick={() => onDelete(index)}
          >
            ✕
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>
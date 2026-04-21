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

<div class="displaced-panel">
  <h3 class="displaced-panel__heading">Displaced Clues</h3>

  {#if displacedClues.length === 0}
    <p class="displaced-panel__empty">No displaced clues</p>
  {:else}
    <ul class="displaced-panel__list">
      {#each displacedClues as clue, index (clue.id)}
        <li
          class="displaced-clue {reattachMode && selectedClueIndex === index ? 'displaced-clue--selected' : 'displaced-clue--default'}"
        >
          <button
            type="button"
            class="displaced-clue__reattach {reattachMode && selectedClueIndex === index ? 'displaced-clue__reattach--active' : ''}"
            onclick={() => onReattachClick(index)}
          >
            <span class="capitalize">{clue.direction}</span>: {clue.clue}
          </button>
          <button
            type="button"
            class="displaced-clue__delete"
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

<style>
  .displaced-panel {
    display: flex;
    flex-direction: column;
    gap: 0.5rem; /* gap-2 */
  }

  .displaced-panel__heading {
    font-size: 0.875rem; /* text-sm */
    font-weight: 600; /* font-semibold */
    color: #374151; /* gray-700 */
  }

  .displaced-panel__empty {
    font-size: 0.75rem; /* text-xs */
    color: #9ca3af; /* gray-400 */
    font-style: italic;
  }

  .displaced-panel__list {
    display: flex;
    flex-direction: column;
    gap: 0.375rem; /* gap-1.5 */
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .displaced-clue {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem; /* gap-2 */
    padding: 0.375rem 0.5rem; /* py-1.5 px-2 */
    border-radius: 0.25rem; /* rounded */
    border: 1px solid transparent;
    font-size: 0.875rem; /* text-sm */
  }

  .displaced-clue--selected {
    border-color: #fbbf24; /* amber-400 */
    background: #fffbeb; /* amber-50 */
  }

  .displaced-clue--default {
    border-color: #e5e7eb; /* gray-200 */
    background: #f9fafb; /* gray-50 */
  }

  .displaced-clue__reattach {
    flex: 1;
    text-align: left;
    cursor: pointer;
    background: none;
    border: none;
    padding: 0;
    font-size: inherit;
  }

  .displaced-clue__reattach:hover {
    text-decoration: underline;
  }

  .displaced-clue__reattach--active {
    color: #92400e; /* amber-800 */
    font-weight: 500; /* font-medium */
  }

  .displaced-clue__delete {
    color: #9ca3af; /* gray-400 */
    font-size: 1rem; /* text-base */
    line-height: 1;
    flex-shrink: 0;
    margin-top: 0.125rem; /* mt-0.5 */
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
  }

  .displaced-clue__delete:hover {
    color: #dc2626; /* red-600 */
  }

  .capitalize {
    text-transform: capitalize;
  }
</style>